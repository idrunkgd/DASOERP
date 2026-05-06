"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { recomputeProject } from "@/server/services/project-service";

// target = "PRJ:<id>" ou "CC:<id>" pour pouvoir choisir indifféremment
const Schema = z.object({
  target: z.string().min(1),
  date: z.string().min(1).transform(v => new Date(v)),
  hours: z.coerce.number().positive(),
  activityType: z.enum(["ANALYSIS","DEVELOPMENT","PROJECT_MANAGEMENT","MEETING","SUPPORT","TRAINING","COMMERCIAL","ADMINISTRATIVE","OTHER"]).default("DEVELOPMENT"),
  description: z.string().optional().nullable()
});

function parseTarget(target: string) {
  const [kind, id] = target.split(":");
  if (kind === "PRJ" && id) return { projectId: id, missionId: null, costCenterId: null };
  if (kind === "MIS" && id) return { projectId: null, missionId: id, costCenterId: null };
  if (kind === "CC"  && id) return { projectId: null, missionId: null, costCenterId: id };
  throw new Error("Cible invalide (projet, mission ou centre de coût)");
}

export async function upsertEntry(formData: FormData) {
  const session = await requirePermission("timesheet.self.write");
  const id = (formData.get("id") || "").toString() || null;
  const parsed = Schema.parse(Object.fromEntries(formData));
  const { target, ...rest } = parsed;
  const targetIds = parseTarget(target);
  const data = { ...rest, ...targetIds };
  if (id) {
    const existing = await prisma.timesheetEntry.findUniqueOrThrow({ where: { id } });
    if (existing.userId !== session.user.id) {
      const sp = await getUserEffectivePermissions(session.user.id, session.user.role);
      if (!sp.includes("timesheet.validate")) throw new Error("Forbidden");
    }
    if (existing.status === "APPROVED") throw new Error("Entrée déjà validée");
    await prisma.timesheetEntry.update({ where: { id }, data });
  } else {
    await prisma.timesheetEntry.create({ data: { ...data, userId: session.user.id, status: "DRAFT" } });
  }
  revalidatePath("/timesheet");
}

export async function deleteEntry(id: string) {
  const session = await requireSession();
  const e = await prisma.timesheetEntry.findUniqueOrThrow({ where: { id } });
  if (e.userId !== session.user.id) {
    const sp = await getUserEffectivePermissions(session.user.id, session.user.role);
    if (!sp.includes("timesheet.validate")) throw new Error("Forbidden");
  }
  if (e.status === "APPROVED") throw new Error("Entrée déjà validée");
  await prisma.timesheetEntry.delete({ where: { id } });
  revalidatePath("/timesheet");
}

export async function submitWeek(weekStartISO: string) {
  const session = await requirePermission("timesheet.self.write");
  const start = new Date(weekStartISO);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  const updated = await prisma.timesheetEntry.updateMany({
    where: { userId: session.user.id, date: { gte: start, lt: end }, status: "DRAFT" },
    data: { status: "SUBMITTED" }
  });
  await logActivity({
    actorId: session.user.id, action: "TIMESHEET_SUBMITTED", entityType: "TimesheetEntry",
    message: `${updated.count} entrée(s) soumises pour validation (semaine ${weekStartISO.slice(0, 10)})`
  });
  revalidatePath("/timesheet");
  return updated.count;
}

export async function approveEntry(id: string) {
  const session = await requirePermission("timesheet.validate");
  const e = await prisma.timesheetEntry.findUniqueOrThrow({ where: { id }, include: { user: true } });
  const computedCost = Number(e.hours) * Number(e.user.hourlyCost ?? 0);
  await prisma.timesheetEntry.update({
    where: { id },
    data: { status: "APPROVED", validatorId: session.user.id, validatedAt: new Date(), computedCost }
  });
  if (e.projectId) await recomputeProject(e.projectId);
  await logActivity({
    actorId: session.user.id, action: "TIMESHEET_APPROVED", entityType: "TimesheetEntry", entityId: id,
    message: `Timesheet ${e.user.firstName} ${e.user.lastName} ${Number(e.hours)}h validé`
  });
  revalidatePath("/timesheet");
}

/**
 * Saisie inline d'une cellule de la grille timesheet :
 * - 1 entrée DRAFT par (user, projectId/costCenterId, date)
 * - hours = 0 → suppression
 * - écrase si existe déjà (impossible si APPROVED)
 */
const CellSchema = z.object({
  target: z.string().min(1),                                    // "PRJ:<id>" | "CC:<id>"
  date: z.string().min(1).transform(v => new Date(v)),
  hours: z.coerce.number().min(0).max(24),
  activityType: z.enum(["ANALYSIS","DEVELOPMENT","PROJECT_MANAGEMENT","MEETING","SUPPORT","TRAINING","COMMERCIAL","ADMINISTRATIVE","OTHER"]).default("DEVELOPMENT"),
  description: z.string().optional().nullable()
});

export async function upsertCell(formData: FormData) {
  const session = await requirePermission("timesheet.self.write");
  const data = CellSchema.parse(Object.fromEntries(formData));
  const targetIds = parseTarget(data.target);
  const userId = session.user.id;

  const sp = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canValidate = sp.includes("timesheet.validate");

  // Si projet : vérifier appartenance équipe (sauf rôles avec timesheet.validate)
  if (targetIds.projectId && !canValidate) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: targetIds.projectId, userId } }
    });
    if (!member) throw new Error("Vous ne faites pas partie de l'équipe de ce projet.");
  }
  // Si mission : vérifier que c'est bien le consultant assigné
  if (targetIds.missionId && !canValidate) {
    const mission = await prisma.mission.findUnique({ where: { id: targetIds.missionId }, select: { consultantId: true } });
    if (mission?.consultantId !== userId) throw new Error("Vous n'êtes pas le consultant assigné à cette mission.");
  }

  const existing = await prisma.timesheetEntry.findFirst({
    where: {
      userId,
      projectId:    targetIds.projectId    ?? undefined,
      missionId:    targetIds.missionId    ?? undefined,
      costCenterId: targetIds.costCenterId ?? undefined,
      date: data.date
    }
  });

  if (data.hours === 0) {
    if (existing) {
      if (existing.status === "APPROVED") throw new Error("Entrée déjà validée — impossible de supprimer.");
      await prisma.timesheetEntry.delete({ where: { id: existing.id } });
    }
    revalidatePath("/timesheet");
    return;
  }

  if (existing) {
    if (existing.status === "APPROVED") throw new Error("Entrée déjà validée — impossible de modifier.");
    await prisma.timesheetEntry.update({
      where: { id: existing.id },
      data: { hours: data.hours, activityType: data.activityType, description: data.description ?? existing.description }
    });
  } else {
    await prisma.timesheetEntry.create({
      data: { userId, ...targetIds, date: data.date, hours: data.hours, activityType: data.activityType, description: data.description, status: "DRAFT" }
    });
  }
  revalidatePath("/timesheet");
}

export async function rejectEntry(id: string, note: string) {
  const session = await requirePermission("timesheet.validate");
  const e = await prisma.timesheetEntry.findUniqueOrThrow({ where: { id } });
  await prisma.timesheetEntry.update({
    where: { id },
    data: { status: "REJECTED", validatorId: session.user.id, validationNote: note, validatedAt: new Date() }
  });
  await logActivity({
    actorId: session.user.id, action: "TIMESHEET_REJECTED", entityType: "TimesheetEntry", entityId: id,
    message: `Timesheet refusé: ${note}`
  });
  revalidatePath("/timesheet");
}
