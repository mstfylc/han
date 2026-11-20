/**
 * HAN Saha E2E — Production-readiness, indoor corridor routing, occasion planner,
 * POI essentials, SEO/OpenGraph, delta sync & 390x844 mobile zero-overflow suite.
 *
 * Usage: node scripts/saha-e2e.mjs [baseUrl]
 */
import { launch } from "./testkit.mjs";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/+$/, "");

let failures = 0;
const ok = (msg) => console.log("  ok  " + msg);
const bad = (msg) => {
  console.log("FAIL  " + msg);
  failures += 1;
};

const MOBILE_ROUTES = [
  "/",
  "/ara",
  "/plan",
  "/etkinlik",
  "/harita?poi=wc",
  "/tarif/roza",
  "/dukkan/roza",
  "/yer/santral",
  "/isler/talep",
  "/arac/doviz",
  "/esnaf",
  "/kategori",
];

async function checkApiAndSeo() {
  // 1. /api/health
  try {
    const res = await fetch(`${BASE}/api/health`);
    const body = await res.json();
    if (res.status === 200 && body?.ok === true && body?.db === "ok") {
      ok("/api/health -> HTTP 200, ok:true, db:ok");
    } else {
      bad(`/api/health unexpected response: status=${res.status} body=${JSON.stringify(body)}`);
    }
  } catch (e) {
    bad("/api/health request failed: " + String(e));
  }

  // 2. Delta Sync: GET /api/state?scope=shared -> maxRevision -> since=<maxRevision> -> 0 keys
  try {
    const res1 = await fetch(`${BASE}/api/state?scope=shared`);
    const d1 = await res1.json();
    if (res1.status !== 200 || typeof d1?.maxRevision !== "number") {
      bad(`/api/state initial fetch failed: status=${res1.status}`);
    } else {
      const since = d1.maxRevision;
      const res2 = await fetch(`${BASE}/api/state?scope=shared&since=${encodeURIComponent(String(since))}`);
      const d2 = await res2.json();
      const count = Object.keys(d2?.scopes?.shared || {}).length;
      if (res2.status === 200 && count === 0) {
        ok(`Delta Sync -> maxRevision=${since}, since=${since} returned 0 unchanged docs`);
      } else {
        bad(`Delta Sync expected 0 docs after since=${since}, got status=${res2.status} count=${count}`);
      }
    }
  } catch (e) {
    bad("Delta Sync check failed: " + String(e));
  }

  // 3. SEO / OpenGraph + sitemap.xml + robots.txt
  for (const path of ["/tarif/roza", "/dukkan/roza"]) {
    try {
      const res = await fetch(`${BASE}${path}`);
      const html = await res.text();
      const hasOg = /og:title/i.test(html);
      const hasRoza = /Roza/i.test(html);
      if (res.status === 200 && hasOg && hasRoza) {
        ok(`SEO/OG ${path} -> HTTP 200, og:title & "Roza" present`);
      } else {
        bad(`SEO/OG ${path} failed: status=${res.status} og:title=${hasOg} Roza=${hasRoza}`);
      }
    } catch (e) {
      bad(`SEO/OG ${path} request failed: ` + String(e));
    }
  }

  for (const path of ["/sitemap.xml", "/robots.txt"]) {
    try {
      const res = await fetch(`${BASE}${path}`);
      if (res.status === 200) {
        ok(`SEO ${path} -> HTTP 200`);
      } else {
        bad(`SEO ${path} expected HTTP 200, got ${res.status}`);
      }
    } catch (e) {
      bad(`SEO ${path} request failed: ` + String(e));
    }
  }
}

