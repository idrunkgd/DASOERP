"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  name: z.string().min(1).transform(v => v.trim()),
  category: z.string().optional().nullable().transform(v => v?.trim() || null),
  active: z.coerce.boolean().default(true)
});

export async function createSkill(formData: FormData) {
  const session = await requirePermission("settings.manage");
  const data = Schema.parse(Object.fromEntries(formData));
  try {
    const s = await prisma.skill.create({ data });
    await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "Skill", entityId: s.id, message: `Compétence « ${s.name} » ajoutée`, after: s });
  } catch (e: any) {
    if (e?.code === "P2002") throw new Error(`La compétence « ${data.name} » existe déjà.`);
    throw e;
  }
  revalidatePath("/skills");
}

export async function updateSkill(id: string, formData: FormData) {
  const session = await requirePermission("settings.manage");
  const before = await prisma.skill.findUniqueOrThrow({ where: { id } });
  const data = Schema.parse(Object.fromEntries(formData));
  const after = await prisma.skill.update({ where: { id }, data });
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "Skill", entityId: id, message: `Compétence mise à jour`, before, after });
  revalidatePath("/skills");
}

export async function deleteSkill(id: string) {
  const session = await requirePermission("settings.manage");
  const before = await prisma.skill.findUniqueOrThrow({ where: { id } });
  await prisma.skill.delete({ where: { id } });
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "Skill", entityId: id, message: `Compétence « ${before.name} » supprimée`, before });
  revalidatePath("/skills");
}
