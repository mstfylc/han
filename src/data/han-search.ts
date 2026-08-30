// HAN · Ölçekli arama (Ö2)
// 10 binlerce kayıtta filtre yetmez: ürün, sıralamanın kendisidir.
// Üç aşama: (1) sorguyu anla, (2) aday havuzunu daralt, (3) sırala.
// Hiçbir sorgu "sonuç yok" ile bitmez — eşleşme zayıfsa talep önerisi döner.

import { RECORDS, PLACES, SEMTLER, STATUS, SECTORS, CATS_EXTRA, SETTINGS, sellsIn, tradeFor } from "./han-scale";
import { candidatesFor, getIndex, stats as indexStats } from "./han-index";
import { CATS } from "./han-data";
import { readKey, writeKey } from "@/services/storage";
import type {
  Band, Facets, Offer, ParsedQuery, Place, ProductDetail,
  ProductSummary, Reason, SearchCtx, SearchFilters, SearchHit, SearchResult,
  ShopRecord, BuyRequest, DistributeResult, DistributeRule,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Dict<T = any> = Record<string, T>;

// Keep Cyrillic and Arabic letters. Stripping everything outside [a-z0-9]
// wiped 40 of the 142 lexicon entries — the whole Russian and Arabic half —
// down to the empty string, and made every non-Latin query normalise to "",
// which turned "no query" on and returned the entire directory. Same failure
// as the multi-word synonym bug (trap 15), one order of magnitude bigger.
const NON_WORD = /[^a-z0-9\u0400-\u04ff\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff\s]/g;
const TRMAP: Dict<string> = { "ı": "i", "İ": "i", "ş": "s", "ğ": "g", "ü": "u", "ö": "o", "ç": "c", "â": "a", "î": "i", "û": "u" };
export const norm = (s: unknown): string => String(s || "").toLowerCase().replace(/[ıİşğüöçâîû]/g, c => TRMAP[c] || c)
  .replace(NON_WORD, " ").replace(/\s+/g, " ").trim();

// Çok dilli eşanlam: aynı şeyin dört dildeki ve sokaktaki adı tek kategoriye düşer.
export const SYNONYMS: Dict<string[]> = {
  kilif: ["kilif", "kılıf", "case", "cover", "чехол", "غطاء", "telefon kabi", "phone case", "kapak"],
  sarj: ["sarj", "şarj", "charger", "kablo", "cable", "powerbank", "зарядка", "кабель", "شاحن", "kulaklik", "headphone"],
  tekstil: ["tekstil", "textile", "kumas", "fabric", "konfeksiyon", "tisort", "tshirt", "havlu", "towel", "ткань", "текстиль", "نسيج", "полотенце"],
  poset: ["poset", "poşet", "bag", "ambalaj", "packaging", "kutu", "box", "karton", "упаковка", "пакет", "تغليف", "كيس"],
  taki: ["taki", "takı", "jewellery", "jewelry", "altin", "gold", "yuzuk", "ring", "ювелир", "золото", "ذهب", "مجوهرات"],
  bijuteri: ["bijuteri", "bijou", "imitation", "boncuk", "bead", "aksesuar", "accessory", "бижутерия", "أكسسوار"],
  hali: ["hali", "halı", "carpet", "rug", "kilim", "ковер", "سجاد"],
  deri: ["deri", "leather", "canta", "çanta", "bag", "kemer", "belt", "кожа", "сумка", "جلد", "حزام"],
  baharat: ["baharat", "spice", "safran", "saffron", "kuruyemis", "nuts", "lokum", "delight", "специи", "بهارات", "زعفران"],
  hediyelik: ["hediyelik", "souvenir", "gift", "cini", "çini", "ceramic", "nazar", "сувенир", "подарок", "هدية", "خزف"],
  gida: ["gida", "gıda", "food", "bakliyat", "peynir", "zeytin", "продукты", "بقالة"],
  kitap: ["kitap", "book", "kirtasiye", "stationery", "книга", "كتاب"],
  hizmet: ["kargo", "cargo", "nakliye", "freight", "shipping", "doviz", "exchange", "gumruk", "customs", "tercume", "translation", "карго", "شحن"],
  imalat: ["imalat", "atolye", "workshop", "fason", "oem", "uretim", "manufacturing", "производство", "ورشة"]
};

const CAT_OF_WORD: Dict<string> = (() => {
  const m: Dict<string> = {};
  Object.keys(SYNONYMS).forEach((cat) => SYNONYMS[cat].forEach((w) => { m[norm(w)] = cat; }));
  ([] as any[]).concat(CATS || [], CATS_EXTRA || []).forEach((c: any) => {
    (["tr", "en", "ru", "ar"] as const).forEach((l) => { if (c[l]) norm(c[l]).split(" ").forEach((w: string) => { if (w.length > 2 && !m[w]) m[w] = c.id; }); });
  });
  return m;
})();

// ── Arama sözlüğü yönetimi ────────────────────────────────────────────────
// Sonuçsuz arama bir sinyaldi ama kolu yoktu: eşanlam eklenemiyordu. SYNONYMS
// ve CAT_OF_WORD modül yüklenirken kuruluyor, o yüzden eklemenin tek yolu burası.
export const LEXICON_KEY = "han-lexicon-v1";

export function addSynonym(catId: string, word: string): false | { ok: true; clash: string | null } {
  const w = String(word || "").trim();
  if (!w || !catId) return false;
  const n = norm(w);
  if (!n || n.length < 2) return false;
  SYNONYMS[catId] = SYNONYMS[catId] || [];
  if (!SYNONYMS[catId].includes(w)) SYNONYMS[catId].push(w);
  // Aynı kelime başka kategoriye bağlıysa üzerine yazmayız: çakışma sessizce
  // eski eşleşmeyi bozmamalı — yönetim ekranı bunu uyarı olarak gösterir.
  const clash = CAT_OF_WORD[n] && CAT_OF_WORD[n] !== catId ? CAT_OF_WORD[n] : null;
  CAT_OF_WORD[n] = catId;
  return { ok: true, clash };
}

export function synonymOwner(word: string): string | null {
  const n = norm(word);
  return n ? (CAT_OF_WORD[n] || null) : null;
}

export function synonymsOf(catId: string): string[] { return (SYNONYMS[catId] || []).slice(); }

export function dropSynonym(catId: string, word: string): void {
  const n = norm(word);
  SYNONYMS[catId] = (SYNONYMS[catId] || []).filter((w) => norm(w) !== n);
  if (CAT_OF_WORD[n] === catId) delete CAT_OF_WORD[n];
}

// Panelde eklenenler kalıcı: Web açılışta bunu çağırır, yoksa eşanlam yalnız
// eklendiği sekmede yaşar.
interface Lexicon { synonyms?: Dict<string[]> }
export function loadLexicon(): Lexicon {
  const lx = readKey<Lexicon>(LEXICON_KEY, {});
  Object.keys(lx.synonyms || {}).forEach((cat) => {
    ((lx.synonyms || {})[cat] || []).forEach((w) => addSynonym(cat, w));
  });
  return lx;
}
export function saveLexicon(catId: string, word: string, remove?: boolean): Lexicon {
  const lx = readKey<Lexicon>(LEXICON_KEY, {});
  lx.synonyms = lx.synonyms || {};
  const list = (lx.synonyms[catId] || []).filter((w) => norm(w) !== norm(word));
  if (!remove) list.push(String(word).trim());
  lx.synonyms[catId] = list;
  writeKey(LEXICON_KEY, lx);
  return lx;
}

// ── indeks: kayıt adları, grup adları, yer adları ─────────────────────────
const INDEX: Map<string, string[]> = (() => {
  const byToken = new Map<string, string[]>();
  const put = (tok: string, id: string) => {
    if (tok.length < 3) return;
    let a = byToken.get(tok); if (!a) { a = []; byToken.set(tok, a); }
    if (a[a.length - 1] !== id) a.push(id);
  };
  RECORDS.forEach((rec) => {
    norm(rec.name).split(" ").forEach((t) => put(t, rec.id));
    (rec.groups || []).forEach((g) => norm(g.name).split(" ").forEach((t) => put(t, rec.id)));
    put(norm(rec.cat), rec.id);
  });
  return byToken;
})();

const RECBYID: Map<string, ShopRecord> = (() => { const m = new Map<string, ShopRecord>(); RECORDS.forEach((r) => m.set(r.id, r)); return m; })();
const PLACEBYID: Map<string, Place> = (() => { const m = new Map<string, Place>(); PLACES.forEach((p) => m.set(p.id, p)); return m; })();

// Omurgaya sonradan eklenen kayıt (saha turunda açılan, esnaf beyanı) aramada da
// görünmelidir. INDEX ve RECBYID modül yüklenirken bir kez kurulduğu için
// RECORDS'a push etmek yetmez — kayıt buradan geçmek zorunda.
export function indexRecord(rec: ShopRecord): void {
  if (!rec || !rec.id) return;
  RECBYID.set(rec.id, rec);
  const put = (tok: string, id: string) => {
    if (!tok || tok.length < 3) return;
    let a = INDEX.get(tok); if (!a) { a = []; INDEX.set(tok, a); }
    if (a.indexOf(id) < 0) a.push(id);
  };
  norm(rec.name).split(" ").forEach((t) => put(t, rec.id));
  (rec.groups || []).forEach((g) => norm(g.name).split(" ").forEach((t) => put(t, rec.id)));
  put(norm(rec.cat), rec.id);
}

// ── (1) sorguyu anla ──────────────────────────────────────────────────────
export function parseQuery(q: unknown): ParsedQuery {
  const raw = String(q || "").trim();
  const n = norm(raw);
  const out: ParsedQuery = { raw, n, cats: [], places: [], semtler: [], door: null, phone: null, words: [], kind: "bos" };
  if (!n) return out;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length >= 7) { out.phone = digits; out.kind = "telefon"; }
  else if (digits.length >= 2 && digits.length <= 4) out.door = digits;
  out.words = n.split(" ").filter(w => w.length > 1);
  // Tek kelime + tüm sorgu + komşu kelime ikilileri denenir. Sözlükte çok kelimeli
  // eşanlamlar var ("telefon kabi", "phone case", "vitrin mankeni") ve yalnız tek
  // kelimeye bakıldığı için hiçbiri eşleşmiyordu.
  const tryCat = (key: string) => {
    const c = CAT_OF_WORD[key];
    if (c && out.cats.indexOf(c) < 0) out.cats.push(c);
  };
  tryCat(n);
  out.words.forEach(w => tryCat(w));
  for (let i = 0; i < out.words.length - 1; i++) tryCat(out.words[i] + " " + out.words[i + 1]);
  PLACES.forEach((p) => {
    const np = norm(p.name);
    if (np.length > 2 && (n.includes(np) || (n.length > 4 && np.includes(n)))) out.places.push(p.id);
  });
  // Latin dışı etiketler norm'dan boş döner; boş dizgi her sorguda eşleşip
  // tüm semtleri işaretliyordu — bu yüzden alaka tamamen kayboluyordu.
  SEMTLER.forEach((s) => {
    (["tr", "en", "ru", "ar"] as const).forEach((l) => {
      const ns = norm(s[l]);
      if (ns.length > 2 && n.includes(ns) && out.semtler.indexOf(s.id) < 0) out.semtler.push(s.id);
    });
  });
  out.kind = out.phone ? "telefon" : out.places.length ? "yer" : out.cats.length ? "kategori" : out.door ? "kapi" : "metin";
  return out;
}

