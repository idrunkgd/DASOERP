import { prisma } from "@/lib/db";
import { computeProjectMargin } from "@/lib/calc";

/**
 * Recalcule les agrégats projet :
 *  - actualTimeH    = somme heures timesheet APPROVED
 *  - actualTimeCost = somme(hours × hourlyCost user) sur entries APPROVED
 *  - actualPurchaseCost = somme achats RECEIVED ou PAID
 *  - marginActual   = budgetSell - actualTimeCost - actualPurchaseCost
 */
export async function recomputeProject(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

  const ts = await prisma.timesheetEntry.findMany({
    where: { projectId, status: "APPROVED" },
    include: { user: true }
  });
  const actualTimeH = ts.reduce((s, t) => s + Number(t.hours), 0);
  const actualTimeCost = ts.reduce((s, t) => {
    const rate = Number(t.computedCost ?? 0) > 0
      ? Number(t.computedCost)
      : Number(t.hours) * Number(t.user.hourlyCost ?? 0);
    return s + rate;
  }, 0);

  const purchases = await prisma.purchase.findMany({
    where: { projectId, status: { in: ["RECEIVED", "PAID"] } }
  });
  const actualPurchaseCost = purchases.reduce((s, p) => s + Number(p.amount), 0);

  const m = computeProjectMargin({
    budgetSell: project.budgetSell.toString(),
    actualTimeCost,
    actualPurchaseCost
  });

  // Avancement simple : min(100, actualTimeH / budgetTimeH * 100)
  const budgetH = Number(project.budgetTimeH);
  const progressPct = budgetH > 0 ? Math.min(100, Math.round((actualTimeH / budgetH) * 1000) / 10) : 0;

  return prisma.project.update({
    where: { id: projectId },
    data: {
      actualTimeH,
      actualTimeCost,
      actualPurchaseCost,
      marginActual: m.marginActual,
      progressPct
    }
  });
}

/** Détecte les projets en dépassement (actualTimeCost + purchases > budgetCost OU actualTimeH > budgetTimeH) */
export async function projectsOverBudget() {
  const all = await prisma.project.findMany({
    where: { status: { in: ["ACTIVE", "TO_START", "ON_HOLD"] } }
  });
  return all.filter(p => {
    const overCost = (Number(p.actualTimeCost) + Number(p.actualPurchaseCost)) > Number(p.budgetCost) && Number(p.budgetCost) > 0;
    const overTime = Number(p.actualTimeH) > Number(p.budgetTimeH) && Number(p.budgetTimeH) > 0;
    return overCost || overTime;
  });
}
