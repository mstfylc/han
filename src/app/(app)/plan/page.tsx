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
import { Button, EmptyState, Icon, Input } from "@/ds";
import { F, W } from "@/lib/copy";
import { convert, money, tonePair } from "@/lib/i18n";
import { planGrid } from "@/lib/layout";
import { href } from "@/lib/routes";
import { buildPlan, hhmm, moveBefore, reorder } from "@/lib/planEngine";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";
import type { Trip } from "@/state/types";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

const CARD = "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:18px 20px;box-shadow:0 3px 4px rgba(0,0,0,.03)";
const KICKER = "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)";

const chip = (on: boolean) =>
  "height:34px;padding:0 13px;border-radius:8px;font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer;border:1px solid " +
  (on ? "var(--color-primary);background:var(--color-primary);color:#fff" : "var(--border-strong);background:var(--surface-card);color:var(--text-body)");

export default function PlanPage() {
  const { state, save, toast } = useApp();
  const router = useRouter();
  const { lang, currency, mode } = state;
  const dragged = useRef<string | null>(null);
  const [row, setRow] = useState({ name: "", qty: "", target: "" });
  const [appt, setAppt] = useState({ time: "", title: "", where: "" });

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
    <div style={sx("max-width:1480px;margin:0 auto;padding:22px 24px 48px")}>
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

      <div style={sx(planGrid(state.vw))}>
        <main>
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
                  <Button variant="outline" color="primary" size="sm" onClick={() => router.push(href.map("route"))}>
                    {W(lang, "seeOnMap")}
                  </Button>
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
                    description={W(lang, "planEmptyBody")}
                    actions={<Button color="primary" onClick={() => router.push(href.search())}>{W(lang, "search")}</Button>}
                  />
                </div>
              ) : (
                <div style={sx("display:flex;flex-direction:column;gap:12px;margin-top:14px")}>
                  {plan.kept.map((k, i) => {
                    const s = k.stop;
                    const acc = SC.accessOf(s.place);
                    const isDone = (trip.done || []).includes(s.place.id);
                    const isNow = !isDone && plan.kept.filter((x) => (trip.done || []).includes(x.stop.place.id)).length === i;
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
                            <div style={sx("font-size:16.5px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>{s.place.name}</div>
                            <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px")}>
                              {hhmm(k.arrive)}–{hhmm(k.arrive + k.dwell)} ·{" "}
                              {k.walk
                                ? pk({ tr: k.walk + " dk yürüme", en: k.walk + " min walk", ru: k.walk + " мин пешком", ar: k.walk + " د سيرًا" }, lang)
                                : pk({ tr: "başlangıç", en: "start", ru: "старт", ar: "البداية" }, lang)}
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
                            <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:4px")}>
                              {[
                                acc.lift ? pk({ tr: "asansör var", en: "lift", ru: "лифт", ar: "مصعد" }, lang) : pk({ tr: "asansör yok, merdiven", en: "no lift, stairs", ru: "без лифта", ar: "بلا مصعد" }, lang),
                                acc.handcart ? "" : pk({ tr: "el arabası giremez", en: "no handcart", ru: "без тележки", ar: "لا عربة" }, lang),
                              ].filter(Boolean).join(" · ")}
                            </div>

                            <div style={sx("display:flex;flex-direction:column;gap:5px;margin-top:10px")}>
                              {s.recs.slice(0, 6).map((r) => (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => router.push(href.store(r.curated || r.id))}
                                  style={sx("display:block;text-align:start;background:none;border:none;padding:0;font-family:inherit;font-size:13px;color:var(--color-primary);cursor:pointer")}
                                >
                                  {(r.floor === 0
                                    ? pk({ tr: "Zemin", en: "Ground", ru: "1-й", ar: "أرضي" }, lang)
                                    : F(lang, "hanFloor", r.floor)) + " · " + (r.name || r.cat) + " · " + W(lang, "doorNo") + " " + r.door}
                                </button>
                              ))}
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

                        <div style={sx("border-top:1px solid var(--border-default);padding:10px 17px;display:flex;gap:8px;flex-wrap:wrap")}>
                          <Button
                            variant={isDone ? "light" : "outline"}
                            color={isDone ? "success" : "primary"}
                            size="sm"
                            onClick={() =>
                              patchTrip({
                                done: isDone ? (trip.done || []).filter((x) => x !== s.place.id) : (trip.done || []).concat(s.place.id),
                              })
                            }
                          >
                            {isDone
                              ? pk({ tr: "Bitti", en: "Done", ru: "Готово", ar: "تم" }, lang)
                              : pk({ tr: "Buradayım · bitti", en: "I'm here · done", ru: "Я здесь · готово", ar: "أنا هنا · تم" }, lang)}
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {/* What was cut, and why. Silently dropping a stop is worse than
                  not planning at all. */}
              {plan.cut.length > 0 && (
                <section style={sx(CARD + ";margin-top:14px;border-color:var(--color-warning)")}>
                  <div style={sx(KICKER)}>{pk({ tr: "Bu güne sığmayanlar", en: "Did not fit today", ru: "Не поместилось", ar: "لم يتسع اليوم" }, lang)}</div>
                  <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:10px")}>
                    {plan.cut.map((c) => (
                      <div key={c.stop.place.id} style={sx("display:flex;align-items:center;gap:10px;font-size:13.5px;color:var(--text-body)")}>
                        <span style={sx("flex:1;min-width:0;font-weight:600")}>{c.stop.place.name}</span>
                        <span style={sx("flex:none;font-size:12.5px;color:var(--color-warning-accent)")}>{c.why}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {plan.unmatched.length > 0 && (
                <section style={sx(CARD + ";margin-top:14px")}>
                  <div style={sx(KICKER)}>{pk({ tr: "Eşleşmeyen satırlar", en: "Lines with no match", ru: "Без совпадений", ar: "بنود بلا مطابقة" }, lang)}</div>
                  <p style={sx("font-size:13px;color:var(--text-muted);margin-top:6px;text-wrap:pretty")}>
                    {pk({
                      tr: "Bunlar için kayıt bulamadık. Talep bırakırsanız uygun dükkânlara birlikte gider.",
                      en: "We found no record for these. Leave a request and it reaches every matching shop at once.",
                      ru: "Записей не найдено. Оставьте заявку.",
                      ar: "لم نجد سجلات لهذه. اترك طلبًا.",
                    }, lang)}
                  </p>
                  <div style={sx("display:flex;flex-wrap:wrap;gap:6px;margin-top:10px")}>
                    {plan.unmatched.map((it) => (
                      <span key={it.id} style={sx("display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:6px;font-size:12.5px;font-weight:600;background:var(--color-warning-soft);color:var(--color-warning-accent)")}>
                        {it.name}
                      </span>
                    ))}
                  </div>
                  <div style={sx("margin-top:12px")}>
                    <Button color="accent" size="sm" onClick={() => router.push(href.work("talep"))}>{F(lang, "leaveReq")}</Button>
                  </div>
                </section>
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
        <aside style={sx("display:flex;flex-direction:column;gap:14px;min-width:0" + (state.vw >= 1180 ? ";position:sticky;top:84px" : ""))}>
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
                  patchTrip({ items: (trip.items || []).concat([item]) });
                  save({ buyList: (state.buyList || []).concat([item]) });
                  setRow({ name: "", qty: "", target: "" });
                }}
              >
                {W(lang, "addRow")}
              </Button>
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
