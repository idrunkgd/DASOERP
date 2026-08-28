import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect, requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft, Pencil, Download, Eye } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PoActions } from "./po-actions";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT:        { label: "Brouillon",   cls: "bg-midnight-100 text-midnight-700" },
  SENT:         { label: "Envoyé",      cls: "bg-indigo-100 text-indigo-800" },
  ACKNOWLEDGED: { label: "Confirmé",    cls: "bg-amber-100 text-amber-800" },
  RECEIVED:     { label: "Reçu",        cls: "bg-emerald-100 text-emerald-800" },
  CANCELLED:    { label: "Annulé",      cls: "bg-rose-100 text-rose-800" }
};

export default async function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  const session = await requirePermissionOrRedirect("purchases.read");
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canWrite = perms.includes("purchases.write");

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      project: { select: { id: true, reference: true, title: true } },
      lines: { orderBy: { position: "asc" } },
      createdBy: { select: { firstName: true, lastName: true } },
      sentBy: { select: { firstName: true, lastName: true } }
    }
  });
  if (!po) notFound();

  const meta = STATUS_META[po.status] ?? { label: po.status, cls: "bg-midnight-100 text-midnight-700" };
  const supplierName = po.supplier?.name ?? po.supplierName ?? "—";
  const pdfUrl = `/api/exports/purchase-order-pdf?id=${po.id}`;
  const senderName = `${session.user.name ?? ""}`.trim() || "Dasolabs";

  return (
    <div>
      <PageHeader
        title={po.reference}
        subtitle={
          <span>
            <span className={"text-[10px] px-1.5 py-0.5 rounded-full font-medium mr-2 " + meta.cls}>{meta.label}</span>
            <span className="text-midnight-700">{po.title}</span>
          </span>
        }
        actions={
          <div className="flex gap-2">
            <a href={`${pdfUrl}&inline=1`} target="_blank" rel="noreferrer" className="btn-ghost text-sm inline-flex items-center gap-1">
              <Eye className="w-4 h-4" /> Aperçu
            </a>
            <a href={pdfUrl} className="btn-secondary text-sm inline-flex items-center gap-1">
              <Download className="w-4 h-4" /> PDF
            </a>
            {canWrite && po.status === "DRAFT" && (
              <Link href={`/purchase-orders/${po.id}/edit`} className="btn-secondary text-sm inline-flex items-center gap-1">
                <Pencil className="w-4 h-4" /> Modifier
              </Link>
            )}
            <Link href="/purchase-orders" className="btn-ghost text-sm inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Retour
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Colonne principale : preview PDF */}
        <div className="lg:col-span-2">
          <div className="card p-2">
            <iframe src={`${pdfUrl}&inline=1`} className="w-full rounded-lg" style={{ height: "80vh" }} title={po.reference} />
          </div>
        </div>

        {/* Colonne droite : infos + actions */}
        <div className="space-y-4">
          {canWrite && (
            <div className="card p-4">
              <h3 className="font-semibold text-sm mb-3">Actions</h3>
              <PoActions
                id={po.id}
                reference={po.reference}
                title={po.title}
                status={po.status}
                contactEmail={po.contactEmail}
                contactName={po.contactName}
                senderName={senderName}
                totalTtc={Number(po.totalTtc)}
                currency={po.currency}
                pdfUrl={pdfUrl}
              />
            </div>
          )}

          {po.project && (
            <div className="card p-4 text-xs">
              <h3 className="font-semibold text-sm mb-2">Projet lié</h3>
              <Link href={`/projects/${po.project.id}`} className="font-medium text-indigoaccent hover:underline">
                {po.project.reference}
              </Link>
              <div className="text-midnight-500 mt-0.5">{po.project.title}</div>
            </div>
          )}

          <div className="card p-4 text-xs space-y-2">
            <h3 className="font-semibold text-sm mb-2">Fournisseur</h3>
            <div className="font-semibold text-midnight-900">{supplierName}</div>
            {po.supplier?.vatNumber && <div className="text-midnight-500">TVA {po.supplier.vatNumber}</div>}
            {po.contactName && <div className="text-midnight-700 mt-2">Contact : <strong>{po.contactName}</strong></div>}
            {po.contactEmail && <div className="text-indigoaccent"><a href={`mailto:${po.contactEmail}`} className="hover:underline">{po.contactEmail}</a></div>}
          </div>

          <div className="card p-4 text-xs space-y-2">
            <h3 className="font-semibold text-sm mb-2">Montants</h3>
            <div className="flex justify-between"><span className="text-midnight-500">Total HT</span><span className="tabular-nums">{formatCurrency(po.totalHt, po.currency)}</span></div>
            <div className="flex justify-between"><span className="text-midnight-500">TVA</span><span className="tabular-nums">{formatCurrency(po.totalVat, po.currency)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 mt-2 text-sm">
              <span className="font-semibold">Total TTC</span>
              <span className="tabular-nums font-bold text-indigoaccent">{formatCurrency(po.totalTtc, po.currency)}</span>
            </div>
          </div>

          <div className="card p-4 text-xs space-y-1.5">
            <h3 className="font-semibold text-sm mb-2">Historique</h3>
            <div><span className="text-midnight-500">Créé le </span>{formatDate(po.createdAt)}{po.createdBy && <span className="text-midnight-500"> par </span>}{po.createdBy && <span>{po.createdBy.firstName} {po.createdBy.lastName}</span>}</div>
            {po.sentAt && <div><span className="text-midnight-500">Envoyé le </span>{formatDate(po.sentAt)}{po.sentBy && <span className="text-midnight-500"> par </span>}{po.sentBy && <span>{po.sentBy.firstName} {po.sentBy.lastName}</span>}</div>}
            {po.acknowledgedAt && <div><span className="text-midnight-500">Confirmé le </span>{formatDate(po.acknowledgedAt)}</div>}
            {po.receivedAt && <div><span className="text-midnight-500">Reçu le </span>{formatDate(po.receivedAt)}</div>}
            {po.cancelledAt && <div className="text-rose-700"><span className="text-midnight-500">Annulé le </span>{formatDate(po.cancelledAt)}{po.cancelledReason && ` — ${po.cancelledReason}`}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
