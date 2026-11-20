// HAN 2.0 — Google Places ToS §3.2.3 compliant live enrichment bridge.
// Never copies Google data into Postgres; caches live rating/count in volatile RAM only (6h)
// and always provides an official Google Maps search/reviews link.

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
}

const RAM_TTL_MS = 6 * 3600 * 1000;
const ramCache = new Map<string, { data: GoogleBridgePayload; exp: number }>();

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
      if (ramCache.size > 400) ramCache.clear();
      ramCache.set(cacheKey, { data: payload, exp: Date.now() + RAM_TTL_MS });
      return NextResponse.json({ ok: true, cached: false, ...payload });
    }
  } catch {
    // Graceful fallback to search link
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
