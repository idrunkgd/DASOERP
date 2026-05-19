/**
 * Cashflow weekly view — 13-week rolling forecast (standard treasury).
 *
 * Indépendant de `cashflow.ts` pour ne pas casser la vue mensuelle.
 * Buckets ISO-week (lundi → dimanche), revenus en TVAC, solde projeté
 * cumulatif en fin de chaque semaine.
 *
 * Hypothèses de bucketing :
 * - BillingMilestone → bucket par `expectedAt` (skip si null)
 * - OneOffCashflowEntry → bucket par `date`
 * - RecurringExpense → tombe le 1er du mois où la fréquence l'impose
 *   (approximation pragmatique : pas de jour précis stocké en DB)
 */
import { prisma } from "./db";

// ─────────── Types ───────────

export type WeekBucket = {
  index: number; // 0..weeksCount-1
  startDate: Date; // lundi UTC
  endDate: Date; // dimanche UTC 23:59:59
  isoWeek: number;
  isoYear: number;
  label: string; // "S20 (12-18 mai)"
};

export type WeeklyCell = {
  amount: number;
  paid: boolean;
};

export type WeeklyRow = {
  id: string;
  label: string;
  category: string;
  isIncome: boolean;
  kind: "milestone" | "recurring" | "oneoff";
  sourceId: string;
  companyName?: string | null;
  cells: WeeklyCell[];
  total: number;
};

export type WeekTotals = {
  inflow: number;
  outflow: number;
  net: number;
  /** Solde projeté à la FIN de cette semaine. */
  endingBalance: number;
};

export type CashflowWeeks = {
  weeks: WeekBucket[];
  rows: WeeklyRow[];
  weekTotals: WeekTotals[];
  /** Solde projeté au début de la semaine 1 (avant tout flux du tableau). */
  startingBalance: number;
  totalInflow: number;
  totalOutflow: number;
  totalNet: number;
};

// ─────────── Helpers de date ───────────

