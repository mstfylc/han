import { NextResponse } from "next/server";

import type { Lang } from "@/data/types";
import { callGeminiJson, checkAiRateLimit, clientIp, getCached, setCached } from "@/server/ai";

export const dynamic = "force-dynamic";

interface TranslationResult {
  translated: string;
  summary: string;
  detectedLang: string;
}

const TRADE_GLOSSARY: [RegExp, Record<Lang, string>][] = [
  [/\b(silicone case|phone case|чехол|غطاء سيليكون|غطاء هاتف)\b/gi, { tr: "silikon telefon kılıfı", en: "silicone phone case", ru: "силиконовый чехол", ar: "غطاء هاتف سيليكون" }],
  [/\b(wholesale|toptan|оптом|بالجملة)\b/gi, { tr: "toptan", en: "wholesale", ru: "оптом", ar: "بالجملة" }],
  [/\b(sample|numune|образец|عينة)\b/gi, { tr: "numune", en: "sample", ru: "образец", ar: "عينة" }],
  [/\b(shipping|cargo|kargo|доставка|شحن)\b/gi, { tr: "kargo / gönderim", en: "shipping / cargo", ru: "доставка / карго", ar: "شحن" }],
  [/\b(pcs|pieces|adet|шт|قطعة)\b/gi, { tr: "adet", en: "pcs", ru: "шт.", ar: "قطعة" }],
  [/\b(price|fiyat|цена|سعر)\b/gi, { tr: "fiyat", en: "price", ru: "цена", ar: "السعر" }],
  [/\b(jewelry|bijuteri|бижутерия|إكسسوارات)\b/gi, { tr: "bijuteri / takı", en: "costume jewelry", ru: "бижутерия", ar: "إكسسوارات" }],
];

function detectSourceLang(text: string): Lang {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[\u0400-\u04FF]/.test(text)) return "ru";
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return "tr";
  return "en";
}

function fallbackTranslate(text: string, targetLang: Lang): TranslationResult {
  const detectedLang = detectSourceLang(text);
  const qtyMatch = text.match(/(\d{1,5})\s*(?:pcs|pieces|adet|шт|قطعة|غطاء|чехл)/i);
  const qty = qtyMatch ? qtyMatch[1] : "";

  const hits: string[] = [];
  for (const [re, dict] of TRADE_GLOSSARY) {
    if (re.test(text)) hits.push(dict[targetLang]);
  }
  const uniqueHits = [...new Set(hits)];

  if (targetLang === "tr") {
    const core = uniqueHits.length ? uniqueHits.join(", ") : text;
    return {
      detectedLang,
      translated: qty ? `${qty} adet ${core} için ticari talep/mesaj: "${text}"` : `Ticari özet (${detectedLang.toUpperCase()}): ${core}`,
      summary: qty ? `Alıcı ${qty} adet (${core}) soruyor.` : `Ticari başlıklar: ${core}`,
    };
  }
  if (targetLang === "en") {
    const core = uniqueHits.length ? uniqueHits.join(", ") : text;
    return {
      detectedLang,
      translated: qty ? `Trade note (${qty} pcs — ${core}): "${text}"` : `Commercial translation: ${core} ("${text}")`,
      summary: qty ? `Quantity ${qty} pcs · ${core}` : core,
    };
  }
  if (targetLang === "ru") {
    const core = uniqueHits.length ? uniqueHits.join(", ") : text;
    return {
      detectedLang,
      translated: qty ? `Коммерческий запрос (${qty} шт. — ${core}): "${text}"` : `Торговый перевод: ${core}`,
      summary: qty ? `${qty} шт. · ${core}` : core,
    };
  }
  const core = uniqueHits.length ? uniqueHits.join("، ") : text;
  return {
    detectedLang,
    translated: qty ? `ملاحظة تجارية (${qty} قطعة — ${core}): "${text}"` : `ترجمة تجارية: ${core}`,
    summary: qty ? `${qty} قطعة · ${core}` : core,
  };
}

export async function POST(request: Request) {
  const rl = checkAiRateLimit(clientIp(request));
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded." }, { status: 429 });
  }

  let body: { text?: string; targetLang?: Lang };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const text = String(body.text || "").trim().slice(0, 800);
  const targetLang: Lang = (["tr", "en", "ru", "ar"].includes(String(body.targetLang))
    ? body.targetLang
    : "tr") as Lang;

  if (!text) {
    return NextResponse.json({ ok: false, error: "Çevrilecek metin boş olamaz." }, { status: 400 });
  }

  const cacheKey = `tr:${targetLang}:${text}`;
  const cached = getCached<{ provider: string; result: TranslationResult }>(cacheKey);
  if (cached) {
    return NextResponse.json({ ok: true, cached: true, ...cached });
  }

  let result: TranslationResult | null = null;
  let provider: "gemini" | "fallback" = "fallback";

  const aiRes = await callGeminiJson<TranslationResult>({
    prompt:
      `Translate this Istanbul bazaar wholesale/retail trade message into language "${targetLang}" preserving exact quantities, MOQ, prices, delivery days and shipping terms. ` +
      `Return STRICT JSON with keys: "translated" (natural commercial translation in ${targetLang}), "summary" (1-line bullet summary in ${targetLang}), "detectedLang" (tr|en|ru|ar). ` +
      `Message: """${text}"""`,
  });

  if (aiRes && aiRes.translated) {
    result = aiRes;
    provider = "gemini";
  } else {
    result = fallbackTranslate(text, targetLang);
  }

  setCached(cacheKey, { provider, result });
  return NextResponse.json({ ok: true, provider, result });
}
