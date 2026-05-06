import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { csvResponse, toCSV } from "@/lib/csv";

export async function GET() {
  await requirePermission("purchases.read");
  const list = await prisma.purchase.findMany({ include: { project: true, supplier: true }, orderBy: { purchaseDate: "desc" } });
  const csv = toCSV(list.map(p => ({
    date: p.purchaseDate.toISOString().slice(0, 10),
    project: p.project.reference, projectName: p.project.name,
    description: p.description, category: p.category,
    supplier: p.supplier?.name ?? "",
    amount: Number(p.amount), status: p.status, comment: p.comment ?? ""
  })));
  return csvResponse(`achats-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
