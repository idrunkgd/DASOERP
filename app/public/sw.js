// Service Worker DasoHub — minimal, dédié aux notifications push.
// Pas de cache offline pour l'instant (Next.js gère son propre cache).

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Réception d'un push serveur → affichage d'une notif système
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "DasoHub", message: event.data.text() };
  }
  const title = data.title || "DasoHub";
  const options = {
    body: data.message || "",
    icon: data.icon || "/dasolabs-icon.svg",
    badge: data.badge || "/dasolabs-icon.svg",
    tag: data.tag || "dasohub-notif",
    data: { href: data.href || "/notifications" },
    // Vibration douce sur mobile (2 pulses)
    vibrate: [80, 40, 80]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clic sur la notif → ouvre l'app à l'URL cible, ou focus l'onglet existant
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.href || "/notifications";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clientsList) {
        if ("focus" in c) {
          try {
            await c.focus();
            if ("navigate" in c) await c.navigate(targetUrl);
            return;
          } catch { /* fall through */ }
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
    })()
  );
});
