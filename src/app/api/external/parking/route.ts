// HAN 2.0 — Live İBB İSPARK Parking Occupancy (5 min cache, Haversine filtered to Active Bazaar).

import { NextResponse } from "next/server";

import { ACTIVE_BAZAAR, haversineMeters } from "@/data/bazaars";
import { readExternalCache, writeExternalCache } from "@/server/db";

export const dynamic = "force-dynamic";

export interface ParkingLot {
  id: string;
  name: string;
  parkType: string;
  capacity: number;
  emptyCapacity: number;
  occupancyPct: number;
  status: "open" | "busy" | "full";
  isOpen: boolean;
  lat: number;
  lng: number;
  distanceMeters: number;
  workHours: string;
}

interface ParkingPayload {
  source: "ibb-ispark-live" | "fallback";
  updatedAt: string;
  lots: ParkingLot[];
}

const CACHE_KEY = "ibb_ispark_v1";
const TTL_SEC = 300;
let memCache: { payload: ParkingPayload; exp: number } | null = null;

const FALLBACK_LOTS: ParkingLot[] = [
  {
    id: "ispark-mercanyokus",
    name: "İSPARK Mercan Katlı Otoparkı",
    parkType: "KAPALI OTOPARK",
    capacity: 240,
    emptyCapacity: 42,
    occupancyPct: 83,
    status: "busy",
    isOpen: true,
    lat: 41.0148,
    lng: 28.9672,
    distanceMeters: 210,
    workHours: "07:00-22:00",
  },
  {
    id: "ispark-eminonu",
    name: "İSPARK Eminönü Meydan Açık Otopark",
    parkType: "AÇIK OTOPARK",
    capacity: 180,
    emptyCapacity: 68,
    occupancyPct: 62,
    status: "open",
    isOpen: true,
    lat: 41.0174,
    lng: 28.9718,
    distanceMeters: 360,
    workHours: "24 Saat",
  },
  {
    id: "ispark-beyazit",
    name: "İSPARK Beyazıt Katlı Otopark",
    parkType: "KAPALI OTOPARK",
    capacity: 320,
    emptyCapacity: 110,
    occupancyPct: 66,
    status: "open",
    isOpen: true,
    lat: 41.0102,
    lng: 28.9648,
    distanceMeters: 520,
    workHours: "07:00-23:00",
  },
  {
    id: "ispark-sirkeci",
    name: "İSPARK Sirkeci İskelesi Açık Otopark",
    parkType: "AÇIK OTOPARK",
    capacity: 210,
    emptyCapacity: 74,
    occupancyPct: 65,
    status: "open",
    isOpen: true,
    lat: 41.0161,
    lng: 28.9776,
    distanceMeters: 640,
    workHours: "24 Saat",
  },
  {
    id: "ispark-gedikpasa",
    name: "İSPARK Gedikpaşa Katlı Otopark",
    parkType: "KAPALI OTOPARK",
    capacity: 260,
    emptyCapacity: 58,
    occupancyPct: 78,
    status: "busy",
    isOpen: true,
    lat: 41.0074,
    lng: 28.9682,
    distanceMeters: 780,
    workHours: "07:00-22:00",
  },
  {
    id: "ispark-cemberlitas",
    name: "İSPARK Çemberlitaş Yol Üstü & Katlı",
    parkType: "KAPALI OTOPARK",
    capacity: 150,
    emptyCapacity: 31,
    occupancyPct: 79,
    status: "busy",
    isOpen: true,
    lat: 41.0089,
    lng: 28.9718,
    distanceMeters: 690,
    workHours: "07:30-22:00",
  },
];

function classifyStatus(cap: number, empty: number): "open" | "busy" | "full" {
  if (empty <= 3 || cap <= 0) return "full";
  const ratio = empty / cap;
  if (ratio >= 0.25) return "open";
  return "busy";
}

export async function GET() {
  if (memCache && memCache.exp > Date.now()) {
    return NextResponse.json({ ok: true, cached: true, ...memCache.payload });
  }

  const dbCached = await readExternalCache<ParkingPayload>(CACHE_KEY);
  if (dbCached?.fresh && Array.isArray(dbCached.payload?.lots) && dbCached.payload.lots.length > 0) {
    memCache = { payload: dbCached.payload, exp: Date.now() + 90 * 1000 };
    return NextResponse.json({ ok: true, cached: true, ...dbCached.payload });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch("https://api.ibb.gov.tr/ispark/Park", {
      signal: ctrl.signal,
      headers: { "User-Agent": "HAN-Bazaar-OS/2.0 (https://han.mansis.com.tr)" },
      cache: "no-store",
    });
    clearTimeout(timer);

    if (res.ok) {
      const raw = (await res.json()) as Array<{
        parkID?: number;
        parkName?: string;
        lat?: string | number;
        lng?: string | number;
        capacity?: number;
        emptyCapacity?: number;
        workHours?: string;
        parkType?: string;
        isOpen?: number;
      }>;
      if (Array.isArray(raw)) {
        const maxDist = ACTIVE_BAZAAR.parkingRadiusKm * 1000;
        const lots: ParkingLot[] = [];
        for (const item of raw) {
          const lat = Number(item.lat);
          const lng = Number(item.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const dist = haversineMeters(ACTIVE_BAZAAR.center.lat, ACTIVE_BAZAAR.center.lng, lat, lng);
          if (dist > maxDist) continue;
          const cap = Math.max(0, Number(item.capacity) || 0);
          const empty = Math.max(0, Number(item.emptyCapacity) || 0);
          const occ = cap > 0 ? Math.min(100, Math.round(((cap - empty) / cap) * 100)) : 100;
          lots.push({
            id: `ispark-${item.parkID ?? lots.length}`,
            name: String(item.parkName || "İSPARK Otopark"),
            parkType: String(item.parkType || "OTOPARK"),
            capacity: cap,
            emptyCapacity: empty,
            occupancyPct: occ,
            status: classifyStatus(cap, empty),
            isOpen: item.isOpen !== 0,
            lat,
            lng,
            distanceMeters: Math.round(dist),
            workHours: String(item.workHours || "07:00-22:00"),
          });
        }

        lots.sort((a, b) => a.distanceMeters - b.distanceMeters);
        const top = lots.slice(0, 12);
        if (top.length > 0) {
          const payload: ParkingPayload = {
            source: "ibb-ispark-live",
            updatedAt: new Date().toISOString(),
            lots: top,
          };
          memCache = { payload, exp: Date.now() + TTL_SEC * 1000 };
          await writeExternalCache(CACHE_KEY, payload, TTL_SEC);
          return NextResponse.json({ ok: true, cached: false, ...payload });
        }
      }
    }
  } catch {
    // Graceful fallback below
  }

  if (dbCached?.payload?.lots?.length) {
    return NextResponse.json({ ok: true, cached: true, stale: true, ...dbCached.payload });
  }

  return NextResponse.json({
    ok: true,
    cached: false,
    source: "fallback",
    updatedAt: new Date().toISOString(),
    lots: FALLBACK_LOTS,
  });
}
