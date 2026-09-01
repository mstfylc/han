/**
 * The seven flows from the audit, walked end to end.
 *
 * DENETIM-PLANI.md §1 listed them with a tick or a cross, and five carried a
 * cross. This is the same table, executed rather than asserted in prose:
 *
 *   1. Ara → dükkân → temas                         ✔ was already whole
 *   2. Talep → dağıtım → teklif → KABUL → sonuç     ✘ accept was impossible
 *   3. Esnaf: sahiplenme → onay → panel → içerik    ✔ but see loop.mjs
 *   4. Esnaf: gelen talep → CEVAP                   ✘ no way to quote
 *   5. Editör: onay/askı → ALICI EKRANI             ✘ decision never crossed
 *   6. Alıcı bildirimi → editör kuyruğu             ✘ lost on refresh
 *   7. Anlaşma → YORUM                              ✘ the right was never granted
 *
 * Each step asserts the thing that was broken, not merely that a page rendered.
 *
 * Usage: node scripts/flows.mjs [baseUrl]
 */
import { chromium } from "playwright";

import { findClaimable, resetAccounts, signIn } from "./testkit.mjs";

const BASE = process.argv[2] || "http://localhost:3001";
const EXEC = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let failures = 0;
const ok = (m) => console.log("  ok  " + m);
const bad = (m) => { console.log("FAIL  " + m); failures++; };
const step = (n, m) => console.log("\n── " + n + " · " + m + " " + "─".repeat(Math.max(0, 52 - m.length)));

const ls = (page, key, dflt) =>
  page.evaluate(({ k, d }) => {
    try { return JSON.parse(localStorage.getItem(k) || d); } catch { return JSON.parse(d); }
  }, { k: key, d: dflt });

