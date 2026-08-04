import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2, Plus } from "lucide-react";
import { FilterChips } from "@/components/ui/filter-chips";
import { PreservedSearchForm } from "@/components/ui/preserved-search-form";
import { parseMulti, inFilter } from "@/lib/filters";

export const dynamic = "force-dynamic";

type Search = { q?: string; status?: string };

export default async function CompaniesPage({ searchParams }: { searchParams: Search }) {
  await requirePermission("companies.read");
  const statuses = parseMulti(searchParams.status);
  const where: any = {};
  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q, mode: "insensitive" } },
      { vatNumber: { contains: searchParams.q, mode: "insensitive" } },
      { city: { contains: searchParams.q, mode: "insensitive" } }
    ];
  }
  const statusFilter = inFilter(statuses);
  if (statusFilter) where.status = statusFilter;

  const companies = await prisma.company.findMany({
    where, orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true, offers: true, projects: true } } }
  });

  return (
    <div>
      <PageHeader
        title="Entreprises"
        subtitle={`${companies.length} entreprise(s)`}
        actions={
          <>
            <Link href="/companies/import" className="btn-secondary">Import CSV</Link>
            <Link href="/api/exports/companies" className="btn-secondary">Export CSV</Link>
            <Link href="/companies/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouvelle entreprise</Link>
          </>
        }
      />
      <div className="mb-4 space-y-3">
        <FilterChips
          paramName="status"
          label="Statut"
          options={[
            { value: "PROSPECT", label: "Prospect",    tone: "warning" },
            { value: "CLIENT",   label: "Client",      tone: "success" },
            { value: "PARTNER",  label: "Partenaire",  tone: "info" },
            { value: "SUPPLIER", label: "Fournisseur", tone: "neutral" }
          ]}
        />
        <PreservedSearchForm
          searchParams={searchParams as Record<string, string | undefined>}
          except={["q", "page"]}
          className="flex gap-2 flex-wrap items-center"
        >
          <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Nom, TVA, ville..." className="input max-w-xs text-sm" />
          <button className="btn-secondary btn-sm">Rechercher</button>
          {(searchParams.q || searchParams.status) && (
            <Link href="/companies" className="btn-ghost btn-sm">Réinitialiser tous</Link>
          )}
        </PreservedSearchForm>
      </div>

      <div className="card overflow-hidden">
        {companies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Aucune entreprise"
            description="Créez votre première entreprise pour commencer."
            action={<Link href="/companies/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouvelle entreprise</Link>}
          />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Nom</th><th>Statut</th><th>Secteur</th><th>Ville</th>
                <th className="text-right">Contacts</th><th className="text-right">Offres</th><th className="text-right">Projets</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id}>
                  <td><Link href={`/companies/${c.id}`} className="font-medium text-midnight-900 hover:underline">{c.name}</Link>{c.vatNumber && <div className="text-xs text-midnight-500">{c.vatNumber}</div>}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="text-midnight-700">{c.sector ?? "—"}</td>
                  <td className="text-midnight-700">{c.city ?? "—"}</td>
                  <td className="text-right tabular-nums">{c._count.contacts}</td>
                  <td className="text-right tabular-nums">{c._count.offers}</td>
                  <td className="text-right tabular-nums">{c._count.projects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
