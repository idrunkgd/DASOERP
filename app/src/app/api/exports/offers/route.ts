import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { csvResponse, toCSV } from "@/lib/csv";

export async function GET() {
  await requirePermission("offers.read");
  const offers = await prisma.offer.findMany({ include: { company: true, owner: true }, orderBy: { createdAt: "desc" } });
  const csv = toCSV(offers.map(o => ({
    reference: o.reference, title: o.title, status: o.status, probability: o.probability,
    company: o.company.name, owner: o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : "",
    totalSell: Number(o.totalSell), totalCost: Number(o.totalCost),
    marginAmount: Number(o.marginAmount), marginPct: Number(o.marginPct),
    createdAt: o.createdAt.toISOString().slice(0, 10),
    sentAt: o.sentAt?.toISOString().slice(0, 10) ?? "",
    closedAt: o.closedAt?.toISOString().slice(0, 10) ?? ""
  })));
  return csvResponse(`offres-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
