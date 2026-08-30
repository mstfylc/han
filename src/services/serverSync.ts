"use client";

// The HTTP transport the storage driver was designed to grow into.
//
// Reads stay synchronous and local: the browser mirror IS the working copy,
// exactly as in the prototype. What changes is where truth lives — on boot the
// mirror hydrates from /api/store (server wins), and every later write flows
// back through the same endpoint. Two browsers finally see the same bazaar:
// the buyer leaves a request on a phone and the panel sees it on a desk.
//
// Per-browser keys are deliberately NOT synced: a trader's phone verification,
// the panel's demo role selector and theme choice belong to the device, not to
// the product's shared state. The real session is an httpOnly cookie and never
// passes through here at all.

import { browserDriver, setStorageDriver } from "./storage";
import type { StorageDriver } from "./storage";

const LOCAL_ONLY = new Set([
  "han-auth-v1", // legacy prototype store; real auth is the cookie session
  "han-esnaf-session",
  "han-panel-role",
  "han-panel-scope-v1",
  "han-panel-theme",
]);

const shouldSync = (key: string) => /^han-[a-z0-9-]+$/.test(key) && !LOCAL_ONLY.has(key);

/** Writes are coalesced per key: a drag-sort that fires ten writes in a second
 *  should land as one PUT, and a failed push retries on the next write. */
const pending = new Map<string, ReturnType<typeof setTimeout>>();

function push(key: string, value: unknown): void {
  const t = pending.get(key);
  if (t) clearTimeout(t);
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key);
      void fetch("/api/store", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value }),
      }).catch(() => {
        // Offline or the server is gone: local keeps working, and the next
        // write to this key tries again. The prototype's world, not worse.
      });
    }, 250),
  );
}

export const serverDriver: StorageDriver = {
  read: (key, fallback) => browserDriver.read(key, fallback),
  write(key, value) {
    browserDriver.write(key, value);
    if (shouldSync(key)) push(key, value);
    return value;
  },
  remove(key) {
    browserDriver.remove(key);
    if (shouldSync(key)) push(key, null);
  },
  subscribe: (keys, onChange) => browserDriver.subscribe(keys, onChange),
};

/** Pull every server-held store into the local mirror. Server wins: the local
 *  copy is a cache of shared truth, not a fork of it. */
export async function hydrateFromServer(): Promise<boolean> {
  try {
    const res = await fetch("/api/store", { cache: "no-store" });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean; stores?: Record<string, unknown> };
    const stores = body.stores || {};
    Object.keys(stores).forEach((key) => {
      if (shouldSync(key)) browserDriver.write(key, stores[key]);
    });
    setStorageDriver(serverDriver);
    return true;
  } catch {
    return false; // no server (static preview) — stay on the local driver
  }
}
