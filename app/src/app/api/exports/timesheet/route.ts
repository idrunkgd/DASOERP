import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { csvResponse, toCSV } from "@/lib/csv";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await requirePermission("timesheet.self.write");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const onlyMine = req.nextUrl.searchParams.get("scope") !== "all";
  const where: any = {};
  if (from) where.date = { ...(where.date ?? {}), gte: new Date(from) };
  if (to)   where.date = { ...(where.date ?? {}), lt:  new Date(to) };
  if (onlyMine) where.userId = session.user.id;

  const entries = await prisma.timesheetEntry.findMany({
    where, include: { user: true, project: { include: { company: true } } }, orderBy: { date: "asc" }
  });
  const csv = toCSV(entries.map(e => ({
    date: e.date.toISOString().slice(0, 10),
    user: `${e.user.firstName} ${e.user.lastName}`,
    project: e.project.reference + " — " + e.project.name,
    client: e.project.company.name,
    activity: e.activityType,
    hours: Number(e.hours),
    cost: Number(e.computedCost ?? 0),
    status: e.status,
    description: e.description ?? ""
  })));
  return csvResponse(`timesheet-${(from ?? "").slice(0,10)}_${(to ?? "").slice(0,10)}.csv`, csv);
}