// ── (2) aday havuzu ───────────────────────────────────────────────────────
interface Candidate { rec: ShopRecord; match: number }
function candidates(pq: ParsedQuery): Candidate[] {
  if (!pq.n) return RECORDS.map((r) => ({ rec: r, match: 0 }));
  const hit = new Map<string, number>();
  const bump = (id: string, w: number) => hit.set(id, (hit.get(id) || 0) + w);
  pq.words.forEach((w) => {
    // tam token
    (INDEX.get(w) || []).forEach((id) => bump(id, 3));
    // önek eşleşmesi (kılıfçı → kılıf)
    if (w.length >= 4) INDEX.forEach((ids, tok) => { if (tok !== w && tok.startsWith(w.slice(0, 4))) ids.forEach((id) => bump(id, 1)); });
  });
  // Ana kategori eşleşmesi ikincilden çok daha güçlüdür.
  pq.cats.forEach((c) => RECORDS.forEach((r) => {
    if (r.cat === c) bump(r.id, 6);
    else if ((r.cats || []).includes(c)) bump(r.id, 2);
  }));
  pq.places.forEach((p) => RECORDS.forEach((r) => { if (r.place === p) bump(r.id, 2); }));
  pq.semtler.forEach((s) => RECORDS.forEach((r) => { if (r.semt === s) bump(r.id, 2); }));
  if (pq.door) RECORDS.forEach((r) => { if (r.door === pq.door) bump(r.id, 5); });
  if (pq.phone) RECORDS.forEach((r) => { if (String(r.tel || "").includes(pq.phone as string)) bump(r.id, 6); });
  const out: Candidate[] = [];
  hit.forEach((score, id) => { const r = RECBYID.get(id); if (r) out.push({ rec: r, match: score }); });
  return out.length ? out : [];
}

