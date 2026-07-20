"use server";
/**
 * Déclarations d'arrêt maladie. Un consultant déclare sa propre absence
 * avec un certificat médical en pièce jointe. Aucune approbation : c'est
 * une info factuelle utilisée pour le badge "Maladie" et le dashboard RH.
 *
 * Un admin/manager peut aussi supprimer une entrée s'il faut nettoyer.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requirePermission, getUserEffectivePermissions } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  startDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason:         z.string().max(500).optional().nullable().transform((v) => v?.trim() || null),
  certificateUrl: z.string().optional().nullable().transform((v) => v || null),
  notes:          z.string().max(1000).optional().nullable().transform((v) => v?.trim() || null)
});

export async function createSickLeave(formData: FormData) {
  const session = await requireSession();
  const data = Schema.parse(Object.fromEntries(formData));
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end < start) {
    throw new Error("La date de fin ne peut pas être antérieure à la date de début");
  }
  const created = await prisma.sickLeave.create({
    data: {
      userId: session.user.id,
      startDate: start,
      endDate: end,
      reason: data.reason,
      certificateUrl: data.certificateUrl,
      notes: data.notes
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "SickLeave",
    entityId: created.id,
    message: `Arrêt maladie déclaré (${data.startDate} → ${data.endDate})`
  });
  revalidatePath("/me");
  revalidatePath("/dashboard");
  return { ok: true, id: created.id };
}

export async function deleteSickLeave(id: string) {
  const session = await requireSession();
  const sl = await prisma.sickLeave.findUnique({ where: { id } });
  if (!sl) throw new Error("Arrêt introuvable");
  // L'auteur peut toujours supprimer son propre arrêt. Un tiers doit avoir
  // users.manage (rôle d'admin RH) — pas de permission dédiée pour rester
  // simple, la gestion des arrêts est un sous-domaine de la gestion users.
  const isOwner = sl.userId === session.user.id;
  if (!isOwner) {
    const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
    if (!perms.includes("users.manage")) {
      throw new Error("Suppression réservée à l'auteur ou à un admin RH");
    }
  }
  await prisma.sickLeave.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "SickLeave",
    entityId: id,
    message: "Arrêt maladie supprimé"
  });
  revalidatePath("/me");
  revalidatePath("/dashboard");
  return { ok: true };
}
