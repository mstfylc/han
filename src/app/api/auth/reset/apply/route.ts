import { applyReset } from "@/server/auth";
import { json, withSessionCookie } from "@/server/http";

export async function POST(req: Request) {
  let body: { code?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, msg: "json gövdesi gerekli" }, 400);
  }
  const r = applyReset(String(body.code || ""), String(body.pin || ""));
  if (!r.ok) return json({ ok: false, msg: r.msg }, 400);
  return withSessionCookie(json({ ok: true, user: r.user }), r.token || null);
}
