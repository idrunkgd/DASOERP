import { prisma } from "@/lib/db";
import { requirePermission, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { TimesheetGrid } from "./timesheet-grid";
import { startOfWeek, addDays, format, parseISO } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TimesheetPage({ searchParams }: { searchParams: { week?: string } }) {
  const session = await requirePermission("timesheet.self.write");
  const today = searchParams.week ? parseISO(searchParams.week) : new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const userId = session.user.id;
  const sessionPerms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canValidateTs = sessionPerms.includes("timesheet.validate");

  // Visibilité : on ne montre que les projets dont l'utilisateur fait partie de l'équipe.
  // Les Admins/Managers sont autorisés à voir tous les projets actifs (pour leurs propres saisies).
  const projectsWhere: any = { status: { in: ["TO_START", "ACTIVE", "ON_HOLD"] } };
  if (!canValidateTs) projectsWhere.members = { some: { userId } };

  const missionsWhere: any = { status: { in: ["ACTIVE", "EXTENDED", "PLANNED"] } };
  if (!canValidateTs) missionsWhere.consultantId = userId;

  const [entries, projects, missions, costCenters] = await Promise.all([
    prisma.timesheetEntry.findMany({
      where: { userId, date: { gte: weekStart, lt: weekEnd } },
      include: { project: true, mission: true, costCenter: true },
      orderBy: { date: "asc" }
    }),
    prisma.project.findMany({
      where: projectsWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true, reference: true, company: { select: { name: true } } }
    }),
    prisma.mission.findMany({
      where: missionsWhere,
      orderBy: { reference: "desc" },
      select: { id: true, reference: true, title: true, company: { select: { name: true } } }
    }),
    prisma.costCenter.findMany({ where: { active: true }, orderBy: { code: "asc" } })
  ]);

  const prevWeek = format(addDays(weekStart, -7), "yyyy-MM-dd");
  const nextWeek = format(addDays(weekStart, 7), "yyyy-MM-dd");
  const totalWeek = entries.reduce((s, e) => s + Number(e.hours), 0);

  return (
    <div>
      <PageHeader
        title="Mon timesheet"
        subtitle={`Semaine du ${format(weekStart, "dd/MM/yyyy")} — ${totalWeek.toFixed(1)}h saisies`}
        actions={
          <>
            <Link href={`/timesheet?week=${prevWeek}`} className="btn-secondary">← Sem. précédente</Link>
            <Link href="/timesheet" className="btn-ghost">Aujourd'hui</Link>
            <Link href={`/timesheet?week=${nextWeek}`} className="btn-secondary">Sem. suivante →</Link>
            <Link href="/timesheet/validation" className="btn-secondary">À valider</Link>
            <a href={`/api/exports/timesheet?from=${format(weekStart, "yyyy-MM-dd")}&to=${format(weekEnd, "yyyy-MM-dd")}`} className="btn-secondary">Export</a>
          </>
        }
      />
      <TimesheetGrid
        weekStartISO={format(weekStart, "yyyy-MM-dd")}
        entries={entries.map(e => ({
          id: e.id,
          date: format(e.date, "yyyy-MM-dd"),
          hours: Number(e.hours),
          activityType: e.activityType,
          description: e.description,
          status: e.status,
          targetType: e.projectId ? "PRJ" : e.missionId ? "MIS" : "CC",
          targetId: (e.projectId ?? e.missionId ?? e.costCenterId) as string
        }))}
        projects={projects}
        missions={missions}
        costCenters={costCenters as any}
      />
    </div>
  );
}
