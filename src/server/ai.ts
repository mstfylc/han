// HAN — Zero-Hallucination AI Service (Gemini 2.5 Flash + deterministic local fallback).
//
// Core invariant (Chief Architect Red Line):
//   AI NEVER invents door numbers, prices, opening hours or walking routes.
//   AI only extracts structured intent, visual tags, OCR drafts, and commercial
//   translations; real shops come from han-search.ts (SC.RECORDS) and routes
//   from planEngine.ts.

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;

const ipBuckets = new Map<string, number[]>();
const responseCache = new Map<string, { at: number; value: unknown }>();
const CACHE_TTL_MS = 5 * 60_000;

export function checkAiRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = ip || "unknown";
  const prev = (ipBuckets.get(key) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (prev.length >= RATE_LIMIT) {
    ipBuckets.set(key, prev);
    return { allowed: false, remaining: 0 };
  }
  prev.push(now);
  ipBuckets.set(key, prev);
  return { allowed: true, remaining: RATE_LIMIT - prev.length };
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

/** Call Gemini 2.5 Flash returning strict JSON. Returns null if key is unset or call fails. */
export async function callGeminiJson<T>(opts: {
  prompt: string;
  imageBase64?: string;
  imageMime?: string;
}): Promise<T | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.HAN_AI_MODEL || "gemini-2.5-flash";
  const parts: Record<string, unknown>[] = [{ text: opts.prompt }];
  if (opts.imageBase64 && opts.imageMime) {
    parts.push({
      inline_data: {
        mime_type: opts.imageMime,
        data: opts.imageBase64,
      },
    });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
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
