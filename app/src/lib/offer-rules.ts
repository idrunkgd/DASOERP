import type { OfferStatus } from "@prisma/client";

/**
 * Substance commerciale (lignes, tranches, options) modifiable seulement en DRAFT.
 * - SENT / NEGOTIATION : verrouillé (pour modifier la substance il faut une nouvelle version)
 * - WON / LOST / CANCELLED : figé définitivement
 */
export function isOfferEditable(status: OfferStatus): boolean {
  return status === "DRAFT";
}

/**
 * Header (titre, statut, probabilité, dates, description, comments, owner, client)
 * éditable tant que l'offre n'est pas dans un statut terminal.
 * Permet aux commerciaux d'ajuster les informations même après envoi sans devoir
 * créer une V2 pour un simple changement d'owner ou de date.
 */
export function isOfferHeaderEditable(status: OfferStatus): boolean {
  return !isOfferFinal(status);
}

/**
 * Une offre peut être "réouverte" via une nouvelle version uniquement si elle a été
 * envoyée mais pas encore conclue (WON/LOST) ni annulée.
 */
export function canCreateNewVersion(status: OfferStatus): boolean {
  return status === "SENT" || status === "NEGOTIATION";
}

/** Statuts terminaux : aucune action de modification, ni nouvelle version. */
export function isOfferFinal(status: OfferStatus): boolean {
  return status === "WON" || status === "LOST" || status === "CANCELLED";
}

export function offerLockMessage(status: OfferStatus): string {
  if (status === "DRAFT") return "";
  if (status === "WON")        return "Cette offre est gagnée et figée définitivement. Toute modification est impossible.";
  if (status === "LOST")       return "Cette offre est perdue et figée. Pour repartir, dupliquez-la.";
  if (status === "CANCELLED")  return "Cette offre est annulée et figée.";
  return "Cette offre est verrouillée car elle a déjà été envoyée. Créez une nouvelle version pour la modifier.";
}

export class OfferLockedError extends Error {
  constructor(status: OfferStatus) {
    super(offerLockMessage(status) || "Offre verrouillée.");
    this.name = "OfferLockedError";
  }
}
