// HAN 2.0 — Google Places ToS §3.2.3 compliant live enrichment bridge with Zero-Billing Circuit Breaker.
// Never copies Google data into Postgres; caches live rating/count in volatile RAM only (24h),
// blocks bot crawlers from burning quota, and enforces hard daily (28) + monthly (850) caps
// strictly below Google's 1,000/month free Enterprise tier.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface GoogleBridgePayload {
  configured: boolean;
  rating: number | null;
  reviewCount: number | null;
  openNow: boolean | null;
  placeId: string | null;
  mapsUrl: string;
  attribution: string;
  budgetCapped?: boolean;
}

const RAM_TTL_MS = 24 * 3600 * 1000;
const ramCache = new Map<string, { data: GoogleBridgePayload; exp: number }>();

const BOT_UA = /bot|crawler|spider|headless|googlebot|bingbot|yandex|slurp|duckduckbot|facebookexternalhit|whatsapp|telegrambot|preview/i;

const budgetState = {
  day: "",
  dayCount: 0,
  month: "",
  monthCount: 0,
};

function consumePlacesBudget(): { allowed: boolean; dayUsed: number; dayCap: number; monthUsed: number; monthCap: number } {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);
  const dayCap = Math.max(1, Number(process.env.GOOGLE_PLACES_DAILY_CAP || "28") || 28);
  const monthCap = Math.max(1, Number(process.env.GOOGLE_PLACES_MONTHLY_CAP || "850") || 850);

  if (budgetState.day !== day) {
    budgetState.day = day;
    budgetState.dayCount = 0;
  }
  if (budgetState.month !== month) {
    budgetState.month = month;
    budgetState.monthCount = 0;
  }

  if (budgetState.dayCount >= dayCap || budgetState.monthCount >= monthCap) {
    return { allowed: false, dayUsed: budgetState.dayCount, dayCap, monthUsed: budgetState.monthCount, monthCap };
  }

  budgetState.dayCount += 1;
  budgetState.monthCount += 1;
  return { allowed: true, dayUsed: budgetState.dayCount, dayCap, monthUsed: budgetState.monthCount, monthCap };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = String(searchParams.get("name") || "").trim();
  const area = String(searchParams.get("area") || "Fatih İstanbul").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  }

  const queryText = `${name} ${area}`;
  const fallbackMapsUrl =
    "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(queryText);

  const cacheKey = queryText.toLocaleLowerCase("tr");
  const hit = ramCache.get(cacheKey);
  if (hit && hit.exp > Date.now()) {
    return NextResponse.json({ ok: true, cached: true, ...hit.data });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      cached: false,
      configured: false,
      rating: null,
      reviewCount: null,
      openNow: null,
      placeId: null,
      mapsUrl: fallbackMapsUrl,
      attribution: "Google Maps",
    });
  }

  // Never let crawlers/bots burn Google Places free tier quota
  const ua = request.headers.get("user-agent") || "";
  if (BOT_UA.test(ua)) {
    return NextResponse.json({
      ok: true,
      cached: false,
      configured: true,
      rating: null,
      reviewCount: null,
      openNow: null,
      placeId: null,
      mapsUrl: fallbackMapsUrl,
      attribution: "Google Maps",
    });
  }

  // Hard Zero-Billing Circuit Breaker (strictly < 1,000 free calls/month)
  const budget = consumePlacesBudget();
  if (!budget.allowed) {
    return NextResponse.json({
      ok: true,
      cached: false,
      configured: true,
      budgetCapped: true,
      rating: null,
      reviewCount: null,
      openNow: null,
      placeId: null,
      mapsUrl: fallbackMapsUrl,
      attribution: "Google Maps",
    });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4500);
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.rating,places.userRatingCount,places.googleMapsUri,places.currentOpeningHours.openNow",
      },
      body: JSON.stringify({
        textQuery: queryText,
        languageCode: "tr",
        maxResultCount: 1,
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = (await res.json()) as {
        places?: Array<{
          id?: string;
          rating?: number;
          userRatingCount?: number;
          googleMapsUri?: string;
          currentOpeningHours?: { openNow?: boolean };
        }>;
      };
      const top = json.places?.[0];
      const payload: GoogleBridgePayload = {
        configured: true,
        rating: typeof top?.rating === "number" ? top.rating : null,
        reviewCount: typeof top?.userRatingCount === "number" ? top.userRatingCount : null,
        openNow: typeof top?.currentOpeningHours?.openNow === "boolean" ? top.currentOpeningHours.openNow : null,
        placeId: top?.id || null,
        mapsUrl: top?.googleMapsUri || fallbackMapsUrl,
        attribution: "Powered by Google",
      };
      if (ramCache.size > 1000) ramCache.clear();
      ramCache.set(cacheKey, { data: payload, exp: Date.now() + RAM_TTL_MS });
      return NextResponse.json({ ok: true, cached: false, ...payload });
    }
  } catch {
    // Graceful fallback to free Google Maps link
  }

  return NextResponse.json({
    ok: true,
    cached: false,
    configured: true,
    rating: null,
    reviewCount: null,
    openNow: null,
    placeId: null,
    mapsUrl: fallbackMapsUrl,
    attribution: "Google Maps",
  });
}
