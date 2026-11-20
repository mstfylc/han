"use client";

// HAN — Lightweight client telemetry bridge.
// Sends non-blocking events to both PostgreSQL (/api/analytics) and Umami (if mounted).

export type TelemetryEvent =
  | "qr_scan"
  | "wayfinder_ar_open"
  | "wayfinder_door_calibrate"
  | "whatsapp_share"
  | "zero_result_query"
  | "ai_visual_search"
  | "ai_plan_intent"
  | "ai_scan_shop"
  | "ai_translate_trade"
  | "offer_accepted"
  | "poi_click";

export function trackEvent(
  eventName: TelemetryEvent,
  opts?: { route?: string; placeId?: string | null; recordId?: string | null; meta?: Record<string, unknown> },
): void {
  if (typeof window === "undefined") return;

  const payload = {
    eventName,
    route: opts?.route || window.location.pathname || "",
    placeId: opts?.placeId || null,
    recordId: opts?.recordId || null,
    meta: opts?.meta || {},
  };

  try {
    const umami = (window as unknown as { umami?: { track?: (name: string, data?: Record<string, unknown>) => void } }).umami;
    if (umami?.track) {
      umami.track(eventName, { ...payload.meta, placeId: payload.placeId || undefined, recordId: payload.recordId || undefined });
    }
  } catch {
    /* ignore umami error */
  }

  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore telemetry network errors */
  }
}
