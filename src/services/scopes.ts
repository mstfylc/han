// HAN — who each document belongs to.
//
// This file is imported by BOTH the client persistence layer and the API route,
// on purpose: if the two sides kept separate lists they would drift, and the
// failure mode of drifting here is a privacy bug — one buyer's saved shops
// written into the shared scope is visible to everyone.
//
// Three scopes:
//
//   shared — the market itself. Offers, claims, approvals, reports, the
//            lexicon, the operations queues. Everyone reads it; this is the
//            state that has to survive leaving one browser, and the whole
//            reason the surfaces stopped being three tabs on one machine.
//
//   user   — one person's own state: language, saved shops, their plan. Synced
//            so it follows them between devices, but never mixed into shared.
//
//   local  — never leaves the browser. Two things: the prototype PIN store,
//            because sending it anywhere would be a security defect, and the
//            device's own reading preferences, because a preference that
//            follows the device is the point of it.

import { KEYS } from "./storage";

/**
 * The prototype's PIN store.
 *
 * han-admin's auth block is explicitly a UI fixture: PINs in plain text, reset
 * codes readable rather than delivered, attempt counters the client can reset.
 * Uploading that to a server would turn a demo shortcut into a real credential
 * leak affecting real accounts, and would make the fake login look like a
 * genuine one. It stays on the device until server-side verification replaces
 * it wholesale.
 */
export const LOCAL_ONLY_KEYS: string[] = [KEYS.auth, KEYS.prefs];

/** The market's own state — read by every surface. */
export const SHARED_KEYS: string[] = [
  KEYS.offers,
  KEYS.seen,
  KEYS.declined,
  KEYS.reviews,
  KEYS.claims,
  KEYS.approvals,
  KEYS.reports,
  KEYS.overrides,
  KEYS.drafts,
  KEYS.settings,
  KEYS.sponsors,
  KEYS.places,
  KEYS.moderation,
  KEYS.nudges,
  KEYS.lexicon,
  KEYS.content,
  KEYS.media,
  KEYS.geo,
  KEYS.tasks,
  KEYS.users,
  // Buyer requests are market state, not personal state: a trader on another
  // device has to see them, or there is nothing to quote against.
  KEYS.requests,
];

/** One person's own state, synced but private to them. */
export const USER_KEYS: string[] = [KEYS.web, KEYS.traderSession];

/** Everything that may cross the wire. */
export const SYNCED_KEYS: string[] = [...SHARED_KEYS, ...USER_KEYS];

/**
 * Shared keys anyone may write, because participating in the market is the
 * point of the market.
 *
 * A buyer raises a request and reports a bad record; a trader claims a door,
 * corrects their own entry and answers with an offer. None of that can require
 * an operations account or there is no bazaar — so these stay open, and the
 * protections that matter are the ones inside the documents: an offer is bound
 * to the record that made it, a review is gated on an accepted offer, three
 * reports raise an alarm rather than a verdict.
 */
export const PUBLIC_WRITE_KEYS: string[] = [
  KEYS.requests,   // a buyer asking for a price
  KEYS.offers,     // a trader answering with a commitment
  KEYS.seen,       // the funnel's "opened it" event
  KEYS.declined,   // "I can't do this one" — better than silence
  KEYS.reviews,    // gated on an accepted offer (K3)
  KEYS.claims,     // asking to own a record; approving it is not public
  KEYS.reports,    // a buyer flagging a record
  KEYS.overrides,  // a trader correcting their own entry
];

/**
 * Shared keys only operations may write. These are the decisions — approvals,
 * suspensions, field visits, who is on the team, what the search lexicon says,
 * which places exist. The `perm` is the key from han-scale's ROLES, so the
 * permission table has exactly one definition and the API and the navigation
 * cannot disagree about it.
 */
export const OPS_WRITE_KEYS: Record<string, string> = {
  [KEYS.approvals]: "kuyruk",
  [KEYS.moderation]: "sikayet",
  [KEYS.nudges]: "teklifler",
  [KEYS.tasks]: "gorevler",
  [KEYS.users]: "yetkililer",
  [KEYS.settings]: "ozet",
  [KEYS.sponsors]: "sponsorluk",
  [KEYS.places]: "yerler",
  [KEYS.lexicon]: "sozluk",
  [KEYS.content]: "icerik",
  [KEYS.media]: "gorsel",
  [KEYS.geo]: "yerler",
  [KEYS.drafts]: "kayit-ekle",
};

export function isSharedKey(key: string): boolean {
  return SHARED_KEYS.includes(key);
}

/** The ROLES permission a write to this key needs, or null when anyone may. */
export function permForWrite(key: string): string | null {
  return OPS_WRITE_KEYS[key] ?? null;
}

export function isSyncedKey(key: string): boolean {
  return SYNCED_KEYS.includes(key);
}

export function scopeOf(key: string, userScope: string): string | null {
  if (isSharedKey(key)) return "shared";
  if (USER_KEYS.includes(key)) return userScope;
  return null;
}
