/**
 * Calcul brut ↔ net belge (employé salarié).
 *
 * ⚠️ APPROXIMATION : la fiche de paie belge réelle utilise les barèmes
 * officiels du SPF Finances (centaines de lignes de tables de lookup
 * mensuelles), avec des dizaines de micro-réductions (bas salaires,
 * fils-de-chômeur, quotient familial, etc.). Cet outil donne une
 * estimation à ±3-5%, suffisante pour des discussions de compensation
 * et propositions salariales mais PAS pour produire une fiche de paie
 * officielle.
 *
 * Barèmes utilisés : valeurs 2025 simplifiées.
 */

export type FamilySituation =
  | "single"            // Isolé
  | "married_dual"      // Marié/cohabitant légal, conjoint avec revenus
  | "married_single";   // Marié/cohabitant légal, conjoint sans revenus

export type SalaryOptions = {
  situation: FamilySituation;
  dependentChildren: number;     // 0, 1, 2, 3, 4+
  disabledChildren?: number;     // enfants à charge handicapés (compte double)
  disabledSelf?: boolean;        // travailleur handicapé
};

export const DEFAULT_OPTIONS: SalaryOptions = {
  situation: "single",
  dependentChildren: 0,
  disabledChildren: 0,
  disabledSelf: false
};

// ─────────────────────────────────────────────────────────────
// CONSTANTES BELGES 2025 (approximations)
// ─────────────────────────────────────────────────────────────

/** ONSS travailleur : taux unique sur le brut */
export const ONSS_RATE = 0.1307;

/**
 * Tranches précompte professionnel mensuel — barème "célibataire / isolé"
 * (approximation 2025 par tranches progressives).
 * Appliqué sur le brut imposable (brut - ONSS).
 */
const PRECOMPTE_BRACKETS_SINGLE: { upTo: number; rate: number }[] = [
  { upTo: 1119, rate: 0.0 },
  { upTo: 2240, rate: 0.2675 },
  { upTo: 5600, rate: 0.3525 },
  { upTo: 8400, rate: 0.45 },
  { upTo: Infinity, rate: 0.5 }
];

/**
 * Réduction d'impôt mensuelle par enfant à charge (cumul progressif).
 * Valeurs 2025 approximatives — barème SPF Finances.
 */
const CHILDREN_REDUCTIONS: number[] = [
  0,    // 0 enfant
  46,   // 1er enfant
  121,  // total pour 2 enfants
  324,  // total pour 3 enfants
  588,  // total pour 4 enfants
  859   // total pour 5 enfants (puis +271 par enfant supplémentaire)
];

/** Réduction supplémentaire pour conjoint sans revenu (quotient conjugal) */
const SINGLE_INCOME_REDUCTION = 110;

/** Réduction travailleur handicapé */
const DISABLED_SELF_REDUCTION = 46;

/**
 * Cotisation spéciale de sécurité sociale (CSSS) — barème mensuel
 * approximatif 2025. Appliquée sur le brut imposable.
 */
function computeCsssMonthly(grossTaxable: number): number {
  // Plage simplifiée : très faible pour les bas revenus,
  // plafonnée à ~60€/mois pour les revenus moyens/élevés.
  if (grossTaxable < 1550) return 0;
  if (grossTaxable < 1850) return 9.30;
  if (grossTaxable < 3500) return 9.30 + (grossTaxable - 1850) * 0.0135;
  return 60.94;
}

// ─────────────────────────────────────────────────────────────
// CALCULS
// ─────────────────────────────────────────────────────────────

export type SalaryBreakdownBe = {
  grossMonthly: number;
  onssWorker: number;
  grossTaxable: number;
  precompteRaw: number;
  precompteReductions: number;
  precompte: number;
  csss: number;
  netMonthly: number;

  // Annuel (× 13.92 par défaut pour gross, × 12 pour les totaux annuels)
  grossAnnual: number;
  netAnnual: number;
  totalDeductionsMonthly: number;
  effectiveTaxRate: number; // % du brut qui part en charges + impôts
};

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

  // Enfants à charge (compte double pour les enfants handicapés)
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

/** Brut mensuel → décomposition complète net */
export function computeNetFromGross(
  grossMonthly: number,
  options: SalaryOptions = DEFAULT_OPTIONS
): SalaryBreakdownBe {
  const onssWorker = grossMonthly * ONSS_RATE;
  const grossTaxable = grossMonthly - onssWorker;

  const precompteRaw = applyBrackets(grossTaxable);
  const precompteReductions = computeFamilyReductions(options);
  const precompte = Math.max(0, precompteRaw - precompteReductions);

  const csss = computeCsssMonthly(grossTaxable);

  const netMonthly = grossTaxable - precompte - csss;

  const grossAnnual = grossMonthly * 13.92;
  const netAnnual = netMonthly * 13.92;
  const totalDeductionsMonthly = onssWorker + precompte + csss;
  const effectiveTaxRate =
    grossMonthly > 0 ? (totalDeductionsMonthly / grossMonthly) * 100 : 0;

  return {
    grossMonthly,
    onssWorker,
    grossTaxable,
    precompteRaw,
    precompteReductions,
    precompte,
    csss,
    netMonthly,
    grossAnnual,
    netAnnual,
    totalDeductionsMonthly,
    effectiveTaxRate
  };
}

/**
 * Net mensuel → brut mensuel.
 * Recherche dichotomique : le brut → net n'est pas inversible analytiquement
 * à cause des tranches + plafonds, donc on itère.
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
    const diff = computed.netMonthly - netTarget;
    if (Math.abs(diff) < 0.01) break;
    if (computed.netMonthly < netTarget) lo = mid;
    else hi = mid;
  }
  return computeNetFromGross(mid, options);
}

export const FAMILY_SITUATION_LABELS: Record<FamilySituation, string> = {
  single: "Isolé / célibataire",
  married_dual: "Marié — 2 revenus",
  married_single: "Marié — 1 seul revenu (quotient conjugal)"
};
