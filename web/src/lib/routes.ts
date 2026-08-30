// HAN — the address layer (W1).
//
// The one structural advantage the web has over the app is that every view has
// an address. The prototype earned that with a hash router; on Next it becomes
// real paths, but the shape is deliberately identical so a link that worked in
// the prototype still resolves here.
//
//   #/ara?q=kılıf&s=fiyat&semt=tahtakale   →  /ara?q=kılıf&s=fiyat&semt=tahtakale
//   #/dukkan/emre/guven                    →  /dukkan/emre/guven
//   #/urun/kilif/silikon-kilif             →  /urun/kilif/silikon-kilif
//   #/isler/talep?r=r1                     →  /isler/talep?r=r1
//
// The URL — not React state — owns navigational state: the section, the query,
// the filters, the selected record. That is what makes back/forward work,
// refresh preserve the view, and a copied link open the same thing for someone
// else.

import type { ReadonlyURLSearchParams } from "next/navigation";

import type { Panel } from "@/state/types";

export const SECTIONS = [
  "kesfet", "ara", "kategori", "plan", "isler", "esnaf",
  "arac", "harita", "etkinlik", "dukkan", "yer", "urun",
] as const;

export type Section = (typeof SECTIONS)[number];

/** Which top-level section a pathname belongs to. Drives the header's active
 *  state, and nothing else. */
export function sectionOf(pathname: string): Section {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg) return "kesfet";
  if ((SECTIONS as readonly string[]).includes(seg)) return seg as Section;
  // The stand-alone panel addresses live under Ara.
  if (seg === "sokak" || seg === "han" || seg === "tarif") return "ara";
  return "kesfet";
}

export function pathOfSection(section: Section): string {
  return section === "kesfet" ? "/" : "/" + section;
}

// ── query parameters ──────────────────────────────────────────────────────
// Short names, exactly as the prototype used them: a shared link should be
// readable, not a wall of verbose keys.

export const PARAM = {
  q: "q",
  sort: "s",
  semt: "semt",
  trade: "tur",
  flags: "oz",
  group: "grup",
  cat: "kat",
  mapMode: "k",
  eventKind: "etur",
  request: "r",
  panel: "p",
  place: "yer",
  door: "kapi",
  record: "kayit",
  floor: "kt",
  lang: "l",
  currency: "c",
  mode: "m",
  page: "sayfa",
} as const;

type Params = URLSearchParams | ReadonlyURLSearchParams;

export function getStr(sp: Params, key: string, fallback = ""): string {
  const v = sp.get(key);
  return v == null ? fallback : v;
}

export function getNum(sp: Params, key: string, fallback = 0): number {
  const v = Number(sp.get(key));
  return Number.isFinite(v) && sp.get(key) != null ? v : fallback;
}

export function getList(sp: Params, key: string): string[] {
  const v = sp.get(key);
  return v ? v.split(",").filter(Boolean) : [];
}

/** `p=store:emre` → `{kind:"store", id:"emre"}`. One source of truth for the
 *  right-hand column; two separate selectors would drift. */
export function getPanel(sp: Params): Panel | null {
  const raw = sp.get(PARAM.panel);
  if (!raw) return null;
  const i = raw.indexOf(":");
  if (i < 0) return null;
  const kind = raw.slice(0, i);
  const id = raw.slice(i + 1);
  if (!id) return null;
  if (kind !== "store" && kind !== "route" && kind !== "street" && kind !== "han") return null;
  return { kind, id };
}

export function panelParam(panel: Panel | null): string | null {
  return panel ? panel.kind + ":" + panel.id : null;
}

/**
 * Build a query string, dropping anything that equals its default.
 *
 * Defaults are omitted on purpose: a link should carry what the reader
 * actually chose, not the whole state of the app.
 */
export function buildQuery(
  entries: Record<string, string | number | string[] | null | undefined>,
  defaults: Record<string, string | number> = {},
): string {
  const sp = new URLSearchParams();
  Object.entries(entries).forEach(([k, v]) => {
    if (v == null) return;
    const value = Array.isArray(v) ? v.join(",") : String(v);
    if (value === "") return;
    if (defaults[k] != null && value === String(defaults[k])) return;
    sp.set(k, value);
  });
  const s = sp.toString();
  return s ? "?" + s : "";
}

/** Merge a patch onto the current params, dropping keys set to null. */
export function withParams(
  sp: Params,
  patch: Record<string, string | number | string[] | null | undefined>,
): string {
  const next = new URLSearchParams(sp.toString());
  Object.entries(patch).forEach(([k, v]) => {
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) next.delete(k);
    else next.set(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  const s = next.toString();
  return s ? "?" + s : "";
}

// ── stable links to the things people share ───────────────────────────────

export const href = {
  home: () => "/",
  search: (q?: string) => "/ara" + (q ? buildQuery({ [PARAM.q]: q }) : ""),
  /** A shop is a full page with its own address, not just a panel. */
  store: (id: string, tab?: string) => "/dukkan/" + encodeURIComponent(id) + (tab && tab !== "urun" ? "/" + tab : ""),
  street: (id: string) => "/sokak/" + encodeURIComponent(id),
  han: (id: string, floor?: number) => "/han/" + encodeURIComponent(id) + (floor ? "/" + floor : ""),
  directions: (id: string) => "/tarif/" + encodeURIComponent(id),
  place: (id: string) => "/yer/" + encodeURIComponent(id),
  product: (cat: string, slug?: string | null) =>
    "/urun/" + encodeURIComponent(cat) + (slug ? "/" + encodeURIComponent(slug) : ""),
  category: (group?: string | null, cat?: string | null) =>
    "/kategori" + buildQuery({ [PARAM.group]: group, [PARAM.cat]: cat }),
  plan: () => "/plan",
  work: (view = "talep", requestId?: string | null) =>
    "/isler/" + view + buildQuery({ [PARAM.request]: requestId }),
  tool: (tool = "doviz") => "/arac/" + tool,
  map: (mode?: string) => "/harita" + buildQuery({ [PARAM.mapMode]: mode }, { [PARAM.mapMode]: "route" }),
  events: (kind?: string) => "/etkinlik" + buildQuery({ [PARAM.eventKind]: kind }, { [PARAM.eventKind]: "all" }),
  /** The trader's own door into the buyer surface. `place`/`door` pre-fill the
   *  finder so "is it yours?" lands on the right unit instead of a blank form. */
  trader: (tab = "bul", opts?: { place?: string; door?: string | number; record?: string }) =>
    "/esnaf" + (tab && tab !== "bul" ? "/" + tab : "") +
    buildQuery({
      [PARAM.place]: opts?.place,
      [PARAM.door]: opts?.door,
      [PARAM.record]: opts?.record,
    }),
};

/**
 * A shareable link: absolute, and carrying the reader's language, currency and
 * buying mode so the recipient opens what the sender was looking at.
 */
export function shareUrl(
  pathname: string,
  search: string,
  opts: { lang: string; currency: string; mode: string },
): string {
  if (typeof window === "undefined") return pathname + search;
  const url = new URL(pathname + search, window.location.origin);
  url.searchParams.set(PARAM.lang, opts.lang);
  if (opts.currency !== "auto") url.searchParams.set(PARAM.currency, opts.currency);
  if (opts.mode !== "ikisi") url.searchParams.set(PARAM.mode, opts.mode);
  return url.toString();
}