// ── (3) sıralama ──────────────────────────────────────────────────────────
const STATUS_SCORE: Dict<number> = { aktif: 30, onayli: 16, beyan: -14, askida: -40 };

// Sıralama gerekçesi kullanıcıya gösterilir: keyfî görünmesin.
export function reasonsOf(rec: ShopRecord, ctx?: SearchCtx): Reason[] {
  const out: Reason[] = [];
  if (rec.status === "aktif") out.push({ k: "aktif", w: 30 });
  if (rec.status === "beyan") out.push({ k: "beyan", w: 1 });
  if (rec.approvedVia === "han") out.push({ k: "hanonay", w: 8 });
  if (rec.respMins && rec.respMins <= 30) out.push({ k: "hizli", v: rec.respMins, w: 18 });
  if (rec.distance <= 300) out.push({ k: "yakin", v: rec.distance, w: 12 });
  if (rec.rating && rec.rating >= 4.5) out.push({ k: "puan", v: rec.rating, w: 10 });
  if (rec.updatedDays <= 30) out.push({ k: "taze", v: rec.updatedDays, w: 10 });
  if ((rec.photos || 0) >= 3) out.push({ k: "foto", v: rec.photos, w: 6 });
  if (ctx && ctx.qty && rec.moq && rec.moq <= ctx.qty) out.push({ k: "moq", v: rec.moq, w: 6 });
  if (rec.isProducer) out.push({ k: "uretici", w: 4 });
  if (ctx && ctx.lang && (rec.langs || []).includes(ctx.lang) && ctx.lang !== "tr") out.push({ k: "dil", w: 5 });
  return out.sort((a, b) => b.w - a.w).slice(0, 3);
}

