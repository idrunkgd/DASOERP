// Règles belges de déduction TVA et de ventilation dans la grille déclarative.
//
// Sources :
// - https://finances.belgium.be/fr/entreprises/tva/declaration/declaration-periodique
// - Code TVA Belge, art. 45 §2 (limitation 50 % véhicules)
// - Art. 45 §3 (exclusion totale : tabac, boissons spiritueuses, frais hôtel,
//   frais restaurant, frais réception, cadeaux > 50 € HT)
//
// La déduction par défaut est :
//   - voitures (achat / leasing / fuel / entretien / assurance) → 50 %
//   - restaurant, hôtel, représentation, gros cadeaux → 0 %
//   - tout le reste → 100 %
//
// L'utilisateur peut surcharger via vatDeductibleRateOverride sur la ligne
// (ex. voiture utilisée 100 % professionnellement avec carnet de bord justifié).
//
// La ventilation case 81/82/83 :
//   - 81 = biens et services (marchandises ordinaires, fournitures de bureau)
//   - 82 = services divers (sous-traitance, software, frais représentation,
//          télécom, formation, énergie, professionnels…)
//   - 83 = biens d'investissement durables > 250 € HT (voiture, gros hardware)

export type VatBox = 81 | 82 | 83;

export interface BelgianVatRule {
  /// Taux de déduction par défaut (0.0 à 1.0).
  deductibleRate: number;
  /// Case de la grille TVA dans laquelle le HTVA est imputé.
  vatBox: VatBox;
  /// Libellé humain pour l'UI.
  label: string;
}

// ─── Catégories SupplierInvoice (factures fournisseurs) ────────────────────
export const SUPPLIER_INVOICE_VAT_RULES: Record<string, BelgianVatRule> = {
  CAR_PURCHASE:          { deductibleRate: 0.50, vatBox: 83, label: "Achat voiture" },
  CAR_LEASE:             { deductibleRate: 0.50, vatBox: 82, label: "Leasing voiture" },
  CAR_FUEL:              { deductibleRate: 0.50, vatBox: 82, label: "Carburant voiture" },
  CAR_MAINTENANCE:       { deductibleRate: 0.50, vatBox: 82, label: "Entretien voiture" },
  CAR_INSURANCE:         { deductibleRate: 0.50, vatBox: 82, label: "Assurance voiture" },
  RESTAURANT:            { deductibleRate: 0.00, vatBox: 82, label: "Restaurant" },
  HOTEL:                 { deductibleRate: 0.00, vatBox: 82, label: "Hôtel" },
  OFFICE_RENT:           { deductibleRate: 1.00, vatBox: 82, label: "Loyer bureau" },
  UTILITIES:             { deductibleRate: 1.00, vatBox: 82, label: "Énergie / eau" },
  SOFTWARE_SAAS:         { deductibleRate: 1.00, vatBox: 82, label: "Logiciel / SaaS" },
  SUBCONTRACTING:        { deductibleRate: 1.00, vatBox: 82, label: "Sous-traitance" },
  OFFICE_SUPPLIES:       { deductibleRate: 1.00, vatBox: 81, label: "Fournitures bureau" },
  HARDWARE_SMALL:        { deductibleRate: 1.00, vatBox: 81, label: "Petit matériel < 250 €" },
  HARDWARE_INVESTMENT:   { deductibleRate: 1.00, vatBox: 83, label: "Hardware d'investissement" },
  PROFESSIONAL_SERVICES: { deductibleRate: 1.00, vatBox: 82, label: "Honoraires (avocat, comptable…)" },
  TRAINING:              { deductibleRate: 1.00, vatBox: 82, label: "Formation" },
  TELECOM:               { deductibleRate: 1.00, vatBox: 82, label: "Téléphone / internet" },
  GIFT_LOW:              { deductibleRate: 1.00, vatBox: 82, label: "Cadeau ≤ 50 € HT" },
  GIFT_HIGH:             { deductibleRate: 0.00, vatBox: 82, label: "Cadeau > 50 € HT" },
  REPRESENTATION:        { deductibleRate: 0.00, vatBox: 82, label: "Frais de représentation" },
  OTHER:                 { deductibleRate: 1.00, vatBox: 82, label: "Autre" }
};

// ─── Catégories ExpenseReport (notes de frais consultants) ─────────────────
//
// Les catégories existaient avant le fix TVA, on fait du best-effort :
//   TRANSPORT (carburant, train, taxi) → 50 % par défaut (voiture dominante).
//     Si c'était un train, l'utilisateur peut override à 100 %.
//   MEAL → 0 % (règle restaurant)
//   ACCOMMODATION (hôtel) → 0 %
//   SUPPLIES → 100 % case 81
//   SOFTWARE → 100 % case 82
//   TRAINING → 100 % case 82
//   OTHER → 100 % case 82
export const EXPENSE_REPORT_VAT_RULES: Record<string, BelgianVatRule> = {
  TRANSPORT:     { deductibleRate: 0.50, vatBox: 82, label: "Transport (voiture / train / taxi)" },
  MEAL:          { deductibleRate: 0.00, vatBox: 82, label: "Repas" },
  ACCOMMODATION: { deductibleRate: 0.00, vatBox: 82, label: "Hébergement" },
  SUPPLIES:      { deductibleRate: 1.00, vatBox: 81, label: "Fournitures" },
  SOFTWARE:      { deductibleRate: 1.00, vatBox: 82, label: "Logiciel" },
  TRAINING:      { deductibleRate: 1.00, vatBox: 82, label: "Formation" },
  OTHER:         { deductibleRate: 1.00, vatBox: 82, label: "Autre" }
};

// ─── Catégories Purchase (achats projet) ───────────────────────────────────
export const PURCHASE_VAT_RULES: Record<string, BelgianVatRule> = {
  HARDWARE:       { deductibleRate: 1.00, vatBox: 83, label: "Hardware" },
  LICENSE:        { deductibleRate: 1.00, vatBox: 82, label: "Licence logicielle" },
  SUBCONTRACTING: { deductibleRate: 1.00, vatBox: 82, label: "Sous-traitance" },
  TRAVEL:         { deductibleRate: 0.50, vatBox: 82, label: "Déplacement" },
  TRAINING:       { deductibleRate: 1.00, vatBox: 82, label: "Formation" },
  OTHER:          { deductibleRate: 1.00, vatBox: 82, label: "Autre" }
};

/**
 * Renvoie le taux effectif de déduction pour une ligne d'achat, en tenant
 * compte d'un éventuel override manuel. Si override est défini (même à 0),
 * il prime sur la règle de catégorie.
 */
export function effectiveDeductibleRate(
  rules: Record<string, BelgianVatRule>,
  category: string | null | undefined,
  override: number | null | undefined
): number {
  if (override !== null && override !== undefined && Number.isFinite(override)) {
    return Math.max(0, Math.min(1, Number(override)));
  }
  const rule = (category && rules[category]) || rules.OTHER;
  return rule.deductibleRate;
}

export function vatBoxForCategory(
  rules: Record<string, BelgianVatRule>,
  category: string | null | undefined
): VatBox {
  const rule = (category && rules[category]) || rules.OTHER;
  return rule.vatBox;
}
