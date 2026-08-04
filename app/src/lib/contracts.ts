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
  | { kind: "user"; user: any /* User */ }
  | { kind: "candidate"; candidate: any /* Candidate */ };

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
  { key: "monthlyNetPay",       label: "Salaire net mensuel (€)",       sample: "3 200,00" },
  { key: "monthlyGrossPay",     label: "Salaire brut mensuel réf. (€)", sample: "4 500,00" },
  { key: "monthlyWithholdingTax",label: "Précompte pro. mensuel (€)",    sample: "820,00" },
  { key: "monthlyOnss",         label: "Cotisations ONSS mensuelles (€)", sample: "580,00" },
  { key: "monthsPerYear",       label: "Mois payés / an (13.92 BE)",    sample: "13,92" },
  { key: "dailyCost",           label: "Coût journalier interne (€)",   sample: "450,00" },
  { key: "dailyRate",           label: "TJM facturé client (€)",        sample: "780,00" },
  { key: "weeklyCapacityH",     label: "Heures/semaine",                sample: "38" },
  { key: "today",               label: "Date du jour",                  sample: "24/07/2026" }
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
    // Salaires : source unique = PayrollEmployee (config paie officielle
    // Dasolabs, éditable depuis /employees). Champ brut = monthlyGrossReference.
    // Si aucune paie configurée pour ce sujet, la variable retourne "—".
    monthlyNetPay:          fmtMoney(s.payrollEmployee?.monthlyNetPay),
    monthlyGrossPay:        fmtMoney(s.payrollEmployee?.monthlyGrossReference),
    monthlyWithholdingTax:  fmtMoney(s.payrollEmployee?.monthlyWithholdingTax),
    monthlyOnss:            fmtMoney(s.payrollEmployee?.monthlyOnss),
    monthsPerYear:          s.payrollEmployee?.monthsPerYear != null
                              ? String(s.payrollEmployee.monthsPerYear).replace(".", ",")
                              : "—",
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
