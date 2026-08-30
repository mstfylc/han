// HAN — paylaşılan alan mantığı. Saf fonksiyonlar; mobil ve web aynı kuralları kullanır.
// Kural burada tek yerde durur: eşleşme, filtre, sıralama, plan durakları, varış saatleri, kur.

import type * as HanData from "./han-data";
import type { CuratedStore, Lang, Mode } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The whole content module, passed in as `D`. The prototype threaded it
 *  through every function so the same rules could serve two documents; keeping
 *  the signature means the logic stays comparable line-for-line with the
 *  original. */
export type DataNS = typeof HanData;
type Dict<T = any> = Record<string, T>;

/** One line of a shopping list. */
export interface BuyRow {
  id: string;
  name: string;
  qty?: number | string;
  target?: number | string;
  [key: string]: any;
}

/** A route stop: one place, the list items it covers and the shops that match. */
export interface PlanStop {
  key: string;
  han: any | null;
  street: any | null;
  area: any | null;
  items: BuyRow[];
  shops: { shop: CuratedStore; why: any; isCore: boolean }[];
  core: boolean;
}

/** Arrival time and closing risk for one stop. */
export interface ScheduleRow {
  walkMins: number;
  arrive: number;
  arriveLabel: string;
  risky: boolean;
  tight: boolean;
  closeIn: number;
}

