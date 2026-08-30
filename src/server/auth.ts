// HAN — server-side authentication.
//
// The Giriş screen's footnote, kept: the PIN is hashed and never returned,
// attempts are counted here (not in a counter the browser could reset), the
// reset code is single-use with a 15-minute TTL and only its hash is stored,
// and the session is an httpOnly cookie the page's scripts cannot read.
//
// The error surface mirrors the prototype's LoginResult exactly, including the
// privacy rule: an unknown phone gets the same reset answer as a known one, so
// the queue cannot be used to discover who is registered.

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { allUsers, getDb, userByTel, userById } from "./db";
import type { KvUser } from "./db";
import { sendSms, smsConfigured } from "./sms";

export const RESET_TTL_MIN = 15;
export const MAX_TRIES = 5;
export const SESSION_COOKIE = "han_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const digits = (x: unknown) => String(x ?? "").replace(/\D/g, "");

function hashPin(pin: string, salt: string): string {
  return scryptSync(String(pin), salt, 32).toString("hex");
}

function hashCode(code: string): string {
  return createHash("sha256").update(String(code)).digest("hex");
}

export function maskTel(tel: string | number): string {
  const t = digits(tel);
  return t.length < 6 ? "•••" : t.slice(0, 3) + " ••• •• " + t.slice(-2);
}

// ── credentials ───────────────────────────────────────────────────────────

export function hasPin(userId: string): boolean {
  const row = getDb().prepare("SELECT pin_hash FROM creds WHERE user_id = ?").get(userId) as { pin_hash: string | null } | undefined;
  return !!row?.pin_hash;
}

function setPin(userId: string, pin: string): void {
  const salt = randomBytes(16).toString("hex");
  getDb()
    .prepare("INSERT INTO creds (user_id, pin_hash, salt, tries) VALUES (?, ?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET pin_hash = excluded.pin_hash, salt = excluded.salt, tries = 0")
    .run(userId, hashPin(pin, salt), salt);
}

// ── sessions ──────────────────────────────────────────────────────────────

export function openSession(userId: string): string {
  const token = randomBytes(24).toString("hex");
  getDb().prepare("INSERT INTO sessions (token, user_id, at) VALUES (?, ?, ?)").run(token, userId, Date.now());
  return token;
}

