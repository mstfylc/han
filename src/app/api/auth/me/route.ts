import { hasPin, sessionUser } from "@/server/auth";
import { allUsers } from "@/server/db";
import { json, tokenFrom } from "@/server/http";

export async function GET(req: Request) {
  const u = sessionUser(tokenFrom(req));
  // noUsers travels with me: the Giriş screen decides whether to offer the
  // first-admin setup from the same request that told it nobody is signed in.
  return json({
    ok: true,
    user: u,
    noUsers: allUsers().length === 0,
    // The Kullanıcılar tab shows who has a password set; only an operations
    // session gets that map.
    pins: u ? Object.fromEntries(allUsers().map((x) => [x.id, hasPin(x.id)])) : undefined,
  });
}
