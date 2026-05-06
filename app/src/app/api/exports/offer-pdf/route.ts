import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function GET(req: NextRequest) {
  await requirePermission("offers.read");
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: { company: true, lines: { orderBy: { position: "asc" } }, milestones: true, owner: true }
  });
  if (!offer) return new Response("Not found", { status: 404 });

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const indigo = rgb(0.125, 0.125, 0.215); // #202037
  const grey = rgb(0.4, 0.4, 0.45);

  let y = height - 50;
  page.drawText("DASOLABS", { x: 40, y, size: 20, font: fontBold, color: indigo });
  page.drawText("Devis", { x: width - 100, y, size: 16, font: fontBold, color: indigo });
  y -= 18;
  page.drawText("ERP interne — devis préparé pour Peppol", { x: 40, y, size: 9, font, color: grey });

  y -= 40;
  page.drawText(`Référence : ${offer.reference}`, { x: 40, y, size: 10, font: fontBold });
  page.drawText(`Date : ${new Date().toLocaleDateString("fr-BE")}`, { x: width - 200, y, size: 10, font });
  y -= 16;
  page.drawText(`Titre : ${offer.title}`, { x: 40, y, size: 11, font: fontBold });

  y -= 30;
  page.drawText("Client", { x: 40, y, size: 10, font: fontBold, color: grey });
  y -= 14;
  page.drawText(offer.company.name, { x: 40, y, size: 11, font: fontBold });
  y -= 12;
  if (offer.company.vatNumber) page.drawText(`TVA: ${offer.company.vatNumber}`, { x: 40, y, size: 9, font });
  y -= 12;
  const addr = [offer.company.street, offer.company.postalCode + " " + (offer.company.city ?? ""), offer.company.country].filter(Boolean).join(", ");
  if (addr.trim()) page.drawText(addr, { x: 40, y, size: 9, font, color: grey });

  y -= 30;
  // Header tableau
  page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 18, color: indigo });
  page.drawText("Description", { x: 46, y, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Qté", { x: 320, y, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("PU", { x: 380, y, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Total HT", { x: 480, y, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  y -= 22;

  const eur = (n: any) => Number(n).toLocaleString("fr-BE", { style: "currency", currency: "EUR" });

  for (const l of offer.lines) {
    if (y < 100) break; // page unique
    const truncated = l.description.length > 55 ? l.description.slice(0, 52) + "..." : l.description;
    page.drawText(truncated, { x: 46, y, size: 9, font });
    page.drawText(String(Number(l.quantity)) + " " + l.unit, { x: 320, y, size: 9, font });
    page.drawText(eur(l.unitSellPrice), { x: 380, y, size: 9, font });
    page.drawText(eur(l.totalSell), { x: 480, y, size: 9, font });
    y -= 16;
  }

  y -= 14;
  page.drawLine({ start: { x: 350, y: y + 4 }, end: { x: width - 40, y: y + 4 }, thickness: 1, color: indigo });
  page.drawText("Total HT :", { x: 360, y: y - 12, size: 11, font: fontBold });
  page.drawText(eur(offer.totalSell), { x: 480, y: y - 12, size: 11, font: fontBold, color: indigo });

  y -= 50;
  if (offer.milestones.length) {
    page.drawText("Tranches de facturation prévues", { x: 40, y, size: 11, font: fontBold, color: indigo });
    y -= 16;
    for (const m of offer.milestones) {
      if (y < 60) break;
      const dt = m.expectedAt ? new Date(m.expectedAt).toLocaleDateString("fr-BE") : "—";
      page.drawText(`• ${m.label} — ${eur(m.amount)} (prévu ${dt})`, { x: 46, y, size: 9, font });
      y -= 14;
    }
  }

  page.drawText("Document généré par Dasolabs ERP", { x: 40, y: 30, size: 8, font, color: grey });

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${offer.reference}.pdf"`
    }
  });
}
