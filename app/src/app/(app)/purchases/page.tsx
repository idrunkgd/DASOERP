import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ShoppingCart, Plus } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PurchasesPage({ searchParams }: { searchParams: { status?: string; projectId?: string; q?: string } }) {
  await requirePermission("purchases.read");
  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.projectId) where.projectId = searchParams.projectId;
  if (searchParams.q) where.description = { contains: searchParams.q, mode: "insensitive" };

  const purchases = await prisma.purchase.findMany({
    where, include: { project: true, supplier: true }, orderBy: { purchaseDate: "desc" }
  });
  const total = purchases.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div>
      <PageHeader
        title="Achats projet"
        subtitle={`${purchases.length} achat(s) — total : ${formatCurrency(total)}`}
        actions={
          <>
            <Link href="/api/exports/purchases" className="btn-secondary">Export CSV</Link>
            <Link href="/purchases/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouvel achat</Link>
          </>
        }
      />
      <form className="mb-4 flex gap-2 flex-wrap">
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Description..." className="input max-w-xs" />
        <select name="status" defaultValue={searchParams.status ?? ""} className="input max-w-[180px]">
          <option value="">Tous statuts</option>
          <option value="PLANNED">Prévu</option>
          <option value="ORDERED">Commandé</option>
          <option value="RECEIVED">Reçu</option>
          <option value="PAID">Payé</option>
          <option value="CANCELLED">Annulé</option>
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>
      <div className="card overflow-hidden">
        {purchases.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Aucun achat" action={<Link href="/purchases/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau</Link>} />
        ) : (
          <table className="table-base">
            <thead><tr><th>Date</th><th>Projet</th><th>Description</th><th>Catégorie</th><th>Fournisseur</th><th className="text-right">Montant HT</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id}>
                  <td>{formatDate(p.purchaseDate)}</td>
                  <td><Link href={`/projects/${p.projectId}`} className="hover:underline">{p.project.reference}</Link></td>
                  <td className="font-medium">{p.description}</td>
                  <td className="text-xs">{p.category}</td>
                  <td>{p.supplier?.name ?? "—"}</td>
                  <td className="text-right tabular-nums">{formatCurrency(p.amount)}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className="text-right"><Link href={`/purchases/${p.id}`} className="text-xs text-indigoaccent hover:underline">Éditer</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
