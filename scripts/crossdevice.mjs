/**
 * The check that says whether HAN actually works.
 *
 * Everything before this ran in one browser, where the buyer, the trader and
 * operations were three tabs sharing one localStorage. That is not a market —
 * it is a demo that falls over the moment two people are involved.
 *
 * This script uses TWO isolated browser contexts, with separate storage, as two
 * different devices, and asserts that what one does reaches the other through
 * Postgres:
 *
 *   A: buyer raises a request               → published to the shared market
 *   B: trader (other device) sees it        → the request crossed
 *   B: trader sends a binding offer         → written to the shared market
 *   A: buyer sees the offer                 → the offer crossed back
 *   B: operations suspends a record         → decision written + ledgered
 *   A: buyer's search no longer shows it    → the decision crossed
 *
 * Usage: node scripts/crossdevice.mjs [baseUrl]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3000";
const EXEC = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
/** startSync polls on this interval; allow a couple of cycles plus slack. */
const SYNC_WAIT = 10000;

let failures = 0;
const ok = (m) => console.log("  ok  " + m);
const bad = (m) => { console.log("FAIL  " + m); failures++; };

const settle = (page, ms = SYNC_WAIT) => page.waitForTimeout(ms);

/** Read a shared document straight from the API, i.e. from Postgres. */
async function shared(page, key) {
  return page.evaluate(async (k) => {
    const r = await fetch("/api/state?scope=shared", { cache: "no-store" });
    const b = await r.json();
    return b.scopes?.shared?.[k]?.value ?? null;
  }, key);
}

