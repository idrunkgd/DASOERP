"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const Schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  active: z.coerce.boolean().default(true),
  hourlyCost: z.coerce.number().nonnegative(),
  dailyCost:  z.coerce.number().nonnegative(),
  hourlySell: z.coerce.number().nonnegative(),
  dailySell:  z.coerce.number().nonnegative()
});

export async function createProfile(formData: FormData) {
  const session = await requirePermission("offers.write");
  const data = Schema.parse(Object.fromEntries(formData));
  const p = await prisma.serviceProfile.create({ data });
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "ServiceProfile", entityId: p.id, message: `Profil '${p.name}' créé`, after: p });
  revalidatePath("/service-profiles");
  redirect("/service-profiles");
}

export async function updateProfile(id: string, formData: FormData) {
  const session = await requirePermission("offers.write");
  const before = await prisma.serviceProfile.findUniqueOrThrow({ where: { id } });
  const data = Schema.parse(Object.fromEntries(formData));
  const after = await prisma.serviceProfile.update({ where: { id }, data });
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "ServiceProfile", entityId: id, message: `Profil '${after.name}' mis à jour`, before, after });
  revalidatePath("/service-profiles");
}

export async function deleteProfile(id: string) {
  const session = await requirePermission("offers.write");
  const p = await prisma.serviceProfile.delete({ where: { id } });
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "ServiceProfile", entityId: id, message: `Profil '${p.name}' supprimé`, before: p });
  revalidatePath("/service-profiles");
}
