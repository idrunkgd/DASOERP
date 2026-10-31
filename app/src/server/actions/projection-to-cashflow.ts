"use server";
/**
 * Pousse une projection candidat dans le cashflow : crée 3 lignes récurrentes
 * mensuelles (Revenu / Coût / TVA) nommées avec le consultant, bornées sur
 * la durée de l'engagement simulé.
 *
 * Tag : les lignes sont catégorisées "SIMULATION" + marquées via `notes` pour
 * retrouver / supprimer en bloc depuis la page /cashflow.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const Input = z.object({
  consultantName: z.string().min(1),
  candidateId: z.string().optional().nullable(),
  startYear: z.coerce.number().int().min(2020).max(2050),
  durationYears: z.coerce.number().int().min(1).max(5),
  // Montants moyens mensuels (déjà calculés côté simulateur)
  monthlyRevenue: z.coerce.number().positive(),
  monthlyCost: z.coerce.number().positive(),
  monthlyVat: z.coerce.number().nonnegative()
});

const TAG = "SIM_PROJECTION";

/**
 * Crée 3 lignes RecurringExpense (Revenu/Coût/TVA) pour un candidat donné.
 * Si des lignes avec le même tag + consultantName existent déjà, on les
 * remplace (nettoyage puis recréation) pour éviter les doublons.
 */
export async function createCashflowFromProjection(input: z.infer<typeof Input>) {
  const session = await requirePermission("finance.write");
  const d = Input.parse(input);

  const startDate = new Date(Date.UTC(d.startYear, 0, 1));
  const endDate = new Date(Date.UTC(d.startYear + d.durationYears - 1, 11, 31));

  // Supprime d'abord les éventuelles lignes existantes pour ce consultant (idempotence)
  const existing = await prisma.recurringExpense.findMany({
    where: {
      category: "SIMULATION",
      notes: { contains: `${TAG}:${d.consultantName}` }
    },
    select: { id: true }
  });
  if (existing.length > 0) {
    await prisma.recurringExpense.deleteMany({
      where: { id: { in: existing.map((e) => e.id) } }
    });
  }

  // Crée les 3 lignes
  const noteStub = `${TAG}:${d.consultantName} · engagement simulé ${d.startYear}-${d.startYear + d.durationYears - 1}`;
  const [revenue, cost, vat] = await Promise.all([
    (prisma as any).recurringExpense.create({
      data: {
        label:         `Revenu ${d.consultantName}`,
        category:      "SIMULATION",
        defaultAmount: d.monthlyRevenue,
        isIncome:      true,
        frequency:     "MONTHLY",
        startDate, endDate, isActive: true,
        isSimulation:  true,
        notes:         noteStub,
        createdById:   session.user.id
      }
    }),
    (prisma as any).recurringExpense.create({
      data: {
        label:         `Coût ${d.consultantName}`,
        category:      "SIMULATION",
        defaultAmount: d.monthlyCost,
        isIncome:      false,
        frequency:     "MONTHLY",
        startDate, endDate, isActive: true,
        isSimulation:  true,
        notes:         noteStub,
        createdById:   session.user.id
      }
    }),
    (prisma as any).recurringExpense.create({
      data: {
        label:         `TVA ${d.consultantName}`,
        category:      "SIMULATION",
        defaultAmount: d.monthlyVat,
        isIncome:      false,
        frequency:     "MONTHLY",
        startDate, endDate, isActive: true,
        isSimulation:  true,
        notes:         noteStub,
        createdById:   session.user.id
      }
    })
  ]);

  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "RecurringExpense",
    entityId: revenue.id,
    message: `Projection cashflow créée pour ${d.consultantName} (${d.durationYears} ans)`
  });

  revalidatePath("/cashflow");
  revalidatePath("/salary-simulator");
  return { ok: true, created: 3, replaced: existing.length };
}

/**
 * Supprime une projection cashflow (les 3 lignes) pour un consultant donné.
 */
export async function deleteProjectionFromCashflow(consultantName: string) {
  const session = await requirePermission("finance.write");
  const existing = await prisma.recurringExpense.findMany({
    where: {
      category: "SIMULATION",
      notes: { contains: `${TAG}:${consultantName}` }
    },
    select: { id: true }
  });
  if (existing.length === 0) return { ok: true, deleted: 0 };
  await prisma.recurringExpense.deleteMany({
    where: { id: { in: existing.map((e) => e.id) } }
  });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "RecurringExpense",
    message: `Projection cashflow supprimée pour ${consultantName}`
  });
  revalidatePath("/cashflow");
  return { ok: true, deleted: existing.length };
}

/**
 * Liste toutes les projections actives (pour page /salary-simulator).
 */
export async function listActiveProjections() {
  await requirePermission("consulting.read");
  const items = await prisma.recurringExpense.findMany({
    where: { category: "SIMULATION", isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, label: true, defaultAmount: true, isIncome: true,
      startDate: true, endDate: true, notes: true, createdAt: true
    }
  });
  // Regroupe par consultantName (extrait du tag)
  const groups = new Map<string, typeof items>();
  for (const it of items) {
    const m = it.notes?.match(/SIM_PROJECTION:([^·]+)/);
    const name = m ? m[1].trim() : "?";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(it);
  }
  return Array.from(groups.entries()).map(([name, lines]) => ({
    consultantName: name,
    lines,
    monthlyRevenue: Number(lines.find((l) => l.isIncome)?.defaultAmount ?? 0),
    monthlyCost: Number(lines.find((l) => !l.isIncome && l.label.startsWith("Coût"))?.defaultAmount ?? 0),
    monthlyVat: Number(lines.find((l) => l.label.startsWith("TVA"))?.defaultAmount ?? 0),
    startDate: lines[0]?.startDate,
    endDate: lines[0]?.endDate
  }));
}
