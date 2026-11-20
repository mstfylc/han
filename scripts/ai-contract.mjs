/**
 * HAN 2.0 AI Contract, Hallucination Firewall & Rate-Limit Verification (8 checks).
 *
 * Tests:
 *   1. /api/ai/plan-intent
 *   2. /api/ai/visual-search (+ firewallVerified)
 *   3. /api/ai/scan-shop (4-language descriptions)
 *   4. /api/ai/translate-trade
 *   5. /api/ai/voice-search (Kademe 3: push-to-talk intent + verified SC.RECORDS doors)
 *   6. /api/ai/voice-catalog (Kademe 3: 4-language catalog draft + confirmedByTrader:false)
 *   7. Hallucination Firewall guarantee (zero suspended/empty-door records in voice/visual outputs)
 *   8. Per-IP Rate-limit guard (HTTP 429)
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
  console.log(`\nHAN 2.0 AI Contract (8 checks) -> ${BASE}\n`);

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
      ok("1. /api/ai/plan-intent -> tomorrow, start=11, hours=3, guestCount=150, budgetLimit=15000, occasion=dugun");
    } else {
      bad(`1. /api/ai/plan-intent mismatch: status=${status} parsed=${JSON.stringify(p)}`);
    }
  } catch (e) {
    bad("1. /api/ai/plan-intent failed: " + String(e));
  }

  // 2. POST /api/ai/visual-search
  let visualMatches = [];
  try {
    const { status, data } = await postJson(
      "/api/ai/visual-search",
      { hint: "silikon telefon kılıfı" },
      { "X-Forwarded-For": "10.99.99.12" },
    );
    visualMatches = Array.isArray(data?.matches) ? data.matches : [];
    const allReal = visualMatches.length > 0 && visualMatches.every((m) => Boolean(m?.recordId) && Boolean(String(m?.door || "").trim()));
    if (status === 200 && data?.ok === true && data?.firewallVerified === true && allReal) {
      ok(`2. /api/ai/visual-search -> ok:true, firewallVerified:true, ${visualMatches.length} verified matches`);
    } else {
      bad(`2. /api/ai/visual-search mismatch: status=${status} ok=${data?.ok} fw=${data?.firewallVerified} matches=${visualMatches.length}`);
    }
  } catch (e) {
    bad("2. /api/ai/visual-search failed: " + String(e));
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
      ok("3. /api/ai/scan-shop -> descTr, descEn, descRu, descAr all populated");
    } else {
      bad(`3. /api/ai/scan-shop mismatch: status=${status} draft=${JSON.stringify(d)}`);
    }
  } catch (e) {
    bad("3. /api/ai/scan-shop failed: " + String(e));
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
      ok("4. /api/ai/translate-trade -> translated & summary populated");
    } else {
      bad(`4. /api/ai/translate-trade mismatch: status=${status} result=${JSON.stringify(r)}`);
    }
  } catch (e) {
    bad("4. /api/ai/translate-trade failed: " + String(e));
  }

  // 5. POST /api/ai/voice-search (Kademe 3)
  let voiceMatches = [];
  try {
    const { status, data } = await postJson(
      "/api/ai/voice-search",
      { transcript: "Tahtakale'de 200 adet çelik kolye bijuteri toptan arıyorum", lang: "tr", mode: "ikisi" },
      { "X-Forwarded-For": "10.99.99.15" },
    );
    voiceMatches = Array.isArray(data?.matches) ? data.matches : [];
    const okIntent = data?.intent?.qty === 200 && data?.intent?.mode === "toptan" && data?.intent?.semt === "tahtakale";
    if (status === 200 && data?.ok === true && data?.firewallVerified === true && okIntent && voiceMatches.length > 0) {
      ok(`5. /api/ai/voice-search -> qty=200, mode=toptan, semt=tahtakale, ${voiceMatches.length} verified doors`);
    } else {
      bad(`5. /api/ai/voice-search mismatch: status=${status} intent=${JSON.stringify(data?.intent)} matches=${voiceMatches.length}`);
    }
  } catch (e) {
    bad("5. /api/ai/voice-search failed: " + String(e));
  }

  // 6. POST /api/ai/voice-catalog (Kademe 3)
  try {
    const { status, data } = await postJson(
      "/api/ai/voice-catalog",
      { text: "316L paslanmaz çelik kelepçe bileklik 140 TL en az 24 adet" },
      { "X-Forwarded-For": "10.99.99.16" },
    );
    const d = data?.draft || {};
    const all4 = Boolean(d.descTr?.trim()) && Boolean(d.descEn?.trim()) && Boolean(d.descRu?.trim()) && Boolean(d.descAr?.trim());
    if (status === 200 && data?.ok === true && all4 && d.confirmedByTrader === false && d.moq === 24) {
      ok("6. /api/ai/voice-catalog -> 4-language draft ready, moq=24, confirmedByTrader=false");
    } else {
      bad(`6. /api/ai/voice-catalog mismatch: status=${status} draft=${JSON.stringify(d)}`);
    }
  } catch (e) {
    bad("6. /api/ai/voice-catalog failed: " + String(e));
  }

  // 7. Hallucination Firewall Check across all returned cards
  try {
    const combined = [...visualMatches, ...voiceMatches];
    const clean =
      combined.length > 0 &&
      combined.every(
        (m) =>
          Boolean(m.recordId) &&
          Boolean(m.placeId) &&
          Boolean(String(m.door || "").trim()) &&
          m.status !== "askida",
      );
    if (clean) {
      ok(`7. Hallucination Firewall -> ${combined.length}/${combined.length} cards verified (0 suspended, 0 empty doors)`);
    } else {
      bad("7. Hallucination Firewall -> invalid or suspended card detected");
    }
  } catch (e) {
    bad("7. Hallucination Firewall check failed: " + String(e));
  }

  // 8. Rate-limit guard: 22 requests from X-Forwarded-For: 10.99.99.99 -> at least one 429
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
      ok(`8. Rate-limit guard -> received ${count429} HTTP 429 response(s) over 22 requests`);
    } else {
      bad("8. Rate-limit guard -> expected at least one HTTP 429 over 22 requests, got 0");
    }
  } catch (e) {
    bad("8. Rate-limit guard test failed: " + String(e));
  }

  console.log(
    failures === 0
      ? "\n✔ ai-contract: 8/8 checks passed.\n"
      : `\n✘ ai-contract: ${failures} failure(s).\n`,
  );
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("FAIL  unhandled error:", e);
  process.exit(1);
});
