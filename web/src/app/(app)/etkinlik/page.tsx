"use client";

// Etkinlikler — grouped by time, not by type.
//
// "Today · Tomorrow · This week · Later · Past" is how someone standing in the
// bazaar actually thinks about a calendar. Each card can be added to the route,
// where it lands in the day's timeline at its fixed hour (see planEngine).

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import * as D from "@/data/han-data";
import { Button, EmptyState } from "@/ds";
import { ImageSlot } from "@/components/ImageSlot";
import { F, W } from "@/lib/copy";
import { loc, tx } from "@/lib/i18n";
import { PARAM, getStr, href } from "@/lib/routes";
import { placePhoto } from "@/lib/shop";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

const KIND_TONE: Record<string, string> = { fair: "primary", tour: "success", workshop: "warning", market: "info" };

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
    return (D.EVENTS || [])
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

  return (
    <div style={sx("max-width:1480px;margin:0 auto;padding:22px 24px 48px")}>
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
                        <div style={sx("margin-top:14px")}>
                          <Button variant={on ? "solid" : "light"} color={on ? "accent" : "primary"} size="sm" onClick={() => toggle(e.id)}>
                            {on ? F(lang, "evIn") : F(lang, "evAdd")}
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
