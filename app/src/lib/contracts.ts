/**
 * Contrats — helpers de résolution de variables + rendu.
 *
 * Les templates contiennent un corps markdown avec des placeholders
 * `{{key}}` qui sont résolus au moment de la génération sur base des
 * données du sujet (User consultant interne ou Candidate externe).
 *
 * Le rendu (remplacement) est fait côté serveur puis snapshoté dans
 * Contract.chapters — ainsi le contrat reste stable même si le template
 * ou les données du sujet évoluent après.
 */

export type ContractSubject =
  | { kind: "user"; user: any /* User + payrollEmployee include */ }
  | {
      kind: "candidate";
      candidate: any /* Candidate + payrollEmployee include */;
      /** Dernière simulation de package salarial du candidat (ordre desc).
       *  Source primaire des variables salaire pour un candidat pas encore
       *  recruté (workflow : Candidat → Offre package → Signature → Employé). */
      salaryScenario?: any | null;
    };

/** Une entrée de chapitre snapshotée (structure stockée dans Contract.chapters JSON). */
export type ContractChapterSnapshot = {
  title: string;
  bodyMd: string;
  sortOrder: number;
};

/** Descripteur d'une variable disponible — pour l'aide et l'auto-complétion. */
export type VariableDoc = {
  key: string;
  label: string;
  sample: string;
};

/**
 * Catalogue des variables reconnues. Sert d'aide dans l'éditeur de template
 * (bouton "Insérer variable"). L'ordre est purement cosmétique.
 */
export const VARIABLE_CATALOG: VariableDoc[] = [
  { key: "firstName",       label: "Prénom",                     sample: "Alice" },
  { key: "lastName",        label: "Nom",                        sample: "Martin" },
  { key: "fullName",        label: "Nom complet",                sample: "Alice Martin" },
  { key: "email",           label: "Email",                      sample: "alice.martin@dasolabs.com" },
  { key: "phone",           label: "Téléphone",                  sample: "+32 470 12 34 56" },
  { key: "birthDate",       label: "Date de naissance",          sample: "12/03/1990" },
  { key: "birthPlace",      label: "Lieu de naissance",          sample: "Bruxelles" },
  { key: "nationalNumber",  label: "Numéro registre national",   sample: "90.03.12-123.45" },
  { key: "address",         label: "Adresse",                    sample: "Rue de la Loi 42" },
  { key: "postalCode",      label: "Code postal",                sample: "1000" },
  { key: "city",            label: "Ville",                      sample: "Bruxelles" },
  { key: "country",         label: "Pays",                       sample: "Belgique" },
  { key: "position",        label: "Fonction / séniorité",       sample: "Senior Data Engineer" },
  { key: "joinedAt",        label: "Date d'entrée en service",   sample: "01/09/2026" },
  { key: "startDate",       label: "Date de début du contrat",   sample: "01/09/2026" },
  { key: "endDate",         label: "Date de fin du contrat",     sample: "31/08/2027" },
  { key: "monthlyNetPay",         label: "Salaire net mensuel (€) — payroll",     sample: "3 200,00" },
  { key: "monthlyGrossPay",       label: "Salaire brut mensuel (€)",              sample: "4 500,00" },
  { key: "monthlyWithholdingTax", label: "Précompte pro. mensuel (€) — payroll",  sample: "820,00" },
  { key: "monthlyOnss",           label: "Cotisations ONSS mensuelles (€) — payroll", sample: "580,00" },
  { key: "monthsPerYear",         label: "Mois payés / an (13.92 BE)",            sample: "13,92" },
  { key: "employerChargesPct",    label: "Charges patronales (%)",                sample: "25" },
  { key: "workingDaysPerWeek",    label: "Régime hebdo (jours/sem)",              sample: "5" },
  { key: "carMonthly",            label: "Voiture — coût mensuel (€)",            sample: "650,00" },
  { key: "mealVoucherPerDay",     label: "Chèque-repas / jour employeur (€)",     sample: "6,91" },
  { key: "ecoVouchersAnnual",     label: "Éco-chèques annuel (€)",                sample: "250,00" },
  { key: "groupInsurancePct",     label: "Assurance groupe (%)",                  sample: "3" },
  { key: "hospitalInsuranceMonthly",label: "Hospitalisation mensuelle (€)",       sample: "45,00" },
  { key: "phoneInternetMonthly",  label: "GSM + internet mensuel (€)",            sample: "50,00" },
  { key: "netExpensesMonthly",    label: "Frais représentation nets (€/mois)",    sample: "150,00" },
  { key: "dailyCost",             label: "Coût journalier interne (€)",           sample: "450,00" },
  { key: "dailyRate",             label: "TJM facturé client (€)",                sample: "780,00" },
  { key: "weeklyCapacityH",       label: "Heures/semaine",                        sample: "38" },
  { key: "today",                 label: "Date du jour",                          sample: "24/07/2026" }
];

