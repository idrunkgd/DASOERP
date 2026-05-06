"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const Schema = z.object({
  code: z.string().min(1).transform(v => v.toUpperCase()),
  name: z.string().min(1),
  kind: z.enum(["SALES","LEAVE","MEETING","ADMIN","TRAINING","RND","OTHER"]).default("OTHER"),
  active: z.coerce.boolean().default(true),
  countsAsBillable: z.coerce.boolean().default(false),
  description: z.string().optional().nullable()
});

export async function createCostCenter(formData: FormData) {
  const session = await requirePermission("settings.manage");
  const data = Schema.parse(Object.fromEntries(formData));
  const c = await prisma.costCenter.create({ data });
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "CostCenter", entityId: c.id, message: `Centre de coût ${c.code} créé`, after: c });
  revalidatePath("/cost-centers");
  redirect("/cost-centers");
}

export async function updateCostCenter(id: string, formData: FormData) {
  const session = await requirePermission("settings.manage");
  const before = await prisma.costCenter.findUniqueOrThrow({ where: { id } });
  const data = Schema.parse(Object.fromEntries(formData));
  const after = await prisma.costCenter.update({ where: { id }, data });
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "CostCenter", entityId: id, message: `Centre ${after.code} mis à jour`, before, after });
  revalidatePath("/cost-centers");
}

export async function deleteCostCenter(id: string) {
  const session = await requirePermission("settings.manage");
  const before = await prisma.costCenter.findUniqueOrThrow({ where: { id } });
  await prisma.costCenter.delete({ where: { id } });
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "CostCenter", entityId: id, message: `Centre ${before.code} supprimé`, before });
  revalidatePath("/cost-centers");
}
