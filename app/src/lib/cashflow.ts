/**
 * Agrégation cashflow annuelle.
 *
 * Pour une année donnée, on construit une grille 12 mois × N lignes :
 *  - Lignes "Revenus auto" depuis BillingMilestone (regroupés par mois)
 *  - Lignes RecurringExpense (résolution montant : override mensuel OU defaultAmount)
 *  - Lignes OneOffCashflowEntry (kind = EXPENSE / INCOME / COMMITMENT / SIMULATION)
 *
 * Et on calcule :
 *  - Total entrant / sortant par mois (hors simulations)
 *  - Net du mois
 *  - Cumul depuis le solde initial
 *  - Versions "avec simulations" si on veut superposer les what-if
 */

import { prisma } from "@/lib/db";

export type CashflowRowKind =
  | "milestones"           // ligne agrégée des BillingMilestones
  | "recurring_income"
  | "recurring_expense"
  | "oneoff_income"
  | "oneoff_expense"
  | "commitment"
  | "simulation";

export type CashflowCell = {
  amount: number;          // 0 si rien ce mois-là pour cette ligne
  status: "PLANNED" | "PAID" | "SKIPPED" | "VIRTUAL"; // VIRTUAL = simu/engagement, pas saisi
  // Pour les lignes RecurringExpense : id de l'entrée mensuelle si elle existe
  monthEntryId?: string;
  // Pour les lignes Milestones agrégées par mission : IDs des milestones de ce mois
  milestoneIds?: string[];
  // Pour ré-éditer
  notes?: string | null;
};

export type CashflowRow = {
  id: string;
  kind: CashflowRowKind;
  label: string;
  category?: string | null;
  isIncome: boolean;
  /** Ressources associées pour l'édition */
  recurringId?: string;     // pour kind = recurring_*
  oneOffId?: string;        // pour kind = oneoff_*, commitment, simulation
  missionId?: string;       // pour kind = milestones, si agrégé par mission
  defaultAmount?: number;   // pour recurring_* : montant par défaut
  paymentMonths?: number[]; // mois où la dépense tombe (1-12)
  frequency?: string;
  cells: CashflowCell[];    // 12 cellules, index 0 = janvier
  totalYear: number;
};

export type CashflowYear = {
  year: number;
  startingBalance: number;
  rows: CashflowRow[];
  monthlyTotals: {
    inflow: number;        // hors simulations
    outflow: number;       // hors simulations
    net: number;
    inflowWithSim: number;
    outflowWithSim: number;
    netWithSim: number;
    cumulativeBalance: number;        // depuis startingBalance, hors sim
    cumulativeBalanceWithSim: number; // avec simulations superposées
  }[];
  yearTotals: {
    inflow: number;
    outflow: number;
    net: number;
    inflowWithSim: number;
    outflowWithSim: number;
    netWithSim: number;
    endingBalance: number;
    endingBalanceWithSim: number;
    /** Solde de compte RÉEL : solde initial + tout ce qui a été marqué payé */
    realBankBalance: number;
    realPaidInflow: number;
    realPaidOutflow: number;
  };
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i);

/** Détermine si une RecurringExpense tombe sur un mois donné selon sa fréquence. */
function falsOnMonth(
  frequency: string,
  paymentMonths: number[],
  month1to12: number
): boolean {
  switch (frequency) {
    case "MONTHLY":
      return true;
    case "QUARTERLY":
      return paymentMonths.length
        ? paymentMonths.includes(month1to12)
        : [3, 6, 9, 12].includes(month1to12);
    case "SEMI_ANNUAL":
      return paymentMonths.length
        ? paymentMonths.includes(month1to12)
        : [6, 12].includes(month1to12);
    case "ANNUAL":
      return paymentMonths.length
        ? paymentMonths.includes(month1to12)
        : month1to12 === 12;
    case "CUSTOM":
      return paymentMonths.includes(month1to12);
    default:
      return false;
  }
}

