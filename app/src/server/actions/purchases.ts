"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recomputeProject } from "@/server/services/project-service";

const Schema = z.object({
  projectId: z.string().min(1),
  supplierId: z.string().optional().nullable().transform(v => v || null),
  description: z.string().min(1),
  category: z.enum(["HARDWARE","LICENSE","SUBCONTRACTING","TRAVEL","TRAINING","OTHER"]).default("OTHER"),
  amount: z.coerce.number().nonnegative(),
  purchaseDate: z.string().min(1).transform(v => new Date(v)),
  status: z.enum(["PLANNED","ORDERED","RECEIVED","PAID","CANCELLED"]).default("PLANNED"),
  comment: z.string().optional().nullable()
});

export async function createPurchase(formData: FormData) {
  const session = await requirePermission("purchases.write");
  const data = Schema.parse(Object.fromEntries(formData));
  const p = await prisma.purchase.create({ data: { ...data, createdById: session.user.id } });
  await recomputeProject(p.projectId);
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "Purchase", entityId: p.id, message: `Achat '${p.description}' (${Number(p.amount)}€) créé` });
  revalidatePath("/purchases"); revalidatePath(`/projects/${p.projectId}`);
  redirect("/purchases");
}

export async function updatePurchase(id: string, formData: FormData) {
  const session = await requirePermission("purchases.write");
  const before = await prisma.purchase.findUniqueOrThrow({ where: { id } });
  const data = Schema.parse(Object.fromEntries(formData));
  const after = await prisma.purchase.update({ where: { id }, data });
  await recomputeProject(after.projectId);
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "Purchase", entityId: id, message: `Achat mis à jour`, before, after });
  revalidatePath("/purchases"); revalidatePath(`/projects/${after.projectId}`);
}

export async function deletePurchase(id: string) {
  const session = await requirePermission("purchases.write");
  const before = await prisma.purchase.findUniqueOrThrow({ where: { id } });
  const p = await prisma.purchase.delete({ where: { id } });
  await recomputeProject(p.projectId);
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "Purchase", entityId: id, message: "Achat supprimé", before });
  revalidatePath("/purchases"); revalidatePath(`/projects/${p.projectId}`);
}
