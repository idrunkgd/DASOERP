import { prisma } from "@/lib/db";
import { startOfWeek, endOfWeek, eachDayOfInterval, isWeekend } from "date-fns";

/**
 * Charge planifiée (heures) d'un user sur une semaine donnée.
 * Pour chaque PlanningEntry qui chevauche la semaine, additionne hoursPerDay × jours ouvrés du chevauchement.
 * Si seulement loadPct défini, applique pct × capacité hebdo / 5.
 */
export async function userPlannedHoursForWeek(userId: string, anyDateInWeek: Date) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const weekStart = startOfWeek(anyDateInWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(anyDateInWeek, { weekStartsOn: 1 });
  const entries = await prisma.planningEntry.findMany({
    where: { userId, startDate: { lte: weekEnd }, endDate: { gte: weekStart } }
  });
  const dailyCap = Number(user.weeklyCapacityH) / 5;
  let total = 0;
  for (const e of entries) {
    const overlapStart = e.startDate < weekStart ? weekStart : e.startDate;
    const overlapEnd   = e.endDate   > weekEnd   ? weekEnd   : e.endDate;
    const days = eachDayOfInterval({ start: overlapStart, end: overlapEnd }).filter(d => !isWeekend(d));
    const hpd = e.hoursPerDay
      ? Number(e.hoursPerDay)
      : (e.loadPct ? (Number(e.loadPct) / 100) * dailyCap : 0);
    total += days.length * hpd;
  }
  return Math.round(total * 10) / 10;
}

export async function userOverloadedThisWeek(userId: string, date = new Date()) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const planned = await userPlannedHoursForWeek(userId, date);
  return planned > Number(user.weeklyCapacityH);
}
