/**
 * End-to-end check for the decision loop the audit found broken.
 *
 * The buyer surface READ `han-approvals-v1` but nothing WROTE it, so a trader
 * could claim a record and it would sit at "bekliyor" for ever: /esnaf/yonet was
 * unreachable and the trust ladder never moved. This script drives the whole
 * path through the real UI and fails if any link is still open.
 *
 *   1. trader claims a record on /esnaf            → claim recorded, "bekliyor"
 *   2. panel approves the CLAIM on /panel          → E1: the record's own status
 *                                                    must NOT change
 *   3. panel approves the RECORD in the queue      → E3: with grounds + officer
 *   4. trader signs in and reaches /esnaf/yonet    → the loop is closed
 *   5. the decision shows up in the audit ledger   → E2/E3: it survived and is
 *                                                    attributable
 *
 * Usage: node scripts/loop.mjs [baseUrl]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3000";
const EXEC = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const OWNER = "Mustafa Yalçın";
const TEL = "0532 111 22 33";
const DEMO_CODE = "1234";

let failures = 0;
const ok = (m) => console.log("  ok  " + m);
const bad = (m) => { console.log("FAIL  " + m); failures++; };

const run = async () => {
  const browser = await chromium.launch({ executablePath: EXEC });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const external = (t) => /tile\.openstreetmap\.org/.test(t);
  page.on("pageerror", (e) => { if (!external(String(e))) errors.push(String(e)); });

  // ── 1 · the trader claims a record ──────────────────────────────────────
  // Pick a place with declared records so the finder has something to show.
  await page.goto(BASE + "/esnaf?l=tr", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // Target the finder's own select by its label: the buyer shell's header also
  // has selects (mode, currency, language), and the first one on the page is
  // the buying mode, not the place.
  const PLACE_SEL = 'select[aria-label="Yer"]';
  const placeId = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const opt = Array.from(el.options).find((o) => o.value && o.value !== "all");
    return opt ? opt.value : null;
  }, PLACE_SEL);
  if (!placeId) return bad("finder has no places to choose"), finish(browser);

  await page.selectOption(PLACE_SEL, placeId);
  await page.waitForTimeout(600);

  // The record has to be one the declaration queue will actually show, i.e. in
  // "beyan" status — otherwise step 4 silently tests nothing. The finder lists
  // every status, so pick by the badge the row carries.
  const claimBtn = page
    .locator('div:has(> span > span:text-is("Esnaf beyanı · onay bekliyor")) button:has-text("Bu benim")')
    .first();
  if (!(await claimBtn.count())) {
    bad("no record in " + placeId + " is awaiting approval — nothing to drive the loop with");
    return finish(browser);
  }
  const recordName = await claimBtn.evaluate((btn) => {
    const row = btn.closest("div");
    const name = row?.querySelector("span > span");
    return name ? (name.textContent || "").trim() : "";
  });
  await claimBtn.click();
  await page.waitForTimeout(500);
  ok("trader opened the claim form" + (recordName ? " (" + recordName.trim().slice(0, 24) + "…)" : ""));

  const inputs = page.locator('input[type="text"], input:not([type])');
  await inputs.nth(0).fill(OWNER);
  await inputs.nth(1).fill(TEL);
  await page.locator('button:has-text("Onaya gönder")').first().click();
  await page.waitForTimeout(700);

  // Find OUR claim, by the record we actually clicked. Taking Object.keys()[0]
  // was only ever right on a virgin database; now that state is durable and
  // shared, that picked up somebody else's older claim and reported its status
  // as ours.
  const claim = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem("han-claims-v1") || "{}"); } catch { return {}; }
  });
  const recId = Object.keys(claim).find((id) => (claim[id]?.name || "") === recordName);
  if (!recId) { bad("claim for " + recordName + " was not recorded"); return finish(browser); }
  if (claim[recId].status !== "bekliyor") bad('a new claim must start at "bekliyor", got ' + claim[recId].status);
  else ok("claim recorded and waiting for an officer");

  // Baseline, not emptiness. The approval log legitimately carries earlier
  // decisions; what must be true is that OUR claim has not been decided yet.
  const before = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem("han-approvals-v1") || "{}"); } catch { return {}; }
  });
  if (before[recId]) bad("this record already carries a decision — cannot test the transition");
  else ok("no decision has been made about this record yet");

  // ── 2 · the panel approves the CLAIM (E1) ───────────────────────────────
  await page.goto(BASE + "/panel/sahiplenme", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  const approveClaim = page.locator('button:has-text("Sahiplenmeyi onayla")').first();
  if (!(await approveClaim.count())) { bad("the claim did not reach the panel queue"); return finish(browser); }
  await approveClaim.click();
  await page.waitForTimeout(600);

  const afterClaim = await page.evaluate(() => ({
    claims: JSON.parse(localStorage.getItem("han-claims-v1") || "{}"),
    approvals: JSON.parse(localStorage.getItem("han-approvals-v1") || "{}"),
  }));
  if (afterClaim.claims[recId]?.status !== "onayli") bad("claim was not approved");
  else ok("panel approved the claim");

  // E1 is the point of this assertion: approving WHO owns the shop must not
  // silently also vouch for WHAT the record says. Compared against the baseline
  // so unrelated earlier decisions do not read as a violation.
  if (afterClaim.approvals[recId] && !before[recId]) {
    bad("E1 violated: approving the claim also decided the record's status");
  } else {
    ok("E1 holds: the record's own status is untouched");
  }

  // ── 3 · the panel approves the RECORD (E3) ──────────────────────────────
  await page.goto(BASE + "/panel/kuyruk", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  // Choose grounds and an officer, so the decision is attributable.
  const sahaRadio = page.locator('[role="radio"]:has-text("Saha turunda")').first();
  if (await sahaRadio.count()) await sahaRadio.click();
  const officerSel = page.locator("select").last();
  const officerId = await officerSel.evaluate((el) => {
    const o = Array.from(el.options).find((x) => x.value);
    return o ? o.value : "";
  });
  if (officerId) await officerSel.selectOption(officerId);

  const row = page.locator('input[type="checkbox"]').first();
  if (!(await row.count())) { bad("the declaration queue is empty"); return finish(browser); }

  // Tick the claimed record specifically. The row renders the record's NAME,
  // never its id, so match on that — matching on the id silently fell through
  // to row 0 and made the decisive assertion below untestable.
  const idx = await page.evaluate((label) => {
    const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    return boxes.findIndex((b) => (b.getAttribute("aria-label") || "").startsWith(label));
  }, recordName);
  if (idx < 0) {
    bad("the claimed record (" + recordName + ") is not in the declaration queue");
    return finish(browser);
  }
  await page.locator('input[type="checkbox"]').nth(idx).check();
  await page.locator('button:has-text("Seçileni onayla")').first().click();
  await page.waitForTimeout(700);

  const log = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem("han-approvals-v1") || "{}"); } catch { return {}; }
  });
  const decidedIds = Object.keys(log);
  if (!decidedIds.length) { bad("record approval was not written to han-approvals-v1"); return finish(browser); }
  ok("record decision written to the approval log");

  const dec = log[decidedIds[0]];
  if (!dec.via) bad("E3 violated: the decision carries no grounds");
  else if (!dec.at) bad("E3 violated: the decision carries no timestamp");
  else ok("E3 holds: decision carries grounds (" + dec.via + ") and a timestamp");

  // ── 4 · the trader can now manage the record ────────────────────────────
  // Only meaningful if the record we approved is the claimed one.
  if (!log[recId]) {
    bad("the approved row was not the claimed record — the decisive check could not run");
  } else {
    await page.goto(BASE + "/esnaf/yonet", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    const telInput = page.locator('input[inputmode="tel"]').first();
    if (!(await telInput.count())) {
      bad("the sign-in form did not appear for an approved claim");
    } else {
      await telInput.fill(TEL);
      await page.locator('input[inputmode="numeric"]').first().fill(DEMO_CODE);
      await page.locator('button:has-text("Giriş yap")').first().click();
      await page.waitForTimeout(800);

      const body = await page.evaluate(() => document.body.innerText);
      if (/Ne satıyorsunuz|Size gelen talepler/.test(body)) {
        ok("LOOP CLOSED: the trader reached the record management screen");
      } else {
        bad("the trader still cannot manage the record after approval");
      }
    }
  }

  // ── 5 · the decision is attributable afterwards ─────────────────────────
  await page.goto(BASE + "/panel/defter", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const ledger = await page.evaluate(() => document.body.innerText);
  if (/Henüz karar yok/.test(ledger)) bad("the audit ledger is empty after a decision was made");
  else ok("the decision is visible in the audit ledger");

  if (errors.length) bad("page errors: " + errors.slice(0, 2).join(" | "));

  await finish(browser);
};

const finish = async (browser) => {
  await browser.close();
  console.log(failures === 0 ? "\n✔ loop: the decision path is closed end to end.\n" : `\n✘ loop: ${failures} failure(s).\n`);
  process.exit(failures ? 1 : 0);
};

run();
