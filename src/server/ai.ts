// HAN 2.0 — Zero-Hallucination AI Service
// (Model Router: fast/agent/fallback + Daily Circuit Breaker + Hallucination Firewall).
//
// Core invariant (Chief Architect Red Line):
//   AI NEVER invents door numbers, prices, opening hours or walking routes.
//   AI only extracts structured intent, visual/audio tags, OCR/voice drafts, and
//   commercial translations; real shops come strictly from SC.RECORDS and are
//   verified by validateAiCards().

import * as SC from "@/data/han-scale";

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const DAILY_IP_LIMIT = 150;

const ipBuckets = new Map<string, number[]>();
const dailyIpBuckets = new Map<string, { day: string; count: number }>();
const globalDailyBudget = { day: "", count: 0 };
const responseCache = new Map<string, { at: number; value: unknown }>();
const CACHE_TTL_MS = 5 * 60_000;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function checkAiRateLimit(ip: string): { allowed: boolean; remaining: number; reason?: string } {
  const now = Date.now();
  const key = ip || "unknown";
  const prev = (ipBuckets.get(key) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (prev.length >= RATE_LIMIT) {
    ipBuckets.set(key, prev);
    return { allowed: false, remaining: 0, reason: "minute_limit" };
  }

  const day = todayKey();
  const d = dailyIpBuckets.get(key);
  if (d && d.day === day && d.count >= DAILY_IP_LIMIT) {
    return { allowed: false, remaining: 0, reason: "daily_ip_limit" };
  }

  prev.push(now);
  ipBuckets.set(key, prev);
  dailyIpBuckets.set(key, { day, count: d && d.day === day ? d.count + 1 : 1 });
  return { allowed: true, remaining: RATE_LIMIT - prev.length };
}

/** Global daily Gemini call circuit breaker (default cap 2000/day, configurable via HAN_AI_DAILY_CAP). */
export function consumeGlobalAiBudget(): boolean {
  const cap = Number(process.env.HAN_AI_DAILY_CAP || "2000");
  const limit = Number.isFinite(cap) && cap > 0 ? cap : 2000;
  const day = todayKey();
  if (globalDailyBudget.day !== day) {
    globalDailyBudget.day = day;
    globalDailyBudget.count = 0;
  }
  if (globalDailyBudget.count >= limit) return false;
  globalDailyBudget.count += 1;
  return true;
}

export function aiBudgetStatus(): { day: string; used: number; cap: number; active: boolean } {
  const cap = Number(process.env.HAN_AI_DAILY_CAP || "2000");
  const limit = Number.isFinite(cap) && cap > 0 ? cap : 2000;
  const day = todayKey();
  const used = globalDailyBudget.day === day ? globalDailyBudget.count : 0;
  return { day, used, cap: limit, active: Boolean(process.env.GEMINI_API_KEY) && used < limit };
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "local";
}

export function getCached<T>(key: string): T | null {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return hit.value as T;
}

export function setCached<T>(key: string, value: T): T {
  if (responseCache.size > 200) {
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
  responseCache.set(key, { at: Date.now(), value });
  return value;
}

export type AiModelTier = "fast" | "agent";

export function resolveModel(tier: AiModelTier = "agent"): string {
  if (tier === "fast") {
    return process.env.HAN_AI_FAST_MODEL || "gemini-2.5-flash-lite";
  }
  return process.env.HAN_AI_MODEL || "gemini-2.5-flash";
}

/**
 * Hallucination Firewall: verifies every AI-returned shop match against live SC.RECORDS.
 * Drops fabricated recordIds, suspended ("askida") records, or blank doors, and stamps
 * authoritative name/place/floor/door/status directly from the registry.
 */
export interface VerifiedAiCard {
  recordId: string;
  curated: string | null;
  name: string;
  placeId: string;
  placeName: string;
  floor: number;
  door: string;
  cat: string;
  band: [number, number] | null;
  status: string;
}

export function validateAiCards(
  candidates: Array<{ recordId?: string | null }>,
  limit = 8,
): VerifiedAiCard[] {
  const seen = new Set<string>();
  const out: VerifiedAiCard[] = [];

  for (const item of candidates) {
    const id = String(item?.recordId || "").trim();
    if (!id || seen.has(id)) continue;
    const rec = SC.RECORDS.find((r) => r.id === id || r.curated === id);
    if (!rec) continue;
    if (rec.status === "askida") continue;
    const doorStr = String(rec.door ?? "").trim();
    if (!doorStr) continue;

    seen.add(rec.id);
    const place = SC.PLACES.find((p) => p.id === rec.place);
    out.push({
      recordId: rec.id,
      curated: rec.curated || null,
      name: rec.name,
      placeId: rec.place,
      placeName: place?.name || rec.place,
      floor: rec.floor,
      door: doorStr,
      cat: rec.cat,
      band: rec.band || null,
      status: rec.status,
    });
    if (out.length >= limit) break;
  }

  return out;
}

/** Call Gemini returning strict JSON. Supports text, image, and MediaRecorder audio inline data. */
export async function callGeminiJson<T>(opts: {
  prompt: string;
  tier?: AiModelTier;
  imageBase64?: string;
  imageMime?: string;
  audioBase64?: string;
  audioMime?: string;
}): Promise<T | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!consumeGlobalAiBudget()) return null;

  const model = resolveModel(opts.tier || "agent");
  const parts: Record<string, unknown>[] = [{ text: opts.prompt }];
  if (opts.imageBase64 && opts.imageMime) {
    parts.push({
      inline_data: {
        mime_type: opts.imageMime,
        data: opts.imageBase64,
      },
    });
  }
  if (opts.audioBase64 && opts.audioMime) {
    parts.push({
      inline_data: {
        mime_type: opts.audioMime,
        data: opts.audioBase64,
      },
    });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 14_000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.15,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;
    return JSON.parse(rawText) as T;
  } catch {
    return null;
  }
}
