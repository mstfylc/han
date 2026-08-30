"use client";

// Mounts the server-backed storage driver before the surfaces read anything
// meaningful. The subtree is re-keyed once hydration settles, so every screen
// runs its mount-time reads again against the freshly pulled shared state —
// the same trick as a hard refresh, without losing the URL.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { hydrateFromServer } from "@/services/serverSync";

export function StoreSync({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"boot" | "ready">("boot");

  useEffect(() => {
    let alive = true;
    void hydrateFromServer().finally(() => {
      if (alive) setPhase("ready");
    });
    // PWA: register the offline shell. Failure is fine — the site is the app.
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => { alive = false; };
  }, []);

  // key change remounts children after hydration; the first (boot) render is
  // identical on server and client, so React has nothing to complain about.
  return <div key={phase} style={{ display: "contents" }}>{children}</div>;
}
