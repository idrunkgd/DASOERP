"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextProjectReference } from "@/lib/references";
import { recomputeProject } from "@/server/services/project-service";

const Schema = z.object({
  name: z.string().min(1),
  mode: z.enum(["PROJECT","CONSULTING"]).default("PROJECT"),
  companyId: z.string().min(1),
  managerId: z.string().optional().nullable().transform(v => v || null),
  status: z.enum(["TO_START","ACTIVE","ON_HOLD","COMPLETED","CANCELLED"]).default("TO_START"),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  risks: z.string().optional().nullable(),
  plannedStart: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  plannedEnd:   z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  actualStart:  z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  actualEnd:    z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  budgetSell:  z.coerce.number().nonnegative().default(0),
  budgetCost:  z.coerce.number().nonnegative().default(0),
  budgetTimeH: z.coerce.number().nonnegative().default(0)
});

export async function createProjectAction(formData: FormData) {
  const session = await requirePermission("projects.write");
  const data = Schema.parse(Object.fromEntries(formData));
  const reference = await nextProjectReference();
  const created = await prisma.project.create({ data: { ...data, reference } });
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "Project", entityId: created.id, message: `Projet ${reference} créé manuellement` });
  revalidatePath("/projects");
  redirect(`/projects/${created.id}`);
}

export async function updateProjectAction(id: string, formData: FormData) {
  const session = await requirePermission("projects.write");
  const before = await prisma.project.findUniqueOrThrow({ where: { id } });
  const data = Schema.parse(Object.fromEntries(formData));
  const after = await prisma.project.update({ where: { id }, data });
  await recomputeProject(id);
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "Project", entityId: id, message: "Projet mis à jour", before, after });
  revalidatePath(`/projects/${id}`);
}

export async function deleteProjectAction(id: string) {
  const session = await requirePermission("projects.write");
  const before = await prisma.project.findUniqueOrThrow({ where: { id } });
  await prisma.project.delete({ where: { id } });
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "Project", entityId: id, message: `Projet ${before.reference} supprimé`, before });
  revalidatePath("/projects");
  redirect("/projects");
}

export async function addMember(projectId: string, formData: FormData) {
  await requirePermission("projects.write");
  const userId = String(formData.get("userId") || "");
  const roleLabel = (String(formData.get("roleLabel") || "")).trim() || null;
  if (!userId) return;
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: { roleLabel },
    create: { projectId, userId, roleLabel }
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function removeMember(projectId: string, userId: string) {
  await requirePermission("projects.write");
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
  revalidatePath(`/projects/${projectId}`);
}

export async function recomputeProjectAction(id: string) {
  await requirePermission("projects.read");
  await recomputeProject(id);
  revalidatePath(`/projects/${id}`);
}
