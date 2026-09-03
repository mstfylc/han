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
      const sql = readFileSync(schemaPath(), "utf8");
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
    try { readFileSync(p); return p; } catch { /* try the next one */ }
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

export async function readScope(scope: string): Promise<DocumentRow[]> {
  await ready();
  const { rows } = await pool().query<DocumentRow>(
    "SELECT key, value, revision FROM documents WHERE scope = $1",
    [scope],
  );
  return rows;
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
