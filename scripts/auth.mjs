/**
 * Sign-in checks — the ones that matter are the ones that must FAIL.
 *
 * The prototype's login was a UI fixture: the PIN sat in localStorage, so the
 * attempt counter was the client's to reset and the "code sent to your phone"
 * could be read instead of received. This asserts the replacement actually
 * behaves like authentication:
 *
 *   · the PIN is never returned, in any shape, by any endpoint
 *   · the session cookie is httpOnly, so page script cannot read it
 *   · a wrong password is refused, and repeated attempts lock the account
 *   · the lockout is the server's — clearing browser storage does not lift it
 *   · a reset code is single-use and cannot be replayed
 *   · the reset endpoint answers identically for a number that does not exist,
 *     so it cannot be used to discover who has an account
 *   · setting a new password ends other sessions
 *   · /panel is not reachable without signing in
 *
 * Usage: node scripts/auth.mjs [baseUrl]
 */
import { launch } from "./testkit.mjs";
import pg from "pg";

// Development mode by default: the reset code is only returned there, which is
// itself the guard this script also checks against the production server.
const BASE = process.argv[2] || "http://localhost:3001";
const PROD = process.env.HAN_PROD_URL || "http://localhost:3000";

let failures = 0;
const ok = (m) => console.log("  ok  " + m);
const bad = (m) => { console.log("FAIL  " + m); failures++; };

const TEL = "0555 " + String(Date.now()).slice(-7);
const PIN = "8412";

const api = async (page, payload) =>
  page.evaluate(async (p) => {
    const r = await fetch("/api/auth", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p),
    });
    return { status: r.status, body: await r.json() };
  }, payload);

/**
 * Start from an empty accounts table.
 *
 * The bootstrap path — "the first person at an empty deployment becomes the
 * administrator" — is deliberately dead once anyone exists, so without this the
 * test cannot create the account it needs. Refuses to touch anything that is
 * not obviously a local database, because a script that truncates user accounts
 * should be impossible to point at production by accident.
 */
async function resetAccounts() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!/@(localhost|127\.0\.0\.1|\/tmp)/.test(url) && !/host=(localhost|\/tmp)/.test(url)) {
    throw new Error("refusing to reset accounts on a non-local database: " + url.replace(/:[^:@]*@/, ":***@"));
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("TRUNCATE ops_sessions, ops_resets, ops_users CASCADE");
  await client.end();
}

