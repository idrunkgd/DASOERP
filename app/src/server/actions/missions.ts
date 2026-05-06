"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextMissionReference } from "@/lib/references";
import type { MissionStatus } from "@prisma/client";

const Schema = z.object({
  title: z.string().min(1),
  companyId: z.string().min(1),
  contactId: z.string().optional().nullable().transform(v => v || null),
  intermediaryCompanyId: z.string().optional().nullable().transform(v => v || null),
  intermediaryContactId: z.string().optional().nullable().transform(v => v || null),
  ownerId: z.string().optional().nullable().transform(v => v || null),
  status: z.enum(["NEW","QUALIFYING","PRESENTING","CONTRACTED","LOST","CANCELLED"]).default("NEW"),
  description: z.string().optional().nullable(),
  requiredSkills: z.string().optional().transform(v => v ? v.split(",").map(s => s.trim()).filter(Boolean) : []),
  seniority: z.string().optional().nullable(),
  workLocation: z.string().optional().nullable(),
  startDate: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  endDate: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  estimatedDays: z.coerce.number().int().nonnegative().optional().nullable(),
  targetDailyRate: z.coerce.number().nonnegative().optional().nullable(),
  maxDailyRate: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
  lostReason: z.string().optional().nullable()
});

export async function createMission(formData: FormData) {
  const session = await requirePermission("consulting.write");
  const data = Schema.parse(Object.fromEntries(formData));
  const reference = await nextMissionReference();
  const m = await prisma.missionRequest.create({ data: { ...data, reference, ownerId: data.ownerId ?? session.user.id } });
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "MissionRequest", entityId: m.id, message: `Demande ${reference} créée`, after: m });
  revalidatePath("/mission-requests");
  redirect(`/mission-requests/${m.id}`);
}

export async function updateMission(id: string, formData: FormData) {
  const session = await requirePermission("consulting.write");
  const before = await prisma.missionRequest.findUniqueOrThrow({ where: { id } });
  const data = Schema.parse(Object.fromEntries(formData));
  const after = await prisma.missionRequest.update({ where: { id }, data });
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "MissionRequest", entityId: id, message: `Demande mise à jour`, before, after });
  revalidatePath(`/mission-requests/${id}`); revalidatePath("/mission-requests");
}

export async function setMissionStatus(id: string, newStatus: MissionStatus, lostReason?: string | null) {
  const session = await requirePermission("consulting.write");
  const before = await prisma.missionRequest.findUniqueOrThrow({ where: { id } });
  const data: any = { status: newStatus };
  if (["CONTRACTED","LOST","CANCELLED"].includes(newStatus)) data.closedAt = new Date();
  if (newStatus === "LOST" && lostReason) data.lostReason = lostReason;
  const after = await prisma.missionRequest.update({ where: { id }, data });
  await logActivity({ actorId: session.user.id, action: "STATUS_CHANGE", entityType: "MissionRequest", entityId: id, message: `Demande ${before.reference} : ${before.status} → ${newStatus}`, before, after });
  revalidatePath(`/mission-requests/${id}`); revalidatePath("/mission-requests");
}

export async function deleteMission(id: string) {
  const session = await requirePermission("consulting.write");
  const before = await prisma.missionRequest.findUniqueOrThrow({ where: { id } });
  await prisma.missionRequest.delete({ where: { id } });
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "MissionRequest", entityId: id, message: `Demande ${before.reference} supprimée`, before });
  revalidatePath("/mission-requests");
  redirect("/mission-requests");
}
