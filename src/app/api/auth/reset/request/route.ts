// Reset code — by phone (the Giriş screen) or by userId (an admin handing a
// code to a teammate from the Kullanıcılar tab; that path demands a session
// that can manage users).

import { requestReset, sessionUser } from "@/server/auth";
import { userById } from "@/server/db";
import { json, tokenFrom } from "@/server/http";

export async function POST(req: Request) {
  let body: { tel?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, msg: "json gövdesi gerekli" }, 400);
  }

  if (body.userId) {
    const me = sessionUser(tokenFrom(req));
    if (!me || me.role !== "yonetici") return json({ ok: false, msg: "kullanıcı için kod üretmek yönetici oturumu ister" }, 401);
    const target = userById(String(body.userId));
    if (!target) return json({ ok: false, msg: "kullanıcı bulunamadı" }, 404);
    return json(requestReset(String(target.tel)));
  }

  return json(requestReset(String(body.tel || "")));
}
