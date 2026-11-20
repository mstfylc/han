import { NextResponse } from "next/server";
import { pingDb } from "@/server/db";

export const dynamic = "force-dynamic";

const STARTED_AT = Date.now();

export async function GET() {
  try {
    const db = await pingDb();
    return NextResponse.json({
      ok: true,
      db: "ok",
      uptimeSec: Math.floor((Date.now() - STARTED_AT) / 1000),
      counts: {
        documents: db.documents,
        decisions: db.decisions,
        analytics: db.analytics,
      },
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      r2Configured: Boolean(
        process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_ACCOUNT_ID,
      ),
      ts: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, db: "error", error: String((e as Error).message || e) },
      { status: 503 },
    );
  }
}
