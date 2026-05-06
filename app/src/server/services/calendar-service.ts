import { prisma } from "@/lib/db";

export type CalendarEventType =
  | "INTERVIEW_HIRING"        // entretien d'embauche Dasolabs (sans application)
  | "INTERVIEW_PLACEMENT"     // entretien client (rattaché à une application)
  | "REVIEW_INTERNAL"         // entretien interne consultant (ConsultantReview)
  | "MISSION_START"           // début mission T&M
  | "MISSION_END";            // fin mission T&M (prévue ou réelle)

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  date: Date;
  endDate?: Date | null;
  title: string;
  subtitle?: string;
  href: string;
  participants?: string[];     // affichage léger
};

const TONES: Record<CalendarEventType, string> = {
  INTERVIEW_HIRING:    "bg-indigo-200 text-indigo-900 border-indigo-300",
  INTERVIEW_PLACEMENT: "bg-blue-200 text-blue-900 border-blue-300",
  REVIEW_INTERNAL:     "bg-violet-200 text-violet-900 border-violet-300",
  MISSION_START:       "bg-emerald-200 text-emerald-900 border-emerald-300",
  MISSION_END:         "bg-amber-200 text-amber-900 border-amber-300"
};
export function eventTone(t: CalendarEventType): string { return TONES[t]; }

const LABELS: Record<CalendarEventType, string> = {
  INTERVIEW_HIRING:    "Entretien embauche",
  INTERVIEW_PLACEMENT: "Entretien client",
  REVIEW_INTERNAL:     "Entretien interne",
  MISSION_START:       "Début mission",
  MISSION_END:         "Fin mission"
};
export function eventLabel(t: CalendarEventType): string { return LABELS[t]; }

/**
 * Agrège tous les événements consultance dans une plage donnée.
 * Une seule fonction → utilisée par la page /calendar.
 */
export async function getCalendarEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
  const [interviews, reviews, missionsStarting, missionsEnding] = await Promise.all([
    // Entretiens (recrutement direct OU placement client)
    prisma.interview.findMany({
      where: { scheduledAt: { gte: from, lte: to } },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true } },
        application: {
          select: {
            id: true,
            candidate: { select: { id: true, firstName: true, lastName: true } },
            consultant: { select: { id: true, firstName: true, lastName: true } },
            missionRequest: { select: { id: true, reference: true, title: true, company: { select: { name: true } } } }
          }
        }
      },
      orderBy: { scheduledAt: "asc" }
    }),
    prisma.consultantReview.findMany({
      where: { scheduledAt: { gte: from, lte: to } },
      include: { subject: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { scheduledAt: "asc" }
    }),
    prisma.mission.findMany({
      where: { startDate: { gte: from, lte: to } },
      include: { consultant: { select: { firstName: true, lastName: true } }, company: { select: { name: true } } },
      orderBy: { startDate: "asc" }
    }),
    prisma.mission.findMany({
      where: {
        OR: [
          { actualEndDate: { gte: from, lte: to } },
          { AND: [{ actualEndDate: null }, { endDate: { gte: from, lte: to } }] }
        ]
      },
      include: { consultant: { select: { firstName: true, lastName: true } }, company: { select: { name: true } } }
    })
  ]);

  const out: CalendarEvent[] = [];

  for (const iv of interviews) {
    if (iv.candidateId && iv.candidate) {
      // entretien d'embauche direct (pas de mission liée)
      out.push({
        id: `iv-${iv.id}`,
        type: "INTERVIEW_HIRING",
        date: iv.scheduledAt,
        title: `Embauche · ${iv.candidate.firstName} ${iv.candidate.lastName}`,
        subtitle: iv.kind + (iv.interviewers ? ` · ${iv.interviewers}` : ""),
        href: `/candidates/${iv.candidate.id}`,
        participants: iv.interviewers ? iv.interviewers.split(",").map(s => s.trim()) : []
      });
    } else if (iv.application) {
      const subject = iv.application.candidate ?? iv.application.consultant;
      const sName = subject ? `${subject.firstName} ${subject.lastName}` : "?";
      out.push({
        id: `iv-${iv.id}`,
        type: "INTERVIEW_PLACEMENT",
        date: iv.scheduledAt,
        title: `${iv.application.missionRequest.reference} · ${sName}`,
        subtitle: `${iv.kind}${iv.interviewers ? ` · ${iv.interviewers}` : ""} · ${iv.application.missionRequest.company.name}`,
        href: `/mission-requests/${iv.application.missionRequest.id}`,
        participants: iv.interviewers ? iv.interviewers.split(",").map(s => s.trim()) : []
      });
    }
  }

  for (const r of reviews) {
    out.push({
      id: `rv-${r.id}`,
      type: "REVIEW_INTERNAL",
      date: r.scheduledAt,
      title: `${r.kind} · ${r.subject.firstName} ${r.subject.lastName}`,
      subtitle: r.outcome,
      href: `/consultants/${r.subject.id}`
    });
  }

  for (const m of missionsStarting) {
    out.push({
      id: `ms-${m.id}`,
      type: "MISSION_START",
      date: m.startDate,
      endDate: m.endDate,
      title: `Début · ${m.reference}`,
      subtitle: `${m.consultant ? `${m.consultant.firstName} ${m.consultant.lastName} → ` : ""}${m.company.name}`,
      href: `/missions/${m.id}`
    });
  }
  for (const m of missionsEnding) {
    const d = m.actualEndDate ?? m.endDate;
    out.push({
      id: `me-${m.id}`,
      type: "MISSION_END",
      date: d,
      title: `Fin · ${m.reference}`,
      subtitle: `${m.consultant ? `${m.consultant.firstName} ${m.consultant.lastName} · ` : ""}${m.company.name}${m.actualEndDate ? " (réelle)" : " (prévue)"}`,
      href: `/missions/${m.id}`
    });
  }

  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}
