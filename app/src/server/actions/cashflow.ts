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

  // Si l'utilisateur passe en PAID sans saisir d'override explicite,
  // on snapshot le defaultAmount actuel pour figer l'historique.
  let finalAmountOverride: number | null = data.amountOverride;
  if (data.status === "PAID" && finalAmountOverride === null) {
    const parent = await prisma.recurringExpense.findUniqueOrThrow({
      where: { id: data.recurringExpenseId }
    });
    finalAmountOverride = Number(parent.defaultAmount);
  }

  await prisma.recurringExpenseMonth.upsert({
    where: {
      recurringExpenseId_year_month: {
        recurringExpenseId: data.recurringExpenseId,
        year: data.year,
        month: data.month
      }
    },
    update: {
      amountOverride: finalAmountOverride,
      status: data.status,
      paidAt: data.status === "PAID" ? new Date() : null,
      notes: data.notes
    },
    create: {
      recurringExpenseId: data.recurringExpenseId,
      year: data.year,
      month: data.month,
      amountOverride: finalAmountOverride,
      status: data.status,
      paidAt: data.status === "PAID" ? new Date() : null,
      notes: data.notes
    }
  });
  revalidatePath("/cashflow");
}

/**
 * Bascule rapide du statut : PLANNED ↔ PAID (toggle 2 états).
 * Le statut SKIPPED reste accessible via le modal d'édition de cellule.
 *
 * IMPORTANT : quand on passe en PAID, on FIGE le montant en copiant
 * defaultAmount dans amountOverride (sauf si un override existe déjà).
 * Comme ça, si plus tard on change le defaultAmount du récurrent
 * (ex: augmentation de salaire), les mois déjà payés gardent leur
 * montant historique réel.
 */
