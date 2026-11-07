"use client";

// M3 · the map, talking both ways with the list, plus live GPS & Han Gate
// Geofence Handoff (Outdoor GPS -> Indoor Floor Plan & Wayfinder).

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import type { Lang } from "@/data/types";
import { Alert, Button, EmptyState, Icon } from "@/ds";
import { F, W } from "@/lib/copy";
import { num, tx } from "@/lib/i18n";
import { pagePad } from "@/lib/layout";
import { buildPlan, serializeRoutePts } from "@/lib/planEngine";
import { PARAM, getStr, href } from "@/lib/routes";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;
const CARD = "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:16px 18px;box-shadow:0 3px 4px rgba(0,0,0,.03)";
const KICKER = "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)";

interface MapMessage {
  source?: string;
  kind?: string;
  id?: string;
  name?: string;
  dist?: number;
  ids?: string[];
}

export default function MapPage() {
  return (
    <Suspense fallback={null}>
      <MapScreen />
    </Suspense>
  );
}

function MapScreen() {
  const { state } = useApp();
  const router = useRouter();
  const sp = useSearchParams();
  const { lang, mode } = state;
  const isPhone = state.vw < 768;

  const layer = getStr(sp, PARAM.mapMode, "sehir");
  const initialPoiParam = sp.get("poi");
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [box, setBox] = useState<string[] | null>(null);
  const [mobileTab, setMobileTab] = useState<"map" | "list">("map");
  const [geofenceHan, setGeofenceHan] = useState<{ id: string; name: string; dist: number } | null>(null);
  const [poiFilter, setPoiFilter] = useState<"all" | SC.ServicePoiKind | null>(() => {
    if (
      initialPoiParam === "wc" ||
      initialPoiParam === "atm" ||
      initialPoiParam === "mola" ||
      initialPoiParam === "kargo" ||
      initialPoiParam === "ulasim"
    ) {
      return initialPoiParam;
    }
    if (initialPoiParam === "all") return "all";
    return null;
  });
  const [activePoiId, setActivePoiId] = useState<string | null>(null);

  useEffect(() => {
    const p = sp.get("poi");
    if (p === "wc" || p === "atm" || p === "mola" || p === "kargo" || p === "ulasim") {
      setPoiFilter(p);
    } else if (p === "all") {
      setPoiFilter("all");
    }
  }, [sp]);

  const filteredPois = useMemo(() => {
    if (!poiFilter) return [];
    if (poiFilter === "all") return SC.SERVICE_POIS;
    return SC.SERVICE_POIS.filter((item) => item.kind === poiFilter);
  }, [poiFilter]);

  const post = useCallback((msg: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage({ source: "han-web", ...msg }, "*");
  }, []);

  useEffect(() => {
    if (!poiFilter) {
      post({ kind: "show-pois", pois: [] });
      return;
    }
    const timer = setTimeout(() => {
      post({ kind: "show-pois", pois: filteredPois });
    }, 180);
    return () => clearTimeout(timer);
  }, [poiFilter, filteredPois, post]);

  // ── map → web ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onMessage = (e: MessageEvent<MapMessage>) => {
      const m = e.data;
      if (!m || m.source !== "han-map") return;
      if (m.kind === "hover" || m.kind === "yer") setFocus(m.id || null);
      else if (m.kind === "han" && m.id) {
        setFocus(m.id);
        router.push(href.place(m.id));
      } else if (m.kind === "open-floor" && m.id) {
        router.push(href.place(m.id));
      } else if (m.kind === "geofence" && m.id) {
        setGeofenceHan({ id: m.id, name: m.name || m.id, dist: m.dist || 15 });
        setFocus(m.id);
      } else if (m.kind === "bounds") {
        setBox(m.ids || []);
        setFocus(null);
      } else if (m.kind === "store" && m.id) {
        router.push(href.store(m.id));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  // ── web → map ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (focus) post({ kind: "focus", id: focus });
    else post({ kind: "clear" });
  }, [focus, post]);

  const focusInfo = useMemo(() => {
    if (!focus) return null;
    const place = SC.PLACES.find((p) => p.id === focus);
    if (place) {
      const stats = SC.placeStats(place.id);
      return {
        kind: "place" as const,
        name: place.name,
        meta: [tx(SC.SEMTLER.find((s) => s.id === place.semt), lang), num(place.units, lang) + " " + pk({ tr: "birim", en: "units", ru: "мест", ar: "وحدة" }, lang)]
          .filter(Boolean)
          .join(" · "),
        records: stats ? stats.records : 0,
        semt: place.semt,
        id: place.id,
      };
    }
    const han = D.HANS.find((h) => h.id === focus);
    if (han) {
      return {
        kind: "han" as const,
        name: han.name as string,
        meta: tx(D.AREAS.find((a) => a.id === han.area), lang),
        records: D.STORES.filter((s) => s.han === han.id).length,
        semt: null,
        id: han.id as string,
      };
    }
    const area = D.AREAS.find((a) => a.id === focus);
    if (area) {
      return {
        kind: "area" as const,
        name: tx(area, lang),
        meta: (area["what" + lang.charAt(0).toUpperCase() + lang.slice(1)] as string) || (area.whatTr as string) || "",
        records: SC.RECORDS.filter((r) => r.semt === area.id).length,
        semt: area.id as string,
        id: area.id as string,
      };
    }
    return null;
  }, [focus, lang]);

  const rows = useMemo(() => {
    if (box) {
      return box
        .map((id) => SC.PLACES.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => ({ id: p!.id, name: p!.name, n: SC.placeStats(p!.id)?.records || 0, semt: p!.semt }));
    }
    if (focusInfo?.semt) {
      return SC.PLACES.filter((p) => p.semt === focusInfo.semt).map((p) => ({
        id: p.id, name: p.name, n: SC.placeStats(p.id)?.records || 0, semt: p.semt,
      }));
    }
    return SC.PLACES.slice()
      .map((p) => ({ id: p.id, name: p.name, n: SC.placeStats(p.id)?.records || 0, semt: p.semt }))
      .sort((a, b) => (a.id === "santral" ? -1 : b.id === "santral" ? 1 : b.n - a.n))
      .slice(0, 12);
  }, [box, focusInfo]);

  const layers: [string, string][] = [
    ["sehir", pk({ tr: "Tüm çarşı", en: "The whole bazaar", ru: "Весь базар", ar: "السوق كله" }, lang)],
    ["route", pk({ tr: "Planımın rotası", en: "My route", ru: "Мой маршрут", ar: "مساري" }, lang)],
    ["carsida", pk({ tr: "Çarşı modu", en: "Bazaar mode", ru: "Режим базара", ar: "وضع السوق" }, lang)],
  ];

  const routePoints = useMemo(() => {
    if (layer !== "route") return "";
    const activeTrip = (state.trips || []).find((t) => t.id === state.tripId) || (state.trips || [])[0] || null;
    if (activeTrip && (activeTrip.items || []).length > 0) {
      const p = buildPlan(activeTrip, {
        lang,
        mode,
        events: state.evPlan || [],
        appointments: state.appts || [],
      });
      if (p.kept.length > 0) {
        return serializeRoutePts(
          p.kept.map((k) => ({ place: k.stop.place, shiftNote: k.shiftNote })),
        );
      }
    }
    const defaultIds = ["santral", "sark", "buyukyeni", "zincirli"];
    const fallbackStops = defaultIds
      .map((id) => SC.PLACES.find((pl) => pl.id === id))
      .filter(Boolean)
      .map((pl) => ({ place: pl! }));
    return serializeRoutePts(fallbackStops);
  }, [layer, state.trips, state.tripId, state.evPlan, state.appts, mode, lang]);

  const mapSrc =
    "/han-map.html?lang=" + lang + (routePoints ? "&pts=" + encodeURIComponent(routePoints) : "");

  return (
    <div style={sx("max-width:1480px;margin:0 auto;" + pagePad(state.vw))}>
      <header style={sx("display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap")}>
        <div style={sx("flex:1;min-width:220px")}>
          <h1 style={sx("font-size:" + (isPhone ? "21px" : "26px") + ";font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0")}>
            {W(lang, "mapTitle")}
          </h1>
          <p style={sx("font-size:13.5px;color:var(--text-muted);margin-top:4px;max-width:70ch;text-wrap:pretty")}>{W(lang, "mapSub")}</p>
        </div>
        <div style={sx("display:flex;gap:6px;flex-wrap:wrap;align-items:center")} role="tablist">
          {layers.map(([id, label]) => {
            const on = layer === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => router.push(href.map(id))}
                style={sx(
                  "height:36px;padding:0 12px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:1px solid " +
                    (on ? "var(--color-primary);background:var(--color-primary);color:#fff" : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
                )}
              >
                {label}
              </button>
            );
          })}
          <Button
            color="accent"
            variant="solid"
            size="md"
            iconStart="locate"
            onClick={() => {
              setMobileTab("map");
              post({ kind: "locate" });
            }}
          >
            {pk({ tr: "Canlı GPS & Han Girişi Algıla", en: "Live GPS & Detect Han Gate", ru: "GPS и вход в хан", ar: "GPS ومدخل الخان" }, lang)}
          </Button>
        </div>
      </header>

      {/* Outdoor GPS -> Indoor Floor Plan Geofence Handoff Alert */}
      {geofenceHan && (
        <div style={sx("margin-top:12px")}>
          <Alert
            color="accent"
            variant="outline"
            title={
              lang === "tr"
                ? `🏢 ${geofenceHan.name} Girişindesiniz (${geofenceHan.dist} m) — Han İçi Rehbere Geçin`
                : `🏢 At the entrance of ${geofenceHan.name} (${geofenceHan.dist} m) — Switch to Indoor Guide`
            }
            onClose={() => setGeofenceHan(null)}
          >
            <div style={sx("display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-top:6px")}>
              <span>
                {lang === "tr"
                  ? "Han içinde GPS sinyali zayıflar. Şimdi kat planına veya canlı kamera/koridor yönlendirmesine geçebilirsiniz."
                  : "GPS weakens inside stone hans. Switch now to the indoor floor plan or camera/corridor wayfinder."}
              </span>
              <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
                <Button
                  color="accent"
                  variant="solid"
                  size="sm"
                  iconStart="floor-layer"
                  onClick={() => router.push(href.place(geofenceHan.id))}
                >
                  {lang === "tr" ? "🗺️ Kat Planını Aç" : "🗺️ Open Floor Plan"}
                </Button>
                <Button
                  color="primary"
                  variant="light"
                  size="sm"
                  iconStart="camera"
                  onClick={() => router.push(`/tarif/roza?han=${encodeURIComponent(geofenceHan.id)}&ar=1`)}
                >
                  {lang === "tr" ? "📷 Kamera & Koridor Rehberi" : "📷 Camera & Corridor Guide"}
                </Button>
              </div>
            </div>
          </Alert>
        </div>
      )}

      {/* 🧭 Saha İhtiyaç Noktaları (WC · ATM/Döviz · Kahve/Avlu · Kargo · Ulaşım) */}
      <section
        style={sx(
          CARD +
            ";margin-top:12px;display:flex;flex-direction:column;gap:10px;min-width:0;max-width:100%;box-sizing:border-box",
        )}
      >
        <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap")}>
          <div style={sx("font-size:13px;font-weight:800;color:var(--text-heading)")}>
            {pk(
              {
                tr: "🧭 Saha İhtiyaç Noktaları (WC · ATM/Döviz · Kahve/Avlu · Kargo · Ulaşım)",
                en: "🧭 Field Essentials (WC · ATM/Exchange · Coffee/Courtyard · Cargo · Transit)",
              },
              lang,
            )}
          </div>
          {poiFilter && (
            <button
              type="button"
              onClick={() => {
                setPoiFilter(null);
                setActivePoiId(null);
              }}
              style={sx(
                "background:none;border:none;padding:0;font-family:inherit;font-size:12px;font-weight:700;color:var(--color-primary);cursor:pointer",
              )}
            >
              {pk({ tr: "İhtiyaç Pinlerini Gizle ×", en: "Hide Pins ×" }, lang)}
            </button>
          )}
        </div>

        <div style={sx("display:flex;gap:6px;flex-wrap:wrap;align-items:center")} data-han-nav="1">
          {(
            [
              ["all", pk({ tr: "Tümü", en: "All" }, lang)],
              ["wc", pk({ tr: "🚻 WC & Mescit", en: "🚻 WC & Prayer" }, lang)],
              ["atm", pk({ tr: "🏧 ATM & Döviz", en: "🏧 ATM & Exchange" }, lang)],
              ["mola", pk({ tr: "☕ Kahve & Mola", en: "☕ Coffee & Break" }, lang)],
              ["kargo", pk({ tr: "📦 Kargo & Emanet", en: "📦 Cargo & Bag Drop" }, lang)],
              ["ulasim", pk({ tr: "🚊 Tramvay & Otopark", en: "🚊 Tram & Parking" }, lang)],
            ] as const
          ).map(([id, label]) => {
            const on = poiFilter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  const next = poiFilter === id ? null : id;
                  setPoiFilter(next);
                  setActivePoiId(null);
                }}
                style={sx(
                  "height:34px;padding:0 12px;border-radius:999px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;border:1px solid " +
                    (on
                      ? "var(--color-primary);background:var(--color-primary);color:#fff"
                      : "var(--border-strong);background:var(--surface-muted);color:var(--text-heading)"),
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {poiFilter && filteredPois.length > 0 && (
          <div
            style={sx(
              "display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:10px;margin-top:4px",
            )}
          >
            {filteredPois.map((poi) => {
              const isSelected = activePoiId === poi.id;
              const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}&travelmode=walking`;
              return (
                <div
                  key={poi.id}
                  onClick={() => {
                    setActivePoiId(poi.id);
                    setMobileTab("map");
                    frame.current?.contentWindow?.postMessage(
                      { source: "han-web", kind: "focus-poi", poi },
                      "*",
                    );
                  }}
                  style={sx(
                    "padding:12px 14px;border-radius:12px;cursor:pointer;display:flex;flex-direction:column;gap:5px;border:1.5px solid " +
                      (isSelected
                        ? "var(--color-accent);background:var(--color-accent-soft)"
                        : "var(--border-strong);background:var(--surface-card)"),
                  )}
                >
                  <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:8px")}>
                    <div style={sx("font-size:13.5px;font-weight:800;color:var(--text-heading);line-height:1.25")}>
                      {tx(poi.title, lang)}
                    </div>
                    <span
                      style={sx(
                        "flex:none;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;background:var(--surface-muted);color:var(--text-muted)",
                      )}
                    >
                      🕒 {poi.hours}
                    </span>
                  </div>
                  <div style={sx("font-size:12px;font-weight:700;color:var(--color-primary)")}>
                    📍 {tx(poi.sub, lang)}
                  </div>
                  <div style={sx("font-size:12px;color:var(--text-body);line-height:1.4")}>
                    💡 {tx(poi.tip, lang)}
                  </div>
                  <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px")}>
                    <span style={sx("font-size:11.5px;font-weight:800;color:var(--color-accent)")}>
                      {pk({ tr: "🎯 Haritada Göster", en: "🎯 Focus on Map" }, lang)}
                    </span>
                    <a
                      href={gmapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(ev) => ev.stopPropagation()}
                      style={sx(
                        "font-size:11.5px;font-weight:700;color:var(--color-primary);text-decoration:none",
                      )}
                    >
                      🌍 Google Haritalar Yürüyüş ↗
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Mobile Segmented Switcher: Harita vs Liste */}
      {isPhone && (
        <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px;padding:4px;border-radius:11px;background:var(--surface-muted);border:1px solid var(--border-strong)")}>
          <button
            type="button"
            onClick={() => setMobileTab("map")}
            style={sx(
              "height:36px;border-radius:8px;border:0;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;" +
                (mobileTab === "map"
                  ? "background:var(--surface-card);color:var(--text-heading);box-shadow:0 2px 6px rgba(0,0,0,.08)"
                  : "background:transparent;color:var(--text-muted)"),
            )}
          >
            <Icon name="map" size={15} />
            {lang === "tr" ? "İnteraktif Harita" : "Interactive Map"}
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("list")}
            style={sx(
              "height:36px;border-radius:8px;border:0;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;" +
                (mobileTab === "list"
                  ? "background:var(--surface-card);color:var(--text-heading);box-shadow:0 2px 6px rgba(0,0,0,.08)"
                  : "background:transparent;color:var(--text-muted)"),
            )}
          >
            <Icon name="building" size={15} />
            {lang === "tr" ? `Han & Çarşı Listesi (${rows.length})` : `Places (${rows.length})`}
          </button>
        </div>
      )}

      <div style={sx("display:grid;grid-template-columns:" + (state.vw >= 1100 ? "minmax(0,1fr) 340px" : "minmax(0,1fr)") + ";gap:16px;margin-top:14px;align-items:start")}>
        {(!isPhone || mobileTab === "map") && (
          <div style={sx("border:1px solid var(--border-strong);border-radius:14px;overflow:hidden;background:var(--surface-muted)")}>
            <iframe
              ref={frame}
              src={mapSrc}
              title={W(lang, "mapTitle")}
              style={sx("display:block;width:100%;height:" + (state.vw >= 1100 ? "620px" : isPhone ? "calc(100dvh - 250px);min-height:380px" : "460px") + ";border:none")}
            />
          </div>
        )}

        {(!isPhone || mobileTab === "list" || !!focusInfo) && (
          <aside style={sx("display:flex;flex-direction:column;gap:14px" + (state.vw >= 1100 ? ";position:sticky;top:84px" : ""))}>
            {focusInfo && (
              <section style={sx(CARD + ";border-color:var(--color-accent)")}>
                <div style={sx("display:flex;align-items:flex-start;gap:10px")}>
                  <div style={sx("flex:1;min-width:0")}>
                    <div style={sx(KICKER)}>{pk({ tr: "Haritada seçili", en: "Selected on the map", ru: "Выбрано на карте", ar: "محدد على الخريطة" }, lang)}</div>
                    <div style={sx("font-size:17px;font-weight:700;color:var(--text-heading);margin-top:4px")}>{focusInfo.name}</div>
                    <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:2px;text-wrap:pretty")}>{focusInfo.meta}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFocus(null)}
                    aria-label={W(lang, "close")}
                    style={sx("flex:none;width:28px;height:28px;border-radius:7px;border:none;background:var(--surface-muted);color:var(--text-muted);cursor:pointer")}
                  >
                    ×
                  </button>
                </div>
                <div style={sx("display:flex;gap:8px;margin-top:12px;flex-wrap:wrap")}>
                  {(focusInfo.kind === "place" || focusInfo.kind === "han") && (
                    <Button variant="solid" color="accent" size="sm" iconStart="floor-layer" onClick={() => router.push(href.place(focusInfo.id))}>
                      {pk({ tr: "Kat Planı & Yer Sayfası", en: "Floor Plan & Place Page", ru: "План этажа и место", ar: "مخطط الطابق والمكان" }, lang)}
                    </Button>
                  )}
                  {focusInfo.semt && (
                    <Button variant="outline" color="primary" size="sm" onClick={() => router.push("/ara?semt=" + encodeURIComponent(focusInfo.semt!))}>
                      {pk({ tr: "Burada ara", en: "Search here", ru: "Искать здесь", ar: "ابحث هنا" }, lang)}
                    </Button>
                  )}
                </div>
              </section>
            )}

            {(!isPhone || mobileTab === "list") && (
              <section style={sx(CARD)}>
                <div style={sx("display:flex;align-items:baseline;justify-content:space-between;gap:10px")}>
                  <div style={sx(KICKER)}>
                    {box
                      ? pk({ tr: "Bu alandaki yerler", en: "Places in this area", ru: "Места в этой области", ar: "أماكن هذه المنطقة" }, lang)
                      : pk({ tr: "En yoğun yerler (Santral Han #1)", en: "Busiest places (Santral Han #1)", ru: "Самые плотные места", ar: "أكثر الأماكن كثافة" }, lang)}
                  </div>
                  {box && (
                    <button
                      type="button"
                      onClick={() => setBox(null)}
                      style={sx("background:none;border:none;padding:0;font-family:inherit;font-size:12px;font-weight:600;color:var(--color-primary);cursor:pointer")}
                    >
                      {F(lang, "clear")}
                    </button>
                  )}
                </div>

                {rows.length === 0 ? (
                  <p style={sx("font-size:13px;color:var(--text-muted);margin-top:10px;text-wrap:pretty")}>
                    {pk({
                      tr: "Bu çerçevede kayıtlı yer yok. Haritayı biraz kaydırıp yeniden deneyin.",
                      en: "No recorded place in this frame. Pan a little and try again.",
                      ru: "В этой рамке нет мест.",
                      ar: "لا أماكن في هذا الإطار.",
                    }, lang)}
                  </p>
                ) : (
                  <div style={sx("display:flex;flex-direction:column;gap:1px;margin-top:10px;background:var(--border-default);border:1px solid var(--border-default);border-radius:10px;overflow:hidden")}>
                    {rows.map((r, idx) => (
                      <button
                        key={r.id}
                        type="button"
                        onMouseEnter={() => setFocus(r.id)}
                        onFocus={() => setFocus(r.id)}
                        onClick={() => router.push(href.place(r.id))}
                        style={sx(
                          "display:flex;align-items:center;gap:10px;background:" +
                            (focus === r.id ? "var(--color-accent-soft)" : "var(--surface-card)") +
                            ";border:none;padding:11px 13px;font-family:inherit;text-align:start;cursor:pointer",
                        )}
                      >
                        <span style={sx("flex:1;min-width:0")}>
                          <span style={sx("display:block;font-size:14px;font-weight:700;color:var(--text-heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                            {(idx === 0 && r.id === "santral" ? "★ " : "") + r.name}
                          </span>
                          <span style={sx("display:block;font-size:12px;color:var(--text-muted);margin-top:2px")}>
                            {tx(SC.SEMTLER.find((s) => s.id === r.semt), lang)}
                          </span>
                        </span>
                        <span style={sx("flex:none;font-size:13px;font-weight:700;color:var(--color-primary)")}>{r.n}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {layer === "route" && !routePoints && (
              <section style={sx(CARD)}>
                <EmptyState
                  compact
                  icon="rocket"
                  tone="neutral"
                  title={W(lang, "planEmpty")}
                  description={W(lang, "planEmptyBody")}
                  actions={<Button color="primary" size="sm" onClick={() => router.push(href.plan())}>{W(lang, "planTitle")}</Button>}
                />
              </section>
            )}

            {layer === "carsida" && (
              <section style={sx(CARD)}>
                <div style={sx(KICKER)}>{pk({ tr: "Çarşı modu", en: "Bazaar mode", ru: "Режим базара", ar: "وضع السوق" }, lang)}</div>
                <p style={sx("font-size:13px;color:var(--text-muted);margin-top:6px;text-wrap:pretty")}>
                  {pk({
                    tr: "Çarşıdayken gereken üç şey: rota, kapı numarası ve telefon. Kaydettikleriniz çevrimdışı da açılır.",
                    en: "The three things you need inside the bazaar: the route, the door number and the phone. Your saved shops open offline too.",
                    ru: "Три вещи внутри базара: маршрут, номер двери и телефон.",
                    ar: "ثلاثة أشياء داخل السوق: المسار ورقم الباب والهاتف.",
                  }, lang)}
                </p>
                <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:12px")}>
                  {state.saved.slice(0, 8).map((id) => {
                    const rec = SC.RECORDS.find((r) => r.id === id || r.curated === id);
                    const store = D.STORES.find((s) => s.id === id);
                    const name = store?.name || rec?.name || id;
                    const tel = String(store?.tel || rec?.tel || "").replace(/\D/g, "");
                    const place = rec ? SC.PLACES.find((p) => p.id === rec.place) : null;
                    return (
                      <div key={id} style={sx("display:flex;align-items:center;gap:9px;padding:10px 11px;border-radius:10px;border:1px solid var(--border-default)")}>
                        <button
                          type="button"
                          onClick={() => router.push(href.store(id))}
                          style={sx("flex:1;min-width:0;background:none;border:none;padding:0;font-family:inherit;text-align:start;cursor:pointer")}
                        >
                          <span style={sx("display:block;font-size:13.5px;font-weight:700;color:var(--text-heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{name}</span>
                          {rec && (
                            <span style={sx("display:block;font-size:12px;color:var(--text-muted);margin-top:2px")}>
                              {place?.name} · {W(lang, "doorNo")} {rec.door}
                            </span>
                          )}
                        </button>
                        {tel && (
                          <a
                            href={"tel:+" + tel}
                            aria-label={pk({ tr: "Ara", en: "Call", ru: "Позвонить", ar: "اتصل" }, lang)}
                            style={sx("flex:none;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:1px solid var(--color-primary);color:var(--color-primary);text-decoration:none")}
                          >
                            <Icon name="phone" size={15} />
                          </a>
                        )}
                      </div>
                    );
                  })}
                  {!state.saved.length && (
                    <p style={sx("font-size:13px;color:var(--text-muted);text-wrap:pretty")}>
                      {pk({
                        tr: "Henüz kaydettiğiniz dükkân yok. Aramada kalp işaretine dokunun.",
                        en: "No saved shops yet. Tap the heart in search results.",
                        ru: "Пока нет сохранённых лавок.",
                        ar: "لا متاجر محفوظة بعد.",
                      }, lang)}
                    </p>
                  )}
                </div>
              </section>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
