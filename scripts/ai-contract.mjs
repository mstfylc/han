/**
 * HAN AI Contract & Rate-Limit Verification (zero external dependencies).
 *
 * Tests all 4 AI endpoints (/api/ai/plan-intent, /api/ai/visual-search,
 * /api/ai/scan-shop, /api/ai/translate-trade) plus per-IP rate limiting (429).
 *
 * Usage: node scripts/ai-contract.mjs [baseUrl]
 */

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/+$/, "");

let failures = 0;
const ok = (msg) => console.log("  ok  " + msg);
const bad = (msg) => {
  console.log("FAIL  " + msg);
  failures += 1;
};

async function postJson(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function main() {
  console.log(`\nHAN AI Contract -> ${BASE}\n`);

  // 1. POST /api/ai/plan-intent
  try {
    const { status, data } = await postJson(
      "/api/ai/plan-intent",
      { prompt: "Yarın 11'de 3 saatim var 150 kişilik nişan kutu ve havlu alacağım 15000 tl" },
      { "X-Forwarded-For": "10.99.99.11" },
    );
    const p = data?.parsed || {};
    const valid =
      status === 200 &&
      data?.ok === true &&
      p.day === "tomorrow" &&
      p.start === 11 &&
      p.hours === 3 &&
      p.guestCount === 150 &&
      p.budgetLimit === 15000 &&
      p.occasion === "dugun";
    if (valid) {
      ok("/api/ai/plan-intent -> tomorrow, start=11, hours=3, guestCount=150, budgetLimit=15000, occasion=dugun");
    } else {
      bad(`/api/ai/plan-intent mismatch: status=${status} parsed=${JSON.stringify(p)}`);
    }
  } catch (e) {
    bad("/api/ai/plan-intent failed: " + String(e));
  }

  // 2. POST /api/ai/visual-search
  try {
    const { status, data } = await postJson(
      "/api/ai/visual-search",
      { hint: "silikon telefon kılıfı" },
      { "X-Forwarded-For": "10.99.99.12" },
    );
    const matches = Array.isArray(data?.matches) ? data.matches : [];
    const allReal = matches.length > 0 && matches.every((m) => Boolean(m?.recordId) && Boolean(String(m?.door || "").trim()));
    if (status === 200 && data?.ok === true && allReal) {
      ok(`/api/ai/visual-search -> ok:true, ${matches.length} real matches with recordId & door`);
    } else {
      bad(`/api/ai/visual-search mismatch: status=${status} ok=${data?.ok} matches=${matches.length} allReal=${allReal}`);
    }
  } catch (e) {
    bad("/api/ai/visual-search failed: " + String(e));
  }

  // 3. POST /api/ai/scan-shop
  try {
    const { status, data } = await postJson(
      "/api/ai/scan-shop",
      { text: "Roza Bijuteri Santral Han No 8 0532 111 22 33" },
      { "X-Forwarded-For": "10.99.99.13" },
    );
    const d = data?.draft || {};
    const all4 = Boolean(d.descTr?.trim()) && Boolean(d.descEn?.trim()) && Boolean(d.descRu?.trim()) && Boolean(d.descAr?.trim());
    if (status === 200 && data?.ok === true && all4) {
      ok("/api/ai/scan-shop -> descTr, descEn, descRu, descAr all populated");
    } else {
      bad(`/api/ai/scan-shop mismatch: status=${status} draft=${JSON.stringify(d)}`);
    }
  } catch (e) {
    bad("/api/ai/scan-shop failed: " + String(e));
  }

  // 4. POST /api/ai/translate-trade
  try {
    const { status, data } = await postJson(
      "/api/ai/translate-trade",
      { text: "200 pcs silicone case wholesale shipping", targetLang: "tr" },
      { "X-Forwarded-For": "10.99.99.14" },
    );
    const r = data?.result || {};
    if (status === 200 && data?.ok === true && Boolean(r.translated?.trim()) && Boolean(r.summary?.trim())) {
      ok("/api/ai/translate-trade -> translated & summary populated");
    } else {
      bad(`/api/ai/translate-trade mismatch: status=${status} result=${JSON.stringify(r)}`);
    }
  } catch (e) {
    bad("/api/ai/translate-trade failed: " + String(e));
  }

  // 5. Rate-limit guard: 22 requests from X-Forwarded-For: 10.99.99.99 -> at least one 429
  try {
    let count429 = 0;
    for (let i = 0; i < 22; i += 1) {
      const { status } = await postJson(
        "/api/ai/translate-trade",
        { text: `wholesale test batch ${i}`, targetLang: "tr" },
        { "X-Forwarded-For": "10.99.99.99" },
      );
      if (status === 429) count429 += 1;
    }
    if (count429 >= 1) {
      ok(`Rate-limit guard -> received ${count429} HTTP 429 response(s) over 22 requests`);
    } else {
      bad("Rate-limit guard -> expected at least one HTTP 429 over 22 requests, got 0");
    }
  } catch (e) {
    bad("Rate-limit guard test failed: " + String(e));
  }

  console.log(
    failures === 0
      ? "\n✔ ai-contract: all checks passed.\n"
      : `\n✘ ai-contract: ${failures} failure(s).\n`,
  );
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("FAIL  unhandled error:", e);
  process.exit(1);
});
