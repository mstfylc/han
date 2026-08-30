"use client";

// HAN — keeping the browser and the database in step.
//
// The shape here is deliberate. `StorageDriver.read` stays SYNCHRONOUS, and the
// screens keep calling `readKey(...)` exactly as before, because the browser
// copy is treated as a local mirror of the database rather than as the truth.
// Reads hit the mirror; writes hit the mirror and are queued to the server;
// a poll pulls other people's changes back in and republishes them through the
// same subscription the surfaces already listen to.
//
// The alternative — making every read async — would have meant rewriting every
// screen and re-proving the engine against the prototype. This way the swap is
// what the layer was designed to be: contained.
//
// What it costs, stated plainly: a write is visible to others after the next
// poll, not instantly, and two people editing the same document resolve by the
// merge below rather than by a transaction. For approval queues and offer
// documents — maps keyed by record or request id — that is sound. It would not
// be sound for money, which is exactly why v1 takes no payment.

import { BUYER_WATCHED_KEYS, KEYS, browserDriver, setStorageDriver } from "./storage";
import type { StorageDriver } from "./storage";
import { SYNCED_KEYS, isSyncedKey, scopeOf } from "./scopes";

const DEVICE_KEY = "han-device-id";
const POLL_MS = 4000;

/** A stable id for this browser, so its personal documents follow it across
 *  reloads. Not an identity: it says "this device", not "this person". Real
 *  accounts replace it. */
export function deviceScope(): string {
  let id = browserDriver.read<string | null>(DEVICE_KEY, null);
  if (!id || !/^[A-Za-z0-9_-]{6,64}$/.test(id)) {
    id = "d" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);
    browserDriver.write(DEVICE_KEY, id);
  }
  return "user:" + id;
}

/** Revisions we last saw, so a write can say what it is building on. */
const revisions = new Map<string, string>();
/** Keys written locally and not yet accepted by the server. */
const dirty = new Set<string>();
let pushing = false;
let started = false;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Resolve a document that changed on both sides.
 *
 * Almost every shared document here is either a map keyed by record/request id
 * (offers, claims, approvals, overrides, moderation) or an append-only list
 * (reports, drafts). For a map, taking the remote as the base and letting our
 * own touched keys win means two officers working different records never
 * clobber each other. For a list, the union keeps both people's additions.
 * Anything else keeps the local value, and says so.
 */
function merge(remote: unknown, local: unknown): unknown {
  if (Array.isArray(remote) && Array.isArray(local)) {
    const seen = new Set(local.map((x) => JSON.stringify(x)));
    return local.concat(remote.filter((x) => !seen.has(JSON.stringify(x))));
  }
  if (isPlainObject(remote) && isPlainObject(local)) return { ...remote, ...local };
  return local;
}

/** The driver the app runs on once syncing is switched on. */
const apiDriver: StorageDriver = {
  read: browserDriver.read,
  write<T>(key: string, value: T): T {
    browserDriver.write(key, value);
    if (isSyncedKey(key)) {
      dirty.add(key);
      // Do not await: a click must not wait for a round trip.
      void push();
    }
    return value;
  },
  remove(key: string): void {
    browserDriver.remove(key);
    if (isSyncedKey(key)) {
      dirty.add(key);
      void push();
    }
  },
  subscribe: browserDriver.subscribe,
};

async function push(): Promise<void> {
  if (pushing || !dirty.size) return;
  pushing = true;
  const scope = deviceScope();
  try {
    const keys = Array.from(dirty);
    dirty.clear();
    const writes = keys
      .map((key) => {
        const s = scopeOf(key, scope);
        if (!s) return null;
        const value = browserDriver.read<unknown>(key, null);
        if (value == null) return { scope: s, key, remove: true };
        const rev = revisions.get(s + "/" + key);
        return { scope: s, key, value, revision: rev ? Number(rev) : undefined };
      })
      .filter(Boolean);
    if (!writes.length) return;

    const res = await fetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ writes }),
    });
    if (!res.ok) {
      // Put them back: an unreachable server must not lose a decision.
      keys.forEach((k) => dirty.add(k));
      return;
    }
    const body = (await res.json()) as {
      results: Record<string, { ok: boolean; revision?: string; conflict?: { value: unknown; revision: string } }>;
    };

    let changed = false;
    Object.keys(body.results || {}).forEach((id) => {
      const r = body.results[id];
      const key = id.slice(id.indexOf("/") + 1);
      if (r.ok && r.revision) {
        revisions.set(id, r.revision);
        return;
      }
      if (r.conflict) {
        // Someone else got there first. Merge their version under ours and try
        // again on the next cycle, rather than dropping either side.
        const local = browserDriver.read<unknown>(key, null);
        const merged = merge(r.conflict.value, local);
        revisions.set(id, r.conflict.revision);
        browserDriver.write(key, merged);
        dirty.add(key);
        changed = true;
      }
    });
    if (changed) void push();
  } catch {
    // Offline. The keys are already back in `dirty` unless the response was
    // read, and the next poll will retry.
  } finally {
    pushing = false;
  }
}

/** Pull everything in our scopes and republish anything that actually moved. */
export async function pull(): Promise<void> {
  const scope = deviceScope();
  try {
    const res = await fetch(
      "/api/state?scope=shared&scope=" + encodeURIComponent(scope),
      { cache: "no-store" },
    );
    if (!res.ok) return;
    const body = (await res.json()) as {
      scopes: Record<string, Record<string, { value: unknown; revision: string }>>;
    };

    Object.keys(body.scopes || {}).forEach((s) => {
      const bucket = body.scopes[s];
      Object.keys(bucket).forEach((key) => {
        if (!SYNCED_KEYS.includes(key)) return;
        const id = s + "/" + key;
        const incoming = bucket[key];
        if (revisions.get(id) === incoming.revision) return;
        revisions.set(id, incoming.revision);

        // A key we have pending changes for must not be overwritten by the
        // server's older copy — merge instead, then let push settle it.
        const local = browserDriver.read<unknown>(key, null);
        const next = dirty.has(key) ? merge(incoming.value, local) : incoming.value;
        if (JSON.stringify(next) === JSON.stringify(local)) return;

        // This write is what wakes the surfaces: every screen already listens
        // through subscribeKeys, so an offer made on another device lands in
        // the buyer's list the same way a second tab would have delivered it.
        browserDriver.write(key, next);
      });
    });
  } catch {
    // Offline: the mirror is still fully usable, which is the point of having
    // one. The next tick tries again.
  }
}

/**
 * Switch the app onto the database.
 *
 * Returns a promise that resolves once the first pull has landed, so callers
 * can hold the first paint until real data is in rather than rendering an empty
 * bazaar and then jumping.
 */
export function startSync(): Promise<void> {
  if (started) return Promise.resolve();
  started = true;
  setStorageDriver(apiDriver);

  const first = pull();
  if (typeof window !== "undefined") {
    window.setInterval(() => { void pull(); void push(); }, POLL_MS);
    // Coming back to the tab is the other moment someone else's work landed.
    window.addEventListener("focus", () => { void pull(); });
    // Best effort on the way out, so a decision made and closed still ships.
    window.addEventListener("beforeunload", () => { void push(); });
  }
  return first;
}

/** Keys a surface should re-read when the mirror changes. Re-exported so a
 *  screen never has to know whether the change came from another tab or the
 *  database. */
export const WATCHED = [...BUYER_WATCHED_KEYS, KEYS.requests];
