import type { OfferStatus } from "@prisma/client";

/**
 * Une offre est modifiable seulement en statut DRAFT.
 * - SENT / NEGOTIATION : lecture seule (l'utilisateur doit créer une nouvelle version pour modifier)
 * - WON / LOST / CANCELLED : figé définitivement (aucune modification possible)
 */
export function isOfferEditable(status: OfferStatus): boolean {
  return status === "DRAFT";
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