export function scoreOf(rec: ShopRecord, match: number, ctx: SearchCtx): number {
  let s = (match || 0) * 6;
  s += STATUS_SCORE[rec.status] || 0;
  if (rec.respMins) s += Math.max(0, 18 - rec.respMins / 6);
  if (rec.respRate) s += (rec.respRate - 70) / 4;
  if (rec.rating) s += (rec.rating - 3.5) * 6;
  s += Math.max(0, 12 - rec.distance / 120);
  s += Math.max(0, 10 - rec.updatedDays / 20);      // tazelik
  s += Math.min(6, (rec.photos || 0) * 0.8);        // katalog kalitesi
  // Faz 0.1 · mod eşleşmesi sektöre değil YETENEĞE bakar: aynı dükkân ikisini birden yapabilir.
  const sells = (rec.trade && rec.trade.sells) || [rec.sector];
  if (ctx.mode === "toptan") { if (sells.includes("toptan")) s += 10; if (rec.isProducer) s += 4; }
  if (ctx.mode === "perakende" && sells.includes("perakende")) s += 8;
  if (ctx.qty && rec.moq && rec.moq <= ctx.qty) s += 6;
  if (ctx.qty && rec.moq && rec.moq > ctx.qty) s -= 8;
  if (ctx.lang && (rec.langs || []).includes(ctx.lang)) s += 5;
  return s;
}