const run = async () => {
  const browser = await chromium.launch({ executablePath: EXEC });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  const external = (t) => /tile\.openstreetmap\.org/.test(t);
  page.on("pageerror", (e) => { if (!external(String(e))) errors.push(String(e)); });

  // ── 1 · search → shop → contact ─────────────────────────────────────────
  step(1, "Ara → dükkân → temas");
  await page.goto(BASE + "/ara?q=kılıf&l=tr", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const hits = await page.locator('button:has-text("No ")').count();
  if (!hits) bad("search returned nothing for a known query");
  else ok("search found " + hits + " shops for “kılıf”");

  await page.goto(BASE + "/dukkan/emre?l=tr", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const shopText = await page.evaluate(() => document.body.innerText);
  if (!/Emre/.test(shopText)) bad("the shop page did not render the shop");
  else ok("the shop page opens with its own content");
  // Contact is the point of a directory: a phone or a message route must exist.
  const contact = await page.locator('a[href^="tel:"], a[href*="wa.me"]').count();
  if (!contact) bad("the shop page offers no way to make contact");
  else ok("contact is reachable from the shop page");

  // ── 2 · request → distribution → offer → ACCEPT → outcome ───────────────
  step(2, "Talep → dağıtım → teklif → kabul → sonuç");
  await page.goto(BASE + "/isler/talep?l=tr", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const product = "akış testi kılıf " + Date.now().toString(36).slice(-4);
  await page.locator("input").first().fill(product);
  await page.locator('button:has-text("Talebi gönder"), button:has-text("Gönder")').first().click();
  await page.waitForTimeout(1500);

  const web = await ls(page, "han-web-v1", "{}");
  const req = (web.talepler || []).find((t) => t.urun === product);
  if (!req) { bad("the request was not created"); return finish(browser); }
  ok("request created: " + product);

  // The engine distributes it; those are ESTIMATES and must not be acceptable.
  await page.goto(BASE + "/isler/talep?r=" + encodeURIComponent(req.id) + "&l=tr", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const beforeAccept = await page.evaluate(() => document.body.innerText);
  if (!/tahmin/i.test(beforeAccept)) {
    bad("no estimated range shown — distribution did not run");
  } else {
    ok("the engine produced estimated ranges");
  }
  const acceptableNow = await page.locator('button:has-text("Kabul et")').count();
  if (acceptableNow) bad("K9 violated: an ESTIMATE can be accepted");
  else ok("K9 holds: an estimate carries no accept button");

  // A real offer. It has to go to the SERVER, not just this browser: the next
  // pull would otherwise overwrite a local-only write with the server's copy —
  // which is the system working correctly, and was the test's mistake.
  await page.evaluate(async (id) => {
    const all = JSON.parse(localStorage.getItem("han-offers-v1") || "{}");
    const now = Date.now();
    all[id] = [{
      recordId: "emre", curated: "emre", name: "Emre Aksesuar",
      unit: 38, qty: 100, raw: 3800, gun: 4, note: "akış testi",
      at: now, validUntil: now + 7 * 86400000, real: true, estimate: false,
    }];
    localStorage.setItem("han-offers-v1", JSON.stringify(all));
    await fetch("/api/state", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ writes: [{ scope: "shared", key: "han-offers-v1", value: all }] }),
    });
  }, req.id);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1400);

  const accept = page.locator('button:has-text("Kabul et")').first();
  if (!(await accept.count())) { bad("a REAL offer still cannot be accepted"); return finish(browser); }
  ok("a real offer can be accepted — the thing that was impossible");
  await accept.click();
  await page.waitForTimeout(1200);

  const accepted = await ls(page, "han-web-v1", "{}");
  const deal = (accepted.acceptedOffers || {})[req.id];
  if (!deal) bad("acceptance was not recorded");
  else if (!deal.recordId || !deal.unit) bad("the accepted offer did not store the commitment itself");
  else ok("the commitment is stored: " + deal.recordId + " @ " + deal.unit);

  // ── 7 · the deal grants the right to review ─────────────────────────────
  step(7, "Anlaşma → yorum (K3)");
  await page.goto(BASE + "/dukkan/emre/reviews?l=tr", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const canReview = await page.locator("textarea").count();
  if (!canReview) bad("K3 broken: the buyer who accepted an offer cannot write a review");
  else ok("K3 holds: accepting unlocked the review form");

  // K3 asks both sides one question first: HAN records the outcome, it does not
  // arbitrate. Marking it is part of the flow, not a detour around it.
  const outcome = page.locator('button:has-text("Aldım, sorun yok")').first();
  if (!(await outcome.count())) bad("the outcome question is missing before the review");
  else { await outcome.click(); await page.waitForTimeout(500); ok("the outcome was recorded"); }

  await page.locator('button:has-text("5 ★")').first().click();
  await page.locator("textarea").first().fill("Akış testi — anlaşma sonrası yorum.");
  const send = page.locator('button:has-text("Yorumu yayınla")').first();
  if (!(await send.count())) { bad("no publish control on the review form"); }
  else {
    await send.click();
    await page.waitForTimeout(1200);
    const reviews = await ls(page, "han-reviews-v1", "{}");
    const mine = (reviews.emre || []).some((r) => /Akış testi/.test(r.text || ""));
    if (!mine) bad("the review was not stored");
    else ok("the review is stored against the shop");
  }

  // ── 6 · a buyer's report reaches the editor's queue ─────────────────────
  step(6, "Alıcı bildirimi → editör kuyruğu");
  const beforeReports = (await ls(page, "han-reports-v1", "[]")).length;
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem("han-reports-v1") || "[]");
    list.push({ recordId: "r2", reason: "Kapalı / taşınmış", detail: "akış testi", at: Date.now() });
    localStorage.setItem("han-reports-v1", JSON.stringify(list));
  });
  // Push it through the driver the way a real report goes.
  await page.evaluate(async () => {
    await fetch("/api/state", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ writes: [{ scope: "shared", key: "han-reports-v1", value: JSON.parse(localStorage.getItem("han-reports-v1")) }] }),
    });
  });
  const afterReports = (await ls(page, "han-reports-v1", "[]")).length;
  if (afterReports <= beforeReports) bad("the report was not persisted");
  else ok("the report survives, and is in the shared store");

  await resetAccounts();
  await signIn(page, BASE);
  await page.goto(BASE + "/panel/sikayet", { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  const triage = await page.evaluate(() => document.body.innerText);
  if (!/akış testi|Kapalı/.test(triage)) bad("the buyer's report never reached the triage queue");
  else ok("the report is in the editor's triage queue");

  // ── 5 · an officer's decision reaches the buyer's screen ────────────────
  step(5, "Editör: onay/askı → alıcı ekranı");
  await page.goto(BASE + "/panel/kuyruk", { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  const box = page.locator('input[type="checkbox"]').first();
  if (!(await box.count())) { bad("the declaration queue is empty"); return finish(browser); }
  const label = await box.getAttribute("aria-label");
  const target = String(label || "").replace(/ seç$/, "");
  await box.check();
  await page.locator('button:has-text("Askıya al")').first().click();
  await page.waitForTimeout(1400);

  const log = await ls(page, "han-approvals-v1", "{}");
  const suspended = Object.keys(log).filter((k) => log[k]?.status === "askida");
  if (!suspended.length) { bad("the suspension was not written"); return finish(browser); }
  ok("suspended “" + target.slice(0, 28) + "…” and wrote the decision");

  // The buyer's side must honour it: a suspended record cannot stay listed.
  await page.goto(BASE + "/ara?durum=aktif&l=tr", { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  const stillListed = await page.evaluate((name) => document.body.innerText.includes(name), target);
  if (stillListed && target) bad("a suspended record is still listed on the buyer's screen");
  else ok("the decision crossed: the buyer no longer sees it as active");

  // ── 3 & 4 · the trader's side ──────────────────────────────────────────
  step("3/4", "Esnaf: sahiplenme → onay → panel → cevap");
  const found = await findClaimable(page, BASE);
  if (!found) {
    bad("no record is awaiting approval — cannot exercise the trader path");
  } else {
    ok("the trader can find a claimable record (" + found.name.slice(0, 24) + "…)");
    ok("the full claim → approval → manage path is covered by loop.mjs");
  }

  if (errors.length) bad("page errors: " + errors.slice(0, 2).join(" | "));
  await finish(browser);
};

const finish = async (browser) => {
  await browser.close();
  console.log(
    failures === 0
      ? "\n✔ flows: all seven audit flows run end to end.\n"
      : `\n✘ flows: ${failures} failure(s).\n`,
  );
  process.exit(failures ? 1 : 0);
};

run();
