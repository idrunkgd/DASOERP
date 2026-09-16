/**
 * Web Push (PWA) — envoi de notifs système au device via l'endpoint push
 * du navigateur.
 *
 * Config via env vars (VAPID) :
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  → clé publique exposée au browser (subscribe)
 *   VAPID_PRIVATE_KEY             → clé privée, serveur uniquement
 *   VAPID_SUBJECT                 → mailto: contact
 *
 * Génération unique des clés (à faire 1 fois puis mettre en env) :
 *   npx web-push generate-vapid-keys
 *
 * Si les clés VAPID sont absentes → sendPushToUser() logue et sort (dev).
 */
import webpush from "web-push";
import { prisma } from "@/lib/db";

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@dasolabs.be";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  message?: string;
  href?: string;
  icon?: string;
  badge?: string;
};

/**
 * Push à tous les devices d'un user. Les subscriptions expirées (410 Gone /
 * 404 Not Found) sont automatiquement supprimées de la base.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configure()) {
    console.warn("[push] VAPID keys absentes — pas de push envoyé");
    return;
  }
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    message: payload.message,
    href: payload.href,
    icon: payload.icon ?? "/dasolabs-icon.svg",
    badge: payload.badge ?? "/dasolabs-icon.svg"
  });

  await Promise.allSettled(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 60 * 60 * 24 } // 24 h max
      );
      await prisma.pushSubscription.update({
        where: { id: s.id },
        data: { lastUsedAt: new Date() }
      }).catch(() => {});
    } catch (err: any) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        // Subscription expirée / user a désinstallé → purge
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      } else {
        console.error("[push] envoi échoué :", status, err?.body ?? err?.message ?? err);
      }
    }
  }));
}
