// HAN 2.0 Kademe 3 — Voice-to-Catalog ("Esnaf 10 Sn Fotoğraf + Sesle 4 Dilli Vitrin Aç").
// Accepts MediaRecorder audio + optional compressed product photo +/or text note.
// Always returns a DRAFT (`confirmedByTrader: false`) — trader reviews and approves before publish.

import { NextResponse } from "next/server";

import { callGeminiJson, checkAiRateLimit, clientIp } from "@/server/ai";

export const dynamic = "force-dynamic";

export interface VoiceCatalogDraft {
  productName: string;
  category: string;
  priceMin: number | null;
  priceMax: number | null;
  moq: number;
  tags: string[];
  descTr: string;
  descEn: string;
  descRu: string;
  descAr: string;
  confirmedByTrader: false;
}

const VALID_CATS = ["bijuteri", "taki", "kilif", "sarj", "tekstil", "poset", "hali", "deri", "baharat", "hediyelik"];

function heuristicVoiceCatalog(text: string): VoiceCatalogDraft {
  const clean = text.trim() || "316L Çelik Kolye Serisi";
  const lower = clean.toLocaleLowerCase("tr");

  const priceMatch = lower.match(/(\d{2,5})\s*(tl|lira|₺)/);
  const price = priceMatch ? Number(priceMatch[1]) : null;
  const moqMatch = lower.match(/(?:en az|min|minimum|moq)\s*(\d{1,4})|(\d{1,4})\s*(?:adet|koli|düzine)/);
  const moq = Number(moqMatch?.[1] || moqMatch?.[2] || 12) || 12;

  let category = "bijuteri";
  if (/kılıf|kilif|telefon|case/.test(lower)) category = "kilif";
  else if (/şarj|sarj|kablo|batarya|pil/.test(lower)) category = "sarj";
  else if (/havlu|bornoz|çeyiz|tekstil|kumaş/.test(lower)) category = "tekstil";
  else if (/poşet|kutu|ambalaj/.test(lower)) category = "poset";
  else if (/deri|çanta|cüzdan/.test(lower)) category = "deri";
  else if (/halı|kilim/.test(lower)) category = "hali";
  else if (/baharat|safran|lokum|kahve|çay/.test(lower)) category = "baharat";
  else if (/altın|gümüş|yüzük|pırlanta/.test(lower)) category = "taki";

  const productName = clean
    .replace(/\b(\d{1,5})\s*(tl|lira|₺|adet|koli)\b/gi, "")
    .replace(/\b(en az|minimum|toptan|perakende|satıyorum|var|elimde)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 56) || "Yeni Vitrin Ürünü";

  const priceStr = price ? `${price} TL` : "toptan & perakende avantajlı fiyat";

  return {
    productName,
    category,
    priceMin: price ? Math.round(price * 0.9) : null,
    priceMax: price ? Math.round(price * 1.15) : null,
    moq,
    tags: [productName.split(" ").slice(0, 2).join(" "), category, moq >= 10 ? "Toptan" : "Perakende"],
    descTr: `${productName} — Tarihi Yarımada mağazamızda hazır stok, ${priceStr}, minimum ${moq} adet.`,
    descEn: `${productName} — In stock at our Historic Peninsula shop, ${price ? `${price} TRY` : "wholesale & retail pricing"}, MOQ ${moq} pcs.`,
    descRu: `${productName} — В наличии в нашем магазине на Историческом полуострове, мин. заказ ${moq} шт.`,
    descAr: `${productName} — متوفر في متجرنا في شبه الجزيرة التاريخية، الحد الأدنى للطلب ${moq} قطعة.`,
    confirmedByTrader: false,
  };
}

export async function POST(request: Request) {
  const rl = checkAiRateLimit(clientIp(request));
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Yapay zeka vitrin açma hız sınırına ulaşıldı. Lütfen biraz bekleyin." },
      { status: 429 },
    );
  }

  let text = "";
  let audioBase64: string | undefined;
  let audioMime: string | undefined;
  let imageBase64: string | undefined;
  let imageMime: string | undefined;

  const ct = request.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    text = String(form.get("text") || "").trim();
    const audio = form.get("audio");
    if (audio instanceof File && audio.size > 0 && audio.size <= 6 * 1024 * 1024) {
      audioMime = audio.type || "audio/webm";
      audioBase64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    }
    const image = form.get("image") || form.get("file");
    if (image instanceof File && image.size > 0 && image.size <= 5 * 1024 * 1024) {
      imageMime = image.type || "image/jpeg";
      imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    }
  } else {
    try {
      const body = (await request.json()) as {
        text?: string;
        audioBase64?: string;
        audioMime?: string;
        imageBase64?: string;
        imageMime?: string;
      };
      text = String(body.text || "").trim();
      audioBase64 = body.audioBase64;
      audioMime = body.audioMime || "audio/webm";
      imageBase64 = body.imageBase64;
      imageMime = body.imageMime || "image/jpeg";
    } catch {
      return NextResponse.json({ ok: false, error: "Geçersiz JSON gövdesi." }, { status: 400 });
    }
  }

  if (!text && !audioBase64 && !imageBase64) {
    return NextResponse.json({ ok: false, error: "Ses kaydı, ürün fotoğrafı veya kısa not gerekli." }, { status: 400 });
  }

  let draft: VoiceCatalogDraft | null = null;
  let provider: "gemini-agent" | "fallback" = "fallback";

  const aiRes = await callGeminiJson<Omit<VoiceCatalogDraft, "confirmedByTrader">>({
    tier: "agent",
    audioBase64,
    audioMime,
    imageBase64,
    imageMime,
    prompt:
      `You are a multilingual bazaar catalog assistant for an Istanbul trader. ` +
      `From the attached voice note, product photo, and/or text ("${text}"), return STRICT JSON: ` +
      `"productName" (concise Turkish product title), "category" (one of: ${VALID_CATS.join(", ")}), ` +
      `"priceMin" (TRY number or null), "priceMax" (TRY number or null), "moq" (integer minimum order quantity, default 12), ` +
      `"tags" (array of 3-4 Turkish tags), "descTr", "descEn", "descRu", "descAr" (1-sentence commercial product description in each language).`,
  });

  if (aiRes && aiRes.productName && aiRes.descTr && aiRes.descEn && aiRes.descRu && aiRes.descAr) {
    draft = {
      productName: String(aiRes.productName).trim(),
      category: VALID_CATS.includes(aiRes.category) ? aiRes.category : "bijuteri",
      priceMin: typeof aiRes.priceMin === "number" ? aiRes.priceMin : null,
      priceMax: typeof aiRes.priceMax === "number" ? aiRes.priceMax : null,
      moq: Number(aiRes.moq) > 0 ? Math.round(Number(aiRes.moq)) : 12,
      tags: Array.isArray(aiRes.tags) ? aiRes.tags.slice(0, 5).map(String) : [],
      descTr: String(aiRes.descTr),
      descEn: String(aiRes.descEn),
      descRu: String(aiRes.descRu),
      descAr: String(aiRes.descAr),
      confirmedByTrader: false,
    };
    provider = "gemini-agent";
  } else {
    draft = heuristicVoiceCatalog(text);
  }

  return NextResponse.json({
    ok: true,
    provider,
    draft,
  });
}
