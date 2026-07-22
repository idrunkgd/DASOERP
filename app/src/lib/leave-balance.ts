/**
 * Calcul du solde de congés annuel d'un utilisateur.
 *
 * Solde = quota annuel (annualLeaveDays) - jours pris (APPROVED) - jours
 *         en cours d'approbation (SUBMITTED, considérés comme provisoire).
 *
 * On ne compte QUE le type ANNUAL par défaut (le RTT, SPECIAL, UNPAID ne
 * consomment pas le quota annuel de congés payés). Les demandes CANCELLED
 * ou REJECTED n'entrent pas dans le calcul.
 */
import { prisma } from "@/lib/db";

export type LeaveBalance = {
  year: number;
  entitled: number;   // quota annuel
  approved: number;   // jours déjà pris (APPROVED)
  pending: number;    // jours en attente d'approbation (SUBMITTED)
  remaining: number;  // entitled - approved
  remainingIfAllApproved: number; // entitled - approved - pending (worst case)
};

export async function computeLeaveBalance(
  userId: string,
  year?: number
): Promise<LeaveBalance> {
  const y = year ?? new Date().getUTCFullYear();
  const yearStart = new Date(Date.UTC(y, 0, 1));
  const yearEnd = new Date(Date.UTC(y, 11, 31, 23, 59, 59));

  const [user, requests] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { annualLeaveDays: true }
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId,
        type: "ANNUAL",
        status: { in: ["APPROVED", "SUBMITTED"] },
        // On considère qu'une demande relève de l'année de son startDate.
        // Cas croisant deux années (rare) : imputé sur l'année de départ.
        startDate: { gte: yearStart, lte: yearEnd }
      },
      select: { days: true, status: true }
    })
  ]);

  const entitled = user?.annualLeaveDays ?? 20;
  let approved = 0;
  let pending = 0;
  for (const r of requests) {
    const d = Number(r.days);
    if (r.status === "APPROVED") approved += d;
    else if (r.status === "SUBMITTED") pending += d;
  }
  return {
    year: y,
    entitled,
    approved: Math.round(approved * 10) / 10,
    pending: Math.round(pending * 10) / 10,
    remaining: Math.round((entitled - approved) * 10) / 10,
    remainingIfAllApproved: Math.round((entitled - approved - pending) * 10) / 10
  };
}
