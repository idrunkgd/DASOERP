import { prisma } from "@/lib/db";
import { requirePermission, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { TimesheetGrid } from "./timesheet-grid";
import { PdfExportButton } from "./pdf-export-button";
import { startOfWeek, addDays, format, parseISO } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TimesheetPage({ searchParams }: { searchParams: { week?: string; userId?: string } }) {
  const session = await requirePermission("timesheet.self.write");
  const today = searchParams.week ? parseISO(searchParams.week) : new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const sessionPerms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canValidateTs = sessionPerms.includes("timesheet.validate");

  // Mode admin : ?userId=xxx pour saisir/consulter le timesheet d'un autre user.
  // Seuls les valideurs (Admin/Manager/Ops) peuvent impersonate.
  const impersonatedUserId = searchParams.userId && canValidateTs && searchParams.userId !== session.user.id
    ? searchParams.userId
    : null;
  const effectiveUserId = impersonatedUserId ?? session.user.id;

  // Info du user cible (pour affichage banner "Timesheet de X")
  const targetUser = impersonatedUserId
    ? await prisma.user.findUnique({
        where: { id: impersonatedUserId },
        select: { id: true, firstName: true, lastName: true, email: true, role: true }
      })
    : null;

  // Liste des consultants sélectionnables pour l'admin (tous users actifs)
  const consultants = canValidateTs
    ? await prisma.user.findMany({
        where: { active: true },
        select: { id: true, firstName: true, lastName: true, role: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
      })
    : [];

  // Visibilité : projets/missions filtrés selon l'utilisateur CIBLE (pas la session)
  // Les valideurs voient tous les projets actifs de toute façon.
  const projectsWhere: any = { status: { in: ["TO_START", "ACTIVE", "ON_HOLD"] } };
  if (!canValidateTs) projectsWhere.members = { some: { userId: effectiveUserId } };

  const missionsWhere: any = { status: { in: ["ACTIVE", "EXTENDED", "PLANNED"] } };
  if (!canValidateTs) missionsWhere.consultantId = effectiveUserId;

  const [entries, projects, missions, costCenters, historicalEntries] = await Promise.all([
    prisma.timesheetEntry.findMany({
      where: { userId: effectiveUserId, date: { gte: weekStart, lt: weekEnd } },
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
    prisma.costCenter.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    // Toutes les cibles distinctes sur lesquelles le consultant a déjà saisi (pour dropdown filtre PDF)
    prisma.timesheetEntry.findMany({
      where: { userId: effectiveUserId },
      select: {
        projectId: true, missionId: true, costCenterId: true,
        project: { select: { reference: true, name: true, company: { select: { name: true } } } },
        mission: { select: { reference: true, title: true, company: { select: { name: true } } } },
        costCenter: { select: { code: true, name: true } }
      },
      distinct: ["projectId", "missionId", "costCenterId"]
    })
  ]);

  // Aplatir en liste unique pour le dropdown PDF
  const pdfTargetsMap = new Map<string, { key: string; label: string; type: "PRJ" | "MIS" | "CC"; client?: string }>();
  for (const e of historicalEntries) {
    if (e.projectId && e.project) {
      const key = `PRJ:${e.projectId}`;
      pdfTargetsMap.set(key, { key, label: `${e.project.reference} — ${e.project.name}`, type: "PRJ", client: e.project.company?.name });
    } else if (e.missionId && e.mission) {
      const key = `MIS:${e.missionId}`;
      pdfTargetsMap.set(key, { key, label: `${e.mission.reference} — ${e.mission.title}`, type: "MIS", client: e.mission.company?.name });
    } else if (e.costCenterId && e.costCenter) {
      const key = `CC:${e.costCenterId}`;
      pdfTargetsMap.set(key, { key, label: `${e.costCenter.code} — ${e.costCenter.name}`, type: "CC" });
    }
  }
  const pdfTargets = Array.from(pdfTargetsMap.values()).sort((a, b) => {
    const order = { PRJ: 0, MIS: 1, CC: 2 };
    if (order[a.type] !== order[b.type]) return order[a.type] - order[b.type];
    return a.label.localeCompare(b.label);
  });

  const prevWeek = format(addDays(weekStart, -7), "yyyy-MM-dd");
  const nextWeek = format(addDays(weekStart, 7), "yyyy-MM-dd");
  const totalWeek = entries.reduce((s, e) => s + Number(e.hours), 0);

  const impersonateQs = impersonatedUserId ? `&userId=${impersonatedUserId}` : "";
  const title = targetUser
    ? `Timesheet — ${targetUser.firstName} ${targetUser.lastName}`
    : "Mon timesheet";
  const subtitle = `Semaine du ${format(weekStart, "dd/MM/yyyy")} — ${totalWeek.toFixed(1)}h saisies`;

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <Link href={`/timesheet?week=${prevWeek}${impersonateQs}`} className="btn-secondary">← Sem. précédente</Link>
            <Link href={`/timesheet${impersonatedUserId ? `?userId=${impersonatedUserId}` : ""}`} className="btn-ghost">Aujourd'hui</Link>
            <Link href={`/timesheet?week=${nextWeek}${impersonateQs}`} className="btn-secondary">Sem. suivante →</Link>
            <Link href="/timesheet/validation" className="btn-secondary">À valider</Link>
            <PdfExportButton
              weekStartISO={format(weekStart, "yyyy-MM-dd")}
              onBehalfOfUserId={impersonatedUserId}
              targets={pdfTargets}
            />
            <a href={`/api/exports/timesheet?from=${format(weekStart, "yyyy-MM-dd")}&to=${format(weekEnd, "yyyy-MM-dd")}${impersonatedUserId ? `&userId=${impersonatedUserId}` : ""}`} className="btn-secondary" title="Export CSV">CSV</a>
          </>
        }
      />

      {/* Bandeau impersonation : visible en mode admin */}
      {canValidateTs && (
        <div className="card p-3 mb-4 bg-amber-50/40 border-amber-200/60 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            {impersonatedUserId ? (
              <>
                <span className="font-semibold text-amber-900">Mode saisie déléguée</span>
                <span className="text-amber-800"> — vous saisissez le timesheet de </span>
                <span className="font-semibold">{targetUser?.firstName} {targetUser?.lastName}</span>
                <span className="text-amber-700 text-xs"> ({targetUser?.email})</span>
              </>
            ) : (
              <span className="text-midnight-700">
                <span className="font-semibold">Saisir pour un consultant</span> — vous pouvez remplir le timesheet d'un autre utilisateur (une entrée dans le journal d'audit sera tracée).
              </span>
            )}
          </div>
          <form action="/timesheet" method="get" className="flex items-center gap-2">
            <input type="hidden" name="week" value={format(weekStart, "yyyy-MM-dd")} />
            <select
              name="userId"
              defaultValue={impersonatedUserId ?? ""}
              className="input h-8 text-sm min-w-[240px]"
            >
              <option value="">— Mon timesheet —</option>
              {consultants.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === session.user.id}>
                  {c.firstName} {c.lastName} {c.id === session.user.id ? "(moi)" : ""}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary btn-sm">Ouvrir</button>
          </form>
        </div>
      )}

      <TimesheetGrid
        weekStartISO={format(weekStart, "yyyy-MM-dd")}
        onBehalfOfUserId={impersonatedUserId}
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
