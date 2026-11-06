/**
 * Envoie un rappel (notif in-app + email + push) pour chaque événement du
 * calendrier qui a lieu DEMAIN (fenêtre H+24 → H+48). Appelé par le cron
 * /api/cron/calendar-reminders tous les matins vers 8h.
 *
 * Destinataires par type :
 *   INTERVIEW_HIRING        → users avec consulting.write
 *   INTERVIEW_PLACEMENT     → le consultant associé + users consulting.write
 *   INTERVIEW_PORTAL        → users avec consulting.write (créneau client)
 *   REVIEW_INTERNAL         → le consultant concerné (subject)
 *   MISSION_START           → le consultant + users consulting.write
 *   MISSION_END             → le consultant + users consulting.write
 *   BIRTHDAY / WORK_ANNIV   → tous les users actifs (fête interne)
 *
 * Les notifs passent par createNotification() → respecte les prefs de l'user
 * (in-app / email / push).
 */
import { prisma } from "@/lib/db";
import { createNotification, getUserIdsWithPermission } from "@/lib/notifications";
import { getCalendarEvents, eventLabel, type CalendarEvent } from "./calendar-service";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function recipientsForEvent(ev: CalendarEvent, consultingWriters: string[]): Promise<string[]> {
  const set = new Set<string>();

  // id de référence stocké dans ev.id (préfixé par type) — on l'utilise pour
  // retrouver le user concerné.
  const bareId = ev.id.replace(/^[a-z]+-/, "").split("-")[0];

  switch (ev.type) {
    case "INTERVIEW_HIRING":
    case "INTERVIEW_PORTAL":
      consultingWriters.forEach((u) => set.add(u));
      break;

    case "INTERVIEW_PLACEMENT": {
      consultingWriters.forEach((u) => set.add(u));
      // On essaie de retrouver le consultant côté application
      try {
        const iv = await (prisma as any).interview.findUnique({
          where: { id: bareId },
          select: { application: { select: { consultantId: true } } }
        });
        if (iv?.application?.consultantId) set.add(iv.application.consultantId);
      } catch { /* noop */ }
      break;
    }

    case "REVIEW_INTERNAL": {
      try {
        const r = await (prisma as any).consultantReview.findUnique({
          where: { id: bareId },
          select: { subjectId: true }
        });
        if (r?.subjectId) set.add(r.subjectId);
      } catch { /* noop */ }
      consultingWriters.forEach((u) => set.add(u));
      break;
    }

    case "MISSION_START":
    case "MISSION_END": {
      try {
        const m = await (prisma as any).mission.findUnique({
          where: { id: bareId },
          select: { consultantId: true }
        });
        if (m?.consultantId) set.add(m.consultantId);
      } catch { /* noop */ }
      consultingWriters.forEach((u) => set.add(u));
      break;
    }

    case "BIRTHDAY":
    case "WORK_ANNIVERSARY": {
      // Diffuse à toute l'équipe active (hors candidats)
      const all = await prisma.user.findMany({
        where: { active: true, candidateProfile: { is: null } },
        select: { id: true }
      });
      all.forEach((u) => set.add(u.id));
      break;
    }
  }
  return Array.from(set);
}

export async function sendCalendarRemindersForTomorrow() {
  const now = new Date();
  const tomorrow = startOfDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const dayAfter = startOfDay(new Date(now.getTime() + 48 * 60 * 60 * 1000));

  const events = await getCalendarEvents(tomorrow, dayAfter);
  // Ne garde que ceux qui tombent effectivement dans la fenêtre [demain 00:00, après-demain 00:00)
  const filtered = events.filter((e) => e.date >= tomorrow && e.date < dayAfter);
  if (filtered.length === 0) return { ok: true, sent: 0 };

  const consultingWriters = await getUserIdsWithPermission("consulting.write");

  let sent = 0;
  for (const ev of filtered) {
    const userIds = await recipientsForEvent(ev, consultingWriters);
    if (userIds.length === 0) continue;

    const timePart = ["INTERVIEW_HIRING", "INTERVIEW_PLACEMENT", "INTERVIEW_PORTAL", "REVIEW_INTERNAL"].includes(ev.type)
      ? ` à ${ev.date.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}`
      : "";

    await createNotification({
      userId: userIds,
      type: "CALENDAR_REMINDER",
      title: `Demain${timePart} — ${eventLabel(ev.type)}`,
      message: `${ev.title}${ev.subtitle ? ` · ${ev.subtitle}` : ""}`,
      href: ev.href,
      entityType: "CalendarEvent",
      entityId: ev.id
    });
    sent++;
  }
  return { ok: true, sent };
}
