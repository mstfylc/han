"use client";

// Plan — a bazaar day in three phases: intent → route → walk.
//
// The screen's job is to be honest about the constraints. It says what it cut
// and why, it says when it moved an arrival and why, and it puts stops, events,
// appointments and cargo on one timeline so a clash is visible before it costs
// someone an afternoon.

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import * as SC from "@/data/han-scale";
import type { Lang } from "@/data/types";
import SantralFloorMap from "@/components/SantralFloorMap";
import { Alert, Badge, Button, EmptyState, Icon, Input } from "@/ds";
import { F, W } from "@/lib/copy";
import { convert, money, tonePair } from "@/lib/i18n";
import { pagePad, planGrid } from "@/lib/layout";
import { href } from "@/lib/routes";
import { buildPlan, hhmm, moveBefore, reorder, serializeRoutePts } from "@/lib/planEngine";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";
import type { Trip } from "@/state/types";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

const CARD = "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:18px 20px;box-shadow:0 3px 4px rgba(0,0,0,.03)";
const KICKER = "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)";

const chip = (on: boolean) =>
  "height:34px;padding:0 13px;border-radius:8px;font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer;border:1px solid " +
  (on ? "var(--color-primary);background:var(--color-primary);color:#fff" : "var(--border-strong);background:var(--surface-card);color:var(--text-body)");

const ROUTE_TEMPLATES = [
  {
    id: "tpl_santral_tahtakale",
    icon: "star",
    badge: "#1 Önerilen · Santral Han Başlangıçlı",
    title: {
      tr: "Santral Han & Tahtakale Bijuteri + Elektronik Turu",
      en: "Santral Han & Tahtakale Jewelry + Electronics Tour",
    },
    desc: {
      tr: "1. Durak: Santral Han (A & B Kat: Roza Bijuteri, Zenta Elektronik, Yıldız Saat) ➔ 2. Durak: Şark Han ➔ 3. Durak: Tahtakale Cad.",
      en: "Stop 1: Santral Han (Floors A & B) ➔ Stop 2: Şark Han ➔ Stop 3: Tahtakale St.",
    },
    hours: 3,
    intent: "is" as const,
    carry: "el",
    items: [
      { id: "tpl1_1", name: "Roza Bijuteri", qty: "24", target: "95" },
      { id: "tpl1_2", name: "Zenta Elektronik", qty: "20", target: "85" },
      { id: "tpl1_3", name: "Emre Aksesuar", qty: "36", target: "45" },
      { id: "tpl1_4", name: "Demir Poşet", qty: "100", target: "12" },
    ],
  },
  {
    id: "tpl_turist_kesif",
    icon: "compass",
    badge: "Turist & Perakende Keşif Rotası",
    title: {
      tr: "Tarihi Yarımada Klasik Hanlar & Çarşı Yürüyüşü",
      en: "Classic Historic Peninsula Hans & Bazaar Walk",
    },
    desc: {
      tr: "1. Durak: Santral Han (Vitrin katları) ➔ 2. Durak: Mısır Çarşısı (Baharat) ➔ 3. Durak: Kalcılar Han (Gümüş) ➔ 4. Durak: Zincirli Han (Halı)",
      en: "1. Santral Han ➔ 2. Spice Bazaar ➔ 3. Kalcılar Han (Silver) ➔ 4. Zincirli Han (Carpets)",
    },
    hours: 4,
    intent: "gez" as const,
    carry: "el",
    items: [
      { id: "tpl2_1", name: "Roza Bijuteri", qty: "2", target: "150" },
      { id: "tpl2_2", name: "Arif Bey Baharat", qty: "1", target: "320" },
      { id: "tpl2_3", name: "Kaya Gümüş", qty: "1", target: "950" },
      { id: "tpl2_4", name: "Anadolu Halı", qty: "1", target: "4500" },
    ],
  },
  {
    id: "tpl_elektronik_b2b",
    icon: "smartphone",
    badge: "B2B Toptan Tedarik Rotası",
    title: {
      tr: "Telefon Kılıfı, Şarj & Saat Toptan Alım Rotası",
      en: "Phone Case, Charger & Watch Wholesale Route",
    },
    desc: {
      tr: "Santral Han merkezli elektronik, saat, pil ve ambalaj toptancıları (El arabası ve kargo teslim uyumlu).",
      en: "Electronics, watch and packaging wholesalers anchored at Santral Han.",
    },
    hours: 3,
    intent: "is" as const,
    carry: "kargo",
    items: [
      { id: "tpl3_1", name: "Zenta Elektronik", qty: "50", target: "80" },
      { id: "tpl3_2", name: "Yıldız Saat", qty: "25", target: "240" },
      { id: "tpl3_3", name: "Demir Poşet", qty: "200", target: "10" },
    ],
  },
  {
    id: "tpl_tekstil_hanlar",
    icon: "building",
    badge: "Tekstil & Tarihi Avlulu Hanlar",
    title: {
      tr: "Santral Han, Kürkçü Han & Mahmutpaşa Tekstil Rotası",
      en: "Santral Han, Kürkçü Han & Mahmutpaşa Textile Route",
    },
    desc: {
      tr: "Santral Han aksesuar turu ardından tarihi Kürkçü Han'da ev tekstili/havlu ve Mercan çanta rotası.",
      en: "Santral Han accessories followed by Kürkçü Han home textiles and Mercan leather.",
    },
    hours: 4,
    intent: "is" as const,
    carry: "kargo",
    items: [
      { id: "tpl4_1", name: "Roza Bijuteri", qty: "15", target: "95" },
      { id: "tpl4_2", name: "Sultan Tekstil", qty: "30", target: "180" },
      { id: "tpl4_3", name: "Mercan Deri", qty: "10", target: "420" },
    ],
  },
];

const QUICK_PICKS = [
  { label: "+ Santral Han · Roza Bijuteri", name: "Roza Bijuteri", qty: "12", target: "95" },
  { label: "+ Santral Han · Zenta Elektronik", name: "Zenta Elektronik", qty: "20", target: "85" },
  { label: "+ Santral Han · Yıldız Saat", name: "Yıldız Saat", qty: "10", target: "240" },
  { label: "+ Şark Han · Emre Aksesuar", name: "Emre Aksesuar", qty: "24", target: "45" },
  { label: "+ Mısır Çarşısı · Arif Bey Baharat", name: "Arif Bey Baharat", qty: "2", target: "280" },
  { label: "+ Zincirli Han · Anadolu Halı", name: "Anadolu Halı", qty: "1", target: "4500" },
  { label: "+ Kürkçü Han · Sultan Tekstil", name: "Sultan Tekstil", qty: "20", target: "180" },
  { label: "+ Kalcılar Han · Kaya Gümüş", name: "Kaya Gümüş", qty: "5", target: "750" },
];

