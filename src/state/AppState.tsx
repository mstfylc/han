"use client";

// HAN — the buyer surface's single store.
//
// The prototype held everything in one component's `state` and wrote it back to
// `localStorage` on every change. That coupling was deliberate and worth
// keeping: one place writes, so nothing gets lost on a refresh (trap 13).
//
// Here that becomes a context + reducer, with three jobs:
//   1. hold the buyer's state and persist the durable half of it;
//   2. boot the data engine once, applying every cross-surface decision
//      (approvals, drafts, settings, lexicon, geo) before the first paint;
//   3. re-apply those decisions when another surface writes — an editor's
//      approval has to change what the buyer sees, or the decision may as well
//      not have happened (trap 4).

import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState,
} from "react";
import type { ReactNode } from "react";

import type { BuyRequest } from "@/data/types";
import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import { detectLang, isLang } from "@/lib/i18n";
import { PARAM } from "@/lib/routes";
import { BUYER_WATCHED_KEYS, KEYS, readKey, removeKey, subscribeKeys, writeKey } from "@/services/storage";
import { startSync } from "@/services/sync";
import type { AppState, OverrideEntry, PersistedState, TraderSession, UserReport } from "./types";

// ── initial state ─────────────────────────────────────────────────────────

/** Note `vw: 1440`. The server has no viewport, so the first render must be
 *  deterministic; the real width arrives on mount. Reading window here would
 *  make the server and client markup disagree. */
export function initialState(): AppState {
  return {
    lang: "tr",
    currency: "auto",
    mode: "ikisi",

    q: "",
    sort: "mesafe",
    areaFilter: "all",
    tradeFilter: "all",
    flagFilters: [],
    semtFilter: "all",
    placeFilter: "all",
    sectorFilter: "all",
    statusFilter: "all",
    page: 1,
    qty: "",
    qHist: [],
    savedSearches: [],
    cmpPick: [],

    panel: null,
    lastStore: null,
    storeId: null,
    shopTab: "urun",
    shopBt: "all",
    hanFloor: 0,
    placeId: null,
    grpSel: null,
    catSel: null,
    prodCat: null,
    prodSlug: null,
    prSort: "onerilen",
    prLimit: 12,

    buyList: [],
    trips: [],
    tripId: null,
    evPlan: [],
    appts: [],

    saved: [],
    savedNotes: {},
    savedFolders: {},
    savedColl: "all",

    talepler: [],
    acceptedOffers: {},
    isler: "talep",
    selReq: null,
    askLog: [],
    rejects: {},
    outcomes: {},
    buyer: { firm: "", vat: "", country: "", verified: false, telOk: false, tel: "", deals: 0, rate: 0 },
    qa: {},

    mapMode: "route",
    mapFocus: null,
    mapBox: null,

    eventFilter: "all",
    arac: "doviz",
    fxAmount: "1000",
    poiKind: "all",

    reports: [],
    claims: {},
    overrides: {},
    esSession: null,

    user: null,
    readNotifs: [],
    toast: null,
    vw: 1440,
    online: true,
    offersRev: 0,
    tick: 0,
  };
}

// ── reducer ───────────────────────────────────────────────────────────────

export type Action =
  | { type: "patch"; patch: Partial<AppState> }
  | { type: "patchFn"; fn: (s: AppState) => Partial<AppState> };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "patchFn":
      return { ...state, ...action.fn(state) };
    default:
      return state;
  }
}

// ── persistence ───────────────────────────────────────────────────────────

const PERSIST_FIELDS: (keyof PersistedState)[] = [
  "lang", "currency", "mode", "user",
  "buyList", "evPlan", "saved", "appts", "trips", "tripId",
  "talepler", "acceptedOffers", "askLog", "buyer", "outcomes",
  "qHist", "savedSearches", "savedNotes", "savedFolders", "rejects", "qa",
];

/**
 * Publish this buyer's requests into the shared market document.
 *
 * Merged rather than replaced: the document holds every buyer's open requests,
 * so writing our list over it would delete everyone else's. Our own rows are
 * re-keyed by request id, which also means editing a request updates it rather
 * than leaving a stale twin behind.
 */
function publishRequests(mine: BuyRequest[]): void {
  const all = readKey<Record<string, BuyRequest>>(KEYS.requests, {});
  let changed = false;
  (mine || []).forEach((t) => {
    if (!t?.id) return;
    if (JSON.stringify(all[t.id]) === JSON.stringify(t)) return;
    all[t.id] = t;
    changed = true;
  });
  if (changed) writeKey(KEYS.requests, all);
}

/** Every open request in the market, whoever raised it — what a trader quotes
 *  against and what operations measures. */
export function allRequests(): BuyRequest[] {
  const all = readKey<Record<string, BuyRequest>>(KEYS.requests, {});
  return Object.values(all).filter(Boolean);
}

