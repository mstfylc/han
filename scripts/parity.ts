/**
 * Engine invariant & production backbone parity check.
 *
 * Verifies the Santral Han + 39-place production backbone (39 places, 14,972 units,
 * 1,600 records, 194 real Santral Han doors, service POIs), opening hours, Friday
 * prayer break, business-centre lifts, 4-language search lexicon, and product groups.
 *
 * Run: npx tsx scripts/parity.ts
 */
import {
  PLACES,
  RECORDS,
  SCALE_TOTALS,
  SERVICE_POIS,
  UNIT_INDEX,
  accessOf,
  openState,
} from "../src/data/han-scale";
import { SYNONYMS, norm, parseQuery, productsIn, search } from "../src/data/han-search";
import { STORES } from "../src/data/han-data";
import { computeCorridorPolyline } from "../src/data/floorplans";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "  ok " : "FAIL "} ${label}: ${a}${ok ? "" : `  (expected ${e})`}`);
}

async function main() {
  console.log("\n── production scale backbone (incl. Santral Han) ──────────");
  check("places (38 base + Santral Han)", SCALE_TOTALS.places, 39);
  check("units", SCALE_TOTALS.units, 14972);
  check("records", RECORDS.length, SCALE_TOTALS.records);
  check("curated records merged", RECORDS.filter((r) => r.curated).length, STORES.length);
  check("unit index covers every place", Object.keys(UNIT_INDEX).length, PLACES.length);
  check("Santral Han exists", Boolean(PLACES.find((p) => p.id === "santral")), true);
  check("Santral Han real doors >= 190", RECORDS.filter((r) => r.place === "santral").length >= 190, true);
  check("Service POIs >= 10 (WC/ATM/Mola/Kargo/Ulaşım)", SERVICE_POIS.length >= 10, true);

  console.log("\n── place kinds and hours ──────────────────────────────────");
  const kinds = [...new Set(PLACES.map((p) => p.kind))].sort();
  check("place kinds", kinds, ["cadde", "carsi", "han", "is-merkezi", "pasaj"]);
  const noon = new Date("2026-09-02T12:00:00"); // Wednesday
  const cadde = PLACES.find((p) => p.kind === "cadde")!;
  check("cadde open at noon midweek", openState(cadde, noon).open, true);
  const sunday = new Date("2026-09-06T12:00:00");
  check("han closed on Sunday", openState(PLACES.find((p) => p.kind === "han")!, sunday).open, false);
  const friday = new Date("2026-09-04T13:00:00");
  check("han in Friday prayer break", openState(PLACES.find((p) => p.kind === "han")!, friday).reason, "namaz");
  check("cadde has no prayer break", openState(cadde, friday).open, true);
  check("openState resolves a place id", openState(cadde.id, friday).open, openState(cadde, friday).open);

  const bc = PLACES.filter((p) => p.kind === "is-merkezi" && p.floors.length > 2);
  check("multi-floor business centres all have a lift", bc.every((p) => accessOf(p).lift), true);

  console.log("\n── search & 4-language lexicon ────────────────────────────");
  for (const q of ["kılıf", "telefon kabı", "phone case", "silikon kılıf", "poşet", "Yıldız Han", "Santral Han"]) {
    const res = search(q, {}, { mode: "toptan", lang: "tr" });
    check(`search "${q}" has hits`, res.total > 0 && res.items.length > 0, true);
  }
  check("multi-word synonym resolves", parseQuery("telefon kabı").cats, ["kilif"]);
  check("empty query parses as bos", parseQuery("").kind, "bos");
  check("no dead lexicon entries", Object.values(SYNONYMS).flat().filter((w) => norm(w) === "").length, 0);

  const ru = search("чехол", {}, { mode: "toptan", lang: "ru" });
  const ar = search("غطاء", {}, { mode: "toptan", lang: "ar" });
  const en = search("phone case", {}, { mode: "toptan", lang: "en" });
  check("ru query resolves to kilif", ru.catGuess, "kilif");
  check("ar query resolves to kilif", ar.catGuess, "kilif");
  check("ru/ar/en agree on total hits", [ru.total, ar.total, en.total], [en.total, en.total, en.total]);

  console.log("\n── product layer & corridor blueprint ─────────────────────");
  const prods = productsIn("kilif", { mode: "toptan" });
  check("product groups in kilif >= 7", prods.length >= 7, true);
  const poly = computeCorridorPolyline({ x: 450, y: 356 }, { x: 279, y: 45 });
  check("Manhattan corridor polyline computes meters & steps", poly.meters >= 5 && poly.steps >= 5 && poly.points.split(" ").length >= 4, true);

  console.log(
    failures === 0
      ? "\n✔ parity: all production backbone, search, lexicon and blueprint invariants passed.\n"
      : `\n✘ parity: ${failures} check(s) failed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