// Görünürlük ayardan okunur, koda gömülmez.
const PUBLIC = (r: ShopRecord): boolean => r.status === "aktif" || r.status === "onayli" ||
  (r.status === "beyan" && SETTINGS.showDeclared.value);
export const canPrice = (r: ShopRecord): boolean => r.status === "aktif" ||
  (r.status === "beyan" && SETTINGS.declaredCanPrice.value);

type Sorter = (a: SearchHit, b: SearchHit) => number;
const SORTS: Dict<Sorter> = {
  uygunluk: (a, b) => b.score - a.score,
  mesafe: (a, b) => a.rec.distance - b.rec.distance,
  yanit: (a, b) => (a.rec.respMins || 9999) - (b.rec.respMins || 9999),
  fiyat: (a, b) => ((a.rec.band || [1e9])[0]) - ((b.rec.band || [1e9])[0]),
  puan: (a, b) => (b.rec.rating || 0) - (a.rec.rating || 0),
  taze: (a, b) => a.rec.updatedDays - b.rec.updatedDays
};

// filters: {semt, place, floor, tier, sector, moqMax, priceMax, lang, payment,
//           shipsAbroad, taxFree, producer, openOnly, hideUnclaimed}
export function search(q: unknown, filters?: SearchFilters, ctx?: SearchCtx): SearchResult {
  const F: SearchFilters = filters || {}, C: SearchCtx = ctx || {};
  const pq = parseQuery(q);
  const pool = candidates(pq);
  const scan = pool.length ? pool : RECORDS.map(r => ({ rec: r, match: 0 }));

  const pass = (r: ShopRecord): boolean => {
    if (F.semt && F.semt !== "all" && r.semt !== F.semt) return false;
    if (F.place && F.place !== "all" && r.place !== F.place) return false;
    if (F.floor != null && F.floor !== "all" && String(r.floor) !== String(F.floor)) return false;
    if (F.status && F.status !== "all" && r.status !== F.status) return false;
    if (F.sector && F.sector !== "all" && r.sector !== F.sector) return false;
    if (!F.editor && !PUBLIC(r)) return false;   // görünürlük: SETTINGS.showDeclared
    if (F.activeOnly && r.status !== "aktif") return false;
    if (F.moqMax && r.moq > F.moqMax) return false;
    if (F.priceMax && r.band && r.band[0] > F.priceMax) return false;
    if (F.lang && !(r.langs || []).includes(F.lang)) return false;
    if (F.payment && !(r.payments || []).includes(F.payment)) return false;
    if (F.shipsAbroad && !r.shipsAbroad) return false;
    if (F.taxFree && !r.taxFree) return false;
    if (F.producer && !r.isProducer) return false;
    return true;
  };

  // Sorgu varsa yalnız eşleşenler kalır: 2.000 kaydı taramak bedava, alakasızı göstermek değil.
  const strict = !!pq.n;
  const kept: SearchHit[] = [];
  const facets: Facets = { semt: {}, place: {}, status: {}, sector: {}, lang: {}, flag: { shipsAbroad: 0, taxFree: 0, producer: 0 } };
  scan.forEach((x) => {
    const r = x.rec;
    // Yüz sayaçları filtre uygulanmadan sayılır ki kullanıcı "başka nerede var" görsün.
    if (PUBLIC(r) || F.editor) {
      facets.semt[r.semt] = (facets.semt[r.semt] || 0) + 1;
      facets.place[r.place] = (facets.place[r.place] || 0) + 1;
    }
    facets.status[r.status] = (facets.status[r.status] || 0) + 1;
    if (!PUBLIC(r) && !F.editor) return;
    facets.sector[r.sector] = (facets.sector[r.sector] || 0) + 1;
    (r.langs || []).forEach((l) => { facets.lang[l] = (facets.lang[l] || 0) + 1; });
    if (r.shipsAbroad) facets.flag.shipsAbroad++;
    if (r.taxFree) facets.flag.taxFree++;
    if (r.isProducer) facets.flag.producer++;
    if (strict && !x.match) return;
    if (!pass(r)) return;
    kept.push({ rec: r, match: x.match, score: scoreOf(r, x.match, C), reasons: reasonsOf(r, C) });
  });

  const sorter = SORTS[C.sort || ""] || SORTS.uygunluk;
  kept.sort(sorter);

  // Kayda değer öneri: sorgu kategoriye düştüyse kaç dükkâna talep gidebilir
  const broadcast = pq.cats.length
    ? RECORDS.filter((r) => (r.cat === pq.cats[0] || (r.cats || []).includes(pq.cats[0])) && PUBLIC(r)).length
    : 0;

  return {
    parsed: pq, total: kept.length, scanned: scan.length,
    items: kept, facets, broadcast,
    weakMatch: kept.length > 0 && kept.length < 4,
    catGuess: pq.cats[0] || null
  };
}

