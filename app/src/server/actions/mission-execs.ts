"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { convertApplicationToMission } from "@/server/services/mission-service";
import type { MissionExecutionStatus } from "@prisma/client";

const Schema = z.object({
  title: z.string().min(1),
  consultantId: z.string().optional().nullable().transform(v => v || null),
  companyId: z.string().min(1),
  intermediaryCompanyId: z.string().optional().nullable().transform(v => v || null),
  intermediaryContactId: z.string().optional().nullable().transform(v => v || null),
  startDate: z.string().min(1).transform(v => new Date(v)),
  endDate:   z.string().min(1).transform(v => new Date(v)),
  actualEndDate: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  estimatedDays: z.coerce.number().int().nonnegative().optional().nullable(),
  dailyRate: z.coerce.number().nonnegative(),
  dailyCost: z.coerce.number().nonnegative(),
  workLocation: z.string().optional().nullable(),
  billingFrequency: z.enum(["MONTHLY","WEEKLY","CUSTOM"]).default("MONTHLY"),
  status: z.enum(["PLANNED","ACTIVE","EXTENDED","COMPLETED","CANCELLED","ON_HOLD"]).default("PLANNED"),
  notes: z.string().optional().nullable()
});

export async function updateMissionExec(id: string, formData: FormData) {
  const session = await requirePermission("consulting.write");
  const before = await prisma.mission.findUniqueOrThrow({ where: { id } });
  const data = Schema.parse(Object.fromEntries(formData));
  const after = await prisma.mission.update({ where: { id }, data });
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "Mission", entityId: id, message: `Mission ${before.reference} mise à jour`, before, after });
  revalidatePath(`/missions/${id}`); revalidatePath("/missions");
}

export async function setMissionExecStatus(id: string, newStatus: MissionExecutionStatus) {
  const session = await requirePermission("consulting.write");
  const before = await prisma.mission.findUniqueOrThrow({ where: { id } });
  const data: any = { status: newStatus };
  if (["COMPLETED","CANCELLED"].includes(newStatus) && !before.actualEndDate) data.actualEndDate = new Date();
  const after = await prisma.mission.update({ where: { id }, data });
  // Quand la mission se termine, le consultant peut redevenir disponible : on remet
  // son Candidate (s'il en avait un) en cohérence (laissé hors-périmètre auto).
  await logActivity({
    actorId: session.user.id, action: "STATUS_CHANGE", entityType: "Mission", entityId: id,
    message: `Mission ${before.reference} : ${before.status} → ${newStatus}`, before, after
  });
  revalidatePath(`/missions/${id}`); revalidatePath("/missions"); revalidatePath("/consultants");
}

export async function deleteMissionExec(id: string) {
  const session = await requirePermission("consulting.write");
  const before = await prisma.mission.findUniqueOrThrow({ where: { id } });
  if (before.status === "ACTIVE" || before.status === "EXTENDED") {
    throw new Error("Impossible de supprimer une mission active. Marquez-la d'abord comme terminée ou annulée.");
  }
  await prisma.mission.delete({ where: { id } });
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "Mission", entityId: id, message: `Mission ${before.reference} supprimée`, before });
  revalidatePath("/missions");
  redirect("/missions");
}

/** Conversion application SELECTED → Mission contractualisée (remplace l'ancien flux Offer/Project). */
export async function convertApplicationToMissionAction(applicationId: string) {
  const session = await requirePermission("consulting.write");
  const mission = await convertApplicationToMission({ actorId: session.user.id, applicationId });
  revalidatePath(`/mission-requests`);
  revalidatePath(`/missions`);
  redirect(`/missions/${mission.id}`);
}
