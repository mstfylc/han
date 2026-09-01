// HAN — the real-offer store.
//
// K9: a number the engine produces is an INFERENCE ("estimated range"); a number
// the trader gives is a COMMITMENT ("offer from the shop"). The two never come
// from the same place — estimates are generated in `han-search.ts`, real offers
// are stored here.
//
// The buyer tab and the trader panel read and write the same keys, so both sides
// see a change live (see services/storage.ts).

import { readKey, writeKey, KEYS } from "@/services/storage";
import type { Decline, DeclineReason, L10n, Offer, Review } from "./types";

/** An offer is a binding commitment for seven days. */
export const OFFER_VALID_DAYS = 7;

type OffersByRequest = Record<string, Offer[]>;
type SeenByRequest = Record<string, Record<string, number>>;
type DeclinesByRequest = Record<string, Record<string, Decline>>;
type ReviewsByRecord = Record<string, Review[]>;

// ── real offers ───────────────────────────────────────────────────────────

export function allOffers(): OffersByRequest {
  return readKey<OffersByRequest>(KEYS.offers, {});
}

export function offersOf(reqId: string | number): Offer[] {
  return (allOffers()[String(reqId)] || []).slice();
}

/** One shop makes one offer per request; offering again replaces the previous
 *  one rather than stacking a second price on the same shop. */
export function putOffer(reqId: string | number, offer: Partial<Offer> & { recordId: string }): Offer[] {
  const all = allOffers();
  const id = String(reqId);
  const list = (all[id] || []).filter((o) => o.recordId !== offer.recordId);
  const now = Date.now();
  list.push({
    unit: 0,
    raw: 0,
    qty: 1,
    gun: 1,
    ...offer,
    at: offer.at ?? now,
    // Validity counts from the offer's own age, not the request's.
    validUntil: offer.validUntil ?? now + OFFER_VALID_DAYS * 86400000,
    real: true,
    estimate: false,
  });
  all[id] = list;
  writeKey(KEYS.offers, all);
  return list;
}

export function dropOffer(reqId: string | number, recordId: string): Offer[] {
  const all = allOffers();
  const id = String(reqId);
  all[id] = (all[id] || []).filter((o) => o.recordId !== recordId);
  writeKey(KEYS.offers, all);
  return all[id];
}

// ── funnel · "opened it" ──────────────────────────────────────────────────
// U3: the funnel used to be arithmetic — "opened = sent × 0.42". That is a lie.
// This is the measured event: marked the moment the trader's panel shows the
// request.

export function allSeen(): SeenByRequest {
  return readKey<SeenByRequest>(KEYS.seen, {});
}

export function markSeen(reqIds: (string | number)[], recordId: string): SeenByRequest {
  const all = allSeen();
  let changed = false;
  (reqIds || []).forEach((rid) => {
    const id = String(rid);
    all[id] = all[id] || {};
    if (!all[id][recordId]) {
      all[id][recordId] = Date.now();
      changed = true;
    }
  });
  return changed ? writeKey(KEYS.seen, all) : all;
}

export function seenCount(reqId: string | number): number {
  return Object.keys(allSeen()[String(reqId)] || {}).length;
}

// ── "I can't answer this" ─────────────────────────────────────────────────
// D4 · declining IS an answer: better than silence, and the buyer sees why.

export const DECLINE_REASONS: Record<DeclineReason, L10n> = {
  stok: { tr: "Bu iş bende yok", en: "I don't carry this", ru: "Этого у меня нет", ar: "لا أتعامل بهذا" },
  adet: { tr: "Adet bana göre değil", en: "Quantity doesn't suit me", ru: "Объём не подходит", ar: "الكمية لا تناسبني" },
  termin: { tr: "Bu tarihe yetiştiremem", en: "Can't make that date", ru: "Не успею к сроку", ar: "لا ألحق بالموعد" },
  dolu: { tr: "Şu an kapasitem dolu", en: "At capacity right now", ru: "Сейчас загружен", ar: "طاقتي ممتلئة الآن" },
};

export function allDeclined(): DeclinesByRequest {
  return readKey<DeclinesByRequest>(KEYS.declined, {});
}

export function putDecline(
  reqId: string | number,
  recordId: string,
  reason: DeclineReason,
): DeclinesByRequest {
  const all = allDeclined();
  const id = String(reqId);
  all[id] = { ...all[id], [recordId]: { reason, at: Date.now() } };
  return writeKey(KEYS.declined, all);
}

/** How many shops said "I can't answer this". The counterpart to seenCount:
 *  the funnel's last step is a declined answer, and it is a real one. */
export function declineCount(reqId: string | number): number {
  return Object.keys(allDeclined()[String(reqId)] || {}).length;
}

export function declineOf(reqId: string | number, recordId: string): Decline | null {
  return (allDeclined()[String(reqId)] || {})[recordId] || null;
}

// ── reviews ───────────────────────────────────────────────────────────────
// K3 · only a buyer who ACCEPTED this shop's offer may write a review. The
// single most effective antidote to fake reviews. The gate itself lives in the
// screen; this module only stores what got through it.

export function allReviews(): ReviewsByRecord {
  return readKey<ReviewsByRecord>(KEYS.reviews, {});
}

export function reviewsOf(recordId: string): Review[] {
  return (allReviews()[recordId] || []).slice();
}

export function putReview(recordId: string, review: Review): Review[] {
  const all = allReviews();
  // Trap 14 · every review needs its own permanent identity. Keying moderation
  // on `recordId + at` meant two reviews written in the same millisecond shared
  // a key, so hiding one hid both.
  const id = "rv" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  all[recordId] = (all[recordId] || []).concat([{ id, at: Date.now(), ...review }]);
  writeKey(KEYS.reviews, all);
  return all[recordId];
}
