"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextOfferReference } from "@/lib/references";
import type { ApplicationStatus } from "@prisma/client";

const PresentSchema = z.object({
  // "C:<candidateId>" ou "U:<userId>"
  subject: z.string().min(1),
  proposedDailyRate: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable()
});

function parseSubject(s: string) {
  const [kind, id] = s.split(":");
  if (kind === "C" && id) return { kind: "candidate" as const, id };
  if (kind === "U" && id) return { kind: "consultant" as const, id };
  throw new Error("Sujet invalide (candidat externe ou consultant interne attendu)");
}

/**
 * Présente un candidat externe OU un consultant interne sur une demande de mission.
 * Une seule action unifiée — le sujet est encodé dans le formulaire ("C:<id>" / "U:<id>").
 */
export async function presentCandidate(missionId: string, formData: FormData) {
  const session = await requirePermission("consulting.write");
  const data = PresentSchema.parse(Object.fromEntries(formData));
  const subject = parseSubject(data.subject);
  const m = await prisma.missionRequest.findUniqueOrThrow({ where: { id: missionId } });

  let createData: any = {
    missionRequestId: missionId,
    proposedDailyRate: data.proposedDailyRate ?? null,
    notes: data.notes,
    status: "PRESENTED"
  };
  let displayName: string;

  if (subject.kind === "candidate") {
    const candidate = await prisma.candidate.findUniqueOrThrow({ where: { id: subject.id } });
    if (candidate.convertedToUserId) {
      throw new Error("Ce candidat est désormais un consultant interne — présentez-le via l'onglet Consultant.");
    }
    createData.candidateId = candidate.id;
    createData.dailyCost = candidate.dailyCost;
    displayName = `${candidate.firstName} ${candidate.lastName}`;
  } else {
    const consultant = await prisma.user.findUniqueOrThrow({ where: { id: subject.id } });
    if (!consultant.active) throw new Error("Ce consultant n'est plus actif chez Dasolabs.");
    createData.consultantId = consultant.id;
    createData.dailyCost = consultant.dailyCost;
    displayName = `${consultant.firstName} ${consultant.lastName} (interne)`;
  }

  const created = await prisma.missionApplication.create({ data: createData });
  if (["NEW","QUALIFYING"].includes(m.status)) {
    await prisma.missionRequest.update({ where: { id: missionId }, data: { status: "PRESENTING" } });
  }
  await logActivity({
    actorId: session.user.id, action: "CREATE", entityType: "MissionApplication", entityId: created.id,
    message: `${displayName} présenté(e) sur ${m.reference}`,
    after: created
  });
  revalidatePath(`/mission-requests/${missionId}`);
}

