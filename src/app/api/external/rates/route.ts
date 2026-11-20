// HAN 2.0 — Live TCMB Exchange Rates with 1h Postgres + memory cache & static D.RATES fallback.

import { NextResponse } from "next/server";

import * as D from "@/data/han-data";
import { readExternalCache, writeExternalCache } from "@/server/db";

export const dynamic = "force-dynamic";

interface RatesPayload {
  source: "tcmb-live" | "fallback";
  updatedAt: string;
  bulletinDate: string | null;
  /** Units of foreign currency per 1 TRY (matches D.RATES format). */
  rates: Record<string, number>;
  /** TRY per 1 unit of foreign currency (human-readable display). */
  tryPerUnit: Record<string, number>;
}

const CACHE_KEY = "tcmb_rates_v1";
const TTL_SEC = 3600;
let memCache: { payload: RatesPayload; exp: number } | null = null;

function fallbackPayload(): RatesPayload {
  const base = D.RATES as Record<string, number>;
  const tryPerUnit: Record<string, number> = {};
  for (const [code, perTry] of Object.entries(base)) {
    if (code !== "TRY" && perTry > 0) {
      tryPerUnit[code] = Number((1 / perTry).toFixed(4));
    }
  }
  return {
    source: "fallback",
    updatedAt: new Date().toISOString(),
    bulletinDate: null,
    rates: { ...base },
    tryPerUnit,
  };
}

function parseTcmbXml(xml: string): RatesPayload | null {
  const dateMatch = xml.match(/Tarih="([^"]+)"/i) || xml.match(/Date="([^"]+)"/i);
  const wanted = ["USD", "EUR", "GBP", "RUB", "SAR", "AED"];
  const tryPerUnit: Record<string, number> = {};
  const rates: Record<string, number> = { ...(D.RATES as Record<string, number>), TRY: 1 };

  for (const code of wanted) {
    const re = new RegExp(
      `<Currency[^>]*CurrencyCode="${code}"[^>]*>([\\s\\S]*?)</Currency>`,
      "i",
    );
    const block = xml.match(re)?.[1];
    if (!block) continue;
    const unitRaw = Number(block.match(/<Unit>([^<]+)<\/Unit>/i)?.[1] || "1") || 1;
    const sellRaw =
      block.match(/<ForexSelling>([^<]+)<\/ForexSelling>/i)?.[1] ||
      block.match(/<ForexBuying>([^<]+)<\/ForexBuying>/i)?.[1] ||
      "";
    const sell = Number(sellRaw.replace(",", ".").trim());
    if (!Number.isFinite(sell) || sell <= 0) continue;
    const oneUnitInTry = sell / unitRaw;
    tryPerUnit[code] = Number(oneUnitInTry.toFixed(4));
    rates[code] = Number((1 / oneUnitInTry).toFixed(6));
  }

  if (!tryPerUnit.USD || !tryPerUnit.EUR) return null;

  return {
    source: "tcmb-live",
    updatedAt: new Date().toISOString(),
    bulletinDate: dateMatch?.[1] || null,
    rates,
    tryPerUnit,
  };
}

export async function GET() {
  if (memCache && memCache.exp > Date.now()) {
    return NextResponse.json({ ok: true, cached: true, ...memCache.payload });
  }

  const dbCached = await readExternalCache<RatesPayload>(CACHE_KEY);
  if (dbCached?.fresh && dbCached.payload?.rates?.USD) {
    memCache = { payload: dbCached.payload, exp: Date.now() + 10 * 60 * 1000 };
    return NextResponse.json({ ok: true, cached: true, ...dbCached.payload });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
      signal: ctrl.signal,
      headers: { "User-Agent": "HAN-Bazaar-OS/2.0 (https://han.mansis.com.tr)" },
      cache: "no-store",
    });
    clearTimeout(timer);

    if (res.ok) {
      const xml = await res.text();
      const parsed = parseTcmbXml(xml);
      if (parsed) {
        memCache = { payload: parsed, exp: Date.now() + TTL_SEC * 1000 };
        await writeExternalCache(CACHE_KEY, parsed, TTL_SEC);
        return NextResponse.json({ ok: true, cached: false, ...parsed });
      }
    }
  } catch {
    // Graceful fallback below
  }

  if (dbCached?.payload?.rates?.USD) {
    return NextResponse.json({ ok: true, cached: true, stale: true, ...dbCached.payload });
  }

  const fb = fallbackPayload();
  return NextResponse.json({ ok: true, cached: false, ...fb });
}
