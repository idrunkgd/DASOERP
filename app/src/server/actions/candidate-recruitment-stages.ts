"use server";
/**
 * Pipeline recrutement du candidat — 6 étapes avec coche + notes.
 */
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

/** Toggle coché / décoché. Lazy-crée la ligne si inexistante. */
export async function toggleRecruitmentStage(
  candidateId: string, stageKey: string, done: boolean
) {
  await requirePermission("consulting.write");
  const doneAt = done ? new Date() : null;
  await (prisma as any).candidateRecruitmentStage.upsert({
    where: { candidateId_stageKey: { candidateId, stageKey } },
    create: { candidateId, stageKey, done, doneAt },
    update: { done, doneAt }
  });
  revalidatePath(`/candidates/${candidateId}`);
}

/** Met à jour les notes d'une étape. Lazy-crée la ligne si inexistante. */
export async function updateRecruitmentStageNotes(
  candidateId: string, stageKey: string, notes: string
) {
  await requirePermission("consulting.write");
  const trimmed = notes.trim() || null;
  await (prisma as any).candidateRecruitmentStage.upsert({
    where: { candidateId_stageKey: { candidateId, stageKey } },
    create: { candidateId, stageKey, notes: trimmed },
    update: { notes: trimmed }
  });
  revalidatePath(`/candidates/${candidateId}`);
}
