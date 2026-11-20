import { NextResponse } from "next/server";
import { readAnalyticsSummary, recordAnalyticsEvent } from "@/server/db";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "qr_scan",
  "wayfinder_ar_open",
  "wayfinder_door_calibrate",
  "whatsapp_share",
  "zero_result_query",
  "ai_visual_search",
  "ai_plan_intent",
  "ai_scan_shop",
  "ai_translate_trade",
  "offer_accepted",
  "poi_click",
]);

export async function GET() {
  try {
    const summary = await readAnalyticsSummary();
    return NextResponse.json({ ok: true, windowDays: 30, summary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message || e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: {
    eventName?: string;
    route?: string;
    placeId?: string;
    recordId?: string;
    meta?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const eventName = String(body.eventName || "").trim();
  if (!ALLOWED_EVENTS.has(eventName)) {
    return NextResponse.json({ ok: false, error: "unsupported event" }, { status: 400 });
  }
  try {
    await recordAnalyticsEvent({
      eventName,
      route: String(body.route || "").slice(0, 120),
      placeId: body.placeId ? String(body.placeId).slice(0, 64) : null,
      recordId: body.recordId ? String(body.recordId).slice(0, 64) : null,
      meta: body.meta && typeof body.meta === "object" ? body.meta : {},
    });
    return NextResponse.json({ ok: true });
  } catch {
    // Non-fatal in client telemetry
    return NextResponse.json({ ok: true, persisted: false });
  }
}
