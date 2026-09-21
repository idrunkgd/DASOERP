/**
 * Export PDF timesheet — supporte plage de dates ou une semaine unique.
 *
 * GET /api/exports/timesheet-pdf?from=YYYY-MM-DD&to=YYYY-MM-DD[&userId=xxx][&inline=1][&notes=...]
 * GET /api/exports/timesheet-pdf?week=YYYY-MM-DD[&userId=xxx][&inline=1]  ← rétrocompat
 *
 * - `from`/`to` : plage libre. Le PDF génère 1 page A4 paysage par semaine
 *   ISO (lundi → dimanche) couverte par la plage. Les jours hors plage
 *   d'une semaine partielle sont inclus dans le tableau (une entrée hors
 *   plage sera juste absente de la source data).
 * - `week` : rétrocompat — équivaut à from=lundi&to=dimanche+1.
 *
 * ACL :
 * - Consultant : son propre timesheet uniquement
 * - Admin/Manager (permission timesheet.validate) : PDF de n'importe quel user via ?userId=...
 */
import { NextRequest } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { TimesheetPdf, type TimesheetPdfData, type TimesheetPdfEntry, type TimesheetPdfWeek } from "@/lib/timesheet-pdf-template";
import { startOfWeek, addDays, parseISO, format, isSameDay } from "date-fns";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrateur",
  MANAGER: "Manager",
  COMMERCIAL: "Business Developer",
  CONSULTANT: "Consultant",
  FINANCE: "Finance"
};

