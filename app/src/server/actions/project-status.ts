"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  projectId: z.string().min(1),
  remainingTimeH: z.coerce.number().nonnegative().max(99999.99)
});

/**
 * Met à jour le "reste à faire" (en heures) d'un projet.
 * Accessible à toute personne authentifiée (non-Visiteur).
 */
export async function updateProjectRemainingTime(formData: FormData) {
  const session = await requireSession();
  const { projectId, remainingTimeH } = Schema.parse(Object.fromEntries(formData));

  const before = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { id: true, reference: true, remainingTimeH: true }
  });

  await prisma.project.update({
    where: { id: projectId },
    data: {
      remainingTimeH,
      remainingUpdatedAt: new Date(),
      remainingUpdatedById: session.user.id
    }
  });

  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Project",
    entityId: projectId,
    message: `Reste à faire mis à jour sur ${before.reference} : ${Number(before.remainingTimeH).toFixed(2)}h → ${remainingTimeH.toFixed(2)}h`
  });

  revalidatePath("/project-status");
  revalidatePath(`/projects/${projectId}`);
}
