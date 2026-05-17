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

/**
 * Trouve un skill par nom (case-insensitive), ou le crée à la volée s'il
 * n'existe pas — avec la casse fournie par l'utilisateur.
 *
 * Accessible à toute personne loguée pouvant lire la base entreprises
 * (donc tous les utilisateurs non-Visiteur). C'est utilisé depuis les
 * autocompletes de skills sur les formulaires User / Candidate / Me.
 *
 * Comportement :
 *  - Si une skill avec un nom matchant en case-insensitive existe déjà,
 *    on renvoie son nom (avec la casse stockée en base, pour cohérence).
 *  - Sinon, on crée une nouvelle entrée Skill avec la casse exacte fournie.
 */
const FindOrCreateSchema = z.object({
  name: z.string().min(1).max(60).transform((v) => v.trim()),
  category: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function findOrCreateSkill(input: {
  name: string;
  category?: string | null;
}): Promise<{ name: string; created: boolean }> {
  const session = await requirePermission("companies.read");
  const data = FindOrCreateSchema.parse(input);

  // 1) Cherche existant (case-insensitive)
  const existing = await prisma.skill.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" } }
  });
  if (existing) {
    return { name: existing.name, created: false };
  }

  // 2) Créé avec la casse fournie
  try {
    const created = await prisma.skill.create({
      data: { name: data.name, category: data.category, active: true }
    });
    await logActivity({
      actorId: session.user.id,
      action: "CREATE",
      entityType: "Skill",
      entityId: created.id,
      message: `Compétence « ${created.name} » créée depuis un formulaire`
    });
    revalidatePath("/skills");
    return { name: created.name, created: true };
  } catch (e: any) {
    // Race condition très rare : 2 créations simultanées du même nom
    if (e?.code === "P2002") {
      const fallback = await prisma.skill.findFirst({
        where: { name: { equals: data.name, mode: "insensitive" } }
      });
      if (fallback) return { name: fallback.name, created: false };
    }
    throw e;
  }
}
