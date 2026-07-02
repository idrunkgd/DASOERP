"use server";
/**
 * CRUD des expériences professionnelles des consultants internes (User).
 *
 * Miroir de candidate-experiences.ts, mais pour la table UserExperience.
 * Le contrôle d'accès est similaire :
 *   - L'utilisateur peut TOUJOURS modifier ses propres expériences.
 *   - Un admin/manager (permissions users.manage ou consulting.write) peut
 *     modifier celles des autres.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  userId:      z.string().min(1),
  companyName: z.string().min(1),
  jobTitle:    z.string().optional().nullable(),
  startDate:   z.string().min(1).transform((v) => new Date(v)),
  endDate:     z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  description: z.string().optional().nullable()
});

async function ensureAccess(userId: string) {
  const session = await requireSession();
  if (userId === session.user.id) return session;
  const sp = await getUserEffectivePermissions(session.user.id, session.user.role);
  if (sp.includes("users.manage") || sp.includes("consulting.write")) return session;
  throw new Error("Vous n'avez pas accès à ces expériences.");
}

export async function addUserExperience(formData: FormData) {
  const data = Schema.parse(Object.fromEntries(formData));
  const session = await ensureAccess(data.userId);
  if (data.endDate && data.endDate < data.startDate) {
    throw new Error("La date de fin doit être après la date de début.");
  }
  const exp = await prisma.userExperience.create({ data });
  await logActivity({
    actorId: session.user.id, action: "CREATE", entityType: "UserExperience", entityId: exp.id,
    message: `Expérience « ${data.companyName} » ajoutée au CV consultant`
  });
  revalidatePath("/me");
  revalidatePath(`/users/${data.userId}`);
}

export async function updateUserExperience(id: string, formData: FormData) {
  const data = Schema.parse(Object.fromEntries(formData));
  const before = await prisma.userExperience.findUniqueOrThrow({ where: { id } });
  const session = await ensureAccess(before.userId);
  if (before.userId !== data.userId) throw new Error("Incohérence d'expérience.");
  if (data.endDate && data.endDate < data.startDate) {
    throw new Error("La date de fin doit être après la date de début.");
  }
  const after = await prisma.userExperience.update({ where: { id }, data });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "UserExperience", entityId: id,
    message: `Expérience « ${data.companyName} » mise à jour`, before, after
  });
  revalidatePath("/me");
  revalidatePath(`/users/${before.userId}`);
}

export async function deleteUserExperience(id: string) {
  const before = await prisma.userExperience.findUniqueOrThrow({ where: { id } });
  const session = await ensureAccess(before.userId);
  await prisma.userExperience.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id, action: "DELETE", entityType: "UserExperience", entityId: id,
    message: `Expérience « ${before.companyName} » supprimée`, before
  });
  revalidatePath("/me");
  revalidatePath(`/users/${before.userId}`);
}
