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
 * Fusionne la compétence `sourceId` DANS `targetId` :
 *  - Pour chaque User / Candidate / MissionRequest contenant le nom source,
 *    on remplace par le nom cible (en dédoublonnant).
 *  - On supprime ensuite la Skill source du catalogue.
 *
 * Utile pour nettoyer les doublons de casse (ex: « TIA Portal » vs « TIA PORTAL »)
 * sans perdre d'affectation.
 *
 * Idempotent : si la cible est déjà présente sur une entité, on supprime juste
 * le doublon source.
 */
export async function mergeSkills(sourceId: string, targetId: string): Promise<{
  usersUpdated: number;
  candidatesUpdated: number;
  missionsUpdated: number;
}> {
  const session = await requirePermission("settings.manage");
  if (sourceId === targetId) throw new Error("Source et cible identiques — rien à fusionner.");
  const [source, target] = await Promise.all([
    prisma.skill.findUniqueOrThrow({ where: { id: sourceId } }),
    prisma.skill.findUniqueOrThrow({ where: { id: targetId } })
  ]);

  const sourceName = source.name;
  const targetName = target.name;

  // Helper pour fusionner un String[] : enlève le nom source et ajoute le
  // nom cible s'il n'y est pas déjà. Retourne le nouveau tableau.
  const merge = (arr: string[]): string[] => {
    const filtered = arr.filter((s) => s !== sourceName);
    if (!filtered.includes(targetName)) filtered.push(targetName);
    return filtered;
  };

  // Transaction pour tout faire d'un coup — si quelque chose casse, on
  // ne laisse pas la base avec des user ayant perdu la skill source sans
  // avoir reçu la target.
  const result = await prisma.$transaction(async (tx) => {
    // Users
    const users = await tx.user.findMany({
      where: { skills: { has: sourceName } },
      select: { id: true, skills: true }
    });
    for (const u of users) {
      await tx.user.update({ where: { id: u.id }, data: { skills: merge(u.skills) } });
    }

    // Candidates
    const candidates = await tx.candidate.findMany({
      where: { skills: { has: sourceName } },
      select: { id: true, skills: true }
    });
    for (const c of candidates) {
      await tx.candidate.update({ where: { id: c.id }, data: { skills: merge(c.skills) } });
    }

    // MissionRequest (requiredSkills)
    const missions = await tx.missionRequest.findMany({
      where: { requiredSkills: { has: sourceName } },
      select: { id: true, requiredSkills: true }
    });
    for (const m of missions) {
      await tx.missionRequest.update({
        where: { id: m.id },
        data: { requiredSkills: merge(m.requiredSkills) }
      });
    }

    // Supprime la skill source du catalogue
    await tx.skill.delete({ where: { id: sourceId } });

    return {
      usersUpdated: users.length,
      candidatesUpdated: candidates.length,
      missionsUpdated: missions.length
    };
  });

  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Skill",
    entityId: targetId,
    message: `Fusion : « ${sourceName} » → « ${targetName} » (${result.usersUpdated} user${result.usersUpdated > 1 ? "s" : ""}, ${result.candidatesUpdated} candidat${result.candidatesUpdated > 1 ? "s" : ""}, ${result.missionsUpdated} mission${result.missionsUpdated > 1 ? "s" : ""} mis à jour)`,
    before: source,
    after: target
  });

  revalidatePath("/skills");
  revalidatePath("/candidates");
  revalidatePath("/consultants");
  revalidatePath("/candidates/benchmark");
  return result;
}

/**
 * Fusionne une compétence « orpheline » (string présente dans un ou plusieurs
 * CV / fiches candidat / consultants / missions, MAIS absente du catalogue
 * `Skill`) vers une entrée du catalogue.
 *
 * Même comportement que mergeSkills(), sauf qu'il n'y a pas de ligne Skill
 * source à supprimer — on ne touche qu'aux String[] des entités.
 *
 * Case-insensitive sur le nom orphelin (pour que « siemens tia » matche
 * aussi « Siemens Tia » si les deux variantes trainent dans la base).
 */
