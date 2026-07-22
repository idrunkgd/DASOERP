"use server";
/**
 * Demandes de congés (LeaveRequest).
 *
 * Workflow :
 *   DRAFT ──submit──▶ SUBMITTED ──approve──▶ APPROVED
 *                                └──reject──▶ REJECTED
 *   L'auteur peut annuler à tout moment (CANCELLED).
 *
 * Le calcul du solde reste dans lib/leave-balance.ts pour être réutilisable
 * côté page /me et /leaves (RH).
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, getUserEffectivePermissions } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de début requise"),
  endDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin requise"),
  /// Nombre de jours ouvrés — accepte les demi-journées (0.5 pas).
  days:        z.coerce.number().positive("Nombre de jours requis").max(365),
  type:        z.enum(["ANNUAL", "RTT", "UNPAID", "SPECIAL", "OTHER"])
    .default("ANNUAL"),
  reason:      z.string().max(500).optional().nullable()
    .transform((v) => v?.trim() || null),
  notes:       z.string().max(1000).optional().nullable()
    .transform((v) => v?.trim() || null),
  missionId:   z.string().optional().nullable()
    .transform((v) => v || null),
  clientApproved: z.coerce.boolean().optional().default(false),
  clientApprovalNotes: z.string().max(500).optional().nullable()
    .transform((v) => v?.trim() || null)
});

/**
 * Calcule le nombre de jours ouvrés entre deux dates (lun-ven).
 * Utile comme suggestion côté front, l'utilisateur peut ensuite ajuster
 * pour les demi-journées.
 */
export async function suggestBusinessDays(start: string, end: string): Promise<number> {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  let n = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getUTCDay(); // 0=dim, 6=sam
    if (day !== 0 && day !== 6) n++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return n;
}

export async function createLeaveRequest(formData: FormData) {
  const session = await requirePermission("leaves.write");
  const data = Schema.parse(Object.fromEntries(formData));
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end < start) throw new Error("La date de fin doit être après la date de début.");

  const created = await prisma.leaveRequest.create({
    data: {
      userId: session.user.id,
      startDate: start,
      endDate: end,
      days: data.days,
      type: data.type,
      reason: data.reason,
      notes: data.notes,
      missionId: data.missionId,
      clientApproved: data.clientApproved,
      clientApprovalNotes: data.clientApprovalNotes,
      status: "DRAFT"
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "LeaveRequest",
    entityId: created.id,
    message: `Demande de congé créée (${data.days}j du ${data.startDate} au ${data.endDate})`
  });
  revalidatePath("/me");
  revalidatePath("/leaves");
  return { ok: true, id: created.id };
}

export async function updateLeaveRequest(id: string, formData: FormData) {
  const session = await requirePermission("leaves.write");
  const existing = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!existing) throw new Error("Demande introuvable");
  if (existing.userId !== session.user.id) {
    throw new Error("Modification réservée à l'auteur.");
  }
  if (existing.status !== "DRAFT") {
    throw new Error("La demande n'est plus en brouillon — annule la soumission d'abord.");
  }
  const data = Schema.parse(Object.fromEntries(formData));
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end < start) throw new Error("La date de fin doit être après la date de début.");
  await prisma.leaveRequest.update({
    where: { id },
    data: {
      startDate: start, endDate: end, days: data.days, type: data.type,
      reason: data.reason, notes: data.notes,
      missionId: data.missionId,
      clientApproved: data.clientApproved,
      clientApprovalNotes: data.clientApprovalNotes
    }
  });
  revalidatePath("/me");
  revalidatePath("/leaves");
  return { ok: true };
}

export async function submitLeaveRequest(id: string) {
  const session = await requirePermission("leaves.write");
  const existing = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!existing) throw new Error("Demande introuvable");
  if (existing.userId !== session.user.id) throw new Error("Réservé à l'auteur.");
  if (existing.status !== "DRAFT") throw new Error("Déjà soumise.");
  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "SUBMITTED", submittedAt: new Date() }
  });
  await logActivity({
    actorId: session.user.id, action: "STATUS_CHANGE",
    entityType: "LeaveRequest", entityId: id,
    message: "Demande de congé soumise"
  });
  revalidatePath("/me");
  revalidatePath("/leaves");
}

export async function approveLeaveRequest(id: string, approve: boolean, rejectionReason?: string) {
  const session = await requirePermission("leaves.approve");
  const existing = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!existing) throw new Error("Demande introuvable");
  if (existing.status !== "SUBMITTED") throw new Error("La demande doit être SUBMITTED.");
  await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: approve ? "APPROVED" : "REJECTED",
      approvedById: session.user.id,
      approvedAt: new Date(),
      rejectionReason: approve ? null : (rejectionReason ?? "Non précisé")
    }
  });
  await logActivity({
    actorId: session.user.id, action: "STATUS_CHANGE",
    entityType: "LeaveRequest", entityId: id,
    message: approve ? "Congé approuvé" : `Congé refusé (${rejectionReason ?? "n/a"})`
  });
  revalidatePath("/me");
  revalidatePath("/leaves");
}

/** L'auteur peut annuler à tout moment (avant approbation ou même après). */
export async function cancelLeaveRequest(id: string) {
  const session = await requirePermission("leaves.write");
  const existing = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!existing) throw new Error("Demande introuvable");
  if (existing.userId !== session.user.id) {
    // Un manager peut aussi annuler si users.manage
    const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
    if (!perms.includes("leaves.approve") && !perms.includes("users.manage")) {
      throw new Error("Annulation réservée à l'auteur ou à un manager.");
    }
  }
  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "CANCELLED" }
  });
  await logActivity({
    actorId: session.user.id, action: "STATUS_CHANGE",
    entityType: "LeaveRequest", entityId: id,
    message: "Demande de congé annulée"
  });
  revalidatePath("/me");
  revalidatePath("/leaves");
}

export async function deleteLeaveRequest(id: string) {
  const session = await requirePermission("leaves.write");
  const existing = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!existing) throw new Error("Demande introuvable");
  if (existing.userId !== session.user.id) {
    const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
    if (!perms.includes("users.manage")) {
      throw new Error("Suppression réservée à l'auteur ou à un admin.");
    }
  }
  await prisma.leaveRequest.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id, action: "DELETE",
    entityType: "LeaveRequest", entityId: id,
    message: "Demande de congé supprimée"
  });
  revalidatePath("/me");
  revalidatePath("/leaves");
}
