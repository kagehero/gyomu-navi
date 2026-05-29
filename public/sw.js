// Gyomu Navi service worker — minimal app-shell + runtime caching.
//
// Strategy:
//   * Precache the offline fallback only. Next.js fingerprints its own assets
//     under /_next/static, so we don't try to enumerate them here — we just
//     stale-while-revalidate them at runtime.
//   * Same-origin GET requests:
//       - /_next/static/*  -> cache-first (immutable, fingerprinted)
//       - /api/*           -> network-only (never cache mutating/auth state)
//       - HTML navigations -> network-first, fallback to cached offline page
//       - other GETs       -> stale-while-revalidate
//   * Non-GET, cross-origin, and POSTs (Blob uploads) are passed through.
//
// Bump CACHE_VERSION to force a refresh on deploy.

const CACHE_VERSION = "v1";
const STATIC_CACHE = `gyomu-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `gyomu-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([OFFLINE_URL, "/favicon.svg", "/manifest.webmanifest"]).catch(() => {
        // If the offline page isn't reachable at install (dev), don't block activation.
      }),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

function isSameOrigin(url) {
  return new URL(url).origin === self.location.origin;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (!isSameOrigin(req.url)) return;

  const url = new URL(req.url);

  // Never intercept API traffic — auth/state must be authoritative.
  if (url.pathname.startsWith("/api/")) return;

  // Immutable Next.js build assets: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        });
      }),
    );
    return;
  }

  // Navigation: network-first, offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return (
            offline ||
            new Response("オフラインです", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }),
    );
    return;
  }

  // Default same-origin GET: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || fetchPromise;
    }),
  );
});
