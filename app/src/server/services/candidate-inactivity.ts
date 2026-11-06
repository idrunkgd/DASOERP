/**
 * Détecte les candidats ACTIFS dont la dernière interaction date de plus de
 * 4 mois et envoie une notification de relance aux owners / consulting.write.
 *
 * Anti-spam : on ne re-notifie pas un candidat déjà relancé il y a moins
 * de 30 jours (champ `lastInactivityReminderAt`).
 *
 * Appelé par le cron /api/cron/candidate-inactivity (hebdomadaire).
 */
import { prisma } from "@/lib/db";
import { createNotification, getUserIdsWithPermission } from "@/lib/notifications";

const FOUR_MONTHS_MS = 4 * 30 * 24 * 60 * 60 * 1000;
const COOLDOWN_MS    = 30 * 24 * 60 * 60 * 1000; // 30 jours entre deux rappels

export async function sendCandidateInactivityReminders() {
  const now = Date.now();
  const cands = await (prisma as any).candidate.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true, firstName: true, lastName: true, ownerId: true,
      lastInactivityReminderAt: true,
      interactions: {
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { occurredAt: true }
      }
    }
  });
  const writers = await getUserIdsWithPermission("consulting.write");
  let sent = 0;
  for (const c of cands) {
    const last = c.interactions?.[0]?.occurredAt;
    if (!last) continue; // un candidat jamais contacté n'est pas "inactif"
    if (now - new Date(last).getTime() < FOUR_MONTHS_MS) continue;
    if (c.lastInactivityReminderAt &&
        now - new Date(c.lastInactivityReminderAt).getTime() < COOLDOWN_MS) continue;

    const recipients = new Set<string>(writers);
    if (c.ownerId) recipients.add(c.ownerId);
    const userIds = Array.from(recipients);
    if (userIds.length === 0) continue;

    await createNotification({
      userId: userIds,
      type: "CANDIDATE_INACTIVE",
      title: `Candidat à relancer : ${c.firstName} ${c.lastName}`,
      message: `Dernière interaction le ${new Date(last).toLocaleDateString("fr-BE")} — plus de 4 mois sans contact.`,
      href: `/candidates/${c.id}`,
      entityType: "Candidate",
      entityId: c.id
    });
    await (prisma as any).candidate.update({
      where: { id: c.id },
      data: { lastInactivityReminderAt: new Date() }
    });
    sent++;
  }
  return { ok: true, sent };
}
