"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const PERM = "finance.read" as const;
const PERM_WRITE = "finance.write" as const;

// ─────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────

export async function upsertCashflowSettings(formData: FormData) {
  const session = await requirePermission(PERM_WRITE);
  const startingBalance = Number(formData.get("startingBalance") ?? 0);
  const startingDate = String(formData.get("startingDate") ?? "");
  const date = startingDate
    ? new Date(startingDate)
    : new Date(new Date().getFullYear(), 0, 1);

  await prisma.cashflowSettings.upsert({
    where: { id: "singleton" },
    update: {
      startingBalance,
      startingDate: date,
      updatedBy: { connect: { id: session.user.id } }
    },
    create: {
      id: "singleton",
      startingBalance,
      startingDate: date,
      updatedBy: { connect: { id: session.user.id } }
    }
  });
  revalidatePath("/cashflow");
}

// ─────────────────────────────────────────────────────────────
// RECURRING EXPENSES
// ─────────────────────────────────────────────────────────────

const RecSchema = z.object({
  label: z.string().min(1).max(120),
  category: z.string().optional().nullable().transform((v) => v?.trim() || null),
  defaultAmount: z.coerce.number().nonnegative(),
  isIncome: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true" || v === "on"),
  frequency: z
    .enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "CUSTOM"])
    .default("MONTHLY"),
  paymentMonths: z
    .string()
    .optional()
    .nullable()
    .transform((v) =>
      !v
        ? []
        : v
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12)
    ),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function createRecurringExpense(formData: FormData) {
  const session = await requirePermission(PERM_WRITE);
  const data = RecSchema.parse(Object.fromEntries(formData));
  const created = await prisma.recurringExpense.create({
    data: {
      label: data.label,
      category: data.category,
      defaultAmount: data.defaultAmount,
      isIncome: data.isIncome ?? false,
      frequency: data.frequency,
      paymentMonths: data.paymentMonths,
      notes: data.notes,
      createdBy: { connect: { id: session.user.id } }
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "RecurringExpense",
    entityId: created.id,
    message: `Récurrent ${data.isIncome ? "(revenu)" : "(dépense)"} « ${data.label} » créé`
  });
  revalidatePath("/cashflow");
  return { id: created.id };
}

export async function updateRecurringExpense(id: string, formData: FormData) {
  const session = await requirePermission(PERM_WRITE);
  const data = RecSchema.parse(Object.fromEntries(formData));
  await prisma.recurringExpense.update({
    where: { id },
    data: {
      label: data.label,
      category: data.category,
      defaultAmount: data.defaultAmount,
      isIncome: data.isIncome ?? false,
      frequency: data.frequency,
      paymentMonths: data.paymentMonths,
      notes: data.notes
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "RecurringExpense",
    entityId: id,
    message: `Récurrent « ${data.label} » mis à jour`
  });
  revalidatePath("/cashflow");
}

export async function deleteRecurringExpense(id: string) {
  const session = await requirePermission(PERM_WRITE);
  const before = await prisma.recurringExpense.findUniqueOrThrow({
    where: { id }
  });
  await prisma.recurringExpense.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "RecurringExpense",
    entityId: id,
    message: `Récurrent « ${before.label} » supprimé`
  });
  revalidatePath("/cashflow");
}

export async function toggleRecurringActive(id: string) {
  await requirePermission(PERM_WRITE);
  const before = await prisma.recurringExpense.findUniqueOrThrow({
    where: { id }
  });
  await prisma.recurringExpense.update({
    where: { id },
    data: { isActive: !before.isActive }
  });
  revalidatePath("/cashflow");
}

// ─────────────────────────────────────────────────────────────
// MONTHLY ENTRIES (override + status)
// ─────────────────────────────────────────────────────────────

