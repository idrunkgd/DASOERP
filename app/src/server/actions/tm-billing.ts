"use server";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { generateMonthlyTMBilling } from "@/server/services/tm-billing";

export async function generateTMForMonth(projectId: string, monthISO: string) {
  const session = await requirePermission("finance.write");
  const m = await generateMonthlyTMBilling(projectId, new Date(monthISO));
  await logActivity({
    actorId: session.user.id, action: "CREATE", entityType: "BillingMilestone", entityId: m.id,
    message: `Tranche T&M générée : ${m.label} — ${Number(m.amount)}€`
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/finance");
}
