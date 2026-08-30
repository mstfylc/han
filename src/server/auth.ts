// HAN — operations sign-in, server side.
//
// This replaces the prototype's browser-side PIN store wholesale. The rules it
// has to hold, and why each one is here rather than in the client:
//
//   · The PIN is never stored, sent back, or comparable in the browser. Only a
//     scrypt hash is kept, and verification is a constant-time compare.
//   · The attempt counter and the lockout are the server's. A counter the
//     client owns is not a limit, it is a suggestion.
//   · Reset codes are hashed, single-use and expiring, so a leaked database row
//     is not a working code and a used code cannot be replayed.
//   · The session is an opaque random token; the database stores only its
//     hash, so a database dump cannot be replayed as a login. The browser holds
//     it in an httpOnly cookie, which page JavaScript cannot read at all.
//   · "No such user" and "user exists" return the same shape from the reset
//     flow, so the endpoint cannot be used to discover who has an account.

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { pool, ready } from "./db";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const N = 16384, R = 8, P = 1, KEYLEN = 32;

export const MAX_TRIES = 5;
export const LOCK_MINUTES = 15;
export const RESET_TTL_MIN = 15;
export const SESSION_DAYS = 14;
export const COOKIE = "han_ops";

// ── secrets ───────────────────────────────────────────────────────────────

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pin, salt, KEYLEN);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [tag, , , , saltB64, keyB64] = stored.split("$");
  if (tag !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(pin, Buffer.from(saltB64, "base64"), expected.length);
  // Constant time: a comparison that returns early leaks the prefix length.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Digits only, so "0532 111 22 33" and "+90 532 111 2233" are one person. */
export const normTel = (tel: string) => String(tel || "").replace(/\D/g, "");

// ── users ─────────────────────────────────────────────────────────────────

export interface OpsUserRow {
  id: string;
  name: string;
  tel: string;
  role: string;
  place: string | null;
  officer: string | null;
  active: boolean;
  pin_hash: string | null;
  tries: number;
  locked_until: string | null;
  last_seen: string | null;
}

/** What is safe to hand to the browser — never the hash, never the counters. */
export interface PublicUser {
  id: string;
  name: string;
  tel: string;
  role: string;
  place: string | null;
  officer: string | null;
}

export function toPublic(u: OpsUserRow): PublicUser {
  return { id: u.id, name: u.name, tel: u.tel, role: u.role, place: u.place, officer: u.officer };
}

export async function userByTel(tel: string): Promise<OpsUserRow | null> {
  await ready();
  const { rows } = await pool().query<OpsUserRow>(
    "SELECT * FROM ops_users WHERE tel = $1",
    [normTel(tel)],
  );
  return rows[0] || null;
}

export async function countUsers(): Promise<number> {
  await ready();
  const { rows } = await pool().query<{ n: string }>("SELECT count(*)::text AS n FROM ops_users");
  return Number(rows[0].n);
}

export async function createUser(u: {
  name?: string; tel: string; role?: string; place?: string | null; officer?: string | null;
}): Promise<OpsUserRow | null> {
  await ready();
  const id = "us" + randomBytes(8).toString("hex");
  const { rows } = await pool().query<OpsUserRow>(
    `INSERT INTO ops_users (id, name, tel, role, place, officer)
          VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (tel) DO NOTHING
       RETURNING *`,
    [id, u.name || "", normTel(u.tel), u.role || "okuma", u.place ?? null, u.officer ?? null],
  );
  return rows[0] || null;
}

// ── sign-in ───────────────────────────────────────────────────────────────

export type LoginOutcome =
  | { ok: true; user: OpsUserRow; token: string }
  | { ok: false; reason: "unknown" | "disabled" | "locked" | "nopin" | "wrong"; left?: number };

export async function login(tel: string, pin: string): Promise<LoginOutcome> {
  const u = await userByTel(tel);
  if (!u) return { ok: false, reason: "unknown" };
  if (!u.active) return { ok: false, reason: "disabled" };
  if (u.locked_until && new Date(u.locked_until).getTime() > Date.now()) {
    return { ok: false, reason: "locked" };
  }
  if (!u.pin_hash) return { ok: false, reason: "nopin" };

  if (!(await verifyPin(pin, u.pin_hash))) {
    const tries = u.tries + 1;
    const lock = tries >= MAX_TRIES;
    await pool().query(
      `UPDATE ops_users
          SET tries = $2,
              locked_until = CASE WHEN $3 THEN now() + ($4 || ' minutes')::interval ELSE locked_until END
        WHERE id = $1`,
      [u.id, lock ? 0 : tries, lock, String(LOCK_MINUTES)],
    );
    return { ok: false, reason: lock ? "locked" : "wrong", left: Math.max(0, MAX_TRIES - tries) };
  }

  await pool().query(
    "UPDATE ops_users SET tries = 0, locked_until = NULL, last_seen = now() WHERE id = $1",
    [u.id],
  );
  return { ok: true, user: u, token: await openSession(u.id) };
}

export async function openSession(userId: string): Promise<string> {
  await ready();
  const token = randomBytes(32).toString("base64url");
  await pool().query(
    `INSERT INTO ops_sessions (token_hash, user_id, expires_at)
          VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [sha(token), userId, String(SESSION_DAYS)],
  );
  return token;
}

export async function sessionUser(token: string | undefined): Promise<OpsUserRow | null> {
  if (!token) return null;
  await ready();
  const { rows } = await pool().query<OpsUserRow>(
    `SELECT u.* FROM ops_sessions s
       JOIN ops_users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`,
    [sha(token)],
  );
  return rows[0] || null;
}

export async function closeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await ready();
  await pool().query("DELETE FROM ops_sessions WHERE token_hash = $1", [sha(token)]);
}

// ── password reset ────────────────────────────────────────────────────────

/**
 * Issue a reset code.
 *
 * The code is returned to the CALLER (the route), never automatically to the
 * browser: without an SMS gateway there is no way to deliver it, so the route
 * decides — and only exposes it when the deployment has explicitly opted in to
 * development mode. Shipping the code to whoever asks would mean anyone who
 * knows a phone number can take over that account.
 */
export async function issueReset(tel: string): Promise<{ code: string; userId: string } | null> {
  const u = await userByTel(tel);
  if (!u || !u.active) return null;
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await pool().query(
    `INSERT INTO ops_resets (code_hash, user_id, expires_at)
          VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
    [sha(code), u.id, String(RESET_TTL_MIN)],
  );
  return { code, userId: u.id };
}

export async function applyReset(
  code: string,
  pin: string,
): Promise<{ ok: true; user: OpsUserRow; token: string } | { ok: false; reason: "bad" | "weak" }> {
  if (!/^\d{4,8}$/.test(String(pin))) return { ok: false, reason: "weak" };
  await ready();
  // Single-use is enforced in the UPDATE, not by a read-then-write: two
  // requests racing on the same code must not both succeed.
  const { rows } = await pool().query<{ user_id: string }>(
    `UPDATE ops_resets SET used_at = now()
      WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [sha(String(code))],
  );
  if (!rows.length) return { ok: false, reason: "bad" };

  const userId = rows[0].user_id;
  const hash = await hashPin(pin);
  const { rows: us } = await pool().query<OpsUserRow>(
    `UPDATE ops_users
        SET pin_hash = $2, tries = 0, locked_until = NULL, last_seen = now()
      WHERE id = $1
      RETURNING *`,
    [userId, hash],
  );
  if (!us.length) return { ok: false, reason: "bad" };

  // Setting a new password ends every other session: if the reset was because
  // someone else had the account, leaving their session alive defeats it.
  await pool().query("DELETE FROM ops_sessions WHERE user_id = $1", [userId]);
  return { ok: true, user: us[0], token: await openSession(userId) };
}

export function maskTel(tel: string): string {
  const t = normTel(tel);
  return t.length < 6 ? "•••" : t.slice(0, 3) + " ••• •• " + t.slice(-2);
}

/** Development convenience, off unless the deployment asks for it. Never true
 *  in production, so a reset code is never returned over the wire there. */
export function showsResetCode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.HAN_DEV_SHOW_RESET_CODE === "1";
}
