"use server";
/**
 * MissionProposal : offre PDF envoyée au client pour un profil déjà
 * présenté (MissionApplication). Depuis la refonte du 2 juillet 2026 :
 *
 *  - MissionProposal ne porte PLUS de statut. Tout l'état métier vit
 *    sur MissionApplication.status (PRESENTED → OFFER_SENT → SELECTED / REJECTED).
 *  - La proposition est simplement l'ARTEFACT PDF (termes figés : dates,
 *    régime, TJM, budget). L'existence d'une proposition + application en
 *    OFFER_SENT = "offre envoyée en attente de décision client".
 *  - Générer la proposition met automatiquement l'application en OFFER_SENT.
 *  - Supprimer la proposition retombe l'application en PRESENTED.
 *  - Le passage de l'application à SELECTED (via applications.ts) déclenche
 *    la création automatique de la Mission avec les termes de la proposition.
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
 * Crée la proposition + met l'application en OFFER_SENT dans une seule
 * transaction. Refuse si l'application a déjà une proposition (unique).
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
    throw new Error("Une offre existe déjà pour ce profil. Supprime-la ou édite-la.");
  }

  const reference = await nextReference();
  const { effectiveDays } = computeWorkingDays({
    startDate: start, endDate: end,
    workDaysPerWeek: data.workDaysPerWeek,
    includeHolidays: data.includeHolidays
  });
  const budget = effectiveDays * data.dailyRate;

  const proposal = await prisma.$transaction(async (tx) => {
    const p = await tx.missionProposal.create({
      data: {
        reference,
        missionRequestId: application.missionRequestId,
        applicationId: application.id,
        ownerId: session.user.id,
        startDate: start, endDate: end,
        workDaysPerWeek: data.workDaysPerWeek,
        includeHolidays: data.includeHolidays,
        dailyRate: data.dailyRate,
        computedDays: effectiveDays,
        computedBudgetHt: budget,
        sentAt: new Date(),
        intro: data.intro,
        internalNotes: data.internalNotes
      }
    });
    // Simultanément : l'application passe en OFFER_SENT (l'offre est
    // considérée envoyée dès qu'elle est générée — l'utilisateur fait
    // du "download + envoi email" ensuite).
    await tx.missionApplication.update({
      where: { id: application.id },
      data: { status: "OFFER_SENT" }
    });
    return p;
  });

  revalidatePath(`/mission-requests/${application.missionRequestId}`);
  return { ok: true, id: proposal.id, reference: proposal.reference };
}

const UpdateSchema = CreateSchema.omit({ applicationId: true });

export async function updateMissionProposal(id: string, formData: FormData) {
  await requirePermission("consulting.write");
  const existing = await prisma.missionProposal.findUniqueOrThrow({
    where: { id }, include: { application: { select: { status: true } } }
  });
  if (existing.application.status === "SELECTED") {
    throw new Error("L'offre a été acceptée, elle n'est plus modifiable.");
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

/**
 * Supprime la proposition + repasse l'application en PRESENTED si elle
 * était en OFFER_SENT. Permet de refaire une nouvelle offre après
 * ajustement des termes.
 */
export async function deleteMissionProposal(id: string) {
  await requirePermission("consulting.write");
  const p = await prisma.missionProposal.findUniqueOrThrow({
    where: { id },
    select: {
      id: true, missionRequestId: true, applicationId: true,
      application: { select: { status: true } }
    }
  });
  if (p.application.status === "SELECTED") {
    throw new Error("L'offre a été acceptée — impossible de la supprimer.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.missionProposal.delete({ where: { id } });
    if (p.application.status === "OFFER_SENT") {
      await tx.missionApplication.update({
        where: { id: p.applicationId },
        data: { status: "PRESENTED" }
      });
    }
  });
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