const FR_DATE = new Intl.DateTimeFormat("fr-BE", {
  day: "2-digit", month: "2-digit", year: "numeric"
});
const FR_NUM = new Intl.NumberFormat("fr-BE", {
  minimumFractionDigits: 2, maximumFractionDigits: 2
});

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return FR_DATE.format(date);
}
function fmtMoney(n: any): string {
  if (n == null) return "—";
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return "—";
  return FR_NUM.format(v);
}

/**
 * Construit le dictionnaire des variables résolues pour un sujet donné.
 * Les champs manquants renvoient "—" pour éviter des placeholders orphelins
 * dans le contrat rendu.
 *
 * `extra` permet de surcharger ou d'ajouter des variables non standard
 * (startDate/endDate spécifiques au contrat, salaire particulier…).
 */
export function resolveSubjectVariables(
  subject: ContractSubject,
  extra: Record<string, string | number | Date | null | undefined> = {}
): Record<string, string> {
  const s: any = subject.kind === "user" ? subject.user : subject.candidate;
  const payroll = s.payrollEmployee ?? null;
  const scenario = subject.kind === "candidate" ? (subject.salaryScenario ?? null) : null;

  // Résolution des variables salaire selon la source disponible :
  //
  //   Consultant interne (User) :
  //     - Déjà employé → PayrollEmployee est la source de vérité.
  //     - Net réel, précompte, ONSS : uniquement dispo côté payroll.
  //
  //   Candidat (Candidate) :
  //     - Pas encore employé → on utilise la dernière simulation de
  //       package (CandidateSalaryScenario) que le user a créée dans
  //       /salary-simulator. Brut + avantages y sont détaillés.
  //     - Le net est un CALCUL complexe (précompte progressif belge) : on
  //       ne l'affiche pas depuis un scénario, seulement depuis payroll.
  //     - Si une PayrollEmployee est déjà pré-configurée pour le candidat
  //       (rare : freelance), elle prime sur le scenario pour cohérence.
  const monthlyGrossPay =
    payroll?.monthlyGrossReference ?? scenario?.grossMonthly ?? null;
  const monthlyNetPay = payroll?.monthlyNetPay ?? null;
  const monthlyWithholdingTax = payroll?.monthlyWithholdingTax ?? null;
  const monthlyOnss = payroll?.monthlyOnss ?? null;
  const monthsPerYear =
    payroll?.monthsPerYear ?? scenario?.monthsPerYear ?? null;
  // Avantages : viennent du scenario si candidat, ne sont pas modélisés
  // côté payroll (payroll ne stocke que les 3 flux ONSS/précompte/net).
  const employerChargesPct = scenario?.employerChargesPct ?? null;
  const workingDaysPerWeek = scenario?.workingDaysPerWeek ?? null;
  const carMonthly = scenario?.carMonthlyTco ?? null;
  const mealVoucherPerDay = scenario?.mealVoucherEmployerPerDay ?? null;
  const ecoVouchersAnnual = scenario?.ecoVouchersAnnual ?? null;
  const groupInsurancePct = scenario?.groupInsurancePct ?? null;
  const hospitalInsuranceMonthly = scenario?.hospitalInsuranceMonthly ?? null;
  const phoneInternetMonthly = scenario?.phoneInternetMonthly ?? null;
  const netExpensesMonthly = scenario?.netExpensesMonthly ?? null;

  const fmtNumFR = (v: any) =>
    v != null && Number.isFinite(Number(v))
      ? String(v).replace(".", ",")
      : "—";

  const vars: Record<string, string> = {
    firstName:       s.firstName ?? "—",
    lastName:        s.lastName ?? "—",
    fullName:        `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "—",
    email:           s.email ?? "—",
    phone:           s.phone ?? "—",
    birthDate:       fmtDate(s.birthDate),
    birthPlace:      s.birthPlace ?? "—",
    nationalNumber:  s.nationalNumber ?? "—",
    address:         s.address ?? "—",
    postalCode:      s.postalCode ?? "—",
    city:            s.city ?? "—",
    country:         s.country ?? "—",
    position:        s.seniority ?? "—",
    joinedAt:        fmtDate(subject.kind === "user" ? s.joinedAt : s.availableFrom),
    startDate:       "—",
    endDate:         "—",
    // Salaires — PayrollEmployee (consultant) > SalaryScenario (candidat).
    monthlyNetPay:          fmtMoney(monthlyNetPay),
    monthlyGrossPay:        fmtMoney(monthlyGrossPay),
    monthlyWithholdingTax:  fmtMoney(monthlyWithholdingTax),
    monthlyOnss:            fmtMoney(monthlyOnss),
    monthsPerYear:          fmtNumFR(monthsPerYear),
    employerChargesPct:     fmtNumFR(employerChargesPct),
    workingDaysPerWeek:     fmtNumFR(workingDaysPerWeek),
    // Avantages (scenario)
    carMonthly:             fmtMoney(carMonthly),
    mealVoucherPerDay:      fmtMoney(mealVoucherPerDay),
    ecoVouchersAnnual:      fmtMoney(ecoVouchersAnnual),
    groupInsurancePct:      fmtNumFR(groupInsurancePct),
    hospitalInsuranceMonthly: fmtMoney(hospitalInsuranceMonthly),
    phoneInternetMonthly:   fmtMoney(phoneInternetMonthly),
    netExpensesMonthly:     fmtMoney(netExpensesMonthly),
    // Métriques Dasolabs
    dailyCost:       fmtMoney(s.dailyCost),
    dailyRate:       fmtMoney(s.dailyRate),
    weeklyCapacityH: s.weeklyCapacityH != null ? String(s.weeklyCapacityH) : "—",
    today:           fmtDate(new Date())
  };
  // Override avec extras (avec formatage auto pour Date + number).
  for (const [k, v] of Object.entries(extra)) {
    if (v == null || v === "") continue;
    if (v instanceof Date) vars[k] = fmtDate(v);
    else if (typeof v === "number") vars[k] = fmtMoney(v);
    else vars[k] = String(v);
  }
  return vars;
}

/**
 * Remplace `{{key}}` par la valeur correspondante dans `vars`. Les clés
 * inconnues sont laissées telles quelles (mais entourées de marqueurs
 * visibles ⟪ ⟫) pour attirer l'attention lors de la relecture.
 */
export function renderMarkdown(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, key) => {
    if (key in vars) return vars[key];
    return `⟪${key} ?⟫`; // marker visible pour aider le relecteur
  });
}

/**
 * Snapshotte les chapitres d'un template : pour chaque chapitre, remplace
 * les variables dans bodyMd et titre et retourne un tableau prêt à
 * enregistrer dans Contract.chapters (JSON).
 */
export function snapshotChapters(
  templateChapters: Array<{ title: string; bodyMd: string; sortOrder: number }>,
  vars: Record<string, string>
): ContractChapterSnapshot[] {
  return templateChapters
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      title: renderMarkdown(c.title, vars),
      bodyMd: renderMarkdown(c.bodyMd, vars),
      sortOrder: c.sortOrder
    }));
}
