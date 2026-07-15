/**
 * @file public/sw.js
 * Service Worker pour les notifications Web Push prosendia.
 * Placer ce fichier dans /public/sw.js (racine Next.js).
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "prosendia", body: event.data.text(), data: {} };
  }

  const options = {
    body:    payload.body   ?? "",
    icon:    payload.icon   ?? "/icon-192.png",
    badge:   payload.badge  ?? "/badge-72.png",
    data:    payload.data   ?? {},
    actions: [
      { action: "open",    title: "Voir" },
      { action: "dismiss", title: "Ignorer" },
    ],
    requireInteraction: payload.severity === "CRITICAL",
    tag:                payload.tag ?? "prosendia-notification",
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "prosendia", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url ?? "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.postMessage({ type: "NAVIGATE", url });
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
