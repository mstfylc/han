// HAN — the database handle.
//
// One pool per process, reused across hot reloads in development (Next keeps
// the module registry warm, and a new pool per reload exhausts connections
// within a minute of editing).

import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const globalForDb = globalThis as unknown as { hanPool?: Pool; hanReady?: Promise<void> };

/**
 * How many connections this process may hold.
 *
 * On a long-running server one process serves everyone, so a real pool is
 * right. On serverless it is the opposite: every concurrent invocation is its
 * own process, and `max: 8` there means 8 × (however many lambdas are warm) —
 * which reaches Postgres' connection limit long before it reaches any traffic
 * worth having. One connection each, and a pooling endpoint (Neon's `-pooler`
 * host, or PgBouncer) in front, is the shape that survives.
 */
function poolSize(): number {
  const explicit = Number(process.env.HAN_DB_POOL);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return process.env.VERCEL ? 1 : 8;
}

export function pool(): Pool {
  if (!globalForDb.hanPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. The API cannot answer without a database — " +
          "see db/schema.sql and README for how to point it at one.",
      );
    }
    globalForDb.hanPool = new Pool({ connectionString, max: poolSize() });
  }
  return globalForDb.hanPool;
}

/**
 * Apply the schema once per process.
 *
 * The statements are idempotent, so running them on a cold start is safe. What
 * is NOT safe is running them from several cold starts at once: concurrent
 * `CREATE TABLE IF NOT EXISTS` on the same name deadlock against each other in
 * Postgres. One long-running server never noticed, because there was only ever
 * one process; serverless makes a burst of simultaneous cold starts the normal
 * case. An advisory lock makes the second one wait instead of failing.
 *
 * The lock is taken on a single checked-out client on purpose — advisory locks
 * belong to a session, so taking it via `pool.query` could unlock on a
 * different connection than it locked.
 */
export function ready(): Promise<void> {
  if (!globalForDb.hanReady) {
    globalForDb.hanReady = (async () => {
      const sql = readFileSync(/*turbopackIgnore: true*/ schemaPath(), "utf8");
      const client = await pool().connect();
      try {
        await client.query("SELECT pg_advisory_lock(hashtext('han-schema'))");
        await client.query(sql);
      } finally {
        await client.query("SELECT pg_advisory_unlock(hashtext('han-schema'))").catch(() => {});
        client.release();
      }
    })();
  }
  return globalForDb.hanReady;
}

/**
 * Where db/schema.sql actually is at runtime.
 *
 * `process.cwd()` is the project root under `next start` and under `next dev`,
 * but a serverless bundle is unpacked somewhere else entirely and only carries
 * the files the build tracer saw. It cannot see through a path built at
 * runtime, which is why next.config.ts names this file in
 * `outputFileTracingIncludes` — without that the first API call on Vercel dies
 * with ENOENT, and the app looks broken rather than misconfigured.
 */
function schemaPath(): string {
  const candidates = [
    path.join(process.cwd(), "db", "schema.sql"),
    // The traced copy lands beside the bundled route, under the task root.
    path.join(process.cwd(), ".next", "server", "db", "schema.sql"),
  ];
  for (const p of candidates) {
    try { readFileSync(/*turbopackIgnore: true*/ p); return p; } catch { /* try the next one */ }
  }
  throw new Error(
    "db/schema.sql not found at runtime. On Vercel this means the build did " +
      "not include it — check outputFileTracingIncludes in next.config.ts.",
  );
}

export interface DocumentRow {
  key: string;
  value: unknown;
  revision: string;
}

export async function readScope(scope: string, sinceRevision = 0): Promise<DocumentRow[]> {
  await ready();
  const hasSince = Number.isFinite(sinceRevision) && sinceRevision > 0;
  const { rows } = await pool().query<DocumentRow>(
    hasSince
      ? "SELECT key, value, revision FROM documents WHERE scope = $1 AND revision > $2"
      : "SELECT key, value, revision FROM documents WHERE scope = $1",
    hasSince ? [scope, sinceRevision] : [scope],
  );
  return rows;
}