// Sorgu boşken bile ekran dolu olmalı: en aktif kayıtlar.
export function topActive(n?: number, ctx?: SearchCtx): SearchHit[] {
  return search("", { activeOnly: true }, ctx || {}).items.slice(0, n || 12);
}

// Adres araması: kaydı olmayan birimler yalnız buradan görünür.
export function unitLookup(q: string): { place: Place; door: string | null; hasRecord: boolean }[] {
  const pq = parseQuery(q);
  if (!SETTINGS.showUnits.value) return [];
  if (!pq.door && !pq.places.length) return [];
  return PLACES.filter((p) => !pq.places.length || pq.places.includes(p.id)).slice(0, 3).map((p) => ({
    place: p, door: pq.door,
    hasRecord: RECORDS.some((r) => r.place === p.id && r.door === pq.door && (r.status === "aktif" || r.status === "onayli"))
  }));
}

// ── § 11 · İndeks katmanı üzerinden arama (ölçeğe geçiş yolu) ─────────────
// Senkron search() bellek içi indeksle çalışır (prototip). searchAsync() ise
// diskteki ters indeksi ve yalnız gereken semt parçalarını kullanır; 30–50 bin
// kayıtta tarayıcıya tüm veriyi yüklememenin yolu budur.
export async function searchAsync(q: string, filters?: SearchFilters, ctx?: SearchCtx) {
  await getIndex();
  const cand = await candidatesFor(q || "");
  const base = search(q, filters, ctx);
  return Object.assign({}, base, { shardsLoaded: cand.shardsLoaded, indexTotal: cand.indexTotal });
}

export function indexInfo() { return indexStats(); }

export function placeOf(id: string): Place | null { return PLACEBYID.get(id) || null; }
export function statusOf(key: string) { return STATUS[key] || STATUS.birim; }
export function sectorOf(key: string) { return SECTORS[key] || SECTORS.perakende; }


// ── M2 · Ürün sayfası ─────────────────────────────────────────────────────
// Her şey dükkân merkezliydi: "şeffaf silikon kılıf" arayan toptancı, o ürünü
// satan dükkânların listesini ve fiyat aralığını hiçbir yerde göremiyordu.
// Ürün, kayıtların çeşit gruplarından türer — ayrı bir ürün tablosu yoktur,
// olmayan veriyi uydurmayız.

export function productSlug(word: string): string {
  return norm(word).replace(/\s+/g, "-");
}

// Bir kategorideki tüm çeşit grupları, kaç dükkânda olduğu ve fiyat aralığıyla.
export function productsIn(cat: string, _ctx?: SearchCtx): ProductSummary[] {
  const recs = RECORDS.filter((r) => r.cat === cat && r.status !== "askida" && r.status !== "birim");
  const by = new Map<string, ProductSummary & { lo: number }>();
  recs.forEach((r) => {
    (r.groups || []).forEach((g) => {
      const key = productSlug(g.name);
      if (!key) return;
      const e = by.get(key) || { slug: key, name: g.name, cat, shops: 0, lines: 0, lo: Infinity, hi: 0, recs: [] as ShopRecord[], band: null as Band | null };
      e.shops += 1;
      e.lines += g.lines || 0;
      if (g.lo > 0) e.lo = Math.min(e.lo, g.lo);
      if (g.hi > 0) e.hi = Math.max(e.hi, g.hi);
      e.recs.push(r);
      by.set(key, e);
    });
  });
  return [...by.values()]
    .map((e): ProductSummary => ({ ...e, lo: e.lo === Infinity ? null : e.lo, band: e.lo === Infinity ? null : [e.lo, e.hi] as Band }))
    .sort((a, b) => b.shops - a.shops);
}

