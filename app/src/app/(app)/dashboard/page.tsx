import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect, getUserAccessGroupName, DEFAULT_GROUP_NAME } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { projectsOverBudget } from "@/server/services/project-service";
import { userPlannedHoursForWeek } from "@/server/services/load-service";
import { Briefcase, FolderKanban, Users as UsersIcon, AlertTriangle, Clock, ShoppingCart, FileText, Receipt, Headset, UserPlus, HeartPulse, ReceiptText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  // Requiert dashboard.read explicitement (la perm est dans les groupes par défaut).
  const session = await requirePermissionOrRedirect("dashboard.read");
  // Le getUserAccessGroupName est aussi gardé pour la suite (titre user).
  const groupName = await getUserAccessGroupName(session.user.id);
  if (groupName === DEFAULT_GROUP_NAME) redirect("/me");

  const [
    offersOpen, offersWonYear, offersLostYear,
    activeProjects, allUsers, weekTimesheet, openPurchases,
    upcomingMilestones, overdueMilestones,
    openMissions, candidatesAvailable
  ] = await Promise.all([
    // Offres en cours : on n'affiche que la VERSION COURANTE de chaque chaîne
    // (nextVersion = null) ET on exclut les compléments (parentOfferId = null)
    // pour ne pas compter une V1 quand sa V2 existe déjà.
    prisma.offer.findMany({ where: { status: { in: ["DRAFT","SENT","NEGOTIATION"] }, nextVersion: null, parentOfferId: null } }),
    prisma.offer.count({ where: { status: "WON", closedAt: { gte: new Date(new Date().getFullYear(), 0, 1) }, nextVersion: null, parentOfferId: null } }),
    prisma.offer.count({ where: { status: "LOST", closedAt: { gte: new Date(new Date().getFullYear(), 0, 1) }, nextVersion: null, parentOfferId: null } }),
    prisma.project.findMany({ where: { status: { in: ["TO_START","ACTIVE"] } } }),
    prisma.user.findMany({ where: { active: true, candidateProfile: { is: null } } }),
    prisma.timesheetEntry.aggregate({ _sum: { hours: true }, where: { date: { gte: weekStart() } } }),
    prisma.purchase.aggregate({ _sum: { amount: true }, where: { status: { in: ["PLANNED","ORDERED","RECEIVED"] } } }),
    prisma.billingMilestone.findMany({
      where: { status: { in: ["PLANNED","READY"] }, expectedAt: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 3600 * 1000) } },
      include: { offer: { include: { company: true } }, project: { include: { company: true } } },
      orderBy: { expectedAt: "asc" }, take: 8
    }),
    prisma.billingMilestone.findMany({
      where: { status: { in: ["PLANNED","READY"] }, expectedAt: { lt: new Date() } },
      include: { offer: { include: { company: true } }, project: { include: { company: true } } },
      orderBy: { expectedAt: "asc" }, take: 5
    }),
    // "Missions ouvertes" = les Mission (contrats consultants réellement en
    // cours) actuellement PLANNED, ACTIVE ou EXTENDED. Le comptage
    // précédent portait sur MissionRequest (demandes commerciales) et
    // sous-estimait les vraies missions en cours.
    prisma.mission.count({ where: { status: { in: ["PLANNED", "ACTIVE", "EXTENDED"] } } }),
    prisma.candidate.count({ where: { status: "ACTIVE" } })
  ]);

  // ─── Bloc RH — malades du jour, notes à approuver, timesheets en attente ───
  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const [sickToday, expensesToApprove, timesheetsToValidate] = await Promise.all([
    prisma.sickLeave.findMany({
      where: { startDate: { lte: todayStart }, endDate: { gte: todayStart } },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { endDate: "asc" }
    }),
    prisma.expenseReport.findMany({
      where: { status: "SUBMITTED" },
      include: {
        user: { select: { firstName: true, lastName: true } }
      },
      orderBy: { submittedAt: "asc" },
      take: 8
    }),
    prisma.timesheetEntry.count({ where: { status: "SUBMITTED" } })
  ]);

  const weightedPipeline = offersOpen.reduce((s, o) => s + Number(o.totalSell) * (o.probability / 100), 0);
  const totalPipeline = offersOpen.reduce((s, o) => s + Number(o.totalSell), 0);
  const estimatedMargin = activeProjects.reduce((s, p) => s + Number(p.marginEstimated), 0);
  const actualMargin = activeProjects.reduce((s, p) => s + Number(p.marginActual), 0);

  const overBudget = await projectsOverBudget();

  // Charge équipe
  const loads = await Promise.all(allUsers.map(async (u) => ({
    user: u, planned: await userPlannedHoursForWeek(u.id, new Date())
  })));
  const overloaded = loads.filter(l => l.planned > Number(l.user.weeklyCapacityH));

  return (
    <div>
      <PageHeader
        title={`Bonjour ${session.user.name.split(" ")[0]} 👋`}
        subtitle="Vue d'ensemble Dasolabs"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Pipeline pondéré" value={formatCurrency(weightedPipeline)} hint={`Pipeline brut : ${formatCurrency(totalPipeline)}`} icon={Briefcase} tone="info" />
        <KpiCard label="Offres en cours" value={offersOpen.length} hint={`${offersWonYear} gagnées · ${offersLostYear} perdues (YTD)`} icon={FileText} />
        <KpiCard label="Projets actifs" value={activeProjects.length} hint={`Marge estimée : ${formatCurrency(estimatedMargin)}`} icon={FolderKanban} />
        <KpiCard label="Marge réelle cumulée" value={formatCurrency(actualMargin)} icon={Receipt} tone={actualMargin >= 0 ? "success" : "danger"} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <KpiCard label="Heures cette semaine" value={`${Number(weekTimesheet._sum.hours ?? 0).toFixed(1)}h`} icon={Clock} />
        <KpiCard label="Achats engagés" value={formatCurrency(Number(openPurchases._sum.amount ?? 0))} icon={ShoppingCart} />
        <KpiCard label="Tranches à venir (30j)" value={upcomingMilestones.length} hint={formatCurrency(upcomingMilestones.reduce((s,m) => s + Number(m.amount), 0))} icon={Receipt} />
        <KpiCard label="Utilisateurs actifs" value={allUsers.length} hint={overloaded.length ? `⚠ ${overloaded.length} surchargé(s)` : "Charge OK"} icon={UsersIcon} tone={overloaded.length ? "warning" : "neutral"} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KpiCard label="Missions ouvertes" value={openMissions} icon={Headset} tone="info" />
        <KpiCard label="Candidats disponibles" value={candidatesAvailable} icon={UserPlus} />
      </div>

      {/* ─── RH — vue rapide équipe ─── */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* Malades du jour */}
        <section className={
          "card p-4 " +
          (sickToday.length > 0 ? "border-red-200 bg-red-50/40" : "")
        }>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <HeartPulse className={"w-4 h-4 " + (sickToday.length > 0 ? "text-red-600" : "text-midnight-400")} />
              En arrêt aujourd'hui
            </h2>
            <Link href="/sick-leaves?filter=active" className="text-xs text-indigoaccent hover:underline">
              Voir tout
            </Link>
          </div>
          {sickToday.length === 0 ? (
            <p className="text-xs text-midnight-500">Personne en arrêt 👍</p>
          ) : (
            <ul className="space-y-1.5">
              {sickToday.map((sl) => (
                <li key={sl.id} className="text-sm flex items-center justify-between gap-2">
                  <span className="font-medium text-red-800 truncate">
                    {sl.user.firstName} {sl.user.lastName}
                  </span>
                  <span className="text-[11px] text-red-600 tabular-nums shrink-0">
                    → {sl.endDate.toLocaleDateString("fr-BE")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Notes de frais à approuver */}
        <section className={
          "card p-4 " +
          (expensesToApprove.length > 0 ? "border-amber-200 bg-amber-50/30" : "")
        }>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <ReceiptText className={"w-4 h-4 " + (expensesToApprove.length > 0 ? "text-amber-600" : "text-midnight-400")} />
              Notes de frais à approuver
            </h2>
            <Link href="/expenses?status=SUBMITTED" className="text-xs text-indigoaccent hover:underline">
              Voir tout
            </Link>
          </div>
          {expensesToApprove.length === 0 ? (
            <p className="text-xs text-midnight-500">Aucune note en attente 👌</p>
          ) : (
            <ul className="space-y-1.5">
              {expensesToApprove.slice(0, 6).map((r) => (
                <li key={r.id} className="text-sm flex items-center justify-between gap-2">
                  <span className="truncate">
                    <span className="font-medium">{r.user.firstName} {r.user.lastName}</span>
                    <span className="text-midnight-500 text-xs"> — {r.description}</span>
                  </span>
                  <span className="text-[11px] text-amber-700 tabular-nums shrink-0 font-semibold">
                    {formatCurrency(Number(r.amountTtc))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Timesheets à valider */}
        <section className={
          "card p-4 " +
          (timesheetsToValidate > 0 ? "border-indigo-200 bg-indigo-50/30" : "")
        }>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Clock className={"w-4 h-4 " + (timesheetsToValidate > 0 ? "text-indigoaccent" : "text-midnight-400")} />
              Timesheets à valider
            </h2>
            <Link href="/timesheet/validation" className="text-xs text-indigoaccent hover:underline">
              Ouvrir
            </Link>
          </div>
          <div className="flex items-baseline gap-2">
            <div className={"text-3xl font-bold " + (timesheetsToValidate > 0 ? "text-indigoaccent" : "text-midnight-400")}>
              {timesheetsToValidate}
            </div>
            <div className="text-xs text-midnight-500">
              {timesheetsToValidate > 0 ? "entrée(s) en attente" : "tout à jour 👌"}
            </div>
          </div>
        </section>
      </div>

      {(overBudget.length > 0 || overdueMilestones.length > 0 || overloaded.length > 0) && (
        <section className="card p-5 mb-6 border-amber-200 bg-amber-50/30">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-amber-900"><AlertTriangle className="w-4 h-4" /> Alertes</h2>
          <ul className="text-sm space-y-1.5">
            {overBudget.map(p => (
              <li key={p.id}>⚠ Projet <Link href={`/projects/${p.id}`} className="text-indigoaccent hover:underline">{p.reference}</Link> en dépassement</li>
            ))}
            {overdueMilestones.map(m => (
              <li key={m.id}>⏰ Tranche en retard : {m.label} ({formatCurrency(m.amount)}) — {m.expectedAt && formatDate(m.expectedAt)}</li>
            ))}
            {overloaded.map(l => (
              <li key={l.user.id}>⚡ {l.user.firstName} {l.user.lastName} en surcharge : {l.planned.toFixed(1)}h / {Number(l.user.weeklyCapacityH).toFixed(0)}h</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Offres en cours</h2>
            <Link href="/offers" className="text-xs text-indigoaccent hover:underline">Voir tout</Link>
          </div>
          {offersOpen.length === 0 ? (
            <p className="text-sm text-midnight-500">Aucune offre en cours.</p>
          ) : (
            <table className="table-base">
              <thead><tr><th>Réf</th><th>Titre</th><th>Statut</th><th className="text-right">Montant</th></tr></thead>
              <tbody>
                {offersOpen.slice(0, 8).map(o => (
                  <tr key={o.id}>
                    <td className="font-mono text-xs">{o.reference}</td>
                    <td><Link href={`/offers/${o.id}`} className="hover:underline">{o.title}</Link></td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="text-right tabular-nums">{formatCurrency(o.totalSell)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Tranches à facturer (30 prochains jours)</h2>
            <Link href="/finance" className="text-xs text-indigoaccent hover:underline">Voir tout</Link>
          </div>
          {upcomingMilestones.length === 0 ? (
            <p className="text-sm text-midnight-500">Aucune tranche prévue à court terme.</p>
          ) : (
            <table className="table-base">
              <thead><tr><th>Libellé</th><th>Client</th><th>Date</th><th className="text-right">Montant</th></tr></thead>
              <tbody>
                {upcomingMilestones.map(m => {
                  const c = m.offer?.company ?? m.project?.company;
                  return (
                    <tr key={m.id}>
                      <td className="font-medium">{m.label}</td>
                      <td className="text-midnight-700">{c?.name ?? "—"}</td>
                      <td className="text-xs">{m.expectedAt && formatDate(m.expectedAt)}</td>
                      <td className="text-right tabular-nums">{formatCurrency(m.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function weekStart() {
  const d = new Date(); const day = (d.getDay() + 6) % 7;
  const w = new Date(d); w.setDate(d.getDate() - day); w.setHours(0,0,0,0);
  return w;
}
