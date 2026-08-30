// HAN — the database handle.
//
// One pool per process, reused across hot reloads in development (Next keeps
// the module registry warm, and a new pool per reload exhausts connections
// within a minute of editing).

import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const globalForDb = globalThis as unknown as { hanPool?: Pool; hanReady?: Promise<void> };

export function pool(): Pool {
  if (!globalForDb.hanPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. The API cannot answer without a database — " +
          "see db/schema.sql and README for how to point it at one.",
      );
    }
    globalForDb.hanPool = new Pool({ connectionString, max: 8 });
  }
  return globalForDb.hanPool;
}

/** Apply the schema once per process. It is written to be idempotent, so this
 *  is safe on every cold start and needs no migration runner yet. */
export function ready(): Promise<void> {
  if (!globalForDb.hanReady) {
    const sql = readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
    globalForDb.hanReady = pool().query(sql).then(() => undefined);
  }
  return globalForDb.hanReady;
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
