/* Admin PWA service worker: web push + minimal offline fallback.
   No data caching on purpose — the admin needs live data. */
const CACHE = "fda-admin-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Pass-through fetch (required for installability); offline page for failed navigations.
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = (event.data && event.data.json()) || {};
  } catch {
    /* malformed payload — show defaults */
  }
  const title = data.title || "Fagurul de Aur";
  const url = data.url || "/admin/comenzi";
  event.waitUntil(
    (async () => {
      // Ask any open admin window to play the cha-ching (background web push
      // on Android always uses the system notification sound).
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) w.postMessage({ type: "new-order" });
      await self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icons/admin-192.png",
        badge: "/icons/admin-192.png",
        vibrate: [200, 100, 200],
        tag: "fda-new-order",
        data: { url },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin/comenzi";
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        try {
          await w.focus();
          await w.navigate(url);
          return;
        } catch {
          /* uncontrolled client — try the next one or open fresh */
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
