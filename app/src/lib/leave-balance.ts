/**
 * Calcul du solde de congés — 3 buckets : Légaux, RTT, Année précédente.
 *
 * Solde par bucket = entitled (dans LeaveBalance) - jours consommés
 *   par les LeaveRequest APPROVED (et éventuellement en attente pour un
 *   "worst case").
 *
 * Rattachement demande → bucket :
 *   LeaveRequest.type = ANNUAL       → bucket ANNUAL_LEGAL
 *   LeaveRequest.type = RTT          → bucket RTT
 *   LeaveRequest.type = CARRIED_OVER → bucket CARRIED_OVER
 *   Autres (UNPAID, SPECIAL, OTHER)  → aucun bucket (pas de décompte)
 */
import { prisma } from "@/lib/db";

export type LeaveBucketBalance = {
  entitled: number;
  approved: number;
  pending: number;
  remaining: number;
  remainingIfAllApproved: number;
};

export type LeaveBalanceByBucket = {
  year: number;
  annualLegal: LeaveBucketBalance;
  rtt: LeaveBucketBalance;
  carriedOver: LeaveBucketBalance;
  total: LeaveBucketBalance;  // somme des 3 pour vue synthétique
};

function emptyBucket(): LeaveBucketBalance {
  return {
    entitled: 0, approved: 0, pending: 0,
    remaining: 0, remainingIfAllApproved: 0
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function computeLeaveBalance(
  userId: string,
  year?: number
): Promise<LeaveBalanceByBucket> {
  const y = year ?? new Date().getUTCFullYear();
  const yearStart = new Date(Date.UTC(y, 0, 1));
  const yearEnd = new Date(Date.UTC(y, 11, 31, 23, 59, 59));

  const [balances, requests, user] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { userId, year: y }
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId,
        type: { in: ["ANNUAL", "RTT", "CARRIED_OVER"] },
        status: { in: ["APPROVED", "SUBMITTED"] },
        startDate: { gte: yearStart, lte: yearEnd }
      },
      select: { days: true, status: true, type: true }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { annualLeaveDays: true, rttDays: true }
    })
  ]);

  const annualLegal = emptyBucket();
  const rtt = emptyBucket();
  const carriedOver = emptyBucket();

  // Entitled — depuis LeaveBalance si présent, sinon fallback sur User
  // (utile la première année, avant qu'un rollover ait été fait).
  const balanceByType = new Map(balances.map((b) => [b.type, Number(b.entitled)]));
  annualLegal.entitled = balanceByType.get("ANNUAL_LEGAL") ?? user?.annualLeaveDays ?? 20;
  rtt.entitled         = balanceByType.get("RTT")          ?? user?.rttDays ?? 12;
  carriedOver.entitled = balanceByType.get("CARRIED_OVER") ?? 0;

  // Consommation par bucket selon le type de la demande.
  for (const r of requests) {
    const d = Number(r.days);
    const bucket =
      r.type === "ANNUAL"       ? annualLegal :
      r.type === "RTT"          ? rtt :
      r.type === "CARRIED_OVER" ? carriedOver : null;
    if (!bucket) continue;
    if (r.status === "APPROVED") bucket.approved += d;
    else if (r.status === "SUBMITTED") bucket.pending += d;
  }

  const finish = (b: LeaveBucketBalance) => {
    b.entitled = round(b.entitled);
    b.approved = round(b.approved);
    b.pending = round(b.pending);
    b.remaining = round(b.entitled - b.approved);
    b.remainingIfAllApproved = round(b.entitled - b.approved - b.pending);
    return b;
  };
  finish(annualLegal); finish(rtt); finish(carriedOver);

  const total: LeaveBucketBalance = {
    entitled: round(annualLegal.entitled + rtt.entitled + carriedOver.entitled),
    approved: round(annualLegal.approved + rtt.approved + carriedOver.approved),
    pending:  round(annualLegal.pending  + rtt.pending  + carriedOver.pending),
    remaining: 0, remainingIfAllApproved: 0
  };
  total.remaining = round(total.entitled - total.approved);
  total.remainingIfAllApproved = round(total.remaining - total.pending);

  return { year: y, annualLegal, rtt, carriedOver, total };
}