function persist(state: AppState): void {
  const out = {} as Record<string, unknown>;
  PERSIST_FIELDS.forEach((k) => { out[k] = state[k]; });
  writeKey(KEYS.web, out);
  // These live in their own keys because other surfaces read them: the editor
  // reads claims and reports, the trader panel reads overrides.
  writeKey(KEYS.claims, state.claims || {});
  writeKey(KEYS.overrides, state.overrides || {});
  writeKey(KEYS.reports, state.reports || []);
  // The buyer's requests are market state: a trader on another device has to
  // see them or there is nothing to quote against. The buyer keeps their own
  // copy in `web`; this is the published one.
  publishRequests(state.talepler || []);
  // K10 · the trader's session is a phone, not a device: it lives in its own
  // key so the panel surface recognises the same number.
  if (state.esSession) writeKey(KEYS.traderSession, state.esSession);
  else removeKey(KEYS.traderSession);
}

// ── engine boot ───────────────────────────────────────────────────────────

/**
 * B1 · the single merge point for a trader's own corrections.
 *
 * A trader's entry overwrites the generated record and lifts that field's
 * provenance from "estimated" to "trader-declared" — so the screen never shows
 * a guess as if someone had vouched for it.
 */
function applyOverrides(overrides: Record<string, OverrideEntry>): void {
  Object.keys(overrides || {}).forEach((id) => {
    const rec = SC.RECORDS.find((r) => r.id === id);
    const o = overrides[id];
    if (!rec || !o) return;
    if (o.band) { rec.band = o.band; rec.src = { ...rec.src, band: "esnaf" }; }
    if (o.moq != null) { rec.moq = o.moq; rec.src = { ...rec.src, moq: "esnaf" }; }
    if (o.groups && o.groups.length) {
      rec.groups = o.groups.map((name) => {
        const old = (rec.groups || []).find((g) => g.name === name);
        const lo = o.band ? o.band[0] : (old ? old.lo : 0);
        return { name, lines: old ? old.lines : 24, lo, hi: o.band ? o.band[1] : (old ? old.hi : 0) };
      });
      rec.src = { ...rec.src, groups: "esnaf" };
    }
    if (o.photos != null) rec.photos = o.photos;
    if (o.tel) rec.tel = o.tel;
    if (o.hours) rec.hours = o.hours;
    rec.updatedDays = 0;
    if (rec.status === "onayli") rec.status = "aktif";
  });
}

/**
 * Pull in everything the other surfaces have decided.
 *
 * Every document loads its own copy of the engine modules, so writing in one
 * place is not enough — each side has to read. That is why this runs on boot
 * AND on every cross-surface write.
 */
function syncFromOtherSurfaces(overrides: Record<string, OverrideEntry>, reports: UserReport[]): void {
  SC.loadSettings();
  SC.loadPlaces();
  SC.loadSponsors();
  SE.loadLexicon();
  // Records opened in the field must reach the backbone AND the search index —
  // pushing onto RECORDS alone leaves them unfindable (trap 9).
  SC.loadDrafts((rec) => SE.indexRecord(rec));
  // The editor's approvals are the single merge point.
  SC.applyApprovals(readKey(KEYS.approvals, {}));
  // Three reports suspend a record, and that threshold has to survive a reload.
  const counts: Record<string, number> = {};
  (reports || []).forEach((x) => { if (x.recordId) counts[x.recordId] = (counts[x.recordId] || 0) + 1; });
  SC.applyReports(counts);
  applyOverrides(overrides);
}

