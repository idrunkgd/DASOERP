"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  candidateId: z.string().min(1),
  companyName: z.string().min(1),
  jobTitle:    z.string().optional().nullable(),
  startDate:   z.string().min(1).transform(v => new Date(v)),
  endDate:     z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  description: z.string().optional().nullable()
});

/** Vérifie que l'utilisateur peut gérer ce CV : soit le candidat lui-même (portail), soit un admin/manager. */
async function ensureAccess(candidateId: string) {
  const session = await requireSession();
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId }, select: { portalUserId: true } });
  if (candidate.portalUserId === session.user.id) return session;
  const sp = await getUserEffectivePermissions(session.user.id, session.user.role);
  if (sp.includes("consulting.write") || sp.includes("users.manage")) return session;
  throw new Error("Vous n'avez pas accès à ce CV.");
}

export async function addExperience(formData: FormData) {
  const data = Schema.parse(Object.fromEntries(formData));
  const session = await ensureAccess(data.candidateId);
  if (data.endDate && data.endDate < data.startDate) throw new Error("La date de fin doit être après la date de début.");
  const exp = await prisma.candidateExperience.create({ data });
  await logActivity({
    actorId: session.user.id, action: "CREATE", entityType: "CandidateExperience", entityId: exp.id,
    message: `Expérience « ${data.companyName} » ajoutée au CV`
  });
  revalidatePath("/me");
  revalidatePath(`/candidates/${data.candidateId}`);
}

export async function updateExperience(id: string, formData: FormData) {
  const data = Schema.parse(Object.fromEntries(formData));
  const before = await prisma.candidateExperience.findUniqueOrThrow({ where: { id } });
  const session = await ensureAccess(before.candidateId);
  if (before.candidateId !== data.candidateId) throw new Error("Incohérence d'expérience.");
  if (data.endDate && data.endDate < data.startDate) throw new Error("La date de fin doit être après la date de début.");
  const after = await prisma.candidateExperience.update({ where: { id }, data });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "CandidateExperience", entityId: id,
    message: `Expérience « ${data.companyName} » mise à jour`, before, after
  });
  revalidatePath("/me");
  revalidatePath(`/candidates/${before.candidateId}`);
}

export async function deleteExperience(id: string) {
  const before = await prisma.candidateExperience.findUniqueOrThrow({ where: { id } });
  const session = await ensureAccess(before.candidateId);
  await prisma.candidateExperience.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id, action: "DELETE", entityType: "CandidateExperience", entityId: id,
    message: `Expérience « ${before.companyName} » supprimée`, before
  });
  revalidatePath("/me");
  revalidatePath(`/candidates/${before.candidateId}`);
}