export async function setApplicationStatus(applicationId: string, newStatus: ApplicationStatus, rejectedReason?: string | null) {
  const session = await requirePermission("consulting.write");
  const before = await prisma.missionApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { candidate: true, consultant: true, missionRequest: true, proposal: true, mission: true }
  });
  // SELECTED :
  //  - Si la présentation a déjà une proposition (offre PDF envoyée), on peut
  //    passer directement à SELECTED : la Mission est créée automatiquement
  //    depuis les termes de la proposition (dates, TJM). C'est le flow
  //    demandé par le PO : "quand on passe en accepté, on crée la mission".
  //  - Sinon on garde l'ancien comportement : forcer la modale de
  //    contractualisation manuelle (bouton "Contracter & créer la mission").
  if (newStatus === "SELECTED") {
    if (before.mission) {
      throw new Error("Cette présentation a déjà une mission contractualisée.");
    }
    if (before.proposal) {
      // Le service convertApplicationToMission utilise les dates + TJM de
      // la proposition (via app.proposal) — pas besoin de re-passer les
      // overrides ici. On marque l'application SELECTED d'abord, puis on
      // crée la Mission. On marque aussi la date de décision sur la
      // proposition (mais plus de field status : depuis la refonte du 2
      // juillet, tout l'état vit sur ApplicationStatus).
      await prisma.$transaction([
        prisma.missionApplication.update({
          where: { id: applicationId },
          data: {
            status: "SELECTED", decisionAt: new Date(),
            // Snapshot du TJM sur l'application pour cohérence historique
            proposedDailyRate: before.proposal.dailyRate
          }
        }),
        prisma.missionProposal.update({
          where: { id: before.proposal.id },
          data: { decidedAt: new Date() }
        })
      ]);
      const { convertApplicationToMission } = await import("@/server/services/mission-service");
      const mission = await convertApplicationToMission({
        actorId: session.user.id,
        applicationId
      });
      await logActivity({
        actorId: session.user.id, action: "STATUS_CHANGE", entityType: "MissionApplication", entityId: applicationId,
        message: `${before.candidate ? `${before.candidate.firstName} ${before.candidate.lastName}` : before.consultant ? `${before.consultant.firstName} ${before.consultant.lastName} (interne)` : "?"} → OFFRE ACCEPTÉE, Mission ${mission.reference} créée`
      });
      revalidatePath(`/mission-requests/${before.missionRequestId}`);
      revalidatePath(`/missions/${mission.id}`);
      return;
    }
    throw new Error(
      "Pour sélectionner ce profil, génère d'abord une proposition PDF (dates, TJM) — le client peut ensuite l'accepter et la mission sera créée automatiquement."
    );
  }
  const subjectName = before.candidate
    ? `${before.candidate.firstName} ${before.candidate.lastName}`
    : before.consultant
    ? `${before.consultant.firstName} ${before.consultant.lastName} (interne)`
    : "?";
  const data: any = { status: newStatus };
  if (["REJECTED","WITHDRAWN"].includes(newStatus)) data.decisionAt = new Date();
  if (newStatus === "REJECTED" && rejectedReason) data.rejectedReason = rejectedReason;
  const after = await prisma.missionApplication.update({ where: { id: applicationId }, data });
  await logActivity({
    actorId: session.user.id, action: "STATUS_CHANGE", entityType: "MissionApplication", entityId: applicationId,
    message: `${subjectName} sur ${before.missionRequest.reference} : ${before.status} → ${newStatus}`,
    before, after
  });
  revalidatePath(`/mission-requests/${before.missionRequestId}`);
}

export async function deleteApplication(applicationId: string) {
  const session = await requirePermission("consulting.write");
  const before = await prisma.missionApplication.findUniqueOrThrow({ where: { id: applicationId } });
  await prisma.missionApplication.delete({ where: { id: applicationId } });
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "MissionApplication", entityId: applicationId, message: "Présentation supprimée", before });
  revalidatePath(`/mission-requests/${before.missionRequestId}`);
}

// ---------- Entretiens ----------

const InterviewSchema = z.object({
  scheduledAt: z.string().min(1).transform(v => new Date(v)),
  kind: z.enum(["PHONE","VIDEO","ON_SITE","TECHNICAL","HR"]).default("VIDEO"),
  interviewers: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  feedback: z.string().optional().nullable(),
  outcome: z.enum(["PENDING","PASSED","FAILED","CANCELLED"]).default("PENDING")
});

export async function addInterview(applicationId: string, formData: FormData) {
  const session = await requirePermission("consulting.write");
  const data = InterviewSchema.parse(Object.fromEntries(formData));
  const created = await prisma.interview.create({ data: { ...data, applicationId } });
  // Auto-bump du statut application si pertinent
  const app = await prisma.missionApplication.findUniqueOrThrow({ where: { id: applicationId } });
  if (app.status === "PRESENTED") {
    await prisma.missionApplication.update({ where: { id: applicationId }, data: { status: "INTERVIEW_SCHEDULED" } });
  }
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "Interview", entityId: created.id, message: `Entretien ${data.kind} planifié`, after: created });
  revalidatePath(`/mission-requests/${app.missionRequestId}`);
}

export async function updateInterview(id: string, formData: FormData) {
  const session = await requirePermission("consulting.write");
  const before = await prisma.interview.findUniqueOrThrow({ where: { id }, include: { application: true } });
  const data = InterviewSchema.parse(Object.fromEntries(formData));
  const after = await prisma.interview.update({ where: { id }, data });
  // Si outcome PASSED → application passe en INTERVIEWED (au minimum)
  if (data.outcome === "PASSED" && before.application.status === "INTERVIEW_SCHEDULED") {
    await prisma.missionApplication.update({ where: { id: before.applicationId }, data: { status: "INTERVIEWED" } });
  }
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "Interview", entityId: id, message: "Entretien mis à jour", before, after });
  revalidatePath(`/mission-requests/${before.application.missionRequestId}`);
}

