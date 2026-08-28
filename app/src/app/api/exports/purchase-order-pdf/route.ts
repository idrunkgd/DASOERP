// Export PDF d'un bon de commande fournisseur (PurchaseOrder).
// Généré via @react-pdf/renderer — inline ou téléchargement selon ?inline=1.
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { PurchaseOrderPdfDocument, type PurchaseOrderPdfData } from "@/lib/purchase-order-pdf-template";
import { getCompanyInfo } from "@/lib/company-info";
import React from "react";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requirePermission("purchases.read");
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });
  const inline = req.nextUrl.searchParams.get("inline") === "1";

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      lines: { orderBy: { position: "asc" } }
    }
  });
  if (!po) return new Response("Not found", { status: 404 });

  const companyInfo = await getCompanyInfo();

  const data: PurchaseOrderPdfData = {
    reference: po.reference,
    title: po.title,
    status: po.status,
    currency: po.currency,
    createdAt: po.createdAt,
    sentAt: po.sentAt,
    deliveryDate: po.deliveryDate,
    deliveryAddress: po.deliveryAddress,
    paymentTerms: po.paymentTerms,
    notes: po.notes,
    supplier: {
      name: po.supplier?.name ?? po.supplierName ?? "Fournisseur non renseigné",
      vatNumber: po.supplier?.vatNumber,
      street: po.supplier?.street,
      postalCode: po.supplier?.postalCode,
      city: po.supplier?.city,
      country: po.supplier?.country,
      contactName: po.contactName,
      contactEmail: po.contactEmail
    },
    lines: po.lines.map((l) => ({
      label: l.label,
      description: l.description,
      quantity: Number(l.quantity),
      unit: l.unit,
      unitPriceHt: Number(l.unitPriceHt),
      vatRate: Number(l.vatRate),
      totalHt: Number(l.totalHt)
    })),
    totalHt: Number(po.totalHt),
    totalVat: Number(po.totalVat),
    totalTtc: Number(po.totalTtc),
    companyInfo
  };

  const buffer = await renderToBuffer(React.createElement(PurchaseOrderPdfDocument, { data }));
  const filename = `${po.reference}.pdf`;
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
