// Export PDF d'un devis (Offer) — généré via @react-pdf/renderer.
// Gère unicode (€, é, à...) nativement, multi-page automatique.
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { OfferPdfDocument, type OfferPdfData } from "@/lib/offer-pdf-template";
import { getCompanyInfo } from "@/lib/company-info";
import React from "react";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requirePermission("offers.read");
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });
  // ?inline=1 → afficher dans le navigateur ; sinon → forcer téléchargement
  const inline = req.nextUrl.searchParams.get("inline") === "1";

  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      company: true,
      lines: { where: { optionId: null }, orderBy: { position: "asc" } },
      options: {
        include: { lines: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" }
      },
      // Même ordre que sur la page offre (par date de création = ordre de saisie)
      milestones: { orderBy: { createdAt: "asc" } },
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
    options: offer.options.map((opt) => ({
      name: opt.name,
      description: opt.description,
      totalSell: Number(opt.totalSell),
      lines: opt.lines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unit: l.unit,
        unitSellPrice: Number(l.unitSellPrice),
        totalSell: Number(l.totalSell)
      }))
    })),
    owner: offer.owner
      ? {
          firstName: offer.owner.firstName,
          lastName: offer.owner.lastName,
          email: offer.owner.email
        }
      : null
  };

  // Fetch company info from settings (configurable in /settings/company)
  const companyInfo = await getCompanyInfo();

  try {
    const buffer = await renderToBuffer(
      React.createElement(OfferPdfDocument, { data, companyInfo })
    );
    // Conversion en Uint8Array pour que Next.js / fetch streame correctement
    // le binaire (sinon certains navigateurs reçoivent le Buffer mal encodé).
    const uint8 = new Uint8Array(buffer);
    const disposition = inline ? "inline" : "attachment";
    return new Response(uint8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${offer.reference}.pdf"`,
        "Content-Length": String(uint8.length),
        "Cache-Control": "private, no-store"
      }
    });
  } catch (e: any) {
    console.error("PDF generation failed", e);
    return new Response(`PDF generation failed: ${String(e?.message ?? e)}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
