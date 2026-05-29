// Calcul des dates d'encaissement selon les délais de paiement.
//
// Standard belge : "30 jours fin de mois" = +N jours après la date facture,
// puis on snape sur le dernier jour de ce mois résultant.
// Exemples avec 30 jours :
//   - Facture 15/03 → +30j = 14/04 → fin avril = 30/04
//   - Facture 31/03 → +30j = 30/04 → fin avril = 30/04
//   - Facture 05/04 → +30j = 05/05 → fin mai   = 31/05

/**
 * Renvoie le dernier jour du mois pour une date donnée (UTC).
 * Utile pour les calculs de fin de mois indépendamment du fuseau horaire.
 */
export function lastDayOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

/**
 * Ajoute N jours à une date (UTC).
 */
export function addDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

/**
 * Calcule la date d'encaissement attendue selon les termes "X jours fin de mois".
 * @param invoiceDate Date d'émission de la facture
 * @param paymentTermsDays Nombre de jours avant snap à fin de mois (default 30)
 */
export function expectedPaymentDate(invoiceDate: Date, paymentTermsDays = 30): Date {
  return lastDayOfMonth(addDays(invoiceDate, paymentTermsDays));
}
