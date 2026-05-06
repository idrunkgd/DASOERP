import { prisma } from "./db";
import { buildReference } from "./calc";

/**
 * Génère la prochaine référence offre/projet de l'année.
 * Implémentation simple : compte les enregistrements de l'année et incrémente.
 * Pour un volume élevé, prévoir une table de séquences dédiée.
 */
export async function nextOfferReference(year = new Date().getFullYear()): Promise<string> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const count = await prisma.offer.count({
    // Compte uniquement les offres "racine" (sans parent) pour ne pas être faussé par les compléments
    where: { createdAt: { gte: start, lt: end }, parentOfferId: null }
  });
  return buildReference("OFF", year, count + 1);
}

/** Référence du complément : <ref parent>-C<N> où N = nb compléments existants + 1 */
export async function nextComplementReference(parentId: string): Promise<string> {
  const parent = await prisma.offer.findUniqueOrThrow({ where: { id: parentId } });
  const count = await prisma.offer.count({ where: { parentOfferId: parentId } });
  return `${parent.reference}-C${count + 1}`;
}

/** Référence d'une demande de mission : DEM-AAAA-NNNN */
export async function nextMissionReference(year = new Date().getFullYear()): Promise<string> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const count = await prisma.missionRequest.count({ where: { createdAt: { gte: start, lt: end } } });
  return `DEM-${year}-${String(count + 1).padStart(4, "0")}`;
}

/** Référence d'une mission exécutée (consultant placé chez client) : MIS-AAAA-NNNN */
export async function nextMissionExecReference(year = new Date().getFullYear()): Promise<string> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const count = await prisma.mission.count({ where: { createdAt: { gte: start, lt: end } } });
  return `MIS-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function nextProjectReference(year = new Date().getFullYear()): Promise<string> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const count = await prisma.project.count({
    where: { createdAt: { gte: start, lt: end } }
  });
  return buildReference("PRJ", year, count + 1);
}
