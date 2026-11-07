"use client";

// Etkinlikler — grouped by time, not by type.
//
// "Today · Tomorrow · This week · Later · Past" is how someone standing in the
// bazaar actually thinks about a calendar. Each card can be added to the route,
// where it lands in the day's timeline at its fixed hour (see planEngine).

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import * as AD from "@/data/han-admin";
import * as D from "@/data/han-data";
import { Button, EmptyState } from "@/ds";
import { ImageSlot } from "@/components/ImageSlot";
import { F, W } from "@/lib/copy";
import { loc, tx } from "@/lib/i18n";
import { pagePad } from "@/lib/layout";
import { PARAM, getStr, href } from "@/lib/routes";
import { placePhoto } from "@/lib/shop";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

const KIND_TONE: Record<string, string> = { fair: "primary", tour: "success", workshop: "warning", market: "info" };

const EVENT_COMPANION_ITEMS: Record<string, { name: string; qty: string; target: string }[]> = {
  zincirli: [
    { name: "Anadolu Halı", qty: "1", target: "4500" },
    { name: "Kaya Gümüş", qty: "2", target: "850" },
    { name: "Roza Bijuteri", qty: "6", target: "120" },
  ],
  kurkcu: [
    { name: "Sultan Tekstil", qty: "12", target: "180" },
    { name: "Roza Bijuteri", qty: "10", target: "95" },
    { name: "Demir Poşet", qty: "50", target: "14" },
  ],
  buyukYeni: [
    { name: "Kaya Gümüş", qty: "3", target: "750" },
    { name: "Roza Bijuteri", qty: "8", target: "110" },
    { name: "Arif Bey Baharat", qty: "2", target: "320" },
  ],
  misir: [
    { name: "Arif Bey Baharat", qty: "3", target: "320" },
    { name: "Roza Bijuteri", qty: "6", target: "110" },
    { name: "Emre Aksesuar", qty: "12", target: "45" },
  ],
  default: [
    { name: "Roza Bijuteri", qty: "10", target: "95" },
    { name: "Arif Bey Baharat", qty: "2", target: "320" },
    { name: "Kaya Gümüş", qty: "2", target: "750" },
  ],
};

export default function EventsPage() {
  return (
    <Suspense fallback={null}>
      <EventsScreen />
    </Suspense>
  );
}