export async function cycleMonthlyStatus(
  recurringExpenseId: string,
  year: number,
  month: number
) {
  await requirePermission(PERM_WRITE);
  const [existing, parent] = await Promise.all([
    prisma.recurringExpenseMonth.findUnique({
      where: {
        recurringExpenseId_year_month: { recurringExpenseId, year, month }
      }
    }),
    prisma.recurringExpense.findUniqueOrThrow({
      where: { id: recurringExpenseId }
    })
  ]);

  const isCurrentlyPaid = existing?.status === "PAID";
  const next: "PLANNED" | "PAID" = isCurrentlyPaid ? "PLANNED" : "PAID";

  // Snapshot : on fige le montant payé pour qu'il ne bouge plus si
  // defaultAmount du parent change plus tard.
  // Si un amountOverride existe déjà, on le garde tel quel.
  // Sinon, on copie le defaultAmount actuel dans l'override.
  const shouldSnapshot =
    next === "PAID" && (!existing || existing.amountOverride === null);

  await prisma.recurringExpenseMonth.upsert({
    where: {
      recurringExpenseId_year_month: { recurringExpenseId, year, month }
    },
    update: {
      status: next,
      paidAt: next === "PAID" ? new Date() : null,
      ...(shouldSnapshot ? { amountOverride: parent.defaultAmount } : {})
    },
    create: {
      recurringExpenseId,
      year,
      month,
      status: next,
      paidAt: next === "PAID" ? new Date() : null,
      amountOverride: shouldSnapshot ? parent.defaultAmount : null
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

/**
 * Crée plusieurs entrées OneOff en récurrence mensuelle entre 2 dates.
 * Chaque entrée hérite des mêmes label/category/amount/kind, datée au
 * même jour du mois (ex: 15 mai, 15 juin, 15 juillet…).
 * Le libellé inclut le mois pour différencier (ex: "Loyer estimé Mai 2026").
 */
const RecurringOneOffSchema = z.object({
  label: z.string().min(1).max(160),
  category: z.string().optional().nullable().transform((v) => v?.trim() || null),
  amount: z.coerce.number(),
  /** Date de la 1ère occurrence (sera répliquée mensuellement) */
  startDate: z.string().min(1).transform((v) => new Date(v)),
  /** Date de fin INCLUSE (dernier mois où on génère une occurrence) */
  endDate: z.string().min(1).transform((v) => new Date(v)),
  kind: z.enum(["EXPENSE", "INCOME", "COMMITMENT", "SIMULATION"]),
  status: z.enum(["PLANNED", "PAID", "SKIPPED"]).default("PLANNED"),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function createRecurringOneOffEntries(formData: FormData) {
  const session = await requirePermission(PERM_WRITE);
  const data = RecurringOneOffSchema.parse(Object.fromEntries(formData));

  if (data.endDate < data.startDate) {
    throw new Error("La date de fin doit être après la date de début");
  }

  const MONTH_LABELS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  // Construit la liste des dates : 1 par mois, même jour du mois que startDate
  const dates: Date[] = [];
  const startDay = data.startDate.getUTCDate();
  let curYear = data.startDate.getUTCFullYear();
  let curMonth = data.startDate.getUTCMonth(); // 0-11
  const endYear = data.endDate.getUTCFullYear();
  const endMonth = data.endDate.getUTCMonth();

  while (
    curYear < endYear ||
    (curYear === endYear && curMonth <= endMonth)
  ) {
    // Ajuste si le jour n'existe pas dans le mois (ex: 31 février → 28)
    const lastDay = new Date(Date.UTC(curYear, curMonth + 1, 0)).getUTCDate();
    const day = Math.min(startDay, lastDay);
    dates.push(new Date(Date.UTC(curYear, curMonth, day)));
    curMonth++;
    if (curMonth > 11) {
      curMonth = 0;
      curYear++;
    }
  }

  if (dates.length === 0) {
    throw new Error("Aucune occurrence à générer dans la plage");
  }

  // Group ID partagé pour que la grille affiche tout en 1 ligne
  const groupId = `rg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  let created = 0;
  for (const date of dates) {
    const monthLabel = MONTH_LABELS[date.getUTCMonth()];
    const fullLabel = `${data.label} — ${monthLabel} ${date.getUTCFullYear()}`;
    await prisma.oneOffCashflowEntry.create({
      data: {
        label: fullLabel,
        category: data.category,
        amount: Math.abs(data.amount),
        date,
        kind: data.kind,
        status: data.status,
        paidAt: data.status === "PAID" ? new Date() : null,
        notes: data.notes,
        recurrenceGroupId: groupId,
        createdBy: { connect: { id: session.user.id } }
      }
    });
    created++;
  }

  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "OneOffCashflowEntry",
    message: `${created} entrées récurrentes (${data.kind}) générées : « ${data.label} » de ${data.startDate.toISOString().slice(0, 10)} à ${data.endDate.toISOString().slice(0, 10)}`
  });

  revalidatePath("/cashflow");
  return { created };
}

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

/**
 * Supprime une entrée OneOff.
 *
 * Par défaut (`cascadeGroup: true`) : si l'entrée appartient à un groupe de
 * récurrence (recurrenceGroupId non null), supprime *toutes* les entrées du
 * groupe. Sinon la ligne agrégée réapparaîtrait au refresh avec les 11 autres
 * mois. Comportement utilisé par le bouton "Supprimer" sur la ligne entière.
 *
 * Avec `cascadeGroup: false` : supprime uniquement cette entrée précise. Utilisé
 * par le modal d'édition cellule par cellule, où l'utilisateur veut juste retirer
 * un mois précis sans casser le reste de la récurrence.
 */
export async function deleteOneOffEntry(
  id: string,
  cascadeGroup: boolean = true
) {
  const session = await requirePermission(PERM_WRITE);
  const before = await prisma.oneOffCashflowEntry.findUniqueOrThrow({
    where: { id }
  });
  const groupId = (before as { recurrenceGroupId?: string | null })
    .recurrenceGroupId;
  let deletedCount = 1;
  const willCascade = cascadeGroup && !!groupId;
  if (willCascade) {
    const result = await prisma.oneOffCashflowEntry.deleteMany({
      where: { recurrenceGroupId: groupId! }
    });
    deletedCount = result.count;
  } else {
    await prisma.oneOffCashflowEntry.delete({ where: { id } });
  }
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "OneOffCashflowEntry",
    entityId: id,
    message: willCascade
      ? `Récurrence cashflow « ${before.label} » supprimée (${deletedCount} entrées)`
      : `Entrée cashflow « ${before.label} » supprimée`
  });
  revalidatePath("/cashflow");
  return { deletedCount, wasGroup: willCascade };
}

/**
 * Récupère un OneOff par son id (pour l'édition cellule par cellule).
 */
export async function getOneOffById(id: string) {
  await requirePermission(PERM);
  const o = await prisma.oneOffCashflowEntry.findUniqueOrThrow({
    where: { id }
  });
  return {
    id: o.id,
    label: o.label,
    category: o.category,
    amount: Number(o.amount),
    date: o.date.toISOString().slice(0, 10),
    kind: o.kind,
    status: o.status,
    notes: o.notes
  };
}

/**
 * Met à jour un OneOff précis : amount + status (édition rapide cellule).
 */
const OneOffCellUpdateSchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  status: z.enum(["PLANNED", "PAID", "SKIPPED"])
});

export async function updateOneOffCell(formData: FormData) {
  const session = await requirePermission(PERM_WRITE);
  const data = OneOffCellUpdateSchema.parse(Object.fromEntries(formData));
  await prisma.oneOffCashflowEntry.update({
    where: { id: data.id },
    data: {
      amount: data.amount,
      status: data.status,
      paidAt: data.status === "PAID" ? new Date() : null
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "OneOffCashflowEntry",
    entityId: data.id,
    message: `OneOff cellule mise à jour : ${data.amount}€ / ${data.status}`
  });
  revalidatePath("/cashflow");
}

/**
 * Nettoie le cashflow avant un mois donné :
 *  - Toutes les RecurringExpenseMonth pour les mois antérieurs sont marquées SKIPPED
 *    (donc ne comptent pas dans les totaux mais restent visibles, barrées)
 *  - Toutes les OneOffCashflowEntry datées avant sont SUPPRIMÉES
 *
 * Utile quand on commence à encoder son cashflow en cours d'année : on
 * « démarre » l'encodage à partir d'un mois donné, le reste avant est neutralisé.
 *
 * @param year - année concernée (ex: 2026)
 * @param fromMonth - mois à partir duquel on garde tout (ex: 5 = mai)
 *                   → tout ce qui est strictement avant ce mois est skipped/supprimé
 */
export async function cleanupCashflowBefore(year: number, fromMonth: number) {
  const session = await requirePermission(PERM_WRITE);

  // 1) Skipper les récurrents avant fromMonth (Jan → fromMonth-1)
  let skippedCount = 0;
  if (fromMonth > 1) {
    const allRecurring = await prisma.recurringExpense.findMany({
      select: { id: true }
    });
    for (const r of allRecurring) {
      for (let m = 1; m < fromMonth; m++) {
        await prisma.recurringExpenseMonth.upsert({
          where: {
            recurringExpenseId_year_month: {
              recurringExpenseId: r.id,
              year,
              month: m
            }
          },
          update: { status: "SKIPPED" },
          create: {
            recurringExpenseId: r.id,
            year,
            month: m,
            status: "SKIPPED"
          }
        });
        skippedCount++;
      }
    }
  }

  // 2) Supprimer les one-offs avant fromMonth de cette année
  const cutoff = new Date(Date.UTC(year, fromMonth - 1, 1)); // 1er du mois fromMonth
  const deleted = await prisma.oneOffCashflowEntry.deleteMany({
    where: {
      date: {
        gte: new Date(Date.UTC(year, 0, 1)), // 1er janvier
        lt: cutoff // strictement avant le mois choisi
      }
    }
  });

  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "CashflowSettings",
    message: `Nettoyage cashflow ${year} avant mois ${fromMonth} : ${skippedCount} récurrents skippés, ${deleted.count} one-offs supprimés`
  });

  revalidatePath("/cashflow");
  return { skippedCount, deletedCount: deleted.count };
}

/**
 * Génère N BillingMilestones (1 par mois) pour une mission, entre 2 dates.
 *
 * Chaque tranche est créée avec :
 *  - label = "Facturation MIS-XXX – Mois Année (X jours)"
 *  - amount = defaultDays × mission.dailyRate
 *  - expectedAt = jour `billingDay` du mois (par défaut dernier jour)
 *  - missionId = la mission
 *  - companyId = client de la mission (pour affichage cashflow)
 *  - status = PLANNED
 *
 * Idempotent : si une tranche existe déjà sur ce mois pour cette mission
 * (basé sur missionId + mois de expectedAt), on la skip pour ne pas
 * créer de doublons.
 *
 * @returns nombre de tranches effectivement créées
 */
export async function generateMonthlyMissionInvoices(input: {
  missionId: string;
  defaultDays: number;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  billingDay?: number; // 1-28 ou null = dernier jour
}): Promise<{ created: number; skipped: number }> {
  const session = await requirePermission(PERM_WRITE);

  const mission = await prisma.mission.findUniqueOrThrow({
    where: { id: input.missionId },
    include: { company: { select: { name: true } } }
  });

  const dailyRate = Number(mission.dailyRate);
  const days = Math.max(0, Number(input.defaultDays || 0));

  // Listes des (year, month) à parcourir
  const months: { year: number; month: number }[] = [];
  let y = input.fromYear;
  let m = input.fromMonth;
  while (
    y < input.toYear ||
    (y === input.toYear && m <= input.toMonth)
  ) {
    months.push({ year: y, month: m });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  let created = 0;
  let skipped = 0;

  const MONTH_LABELS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  for (const { year, month } of months) {
    // Date de facturation : billingDay du mois, ou dernier jour si non spécifié / > 28
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = Math.min(
      Math.max(input.billingDay ?? lastDayOfMonth, 1),
      lastDayOfMonth
    );
    const expectedAt = new Date(Date.UTC(year, month - 1, day));

    // Idempotence : on cherche un milestone existant pour cette mission ce mois
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const existing = await prisma.billingMilestone.findFirst({
      where: {
        missionId: input.missionId,
        expectedAt: { gte: monthStart, lte: monthEnd }
      }
    });
    if (existing) {
      skipped++;
      continue;
    }

    const amount = Math.round(days * dailyRate * 100) / 100;
    const label = `${mission.reference} — ${MONTH_LABELS[month - 1]} ${year} (${days}j)`;

    await prisma.billingMilestone.create({
      data: {
        label,
        amount,
        expectedAt,
        status: "PLANNED",
        appliedDailyRate: dailyRate, // snapshot pour ne pas bouger si rate change
        mission: { connect: { id: input.missionId } },
        // Lien direct vers la company pour qu'elle apparaisse dans le cashflow
        ...(mission.companyId
          ? { company: { connect: { id: mission.companyId } } }
          : {}),
        comment: `Généré auto : ${days}j × ${dailyRate}€`
      }
    });
    created++;
  }

  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "BillingMilestone",
    entityId: input.missionId,
    message: `Facturation récurrente générée pour mission ${mission.reference} : ${created} tranches créées, ${skipped} déjà existantes`
  });

  revalidatePath("/cashflow");
  return { created, skipped };
}

// ─────────────────────────────────────────────────────────────
// MILESTONES individuels (édition rapide depuis le cashflow)
// ─────────────────────────────────────────────────────────────

const MilestoneUpdateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  amount: z.coerce.number().min(0),
  comment: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function updateBillingMilestone(formData: FormData) {
  const session = await requirePermission(PERM_WRITE);
  const data = MilestoneUpdateSchema.parse(Object.fromEntries(formData));
  await prisma.billingMilestone.update({
    where: { id: data.id },
    data: {
      label: data.label,
      amount: data.amount,
      comment: data.comment
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "BillingMilestone",
    entityId: data.id,
    message: `Tranche mise à jour depuis cashflow`
  });
  revalidatePath("/cashflow");
}

/**
 * Récupère toutes les tranches d'une mission sur une année donnée,
 * indexées par mois (1-12). Inclut le taux journalier de la mission
 * pour calculer le nombre de jours implicite (amount / dailyRate).
 */
export async function getMissionMilestonesYear(missionId: string, year: number) {
  await requirePermission(PERM);
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  const [mission, milestones] = await Promise.all([
    prisma.mission.findUniqueOrThrow({
      where: { id: missionId },
      include: { company: { select: { name: true } } }
    }),
    prisma.billingMilestone.findMany({
      where: {
        missionId,
        expectedAt: { gte: yearStart, lte: yearEnd }
      },
      orderBy: { expectedAt: "asc" }
    })
  ]);

  // Fetch vatRate séparément (cf. fix dans cashflow.ts pour éviter le bug Prisma)
  let vatRate = 21;
  try {
    const row = await prisma.$queryRawUnsafe<{ vatRate: number | string }[]>(
      `SELECT "vatRate" FROM "Mission" WHERE id = '${missionId.replace(/'/g, "''")}'`
    );
    if (row[0]?.vatRate != null) {
      const v = Number(row[0].vatRate);
      if (Number.isFinite(v)) vatRate = v;
    }
  } catch {
    // colonne manquante : fallback 21%
  }

  return {
    mission: {
      id: mission.id,
      reference: mission.reference,
      title: mission.title,
      dailyRate: Number(mission.dailyRate),
      vatRate,
      startDate: mission.startDate.toISOString().slice(0, 10),
      endDate: mission.endDate.toISOString().slice(0, 10),
      companyName: mission.company?.name ?? null,
      companyId: mission.companyId ?? null
    },
    milestones: milestones.map((m) => ({
      id: m.id,
      label: m.label,
      amount: Number(m.amount),
      status: m.status,
      expectedAt: m.expectedAt?.toISOString() ?? null,
      paidAt: m.paidAt?.toISOString() ?? null,
      comment: m.comment,
      month: m.expectedAt ? m.expectedAt.getUTCMonth() + 1 : null
    }))
  };
}

/**
 * Met à jour rate / dates / vatRate d'une mission depuis le cashflow.
 * Utilise un raw SQL pour vatRate (évite le bug Prisma observé en prod).
 */
const MissionEditSchema = z.object({
  missionId: z.string().min(1),
  newDailyRate: z.coerce.number().nonnegative().optional(),
  newVatRate: z.coerce.number().min(0).max(100).optional(),
  newStartDate: z.string().optional(),
  newEndDate: z.string().optional()
});

export async function updateMissionFromCashflow(formData: FormData) {
  const session = await requirePermission(PERM_WRITE);
  const parsed = MissionEditSchema.parse(Object.fromEntries(formData));

  // 1) Updates standard via Prisma (dailyRate, dates)
  const data: any = {};
  if (parsed.newDailyRate !== undefined) data.dailyRate = parsed.newDailyRate;
  if (parsed.newStartDate) data.startDate = new Date(parsed.newStartDate);
  if (parsed.newEndDate) data.endDate = new Date(parsed.newEndDate);
  if (Object.keys(data).length > 0) {
    await prisma.mission.update({
      where: { id: parsed.missionId },
      data
    });
  }

  // 2) vatRate via raw SQL (évite le souci de typage Prisma sur cette colonne)
  if (parsed.newVatRate !== undefined) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Mission" SET "vatRate" = ${parsed.newVatRate} WHERE id = '${parsed.missionId.replace(/'/g, "''")}'`
      );
    } catch (e) {
      // Si colonne manquante : pas grave, on log et on continue
      console.error("[cashflow] update vatRate raw failed:", e);
    }
  }

  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Mission",
    entityId: parsed.missionId,
    message: `Mission mise à jour depuis cashflow`
  });
  revalidatePath("/cashflow");
  revalidatePath(`/missions/${parsed.missionId}`);
}

