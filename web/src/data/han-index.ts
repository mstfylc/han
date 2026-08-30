// HAN · Arama indeksi ve veri parçalama (§ 11)
// 2.000 kayıt tarayıcıda rahat döner; 30–50 bin dönmez. Bu dosya ölçeğe geçiş
// katmanıdır: kayıtlar SEMT bazlı parçalara ayrılır, arama tek seferde üretilen
// ters indeks üzerinden çalışır ve yalnız gereken parça belleğe alınır.
//
// Parçalar `data/records-<semt>.json`, indeks `data/index.json` olarak diskte
// durur (build çıktısı). Dosyalar yoksa katman han-scale'in bellek içi
// kayıtlarına düşer — yani prototip her koşulda çalışır.

import { RECORDS, SEMTLER, SETTINGS } from "./han-scale";
import type { ShopRecord } from "./types";

/** The inverted index artefact: token → record ids, plus each record's shard. */
export interface RecordIndex {
  tokens: Record<string, string[]>;
  byId: Record<string, string>;
  total: number;
  built?: string;
}

const BASE = "data/";
const shardCache = new Map<string, ShopRecord[]>();  // semt → kayıt dizisi
let indexCache: RecordIndex | null = null;
let indexTried = false;

const NON_WORD = /[^a-z0-9\u0400-\u04ff\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff\s]/g;
const TR: Record<string, string> = { "ı": "i", "İ": "i", "ş": "s", "ğ": "g", "ü": "u", "ö": "o", "ç": "c", "â": "a", "î": "i", "û": "u" };
const norm = (s: unknown): string => String(s || "").toLowerCase()
  .replace(/[ıİşğüöçâîû]/g, (c) => TR[c] || c)
  .replace(NON_WORD, " ").replace(/\s+/g, " ").trim();

// ── indeks üretimi (build) ────────────────────────────────────────────────
// Aynı kod hem diske yazılan artefaktı üretir hem de dosya yoksa runtime'da
// kullanılır; böylece iki farklı indeks mantığı riski doğmaz.
export function buildIndex(records?: ShopRecord[]): RecordIndex {
  const tokens: Record<string, string[]> = {};
  const byId: Record<string, string> = {};
  (records || RECORDS).forEach((r) => {
    byId[r.id] = r.semt;
    const put = (tok: string) => {
      if (!tok || tok.length < 3) return;
      const a = tokens[tok] || (tokens[tok] = []);
      if (a[a.length - 1] !== r.id) a.push(r.id);
    };
    norm(r.name).split(" ").forEach(put);
    (r.groups || []).forEach((g) => norm(g.name).split(" ").forEach(put));
    put(norm(r.cat));
    (r.cats || []).forEach((c) => put(norm(c)));
  });
  return { tokens, byId, total: (records || RECORDS).length, built: new Date().toISOString().slice(0, 10) };
}

export function buildShards(records?: ShopRecord[]): Record<string, ShopRecord[]> {
  const out: Record<string, ShopRecord[]> = {};
  SEMTLER.forEach((s) => { out[s.id] = []; });
  (records || RECORDS).forEach((r) => { (out[r.semt] = out[r.semt] || []).push(r); });
  return out;
}

// ── runtime erişim ────────────────────────────────────────────────────────
export async function getIndex(): Promise<RecordIndex> {
  if (indexCache) return indexCache;
  if (!indexTried) {
    indexTried = true;
    try {
      const res = await fetch(BASE + "index.json");
      if (res.ok) { indexCache = (await res.json()) as RecordIndex; return indexCache; }
    } catch {
      // No build artefact — fall through and index in memory.
    }
  }
  indexCache = buildIndex(RECORDS);      // diskte yoksa bellekte üret
  return indexCache;
}

export async function getShard(semt: string): Promise<ShopRecord[]> {
  const cached = shardCache.get(semt);
  if (cached) return cached;
  let rows: ShopRecord[] | null = null;
  try {
    const res = await fetch(BASE + "records-" + semt + ".json");
    if (res.ok) rows = (await res.json()) as ShopRecord[];
  } catch {
    // Shard not on disk — read it from the in-memory backbone instead.
  }
  if (!rows) rows = RECORDS.filter((r) => r.semt === semt);
  shardCache.set(semt, rows);
  return rows;
}

// Sorgunun dokunduğu parçaları bul, YALNIZ onları yükle.
export async function candidatesFor(query: string): Promise<{
  items: { rec: ShopRecord; match: number }[];
  shardsLoaded: number;
  indexTotal: number;
}> {
  const idx = await getIndex();
  const words = norm(query).split(" ").filter((w) => w.length > 2);
  const hits = new Map<string, number>();
  words.forEach((w) => {
    (idx.tokens[w] || []).forEach((id) => hits.set(id, (hits.get(id) || 0) + 3));
    if (w.length >= 4) {
      const pre = w.slice(0, 4);
      Object.keys(idx.tokens).forEach((tok) => {
        if (tok !== w && tok.startsWith(pre)) idx.tokens[tok].forEach((id) => hits.set(id, (hits.get(id) || 0) + 1));
      });
    }
  });
  const semtler = new Set<string>();
  hits.forEach((_, id) => { const s = idx.byId[id]; if (s) semtler.add(s); });
  const shards = await Promise.all(Array.from(semtler).map(getShard));
  const map = new Map<string, ShopRecord>();
  shards.forEach((rows) => rows.forEach((r) => map.set(r.id, r)));
  const out: { rec: ShopRecord; match: number }[] = [];
  hits.forEach((match, id) => { const rec = map.get(id); if (rec) out.push({ rec, match }); });
  return { items: out, shardsLoaded: semtler.size, indexTotal: idx.total };
}

export function stats() {
  return {
    shardsLoaded: shardCache.size, shardsTotal: SEMTLER.length,
    indexReady: !!indexCache, records: RECORDS.length,
    freshDays: SETTINGS.freshDays.value
  };
}
