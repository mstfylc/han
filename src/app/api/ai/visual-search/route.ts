import { NextResponse } from "next/server";

import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import type { Lang, Mode } from "@/data/types";
import { callGeminiJson, checkAiRateLimit, clientIp } from "@/server/ai";

export const dynamic = "force-dynamic";

interface VisualExtraction {
  query: string;
  category: string;
  labelTr: string;
  tags: string[];
  confidence: number;
}

const VALID_CATS = ["bijuteri", "taki", "kilif", "sarj", "tekstil", "poset", "hali", "deri", "baharat", "hediyelik"];

function heuristicVisualFallback(hint: string, filename: string): VisualExtraction {
  const txt = (hint + " " + filename).toLocaleLowerCase("tr");
  if (/kılıf|kilif|case|iphone|samsung|phone|telefon|kapak/.test(txt)) {
    return {
      query: "telefon kılıfı",
      category: "kilif",
      labelTr: "Telefon Kılıfı & Mobil Aksesuar",
      tags: ["Silikon Kılıf", "Mobil Aksesuar", "Santral Han C Kat", "Şark Han"],
      confidence: 0.86,
    };
  }
  if (/şarj|sarj|kablo|kulaklık|pil|powerbank|charger/.test(txt)) {
    return {
      query: "hızlı şarj",
      category: "sarj",
      labelTr: "Şarj Adaptörü, Kablo & Powerbank",
      tags: ["Hızlı Şarj", "Batarya", "Santral Han D Kat"],
      confidence: 0.85,
    };
  }
  if (/havlu|bornoz|çeyiz|ceyiz|tekstil|gömlek|tişört|kumaş|towel/.test(txt)) {
    return {
      query: "havlu seti",
      category: "tekstil",
      labelTr: "Çeyiz, Havlu & Ev Tekstili",
      tags: ["Havlu Seti", "Çeyiz", "Kürkçü Han", "Mahmutpaşa"],
      confidence: 0.84,
    };
  }
  if (/poşet|poset|kutu|ambalaj|kurdele|kese|nikah|box|bag/.test(txt)) {
    return {
      query: "hediye kutusu poşet",
      category: "poset",
      labelTr: "Hediye Kutusu, Kraft Poşet & Ambalaj",
      tags: ["Kraft Poşet", "Karton Kutu", "Nikah Şekeri Kutusu", "Sultan Han"],
      confidence: 0.85,
    };
  }
  if (/deri|çanta|canta|cüzdan|kemer|leather|wallet/.test(txt)) {
    return {
      query: "deri çanta cüzdan",
      category: "deri",
      labelTr: "Hakiki Deri Çanta, Cüzdan & Kemer",
      tags: ["Deri Cüzdan", "Omuz Çantası", "Şark Han", "Mercan"],
      confidence: 0.84,
    };
  }
  if (/halı|hali|kilim|carpet/.test(txt)) {
    return {
      query: "el dokuma halı kilim",
      category: "hali",
      labelTr: "El Dokuma Halı & Kilim",
      tags: ["Uşak Kilim", "Yün Halı", "Zincirli Han", "Şark Han"],
      confidence: 0.84,
    };
  }
  if (/baharat|safran|lokum|çay|kahve|spice/.test(txt)) {
    return {
      query: "baharat lokum safran",
      category: "baharat",
      labelTr: "Baharat, Safran, Lokum & Bitki Çayı",
      tags: ["Safran", "Lokum", "Mısır Çarşısı"],
      confidence: 0.85,
    };
  }
  if (/altın|gümüş|yüzük|kuyum|silver|gold|ring/.test(txt)) {
    return {
      query: "gümüş yüzük kolye",
      category: "taki",
      labelTr: "925 Gümüş & Altın Kuyum",
      tags: ["925 Gümüş", "Yüzük", "Kalpakçılar", "Zincirli Han"],
      confidence: 0.86,
    };
  }
  return {
    query: "çelik kolye bijuteri",
    category: "bijuteri",
    labelTr: "316L Çelik Takı, Bijuteri & Gelin Aksesuarı",
    tags: ["316L Çelik Kolye", "Zirkon Küpe", "Bijuteri", "Santral Han A–B Kat"],
    confidence: 0.82,
  };
}

