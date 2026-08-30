// HAN — the decision ledger.
//
// The approvals document is keyed by record, so a second decision about the
// same shop replaces the first: it knows the current state and forgets how it
// got there. The code's promise is stronger — "no decision disappears silently,
// every one carries a reason and a time" — so decisions are appended here as
// well, where nothing is overwritten.
//
// This is what keeps "why was this record suspended, and who decided that?"
// answerable after the record has since been reinstated.

import { NextResponse } from "next/server";

import { appendDecisions, readDecisions } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit")) || 200));
  try {
    return NextResponse.json({ decisions: await readDecisions(limit) });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
}

interface Incoming {
  recordId?: string;
  status?: string;
  via?: string | null;
  officer?: string | null;
}

export async function POST(request: Request) {
  let body: { decisions?: Incoming[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body is not JSON" }, { status: 400 });
  }

  const rows = (Array.isArray(body.decisions) ? body.decisions : [])
    .filter((d) => d && typeof d.recordId === "string" && typeof d.status === "string")
    .slice(0, 2000)
    .map((d) => ({
      recordId: d.recordId as string,
      status: d.status as string,
      via: d.via ?? null,
      officer: d.officer ?? null,
    }));

  if (!rows.length) return NextResponse.json({ error: "no decisions" }, { status: 400 });

  try {
    await appendDecisions(rows);
    return NextResponse.json({ appended: rows.length });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
}
