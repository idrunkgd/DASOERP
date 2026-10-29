/**
 * Calcul paie belge simplifié — brut → ONSS employé → précompte prof → net.
 *
 * ⚠ ESTIMATION — pas un calcul légal exact.
 * Barème utilisé : "Barème I" (isolé, 0 enfant à charge, salarié résident fiscal
 * belge), échelle 2026 arrondie. Pour une paie officielle, utiliser un secrétariat
 * social (Partena, SD Worx, Securex, Acerta).
 *
 * Références :
 *   - ONSS employé : 13.07 % cotisation personnelle de sécurité sociale
 *   - Précompte professionnel : barème officiel SPF Finances (annexes AR
 *     exécution CIR 92) — ici approximé par une fonction continue par tranches
 *   - Réductions forfaitaires faibles revenus : incluses de manière simplifiée
 */

export type PayrollOptions = {
  /** Isolé | marié conjoint sans revenu — barème I/II. Simplifié : barème I par défaut. */
  bareme?: "I" | "II";
  /** Nombre d'enfants à charge — chaque enfant réduit le précompte */
  childrenCount?: number;
};

export type PayrollResult = {
  gross: number;
  onssEmployee: number;        // cotisation personnelle 13.07 %
  taxableIncome: number;       // brut - ONSS
  withholdingTax: number;      // précompte professionnel
  net: number;                 // taxable - précompte
  onssEmployerEstimate: number;// ~25 % du brut (estimation globale)
  totalEmployerCost: number;   // brut + ONSS patronal
};

const ONSS_EMPLOYEE_RATE = 0.1307;
const ONSS_EMPLOYER_RATE_APPROX = 0.25; // 25 % estimation (varie 24-27 % selon secteur, Maribel, groupe cible)

/**
 * Précompte professionnel mensuel — Barème I (isolé, 0 enfant), échelle 2026.
 *
 * Approximation par tranches sur revenu imposable mensuel (après ONSS).
 * Barème officiel = formule par tranches avec arrondis à l'euro inférieur,
 * ici on retourne la valeur continue pour avoir une estimation fluide.
 */
function withholdingTaxBaremeI(taxable: number): number {
  if (taxable <= 1035)  return 0;
  if (taxable <= 2140)  return (taxable - 1035) * 0.2675;
  if (taxable <= 3570)  return 295.59 + (taxable - 2140) * 0.4075;
  if (taxable <= 5250)  return 878.32 + (taxable - 3570) * 0.4575;
  return 1646.72 + (taxable - 5250) * 0.5000;
}

/** Réduction mensuelle par enfant à charge (approximation 2026). */
const CHILD_REDUCTIONS = [0, 46, 128, 341, 639, 973, 1314]; // 0, 1, 2, 3, 4, 5, 6 enfants
function childReduction(n: number): number {
  if (n <= 0) return 0;
  if (n >= CHILD_REDUCTIONS.length) return CHILD_REDUCTIONS[CHILD_REDUCTIONS.length - 1] + (n - CHILD_REDUCTIONS.length + 1) * 400;
  return CHILD_REDUCTIONS[n];
}

/**
 * Calcule la paie belge mensuelle à partir d'un brut.
 */
export function computeBelgianPayroll(gross: number, opts: PayrollOptions = {}): PayrollResult {
  const g = Math.max(0, Number(gross) || 0);
  const onssEmployee = round2(g * ONSS_EMPLOYEE_RATE);
  const taxableIncome = round2(g - onssEmployee);

  // Précompte brut barème
  let wht = withholdingTaxBaremeI(taxableIncome);

  // Barème II (marié conjoint sans revenu) : réduction forfaitaire mensuelle ~249 €
  if (opts.bareme === "II") wht -= 249;

  // Réduction enfants à charge
  wht -= childReduction(opts.childrenCount ?? 0);

  // Réduction forfaitaire bas revenus — simplifié
  if (taxableIncome < 2600) {
    const reduction = Math.min(wht, (2600 - taxableIncome) * 0.045);
    wht -= reduction;
  }

  const withholdingTax = round2(Math.max(0, wht));
  const net = round2(taxableIncome - withholdingTax);
  const onssEmployerEstimate = round2(g * ONSS_EMPLOYER_RATE_APPROX);
  const totalEmployerCost = round2(g + onssEmployerEstimate);

  return {
    gross: round2(g),
    onssEmployee,
    taxableIncome,
    withholdingTax,
    net,
    onssEmployerEstimate,
    totalEmployerCost
  };
}

function round2(x: number): number { return Math.round(x * 100) / 100; }
