import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, Plus } from "lucide-react";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OffersPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  await requirePermission("offers.read");
  // On n'affiche que la version courante de chaque offre :
  //   - nextVersion = null : c'est la dernière version (V1 sans V2, ou la V2 d'une chaîne)
  //   - parentOfferId = null : on exclut aussi les compléments d'offres
  // Les versions précédentes sont accessibles depuis la fiche détail.
  const where: any = { nextVersion: null, parentOfferId: null };
  if (searchParams.q) where.OR = [
    { title: { contains: searchParams.q, mode: "insensitive" } },
    { reference: { contains: searchParams.q, mode: "insensitive" } }
  ];
  if (searchParams.status) where.status = searchParams.status;

  const offers = await prisma.offer.findMany({
    where, orderBy: { createdAt: "desc" },
    include: { company: true, owner: true }
  });

  return (
    <div>
      <PageHeader
        title="Offres"
        subtitle={`${offers.length} offre(s)`}
        actions={
          <>
            <Link href="/api/exports/offers" className="btn-secondary">Export CSV</Link>
            <Link href="/offers/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouvelle offre</Link>
          </>
        }
      />
      <form className="mb-4 flex gap-2 flex-wrap">
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Référence, titre..." className="input max-w-xs" />
        <select name="status" defaultValue={searchParams.status ?? ""} className="input max-w-[180px]">
          <option value="">Tous statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="SENT">Envoyée</option>
          <option value="NEGOTIATION">En négociation</option>
          <option value="WON">Gagnée</option>
          <option value="LOST">Perdue</option>
          <option value="CANCELLED">Annulée</option>
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>

      <div className="card overflow-hidden">
        {offers.length === 0 ? (
          <EmptyState icon={FileText} title="Aucune offre" action={<Link href="/offers/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouvelle</Link>} />
        ) : (
          <table className="table-base">
            <thead><tr>
              <th>Réf</th><th>Titre</th><th>Client</th><th>Statut</th>
              <th className="text-right">Probabilité</th><th className="text-right">Total HT</th><th className="text-right">Marge</th><th>Resp.</th><th>Créée</th>
            </tr></thead>
            <tbody>
              {offers.map(o => (
                <tr key={o.id}>
                  <td className="font-mono text-xs">{o.reference}</td>
                  <td><Link href={`/offers/${o.id}`} className="font-medium hover:underline">{o.title}</Link></td>
                  <td><Link href={`/companies/${o.companyId}`} className="hover:underline text-midnight-700">{o.company.name}</Link></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="text-right tabular-nums">{o.probability}%</td>
                  <td className="text-right tabular-nums">{formatCurrency(o.totalSell)}</td>
                  <td className="text-right tabular-nums">{formatPercent(o.marginPct)}</td>
                  <td className="text-midnight-700">{o.owner ? `${o.owner.firstName[0]}. ${o.owner.lastName}` : "—"}</td>
                  <td className="text-midnight-500 text-xs">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
