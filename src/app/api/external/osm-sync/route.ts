// HAN 2.0 — RBAC-protected OpenStreetMap Overpass Sync for Active Bazaar Region.
// Fetches real POIs (WC, ATM, pharmacy, cafe, parking) + candidate shops into Postgres.

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { ACTIVE_BAZAAR, haversineMeters } from "@/data/bazaars";
import * as SC from "@/data/han-scale";
import { upsertCandidateShop, upsertExternalPois, type ExternalPoiRow } from "@/server/db";
import { requireOpsWriter } from "@/server/external-auth";

export const dynamic = "force-dynamic";

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function nearestPlace(lat: number, lng: number) {
  let best = SC.PLACES[0];
  let bestDist = Infinity;
  for (const p of SC.PLACES) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const d = haversineMeters(lat, lng, p.lat, p.lng);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return { place: best, dist: Math.round(bestDist) };
}

function classifyPoi(tags: Record<string, string>): string | null {
  const a = tags.amenity || "";
  if (a === "toilets") return "wc";
  if (a === "atm" || a === "bank" || a === "bureau_de_change") return "atm";
  if (a === "pharmacy") return "eczane";
  if (a === "cafe") return "mola";
  if (a === "parking") return "ulasim";
  if (a === "post_office") return "kargo";
  return null;
}

function mapOsmShopCategory(shopTag: string): string {
  const s = shopTag.toLowerCase();
  if (/(jewelry|jewellery|watches|gift|accessories|variety)/.test(s)) return "bijuteri";
  if (/(clothes|fabric|textile|curtain|carpet|shoes|bag|leather)/.test(s)) return "tekstil";
  if (/(spices|tea|coffee|confectionery|tea|deli|bakery)/.test(s)) return "baharat";
  if (/(electronics|mobile_phone|computer|hifi)/.test(s)) return "kilif";
  return "hediyelik";
}

export async function POST() {
  const gate = await requireOpsWriter();
  if (gate.error) return gate.error;

  const [south, west, north, east] = ACTIVE_BAZAAR.bbox;
  const bboxStr = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:18];(
    node["amenity"~"^(toilets|atm|bureau_de_change|pharmacy|cafe|parking|post_office)$"](${bboxStr});
    way["amenity"~"^(toilets|parking|pharmacy)$"](${bboxStr});
    node["shop"]["name"](${bboxStr});
  );out center 180;`;

  let elements: OverpassElement[] = [];
  let sourceNote = "overpass-live";

  const mirrors = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];

  let lastErr = "";
  for (const mirror of mirrors) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 11000);
      const res = await fetch(mirror, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "HAN-Bazaar-OS/2.0 (https://han.mansis.com.tr)",
        },
        body: "data=" + encodeURIComponent(query),
        signal: ctrl.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const json = (await res.json()) as { elements?: OverpassElement[] };
      elements = Array.isArray(json.elements) ? json.elements : [];
      sourceNote = `overpass-live:${new URL(mirror).hostname}`;
      lastErr = "";
      break;
    } catch (e) {
      lastErr = String((e as Error).message || e);
    }
  }

  if (lastErr && elements.length === 0) {
    sourceNote = "overpass-unavailable:" + lastErr;
    return NextResponse.json({
      ok: true,
      syncedPois: 0,
      syncedCandidates: 0,
      source: sourceNote,
      attribution: "© OpenStreetMap contributors",
      bazaar: ACTIVE_BAZAAR.id,
    });
  }

  const poiBatch: ExternalPoiRow[] = [];
  let syncedCandidates = 0;

  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const tags = el.tags || {};
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const poiKind = classifyPoi(tags);
    if (poiKind && poiBatch.length < 120) {
      const name =
        tags.name ||
        tags["name:tr"] ||
        (poiKind === "wc"
          ? "Umumi WC (OSM)"
          : poiKind === "atm"
            ? tags.operator || "ATM / Döviz (OSM)"
            : poiKind === "eczane"
              ? "Eczane (OSM)"
              : poiKind === "ulasim"
                ? "Otopark (OSM)"
                : "Hizmet Noktası (OSM)");
      const subParts = [tags["addr:street"], tags["addr:housenumber"], tags.operator].filter(Boolean);
      poiBatch.push({
        id: `osm-${el.type}-${el.id}`,
        source: "osm",
        kind: poiKind,
        name,
        sub: subParts.join(" · ") || "Tarihi Yarımada · OpenStreetMap",
        tip: tags.opening_hours ? `Saatler: ${tags.opening_hours}` : "Açık kaynak OpenStreetMap kaydı",
        hours: tags.opening_hours || "09:00–19:00",
        lat: lat!,
        lng: lng!,
        tags,
      });
    }

    if (tags.shop && tags.name && syncedCandidates < 45) {
      const near = nearestPlace(lat!, lng!);
      const tel = String(tags.phone || tags["contact:phone"] || tags["contact:mobile"] || "").trim();
      const addr = [tags["addr:street"], tags["addr:housenumber"], tags["addr:suburb"]].filter(Boolean).join(" ");
      await upsertCandidateShop({
        id: `osm-shop-${el.type}-${el.id}`,
        source: "osm",
        external_id: `${el.type}/${el.id}`,
        name: tags.name,
        cat: mapOsmShopCategory(tags.shop),
        place_id: near.dist <= 220 ? near.place.id : null,
        semt: near.place.semt,
        floor: 0,
        door: tags["addr:housenumber"] || null,
        tel,
        address: addr || `${near.place.name} çevresi`,
        lat: lat!,
        lng: lng!,
        status: "pending",
        invite_token: randomBytes(12).toString("base64url"),
        notes: `OSM shop=${tags.shop}`,
        raw: tags,
      });
      syncedCandidates += 1;
    }
  }

  const syncedPois = await upsertExternalPois(poiBatch);

  return NextResponse.json({
    ok: true,
    syncedPois,
    syncedCandidates,
    source: sourceNote,
    attribution: "© OpenStreetMap contributors",
    bazaar: ACTIVE_BAZAAR.id,
  });
}
