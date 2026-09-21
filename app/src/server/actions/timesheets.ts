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

/**
 * Résout l'utilisateur cible pour une action de saisie timesheet.
 * - Si `onBehalfOfUserId` fourni ET actor a `timesheet.validate` → utilise cet ID
 *   (saisie déléguée par un admin/manager pour un consultant)
 * - Sinon → session.user.id (saisie personnelle)
 * Retourne { userId, isDelegated, canValidate }
 */
async function resolveTargetUser(session: { user: { id: string; role: any } }, onBehalfOfUserId?: string | null) {
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canValidate = perms.includes("timesheet.validate");
  if (onBehalfOfUserId && onBehalfOfUserId !== session.user.id) {
    if (!canValidate) throw new Error("Forbidden: seuls Admin/Manager peuvent saisir pour un autre utilisateur.");
    // Vérifier que l'utilisateur cible existe et est actif
    const target = await prisma.user.findUnique({ where: { id: onBehalfOfUserId }, select: { id: true, active: true } });
    if (!target || !target.active) throw new Error("Utilisateur cible introuvable ou inactif.");
    return { userId: onBehalfOfUserId, isDelegated: true, canValidate };
  }
  return { userId: session.user.id, isDelegated: false, canValidate };
}

export async function upsertEntry(formData: FormData) {
  const session = await requirePermission("timesheet.self.write");
  const id = (formData.get("id") || "").toString() || null;
  const onBehalf = (formData.get("onBehalfOfUserId") || "").toString() || null;
  const parsed = Schema.parse(Object.fromEntries(formData));
  const { target, ...rest } = parsed;
  const targetIds = parseTarget(target);
  const { userId, isDelegated } = await resolveTargetUser(session, onBehalf);
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
    await prisma.timesheetEntry.create({ data: { ...data, userId, status: "DRAFT" } });
    if (isDelegated) {
      await logActivity({
        actorId: session.user.id, action: "CREATE", entityType: "TimesheetEntry",
        message: `Saisie déléguée pour userId=${userId} · ${rest.hours}h le ${rest.date.toISOString().slice(0, 10)}`
      });
    }
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

export async function submitWeek(weekStartISO: string, onBehalfOfUserId?: string | null) {
  const session = await requirePermission("timesheet.self.write");
  const { userId, isDelegated } = await resolveTargetUser(session, onBehalfOfUserId ?? null);
  const start = new Date(weekStartISO);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  const updated = await prisma.timesheetEntry.updateMany({
    where: { userId, date: { gte: start, lt: end }, status: "DRAFT" },
    data: { status: "SUBMITTED" }
  });
  await logActivity({
    actorId: session.user.id, action: "TIMESHEET_SUBMITTED", entityType: "TimesheetEntry",
    message: `${updated.count} entrée(s) soumises pour validation (semaine ${weekStartISO.slice(0, 10)})${isDelegated ? ` — saisie déléguée pour userId=${userId}` : ""}`
  });
  // Notifier les valideurs (sauf l'acteur en cas de délégation par un admin)
  if (updated.count > 0) {
    const { createNotification, getUserIdsWithPermission } = await import("@/lib/notifications");
    const validators = await getUserIdsWithPermission("timesheet.validate", session.user.id);
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
    await createNotification({
      userId: validators,
      type: "TIMESHEET_SUBMITTED",
      title: `Timesheet à valider — ${target?.firstName ?? ""} ${target?.lastName ?? ""}`.trim(),
      message: `${updated.count} entrée(s) · semaine du ${weekStartISO.slice(0, 10)}${isDelegated ? " (saisie déléguée)" : ""}`,
      href: "/timesheet/validation",
      entityType: "TimesheetEntry"
    });
  }
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
 *
 * Le champ optionnel `onBehalfOfUserId` (dans le FormData) permet à un
 * Admin/Manager de saisir pour un consultant. Trace d'audit systématique.
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
  const onBehalf = (formData.get("onBehalfOfUserId") || "").toString() || null;
  const data = CellSchema.parse(Object.fromEntries(formData));
  const targetIds = parseTarget(data.target);
  const { userId, isDelegated, canValidate } = await resolveTargetUser(session, onBehalf);

  // Guards équipe/consultant : ne s'appliquent PAS quand l'acteur est un valideur
  // (Admin/Manager peut saisir n'importe quel projet pour un consultant délégué).
  if (targetIds.projectId && !canValidate) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: targetIds.projectId, userId } }
    });
    if (!member) throw new Error("Vous ne faites pas partie de l'équipe de ce projet.");
  }
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
    if (isDelegated) {
      await logActivity({
        actorId: session.user.id, action: "CREATE", entityType: "TimesheetEntry",
        message: `Saisie déléguée pour userId=${userId} · ${data.hours}h le ${data.date.toISOString().slice(0, 10)}`
      });
    }
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

