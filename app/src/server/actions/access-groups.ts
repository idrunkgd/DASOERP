"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, ALL_PERMISSIONS, type Permission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const Schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  // Les permissions arrivent en multiples FormData entries "permissions"
  permissions: z.preprocess(
    (v) => Array.isArray(v) ? v : (v ? [v] : []),
    z.array(z.string())
  )
});

function readForm(formData: FormData) {
  const obj: any = {
    name: formData.get("name"),
    description: formData.get("description"),
    permissions: formData.getAll("permissions").filter(Boolean)
  };
  return Schema.parse(obj);
}

function sanitizePerms(list: string[]): Permission[] {
  const valid = new Set<string>(ALL_PERMISSIONS);
  return list.filter(p => valid.has(p)) as Permission[];
}

export async function createAccessGroup(formData: FormData) {
  const session = await requirePermission("users.manage");
  const data = readForm(formData);
  const g = await prisma.accessGroup.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      permissions: sanitizePerms(data.permissions),
      isSystem: false
    }
  });
  await logActivity({
    actorId: session.user.id, action: "CREATE", entityType: "AccessGroup", entityId: g.id,
    message: `Groupe d'accès « ${g.name} » créé (${g.permissions.length} permission(s))`,
    after: g
  });
  revalidatePath("/access");
  redirect("/access");
}

export async function updateAccessGroup(id: string, formData: FormData) {
  const session = await requirePermission("users.manage");
  const before = await prisma.accessGroup.findUniqueOrThrow({ where: { id } });
  const data = readForm(formData);
  const after = await prisma.accessGroup.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description ?? null,
      permissions: sanitizePerms(data.permissions)
    }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "AccessGroup", entityId: id,
    message: `Groupe « ${after.name} » mis à jour (${after.permissions.length} permission(s))`,
    before, after
  });
  revalidatePath("/access");
}

export async function deleteAccessGroup(id: string) {
  const session = await requirePermission("users.manage");
  const before = await prisma.accessGroup.findUniqueOrThrow({ where: { id }, include: { _count: { select: { users: true } } } });
  if (before.isSystem) throw new Error("Impossible de supprimer un groupe système.");
  if (before._count.users > 0) throw new Error(`Ce groupe est attribué à ${before._count.users} utilisateur(s). Réaffectez-les d'abord.`);
  await prisma.accessGroup.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id, action: "DELETE", entityType: "AccessGroup", entityId: id,
    message: `Groupe « ${before.name} » supprimé`, before
  });
  revalidatePath("/access");
}

/** Assigne (ou retire) un groupe d'accès à un utilisateur. groupId="" pour retirer. */
export async function assignUserGroup(userId: string, groupId: string) {
  const session = await requirePermission("users.manage");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const newGroupId = groupId || null;
  const newGroup = newGroupId ? await prisma.accessGroup.findUnique({ where: { id: newGroupId } }) : null;
  await prisma.user.update({ where: { id: userId }, data: { accessGroupId: newGroupId } });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "User", entityId: userId,
    message: `${user.firstName} ${user.lastName} : groupe d'accès → ${newGroup?.name ?? "— défaut du rôle —"}`
  });
  revalidatePath("/access");
  if (userId === session.user.id) revalidatePath("/", "layout");
}