export async function mergeOrphanSkill(orphanName: string, targetId: string): Promise<{
  usersUpdated: number;
  candidatesUpdated: number;
  missionsUpdated: number;
  variantsReplaced: string[];
}> {
  const session = await requirePermission("settings.manage");
  const trimmed = orphanName.trim();
  if (!trimmed) throw new Error("Nom orphelin vide.");
  const target = await prisma.skill.findUniqueOrThrow({ where: { id: targetId } });
  const targetName = target.name;
  if (trimmed.toLowerCase() === targetName.toLowerCase()) {
    throw new Error("Le nom orphelin est déjà la cible — rien à fusionner.");
  }

  // On matche le nom orphelin en case-insensitive pour attraper toutes les
  // variantes de casse qui n'auraient PAS d'entrée dans Skill.
  const orphanLower = trimmed.toLowerCase();
  const variantsReplaced = new Set<string>();

  const merge = (arr: string[]): string[] => {
    const kept: string[] = [];
    let touched = false;
    for (const s of arr) {
      if (s.toLowerCase() === orphanLower) {
        variantsReplaced.add(s);
        touched = true;
        continue;
      }
      kept.push(s);
    }
    if (touched && !kept.includes(targetName)) kept.push(targetName);
    return kept;
  };

  const result = await prisma.$transaction(async (tx) => {
    let usersUpdated = 0;
    const users = await tx.user.findMany({ select: { id: true, skills: true } });
    for (const u of users) {
      if (!u.skills.some((s) => s.toLowerCase() === orphanLower)) continue;
      await tx.user.update({ where: { id: u.id }, data: { skills: merge(u.skills) } });
      usersUpdated++;
    }

    let candidatesUpdated = 0;
    const candidates = await tx.candidate.findMany({ select: { id: true, skills: true } });
    for (const c of candidates) {
      if (!c.skills.some((s) => s.toLowerCase() === orphanLower)) continue;
      await tx.candidate.update({ where: { id: c.id }, data: { skills: merge(c.skills) } });
      candidatesUpdated++;
    }

    let missionsUpdated = 0;
    const missions = await tx.missionRequest.findMany({ select: { id: true, requiredSkills: true } });
    for (const m of missions) {
      if (!m.requiredSkills.some((s) => s.toLowerCase() === orphanLower)) continue;
      await tx.missionRequest.update({
        where: { id: m.id },
        data: { requiredSkills: merge(m.requiredSkills) }
      });
      missionsUpdated++;
    }

    return { usersUpdated, candidatesUpdated, missionsUpdated };
  });

  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Skill",
    entityId: targetId,
    message: `Fusion orpheline : « ${trimmed} » (${Array.from(variantsReplaced).join(", ")}) → « ${targetName} » (${result.usersUpdated} user, ${result.candidatesUpdated} candidat, ${result.missionsUpdated} mission mis à jour)`,
    after: target
  });

  revalidatePath("/skills");
  revalidatePath("/candidates");
  revalidatePath("/consultants");
  revalidatePath("/candidates/benchmark");
  return { ...result, variantsReplaced: Array.from(variantsReplaced) };
}

/**
 * Collecte toutes les skills utilisées dans les entités (User/Candidate/
 * MissionRequest) qui n'existent PAS dans le catalogue Skill.
 *
 * Retourne un tableau trié avec, pour chaque orphelin, le nombre d'entités
 * qui l'utilisent — pour aider à prioriser les fusions.
 */
export async function listOrphanSkills(): Promise<Array<{
  name: string;
  users: number;
  candidates: number;
  missions: number;
  total: number;
}>> {
  await requirePermission("settings.manage");
  const [catalog, users, candidates, missions] = await Promise.all([
    prisma.skill.findMany({ select: { name: true } }),
    prisma.user.findMany({ select: { skills: true } }),
    prisma.candidate.findMany({ select: { skills: true } }),
    prisma.missionRequest.findMany({ select: { requiredSkills: true } })
  ]);
  const catalogSet = new Set(catalog.map((s) => s.name.trim().toLowerCase()));
  const counts = new Map<string, { display: string; users: number; candidates: number; missions: number }>();

  const bump = (arr: string[], kind: "users" | "candidates" | "missions") => {
    const seenInEntity = new Set<string>();
    for (const raw of arr) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (catalogSet.has(key)) continue;
      if (seenInEntity.has(key)) continue;
      seenInEntity.add(key);
      const existing = counts.get(key);
      if (existing) {
        existing[kind]++;
      } else {
        counts.set(key, { display: name, users: 0, candidates: 0, missions: 0, [kind]: 1 } as any);
      }
    }
  };

  for (const u of users) bump(u.skills, "users");
  for (const c of candidates) bump(c.skills, "candidates");
  for (const m of missions) bump(m.requiredSkills, "missions");

  return Array.from(counts.values())
    .map((v) => ({
      name: v.display, users: v.users, candidates: v.candidates, missions: v.missions,
      total: v.users + v.candidates + v.missions
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
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
