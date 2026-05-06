import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProjectForm } from "../project-form";
import { ProjectMembers } from "./members";
import { recomputeProjectAction, deleteProjectAction } from "@/server/actions/projects";
import { ConfirmButton } from "@/components/ui/confirm";
import { ProjectMilestones } from "./milestones";
import { TMBillingButton } from "./tm-billing-button";
import { formatCurrency, formatPercent, formatDate } from "@/lib/utils";

export default async function ProjectDetail({ params }: { params: { id: string } }) {
  await requirePermission("projects.read");
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      company: true, manager: true, sourceOffer: true,
      members: { include: { user: true } },
      milestones: { orderBy: { expectedAt: "asc" } },
      timesheetEntries: { include: { user: true }, orderBy: { date: "desc" }, take: 10 },
      purchases: { orderBy: { purchaseDate: "desc" }, take: 10 }
    }
  });
  if (!project) notFound();

  const [companies, users] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true, candidateProfile: { is: null } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } })
  ]);

  const overTime = Number(project.actualTimeH) > Number(project.budgetTimeH) && Number(project.budgetTimeH) > 0;
  const overCost = (Number(project.actualTimeCost) + Number(project.actualPurchaseCost)) > Number(project.budgetCost) && Number(project.budgetCost) > 0;

  return (
    <div>
      <PageHeader
        title={project.name}
        breadcrumb={[{ label: "Projets", href: "/projects" }, { label: project.reference }]}
        subtitle={
          <span>
            {project.reference} · {project.company.name} ·{" "}
            <span className={"badge-" + (project.mode === "CONSULTING" ? "warning" : "info")}>
              {project.mode === "CONSULTING" ? "Consultance T&M" : "Projet forfait"}
            </span>
          </span> as any
        }
        actions={
          <>
            <StatusBadge status={project.status} className="mr-2" />
            {project.mode === "CONSULTING" && <TMBillingButton projectId={project.id} />}
            <form action={recomputeProjectAction.bind(null, project.id)}><button className="btn-secondary btn-sm">Recalculer</button></form>
            <ConfirmButton onConfirm={async () => { "use server"; await deleteProjectAction(project.id); }} message="Supprimer ce projet ?">Supprimer</ConfirmButton>
          </>
        }
      />

      {(overTime || overCost) && (
        <div className="mb-4 card p-3 border-amber-300 bg-amber-50 text-sm text-amber-900">
          ⚠ Dépassement détecté : {overTime && "temps "}{overCost && "coût"} — pensez à ajuster le scope ou le budget.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ProjectForm initial={project as any} companies={companies} users={users} />
          <ProjectMembers projectId={project.id} members={project.members as any} users={users} />
          <ProjectMilestones milestones={project.milestones as any} projectId={project.id} />

          <section className="card p-5">
            <h2 className="font-semibold mb-3">Derniers timesheets ({project.timesheetEntries.length})</h2>
            {project.timesheetEntries.length === 0 ? (
              <p className="text-sm text-midnight-500">Aucun timesheet pour le moment.</p>
            ) : (
              <table className="table-base">
                <thead><tr><th>Date</th><th>Utilisateur</th><th className="text-right">Heures</th><th>Type</th><th>Statut</th></tr></thead>
                <tbody>
                  {project.timesheetEntries.map(t => (
                    <tr key={t.id}>
                      <td>{formatDate(t.date)}</td>
                      <td>{t.user.firstName} {t.user.lastName}</td>
                      <td className="text-right tabular-nums">{Number(t.hours)}</td>
                      <td className="text-xs">{t.activityType}</td>
                      <td><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card p-5 space-y-2">
            <h3 className="font-semibold mb-2">Synthèse</h3>
            <Row k="Budget vendu" v={formatCurrency(project.budgetSell)} />
            <Row k="Budget coût" v={formatCurrency(project.budgetCost)} />
            <Row k="Budget temps" v={`${Number(project.budgetTimeH).toFixed(0)}h`} />
            <hr className="my-1" />
            <Row k="Temps réel" v={`${Number(project.actualTimeH).toFixed(1)}h`} />
            <Row k="Coût temps" v={formatCurrency(project.actualTimeCost)} />
            <Row k="Achats réels" v={formatCurrency(project.actualPurchaseCost)} />
            <hr className="my-1" />
            <Row k="Marge estimée" v={formatCurrency(project.marginEstimated)} />
            <Row k="Marge réelle" v={formatCurrency(project.marginActual)} />
            <Row k="Avancement" v={formatPercent(project.progressPct)} />
          </div>
          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Liens</h3>
            {project.sourceOffer && <Row k="Offre source" v={<Link href={`/offers/${project.sourceOffer.id}`} className="text-indigoaccent hover:underline">{project.sourceOffer.reference}</Link>} />}
            <Link href={`/timesheet?projectId=${project.id}`} className="block text-indigoaccent hover:underline">→ Voir les timesheets</Link>
            <Link href={`/purchases?projectId=${project.id}`} className="block text-indigoaccent hover:underline">→ Voir les achats</Link>
            <Link href={`/planning?projectId=${project.id}`} className="block text-indigoaccent hover:underline">→ Voir le planning</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between text-sm"><span className="text-midnight-500">{k}</span><span className="text-midnight-900 font-medium">{v}</span></div>;
}
