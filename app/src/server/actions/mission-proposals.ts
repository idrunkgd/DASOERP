"use server";
/**
 * MissionProposal : offre PDF envoyée au client pour un profil déjà
 * présenté (MissionApplication). Une proposition = pivot sur application.
 *
 * Flow métier :
 *   1. Un candidat OU consultant est présenté sur la MissionRequest via
 *      une MissionApplication (statut PRESENTED).
 *   2. On génère une proposition : période + régime + TJM. L'application
 *      passe automatiquement en OFFER_SENT.
 *   3. Le client accepte → application → SELECTED → création automatique
 *      de la Mission via mission-service.
 *   4. Le client refuse → application → REJECTED.
 */
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { computeWorkingDays } from "@/lib/working-days";

async function nextReference() {
  const year = new Date().getFullYear();
  const prefix = `PROP-${year}-`;
  const last = await prisma.missionProposal.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" }, select: { reference: true }
  });
  const lastNum = last ? parseInt(last.reference.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
}

async function recomputeTotals(id: string) {
  const p = await prisma.missionProposal.findUniqueOrThrow({ where: { id } });
  const { effectiveDays } = computeWorkingDays({
    startDate: p.startDate,
    endDate: p.endDate,
    workDaysPerWeek: Number(p.workDaysPerWeek),
    includeHolidays: p.includeHolidays
  });
  const budget = effectiveDays * Number(p.dailyRate);
  await prisma.missionProposal.update({
    where: { id },
    data: { computedDays: effectiveDays, computedBudgetHt: budget }
  });
}

const CreateSchema = z.object({
  applicationId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  workDaysPerWeek: z.coerce.number().min(0.5).max(7).default(5),
  includeHolidays: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === undefined ? true : (v === true || v === "on" || v === "true")),
  dailyRate: z.coerce.number().positive(),
  intro: z.string().optional().nullable().transform((v) => v?.trim() || null),
  internalNotes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

/**
 * Crée une proposition depuis une MissionApplication existante.
 * Marque simultanément l'application en OFFER_SENT.
 * Erreur si l'application a déjà une proposition (unique constraint).
 */
export async function createMissionProposal(formData: FormData) {
  const session = await requirePermission("consulting.write");
  const data = CreateSchema.parse(Object.fromEntries(formData));
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end < start) throw new Error("La date de fin doit être après la date de début");

  const application = await prisma.missionApplication.findUnique({
    where: { id: data.applicationId },
    select: { id: true, missionRequestId: true, status: true, proposal: { select: { id: true } } }
  });
  if (!application) throw new Error("Présentation introuvable");
  if (application.proposal) {
    throw new Error(
      "Une proposition existe déjà pour ce profil. Modifie-la ou supprime-la avant d'en générer une nouvelle."
    );
  }

  const reference = await nextReference();
  const { effectiveDays } = computeWorkingDays({
    startDate: start, endDate: end,
    workDaysPerWeek: data.workDaysPerWeek,
    includeHolidays: data.includeHolidays
  });
  const budget = effectiveDays * data.dailyRate;

  // Une seule transaction : création de la proposition + passage de
  // l'application en OFFER_SENT. Si l'un échoue, rien n'est appliqué.
  const proposal = await prisma.$transaction(async (tx) => {
    const p = await tx.missionProposal.create({
      data: {
        reference,
        missionRequestId: application.missionRequestId,
        applicationId: application.id,
        ownerId: session.user.id,
        status: "DRAFT",
        startDate: start, endDate: end,
        workDaysPerWeek: data.workDaysPerWeek,
        includeHolidays: data.includeHolidays,
        dailyRate: data.dailyRate,
        computedDays: effectiveDays,
        computedBudgetHt: budget,
        intro: data.intro,
        internalNotes: data.internalNotes
      }
    });
    // L'application est marquée OFFER_SENT dès la génération de l'offre.
    // On garde le rôle d'un statut proposal.status=SENT pour distinguer
    // "générée" vs "vraiment envoyée au client" (l'utilisateur clique
    // ensuite sur "Marquer envoyée").
    if (application.status === "PRESENTED" || application.status === "SHORTLISTED"
        || application.status === "INTERVIEW_SCHEDULED" || application.status === "INTERVIEWED") {
      await tx.missionApplication.update({
        where: { id: application.id },
        data: { status: "OFFER_SENT" }
      });
    }
    return p;
  });

  revalidatePath(`/mission-requests/${application.missionRequestId}`);
  return { ok: true, id: proposal.id, reference: proposal.reference };
}

