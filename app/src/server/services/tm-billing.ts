import { prisma } from "@/lib/db";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Génère une tranche de facturation T&M pour le projet sur le mois donné.
 * - Total = somme(heures validées du mois × tarif jour de l'offre / hoursPerDay)
 *   Par défaut on prend le PU vente de la 1ʳᵉ ligne de l'offre source en €/jour, 8h = 1 jour.
 * - Crée une BillingMilestone status PLANNED, label "TM AAAA-MM" — UPSERT (1 par mois).
 */
export async function generateMonthlyTMBilling(projectId: string, monthDate: Date) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { sourceOffer: { include: { lines: { orderBy: { position: "asc" }, take: 1 } } } }
  });
  if (project.mode !== "CONSULTING") throw new Error("Génération T&M réservée aux projets CONSULTING");

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  // Tarif jour : 1ʳᵉ ligne de l'offre source en €/jour
  const line = project.sourceOffer?.lines[0];
  if (!line) throw new Error("Aucune ligne d'offre source pour calculer le tarif jour");
  const dailyRate = Number(line.unitSellPrice);
  const hoursPerDay = 8;

  // Heures validées du mois
  const entries = await prisma.timesheetEntry.findMany({
    where: { projectId, status: "APPROVED", date: { gte: monthStart, lte: monthEnd } }
  });
  const hours = entries.reduce((s, e) => s + Number(e.hours), 0);
  const days = hours / hoursPerDay;
  const amount = Math.round(days * dailyRate * 100) / 100;

  const label = `T&M ${format(monthStart, "LLLL yyyy", { locale: fr })}`;

  // Cherche une tranche existante pour ce mois (label match)
  const existing = await prisma.billingMilestone.findFirst({
    where: { projectId, label, status: { not: "PAID" } }
  });

  if (existing) {
    return prisma.billingMilestone.update({
      where: { id: existing.id },
      data: { amount, expectedAt: monthEnd, trigger: `${hours.toFixed(1)}h validées × ${dailyRate}€/j (${hoursPerDay}h)` }
    });
  }
  return prisma.billingMilestone.create({
    data: {
      projectId, label, amount,
      expectedAt: monthEnd,
      trigger: `${hours.toFixed(1)}h validées × ${dailyRate}€/j (${hoursPerDay}h)`,
      status: "PLANNED"
    }
  });
}
