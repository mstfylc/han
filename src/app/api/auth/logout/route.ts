import { closeSession } from "@/server/auth";
import { json, tokenFrom, withSessionCookie } from "@/server/http";

export async function POST(req: Request) {
  closeSession(tokenFrom(req));
  return withSessionCookie(json({ ok: true }), null);
}
