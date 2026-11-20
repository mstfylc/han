// HAN 2.0 — Server-side RBAC helper for privileged external sync, candidate queue & invite routes.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { COOKIE, sessionUser, type OpsUserRow } from "./auth";

export async function requireOpsWriter(): Promise<
  { me: OpsUserRow; error?: undefined } | { me?: undefined; error: NextResponse }
> {
  const jar = await cookies();
  const me = await sessionUser(jar.get(COOKIE)?.value);
  if (!me) {
    return { error: NextResponse.json({ ok: false, error: "anonymous" }, { status: 401 }) };
  }
  if (me.role === "okuma") {
    return { error: NextResponse.json({ ok: false, error: "forbidden_read_only" }, { status: 403 }) };
  }
  return { me };
}

export async function requireOpsReader(): Promise<
  { me: OpsUserRow; error?: undefined } | { me?: undefined; error: NextResponse }
> {
  const jar = await cookies();
  const me = await sessionUser(jar.get(COOKIE)?.value);
  if (!me) {
    return { error: NextResponse.json({ ok: false, error: "anonymous" }, { status: 401 }) };
  }
  return { me };
}

export function normalizeContact(raw: string): string {
  const s = String(raw || "").trim();
  if (s.includes("@")) return s.toLowerCase();
  const digits = s.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) return "90" + digits.slice(1);
  if (digits.length === 10 && digits.startsWith("5")) return "90" + digits;
  return digits;
}
