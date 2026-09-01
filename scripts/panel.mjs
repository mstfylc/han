/**
 * Every operations tab must actually work.
 *
 * The nav used to mark unwritten tabs "YAKINDA", which was honest. Now that the
 * label is gone, every tab claims to be real, and a tab that renders an empty
 * shell or throws is worse than one that admits it is not built. So this walks
 * all of them and asserts each one renders its own heading, produces no page
 * error, and leaks nothing.
 *
 * It also checks the two rules the panel is supposed to enforce about ITSELF:
 *   · a read-only role sees the queues but gets no action buttons
 *   · a role without a permission cannot reach that tab at all
 *
 * Usage: node scripts/panel.mjs [baseUrl]
 */
import pg from "pg";

import { launch, resetAccounts, signIn } from "./testkit.mjs";

const BASE = process.argv[2] || "http://localhost:3001";

let failures = 0;
const ok = (m) => console.log("  ok  " + m);
const bad = (m) => { console.log("FAIL  " + m); failures++; };

/** Each tab, and a phrase that only its own screen renders. */
const TABS = [
  ["ozet", "Özet"],
  ["sahiplenme", "Sahiplenme talepleri"],
  ["kuyruk", "Beyan kuyruğu"],
  ["toplu", "Toplu onay"],
  ["sikayet", "Şikayet triyajı"],
  ["askidakiler", "Askıdaki kayıtlar"],
  ["defter", "Karar defteri"],
  ["kayitlar", "Mağaza kayıtları"],
  ["talepler", "Alıcı talepleri"],
  ["teklifler", "Teklif denetimi"],
  ["yorumlar", "Yorum denetimi"],
  ["alicilar", "Alıcı doğrulama"],
  ["kapsama", "Kapsama"],
  ["yerler", "Yerler"],
  ["gorevler", "Saha görevleri"],
  ["kalite", "Veri kalitesi"],
  ["iceaktar", "Toplu içe aktarma"],
  ["yetkililer", "Yetkililer"],
  ["sponsorluk", "Sponsorluk"],
  ["sozluk", "Arama sözlüğü"],
  ["icerik", "Etkinlik & kampanya"],
];

const LEAKS = [
  { re: /\bundefined\b/, why: "the word 'undefined'" },
  { re: /\bNaN\b/, why: "NaN" },
  { re: /\[object Object\]/, why: "[object Object]" },
  { re: /YAKINDA/, why: "a 'coming soon' label on a tab that claims to be built" },
];

async function setRole(role) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("UPDATE ops_users SET role = $1", [role]);
  await client.end();
}

const run = async () => {
  await resetAccounts();
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  const errors = [];
  const external = (t) => /tile\.openstreetmap\.org/.test(t);
  page.on("pageerror", (e) => { if (!external(String(e))) errors.push(String(e)); });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const txt = m.text();
    if (!external(txt) && !external((m.location() || {}).url || "")) errors.push(txt);
  });

  await signIn(page, BASE);
  ok("signed in as an administrator");

  for (const [id, heading] of TABS) {
    errors.length = 0;
    await page.goto(BASE + "/panel/" + id, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);

    const text = await page.evaluate(() => document.body.innerText);
    const problems = [];
    if (!text.includes(heading)) problems.push('did not render its own heading "' + heading + '"');
    if (text.trim().length < 80) problems.push("rendered almost nothing");
    LEAKS.forEach(({ re, why }) => { if (re.test(text)) problems.push(why); });
    if (errors.length) problems.push("console: " + errors.slice(0, 2).join(" | "));

    if (problems.length) bad("/panel/" + id + " — " + problems.join("; "));
    else ok("/panel/" + id);
  }

  // ── a read-only role must not be offered actions ────────────────────────
  await setRole("okuma");
  await page.goto(BASE + "/panel/kuyruk", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const ro = await page.evaluate(() => document.body.innerText);
  if (!/Salt okuma/.test(ro)) bad("a read-only role is not labelled as such");
  else ok("a read-only role is labelled in the header");

  const approveEnabled = await page
    .locator('button:has-text("Seçileni onayla")')
    .first()
    .isEnabled()
    .catch(() => false);
  if (approveEnabled) bad("a read-only role was offered a working approve button");
  else ok("a read-only role cannot approve");

  // ── a role without a permission cannot reach the tab ────────────────────
  // "okuma" has no `yetkililer` permission, so the team screen must refuse
  // rather than render and then fail on write.
  await page.goto(BASE + "/panel/yetkililer", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const gated = await page.evaluate(() => document.body.innerText);
  if (/Bu bölüm rolünüzde yok/.test(gated)) ok("a role without the permission is refused the tab");
  else bad("the team screen rendered for a role that has no permission for it");

  await browser.close();
  console.log(failures === 0 ? "\n✔ panel: every tab renders and the role rules hold.\n" : `\n✘ panel: ${failures} failure(s).\n`);
  process.exit(failures ? 1 : 0);
};

run();
