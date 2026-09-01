"use client";

// Keşfet — the arrival screen.
//
// A visitor should see the answer to "what do I do here?" before they think to
// ask it. So the hero leads with the promise the product actually keeps — which
// han, which floor, which door — then three doors by intent, then the live
// state of the bazaar, then what is on this week.

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import * as D from "@/data/han-data";
import * as L from "@/data/han-logic";
import * as SC from "@/data/han-scale";
import type { Lang } from "@/data/types";
import { Button, Icon, Input } from "@/ds";
import { ImageSlot } from "@/components/ImageSlot";
import { StoreCard } from "@/components/StoreCard";
import { F, W } from "@/lib/copy";
import { chevron, convert, num, tonePair, tx, loc } from "@/lib/i18n";
import { href } from "@/lib/routes";
import { catPhoto, medStyle, monoStyle, priceOf, shopsIn, storePhoto, whereOf } from "@/lib/shop";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

export default function DiscoverPage() {
  const { state, save } = useApp();
  const router = useRouter();
  const { lang, mode, currency } = state;
  const [q, setQ] = useState("");

  const cv = (n: number | null) => convert(n, lang, currency);
  const T = (D.L[lang] || D.L.tr) as Record<string, string>;
  const td = (k: string, a?: string | number, b?: string | number) => {
    const e = (D.TD || {})[k];
    if (!e) return "";
    let s = e[lang] || e.tr || "";
    if (a != null) s = s.replace("%s", String(a));
    if (b != null) s = s.replace("%s", String(b));
    return s;
  };

  const goSearch = (query?: string) => router.push(href.search(query ?? q));

  // ── the bazaar right now ────────────────────────────────────────────────
  // Our data knows the bazaar's hours; it does not know whether each of ten
  // thousand shutters is up. So we say what the bazaar is doing, rather than
  // inventing a shop count.
  const live = useMemo(() => {
    const now = new Date();
    const dow = now.getDay();
    const mins = now.getHours() * 60 + now.getMinutes();
    const stores = D.STORES.filter((s) => L.modeAllows(s, mode));
    const openNow = stores.filter((s) => L.isOpenNow(D, s));

    const dur = (n: number) => {
      const h = Math.floor(n / 60);
      const m = n % 60;
      return (h ? h + " " + td("hourShort") + " " : "") + m + " " + td("minShort");
    };

    const closeCount: Record<string, number> = {};
    openNow.forEach((s) => {
      const day = ((s.hours2 || D.HOURS_DEFAULT).weekly || [])[dow];
      if (day) closeCount[day[1]] = (closeCount[day[1]] || 0) + 1;
    });
    const common = Object.keys(closeCount).sort((a, b) => closeCount[b] - closeCount[a])[0];

    const earliest = (d: number) => {
      const list = stores.map((s) => ((s.hours2 || D.HOURS_DEFAULT).weekly || [])[d]).filter(Boolean) as string[][];
      return list.length ? list.map((h) => h[0]).sort((a, b) => L.toMin(a) - L.toMin(b))[0] : null;
    };
    const dayNames =
      ({
        tr: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
        en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        ru: ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"],
        ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
      } as Record<string, string[]>)[lang] || [];

    const todayOpen = earliest(dow);
    let nextDay = { i: 1, d: (dow + 1) % 7, t: "09:00" };
    for (let i = 1; i <= 7; i++) {
      const d = (dow + i) % 7;
      const t = earliest(d);
      if (t) { nextDay = { i, d, t }; break; }
    }

    const sub = openNow.length
      ? td("closesAt", common || "19:00", dur(Math.max(0, L.toMin(common || "19:00") - mins)))
      : todayOpen && mins < L.toMin(todayOpen)
        ? td("opensToday", todayOpen, dur(L.toMin(todayOpen) - mins))
        : nextDay.i === 1
          ? td("allClosed", nextDay.t)
          : td("closedToday", dayNames[nextDay.d] || "", nextDay.t);

    return { open: openNow.length > 0, sub };
    // `tick` keeps "closes in 40 min" honest as the clock moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lang, state.tick]);

  const mapTone = live.open ? "success" : "danger";

  // ── where you left off ──────────────────────────────────────────────────
  // If there is something in progress, that comes first. If there is not,
  // guided entry points by intent — nobody browses 10,000 shops.
  const resume = useMemo(() => {
    const out: { icon: string; tone: string; title: string; sub: string; go: () => void }[] = [];
    const buy = state.buyList || [];
    if (buy.length)
      out.push({ icon: "rocket", tone: "accent", title: F(lang, "kPlan", buy.length), sub: F(lang, "kPlanSub"), go: () => router.push(href.plan()) });
    if ((state.evPlan || []).length)
      out.push({ icon: "calendar", tone: "warning", title: F(lang, "kEvent", state.evPlan.length), sub: F(lang, "kEventSub"), go: () => router.push(href.plan()) });
    if (state.saved.length)
      out.push({ icon: "heart", tone: "danger", title: F(lang, "kSaved", state.saved.length), sub: F(lang, "kSavedSub"), go: () => router.push(href.search()) });
    return out;
  }, [state.buyList, state.evPlan, state.saved, lang, router]);

  const startCards = useMemo(
    () => [
      {
        icon: "rocket", tone: "accent",
        title: pk({ tr: "İlk kez mi geliyorsunuz?", en: "First time here?", ru: "Впервые здесь?", ar: "أول مرة هنا؟" }, lang),
        sub: pk({ tr: "Hangi kapıdan girip nereden başlayacağınızı gösterelim.", en: "We show which gate to use and where to start.", ru: "Покажем, с каких ворот начать.", ar: "نوضح من أي باب تبدأ." }, lang),
        go: () => router.push(href.map("yogunluk")),
      },
      {
        icon: "handcart", tone: "primary",
        title: pk({ tr: "Toptan alacaksanız", en: "Buying wholesale", ru: "Покупаете оптом", ar: "تشتري بالجملة" }, lang),
        sub: pk({ tr: "Adedi yazın; minimumu uyan dükkânlar öne gelir.", en: "Enter your quantity; shops whose minimum fits rise first.", ru: "Укажите количество; подходящие лавки выйдут вперёд.", ar: "أدخل الكمية؛ تتقدم المتاجر المناسبة." }, lang),
        go: () => { save({ mode: "toptan", qty: "200" }); router.push(href.search()); },
      },
      { icon: "category", tone: "primary", title: F(lang, "sWalk"), sub: F(lang, "sWalkSub"), go: () => router.push(href.map()) },
      { icon: "magnifier", tone: "info", title: F(lang, "sFind"), sub: F(lang, "sFindSub"), go: () => router.push(href.search()) },
      { icon: "notepad-edit", tone: "accent", title: F(lang, "sBuy"), sub: F(lang, "sBuySub"), go: () => router.push(href.plan()) },
    ],
    [lang, router, save],
  );

  const resumeCards = resume.length ? resume : startCards;

  // ── contextual category tiles ───────────────────────────────────────────
  // Each tile says why it is there — from your list, from your saved shops, or
  // simply the busiest. A grid of categories with no reason is noise.
  const homeCats = useMemo(() => {
    const seen: Record<string, boolean> = {};
    const picked: { c: Record<string, unknown>; why: string }[] = [];
    const push = (c: Record<string, unknown> | undefined, why: string) => {
      if (!c || seen[c.id as string] || picked.length >= 6) return;
      seen[c.id as string] = true;
      picked.push({ c, why });
    };
    (state.buyList || []).forEach((it) => {
      const s = D.STORES.find((x) => L.matchStore(D, x, it.name, lang));
      if (s) (s.cats || []).forEach((id) => push(D.CATS.find((c) => c.id === id), F(lang, "whyList")));
    });
    state.saved.forEach((id) => {
      const s = D.STORES.find((x) => x.id === id);
      if (s) (s.cats || []).forEach((cid) => push(D.CATS.find((c) => c.id === cid), F(lang, "whySaved")));
    });
    D.CATS.slice()
      .sort((a, b) => shopsIn(b.id as string) - shopsIn(a.id as string))
      .forEach((c) => push(c, F(lang, "whyCommon")));
    return picked;
  }, [state.buyList, state.saved, lang]);

  // ── campaigns ───────────────────────────────────────────────────────────
  const campRows = useMemo(() => {
    const areaCatWord = (areaId: string) => {
      const s = D.STORES.find((x) => L.areaOf(D, x) === areaId && (x.cats || []).length);
      const c = s ? D.CATS.find((k) => k.id === s.cats[0]) : null;
      return c ? tx(c, lang) : "";
    };
    return (D.CAMPAIGNS || []).slice(0, 4).map((c) => {
      const st = c.store ? D.STORES.find((s) => s.id === c.store) : null;
      return {
        id: c.id as string,
        tag: loc(c, "tag", lang),
        title: tx(c, lang),
        sub: loc(c, "sub", lang),
        until: loc(c, "until", lang),
        // A campaign that names a shop shows that shop; otherwise the campaign
        // placeholder. Local either way — remote Commons URLs broke offline.
        photoSrc: st ? storePhoto(st) : "/assets/ph-kampanya.png",
        tagStyle:
          "position:absolute;top:11px;inset-inline-start:11px;display:inline-flex;align-items:center;height:25px;padding:0 11px;border-radius:6px;font-size:12px;font-weight:700;background:var(--color-" +
          (c.tone || "primary") + ");color:#fff",
        go: st ? () => router.push(href.store(st.id)) : () => router.push(href.search(areaCatWord(c.area as string))),
      };
    });
  }, [lang, router]);

  // ── events ──────────────────────────────────────────────────────────────
  const homeEvents = useMemo(() => {
    const kindTone: Record<string, string> = { fair: "primary", tour: "success", workshop: "warning", market: "info" };
    const kindLbl: Record<string, string> = {
      fair: T.eventFair, tour: T.eventTour, workshop: T.eventWorkshop, market: T.eventMarket,
    };
    const dom = new Date().getDate();
    const all = (D.EVENTS || []).slice().sort((a, b) => (parseInt(a.day, 10) || 0) - (parseInt(b.day, 10) || 0));
    const upcoming = all.filter((e) => (parseInt(e.day, 10) || 0) >= dom);
    return (upcoming.length ? upcoming : all).slice(0, 3).map((e) => {
      const h = D.HANS.find((x) => x.id === e.han);
      const a = D.AREAS.find((x) => x.id === e.area);
      const tone = kindTone[e.kind as string] || "primary";
      return {
        id: e.id as string,
        day: e.day as string,
        month: loc(e, "month", lang) || (e.monthTr as string),
        title: tx(e, lang),
        time: e.time as string,
        where: [h ? (h.name as string) : "", a ? tx(a, lang) : ""].filter(Boolean).join(" · "),
        kindLabel: kindLbl[e.kind as string] || "",
        kindStyle:
          "display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:6px;font-size:11.5px;font-weight:700;background:var(--color-" +
          tone + "-soft);color:var(--color-" + tone + ")",
      };
    });
  }, [lang, T]);

  const heroStats = [
    { n: num(SC.SCALE_TOTALS.units, lang), label: pk({ tr: "dükkân birimi", en: "shop units", ru: "торговых мест", ar: "وحدة تجارية" }, lang) },
    { n: num(SC.SCALE_TOTALS.open, lang), label: pk({ tr: "onaylı kayıt", en: "approved records", ru: "подтверждённых записей", ar: "سجلًا معتمدًا" }, lang) },
    { n: String(SC.PLACES.length), label: pk({ tr: "han · çarşı · cadde", en: "hans · bazaars · streets", ru: "ханов · базаров · улиц", ar: "خان · سوق · شارع" }, lang) },
    { n: String(D.AREAS.length), label: pk({ tr: "çarşı bölgesi", en: "bazaar areas", ru: "районов", ar: "مناطق" }, lang) },
    { n: String(D.HANS.length), label: pk({ tr: "tarihi han", en: "historic hans", ru: "ханов", ar: "خانات" }, lang) },
  ];

  const heroDoors = [
    {
      icon: "rocket",
      title: pk({ tr: "Çarşıyı ilk kez geziyorum", en: "First time in the bazaar", ru: "Впервые на базаре", ar: "أول زيارة للسوق" }, lang),
      sub: pk({ tr: "Hangi kapıdan girip nereden başlayacağınızı gösterelim.", en: "We show which gate to enter and where to start.", ru: "Покажем, с каких ворот войти и с чего начать.", ar: "نوضح من أي باب تدخل وأين تبدأ." }, lang),
      go: () => router.push(href.map("yogunluk")),
    },
    {
      icon: "magnifier",
      title: pk({ tr: "Belirli bir şey arıyorum", en: "Looking for one thing", ru: "Ищу конкретную вещь", ar: "أبحث عن شيء محدد" }, lang),
      sub: pk({ tr: "Ürün adını yazın; satan dükkânları kapı numarasıyla sıralayalım.", en: "Name the product; we list the shops with door numbers.", ru: "Назовите товар — покажем лавки с номерами дверей.", ar: "اذكر المنتج ونعرض المتاجر مع أرقام الأبواب." }, lang),
      go: () => router.push(href.search()),
    },
    {
      icon: "handcart",
      title: pk({ tr: "Toptan alacağım", en: "Buying wholesale", ru: "Покупаю оптом", ar: "أشتري بالجملة" }, lang),
      sub: pk({ tr: "Adedi yazın; minimumu tutan dükkânlar öne gelsin.", en: "Enter your quantity; shops whose minimum fits come first.", ru: "Укажите количество — подходящие лавки выйдут вперёд.", ar: "أدخل الكمية لتتقدم المتاجر المناسبة." }, lang),
      go: () => { save({ mode: "toptan", qty: "200" }); router.push(href.search()); },
    },
  ];

  const popularQ = (D.CATS || []).slice(0, 6).map((c) => ({ label: tx(c, lang), value: tx(c, lang) }));
  const knowRows = (D.KNOW || []).slice(0, 4);
  const areaMini = D.AREAS.map((a) => ({
    id: a.id as string,
    name: tx(a, lang),
    what: loc(a, "what", lang),
    dot: "flex:none;width:9px;height:9px;border-radius:999px;background:var(--color-" + (a.tone || "primary") + ")",
  }));

  return (
    <div style={sx("max-width:1480px;margin:0 auto;padding:26px 24px 48px")}>
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr));gap:22px;align-items:start")}>
        {/* ── hero ───────────────────────────────────────────────────────── */}
        <div
          style={sx(
            "position:relative;overflow:hidden;background:var(--color-primary);background-image:radial-gradient(120% 130% at 100% 0%, rgba(224,138,43,.34) 0%, rgba(224,138,43,0) 46%), radial-gradient(90% 120% at 0% 100%, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 55%);border-radius:16px;padding:30px 32px 26px;box-shadow:0 3px 8px rgba(0,0,0,.07)",
          )}
        >
          <div style={sx("display:flex;align-items:center;gap:9px")}>
            <span style={sx("width:7px;height:7px;border-radius:999px;background:var(--color-accent)")} />
            <span style={sx("font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.72)")}>
              {pk({ tr: "Tarihi Yarımada · Fatih", en: "Historic Peninsula · Fatih", ru: "Исторический полуостров · Фатих", ar: "شبه الجزيرة التاريخية · الفاتح" }, lang)}
            </span>
          </div>

          <h1 style={sx("font-size:38px;font-weight:700;color:#fff;letter-spacing:-.025em;line-height:1.1;margin-top:14px;max-width:19ch;text-wrap:pretty")}>
            {pk({
              tr: "Hangi hana, hangi kata, hangi kapıya gideceğinizi söyleriz",
              en: "We tell you which han, which floor, which door",
              ru: "Скажем, в какой хан, на какой этаж, к какой двери идти",
              ar: "نخبرك بأي خان وأي طابق وأي باب تقصد",
            }, lang)}
          </h1>

          <p style={sx("font-size:16px;color:rgba(255,255,255,.82);margin-top:12px;max-width:58ch;text-wrap:pretty")}>
            {pk({
              tr: "Kapalıçarşı'dan Tahtakale'ye 30 binden fazla dükkânın tek kaydı. Ne aradığınızı yazın; kapıdan tezgâha kadar tarif edelim.",
              en: "One registry for 30,000+ shops from the Grand Bazaar to Tahtakale. Say what you need; we walk you from the gate to the counter.",
              ru: "Единый реестр 30 000+ лавок от Гранд-базара до Тахтакале. Напишите, что ищете, — доведём от ворот до прилавка.",
              ar: "سجل واحد لأكثر من ٣٠ ألف متجر من السوق المسقوف إلى تحتة قلعة. اكتب ما تبحث عنه ونرشدك من الباب إلى المحل.",
            }, lang)}
          </p>

          <form
            style={sx("display:flex;gap:10px;margin-top:22px;max-width:620px")}
            onSubmit={(e) => { e.preventDefault(); goSearch(); }}
          >
            <div style={sx("flex:1;min-width:0")}>
              <Input
                size="lg"
                iconLead="magnifier"
                placeholder={T.searchPlaceholder}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label={W(lang, "searchPh")}
              />
            </div>
            <Button color="accent" size="lg" type="submit">
              {W(lang, "search")}
            </Button>
          </form>

          <div style={sx("display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:18px")}>
            <span style={sx("font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.6)")}>
              {pk({ tr: "Sık aranan", en: "Popular", ru: "Часто ищут", ar: "الأكثر بحثًا" }, lang)}
            </span>
            {popularQ.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => goSearch(p.value)}
                style={sx("height:30px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.26);background:rgba(255,255,255,.08);color:#fff;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer")}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={sx("display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:20px;padding-top:18px;border-top:1px solid rgba(255,255,255,.16)")}>
            {heroStats.map((s) => (
              <div key={s.label} style={sx("font-size:14px;color:rgba(255,255,255,.72)")}>
                <span style={sx("font-weight:700;color:#fff")}>{s.n}</span> {s.label}
              </div>
            ))}
          </div>

          <div style={sx("margin-top:18px")}>
            <div style={sx("font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.6)")}>
              {pk({ tr: "Ne yapmak istiyorsunuz?", en: "What are you here to do?", ru: "Что вы хотите сделать?", ar: "ماذا تريد أن تفعل؟" }, lang)}
            </div>
            <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(184px,100%),1fr));gap:10px;margin-top:11px")}>
              {heroDoors.map((d) => (
                <button
                  key={d.title}
                  type="button"
                  onClick={d.go}
                  style={sx("display:flex;flex-direction:column;align-items:flex-start;gap:9px;padding:14px 15px;border-radius:13px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07);font-family:inherit;text-align:start;cursor:pointer")}
                >
                  <span style={sx("display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,.16);color:#fff")}>
                    <Icon name={d.icon} size={18} />
                  </span>
                  <span style={sx("display:block;font-size:15px;font-weight:700;color:#fff;letter-spacing:-.01em;line-height:1.25;text-wrap:pretty")}>{d.title}</span>
                  <span style={sx("display:block;font-size:12.5px;color:rgba(255,255,255,.68);line-height:1.4;text-wrap:pretty")}>{d.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── mini map ───────────────────────────────────────────────────── */}
        <div style={sx("background:var(--surface-card);border:1px solid var(--border-strong);border-radius:16px;box-shadow:0 3px 4px rgba(0,0,0,.03);overflow:hidden")}>
          <div style={sx("padding:18px 20px 14px")}>
            <div style={sx("display:flex;align-items:center;gap:10px")}>
              <div style={sx("flex:1;min-width:0")}>
                <div style={sx("font-size:19px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em")}>
                  {pk({ tr: "Çarşı haritası", en: "Bazaar map", ru: "Карта базара", ar: "خريطة السوق" }, lang)}
                </div>
                <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px;text-wrap:pretty")}>{live.sub}</div>
              </div>
              <span
                style={sx(
                  "flex:none;display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 12px;border-radius:999px;font-size:12.5px;font-weight:700;background:" +
                    tonePair(mapTone).bg + ";color:" + tonePair(mapTone).fg,
                )}
              >
                <span style={sx("width:7px;height:7px;border-radius:999px;background:var(--color-" + mapTone + ")")} />
                {live.open
                  ? pk({ tr: "Çarşı açık", en: "Bazaar open", ru: "Базар открыт", ar: "السوق مفتوح" }, lang)
                  : pk({ tr: "Çarşı kapalı", en: "Bazaar closed", ru: "Базар закрыт", ar: "السوق مغلق" }, lang)}
              </span>
            </div>
          </div>

          <div style={sx("position:relative;border-top:1px solid var(--border-default);border-bottom:1px solid var(--border-default);background:var(--surface-muted)")}>
            <iframe
              src={"/han-map.html?lang=" + lang}
              title={pk({ tr: "Çarşı haritası", en: "Bazaar map", ru: "Карта базара", ar: "خريطة السوق" }, lang)}
              style={sx("display:block;width:100%;height:236px;border:none")}
            />
            <button
              type="button"
              onClick={() => router.push(href.map())}
              style={sx("position:absolute;inset-inline-end:12px;bottom:12px;height:36px;padding:0 14px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface-card);color:var(--text-heading);font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer;box-shadow:0 3px 8px rgba(0,0,0,.07)")}
            >
              {pk({ tr: "Haritayı büyüt", en: "Open full map", ru: "Открыть карту", ar: "تكبير الخريطة" }, lang)}
            </button>
          </div>

          <div style={sx("padding:14px 20px 18px")}>
            <div style={sx("font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted)")}>
              {pk({ tr: "Semtler", en: "Areas", ru: "Районы", ar: "المناطق" }, lang)}
            </div>
            <div style={sx("display:flex;flex-direction:column;gap:1px;margin-top:10px;background:var(--border-default);border:1px solid var(--border-default);border-radius:10px;overflow:hidden")}>
              {areaMini.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => router.push("/ara?semt=" + encodeURIComponent(a.id))}
                  style={sx("display:flex;align-items:center;gap:10px;background:var(--surface-card);border:none;padding:11px 13px;font-family:inherit;text-align:start;cursor:pointer")}
                >
                  <span style={sx(a.dot)} />
                  <span style={sx("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
                    <span style={sx("font-size:14px;font-weight:600;color:var(--text-heading);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{a.name}</span>
                    <span style={sx("font-size:12.5px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{a.what}</span>
                  </span>
                  <span style={sx("flex:none;color:var(--text-muted);display:flex")}>
                    <Icon name={chevron(lang)} size={15} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── where you left off ───────────────────────────────────────────── */}
      <section style={sx("margin-top:20px")}>
        <div style={sx("display:flex;align-items:baseline;gap:12px")}>
          <h2 style={sx("font-size:17px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>
            {resume.length ? F(lang, "hmResume") : F(lang, "hmStart")}
          </h2>
          <div style={sx("font-size:13.5px;color:var(--text-muted)")}>
            {resume.length ? F(lang, "hmResumeSub") : F(lang, "hmStartSub")}
          </div>
        </div>
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:12px;margin-top:12px")}>
          {resumeCards.map((c) => (
            <button
              key={c.title}
              type="button"
              onClick={c.go}
              style={sx("display:flex;align-items:center;gap:13px;width:100%;background:var(--surface-card);border:1px solid var(--border-strong);border-radius:12px;padding:14px;min-height:74px;font-family:inherit;text-align:start;cursor:pointer;box-shadow:0 3px 4px rgba(0,0,0,.03)")}
            >
              <span style={sx(medStyle(c.tone, 42))}>
                <Icon name={c.icon} size={19} />
              </span>
              <span style={sx("flex:1;min-width:0")}>
                <span style={sx("display:block;font-size:15.5px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>{c.title}</span>
                <span style={sx("display:block;font-size:13px;color:var(--text-muted);margin-top:2px;text-wrap:pretty")}>{c.sub}</span>
              </span>
              <span style={sx("flex:none;color:var(--text-muted);display:flex")}>
                <Icon name={chevron(lang)} size={17} />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── campaigns ────────────────────────────────────────────────────── */}
      <section style={sx("margin-top:34px")}>
        <h2 style={sx("font-size:22px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em")}>
          {pk({ tr: "Bu hafta çarşıda", en: "This week in the bazaar", ru: "На этой неделе на базаре", ar: "هذا الأسبوع في السوق" }, lang)}
        </h2>
        <p style={sx("font-size:14px;color:var(--text-muted);margin-top:3px;text-wrap:pretty")}>
          {pk({ tr: "Dükkânların açtığı kampanyalar ve süreli fırsatlar.", en: "Campaigns and limited offers the shops opened.", ru: "Акции и срочные предложения лавок.", ar: "حملات وعروض محدودة من المتاجر." }, lang)}
        </p>
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(268px,100%),1fr));gap:14px;margin-top:16px")}>
          {campRows.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={c.go}
              style={sx("display:flex;flex-direction:column;align-items:stretch;padding:0;border-radius:14px;border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:0 3px 4px rgba(0,0,0,.03);overflow:hidden;font-family:inherit;text-align:start;cursor:pointer")}
            >
              <span style={sx("position:relative;display:block;height:132px;background:var(--surface-muted)")}>
                <ImageSlot src={c.photoSrc} placeholder={c.title} decorative />
                <span style={sx(c.tagStyle)}>{c.tag}</span>
              </span>
              <span style={sx("display:block;padding:14px 15px 15px")}>
                <span style={sx("display:block;font-size:16px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em;line-height:1.3;text-wrap:pretty")}>{c.title}</span>
                <span style={sx("display:block;font-size:13px;color:var(--text-muted);margin-top:5px")}>{c.sub}</span>
                <span style={sx("display:flex;align-items:center;gap:6px;margin-top:10px;font-size:12.5px;font-weight:700;color:var(--color-primary)")}>
                  <Icon name="time" size={14} />
                  {c.until}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── contextual categories ────────────────────────────────────────── */}
      <section style={sx("margin-top:34px")}>
        <div style={sx("display:flex;align-items:baseline;justify-content:space-between;gap:16px")}>
          <div>
            <h2 style={sx("font-size:22px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em")}>{F(lang, "catTitle")}</h2>
            <p style={sx("font-size:14px;color:var(--text-muted);margin-top:3px")}>{F(lang, "catSub")}</p>
          </div>
          <Button variant="outline" color="primary" size="md" onClick={() => router.push(href.category())}>
            {W(lang, "allCats")}
          </Button>
        </div>
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(190px,100%),1fr));gap:14px;margin-top:16px")}>
          {homeCats.map(({ c, why }) => {
            const id = c.id as string;
            const label = tx(c, lang);
            const group = D.CAT_GROUPS.find((g) => (g.cats || []).includes(id));
            return (
              <button
                key={id}
                type="button"
                onClick={() => router.push(href.category((group?.id as string) || null, id))}
                style={sx("display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:14px;border-radius:14px;border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:0 3px 4px rgba(0,0,0,.03);font-family:inherit;text-align:start;cursor:pointer")}
              >
                <span style={sx("display:block;width:100%;height:96px;border-radius:10px;overflow:hidden;background:var(--surface-muted)")}>
                  <ImageSlot src={catPhoto(id)} placeholder={label} decorative />
                </span>
                <span style={sx("font-size:15.5px;font-weight:700;color:var(--text-heading);line-height:1.3;letter-spacing:-.01em;text-wrap:pretty")}>{label}</span>
                <span style={sx("font-size:12.5px;color:var(--color-primary);text-wrap:pretty")}>{why}</span>
                <span style={sx("font-size:12.5px;color:var(--text-muted)")}>{F(lang, "shopCount", shopsIn(id))}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── featured shops + areas ───────────────────────────────────────── */}
      <div style={sx("margin-top:34px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:24px;align-items:start")}>
        <section>
          <h2 style={sx("font-size:22px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em;margin-bottom:16px")}>{W(lang, "featured")}</h2>
          <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(210px,100%),1fr));gap:14px")}>
            {D.STORES.filter((s) => s.verified).slice(0, 3).map((s) => {
              const p = priceOf(s, mode);
              const t = (s.trade || {}) as Record<string, unknown>;
              const sells = (t.sells || []) as string[];
              const moq = (t.toptan as { moq?: number } | null)?.moq;
              return (
                <StoreCard
                  key={s.id}
                  name={s.name as string}
                  location={whereOf(s, lang)}
                  photo={storePhoto(s)}
                  verified={!!s.verified}
                  verifiedLabel={W(lang, "cardVerified")}
                  rating={s.rating as number | null}
                  price={p.label}
                  alt={cv(p.value)}
                  fromLabel={W(lang, "from")}
                  tags={(s.groups || []).slice(0, 2).map((g: { name?: string }) => String(g.name || ""))}
                  wholesale={sells.includes("toptan")}
                  retail={sells.includes("perakende")}
                  producer={!!s.isProducer}
                  taxFree={!!s.taxFree}
                  minLabel={moq && moq > 1 ? W(lang, "minOrder", moq) : ""}
                  labels={{
                    wholesale: F(lang, "wholesale"),
                    retail: F(lang, "retail"),
                    producer: F(lang, "fProducer"),
                    taxFree: F(lang, "fTaxFree"),
                  }}
                  onOpen={() => router.push(href.store(s.id as string))}
                />
              );
            })}
          </div>
        </section>

        <section>
          <h2 style={sx("font-size:22px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em;margin-bottom:16px")}>{T.areasTitle}</h2>
          <div style={sx("display:flex;flex-direction:column;gap:1px;background:var(--border-default);border:1px solid var(--border-strong);border-radius:14px;overflow:hidden")}>
            {D.AREAS.map((a) => (
              <button
                key={a.id as string}
                type="button"
                onClick={() => router.push("/ara?semt=" + encodeURIComponent(a.id as string))}
                style={sx("display:flex;align-items:center;gap:13px;background:var(--surface-card);border:none;padding:13px 15px;min-height:66px;font-family:inherit;text-align:start;cursor:pointer")}
              >
                <span style={sx(monoStyle((a.tone as string) || "primary", 40))}>{L.monoText(tx(a, lang))}</span>
                <span style={sx("flex:1;min-width:0")}>
                  <span style={sx("display:block;font-size:15.5px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>{tx(a, lang)}</span>
                  <span style={sx("display:block;font-size:13px;color:var(--text-muted);margin-top:2px")}>
                    {F(lang, "shopCount", D.STORES.filter((s) => L.areaOf(D, s) === a.id).length)}
                  </span>
                </span>
                <span style={sx("flex:none;color:var(--text-muted);display:flex")}>
                  <Icon name={chevron(lang)} size={17} />
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* ── events + wholesale invitation ────────────────────────────────── */}
      <div style={sx("margin-top:34px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(360px,100%),1fr));gap:24px;align-items:start")}>
        <section>
          <div style={sx("display:flex;align-items:baseline;justify-content:space-between;gap:14px;margin-bottom:16px")}>
            <div>
              <h2 style={sx("font-size:22px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em")}>{T.eventsTitle}</h2>
              <p style={sx("font-size:14px;color:var(--text-muted);margin-top:3px")}>
                {pk({ tr: "Yaklaşan üç program", en: "The next three on the calendar", ru: "Три ближайших события", ar: "أقرب ثلاث فعاليات" }, lang)}
              </p>
            </div>
            <Button variant="outline" color="primary" size="md" onClick={() => router.push(href.events())}>
              {pk({ tr: "Tüm etkinlikler", en: "All events", ru: "Все события", ar: "كل الفعاليات" }, lang)}
            </Button>
          </div>
          <div style={sx("display:flex;flex-direction:column;gap:12px")}>
            {homeEvents.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => router.push(href.events())}
                style={sx("display:flex;align-items:stretch;gap:0;padding:0;border-radius:14px;border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:0 3px 4px rgba(0,0,0,.03);overflow:hidden;font-family:inherit;text-align:start;cursor:pointer")}
              >
                <span style={sx("flex:none;width:74px;background:var(--color-primary);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px 0")}>
                  <span style={sx("font-size:26px;font-weight:700;line-height:1;letter-spacing:-.02em")}>{e.day}</span>
                  <span style={sx("font-size:11.5px;font-weight:700;letter-spacing:.08em;margin-top:4px;opacity:.8")}>{e.month}</span>
                </span>
                <span style={sx("flex:1;min-width:0;padding:13px 15px")}>
                  <span style={sx("display:flex;align-items:center;gap:8px")}>
                    <span style={sx(e.kindStyle)}>{e.kindLabel}</span>
                    <span style={sx("font-size:12.5px;color:var(--text-muted);font-variant-numeric:tabular-nums")}>{e.time}</span>
                  </span>
                  <span style={sx("display:block;font-size:16px;font-weight:700;color:var(--text-heading);margin-top:7px;letter-spacing:-.01em;line-height:1.3;text-wrap:pretty")}>{e.title}</span>
                  <span style={sx("display:block;font-size:13px;color:var(--text-muted);margin-top:3px")}>{e.where}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section style={sx("background:var(--color-primary);border-radius:16px;padding:26px 28px;box-shadow:0 3px 8px rgba(0,0,0,.07)")}>
          <h2 style={sx("font-size:22px;font-weight:700;color:#fff;letter-spacing:-.015em;line-height:1.2;text-wrap:pretty")}>{td("pitchTitle")}</h2>
          <p style={sx("font-size:14.5px;color:rgba(255,255,255,.8);margin-top:10px;text-wrap:pretty")}>{td("pitchBody")}</p>
          <div style={sx("display:flex;flex-wrap:wrap;gap:10px;margin-top:20px")}>
            <button
              type="button"
              onClick={() => router.push(href.plan())}
              style={sx("height:42px;padding:0 18px;border-radius:8px;border:1px solid #fff;background:#fff;color:var(--color-primary-accent);font-family:inherit;font-size:14.5px;font-weight:700;cursor:pointer")}
            >
              {td("pitchList")}
            </button>
            <button
              type="button"
              onClick={() => router.push(href.work("talep"))}
              style={sx("height:42px;padding:0 18px;border-radius:8px;border:1px solid rgba(255,255,255,.4);background:transparent;color:#fff;font-family:inherit;font-size:14.5px;font-weight:600;cursor:pointer")}
            >
              {td("pitchReq")}
            </button>
          </div>
          <div style={sx("display:flex;flex-direction:column;gap:1px;margin-top:24px;background:rgba(255,255,255,.16);border-radius:12px;overflow:hidden")}>
            {[
              { icon: "rocket", label: pk({ tr: "Tek talep, uygun tüm dükkânlara birlikte gider.", en: "One request goes out to every matching shop at once.", ru: "Одна заявка уходит сразу всем подходящим лавкам.", ar: "طلب واحد يُرسل إلى كل المتاجر المناسبة معًا." }, lang) },
              { icon: "notepad", label: pk({ tr: "Minimum sipariş ve kademeli fiyat yan yana durur.", en: "Minimum order and tier pricing sit side by side.", ru: "Минимальный заказ и цены по градациям рядом.", ar: "الحد الأدنى للطلب والأسعار المتدرجة جنبًا إلى جنب." }, lang) },
              { icon: "verify", label: pk({ tr: "Gelen teklifleri karşılaştırıp doğrudan anlaşırsınız.", en: "Compare the offers that come back and close directly.", ru: "Сравниваете предложения и договариваетесь напрямую.", ar: "قارن العروض الواردة وأتمم الاتفاق مباشرة." }, lang) },
            ].map((p) => (
              <span key={p.icon} style={sx("display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.07);padding:12px 14px")}>
                <span style={sx("flex:none;display:flex;color:#fff;opacity:.85")}>
                  <Icon name={p.icon} size={17} />
                </span>
                <span style={sx("font-size:13.5px;color:rgba(255,255,255,.9);text-wrap:pretty")}>{p.label}</span>
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* ── what you should know ─────────────────────────────────────────── */}
      <section style={sx("margin-top:34px")}>
        <h2 style={sx("font-size:22px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em")}>{T.knowTitle}</h2>
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr));gap:14px;margin-top:16px")}>
          {knowRows.map((k, i) => (
            <div key={i} style={sx("border-radius:14px;border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:0 3px 4px rgba(0,0,0,.03);padding:18px")}>
              <div style={sx("display:flex;align-items:center;gap:11px")}>
                <span style={sx(medStyle((k.tone as string) || "primary", 36))}>
                  <Icon name={k.icon as string} size={18} />
                </span>
                <div style={sx("font-size:15.5px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em;text-wrap:pretty")}>{tx(k, lang)}</div>
              </div>
              <div style={sx("font-size:13.5px;color:var(--text-body);margin-top:10px;line-height:1.55;text-wrap:pretty")}>{loc(k, "body", lang)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