// ── context ───────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  /** Update state without writing to storage — for transient chrome. */
  set: (patch: Partial<AppState>) => void;
  /** Update state and persist. The prototype's `persist`. */
  save: (patch: Partial<AppState>) => void;
  /** Same, but computed from the previous state. */
  update: (fn: (s: AppState) => Partial<AppState>) => void;
  /** True until the engine has booted and stored state has been read. */
  loading: boolean;
  toast: (message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

/** Convenience: just the state. */
export function useAppState(): AppState {
  return useApp().state;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [loading, setLoading] = useState(true);
  const booted = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback((patch: Partial<AppState>) => {
    dispatch({ type: "patch", patch });
  }, []);

  const update = useCallback((fn: (s: AppState) => Partial<AppState>) => {
    dispatch({ type: "patchFn", fn });
  }, []);

  // `save` marks the change as durable; the effect below does the writing, so
  // there is exactly one place that touches storage.
  const pendingSave = useRef(false);
  const save = useCallback((patch: Partial<AppState>) => {
    pendingSave.current = true;
    dispatch({ type: "patch", patch });
  }, []);

  const toast = useCallback((message: string) => {
    set({ toast: message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => dispatch({ type: "patch", patch: { toast: null } }), 2600);
  }, [set]);

  // ── boot ────────────────────────────────────────────────────────────────
  const boot = useCallback(() => {
    const stored = readKey<Partial<PersistedState> | null>(KEYS.web, null);
    // The mobile app's key is read once, on first open, and never written to.
    const legacy = readKey<Partial<PersistedState> | null>("han-app-v2", null);
    const src = stored || legacy || {};

    // W1 · a shared link carries its own reading of the page, and that beats
    // everything: the URL is more specific than what this browser stored, which
    // is more specific than the browser's own locale. Resolving it here rather
    // than in a second effect is deliberate — a competing effect could not tell
    // "?l=tr" apart from the default tr and silently dropped it, so a Turkish
    // link opened in English on an English browser.
    const url = new URLSearchParams(window.location.search);
    const urlLang = url.get(PARAM.lang);
    const urlCurrency = url.get(PARAM.currency);
    const urlMode = url.get(PARAM.mode);

    const lang = isLang(urlLang) ? urlLang : isLang(src.lang) ? src.lang : detectLang();
    const overrides = readKey<Record<string, OverrideEntry>>(KEYS.overrides, {});
    const reports = readKey<UserReport[]>(KEYS.reports, []);

    syncFromOtherSurfaces(overrides, reports);

    const g0 = (D.CAT_GROUPS || [])[0];
    const defaultTripName =
      ({ tr: "Çarşı günüm", en: "My bazaar day", ru: "Мой день на базаре", ar: "يومي في السوق" } as Record<string, string>)[lang] ||
      "Çarşı günüm";

    dispatch({
      type: "patch",
      patch: {
        lang,
        currency: (urlCurrency as AppState["currency"]) || src.currency || "auto",
        mode: (urlMode as AppState["mode"]) || src.mode || "ikisi",
        buyList: src.buyList || [],
        evPlan: src.evPlan || [],
        saved: src.saved || [],
        appts: src.appts || [],
        trips: (src.trips && src.trips.length) ? src.trips : [{
          id: "t0",
          name: defaultTripName,
          day: "today",
          start: 10,
          hours: 3,
          intent: src.mode === "toptan" ? "is" : "gez",
          carry: "el",
          // An older buying list is not lost: it becomes the first plan's rows.
          items: (src.buyList || []).map((b) => ({ id: b.id, name: b.name, qty: b.qty })),
          done: [],
          phase: "niyet",
        }],
        tripId: src.tripId || null,
        talepler: src.talepler || [],
        acceptedOffers: src.acceptedOffers || {},
        askLog: src.askLog || [],
        rejects: src.rejects || {},
        qa: src.qa || {},
        buyer: src.buyer || initialState().buyer,
        outcomes: src.outcomes || {},
        qHist: src.qHist || [],
        savedSearches: src.savedSearches || [],
        savedNotes: src.savedNotes || {},
        savedFolders: src.savedFolders || {},
        user: (stored && stored.user) || null,
        claims: readKey(KEYS.claims, {}),
        overrides,
        reports,
        esSession: readKey<TraderSession | null>(KEYS.traderSession, null),
        grpSel: g0 ? (g0.id as string) : null,
        catSel: g0 ? ((g0.cats || [])[0] as string) : null,
        vw: window.innerWidth,
        online: navigator.onLine !== false,
      },
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    // Point the persistence layer at the database and wait for the first pull,
    // so the app opens on what is actually stored rather than rendering an
    // empty bazaar and then jumping when the data lands. If the server cannot
    // be reached, startSync resolves anyway and the local mirror is used.
    void startSync().then(boot);
  }, [boot]);

  // ── persistence ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !pendingSave.current) return;
    pendingSave.current = false;
    persist(state);
  }, [state, loading]);

  // ── viewport ────────────────────────────────────────────────────────────
  // The template is inline-styled, so the breakpoints are computed from a
  // measured width rather than declared as media queries.
  useEffect(() => {
    const onResize = () => set({ vw: window.innerWidth });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [set]);

  // ── connectivity ────────────────────────────────────────────────────────
  useEffect(() => {
    const onNet = () => set({ online: navigator.onLine !== false });
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
    return () => {
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
    };
  }, [set]);

  // ── cross-surface sync ──────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const reread = () => {
      const overrides = readKey<Record<string, OverrideEntry>>(KEYS.overrides, {});
      const reports = readKey<UserReport[]>(KEYS.reports, []);
      syncFromOtherSurfaces(overrides, reports);
      dispatch({
        type: "patchFn",
        fn: (s) => ({
          offersRev: (s.offersRev || 0) + 1,
          claims: readKey(KEYS.claims, {}),
          overrides,
          reports,
        }),
      });
    };
    const unsub = subscribeKeys(BUYER_WATCHED_KEYS, reread);
    // Returning to the tab is the other moment another surface's work lands.
    window.addEventListener("focus", reread);
    return () => {
      unsub();
      window.removeEventListener("focus", reread);
    };
  }, [loading]);

  // ── live clock ──────────────────────────────────────────────────────────
  // Offers drip in over time, and "closes in 20 min" has to stay true.
  useEffect(() => {
    if (loading) return;
    const id = setInterval(() => dispatch({ type: "patchFn", fn: (s) => ({ tick: s.tick + 1 }) }), 4000);
    return () => clearInterval(id);
  }, [loading]);

  const value = useMemo<AppContextValue>(
    () => ({ state, set, save, update, loading, toast }),
    [state, set, save, update, loading, toast],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
