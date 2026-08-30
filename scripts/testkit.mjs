/**
 * Shared setup for the end-to-end scripts.
 *
 * Two things changed once state became durable and shared, and both broke
 * assumptions the earlier harnesses were built on:
 *
 *   · The operations panel now needs a session, so a script that drives it has
 *     to sign in like a person would.
 *   · Every run leaves its decisions in the database. A test that assumed a
 *     particular place still had unapproved records was really assuming a
 *     virgin database, and started failing the moment a previous run approved
 *     them. Tests have to find their own subject rather than assume one.
 */
import pg from "pg";

/** Only ever point this at a local database. Truncating accounts is not the
 *  sort of thing that should be one typo away from production. */
function assertLocal(url) {
  if (!url) throw new Error("DATABASE_URL is not set");
  const local = /@(localhost|127\.0\.0\.1)/.test(url) || /host=(localhost|\/tmp)/.test(url);
  if (!local) throw new Error("refusing to touch a non-local database: " + url.replace(/:[^:@]*@/, ":***@"));
}

export async function resetAccounts() {
  const url = process.env.DATABASE_URL;
  assertLocal(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("TRUNCATE ops_sessions, ops_resets, ops_users CASCADE");
  await client.end();
}

/** Clear the market's own documents, so a run starts from the seeded bazaar
 *  rather than from whatever the last run decided. */
export async function resetMarket() {
  const url = process.env.DATABASE_URL;
  assertLocal(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("TRUNCATE documents, decisions");
  await client.end();
}

const TEL = "0555 000 11 22";
const PIN = "4242";

/**
 * Sign the page in as an administrator.
 *
 * Uses the real endpoints — bootstrap the first account, set a password with
 * the emailed-in-real-life code, then hold the session cookie — so the scripts
 * exercise the same path a person walks, not a back door.
 */
export async function signIn(page, base) {
  await page.goto(base + "/giris", { waitUntil: "domcontentloaded" });
  const call = (payload) =>
    page.evaluate(async (p) => {
      const r = await fetch("/api/auth", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p),
      });
      return r.json();
    }, payload);

  const asked = await call({ action: "reset", tel: TEL, name: "Test Yönetici" });
  if (!asked.devCode) {
    throw new Error(
      "no reset code returned — these scripts need a development server " +
      "(scripts/serve-dev.sh) with HAN_DEV_SHOW_RESET_CODE=1",
    );
  }
  const applied = await call({ action: "apply", code: asked.devCode, pin: PIN });
  if (!applied.ok) throw new Error("could not sign in for the test");
  return applied.user;
}

/**
 * Find a place that still has a record awaiting approval, and return both.
 *
 * Iterates the finder's own options instead of trusting the first one: after a
 * few runs the obvious places are fully approved, and "the first place is
 * empty" is not the same as "there is nothing to test".
 */
export async function findClaimable(page, base, lang = "tr") {
  await page.goto(base + "/esnaf?l=" + lang, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const PLACE_SEL = 'select[aria-label="Yer"]';
  const places = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return [];
    return Array.from(el.options).map((o) => o.value).filter((v) => v && v !== "all");
  }, PLACE_SEL);

  for (const placeId of places) {
    await page.selectOption(PLACE_SEL, placeId);
    await page.waitForTimeout(450);
    const btn = page
      .locator('div:has(> span > span:text-is("Esnaf beyanı · onay bekliyor")) button:has-text("Bu benim")')
      .first();
    if (await btn.count()) {
      const name = await btn.evaluate((b) => {
        const row = b.closest("div");
        const n = row?.querySelector("span > span");
        return n ? (n.textContent || "").trim() : "";
      });
      return { placeId, name, button: btn };
    }
  }
  return null;
}
