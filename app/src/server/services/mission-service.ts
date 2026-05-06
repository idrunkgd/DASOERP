import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { nextMissionExecReference } from "@/lib/references";
import { addDays } from "date-fns";

/**
 * Crée une Mission (T&M) à partir d'une MissionApplication SELECTED.
 *
 * Distinction nette avec les Projets :
 *   - Une Mission ≠ Project. Pas de création de Project ni d'Offer.
 *   - Si le candidat est déjà recruté en interne (convertedToUserId), on
 *     rattache directement la Mission à son User (consultantId). Sinon on
 *     laisse consultantId à null (cas freelance externe sous-traité).
 */
/**
 * Contractualisation atomique : application → SELECTED + autres → REJECTED + demande
 * → CONTRACTED + Mission créée avec les dates et tarifs fournis explicitement par
 * l'utilisateur (modale). Tout dans une transaction Prisma.
 */
export async function contractApplication(opts: {
  actorId: string;
  applicationId: string;
  startDate: Date;
  endDate: Date;
  dailyRate: number;
  dailyCost: number;
  workLocation?: string | null;
  estimatedDays?: number | null;
}) {
  const { actorId, applicationId, startDate, endDate, dailyRate, dailyCost } = opts;
  if (endDate <= startDate) throw new Error("La date de fin doit être après la date de début.");
  if (dailyRate <= 0) throw new Error("Tarif journalier facturé requis.");
  if (dailyCost < 0) throw new Error("Coût journalier invalide.");

  const app = await prisma.missionApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { missionRequest: true, candidate: true, consultant: true, mission: true }
  });
  if (app.mission) return app.mission; // idempotent

  // Détermine le sujet et le consultantId à mettre sur la Mission
  let consultantId: string | null;
  let displayName: string;
  if (app.consultantId && app.consultant) {
    consultantId = app.consultantId;
    displayName = `${app.consultant.firstName} ${app.consultant.lastName}`;
  } else if (app.candidateId && app.candidate) {
    consultantId = app.candidate.convertedToUserId ?? null;
    displayName = `${app.candidate.firstName} ${app.candidate.lastName}`;
  } else {
    throw new Error("Application sans candidat ni consultant — incohérence.");
  }

  const reference = await nextMissionExecReference();

  return prisma.$transaction(async (tx) => {
    // 1. Marque l'application SELECTED
    await tx.missionApplication.update({
      where: { id: applicationId },
      data: { status: "SELECTED", decisionAt: new Date(), proposedDailyRate: dailyRate, dailyCost }
    });
    // 2. Refuse les autres présentations en compétition
    await tx.missionApplication.updateMany({
      where: { missionRequestId: app.missionRequestId, id: { not: applicationId }, status: { in: ["PRESENTED","INTERVIEW_SCHEDULED","INTERVIEWED","SHORTLISTED"] } },
      data: { status: "REJECTED", rejectedReason: "Autre profil sélectionné", decisionAt: new Date() }
    });
    // 3. Demande passe en CONTRACTED
    await tx.missionRequest.update({
      where: { id: app.missionRequestId },
      data: { status: "CONTRACTED", closedAt: new Date() }
    });
    // 4. Si Candidate externe : statut ENGAGED
    if (app.candidateId) {
      await tx.candidate.update({ where: { id: app.candidateId }, data: { status: "ENGAGED" } });
    }
    // 5. Création de la Mission (recopie l'intermédiaire depuis la demande)
    const mission = await tx.mission.create({
      data: {
        reference,
        title: app.missionRequest.title,
        missionRequestId: app.missionRequestId,
        applicationId: app.id,
        consultantId,
        companyId: app.missionRequest.companyId,
        intermediaryCompanyId: app.missionRequest.intermediaryCompanyId,
        intermediaryContactId: app.missionRequest.intermediaryContactId,
        startDate, endDate,
        estimatedDays: opts.estimatedDays ?? app.missionRequest.estimatedDays ?? null,
        dailyRate, dailyCost,
        workLocation: opts.workLocation ?? app.missionRequest.workLocation ?? null,
        status: startDate <= new Date() ? "ACTIVE" : "PLANNED",
        billingFrequency: "MONTHLY"
      }
    });
    return mission;
  }).then(async (mission) => {
    await logActivity({
      actorId, action: "STATUS_CHANGE", entityType: "MissionApplication", entityId: applicationId,
      message: `Profil ${displayName} sélectionné — Mission ${reference} créée (${app.missionRequest.reference})`
    });
    await logActivity({
      actorId, action: "CREATE", entityType: "Mission", entityId: mission.id,
      message: `Mission ${reference} contractualisée pour ${displayName} chez ${app.missionRequest.companyId}`,
      after: mission
    });
    return mission;
  });
}