export const norm = (s: unknown): string => String(s || "").toLowerCase()
  .replace(/[İI]/g, "i").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
  .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/â/g, "a")
  .replace(/[·.,;:!?()\[\]"']/g, " ").replace(/\s+/g, " ").trim();

export const wordMatch = (hay: unknown, q: unknown): boolean => {
  const h = norm(hay), n = norm(q);
  if (!h || !n) return false;
  if (h === n) return true;
  const hw = h.split(" "), nw = n.split(" ");
  return nw.every((t) => t.length > 2 && hw.some((w) => w === t ||
    (w.length >= 4 && t.length >= 4 && (w.startsWith(t) || t.startsWith(w)))));
};

export const txt = (o: any, lang: Lang | string): string => (o ? (o[lang] ?? o.tr ?? "") : "");
export const loc = (o: any, base: string, lang: Lang | string): string =>
  (o ? (o[base + lang.charAt(0).toUpperCase() + lang.slice(1)] ?? o[base + "Tr"] ?? "") : "");

export const money = (n: number | null | undefined): string => n == null ? "—" : "₺" + Number(n).toLocaleString("tr-TR");

export function convert(D: DataNS, tl: number | null | undefined, lang: Lang | string, currency: string | null | undefined): string {
  if (tl == null || !D) return "";
  const cur = currency === "auto" ? (D.LANG_CURRENCY as Dict<string | null>)[lang] : (currency === "TRY" ? null : currency);
  if (!cur) return "";
  const v = tl * (D.RATES as Dict<number>)[cur];
  const sym = ({ USD: "$", EUR: "€", RUB: "₽", SAR: "﷼" } as Dict<string>)[cur] || "";
  return "≈ " + sym + (v >= 100 ? Math.round(v) : v.toFixed(1));
}

export const toMin = (t: string): number => { const p = String(t).split(":").map(Number); return p[0] * 60 + p[1]; };
export const hhmm = (m: number): string =>
  String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(Math.round(m) % 60).padStart(2, "0");

export function hoursToday(D: DataNS, store: CuratedStore, dow?: number | null): string[] | null {
  const H = store.hours2 || D.HOURS_DEFAULT;
  return (H.weekly || [])[dow == null ? new Date().getDay() : dow] || null;
}
export function isOpenNow(D: DataNS, store: CuratedStore): boolean {
  const day = hoursToday(D, store);
  if (!day) return false;
  const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
  return m >= toMin(day[0]) && m < toMin(day[1]);
}

export function modeAllows(store: CuratedStore, mode: Mode | string): boolean {
  if (mode === "ikisi") return true;
  const t = (store.trade || {}).type;
  return t === "ikisi" || t === mode;
}

// Dil-bağımsız eşleşme: kategori sözlüğü, ürün adları, mağaza adı, kapı no, telefon.
export function matchStore(D: DataNS, store: CuratedStore, query: string, lang: Lang | string): any {
  const q = norm(query);
  if (!q) return null;
  const cats = (store.cats || []).map((id) => D.CATS.find((c) => c.id === id)).filter(Boolean) as any[];
  const catLine = cats.map((c) => txt(c, lang)).join(", ");
  if (cats.flatMap((c) => [c.tr, c.en, c.ru, c.ar].concat(c.words || [])).some((w) => wordMatch(w, q))) return catLine;
  const hit = (store.products || []).filter((p) => [p.tr, p.en, p.ru, p.ar, p.note].some((x) => wordMatch(x, q)));
  if (hit.length) return hit.map((p) => txt(p, lang)).join(", ");
  if (wordMatch(store.name, q)) return catLine;
  const dg = q.replace(/[^\d]/g, "");
  if (dg.length >= 2) {
    if (String(store.no) === dg) return { kind: "door", no: store.no };
    if (dg.length >= 4 && String(store.tel || "").replace(/[^\d]/g, "").includes(dg)) return { kind: "phone" };
  }
  return null;
}

export function areaOf(D: DataNS, store: CuratedStore): string | null | undefined {
  const h = D.HANS.find((x) => x.id === store.han);
  return h ? h.area : store.area;
}

export function filterHits(D: DataNS, base: { s: CuratedStore; [k: string]: any }[], o: Dict): typeof base {
  const flags = o.flagFilters || [];
  let h = base;
  if (o.areaFilter && o.areaFilter !== "all") h = h.filter((x) => areaOf(D, x.s) === o.areaFilter);
  if (o.tradeFilter && o.tradeFilter !== "all")
    h = h.filter((x) => (x.s.trade || {}).type === o.tradeFilter || (x.s.trade || {}).type === "ikisi");
  if (flags.includes("taxfree")) h = h.filter((x) => (x.s.commerce || {}).taxFree);
  if (flags.includes("producer")) h = h.filter((x) => (x.s.trade || {}).isProducer);
  if (flags.includes("cert")) h = h.filter((x) => ((x.s.production || {}).certs || []).length > 0);
  if (flags.includes("moq")) h = h.filter((x) => (((x.s.trade || {}).minOrder || {}).qty ?? Infinity) <= 10);
  if (flags.includes("export")) h = h.filter((x) => (x.s.exportInfo || {}).shipsAbroad);
  if (flags.includes("customs")) h = h.filter((x) => (x.s.exportInfo || {}).customsSupport);
  if (flags.includes("open")) h = h.filter((x) => isOpenNow(D, x.s));
  return h;
}

export function minPrice(store: CuratedStore, mode: Mode | string): number {
  const ps = (store.products || [])
    .map((p) => mode === "toptan" ? (p.wholesale ?? p.retail) : (p.retail ?? p.wholesale))
    .filter((v): v is number => v != null);
  return ps.length ? Math.min.apply(null, ps) : Number.MAX_SAFE_INTEGER;
}

export function sortHits<T extends { s: CuratedStore }>(hits: T[], sort: string, mode: Mode | string): T[] {
  const a = hits.slice();
  a.sort((x, y) =>
    sort === "fiyat" ? minPrice(x.s, mode) - minPrice(y.s, mode) :
    sort === "puan" ? (y.s.rating || 0) - (x.s.rating || 0) :
    sort === "guncel" ? (x.s.gun || 0) - (y.s.gun || 0) :
    (x.s.distance || 0) - (y.s.distance || 0));
  return a;
}

// Alt kategori seviyesi kataloglardan türetilir; ayrı veri tutulmaz.
export function catSubs(D: DataNS, catId: string, lang: Lang | string): { label: string; n: number }[] {
  const own = D.STORES.filter((s) => (s.cats || [])[0] === catId);
  const pool = own.length ? own : D.STORES.filter((s) => (s.cats || []).includes(catId));
  const seen: Dict<{ label: string; n: number }> = {}, out: { label: string; n: number }[] = [];
  pool.forEach((s) => {
    const cat = (D.CATALOG || {})[s.id];
    (cat ? cat.groups || [] : []).forEach((g: any) => {
      const label = txt(g, lang);
      if (seen[label]) { seen[label].n += g.n || 0; return; }
      const item = { label, n: g.n || 0 };
      seen[label] = item; out.push(item);
    });
  });
  return out.sort((a, b) => b.n - a.n);
}

const STOP = ["ve", "and", "и", "و", "&", "y", "а"];
export function monoWords(name: string): string[] {
  return String(name || "").replace(/[·—–\-]/g, " ").trim().split(/\s+/).filter(Boolean)
    .map(x => {
      let s = x;
      if (/^و./.test(s)) s = s.slice(1);
      if (/^ال./.test(s)) s = s.slice(2);
      return s;
    })
    .filter(x => x && STOP.indexOf(x.toLowerCase()) < 0);
}
export function monoText(name: string): string {
  const w = monoWords(name);
  if (!w.length) return "";
  return w.length === 1 ? w[0].slice(0, 2) : w[0].charAt(0) + w[1].charAt(0);
}
export function monoG(name: string): string {
  return monoText(name).toLocaleUpperCase("tr");
}

export function streetPath(D: DataNS, fromId: string | null | undefined, toId: string | null | undefined): string[] {
  if (!fromId || !toId) return fromId ? [fromId] : [];
  if (fromId === toId) return [fromId];
  const q: string[][] = [[fromId]], seen = new Set<string>([fromId]);
  while (q.length) {
    const p = q.shift();
    const cur = p ? D.STREETS.find((x) => x.id === p[p.length - 1]) : null;
    if (!cur) continue;
    for (const n of cur.neighbors || []) {
      if (!p || seen.has(n)) continue;
      seen.add(n);
      const np = p.concat(n);
      if (n === toId) return np;
      q.push(np);
    }
  }
  return [fromId, toId];
}
export function streetOfStore(D: DataNS, s: CuratedStore): string | null {
  return (s.location || {}).street || ((D.HANS.find((h) => h.id === s.han) || ({} as any)).entryStreet) || null;
}

// Alım listesini yer bazlı duraklara çevirir: turist dükkân dükkân değil sokak sokak gezer.
export function planStops(D: DataNS, buyList: BuyRow[], lang: Lang | string): { stops: PlanStop[]; missing: BuyRow[] } {
  const byPlace: Dict<any> = {}, missing: BuyRow[] = [];
  (buyList || []).forEach((item) => {
    const hits = D.STORES.filter((s) => matchStore(D, s, item.name, lang));
    if (!hits.length) { missing.push(item); return; }
    hits.forEach((shop) => {
      const han = D.HANS.find((h) => h.id === shop.han);
      const key = han ? "han:" + han.id : "street:" + ((shop.location || {}).street || shop.area);
      const place = byPlace[key] || (byPlace[key] = {
        key, han: han || null,
        street: D.STREETS.find((x) => x.id === (shop.location || {}).street) || null,
        area: D.AREAS.find((a) => a.id === (han ? han.area : shop.area)) || null,
        items: {}, shops: {}
      });
      place.items[item.id] = item;
      const why = matchStore(D, shop, item.name, lang);
      const catLine = (shop.cats || []).map((id) => txt(D.CATS.find((c) => c.id === id), lang)).join(", ");
      place.shops[shop.id] = { shop, why, isCore: why === catLine };
    });
  });
  const stops: PlanStop[] = Object.values(byPlace).map((p: any) => ({
    ...p, items: Object.values(p.items) as BuyRow[], shops: Object.values(p.shops) as PlanStop["shops"],
    core: (Object.values(p.shops) as PlanStop["shops"]).some((x) => x.isCore)
  }));
  const sOf = (p: PlanStop): string => (p.street || {}).id || (p.han ? p.han.entryStreet : null) || "s-kalpakcilar";
  const ordered: PlanStop[] = [], pool = stops.slice();
  let cur = "s-kalpakcilar";
  for (let guard = 0; guard < stops.length && pool.length; guard++) {
    const coreIdx = pool.map((p, i) => p.core ? i : -1).filter((i) => i >= 0);
    const bag = coreIdx.length ? coreIdx : pool.map((p, i) => i);
    let bestI = bag[0], bestD = Infinity;
    bag.forEach((i) => {
      const d = streetPath(D, cur, sOf(pool[i])).length;
      if (d < bestD || (d === bestD && pool[i].items.length > pool[bestI].items.length)) { bestD = d; bestI = i; }
    });
    const best = pool.splice(bestI, 1)[0];
    if (!best) break;
    ordered.push(best);
    cur = sOf(best);
  }
  return { stops: ordered.concat(pool), missing };
}

// Varış saatleri ve kapanış riski. Çarşı o gün kapandıysa plan yarın sabaha kurulur.
export function planSchedule(D: DataNS, stops: PlanStop[]) {
  const now = new Date(), dow = now.getDay();
  const all = D.STORES.map((s) => hoursToday(D, s, dow)).filter(Boolean).map((h) => toMin((h as string[])[1]));
  const dayClose = all.length ? Math.max.apply(null, all) : 19 * 60;
  const nowM = now.getHours() * 60 + now.getMinutes();
  const tomorrow = nowM >= dayClose;
  let clock = tomorrow ? 9 * 60 + 30 : Math.max(nowM, 9 * 60 + 30);
  let walk = 0, riskCount = 0;
  const sOf = (p: PlanStop): string => (p.street || {}).id || (p.han ? p.han.entryStreet : null) || "s-kalpakcilar";
  const rows: ScheduleRow[] = stops.map((p, i) => {
    const from = i === 0 ? "s-kalpakcilar" : sOf(stops[i - 1]);
    const mins = Math.max(2, (streetPath(D, from, sOf(p)).length - 1) * 3);
    walk += mins; clock += mins;
    const arrive = clock;
    clock += 10 + 4 * p.items.length;
    const closings = p.shops.map((x) => hoursToday(D, x.shop, dow)).filter(Boolean).map((h) => toMin((h as string[])[1]));
    const close = closings.length ? Math.max.apply(null, closings) : 19 * 60;
    const risky = arrive >= close, tight = !risky && (close - arrive) < 30;
    if (risky) riskCount++;
    return { walkMins: mins, arrive, arriveLabel: hhmm(arrive), risky, tight, closeIn: Math.max(0, Math.round(close - arrive)) };
  });
  return { rows, walk, riskCount, endsAt: hhmm(clock), endsMin: clock, tomorrow, dow };
}

export function listTotal(buyList: BuyRow[]): { sum: number; missing: number; has: boolean } {
  let sum = 0, missing = 0;
  (buyList || []).forEach((r) => {
    const t = Number(r.target), q = Number(r.qty) || 0;
    if (t > 0 && q > 0) sum += t * q; else missing++;
  });
  return { sum, missing, has: sum > 0 };
}

// Kademeli fiyat: adet kademeye ulaşıyorsa o birim fiyat, yoksa ürün fiyatı.
export function unitPriceFor(store: CuratedStore, row: BuyRow, mode: Mode | string): number | null {
  const qty = Number(row.qty) || 1;
  const tiers = ((store.trade || {}).tiers || []).slice().sort((a, b) => a.from - b.from);
  let p: number | null = null;
  tiers.forEach((t) => { if (qty >= t.from) p = t.price; });
  if (p != null) return p;
  const n = String(row.name || "").toLowerCase();
  const hit = (store.products || []).find((x) => [x.tr, x.en, x.ru, x.ar].some((v) => String(v || "").toLowerCase().includes(n)));
  const any = hit || (store.products || [])[0];
  if (!any) return null;
  return (mode === "toptan" ? (any.wholesale ?? any.retail) : (any.retail ?? any.wholesale)) ?? null;
}

// Talebe gelen teklifler zamanla damlar: ilk saniyeler beklemede, sonra sırayla düşer.
export function reqOffers(D: DataNS, t: Dict, lang: Lang | string, mode: Mode | string, speedSec?: number) {
  const word = String(t.urun || "").split(/[\s,]+/)[0] || "";
  let stores = D.STORES.filter((s) => matchStore(D, s, word, lang) && modeAllows(s, mode));
  if (!stores.length) stores = D.STORES.filter((s) => modeAllows(s, mode));
  stores = stores.slice(0, 3);
  const age = Date.now() - Number(t.id || 0);
  const first = (speedSec || 8) * 1000;
  const n = age < first ? 0 : age < first * 2.5 ? 1 : stores.length;
  return stores.slice(0, n).map((s, i) => {
    const base = minPrice(s, mode);
    const b = base === Number.MAX_SAFE_INTEGER ? 40 : base;
    return {
      storeId: s.id, name: s.name, verified: !!s.verified, rating: s.rating, tel: s.tel,
      raw: Math.round(b * (1 - 0.04 * i) * 100) / 100, gun: s.gun || 2
    };
  });
}

// Şehir katmanından dükkâna adım adım tarif: kapı → sokak zinciri → çapa → kat.
export function routeSteps(D: DataNS, shop: CuratedStore | null, lang: Lang | string): Dict[] {
  if (!shop) return [];
  const han = D.HANS.find((h) => h.id === shop.han) || null;
  const target = streetOfStore(D, shop) || "s-kalpakcilar";
  const gate = (D.GATES || []).find((g) => g.opensTo === target)
    || (D.GATES || []).find((g) => (streetPath(D, g.opensTo, target) || []).length <= 3)
    || (D.GATES || [])[0] || null;
  const out: Dict[] = [];
  if (gate) out.push({ kind: "gate", id: gate.id, title: txt(gate, lang), note: loc(gate, "mark", lang), mins: 0 });
  const path = gate ? streetPath(D, gate.opensTo, target) : [target];
  path.forEach((id, i) => {
    const st = D.STREETS.find((x) => x.id === id);
    if (!st) return;
    out.push({ kind: "street", id: id, title: txt(st, lang), note: loc(st, "trade", lang), mins: i === 0 ? 1 : 3 });
  });
  const lm = (D.LANDMARKS || []).find((l) => l.id === (shop.location || {}).nearestLandmark)
    || (D.LANDMARKS || []).find((l) => l.street === target) || null;
  if (lm) out.push({ kind: "landmark", id: lm.id, title: txt(lm, lang), note: "", mins: 1 });
  if (han) out.push({ kind: "han", id: han.id, title: han.name, note: "", mins: 2 });
  out.push({
    kind: "door", id: shop.id, title: shop.name,
    note: ((shop.floor || 0) > 0 ? shop.floor : 0), mins: 1
  });
  return out;
}

export function photoUrlOf(D: DataNS, kind: string, key?: string | null, w?: number): string {
  const table = (D.PHOTOS || {})[kind] || {};
  const file = (typeof table === "string" ? table : table[key as string]) || (D.PHOTOS || {}).fallback;
  return file ? D.photoUrl(file, w || 900) : "";
}
export function catPhoto(D: DataNS, id: string): string { return (D.CAT_PHOTO || {})[id] || "assets/ph-shop.png"; }
export function storePhoto(D: DataNS, s: CuratedStore | null): string {
  if (!s) return "assets/ph-shop.png";
  if (s.han) return photoUrlOf(D, "han", s.han);
  const c = (s.cats || [])[0];
  return c ? catPhoto(D, c) : "assets/ph-shop.png";
}
export function eventPhoto(D: DataNS, e: Dict): string {
  if (e.han) return photoUrlOf(D, "han", e.han);
  if (e.area) return photoUrlOf(D, "area", e.area);
  return "assets/ph-shop.png";
}