const run = async () => {
  try {
    await resetAccounts();
    ok("accounts table reset — testing the bootstrap path from empty");
  } catch (e) {
    bad("could not reset accounts: " + e.message);
    process.exit(1);
  }
  const browser = await launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + "/giris", { waitUntil: "networkidle" });

  // ── open an account and set a password ──────────────────────────────────
  const asked = await api(page, { action: "reset", tel: TEL, name: "Test Yetkili" });
  if (!asked.body.ok) { bad("could not request a reset code"); return finish(browser); }
  const code = asked.body.devCode;
  if (!code) {
    bad("no dev code returned by " + BASE + " — run scripts/serve-dev.sh and set HAN_DEV_SHOW_RESET_CODE=1");
    return finish(browser);
  }
  ok("reset code issued for " + asked.body.masked);

  // The same request against the PRODUCTION build must not hand the code out:
  // without a delivery channel, returning it would mean anyone who knows a
  // phone number can take the account.
  try {
    const prodPage = await ctx.newPage();
    await prodPage.goto(PROD + "/giris", { waitUntil: "domcontentloaded", timeout: 8000 });
    const prod = await api(prodPage, { action: "reset", tel: TEL });
    if (prod.body.devCode) bad("the production build returned a reset code over the wire");
    else ok("the production build refuses to return the code");
    await prodPage.close();
  } catch {
    bad("could not reach the production build at " + PROD + " to check the code is withheld");
  }

  // The masked number must not be the full number.
  if (String(asked.body.masked).replace(/\D/g, "").length >= TEL.replace(/\D/g, "").length) {
    bad("the masked number is not actually masked");
  } else ok("the number comes back masked, not in full");

  const applied = await api(page, { action: "apply", code, pin: PIN });
  if (!applied.body.ok) { bad("could not set the password"); return finish(browser); }
  ok("password set and signed in");

  // ── the secret must not be reachable from the browser ───────────────────
  const meRaw = await page.evaluate(async () => {
    const r = await fetch("/api/auth", { cache: "no-store" });
    return JSON.stringify(await r.json());
  });
  if (/pin|hash|scrypt/i.test(meRaw)) bad("an auth endpoint returned something password-shaped: " + meRaw.slice(0, 120));
  else ok("no password material is exposed by /api/auth");

  const readable = await page.evaluate(() => document.cookie);
  if (/han_ops/.test(readable)) bad("the session cookie is readable by page script — it is not httpOnly");
  else ok("the session cookie is httpOnly: page script cannot read it");

  const inStorage = await page.evaluate(() =>
    JSON.stringify(Object.entries(localStorage).filter(([k]) => /auth|pin|session/i.test(k))));
  if (/scrypt|pins/i.test(inStorage)) bad("password material is sitting in localStorage: " + inStorage.slice(0, 120));
  else ok("no password material in localStorage");

  // ── a single-use code really is single use ──────────────────────────────
  const replay = await api(page, { action: "apply", code, pin: "9999" });
  if (replay.body.ok) bad("a used reset code was accepted a second time");
  else ok("a used reset code is refused");

  // ── wrong password, then lockout, enforced server-side ──────────────────
  await api(page, { action: "logout" });
  const wrong = await api(page, { action: "login", tel: TEL, pin: "0000" });
  if (wrong.body.ok) bad("a wrong password was accepted");
  else ok("a wrong password is refused (" + wrong.body.reason + ", " + wrong.body.left + " left)");

  for (let i = 0; i < 5; i++) await api(page, { action: "login", tel: TEL, pin: "0000" });
  // Wipe every trace on the client: if the limit were the browser's, this lifts it.
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  const afterWipe = await api(page, { action: "login", tel: TEL, pin: PIN });
  if (afterWipe.body.ok) {
    bad("clearing browser storage lifted the lockout — the limit is not the server's");
  } else if (afterWipe.body.reason === "locked") {
    ok("locked out, and clearing browser storage does not lift it");
  } else {
    bad("expected a lockout after repeated failures, got: " + afterWipe.body.reason);
  }

  // ── the reset endpoint must not reveal who has an account ───────────────
  const known = await api(page, { action: "reset", tel: TEL });
  const unknown = await api(page, { action: "reset", tel: "0500 000 00 00" });
  const shape = (b) => JSON.stringify({ ok: b.ok, hasMasked: !!b.masked, ttl: b.ttl });
  if (shape(known.body) !== shape(unknown.body)) {
    bad("a registered and an unregistered number give different answers: " + shape(known.body) + " vs " + shape(unknown.body));
  } else ok("registered and unregistered numbers answer identically");

  // ── a new password ends other sessions ──────────────────────────────────
  const other = await ctx.browser().newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(BASE + "/giris", { waitUntil: "networkidle" });
  const fresh = await api(otherPage, { action: "reset", tel: TEL });
  const applied2 = await api(otherPage, { action: "apply", code: fresh.body.devCode, pin: "5150" });
  if (!applied2.body.ok) { bad("could not reset the password a second time"); return finish(browser); }

  const stillIn = await page.evaluate(async () => {
    const r = await fetch("/api/auth", { cache: "no-store" });
    return (await r.json()).user;
  });
  if (stillIn) bad("the old session survived a password reset");
  else ok("resetting the password ended the other session");

  // ── the delivery channel ────────────────────────────────────────────────
  //
  // Refusing to return the code in production was correct and also a dead end:
  // a real deployment could not create its second user, because nobody could
  // ever receive their code. What matters now is that the response says
  // truthfully whether a channel exists, so the screen does not promise an SMS
  // that is not coming.
  if (typeof asked.body.delivered !== "boolean") {
    bad("the reset response does not say whether a channel is configured");
  } else {
    ok("the reset response states delivery honestly (delivered=" + asked.body.delivered + ")");
  }

  // Whether a channel exists must be the SAME answer for a registered and an
  // unregistered number, or it becomes another way to probe for accounts.
  const unknownDelivery = await api(page, { action: "reset", tel: "0500 111 22 33" });
  if (unknownDelivery.body.delivered !== asked.body.delivered) {
    bad("delivery status differs between a registered and an unregistered number");
  } else {
    ok("delivery status is identical for known and unknown numbers");
  }

  // ── the WRITE path, not just the menu ───────────────────────────────────
  //
  // Hiding a tab from a role is usability. What decides whether a decision can
  // be forged is the endpoint, so it is checked directly rather than through
  // the UI that is supposed to prevent reaching it.
  const anon = await ctx.browser().newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(BASE + "/", { waitUntil: "domcontentloaded" });

  const write = (page, key, value) =>
    page.evaluate(async ({ k, v }) => {
      const r = await fetch("/api/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ writes: [{ scope: "shared", key: k, value: v }] }),
      });
      const b = await r.json();
      return b.results["shared/" + k];
    }, { k: key, v: value });

  const forged = await write(anonPage, "han-approvals-v1", {
    "r1": { status: "onayli", via: "han", officer: null, at: Date.now() },
  });
  if (forged?.ok) bad("an anonymous request approved a record — the write path is open");
  else ok("an anonymous request cannot approve a record (" + forged?.reason + ")");

  const forgedUsers = await write(anonPage, "han-users-v1", [{ id: "x", role: "yonetici" }]);
  if (forgedUsers?.ok) bad("an anonymous request rewrote the operations team");
  else ok("an anonymous request cannot rewrite the team (" + forgedUsers?.reason + ")");

  // ...but the market itself must stay open, or there is no bazaar.
  const publicWrite = await write(anonPage, "han-reports-v1", [
    { recordId: "r1", reason: "test", at: Date.now() },
  ]);
  if (!publicWrite?.ok) bad("an anonymous buyer could not file a report — the market is over-locked");
  else ok("an anonymous buyer can still report a record");
  await anonPage.close();

  // ── the panel is not reachable while signed out ─────────────────────────
  const signedOut = await ctx.browser().newContext();
  const p3 = await signedOut.newPage();
  await p3.goto(BASE + "/panel/kuyruk", { waitUntil: "networkidle" });
  await p3.waitForTimeout(1500);
  if (!/\/giris/.test(p3.url())) bad("the panel rendered without a session (" + p3.url() + ")");
  else ok("an anonymous visitor is sent to sign in");

  await finish(browser);
};

const finish = async (browser) => {
  await browser.close();
  console.log(failures === 0 ? "\n✔ auth: sign-in behaves like authentication.\n" : `\n✘ auth: ${failures} failure(s).\n`);
  process.exit(failures ? 1 : 0);
};

run();