/** Découpe une plage [from, to) en semaines ISO (lundi 00:00 → lundi 00:00 semaine suivante) */
function splitIntoWeeks(from: Date, to: Date): Array<{ start: Date; end: Date }> {
  const weeks: Array<{ start: Date; end: Date }> = [];
  let cursor = startOfWeek(from, { weekStartsOn: 1 });
  while (cursor < to) {
    const next = addDays(cursor, 7);
    weeks.push({ start: cursor, end: next });
    cursor = next;
  }
  return weeks;
}

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const weekParam = req.nextUrl.searchParams.get("week");
  const explicitUserId = req.nextUrl.searchParams.get("userId");
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const notes = req.nextUrl.searchParams.get("notes")?.slice(0, 500) ?? undefined;
  // "weekly" (défaut) = 1 page/semaine · "monthly" = 1 seule page A4 récap
  const layout = (req.nextUrl.searchParams.get("layout") === "monthly" ? "monthly" : "weekly") as "weekly" | "monthly";
  // "full" (défaut) = toutes les entrées · "client" = uniquement APPROVED (pour envoi client)
  const mode = (req.nextUrl.searchParams.get("mode") === "client" ? "client" : "full") as "full" | "client";

  // Résolution période : from/to prioritaire, sinon week
  let periodStart: Date, periodEnd: Date;
  if (fromParam && toParam) {
    periodStart = parseISO(fromParam);
    periodEnd = addDays(parseISO(toParam), 1); // to inclusif → end exclusif
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      return new Response("Invalid 'from' or 'to' param (YYYY-MM-DD attendu)", { status: 400 });
    }
    if (periodEnd <= periodStart) {
      return new Response("La date de fin doit être ≥ la date de début", { status: 400 });
    }
  } else if (weekParam) {
    const anchor = parseISO(weekParam);
    if (isNaN(anchor.getTime())) return new Response("Invalid 'week' param", { status: 400 });
    periodStart = startOfWeek(anchor, { weekStartsOn: 1 });
    periodEnd = addDays(periodStart, 7);
  } else {
    return new Response("Missing 'from'+'to' or 'week' params", { status: 400 });
  }

  // Garde-fou : max 12 semaines (3 mois) par PDF pour éviter les abus
  const nbDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86400000);
  if (nbDays > 12 * 7) {
    return new Response("Période trop longue — maximum 12 semaines (3 mois)", { status: 400 });
  }

  // ACL user cible
  let targetUserId = session.user.id;
  if (explicitUserId && explicitUserId !== session.user.id) {
    const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
    if (!perms.includes("timesheet.validate")) {
      return new Response("Forbidden — permission timesheet.validate required", { status: 403 });
    }
    targetUserId = explicitUserId;
  }

  const [targetUser, actor] = await Promise.all([
    prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true }
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true }
    })
  ]);
  if (!targetUser) return new Response("User not found", { status: 404 });

  // Récupérer toutes les entrées sur la période
  // En mode "client" : uniquement les entrées APPROVED (validées) → justificatif propre
  const entriesWhere: any = { userId: targetUserId, date: { gte: periodStart, lt: periodEnd } };
  if (mode === "client") entriesWhere.status = "APPROVED";

  const entries = await prisma.timesheetEntry.findMany({
    where: entriesWhere,
    include: {
      project: { include: { company: { select: { name: true } } } },
      mission: { include: { company: { select: { name: true } } } },
      costCenter: true
    },
    orderBy: { date: "asc" }
  });

  // Découper en semaines et agréger par semaine × target × jour
  const weekRanges = splitIntoWeeks(periodStart, periodEnd);
  const weeks: TimesheetPdfWeek[] = [];

  for (const { start: weekStart, end: weekEnd } of weekRanges) {
    type RowAcc = {
      targetLabel: string;
      targetType: "PRJ" | "MIS" | "CC";
      targetClient?: string;
      daysHours: number[];
      daysStatus: (string | null)[];
      rowTotal: number;
    };
    const rowsByKey = new Map<string, RowAcc>();

    const weekEntries = entries.filter((e) => e.date >= weekStart && e.date < weekEnd);
    for (const e of weekEntries) {
      let key: string, label: string, type: "PRJ" | "MIS" | "CC", client: string | undefined;
      if (e.projectId && e.project) {
        key = `PRJ:${e.projectId}`;
        label = `${e.project.reference} — ${e.project.name}`;
        type = "PRJ";
        client = e.project.company?.name;
      } else if (e.missionId && e.mission) {
        key = `MIS:${e.missionId}`;
        label = `${e.mission.reference} — ${e.mission.title}`;
        type = "MIS";
        client = e.mission.company?.name;
      } else if (e.costCenterId && e.costCenter) {
        key = `CC:${e.costCenterId}`;
        label = `${e.costCenter.code} — ${e.costCenter.name}`;
        type = "CC";
      } else {
        continue;
      }

      if (!rowsByKey.has(key)) {
        rowsByKey.set(key, {
          targetLabel: label, targetType: type, targetClient: client,
          daysHours: Array(7).fill(0), daysStatus: Array(7).fill(null), rowTotal: 0
        });
      }
      const row = rowsByKey.get(key)!;

      let dayIdx = -1;
      for (let i = 0; i < 7; i++) {
        if (isSameDay(e.date, addDays(weekStart, i))) { dayIdx = i; break; }
      }
      if (dayIdx < 0) continue;

      row.daysHours[dayIdx] += Number(e.hours);
      row.daysStatus[dayIdx] = e.status;
      row.rowTotal += Number(e.hours);
    }

    const rows: TimesheetPdfEntry[] = Array.from(rowsByKey.values()).sort((a, b) => {
      const order = { PRJ: 0, MIS: 1, CC: 2 };
      if (order[a.targetType] !== order[b.targetType]) return order[a.targetType] - order[b.targetType];
      return a.targetLabel.localeCompare(b.targetLabel);
    });

    const dayTotals = Array(7).fill(0);
    for (const r of rows) for (let i = 0; i < 7; i++) dayTotals[i] += r.daysHours[i];
    const weekTotal = dayTotals.reduce((s, v) => s + v, 0);

    weeks.push({
      weekStart, weekEnd, rows, dayTotals, weekTotal
    });
  }

  const grandTotal = weeks.reduce((s, w) => s + w.weekTotal, 0);

  const data: TimesheetPdfData = {
    consultantName: `${targetUser.firstName} ${targetUser.lastName}`.trim(),
    consultantEmail: targetUser.email,
    consultantRole: ROLE_LABEL[targetUser.role as string] ?? targetUser.role,
    periodStart, periodEnd,
    weeks, grandTotal,
    layout, mode,
    generatedBy: `${actor?.firstName ?? ""} ${actor?.lastName ?? ""}`.trim() || session.user.id,
    generatedAt: new Date(),
    notes
  };

  try {
    const buffer = await renderToBuffer(React.createElement(TimesheetPdf, { data }) as any);
    const u8 = new Uint8Array(buffer);
    const slug = `${targetUser.firstName}-${targetUser.lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const suffix = weeks.length === 1
      ? format(periodStart, "yyyy-MM-dd")
      : `${format(periodStart, "yyyy-MM-dd")}_${format(addDays(periodEnd, -1), "yyyy-MM-dd")}`;
    const prefix = mode === "client" ? "Timesheet-CLIENT" : "Timesheet";
    const filename = `${prefix}-${slug}-${suffix}.pdf`;
    return new Response(u8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "Content-Length": String(u8.length),
        "Cache-Control": "private, no-store"
      }
    });
  } catch (e: any) {
    console.error("Timesheet PDF failed", e);
    return new Response(`PDF generation failed: ${String(e?.message ?? e)}`, {
      status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
