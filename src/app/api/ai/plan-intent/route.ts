import { NextResponse } from "next/server";

import { callGeminiJson, checkAiRateLimit, clientIp, getCached, setCached } from "@/server/ai";

export const dynamic = "force-dynamic";

export interface ParsedPlanIntent {
  day: "today" | "tomorrow" | "weekend";
  start: number;
  hours: number;
  intent: "gez" | "is" | "etkinlik";
  occasion?: "dugun" | "mevlut" | "butik" | "kultur";
  guestCount?: number;
  budgetLimit?: number;
  carry: "el" | "araba" | "kargo";
  items: { name: string; qty: string; target: string }[];
  explanationTr: string;
}

function deterministicParseIntent(prompt: string): ParsedPlanIntent {
  const low = prompt.toLocaleLowerCase("tr");

  const day: ParsedPlanIntent["day"] = /yarın|yarin|tomorrow|завтра|غد/.test(low)
    ? "tomorrow"
    : /hafta\s*sonu|cumartesi|pazar|weekend/.test(low)
      ? "weekend"
      : "today";

  // Start hour: "saat 11", "11'de", "10:30"
  const startMatch = low.match(/(?:saat\s*|^|\s)(9|10|11|12|13|14|15|16)(?:[:']|(?:\s*da|\s*de|\s*te|\s*ta))?/);
  let start = 10;
  if (startMatch) {
    const h = Number(startMatch[1]);
    if (h >= 9 && h <= 16) start = h;
  }

  // Duration hours: "3 saat", "4 saatim"
  const hoursMatch = low.match(/(\d)\s*(?:saat|hour|h\b|ч)/);
  const hours = hoursMatch ? Math.max(2, Math.min(6, Number(hoursMatch[1]))) : 3;

  // Guest count: "150 kişilik", "200 davetli"
  const guestMatch = low.match(/(\d{2,4})\s*(?:kişi|kisi|kişilik|kisilik|davetli|guest|misafir)/);
  const guestCount = guestMatch ? Number(guestMatch[1]) : undefined;

  // Budget: "15 bin tl", "15000 tl", "15.000 ₺"
  let budgetLimit: number | undefined;
  const binMatch = low.match(/(\d{1,3})\s*bin\s*(?:tl|₺|lira)?/);
  const numBudgetMatch = low.match(/(\d{1,3}(?:[.,]\d{3})+|\d{4,6})\s*(?:tl|₺|lira|bütçe|butce)/);
  if (binMatch) budgetLimit = Number(binMatch[1]) * 1000;
  else if (numBudgetMatch) budgetLimit = Number(numBudgetMatch[1].replace(/[.,]/g, ""));

  let occasion: ParsedPlanIntent["occasion"];
  let intent: ParsedPlanIntent["intent"] = "gez";

  if (/nişan|nisan|söz|soz|düğün|dugun|kına|kina|çeyiz|ceyiz|nikah|gelin/.test(low)) {
    intent = "etkinlik";
    occasion = "dugun";
  } else if (/mevlüt|mevlut|mevlid|doğum\s*günü|dogum\s*gunu|sünnet|sunnet|bebek|parti/.test(low)) {
    intent = "etkinlik";
    occasion = "mevlut";
  } else if (/butik|toptan|stok|mağaza|e-ticaret|kermes|wholesale/.test(low)) {
    intent = /butik|kermes|açılış|acilis/.test(low) ? "etkinlik" : "is";
    if (intent === "etkinlik") occasion = "butik";
  } else if (/turist|gezi|tarihi|kahve|atölye|atolye|mısır\s*çarşısı|tour/.test(low)) {
    intent = "gez";
    occasion = "kultur";
  }

  const carry: ParsedPlanIntent["carry"] = /kargo|gönder|yokuş\s*çık|yokus\s*cik|ağır|ship/.test(low)
    ? "kargo"
    : /araba|koli/.test(low)
      ? "araba"
      : "el";

  const fireQty = guestCount ? String(Math.ceil(guestCount * 1.1)) : "12";
  const items: { name: string; qty: string; target: string }[] = [];

  if (/kutu|nikah|poşet|poset|ambalaj|kurdele|kese/.test(low)) {
    items.push({ name: "Sedef Ambalaj", qty: fireQty, target: "12" });
  }
  if (/taç|tac|kolye|küpe|kupe|bileklik|bijuteri|takı|taki|tesbih/.test(low)) {
    items.push({ name: "Roza Bijuteri", qty: guestCount ? String(Math.min(100, Math.ceil(guestCount * 0.25))) : "12", target: "85" });
  }
  if (/havlu|bornoz|çeyiz|ceyiz|tekstil|bohça/.test(low)) {
    items.push({ name: "Mahmut Tekstil", qty: "10", target: "165" });
  }
  if (/kılıf|kilif|şarj|sarj|elektronik|telefon/.test(low)) {
    items.push({ name: "Zenta Elektronik", qty: "24", target: "85" });
  }
  if (/saat|gözlük|süs|parti|balon|oyuncak/.test(low)) {
    items.push({ name: "Emre Aksesuar", qty: "24", target: "45" });
  }
  if (/baharat|lokum|safran|kahve|şeker/.test(low)) {
    items.push({ name: "Arif Bey Baharat", qty: "2", target: "280" });
  }
  if (/gümüş|gumus|yüzük|altın|kuyum/.test(low)) {
    items.push({ name: "Kalpakçılar Kuyum", qty: "1", target: "540" });
  }

  // If no explicit product keyword matched, populate smart defaults for the occasion
  if (!items.length) {
    if (occasion === "dugun") {
      items.push(
        { name: "Roza Bijuteri", qty: "12", target: "95" },
        { name: "Mahmut Tekstil", qty: "10", target: "165" },
        { name: "Sedef Ambalaj", qty: fireQty, target: "12" },
      );
    } else if (occasion === "mevlut") {
      items.push(
        { name: "Emre Aksesuar", qty: "24", target: "45" },
        { name: "Roza Bijuteri", qty: fireQty, target: "40" },
        { name: "Sedef Ambalaj", qty: fireQty, target: "10" },
      );
    } else {
      items.push(
        { name: "Roza Bijuteri", qty: "6", target: "95" },
        { name: "Emre Aksesuar", qty: "12", target: "45" },
      );
    }
  }

  const dayTr = day === "tomorrow" ? "Yarın" : day === "weekend" ? "Hafta sonu" : "Bugün";
  const explanationTr = `${dayTr} saat ${String(start).padStart(2, "0")}:00 başlangıçlı, ${hours} saatlik ${
    occasion === "dugun"
      ? "Söz/Nişan/Düğün"
      : occasion === "mevlut"
        ? "Mevlüt/Parti"
        : occasion === "butik"
          ? "Butik Açılış"
          : intent === "is"
            ? "Toptan Tedarik"
            : "Çarşı Gezi"
  } rotası${guestCount ? ` (${guestCount} kişi · %10 fireli adet)` : ""}${
    budgetLimit ? ` · Hedef bütçe ₺${budgetLimit.toLocaleString("tr-TR")}` : ""
  } olarak kuruldu.`;

  return { day, start, hours, intent, occasion, guestCount, budgetLimit, carry, items, explanationTr };
}

export async function POST(request: Request) {
  const rl = checkAiRateLimit(clientIp(request));
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Dakikalık yapay zeka sınırı aşıldı." }, { status: 429 });
  }

  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = String(body.prompt || "").trim().slice(0, 600);
  if (!prompt) {
    return NextResponse.json({ ok: false, error: "Plan açıklaması boş olamaz." }, { status: 400 });
  }

  const cacheKey = `plan:${prompt.toLocaleLowerCase("tr")}`;
  const cached = getCached<{ provider: string; parsed: ParsedPlanIntent }>(cacheKey);
  if (cached) {
    return NextResponse.json({ ok: true, cached: true, ...cached });
  }

  const base = deterministicParseIntent(prompt);
  let parsed = base;
  let provider: "gemini" | "fallback" = "fallback";

  const aiRes = await callGeminiJson<Partial<ParsedPlanIntent>>({
    prompt:
      `Parse this Istanbul bazaar trip request into STRICT JSON matching the schema: ` +
      `{ day: "today"|"tomorrow"|"weekend", start: integer(9..16), hours: integer(2..6), ` +
      `intent: "gez"|"is"|"etkinlik", occasion?: "dugun"|"mevlut"|"butik"|"kultur", ` +
      `guestCount?: integer, budgetLimit?: integer, carry: "el"|"araba"|"kargo", ` +
      `explanationTr: string }. Never invent fake shop names. User request: """${prompt}"""`,
  });

  if (aiRes && aiRes.day && typeof aiRes.hours === "number") {
    parsed = {
      ...base,
      day: (["today", "tomorrow", "weekend"].includes(aiRes.day) ? aiRes.day : base.day) as ParsedPlanIntent["day"],
      start: typeof aiRes.start === "number" && aiRes.start >= 9 && aiRes.start <= 16 ? Math.round(aiRes.start) : base.start,
      hours: Math.max(2, Math.min(6, Math.round(aiRes.hours))),
      intent: (["gez", "is", "etkinlik"].includes(String(aiRes.intent)) ? aiRes.intent : base.intent) as ParsedPlanIntent["intent"],
      occasion: aiRes.occasion || base.occasion,
      guestCount: typeof aiRes.guestCount === "number" && aiRes.guestCount > 0 ? Math.round(aiRes.guestCount) : base.guestCount,
      budgetLimit: typeof aiRes.budgetLimit === "number" && aiRes.budgetLimit > 0 ? Math.round(aiRes.budgetLimit) : base.budgetLimit,
      carry: (["el", "araba", "kargo"].includes(String(aiRes.carry)) ? aiRes.carry : base.carry) as ParsedPlanIntent["carry"],
      explanationTr: aiRes.explanationTr || base.explanationTr,
    };
    provider = "gemini";
  }

  setCached(cacheKey, { provider, parsed });
  return NextResponse.json({ ok: true, provider, parsed });
}
