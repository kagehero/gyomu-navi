"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker after first paint. No-op during SSR, in
 * development (Next.js HMR + a caching SW is a footgun), and on unsupported
 * browsers. Kept as a thin component so the root layout can stay a Server
 * Component.
 */
async function clearDevServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((r) => r.unregister()));
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith("gyomu-")).map((k) => caches.delete(k)),
    );
  }
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // A leftover production SW cache-firsts /_next/static and breaks `next dev`
    // (ChunkLoadError: app/layout.js timeout). Strip it in development.
    if (process.env.NODE_ENV !== "production") {
      void clearDevServiceWorkers();
      return;
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          console.warn("[sw] registration failed:", err);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
