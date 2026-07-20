/**
 * Table des taux TVA par défaut pour les catégories de notes de frais
 * (droit belge simplifié — l'utilisateur ne devrait pas avoir à choisir
 * un taux lui-même, le back le déduit de la catégorie).
 *
 * Sources :
 *   - Repas au restaurant / traiteur : 12%
 *   - Hébergement : 6%
 *   - Transport public : 6% ; taxi/parking : 21% (moyenne pratique 21%)
 *   - Autres biens & services : 21%
 *
 * L'utilisateur reste libre d'overrider si son ticket réel a un autre taux.
 */
export const DEFAULT_VAT_RATE_BY_CATEGORY: Record<string, number> = {
  MEAL:          12,
  ACCOMMODATION:  6,
  TRANSPORT:     21,
  SUPPLIES:      21,
  SOFTWARE:      21,
  TRAINING:      21,
  OTHER:         21
};

export function defaultVatRate(category: string): number {
  return DEFAULT_VAT_RATE_BY_CATEGORY[category] ?? 21;
}

/**
 * À partir d'un montant TTC et d'un taux de TVA, dérive HT et montant TVA.
 * Arrondi à 2 décimales (cents) — les 3 doivent obéir à HT + VAT ≈ TTC.
 */
export function deriveHtFromTtc(
  ttc: number, vatRate: number
): { amountHt: number; vatAmount: number } {
  const rate = Number(vatRate);
  const ttcNum = Number(ttc);
  if (!Number.isFinite(ttcNum) || ttcNum < 0) {
    return { amountHt: 0, vatAmount: 0 };
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    return { amountHt: ttcNum, vatAmount: 0 };
  }
  const ht = ttcNum / (1 + rate / 100);
  const htRounded = Math.round(ht * 100) / 100;
  // On calcule la TVA comme TTC - HT pour que l'égalité soit parfaite après
  // arrondi (évite les 0.01 d'écart entre HT + VAT et TTC).
  const vat = Math.round((ttcNum - htRounded) * 100) / 100;
  return { amountHt: htRounded, vatAmount: vat };
}