export async function POST(request: Request) {
  const rl = checkAiRateLimit(clientIp(request));
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Dakikalık yapay zeka arama sınırına ulaşıldı. Lütfen biraz bekleyin." },
      { status: 429 },
    );
  }

  let hint = "";
  let filename = "";
  let imageBase64: string | undefined;
  let imageMime: string | undefined;
  let lang: Lang = "tr";
  let mode: Mode = "ikisi";

  const ct = request.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    hint = String(form.get("hint") || "");
    lang = (String(form.get("lang") || "tr") as Lang) || "tr";
    mode = (String(form.get("mode") || "ikisi") as Mode) || "ikisi";
    const file = form.get("file");
    if (file instanceof File && file.size > 0 && file.size <= 5 * 1024 * 1024) {
      filename = file.name || "";
      imageMime = file.type || "image/jpeg";
      imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    }
  } else {
    try {
      const body = (await request.json()) as {
        hint?: string;
        filename?: string;
        imageBase64?: string;
        imageMime?: string;
        lang?: Lang;
        mode?: Mode;
      };
      hint = String(body.hint || "");
      filename = String(body.filename || "");
      imageBase64 = body.imageBase64;
      imageMime = body.imageMime || "image/jpeg";
      lang = body.lang || "tr";
      mode = body.mode || "ikisi";
    } catch {
      return NextResponse.json({ ok: false, error: "Geçersiz istek gövdesi." }, { status: 400 });
    }
  }

  let extracted: VisualExtraction | null = null;
  let provider: "gemini" | "fallback" = "fallback";

  if (imageBase64) {
    const aiRes = await callGeminiJson<VisualExtraction>({
      imageBase64,
      imageMime,
      prompt:
        `You are a product classifier for Istanbul Historic Bazaar (Tahtakale, Santral Han, Kapalıçarşı, Mahmutpaşa, Mısır Çarşısı). ` +
        `Analyze the image (optional user hint: "${hint}") and return STRICT JSON with keys: ` +
        `"query" (short Turkish search phrase), "category" (MUST be one of: ${VALID_CATS.join(", ")}), ` +
        `"labelTr" (concise Turkish product title), "tags" (array of 3-4 Turkish tags), "confidence" (0.5 to 0.99). ` +
        `Never invent shop names or door numbers.`,
    });
    if (aiRes && aiRes.query && VALID_CATS.includes(aiRes.category)) {
      extracted = aiRes;
      provider = "gemini";
    }
  }

  if (!extracted) {
    extracted = heuristicVisualFallback(hint, filename);
  }

  // Zero-hallucination guarantee: EVERY shop result comes strictly from deterministic han-search (SC.RECORDS)
  const searchRes = SE.search(extracted.query, { cat: extracted.category }, { mode, lang });
  const fallbackRes = searchRes.items.length
    ? searchRes
    : SE.search(extracted.query, {}, { mode, lang });

  const matches = fallbackRes.items.slice(0, 8).map((item) => {
    const rec = item.rec;
    const place = SC.PLACES.find((p) => p.id === rec.place);
    return {
      recordId: rec.id,
      curated: rec.curated || null,
      name: rec.name,
      placeId: rec.place,
      placeName: place?.name || rec.place,
      floor: rec.floor,
      door: String(rec.door),
      cat: rec.cat,
      band: rec.band || null,
      status: rec.status,
    };
  });

  return NextResponse.json({
    ok: true,
    provider,
    extracted,
    totalMatches: fallbackRes.total,
    matches,
  });
}
