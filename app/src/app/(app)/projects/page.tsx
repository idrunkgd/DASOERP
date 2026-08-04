import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FolderKanban, Plus, AlertTriangle } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { FilterChips } from "@/components/ui/filter-chips";
import { PreservedSearchForm } from "@/components/ui/preserved-search-form";
import { parseMulti, inFilter } from "@/lib/filters";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  await requirePermission("projects.read");
  const statuses = parseMulti(searchParams.status);
  const where: any = {};
  if (searchParams.q) where.OR = [
    { name: { contains: searchParams.q, mode: "insensitive" } },
    { reference: { contains: searchParams.q, mode: "insensitive" } }
  ];
  const statusFilter = inFilter(statuses);
  if (statusFilter) where.status = statusFilter;

  const projects = await prisma.project.findMany({
    where, include: { company: true, manager: true }, orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <PageHeader
        title="Projets"
        subtitle={`${projects.length} projet(s)`}
        actions={
          <>
            <Link href="/api/exports/projects" className="btn-secondary">Export CSV</Link>
            <Link href="/projects/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau projet</Link>
          </>
        }
      />
      <div className="mb-4 space-y-3">
        <FilterChips
          paramName="status"
          label="Statut"
          options={[
            { value: "TO_START",  label: "À démarrer", tone: "info" },
            { value: "ACTIVE",    label: "Actif",      tone: "success" },
            { value: "ON_HOLD",   label: "En pause",   tone: "warning" },
            { value: "COMPLETED", label: "Terminé",    tone: "neutral" },
            { value: "CANCELLED", label: "Annulé",     tone: "danger" }
          ]}
        />
        <PreservedSearchForm
          searchParams={searchParams as Record<string, string | undefined>}
          except={["q", "page"]}
          className="flex gap-2 flex-wrap items-center"
        >
          <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Réf, nom..." className="input max-w-xs text-sm" />
          <button className="btn-secondary btn-sm">Rechercher</button>
        </PreservedSearchForm>
      </div>

      <div className="card overflow-hidden">
        {projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="Aucun projet" description="Les projets sont créés automatiquement lorsque vous gagnez une offre, ou manuellement ici."
            action={<Link href="/projects/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau</Link>} />
        ) : (
          <table className="table-base">
            <thead><tr>
              <th>Réf</th><th>Nom</th><th>Client</th><th>Statut</th>
              <th className="text-right">Budget vendu</th><th className="text-right">Conso temps</th>
              <th className="text-right">Marge réelle</th><th className="text-right">Avancement</th><th>Chef</th>
            </tr></thead>
            <tbody>
              {projects.map(p => {
                const overTime = Number(p.budgetTimeH) > 0 && Number(p.actualTimeH) > Number(p.budgetTimeH);
                return (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.reference}</td>
                    <td>
                      <Link href={`/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                      {overTime && <AlertTriangle className="w-3 h-3 text-amber-500 inline ml-1" />}
                    </td>
                    <td><Link href={`/companies/${p.companyId}`} className="hover:underline text-midnight-700">{p.company.name}</Link></td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="text-right tabular-nums">{formatCurrency(p.budgetSell)}</td>
                    <td className="text-right tabular-nums">{Number(p.actualTimeH).toFixed(1)}h / {Number(p.budgetTimeH).toFixed(0)}h</td>
                    <td className="text-right tabular-nums">{formatCurrency(p.marginActual)}</td>
                    <td className="text-right tabular-nums">{formatPercent(p.progressPct)}</td>
                    <td className="text-midnight-700 text-xs">{p.manager ? `${p.manager.firstName} ${p.manager.lastName[0]}.` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
