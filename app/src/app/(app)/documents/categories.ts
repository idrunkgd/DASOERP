/**
 * Catégories de documents utilisées dans /documents pour le rangement.
 * La valeur stockée en DB est l'une des clés ci-dessous (ou null pour "non classé").
 * Les libellés et couleurs sont consommés côté UI uniquement.
 */
export type DocCategory =
  | "CONTRACT" | "RH" | "PROJECT" | "CLIENT" | "OFFER"
  | "POLICY" | "FINANCE" | "TECH" | "OTHER";

export const DOC_CATEGORIES: { value: DocCategory; label: string; tone: string }[] = [
  { value: "CONTRACT", label: "Contrats",            tone: "bg-indigo-100 text-indigo-800" },
  { value: "RH",       label: "RH",                  tone: "bg-rose-100 text-rose-800" },
  { value: "PROJECT",  label: "Projets",             tone: "bg-amber-100 text-amber-800" },
  { value: "CLIENT",   label: "Clients",             tone: "bg-blue-100 text-blue-800" },
  { value: "OFFER",    label: "Offres & devis",      tone: "bg-violet-100 text-violet-800" },
  { value: "POLICY",   label: "Chartes & procédures", tone: "bg-teal-100 text-teal-800" },
  { value: "FINANCE",  label: "Finance",             tone: "bg-emerald-100 text-emerald-800" },
  { value: "TECH",     label: "Technique",           tone: "bg-cyan-100 text-cyan-800" },
  { value: "OTHER",    label: "Autre",               tone: "bg-midnight-100 text-midnight-700" }
];

export const DOC_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  DOC_CATEGORIES.map((c) => [c.value, c.label])
);
export const DOC_CATEGORY_TONES: Record<string, string> = Object.fromEntries(
  DOC_CATEGORIES.map((c) => [c.value, c.tone])
);
