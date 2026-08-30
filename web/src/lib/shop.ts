// HAN — presentation helpers shared by every screen.
//
// These are the small style/label builders the prototype defined inside
// `renderVals()` and reused across sections. Pulling them out means the search
// list, the store page and the plan all describe a shop the same way — which is
// the point: a badge must mean the same thing wherever it appears.

import * as D from "@/data/han-data";
import * as L from "@/data/han-logic";
import * as SC from "@/data/han-scale";
import type { CuratedStore, Lang, Mode, ShopRecord } from "@/data/types";
import { F, W } from "@/lib/copy";
import { tonePair, tx } from "@/lib/i18n";

/** Icon medallion — a soft square holding an icon. */
export function medStyle(tone: string, size = 40): string {
  const t = tonePair(tone);
  return (
    "flex:none;width:" + size + "px;height:" + size +
    "px;border-radius:11px;display:flex;align-items:center;justify-content:center;" +
    "background:" + t.bg + ";color:" + t.fg
  );
}

/** Monogram medallion — for a record with no logo. */
export function monoStyle(tone: string, size = 40): string {
  const known = ["primary", "accent", "success", "danger", "warning", "info", "dark"];
  const ok = known.indexOf(tone) >= 0;
  return (
    "flex:none;width:" + size + "px;height:" + size +
    "px;border-radius:10px;display:flex;align-items:center;justify-content:center;" +
    "background:" + (ok ? "var(--color-" + tone + "-soft)" : "var(--color-grey-100)") +
    ";color:" + (ok ? "var(--color-" + tone + ")" : "var(--text-body)") +
    ";font-size:" + Math.round(size * 0.36) +
    "px;font-weight:700;letter-spacing:.01em;text-transform:uppercase"
  );
}

/** Small pill: label + tone. */
export function pillStyle(tone: string, height = 24): string {
  const t = tonePair(tone);
  return (
    "display:inline-flex;align-items:center;height:" + height +
    "px;padding:0 9px;border-radius:6px;font-size:12px;font-weight:700;background:" +
    t.bg + ";color:" + t.fg
  );
}

export interface BadgeSpec {
  label: string;
  style: string;
}

export function badge(label: string, tone: string): BadgeSpec {
  return { label, style: pillStyle(tone) };
}

/** Trade badges for a curated store. */
export function storeBadges(s: CuratedStore, lang: Lang): BadgeSpec[] {
  const out: BadgeSpec[] = [];
  const t: Partial<import("@/data/types").Trade> = s.trade || {};
  if (t.type === "toptan" || t.type === "ikisi") out.push(badge(F(lang, "wholesale"), "primary"));
  if (t.type === "perakende" || t.type === "ikisi") out.push(badge(F(lang, "retail"), "info"));
  if (t.isProducer) out.push(badge(F(lang, "fProducer"), "success"));
  if ((s.commerce || {}).taxFree) out.push(badge(F(lang, "fTaxFree"), "accent"));
  if ((s.exportInfo || {}).shipsAbroad) out.push(badge(F(lang, "fExport"), "warning"));
  return out;
}

/** Trade badges for a scale record. Reads the capability SET, not one value —
 *  the same shop can sell wholesale and retail. */
export function recordBadges(r: ShopRecord, lang: Lang): BadgeSpec[] {
  const out: BadgeSpec[] = [];
  const sells = (r.trade && r.trade.sells) || [r.sector];
  if (sells.includes("toptan")) out.push(badge(F(lang, "wholesale"), "primary"));
  if (sells.includes("perakende")) out.push(badge(F(lang, "retail"), "info"));
  if (r.isProducer) out.push(badge(F(lang, "fProducer"), "success"));
  if (r.taxFree) out.push(badge(F(lang, "fTaxFree"), "accent"));
  if (r.shipsAbroad) out.push(badge(F(lang, "fExport"), "warning"));
  return out;
}

/** "Open now" / "Closed" pill for a curated store. */
export function openPill(s: CuratedStore, lang: Lang): BadgeSpec {
  const on = L.isOpenNow(D, s);
  return {
    label: on ? W(lang, "openNow") : W(lang, "closedNow"),
    style:
      "flex:none;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;font-size:11.5px;font-weight:700;background:var(--color-" +
      (on ? "success" : "danger") +
      "-soft);color:var(--color-" +
      (on ? "success" : "danger") +
      ")",
  };
}

