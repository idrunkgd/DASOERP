// Export PDF d'un devis (Offer) — généré via @react-pdf/renderer.
// Gère unicode (€, é, à...) nativement, multi-page automatique.
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { OfferPdfDocument, type OfferPdfData } from "@/lib/offer-pdf-template";
import React from "react";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requirePermission("offers.read");
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      company: true,
      lines: { orderBy: { position: "asc" } },
      milestones: { orderBy: { expectedAt: "asc" } },
      owner: true,
      contacts: {
        include: { contact: true }
      }
    }
  });
  if (!offer) return new Response("Not found", { status: 404 });

  const data: OfferPdfData = {
    reference: offer.reference,
    title: offer.title,
    description: offer.description,
    totalSell: Number(offer.totalSell),
    sentAt: offer.sentAt,
    expectedDecisionAt: offer.expectedDecisionAt,
    company: {
      name: offer.company.name,
      vatNumber: offer.company.vatNumber,
      street: offer.company.street,
      postalCode: offer.company.postalCode,
      city: offer.company.city,
      country: offer.company.country
    },
    contacts: offer.contacts.map((oc) => ({
      firstName: oc.contact.firstName,
      lastName: oc.contact.lastName,
      email: oc.contact.email
    })),
    lines: offer.lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unit: l.unit,
      unitSellPrice: Number(l.unitSellPrice),
      totalSell: Number(l.totalSell)
    })),
    milestones: offer.milestones.map((m) => ({
      label: m.label,
      amount: Number(m.amount),
      expectedAt: m.expectedAt,
      percentage: m.percentage ? Number(m.percentage) : null
    })),
    owner: offer.owner
      ? {
          firstName: offer.owner.firstName,
          lastName: offer.owner.lastName,
          email: offer.owner.email
        }
      : null
  };

  try {
    const buffer = await renderToBuffer(
      React.createElement(OfferPdfDocument, { data })
    );
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${offer.reference}.pdf"`
      }
    });
  } catch (e: any) {
    console.error("PDF generation failed", e);
    return new Response(`PDF generation failed: ${String(e?.message ?? e)}`, {
      status: 500
    });
  }
}