export async function deleteInterview(id: string) {
  const session = await requirePermission("consulting.write");
  const before = await prisma.interview.findUniqueOrThrow({ where: { id }, include: { application: true } });
  await prisma.interview.delete({ where: { id } });
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "Interview", entityId: id, message: "Entretien supprimé", before });
  if (before.application?.missionRequestId) revalidatePath(`/mission-requests/${before.application.missionRequestId}`);
  if (before.candidateId) revalidatePath(`/candidates/${before.candidateId}`);
  revalidatePath("/calendar");
}

// ---------- Sélection + contractualisation atomique ----------

const ContractSchema = z.object({
  startDate: z.string().min(1).transform(v => new Date(v)),
  endDate:   z.string().min(1).transform(v => new Date(v)),
  dailyRate: z.coerce.number().positive(),
  dailyCost: z.coerce.number().nonnegative(),
  estimatedDays: z.coerce.number().int().nonnegative().optional().nullable(),
  workLocation: z.string().optional().nullable()
});

export async function selectAndContractApplication(applicationId: string, formData: FormData) {
  const session = await requirePermission("consulting.write");
  const data = ContractSchema.parse(Object.fromEntries(formData));
  const { contractApplication } = await import("@/server/services/mission-service");
  const mission = await contractApplication({ actorId: session.user.id, applicationId, ...data });
  const app = await prisma.missionApplication.findUniqueOrThrow({ where: { id: applicationId }, select: { missionRequestId: true } });
  revalidatePath(`/mission-requests/${app.missionRequestId}`);
  revalidatePath("/missions");
  redirect(`/missions/${mission.id}`);
}

// ---------- Entretien d'embauche direct (sans présentation client) ----------

const HiringInterviewSchema = z.object({
  scheduledAt: z.string().min(1).transform(v => new Date(v)),
  kind: z.enum(["PHONE","VIDEO","ON_SITE","TECHNICAL","HR"]).default("HR"),
  interviewers: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  feedback: z.string().optional().nullable(),
  outcome: z.enum(["PENDING","PASSED","FAILED","CANCELLED"]).default("PENDING")
});

/** Planifie un entretien d'embauche Dasolabs directement sur un candidat (pas d'application). */
export async function addCandidateInterview(candidateId: string, formData: FormData) {
  const session = await requirePermission("consulting.write");
  const data = HiringInterviewSchema.parse(Object.fromEntries(formData));
  const cand = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } });
  const created = await prisma.interview.create({ data: { ...data, candidateId } });
  await logActivity({
    actorId: session.user.id, action: "CREATE", entityType: "Interview", entityId: created.id,
    message: `Entretien d'embauche ${data.kind} planifié pour ${cand.firstName} ${cand.lastName}`,
    after: created
  });
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/calendar");
}

export async function updateCandidateInterview(id: string, formData: FormData) {
  const session = await requirePermission("consulting.write");
  const before = await prisma.interview.findUniqueOrThrow({ where: { id } });
  const data = HiringInterviewSchema.parse(Object.fromEntries(formData));
  const after = await prisma.interview.update({ where: { id }, data });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "Interview", entityId: id,
    message: "Entretien d'embauche mis à jour", before, after
  });
  if (before.candidateId) revalidatePath(`/candidates/${before.candidateId}`);
  revalidatePath("/calendar");
}

/**
 * Convertit une application SELECTED en Mission contractualisée (entité distincte
 * d'un Project forfait). Le flux ne crée plus d'Offer/Project parasites — la
 * Mission elle-même porte les conditions contractuelles, le tarif, les dates,
 * et reçoit les saisies timesheet/planning.
 */
export async function convertApplicationToOffer(applicationId: string) {
  const session = await requirePermission("consulting.write");
  const { convertApplicationToMission } = await import("@/server/services/mission-service");
  const mission = await convertApplicationToMission({ actorId: session.user.id, applicationId });
  revalidatePath(`/mission-requests`);
  revalidatePath(`/missions`);
  redirect(`/missions/${mission.id}`);
}
