import { NextResponse } from "next/server";

import { callGeminiJson, checkAiRateLimit, clientIp } from "@/server/ai";

export const dynamic = "force-dynamic";

interface ShopScanDraft {
  name: string;
  tel: string;
  door: string;
  category: string;
  tags: string[];
  moq: number;
  descTr: string;
  descEn: string;
  descRu: string;
  descAr: string;
}

const VALID_CATS = ["bijuteri", "taki", "kilif", "sarj", "tekstil", "poset", "hali", "deri", "baharat", "hediyelik"];

function heuristicShopDraft(rawText: string): ShopScanDraft {
  const txt = String(rawText || "").trim();
  const telMatch = txt.match(/(?:\+?90|0)?\s*5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/);
  const doorMatch = txt.match(/(?:no|kapı|kapi|dükkan|dukkan)[:.\s#-]*(\d{1,4})/i);
  const low = txt.toLocaleLowerCase("tr");

  let category = "bijuteri";
  if (/kılıf|kilif|telefon|gsm|mobil/.test(low)) category = "kilif";
  else if (/şarj|sarj|pil|batarya|elektronik/.test(low)) category = "sarj";
  else if (/havlu|tekstil|çeyiz|kumaş/.test(low)) category = "tekstil";
  else if (/poşet|kutu|ambalaj/.test(low)) category = "poset";
  else if (/gümüş|altın|kuyum/.test(low)) category = "taki";
  else if (/deri|çanta|cüzdan/.test(low)) category = "deri";
  else if (/halı|kilim/.test(low)) category = "hali";
  else if (/baharat|lokum|kahve/.test(low)) category = "baharat";

  const firstLine = txt
    .split(/[\n,|·]+/)
    .map((s) => s.trim())
    .find((s) => s.length >= 3 && !/^\d+$/.test(s)) || "Yeni Çarşı Mağazası";
  const name = firstLine.slice(0, 60);

  const catLabels: Record<string, { tr: string; en: string; ru: string; ar: string; tags: string[] }> = {
    bijuteri: {
      tr: "çelik takı, bijuteri ve özel gün aksesuarları",
      en: "steel jewelry, costume accessories and occasion pieces",
      ru: "бижутерия из стали и праздничные аксессуары",
      ar: "إكسسوارات الستيل والمجوهرات المقلدة ومستلزمات المناسبات",
      tags: ["Çelik Takı", "Bijuteri", "Toptan & Perakende"],
    },
    kilif: {
      tr: "telefon kılıfı, ekran koruyucu ve mobil aksesuar",
      en: "phone cases, screen protectors and mobile accessories",
      ru: "чехлы для телефонов и мобильные аксессуары",
      ar: "أغطية الهواتف وإكسسوارات الجوال",
      tags: ["Telefon Kılıfı", "Mobil Aksesuar", "Aynı Gün Kargo"],
    },
    sarj: {
      tr: "hızlı şarj adaptörü, kablo, batarya ve powerbank",
      en: "fast chargers, cables, batteries and powerbanks",
      ru: "быстрые зарядки, кабели и повербанки",
      ar: "شواحن سريعة وكابلات وبطاريات",
      tags: ["Hızlı Şarj", "Powerbank", "Toptan Elektronik"],
    },
    tekstil: {
      tr: "çeyiz, havlu, bornoz ve ev tekstili",
      en: "bridal linens, towels, bathrobes and home textiles",
      ru: "полотенца, халаты и домашний текстиль",
      ar: "مناشف وأرواب ومنسوجات منزلية وجهاز عروس",
      tags: ["Havlu Seti", "Çeyiz", "Ev Tekstili"],
    },
    poset: {
      tr: "hediye kutusu, kraft poşet, kurdele ve ambalaj",
      en: "gift boxes, kraft bags, ribbons and packaging",
      ru: "подарочные коробки, крафт-пакеты и упаковка",
      ar: "علب هدايا وأكياس كرافت ومستلزمات التغليف",
      tags: ["Karton Kutu", "Kraft Poşet", "Nikah Kutusu"],
    },
    taki: {
      tr: "925 ayar gümüş, altın ve el işi kuyum ürünleri",
      en: "925 sterling silver, gold and handcrafted jewelry",
      ru: "серебро 925 пробы, золото и ювелирные изделия",
      ar: "فضة عيار ٩٢٥ وذهب ومجوهرات يدوية",
      tags: ["925 Gümüş", "El İşi", "Kuyum"],
    },
    deri: {
      tr: "hakiki deri çanta, cüzdan ve kemer",
      en: "genuine leather bags, wallets and belts",
      ru: "сумки, кошельки и ремни из натуральной кожи",
      ar: "حقائب ومحافظ وأحزمة من الجلد الطبيعي",
      tags: ["Hakiki Deri", "Cüzdan", "Çanta"],
    },
    hali: {
      tr: "el dokuma halı, Uşak kilim ve yastık kılıfları",
      en: "handwoven carpets, Uşak kilims and cushion covers",
      ru: "ковры ручной работы и килимы Ушак",
      ar: "سجاد يدوي وكليم أوشاك",
      tags: ["El Dokuma", "Kilim", "Yurt Dışı Kargo"],
    },
    baharat: {
      tr: "yeni hasat baharat, safran, lokum ve Türk kahvesi",
      en: "new-harvest spices, saffron, Turkish delight and coffee",
      ru: "специи нового урожая, шафран, лукум и кофе",
      ar: "بهارات وزعفران وحلقوم وقهوة تركية",
      tags: ["Safran", "Lokum", "Vakum Paket"],
    },
    hediyelik: {
      tr: "el işi çini, hediyelik eşya ve tasarım ürünleri",
      en: "handmade ceramics, souvenirs and gift items",
      ru: "керамика ручной работы и сувениры",
      ar: "خزف يدوي وهدايا تذكارية",
      tags: ["Hediyelik", "El İşi", "Tax-Free"],
    },
  };

  const info = catLabels[category] || catLabels.bijuteri;
  return {
    name,
    tel: telMatch ? telMatch[0].replace(/\D/g, "") : "",
    door: doorMatch ? doorMatch[1] : "",
    category,
    tags: info.tags,
    moq: 12,
    descTr: `${name} — Tarihi Çarşı'da ${info.tr} alanında toptan ve perakende hizmet verir.`,
    descEn: `${name} — Wholesale & retail specialist for ${info.en} in the Historic Bazaar.`,
    descRu: `${name} — Оптовая и розничная продажа: ${info.ru} на Историческом базаре.`,
    descAr: `${name} — متخصص في بيع الجملة والتجزئة في ${info.ar} بالسوق التاريخي.`,
  };
}

export async function POST(request: Request) {
  const rl = checkAiRateLimit(clientIp(request));
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Dakikalık yapay zeka sınırı aşıldı." },
      { status: 429 },
    );
  }

  let textHint = "";
  let imageBase64: string | undefined;
  let imageMime: string | undefined;

  const ct = request.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    textHint = String(form.get("text") || form.get("hint") || "");
    const file = form.get("file");
    if (file instanceof File && file.size > 0 && file.size <= 5 * 1024 * 1024) {
      imageMime = file.type || "image/jpeg";
      imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    }
  } else {
    try {
      const body = (await request.json()) as {
        text?: string;
        hint?: string;
        imageBase64?: string;
        imageMime?: string;
      };
      textHint = String(body.text || body.hint || "");
      imageBase64 = body.imageBase64;
      imageMime = body.imageMime || "image/jpeg";
    } catch {
      return NextResponse.json({ ok: false, error: "Geçersiz JSON gövdesi." }, { status: 400 });
    }
  }

  let draft: ShopScanDraft | null = null;
  let provider: "gemini" | "fallback" = "fallback";

  if (imageBase64 || textHint.length >= 6) {
    const aiRes = await callGeminiJson<ShopScanDraft>({
      imageBase64,
      imageMime,
      prompt:
        `Extract shop onboarding details from this Istanbul bazaar storefront/business card image or note ("${textHint}"). ` +
        `Return STRICT JSON with keys: name, tel (digits only or empty), door (door number or empty), ` +
        `category (one of: ${VALID_CATS.join(", ")}), tags (array of 3 Turkish tags), moq (integer default 12), ` +
        `descTr, descEn, descRu, descAr (concise 1-sentence shop description in each language).`,
    });
    if (aiRes && aiRes.name && aiRes.descTr && aiRes.descEn && aiRes.descRu && aiRes.descAr) {
      if (!VALID_CATS.includes(aiRes.category)) aiRes.category = "bijuteri";
      draft = aiRes;
      provider = "gemini";
    }
  }

  if (!draft) {
    draft = heuristicShopDraft(textHint);
  }

  return NextResponse.json({ ok: true, provider, draft });
}
