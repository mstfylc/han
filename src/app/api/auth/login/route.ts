import { login } from "@/server/auth";
import { json, withSessionCookie } from "@/server/http";

export async function POST(req: Request) {
  let body: { tel?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, msg: "json gövdesi gerekli" }, 400);
  }
  const r = login(String(body.tel || ""), String(body.pin || ""));
  if (!r.ok) return json({ ok: false, err: r.err, msg: r.msg, userId: r.userId }, 401);
  return withSessionCookie(json({ ok: true, user: r.user }), r.token || null);
}
