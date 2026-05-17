/**
 * Calcul brut ↔ net belge (employé salarié) — version complète avec
 * avantages extra-légaux et cotisations spéciales côté employé.
 *
 * ⚠️ APPROXIMATION : la fiche de paie belge réelle utilise les barèmes
 * officiels du SPF Finances (centaines de lignes de tables mensuelles)
 * avec dizaines de micro-réductions. Cet outil donne une estimation à
 * ±3-5%, suffisante pour des discussions de compensation mais PAS pour
 * produire une fiche de paie officielle.
 *
 * Barèmes utilisés : valeurs 2025 simplifiées.
 *
 * Flux de calcul :
 *
 *   BRUT MENSUEL
 *   − ONSS travailleur (13.07% du brut)
 *   = BRUT IMPOSABLE
 *   + ATN voiture (ajoute à la base imposable, pas à l'ONSS)
 *   − Cotisations employé pré-impôt (assurance groupe, hospi)
 *   = BASE PRÉCOMPTE
 *
 *   PRÉCOMPTE = brackets(base) − réductions famille
 *
 *   NET SALAIRE (cash sur le compte)
 *     = BRUT IMPOSABLE − cot. employé − précompte − CSSS − chèques-repas (part employé)
 *     (l'ATN n'est PAS du cash, il a juste augmenté le précompte)
 *
 *   POUVOIR D'ACHAT TOTAL
 *     = NET SALAIRE
 *     + chèques-repas (part employeur)
 *     + éco-chèques
 *     + frais de représentation (forfait net)
 */

export type FamilySituation =
  | "single"
  | "married_dual"
  | "married_single";

export type SalaryOptions = {
  // Situation familiale
  situation: FamilySituation;
  dependentChildren: number;
  disabledChildren?: number;
  disabledSelf?: boolean;

  // Avantages en nature & cotisations
  /** ATN voiture mensuel (€/mois) — augmente la base imposable */
  carAtnMonthly?: number;

  /** Cotisation employé à l'assurance groupe (€/mois) — déductible */
  groupInsuranceEmployee?: number;

  /** Cotisation employé à l'assurance hospitalisation/famille (€/mois) */
  hospitalInsuranceEmployee?: number;

  /** Chèques-repas : part employé (€/jour, typique 1.09€) */
  mealVoucherEmployeeShare?: number;

  /** Chèques-repas : part employeur (€/jour, typique 6.91-8.91€) */
  mealVoucherEmployerShare?: number;

  /** Nombre de jours prestés par mois (typique ~20) */
  mealVoucherDaysPerMonth?: number;

  /** Éco-chèques mensuels (€/mois, typique 250€/an = 20.83€/mois) */
  ecoVouchersMonthly?: number;

  /** Frais de représentation (forfait net, max ~150€/mois sans justif) */
  representationFeesMonthly?: number;
};

export const DEFAULT_OPTIONS: SalaryOptions = {
  situation: "single",
  dependentChildren: 0,
  disabledChildren: 0,
  disabledSelf: false,
  carAtnMonthly: 0,
  groupInsuranceEmployee: 0,
  hospitalInsuranceEmployee: 0,
  mealVoucherEmployeeShare: 0,
  mealVoucherEmployerShare: 0,
  mealVoucherDaysPerMonth: 20,
  ecoVouchersMonthly: 0,
  representationFeesMonthly: 0
};

// ─────────────────────────────────────────────────────────────
// CONSTANTES BELGES 2025
// ─────────────────────────────────────────────────────────────

export const ONSS_RATE = 0.1307;

const PRECOMPTE_BRACKETS_SINGLE: { upTo: number; rate: number }[] = [
  { upTo: 1119, rate: 0.0 },
  { upTo: 2240, rate: 0.2675 },
  { upTo: 5600, rate: 0.3525 },
  { upTo: 8400, rate: 0.45 },
  { upTo: Infinity, rate: 0.5 }
];

