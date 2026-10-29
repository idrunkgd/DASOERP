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
  net: number;                 // taxable - précompte (sans package)
  onssEmployerEstimate: number;// ~25 % du brut (estimation globale)
  totalEmployerCost: number;   // brut + ONSS patronal
};

/**
 * Package complet du consultant / employé (vient du simulateur).
 * Tous les montants mensuels sauf ecoVouchersAnnual.
 */
export type Package = {
  grossMonthly: number;
  carMonthlyTco?: number;              // TCO voiture de société
  mealVoucherEmployerPerDay?: number;  // contribution employeur ticket-restaurant
  ecoVouchersAnnual?: number;          // éco-chèques annuels
  hospitalInsuranceMonthly?: number;   // hospi + autres assurances
  phoneInternetMonthly?: number;       // GSM + internet
  netExpensesMonthly?: number;         // frais de représentation forfaitaires (nets)
  workingDaysPerMonth?: number;        // 18.33 par défaut (220/12)
};

export type PayrollFullResult = PayrollResult & {
  // ATN (Avantages de Toute Nature) — rajoutés à l'imposable
  atnCar: number;
  atnPhone: number;
  atnHospital: number;
  atnTotal: number;
  // Nets perçus en nature / vouchers (viennent s'ajouter au net cash)
  mealVouchersNetMonthly: number;
  ecoVouchersNetMonthly: number;
  netExpensesMonthly: number;
  // Résumé final
  netCash: number;         // ce qui tombe sur le compte (brut − ONSS − précompte)
  netTotalInHand: number;  // net cash + chèques + éco + frais représ. (sans voiture ATN)
  packageValueMonthly: number; // valeur totale perçue (netTotal + ATN voiture valorisée)
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

/**
 * Calcul paie complète à partir du package du consultant.
 *
 * Modèle :
 *   1. ONSS employé (13,07 % du brut)
 *   2. ATN mensuels à ajouter à l'imposable :
 *      - Voiture : ≈ 15 % du TCO mensuel (vraie formule 2026 complexe, basée
 *        sur VC × 6/7 × coeff CO2 × âge, on simplifie pour la décision)
 *      - GSM / internet : forfait 4 €/mois si phoneInternetMonthly > 0
 *      - Hospi + assurances employeur : 30 % de la prime (ratio ATN courant)
 *   3. Base imposable = brut − ONSS + ATN
 *   4. Précompte prof barème I appliqué sur la base imposable
 *   5. Net cash = brut − ONSS − précompte (ce qui tombe sur le compte)
 *   6. Net perçu en main = net cash
 *                        + chèques-repas (part employeur − 1,09 €/jour part salariée)
 *                        + éco-chèques (nets)
 *                        + frais de représentation (nets forfaitaires)
 *   7. Package valeur totale = Net perçu + voiture (TCO mensuel) + hospi
 *      (valorisation complète, utile pour benchmark global).
 */
export function computeBelgianPayrollFromPackage(pkg: Package, opts: PayrollOptions = {}): PayrollFullResult {
  const gross = Math.max(0, Number(pkg.grossMonthly) || 0);
  const onssEmployee = round2(gross * ONSS_EMPLOYEE_RATE);

  // ATN mensuels
  const car = pkg.carMonthlyTco ?? 0;
  const phone = pkg.phoneInternetMonthly ?? 0;
  const hospi = pkg.hospitalInsuranceMonthly ?? 0;
  const atnCar      = round2(car * 0.15);                 // ≈ 15 % TCO (approx)
  const atnPhone    = phone > 0 ? 4 : 0;                  // forfait tolérance mensuel
  const atnHospital = round2(hospi * 0.30);               // 30 % de la prime (approx)
  const atnTotal    = round2(atnCar + atnPhone + atnHospital);

  // Imposable mensuel
  const taxableIncome = round2(gross - onssEmployee + atnTotal);

  // Précompte prof
  let wht = withholdingTaxBaremeI(taxableIncome);
  if (opts.bareme === "II") wht -= 249;
  wht -= childReduction(opts.childrenCount ?? 0);
  if (taxableIncome < 2600) {
    const reduction = Math.min(wht, (2600 - taxableIncome) * 0.045);
    wht -= reduction;
  }
  const withholdingTax = round2(Math.max(0, wht));

  // Net cash (ce qui tombe sur le compte) — les ATN ne sont pas versés en cash
  const netCash = round2(gross - onssEmployee - withholdingTax);

  // Nets en nature / vouchers
  const workDays = pkg.workingDaysPerMonth ?? 220 / 12; // 18.33 par défaut
  const mealContribEmp = pkg.mealVoucherEmployerPerDay ?? 0;
  // Part salarié obligatoire 1,09 €/j — déjà déduite du net cash dans la réalité,
  // mais pour simplifier on affiche la valeur reçue en vouchers nette :
  const mealVouchersNetMonthly = round2(Math.max(0, (mealContribEmp - 1.09) * workDays));
  const ecoVouchersNetMonthly  = round2((pkg.ecoVouchersAnnual ?? 0) / 12);
  const netExpensesMonthly     = round2(pkg.netExpensesMonthly ?? 0);

  // Net perçu en main (cash + vouchers + frais nets)
  const netTotalInHand = round2(netCash + mealVouchersNetMonthly + ecoVouchersNetMonthly + netExpensesMonthly);

  // Valeur totale package (ajoute la voiture valorisée + hospi)
  const packageValueMonthly = round2(netTotalInHand + car + hospi);

  // Côté employeur
  const onssEmployerEstimate = round2(gross * ONSS_EMPLOYER_RATE_APPROX);
  const totalEmployerCost = round2(
    gross + onssEmployerEstimate + car + mealContribEmp * workDays
    + ecoVouchersNetMonthly + hospi + phone + netExpensesMonthly
  );

  return {
    gross: round2(gross),
    onssEmployee,
    taxableIncome,
    withholdingTax,
    net: netCash,
    onssEmployerEstimate,
    totalEmployerCost,

    atnCar, atnPhone, atnHospital, atnTotal,
    mealVouchersNetMonthly, ecoVouchersNetMonthly, netExpensesMonthly,
    netCash,
    netTotalInHand,
    packageValueMonthly
  };
}
