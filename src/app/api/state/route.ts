// HAN — the state API.
//
// The whole client persistence layer talks to exactly these two handlers, which
// is the point of having had a StorageDriver seam all along: the screens did
// not change to get here.
//
// GET  /api/state?scope=shared&scope=user:abc   → every document in those scopes
// PUT  /api/state                               → a batch of writes
//
// Scope rules live in src/services/storage.ts and are enforced again here, so a
// crafted request cannot write a local-only key (the prototype PIN store) into
// the shared database.

import { NextResponse } from "next/server";

import { readScope, writeDocument, deleteDocument } from "@/server/db";
import { SYNCED_KEYS, isSharedKey } from "@/services/scopes";

export const dynamic = "force-dynamic";

/** A scope is either the market's own state or one person's. Anything else is
 *  refused rather than quietly created — scopes are not free-form. */
function validScope(scope: string): boolean {
  return scope === "shared" || /^user:[A-Za-z0-9_-]{6,64}$/.test(scope);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scopes = url.searchParams.getAll("scope").filter(validScope);
  if (!scopes.length) {
    return NextResponse.json({ error: "no valid scope requested" }, { status: 400 });
  }

  try {
    const out: Record<string, Record<string, { value: unknown; revision: string }>> = {};
    for (const scope of scopes) {
      const rows = await readScope(scope);
      const bucket: Record<string, { value: unknown; revision: string }> = {};
      rows.forEach((r) => { bucket[r.key] = { value: r.value, revision: r.revision }; });
      out[scope] = bucket;
    }
    return NextResponse.json({ scopes: out });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
}

interface WriteOp {
  scope?: string;
  key?: string;
  value?: unknown;
  revision?: number;
  remove?: boolean;
}

export async function PUT(request: Request) {
  let body: { writes?: WriteOp[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body is not JSON" }, { status: 400 });
  }

  const writes = Array.isArray(body.writes) ? body.writes : [];
  if (!writes.length) return NextResponse.json({ error: "no writes" }, { status: 400 });
  if (writes.length > 64) return NextResponse.json({ error: "too many writes in one batch" }, { status: 413 });

  const results: Record<string, { ok: boolean; revision?: string; conflict?: unknown }> = {};

  try {
    for (const w of writes) {
      const scope = String(w.scope || "");
      const key = String(w.key || "");
      if (!validScope(scope) || !key) {
        results[scope + "/" + key] = { ok: false };
        continue;
      }
      // A key the client is not allowed to sync at all (the prototype auth
      // store) is refused here too. The client already declines to send it;
      // this is the second lock, on the side that actually owns the data.
      if (!SYNCED_KEYS.includes(key)) {
        results[scope + "/" + key] = { ok: false };
        continue;
      }
      // Market state belongs in 'shared'; personal state must not be written
      // there. Getting this backwards would leak one buyer's saved list to
      // everyone, so it is checked rather than trusted.
      if (isSharedKey(key) !== (scope === "shared")) {
        results[scope + "/" + key] = { ok: false };
        continue;
      }

      if (w.remove) {
        await deleteDocument(scope, key);
        results[scope + "/" + key] = { ok: true };
        continue;
      }

      const res = await writeDocument(scope, key, w.value, w.revision);
      results[scope + "/" + key] = res.ok
        ? { ok: true, revision: res.revision }
        : { ok: false, conflict: res.current };
    }
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
}
