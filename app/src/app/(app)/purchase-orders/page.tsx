import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT:        { label: "Brouillon",   cls: "bg-midnight-100 text-midnight-700" },
  SENT:         { label: "Envoyé",      cls: "bg-indigo-100 text-indigo-800" },
  ACKNOWLEDGED: { label: "Confirmé",    cls: "bg-amber-100 text-amber-800" },
  RECEIVED:     { label: "Reçu",        cls: "bg-emerald-100 text-emerald-800" },
  CANCELLED:    { label: "Annulé",      cls: "bg-rose-100 text-rose-800" }
};

export default async function PurchaseOrdersPage() {
  await requirePermissionOrRedirect("purchases.read");

  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { supplier: { select: { name: true } } }
  });

  return (
    <div>
      <PageHeader
        title="Bons de commande"
        subtitle="Documents formels envoyés aux fournisseurs — réf PO-AAAA-NNNN"
        actions={
          <Link href="/purchase-orders/new" className="btn-primary text-sm inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> Nouveau PO
          </Link>
        }
      />

      <div className="card">
        <div className="card-header font-semibold">Tous les bons de commande ({orders.length})</div>
        {orders.length === 0 ? (
          <div className="p-10 text-center text-sm text-midnight-500 italic">
            Aucun bon de commande. Clique sur « Nouveau PO » pour créer le premier.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {orders.map((o) => {
              const meta = STATUS_META[o.status] ?? { label: o.status, cls: "bg-midnight-100 text-midnight-700" };
              return (
                <li key={o.id} className="p-3 flex items-center gap-3 hover:bg-midnight-50/40 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-indigoaccent/10 text-indigoaccent flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/purchase-orders/${o.id}`} className="font-semibold text-sm text-midnight-900 hover:text-indigoaccent">
                        {o.reference}
                      </Link>
                      <span className={"text-[10px] px-1.5 py-0.5 rounded-full font-medium " + meta.cls}>{meta.label}</span>
                    </div>
                    <div className="text-xs text-midnight-700 mt-0.5 truncate">{o.title}</div>
                    <div className="text-[10px] text-midnight-500 mt-0.5">
                      {o.supplier?.name ?? o.supplierName ?? "—"} · créé le {formatDate(o.createdAt)}
                    </div>
                  </div>
                  <div className="text-right text-xs flex-shrink-0">
                    <div className="tabular-nums font-semibold text-midnight-900">{formatCurrency(o.totalTtc, o.currency)}</div>
                    <div className="text-[10px] text-midnight-400">TTC</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
