import { prisma } from "@/lib/db";
import { requirePermission, getUserEffectivePermissions } from "@/lib/rbac";
import { csvResponse, toCSV } from "@/lib/csv";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await requirePermission("timesheet.self.write");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const explicitUserId = req.nextUrl.searchParams.get("userId");
  const scopeAll = req.nextUrl.searchParams.get("scope") === "all";
  const where: any = {};
  if (from) where.date = { ...(where.date ?? {}), gte: new Date(from) };
  if (to)   where.date = { ...(where.date ?? {}), lt:  new Date(to) };

  // userId explicite (mode admin) : autorisé uniquement pour valideurs
  if (explicitUserId && explicitUserId !== session.user.id) {
    const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
    if (!perms.includes("timesheet.validate")) throw new Error("Forbidden");
    where.userId = explicitUserId;
  } else if (!scopeAll) {
    where.userId = session.user.id;
  }

  const entries = await prisma.timesheetEntry.findMany({
    where,
    include: {
      user: true,
      project: { include: { company: true } },
      mission: { include: { company: true } },
      costCenter: true
    },
    orderBy: { date: "asc" }
  });
  const csv = toCSV(entries.map(e => ({
    date: e.date.toISOString().slice(0, 10),
    user: `${e.user.firstName} ${e.user.lastName}`,
    project: e.project ? `${e.project.reference} — ${e.project.name}`
      : e.mission ? `${e.mission.reference} — ${e.mission.title}`
      : e.costCenter ? `${e.costCenter.code} — ${e.costCenter.name}`
      : "",
    client: e.project?.company.name ?? e.mission?.company.name ?? "",
    activity: e.activityType,
    hours: Number(e.hours),
    cost: Number(e.computedCost ?? 0),
    status: e.status,
    description: e.description ?? ""
  })));
  return csvResponse(`timesheet-${(from ?? "").slice(0,10)}_${(to ?? "").slice(0,10)}.csv`, csv);
}