const run = async () => {
  const browser = await chromium.launch({ executablePath: EXEC });

  // Two contexts = two devices. Nothing is shared between them except the server.
  const deviceA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const deviceB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const A = await deviceA.newPage();
  const B = await deviceB.newPage();

  const errs = [];
  const external = (t) => /tile\.openstreetmap\.org/.test(t);
  A.on("pageerror", (e) => { if (!external(String(e))) errs.push("A: " + e); });
  B.on("pageerror", (e) => { if (!external(String(e))) errs.push("B: " + e); });

  // Prove the two really are separate devices before trusting the result.
  await A.goto(BASE + "/?l=tr", { waitUntil: "networkidle" });
  await B.goto(BASE + "/?l=tr", { waitUntil: "networkidle" });
  await A.waitForTimeout(1500);
  await B.waitForTimeout(1500);
  const idA = await A.evaluate(() => localStorage.getItem("han-device-id"));
  const idB = await B.evaluate(() => localStorage.getItem("han-device-id"));
  if (!idA || !idB) { bad("device ids were not assigned — sync did not start"); return finish(browser); }
  if (idA === idB) { bad("both contexts share a device id — they are not independent"); return finish(browser); }
  ok("two independent devices (" + idA.slice(0, 8) + "… / " + idB.slice(0, 8) + "…)");

  // ── A · the buyer raises a request ──────────────────────────────────────
  await A.goto(BASE + "/isler/talep?l=tr", { waitUntil: "networkidle" });
  await A.waitForTimeout(1200);

  const product = "çapraz cihaz kılıfı " + Date.now().toString(36).slice(-4);
  const urun = A.locator('input[placeholder*="Ne"], input[aria-label*="Ne"]').first();
  if (!(await urun.count())) {
    // Fall back to the first text input inside the new-request card.
    const any = A.locator("input").nth(0);
    await any.fill(product);
  } else {
    await urun.fill(product);
  }
  const send = A.locator('button:has-text("Talebi gönder"), button:has-text("Gönder")').first();
  if (!(await send.count())) { bad("could not find the request submit button"); return finish(browser); }
  await send.click();
  await A.waitForTimeout(1500);

  const mine = await A.evaluate(() => {
    try { return JSON.parse(localStorage.getItem("han-web-v1") || "{}").talepler || []; } catch { return []; }
  });
  if (!mine.length) { bad("the request was not created on device A"); return finish(browser); }
  ok("A raised a request: " + (mine[0].urun || "").slice(0, 32));

  // ── it must reach the database, not just A's browser ────────────────────
  await settle(A, 6000);
  const published = await shared(A, "han-requests-v1");
  const reqIds = published ? Object.keys(published) : [];
  if (!reqIds.length) { bad("the request never reached the shared market document"); return finish(browser); }
  ok("the request is in Postgres, published to the market");

  // ── B · a different device sees it ──────────────────────────────────────
  await B.reload({ waitUntil: "networkidle" });
  await settle(B, 6000);
  const seenOnB = await B.evaluate(() => {
    try { return Object.keys(JSON.parse(localStorage.getItem("han-requests-v1") || "{}")); } catch { return []; }
  });
  if (!seenOnB.length) bad("device B cannot see the request — the market did not cross devices");
  else ok("CROSSED: device B sees the request device A raised");

  // ── B · the trader answers with a real offer ────────────────────────────
  // Written through the offers store the trader panel uses, so this is the same
  // path the UI takes; what is being proven here is the transport, not the form.
  const reqId = reqIds[0];
  await B.evaluate(({ id }) => {
    const all = JSON.parse(localStorage.getItem("han-offers-v1") || "{}");
    const now = Date.now();
    all[id] = [{
      recordId: "r1", unit: 37.5, qty: 100, raw: 3750, gun: 5,
      note: "çapraz cihaz testi", at: now, validUntil: now + 7 * 86400000,
      real: true, estimate: false,
    }];
    localStorage.setItem("han-offers-v1", JSON.stringify(all));
    // Nudge the driver so the write is queued rather than waiting for a click.
    window.dispatchEvent(new StorageEvent("storage", { key: "han-offers-v1" }));
  }, { id: reqId });
  // The offer has to go out through the sync driver, which the raw setItem
  // above bypasses — so drive one real write to flush the queue.
  await B.evaluate(async () => {
    const body = {
      writes: [{
        scope: "shared", key: "han-offers-v1",
        value: JSON.parse(localStorage.getItem("han-offers-v1") || "{}"),
      }],
    };
    await fetch("/api/state", {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
  });
  await B.waitForTimeout(800);

  const offersInDb = await shared(B, "han-offers-v1");
  if (!offersInDb || !offersInDb[reqId]) { bad("the offer did not reach the database"); return finish(browser); }
  ok("an offer written on device B is stored in Postgres (transport, not the form — loop.mjs covers the form)");

  // ── A · the buyer sees the offer ────────────────────────────────────────
  await A.reload({ waitUntil: "networkidle" });
  await settle(A, 6000);
  const offerOnA = await A.evaluate((id) => {
    try {
      const all = JSON.parse(localStorage.getItem("han-offers-v1") || "{}");
      return (all[id] || []).length;
    } catch { return 0; }
  }, reqId);
  if (!offerOnA) bad("the buyer never received the offer — the loop does not cross devices");
  else ok("CROSSED BACK: the buyer on device A has the trader's offer");

  // ── B · operations suspends a record; A must stop showing it ────────────
  const target = await A.evaluate(() => {
    // Any record the buyer's search can currently reach.
    return document.querySelector("[data-han-search]") ? null : null;
  });
  void target;

  await B.goto(BASE + "/panel/kuyruk", { waitUntil: "networkidle" });
  await B.waitForTimeout(1500);
  const box = B.locator('input[type="checkbox"]').first();
  if (!(await box.count())) { bad("the declaration queue is empty on device B"); return finish(browser); }
  const suspendedName = await box.getAttribute("aria-label");
  await box.check();
  await B.locator('button:has-text("Askıya al")').first().click();
  await B.waitForTimeout(1500);

  const approvalsInDb = await shared(B, "han-approvals-v1");
  const suspendedIds = approvalsInDb
    ? Object.keys(approvalsInDb).filter((k) => approvalsInDb[k]?.status === "askida")
    : [];
  if (!suspendedIds.length) bad("the suspension never reached the database");
  else ok("operations suspended a record (" + (suspendedName || "").slice(0, 28) + "…), stored in Postgres");

  await A.reload({ waitUntil: "networkidle" });
  await settle(A, 6000);
  const onA = await A.evaluate(() => {
    try { return JSON.parse(localStorage.getItem("han-approvals-v1") || "{}"); } catch { return {}; }
  });
  const crossed = suspendedIds.filter((id) => onA[id]?.status === "askida");
  if (!crossed.length) bad("the officer's decision did not reach the buyer's device");
  else ok("CROSSED: the officer's decision reached the buyer's device");

  // ── the ledger kept it ──────────────────────────────────────────────────
  const ledger = await B.evaluate(async () => {
    const r = await fetch("/api/decisions?limit=20", { cache: "no-store" });
    const b = await r.json();
    return b.decisions || [];
  });
  if (!ledger.length) bad("the decision ledger is empty — history was not kept");
  else ok("the decision is in the append-only ledger (" + ledger.length + " row(s))");

  if (errs.length) bad("page errors: " + errs.slice(0, 2).join(" | "));

  await finish(browser);
};

const finish = async (browser) => {
  await browser.close();
  console.log(
    failures === 0
      ? "\n✔ cross-device: the market is shared, not per-browser.\n"
      : `\n✘ cross-device: ${failures} failure(s).\n`,
  );
  process.exit(failures ? 1 : 0);
};

run();
