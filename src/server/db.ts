// HAN — the server-side store.
//
// The prototype kept every store under a localStorage key (han-*-v1); the plan
// said that becomes a server in production. This is that server, kept
// deliberately shaped like the thing it replaces: one KV table whose keys ARE
// the prototype's storage keys, so the entire ported data engine keeps working
// unchanged — the browser now hydrates from here and writes back through
// /api/store, and two different browsers finally see the same bazaar.
//
// Auth is the exception: PINs, attempt counters, reset codes and sessions are
// NOT mirrors of browser state. They live only here, hashed where relevant —
// exactly the three things the Giriş screen's footnote promised would move
// server-side.

import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const DB_DIR = process.env.HAN_DB_DIR || path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "han.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(DB_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS creds (
      user_id  TEXT PRIMARY KEY,
      pin_hash TEXT,
      salt     TEXT,
      tries    INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS resets (
      code_hash TEXT PRIMARY KEY,
      user_id   TEXT NOT NULL,
      at        INTEGER NOT NULL,
      used      INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token   TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      at      INTEGER NOT NULL
    );
  `);
  return db;
}

// ── KV ────────────────────────────────────────────────────────────────────

/** Only the product's own stores are accepted; the API must not become a
 *  general-purpose dumping ground. */
export const KEY_RE = /^han-[a-z0-9-]{1,64}$/;

export function kvGetAll(): Record<string, unknown> {
  const rows = getDb().prepare("SELECT key, value FROM kv").all() as { key: string; value: string }[];
  const out: Record<string, unknown> = {};
  rows.forEach((r) => {
    try { out[r.key] = JSON.parse(r.value); } catch { /* a corrupt row must not sink the rest */ }
  });
  return out;
}

export function kvGet(key: string): unknown {
  const row = getDb().prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) return undefined;
  try { return JSON.parse(row.value); } catch { return undefined; }
}

export function kvSet(key: string, value: unknown): void {
  getDb()
    .prepare("INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(key, JSON.stringify(value ?? null), Date.now());
}

// ── users (read from the same KV the panel writes) ───────────────────────
// The user directory itself is product data managed on the Kullanıcılar tab
// (han-users-v1). Only the secrets about those users live in their own tables.

export interface KvUser {
  id: string;
  name: string;
  role: string;
  tel: string | number;
  active?: boolean;
  scope?: string | null;
  [k: string]: unknown;
}

export function allUsers(): KvUser[] {
  const v = kvGet("han-users-v1");
  return Array.isArray(v) ? (v as KvUser[]) : [];
}

export function userByTel(tel: string): KvUser | null {
  const t = String(tel || "").replace(/\D/g, "");
  return allUsers().find((u) => String(u.tel || "").replace(/\D/g, "") === t) || null;
}

export function userById(id: string): KvUser | null {
  return allUsers().find((u) => u.id === id) || null;
}