/**
 * Saisie rapide en lot — remplit N jours d'un coup pour une même cible
 * (projet / mission / centre de coût). Utilisé par le drag & drop et le
 * bouton "Remplir la semaine" du grid.
 *
 * Le champ `onBehalfOfUserId` (input parameter) permet à un Admin/Manager
 * de remplir un timesheet pour un consultant. Trace d'audit.
 */
const BulkSchema = z.object({
  target: z.string().min(1),
  dates: z.array(z.string()).min(1).max(31),   // dates au format YYYY-MM-DD
  hours: z.coerce.number().min(0).max(24)
});

export async function upsertCellsBulk(input: { target: string; dates: string[]; hours: number; onBehalfOfUserId?: string | null }) {
  const session = await requirePermission("timesheet.self.write");
  const parsed = BulkSchema.parse(input);
  const targetIds = parseTarget(parsed.target);
  const { userId, isDelegated, canValidate } = await resolveTargetUser(session, input.onBehalfOfUserId ?? null);

  // Guards équipe / consultant (sautés en mode admin/valideur)
  if (targetIds.projectId && !canValidate) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: targetIds.projectId, userId } }
    });
    if (!member) throw new Error("Vous ne faites pas partie de l'équipe de ce projet.");
  }
  if (targetIds.missionId && !canValidate) {
    const mission = await prisma.mission.findUnique({ where: { id: targetIds.missionId }, select: { consultantId: true } });
    if (mission?.consultantId !== userId) throw new Error("Vous n'êtes pas le consultant assigné à cette mission.");
  }

  const dateObjs = parsed.dates.map((d) => new Date(d));
  const existing = await prisma.timesheetEntry.findMany({
    where: {
      userId,
      projectId:    targetIds.projectId    ?? undefined,
      missionId:    targetIds.missionId    ?? undefined,
      costCenterId: targetIds.costCenterId ?? undefined,
      date: { in: dateObjs }
    }
  });
  const existingByDate = new Map(existing.map((e) => [e.date.toISOString().slice(0, 10), e]));

  const ops: Promise<any>[] = [];
  let created = 0;
  for (const d of parsed.dates) {
    const ex = existingByDate.get(d);
    if (parsed.hours === 0) {
      if (ex && ex.status !== "APPROVED") {
        ops.push(prisma.timesheetEntry.delete({ where: { id: ex.id } }));
      }
      continue;
    }
    if (ex) {
      if (ex.status === "APPROVED") continue;  // pas touche
      ops.push(prisma.timesheetEntry.update({ where: { id: ex.id }, data: { hours: parsed.hours } }));
    } else {
      created++;
      ops.push(prisma.timesheetEntry.create({
        data: {
          userId, date: new Date(d), hours: parsed.hours,
          activityType: "DEVELOPMENT",
          status: "DRAFT",
          projectId:    targetIds.projectId    ?? undefined,
          missionId:    targetIds.missionId    ?? undefined,
          costCenterId: targetIds.costCenterId ?? undefined
        }
      }));
    }
  }
  await prisma.$transaction(ops as any);
  if (isDelegated && created > 0) {
    await logActivity({
      actorId: session.user.id, action: "CREATE", entityType: "TimesheetEntry",
      message: `Saisie déléguée en lot pour userId=${userId} · ${created} entrée(s) créée(s) à ${parsed.hours}h`
    });
  }
  revalidatePath("/timesheet");
  return { touched: ops.length };
}
