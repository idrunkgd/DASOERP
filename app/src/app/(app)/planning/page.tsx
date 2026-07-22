import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { startOfMonth, endOfMonth, addMonths, format, parseISO } from "date-fns";
import Link from "next/link";
import { MonthGrid } from "./month-grid";

export const dynamic = "force-dynamic";

export default async function PlanningPage({ searchParams }: { searchParams: { month?: string; userId?: string } }) {
  await requirePermission("planning.read");
  const ref = searchParams.month ? parseISO(searchParams.month + "-01") : new Date();
  const monthStart = startOfMonth(ref);
  const monthEnd = endOfMonth(ref);

  const where: any = { startDate: { lte: monthEnd }, endDate: { gte: monthStart } };
  if (searchParams.userId) where.userId = searchParams.userId;

  const overlapWhere = { startDate: { lte: monthEnd }, endDate: { gte: monthStart } };
  const [entries, users, projects, costCenters, leaves, sickLeaves] = await Promise.all([
    prisma.planningEntry.findMany({
      where,
      include: { user: true, project: { include: { company: true } }, costCenter: true },
      orderBy: { startDate: "asc" }
    }),
    prisma.user.findMany({ where: { active: true, candidateProfile: { is: null } }, orderBy: [{ firstName: "asc" }] }),
    prisma.project.findMany({ where: { status: { in: ["TO_START","ACTIVE","ON_HOLD"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, reference: true, company: { select: { name: true } } } }),
    prisma.costCenter.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    // Congés SUBMITTED (en attente) + APPROVED (validés) qui touchent le mois
    prisma.leaveRequest.findMany({
      where: {
        ...overlapWhere,
        ...(searchParams.userId ? { userId: searchParams.userId } : {}),
        status: { in: ["SUBMITTED", "APPROVED"] }
      },
      select: { id: true, userId: true, startDate: true, endDate: true, status: true, type: true }
    }),
    // Arrêts maladie qui touchent le mois
    prisma.sickLeave.findMany({
      where: {
        ...overlapWhere,
        ...(searchParams.userId ? { userId: searchParams.userId } : {})
      },
      select: { id: true, userId: true, startDate: true, endDate: true, reason: true }
    })
  ]);

  const prevMonth = format(addMonths(monthStart, -1), "yyyy-MM");
  const nextMonth = format(addMonths(monthStart, 1), "yyyy-MM");

  return (
    <div>
      <PageHeader
        title="Planning"
        subtitle={`${format(monthStart, "MMMM yyyy")} — sélectionnez plusieurs jours sur une ligne pour assigner un projet ou un centre de coût`}
        actions={
          <>
            <Link href={`/planning?month=${prevMonth}`} className="btn-secondary">← Mois précédent</Link>
            <Link href="/planning" className="btn-ghost">Aujourd'hui</Link>
            <Link href={`/planning?month=${nextMonth}`} className="btn-secondary">Mois suivant →</Link>
          </>
        }
      />
      <MonthGrid
        monthStartISO={format(monthStart, "yyyy-MM-dd")}
        users={users.map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, weeklyCapacityH: Number(u.weeklyCapacityH) }))}
        entries={entries.map(e => ({
          id: e.id, userId: e.userId,
          startDate: format(e.startDate, "yyyy-MM-dd"),
          endDate: format(e.endDate, "yyyy-MM-dd"),
          hoursPerDay: e.hoursPerDay ? Number(e.hoursPerDay) : null,
          loadPct: e.loadPct ? Number(e.loadPct) : null,
          activityType: e.activityType,
          comment: e.comment,
          targetType: e.projectId ? "PRJ" : "CC",
          targetId: (e.projectId ?? e.costCenterId) as string,
          targetLabel: e.project ? `${e.project.reference} ${e.project.name}` : (e.costCenter ? `${e.costCenter.code} ${e.costCenter.name}` : "—")
        }))}
        projects={projects}
        costCenters={costCenters as any}
        overlays={[
          ...leaves.map((l) => ({
            id: `leave-${l.id}`,
            userId: l.userId,
            startDate: format(l.startDate, "yyyy-MM-dd"),
            endDate: format(l.endDate, "yyyy-MM-dd"),
            kind: l.status === "APPROVED"
              ? ("leave-approved" as const)
              : ("leave-pending" as const),
            label: l.status === "APPROVED"
              ? `Congé validé (${l.type})`
              : `Congé demandé (${l.type})`
          })),
          ...sickLeaves.map((s) => ({
            id: `sick-${s.id}`,
            userId: s.userId,
            startDate: format(s.startDate, "yyyy-MM-dd"),
            endDate: format(s.endDate, "yyyy-MM-dd"),
            kind: "sick" as const,
            label: s.reason ? `Maladie — ${s.reason}` : "Arrêt maladie"
          }))
        ]}
      />
    </div>
  );
}
