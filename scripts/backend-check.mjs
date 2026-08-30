/**
 * Backend check: the auth and store contracts, exercised end to end against a
 * running server. Covers the promises the Giriş screen makes:
 *   · first-admin seed works only on an empty directory
 *   · reset codes are single-use and set the password server-side
 *   · wrong PINs count down and lock at five
 *   · the session is a cookie; /me answers with the user
 *   · protected store keys refuse writes without a session (after bootstrap)
 *   · KV writes survive and read back
 *
 * Usage: node scripts/backend-check.mjs [baseUrl]
 * NOTE: run against a THROWAWAY database (HAN_DB_DIR), not a live one — the
 * seed step only passes on an empty user directory.
 */

const BASE = process.argv[2] || "http://localhost:3000";
let failures = 0;
let cookie = "";

const ok = (name, cond, extra = "") => {
  if (cond) console.log("  ok  " + name);
  else { console.log("FAIL  " + name + (extra ? " — " + extra : "")); failures++; }
};

async function call(method, path, body, useCookie = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(useCookie && cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
}

const TEL = "5395550101";

// ── bootstrap ──────────────────────────────────────────────────────────────
let r = await call("GET", "/api/auth/me");
ok("me: kimse yok", r.json && r.json.user === null);
ok("me: noUsers=true (boş veritabanıyla koşulmalı)", r.json && r.json.noUsers === true,
  "kullanıcı zaten var — HAN_DB_DIR ile boş veritabanına karşı koşun");

// bootstrap mode: protected key writable with no session
r = await call("PUT", "/api/store", { key: "han-settings-v1", value: { probe: 1 } });
ok("bootstrap: korumalı anahtar oturumsuz yazılır", r.status === 200);

r = await call("PUT", "/api/store", { key: "definitely-not-han", value: 1 });
ok("store: yabancı anahtar reddedilir", r.status === 400);

// ── seed the first admin ───────────────────────────────────────────────────
r = await call("POST", "/api/auth/seed", { tel: TEL });
const code1 = r.json && r.json.demoCode;
ok("seed: ilk yönetici + kod", r.status === 200 && !!code1);

r = await call("POST", "/api/auth/seed", { tel: "5000000000" });
ok("seed: ikinci kez reddedilir", r.status === 409);

// ── reset flow ─────────────────────────────────────────────────────────────
r = await call("POST", "/api/auth/reset/apply", { code: code1, pin: "12" });
ok("reset: kısa şifre reddedilir", r.status === 400);

r = await call("POST", "/api/auth/reset/apply", { code: code1, pin: "4321" });
ok("reset: şifre kurulur ve oturum açılır", r.status === 200 && !!cookie);

r = await call("POST", "/api/auth/reset/apply", { code: code1, pin: "9999" });
ok("reset: kod ikinci kez geçmez", r.status === 400 && /bir kez/.test(r.json?.msg || ""));

r = await call("GET", "/api/auth/me");
ok("me: oturum kullanıcıyı tanır", r.json?.user?.role === "yonetici");
ok("me: pins haritası oturumla gelir", !!r.json?.pins);

// ── protected writes after bootstrap ───────────────────────────────────────
const saved = cookie;
cookie = "";
r = await call("PUT", "/api/store", { key: "han-settings-v1", value: { probe: 2 } }, false);
ok("store: kullanıcı varken korumalı anahtar oturumsuz REDDEDİLİR", r.status === 401);
r = await call("PUT", "/api/store", { key: "han-web-v1", value: { probe: "buyer" } }, false);
ok("store: alıcı anahtarı oturumsuz yazılır", r.status === 200);
cookie = saved;

r = await call("PUT", "/api/store", { key: "han-settings-v1", value: { probe: 3 } });
ok("store: oturumla korumalı anahtar yazılır", r.status === 200);

r = await call("GET", "/api/store");
ok("store: yazılan geri okunur", r.json?.stores?.["han-settings-v1"]?.probe === 3 &&
  r.json?.stores?.["han-web-v1"]?.probe === "buyer");

// ── lockout ────────────────────────────────────────────────────────────────
await call("POST", "/api/auth/logout");
for (let i = 0; i < 5; i++) r = await call("POST", "/api/auth/login", { tel: TEL, pin: "0000" });
ok("login: beş hatada sayaç dolar", r.status === 401 && /Kalan deneme: 0/.test(r.json?.msg || ""));
r = await call("POST", "/api/auth/login", { tel: TEL, pin: "4321" });
ok("login: kilitliyken doğru şifre de girmez", r.status === 401 && r.json?.err === "kilit");

// reset unlocks
r = await call("POST", "/api/auth/reset/request", { tel: TEL });
const code2 = r.json?.demoCode;
ok("reset: kilitli hesaba kod üretilir", !!code2);
r = await call("POST", "/api/auth/reset/apply", { code: code2, pin: "7777" });
ok("reset: kilidi açar", r.status === 200);
r = await call("POST", "/api/auth/login", { tel: TEL, pin: "7777" });
ok("login: yeni şifreyle girer", r.status === 200 && r.json?.user?.name);

// privacy: unknown phone gets the same shaped answer
r = await call("POST", "/api/auth/reset/request", { tel: "5001112233" });
ok("reset: kayıtsız telefon aynı cevabı alır (kod yok)", r.status === 200 && r.json?.ok === true && !r.json?.demoCode);

console.log(failures ? "\n✖ backend: " + failures + " failure(s)" : "\n✔ backend: all checks clean.");
process.exit(failures ? 1 : 0);
