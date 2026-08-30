// HAN — service worker.
//
// The bazaar has thick stone walls and thin reception; the promise the map
// iframe already makes ("saved data opens offline") extends here. Strategy is
// deliberately conservative so the worker can never serve a stale bazaar:
//   · static assets (icons, vendored leaflet, placeholder photos) — cache
//     first, they are content-addressed by path and effectively immutable
//   · pages and API — network first, cache fallback for pages only, so an
//     offline reopen still shows the last shell instead of a dinosaur
//   · never cache /api responses: shared truth must not fork in a cache
const VERSION = "han-v1";
const STATIC = /^\/(assets|vendor)\/|^\/(han-data\.js|han-map\.html|favicon\.ico|manifest\.webmanifest)$/;

self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // always live

  if (STATIC.test(url.pathname) || url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.open(VERSION).then((c) =>
        c.match(e.request).then((hit) =>
          hit || fetch(e.request).then((res) => {
            if (res.ok) c.put(e.request, res.clone());
            return res;
          }),
        ),
      ),
    );
    return;
  }

  // pages: network first, last-seen fallback
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && e.request.mode === "navigate") {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.open(VERSION).then((c) => c.match(e.request).then((hit) => hit || c.match("/")))),
  );
});
