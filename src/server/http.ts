// Small HTTP helpers shared by the route handlers — plain Web APIs, no
// framework magic, so the auth cookie behaves identically everywhere.

import { SESSION_COOKIE, SESSION_TTL_MS } from "./auth";

export function tokenFrom(req: Request): string | null {
  const raw = req.headers.get("cookie") || "";
  const hit = raw.split(/;\s*/).find((c) => c.startsWith(SESSION_COOKIE + "="));
  return hit ? decodeURIComponent(hit.slice(SESSION_COOKIE.length + 1)) : null;
}

export function withSessionCookie(res: Response, token: string | null): Response {
  const base = SESSION_COOKIE + "=" + (token ? encodeURIComponent(token) : "") +
    "; Path=/; HttpOnly; SameSite=Lax" +
    (token ? "; Max-Age=" + Math.floor(SESSION_TTL_MS / 1000) : "; Max-Age=0");
  res.headers.append("Set-Cookie", base);
  return res;
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}
