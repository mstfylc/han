// HAN 2.0 — Unified Service POIs (Curated SC.SERVICE_POIS + Live OSM external_pois).

import { NextResponse } from "next/server";

import * as SC from "@/data/han-scale";
import { readExternalPois } from "@/server/db";

export const dynamic = "force-dynamic";

const BASE_PHARMACIES = [
  {
    id: "ecz-eminonu-yeni",
    kind: "eczane",
    source: "curated" as const,
    lat: 41.0168,
    lng: 28.9711,
    hours: "08:30–19:30",
    title: { tr: "Eminönü Meydan Eczanesi", en: "Eminönü Square Pharmacy", ru: "Аптека Эминёню", ar: "صيدلية إمين أونو" },
    sub: { tr: "Mısır Çarşısı & Tahtakale Girişi", en: "Spice Bazaar & Tahtakale Entrance", ru: "Вход на Египетский базар", ar: "مدخل سوق التوابل" },
    tip: { tr: "Santral Han'a 4 dk düz yürüyüş · İngilizce destek", en: "4 min flat walk to Santral Han", ru: "4 мин пешком от Сантрал Хана", ar: "٤ دقائق مشيًا من سانترال خان" },
  },
  {
    id: "ecz-mahmutpasa",
    kind: "eczane",
    source: "curated" as const,
    lat: 41.0136,
    lng: 28.9702,
    hours: "09:00–19:00",
    title: { tr: "Mahmutpaşa Yokuşu Eczanesi", en: "Mahmutpaşa Pharmacy", ru: "Аптека Махмутпаша", ar: "صيدلية محمود باشا" },
    sub: { tr: "Kürkçü Han & Büyük Yeni Han arası", en: "Between Kürkçü Han & Büyük Yeni Han", ru: "Между Кюркчю и Бююк Ени Хан", ar: "بين كوركجو وبويوك يني خان" },
    tip: { tr: "Çarşı içi acil ilk yardım & reçeteli ilaç", en: "Quick first-aid & prescription support", ru: "Первая помощь и рецепты", ar: "إسعافات أولية وأدوية" },
  },
  {
    id: "ecz-beyazit",
    kind: "eczane",
    source: "curated" as const,
    lat: 41.0108,
    lng: 28.9675,
    hours: "08:30–20:00",
    title: { tr: "Kapalıçarşı Beyazıt Eczanesi", en: "Grand Bazaar Beyazıt Pharmacy", ru: "Аптека Беязыт (Гранд-базар)", ar: "صيدلية بيازيد (السوق المسقوف)" },
    sub: { tr: "Kapalıçarşı Beyazıt Kapısı çıkışı", en: "Grand Bazaar Beyazıt Gate exit", ru: "Выход у ворот Беязыт", ar: "مخرج بوابة بيازيد" },
    tip: { tr: "T1 Beyazıt tramvay durağına 2 dk", en: "2 min from T1 Beyazıt tram stop", ru: "2 мин от трамвая T1 Беязыт", ar: "دقيقتان من ترام بيازيد" },
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");

  const curated = [
    ...SC.SERVICE_POIS.map((p) => ({
      id: p.id,
      kind: p.kind,
      source: "curated" as const,
      lat: p.lat,
      lng: p.lng,
      hours: p.hours,
      title: p.title,
      sub: p.sub,
      tip: p.tip,
    })),
    ...BASE_PHARMACIES,
  ].filter((p) => !kind || kind === "all" || p.kind === kind);

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