const MonthSchema = z.object({
  recurringExpenseId: z.string().min(1),
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
  amountOverride: z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      if (!v || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }),
  status: z.enum(["PLANNED", "PAID", "SKIPPED"]).default("PLANNED"),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function upsertMonthlyEntry(formData: FormData) {
  await requirePermission(PERM_WRITE);
  const data = MonthSchema.parse(Object.fromEntries(formData));
  await prisma.recurringExpenseMonth.upsert({
    where: {
      recurringExpenseId_year_month: {
        recurringExpenseId: data.recurringExpenseId,
        year: data.year,
        month: data.month
      }
    },
    update: {
      amountOverride: data.amountOverride,
      status: data.status,
      paidAt: data.status === "PAID" ? new Date() : null,
      notes: data.notes
    },
    create: {
      recurringExpenseId: data.recurringExpenseId,
      year: data.year,
      month: data.month,
      amountOverride: data.amountOverride,
      status: data.status,
      paidAt: data.status === "PAID" ? new Date() : null,
      notes: data.notes
    }
  });
  revalidatePath("/cashflow");
}

/**
 * Bascule rapide du statut : PLANNED ↔ PAID (toggle 2 états).
 * Le statut SKIPPED reste accessible via le modal d'édition de cellule,
 * pour ne pas le toucher par accident en cliquant trop vite.
 */
export async function cycleMonthlyStatus(
  recurringExpenseId: string,
  year: number,
  month: number
) {
  await requirePermission(PERM_WRITE);
  const existing = await prisma.recurringExpenseMonth.findUnique({
    where: {
      recurringExpenseId_year_month: { recurringExpenseId, year, month }
    }
  });
  // Si déjà PAID → repasse PLANNED. Sinon (PLANNED, SKIPPED, ou inexistant) → PAID.
  const next: "PLANNED" | "PAID" =
    existing?.status === "PAID" ? "PLANNED" : "PAID";

  await prisma.recurringExpenseMonth.upsert({
    where: {
      recurringExpenseId_year_month: { recurringExpenseId, year, month }
    },
    update: {
      status: next,
      paidAt: next === "PAID" ? new Date() : null
    },
    create: {
      recurringExpenseId,
      year,
      month,
      status: next,
      paidAt: next === "PAID" ? new Date() : null
    }
  });
  revalidatePath("/cashflow");
}

// ─────────────────────────────────────────────────────────────
// ONE-OFF ENTRIES (revenus/dépenses, engagements, simulations)
// ─────────────────────────────────────────────────────────────

const OneOffSchema = z.object({
  label: z.string().min(1).max(160),
  category: z.string().optional().nullable().transform((v) => v?.trim() || null),
  amount: z.coerce.number(),
  date: z.string().min(1).transform((v) => new Date(v)),
  kind: z.enum(["EXPENSE", "INCOME", "COMMITMENT", "SIMULATION"]),
  status: z.enum(["PLANNED", "PAID", "SKIPPED"]).default("PLANNED"),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function createOneOffEntry(formData: FormData) {
  const session = await requirePermission(PERM_WRITE);
  const data = OneOffSchema.parse(Object.fromEntries(formData));
  const created = await prisma.oneOffCashflowEntry.create({
    data: {
      label: data.label,
      category: data.category,
      amount: Math.abs(data.amount), // toujours positif, le signe vient de kind
      date: data.date,
      kind: data.kind,
      status: data.status,
      paidAt: data.status === "PAID" ? new Date() : null,
      notes: data.notes,
      createdBy: { connect: { id: session.user.id } }
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "OneOffCashflowEntry",
    entityId: created.id,
    message: `Entrée cashflow ${data.kind} « ${data.label} » : ${data.amount}€`
  });
  revalidatePath("/cashflow");
  return { id: created.id };
}

export async function updateOneOffEntry(id: string, formData: FormData) {
  const session = await requirePermission(PERM_WRITE);
  const data = OneOffSchema.parse(Object.fromEntries(formData));
  await prisma.oneOffCashflowEntry.update({
    where: { id },
    data: {
      label: data.label,
      category: data.category,
      amount: Math.abs(data.amount),
      date: data.date,
      kind: data.kind,
      status: data.status,
      paidAt: data.status === "PAID" ? new Date() : null,
      notes: data.notes
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "OneOffCashflowEntry",
    entityId: id,
    message: `Entrée cashflow mise à jour`
  });
  revalidatePath("/cashflow");
}

export async function deleteOneOffEntry(id: string) {
  const session = await requirePermission(PERM_WRITE);
  const before = await prisma.oneOffCashflowEntry.findUniqueOrThrow({
    where: { id }
  });
  await prisma.oneOffCashflowEntry.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "OneOffCashflowEntry",
    entityId: id,
    message: `Entrée cashflow « ${before.label} » supprimée`
  });
  revalidatePath("/cashflow");
}

export async function toggleOneOffStatus(id: string) {
  await requirePermission(PERM_WRITE);
  const before = await prisma.oneOffCashflowEntry.findUniqueOrThrow({
    where: { id }
  });
  // Toggle 2 états : PAID ↔ PLANNED. Si SKIPPED, on remet PLANNED.
  const next: "PLANNED" | "PAID" =
    before.status === "PAID" ? "PLANNED" : "PAID";
  await prisma.oneOffCashflowEntry.update({
    where: { id },
    data: {
      status: next,
      paidAt: next === "PAID" ? new Date() : null
    }
  });
  revalidatePath("/cashflow");
}
