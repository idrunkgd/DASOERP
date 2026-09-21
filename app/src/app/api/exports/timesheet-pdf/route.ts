/**
 * Export PDF timesheet hebdomadaire.
 * GET /api/exports/timesheet-pdf?week=YYYY-MM-DD[&userId=xxx][&inline=1][&notes=...]
 *
 * ACL :
 * - Un consultant peut télécharger son PROPRE timesheet (userId = session ou absent)
 * - Un valideur (Admin/Manager/Ops · permission timesheet.validate) peut télécharger
 *   celui de n'importe quel autre utilisateur en passant ?userId=...
 *
 * Le PDF contient une semaine complète (lun→dim), tableau des entrées, totaux,
 * statuts, zone signatures. Format A4 paysage.
 */
import { NextRequest } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { TimesheetPdf, type TimesheetPdfData, type TimesheetPdfEntry } from "@/lib/timesheet-pdf-template";
import { startOfWeek, addDays, parseISO, format, isSameDay } from "date-fns";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrateur",
  MANAGER: "Manager",
  COMMERCIAL: "Business Developer",
  CONSULTANT: "Consultant",
  FINANCE: "Finance"
};

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const weekParam = req.nextUrl.searchParams.get("week");
  const explicitUserId = req.nextUrl.searchParams.get("userId");
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const notes = req.nextUrl.searchParams.get("notes")?.slice(0, 500) ?? undefined;

  if (!weekParam) return new Response("Missing 'week' param (YYYY-MM-DD)", { status: 400 });
  const anchor = parseISO(weekParam);
  if (isNaN(anchor.getTime())) return new Response("Invalid 'week' param", { status: 400 });

  // Résolution du user cible
  let targetUserId = session.user.id;
  if (explicitUserId && explicitUserId !== session.user.id) {
    const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
    if (!perms.includes("timesheet.validate")) {
      return new Response("Forbidden — permission timesheet.validate required", { status: 403 });
    }
    targetUserId = explicitUserId;
  }

  // Charger l'utilisateur cible + les entrées de la semaine
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

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);

  const entries = await prisma.timesheetEntry.findMany({
    where: { userId: targetUserId, date: { gte: weekStart, lt: weekEnd } },
    include: {
      project: { include: { company: { select: { name: true } } } },
      mission: { include: { company: { select: { name: true } } } },
      costCenter: true
    },
    orderBy: { date: "asc" }
  });

  // Agrégation par target (projet/mission/CC) + par jour
  type RowAcc = {
    key: string;
    targetLabel: string;
    targetType: "PRJ" | "MIS" | "CC";
    targetClient?: string;
    daysHours: number[];
    daysStatus: (string | null)[];
    rowTotal: number;
  };
  const rowsByKey = new Map<string, RowAcc>();

  for (const e of entries) {
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
        key,
        targetLabel: label,
        targetType: type,
        targetClient: client,
        daysHours: Array(7).fill(0),
        daysStatus: Array(7).fill(null),
        rowTotal: 0
      });
    }
    const row = rowsByKey.get(key)!;

    // Index jour (lundi = 0)
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
    // Tri : Projets, puis Missions, puis Centres de coût, puis alpha
    const order = { PRJ: 0, MIS: 1, CC: 2 };
    if (order[a.targetType] !== order[b.targetType]) return order[a.targetType] - order[b.targetType];
    return a.targetLabel.localeCompare(b.targetLabel);
  });

  const dayTotals = Array(7).fill(0);
  for (const r of rows) for (let i = 0; i < 7; i++) dayTotals[i] += r.daysHours[i];
  const weekTotal = dayTotals.reduce((s, v) => s + v, 0);

  const data: TimesheetPdfData = {
    consultantName: `${targetUser.firstName} ${targetUser.lastName}`.trim(),
    consultantEmail: targetUser.email,
    consultantRole: ROLE_LABEL[targetUser.role as string] ?? targetUser.role,
    weekStart,
    weekEnd,
    rows,
    dayTotals,
    weekTotal,
    generatedBy: `${actor?.firstName ?? ""} ${actor?.lastName ?? ""}`.trim() || session.user.id,
    generatedAt: new Date(),
    notes
  };

  try {
    const buffer = await renderToBuffer(React.createElement(TimesheetPdf, { data }) as any);
    const u8 = new Uint8Array(buffer);
    const slug = `${targetUser.firstName}-${targetUser.lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const filename = `Timesheet-${slug}-${format(weekStart, "yyyy-MM-dd")}.pdf`;
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
