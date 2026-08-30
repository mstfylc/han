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
//   local  — never leaves the browser. Exactly one thing lives here, and it is
//            here because sending it anywhere would be a security defect.

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
export const LOCAL_ONLY_KEYS: string[] = [KEYS.auth];

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

export function isSharedKey(key: string): boolean {
  return SHARED_KEYS.includes(key);
}

export function isSyncedKey(key: string): boolean {
  return SYNCED_KEYS.includes(key);
}

export function scopeOf(key: string, userScope: string): string | null {
  if (isSharedKey(key)) return "shared";
  if (USER_KEYS.includes(key)) return userScope;
  return null;
}
