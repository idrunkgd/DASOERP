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
  // Statuts visibles dans la grille :
  // - PLANNED  = prévue / encodée (READY côté milestone aussi) → bleu
  // - INVOICED = facture émise au client, en attente paiement → ambre/orange
  // - PAID     = encaissée                                      → vert
  // - SKIPPED  = annulée pour ce mois                           → barré
  // - VIRTUAL  = simulation / engagement, pas saisi en vrai     → gris
  status: "PLANNED" | "INVOICED" | "PAID" | "SKIPPED" | "VIRTUAL";
  // Pour les lignes RecurringExpense : id de l'entrée mensuelle si elle existe
  monthEntryId?: string;
  // Pour les lignes Milestones agrégées par mission : IDs des milestones de ce mois
  milestoneIds?: string[];
  /** Pour les cellules mission : nb de jours prestés cumulés ce mois (somme
   *  des amount / appliedDailyRate des milestones non annulées). undefined si
   *  pas applicable. */
  daysCount?: number;
  /** Pour les cellules Payroll : marqueur (year, month, kind) permettant à
   *  l'UI de savoir qu'un clic doit ouvrir le modal payroll et appeler
   *  setPayrollMonthStatus / setPayrollMonthAmount plutôt qu'une action générique. */
  payroll?: { year: number; month: number; kind: "NET_PAY" | "WITHHOLDING_TAX" | "ONSS" };
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
  /** Bornes temporelles pour récurrents (yyyy-mm-dd, null = illimité). */
  startDate?: string | null;
  endDate?: string | null;
  cells: CashflowCell[];    // 12 cellules, index 0 = janvier
  totalYear: number;
  /**
   * Si true, la ligne est TOUJOURS agrégée dans les totaux mensuels et
   * annuels, mais n'est PAS rendue dans la grille. Utilisé pour les projets
   * clôturés (toutes les tranches payées) : on garde la contribution
   * financière dans les KPIs sans polluer la vue avec des lignes inertes.
   */
  hidden?: boolean;
  /** Pour kind = milestones (agrégation par projet) : id du projet source. */
  projectId?: string;
};

