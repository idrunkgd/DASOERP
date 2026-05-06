/**
 * Calcul du package salarial belge — coût employeur et TJM.
 *
 * Convention :
 *  - le brut "mensuel" est multiplié par `monthsPerYear` (13.92 par défaut :
 *    12 mensualités + 13e mois + double pécule de vacances ≈ 0.92 mensualité).
 *  - les "charges patronales" (employerChargesPct) appliquent un % brut sur
 *    le brut annuel : ONSS patronale + cotisations connexes (≈ 25-27% selon
 *    réductions structurelles en Belgique).
 *  - les avantages "extra-légaux" (voiture, chèques-repas, éco-chèques,
 *    assurance groupe, hospi, GSM, frais nets) sont additionnés en coût
 *    employeur direct (TCO réel pour la voiture, plafond ONSS exonéré
 *    pour les chèques).
 *  - on suppose `workingDaysPerYear` jours réellement prestés (220 par
 *    défaut, soit ≈ 252 jours ouvrés - 20 congés - 12 fériés).
 */

export type SalaryInputs = {
  grossMonthly: number;
  monthsPerYear: number;
  employerChargesPct: number;
  /** Régime hebdomadaire en jours travaillés (5 = temps plein, 4 = 4/5, etc.) */
  workingDaysPerWeek: number;
  workingDaysPerYear: number;
  carMonthlyTco: number;
  mealVoucherEmployerPerDay: number;
  ecoVouchersAnnual: number;
  groupInsurancePct: number;
  /** Hospitalisation + autres assurances : coût employeur MENSUEL (× 12 dans le calcul) */
  hospitalInsuranceMonthly: number;
  /** GSM + abonnement internet : coût employeur MENSUEL (× 12 dans le calcul) */
  phoneInternetMonthly: number;
  netExpensesMonthly: number;
  targetMarginPct: number;
  /** TJM réellement vendu / facturé au client (0 = pas encore défini) */
  soldDailyRate: number;
};

export type SalaryBreakdown = {
  grossAnnual: number;
  employerChargesAnnual: number;
  totalGrossLoaded: number;

  carAnnual: number;
  mealVouchersAnnual: number;
  ecoVouchersAnnual: number;
  groupInsuranceAnnual: number;
  hospitalInsuranceAnnual: number;
  phoneInternetAnnual: number;
  netExpensesAnnual: number;
  benefitsAnnual: number;

  totalAnnualCost: number;
  costPerDay: number;
  billableRate: number;
  marginPerDay: number;
  marginAnnual: number;

  /** Marge calculée à partir du TJM réellement vendu (si soldDailyRate > 0) */
  actualMarginPerDay: number;
  actualMarginAnnual: number;
  actualMarginPct: number;
};

/**
 * Convention Dasolabs pour estimer les jours prestés/an :
 *   261 jours ouvrés/an (52 sem × 5)
 *   − 32 jours de congés Dasolabs
 *   − 10 jours fériés légaux belges
 *   ≈ 219 jours pour un temps plein 5/5
 * Soit ≈ 44 jours/an par jour de travail/semaine (219/5 ≈ 43.8, arrondi 44).
 */
export const DAYS_PER_YEAR_PER_WEEKDAY = 44;
export const FULLTIME_WORKING_DAYS_PER_YEAR = 219;

export const DEFAULT_SALARY_INPUTS: SalaryInputs = {
  grossMonthly: 4500,
  monthsPerYear: 13.92,
  employerChargesPct: 25,
  workingDaysPerWeek: 5,
  workingDaysPerYear: FULLTIME_WORKING_DAYS_PER_YEAR,
  carMonthlyTco: 0,
  mealVoucherEmployerPerDay: 8.91,
  ecoVouchersAnnual: 250,
  groupInsurancePct: 0,
  hospitalInsuranceMonthly: 0,
  phoneInternetMonthly: 0,
  netExpensesMonthly: 0,
  targetMarginPct: 35,
  soldDailyRate: 0
};

export function computeSalary(i: SalaryInputs): SalaryBreakdown {
  const grossAnnual = i.grossMonthly * i.monthsPerYear;
  const employerChargesAnnual = grossAnnual * (i.employerChargesPct / 100);
  const totalGrossLoaded = grossAnnual + employerChargesAnnual;

  const carAnnual = i.carMonthlyTco * 12;
  const mealVouchersAnnual = i.mealVoucherEmployerPerDay * i.workingDaysPerYear;
  const ecoVouchersAnnual = i.ecoVouchersAnnual;
  const groupInsuranceAnnual = grossAnnual * (i.groupInsurancePct / 100);
  const hospitalInsuranceAnnual = i.hospitalInsuranceMonthly * 12;
  const phoneInternetAnnual = i.phoneInternetMonthly * 12;
  const netExpensesAnnual = i.netExpensesMonthly * 12;

  const benefitsAnnual =
    carAnnual +
    mealVouchersAnnual +
    ecoVouchersAnnual +
    groupInsuranceAnnual +
    hospitalInsuranceAnnual +
    phoneInternetAnnual +
    netExpensesAnnual;

  const totalAnnualCost = totalGrossLoaded + benefitsAnnual;
  const costPerDay =
    i.workingDaysPerYear > 0 ? totalAnnualCost / i.workingDaysPerYear : 0;
  const billableRate = costPerDay * (1 + i.targetMarginPct / 100);
  const marginPerDay = billableRate - costPerDay;
  const marginAnnual = marginPerDay * i.workingDaysPerYear;

  // Marge réelle si un TJM vendu est saisi
  const actualMarginPerDay =
    i.soldDailyRate > 0 ? i.soldDailyRate - costPerDay : 0;
  const actualMarginAnnual = actualMarginPerDay * i.workingDaysPerYear;
  const actualMarginPct =
    i.soldDailyRate > 0 && costPerDay > 0
      ? ((i.soldDailyRate - costPerDay) / costPerDay) * 100
      : 0;

  return {
    grossAnnual,
    employerChargesAnnual,
    totalGrossLoaded,
    carAnnual,
    mealVouchersAnnual,
    ecoVouchersAnnual,
    groupInsuranceAnnual,
    hospitalInsuranceAnnual,
    phoneInternetAnnual,
    netExpensesAnnual,
    benefitsAnnual,
    totalAnnualCost,
    costPerDay,
    billableRate,
    marginPerDay,
    marginAnnual,
    actualMarginPerDay,
    actualMarginAnnual,
    actualMarginPct
  };
}