export async function pingDb(): Promise<{ ok: boolean; documents: number; decisions: number; analytics: number }> {
  await ready();
  const { rows } = await pool().query<{ documents: string; decisions: string; analytics: string }>(
    `SELECT
       (SELECT COUNT(*)::text FROM documents) AS documents,
       (SELECT COUNT(*)::text FROM decisions) AS decisions,
       (SELECT COUNT(*)::text FROM analytics_events) AS analytics`,
  );
  const r = rows[0] || { documents: "0", decisions: "0", analytics: "0" };
  return {
    ok: true,
    documents: Number(r.documents) || 0,
    decisions: Number(r.decisions) || 0,
    analytics: Number(r.analytics) || 0,
  };
}

/** Dual-write key market documents into normalized row-level tables without breaking JSONB parity. */
export async function dualWriteNormalized(key: string, value: unknown): Promise<void> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  try {
    await ready();
    const map = value as Record<string, unknown>;
    if (key === "han-requests-v1") {
      const entries = Object.entries(map).slice(-200);
      for (const [id, raw] of entries) {
        if (!raw || typeof raw !== "object") continue;
        const r = raw as Record<string, unknown>;
        await pool().query(
          `INSERT INTO market_requests (id, product, qty, payload, updated_at)
                VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (id) DO UPDATE
                  SET product = EXCLUDED.product, qty = EXCLUDED.qty, payload = EXCLUDED.payload, updated_at = now()`,
          [id, String(r.urun || r.product || ""), String(r.adet || r.qty || ""), JSON.stringify(raw)],
        );
      }
    } else if (key === "han-offers-v1") {
      const entries = Object.entries(map).slice(-200);
      for (const [reqId, list] of entries) {
        if (!Array.isArray(list)) continue;
        for (const raw of list) {
          if (!raw || typeof raw !== "object") continue;
          const o = raw as Record<string, unknown>;
          const recId = String(o.recordId || o.curated || "");
          if (!recId) continue;
          const unit = Number(o.unit);
          await pool().query(
            `INSERT INTO market_offers (request_id, record_id, unit_price, payload, updated_at)
                  VALUES ($1, $2, $3, $4, now())
             ON CONFLICT (request_id, record_id) DO UPDATE
                    SET unit_price = EXCLUDED.unit_price, payload = EXCLUDED.payload, updated_at = now()`,
            [reqId, recId, Number.isFinite(unit) ? unit : null, JSON.stringify(raw)],
          );
        }
      }
    }
  } catch {
    // Non-blocking projection: never fail the primary JSONB write.
  }
}

export async function recordMediaAsset(row: {
  hash: string;
  recordId?: string | null;
  slug: string;
  url: string;
  mime: string;
  bytes: number;
  storage: string;
}): Promise<void> {
  await ready();
  await pool().query(
    `INSERT INTO media_assets (hash, record_id, slug, url, mime, bytes, storage)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (hash) DO NOTHING`,
    [row.hash, row.recordId || null, row.slug, row.url, row.mime, row.bytes, row.storage],
  );
}