// Tek ürün: satan dükkânlar sıralı, fiyat dağılımı ve üretici sayısıyla.
export function productDetail(cat: string, slug: string, ctx?: SearchCtx): ProductDetail | null {
  const C: SearchCtx = ctx || {};
  const all = productsIn(cat, C);
  const p = all.find((x) => x.slug === slug);
  if (!p) return null;
  const mode = C.mode === "toptan" ? "toptan" : C.mode === "perakende" ? "perakende" : null;
  const shops = p.recs
    .filter((r) => !mode || sellsIn(r, mode))
    .map((r) => {
      const g = (r.groups || []).find((x) => productSlug(x.name) === slug) || ({} as Partial<import("./types").GroupEntry>);
      const t = tradeFor(r, mode || ((r.trade || {}).sells || [])[0] || "perakende") || {};
      return {
        rec: r, lo: g.lo || null, hi: g.hi || null, lines: g.lines || 0,
        moq: t.moq || r.moq || 1,
        score: (r.status === "aktif" ? 40 : r.status === "onayli" ? 22 : 8) +
               (r.isProducer ? 14 : 0) + Math.round((r.respRate || 0) / 8) +
               (r.rating ? r.rating * 3 : 0) - Math.min(12, (r.updatedDays || 0) / 12)
      };
    })
    .sort((a, b) => b.score - a.score);
  const prices = shops.map((s) => s.lo).filter((v): v is number => (v ?? 0) > 0).sort((a, b) => a - b);
  const mid = prices.length ? prices[Math.floor(prices.length / 2)] : null;
  return {
    ...p, shops,
    producers: shops.filter((s) => s.rec.isProducer).length,
    exporters: shops.filter((s) => s.rec.shipsAbroad).length,
    median: mid,
    // Fiyat aralığı tek sayı değil: alıcı nereye düştüğünü görmeli.
    spread: prices.length > 1 ? { lo: prices[0], hi: prices[prices.length - 1], mid } : null,
    // En düşük MOQ, numune isteyen küçük alıcı için en kritik bilgi.
    minMoq: shops.reduce((m: number, s) => Math.min(m, s.moq || 1), Infinity)
  };
}

// Arama sonucundan ürüne köprü: sorgu bir çeşit grubuna oturuyorsa onu döndür.
export function productForQuery(q: string, ctx?: SearchCtx): ProductSummary | null {
  const p = parseQuery(q);
  const cat = (p.cats || [])[0];
  if (!cat) return null;
  const n = norm(q);
  const all = productsIn(cat, ctx);
  return all.find((x) => norm(x.name) === n) ||
         all.find((x) => n.includes(norm(x.name)) || norm(x.name).includes(n)) || null;
}
// 10 bin dükkânı gezmek yerine talep eşleşenlere gider. Dağıtım kuralları
// açıktır ve kullanıcıya gösterilir; yanıt vermeyen dükkân havuzdan düşer.
const QUOTA_PER_SHOP_DAY = 12;   // dükkân başına günlük talep kotası

