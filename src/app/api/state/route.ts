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
import { cookies } from "next/headers";

import { readScope, writeDocument, deleteDocument } from "@/server/db";
import { COOKIE, sessionUser } from "@/server/auth";
import { can } from "@/data/han-scale";
import { PUBLIC_WRITE_KEYS, SYNCED_KEYS, isSharedKey, permForWrite } from "@/services/scopes";

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

  const results: Record<string, { ok: boolean; revision?: string; conflict?: unknown; reason?: string }> = {};

  // Who is asking. Resolved once: most batches touch a single key, and hitting
  // the session table per write would make a sync tick N queries deeper.
  const jar = await cookies();
  const me = await sessionUser(jar.get(COOKIE)?.value);

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
      // Decisions need an account; participating in the market does not.
      //
      // A buyer raising a request or reporting a record, and a trader claiming
      // a door or answering with an offer, must stay open — requiring an
      // operations login for those would mean there is no bazaar. Approving,
      // suspending, assigning field work, editing the lexicon and changing who
      // is on the team are decisions, and a decision needs someone behind it.
      //
      // The permission table is han-scale's ROLES, the same one the navigation
      // reads, so the menu and the endpoint cannot disagree about what a role
      // may do.
      const perm = permForWrite(key);
      if (perm && !PUBLIC_WRITE_KEYS.includes(key)) {
        if (!me) {
          results[scope + "/" + key] = { ok: false, reason: "anonymous" };
          continue;
        }
        if (!can(me.role, perm)) {
          results[scope + "/" + key] = { ok: false, reason: "forbidden" };
          continue;
        }
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
