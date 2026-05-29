"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker after first paint. No-op during SSR, in
 * development (Next.js HMR + a caching SW is a footgun), and on unsupported
 * browsers. Kept as a thin component so the root layout can stay a Server
 * Component.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

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
