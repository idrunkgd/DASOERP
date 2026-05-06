import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { csvResponse, toCSV } from "@/lib/csv";

export async function GET() {
  await requirePermission("projects.read");
  const projects = await prisma.project.findMany({ include: { company: true, manager: true }, orderBy: { createdAt: "desc" } });
  const csv = toCSV(projects.map(p => ({
    reference: p.reference, name: p.name, status: p.status, company: p.company.name,
    manager: p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : "",
    budgetSell: Number(p.budgetSell), budgetCost: Number(p.budgetCost), budgetTimeH: Number(p.budgetTimeH),
    actualTimeH: Number(p.actualTimeH), actualTimeCost: Number(p.actualTimeCost), actualPurchaseCost: Number(p.actualPurchaseCost),
    marginActual: Number(p.marginActual), progressPct: Number(p.progressPct),
    plannedStart: p.plannedStart?.toISOString().slice(0, 10) ?? "",
    plannedEnd: p.plannedEnd?.toISOString().slice(0, 10) ?? ""
  })));
  return csvResponse(`projets-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