export type CashflowYear = {
  year: number;
  /** Solde projeté au 1er janvier de l'année affichée (= bootstrap + flux PAID antérieurs). */
  startingBalance: number;
  /** True si l'année affichée est celle où l'utilisateur a configuré son solde de
   *  bootstrap. Pour les autres années, le solde initial est *dérivé* (read-only). */
  isBootstrapYear: boolean;
  /** Année dans laquelle tombe `settings.startingDate` (utilisée pour le hint). */
  bootstrapYear: number;
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
    /** Total des factures émises et en attente de paiement (status=INVOICED), TVAC, toutes années. */
    inProgressAmount: number;
    inProgressCount: number;
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
  // Note historique : on a temporairement élargi la fenêtre pour gérer un
  // calcul "+30j fin de mois" automatique. On est revenu à un schéma où
  // expectedAt EST la date d'encaissement, donc la fenêtre stricte suffit.
  const milestoneFetchStart = yearStart;
  const milestoneFetchEnd = yearEnd;

  const [
    settings,
    recurring,
    monthEntries,
    oneOffs,
    milestones,
    /// Employés : leurs 3 sorties mensuelles (Net / Précompte / ONSS) sont
    /// agrégées automatiquement pour créer 3 lignes cashflow SYNTHÉTIQUES,
    /// filtrées par employé actif au mois considéré.
    employees,
    payrollMonths
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
      where: { expectedAt: { gte: milestoneFetchStart, lte: milestoneFetchEnd } },
      include: {
        // Lien direct (milestones standalone)
        company: { select: { name: true } },
        offer: { select: { vatRate: true, company: { select: { name: true } } } },
        // On sélectionne aussi id / reference / name du projet pour pouvoir
        // agréger toutes les tranches d'un même projet sur une seule ligne.
        project: {
          select: {
            id: true, reference: true, name: true,
            vatRate: true, company: { select: { name: true } }
          }
        },
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
    }),
    // Employés : leurs 3 sorties mensuelles (Net / Précompte / ONSS) sont
    // agrégées ci-dessous pour créer 3 lignes cashflow synthétiques,
    // filtrées par employé actif au mois considéré.
    prisma.payrollEmployee.findMany({
      orderBy: [{ startDate: "asc" }]
    }),
    // Statut cellule-par-cellule des versements payroll (PAID / PLANNED /
    // SKIPPED) et éventuel amountOverride quand la valeur réelle diffère
    // du calcul agrégé. Indexé par year/month/kind.
    prisma.payrollMonth.findMany({ where: { year } })
  ]);

  // ─── Solde de départ projeté pour l'année `year` ───
  // Le bouton "Solde initial" ne sert qu'à *amorcer* le système. Pour les années
  // suivantes, on dérive automatiquement le solde au 1er janvier en partant du
  // bootstrap + tous les flux PAID intervenus entre la startingDate et le 1er
  // janvier de l'année affichée.
  const bootstrapBalance = Number(settings?.startingBalance ?? 0);
  const bootstrapDate =
    settings?.startingDate ?? new Date(Date.UTC(year, 0, 1));
  const bootstrapYear = bootstrapDate.getUTCFullYear();
  const isBootstrapYear = year === bootstrapYear;

  let startingBalance = bootstrapBalance;
  if (year > bootstrapYear) try {
    // Chaîne année → année : on prend la PROJECTION (PAID + PLANNED, non-SKIPPED,
    // non-CANCELLED, hors simulations), pas uniquement le réel marqué payé.
    // Sinon fin 2026 = 120K ≠ début 2027 = 45K (seulement les payés cochés).
    const [priorMs, priorOo, priorRecurring, priorEmployees, priorPayrollMonths] =
      await Promise.all([
        prisma.billingMilestone.findMany({
          where: {
            status: { not: "CANCELLED" },
            expectedAt: { gte: bootstrapDate, lt: yearStart }
          },
          select: { amount: true, missionId: true }
        }),
        prisma.oneOffCashflowEntry.findMany({
          where: {
            status: { not: "SKIPPED" },
            // On exclut les SIMULATIONS des DEUX côtés (dépense simulée et
            // recette simulée) : une projection what-if n'a rien à faire
            // dans le solde reporté du 1er janvier.
            kind: { notIn: ["SIMULATION", "SIMULATION_INCOME"] },
            date: { gte: bootstrapDate, lt: yearStart }
          },
          select: { amount: true, kind: true }
        }),
        prisma.recurringExpense.findMany({
          where: { isActive: true },
          include: { months: true }
        }),
        // Payroll : mêmes 3 postes (Salaires / Précompte / ONSS) qui
        // doivent être décomptés du solde reporté sinon fin 2026 ≠ début
        // 2027 (le manque de 130k ≈ payroll d'une année).
        prisma.payrollEmployee.findMany({
          where: {
            startDate: { lt: yearStart },
            OR: [{ endDate: null }, { endDate: { gte: bootstrapDate } }]
          }
        }),
        prisma.payrollMonth.findMany({
          where: { year: { lt: year } }
        })
      ]);

    // TVAC pour milestones liés à une mission — fetch vatRate en raw SQL
    const priorMissionIds = new Set<string>();
    for (const m of priorMs) if (m.missionId) priorMissionIds.add(m.missionId);
    const priorVatByMissionId = new Map<string, number>();
    if (priorMissionIds.size > 0) {
      try {
        const idList = Array.from(priorMissionIds)
          .map((id) => `'${id.replace(/'/g, "''")}'`)
          .join(",");
        const rows = await prisma.$queryRawUnsafe<
          { id: string; vatRate: string | number }[]
        >(`SELECT id, "vatRate" FROM "Mission" WHERE id IN (${idList})`);
        for (const r of rows) {
          const v = Number(r.vatRate);
          // On ignore 0 / NaN / négatif : on veut tomber sur le fallback 21%
          // (0 en DB = colonne non renseignée par la migration vatRate).
          if (Number.isFinite(v) && v > 0) priorVatByMissionId.set(r.id, v);
        }
      } catch {
        // colonne absente → fallback 21%
      }
    }
    for (const m of priorMs) {
      const vat = m.missionId
        ? priorVatByMissionId.get(m.missionId) ?? 21
        : 21;
      startingBalance += Number(m.amount) * (1 + vat / 100);
    }
    for (const o of priorOo) {
      const a = Number(o.amount);
      if (o.kind === "INCOME") startingBalance += a;
      else if (o.kind === "EXPENSE" || o.kind === "COMMITMENT")
        startingBalance -= a;
    }

    // Récurrents : on itère tous les (year, month) entre bootstrap et yearStart
    // et on applique falsOnMonth + amountOverride éventuel.
    const startY = bootstrapDate.getUTCFullYear();
    const startM = bootstrapDate.getUTCMonth() + 1; // 1..12
    const monthsInRange: { year: number; month: number }[] = [];
    for (let y = startY; y < year; y++) {
      const fromM = y === startY ? startM : 1;
      for (let m = fromM; m <= 12; m++) monthsInRange.push({ year: y, month: m });
    }
    for (const r of priorRecurring) {
      const recStart = (r as { startDate?: Date | null }).startDate ?? null;
      const recEnd = (r as { endDate?: Date | null }).endDate ?? null;
      const startYM = recStart
        ? recStart.getUTCFullYear() * 12 + recStart.getUTCMonth()
        : null;
      const endYM = recEnd
        ? recEnd.getUTCFullYear() * 12 + recEnd.getUTCMonth()
        : null;
      for (const { year: y, month } of monthsInRange) {
        const ym = y * 12 + (month - 1);
        if (startYM != null && ym < startYM) continue;
        if (endYM != null && ym > endYM) continue;
        if (!falsOnMonth(r.frequency, r.paymentMonths, month)) continue;
        const me = r.months.find((x) => x.year === y && x.month === month);
        if (me?.status === "SKIPPED") continue;
        const a = Number(me?.amountOverride ?? r.defaultAmount);
        startingBalance += r.isIncome ? a : -a;
      }
    }

    // Payroll : pour chaque (y, month) antérieur à l'année affichée, on
    // somme les 3 postes (net + précompte + ONSS) pour tous les employés
    // actifs ce mois-là (start/end dates), en appliquant amountOverride
    // et le statut SKIPPED s'ils existent dans PayrollMonth.
    const priorPmIndex = new Map<string, typeof priorPayrollMonths[number]>();
    for (const pm of priorPayrollMonths) {
      priorPmIndex.set(`${pm.year}-${pm.month}-${pm.kind}`, pm);
    }
    for (const { year: y, month } of monthsInRange) {
      const monthStart = new Date(Date.UTC(y, month - 1, 1));
      const monthEnd = new Date(Date.UTC(y, month, 0));
      let sNet = 0, sTax = 0, sOnss = 0;
      for (const e of priorEmployees) {
        if (e.startDate > monthEnd) continue;
        if (e.endDate != null && e.endDate < monthStart) continue;
        sNet  += Number(e.monthlyNetPay);
        sTax  += Number(e.monthlyWithholdingTax);
        sOnss += Number(e.monthlyOnss);
      }
      const kinds: [string, number][] = [
        ["NET_PAY", sNet],
        ["WITHHOLDING_TAX", sTax],
        ["ONSS", sOnss]
      ];
      for (const [kind, calc] of kinds) {
        const pm = priorPmIndex.get(`${y}-${month}-${kind}`);
        if (pm?.status === "SKIPPED") continue;
        const overriden = pm?.amountOverride != null ? Number(pm.amountOverride) : null;
        const amount = overriden != null ? overriden : calc;
        startingBalance -= amount;
      }
    }

    startingBalance = Math.round(startingBalance * 100) / 100;
  } catch (err) {
    // Défense en profondeur : si le calcul de projection année → année
    // plante (colonne DB manquante, données corrompues, etc.), on log en
    // console serveur et on retombe sur le bootstrapBalance plutôt que
    // de casser toute la page cashflow avec une 500.
    console.error("[cashflow] Year chaining failed, falling back to bootstrap:", err);
    startingBalance = bootstrapBalance;
  }

  // Index des monthly entries par recurringId/month
  const monthIndex = new Map<string, (typeof monthEntries)[number]>();
  for (const m of monthEntries) {
    monthIndex.set(`${m.recurringExpenseId}-${m.month}`, m);
  }

  // ─── Fetch séparé des vatRate par mission ───
  // On fait une requête à part (au lieu d'ajouter dans le select du milestone)
  // pour éviter d'éventuels conflits de typage Prisma observés en prod.
  const missionIdsSet = new Set<string>();
  for (const ms of milestones) {
    if (ms.missionId) missionIdsSet.add(ms.missionId);
  }
  const vatRateByMissionId = new Map<string, number>();
  if (missionIdsSet.size > 0) {
    try {
      const missionsWithVat = await prisma.$queryRawUnsafe<
        { id: string; vatRate: string | number }[]
      >(
        `SELECT id, "vatRate" FROM "Mission" WHERE id IN (${Array.from(missionIdsSet).map((id) => `'${id.replace(/'/g, "''")}'`).join(",")})`
      );
      for (const r of missionsWithVat) {
        const v = Number(r.vatRate);
        // Idem : 0 = colonne pas renseignée, on retombe sur le fallback 21%.
        if (Number.isFinite(v) && v > 0) vatRateByMissionId.set(r.id, v);
      }
    } catch {
      // Si la colonne vatRate n'existe pas encore : pas grave, on tombera sur 21%
    }
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

    // Multiplier TVAC : on prend le vatRate depuis notre map fetched séparément
    // (fallback 21% — taux belge standard — si pas trouvé)
    const vatNumber = vatRateByMissionId.get(missionId) ?? 21;
    const tvacMultiplier = 1 + vatNumber / 100;

    // Pour chaque mois, agrège les milestones de cette mission (affiché TVAC).
    // expectedAt = date d'encaissement attendu (== celle qui apparaît sur le
    // compte bancaire). Pour les milestones créés via le wizard d'offre, ce
    // calcul est fait côté wizard à partir de la date facture + délai paiement.
    const cells: CashflowCell[] = MONTHS.map((monthIdx) => {
      const monthMilestones = group.filter(
        (m) => m.expectedAt && m.expectedAt.getUTCMonth() === monthIdx
      );
      if (monthMilestones.length === 0) {
        return { amount: 0, status: "PLANNED" as const };
      }
      const amountHtva = monthMilestones
        .filter((m) => m.status !== "CANCELLED")
        .reduce((s, m) => s + Number(m.amount), 0);
      const amount = Math.round(amountHtva * tvacMultiplier * 100) / 100;
      // Nb de jours = somme des (amount / appliedDailyRate) pour les tranches non annulées
      // (fallback : on tente avec le rate actuel de la mission si pas de snapshot)
      const missionDailyRate = monthMilestones[0]?.mission?.dailyRate
        ? Number(monthMilestones[0].mission.dailyRate)
        : 0;
      const daysRaw = monthMilestones
        .filter((m) => m.status !== "CANCELLED")
        .reduce((s, m) => {
          const snap = (m as { appliedDailyRate?: any }).appliedDailyRate;
          const rate = snap != null ? Number(snap) : missionDailyRate;
          if (!rate || rate <= 0) return s;
          return s + Number(m.amount) / rate;
        }, 0);
      const daysCount =
        daysRaw > 0 ? Math.round(daysRaw * 10) / 10 : undefined;
      const allPaid = monthMilestones.every((m) => m.status === "PAID");
      const allCancelled = monthMilestones.every(
        (m) => m.status === "CANCELLED"
      );
      // INVOICED visible si TOUTES les tranches sont émises (INVOICED ou
      // TRANSMITTED) mais aucune encore payée. Sinon on retombe sur PLANNED
      // (bleu) qui couvre PLANNED + READY + cas mixtes.
      const allInvoicedOrPaid = monthMilestones.every(
        (m) => m.status === "INVOICED" || m.status === "TRANSMITTED" || m.status === "PAID"
      );
      const status: "PLANNED" | "INVOICED" | "PAID" | "SKIPPED" = allPaid
        ? "PAID"
        : allCancelled
        ? "SKIPPED"
        : allInvoicedOrPaid
        ? "INVOICED"
        : "PLANNED";
      return {
        amount,
        status,
        milestoneIds: monthMilestones.map((m) => m.id),
        daysCount
      };
    });

    rows.push({
      id: `ms-mission-${missionId}`,
      kind: "milestones",
      label,
      category: "MISSION",
      isIncome: true,
      missionId,
      cells,
      totalYear: cells.reduce((s, c) => s + c.amount, 0)
    });
  }

  // 2) Lignes agrégées par PROJET (tranches non-mission)
  //
  // Refonte (juillet 2026) : au lieu d'une ligne par BillingMilestone, on
  // regroupe toutes les tranches d'un même projet sur une seule ligne, et
  // on somme les montants du même mois.
  //
  // Règle métier :
  //  - Un projet dont TOUTES les tranches sont PAID est considéré clôturé
  //    → la row existe (contribue aux totaux mensuels / annuels) mais est
  //    marquée `hidden` pour ne pas polluer la grille.
  //  - Les tranches CANCELLED sont ignorées (elles ne comptent ni pour la
  //    clôture, ni pour les totaux financiers).
  //  - Les milestones sans project (companyId direct, offer libre, etc.)
  //    tombent dans un groupe « standalone » indexé par une clé unique
  //    (companyId + label) pour rester tolérant à l'existant.

  // Grouping key : project.id si dispo, sinon fallback sur un ID synthétique
  const projectGroups = new Map<
    string,
    {
      projectId: string | null;
      projectRef: string | null;
      projectName: string | null;
      companyName: string | null;
      vatRate: number;
      items: typeof standaloneMilestones;
    }
  >();
  for (const m of standaloneMilestones) {
    if (!m.expectedAt) continue;
    // On garde les tranches d'AUTRES années dans les items du groupe pour
    // savoir si le projet est réellement clôturé (toutes ses tranches
    // passées et futures sont payées). Le filtrage par année se fait plus bas.
    const gk = m.project?.id ?? `standalone-${m.companyId ?? "none"}-${m.offerId ?? "none"}`;
    if (!projectGroups.has(gk)) {
      const companyName =
        m.company?.name ??
        m.offer?.company?.name ??
        m.project?.company?.name ??
        null;
      const vatRate =
        m.project?.vatRate != null
          ? Number(m.project.vatRate)
          : m.offer?.vatRate != null
            ? Number(m.offer.vatRate)
            : 21;
      projectGroups.set(gk, {
        projectId: m.project?.id ?? null,
        projectRef: m.project?.reference ?? null,
        projectName: m.project?.name ?? null,
        companyName,
        vatRate,
        items: []
      });
    }
    projectGroups.get(gk)!.items.push(m);
  }

  for (const [groupKey, g] of projectGroups) {
    const tvacMultiplier = 1 + g.vatRate / 100;
    // On somme par mois de l'ANNÉE affichée + on collecte les milestoneIds
    // par mois pour permettre l'édition via clic sur la cellule.
    const monthlyAmount = new Array<number>(12).fill(0);
    const monthlyIds = Array.from({ length: 12 }, () => [] as string[]);
    // Statut agrégé par mois : PAID si tout est payé, INVOICED si au moins
    // une facturée non payée, sinon PLANNED. SKIPPED uniquement si tout est
    // annulé (rare car on ignore CANCELLED du calcul de montant).
    const monthlyStatus: Array<"PLANNED" | "INVOICED" | "PAID" | "SKIPPED"> =
      Array.from({ length: 12 }, () => "PLANNED");
    const monthlyHasNonCancelled = new Array<boolean>(12).fill(false);
    const monthlyAllPaid = new Array<boolean>(12).fill(true);
    const monthlyAnyInvoiced = new Array<boolean>(12).fill(false);
    for (const m of g.items) {
      if (!m.expectedAt) continue;
      if (m.expectedAt.getUTCFullYear() !== year) continue;
      const monthIdx = m.expectedAt.getUTCMonth();
      if (m.status === "CANCELLED") continue;
      monthlyHasNonCancelled[monthIdx] = true;
      const amountTvac =
        Math.round(Number(m.amount) * tvacMultiplier * 100) / 100;
      monthlyAmount[monthIdx] += amountTvac;
      monthlyIds[monthIdx].push(m.id);
      if (m.status !== "PAID") monthlyAllPaid[monthIdx] = false;
      if (m.status === "INVOICED" || m.status === "TRANSMITTED") {
        monthlyAnyInvoiced[monthIdx] = true;
      }
    }
    for (let i = 0; i < 12; i++) {
      if (!monthlyHasNonCancelled[i]) continue;
      if (monthlyAllPaid[i]) monthlyStatus[i] = "PAID";
      else if (monthlyAnyInvoiced[i]) monthlyStatus[i] = "INVOICED";
      else monthlyStatus[i] = "PLANNED";
      // Arrondi final anti-drift virgule flottante
      monthlyAmount[i] = Math.round(monthlyAmount[i] * 100) / 100;
    }

    // Un projet est clôturé si TOUTES ses tranches non-annulées sont PAID
    // (toutes années confondues). Si oui, la ligne existe pour le calcul
    // des totaux mais est masquée dans la grille.
    const activeItems = g.items.filter((m) => m.status !== "CANCELLED");
    const isClosed =
      activeItems.length > 0 && activeItems.every((m) => m.status === "PAID");

    // Label : « [Réf] Nom projet (Client) » ou fallback tranche libre
    const projectLabel = g.projectRef
      ? g.projectName
        ? `${g.projectRef} — ${g.projectName}`
        : g.projectRef
      : g.items[0]?.label ?? "Projet";
    const label = g.companyName
      ? `${projectLabel} (${g.companyName})`
      : projectLabel;

    const cells: CashflowCell[] = MONTHS.map((i) => ({
      amount: monthlyAmount[i],
      status: monthlyStatus[i],
      milestoneIds: monthlyIds[i].length > 0 ? monthlyIds[i] : undefined
    }));
    const totalYear = cells.reduce((s, c) => s + c.amount, 0);

    // Si aucune tranche cette année ET pas clôturé → skip complètement
    // (pas la peine d'avoir une row à 0 partout).
    if (totalYear === 0 && !isClosed && !cells.some((c) => c.status !== "PLANNED")) {
      continue;
    }

    rows.push({
      id: `proj-${groupKey}`,
      kind: "milestones",
      label,
      category: "PROJET",
      isIncome: true,
      projectId: g.projectId ?? undefined,
      cells,
      totalYear: Math.round(totalYear * 100) / 100,
      hidden: isClosed
    });
  }

  // ─── Lignes synthétiques Payroll (Salaires / Précompte / ONSS) ───
  // Une seule ligne par poste, agrégée sur tous les employés actifs au mois M.
  // Actif = startDate <= dernier jour du mois && (endDate == null || endDate >= 1er du mois).
  //
  // Statut par cellule : lookup dans payrollMonths (year/month/kind). Si un
  // amountOverride est défini, il PRIME sur le calculé (utile pour aligner
  // sur le montant réel constaté à la banque).
  if (employees.length > 0) {
    const monthlySalary  = new Array<number>(12).fill(0);
    const monthlyTax     = new Array<number>(12).fill(0);
    const monthlyOnss    = new Array<number>(12).fill(0);
    for (const e of employees) {
      const start = e.startDate;
      const end = e.endDate;
      for (let m = 0; m < 12; m++) {
        const monthEnd = new Date(Date.UTC(year, m + 1, 0));
        const monthStart = new Date(Date.UTC(year, m, 1));
        if (start > monthEnd) continue;
        if (end != null && end < monthStart) continue;
        monthlySalary[m] += Number(e.monthlyNetPay);
        monthlyTax[m]    += Number(e.monthlyWithholdingTax);
        monthlyOnss[m]   += Number(e.monthlyOnss);
      }
    }
    const roundArr = (arr: number[]) => arr.map((v) => Math.round(v * 100) / 100);
    const s = roundArr(monthlySalary);
    const t = roundArr(monthlyTax);
    const o = roundArr(monthlyOnss);

    // Index des PayrollMonth par (kind, month) pour lookup O(1)
    const pmIndex = new Map<string, typeof payrollMonths[number]>();
    for (const pm of payrollMonths) pmIndex.set(`${pm.kind}-${pm.month}`, pm);

    const mkRow = (
      label: string, id: string, values: number[],
      kind: "NET_PAY" | "WITHHOLDING_TAX" | "ONSS"
    ): CashflowRow => ({
      id, kind: "recurring_expense", label, category: "PAYROLL",
      isIncome: false,
      cells: values.map((v, i) => {
        const monthNum = i + 1;
        const pm = pmIndex.get(`${kind}-${monthNum}`);
        const overriden = pm?.amountOverride != null ? Number(pm.amountOverride) : null;
        const effectiveAmount = overriden != null ? overriden : v;
        const status = pm?.status === "PAID"
          ? "PAID" as const
          : pm?.status === "SKIPPED"
            ? "SKIPPED" as const
            : "PLANNED" as const;
        return {
          amount: status === "SKIPPED" ? 0 : effectiveAmount,
          status,
          payroll: { year, month: monthNum, kind }
        };
      }),
      totalYear: values.reduce((a, b) => a + b, 0)
    });
    if (s.some((v) => v > 0)) rows.push(mkRow("Salaires (net)",         "payroll-salary", s, "NET_PAY"));
    if (t.some((v) => v > 0)) rows.push(mkRow("Précompte professionnel","payroll-tax",    t, "WITHHOLDING_TAX"));
    if (o.some((v) => v > 0)) rows.push(mkRow("ONSS",                   "payroll-onss",   o, "ONSS"));
  }

  // ─── Lignes RecurringExpense ───
  for (const r of recurring) {
    // Bornes temporelles : on n'affiche la récurrence que dans [startDate, endDate]
    // (vues comme yyyy-mm pour le bucketing mensuel). Si null, illimité.
    const recStart = (r as { startDate?: Date | null }).startDate ?? null;
    const recEnd = (r as { endDate?: Date | null }).endDate ?? null;
    const startYM = recStart
      ? recStart.getUTCFullYear() * 12 + recStart.getUTCMonth()
      : null;
    const endYM = recEnd
      ? recEnd.getUTCFullYear() * 12 + recEnd.getUTCMonth()
      : null;
    const cells: CashflowCell[] = MONTHS.map((monthIdx) => {
      const monthNum = monthIdx + 1; // 1-12
      const cellYM = year * 12 + monthIdx;
      if (startYM != null && cellYM < startYM) {
        return { amount: 0, status: "PLANNED" as const };
      }
      if (endYM != null && cellYM > endYM) {
        return { amount: 0, status: "PLANNED" as const };
      }
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
      startDate: recStart ? recStart.toISOString().slice(0, 10) : null,
      endDate: recEnd ? recEnd.toISOString().slice(0, 10) : null,
      cells,
      totalYear: cells.reduce((s, c) => s + c.amount, 0)
    });
  }

  // ─── Lignes OneOff ───
  // Stratégie :
  //  - Plusieurs OneOff partageant le même recurrenceGroupId → 1 ligne agrégée
  //    (récurrence mensuelle, montants éditables individuellement par cellule)
  //  - Sinon → 1 ligne par OneOff individuel
  const kindMap: Record<string, CashflowRowKind> = {
    INCOME: "oneoff_income",
    EXPENSE: "oneoff_expense",
    COMMITMENT: "commitment",
    SIMULATION: "simulation",
    SIMULATION_INCOME: "simulation"
  };
  // Helper : un OneOff est-il une recette ? (INCOME ou SIMULATION_INCOME)
  const isIncomeKind = (k: string) =>
    k === "INCOME" || k === "SIMULATION_INCOME";

  // On lit recurrenceGroupId via une property optionnelle (idempotent : si la
  // colonne n'existe pas en runtime, on tombe sur undefined → standalone)
  const oneOffsByGroup = new Map<string, typeof oneOffs>();
  const standaloneOneOffs: typeof oneOffs = [];
  for (const o of oneOffs) {
    const gid = (o as { recurrenceGroupId?: string | null }).recurrenceGroupId;
    if (gid) {
      if (!oneOffsByGroup.has(gid)) oneOffsByGroup.set(gid, []);
      oneOffsByGroup.get(gid)!.push(o);
    } else {
      standaloneOneOffs.push(o);
    }
  }

  // 1) Groupes récurrents → 1 ligne par groupe
  for (const [gid, group] of oneOffsByGroup) {
    const first = group[0];
    // Label : on retire le suffixe " — Mois Année" pour avoir le label de base
    const baseLabel = first.label.replace(/\s—\s\w+\s\d{4}$/i, "");

    const cells: CashflowCell[] = MONTHS.map((monthIdx) => {
      const item = group.find((o) => o.date.getUTCMonth() === monthIdx);
      if (!item) return { amount: 0, status: "PLANNED" as const };
      return {
        amount: Number(item.amount),
        status: (item.status === "PAID"
          ? "PAID"
          : item.status === "SKIPPED"
          ? "SKIPPED"
          : "PLANNED") as "PLANNED" | "PAID" | "SKIPPED",
        notes: item.notes,
        monthEntryId: item.id // permet d'éditer ce OneOff précis via la cellule
      };
    });

    rows.push({
      id: `one-group-${gid}`,
      kind: kindMap[first.kind],
      label: baseLabel,
      category: first.category,
      isIncome: isIncomeKind(first.kind),
      oneOffId: first.id, // pour le pencil → édite la 1ère
      cells,
      totalYear: cells.reduce(
        (s, c) => s + (c.status === "SKIPPED" ? 0 : c.amount),
        0
      )
    });
  }

  // 2) OneOffs individuels (sans groupe)
  for (const o of standaloneOneOffs) {
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
    rows.push({
      id: `one-${o.id}`,
      kind: kindMap[o.kind],
      label: o.label,
      category: o.category,
      isIncome: isIncomeKind(o.kind),
      oneOffId: o.id,
      cells,
      totalYear: Number(o.amount)
    });
  }

  // ─── Masquage de catégories obsolètes ───
  // La catégorie « Facture client » (encore présente sur d'anciennes lignes
  // recurring/oneoff) n'a plus de raison d'être depuis la refonte "1 ligne
  // par projet" — les revenus client passent tous par les BillingMilestones.
  // On garde les montants dans les totaux (contribution historique) mais on
  // cache la ligne à l'affichage. Match insensible à la casse et tolère les
  // variantes courantes (accents, pluriel, "factures client(s)").
  const HIDDEN_CATEGORY_LABELS = new Set([
    "facture client",
    "factures client",
    "facture clients",
    "factures clients"
  ]);
  function isHiddenCategory(cat: string | null | undefined): boolean {
    if (!cat) return false;
    const norm = cat.trim().toLowerCase()
      // NFD sépare les accents en combining marks, on les enlève
      // (U+0300 → U+036F = plage des diacritiques combinés)
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
    return HIDDEN_CATEGORY_LABELS.has(norm);
  }
  for (const r of rows) {
    if (isHiddenCategory(r.category)) r.hidden = true;
  }

  // Masque une ligne s'il ne reste AUCUN paiement dans le futur.
  //  - Année future (>= année courante) : "futur" = mois index >= cutoffMonth
  //    (cutoffMonth = mois courant si année courante, sinon 0)
  //  - Année passée : on garde le comportement "hide seulement si toute
  //    l'année à 0" pour rester utile en mode archive
  // Les milestones (projets) conservent leur propre logique "hidden si
  // projet clôturé" gérée plus haut et ne sont pas touchés ici.
  const nowRef = new Date();
  const currentYear = nowRef.getUTCFullYear();
  const currentMonthIdx = nowRef.getUTCMonth(); // 0..11
  const isCurrentYear = year === currentYear;
  const isFutureYear = year > currentYear;
  for (const r of rows) {
    if (r.hidden) continue;
    if (r.kind === "milestones") continue;
    const cutoff = isCurrentYear ? currentMonthIdx : 0;
    let hasFuturePayment = false;
    if (isCurrentYear || isFutureYear) {
      for (let i = cutoff; i < r.cells.length; i++) {
        const c = r.cells[i];
        if (c.status === "SKIPPED") continue;
        if (Number(c.amount) > 0) { hasFuturePayment = true; break; }
      }
    } else {
      // Année passée : on retombe sur le critère "au moins un paiement
      // n'importe quand dans l'année" pour ne pas vider la vue archive.
      for (const c of r.cells) {
        if (c.status === "SKIPPED") continue;
        if (Number(c.amount) > 0) { hasFuturePayment = true; break; }
      }
    }
    if (!hasFuturePayment) r.hidden = true;
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

  // ─── Solde compte réel — indépendant de l'année affichée ───
  // Le KPI "Solde compte" doit représenter le SOLDE BANCAIRE ACTUEL, pas
  // une projection. Il vaut donc : bootstrap + TOUS les paiements réels
  // encaissés/effectués depuis le bootstrap, tous statuts PAID confondus,
  // quelle que soit l'année. On ne peut pas se contenter du realPaid de
  // l'année affichée + startingBalance projeté : ce mix donnerait un
  // solde différent selon l'année consultée.
  const [
    allPaidMs,
    allPaidOo,
    allPaidRecMonths,
    allPaidPayrollMonths
  ] = await Promise.all([
    prisma.billingMilestone.findMany({
      where: { status: "PAID" },
      include: {
        mission: { select: { id: true } },
        project: { select: { vatRate: true } },
        offer:   { select: { vatRate: true } }
      }
    }),
    prisma.oneOffCashflowEntry.findMany({
      where: {
        status: "PAID",
        kind: { notIn: ["SIMULATION", "SIMULATION_INCOME"] }
      },
      select: { amount: true, kind: true }
    }),
    prisma.recurringExpenseMonth.findMany({
      where: { status: "PAID" },
      include: { recurringExpense: { select: { isIncome: true } } }
    }),
    prisma.payrollMonth.findMany({
      where: { status: "PAID" }
    })
  ]);
  // TVAC pour les milestones PAID (identique à la logique année/année) :
  // on récupère vatRate depuis project / offer / mission.
  const allPaidMissionIds = new Set<string>();
  for (const m of allPaidMs) if (m.missionId) allPaidMissionIds.add(m.missionId);
  const allPaidVatByMission = new Map<string, number>();
  if (allPaidMissionIds.size > 0) {
    try {
      const idList = Array.from(allPaidMissionIds)
        .map((id) => `'${id.replace(/'/g, "''")}'`)
        .join(",");
      const missionRows = await prisma.$queryRawUnsafe<
        { id: string; vatRate: string | number }[]
      >(`SELECT id, "vatRate" FROM "Mission" WHERE id IN (${idList})`);
      for (const r of missionRows) {
        const v = Number(r.vatRate);
        if (Number.isFinite(v) && v > 0) allPaidVatByMission.set(r.id, v);
      }
    } catch { /* colonne absente → fallback 21% */ }
  }
  let realPaidInflow = 0;
  let realPaidOutflow = 0;
  for (const m of allPaidMs) {
    const vat = m.missionId
      ? allPaidVatByMission.get(m.missionId) ?? 21
      : (m.project?.vatRate ?? m.offer?.vatRate ?? 21) as number;
    realPaidInflow += Number(m.amount) * (1 + Number(vat) / 100);
  }
  for (const o of allPaidOo) {
    const a = Number(o.amount);
    if (o.kind === "INCOME") realPaidInflow += a;
    else if (o.kind === "EXPENSE" || o.kind === "COMMITMENT") realPaidOutflow += a;
  }
  for (const me of allPaidRecMonths) {
    const a = Number(me.amountOverride ?? 0);
    // Si pas d'override, il faudrait le defaultAmount du parent RecurringExpense
    const amount = me.amountOverride != null
      ? a
      : Number((me as any).recurringExpense?.defaultAmount ?? 0);
    if ((me as any).recurringExpense?.isIncome) realPaidInflow += amount;
    else realPaidOutflow += amount;
  }
  // Payroll : toujours en sortie. Si override présent → on l'utilise ;
  // sinon on recompose le montant en agrégeant les employés actifs ce
  // mois-là (même logique que le rendu grille). Sans ça un utilisateur
  // qui coche Payé sans saisir de montant n'aurait rien dans son solde.
  const allEmployeesForPaid = allPaidPayrollMonths.length > 0
    ? await prisma.payrollEmployee.findMany()
    : [];
  for (const pm of allPaidPayrollMonths) {
    if (pm.amountOverride != null) {
      realPaidOutflow += Number(pm.amountOverride);
      continue;
    }
    const monthStart = new Date(Date.UTC(pm.year, pm.month - 1, 1));
    const monthEnd = new Date(Date.UTC(pm.year, pm.month, 0));
    let sum = 0;
    for (const e of allEmployeesForPaid) {
      if (e.startDate > monthEnd) continue;
      if (e.endDate != null && e.endDate < monthStart) continue;
      if (pm.kind === "NET_PAY") sum += Number(e.monthlyNetPay);
      else if (pm.kind === "WITHHOLDING_TAX") sum += Number(e.monthlyWithholdingTax);
      else if (pm.kind === "ONSS") sum += Number(e.monthlyOnss);
    }
    realPaidOutflow += sum;
  }
  const realBankBalance = bootstrapBalance + realPaidInflow - realPaidOutflow;

  // ─── "En cours" : factures émises (INVOICED) en attente de paiement ───
  // On veut le total des outstanding receivables, indépendamment de l'année
  // affichée. C'est l'argent qu'on doit recevoir mais qu'on n'a pas encore.
  // TVAC car c'est ce qui arrivera sur le compte bancaire.
  const inProgressMilestones = await prisma.billingMilestone.findMany({
    where: { status: "INVOICED" as any },
    include: {
      mission: { select: { id: true } },
      project: { select: { vatRate: true } },
      offer: { select: { vatRate: true } }
    }
  });
  // Mission vatRate via raw SQL pour gérer la colonne absente
  let missionVatById = new Map<string, number>();
  const missionIdsInProgress = Array.from(
    new Set(
      inProgressMilestones.map((m) => m.missionId).filter((x): x is string => !!x)
    )
  );
  if (missionIdsInProgress.length > 0) {
    try {
      const rows = await prisma.$queryRawUnsafe<
        { id: string; vatRate: string | number }[]
      >(
        `SELECT id, "vatRate" FROM "Mission" WHERE id IN (${missionIdsInProgress
          .map((id) => `'${id.replace(/'/g, "''")}'`)
          .join(",")})`
      );
      for (const r of rows) {
        const v = Number(r.vatRate);
        if (Number.isFinite(v) && v > 0) missionVatById.set(r.id, v);
      }
    } catch {
      // Colonne absente → fallback 21% dans la boucle
    }
  }
  let inProgressAmount = 0;
  for (const m of inProgressMilestones) {
    const vat =
      missionVatById.get(m.missionId ?? "") ??
      (m.project?.vatRate != null
        ? Number(m.project.vatRate)
        : m.offer?.vatRate != null
          ? Number(m.offer.vatRate)
          : 21);
    inProgressAmount += Number(m.amount) * (1 + vat / 100);
  }
  inProgressAmount = Math.round(inProgressAmount * 100) / 100;
  const inProgressCount = inProgressMilestones.length;

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
    realPaidOutflow,
    inProgressAmount,
    inProgressCount
  };

  return {
    year,
    startingBalance,
    isBootstrapYear,
    bootstrapYear,
    rows,
    monthlyTotals,
    yearTotals
  };
}

export const MONTH_LABELS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
];
