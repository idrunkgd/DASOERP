import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft } from "lucide-react";
import { POForm } from "../../po-form";

export const dynamic = "force-dynamic";

export default async function EditPurchaseOrderPage({ params }: { params: { id: string } }) {
  await requirePermissionOrRedirect("purchases.write");
  const [po, suppliers] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      include: { lines: { orderBy: { position: "asc" } } }
    }),
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
  ]);
  if (!po) notFound();
  if (po.status !== "DRAFT") {
    return (
      <div>
        <PageHeader
          title="Modification impossible"
          subtitle={`Ce PO est en statut ${po.status} — seuls les brouillons sont modifiables.`}
          actions={<Link href={`/purchase-orders/${po.id}`} className="btn-ghost text-sm"><ArrowLeft className="w-4 h-4 inline mr-1" />Retour</Link>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Modifier ${po.reference}`}
        subtitle="Modifications autorisées uniquement en statut brouillon"
        actions={
          <Link href={`/purchase-orders/${po.id}`} className="btn-ghost text-sm inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Retour
          </Link>
        }
      />
      <POForm
        suppliers={suppliers}
        initial={{
          id: po.id,
          title: po.title,
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          contactName: po.contactName,
          contactEmail: po.contactEmail,
          deliveryAddress: po.deliveryAddress,
          deliveryDate: po.deliveryDate ? po.deliveryDate.toISOString().slice(0, 10) : null,
          paymentTerms: po.paymentTerms,
          notes: po.notes,
          currency: po.currency,
          lines: po.lines.map((l) => ({
            label: l.label,
            description: l.description ?? "",
            quantity: Number(l.quantity),
            unit: l.unit ?? "",
            unitPriceHt: Number(l.unitPriceHt),
            vatRate: Number(l.vatRate)
          }))
        }}
      />
    </div>
  );
}