/**
 * Met à jour en bulk les tranches d'une mission pour une année, en
 * spécifiant uniquement un nombre de jours par mois.
 * - Si la tranche existe : son montant est mis à jour (= days × dailyRate)
 *   et le label est régénéré pour inclure les jours.
 * - Si pas de tranche pour ce mois et days > 0 : on en crée une.
 * - Si tranche existe et days = 0 : on la supprime (l'utilisateur peut
 *   aussi le faire individuellement, mais c'est plus pratique en bulk).
 */
const BulkUpdateSchema = z.object({
  missionId: z.string().min(1),
  year: z.coerce.number().int(),
  // JSON stringifié : { "1": 20, "2": 18, ... } (mois → jours)
  daysByMonth: z.string().transform((v) => JSON.parse(v) as Record<string, number>)
});

export async function updateMissionDaysBulk(formData: FormData) {
  const session = await requirePermission(PERM_WRITE);
  const parsed = BulkUpdateSchema.parse(Object.fromEntries(formData));
  const { missionId, year, daysByMonth } = parsed;

  const mission = await prisma.mission.findUniqueOrThrow({
    where: { id: missionId }
  });
  const dailyRate = Number(mission.dailyRate);

  const MONTH_LABELS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  let updated = 0;
  let created = 0;
  let deleted = 0;

  for (const [monthStr, daysVal] of Object.entries(daysByMonth)) {
    const month = parseInt(monthStr, 10);
    if (month < 1 || month > 12) continue;
    const days = Math.max(0, Number(daysVal) || 0);

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const existing = await prisma.billingMilestone.findFirst({
      where: {
        missionId,
        expectedAt: { gte: monthStart, lte: monthEnd }
      }
    });

    // Protection : on ne touche pas aux tranches déjà PAID en bulk
    if (existing && existing.status === "PAID") {
      continue;
    }

    if (days === 0) {
      if (existing) {
        await prisma.billingMilestone.delete({ where: { id: existing.id } });
        deleted++;
      }
      continue;
    }

    // Pour les tranches existantes : si elles ont un appliedDailyRate
    // snapshotté, on l'utilise pour préserver l'historique. Sinon fallback
    // sur le rate actuel de la mission.
    const existingSnapshot = (existing as { appliedDailyRate?: any } | null)
      ?.appliedDailyRate;
    const effectiveRate =
      existingSnapshot != null && Number.isFinite(Number(existingSnapshot))
        ? Number(existingSnapshot)
        : dailyRate;

    const amount = Math.round(days * effectiveRate * 100) / 100;
    const label = `${mission.reference} — ${MONTH_LABELS[month - 1]} ${year} (${days}j)`;

    if (existing) {
      await prisma.billingMilestone.update({
        where: { id: existing.id },
        data: {
          amount,
          label,
          // Pose le snapshot si pas encore défini (rétro-compat)
          ...(existingSnapshot == null
            ? { appliedDailyRate: effectiveRate }
            : {})
        }
      });
      updated++;
    } else {
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const expectedAt = new Date(Date.UTC(year, month - 1, lastDay));
      // Nouvelle tranche : on snapshot le rate actuel de la mission
      await prisma.billingMilestone.create({
        data: {
          label,
          amount: Math.round(days * dailyRate * 100) / 100,
          expectedAt,
          status: "PLANNED",
          appliedDailyRate: dailyRate,
          mission: { connect: { id: missionId } },
          ...(mission.companyId
            ? { company: { connect: { id: mission.companyId } } }
            : {})
        }
      });
      created++;
    }
  }

  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "BillingMilestone",
    entityId: missionId,
    message: `Mission ${mission.reference} — jours bulk update ${year} : ${updated} mises à jour, ${created} créées, ${deleted} supprimées`
  });

  revalidatePath("/cashflow");
  return { updated, created, deleted };
}