const UpdateSchema = CreateSchema.omit({ applicationId: true });

export async function updateMissionProposal(id: string, formData: FormData) {
  await requirePermission("consulting.write");
  const existing = await prisma.missionProposal.findUniqueOrThrow({ where: { id } });
  if (existing.status === "ACCEPTED") {
    throw new Error("Cette proposition est acceptée, elle n'est plus modifiable");
  }
  const data = UpdateSchema.parse(Object.fromEntries(formData));
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end < start) throw new Error("La date de fin doit être après la date de début");

  await prisma.missionProposal.update({
    where: { id },
    data: {
      startDate: start, endDate: end,
      workDaysPerWeek: data.workDaysPerWeek,
      includeHolidays: data.includeHolidays,
      dailyRate: data.dailyRate,
      intro: data.intro,
      internalNotes: data.internalNotes
    }
  });
  await recomputeTotals(id);

  revalidatePath(`/mission-requests/${existing.missionRequestId}`);
  return { ok: true };
}

export async function deleteMissionProposal(id: string) {
  await requirePermission("consulting.write");
  const p = await prisma.missionProposal.findUniqueOrThrow({
    where: { id },
    select: { id: true, status: true, missionRequestId: true, applicationId: true }
  });
  if (p.status === "SENT" || p.status === "ACCEPTED" || p.status === "REJECTED") {
    throw new Error(
      "Une proposition envoyée ou décidée ne peut pas être supprimée. Passe-la en CANCELLED."
    );
  }
  await prisma.$transaction(async (tx) => {
    await tx.missionProposal.delete({ where: { id } });
    // On retombe l'application en PRESENTED puisqu'il n'y a plus d'offre en cours.
    await tx.missionApplication.update({
      where: { id: p.applicationId },
      data: { status: "PRESENTED" }
    });
  });
  revalidatePath(`/mission-requests/${p.missionRequestId}`);
  return { ok: true };
}

/**
 * Change de statut. Sur SENT : marque sentAt. Sur ACCEPTED/REJECTED :
 * marque decidedAt. L'acceptation ne crée pas la Mission — c'est le
 * changement de statut de l'APPLICATION → SELECTED qui déclenche la
 * création de mission (via applications.ts).
 */
export async function setMissionProposalStatus(
  id: string,
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "CANCELLED",
  lostReason?: string
) {
  await requirePermission("consulting.write");
  const p = await prisma.missionProposal.findUniqueOrThrow({
    where: { id }, select: { id: true, missionRequestId: true }
  });
  const data: any = { status };
  if (status === "SENT") data.sentAt = new Date();
  if (status === "ACCEPTED" || status === "REJECTED") {
    data.decidedAt = new Date();
    if (status === "REJECTED" && lostReason) data.lostReason = lostReason;
  }
  await prisma.missionProposal.update({ where: { id }, data });
  revalidatePath(`/mission-requests/${p.missionRequestId}`);
  return { ok: true };
}

/**
 * Preview live des totaux dans le formulaire de création. Non-persistant.
 */
export async function previewProposalTotals(input: {
  startDate: string; endDate: string;
  workDaysPerWeek: number; includeHolidays: boolean;
  dailyRate: number;
}) {
  await requirePermission("consulting.read");
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return { calendarDays: 0, fullTimeWorkingDays: 0, effectiveDays: 0, budgetHt: 0 };
  }
  const r = computeWorkingDays({
    startDate: start, endDate: end,
    workDaysPerWeek: input.workDaysPerWeek,
    includeHolidays: input.includeHolidays
  });
  return { ...r, budgetHt: r.effectiveDays * (input.dailyRate || 0) };
}
