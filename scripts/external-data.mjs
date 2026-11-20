#!/usr/bin/env node
// HAN 2.0 Kademe 2 — External Live Data, RBAC & KVKK Invite Contract Test.
// Usage: node scripts/external-data.mjs [BASE_URL]

const BASE = (process.argv[2] || process.env.HAN_BASE_URL || "https://han.mansis.com.tr").replace(/\/$/, "");

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`  ok  ${name}${detail ? " — " + detail : ""}`);
    passed += 1;
  } catch (err) {
    console.error(`FAIL  ${name} — ${err.message}`);
    failed += 1;
  }
}

console.log(`\n── HAN 2.0 Kademe 2 External Data & KVKK Contract (${BASE}) ──`);

await check("1. TCMB /api/external/rates returns positive USD & EUR", async () => {
  const res = await fetch(`${BASE}/api/external/rates`);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  if (!d.ok || !d.rates || !(d.rates.USD > 0) || !(d.rates.EUR > 0)) {
    throw new Error("missing USD/EUR rates");
  }
  return `source=${d.source}, 1 USD ≈ ${d.tryPerUnit?.USD ?? "?"} TRY`;
});

await check("2. Unified /api/external/pois includes curated POIs + OSM attribution", async () => {
  const res = await fetch(`${BASE}/api/external/pois`);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  if (!d.ok || !Array.isArray(d.pois) || d.pois.length < 10) {
    throw new Error(`unexpected poi count: ${d.pois?.length}`);
  }
  if (!String(d.attribution || "").includes("OpenStreetMap")) {
    throw new Error("missing OpenStreetMap attribution");
  }
  return `total=${d.total} (curated=${d.curatedCount}, osm=${d.osmCount})`;
});

await check("3. İBB İSPARK /api/external/parking returns nearby lots with capacity", async () => {
  const res = await fetch(`${BASE}/api/external/parking`);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  if (!d.ok || !Array.isArray(d.lots) || d.lots.length < 1) {
    throw new Error("no parking lots returned");
  }
  const first = d.lots[0];
  if (typeof first.capacity !== "number" || typeof first.emptyCapacity !== "number") {
    throw new Error("missing capacity numbers");
  }
  return `source=${d.source}, lots=${d.lots.length}, nearest=${first.name} (${first.emptyCapacity}/${first.capacity})`;
});

await check("4. Google Places bridge returns ToS-compliant Google Maps URL", async () => {
  const res = await fetch(`${BASE}/api/external/google-place?name=Santral+Han&area=Tahtakale`);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  if (!d.ok || !String(d.mapsUrl || "").startsWith("https://")) {
    throw new Error("missing valid Google Maps URL");
  }
  return `configured=${d.configured}, rating=${d.rating ?? "link-only"}`;
});

await check("5. RBAC blocks anonymous OSM sync & candidate/invite endpoints with 401", async () => {
  const r1 = await fetch(`${BASE}/api/external/osm-sync`, { method: "POST" });
  const r2 = await fetch(`${BASE}/api/external/candidates`);
  const r3 = await fetch(`${BASE}/api/external/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopName: "Test", contact: "05320000000" }),
  });
  if (r1.status !== 401 || r2.status !== 401 || r3.status !== 401) {
    throw new Error(`expected 401/401/401, got ${r1.status}/${r2.status}/${r3.status}`);
  }
  return "osm-sync=401, candidates=401, invites=401";
});

await check("6. Public invite token route rejects unknown token cleanly with 404", async () => {
  const res = await fetch(`${BASE}/api/external/invite-public?token=unknown_token_test_123`);
  if (res.status !== 404) throw new Error(`expected 404, got ${res.status}`);
  return "unknown token -> 404";
});

console.log(`\nResult: ${passed}/${passed + failed} PASS\n`);
if (failed > 0) process.exit(1);
