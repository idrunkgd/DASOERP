import { prisma } from "@/lib/db";

export type CalendarEventType =
  | "INTERVIEW_HIRING"        // entretien d'embauche Dasolabs (sans application)
  | "INTERVIEW_PLACEMENT"     // entretien client (rattaché à une application)
  | "INTERVIEW_PORTAL"        // créneau confirmé via le portail client (CandidateProposal)
  | "REVIEW_INTERNAL"         // entretien interne consultant (ConsultantReview)
  | "MISSION_START"           // début mission T&M
  | "MISSION_END"             // fin mission T&M (prévue ou réelle)
  | "BIRTHDAY"                // anniversaire d'un consultant (récurrent annuel)
  | "WORK_ANNIVERSARY"        // date d'entrée chez Dasolabs (récurrent annuel)
  | "CANDIDATE_INACTIVE";     // candidat silencieux depuis >4 mois (relance à prévoir)

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
  INTERVIEW_PORTAL:    "bg-cyan-200 text-cyan-900 border-cyan-300",
  REVIEW_INTERNAL:     "bg-violet-200 text-violet-900 border-violet-300",
  MISSION_START:       "bg-emerald-200 text-emerald-900 border-emerald-300",
  MISSION_END:         "bg-amber-200 text-amber-900 border-amber-300",
  BIRTHDAY:            "bg-pink-200 text-pink-900 border-pink-300",
  WORK_ANNIVERSARY:    "bg-fuchsia-200 text-fuchsia-900 border-fuchsia-300",
  CANDIDATE_INACTIVE:  "bg-orange-200 text-orange-900 border-orange-300"
};
export function eventTone(t: CalendarEventType): string { return TONES[t]; }

const LABELS: Record<CalendarEventType, string> = {
  INTERVIEW_HIRING:    "Entretien embauche",
  INTERVIEW_PLACEMENT: "Entretien client",
  INTERVIEW_PORTAL:    "Entretien portail client",
  REVIEW_INTERNAL:     "Entretien interne",
  MISSION_START:       "Début mission",
  MISSION_END:         "Fin mission",
  BIRTHDAY:            "Anniversaire",
  WORK_ANNIVERSARY:    "Date d'entrée",
  CANDIDATE_INACTIVE:  "Candidat à relancer"
};
export function eventLabel(t: CalendarEventType): string { return LABELS[t]; }

/**
 * Agrège tous les événements consultance dans une plage donnée.
 * Une seule fonction → utilisée par la page /calendar.
 */