export async function getMilestonesByIds(ids: string[]) {
  await requirePermission(PERM);
  if (ids.length === 0) return [];
  const list = await prisma.billingMilestone.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      label: true,
      amount: true,
      status: true,
      expectedAt: true,
      paidAt: true,
      comment: true,
      missionId: true,
      mission: {
        select: { id: true, reference: true, dailyRate: true }
      }
    },
    orderBy: { expectedAt: "asc" }
  });
  return list.map((m) => ({
    id: m.id,
    label: m.label,
    amount: Number(m.amount),
    status: m.status,
    expectedAt: m.expectedAt?.toISOString() ?? null,
    paidAt: m.paidAt?.toISOString() ?? null,
    comment: m.comment,
    missionId: m.missionId,
    mission: m.mission
      ? {
          id: m.mission.id,
          reference: m.mission.reference,
          dailyRate: Number(m.mission.dailyRate)
        }
      : null
  }));
}

/**
 * Met à jour le nombre de jours d'une tranche liée à une mission.
 * Le montant et le libellé sont régénérés auto depuis le taux de la mission.
 * Refuse si la tranche est PAID (verrou).
 */
const UpdateMissionDaysSchema = z.object({
  id: z.string().min(1),
  days: z.coerce.number().min(0)
});

export async function updateMissionMilestoneDays(formData: FormData) {
  const session = await requirePermission(PERM_WRITE);
  const { id, days } = UpdateMissionDaysSchema.parse(
    Object.fromEntries(formData)
  );
  const existing = await prisma.billingMilestone.findUniqueOrThrow({
    where: { id },
    include: { mission: true }
  });
  if (!existing.mission) {
    throw new Error("Cette tranche n'est pas liée à une mission");
  }
  if (existing.status === "PAID") {
    throw new Error("Tranche déjà payée — modification refusée");
  }
  if (days === 0) {
    await prisma.billingMilestone.delete({ where: { id } });
    await logActivity({
      actorId: session.user.id,
      action: "DELETE",
      entityType: "BillingMilestone",
      entityId: id,
      message: `Tranche supprimée (0 jours)`
    });
    revalidatePath("/cashflow");
    return;
  }
  // Utilise le snapshot rate de la tranche si présent, sinon fallback au
  // rate actuel de la mission (rétro-compat pour les tranches sans snapshot)
  const existingSnapshot = (existing as { appliedDailyRate?: any })
    ?.appliedDailyRate;
  const effectiveRate =
    existingSnapshot != null && Number.isFinite(Number(existingSnapshot))
      ? Number(existingSnapshot)
      : Number(existing.mission.dailyRate);
  const amount = Math.round(days * effectiveRate * 100) / 100;
  const MONTH_LABELS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  const monthIdx = existing.expectedAt?.getUTCMonth() ?? 0;
  const yr = existing.expectedAt?.getUTCFullYear() ?? new Date().getFullYear();
  const label = `${existing.mission.reference} — ${MONTH_LABELS[monthIdx]} ${yr} (${days}j)`;
  await prisma.billingMilestone.update({
    where: { id },
    data: {
      amount,
      label,
      // Pose le snapshot si pas défini
      ...(existingSnapshot == null
        ? { appliedDailyRate: effectiveRate }
        : {})
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "BillingMilestone",
    entityId: id,
    message: `Tranche mission ajustée : ${days}j × ${effectiveRate}€ = ${amount}€`
  });
  revalidatePath("/cashflow");
}

export async function deleteBillingMilestoneFromCashflow(id: string) {
  const session = await requirePermission(PERM_WRITE);
  const before = await prisma.billingMilestone.findUniqueOrThrow({
    where: { id }
  });
  await prisma.billingMilestone.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "BillingMilestone",
    entityId: id,
    message: `Tranche « ${before.label} » supprimée depuis cashflow`
  });
  revalidatePath("/cashflow");
}

