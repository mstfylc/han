// HAN — Han & Door-Number Grouped Moderation Engine.
// Groups ShopRecord queues by Place (Han/Bazaar) and orders units deterministically
// by floor -> numeric door number so field officers and han managers moderate door-by-door.

import * as SC from "@/data/han-scale";
import type { Place, ShopRecord } from "@/data/types";

export interface HanModerationGroup {
  placeId: string;
  placeName: string;
  semt: string;
  totalUnits: number;
  place: Place | null;
  records: ShopRecord[];
  counts: {
    aktif: number;
    onayli: number;
    beyan: number;
    askida: number;
    noPhoto: number;
    stale: number;
  };
}

export function numericDoorValue(door: string | number | null | undefined): number {
  const m = String(door ?? "").match(/\d+/);
  return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER;
}

export function compareByFloorAndDoor(a: ShopRecord, b: ShopRecord): number {
  if (a.floor !== b.floor) return a.floor - b.floor;
  const da = numericDoorValue(a.door);
  const db = numericDoorValue(b.door);
  if (da !== db) return da - db;
  return String(a.door ?? "").localeCompare(String(b.door ?? ""), "tr");
}

export type ModerationGroupSort = "pending" | "total" | "noPhoto" | "alpha";

export function groupRecordsByHan(
  records: ShopRecord[],
  sortBy: ModerationGroupSort = "pending",
): HanModerationGroup[] {
  const map = new Map<string, HanModerationGroup>();

  for (const r of records) {
    let g = map.get(r.place);
    if (!g) {
      const place = SC.PLACES.find((p) => p.id === r.place) || null;
      g = {
        placeId: r.place,
        placeName: place?.name || r.place,
        semt: place?.semt || r.semt || "",
        totalUnits: place?.units || 0,
        place,
        records: [],
        counts: { aktif: 0, onayli: 0, beyan: 0, askida: 0, noPhoto: 0, stale: 0 },
      };
      map.set(r.place, g);
    }
    g.records.push(r);
    if (r.status === "aktif") g.counts.aktif += 1;
    else if (r.status === "onayli") g.counts.onayli += 1;
    else if (r.status === "beyan") g.counts.beyan += 1;
    else if (r.status === "askida") g.counts.askida += 1;
    if (!r.photos) g.counts.noPhoto += 1;
    if ((r.updatedDays || 0) > 30) g.counts.stale += 1;
  }

  const groups = Array.from(map.values());
  for (const g of groups) {
    g.records.sort(compareByFloorAndDoor);
  }

  groups.sort((a, b) => {
    if (a.placeId === "santral" && sortBy !== "alpha") return -1;
    if (b.placeId === "santral" && sortBy !== "alpha") return 1;
    if (sortBy === "pending") {
      const d = b.counts.beyan - a.counts.beyan;
      if (d !== 0) return d;
      return b.records.length - a.records.length;
    }
    if (sortBy === "noPhoto") {
      const d = b.counts.noPhoto - a.counts.noPhoto;
      if (d !== 0) return d;
    }
    if (sortBy === "alpha") {
      return a.placeName.localeCompare(b.placeName, "tr");
    }
    return b.records.length - a.records.length;
  });

  return groups;
}