export async function computeCashflowYear(year: number): Promise<CashflowYear> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

  const [
    settings,
    recurring,
    monthEntries,
    oneOffs,
    milestones
  ] = await Promise.all([
    prisma.cashflowSettings.findUnique({ where: { id: "singleton" } }),
    prisma.recurringExpense.findMany({
      where: { isActive: true },
      orderBy: [{ isIncome: "desc" }, { category: "asc" }, { label: "asc" }]
    }),
    prisma.recurringExpenseMonth.findMany({ where: { year } }),
    prisma.oneOffCashflowEntry.findMany({
      where: { date: { gte: yearStart, lte: yearEnd } },
      orderBy: [{ date: "asc" }, { kind: "asc" }, { label: "asc" }]
    }),
    prisma.billingMilestone.findMany({
      where: { expectedAt: { gte: yearStart, lte: yearEnd } },
      include: {
        // Lien direct (milestones standalone)
        company: { select: { name: true } },
        offer: { include: { company: { select: { name: true } } } },
        project: { include: { company: { select: { name: true } } } },
        // Pour grouper les milestones d'une même mission sur une seule ligne
        mission: {
          select: {
            id: true,
            reference: true,
            title: true,
            company: { select: { name: true } }
          }
        }
      }
    })
  ]);

  const startingBalance = Number(settings?.startingBalance ?? 0);

  // Index des monthly entries par recurringId/month
  const monthIndex = new Map<string, (typeof monthEntries)[number]>();
  for (const m of monthEntries) {
    monthIndex.set(`${m.recurringExpenseId}-${m.month}`, m);
  }

  const rows: CashflowRow[] = [];

  // ─── Lignes BillingMilestones ───
  // Stratégie :
  //  - Milestones rattachés à une MÊME mission → 1 seule ligne agrégée
  //    par mission, sommes par mois (typique facturation T&M récurrente)
  //  - Milestones standalone (sans mission) → 1 ligne par milestone individuel
  //
  // Pour la ligne agrégée d'une mission :
  //  - Le label inclut la référence mission + client
  //  - Le statut de chaque cellule mensuelle = PAID si tous les milestones
  //    de ce mois sont payés, SKIPPED si tous annulés, sinon PLANNED

  // Regroupe les milestones par missionId
  const milestonesByMission = new Map<string, typeof milestones>();
  const standaloneMilestones: typeof milestones = [];
  for (const m of milestones) {
    if (m.missionId) {
      if (!milestonesByMission.has(m.missionId)) {
        milestonesByMission.set(m.missionId, []);
      }
      milestonesByMission.get(m.missionId)!.push(m);
    } else {
      standaloneMilestones.push(m);
    }
  }

  // 1) Une ligne par mission (agrégée)
  for (const [missionId, group] of milestonesByMission) {
    const mission = group[0].mission;
    const companyName =
      group[0].company?.name ??
      group[0].offer?.company?.name ??
      group[0].project?.company?.name ??
      mission?.company?.name ??
      null;
    const ref = mission?.reference ?? "Mission";
    const title = mission?.title ?? "";
    const labelParts = [ref];
    if (title) labelParts.push(title);
    let label = labelParts.join(" — ");
    if (companyName) label = `${label} (${companyName})`;

    // Pour chaque mois, agrège les milestones de cette mission
    const cells: CashflowCell[] = MONTHS.map((monthIdx) => {
      const monthMilestones = group.filter(
        (m) => m.expectedAt && m.expectedAt.getUTCMonth() === monthIdx
      );
      if (monthMilestones.length === 0) {
        return { amount: 0, status: "PLANNED" as const };
      }
      const amount = monthMilestones
        .filter((m) => m.status !== "CANCELLED")
        .reduce((s, m) => s + Number(m.amount), 0);
      const allPaid = monthMilestones.every((m) => m.status === "PAID");
      const allCancelled = monthMilestones.every(
        (m) => m.status === "CANCELLED"
      );
      const status: "PLANNED" | "PAID" | "SKIPPED" = allPaid
        ? "PAID"
        : allCancelled
        ? "SKIPPED"
        : "PLANNED";
      return {
        amount,
        status,
        milestoneIds: monthMilestones.map((m) => m.id)
      };
    });

    rows.push({
      id: `ms-mission-${missionId}`,
      kind: "milestones",
      label,
      category: "Factures clients",
      isIncome: true,
      missionId,
      cells,
      totalYear: cells.reduce((s, c) => s + c.amount, 0)
    });
  }

  // 2) Lignes individuelles pour les milestones standalone (sans mission)
  for (const m of standaloneMilestones) {
    if (!m.expectedAt) continue;
    const monthIdx = m.expectedAt.getUTCMonth();
    const companyName =
      m.company?.name ??
      m.offer?.company?.name ??
      m.project?.company?.name ??
      null;
    const labelWithCompany = companyName
      ? `${m.label} (${companyName})`
      : m.label;
    const cells: CashflowCell[] = MONTHS.map((i) =>
      i === monthIdx
        ? {
            amount: Number(m.amount),
            status: (m.status === "PAID"
              ? "PAID"
              : m.status === "CANCELLED"
              ? "SKIPPED"
              : "PLANNED") as "PLANNED" | "PAID" | "SKIPPED"
          }
        : { amount: 0, status: "PLANNED" as const }
    );
    rows.push({
      id: `ms-${m.id}`,
      kind: "milestones",
      label: labelWithCompany,
      category: "Factures clients",
      isIncome: true,
      cells,
      totalYear: Number(m.amount)
    });
  }

  // ─── Lignes RecurringExpense ───
  for (const r of recurring) {
    const cells: CashflowCell[] = MONTHS.map((monthIdx) => {
      const monthNum = monthIdx + 1; // 1-12
      if (!falsOnMonth(r.frequency, r.paymentMonths, monthNum)) {
        return { amount: 0, status: "PLANNED" as const };
      }
      const entry = monthIndex.get(`${r.id}-${monthNum}`);
      if (entry?.status === "SKIPPED") {
        return {
          amount: 0,
          status: "SKIPPED" as const,
          monthEntryId: entry.id,
          notes: entry.notes
        };
      }
      const amount = entry?.amountOverride
        ? Number(entry.amountOverride)
        : Number(r.defaultAmount);
      return {
        amount,
        status: (entry?.status ?? "PLANNED") as "PLANNED" | "PAID",
        monthEntryId: entry?.id,
        notes: entry?.notes
      };
    });
    rows.push({
      id: `rec-${r.id}`,
      kind: r.isIncome ? "recurring_income" : "recurring_expense",
      label: r.label,
      category: r.category,
      isIncome: r.isIncome,
      recurringId: r.id,
      defaultAmount: Number(r.defaultAmount),
      paymentMonths: r.paymentMonths,
      frequency: r.frequency,
      cells,
      totalYear: cells.reduce((s, c) => s + c.amount, 0)
    });
  }

  // ─── Lignes OneOff (par entrée individuelle, regroupées par type) ───
  for (const o of oneOffs) {
    const monthIdx = o.date.getUTCMonth();
    const cells: CashflowCell[] = MONTHS.map((i) =>
      i === monthIdx
        ? {
            amount: Number(o.amount),
            status: (o.status ?? "PLANNED") as "PLANNED" | "PAID" | "SKIPPED",
            notes: o.notes
          }
        : { amount: 0, status: "PLANNED" as const }
    );
    const kindMap: Record<string, CashflowRowKind> = {
      INCOME: "oneoff_income",
      EXPENSE: "oneoff_expense",
      COMMITMENT: "commitment",
      SIMULATION: "simulation"
    };
    rows.push({
      id: `one-${o.id}`,
      kind: kindMap[o.kind],
      label: o.label,
      category: o.category,
      isIncome: o.kind === "INCOME",
      oneOffId: o.id,
      cells,
      totalYear: Number(o.amount)
    });
  }

  // ─── Totaux mensuels ───
  const monthlyTotals = MONTHS.map((monthIdx) => {
    let inflow = 0;
    let outflow = 0;
    let inflowSim = 0;
    let outflowSim = 0;
    for (const row of rows) {
      const cell = row.cells[monthIdx];
      const amount = cell.status === "SKIPPED" ? 0 : cell.amount;
      const isSimulation = row.kind === "simulation";
      if (row.isIncome) {
        if (!isSimulation) inflow += amount;
        inflowSim += amount;
      } else {
        if (!isSimulation) outflow += amount;
        outflowSim += amount;
      }
    }
    return {
      inflow,
      outflow,
      net: inflow - outflow,
      inflowWithSim: inflowSim,
      outflowWithSim: outflowSim,
      netWithSim: inflowSim - outflowSim,
      cumulativeBalance: 0, // calculé après
      cumulativeBalanceWithSim: 0
    };
  });

  // Cumul
  let runningBalance = startingBalance;
  let runningBalanceSim = startingBalance;
  for (const m of monthlyTotals) {
    runningBalance += m.net;
    runningBalanceSim += m.netWithSim;
    m.cumulativeBalance = runningBalance;
    m.cumulativeBalanceWithSim = runningBalanceSim;
  }

  // Solde réel = solde initial + tout ce qui a été marqué PAID (exclut simulations)
  let realPaidInflow = 0;
  let realPaidOutflow = 0;
  for (const row of rows) {
    if (row.kind === "simulation") continue;
    for (const cell of row.cells) {
      if (cell.status !== "PAID") continue;
      if (row.isIncome) realPaidInflow += cell.amount;
      else realPaidOutflow += cell.amount;
    }
  }
  const realBankBalance = startingBalance + realPaidInflow - realPaidOutflow;

  const yearTotals = {
    inflow: monthlyTotals.reduce((s, m) => s + m.inflow, 0),
    outflow: monthlyTotals.reduce((s, m) => s + m.outflow, 0),
    net: monthlyTotals.reduce((s, m) => s + m.net, 0),
    inflowWithSim: monthlyTotals.reduce((s, m) => s + m.inflowWithSim, 0),
    outflowWithSim: monthlyTotals.reduce((s, m) => s + m.outflowWithSim, 0),
    netWithSim: monthlyTotals.reduce((s, m) => s + m.netWithSim, 0),
    endingBalance: runningBalance,
    endingBalanceWithSim: runningBalanceSim,
    realBankBalance,
    realPaidInflow,
    realPaidOutflow
  };

  return {
    year,
    startingBalance,
    rows,
    monthlyTotals,
    yearTotals
  };
}

export const MONTH_LABELS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
];
