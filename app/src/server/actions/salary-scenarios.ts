"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { computeSalary } from "@/lib/salary-calc";

const Schema = z.object({
  candidateId: z.string().optional().nullable().transform((v) => v || null),
  label: z.string().min(1).max(120),
  grossMonthly: z.coerce.number().nonnegative(),
  monthsPerYear: z.coerce.number().positive().max(20),
  employerChargesPct: z.coerce.number().min(0).max(100),
  workingDaysPerWeek: z.coerce.number().min(0.5).max(7),
  workingDaysPerYear: z.coerce.number().int().min(1).max(366),
  carMonthlyTco: z.coerce.number().nonnegative(),
  mealVoucherEmployerPerDay: z.coerce.number().min(0).max(20),
  ecoVouchersAnnual: z.coerce.number().nonnegative(),
  groupInsurancePct: z.coerce.number().min(0).max(100),
  hospitalInsuranceMonthly: z.coerce.number().nonnegative(),
  phoneInternetMonthly: z.coerce.number().nonnegative(),
  netExpensesMonthly: z.coerce.number().nonnegative(),
  targetMarginPct: z.coerce.number().min(0).max(500),
  soldDailyRate: z.coerce.number().nonnegative(),
  notes: z.string().optional().nullable().transform((v) => v || null)
});

export async function saveSalaryScenario(formData: FormData) {
  const session = await requirePermission("consulting.read");
  const parsed = Schema.parse(Object.fromEntries(formData));
  const breakdown = computeSalary(parsed);

  // On utilise la forme `connect` (relation) plutôt que les FK directes
  // (`candidateId`, `createdById`) — ça fonctionne quel que soit le variant
  // de CreateInput généré par Prisma (checked vs unchecked).
  const created = await prisma.candidateSalaryScenario.create({
    data: {
      label: parsed.label,
      grossMonthly: parsed.grossMonthly,
      monthsPerYear: parsed.monthsPerYear,
      employerChargesPct: parsed.employerChargesPct,
      workingDaysPerWeek: parsed.workingDaysPerWeek,
      workingDaysPerYear: parsed.workingDaysPerYear,
      carMonthlyTco: parsed.carMonthlyTco,
      mealVoucherEmployerPerDay: parsed.mealVoucherEmployerPerDay,
      ecoVouchersAnnual: parsed.ecoVouchersAnnual,
      groupInsurancePct: parsed.groupInsurancePct,
      hospitalInsuranceMonthly: parsed.hospitalInsuranceMonthly,
      phoneInternetMonthly: parsed.phoneInternetMonthly,
      netExpensesMonthly: parsed.netExpensesMonthly,
      targetMarginPct: parsed.targetMarginPct,
      soldDailyRate: parsed.soldDailyRate,
      totalAnnualCost: breakdown.totalAnnualCost,
      costPerDay: breakdown.costPerDay,
      billableRate: breakdown.billableRate,
      notes: parsed.notes,
      createdBy: { connect: { id: session.user.id } },
      ...(parsed.candidateId
        ? { candidate: { connect: { id: parsed.candidateId } } }
        : {})
    }
  });

  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "CandidateSalaryScenario",
    entityId: created.id,
    message: `Simulation salaire « ${parsed.label} » : brut ${parsed.grossMonthly}€/mois → TJM coût ${breakdown.costPerDay.toFixed(0)}€`
  });

  revalidatePath("/salary-simulator");
  if (parsed.candidateId) revalidatePath(`/candidates/${parsed.candidateId}`);
  return { id: created.id };
}

export async function deleteSalaryScenario(id: string) {
  const session = await requirePermission("consulting.read");
  const before = await prisma.candidateSalaryScenario.findUniqueOrThrow({
    where: { id }
  });
  await prisma.candidateSalaryScenario.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "CandidateSalaryScenario",
    entityId: id,
    message: `Simulation salaire « ${before.label} » supprimée`
  });
  revalidatePath("/salary-simulator");
  if (before.candidateId) revalidatePath(`/candidates/${before.candidateId}`);
}

/**
 * Si le candidat n'a pas encore de dailyCost / minDailyRate, on peut
 * appliquer le résultat de la simulation directement sur sa fiche.
 */
export async function applyScenarioToCandidate(scenarioId: string) {
  const session = await requirePermission("consulting.write");
  const sc = await prisma.candidateSalaryScenario.findUniqueOrThrow({
    where: { id: scenarioId }
  });
  if (!sc.candidateId) {
    throw new Error("Cette simulation n'est rattachée à aucun candidat.");
  }
  await prisma.candidate.update({
    where: { id: sc.candidateId },
    data: {
      dailyCost: sc.costPerDay,
      hourlyCost: Number(sc.costPerDay) / 8,
      minDailyRate: sc.billableRate
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Candidate",
    entityId: sc.candidateId,
    message: `Tarifs appliqués depuis simulation « ${sc.label} » (coût ${Number(sc.costPerDay).toFixed(0)}€, TJM ${Number(sc.billableRate).toFixed(0)}€)`
  });
  revalidatePath(`/candidates/${sc.candidateId}`);
  revalidatePath("/salary-simulator");
}