export async function recordAnalyticsEvent(ev: {
  eventName: string;
  route?: string;
  placeId?: string | null;
  recordId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await ready();
  await pool().query(
    `INSERT INTO analytics_events (event_name, route, place_id, record_id, meta)
     VALUES ($1, $2, $3, $4, $5)`,
    [ev.eventName, ev.route || "", ev.placeId || null, ev.recordId || null, JSON.stringify(ev.meta || {})],
  );
}

export async function readAnalyticsSummary(): Promise<{ event_name: string; count: number }[]> {
  await ready();
  const { rows } = await pool().query<{ event_name: string; count: string }>(
    `SELECT event_name, COUNT(*)::text AS count
       FROM analytics_events
      WHERE created_at >= now() - interval '30 days'
      GROUP BY event_name
      ORDER BY COUNT(*) DESC
      LIMIT 30`,
  );
  return rows.map((r) => ({ event_name: r.event_name, count: Number(r.count) || 0 }));
}

export async function saveTraderOtp(tel: string, codeHash: string, ttlMinutes = 10): Promise<void> {
  await ready();
  await pool().query(
    `INSERT INTO trader_otps (tel, code_hash, expires_at)
          VALUES ($1, $2, now() + ($3 || ' minutes')::interval)
     ON CONFLICT (tel, code_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at, used_at = NULL`,
    [tel, codeHash, String(ttlMinutes)],
  );
}

export async function consumeTraderOtp(tel: string, codeHash: string): Promise<boolean> {
  await ready();
  const { rows } = await pool().query<{ tel: string }>(
    `UPDATE trader_otps
        SET used_at = now()
      WHERE tel = $1 AND code_hash = $2 AND used_at IS NULL AND expires_at > now()
      RETURNING tel`,
    [tel, codeHash],
  );
  return rows.length > 0;
}

/**
 * Write one document.
 *
 * `expected` is the revision the client last saw. When it is supplied and no
 * longer matches, the write is refused rather than applied: two people editing
 * the same queue must not silently overwrite each other. The caller gets the
 * current row back so it can merge and retry.
 */
export async function writeDocument(
  scope: string,
  key: string,
  value: unknown,
  expected?: number,
): Promise<{ ok: true; revision: string } | { ok: false; current: DocumentRow }> {
  await ready();
  if (expected == null) {
    const { rows } = await pool().query<{ revision: string }>(
      `INSERT INTO documents (scope, key, value)
            VALUES ($1, $2, $3)
       ON CONFLICT (scope, key) DO UPDATE
              SET value = EXCLUDED.value,
                  revision = documents.revision + 1,
                  updated_at = now()
        RETURNING revision`,
      [scope, key, JSON.stringify(value)],
    );
    return { ok: true, revision: rows[0].revision };
  }

  const { rows } = await pool().query<{ revision: string }>(
    `UPDATE documents
        SET value = $3, revision = revision + 1, updated_at = now()
      WHERE scope = $1 AND key = $2 AND revision = $4
      RETURNING revision`,
    [scope, key, JSON.stringify(value), expected],
  );
  if (rows.length) return { ok: true, revision: rows[0].revision };

  // Either the row moved on without us, or it does not exist yet.
  const { rows: cur } = await pool().query<DocumentRow>(
    "SELECT key, value, revision FROM documents WHERE scope = $1 AND key = $2",
    [scope, key],
  );
  if (!cur.length) {
    const { rows: ins } = await pool().query<{ revision: string }>(
      `INSERT INTO documents (scope, key, value) VALUES ($1, $2, $3)
       ON CONFLICT (scope, key) DO NOTHING
       RETURNING revision`,
      [scope, key, JSON.stringify(value)],
    );
    if (ins.length) return { ok: true, revision: ins[0].revision };
  }
  return { ok: false, current: cur[0] };
}

export async function deleteDocument(scope: string, key: string): Promise<void> {
  await ready();
  await pool().query("DELETE FROM documents WHERE scope = $1 AND key = $2", [scope, key]);
}

/** Append-only: a decision is never rewritten, so "why is this suspended?"
 *  stays answerable after the current state has moved on. */
export async function appendDecisions(
  rows: { recordId: string; status: string; via?: string | null; officer?: string | null }[],
): Promise<void> {
  if (!rows.length) return;
  await ready();
  const values: unknown[] = [];
  const tuples = rows.map((r, i) => {
    const b = i * 4;
    values.push(r.recordId, r.status, r.via ?? null, r.officer ?? null);
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4})`;
  });
  await pool().query(
    "INSERT INTO decisions (record_id, status, via, officer) VALUES " + tuples.join(", "),
    values,
  );
}

export async function readDecisions(limit = 200): Promise<
  { record_id: string; status: string; via: string | null; officer: string | null; decided_at: string }[]
> {
  await ready();
  const { rows } = await pool().query(
    "SELECT record_id, status, via, officer, decided_at FROM decisions ORDER BY decided_at DESC LIMIT $1",
    [limit],
  );
  return rows;
}

// ── HAN 2.0 Kademe 2: external cache, POIs, candidate shops & KVKK invites ──

export async function readExternalCache<T = unknown>(
  key: string,
): Promise<{ payload: T; fetchedAt: string; fresh: boolean } | null> {
  try {
    await ready();
    const { rows } = await pool().query<{ payload: T; fetched_at: string; fresh: boolean }>(
      `SELECT payload, fetched_at, (expires_at > now()) AS fresh
         FROM external_cache
        WHERE cache_key = $1`,
      [key],
    );
    if (!rows.length) return null;
    return { payload: rows[0].payload, fetchedAt: rows[0].fetched_at, fresh: Boolean(rows[0].fresh) };
  } catch {
    return null;
  }
}

export async function writeExternalCache(key: string, payload: unknown, ttlSeconds: number): Promise<void> {
  try {
    await ready();
    await pool().query(
      `INSERT INTO external_cache (cache_key, payload, fetched_at, expires_at)
            VALUES ($1, $2, now(), now() + ($3 || ' seconds')::interval)
       ON CONFLICT (cache_key) DO UPDATE
              SET payload = EXCLUDED.payload,
                  fetched_at = now(),
                  expires_at = EXCLUDED.expires_at`,
      [key, JSON.stringify(payload), String(Math.max(30, Math.round(ttlSeconds)))],
    );
  } catch {
    // Non-blocking cache write
  }
}

export interface ExternalPoiRow {
  id: string;
  source: string;
  kind: string;
  name: string;
  sub: string;
  tip: string;
  hours: string;
  lat: number;
  lng: number;
  tags: Record<string, unknown>;
  updated_at?: string;
}

export async function upsertExternalPois(items: ExternalPoiRow[]): Promise<number> {
  if (!items.length) return 0;
  await ready();
  let count = 0;
  for (const p of items) {
    await pool().query(
      `INSERT INTO external_pois (id, source, kind, name, sub, tip, hours, lat, lng, tags, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
       ON CONFLICT (id) DO UPDATE
              SET name = EXCLUDED.name,
                  sub = EXCLUDED.sub,
                  tip = EXCLUDED.tip,
                  hours = EXCLUDED.hours,
                  lat = EXCLUDED.lat,
                  lng = EXCLUDED.lng,
                  tags = EXCLUDED.tags,
                  updated_at = now()`,
      [p.id, p.source, p.kind, p.name, p.sub, p.tip, p.hours, p.lat, p.lng, JSON.stringify(p.tags || {})],
    );
    count += 1;
  }
  return count;
}

export async function readExternalPois(kind?: string | null): Promise<ExternalPoiRow[]> {
  try {
    await ready();
    const { rows } = await pool().query<ExternalPoiRow>(
      kind && kind !== "all"
        ? "SELECT id, source, kind, name, sub, tip, hours, lat, lng, tags, updated_at FROM external_pois WHERE kind = $1 ORDER BY updated_at DESC LIMIT 200"
        : "SELECT id, source, kind, name, sub, tip, hours, lat, lng, tags, updated_at FROM external_pois ORDER BY updated_at DESC LIMIT 250",
      kind && kind !== "all" ? [kind] : [],
    );
    return rows;
  } catch {
    return [];
  }
}

export interface CandidateShopRow {
  id: string;
  source: string;
  external_id: string | null;
  name: string;
  cat: string;
  place_id: string | null;
  semt: string | null;
  floor: number | null;
  door: string | null;
  tel: string;
  address: string;
  lat: number | null;
  lng: number | null;
  status: string;
  invite_token: string | null;
  notes: string;
  raw?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export async function upsertCandidateShop(row: Omit<CandidateShopRow, "created_at" | "updated_at">): Promise<CandidateShopRow> {
  await ready();
  const { rows } = await pool().query<CandidateShopRow>(
    `INSERT INTO candidate_shops
       (id, source, external_id, name, cat, place_id, semt, floor, door, tel, address, lat, lng, status, invite_token, notes, raw, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now())
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           cat = COALESCE(NULLIF(EXCLUDED.cat, ''), candidate_shops.cat),
           tel = COALESCE(NULLIF(EXCLUDED.tel, ''), candidate_shops.tel),
           address = COALESCE(NULLIF(EXCLUDED.address, ''), candidate_shops.address),
           lat = COALESCE(EXCLUDED.lat, candidate_shops.lat),
           lng = COALESCE(EXCLUDED.lng, candidate_shops.lng),
           updated_at = now()
     RETURNING *`,
    [
      row.id, row.source, row.external_id, row.name, row.cat,
      row.place_id, row.semt, row.floor, row.door, row.tel,
      row.address, row.lat, row.lng, row.status, row.invite_token,
      row.notes, JSON.stringify(row.raw || {}),
    ],
  );
  return rows[0];
}

export async function listCandidateShops(status?: string | null, limit = 100): Promise<CandidateShopRow[]> {
  await ready();
  const { rows } = await pool().query<CandidateShopRow>(
    status && status !== "all"
      ? "SELECT * FROM candidate_shops WHERE status = $1 ORDER BY updated_at DESC LIMIT $2"
      : "SELECT * FROM candidate_shops ORDER BY updated_at DESC LIMIT $1",
    status && status !== "all" ? [status, limit] : [limit],
  );
  return rows;
}

export async function updateCandidateShop(
  id: string,
  patch: Partial<Pick<CandidateShopRow, "status" | "name" | "cat" | "place_id" | "floor" | "door" | "tel" | "notes" | "invite_token">>,
): Promise<CandidateShopRow | null> {
  await ready();
  const { rows } = await pool().query<CandidateShopRow>(
    `UPDATE candidate_shops
        SET status = COALESCE($2, status),
            name = COALESCE($3, name),
            cat = COALESCE($4, cat),
            place_id = COALESCE($5, place_id),
            floor = COALESCE($6, floor),
            door = COALESCE($7, door),
            tel = COALESCE($8, tel),
            notes = COALESCE($9, notes),
            invite_token = COALESCE($10, invite_token),
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [
      id,
      patch.status ?? null,
      patch.name ?? null,
      patch.cat ?? null,
      patch.place_id ?? null,
      patch.floor ?? null,
      patch.door ?? null,
      patch.tel ?? null,
      patch.notes ?? null,
      patch.invite_token ?? null,
    ],
  );
  return rows[0] || null;
}

export async function findCandidateByToken(token: string): Promise<CandidateShopRow | null> {
  await ready();
  const { rows } = await pool().query<CandidateShopRow>(
    "SELECT * FROM candidate_shops WHERE invite_token = $1 LIMIT 1",
    [token],
  );
  return rows[0] || null;
}

export async function isContactOptedOut(contactNorm: string): Promise<boolean> {
  if (!contactNorm) return false;
  await ready();
  const { rows } = await pool().query<{ contact_norm: string }>(
    "SELECT contact_norm FROM opt_out_contacts WHERE contact_norm = $1 LIMIT 1",
    [contactNorm],
  );
  return rows.length > 0;
}

export async function addContactOptOut(contactNorm: string, reason = "kvkk-optout"): Promise<void> {
  if (!contactNorm) return;
  await ready();
  await pool().query(
    `INSERT INTO opt_out_contacts (contact_norm, reason)
          VALUES ($1, $2)
     ON CONFLICT (contact_norm) DO UPDATE SET reason = EXCLUDED.reason`,
    [contactNorm, reason],
  );
}

export async function hasRecentInvite(contactNorm: string, days = 30): Promise<boolean> {
  if (!contactNorm) return false;
  await ready();
  const { rows } = await pool().query<{ id: string }>(
    `SELECT id::text FROM invite_logs
      WHERE contact_norm = $1
        AND created_at > now() - ($2 || ' days')::interval
      LIMIT 1`,
    [contactNorm, String(days)],
  );
  return rows.length > 0;
}

export async function logInvite(entry: {
  candidateId?: string | null;
  contactNorm: string;
  channel: string;
  token?: string | null;
  officer?: string | null;
}): Promise<void> {
  await ready();
  await pool().query(
    `INSERT INTO invite_logs (candidate_id, contact_norm, channel, token, officer)
     VALUES ($1, $2, $3, $4, $5)`,
    [entry.candidateId || null, entry.contactNorm, entry.channel, entry.token || null, entry.officer || null],
  );
}

export async function listInviteLogs(limit = 50): Promise<
  { id: string; candidate_id: string | null; contact_norm: string; channel: string; officer: string | null; created_at: string }[]
> {
  await ready();
  const { rows } = await pool().query(
    "SELECT id::text, candidate_id, contact_norm, channel, officer, created_at FROM invite_logs ORDER BY created_at DESC LIMIT $1",
    [limit],
  );
  return rows;
}
