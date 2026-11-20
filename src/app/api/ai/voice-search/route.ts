// HAN 2.0 Kademe 3 — Voice Search ("Bas-Konuş Gerçek Kapı Bul").
// Accepts MediaRecorder audio (audio/webm, audio/mp4) OR text transcript.
// Extracts product/quantity/area intent via Gemini fast tier (or deterministic fallback),
// searches SC.RECORDS, and runs every card through the validateAiCards Hallucination Firewall.

import { NextResponse } from "next/server";

import * as SE from "@/data/han-search";
import type { Lang, Mode } from "@/data/types";
import { callGeminiJson, checkAiRateLimit, clientIp, validateAiCards } from "@/server/ai";

export const dynamic = "force-dynamic";

interface VoiceSearchIntent {
  transcript: string;
  query: string;
  qty: number | null;
  mode: Mode;
  semt: string | null;
  replyTr: string;
}

function deterministicVoiceParse(rawText: string, defaultMode: Mode): VoiceSearchIntent {
  const cleaned = rawText.trim() || "çelik kolye bijuteri";
  const lower = cleaned.toLocaleLowerCase("tr");

  const qtyMatch = lower.match(/\b(\d{2,5})\s*(adet|tane|koli|düzine|pcs|piece)?\b/);
  const qty = qtyMatch ? Number(qtyMatch[1]) : null;
  const mode: Mode =
    /toptan|koli|wholesale|опт|جملة/.test(lower) || (qty != null && qty >= 24)
      ? "toptan"
      : /perakende|tek|retail/.test(lower)
        ? "perakende"
        : defaultMode;

  let semt: string | null = null;
  if (/tahtakale|santral|şark|sark/.test(lower)) semt = "tahtakale";
  else if (/mahmutpaşa|mahmutpasa|kürkçü|kurkcu/.test(lower)) semt = "mahmutpasa";
  else if (/kapalıçarşı|kapalicarsi|zincirli|kalcılar/.test(lower)) semt = "kapalicarsi";
  else if (/mısır|misir|baharat|eminönü|eminonu/.test(lower)) semt = "misircarsisi";
  else if (/sirkeci|doğubank|dogubank/.test(lower)) semt = "sirkeci";

  // Extract concise search phrase
  let query = cleaned
    .replace(/\b(\d{1,5})\s*(adet|tane|koli|düzine|tl|lira|euro|dolar|usd|eur)\b/gi, " ")
    .replace(/\b(toptan|perakende|nerede|satılır|arıyorum|lazım|istiyorum|bul|bana|en ucuz|han|kapı)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (query.length < 2) query = cleaned;

  return {
    transcript: cleaned,
    query,
    qty,
    mode,
    semt,
    replyTr:
      `"${query}" için gerçek han ve kapı kayıtları listelendi` +
      (qty ? ` (Hedef adet: ${qty})` : "") +
      ".",
  };
}

export async function POST(request: Request) {
  const rl = checkAiRateLimit(clientIp(request));
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Yapay zeka sesli arama hız sınırına ulaşıldı. Lütfen biraz bekleyin." },
      { status: 429 },
    );
  }

  let transcript = "";
  let audioBase64: string | undefined;
  let audioMime: string | undefined;
  let lang: Lang = "tr";
  let mode: Mode = "ikisi";

  const ct = request.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    transcript = String(form.get("transcript") || form.get("text") || "").trim();
    lang = (String(form.get("lang") || "tr") as Lang) || "tr";
    mode = (String(form.get("mode") || "ikisi") as Mode) || "ikisi";
    const audio = form.get("audio");
    if (audio instanceof File && audio.size > 0 && audio.size <= 6 * 1024 * 1024) {
      audioMime = audio.type || "audio/webm";
      audioBase64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    }
  } else {
    try {
      const body = (await request.json()) as {
        transcript?: string;
        text?: string;
        audioBase64?: string;
        audioMime?: string;
        lang?: Lang;
        mode?: Mode;
      };
      transcript = String(body.transcript || body.text || "").trim();
      audioBase64 = body.audioBase64;
      audioMime = body.audioMime || "audio/webm";
      lang = body.lang || "tr";
      mode = body.mode || "ikisi";
    } catch {
      return NextResponse.json({ ok: false, error: "Geçersiz JSON gövdesi." }, { status: 400 });
    }
  }

  if (!transcript && !audioBase64) {
    return NextResponse.json({ ok: false, error: "Ses kaydı veya metin gerekli." }, { status: 400 });
  }

  let intent: VoiceSearchIntent | null = null;
  let provider: "gemini-fast" | "fallback" = "fallback";

  const aiRes = await callGeminiJson<VoiceSearchIntent>({
    tier: "fast",
    audioBase64,
    audioMime,
    prompt:
      `You are a concise bazaar voice-intent parser for Istanbul Historic Peninsula (Tahtakale, Santral Han, Kapalıçarşı, Mahmutpaşa, Mısır Çarşısı, Sirkeci). ` +
      `Listen to the audio (or read text: "${transcript}") and return STRICT JSON: ` +
      `"transcript" (transcribed text in user language), "query" (short Turkish product/shop search keywords), ` +
      `"qty" (integer quantity or null), "mode" ("toptan" | "perakende" | "ikisi"), ` +
      `"semt" (one of "tahtakale"|"mahmutpasa"|"kapalicarsi"|"misircarsisi"|"sirkeci"|null), ` +
      `"replyTr" (1 short Turkish sentence confirming what you searched). NEVER invent shop names or door numbers.`,
  });

  if (aiRes && aiRes.query) {
    intent = {
      transcript: String(aiRes.transcript || transcript || aiRes.query),
      query: String(aiRes.query).trim(),
      qty: typeof aiRes.qty === "number" && Number.isFinite(aiRes.qty) ? aiRes.qty : null,
      mode: aiRes.mode === "toptan" || aiRes.mode === "perakende" ? aiRes.mode : mode,
      semt: aiRes.semt || null,
      replyTr: String(aiRes.replyTr || `"${aiRes.query}" için gerçek kapı kayıtları bulundu.`),
    };
    provider = "gemini-fast";
  } else {
    intent = deterministicVoiceParse(transcript, mode);
  }

  // Deterministic search on real SC.RECORDS + Hallucination Firewall
  const searchRes = SE.search(
    intent.query,
    {
      semt: intent.semt || "all",
      moqMax: intent.qty || undefined,
    },
    { mode: intent.mode, lang, qty: intent.qty || 0 },
  );

  const fallbackPool =
    searchRes.items.length > 0
      ? searchRes.items
      : SE.search(intent.query, {}, { mode: "ikisi", lang }).items;

  // Test hallucination firewall explicitly by injecting no fake IDs; every output is verified against SC.RECORDS
  const matches = validateAiCards(
    fallbackPool.slice(0, 12).map((item) => ({ recordId: item.rec.id })),
    8,
  );

  return NextResponse.json({
    ok: true,
    provider,
    firewallVerified: true,
    intent,
    totalMatches: fallbackPool.length,
    matches,
  });
}
