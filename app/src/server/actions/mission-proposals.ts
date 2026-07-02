"use server";
/**
 * MissionProposal : proposition consultant pour un client, générée
 * depuis une demande de mission.
 *
 * Chaque proposition = un consultant candidat pour la mission, avec
 * une période, un régime (jours/sem) et un TJM vendu. Le budget total
 * est calculé serveur-side depuis les dates + régime + fériés belges
 * (voir lib/working-days.ts) et snapshoté sur la row pour que le PDF
 * reste cohérent même si on rejoue le calcul plus tard.
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

/**
 * Recalcule computedDays et computedBudgetHt depuis les inputs.
 * À appeler après chaque update qui touche start/end/régime/dailyRate.
 */
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
  missionRequestId: z.string().min(1),
  candidateId: z.string().min(1),
  startDate: z.string().min(1),  // ISO YYYY-MM-DD
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

export async function createMissionProposal(formData: FormData) {
  const session = await requirePermission("consulting.write");
  const data = CreateSchema.parse(Object.fromEntries(formData));

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end < start) throw new Error("La date de fin doit être après la date de début");

  const [request, candidate] = await Promise.all([
    prisma.missionRequest.findUnique({ where: { id: data.missionRequestId }, select: { id: true } }),
    prisma.candidate.findUnique({ where: { id: data.candidateId }, select: { id: true } })
  ]);
  if (!request) throw new Error("Demande de mission introuvable");
  if (!candidate) throw new Error("Consultant introuvable");

  const reference = await nextReference();

  // Calcul initial (aussi refait en recomputeTotals, mais on veut la valeur
  // dès la création pour éviter une row à 0)
  const { effectiveDays } = computeWorkingDays({
    startDate: start, endDate: end,
    workDaysPerWeek: data.workDaysPerWeek,
    includeHolidays: data.includeHolidays
  });
  const budget = effectiveDays * data.dailyRate;

  const proposal = await prisma.missionProposal.create({
    data: {
      reference,
      missionRequestId: data.missionRequestId,
      candidateId: data.candidateId,
      ownerId: session.user.id,
      status: "DRAFT",
      startDate: start,
      endDate: end,
      workDaysPerWeek: data.workDaysPerWeek,
      includeHolidays: data.includeHolidays,
      dailyRate: data.dailyRate,
      computedDays: effectiveDays,
      computedBudgetHt: budget,
      intro: data.intro,
      internalNotes: data.internalNotes
    }
  });

  revalidatePath(`/mission-requests/${data.missionRequestId}`);
  revalidatePath(`/proposals`);
  return { ok: true, id: proposal.id, reference: proposal.reference };
}

const UpdateSchema = CreateSchema.omit({ missionRequestId: true });

export async function updateMissionProposal(id: string, formData: FormData) {
  await requirePermission("consulting.write");
  const existing = await prisma.missionProposal.findUniqueOrThrow({ where: { id } });
  // On refuse l'édition après acceptation client (invariant métier :
  // le PDF envoyé doit refléter les termes acceptés). Le refus ou
  // l'annulation autorisent l'édition (correction avant renvoi).
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
      candidateId: data.candidateId,
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
  revalidatePath(`/proposals/${id}`);
  return { ok: true };
}

export async function deleteMissionProposal(id: string) {
  await requirePermission("consulting.write");
  const p = await prisma.missionProposal.findUniqueOrThrow({
    where: { id }, select: { id: true, status: true, missionRequestId: true }
  });
  // Belgian legal / prudence : si la proposition a été envoyée ou décidée,
  // on préfère la marquer CANCELLED plutôt que la supprimer sec (garde une
  // trace commerciale).
  if (p.status === "SENT" || p.status === "ACCEPTED" || p.status === "REJECTED") {
    throw new Error(
      "Une proposition envoyée ou décidée ne peut pas être supprimée. " +
      "Passe-la en CANCELLED ou crée une nouvelle version."
    );
  }
  await prisma.missionProposal.delete({ where: { id } });
  revalidatePath(`/mission-requests/${p.missionRequestId}`);
  revalidatePath(`/proposals`);
  return { ok: true };
}

export async function setMissionProposalStatus(
  id: string,
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "CANCELLED",
  lostReason?: string
) {
  await requirePermission("consulting.write");
  const p = await prisma.missionProposal.findUniqueOrThrow({
    where: { id }, select: { id: true, status: true, missionRequestId: true }
  });
  const data: any = { status };
  if (status === "SENT" && !p.status) data.sentAt = new Date();
  if (status === "SENT") data.sentAt = new Date();
  if (status === "ACCEPTED" || status === "REJECTED") {
    data.decidedAt = new Date();
    if (status === "REJECTED" && lostReason) data.lostReason = lostReason;
  }
  await prisma.missionProposal.update({ where: { id }, data });
  revalidatePath(`/mission-requests/${p.missionRequestId}`);
  revalidatePath(`/proposals/${id}`);
  return { ok: true };
}

/**
 * Endpoint utilitaire pour l'UI : preview des jours ouvrés + budget
 * sans persister, utilisé pendant la saisie du formulaire.
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
