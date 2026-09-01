// HAN — the sign-in endpoints.
//
// One route, four actions, because they share the cookie handling and the rule
// that failures must not leak who has an account.
//
//   GET                       → who am I (or null)
//   POST { action: "login" }  → tel + pin
//   POST { action: "reset" }  → ask for a code
//   POST { action: "apply" }  → code + new pin
//   POST { action: "logout" } → end this session

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  COOKIE, MAX_TRIES, RESET_TTL_MIN, SESSION_DAYS,
  applyReset, closeSession, countUsers, createUser, issueReset, login,
  maskTel, normTel, sessionUser, showsResetCode, toPublic,
} from "@/server/auth";
import { canDeliver, notifier } from "@/server/notify";

export const dynamic = "force-dynamic";

function withSession(res: NextResponse, token: string): NextResponse {
  res.cookies.set(COOKIE, token, {
    httpOnly: true,       // page scripts cannot read it, so XSS cannot steal it
    sameSite: "lax",      // not sent on cross-site POSTs
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
}

export async function GET() {
  try {
    // Next 16: cookies() is async, like every other request API.
    const jar = await cookies();
    const me = await sessionUser(jar.get(COOKIE)?.value);
    return NextResponse.json({
      user: me ? toPublic(me) : null,
      // The very first person to arrive at an empty deployment has to be able
      // to become the administrator; after that this is false and the screen
      // stops offering it.
      bootstrap: (await countUsers()) === 0,
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: { action?: string; tel?: string; pin?: string; code?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body is not JSON" }, { status: 400 });
  }

  const jar = await cookies();

  try {
    if (body.action === "logout") {
      await closeSession(jar.get(COOKIE)?.value);
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(COOKIE);
      return res;
    }

    if (body.action === "login") {
      const tel = normTel(body.tel || "");
      const pin = String(body.pin || "");
      if (!tel || !pin) return NextResponse.json({ ok: false, reason: "missing" }, { status: 400 });

      const out = await login(tel, pin);
      if (out.ok) {
        return withSession(NextResponse.json({ ok: true, user: toPublic(out.user) }), out.token);
      }
      // "nopin" is deliberately distinguishable: the account exists but has no
      // password yet, and the screen has to send the person to the reset flow
      // instead of telling them their password is wrong.
      return NextResponse.json(
        { ok: false, reason: out.reason, left: out.left, maxTries: MAX_TRIES },
        { status: 401 },
      );
    }

    if (body.action === "reset") {
      const tel = normTel(body.tel || "");
      if (!tel) return NextResponse.json({ ok: false }, { status: 400 });

      // Bootstrap: an empty deployment lets the first caller open the first
      // administrator account. Once anyone exists this branch is dead, so it
      // cannot be used later to mint a second one.
      if ((await countUsers()) === 0) {
        await createUser({ name: String(body.name || "İlk Yönetici"), tel, role: "yonetici" });
      }

      const issued = await issueReset(tel);

      // Hand it to whatever channel is configured. Awaited but never allowed to
      // throw, and its result is NOT reflected in the response: "we could not
      // deliver" would tell a stranger this number has no account.
      if (issued) {
        await notifier().send({
          to: tel,
          kind: "reset-code",
          text: `HAN doğrulama kodunuz: ${issued.code} — ${RESET_TTL_MIN} dakika geçerli.`,
        });
      }

      // The SAME answer whether or not the number is registered: otherwise this
      // endpoint becomes a way to find out who has an account.
      return NextResponse.json({
        ok: true,
        masked: maskTel(tel),
        ttl: RESET_TTL_MIN,
        // Whether a real channel exists at all is not a secret — it is the same
        // for every caller, and the screen has to be able to say something true
        // about what just happened rather than promising an SMS that is not
        // coming.
        delivered: canDeliver(),
        // Only when the deployment has explicitly opted in, and never in
        // production. Handing the code to whoever asked for it would mean
        // anyone who knows a phone number could take the account.
        devCode: issued && showsResetCode() ? issued.code : undefined,
      });
    }

    if (body.action === "apply") {
      const out = await applyReset(String(body.code || ""), String(body.pin || ""));
      if (out.ok) {
        return withSession(NextResponse.json({ ok: true, user: toPublic(out.user) }), out.token);
      }
      return NextResponse.json({ ok: false, reason: out.reason }, { status: 400 });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
}
