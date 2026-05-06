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