/**
 * Crée une nouvelle tranche pour une mission sur un mois donné.
 * Utilisé pour ajouter une tranche manquante depuis le cashflow (ex: bonus,
 * facturation hors barème).
 */
const NewMilestoneSchema = z.object({
  missionId: z.string().min(1),
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
  label: z.string().min(1).max(200),
  amount: z.coerce.number().min(0)
});

export async function addBillingMilestoneToMission(formData: FormData) {
  const session = await requirePermission(PERM_WRITE);
  const data = NewMilestoneSchema.parse(Object.fromEntries(formData));
  const mission = await prisma.mission.findUniqueOrThrow({
    where: { id: data.missionId }
  });
  // Date de facturation : dernier jour du mois par défaut
  const lastDay = new Date(Date.UTC(data.year, data.month, 0)).getUTCDate();
  const expectedAt = new Date(Date.UTC(data.year, data.month - 1, lastDay));

  await prisma.billingMilestone.create({
    data: {
      label: data.label,
      amount: data.amount,
      expectedAt,
      status: "PLANNED",
      appliedDailyRate: Number(mission.dailyRate), // snapshot rate mission
      mission: { connect: { id: data.missionId } },
      ...(mission.companyId
        ? { company: { connect: { id: mission.companyId } } }
        : {})
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "BillingMilestone",
    entityId: data.missionId,
    message: `Tranche « ${data.label} » ajoutée depuis cashflow`
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