export default function PlanPage() {
  const { state, save, toast } = useApp();
  const router = useRouter();
  const { lang, currency, mode } = state;
  const dragged = useRef<string | null>(null);
  const [row, setRow] = useState({ name: "", qty: "", target: "" });
  const [appt, setAppt] = useState({ time: "", title: "", where: "" });
  const [openFloorPlaceId, setOpenFloorPlaceId] = useState<string | null>("santral");
  const [selectedShopTarget, setSelectedShopTarget] = useState<{ placeId: string; floor: number; door: string } | null>(null);
  const [showLiveMap, setShowLiveMap] = useState<boolean>(true);
  const [mobilePlanTab, setMobilePlanTab] = useState<"route" | "list">("route");
  const isStacked = state.vw < 1180;

  const trip: Trip | null = (state.trips || []).find((t) => t.id === state.tripId) || (state.trips || [])[0] || null;

  const patchTrip = (patch: Partial<Trip>) => {
    if (!trip) return;
    save({ trips: (state.trips || []).map((t) => (t.id === trip.id ? { ...t, ...patch } : t)) });
  };

  const plan = useMemo(
    () => (trip ? buildPlan(trip, { lang, mode, events: state.evPlan || [], appointments: state.appts || [] }) : null),
    [trip, lang, mode, state.evPlan, state.appts],
  );

  const cv = (n: number | null) => convert(n, lang, currency);

  if (!trip || !plan) {
    return (
      <div style={sx("max-width:1480px;margin:0 auto;padding:26px 24px 48px")}>
        <EmptyState
          icon="rocket"
          tone="neutral"
          title={W(lang, "planEmpty")}
          description={W(lang, "planEmptyBody")}
          actions={<Button color="primary" onClick={() => router.push(href.search())}>{W(lang, "search")}</Button>}
        />
      </div>
    );
  }

  const total = (trip.items || []).reduce((n, it) => {
    const t = Number(it.target);
    const q = Number(it.qty) || 0;
    return t > 0 && q > 0 ? n + t * q : n;
  }, 0);
  const pctUsed = Math.min(100, Math.round((plan.used / Math.max(1, plan.budget)) * 100));

  return (
    <div style={sx("max-width:1480px;margin:0 auto;padding:" + pagePad(state.vw))}>
      <header style={sx("display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap")}>
        <div style={sx("flex:1;min-width:240px")}>
          <h1 style={sx("font-size:26px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0")}>{W(lang, "planTitle")}</h1>
          <p style={sx("font-size:14px;color:var(--text-muted);margin-top:4px;max-width:70ch;text-wrap:pretty")}>{W(lang, "planSub")}</p>
        </div>
        <Button
          variant="outline"
          color="primary"
          size="md"
          onClick={() => {
            const t: Trip = {
              id: "t" + Date.now(),
              name: pk({ tr: "Yeni plan", en: "New plan", ru: "Новый план", ar: "خطة جديدة" }, lang),
              day: "today", start: 10, hours: 3,
              intent: mode === "toptan" ? "is" : "gez",
              carry: "el", items: [], done: [], phase: "niyet",
            };
            save({ trips: (state.trips || []).concat([t]), tripId: t.id });
          }}
        >
          {pk({ tr: "Yeni plan", en: "New plan", ru: "Новый план", ar: "خطة جديدة" }, lang)}
        </Button>
      </header>

      {/* named plans */}
      {(state.trips || []).length > 1 && (
        <div style={sx("display:flex;gap:8px;flex-wrap:wrap;margin-top:14px")}>
          {(state.trips || []).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => save({ tripId: t.id })}
              style={sx(
                "height:32px;padding:0 12px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid " +
                  (t.id === trip.id
                    ? "var(--color-primary);background:var(--color-primary-soft);color:var(--color-primary-accent)"
                    : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* phases */}
      <div style={sx("display:flex;gap:8px;flex-wrap:wrap;margin-top:14px")} role="tablist">
        {(
          [
            ["niyet", pk({ tr: "1 · Niyet", en: "1 · Intent", ru: "1 · Замысел", ar: "١ · النية" }, lang)],
            ["rota", pk({ tr: "2 · Rota", en: "2 · Route", ru: "2 · Маршрут", ar: "٢ · المسار" }, lang)],
            ["yuruyus", pk({ tr: "3 · Yürüyüş", en: "3 · Walk", ru: "3 · Прогулка", ar: "٣ · المسير" }, lang)],
          ] as [Trip["phase"], string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={trip.phase === id}
            onClick={() => patchTrip({ phase: id })}
            style={sx(
              "height:36px;padding:0 15px;border-radius:8px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;border:1px solid " +
                (trip.phase === id
                  ? "var(--color-primary);background:var(--color-primary);color:#fff"
                  : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mobile / Tablet Segmented Switcher: Yürüyüş Rotam vs Alım Listem */}
      {isStacked && (
        <div
          style={sx(
            "display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;border-radius:12px;background:var(--surface-muted);border:1px solid var(--border-strong);margin-top:14px",
          )}
        >
          <button
            type="button"
            onClick={() => setMobilePlanTab("route")}
            style={sx(
              "height:38px;border-radius:9px;border:none;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;" +
                (mobilePlanTab === "route"
                  ? "background:var(--color-primary);color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.12)"
                  : "background:transparent;color:var(--text-body)"),
            )}
          >
            <Icon name="route" size={15} />
            {pk({ tr: `Yürüyüş Rotam (${plan.kept.length} Durak)`, en: `Walking Route (${plan.kept.length})` }, lang)}
          </button>
          <button
            type="button"
            onClick={() => setMobilePlanTab("list")}
            style={sx(
              "height:38px;border-radius:9px;border:none;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;" +
                (mobilePlanTab === "list"
                  ? "background:var(--color-primary);color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.12)"
                  : "background:transparent;color:var(--text-body)"),
            )}
          >
            <Icon name="bag" size={15} />
            {pk({ tr: `Alım Listem (${(trip.items || []).length} Kalem)`, en: `Buying List (${(trip.items || []).length})` }, lang)}
          </button>
        </div>
      )}

      <div className="han-plan-grid" style={sx(planGrid(state.vw))}>
        <main style={sx(isStacked && mobilePlanTab === "list" ? "display:none" : "min-width:0")}>
          {/* ── 1-Click Ready-Made Smart Route Templates ───────────────── */}
          <section style={sx(CARD + ";margin-bottom:16px;border-color:var(--color-primary)")}>
            <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap")}>
              <div>
                <div style={sx(KICKER + ";display:inline-flex;align-items:center;gap:6px")}>
                  <Icon name="bolt" size={14} /> {pk({ tr: "Tek Tıkla Hazır İnteraktif Rota Şablonları", en: "1-Click Interactive Route Templates" }, lang)}
                </div>
                <div style={sx("font-size:13.5px;color:var(--text-body);margin-top:3px")}>
                  {pk(
                    {
                      tr: "Tek tek ürün yazmakla uğraşmayın; Santral Han ve Tarihi Yarımada için hazır rotalardan birini seçip anında canlı harita ve kat planıyla yürüyüşe başlayın.",
                      en: "Skip manual typing — pick a ready-made route starting at Santral Han with live outdoor map and indoor floor plans.",
                    },
                    lang,
                  )}
                </div>
              </div>
            </div>

            <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:10px;margin-top:12px")}>
              {ROUTE_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  style={sx(
                    "padding:12px 14px;border-radius:12px;border:1px solid var(--border-strong);background:var(--surface-muted);display:flex;flex-direction:column;justify-content:space-between;gap:10px",
                  )}
                >
                  <div>
                    <Badge color="primary" variant="light">
                      <Icon name={tpl.icon} size={12} /> {tpl.badge}
                    </Badge>
                    <div style={sx("font-size:14.5px;font-weight:800;color:var(--text-heading);margin-top:6px")}>
                      {pk(tpl.title, lang)}
                    </div>
                    <div style={sx("font-size:12px;color:var(--text-body);margin-top:4px;line-height:1.45")}>
                      {pk(tpl.desc, lang)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    color="primary"
                    variant="solid"
                    iconStart="rocket"
                    fullWidth
                    onClick={() => {
                      const items = tpl.items.map((it, idx) => ({
                        ...it,
                        id: `${tpl.id}_${Date.now()}_${idx}`,
                      }));
                      patchTrip({
                        name: pk(tpl.title, lang),
                        hours: tpl.hours,
                        intent: tpl.intent,
                        carry: tpl.carry,
                        items,
                        done: [],
                        order: null,
                        phase: "rota",
                      });
                      save({ buyList: items });
                      setOpenFloorPlaceId("santral");
                      toast(
                        pk(
                          {
                            tr: "Canlı rota ve han içi kat planları yüklendi!",
                            en: "Live route and indoor floor plans loaded!",
                          },
                          lang,
                        ),
                      );
                    }}
                  >
                    {pk({ tr: "Bu Rotayı Başlat (Harita + Kat Planı)", en: "Launch This Route" }, lang)}
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* ── intent ─────────────────────────────────────────────────── */}
          {trip.phase === "niyet" && (
            <section style={sx(CARD)}>
              <div style={sx(KICKER)}>{pk({ tr: "Gününüz nasıl geçecek?", en: "How will the day go?", ru: "Как пройдёт день?", ar: "كيف سيمضي يومك؟" }, lang)}</div>

              <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:18px;margin-top:14px")}>
                <Field label={pk({ tr: "Ne zaman", en: "When", ru: "Когда", ar: "متى" }, lang)}>
                  {([["today", pk({ tr: "Bugün", en: "Today", ru: "Сегодня", ar: "اليوم" }, lang)],
                     ["tomorrow", pk({ tr: "Yarın", en: "Tomorrow", ru: "Завтра", ar: "غدًا" }, lang)],
                     ["weekend", pk({ tr: "Hafta sonu", en: "Weekend", ru: "Выходные", ar: "نهاية الأسبوع" }, lang)]] as [string, string][]).map(([id, label]) => (
                    <button key={id} type="button" onClick={() => patchTrip({ day: id })} style={sx(chip(trip.day === id))}>{label}</button>
                  ))}
                </Field>

                <Field label={pk({ tr: "Başlangıç", en: "Start", ru: "Начало", ar: "البداية" }, lang)}>
                  {[9, 10, 11, 13, 15].map((h) => (
                    <button key={h} type="button" onClick={() => patchTrip({ start: h })} style={sx(chip(trip.start === h))}>{hhmm(h * 60)}</button>
                  ))}
                </Field>

                <Field label={pk({ tr: "Kaç saatiniz var", en: "Hours you have", ru: "Сколько часов", ar: "كم ساعة لديك" }, lang)}>
                  {[2, 3, 4, 6].map((h) => (
                    <button key={h} type="button" onClick={() => patchTrip({ hours: h })} style={sx(chip(trip.hours === h))}>{h} {pk({ tr: "saat", en: "h", ru: "ч", ar: "س" }, lang)}</button>
                  ))}
                </Field>

                <Field label={pk({ tr: "Niyet", en: "Intent", ru: "Цель", ar: "الغرض" }, lang)}>
                  {([["gez", pk({ tr: "Geziyorum", en: "Browsing", ru: "Гуляю", ar: "أتجول" }, lang)],
                     ["is", pk({ tr: "İş için", en: "For business", ru: "По делу", ar: "للعمل" }, lang)]] as [Trip["intent"], string][]).map(([id, label]) => (
                    <button key={id} type="button" onClick={() => patchTrip({ intent: id })} style={sx(chip(trip.intent === id))}>{label}</button>
                  ))}
                </Field>

                {/* How you carry it changes the route: heavy last, and a cargo
                    stop at the end if you are shipping. */}
                <Field label={pk({ tr: "Aldıklarınızı nasıl taşıyacaksınız", en: "How will you carry it", ru: "Как повезёте", ar: "كيف ستحمل مشترياتك" }, lang)}>
                  {([["el", pk({ tr: "Elde", en: "By hand", ru: "В руках", ar: "باليد" }, lang)],
                     ["araba", pk({ tr: "El arabası", en: "Handcart", ru: "Тележка", ar: "عربة" }, lang)],
                     ["kargo", pk({ tr: "Kargoya vereceğim", en: "I'll ship it", ru: "Отправлю карго", ar: "سأشحنها" }, lang)]] as [string, string][]).map(([id, label]) => (
                    <button key={id} type="button" onClick={() => patchTrip({ carry: id })} style={sx(chip(trip.carry === id))}>{label}</button>
                  ))}
                </Field>
              </div>

              <div style={sx("margin-top:20px")}>
                <Button color="accent" size="lg" onClick={() => patchTrip({ phase: "rota" })}>
                  {pk({ tr: "Rotayı kur", en: "Build the route", ru: "Построить маршрут", ar: "ابنِ المسار" }, lang)}
                </Button>
              </div>
            </section>
          )}

          {/* ── route / walk ───────────────────────────────────────────── */}
          {trip.phase !== "niyet" && (
            <>
              <section style={sx(CARD)}>
                <div style={sx("display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
                  <div style={sx("flex:1;min-width:180px")}>
                    <div style={sx(KICKER)}>{W(lang, "stops")}</div>
                    <div style={sx("font-size:19px;font-weight:700;color:var(--text-heading);margin-top:4px")}>
                      {plan.kept.length} {W(lang, "stops").toLocaleLowerCase(lang === "tr" ? "tr-TR" : lang)} ·{" "}
                      {Math.floor(plan.used / 60)} {pk({ tr: "sa", en: "h", ru: "ч", ar: "س" }, lang)} {plan.used % 60}{" "}
                      {pk({ tr: "dk", en: "min", ru: "мин", ar: "د" }, lang)}
                    </div>
                  </div>
                  <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
                    <Button
                      variant={showLiveMap ? "solid" : "outline"}
                      color="primary"
                      size="sm"
                      iconStart="map"
                      onClick={() => setShowLiveMap(!showLiveMap)}
                    >
                      {showLiveMap
                        ? pk({ tr: "Canlı Haritayı Gizle", en: "Hide Live Map" }, lang)
                        : pk({ tr: "Canlı Rota Haritasını Göster", en: "Show Live Route Map" }, lang)}
                    </Button>
                    <Button variant="outline" color="primary" size="sm" iconEnd="external-link" onClick={() => router.push(href.map("route"))}>
                      {W(lang, "seeOnMap")}
                    </Button>
                  </div>
                </div>

                <div style={sx("height:8px;border-radius:999px;background:var(--surface-muted);margin-top:12px;overflow:hidden")}>
                  <div style={sx("height:100%;width:" + pctUsed + "%;background:var(--color-" + (pctUsed > 95 ? "danger" : "primary") + ")")} />
                </div>
                <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:5px")}>
                  {pk({
                    tr: trip.hours + " saatin %" + pctUsed + "'i dolu",
                    en: pctUsed + "% of your " + trip.hours + " hours is used",
                    ru: "Использовано " + pctUsed + "% из " + trip.hours + " ч",
                    ar: "استُخدم " + pctUsed + "٪ من " + trip.hours + " ساعة",
                  }, lang)}
                </div>

                {/* Embedded Live Multi-Stop Route Map (Leaflet) */}
                {showLiveMap && plan.kept.length > 0 && (
                  <div
                    style={sx(
                      "margin-top:14px;border-radius:12px;border:1px solid var(--border-strong);overflow:hidden;background:var(--surface-muted)",
                    )}
                  >
                    <div
                      style={sx(
                        "padding:8px 12px;background:var(--surface-subtle);border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12px",
                      )}
                    >
                      <span style={sx("font-weight:700;color:var(--text-primary);display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap")}>
                        <Icon name="compass" size={14} /> {pk({ tr: "Dış Mekan Hanlar Arası Yürüyüş Rotası (Numaralı Duraklar):", en: "Outdoor Inter-Han Walking Route (Numbered Stops):" }, lang)}{" "}
                        {plan.kept.map((k, idx) => `${idx + 1}. ${k.stop.place.name}`).join(" ➔ ")}
                      </span>
                      <span style={sx("color:var(--text-muted);font-weight:600")}>
                        {pk({ tr: "Haritadaki numaralı pinlere tıklayarak durağı inceleyin", en: "Click numbered pins on the map" }, lang)}
                      </span>
                    </div>
                    <iframe
                      src={`/han-map.html?lang=${lang}&pts=${encodeURIComponent(
                        serializeRoutePts(plan.kept.map((k) => ({ place: k.stop.place, shiftNote: k.shiftNote }))),
                      )}`}
                      title="Canlı Rota Haritası"
                      style={sx("display:block;width:100%;height:310px;border:none")}
                    />
                  </div>
                )}

                {/* Manual reordering: drag AND buttons. Dragging alone is hard
                    on touch and impossible from a keyboard. */}
                {trip.order && trip.order.length > 0 && (
                  <div style={sx("display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;padding:10px 12px;border-radius:10px;background:var(--color-primary-soft)")}>
                    <span style={sx("flex:1;min-width:160px;font-size:13px;font-weight:600;color:var(--color-primary-accent)")}>
                      {pk({ tr: "Sırayı siz belirlediniz", en: "You set this order", ru: "Порядок задан вами", ar: "أنت حددت الترتيب" }, lang)}
                    </span>
                    <button
                      type="button"
                      onClick={() => patchTrip({ order: null })}
                      style={sx("background:none;border:none;padding:0;font-family:inherit;font-size:13px;font-weight:700;color:var(--color-primary);cursor:pointer")}
                    >
                      {pk({ tr: "Otomatik sıraya dön", en: "Back to automatic order", ru: "Вернуть автопорядок", ar: "عد للترتيب التلقائي" }, lang)}
                    </button>
                  </div>
                )}
              </section>

              {plan.kept.length === 0 ? (
                <div style={sx("margin-top:14px")}>
                  <EmptyState
                    icon="rocket"
                    tone="neutral"
                    title={W(lang, "planEmpty")}
                    description={pk(
                      {
                        tr: "Yukarıdaki 'Tek Tıkla Hazır İnteraktif Rota Şablonları'ndan birini seçin veya sağdaki hızlı dükkân butonlarına tıklayın.",
                        en: "Pick one of the 1-Click Route Templates above or tap a quick shop chip on the right.",
                      },
                      lang,
                    )}
                    actions={
                      <Button
                        color="primary"
                        iconStart="rocket"
                        onClick={() => {
                          const tpl = ROUTE_TEMPLATES[0];
                          const items = tpl.items.map((it, idx) => ({ ...it, id: `auto_${Date.now()}_${idx}` }));
                          patchTrip({ name: pk(tpl.title, lang), items, phase: "rota" });
                          save({ buyList: items });
                        }}
                      >
                        {pk({ tr: "Santral Han & Tahtakale Örnek Rotasını Yükle", en: "Load Santral Han Sample Route" }, lang)}
                      </Button>
                    }
                  />
                </div>
              ) : (
                <div style={sx("display:flex;flex-direction:column;gap:12px;margin-top:14px")}>
                  {plan.kept.map((k, i) => {
                    const s = k.stop;
                    const acc = SC.accessOf(s.place);
                    const isDone = (trip.done || []).includes(s.place.id);
                    const isNow = !isDone && plan.kept.filter((x) => (trip.done || []).includes(x.stop.place.id)).length === i;
                    const isFloorOpen = openFloorPlaceId === s.place.id;
                    const firstRec = s.recs[0];
                    const activeFloorForStop =
                      selectedShopTarget?.placeId === s.place.id
                        ? selectedShopTarget.floor
                        : firstRec
                          ? firstRec.floor
                          : s.place.floors[0] || 0;
                    const activeDoorForStop =
                      selectedShopTarget?.placeId === s.place.id
                        ? selectedShopTarget.door
                        : firstRec
                          ? String(firstRec.door)
                          : undefined;

                    return (
                      <article
                        key={s.place.id}
                        draggable
                        onDragStart={(e) => { dragged.current = s.place.id; e.dataTransfer.effectAllowed = "move"; }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = dragged.current;
                          dragged.current = null;
                          if (from) patchTrip({ order: moveBefore(plan.orderIds, from, s.place.id) });
                        }}
                        style={sx(
                          "border:1px solid " + (isNow ? "var(--color-accent)" : isDone ? "var(--border-default)" : "var(--border-strong)") +
                            ";border-radius:14px;background:var(--surface-card);box-shadow:0 3px 4px rgba(0,0,0,.03);overflow:hidden" +
                            (isDone ? ";opacity:.55" : ""),
                        )}
                      >
                        <div style={sx("display:flex;align-items:flex-start;gap:12px;padding:15px 17px")}>
                          <span
                            style={sx(
                              "flex:none;width:32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;background:var(--color-" +
                                (isNow ? "accent" : isDone ? "success" : "primary") + ");color:#fff",
                            )}
                          >
                            {i + 1}
                          </span>

                          <div style={sx("flex:1;min-width:0")}>
                            <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
                              <div style={sx("font-size:16.5px;font-weight:800;color:var(--text-heading);letter-spacing:-.01em")}>
                                {s.place.name}
                              </div>
                              {isNow && (
                                <Badge color="accent" variant="solid">
                                  <Icon name="pin" size={12} /> {pk({ tr: "Şu Anki Durağınız", en: "Current Stop" }, lang)}
                                </Badge>
                              )}
                            </div>
                            <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px")}>
                              {hhmm(k.arrive)}–{hhmm(k.arrive + k.dwell)} ·{" "}
                              {k.walk
                                ? pk({ tr: k.walk + " dk yürüme", en: k.walk + " min walk", ru: k.walk + " мин пешком", ar: k.walk + " د سيرًا" }, lang)
                                : pk({ tr: "başlangıç durağı", en: "starting stop", ru: "старт", ar: "البداية" }, lang)}
                            </div>

                            {/* When we move an arrival, we say why. */}
                            {k.shiftNote && (
                              <div style={sx("font-size:12.5px;font-weight:600;color:var(--color-warning-accent);margin-top:5px")}>{k.shiftNote}</div>
                            )}
                            {k.heavy && (
                              <div style={sx("font-size:12.5px;color:var(--color-primary);margin-top:4px")}>
                                {pk({ tr: "Ağır alım — sona bıraktım", en: "Bulky purchase — placed last", ru: "Тяжёлая покупка — в конце", ar: "شراء ثقيل — في الآخر" }, lang)}
                              </div>
                            )}
                            <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:4px;display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
                              <span style={sx("display:inline-flex;align-items:center;gap:4px")}>
                                <Icon name={acc.lift ? "elevator" : "stairs"} size={13} />
                                {acc.lift
                                  ? pk({ tr: "asansör var", en: "lift available", ru: "лифт", ar: "مصعد" }, lang)
                                  : pk({ tr: "asansör yok, merdiven", en: "stairs only", ru: "без лифта", ar: "بلا مصعد" }, lang)}
                              </span>
                              <span>·</span>
                              <span style={sx("display:inline-flex;align-items:center;gap:4px")}>
                                <Icon name="handcart" size={13} />
                                {acc.handcart
                                  ? pk({ tr: "el arabası uygun", en: "handcart ok" }, lang)
                                  : pk({ tr: "el arabası giremez", en: "no handcart", ru: "без тележки", ar: "لا عربة" }, lang)}
                              </span>
                            </div>

                            {/* Interactive Shop Buttons inside Stop: Click to highlight on indoor floor plan */}
                            <div style={sx("display:flex;flex-direction:column;gap:6px;margin-top:10px")}>
                              <div style={sx("font-size:11.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;display:inline-flex;align-items:center;gap:5px")}>
                                <Icon name="route" size={13} /> {pk({ tr: "Bu Handaki Hedef Dükkânlarınız (Tıklayıp Kat Planında Rotayı Çizin):", en: "Target Shops in This Han (Click to Route on Floor Plan):" }, lang)}
                              </div>
                              <div style={sx("display:flex;flex-wrap:wrap;gap:6px")}>
                                {s.recs.slice(0, 6).map((r) => {
                                  const isSelectedShop =
                                    isFloorOpen &&
                                    activeFloorForStop === r.floor &&
                                    String(activeDoorForStop) === String(r.door);
                                  return (
                                    <div
                                      key={r.id}
                                      style={sx(
                                        "display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;border:1px solid " +
                                          (isSelectedShop ? "var(--color-primary)" : "var(--border-strong)") +
                                          ";background:" +
                                          (isSelectedShop ? "var(--color-primary-soft)" : "var(--surface-muted)"),
                                      )}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenFloorPlaceId(s.place.id);
                                          setSelectedShopTarget({
                                            placeId: s.place.id,
                                            floor: r.floor,
                                            door: String(r.door),
                                          });
                                        }}
                                        style={sx(
                                          "background:none;border:none;padding:0;font-family:inherit;font-size:12.5px;font-weight:700;color:var(--color-primary);cursor:pointer;text-align:start;display:inline-flex;align-items:center;gap:5px",
                                        )}
                                      >
                                        <Icon name="compass" size={13} />
                                        {(r.floor === 0
                                          ? pk({ tr: "Zemin", en: "Ground", ru: "1-й", ar: "أرضي" }, lang)
                                          : F(lang, "hanFloor", r.floor)) +
                                          " · " +
                                          (r.name || r.cat) +
                                          " · " +
                                          W(lang, "doorNo") +
                                          " " +
                                          r.door}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => router.push(href.store(r.curated || r.id))}
                                        style={sx(
                                          "background:var(--surface-card);border:1px solid var(--border-subtle);border-radius:5px;padding:3px 6px;font-family:inherit;font-size:11px;font-weight:700;color:var(--text-body);cursor:pointer;display:inline-flex;align-items:center",
                                        )}
                                        title={pk({ tr: "Dükkân sayfasına git", en: "Open shop page" }, lang)}
                                      >
                                        <Icon name="external-link" size={11} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div style={sx("display:flex;flex-wrap:wrap;gap:6px;margin-top:10px")}>
                              {s.items.map((x) => (
                                <span key={x.id} style={sx("display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:6px;font-size:12px;font-weight:600;background:var(--surface-muted);color:var(--text-body)")}>
                                  {x.name}{x.qty ? " × " + x.qty : ""}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div style={sx("flex:none;display:flex;flex-direction:column;gap:5px")}>
                            <button
                              type="button"
                              disabled={i === 0}
                              onClick={() => patchTrip({ order: reorder(plan.orderIds, s.place.id, -1) })}
                              aria-label={pk({ tr: "Yukarı taşı", en: "Move up", ru: "Вверх", ar: "لأعلى" }, lang)}
                              style={sx("width:28px;height:26px;border-radius:6px;border:1px solid var(--border-strong);background:var(--surface-card);color:var(--text-body);cursor:" + (i === 0 ? "default" : "pointer") + ";display:flex;align-items:center;justify-content:center")}
                            >
                              <Icon name="chevron-up" size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={i === plan.kept.length - 1}
                              onClick={() => patchTrip({ order: reorder(plan.orderIds, s.place.id, 1) })}
                              aria-label={pk({ tr: "Aşağı taşı", en: "Move down", ru: "Вниз", ar: "لأسفل" }, lang)}
                              style={sx("width:28px;height:26px;border-radius:6px;border:1px solid var(--border-strong);background:var(--surface-card);color:var(--text-body);cursor:" + (i === plan.kept.length - 1 ? "default" : "pointer") + ";display:flex;align-items:center;justify-content:center")}
                            >
                              <Icon name="chevron-down" size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Action Bar on Each Stop: Expand Indoor Floor Plan + Google Maps Gate Walk + Mark Done */}
                        <div style={sx("border-top:1px solid var(--border-default);padding:10px 17px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;background:var(--surface-subtle)")}>
                          <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
                            <Button
                              variant={isFloorOpen ? "solid" : "outline"}
                              color="primary"
                              size="sm"
                              iconStart="map"
                              onClick={() => setOpenFloorPlaceId(isFloorOpen ? null : s.place.id)}
                            >
                              {isFloorOpen
                                ? pk({ tr: "Han İçi Kat Planını Kapat", en: "Hide Indoor Floor Plan" }, lang)
                                : pk({ tr: `${s.place.name} Kat Planını & Kapı Rotasını Aç`, en: `Open ${s.place.name} Indoor Map` }, lang)}
                            </Button>

                            {s.place.lat && s.place.lng && (
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${s.place.lat},${s.place.lng}&travelmode=walking`}
                                target="_blank"
                                rel="noreferrer"
                                style={sx("text-decoration:none")}
                              >
                                <Button variant="outline" color="secondary" size="sm" iconStart="globe">
                                  {pk({ tr: "Google Maps ile Han Kapısına Yürü", en: "Walk to Gate (Google Maps)" }, lang)}
                                </Button>
                              </a>
                            )}
                          </div>

                          <Button
                            variant={isDone ? "light" : isNow ? "solid" : "outline"}
                            color={isDone ? "success" : isNow ? "accent" : "primary"}
                            size="sm"
                            iconStart={isDone ? "check" : "pin"}
                            onClick={() =>
                              patchTrip({
                                done: isDone ? (trip.done || []).filter((x) => x !== s.place.id) : (trip.done || []).concat(s.place.id),
                              })
                            }
                          >
                            {isDone
                              ? pk({ tr: "Tamamlandı", en: "Completed", ru: "Готово", ar: "تم" }, lang)
                              : pk({ tr: "Buradayım · Durağı Tamamla", en: "I'm Here · Mark Done", ru: "Я здесь · готово", ar: "أنا هنا · تم" }, lang)}
                          </Button>
                        </div>

                        {/* Inline Expandable Interactive Indoor Floor Map right inside the Route Stop! */}
                        {isFloorOpen && (
                          <div style={sx("padding:14px;border-top:1px solid var(--border-strong);background:var(--surface-muted)")}>
                            <SantralFloorMap
                              key={`${s.place.id}_${activeFloorForStop}_${activeDoorForStop}`}
                              placeId={s.place.id}
                              lang={lang}
                              initialFloor={activeFloorForStop}
                              initialDoor={activeDoorForStop}
                            />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}

              {/* What was cut, and why. Silently dropping a stop is worse than
                  not planning at all. */}
              {plan.cut.length > 0 && (
                <div style={sx("margin-top:14px")}>
                  <Alert
                    color="warning"
                    variant="light"
                    title={pk({ tr: "Bu güne sığmayanlar", en: "Did not fit today", ru: "Не поместилось", ar: "لم يتسع اليوم" }, lang)}
                  >
                    <div style={sx("display:flex;flex-direction:column;gap:6px;margin-top:4px")}>
                      {plan.cut.map((c) => (
                        <div key={c.stop.place.id} style={sx("display:flex;align-items:center;gap:10px;font-size:13px")}>
                          <span style={sx("flex:1;min-width:0;font-weight:700")}>{c.stop.place.name}</span>
                          <span style={sx("flex:none;font-size:12px")}>{c.why}</span>
                        </div>
                      ))}
                    </div>
                  </Alert>
                </div>
              )}

              {plan.unmatched.length > 0 && (
                <div style={sx("margin-top:14px")}>
                  <Alert
                    color="info"
                    variant="light"
                    title={pk({ tr: "Eşleşmeyen satırlar", en: "Lines with no match", ru: "Без совпадений", ar: "بنود بلا مطابقة" }, lang)}
                  >
                    <p style={sx("font-size:12.5px;margin-top:2px;text-wrap:pretty")}>
                      {pk({
                        tr: "Bunlar için kayıt bulamadık. Talep bırakırsanız uygun dükkânlara birlikte gider.",
                        en: "We found no record for these. Leave a request and it reaches every matching shop at once.",
                        ru: "Записей не найдено. Оставьте заявку.",
                        ar: "لم نجد سجلات لهذه. اترك طلبًا.",
                      }, lang)}
                    </p>
                    <div style={sx("display:flex;flex-wrap:wrap;gap:6px;margin-top:8px")}>
                      {plan.unmatched.map((it) => (
                        <Badge key={it.id} color="warning" variant="light">
                          {it.name}
                        </Badge>
                      ))}
                    </div>
                    <div style={sx("margin-top:10px")}>
                      <Button color="primary" size="sm" onClick={() => router.push(href.work("talep"))}>{F(lang, "leaveReq")}</Button>
                    </div>
                  </Alert>
                </div>
              )}

              {/* ── M5 · the day's calendar ────────────────────────────── */}
              {plan.day.length > 1 && (
                <section style={sx(CARD + ";margin-top:14px")}>
                  <div style={sx(KICKER)}>{pk({ tr: "Günün takvimi", en: "The day's calendar", ru: "Календарь дня", ar: "تقويم اليوم" }, lang)}</div>
                  <p style={sx("font-size:13px;color:var(--text-muted);margin-top:5px;text-wrap:pretty")}>
                    {pk({
                      tr: "Duraklar, etkinlikler, randevular ve kargo tek çizgide. Saati çakışan varsa burada görünür.",
                      en: "Stops, events, appointments and cargo on one line. Clashes show up here.",
                      ru: "Точки, события, встречи и карго на одной линии.",
                      ar: "المحطات والفعاليات والمواعيد والشحن على خط واحد.",
                    }, lang)}
                  </p>
                  <div style={sx("display:flex;flex-direction:column;gap:10px;margin-top:12px")}>
                    {plan.day.map((it, i) => {
                      const toneName = it.clash ? "danger" : ({ durak: "primary", etkinlik: "warning", kargo: "info", randevu: "success" } as Record<string, string>)[it.kind];
                      const t = tonePair(toneName);
                      return (
                        <div key={i} style={sx("display:flex;gap:11px")}>
                          <span style={sx("flex:none;width:9px;height:9px;border-radius:999px;margin-top:6px;background:var(--color-" + toneName + ")")} />
                          <div style={sx("flex:none;width:96px;font-size:13px;font-weight:700;color:var(--text-heading);font-variant-numeric:tabular-nums")}>
                            {it.at == null ? "—" : hhmm(it.at) + (it.end ? "–" + hhmm(it.end) : "")}
                          </div>
                          <div style={sx("flex:1;min-width:0")}>
                            <div style={sx("display:flex;align-items:center;gap:7px;flex-wrap:wrap")}>
                              <span style={sx("font-size:14px;font-weight:700;color:var(--text-heading)")}>{it.title}</span>
                              <span style={sx("display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:5px;font-size:11px;font-weight:700;background:" + t.bg + ";color:" + t.fg)}>
                                {({ durak: pk({ tr: "Durak", en: "Stop", ru: "Точка", ar: "محطة" }, lang),
                                    etkinlik: pk({ tr: "Etkinlik", en: "Event", ru: "Событие", ar: "فعالية" }, lang),
                                    kargo: pk({ tr: "Kargo", en: "Cargo", ru: "Карго", ar: "شحن" }, lang),
                                    randevu: pk({ tr: "Randevu", en: "Appointment", ru: "Встреча", ar: "موعد" }, lang) } as Record<string, string>)[it.kind]}
                              </span>
                              {it.kind === "randevu" && it.apptId && (
                                <button
                                  type="button"
                                  onClick={() => save({ appts: (state.appts || []).filter((a) => a.id !== it.apptId) })}
                                  style={sx("background:none;border:none;padding:0;font-family:inherit;font-size:12px;color:var(--text-muted);cursor:pointer")}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                            {it.meta && <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:2px")}>{it.meta}</div>}
                            {it.clash && (
                              <div style={sx("font-size:12.5px;font-weight:600;color:var(--color-danger);margin-top:3px;text-wrap:pretty")}>
                                {pk({
                                  tr: "Bu saatte bir durakta olacaksınız — biri kayacak.",
                                  en: "You'll be at a stop then — one of these has to move.",
                                  ru: "В это время вы на точке — что-то сдвинется.",
                                  ar: "ستكون في محطة حينها.",
                                }, lang)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* the third source: the buyer's own appointments */}
                  <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border-default)")}>
                    <Input size="sm" placeholder="14:30" value={appt.time} onChange={(e) => setAppt({ ...appt, time: e.target.value })} aria-label={pk({ tr: "Saat", en: "Time", ru: "Время", ar: "الوقت" }, lang)} />
                    <Input
                      size="sm"
                      placeholder={pk({ tr: "Örn. Numune teslimi", en: "e.g. Sample pickup", ru: "Напр. образец", ar: "مثلًا استلام عينة" }, lang)}
                      value={appt.title}
                      onChange={(e) => setAppt({ ...appt, title: e.target.value })}
                      aria-label={pk({ tr: "Randevu", en: "Appointment", ru: "Встреча", ar: "موعد" }, lang)}
                    />
                    <Input
                      size="sm"
                      placeholder={pk({ tr: "Nerede (isteğe bağlı)", en: "Where (optional)", ru: "Где (необяз.)", ar: "أين (اختياري)" }, lang)}
                      value={appt.where}
                      onChange={(e) => setAppt({ ...appt, where: e.target.value })}
                      aria-label={pk({ tr: "Yer", en: "Where", ru: "Где", ar: "أين" }, lang)}
                    />
                    <Button
                      color="primary"
                      size="sm"
                      onClick={() => {
                        const title = appt.title.trim();
                        const time = appt.time.trim();
                        if (!title) return toast(pk({ tr: "Randevuya bir ad verin", en: "Name the appointment", ru: "Укажите название", ar: "سمِّ الموعد" }, lang));
                        if (!/^\d{1,2}[:.]\d{2}$/.test(time)) {
                          return toast(pk({ tr: "Saati 14:30 gibi yazın", en: "Write the time like 14:30", ru: "Время как 14:30", ar: "اكتب الوقت مثل 14:30" }, lang));
                        }
                        save({
                          appts: (state.appts || []).concat([
                            { id: "ap" + Date.now(), title, time: time.replace(".", ":"), where: appt.where.trim() },
                          ]),
                        });
                        setAppt({ time: "", title: "", where: "" });
                        toast(pk({ tr: "Randevu günün takvimine eklendi", en: "Added to your day", ru: "Добавлено в день", ar: "أُضيف لليوم" }, lang));
                      }}
                    >
                      {pk({ tr: "Takvime ekle", en: "Add to day", ru: "Добавить", ar: "أضف لليوم" }, lang)}
                    </Button>
                  </div>
                </section>
              )}
            </>
          )}
        </main>

        {/* ── buying list ────────────────────────────────────────────────── */}
        <aside
          style={sx(
            "display:" +
              (isStacked && mobilePlanTab === "route" ? "none" : "flex") +
              ";flex-direction:column;gap:14px;min-width:0" +
              (state.vw >= 1180 ? ";position:sticky;top:84px" : ""),
          )}
        >
          <section style={sx(CARD)}>
            <div style={sx(KICKER)}>{W(lang, "listTitle")}</div>

            <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:12px")}>
              {(trip.items || []).map((it) => (
                <div key={it.id} style={sx("display:flex;align-items:center;gap:9px;padding:10px 11px;border-radius:10px;border:1px solid var(--border-default)")}>
                  <span style={sx("flex:1;min-width:0")}>
                    <span style={sx("display:block;font-size:14px;font-weight:600;color:var(--text-heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{it.name}</span>
                    <span style={sx("display:block;font-size:12px;color:var(--text-muted);margin-top:2px")}>
                      {[it.qty ? W(lang, "fQty") + " " + it.qty : "", it.target ? W(lang, "fTarget") + " " + it.target : ""].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => patchTrip({ items: (trip.items || []).filter((x) => x.id !== it.id) })}
                    aria-label={W(lang, "delete")}
                    style={sx("flex:none;width:28px;height:28px;border-radius:7px;border:1px solid var(--border-default);background:none;color:var(--text-muted);cursor:pointer")}
                  >
                    ×
                  </button>
                </div>
              ))}
              {!(trip.items || []).length && (
                <p style={sx("font-size:13px;color:var(--text-muted);text-wrap:pretty")}>
                  {pk({
                    tr: "Listeye ne alacağınızı yazın; rota ona göre kurulur.",
                    en: "Add what you plan to buy; the route is built around it.",
                    ru: "Добавьте покупки — маршрут построится по ним.",
                    ar: "أضف ما ستشتريه ويُبنى المسار عليه.",
                  }, lang)}
                </p>
              )}
            </div>

            <div style={sx("display:grid;grid-template-columns:1fr 70px 84px;gap:7px;margin-top:12px")}>
              <Input size="sm" placeholder={W(lang, "fName")} value={row.name} onChange={(e) => setRow({ ...row, name: e.target.value })} aria-label={W(lang, "fName")} />
              <Input size="sm" inputMode="numeric" placeholder={W(lang, "fQty")} value={row.qty} onChange={(e) => setRow({ ...row, qty: e.target.value })} aria-label={W(lang, "fQty")} />
              <Input size="sm" inputMode="numeric" placeholder={W(lang, "fTarget")} value={row.target} onChange={(e) => setRow({ ...row, target: e.target.value })} aria-label={W(lang, "fTarget")} />
            </div>
            <div style={sx("margin-top:9px")}>
              <Button
                variant="outline"
                color="primary"
                size="sm"
                fullWidth
                onClick={() => {
                  if (!row.name.trim()) return;
                  const item = { id: "b" + Date.now(), name: row.name.trim(), qty: row.qty, target: row.target };
                  patchTrip({ items: (trip.items || []).concat([item]), phase: "rota" });
                  save({ buyList: (state.buyList || []).concat([item]) });
                  setRow({ name: "", qty: "", target: "" });
                }}
              >
                {W(lang, "addRow")}
              </Button>
            </div>

            {/* 1-Click Popular Han & Shop Quick Add Chips */}
            <div style={sx("margin-top:14px;padding-top:12px;border-top:1px solid var(--border-default)")}>
              <div style={sx("font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;display:inline-flex;align-items:center;gap:5px")}>
                <Icon name="bolt" size={12} /> {pk({ tr: "Tek Tıkla Rotaya Durak Ekle:", en: "1-Click Add Stop to Route:" }, lang)}
              </div>
              <div style={sx("display:flex;flex-wrap:wrap;gap:6px;margin-top:8px")}>
                {QUICK_PICKS.map((qp) => {
                  const alreadyIn = (trip.items || []).some((x) => x.name === qp.name);
                  return (
                    <button
                      key={qp.name}
                      type="button"
                      onClick={() => {
                        if (alreadyIn) return;
                        const item = { id: `qp_${Date.now()}_${qp.name}`, name: qp.name, qty: qp.qty, target: qp.target };
                        patchTrip({ items: (trip.items || []).concat([item]), phase: "rota" });
                        save({ buyList: (state.buyList || []).concat([item]) });
                      }}
                      style={sx(
                        "height:26px;padding:0 9px;border-radius:999px;border:1px solid " +
                          (alreadyIn ? "var(--color-success)" : "var(--border-strong)") +
                          ";background:" +
                          (alreadyIn ? "var(--color-success-soft)" : "var(--surface-muted)") +
                          ";color:" +
                          (alreadyIn ? "var(--color-success)" : "var(--text-primary)") +
                          ";font-family:inherit;font-size:11px;font-weight:700;cursor:pointer",
                      )}
                    >
                      {alreadyIn ? "✓ " : ""}
                      {qp.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {total > 0 && (
              <div style={sx("display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid var(--border-default)")}>
                <span style={sx("font-size:13.5px;color:var(--text-muted)")}>
                  {pk({ tr: "Hedef toplam", en: "Target total", ru: "Целевая сумма", ar: "الإجمالي المستهدف" }, lang)}
                </span>
                <span style={sx("text-align:end")}>
                  <span style={sx("display:block;font-size:18px;font-weight:700;color:var(--color-primary)")}>{money(total)}</span>
                  <span style={sx("display:block;font-size:12px;color:var(--text-muted)")}>{cv(total)}</span>
                </span>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={sx(KICKER)}>{label}</div>
      <div style={sx("display:flex;flex-wrap:wrap;gap:7px;margin-top:9px")}>{children}</div>
    </div>
  );
}
