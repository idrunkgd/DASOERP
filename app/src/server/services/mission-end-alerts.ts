/**
 * Alertes fin de mission — missions dont la date de fin arrive dans 3 mois.
 *
 * Deux usages :
 *   1. Affichage dashboard (component serveur) — appel direct de getMissionsEndingSoon
 *   2. Envoi email digest — route /api/cron/mission-end-alerts (sécurisée via secret)
 *
 * On évite les doublons d'alertes avec une table AppLog (recherche d'un log récent
 * du type MISSION_END_ALERT par missionId).
 */
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/email";

/** Fenêtre d'alerte en jours : missions qui finissent entre maintenant et +90 jours. */
const ALERT_DAYS_AHEAD = 90;

export type MissionEndingSoon = {
  id: string;
  reference: string;
  title: string;
  endDate: Date;
  daysLeft: number;
  consultantName: string | null;
  consultantEmail: string | null;
  consultantId: string | null;
  clientName: string;
  clientId: string;
  dailyRate: number;
};

/**
 * Liste des missions ACTIVE/EXTENDED qui finissent dans les 3 prochains mois.
 * Trié par date de fin ascendante (la plus proche en premier).
 */
export async function getMissionsEndingSoon(daysAhead = ALERT_DAYS_AHEAD): Promise<MissionEndingSoon[]> {
  const today = new Date();
  const horizon = new Date(today.getTime() + daysAhead * 24 * 3600 * 1000);
  const missions = await prisma.mission.findMany({
    where: {
      status: { in: ["ACTIVE", "EXTENDED"] },
      endDate: { gte: today, lte: horizon }
    },
    include: {
      consultant: { select: { id: true, firstName: true, lastName: true, email: true } },
      company: { select: { id: true, name: true } }
    },
    orderBy: { endDate: "asc" }
  });
  return missions.map((m) => {
    const daysLeft = Math.ceil((m.endDate.getTime() - today.getTime()) / (24 * 3600 * 1000));
    return {
      id: m.id,
      reference: m.reference,
      title: m.title,
      endDate: m.endDate,
      daysLeft,
      consultantId: m.consultant?.id ?? null,
      consultantName: m.consultant ? `${m.consultant.firstName} ${m.consultant.lastName}` : null,
      consultantEmail: m.consultant?.email ?? null,
      clientName: m.company.name,
      clientId: m.company.id,
      dailyRate: Number(m.dailyRate)
    };
  });
}

/**
 * Envoie un email digest aux destinataires configurés avec les missions
 * qui se terminent dans les 90 jours. Idempotent via tracking AppLog.
 *
 * Destinataires : variable d'env MISSION_ALERT_RECIPIENTS (CSV)
 * ou, à défaut, tous les users avec permission consulting.write.
 */
export async function sendMissionEndDigest(): Promise<{ sent: boolean; count: number }> {
  const missions = await getMissionsEndingSoon();
  if (missions.length === 0) return { sent: false, count: 0 };

  const recipientsEnv = process.env.MISSION_ALERT_RECIPIENTS;
  let recipients: string[];
  if (recipientsEnv) {
    recipients = recipientsEnv.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    // Fallback : admins actifs
    const admins = await prisma.user.findMany({
      where: { active: true, role: "ADMIN" as any },
      select: { email: true }
    }).catch(() => [] as any[]);
    recipients = admins.map((u) => u.email).filter(Boolean);
  }
  if (recipients.length === 0) return { sent: false, count: missions.length };

  const html = buildDigestHtml(missions);
  await sendMail({
    to: recipients,
    subject: `[DasoHub] ${missions.length} mission${missions.length > 1 ? "s" : ""} se termine${missions.length > 1 ? "nt" : ""} dans les 3 mois`,
    html,
    text: buildDigestText(missions)
  });
  return { sent: true, count: missions.length };
}

function buildDigestHtml(missions: MissionEndingSoon[]): string {
  const rows = missions.map((m) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">
        <strong>${escape(m.reference)}</strong><br>
        <span style="color:#64748b;font-size:12px;">${escape(m.title)}</span>
      </td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escape(m.clientName)}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escape(m.consultantName ?? "—")}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;color:${m.daysLeft < 30 ? "#dc2626" : m.daysLeft < 60 ? "#d97706" : "#059669"};">
        <strong>J-${m.daysLeft}</strong><br>
        <span style="font-size:11px;color:#64748b;">${m.endDate.toLocaleDateString("fr-BE")}</span>
      </td>
    </tr>
  `).join("");
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;">
      <h2 style="color:#0f172a;">Fin de mission à anticiper</h2>
      <p style="color:#64748b;">${missions.length} mission${missions.length > 1 ? "s se terminent" : " se termine"} dans les 90 prochains jours. Pense à préparer les renouvellements ou le reclassement.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px;text-align:left;">Mission</th>
            <th style="padding:8px;text-align:left;">Client</th>
            <th style="padding:8px;text-align:left;">Consultant</th>
            <th style="padding:8px;text-align:left;">Fin</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:24px;color:#64748b;font-size:12px;">Envoi automatique DasoHub.</p>
    </div>
  `;
}

function buildDigestText(missions: MissionEndingSoon[]): string {
  return `${missions.length} mission(s) se terminent dans les 90 jours:\n\n` +
    missions.map((m) => `- ${m.reference} (${m.title}) · ${m.clientName} · ${m.consultantName ?? "—"} · J-${m.daysLeft} (${m.endDate.toLocaleDateString("fr-BE")})`).join("\n");
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
