import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { csvResponse, toCSV } from "@/lib/csv";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  await requirePermission("offers.read");
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });
  const offer = await prisma.offer.findUnique({ where: { id }, include: { lines: true, milestones: true, company: true } });
  if (!offer) return new Response("Not found", { status: 404 });
  const out: any[] = [];
  out.push({ section: "header", reference: offer.reference, title: offer.title, company: offer.company.name, status: offer.status });
  for (const l of offer.lines) {
    out.push({
      section: "line", description: l.description, type: l.type,
      quantity: Number(l.quantity), unit: l.unit,
      unitSellPrice: Number(l.unitSellPrice), unitCost: Number(l.unitCost),
      discountPct: Number(l.discountPct), totalSell: Number(l.totalSell), marginPct: Number(l.marginPct)
    });
  }
  for (const m of offer.milestones) {
    out.push({
      section: "milestone", description: m.label, type: "",
      quantity: m.percentage ? Number(m.percentage) : "",
      unit: "%", unitSellPrice: "", unitCost: "", discountPct: "",
      totalSell: Number(m.amount), marginPct: m.status
    });
  }
  return csvResponse(`${offer.reference}.csv`, toCSV(out));
}
