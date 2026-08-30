// /api/store — the prototype's storage keys, served.
//
// GET returns every store at once: the browser hydrates from this before the
// first read, so the sync readKey() world the whole engine is written in
// keeps working. PUT is a single-key write-through.
//
// Operations-only keys demand a session once the first user exists; until
// then the system is in bootstrap and stays as open as the prototype, so the
// out-of-the-box demo still works.

import { canWriteKey } from "@/server/auth";
import { KEY_RE, kvGetAll, kvSet } from "@/server/db";
import { json, tokenFrom } from "@/server/http";

export async function GET() {
  return json({ ok: true, stores: kvGetAll() });
}

export async function PUT(req: Request) {
  let body: { key?: string; value?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "json gövdesi gerekli" }, 400);
  }
  const key = String(body.key || "");
  if (!KEY_RE.test(key)) return json({ ok: false, error: "geçersiz anahtar" }, 400);
  if (!canWriteKey(key, tokenFrom(req))) {
    return json({ ok: false, error: "bu anahtara yazmak oturum ister" }, 401);
  }
  kvSet(key, body.value ?? null);
  return json({ ok: true });
}
