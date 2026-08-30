"use client";

// M3 · the map, talking both ways with the list.
//
// Two rules the audit settled and this keeps:
//
//   · Panning the map does NOT re-filter the list. Involuntary re-filtering is
//     maddening; it happens when the user presses "search this area".
//   · Selection is bidirectional. Tapping a pin narrows the list; tapping a row
//     rings the pin, centres it and opens its popup.
//
// The map lives in an iframe (Leaflet, vendored locally) and the two sides talk
// over postMessage.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import type { Lang } from "@/data/types";
import { Button, EmptyState, Icon } from "@/ds";
import { F, W } from "@/lib/copy";
import { num, tx } from "@/lib/i18n";
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

  const layer = getStr(sp, PARAM.mapMode, "sehir");
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [box, setBox] = useState<string[] | null>(null);

  const post = useCallback((msg: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage({ source: "han-web", ...msg }, "*");
  }, []);

  // ── map → web ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onMessage = (e: MessageEvent<MapMessage>) => {
      const m = e.data;
      if (!m || m.source !== "han-map") return;
      // A tap on a pin is enough; nobody should have to find a popup button.
      if (m.kind === "hover" || m.kind === "han" || m.kind === "yer") setFocus(m.id || null);
      // "Search this area" is the only thing that changes the list.
      else if (m.kind === "bounds") { setBox(m.ids || []); setFocus(null); }
      else if (m.kind === "store" && m.id) router.push(href.store(m.id));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  // ── web → map ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (focus) post({ kind: "focus", id: focus });
    else post({ kind: "clear" });
  }, [focus, post]);

  // Resolving a focus id has to look in all three tables: the map also sends
  // AREA pins, and leaving areas out made an area tap vanish silently.
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

  // The list beside the map: whatever the current scope is.
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
      .sort((a, b) => b.n - a.n)
      .slice(0, 12);
  }, [box, focusInfo]);

  const layers: [string, string][] = [
    ["sehir", pk({ tr: "Tüm çarşı", en: "The whole bazaar", ru: "Весь базар", ar: "السوق كله" }, lang)],
    ["route", pk({ tr: "Planımın rotası", en: "My route", ru: "Мой маршрут", ar: "مساري" }, lang)],
    ["carsida", pk({ tr: "Çarşı modu", en: "Bazaar mode", ru: "Режим базара", ar: "وضع السوق" }, lang)],
  ];

  // In route mode the map draws the plan's stops as numbered pins.
  const routePoints = useMemo(() => {
    if (layer !== "route") return "";
    const ids = new Set((state.buyList || []).map((b) => b.name.toLocaleLowerCase(lang === "tr" ? "tr-TR" : lang)));
    if (!ids.size) return "";
    const places: string[] = [];
    (state.buyList || []).forEach((it) => {
      const hit = SE.search(it.name, {}, { mode, lang }).items[0];
      if (hit && !places.includes(hit.rec.place)) places.push(hit.rec.place);
    });
    return places.join(",");
  }, [layer, state.buyList, mode, lang]);

  const mapSrc =
    "/han-map.html?lang=" + lang + (routePoints ? "&pts=" + encodeURIComponent(routePoints) : "");

  return (
    <div style={sx("max-width:1480px;margin:0 auto;padding:22px 24px 48px")}>
      <header style={sx("display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap")}>
        <div style={sx("flex:1;min-width:240px")}>
          <h1 style={sx("font-size:26px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0")}>{W(lang, "mapTitle")}</h1>
          <p style={sx("font-size:14px;color:var(--text-muted);margin-top:4px;max-width:70ch;text-wrap:pretty")}>{W(lang, "mapSub")}</p>
        </div>
        <div style={sx("display:flex;gap:7px;flex-wrap:wrap")} role="tablist">
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
                  "height:36px;padding:0 14px;border-radius:8px;font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer;border:1px solid " +
                    (on ? "var(--color-primary);background:var(--color-primary);color:#fff" : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </header>

      <div style={sx("display:grid;grid-template-columns:" + (state.vw >= 1100 ? "minmax(0,1fr) 340px" : "minmax(0,1fr)") + ";gap:18px;margin-top:18px;align-items:start")}>
        <div style={sx("border:1px solid var(--border-strong);border-radius:14px;overflow:hidden;background:var(--surface-muted)")}>
          <iframe
            ref={frame}
            src={mapSrc}
            title={W(lang, "mapTitle")}
            style={sx("display:block;width:100%;height:" + (state.vw >= 1100 ? "620px" : "420px") + ";border:none")}
          />
        </div>

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
                {focusInfo.kind === "place" && (
                  <Button variant="outline" color="primary" size="sm" onClick={() => router.push(href.place(focusInfo.id))}>
                    {pk({ tr: "Yer sayfası", en: "Place page", ru: "Страница места", ar: "صفحة المكان" }, lang)}
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

          <section style={sx(CARD)}>
            <div style={sx("display:flex;align-items:baseline;justify-content:space-between;gap:10px")}>
              <div style={sx(KICKER)}>
                {box
                  ? pk({ tr: "Bu alandaki yerler", en: "Places in this area", ru: "Места в этой области", ar: "أماكن هذه المنطقة" }, lang)
                  : pk({ tr: "En yoğun yerler", en: "Busiest places", ru: "Самые плотные места", ar: "أكثر الأماكن كثافة" }, lang)}
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
                {rows.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    // list → map: ring the pin and centre it.
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
                      <span style={sx("display:block;font-size:14px;font-weight:600;color:var(--text-heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{r.name}</span>
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

          {/* K4 · bazaar mode: the phone in the bazaar needs route, door number,
              phone, "open now" and what I saved — and nothing else. */}
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
                          <Icon name="message-notif" size={15} />
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
      </div>
    </div>
  );
}
