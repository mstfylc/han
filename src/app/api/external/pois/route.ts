// HAN 2.0 — Unified Service POIs (Curated SC.SERVICE_POIS + Live OSM external_pois).

import { NextResponse } from "next/server";

import * as SC from "@/data/han-scale";
import { readExternalPois } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");

  const curated = SC.SERVICE_POIS.filter((p) => !kind || kind === "all" || p.kind === kind).map((p) => ({
    id: p.id,
    kind: p.kind,
    source: "curated" as const,
    lat: p.lat,
    lng: p.lng,
    hours: p.hours,
    title: p.title,
    sub: p.sub,
    tip: p.tip,
  }));

  const osmRows = await readExternalPois(kind);
  const osmMapped = osmRows.map((p) => ({
    id: p.id,
    kind: p.kind,
    source: "osm" as const,
    lat: p.lat,
    lng: p.lng,
    hours: p.hours || "09:00–19:00",
    title: { tr: p.name, en: p.name, ru: p.name, ar: p.name },
    sub: { tr: p.sub, en: p.sub, ru: p.sub, ar: p.sub },
    tip: { tr: p.tip, en: p.tip, ru: p.tip, ar: p.tip },
  }));

  return NextResponse.json({
    ok: true,
    total: curated.length + osmMapped.length,
    curatedCount: curated.length,
    osmCount: osmMapped.length,
    attribution: "© OpenStreetMap contributors",
    pois: [...curated, ...osmMapped],
  });
}
