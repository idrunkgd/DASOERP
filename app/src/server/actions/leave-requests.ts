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

/**
 * Rollover année N → N+1 pour un user donné :
 *   1. Récupère le solde restant en LÉGAUX + RTT de l'année N (non-consommés)
 *   2. Crée pour N+1 un bucket CARRIED_OVER = (reste légaux + reste RTT + reste ancien report)
 *   3. Crée pour N+1 les buckets ANNUAL_LEGAL = User.annualLeaveDays et
 *      RTT = User.rttDays (les nouveaux quotas fixes de l'année)
 *
 * Idempotent : si l'année cible a déjà des balances, on refuse (throw) pour
 * éviter les doubles-clics qui doubleraient les quotas.
 */
export async function rolloverLeaveYear(userId: string, targetYear?: number) {
  const session = await requirePermission("leaves.approve");
  const nextYear = targetYear ?? (new Date().getUTCFullYear() + 1);
  const currentYear = nextYear - 1;
  const existing = await prisma.leaveBalance.count({
    where: { userId, year: nextYear }
  });
  if (existing > 0) {
    throw new Error(`Les soldes ${nextYear} existent déjà pour cet utilisateur.`);
  }
  const [user, currentBalances, currentRequests] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { firstName: true, lastName: true, annualLeaveDays: true, rttDays: true }
    }),
    prisma.leaveBalance.findMany({ where: { userId, year: currentYear } }),
    prisma.leaveRequest.findMany({
      where: {
        userId,
        type: { in: ["ANNUAL", "RTT", "CARRIED_OVER"] },
        status: "APPROVED",
        startDate: { gte: new Date(Date.UTC(currentYear, 0, 1)) },
        endDate:   { lte: new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59)) }
      },
      select: { days: true, type: true }
    })
  ]);
  const balanceByType = new Map(currentBalances.map((b) => [b.type, Number(b.entitled)]));
  const usedByType = { ANNUAL: 0, RTT: 0, CARRIED_OVER: 0 };
  for (const r of currentRequests) {
    if (r.type === "ANNUAL") usedByType.ANNUAL += Number(r.days);
    else if (r.type === "RTT") usedByType.RTT += Number(r.days);
    else if (r.type === "CARRIED_OVER") usedByType.CARRIED_OVER += Number(r.days);
  }
  const legalRemaining = Math.max(0,
    (balanceByType.get("ANNUAL_LEGAL") ?? user.annualLeaveDays) - usedByType.ANNUAL);
  const rttRemaining = Math.max(0,
    (balanceByType.get("RTT") ?? user.rttDays) - usedByType.RTT);
  const carriedRemaining = Math.max(0,
    (balanceByType.get("CARRIED_OVER") ?? 0) - usedByType.CARRIED_OVER);
  const newCarriedOver = legalRemaining + rttRemaining + carriedRemaining;

  await prisma.leaveBalance.createMany({
    data: [
      { userId, year: nextYear, type: "ANNUAL_LEGAL", entitled: user.annualLeaveDays },
      { userId, year: nextYear, type: "RTT",          entitled: user.rttDays },
      {
        userId, year: nextYear, type: "CARRIED_OVER",
        entitled: newCarriedOver,
        notes: `Report ${currentYear} : ${legalRemaining}j légaux + ${rttRemaining}j RTT + ${carriedRemaining}j ancien report`
      }
    ]
  });
  await logActivity({
    actorId: session.user.id, action: "CREATE",
    entityType: "LeaveBalance", entityId: `${userId}-${nextYear}`,
    message: `Soldes ${nextYear} créés pour ${user.firstName} ${user.lastName} — ${user.annualLeaveDays}j légaux + ${user.rttDays}j RTT + ${newCarriedOver}j report`
  });
  revalidatePath("/leaves");
  revalidatePath(`/users/${userId}`);
  return { ok: true, legalRemaining, rttRemaining, carriedRemaining,
    newCarriedOver, entitledLegal: user.annualLeaveDays, entitledRtt: user.rttDays };
}

/** Rollover pour TOUS les users actifs — un simple bouton RH. */
export async function rolloverLeaveYearAll(targetYear?: number) {
  await requirePermission("leaves.approve");
  const nextYear = targetYear ?? (new Date().getUTCFullYear() + 1);
  const activeUsers = await prisma.user.findMany({
    where: { active: true, candidateProfile: { is: null } },
    select: { id: true, firstName: true, lastName: true }
  });
  const results: { userId: string; name: string; ok: boolean; error?: string }[] = [];
  for (const u of activeUsers) {
    try {
      await rolloverLeaveYear(u.id, nextYear);
      results.push({ userId: u.id, name: `${u.firstName} ${u.lastName}`, ok: true });
    } catch (e: any) {
      results.push({ userId: u.id, name: `${u.firstName} ${u.lastName}`, ok: false, error: e?.message });
    }
  }
  revalidatePath("/leaves");
  return {
    ok: true, total: activeUsers.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length, results
  };
}

const Schema = z.object({
  startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de début requise"),
  endDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin requise"),
  /// Nombre de jours ouvrés — accepte les demi-journées (0.5 pas).
  days:        z.coerce.number().positive("Nombre de jours requis").max(365),
  type:        z.enum(["ANNUAL", "RTT", "CARRIED_OVER", "UNPAID", "SPECIAL", "OTHER"])
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
