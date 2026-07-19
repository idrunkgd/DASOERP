"use server";
/**
 * CRUD des PayrollEmployee. Chaque save invalide /cashflow et /employees
 * car les 3 lignes cashflow "Salaires / Précompte / ONSS" sont dérivées
 * de cette table en temps réel côté serveur.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  role:      z.string().optional().nullable().transform((v) => v?.trim() || null),
  startDate: z.string().min(1),
  endDate:   z.string().optional().nullable().transform((v) => v || null),
  monthlyNetPay:         z.coerce.number().nonnegative().default(0),
  monthlyWithholdingTax: z.coerce.number().nonnegative().default(0),
  monthlyOnss:           z.coerce.number().nonnegative().default(0),
  monthlyGrossReference: z.coerce.number().nonnegative().optional().nullable(),
  monthsPerYear:         z.coerce.number().positive().default(13.92),
  /// Lien optionnel vers la source (candidat externe ou consultant interne)
  candidateId: z.string().optional().nullable().transform((v) => v || null),
  userId:      z.string().optional().nullable().transform((v) => v || null),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function createEmployee(formData: FormData) {
  await requirePermission("finance.write");
  const data = Schema.parse(Object.fromEntries(formData));
  // XOR : au max un seul lien source
  if (data.candidateId && data.userId) {
    throw new Error("Un employé ne peut pas être lié à la fois à un candidat et un consultant interne.");
  }
  await prisma.payrollEmployee.create({
    data: {
      ...data,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null
    }
  });
  revalidatePath("/employees");
  revalidatePath("/cashflow");
  return { ok: true };
}

export async function updateEmployee(id: string, formData: FormData) {
  await requirePermission("finance.write");
  const data = Schema.parse(Object.fromEntries(formData));
  await prisma.payrollEmployee.update({
    where: { id },
    data: {
      ...data,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null
    }
  });
  revalidatePath("/employees");
  revalidatePath("/cashflow");
  return { ok: true };
}

export async function deleteEmployee(id: string) {
  await requirePermission("finance.write");
  await prisma.payrollEmployee.delete({ where: { id } });
  revalidatePath("/employees");
  revalidatePath("/cashflow");
  return { ok: true };
}

// ─── Statut d'une cellule payroll (mois × kind) ──────────────

type PayrollKindStr = "NET_PAY" | "WITHHOLDING_TAX" | "ONSS";
type CashflowStatusStr = "PLANNED" | "PAID" | "SKIPPED";

/**
 * Marque une cellule payroll comme payée / à venir / skip. Idempotent :
 * si aucune ligne PayrollMonth n'existe encore pour ce couple (year, month,
 * kind), elle est créée. Sinon on update.
 */
export async function setPayrollMonthStatus(
  year: number, month: number, kind: PayrollKindStr, status: CashflowStatusStr
) {
  await requirePermission("finance.write");
  const paidAt = status === "PAID" ? new Date() : null;
  await prisma.payrollMonth.upsert({
    where: { year_month_kind: { year, month, kind } },
    create: { year, month, kind, status, paidAt },
    update: { status, paidAt }
  });
  revalidatePath("/cashflow");
  revalidatePath("/employees");
  return { ok: true };
}

/**
 * Corrige le montant réel d'un versement (rare — quand la banque a débité
 * un montant différent du calculé et qu'on veut refléter le réel).
 */
export async function setPayrollMonthAmount(
  year: number, month: number, kind: PayrollKindStr, amount: number | null
) {
  await requirePermission("finance.write");
  await prisma.payrollMonth.upsert({
    where: { year_month_kind: { year, month, kind } },
    create: { year, month, kind, amountOverride: amount },
    update: { amountOverride: amount }
  });
  revalidatePath("/cashflow");
  return { ok: true };
}
