// HAN — Multi-bazaar region configuration.
// Keeps geographic bounding boxes, default anchor han, and external API radii
// out of hardcoded page logic so additional cities/bazaars (e.g. Izmir Kemeraltı)
// can be added declaratively.

export interface BazaarRegion {
  id: string;
  name: { tr: string; en: string; ru: string; ar: string };
  city: string;
  center: { lat: number; lng: number };
  /** [south, west, north, east] for Overpass & map bounds */
  bbox: [number, number, number, number];
  defaultHanId: string;
  parkingRadiusKm: number;
  initialZoom: number;
  initialPitch: number;
  initialBearing: number;
}

export const BAZAAR_REGIONS: Record<string, BazaarRegion> = {
  "istanbul-tarihi-yarimada": {
    id: "istanbul-tarihi-yarimada",
    name: {
      tr: "İstanbul Tarihi Yarımada Çarşıları",
      en: "Istanbul Historic Peninsula Bazaars",
      ru: "Исторические базары Стамбула",
      ar: "أسواق شبه الجزيرة التاريخية في إسطنبول",
    },
    city: "İstanbul",
    center: { lat: 41.0138, lng: 28.9690 },
    bbox: [41.007, 28.962, 41.019, 28.976],
    defaultHanId: "santral",
    parkingRadiusKm: 1.8,
    initialZoom: 16.2,
    initialPitch: 48,
    initialBearing: -15,
  },
};

export const ACTIVE_BAZAAR: BazaarRegion = BAZAAR_REGIONS["istanbul-tarihi-yarimada"];

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