function startOfISOWeek(d: Date): Date {
  // lundi de la semaine ISO contenant d, à 00:00 UTC
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const dayOfWeek = date.getUTCDay() || 7; // dim=0 → 7
  date.setUTCDate(date.getUTCDate() - dayOfWeek + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function isoWeekOf(d: Date): { isoWeek: number; isoYear: number } {
  // Algo classique ISO 8601
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return { isoWeek: weekNo, isoYear: date.getUTCFullYear() };
}

const MONTHS_FR_SHORT = [
  "jan", "fév", "mar", "avr", "mai", "juin",
  "juil", "août", "sep", "oct", "nov", "déc"
];

function formatWeekLabel(start: Date, end: Date, isoWeek: number): string {
  const sd = start.getUTCDate();
  const ed = end.getUTCDate();
  const sm = MONTHS_FR_SHORT[start.getUTCMonth()];
  const em = MONTHS_FR_SHORT[end.getUTCMonth()];
  if (sm === em) return `S${isoWeek} ${sd}-${ed} ${sm}`;
  return `S${isoWeek} ${sd} ${sm} - ${ed} ${em}`;
}

function buildWeeks(fromDate: Date, weeksCount: number): WeekBucket[] {
  const weekStart0 = startOfISOWeek(fromDate);
  const weeks: WeekBucket[] = [];
  for (let i = 0; i < weeksCount; i++) {
    const start = addDays(weekStart0, i * 7);
    const end = new Date(addDays(start, 6));
    end.setUTCHours(23, 59, 59, 999);
    const { isoWeek, isoYear } = isoWeekOf(start);
    weeks.push({
      index: i,
      startDate: start,
      endDate: end,
      isoWeek,
      isoYear,
      label: formatWeekLabel(start, end, isoWeek)
    });
  }
  return weeks;
}

/** Trouve l'index de semaine qui contient `d`, ou -1 si hors plage. */
function findWeekIndex(weeks: WeekBucket[], d: Date): number {
  const t = d.getTime();
  for (const w of weeks) {
    if (t >= w.startDate.getTime() && t <= w.endDate.getTime()) return w.index;
  }
  return -1;
}

// ─────────── Récurrents : sur quels mois tombent-ils ? ───────────

function recurringFallsOnMonth(
  frequency: string,
  paymentMonths: number[],
  month: number
): boolean {
  switch (frequency) {
    case "MONTHLY":
      return true;
    case "QUARTERLY":
      return paymentMonths.length
        ? paymentMonths.includes(month)
        : [3, 6, 9, 12].includes(month);
    case "SEMI_ANNUAL":
      return paymentMonths.length
        ? paymentMonths.includes(month)
        : [6, 12].includes(month);
    case "ANNUAL":
      return paymentMonths.length
        ? paymentMonths.includes(month)
        : month === 12;
    case "CUSTOM":
      return paymentMonths.includes(month);
    default:
      return false;
  }
}

// ─────────── Fonction principale ───────────

export async function computeCashflowWeeks(
  fromDate: Date,
  weeksCount: number = 13
): Promise<CashflowWeeks> {
  const weeks = buildWeeks(fromDate, weeksCount);
  const rangeStart = weeks[0].startDate;
  const rangeEnd = weeks[weeks.length - 1].endDate;

  // ─── Solde initial : on part du startingBalance + tous les PAID avant rangeStart ───
  const settings = await prisma.cashflowSettings.findUnique({
    where: { id: "singleton" }
  });
  const initialBalance = Number(settings?.startingBalance ?? 0);
  const initialDate = settings?.startingDate ?? new Date(
    Date.UTC(rangeStart.getUTCFullYear(), 0, 1)
  );

  // Tous les flux PAID entre initialDate et rangeStart → ajustent le solde de départ
  const [paidMilestonesPrior, paidOneOffsPrior, paidRecurringPrior] =
    await Promise.all([
      prisma.billingMilestone.findMany({
        where: {
          status: "PAID",
          paidAt: { gte: initialDate, lt: rangeStart }
        },
        select: { id: true, amount: true, missionId: true }
      }),
      prisma.oneOffCashflowEntry.findMany({
        where: {
          status: "PAID",
          paidAt: { gte: initialDate, lt: rangeStart }
        },
        select: { amount: true, kind: true }
      }),
      prisma.recurringExpenseMonth.findMany({
        where: {
          status: "PAID",
          paidAt: { gte: initialDate, lt: rangeStart }
        },
        include: { recurringExpense: true }
      })
    ]);

  // TVAC sur milestones → fetch vatRate par mission (raw SQL : cf. cashflow.ts)
  const STANDALONE_VAT_RATE = 21;
  const allMissionIds = new Set<string>();
  for (const m of paidMilestonesPrior) {
    if (m.missionId) allMissionIds.add(m.missionId);
  }

  // ─── Flux qui tombent dans la plage 13 semaines ───
  const [milestonesInRange, oneOffsInRange, recurringActive] =
    await Promise.all([
      prisma.billingMilestone.findMany({
        where: {
          expectedAt: { gte: rangeStart, lte: rangeEnd }
        },
        include: {
          company: { select: { name: true } },
          offer: { include: { company: { select: { name: true } } } },
          project: { include: { company: { select: { name: true } } } },
          mission: {
            select: { id: true, title: true, company: { select: { name: true } } }
          }
        },
        orderBy: { expectedAt: "asc" }
      }),
      prisma.oneOffCashflowEntry.findMany({
        where: { date: { gte: rangeStart, lte: rangeEnd } },
        orderBy: { date: "asc" }
      }),
      prisma.recurringExpense.findMany({
        where: { isActive: true },
        include: {
          months: {
            // On a besoin des overrides + statuts pour les mois couverts
            where: {
              OR: weeksInMonthRange(weeks).map(({ year, month }) => ({
                year,
                month
              }))
            }
          }
        }
      })
    ]);

  for (const m of milestonesInRange) {
    if (m.missionId) allMissionIds.add(m.missionId);
  }

  const vatRateByMissionId = new Map<string, number>();
  if (allMissionIds.size > 0) {
    try {
      const idList = Array.from(allMissionIds)
        .map((id) => `'${id.replace(/'/g, "''")}'`)
        .join(",");
      const rows = await prisma.$queryRawUnsafe<
        { id: string; vatRate: string | number }[]
      >(`SELECT id, "vatRate" FROM "Mission" WHERE id IN (${idList})`);
      for (const r of rows) {
        const v = Number(r.vatRate);
        // 0 = colonne pas renseignée → fallback 21% via le ?? en aval
        if (Number.isFinite(v) && v > 0) vatRateByMissionId.set(r.id, v);
      }
    } catch {
      // colonne vatRate absente → fallback 21%
    }
  }

  const tvacAmount = (
    amountHtva: number | string | { toString(): string },
    missionId: string | null
  ): number => {
    const vat = missionId
      ? vatRateByMissionId.get(missionId) ?? STANDALONE_VAT_RATE
      : STANDALONE_VAT_RATE;
    return Math.round(Number(amountHtva) * (1 + vat / 100) * 100) / 100;
  };

  // ─── Calcul du solde de départ projeté ───
  let startingBalance = initialBalance;
  for (const m of paidMilestonesPrior) {
    startingBalance += tvacAmount(m.amount, m.missionId);
  }
  for (const o of paidOneOffsPrior) {
    const amt = Number(o.amount);
    if (o.kind === "INCOME") startingBalance += amt;
    else if (o.kind === "EXPENSE" || o.kind === "COMMITMENT")
      startingBalance -= amt;
    // SIMULATION : ignoré du réel
  }
  for (const rm of paidRecurringPrior) {
    const amt = Number(rm.amountOverride ?? rm.recurringExpense.defaultAmount);
    startingBalance += rm.recurringExpense.isIncome ? amt : -amt;
  }

  // ─── Construction des lignes ───
  const rows: WeeklyRow[] = [];
  const emptyCells = (): WeeklyCell[] =>
    weeks.map(() => ({ amount: 0, paid: false }));

  // Milestones individuelles
  for (const m of milestonesInRange) {
    if (m.status === "CANCELLED") continue;
    if (!m.expectedAt) continue;
    const wi = findWeekIndex(weeks, m.expectedAt);
    if (wi < 0) continue;
    const amount = tvacAmount(m.amount, m.missionId);
    const cells = emptyCells();
    cells[wi] = { amount, paid: m.status === "PAID" };
    const company =
      m.company?.name ??
      m.mission?.company?.name ??
      m.offer?.company?.name ??
      m.project?.company?.name ??
      null;
    const labelWithCompany = company ? `${m.label} (${company})` : m.label;
    const category = m.missionId
      ? "MISSION"
      : m.offerId || m.projectId
      ? "PROJET"
      : "Factures clients";
    rows.push({
      id: `milestone-${m.id}`,
      label: labelWithCompany,
      category,
      isIncome: true,
      kind: "milestone",
      sourceId: m.id,
      companyName: company,
      cells,
      total: amount
    });
  }

  // OneOffs (on garde SIMULATION séparé mais on l'affiche aussi — c'est utile en 13-week)
  for (const o of oneOffsInRange) {
    if (o.status === "SKIPPED" || o.status === "CANCELLED") continue;
    const wi = findWeekIndex(weeks, o.date);
    if (wi < 0) continue;
    const amount = Number(o.amount);
    const cells = emptyCells();
    const sign = o.kind === "INCOME" ? 1 : -1;
    cells[wi] = { amount: amount * sign, paid: o.status === "PAID" };
    rows.push({
      id: `oneoff-${o.id}`,
      label:
        o.kind === "SIMULATION"
          ? `[Sim] ${o.label}`
          : o.kind === "COMMITMENT"
          ? `[Engagement] ${o.label}`
          : o.label,
      category: o.category?.trim() || "Divers",
      isIncome: o.kind === "INCOME",
      kind: "oneoff",
      sourceId: o.id,
      cells,
      total: amount * sign
    });
  }

  // Récurrents : pour chaque mois couvert par les semaines, on génère une occurrence
  // sur le 1er du mois (approximation), bucketée dans la semaine correspondante.
  // Edge case : un récurrent PLANIFIÉ avant rangeStart (ex. mois courant déjà entamé)
  // n'est pas encore dans le starting balance et doit apparaître en semaine 1 comme
  // "obligation reportée". Un récurrent PAID avant rangeStart est lui déjà dans le
  // starting balance → on le saute pour ne pas le compter deux fois.
  const monthsInRange = weeksInMonthRange(weeks);
  for (const r of recurringActive) {
    const cells = emptyCells();
    let total = 0;
    for (const { year, month } of monthsInRange) {
      if (!recurringFallsOnMonth(r.frequency, r.paymentMonths, month)) continue;
      const monthEntry = r.months.find(
        (me) => me.year === year && me.month === month
      );
      if (monthEntry?.status === "SKIPPED") continue;
      const occurrenceDate = new Date(Date.UTC(year, month - 1, 1));
      // Évite le double-compte avec startingBalance
      if (monthEntry?.status === "PAID" && occurrenceDate < rangeStart) continue;
      // Push une occurrence passée non payée vers le début de la fenêtre
      const effectiveDate =
        occurrenceDate < rangeStart ? rangeStart : occurrenceDate;
      const wi = findWeekIndex(weeks, effectiveDate);
      if (wi < 0) continue;
      const amount = Number(monthEntry?.amountOverride ?? r.defaultAmount);
      const sign = r.isIncome ? 1 : -1;
      cells[wi] = {
        amount: cells[wi].amount + amount * sign,
        paid: cells[wi].paid || monthEntry?.status === "PAID"
      };
      total += amount * sign;
    }
    if (total === 0) continue;
    rows.push({
      id: `recurring-${r.id}`,
      label: r.label,
      category: r.category?.trim() || (r.isIncome ? "Recettes récurrentes" : "Dépenses récurrentes"),
      isIncome: r.isIncome,
      kind: "recurring",
      sourceId: r.id,
      cells,
      total
    });
  }

  // ─── Totaux par semaine + solde projeté ───
  const weekTotals: WeekTotals[] = weeks.map(() => ({
    inflow: 0,
    outflow: 0,
    net: 0,
    endingBalance: 0
  }));
  for (const row of rows) {
    for (let i = 0; i < weeks.length; i++) {
      const v = row.cells[i].amount;
      if (v > 0) weekTotals[i].inflow += v;
      else if (v < 0) weekTotals[i].outflow += -v;
    }
  }
  let running = startingBalance;
  let totalInflow = 0;
  let totalOutflow = 0;
  for (let i = 0; i < weeks.length; i++) {
    weekTotals[i].net = weekTotals[i].inflow - weekTotals[i].outflow;
    running += weekTotals[i].net;
    weekTotals[i].endingBalance = running;
    totalInflow += weekTotals[i].inflow;
    totalOutflow += weekTotals[i].outflow;
  }

  return {
    weeks,
    rows,
    weekTotals,
    startingBalance,
    totalInflow,
    totalOutflow,
    totalNet: totalInflow - totalOutflow
  };
}

/** Liste les couples (year, month) couverts par au moins une semaine. */
function weeksInMonthRange(weeks: WeekBucket[]): { year: number; month: number }[] {
  const seen = new Set<string>();
  const result: { year: number; month: number }[] = [];
  for (const w of weeks) {
    // une semaine peut chevaucher 2 mois → on prend les deux
    for (const d of [w.startDate, w.endDate]) {
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const key = `${y}-${m}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ year: y, month: m });
      }
    }
  }
  return result;
}
