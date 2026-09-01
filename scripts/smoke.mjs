/**
 * Smoke check: every buyer route must render with no console error, no unresolved
 * template placeholder, and no raw slug or NaN leaking onto the screen.
 *
 * The prototype was audited the same way — a screen that renders "undefined" or
 * "kapalicarsi" instead of "Kapalıçarşı" is broken even though nothing threw.
 *
 * Usage: node scripts/smoke.mjs [baseUrl]
 */
import { launch } from "./testkit.mjs";

const BASE = process.argv[2] || "http://localhost:3000";

const ROUTES = [
  "/",
  "/ara",
  "/ara?q=kılıf",
  "/ara?q=telefon kabı&s=fiyat&semt=tahtakale",
  "/ara?q=чехол",
  "/ara?p=store:emre",
  "/kategori",
  "/kategori?grup=aksesuar&kat=kilif",
  "/urun/kilif",
  "/urun/kilif/silikon-kilif",
  "/dukkan/emre",
  "/dukkan/emre/guven",
  "/dukkan/emre/konum",
  "/dukkan/emre/reviews",
  "/dukkan/r517",
  "/plan",
  "/isler/talep",
  "/isler/karsi",
  "/isler/kayitli",
  "/isler/bildirim",
  "/harita",
  "/etkinlik",
  "/arac/doviz",
  "/arac/rehber",
  "/arac/taxfree",
  "/arac/lojistik",
  "/arac/yakin",
  "/arac/kultur",
  "/arac/acil",
  "/arac/sorun",
  "/yer/yildiz",
  "/sokak/s-kalpakcilar",
  "/han/yildiz/2",
  "/tarif/emre",
  "/esnaf",
  "/esnaf?yer=yildiz",
  "/esnaf/talep",
  "/esnaf/durum",
  "/esnaf/yonet",
];

/** Text that must never reach a reader. */
const LEAKS = [
  { re: /\{\{[^}]+\}\}/, why: "unresolved template placeholder" },
  { re: /\bundefined\b/, why: "the word 'undefined'" },
  { re: /\bNaN\b/, why: "NaN" },
  { re: /\[object Object\]/, why: "[object Object]" },
];

const run = async () => {
  // This environment ships Chromium at a pinned path; the npm playwright
  // version may not match its own download build, so point at the real binary
  // rather than fetching another copy.
  const browser = await launch();
  let failures = 0;

  for (const lang of ["tr", "ar"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    const errors = [];
    // Map tiles come from OpenStreetMap and cannot be vendored; when the
    // network is unavailable Leaflet falls back to its own canvas colour, which
    // is the intended degraded state rather than a fault in the page.
    // The failing URL is not always in the message text — for a blocked image
    // the text is just "Failed to load resource" and the URL is in location().
    // Check both, so a genuine error still fails the run.
    const external = (m) =>
      /tile\.openstreetmap\.org/.test(m.text()) ||
      /tile\.openstreetmap\.org/.test((m.location() || {}).url || "");
    page.on("console", (m) => { if (m.type() === "error" && !external(m)) errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));

    for (const route of ROUTES) {
      errors.length = 0;
      const url = BASE + route + (route.includes("?") ? "&" : "?") + "l=" + lang;
      let status = 0;
      try {
        const res = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        status = res ? res.status() : 0;
      } catch (e) {
        console.log(`FAIL  [${lang}] ${route} — navigation: ${e.message}`);
        failures++;
        continue;
      }

      // Give the engine a beat to boot and the first paint to settle.
      await page.waitForTimeout(350);

      const text = await page.evaluate(() => document.body.innerText);
      const problems = [];
      if (status >= 400) problems.push("HTTP " + status);
      if (errors.length) problems.push("console: " + errors.slice(0, 2).join(" | "));
      LEAKS.forEach(({ re, why }) => { if (re.test(text)) problems.push(why); });
      if (text.trim().length < 40) problems.push("page is effectively blank");

      const dir = await page.evaluate(() => document.documentElement.dir);
      const htmlLang = await page.evaluate(() => document.documentElement.lang);
      if (lang === "ar" && dir !== "rtl") problems.push(`dir is "${dir}", expected rtl`);
      if (htmlLang !== lang) problems.push(`html lang is "${htmlLang}", expected ${lang}`);

      if (problems.length) {
        console.log(`FAIL  [${lang}] ${route} — ${problems.join("; ")}`);
        failures++;
      } else {
        console.log(`  ok  [${lang}] ${route}`);
      }
    }
    await ctx.close();
  }

  // Narrow viewport: the bazaar is browsed on a phone, in the bazaar.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const route of ["/", "/ara?q=kılıf", "/plan", "/isler/talep", "/dukkan/emre"]) {
    errors.length = 0;
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    // Nothing may scroll the page sideways at 390px.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    const problems = [];
    if (overflow > 2) problems.push(`horizontal overflow of ${overflow}px`);
    if (errors.length) problems.push("error: " + errors[0]);
    if (problems.length) { console.log(`FAIL  [390px] ${route} — ${problems.join("; ")}`); failures++; }
    else console.log(`  ok  [390px] ${route}`);
  }
  await ctx.close();

  await browser.close();
  console.log(failures === 0 ? "\n✔ smoke: all routes clean.\n" : `\n✘ smoke: ${failures} failure(s).\n`);
  process.exit(failures ? 1 : 0);
};

run();