export function closeSession(token: string | undefined | null): void {
  if (token) getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function sessionUser(token: string | undefined | null): KvUser | null {
  if (!token) return null;
  const row = getDb().prepare("SELECT user_id, at FROM sessions WHERE token = ?").get(token) as { user_id: string; at: number } | undefined;
  if (!row) return null;
  if (Date.now() - row.at > SESSION_TTL_MS) {
    closeSession(token);
    return null;
  }
  const u = userById(row.user_id);
  return u && u.active !== false ? u : null;
}

// ── login ─────────────────────────────────────────────────────────────────

export type LoginError = "yok" | "kapali" | "kilit" | "pinsiz" | "hatali";

export interface LoginOutcome {
  ok: boolean;
  err?: LoginError;
  msg?: string;
  user?: KvUser;
  userId?: string;
  token?: string;
}

export function login(tel: string, pin: string): LoginOutcome {
  const u = userByTel(tel);
  if (!u) return { ok: false, err: "yok", msg: "Bu telefonla kayıtlı kullanıcı yok." };
  if (u.active === false) return { ok: false, err: "kapali", msg: "Bu hesap kapatılmış. Yöneticinize başvurun." };

  const db = getDb();
  const cred = db.prepare("SELECT pin_hash, salt, tries FROM creds WHERE user_id = ?").get(u.id) as
    | { pin_hash: string | null; salt: string | null; tries: number }
    | undefined;

  if (!cred?.pin_hash || !cred.salt) {
    return { ok: false, err: "pinsiz", msg: "Bu hesaba henüz şifre kurulmadı. “Şifremi unuttum” ile kurun.", userId: u.id };
  }
  if (cred.tries >= MAX_TRIES) {
    return { ok: false, err: "kilit", msg: "Çok fazla hatalı deneme. Şifrenizi sıfırlayın." };
  }

  const given = Buffer.from(hashPin(String(pin), cred.salt), "hex");
  const kept = Buffer.from(cred.pin_hash, "hex");
  const match = given.length === kept.length && timingSafeEqual(given, kept);
  if (!match) {
    db.prepare("UPDATE creds SET tries = tries + 1 WHERE user_id = ?").run(u.id);
    return { ok: false, err: "hatali", msg: "Şifre yanlış. Kalan deneme: " + (MAX_TRIES - cred.tries - 1) };
  }

  db.prepare("UPDATE creds SET tries = 0 WHERE user_id = ?").run(u.id);
  return { ok: true, user: u, token: openSession(u.id) };
}

// ── reset codes ───────────────────────────────────────────────────────────

/** With an SMS provider configured (src/server/sms.ts) the code goes out as a
 *  text and never reaches the screen. Without one it has nowhere to go but
 *  back to the response, and the UI keeps its "PROTOTİP" notice. */
export async function requestReset(tel: string): Promise<{ ok: boolean; msg?: string; masked: string; demoCode: string | null }> {
  const u = userByTel(tel);
  // Same answer whether or not the phone is registered.
  if (!u) return { ok: true, masked: maskTel(tel), demoCode: null };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  getDb().prepare("INSERT INTO resets (code_hash, user_id, at, used) VALUES (?, ?, ?, 0)").run(hashCode(code), u.id, Date.now());

  if (smsConfigured()) {
    const sent = await sendSms(String(u.tel), "HAN doğrulama kodunuz: " + code + " — " + RESET_TTL_MIN + " dk geçerli, kimseyle paylaşmayın.");
    // A code that could not be delivered must not fall back to the screen;
    // that would quietly undo SMS delivery for whoever the message failed for.
    if (!sent) return { ok: false, msg: "Kod gönderilemedi. Biraz sonra yeniden deneyin.", masked: maskTel(String(u.tel)), demoCode: null };
    return { ok: true, masked: maskTel(String(u.tel)), demoCode: null };
  }

  return { ok: true, masked: maskTel(String(u.tel)), demoCode: code };
}

export function applyReset(code: string, pin: string): { ok: boolean; msg?: string; user?: KvUser; token?: string } {
  const row = getDb().prepare("SELECT code_hash, user_id, at, used FROM resets WHERE code_hash = ?").get(hashCode(digits(code))) as
    | { code_hash: string; user_id: string; at: number; used: number }
    | undefined;
  if (!row) return { ok: false, msg: "Kod geçersiz." };
  if (row.used) return { ok: false, msg: "Bu kod bir kez kullanıldı. Yeni kod isteyin." };
  if (Date.now() - row.at > RESET_TTL_MIN * 60000) return { ok: false, msg: "Kodun süresi doldu. Yeni kod isteyin." };
  if (!/^\d{4,8}$/.test(digits(pin))) return { ok: false, msg: "Şifre 4–8 haneli sayı olmalı." };

  const u = userById(row.user_id);
  if (!u || u.active === false) return { ok: false, msg: "Bu hesap kapatılmış. Yöneticinize başvurun." };

  getDb().prepare("UPDATE resets SET used = 1 WHERE code_hash = ?").run(row.code_hash);
  setPin(u.id, digits(pin));
  return { ok: true, user: u, token: openSession(u.id) };
}

// ── write guard ───────────────────────────────────────────────────────────
// The keys only the operations side writes. While no user exists yet the
// system is in bootstrap: everything stays open so the demo works out of the
// box; the moment the first user is created, these keys demand a session
// whose role is not read-only.

const PROTECTED_KEYS = new Set([
  "han-users-v1",
  "han-settings-v1",
  "han-sponsors-v1",
  "han-places-v1",
  "han-moderation-v1",
  "han-nudges-v1",
  "han-tasks-v1",
  "han-lexicon-v1",
  "han-content-v1",
  "han-media-v1",
  "han-geo-v1",
  "han-approvals-v1",
  "han-panel-drafts",
]);

const READ_ONLY_ROLES = new Set(["okuma", "han"]);

export function canWriteKey(key: string, token: string | undefined | null): boolean {
  if (!PROTECTED_KEYS.has(key)) return true;
  if (allUsers().length === 0) return true; // bootstrap
  const u = sessionUser(token);
  return !!u && !READ_ONLY_ROLES.has(u.role);
}
