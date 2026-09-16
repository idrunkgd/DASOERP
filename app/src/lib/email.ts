/**
 * Envoi d'email transactionnel via SMTP (Scaleway TEM, Resend, Postmark…).
 *
 * Config via env vars :
 *   SMTP_HOST     (ex : smtp.tem.scw.cloud)
 *   SMTP_PORT     (587 STARTTLS, 465 SSL)
 *   SMTP_USER
 *   SMTP_PASS
 *   SMTP_FROM     (ex : "DasoHub <noreply@dasolabs.be>")
 *
 * Si SMTP_HOST est absent → sendMail() logue et sort silencieusement (dev).
 * Best-effort : ne throw jamais côté appelant.
 */
import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
  return transporter;
}

export type MailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail(input: MailInput): Promise<void> {
  const tx = getTransporter();
  const from = process.env.SMTP_FROM || "DasoHub <noreply@dasolabs.be>";
  if (!tx) {
    console.warn("[email] SMTP_HOST manquant — mail non envoyé :", input.subject, "→", input.to);
    return;
  }
  try {
    await tx.sendMail({
      from,
      to: Array.isArray(input.to) ? input.to.join(",") : input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripHtml(input.html)
    });
  } catch (err) {
    console.error("[email] envoi échoué :", err);
  }
}

/**
 * Template HTML minimal — DM Sans (via Google Fonts inline), palette charte,
 * CTA vers /notifications ou l'URL du contexte.
 */
export function renderNotifEmail(input: {
  title: string;
  message?: string | null;
  href?: string | null;
  ctaLabel?: string;
  firstName?: string | null;
}): string {
  const appUrl = process.env.NEXTAUTH_URL || process.env.COOLIFY_URL || "https://hub.dasolabs.be";
  const link = input.href ? (input.href.startsWith("http") ? input.href : `${appUrl}${input.href}`) : `${appUrl}/notifications`;
  const cta = input.ctaLabel ?? "Voir dans DasoHub";
  const hello = input.firstName ? `Bonjour ${input.firstName},` : "Bonjour,";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;background:#F1F1F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#202037;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F1F6;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(7,7,13,.06);">
      <tr><td style="background:linear-gradient(135deg,#202037 0%,#3434E8 100%);padding:24px 32px;">
        <div style="color:#FFFFFF;font-size:22px;font-weight:800;letter-spacing:-.02em;">dasolabs<span style="color:#8a8bff;">/</span></div>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;color:#6b6d80;font-size:14px;">${hello}</p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.2;font-weight:800;color:#202037;">${escapeHtml(input.title)}</h1>
        ${input.message ? `<p style="margin:0 0 24px;color:#4a4d6a;font-size:14px;line-height:1.5;">${escapeHtml(input.message)}</p>` : ""}
        <a href="${link}" style="display:inline-block;background:#3434E8;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">${escapeHtml(cta)} →</a>
      </td></tr>
      <tr><td style="padding:16px 32px;background:#F1F1F6;color:#9394a6;font-size:11px;text-align:center;">
        DasoHub · Notification automatique · <a href="${appUrl}/me/notifications" style="color:#3434E8;text-decoration:none;">Gérer mes notifications</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
