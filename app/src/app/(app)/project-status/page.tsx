import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Gauge, AlertTriangle, FolderKanban, CheckCircle2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { RemainingInput } from "./remaining-input";

export const dynamic = "force-dynamic";

export default async function ProjectStatusPage({
  searchParams
}: {
  searchParams: { all?: string; q?: string };
}) {
  // Page accessible à tout utilisateur authentifié non-Visiteur.
  // Le layout (app)/layout.tsx redirige déjà les Visiteurs vers /me.
  await requirePermissionOrRedirect("projects.read");

  const showAll = searchParams.all === "1";
  const where: any = showAll
    ? {}
    : { status: { in: ["TO_START", "ACTIVE", "ON_HOLD"] } };
  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q, mode: "insensitive" } },
      { reference: { contains: searchParams.q, mode: "insensitive" } }
    ];
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      company: true,
      manager: true,
      remainingUpdatedBy: true
    },
    orderBy: [{ status: "asc" }, { reference: "asc" }]
  });

  // Heures saisies, par projet et statut (on exclut REJECTED).
  // On compte donc DRAFT + SUBMITTED + APPROVED — pour avoir une vision
  // réaliste de la consommation, même quand les timesheets ne sont pas
  // encore validés.
  const projectIds = projects.map((p) => p.id);
  const hoursAgg =
    projectIds.length === 0
      ? []
      : await prisma.timesheetEntry.groupBy({
          by: ["projectId", "status"],
          where: {
            projectId: { in: projectIds },
            status: { not: "REJECTED" }
          },
          _sum: { hours: true }
        });

  const hoursByProject = new Map<
    string,
    { approved: number; pending: number; total: number }
  >();
  for (const row of hoursAgg) {
    if (!row.projectId) continue;
    const cur = hoursByProject.get(row.projectId) ?? {
      approved: 0,
      pending: 0,
      total: 0
    };
    const h = Number(row._sum.hours ?? 0);
    if (row.status === "APPROVED") cur.approved += h;
    else cur.pending += h; // DRAFT + SUBMITTED
    cur.total += h;
    hoursByProject.set(row.projectId, cur);
  }

  // Agrégats
  let totalSold = 0;
  let totalUsed = 0;
  let totalApproved = 0;
  let totalPending = 0;
  let totalRemaining = 0;
  let countOver = 0;
  let countWarn = 0;

  const rows = projects.map((p) => {
    const sold = Number(p.budgetTimeH);
    const h = hoursByProject.get(p.id) ?? { approved: 0, pending: 0, total: 0 };
    const used = h.total; // approuvées + en attente
    const remaining = Number(p.remainingTimeH);
    const estimated = used + remaining;
    const overrun = estimated - sold;
    const overrunPct = sold > 0 ? (overrun / sold) * 100 : 0;
    const usedPct = sold > 0 ? Math.min(100, (used / sold) * 100) : 0;
    const estimatedPct = sold > 0 ? Math.min(100, (estimated / sold) * 100) : 0;

    const isOver = sold > 0 && estimated > sold;
    const isWarn = !isOver && sold > 0 && estimated >= sold * 0.9;

    totalSold += sold;
    totalUsed += used;
    totalApproved += h.approved;
    totalPending += h.pending;
    totalRemaining += remaining;
    if (isOver) countOver++;
    if (isWarn) countWarn++;

    return {
      project: p,
      sold,
      used,
      approved: h.approved,
      pending: h.pending,
      remaining,
      estimated,
      overrun,
      overrunPct,
      usedPct,
      estimatedPct,
      isOver,
      isWarn
    };
  });

  const totalEstimated = totalUsed + totalRemaining;

  return (
    <div>
      <PageHeader
        title="Statut projet"
        subtitle="Suivi des heures vendues vs heures consommées + reste à faire"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={showAll ? "/project-status" : "/project-status?all=1"}
              className="btn-secondary text-xs"
            >
              {showAll ? "Projets en cours" : "Voir tous les projets"}
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Heures vendues"
          value={`${totalSold.toFixed(0)}h`}
          hint={`${rows.length} projet(s)`}
          icon={FolderKanban}
        />
        <KpiCard
          label="Heures consommées"
          value={`${totalUsed.toFixed(0)}h`}
          hint={`${totalApproved.toFixed(0)}h validées · ${totalPending.toFixed(0)}h en attente`}
          icon={Gauge}
        />
        <KpiCard
          label="Reste à faire"
          value={`${totalRemaining.toFixed(0)}h`}
          hint={`Total estimé : ${totalEstimated.toFixed(0)}h`}
          icon={Gauge}
          tone="info"
        />
        <KpiCard
          label="Projets en dépassement"
          value={countOver}
          hint={countWarn > 0 ? `${countWarn} à surveiller (≥90%)` : "Tout va bien"}
          icon={AlertTriangle}
          tone={countOver > 0 ? "danger" : countWarn > 0 ? "warning" : "success"}
        />
      </div>

      <form className="mb-4 flex gap-2 flex-wrap">
        {showAll && <input type="hidden" name="all" value="1" />}
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Réf, nom..."
          className="input max-w-xs"
        />
        <button className="btn-secondary">Filtrer</button>
      </form>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="Aucun projet"
            description={
              showAll
                ? "Aucun projet n'a encore été créé."
                : "Aucun projet en cours. Cliquez sur « Voir tous les projets » pour inclure les projets terminés."
            }
          />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Réf</th>
                <th>Projet</th>
                <th>Client</th>
                <th>Statut</th>
                <th className="text-right">Vendu</th>
                <th className="text-right">Passé</th>
                <th className="text-right">Reste à faire</th>
                <th className="text-right">Total estimé</th>
                <th>Avancement</th>
                <th>Maj reste</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(
                ({
                  project: p,
                  sold,
                  used,
                  approved,
                  pending,
                  remaining,
                  estimated,
                  overrun,
                  overrunPct,
                  usedPct,
                  estimatedPct,
                  isOver,
                  isWarn
                }) => (
                  <tr
                    key={p.id}
                    className={cn(
                      isOver && "bg-red-50/60",
                      isWarn && "bg-amber-50/40"
                    )}
                  >
                    <td className="font-mono text-xs">{p.reference}</td>
                    <td>
                      <Link
                        href={`/projects/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                      {isOver && (
                        <AlertTriangle className="w-3 h-3 text-red-600 inline ml-1" />
                      )}
                    </td>
                    <td className="text-midnight-700">{p.company.name}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="text-right tabular-nums">
                      {sold.toFixed(1)}h
                    </td>
                    <td
                      className="text-right tabular-nums"
                      title={`${approved.toFixed(1)}h validées + ${pending.toFixed(1)}h en attente`}
                    >
                      {used.toFixed(1)}h
                      {pending > 0 && (
                        <div className="text-[10px] text-amber-700 font-normal">
                          dont {pending.toFixed(1)}h en attente
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      <RemainingInput
                        projectId={p.id}
                        initialValue={remaining}
                      />
                    </td>
                    <td
                      className={cn(
                        "text-right tabular-nums font-medium",
                        isOver && "text-red-700",
                        isWarn && "text-amber-700"
                      )}
                    >
                      {estimated.toFixed(1)}h
                      {sold > 0 && (
                        <div className="text-[10px] font-normal text-midnight-500">
                          {isOver ? (
                            <>+{overrun.toFixed(1)}h ({overrunPct.toFixed(0)}%)</>
                          ) : (
                            <>{((estimated / sold) * 100).toFixed(0)}% du vendu</>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="min-w-[140px]">
                      <ProgressBar
                        usedPct={usedPct}
                        estimatedPct={estimatedPct}
                        isOver={isOver}
                        isWarn={isWarn}
                      />
                    </td>
                    <td className="text-xs text-midnight-500">
                      {p.remainingUpdatedAt ? (
                        <div>
                          <div>{formatDate(p.remainingUpdatedAt)}</div>
                          {p.remainingUpdatedBy && (
                            <div className="text-[10px]">
                              {p.remainingUpdatedBy.firstName}{" "}
                              {p.remainingUpdatedBy.lastName[0]}.
                            </div>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-midnight-500 flex items-start gap-2">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Les <strong>heures passées</strong> incluent toutes les saisies
          timesheet non rejetées (brouillons + soumises + validées). Le{" "}
          <strong>« reste à faire »</strong> est saisi par l'équipe. Total
          estimé = passé + reste à faire. Une ligne devient{" "}
          <span className="font-medium text-red-700">rouge</span> si ce total
          dépasse les heures vendues.
        </span>
      </p>
    </div>
  );
}

function ProgressBar({
  usedPct,
  estimatedPct,
  isOver,
  isWarn
}: {
  usedPct: number;
  estimatedPct: number;
  isOver: boolean;
  isWarn: boolean;
}) {
  const usedColor = isOver
    ? "bg-red-500"
    : isWarn
    ? "bg-amber-500"
    : "bg-emerald-500";
  const estimatedColor = isOver
    ? "bg-red-300"
    : isWarn
    ? "bg-amber-300"
    : "bg-emerald-300";
  return (
    <div className="w-full h-2 bg-midnight-100 rounded overflow-hidden relative">
      <div
        className={cn("absolute inset-y-0 left-0", estimatedColor)}
        style={{ width: `${Math.min(100, estimatedPct)}%` }}
      />
      <div
        className={cn("absolute inset-y-0 left-0", usedColor)}
        style={{ width: `${Math.min(100, usedPct)}%` }}
      />
    </div>
  );
}
