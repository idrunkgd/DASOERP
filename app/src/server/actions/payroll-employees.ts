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
import { computeBelgianPayroll, computeBelgianPayrollFromPackage } from "@/lib/belgian-payroll";

const Schema = z.object({
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
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
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null),
  // ─── Package avantages (surcharge scénario candidat) ───
  carMonthlyTco:             z.coerce.number().nonnegative().default(0),
  mealVoucherEmployerPerDay: z.coerce.number().nonnegative().default(0),
  ecoVouchersAnnual:         z.coerce.number().nonnegative().default(0),
  hospitalInsuranceMonthly:  z.coerce.number().nonnegative().default(0),
  phoneInternetMonthly:      z.coerce.number().nonnegative().default(0),
  netExpensesMonthly:        z.coerce.number().nonnegative().default(0)
});

/**
 * Si les montants manuels (net/précompte/ONSS) sont 0 et qu'un brut est fourni,
 * on complète automatiquement depuis le calcul barème I belge.
 */
function fillAutoPayroll(d: z.infer<typeof Schema>) {
  if (!d.monthlyGrossReference || d.monthlyGrossReference <= 0) return d;
  // Si des avantages package sont saisis → calcul complet avec ATN + perks.
  // Sinon → calcul simple barème I.
  const hasPackage = (d.carMonthlyTco + d.mealVoucherEmployerPerDay +
    d.ecoVouchersAnnual + d.hospitalInsuranceMonthly +
    d.phoneInternetMonthly + d.netExpensesMonthly) > 0;
  const gross = Number(d.monthlyGrossReference);
  const calc = hasPackage
    ? computeBelgianPayrollFromPackage({
        grossMonthly: gross,
        carMonthlyTco: d.carMonthlyTco,
        mealVoucherEmployerPerDay: d.mealVoucherEmployerPerDay,
        ecoVouchersAnnual: d.ecoVouchersAnnual,
        hospitalInsuranceMonthly: d.hospitalInsuranceMonthly,
        phoneInternetMonthly: d.phoneInternetMonthly,
        netExpensesMonthly: d.netExpensesMonthly
      })
    : computeBelgianPayroll(gross);
  // ONSS stocké = ONSS employé + ONSS patronal (ce que Dasolabs verse à l'ONSS
  // chaque mois). Cashflow ligne "ONSS" = cette valeur agrégée.
  const totalOnss = Number((calc as any).onssEmployee ?? 0) + Number((calc as any).onssEmployerEstimate ?? 0);
  const netVal = (calc as any).netCash ?? (calc as any).net;
  return {
    ...d,
    monthlyNetPay:         d.monthlyNetPay         > 0 ? d.monthlyNetPay         : netVal,
    monthlyWithholdingTax: d.monthlyWithholdingTax > 0 ? d.monthlyWithholdingTax : calc.withholdingTax,
    monthlyOnss:           d.monthlyOnss           > 0 ? d.monthlyOnss           : totalOnss
  };
}

export async function createEmployee(formData: FormData) {
  await requirePermission("finance.write");
  const parsed = Schema.parse(Object.fromEntries(formData));
  const data = fillAutoPayroll(parsed);
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
  const parsed = Schema.parse(Object.fromEntries(formData));
  const data = fillAutoPayroll(parsed);
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
 *
 * SNAPSHOT PAID : quand on passe en PAID, on fige automatiquement le
 * montant courant dans amountOverride (si pas déjà défini). Les changements
 * futurs sur PayrollEmployee ne pourront plus modifier ce mois payé.
 */
export async function setPayrollMonthStatus(
  year: number, month: number, kind: PayrollKindStr, status: CashflowStatusStr
) {
  await requirePermission("finance.write");
  const paidAt = status === "PAID" ? new Date() : null;

  // Récupère l'override existant pour éviter de l'écraser s'il est déjà défini
  const existing = await prisma.payrollMonth.findUnique({
    where: { year_month_kind: { year, month, kind } }
  });

  let snapshotOverride: number | null = null;
  if (status === "PAID" && (existing?.amountOverride == null)) {
    // On fige la valeur courante en snapshot. Calcul : somme des employés
    // actifs au mois considéré, selon le kind demandé.
    snapshotOverride = await computePayrollSnapshotForMonth(year, month, kind);
  }

  await prisma.payrollMonth.upsert({
    where: { year_month_kind: { year, month, kind } },
    create: {
      year, month, kind, status, paidAt,
      amountOverride: snapshotOverride ?? undefined
    },
    update: {
      status, paidAt,
      ...(snapshotOverride != null ? { amountOverride: snapshotOverride } : {})
    }
  });
  revalidatePath("/cashflow");
  revalidatePath("/employees");
  return { ok: true };
}

/**
 * Calcule la somme payroll pour un mois / kind donné en additionnant tous
 * les employés actifs ce mois-là. Utilisé pour snapshot au passage en PAID.
 */
async function computePayrollSnapshotForMonth(
  year: number, month: number, kind: PayrollKindStr
): Promise<number> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const employees = await prisma.payrollEmployee.findMany({
    where: {
      startDate: { lte: monthEnd },
      OR: [{ endDate: null }, { endDate: { gte: monthStart } }]
    },
    select: {
      monthlyNetPay: true, monthlyWithholdingTax: true, monthlyOnss: true
    }
  });
  const field = kind === "NET_PAY" ? "monthlyNetPay"
              : kind === "WITHHOLDING_TAX" ? "monthlyWithholdingTax"
              : "monthlyOnss";
  return employees.reduce((sum, e) => sum + Number(e[field]), 0);
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
