// HAN — the operations team.
//
// Roles are the thing that decides what a person may write, so changing one is
// itself a privileged act. Everything here requires a session with the
// `yetkililer` permission, checked on the server — the panel's own navigation
// hiding the tab is not a control.
//
// Two rules that exist to stop an account taking itself hostage or running away
// with the place:
//   · Nobody can change their OWN role or disable themselves. Otherwise a
//     mis-click locks the last administrator out of their own deployment, and a
//     compromised session can quietly promote itself.
//   · A new account is created WITHOUT a password. The person sets their own
//     through the reset flow, so no administrator ever knows it.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { pool, ready } from "@/server/db";
import { COOKIE, createUser, normTel, sessionUser, toPublic } from "@/server/auth";
import { ROLES, can } from "@/data/han-scale";

export const dynamic = "force-dynamic";

async function requireOps() {
  const jar = await cookies();
  const me = await sessionUser(jar.get(COOKIE)?.value);
  if (!me) return { error: NextResponse.json({ error: "anonymous" }, { status: 401 }) };
  if (!can(me.role, "yetkililer")) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { me };
}

export async function GET() {
  const gate = await requireOps();
  if (gate.error) return gate.error;
  try {
    await ready();
    const { rows } = await pool().query(
      `SELECT id, name, tel, role, place, officer, active, last_seen
         FROM ops_users ORDER BY created_at`,
    );
    // Never the hash, never the attempt counter.
    return NextResponse.json({
      users: rows.map((u) => ({
        id: u.id, name: u.name, tel: u.tel, role: u.role,
        place: u.place, officer: u.officer, active: u.active, lastSeen: u.last_seen,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await requireOps();
  if (gate.error) return gate.error;
  const me = gate.me!;

  let body: { action?: string; id?: string; name?: string; tel?: string; role?: string; active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body is not JSON" }, { status: 400 });
  }

  try {
    if (body.action === "create") {
      const tel = normTel(body.tel || "");
      if (tel.length < 10) return NextResponse.json({ ok: false, error: "tel" }, { status: 400 });
      const role = ROLES[String(body.role)] ? String(body.role) : "okuma";
      const created = await createUser({ name: String(body.name || ""), tel, role });
      if (!created) return NextResponse.json({ ok: false, error: "exists" }, { status: 409 });
      return NextResponse.json({ ok: true, user: toPublic(created) });
    }

    if (body.action === "role") {
      const id = String(body.id || "");
      const role = String(body.role || "");
      if (!ROLES[role]) return NextResponse.json({ ok: false, error: "role" }, { status: 400 });
      // Changing your own role is how an account promotes itself; refuse it.
      if (id === me.id) return NextResponse.json({ ok: false, error: "self" }, { status: 400 });
      await ready();
      await pool().query("UPDATE ops_users SET role = $2 WHERE id = $1", [id, role]);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "active") {
      const id = String(body.id || "");
      // Disabling yourself locks you out of the deployment you administer.
      if (id === me.id) return NextResponse.json({ ok: false, error: "self" }, { status: 400 });
      await ready();
      await pool().query("UPDATE ops_users SET active = $2 WHERE id = $1", [id, !!body.active]);
      // A disabled account must not keep working through an open session.
      if (!body.active) await pool().query("DELETE FROM ops_sessions WHERE user_id = $1", [id]);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
}