async function runBrowserChecks() {
  const browser = await launch();
  try {
    // Desktop / tablet interactive feature checks (4, 5, 6)
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const pageErrors = [];
    const external = (t) => /tile\.openstreetmap\.org/.test(t);
    page.on("pageerror", (e) => {
      if (!external(String(e))) pageErrors.push(String(e));
    });

    // 4. /tarif/roza: IndoorWayfinder door input/chip + polyline[data-corridor-route="1"] + QR Tabelası
    await page.goto(`${BASE}/tarif/roza`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    const doorChip = page.locator('button:has-text("Kapı ")').first();
    const doorInput = page.locator('input[placeholder*="Kapı No"]').first();
    if (await doorChip.count()) {
      await doorChip.click();
      await page.waitForTimeout(300);
      ok("/tarif/roza -> IndoorWayfinder nearby door chip clicked");
    } else if (await doorInput.count()) {
      await doorInput.fill("8");
      await page.waitForTimeout(300);
      ok("/tarif/roza -> IndoorWayfinder door input filled");
    } else {
      bad("/tarif/roza -> IndoorWayfinder door input/chip not found");
    }

    const polyCount = await page.locator('polyline[data-corridor-route="1"]').count();
    if (polyCount > 0) {
      ok(`/tarif/roza -> polyline[data-corridor-route="1"] rendered (${polyCount})`);
    } else {
      bad('/tarif/roza -> polyline[data-corridor-route="1"] not found');
    }

    const qrBtn = page.locator('button:has-text("QR Tabelası")').first();
    if (await qrBtn.count()) {
      ok("/tarif/roza -> QR Tabelası button present");
    } else {
      bad("/tarif/roza -> QR Tabelası button not found");
    }

    // 5. /plan: 200 Kişi + Söz/Nişan package -> %10 fire + Han İçi Ziyaret Sırası
    await page.goto(`${BASE}/plan`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    const btn200 = page.locator('button:has-text("200 Kişi")').first();
    if (await btn200.count()) {
      await btn200.click();
      await page.waitForTimeout(400);
    } else {
      bad('/plan -> "200 Kişi" button not found');
    }

    const loadPkgBtn = page.locator('button:has-text("200 Kişilik Paketi Yükle")').first();
    if (await loadPkgBtn.count()) {
      await loadPkgBtn.click();
      await page.waitForTimeout(600);
    }

    const planText = await page.evaluate(() => document.body.innerText);
    const hasFire = /%10\s*fire/i.test(planText);
    const hasIndoorOrder = /Han İçi Ziyaret Sırası/i.test(planText);
    if (hasFire && hasIndoorOrder) {
      ok('/plan -> 200 Kişi + Söz/Nişan triggered: "%10 fire" & "Han İçi Ziyaret Sırası" visible');
    } else {
      bad(`/plan -> missing output: hasFire=${hasFire}, hasIndoorOrder=${hasIndoorOrder}`);
    }

    // 6. /harita?poi=wc -> WC/Mescit POI cards open
    await page.goto(`${BASE}/harita?poi=wc`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const mapText = await page.evaluate(() => document.body.innerText);
    const hasWcPoi = /WC|Mescit/i.test(mapText) && /Yürüyerek Git|Google Maps|Haritada/i.test(mapText);
    if (hasWcPoi || (/WC/i.test(mapText) && /Mescit/i.test(mapText))) {
      ok("/harita?poi=wc -> WC/Mescit POI cards rendered");
    } else {
      bad("/harita?poi=wc -> WC/Mescit POI cards not visible");
    }

    if (pageErrors.length) {
      bad("Desktop check pageerrors: " + pageErrors.slice(0, 2).join(" | "));
    }
    await ctx.close();

    // 7. 390x844 mobile zero-overflow check across 12 routes
    const mobCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobPage = await mobCtx.newPage();

    for (const route of MOBILE_ROUTES) {
      await mobPage.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await mobPage.waitForTimeout(350);
      const metrics = await mobPage.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      const diff = metrics.scrollWidth - metrics.clientWidth;
      if (diff <= 2) {
        ok(`Mobile 390x844 ${route} -> overflow=${diff}px (<= 2px)`);
      } else {
        bad(`Mobile 390x844 ${route} -> horizontal overflow ${diff}px (scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth})`);
      }
    }
    await mobCtx.close();
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log(`\nHAN Saha E2E -> ${BASE}\n`);
  await checkApiAndSeo();
  await runBrowserChecks();
  console.log(
    failures === 0
      ? "\n✔ saha-e2e: all checks passed.\n"
      : `\n✘ saha-e2e: ${failures} failure(s).\n`,
  );
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("FAIL  unhandled error:", e);
  process.exit(1);
});