export function floorLabel(n: number, lang: Lang): string {
  return n > 0 ? F(lang, "hanFloor", n) : F(lang, "hanGround");
}

/** "Yıldız Han · 2. kat" — where a curated store physically is. */
export function whereOf(s: CuratedStore, lang: Lang): string {
  const h = D.HANS.find((x) => x.id === s.han);
  const a = D.AREAS.find((x) => x.id === L.areaOf(D, s));
  return (h ? (h.name as string) : tx(a, lang)) + " · " + floorLabel(s.floor || 0, lang);
}

/** Same, for a scale record: place · floor · door. The address backbone is the
 *  product's real asset, so it is always spelled out. */
export function whereOfRecord(r: ShopRecord, lang: Lang): string {
  const p = SC.PLACES.find((x) => x.id === r.place);
  const parts = [p ? p.name : r.place, floorLabel(r.floor || 0, lang)];
  if (r.door) parts.push(F(lang, "kDoor", r.door));
  return parts.filter(Boolean).join(" · ");
}

/** How many curated stores sit in a category. */
export function shopsIn(catId: string): number {
  return D.STORES.filter((s) => (s.cats || []).includes(catId)).length;
}

/** Lowest price a store quotes in the active mode. */
export function priceOf(s: CuratedStore, mode: Mode): { value: number | null; label: string } {
  const p = L.minPrice(s, mode);
  const missing = p === Number.MAX_SAFE_INTEGER;
  return { value: missing ? null : p, label: missing ? "—" : L.money(p) };
}

// ── photos ────────────────────────────────────────────────────────────────
//
// Every image in this app is a local file. The project settled that once
// already — category and shop cards moved off remote Commons URLs so the app
// works offline in the bazaar, which is exactly where it gets used. The web
// screens still reached for the remote han photos through `photoUrlOf`, so
// those are mapped to the local placeholder set here.
//
// A generic placeholder is the honest option anyway: we do not have a
// photograph of shop r517, and pretending otherwise is the thing the store
// page's "photo honesty" block exists to prevent.

const PLACE_PHOTO: Record<string, string> = {
  han: "/assets/ph-han.png",
  gate: "/assets/ph-gate.png",
  landmark: "/assets/ph-landmark.png",
  area: "/assets/ph-shop.png",
  campaign: "/assets/ph-kampanya.png",
};

/** Local placeholder for a place-kind image (han · gate · landmark · area). */
export function placePhoto(kind: string): string {
  return PLACE_PHOTO[kind] || "/assets/ph-shop.png";
}

/** Photo for a curated store: its own category's picture, which at least shows
 *  the right kind of goods. */
export function storePhoto(s: CuratedStore | null): string {
  if (!s) return "/assets/ph-shop.png";
  const cat = (s.cats || [])[0];
  return cat ? catPhoto(cat) : "/assets/ph-shop.png";
}

export function catPhoto(id: string): string {
  return toPublic(L.catPhoto(D, id));
}

/** The data layer stores asset paths as the prototype used them
 *  ("assets/ph-shop.png"); in Next they are served from /public. */
export function toPublic(path: string | null | undefined): string {
  if (!path) return "";
  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:")) return path;
  return path.startsWith("/") ? path : "/" + path;
}

/** Photo for a scale record: it has no gallery of its own, so it borrows its
 *  category's. The store page says so out loud rather than implying the shot is
 *  of this shop (photo honesty). */
export function recordPhoto(r: ShopRecord): string {
  if (r.curated) {
    const s = D.STORES.find((x) => x.id === r.curated);
    if (s) return storePhoto(s);
  }
  return catPhoto(r.cat);
}

/** Display name for a record. A record with no name shows its category — never
 *  a blank or an id. */
export function recordName(r: ShopRecord, lang: Lang): string {
  if (r.name) return r.name;
  const c = [...(D.CATS || []), ...SC.CATS_EXTRA].find((x) => x.id === r.cat);
  return c ? tx(c, lang) : r.cat;
}