export async function getCalendarEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
  const [interviews, reviews, missionsStarting, missionsEnding, teamDates, inactiveCandidates, portalProposals] = await Promise.all([
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
    }),
    // Anniversaires + dates d'entrée : on récupère tous les employés actifs
    // avec au moins une des deux dates renseignées. On projette ensuite chaque
    // date sur l'année de la plage affichée pour créer des événements récurrents.
    prisma.user.findMany({
      where: {
        active: true,
        candidateProfile: { is: null },
        OR: [{ birthDate: { not: null } }, { joinedAt: { not: null } }]
      },
      select: { id: true, firstName: true, lastName: true, birthDate: true, joinedAt: true }
    }),
    // Candidats sans interaction depuis >4 mois — event posé à la date où ils
    // ont franchi le seuil (dernière interaction + 4 mois). Placé dans la
    // fenêtre uniquement si ce seuil y tombe.
    (async () => {
      const fourMonthsMs = 4 * 30 * 24 * 60 * 60 * 1000;
      const cutoffFrom = new Date(from.getTime() - fourMonthsMs);
      const cutoffTo   = new Date(to.getTime()   - fourMonthsMs);
      // Candidats actifs avec au moins 1 interaction ; on ne garde que ceux
      // dont la DERNIÈRE interaction tombe entre [to - 4mois ; from - 4mois]
      // (inversé car on veut un event à "lastInteraction + 4mois" dans [from, to]).
      const cands = await (prisma as any).candidate.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true, firstName: true, lastName: true,
          interactions: {
            orderBy: { occurredAt: "desc" },
            take: 1,
            select: { occurredAt: true }
          }
        }
      });
      return cands.filter((c: any) => {
        const last = c.interactions?.[0]?.occurredAt;
        if (!last) return false;
        const trigger = new Date(new Date(last).getTime() + fourMonthsMs);
        return trigger >= from && trigger <= to;
      });
    })(),
    // Créneaux confirmés depuis le portail client (CandidateProposal.interview1/2ConfirmedAt)
    (prisma as any).candidateProposal.findMany({
      where: {
        OR: [
          { interview1ConfirmedAt: { gte: from, lte: to } },
          { interview2ConfirmedAt: { gte: from, lte: to } }
        ]
      },
      select: {
        id: true,
        interview1ConfirmedAt: true, interview1Slots: true,
        interview2ConfirmedAt: true, interview2Slots: true,
        portalId: true,
        candidate: { select: { id: true, firstName: true, lastName: true } },
        portal:    { select: { id: true, name: true } }
      }
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

  // ─── Candidats inactifs >4 mois ─────────────────────────────────────────
  const fourMonthsMs = 4 * 30 * 24 * 60 * 60 * 1000;
  for (const c of inactiveCandidates as any[]) {
    const last = c.interactions?.[0]?.occurredAt;
    if (!last) continue;
    const trigger = new Date(new Date(last).getTime() + fourMonthsMs);
    out.push({
      id: `inac-${c.id}`,
      type: "CANDIDATE_INACTIVE",
      date: trigger,
      title: `À relancer · ${c.firstName} ${c.lastName}`,
      subtitle: `Dernière interaction le ${new Date(last).toLocaleDateString("fr-BE")}`,
      href: `/candidates/${c.id}`
    });
  }

  // ─── Créneaux portail confirmés ─────────────────────────────────────────
  // On projette chaque date confirmée en event, en reprenant le mode (VISIO/
  // ONSITE) depuis le slot d'origine quand on le retrouve.
  function findSlotMode(slots: any, confirmedAt: Date | null): string | null {
    if (!slots || !Array.isArray(slots) || !confirmedAt) return null;
    const stamp = new Date(confirmedAt).toISOString().slice(0, 16);
    for (const s of slots) {
      if (!s?.date || !s?.startTime) continue;
      const ts = `${s.date}T${s.startTime}`.slice(0, 16);
      if (ts === stamp) return s.mode ?? null;
    }
    return null;
  }
  for (const p of portalProposals as any[]) {
    for (const which of [1, 2] as const) {
      const confirmedAt: Date | null = which === 1 ? p.interview1ConfirmedAt : p.interview2ConfirmedAt;
      if (!confirmedAt) continue;
      const slots = which === 1 ? p.interview1Slots : p.interview2Slots;
      const mode = findSlotMode(slots, confirmedAt);
      const cName = p.candidate ? `${p.candidate.firstName} ${p.candidate.lastName}` : "?";
      out.push({
        id: `pp-${p.id}-${which}`,
        type: "INTERVIEW_PORTAL",
        date: new Date(confirmedAt),
        title: `Entretien ${which} · ${cName}`,
        subtitle: `${p.portal?.name ?? "Portail client"}${mode ? ` · ${mode === "VISIO" ? "Visio" : "Sur site"}` : ""}`,
        href: `/client-portals/${p.portalId}`
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

  // ─── Anniversaires + dates d'entrée récurrents ───
  // On projette chaque date sur toutes les années de la plage affichée, puis
  // on filtre pour ne garder que celles qui tombent DANS la plage.
  const yearMin = from.getUTCFullYear();
  const yearMax = to.getUTCFullYear();
  for (const u of teamDates) {
    const fullName = `${u.firstName} ${u.lastName}`;
    if (u.birthDate) {
      const m = u.birthDate.getUTCMonth();
      const d = u.birthDate.getUTCDate();
      const originalYear = u.birthDate.getUTCFullYear();
      for (let y = yearMin; y <= yearMax; y++) {
        const projected = new Date(Date.UTC(y, m, d));
        if (projected >= from && projected <= to) {
          const age = y - originalYear;
          out.push({
            id: `bd-${u.id}-${y}`,
            type: "BIRTHDAY",
            date: projected,
            title: `🎂 ${fullName}`,
            subtitle: age > 0 ? `${age} ans` : undefined,
            href: `/consultants/${u.id}`
          });
        }
      }
    }
    if (u.joinedAt) {
      const m = u.joinedAt.getUTCMonth();
      const d = u.joinedAt.getUTCDate();
      const originalYear = u.joinedAt.getUTCFullYear();
      for (let y = yearMin; y <= yearMax; y++) {
        const projected = new Date(Date.UTC(y, m, d));
        if (projected >= from && projected <= to) {
          const yearsIn = y - originalYear;
          // Le jour même de l'entrée = date d'entrée. Les années suivantes = anniversaire d'ancienneté.
          const label = yearsIn === 0
            ? `🎉 Arrivée · ${fullName}`
            : `🎉 ${fullName} · ${yearsIn} an${yearsIn > 1 ? "s" : ""} chez Dasolabs`;
          out.push({
            id: `wa-${u.id}-${y}`,
            type: "WORK_ANNIVERSARY",
            date: projected,
            title: label,
            subtitle: yearsIn === 0 ? `Bienvenue !` : `Depuis ${originalYear}`,
            href: `/consultants/${u.id}`
          });
        }
      }
    }
  }

  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}