export async function convertApplicationToMission(opts: {
  actorId: string;
  applicationId: string;
}) {
  const { actorId, applicationId } = opts;
  const app = await prisma.missionApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { missionRequest: true, candidate: true, consultant: true, mission: true }
  });
  if (app.mission) return app.mission; // idempotent
  if (app.status !== "SELECTED") throw new Error("L'application doit être SELECTED avant conversion.");

  const m = app.missionRequest;
  // Détermine le consultant assigné et le coût snapshot selon la source
  let consultantId: string | null;
  let dailyCost: number;
  let displayName: string;
  if (app.consultantId && app.consultant) {
    // Consultant interne directement sélectionné
    consultantId = app.consultantId;
    dailyCost = Number(app.dailyCost ?? app.consultant.dailyCost ?? 0);
    displayName = `${app.consultant.firstName} ${app.consultant.lastName}`;
  } else if (app.candidateId && app.candidate) {
    // Candidat externe — s'il a déjà été recruté, on récupère son User
    consultantId = app.candidate.convertedToUserId ?? null;
    dailyCost = Number(app.dailyCost ?? app.candidate.dailyCost ?? 0);
    displayName = `${app.candidate.firstName} ${app.candidate.lastName}`;
  } else {
    throw new Error("Application sans candidat ni consultant — incohérence.");
  }

  const dailyRate = Number(app.proposedDailyRate ?? m.targetDailyRate ?? 0);
  if (dailyRate <= 0) throw new Error("Tarif journalier facturé manquant.");

  const startDate = m.startDate ?? new Date();
  const endDate = m.endDate ?? addDays(startDate, (m.estimatedDays ?? 220));
  const reference = await nextMissionExecReference();

  const mission = await prisma.mission.create({
    data: {
      reference,
      title: m.title,
      missionRequestId: m.id,
      applicationId: app.id,
      consultantId,
      companyId: m.companyId,
      intermediaryCompanyId: m.intermediaryCompanyId,
      intermediaryContactId: m.intermediaryContactId,
      startDate, endDate,
      estimatedDays: m.estimatedDays ?? null,
      dailyRate, dailyCost,
      workLocation: m.workLocation,
      status: startDate <= new Date() ? "ACTIVE" : "PLANNED",
      billingFrequency: "MONTHLY"
    }
  });
  await logActivity({
    actorId, action: "CREATE", entityType: "Mission", entityId: mission.id,
    message: `Mission ${reference} contractualisée (demande ${m.reference}, ${displayName})`,
    after: mission
  });
  return mission;
}

/**
 * Recalcule les métriques de la mission depuis les timesheets validés.
 * - actualDays = somme heures validées / 8
 * - peut être étendu si on dépasse endDate
 */
export async function recomputeMission(missionId: string) {
  const ts = await prisma.timesheetEntry.aggregate({
    where: { missionId, status: "APPROVED" },
    _sum: { hours: true }
  });
  const totalHours = Number(ts._sum.hours ?? 0);
  return prisma.mission.findUnique({
    where: { id: missionId },
    include: { milestones: true }
  }).then(async (mission) => {
    if (!mission) return null;
    // On stocke ces métriques dans actualEndDate / etc. selon besoin futur.
    // Pour l'instant on retourne juste le calcul agrégé.
    return { mission, totalHours, totalDays: totalHours / 8 };
  });
}
