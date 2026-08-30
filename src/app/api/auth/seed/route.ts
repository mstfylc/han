// First-admin setup. Only works while the user directory is empty — the same
// dead-end the Giriş screen closes: nobody registered means nobody can sign
// in, so the first manager is created here and immediately gets a reset code
// to set their own password.

import { requestReset } from "@/server/auth";
import { allUsers, kvSet } from "@/server/db";
import { json } from "@/server/http";

export async function POST(req: Request) {
  if (allUsers().length > 0) return json({ ok: false, msg: "Sistemde zaten kullanıcı var." }, 409);

  let body: { tel?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const tel = String(body.tel || "").replace(/\D/g, "") || "5320000000";

  // Shape matches the panel's own OpsUser records so the Kullanıcılar tab
  // manages this account like any other.
  const rec = {
    id: "us" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: "İlk Yönetici",
    tel,
    role: "yonetici",
    place: null,
    officer: null,
    active: true,
    createdAt: Date.now(),
    lastSeen: null,
  };
  kvSet("han-users-v1", [rec]);
  return json({ ...requestReset(tel), user: rec });
}
