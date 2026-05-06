"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  userId: z.string().min(1),
  target: z.string().min(1),    // "PRJ:<id>" ou "CC:<id>"
  startDate: z.string().min(1).transform(v => new Date(v)),
  endDate:   z.string().min(1).transform(v => new Date(v)),
  hoursPerDay: z.coerce.number().optional().nullable(),
  loadPct:     z.coerce.number().optional().nullable(),
  activityType: z.enum(["ANALYSIS","DEVELOPMENT","PROJECT_MANAGEMENT","MEETING","SUPPORT","TRAINING","COMMERCIAL","ADMINISTRATIVE","OTHER"]).default("DEVELOPMENT"),
  comment: z.string().optional().nullable()
});

function parseTarget(target: string) {
  const [kind, id] = target.split(":");
  if (kind === "PRJ" && id) return { projectId: id, missionId: null, costCenterId: null };
  if (kind === "MIS" && id) return { projectId: null, missionId: id, costCenterId: null };
  if (kind === "CC"  && id) return { projectId: null, missionId: null, costCenterId: id };
  throw new Error("Cible invalide (projet, mission ou centre de coût)");
}

export async function createPlanning(formData: FormData) {
  const session = await requirePermission("planning.write");
  const parsed = Schema.parse(Object.fromEntries(formData));
  const { target, ...rest } = parsed;
  if (rest.endDate < rest.startDate) throw new Error("Date de fin avant date de début");
  const created = await prisma.planningEntry.create({ data: { ...rest, ...parseTarget(target) } });
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "PlanningEntry", entityId: created.id, message: `Affectation créée`, after: created });
  revalidatePath("/planning");
}

export async function deletePlanning(id: string) {
  const session = await requirePermission("planning.write");
  const before = await prisma.planningEntry.findUniqueOrThrow({ where: { id } });
  await prisma.planningEntry.delete({ where: { id } });
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "PlanningEntry", entityId: id, message: "Affectation supprimée", before });
  revalidatePath("/planning");
}
