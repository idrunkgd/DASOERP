"use client";
/**
 * Gestion du Service Worker + subscription Web Push.
 *
 * - Enregistre le SW à /sw.js au premier chargement (silencieux)
 * - Expose deux hooks/utils :
 *     usePushStatus()   → { supported, permission, subscribed, enable, disable }
 *
 * Le composant <PushEnableButton /> peut être rendu où on veut (dans la cloche,
 * dans /me/notifications, etc.) pour proposer d'activer les notifs push.
 */
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

type PushStatus = {
  supported: boolean;
  permission: NotificationPermission | "unavailable";
  subscribed: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
};

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function usePushStatus(): PushStatus {
  const [permission, setPermission] = useState<NotificationPermission | "unavailable">("unavailable");
  const [subscribed, setSubscribed] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sup = "serviceWorker" in navigator && "PushManager" in window;
    setSupported(sup);
    if (!sup) return;
    setPermission(Notification.permission);
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch { /* ignore */ }
    })();
  }, []);

  const enable = useCallback(async () => {
    if (!supported) { toast.error("Push non supporté par ce navigateur"); return; }
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublic) { toast.error("VAPID public key manquante côté client (env)"); return; }

    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") { toast.error("Permission refusée"); return; }

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(vapidPublic)
    });
    // Envoie au serveur
    const r = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON())
    });
    if (!r.ok) { toast.error("Enregistrement serveur échoué"); return; }
    setSubscribed(true);
    toast.success("Notifications push activées 📲");
  }, [supported]);

  const disable = useCallback(async () => {
    if (!supported) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) { setSubscribed(false); return; }
    await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: "DELETE" });
    await sub.unsubscribe();
    setSubscribed(false);
    toast.success("Notifications désactivées");
  }, [supported]);

  return { supported, permission, subscribed, enable, disable };
}

export function PushEnableButton() {
  const { supported, permission, subscribed, enable, disable } = usePushStatus();
  if (!supported) {
    return (
      <div className="text-[11px] text-midnight-400 italic">
        Ton navigateur ne supporte pas les notifications push.
      </div>
    );
  }
  if (permission === "denied") {
    return (
      <div className="text-[11px] text-red-600 italic">
        Notifications bloquées — active-les dans les réglages du navigateur.
      </div>
    );
  }
  return subscribed ? (
    <button
      onClick={disable}
      className="text-[11px] text-midnight-500 hover:text-red-600 hover:underline"
    >
      🔕 Désactiver les notifs push
    </button>
  ) : (
    <button
      onClick={enable}
      className="text-[11px] text-indigoaccent hover:underline font-medium"
    >
      📲 Activer les notifs push (ce device)
    </button>
  );
}
