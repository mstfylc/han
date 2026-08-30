/**
 * Parity check: the ported TypeScript engine must behave exactly like the
 * prototype's JavaScript engine.
 *
 * The record set is generated from a fixed seed, so "same seed → same bazaar"
 * is a testable claim, not a hope. If a port ever drifts, this is what says so.
 * Run: npx tsx scripts/parity.ts
 */
import { PLACES, RECORDS, SCALE_TOTALS, UNIT_INDEX, openState, accessOf } from "../src/data/han-scale";
import { search, parseQuery, productsIn, norm, SYNONYMS } from "../src/data/han-search";
import { STORES } from "../src/data/han-data";

const PROTO = "../../project";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "  ok " : "FAIL "} ${label}: ${a}${ok ? "" : `  (expected ${e})`}`);
}

async function main() {
  console.log("\n── scale backbone ─────────────────────────────────────────");
  // These are the figures the handoff and the admin panel both quote.
  check("places", SCALE_TOTALS.places, 38);
  check("units", SCALE_TOTALS.units, 14716);
  check("records", RECORDS.length, SCALE_TOTALS.records);
  check("curated records merged", RECORDS.filter((r) => r.curated).length, STORES.length);
  check("unit index covers every place", Object.keys(UNIT_INDEX).length, PLACES.length);

  // Compare against the untouched prototype module, loaded straight from the
  // handoff bundle. Same seed, same code path → identical output.
  const proto = await import(`${PROTO}/han-scale.js`);
  check("record count matches prototype", RECORDS.length, proto.RECORDS.length);
  check("totals match prototype", SCALE_TOTALS, proto.SCALE_TOTALS);

  const mismatched = RECORDS.filter((r, i) => {
    const p = proto.RECORDS[i];
    return !p || p.id !== r.id || p.name !== r.name || p.status !== r.status ||
      p.door !== r.door || p.floor !== r.floor || p.skuCount !== r.skuCount ||
      JSON.stringify(p.band) !== JSON.stringify(r.band);
  });
  check("every record identical to prototype", mismatched.length, 0);
  if (mismatched.length) console.log("   first mismatch:", mismatched[0].id);

  console.log("\n── place kinds and hours ──────────────────────────────────");
  // Trap 10: HOURS_BY_KIND keys must line up with PLACE_KINDS, or records run
  // on the wrong clock silently.
  const kinds = [...new Set(PLACES.map((p) => p.kind))].sort();
  check("place kinds", kinds, ["cadde", "carsi", "han", "is-merkezi", "pasaj"]);
  const noon = new Date("2026-09-02T12:00:00");   // a Wednesday
  const cadde = PLACES.find((p) => p.kind === "cadde")!;
  check("cadde open at noon midweek", openState(cadde, noon).open, true);
  const sunday = new Date("2026-09-06T12:00:00");
  check("han closed on Sunday", openState(PLACES.find((p) => p.kind === "han")!, sunday).open, false);
  const friday = new Date("2026-09-04T13:00:00");
  check("han in Friday prayer break", openState(PLACES.find((p) => p.kind === "han")!, friday).reason, "namaz");
  check("cadde has no prayer break", openState(cadde, friday).open, true);
  // openState must resolve an id, not fall through to the han default.
  check("openState resolves a place id", openState(cadde.id, friday).open, openState(cadde, friday).open);

  // The bug TypeScript caught: business centres compared against "is_merkezi".
  const bc = PLACES.filter((p) => p.kind === "is-merkezi" && p.floors.length > 2);
  check("multi-floor business centres all have a lift", bc.every((p) => accessOf(p).lift), true);

  console.log("\n── search ─────────────────────────────────────────────────");
  const protoSearch = await import(`${PROTO}/han-search.js`);
  // Trap 15: multi-word synonyms. Half the lexicon used to be dead.
  for (const q of ["kılıf", "telefon kabı", "phone case", "silikon kılıf", "poşet", "Yıldız Han"]) {
    const mine = search(q, {}, { mode: "toptan", lang: "tr" });
    const theirs = protoSearch.search(q, {}, { mode: "toptan", lang: "tr" });
    check(`search "${q}" total`, mine.total, theirs.total);
    check(`search "${q}" first hit`, mine.items[0]?.rec.id ?? null, theirs.items[0]?.rec.id ?? null);
  }
  check("multi-word synonym resolves", parseQuery("telefon kabı").cats, ["kilif"]);
  check("empty query parses as bos", parseQuery("").kind, "bos");

  console.log("\n── non-Latin search (deliberate divergence) ───────────────");
  // The prototype's norm() stripped everything outside [a-z0-9], so 40 of the
  // 142 lexicon entries — every Russian and Arabic one — collapsed to "". Any
  // non-Latin query then read as "no query" and returned all 1,385 records.
  // We keep Cyrillic and Arabic, so these now resolve to a category. This is
  // the one place the port is intentionally NOT bug-for-bug faithful.
  check("no dead lexicon entries", Object.values(SYNONYMS).flat().filter((w) => norm(w) === "").length, 0);
  const ru = search("чехол", {}, { mode: "toptan", lang: "ru" });
  const ar = search("غطاء", {}, { mode: "toptan", lang: "ar" });
  const en = search("phone case", {}, { mode: "toptan", lang: "en" });
  check("ru query resolves to a category", ru.catGuess, "kilif");
  check("ar query resolves to a category", ar.catGuess, "kilif");
  check("ru/ar/en agree on the same product", [ru.total, ar.total, en.total], [en.total, en.total, en.total]);
  check("prototype returned the whole directory for ru", protoSearch.search("чехол", {}, {}).total, RECORDS.length);

  console.log("\n── product layer (M2) ─────────────────────────────────────");
  const prods = productsIn("kilif", { mode: "toptan" });
  const protoProds = protoSearch.productsIn("kilif", { mode: "toptan" });
  check("product groups in kilif", prods.length, protoProds.length);
  check("product ordering", prods.slice(0, 3).map((p) => p.slug), protoProds.slice(0, 3).map((p: { slug: string }) => p.slug));

  console.log(
    failures === 0
      ? "\n✔ parity: the ported engine matches the prototype exactly.\n"
      : `\n✘ parity: ${failures} check(s) failed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
