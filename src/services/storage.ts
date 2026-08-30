// HAN — persistence driver.
//
// The prototype wrote straight to `localStorage` and let three documents talk to
// each other through `storage` events. That is a real requirement, not an
// accident: the same truth has to show up in the buyer tab, the trader panel and
// the admin panel at once (handoff §6). It is only the *transport* that is
// temporary.
//
// So every read and write goes through one driver here. Swapping in an HTTP
// backend later means implementing `StorageDriver` once — no screen changes.
//
// Everything is SSR-safe: on the server the driver is a no-op that returns
// defaults, so a page can render before hydration without crashing.

export interface StorageDriver {
  read<T>(key: string, fallback: T): T;
  write<T>(key: string, value: T): T;
  remove(key: string): void;
  /** Fires when another tab (or another surface) changes a key. */
  subscribe(keys: string[], onChange: (key: string) => void): () => void;
}

const memory = new Map<string, string>();

const hasWindow = () => typeof window !== "undefined";

/** In-memory fallback — used during SSR and when the browser denies storage
 *  (private mode, blocked site data). The app must still work, just without
 *  anything surviving a reload. */
function backingStore(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  if (!hasWindow()) {
    return {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    };
  }
  try {
    // Touch it: some browsers throw on access rather than on use.
    window.localStorage.getItem("han-probe");
    return window.localStorage;
  } catch {
    return {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    };
  }
}

/** Notifies listeners in *this* document. The native `storage` event only
 *  fires in other tabs, so a same-tab write would otherwise go unnoticed. */
const localListeners = new Set<(key: string) => void>();

export const browserDriver: StorageDriver = {
  read<T>(key: string, fallback: T): T {
    try {
      const raw = backingStore().getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt JSON is not worth crashing a screen over — fall back and let
      // the next write repair it.
      return fallback;
    }
  },

  write<T>(key: string, value: T): T {
    try {
      backingStore().setItem(key, JSON.stringify(value));
    } catch {
      // Quota exceeded or storage denied. The in-memory copy above still holds
      // for this session.
    }
    localListeners.forEach((fn) => fn(key));
    return value;
  },

  remove(key: string): void {
    try {
      backingStore().removeItem(key);
    } catch {
      /* nothing to undo */
    }
    localListeners.forEach((fn) => fn(key));
  },

  subscribe(keys: string[], onChange: (key: string) => void): () => void {
    if (!hasWindow()) return () => {};
    const watched = new Set(keys);

    const onNative = (e: StorageEvent) => {
      if (e.key && watched.has(e.key)) onChange(e.key);
    };
    const onLocal = (key: string) => {
      if (watched.has(key)) onChange(key);
    };

    window.addEventListener("storage", onNative);
    localListeners.add(onLocal);
    return () => {
      window.removeEventListener("storage", onNative);
      localListeners.delete(onLocal);
    };
  },
};

let driver: StorageDriver = browserDriver;

/** Swap the driver — the seam an HTTP/API backend plugs into. */
export function setStorageDriver(next: StorageDriver): void {
  driver = next;
}

export function readKey<T>(key: string, fallback: T): T {
  return driver.read(key, fallback);
}

export function writeKey<T>(key: string, value: T): T {
  return driver.write(key, value);
}

export function removeKey(key: string): void {
  driver.remove(key);
}

export function subscribeKeys(keys: string[], onChange: (key: string) => void): () => void {
  return driver.subscribe(keys, onChange);
}

/** The full key map from the handoff §6. Each one becomes a resource when the
 *  backend is real; keeping them in one place is what makes that swap boring. */
export const KEYS = {
  /** buyer session: requests, plan, appointments, saved, language, mode, history */
  web: "han-web-v1",
  /** real offers — POST/GET /requests/:id/offers */
  offers: "han-offers-v1",
  /** funnel telemetry: the "opened it" event */
  seen: "han-seen-v1",
  /** POST /requests/:id/decline */
  declined: "han-declined-v1",
  /** POST/GET /records/:id/reviews — gated on an accepted offer */
  reviews: "han-reviews-v1",
  /** trader ownership claims */
  claims: "han-claims-v1",
  /** editor decisions — append-only audit log */
  approvals: "han-approvals-v1",
  /** buyer reports; three of them suspend a record automatically */
  reports: "han-reports-v1",
  /** a trader's corrections to their own record */
  overrides: "han-overrides-v1",
  /** records opened in the field */
  drafts: "han-panel-drafts",
  /** trader session (phone verification) */
  traderSession: "han-esnaf-session",
  /** publication rules — read by all three surfaces */
  settings: "han-settings-v1",
  /** paid placements */
  sponsors: "han-sponsors-v1",
  /** place corrections (floors, units, bulk agreement) */
  places: "han-places-v1",
  /** report · review · buyer decisions */
  moderation: "han-moderation-v1",
  /** manual offer routing */
  nudges: "han-nudges-v1",
  /** search synonyms */
  lexicon: "han-lexicon-v1",
  /** event/campaign add·hide layer */
  content: "han-content-v1",
  /** store images (order, cover, approval) */
  media: "han-media-v1",
  /** place geography, gates, floor plans */
  geo: "han-geo-v1",
  /** field visits assigned to an officer */
  tasks: "han-tasks-v1",
  /** the operations team: who exists, what role, which area */
  users: "han-users-v1",
  /**
   * ⚠ PROTOTYPE ONLY — never ships as real authentication.
   *
   * The prototype keeps PINs, reset codes and the session in the browser so the
   * screens and their states can be demonstrated. A PIN in localStorage is
   * readable by any script on the origin and by anyone with the device; reset
   * codes stored client-side can simply be read instead of received. Real
   * verification belongs on the server (see the Postgres phase), which is why
   * this key is deliberately NOT in BUYER_WATCHED_KEYS and must not grow into
   * the production login.
   */
  auth: "han-auth-v1",
} as const;

export type StorageKey = (typeof KEYS)[keyof typeof KEYS];

/** Keys the buyer surface must react to when another surface changes them.
 *  An editor approving a record has to change what the buyer sees — writing
 *  without reading is the same as the decision never happening (trap 4). */
export const BUYER_WATCHED_KEYS: string[] = [
  KEYS.offers,
  KEYS.seen,
  KEYS.declined,
  KEYS.reviews,
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
];
