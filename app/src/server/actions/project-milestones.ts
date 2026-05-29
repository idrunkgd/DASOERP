"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  label: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  expectedAt: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  trigger: z.string().optional().nullable()
});

export async function addMilestoneToProject(projectId: string, formData: FormData) {
  const session = await requirePermission("finance.write");
  const data = Schema.parse(Object.fromEntries(formData));
  await prisma.billingMilestone.create({ data: { ...data, projectId } });
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "BillingMilestone", message: `Tranche '${data.label}' ajoutée au projet`, diff: { projectId } });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteMilestoneFromProject(milestoneId: string, projectId: string) {
  await requirePermission("finance.write");
  await prisma.billingMilestone.delete({ where: { id: milestoneId } });
  revalidatePath(`/projects/${projectId}`);
}

/**
 * Met à jour la date d'encaissement attendu d'une tranche.
 * expectedAt = date où on attend le cash sur le compte bancaire (pas la date
 * facture). Pour caler une date "à 30 jours fin de mois plus tard que la
 * facture", c'est au caller de faire le calcul avant d'envoyer.
 */
export async function updateMilestoneDate(milestoneId: string, expectedAt: string | null) {
  const session = await requirePermission("finance.write");
  const before = await prisma.billingMilestone.findUniqueOrThrow({
    where: { id: milestoneId },
    select: { id: true, label: true, expectedAt: true, projectId: true, missionId: true, offerId: true }
  });
  const newDate = expectedAt ? new Date(expectedAt) : null;
  await prisma.billingMilestone.update({
    where: { id: milestoneId },
    data: { expectedAt: newDate }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "BillingMilestone",
    entityId: milestoneId,
    message: `Tranche '${before.label}' : date d'encaissement ${before.expectedAt?.toISOString().slice(0, 10) ?? "—"} → ${expectedAt ?? "—"}`
  });
  // Revalide les pages concernées : projet, mission, offre, cashflow, dashboard
  if (before.projectId) revalidatePath(`/projects/${before.projectId}`);
  if (before.missionId) revalidatePath(`/missions/${before.missionId}`);
  if (before.offerId) revalidatePath(`/offers/${before.offerId}`);
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
}
