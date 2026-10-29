"use server";
/**
 * CRUD des interactions candidats (appels, mails, meetings, notes).
 * Même pattern que ContactInteraction.
 */
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function addCandidateInteraction(candidateId: string, formData: FormData) {
  const session = await requirePermission("consulting.write");
  const kind = String(formData.get("kind") || "note");
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim() || null;
  if (!subject) return;
  await (prisma as any).candidateInteraction.create({
    data: { candidateId, userId: session.user.id, kind, subject, body }
  });
  revalidatePath(`/candidates/${candidateId}`);
}

export async function updateCandidateInteraction(id: string, formData: FormData) {
  await requirePermission("consulting.write");
  const kind = String(formData.get("kind") || "note");
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim() || null;
  if (!subject) throw new Error("Le sujet est obligatoire");
  const interaction = await (prisma as any).candidateInteraction.update({
    where: { id }, data: { kind, subject, body }
  });
  revalidatePath(`/candidates/${interaction.candidateId}`);
}

export async function deleteCandidateInteraction(id: string) {
  await requirePermission("consulting.write");
  const interaction = await (prisma as any).candidateInteraction.findUnique({ where: { id } });
  if (!interaction) return { ok: true };
  await (prisma as any).candidateInteraction.delete({ where: { id } });
  revalidatePath(`/candidates/${interaction.candidateId}`);
  return { ok: true };
}
