// HAN — buyer-surface state shape.
//
// One-for-one with the prototype's component state. The names are kept so the
// port can be read side by side with `HAN Web.dc.html`; only the transport
// (a reducer + context instead of setState) is different.

import type {
  AcceptedOffer, BuyRequest, BuyerTier, Currency, Lang, Mode, SortKey,
} from "@/data/types";

/** A line in the buying list. */
export interface BuyItem {
  id: string;
  name: string;
  qty?: string | number;
  target?: string | number;
}

/** A bazaar day. There can be more than one — "my day" is a named plan, not a
 *  single global list. */
export interface Trip {
  id: string;
  name: string;
  day: string;
  start: number;
  hours: number;
  /** what the day is for — browsing or business */
  intent: "gez" | "is";
  /** how much the buyer can carry: by hand, trolley, courier */
  carry: string;
  items: BuyItem[];
  done: string[];
  phase: "niyet" | "rota" | "yuruyus";
  /** set once the buyer reorders stops by hand; "back to automatic" stays visible */
  order?: string[] | null;
}

/** M5 · the third source in the day calendar, beside stops and events. */
export interface Appointment {
  id: string;
  time: string;
  title: string;
  where: string;
}

/** The right-hand column has one source of truth, not two selectors. */
export interface Panel {
  kind: "store" | "route" | "street" | "han";
  id: string;
}

/** A saved search, kept with the result count at the time it was saved — the
 *  concrete evidence that coverage moved. */
export interface SavedSearch {
  q: string;
  at: number;
  count: number;
  filters?: Record<string, unknown>;
}

/** A user report on a record. Three of them suspend it automatically. */
export interface UserReport {
  recordId: string;
  reason: string;
  detail?: string;
  at: number;
}

/**
 * A trader's claim on a generated record.
 *
 * Owning a record is a decision, not a button: the trader asks, an officer or
 * the han's own management approves. Until `status` turns "onayli" not one
 * field of the record changes — that rule bends for no one, which is why the
 * claim carries the officer it was routed to and nothing else can unlock it.
 */
export interface Claim {
  record: string;
  name: string;
  place: string;
  floor: number;
  door: number | string;
  owner: string;
  tel: string;
  /** how the trader offered to prove it: registry · document · site visit */
  proof: string;
  officer?: string | null;
  status: "bekliyor" | "onayli" | "red";
  /** the officer's words when a claim is rejected — feedback, not a verdict */
  reason?: string;
  at: number;
}

/** K10 · the record is tied to the phone on the claim, not to this browser, so
 *  the same trader can manage it from any device. */
export interface TraderSession {
  tel: string;
  at: number;
}

/** Did the deal actually happen? HAN is not an arbiter, only a record-keeper
 *  (K3): it asks both sides one question and feeds the answer into trust. */
export type Outcome = "aldim" | "bozuldu" | "donus-yok";

export interface AppState {
  // ── preferences ────────────────────────────────────────────────────────
  lang: Lang;
  currency: Currency;
  mode: Mode;

  // ── search ─────────────────────────────────────────────────────────────
  q: string;
  sort: SortKey | string;
  areaFilter: string;
  tradeFilter: string;
  flagFilters: string[];
  semtFilter: string;
  placeFilter: string;
  sectorFilter: string;
  statusFilter: string;
  page: number;
  qty: string;
  /** recent queries — eight of them, one tap back */
  qHist: string[];
  savedSearches: SavedSearch[];
  /** hand-ticked records for "compare what I picked" (2–5) */
  cmpPick: string[];

  // ── selection ──────────────────────────────────────────────────────────
  panel: Panel | null;
  lastStore: string | null;
  storeId: string | null;
  shopTab: string;
  shopBt: string;
  hanFloor: number;
  placeId: string | null;
  grpSel: string | null;
  catSel: string | null;
  prodCat: string | null;
  prodSlug: string | null;
  prSort: string;
  prLimit: number;

  // ── plan ───────────────────────────────────────────────────────────────
  buyList: BuyItem[];
  trips: Trip[];
  tripId: string | null;
  evPlan: string[];
  appts: Appointment[];

  // ── saved ──────────────────────────────────────────────────────────────
  saved: string[];
  savedNotes: Record<string, string>;
  savedFolders: Record<string, string>;
  savedColl: string;

  // ── requests · offers ──────────────────────────────────────────────────
  talepler: BuyRequest[];
  acceptedOffers: Record<string, AcceptedOffer>;
  isler: string;
  selReq: string | null;
  askLog: { recordId: string; text: string; at: number }[];
  rejects: Record<string, unknown>;
  outcomes: Record<string, Outcome>;
  /** K2 · buyer verification is voluntary and tiered: identity buys priority,
   *  money does not. */
  buyer: BuyerTier & { firm: string; vat: string; country: string; tel: string };
  qa: Record<string, unknown>;

  // ── map ────────────────────────────────────────────────────────────────
  mapMode: string;
  mapFocus: string | null;
  mapBox: string[] | null;

  // ── events · tools ─────────────────────────────────────────────────────
  eventFilter: string;
  arac: string;
  fxAmount: string;
  poiKind: string;

  // ── reports ────────────────────────────────────────────────────────────
  reports: UserReport[];

  // ── cross-surface data written elsewhere ───────────────────────────────
  claims: Record<string, Claim>;
  overrides: Record<string, OverrideEntry>;
  /** the trader's phone session; null until they sign in */
  esSession: TraderSession | null;

  // ── session · chrome ───────────────────────────────────────────────────
  user: { name?: string; contact?: string } | null;
  readNotifs: string[];
  toast: string | null;
  /** viewport width — the breakpoints are computed, not media queries, because
   *  the template is inline-styled */
  vw: number;
  online: boolean;
  /** bumped whenever another surface writes, to force a recompute */
  offersRev: number;
  /** offers drip in over time; this keeps the screen live */
  tick: number;
}

/** A trader's corrections to their own generated record. Applying one lifts
 *  the field's provenance from `tahmini` to `esnaf` (K11). */
export interface OverrideEntry {
  band?: [number, number];
  moq?: number;
  groups?: string[];
  photos?: number;
  tel?: string;
  hours?: { open: number; close: number };
}

/** What gets written to `han-web-v1`. Deliberately narrower than AppState:
 *  transient chrome (toast, tick, vw) has no business surviving a reload. */
export type PersistedState = Pick<
  AppState,
  | "lang" | "currency" | "mode" | "user"
  | "buyList" | "evPlan" | "saved" | "appts" | "trips" | "tripId"
  | "talepler" | "acceptedOffers" | "askLog" | "buyer" | "outcomes"
  | "qHist" | "savedSearches" | "savedNotes" | "savedFolders" | "rejects" | "qa"
>;
