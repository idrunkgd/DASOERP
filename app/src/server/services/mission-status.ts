import { prisma } from "@/lib/db";
import { addDays } from "date-fns";

export type MissionAssignment = {
  missionId: string;
  reference: string;
  title: string;
  companyName: string;
  startDate: Date;
  endDate: Date;
  dailyRate: number;
  status: string;
};

export type ConsultantMissionStatus =
  | { state: "on_mission"; current: MissionAssignment[]; upcoming: MissionAssignment[]; latestEnd: Date }
  | { state: "scheduled"; current: []; upcoming: MissionAssignment[]; nextStart: Date }
  | { state: "available"; current: []; upcoming: [] };

/**
 * Statut mission d'un consultant à une date donnée — basé sur l'entité Mission
 * (T&M, distinct de Project). Une mission ACTIVE ou EXTENDED qui couvre la date
 * = "en mission". Une mission PLANNED/ACTIVE future dans <60j = "programmé".
 */
export async function getConsultantMissionStatus(userId: string, when: Date = new Date()): Promise<ConsultantMissionStatus> {
  const horizon = addDays(when, 60);
  const [current, upcoming] = await Promise.all([
    prisma.mission.findMany({
      where: {
        consultantId: userId,
        status: { in: ["ACTIVE", "EXTENDED"] },
        startDate: { lte: when },
        OR: [
          { actualEndDate: null, endDate: { gte: when } },
          { actualEndDate: { gte: when } }
        ]
      },
      include: { company: true },
      orderBy: { endDate: "desc" }
    }),
    prisma.mission.findMany({
      where: {
        consultantId: userId,
        status: { in: ["PLANNED", "ACTIVE", "EXTENDED"] },
        startDate: { gt: when, lte: horizon }
      },
      include: { company: true },
      orderBy: { startDate: "asc" }
    })
  ]);

  const map = (m: any): MissionAssignment => ({
    missionId: m.id,
    reference: m.reference,
    title: m.title,
    companyName: m.company.name,
    startDate: m.startDate,
    endDate: m.actualEndDate ?? m.endDate,
    dailyRate: Number(m.dailyRate),
    status: m.status
  });

  if (current.length > 0) {
    const mapped = current.map(map);
    const latestEnd = mapped.reduce((m, e) => e.endDate > m ? e.endDate : m, mapped[0].endDate);
    return { state: "on_mission", current: mapped, upcoming: upcoming.map(map), latestEnd };
  }
  if (upcoming.length > 0) {
    const mapped = upcoming.map(map);
    return { state: "scheduled", current: [], upcoming: mapped, nextStart: mapped[0].startDate };
  }
  return { state: "available", current: [], upcoming: [] };
}

export async function getConsultantMissionStatusBatch(
  userIds: string[],
  when: Date = new Date()
): Promise<Map<string, ConsultantMissionStatus>> {
  if (userIds.length === 0) return new Map();
  const horizon = addDays(when, 60);
  const [allCurrent, allUpcoming] = await Promise.all([
    prisma.mission.findMany({
      where: {
        consultantId: { in: userIds },
        status: { in: ["ACTIVE", "EXTENDED"] },
        startDate: { lte: when },
        OR: [
          { actualEndDate: null, endDate: { gte: when } },
          { actualEndDate: { gte: when } }
        ]
      },
      include: { company: true }
    }),
    prisma.mission.findMany({
      where: {
        consultantId: { in: userIds },
        status: { in: ["PLANNED", "ACTIVE", "EXTENDED"] },
        startDate: { gt: when, lte: horizon }
      },
      include: { company: true }
    })
  ]);

  const map = (m: any): MissionAssignment => ({
    missionId: m.id,
    reference: m.reference,
    title: m.title,
    companyName: m.company.name,
    startDate: m.startDate,
    endDate: m.actualEndDate ?? m.endDate,
    dailyRate: Number(m.dailyRate),
    status: m.status
  });

  const out = new Map<string, ConsultantMissionStatus>();
  for (const id of userIds) {
    const cur = allCurrent.filter(m => m.consultantId === id).map(map).sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
    const upc = allUpcoming.filter(m => m.consultantId === id).map(map).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    if (cur.length > 0) {
      const latestEnd = cur.reduce((m, e) => e.endDate > m ? e.endDate : m, cur[0].endDate);
      out.set(id, { state: "on_mission", current: cur, upcoming: upc, latestEnd });
    } else if (upc.length > 0) {
      out.set(id, { state: "scheduled", current: [], upcoming: upc, nextStart: upc[0].startDate });
    } else {
      out.set(id, { state: "available", current: [], upcoming: [] });
    }
  }
  return out;
}
