"use client";

import { useEffect } from "react";

/** Register service worker for PWA offline shell */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration is best-effort in dev
      });
    }
  }, []);

  return null;
}