function seeded(n: number) { let s = (n >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// Talep: { urun, adet, zaman, id }
export function distribute(req: BuyRequest, ctx?: SearchCtx): DistributeResult {
  const C: SearchCtx = ctx || {};
  const qty = Number(String(req.adet || "").replace(/[^\d]/g, "")) || 0;
  const pq = parseQuery(req.urun || "");
  const cat = pq.cats[0] || null;

  const rules: DistributeRule[] = [];
  const pool = RECORDS.filter((r) => {
    if (r.status !== "aktif" && r.status !== "onayli") return false;      // beyan teklif vermez
    if (cat && r.cat !== cat && !(r.cats || []).includes(cat)) return false;
    if (qty && r.moq > qty && !r.moqFlex) return false;                   // MOQ uymuyor
    if (C.mode === "toptan" && !((r.trade && r.trade.sells) || [r.sector]).includes("toptan")) return false;
    return true;
  });

  rules.push({ k: "kategori", v: cat, n: pool.length });
  if (qty) rules.push({ k: "moq", v: qty, n: pool.filter((r) => r.moq <= qty).length });

  // Sıralama: yanıt performansı + kayıt durumu + kapasite + dil
  const scored = pool.map((r) => {
    let sc = (r.status === "aktif" ? 20 : 8);
    if (r.respMins) sc += Math.max(0, 20 - r.respMins / 5);
    if (r.respRate) sc += (r.respRate - 60) / 4;
    if (r.isProducer) sc += 6;
    if (C.lang && (r.langs || []).includes(C.lang)) sc += 5;
    if (r.updatedDays > 120) sc -= 8;                 // ölü kayıt havuzdan düşer
    return { rec: r, sc };
  }).sort((a, b) => b.sc - a.sc);

  const sent = scored.slice(0, 24).map((x) => x.rec);   // kota: alıcıya da makul sayı
  return {
    cat, qty, matched: pool.length, sent, rules,
    quota: QUOTA_PER_SHOP_DAY,
    langHit: sent.filter((r) => C.lang && (r.langs || []).includes(C.lang)).length,
    producers: sent.filter((r) => r.isProducer).length
  };
}

// Teklifler tohumlu üretilir: aynı talep her açılışta aynı teklifleri gösterir.
export function offersFor(req: BuyRequest, ctx?: SearchCtx): Offer[] {
  const C: SearchCtx = ctx || {};
  const d = distribute(req, C);
  const rnd = seeded(Number(req.id) || 7);
  const qty = d.qty || 1;
  // D5b/K9 · Tahmini aralık ile gerçek teklif aynı şey değildir. Motordan çıkan
  // sayı bir çıkarımdır; ancak sahiplenmesi ONAYLI esnaf verdiğinde taahhüttür.
  // Motor SADECE tahmin üretir. "Gerçek teklif" tek bir yerden gelir: esnafın
  // kendi verdiği teklif (han-offers.js). Burada `real` üretmek, alıcının
  // uydurma bir sayıyı taahhüt sanmasına yol açardı.
  const exclude = C.exclude || [];
  return d.sent.slice(0, 8).filter((rec) => !exclude.includes(rec.id)).filter(() => rnd() < 0.55).map((rec): Offer => {
    const t = rec.trade || {};
    const bandOf = rec.band || (t.toptan && t.toptan.band) || (t.perakende && t.perakende.band) || null;
    const base = bandOf ? bandOf[0] : 40;
    const unit = Math.round(base * (0.9 + rnd() * 0.5) * 100) / 100;
    return {
      recordId: rec.id, curated: rec.curated || null,
      name: rec.name, place: rec.place, floor: rec.floor, door: rec.door,
      unit, raw: unit * Math.max(1, qty),
      qty: Math.max(qty, rec.moq || 1),
      moq: rec.moq, gun: 1 + Math.floor(rnd() * 6),
      respMins: rec.respMins, rating: rec.rating,
      status: rec.status, producer: rec.isProducer,
      langs: rec.langs || [], shipsAbroad: rec.shipsAbroad,
      real: false, estimate: true
    };
  }).sort((a, b) => a.raw - b.raw);
}

// Alıcının gördüğü tek liste: gerçek teklifler üstte, tahminler altta.
// Gerçek teklif veren dükkânın tahmini listeden düşer — aynı dükkân iki fiyatla görünmez.
export function mergedOffers(req: BuyRequest, real?: Offer[], ctx?: SearchCtx): Offer[] {
  const rl = (real || []).map((o): Offer => {
    const rec = (RECORDS.find((r) => r.id === o.recordId) || {}) as Partial<ShopRecord>;
    return Object.assign({
      name: rec.name, place: rec.place, floor: rec.floor, door: rec.door,
      curated: rec.curated || null, moq: rec.moq, respMins: rec.respMins,
      rating: rec.rating, status: rec.status, producer: rec.isProducer,
      langs: rec.langs || [], shipsAbroad: rec.shipsAbroad
    }, o, { real: true, estimate: false });
  });
  const est = offersFor(req, Object.assign({}, ctx, { exclude: rl.map((o) => o.recordId) }));
  return rl.sort((a, b) => a.raw - b.raw).concat(est);
}
