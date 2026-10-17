"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, ALL_PERMISSIONS as RBAC_ALL_PERMISSIONS } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// On réutilise la liste exhaustive définie dans rbac.ts (source de vérité).
// Précédemment hardcodée partiellement ici → les overrides sur expenses.*,
// leaves.*, documents.*, fleet.*, etc. étaient rejetés par zod avec une
// erreur server component peu claire.
const ALL_PERMISSIONS = RBAC_ALL_PERMISSIONS;

/**
 * Définit la valeur d'une surcharge de permission pour un utilisateur.
 *
 * - granted=true  : grant explicite (ajoute au-dessus du rôle)
 * - granted=false : revoke explicite (retire si le rôle l'accordait)
 * - granted=null  : supprime l'override (retombe sur le rôle par défaut)
 */
const SetSchema = z.object({
  userId: z.string().min(1),
  permission: z.enum(ALL_PERMISSIONS as any),
  granted: z.enum(["GRANT","REVOKE","INHERIT"])
});

export async function setPermissionOverride(formData: FormData) {
  const session = await requirePermission("users.manage");
  const data = SetSchema.parse(Object.fromEntries(formData));
  const target = await prisma.user.findUniqueOrThrow({ where: { id: data.userId } });

  if (data.granted === "INHERIT") {
    // Suppression de l'override (retour au défaut du rôle)
    await prisma.userPermissionOverride.deleteMany({
      where: { userId: data.userId, permission: data.permission }
    });
  } else {
    const granted = data.granted === "GRANT";
    await prisma.userPermissionOverride.upsert({
      where: { userId_permission: { userId: data.userId, permission: data.permission } },
      update: { granted },
      create: { userId: data.userId, permission: data.permission, granted }
    });
  }
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "UserPermissionOverride",
    message: `Accès ${data.permission} sur ${target.firstName} ${target.lastName} → ${data.granted}`,
    diff: { userId: data.userId, permission: data.permission, granted: data.granted } as any
  });
  revalidatePath("/access");
  // Force la mise à jour de la sidebar de la session courante (cas où on change ses propres droits)
  if (data.userId === session.user.id) revalidatePath("/", "layout");
}

/** Réinitialise toutes les surcharges d'un utilisateur (retour aux défauts du rôle). */
export async function resetUserOverrides(userId: string) {
  const session = await requirePermission("users.manage");
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const { count } = await prisma.userPermissionOverride.deleteMany({ where: { userId } });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "UserPermissionOverride",
    message: `Reset des ${count} surcharge(s) pour ${target.firstName} ${target.lastName}`
  });
  revalidatePath("/access");
}
