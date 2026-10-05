/* DIMSUM service worker.
 *
 * Caching rules (deliberately conservative):
 *  - pages, API, prices, availability, payments and order status: ALWAYS from the network;
 *    when offline, navigations get the /offline page instead of stale content;
 *  - only immutable assets are cached: hashed build files, menu photos, icons and fonts.
 * Push: order updates for customers, new orders for the kitchen, assignments for riders.
 */
const DEV = new URL(self.location.href).searchParams.get("mode") === "development";
const SHELL = "dimsum-shell-v1";
const ASSETS = "dimsum-assets-v1";
const MAX_ASSETS = 300;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png", "/icons/badge-96.png"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, ASSETS]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// The page asks before switching to a new version ("Nuova versione disponibile").
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/menu/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/maplibre/")
  );
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    void trim(cache);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Third parties (payments, maps) are never intercepted.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (!DEV && isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "DIMSUM", body: event.data ? event.data.text() : "" };
  }
  const kitchen = data.kind === "staff-new-order";
  event.waitUntil(
    self.registration.showNotification(data.title || "DIMSUM", {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192.png",
      badge: data.badge || "/icons/badge-96.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      requireInteraction: Boolean(data.requireInteraction),
      vibrate: kitchen ? [300, 150, 300, 150, 300] : [120, 60, 120],
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const exact = windows.find((w) => w.url === target);
      if (exact) return exact.focus();
      const ours = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (ours) {
        await ours.navigate(target);
        return ours.focus();
      }
      return self.clients.openWindow(target);
    })(),
  );
});