function EventsScreen() {
  const { state, save, toast } = useApp();
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = state;

  const filter = getStr(sp, PARAM.eventKind, "all");
  const T = (D.L[lang] || D.L.tr) as Record<string, string>;

  const kindLabels: Record<string, string> = {
    fair: T.eventFair, tour: T.eventTour, workshop: T.eventWorkshop, market: T.eventMarket,
  };

  const rows = useMemo(() => {
    const today = new Date().getDate();
    // Panelin içerik katmanı temel veriyi bozmadan biner: eklenen etkinlik
    // burada görünür, yayından alınan hem burada hem anasayfada kaybolur.
    return AD.mergeContent(D.EVENTS || [], "events")
      .filter((e) => filter === "all" || e.kind === filter)
      .map((e) => {
        const day = parseInt(e.day as string, 10) || 0;
        const diff = day - today;
        // Buckets: today · tomorrow · this week · later · past.
        const bucket = diff < 0 ? 4 : diff === 0 ? 0 : diff === 1 ? 1 : diff <= 7 ? 2 : 3;
        const han = D.HANS.find((h) => h.id === e.han);
        const area = D.AREAS.find((a) => a.id === e.area);
        return {
          id: e.id as string,
          day: e.day as string,
          month: loc(e, "month", lang) || (e.monthTr as string),
          title: tx(e, lang),
          body: loc(e, "body", lang),
          time: e.time as string,
          hanId: (e.han as string) || "",
          areaId: (e.area as string) || "",
          where: [han ? (han.name as string) : "", area ? tx(area, lang) : ""].filter(Boolean).join(" · "),
          kind: e.kind as string,
          bucket,
          past: diff < 0,
        };
      })
      .sort((a, b) => (parseInt(a.day, 10) || 0) - (parseInt(b.day, 10) || 0));
  }, [filter, lang]);

  const groupTitles = [F(lang, "gToday"), F(lang, "gTomorrow"), F(lang, "gWeek"), F(lang, "gLater"), F(lang, "gPast")];
  const groups = groupTitles
    .map((title, i) => ({ title, items: rows.filter((r) => r.bucket === i) }))
    .filter((g) => g.items.length > 0);

  const kinds: [string, string][] = [
    ["all", F(lang, "all")],
    ...Object.keys(kindLabels).map((k) => [k, kindLabels[k]] as [string, string]),
  ];

  const toggle = (id: string) => {
    const had = (state.evPlan || []).includes(id);
    save({ evPlan: had ? state.evPlan.filter((x) => x !== id) : (state.evPlan || []).concat(id) });
    toast(had ? F(lang, "evRemove") : F(lang, "evAdd"));
  };

  const launchHalfDayWithEvent = (ev: { id: string; title: string; hanId: string; areaId: string }) => {
    const nextEvPlan = (state.evPlan || []).includes(ev.id)
      ? state.evPlan
      : (state.evPlan || []).concat(ev.id);
    const companion =
      EVENT_COMPANION_ITEMS[ev.hanId] ||
      EVENT_COMPANION_ITEMS[ev.areaId] ||
      EVENT_COMPANION_ITEMS.default;
    const newItems = companion.map((c, idx) => ({
      id: `ev_${ev.id}_${Date.now()}_${idx}`,
      name: c.name,
      qty: c.qty,
      target: c.target,
    }));
    const activeTrip = (state.trips || []).find((t) => t.id === state.tripId) || (state.trips || [])[0];
    const updatedTrips = activeTrip
      ? (state.trips || []).map((t) =>
          t.id === activeTrip.id
            ? {
                ...t,
                name: ev.title,
                hours: 4,
                intent: "etkinlik" as const,
                items: newItems,
                done: [],
                order: null,
                phase: "rota" as const,
              }
            : t,
        )
      : state.trips;

    save({
      evPlan: nextEvPlan,
      buyList: newItems,
      trips: updatedTrips,
    });
    toast(
      lang === "tr"
        ? `"${ev.title}" etkinliği ve çevresindeki han duraklarıyla yarım günlük rota kuruldu!`
        : `Half-day route built around "${ev.title}"!`,
    );
    router.push(href.plan());
  };

  return (
    <div style={sx("max-width:1480px;margin:0 auto;" + pagePad(state.vw))}>
      {/* Quick Banner: Özel Gün Alışverişi mi Planlıyorsunuz? */}
      <div
        onClick={() => router.push(href.plan())}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") router.push(href.plan());
        }}
        style={sx(
          "margin-bottom:18px;padding:14px 18px;border-radius:14px;border:1px solid var(--color-accent);background:var(--color-accent-soft);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;cursor:pointer",
        )}
      >
        <div style={sx("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
          <span style={sx("font-size:15px;font-weight:800;color:var(--text-heading)")}>
            {lang === "tr"
              ? "💍 Özel Gün Alışverişi mi Planlıyorsunuz? (Söz · Nişan · Düğün · Mevlüt · Butik)"
              : "💍 Planning Occasion Shopping? (Engagement · Wedding · Baby Shower · Boutique)"}
          </span>
          <span style={sx("font-size:13px;color:var(--text-body)")}>
            {lang === "tr"
              ? "Davetli sayısına göre %10 fireli adet hesaplayıcı ve toptan (MOQ) tasarruf sihirbazıyla rotanızı tek tıkla kurun."
              : "Auto-calculate quantities with +10% buffer and wholesale (MOQ) savings in the Route Planner."}
          </span>
        </div>
        <Button
          size="sm"
          color="accent"
          variant="solid"
          iconEnd="arrow-right"
          onClick={(e) => {
            e.stopPropagation();
            router.push(href.plan());
          }}
        >
          {lang === "tr" ? "Özel Gün Sihirbazını Aç" : "Open Occasion Wizard"}
        </Button>
      </div>

      <header style={sx("display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap")}>
        <div style={sx("flex:1;min-width:240px")}>
          <h1 style={sx("font-size:26px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0")}>{T.eventsTitle}</h1>
          <p style={sx("font-size:14px;color:var(--text-muted);margin-top:4px;max-width:70ch;text-wrap:pretty")}>{F(lang, "evSub")}</p>
        </div>
        {(state.evPlan || []).length > 0 && (
          <Button variant="outline" color="primary" size="md" onClick={() => router.push(href.plan())}>
            {F(lang, "evPlanTitle")} · {state.evPlan.length}
          </Button>
        )}
      </header>

      <div style={sx("display:flex;gap:7px;flex-wrap:wrap;margin-top:16px")}>
        {kinds.map(([id, label]) => {
          const on = filter === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => router.push(href.events(id === "all" ? undefined : id))}
              aria-pressed={on}
              style={sx(
                "height:34px;padding:0 14px;border-radius:999px;font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer;border:1px solid " +
                  (on ? "var(--color-primary);background:var(--color-primary);color:#fff" : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <div style={sx("margin-top:22px")}>
          <EmptyState icon="calendar" tone="neutral" title={W(lang, "noEvents")} description={W(lang, "noEventsBody")} />
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.title} style={sx("margin-top:26px")}>
            <div style={sx("display:flex;align-items:baseline;gap:10px")}>
              <h2 style={sx("font-size:18px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em")}>{g.title}</h2>
              <span style={sx("font-size:13px;color:var(--text-muted)")}>{F(lang, "evCount", g.items.length)}</span>
            </div>

            <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:16px;margin-top:14px")}>
              {g.items.map((e) => {
                const on = (state.evPlan || []).includes(e.id);
                const tone = KIND_TONE[e.kind] || "primary";
                return (
                  <article
                    key={e.id}
                    style={sx(
                      "background:var(--surface-card);border:1px solid " + (on ? "var(--color-accent)" : "var(--border-strong)") +
                        ";border-radius:14px;box-shadow:0 3px 4px rgba(0,0,0,.03);overflow:hidden" + (e.past ? ";opacity:.55" : ""),
                    )}
                  >
                    <div style={sx("position:relative;height:150px;background:var(--surface-muted)")}>
                      <ImageSlot src={placePhoto("han")} placeholder={e.title} decorative />
                      {/* White date badge on the photo — the thing you scan for. */}
                      <span style={sx("position:absolute;top:12px;inset-inline-start:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;width:52px;height:52px;border-radius:12px;background:#fff;box-shadow:0 3px 8px rgba(0,0,0,.15)")}>
                        <span style={sx("font-size:20px;font-weight:700;line-height:1;color:var(--text-heading)")}>{e.day}</span>
                        <span style={sx("font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--text-muted);margin-top:2px")}>{e.month}</span>
                      </span>
                      <span
                        style={sx(
                          "position:absolute;top:12px;inset-inline-end:12px;display:inline-flex;align-items:center;height:28px;padding:0 11px;border-radius:999px;font-size:12.5px;font-weight:700;color:#fff;background:var(--color-" +
                            tone + ");box-shadow:0 3px 8px rgba(0,0,0,.15)",
                        )}
                      >
                        {kindLabels[e.kind] || ""}
                      </span>
                    </div>

                    <div style={sx("padding:15px 17px 17px")}>
                      <div style={sx("font-size:12.5px;color:var(--text-muted);font-variant-numeric:tabular-nums")}>{e.time}</div>
                      <h3 style={sx("font-size:17px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em;margin:6px 0 0;line-height:1.3;text-wrap:pretty")}>{e.title}</h3>
                      <div style={sx("font-size:13px;color:var(--text-muted);margin-top:4px")}>{e.where}</div>
                      {e.body && <p style={sx("font-size:13.5px;color:var(--text-body);margin-top:8px;line-height:1.5;text-wrap:pretty")}>{e.body}</p>}

                      {!e.past && (
                        <div style={sx("margin-top:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
                          <Button variant={on ? "solid" : "light"} color={on ? "accent" : "primary"} size="sm" onClick={() => toggle(e.id)}>
                            {on ? F(lang, "evIn") : F(lang, "evAdd")}
                          </Button>
                          <Button
                            variant="outline"
                            color="primary"
                            size="sm"
                            iconStart="rocket"
                            onClick={() => launchHalfDayWithEvent(e)}
                          >
                            {lang === "tr" ? "🚀 Bu Etkinlikle Yarım Günlük Rota Kur" : "🚀 Build Half-Day Route with Event"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