const CHILDREN_REDUCTIONS: number[] = [
  0, 46, 121, 324, 588, 859
];

const SINGLE_INCOME_REDUCTION = 110;
const DISABLED_SELF_REDUCTION = 46;

function computeCsssMonthly(grossTaxable: number): number {
  if (grossTaxable < 1550) return 0;
  if (grossTaxable < 1850) return 9.3;
  if (grossTaxable < 3500) return 9.3 + (grossTaxable - 1850) * 0.0135;
  return 60.94;
}

function applyBrackets(amount: number): number {
  let result = 0;
  let prev = 0;
  let remaining = amount;
  for (const b of PRECOMPTE_BRACKETS_SINGLE) {
    const inThisBracket = Math.min(remaining, b.upTo - prev);
    if (inThisBracket > 0) {
      result += inThisBracket * b.rate;
      remaining -= inThisBracket;
    }
    prev = b.upTo;
    if (remaining <= 0) break;
  }
  return result;
}

function computeFamilyReductions(opts: SalaryOptions): number {
  let reduction = 0;
  const effectiveChildren =
    opts.dependentChildren + (opts.disabledChildren ?? 0);
  if (effectiveChildren >= CHILDREN_REDUCTIONS.length) {
    reduction +=
      CHILDREN_REDUCTIONS[CHILDREN_REDUCTIONS.length - 1] +
      (effectiveChildren - (CHILDREN_REDUCTIONS.length - 1)) * 271;
  } else {
    reduction += CHILDREN_REDUCTIONS[effectiveChildren] ?? 0;
  }
  if (opts.situation === "married_single") reduction += SINGLE_INCOME_REDUCTION;
  if (opts.disabledSelf) reduction += DISABLED_SELF_REDUCTION;
  return reduction;
}

// ─────────────────────────────────────────────────────────────
// CALCULS
// ─────────────────────────────────────────────────────────────

export type SalaryBreakdownBe = {
  // Saisie
  grossMonthly: number;

  // Cotisations & impôts
  onssWorker: number;
  grossTaxable: number;
  carAtn: number;
  groupInsuranceEmployee: number;
  hospitalInsuranceEmployee: number;
  taxableBase: number;
  precompteRaw: number;
  precompteReductions: number;
  precompte: number;
  csss: number;

  // Chèques-repas
  mealVoucherEmployeeMonthly: number;
  mealVoucherEmployerMonthly: number;
  ecoVouchersMonthly: number;
  representationFeesMonthly: number;

  // Résultats
  /** Net cash reçu sur le compte bancaire chaque mois */
  netSalaryCash: number;
  /** Somme des avantages non taxés (chèques-repas, éco, frais représentation) */
  untaxedAdvantagesMonthly: number;
  /** Pouvoir d'achat total mensuel (cash + avantages utilisables) */
  totalPurchasingPower: number;

  // Annuel (×13.92 sur le brut)
  grossAnnual: number;
  netSalaryCashAnnual: number;
  totalPurchasingPowerAnnual: number;

  // KPIs
  totalDeductionsMonthly: number;
  effectiveTaxRate: number; // % du brut prélevé en charges + impôts
};

