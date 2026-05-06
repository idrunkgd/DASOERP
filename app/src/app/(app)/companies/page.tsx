import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

type Search = { q?: string; status?: string };

export default async function CompaniesPage({ searchParams }: { searchParams: Search }) {
  await requirePermission("companies.read");
  const where: any = {};
  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q, mode: "insensitive" } },
      { vatNumber: { contains: searchParams.q, mode: "insensitive" } },
      { city: { contains: searchParams.q, mode: "insensitive" } }
    ];
  }
  if (searchParams.status) where.status = searchParams.status;

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
      <form className="mb-4 flex gap-2 flex-wrap">
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Nom, TVA, ville..." className="input max-w-xs" />
        <select name="status" defaultValue={searchParams.status ?? ""} className="input max-w-[180px]">
          <option value="">Tous statuts</option>
          <option value="PROSPECT">Prospect</option>
          <option value="CLIENT">Client</option>
          <option value="PARTNER">Partenaire</option>
          <option value="SUPPLIER">Fournisseur</option>
        </select>
        <button className="btn-secondary">Filtrer</button>
        {(searchParams.q || searchParams.status) && (
          <Link href="/companies" className="btn-ghost">Réinitialiser</Link>
        )}
      </form>

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