export function computeNetFromGross(
  grossMonthly: number,
  options: SalaryOptions = DEFAULT_OPTIONS
): SalaryBreakdownBe {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 1) ONSS travailleur sur le brut (pas sur l'ATN)
  const onssWorker = grossMonthly * ONSS_RATE;
  const grossTaxable = grossMonthly - onssWorker;

  // 2) Base pour le précompte = brut imposable + ATN voiture − cotisations employé
  const carAtn = opts.carAtnMonthly ?? 0;
  const groupIns = opts.groupInsuranceEmployee ?? 0;
  const hospiIns = opts.hospitalInsuranceEmployee ?? 0;
  const taxableBase = grossTaxable + carAtn - groupIns - hospiIns;

  // 3) Précompte professionnel
  const precompteRaw = applyBrackets(Math.max(0, taxableBase));
  const precompteReductions = computeFamilyReductions(opts);
  const precompte = Math.max(0, precompteRaw - precompteReductions);

  // 4) CSSS sur le brut imposable
  const csss = computeCsssMonthly(grossTaxable);

  // 5) Chèques-repas
  const mvDays = opts.mealVoucherDaysPerMonth ?? 20;
  const mealVoucherEmployeeMonthly =
    (opts.mealVoucherEmployeeShare ?? 0) * mvDays;
  const mealVoucherEmployerMonthly =
    (opts.mealVoucherEmployerShare ?? 0) * mvDays;

  // 6) Net salaire cash :
  //    = brut imposable − cot. employé − précompte − CSSS − part employé chèques-repas
  //    (l'ATN n'est PAS retiré du cash, il a juste augmenté le précompte)
  const netSalaryCash =
    grossTaxable -
    groupIns -
    hospiIns -
    precompte -
    csss -
    mealVoucherEmployeeMonthly;

  // 7) Avantages non taxés (s'ajoutent au pouvoir d'achat)
  const untaxedAdvantagesMonthly =
    mealVoucherEmployerMonthly +
    (opts.ecoVouchersMonthly ?? 0) +
    (opts.representationFeesMonthly ?? 0);

  const totalPurchasingPower = netSalaryCash + untaxedAdvantagesMonthly;

  // 8) Annualisation
  const grossAnnual = grossMonthly * 13.92;
  const netSalaryCashAnnual = netSalaryCash * 13.92;
  // Les avantages s'étalent sur 12 mois (pas de 13ᵉ chèque-repas)
  const totalPurchasingPowerAnnual =
    netSalaryCashAnnual + untaxedAdvantagesMonthly * 12;

  const totalDeductionsMonthly = onssWorker + precompte + csss;
  const effectiveTaxRate =
    grossMonthly > 0 ? (totalDeductionsMonthly / grossMonthly) * 100 : 0;

  return {
    grossMonthly,
    onssWorker,
    grossTaxable,
    carAtn,
    groupInsuranceEmployee: groupIns,
    hospitalInsuranceEmployee: hospiIns,
    taxableBase,
    precompteRaw,
    precompteReductions,
    precompte,
    csss,
    mealVoucherEmployeeMonthly,
    mealVoucherEmployerMonthly,
    ecoVouchersMonthly: opts.ecoVouchersMonthly ?? 0,
    representationFeesMonthly: opts.representationFeesMonthly ?? 0,
    netSalaryCash,
    untaxedAdvantagesMonthly,
    totalPurchasingPower,
    grossAnnual,
    netSalaryCashAnnual,
    totalPurchasingPowerAnnual,
    totalDeductionsMonthly,
    effectiveTaxRate
  };
}

/**
 * Net cash souhaité → brut nécessaire.
 * Dichotomique : la fonction brut→net n'est pas inversible analytiquement.
 */
export function computeGrossFromNet(
  netTarget: number,
  options: SalaryOptions = DEFAULT_OPTIONS,
  maxIter = 80
): SalaryBreakdownBe {
  let lo = netTarget;
  let hi = netTarget * 3;
  let mid = (lo + hi) / 2;
  for (let i = 0; i < maxIter; i++) {
    mid = (lo + hi) / 2;
    const computed = computeNetFromGross(mid, options);
    const diff = computed.netSalaryCash - netTarget;
    if (Math.abs(diff) < 0.01) break;
    if (computed.netSalaryCash < netTarget) lo = mid;
    else hi = mid;
  }
  return computeNetFromGross(mid, options);
}

export const FAMILY_SITUATION_LABELS: Record<FamilySituation, string> = {
  single: "Isolé / célibataire",
  married_dual: "Marié — 2 revenus",
  married_single: "Marié — 1 seul revenu (quotient conjugal)"
};
