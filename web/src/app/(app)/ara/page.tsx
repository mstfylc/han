"use client";

// Ara — three columns: filters · results · detail.
//
// The URL owns everything navigational here (query, sort, facets, page, the
// selected panel), so back/forward work, a refresh keeps the view, and a copied
// link opens the same thing for someone else. That is the whole point of W1.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import type { Lang, SearchFilters, SortKey } from "@/data/types";
import { Alert, Button, Icon } from "@/ds";
import { DetailPanel } from "@/components/search/DetailPanel";
import { Filters } from "@/components/search/Filters";
import { ResultRow, ResultSkeleton } from "@/components/search/ResultList";
import { F, W } from "@/lib/copy";
import { convert, money, num, tx } from "@/lib/i18n";
import { CARD_BOX, STICKY_TOP, areaOn, breaks, searchGrid } from "@/lib/layout";
import { PARAM, getList, getNum, getPanel, getStr, href, panelParam, withParams } from "@/lib/routes";
import { medStyle } from "@/lib/shop";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";
import type { Panel, SavedSearch } from "@/state/types";

const PER_PAGE = 40;
const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchScreen />
    </Suspense>
  );
}

function SearchScreen() {
  const { state, save, set, toast, loading } = useApp();
  const router = useRouter();
  const sp = useSearchParams();
  const { lang, mode, currency } = state;
  const b = breaks(state.vw);

  // ── URL-owned state ─────────────────────────────────────────────────────
  const q = getStr(sp, PARAM.q);
  const sort = getStr(sp, PARAM.sort, "uygunluk");
  const semtFilter = getStr(sp, PARAM.semt, "all");
  const placeFilter = getStr(sp, "yer", "all");
  const sectorFilter = getStr(sp, PARAM.trade, "all");
  const statusFilter = getStr(sp, "durum", "all");
  const flagFilters = getList(sp, PARAM.flags);
  const page = Math.max(1, getNum(sp, PARAM.page, 1));
  const qtyParam = getStr(sp, "adet", state.qty || "");
  const panel = getPanel(sp);
  const hanFloor = getNum(sp, PARAM.floor, 0);

  // The text box is local so typing stays smooth; the URL updates on submit.
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const nav = useCallback(
    (patch: Record<string, string | number | string[] | null | undefined>, replace = false) => {
      const url = "/ara" + withParams(sp, patch);
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [router, sp],
  );

  // ── the search itself ───────────────────────────────────────────────────
  const qty = Number(String(qtyParam || "").replace(/[^\d]/g, "")) || 0;

  const res = useMemo(() => {
    const filters: SearchFilters = {
      semt: semtFilter,
      place: placeFilter,
      sector: sectorFilter,
      status: statusFilter,
      activeOnly: statusFilter === "aktif",
      shipsAbroad: flagFilters.includes("export"),
      taxFree: flagFilters.includes("taxfree"),
      producer: flagFilters.includes("producer"),
      moqMax: qty || undefined,
    };
    return SE.search(q, filters, { mode, sort: sort as SortKey, qty, lang });
    // `offersRev` changes when another surface writes — an approval elsewhere
    // must change what this list shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, semtFilter, placeFilter, sectorFilter, statusFilter, flagFilters.join(","), qty, mode, sort, lang, state.offersRev]);

  const totalPages = Math.max(1, Math.ceil(res.total / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const slice = res.items.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  // Record the query once it has actually been run, newest first, no repeats.
  const lastLogged = useRef<string>("");
  useEffect(() => {
    const trimmed = q.trim();
    if (!trimmed || trimmed === lastLogged.current) return;
    lastLogged.current = trimmed;
    save({ qHist: [trimmed].concat((state.qHist || []).filter((x) => x !== trimmed)).slice(0, 8) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // ── keyboard: "/" focuses search, Esc closes the panel ──────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('[data-han-search] input');
        input?.focus();
      }
      if (e.key === "Escape" && panel) nav({ [PARAM.panel]: null, [PARAM.floor]: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, nav]);

  const cv = (n: number | null) => convert(n, lang, currency);
  const hasFilters =
    semtFilter !== "all" || placeFilter !== "all" || sectorFilter !== "all" || statusFilter !== "all" || flagFilters.length > 0;

  const openPanel = useCallback(
    (kind: Panel["kind"], id: string) => nav({ [PARAM.panel]: panelParam({ kind, id }), [PARAM.floor]: null }),
    [nav],
  );

  // A curated record opens its rich page; a scale record opens the same page
  // driven by the generated record. One template, two data sources.
  const openRecord = useCallback(
    (recId: string, curated: string | null) => router.push(href.store(curated || recId)),
    [router],
  );

  const toggleSave = useCallback(
    (id: string) => {
      const had = state.saved.includes(id);
      save({ saved: had ? state.saved.filter((x) => x !== id) : state.saved.concat(id) });
      toast(had ? W(lang, "removedHint") : W(lang, "saveHint"));
    },
    [state.saved, save, toast, lang],
  );

  const togglePick = useCallback(
    (id: string) => {
      const cur = state.cmpPick || [];
      if (cur.includes(id)) return set({ cmpPick: cur.filter((x) => x !== id) });
      if (cur.length >= 5) {
        return toast(pk({ tr: "En çok 5 dükkân karşılaştırılır", en: "Compare up to 5 shops", ru: "Не более 5 магазинов", ar: "حتى ٥ متاجر" }, lang));
      }
      set({ cmpPick: cur.concat(id) });
    },
    [state.cmpPick, set, toast, lang],
  );

  const saveSearch = useCallback(() => {
    const trimmed = q.trim();
    if (!trimmed) return toast(pk({ tr: "Önce bir arama yapın", en: "Search for something first", ru: "Сначала выполните поиск", ar: "ابحث أولًا" }, lang));
    if ((state.savedSearches || []).some((x) => x.q === trimmed && (x.filters || {}).semt === semtFilter)) {
      return toast(pk({ tr: "Bu arama zaten kayıtlı", en: "Already saved", ru: "Уже сохранено", ar: "محفوظ سابقًا" }, lang));
    }
    const row: SavedSearch = { q: trimmed, at: Date.now(), count: res.total, filters: { semt: semtFilter, mode } };
    save({ savedSearches: [row].concat(state.savedSearches || []).slice(0, 6) });
    toast(pk({ tr: "Arama kaydedildi", en: "Search saved", ru: "Поиск сохранён", ar: "تم الحفظ" }, lang));
  }, [q, state.savedSearches, semtFilter, mode, res.total, save, toast, lang]);

  // ── product bridge (M2) ─────────────────────────────────────────────────
  // A wholesaler thinks in products, not shops: if the query lands on a variety
  // group, offer the product view before the shop list.
  const bridge = useMemo(() => (q ? SE.productForQuery(q, { mode }) : null), [q, mode]);

  // Paid placement: a labelled strip of its own. Organic ranking is never sold,
  // so this never mixes into the list below it.
  const sponsored = useMemo(() => {
    const key = res.parsed.cats[0];
    return key ? SC.sponsorsFor("kategori", key) : [];
  }, [res.parsed.cats]);

  const unitHits = useMemo(() => SE.unitLookup(q), [q]);

  // "This work is dense in these three hans" — meet the buyer with places, not
  // with ten thousand shops.
  const placeChips = useMemo(
    () =>
      Object.entries(res.facets.place)
        .sort((a, c) => c[1] - a[1])
        .slice(0, 6)
        .map(([id, n]) => ({ id, label: (SC.PLACES.find((p) => p.id === id) || { name: id }).name, n })),
    [res.facets.place],
  );

  const units = SC.PLACES.reduce((t, p) => t + (semtFilter === "all" || p.semt === semtFilter ? p.units : 0), 0);
  const totals = SC.SCALE_TOTALS;

  const idle = !q.trim() && !hasFilters;

  return (
    <div style={sx(searchGrid(b))}>
      {/* ── filters ─────────────────────────────────────────────────────── */}
      <aside style={sx(areaOn("f") + CARD_BOX + (b.three ? STICKY_TOP : ""))} data-han-search aria-label={F(lang, "flags")}>
        <Filters
          lang={lang}
          q={draft}
          onQ={setDraft}
          onSubmitQ={() => nav({ [PARAM.q]: draft || null, [PARAM.page]: null })}
          res={res}
          sort={sort}
          onSort={(s) => nav({ [PARAM.sort]: s === "uygunluk" ? null : s, [PARAM.page]: null })}
          qty={qtyParam}
          onQty={(v) => { set({ qty: v }); nav({ adet: v || null, [PARAM.page]: null }, true); }}
          semtFilter={semtFilter}
          placeFilter={placeFilter}
          sectorFilter={sectorFilter}
          statusFilter={statusFilter}
          flagFilters={flagFilters}
          onFacet={(patch) => {
            const out: Record<string, string | string[] | null> = { [PARAM.page]: null };
            if ("semtFilter" in patch) { out[PARAM.semt] = patch.semtFilter === "all" ? null : (patch.semtFilter as string); out.yer = null; }
            if ("placeFilter" in patch) out.yer = patch.placeFilter === "all" ? null : (patch.placeFilter as string);
            if ("sectorFilter" in patch) out[PARAM.trade] = patch.sectorFilter === "all" ? null : (patch.sectorFilter as string);
            if ("statusFilter" in patch) out.durum = patch.statusFilter === "all" ? null : (patch.statusFilter as string);
            if ("flagFilters" in patch) out[PARAM.flags] = (patch.flagFilters as string[]).length ? (patch.flagFilters as string[]) : null;
            nav(out);
          }}
          hasFilters={hasFilters}
          onClear={() => nav({ [PARAM.semt]: null, yer: null, [PARAM.trade]: null, durum: null, [PARAM.flags]: null, [PARAM.page]: null })}
          onBrowseCats={() => router.push(href.category())}
          qHist={state.qHist || []}
          onPickHistory={(h) => { setDraft(h); nav({ [PARAM.q]: h, [PARAM.page]: null }); }}
          onClearHistory={() => save({ qHist: [] })}
          savedSearches={state.savedSearches || []}
          onSaveSearch={saveSearch}
          onOpenSaved={(s) => nav({ [PARAM.q]: s.q, [PARAM.semt]: (s.filters?.semt as string) === "all" ? null : (s.filters?.semt as string), [PARAM.page]: null })}
          onRemoveSaved={(s) => save({ savedSearches: (state.savedSearches || []).filter((y) => y.at !== s.at) })}
          searchPlaceholder={(D.L[lang] || D.L.tr).searchPlaceholder as string}
        />
      </aside>

      {/* ── results ─────────────────────────────────────────────────────── */}
      <main style={sx(areaOn("l"))} id="han-sonuclar">
        <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap")}>
          <div>
            <div style={sx("font-size:15px;color:var(--text-body)")}>
              <b style={sx("font-size:19px;color:var(--text-heading);letter-spacing:-.01em")}>{num(res.total, lang)}</b>{" "}
              {W(lang, "shopsWord")}
            </div>
            {/* Coverage is stated plainly, including what is still unverified —
                an honest denominator is the whole credibility of a registry. */}
            <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:3px;text-wrap:pretty")}>
              {pk({
                tr: num(units, lang) + " dükkân birimi · " + num(totals.open, lang) + " onaylı kayıt · " + totals.declared + " kayıt doğrulanmayı bekliyor",
                en: num(units, lang) + " shop units · " + num(totals.open, lang) + " approved records · " + totals.declared + " awaiting verification",
                ru: num(units, lang) + " торговых мест · " + num(totals.open, lang) + " подтверждённых записей · " + totals.declared + " ждут проверки",
                ar: num(units, lang) + " وحدة · " + num(totals.open, lang) + " سجلًا معتمدًا · " + totals.declared + " بانتظار التحقق",
              }, lang)}
            </div>
          </div>
        </div>

        {placeChips.length > 1 && (
          <div style={sx("margin-top:12px")}>
            <div style={sx("font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)")}>
              {pk({ tr: "Bu iş nerede yoğun", en: "Where this work is dense", ru: "Где это сосредоточено", ar: "أين يتكثف هذا العمل" }, lang)}
            </div>
            <div style={sx("display:flex;flex-wrap:wrap;gap:8px;margin-top:8px")}>
              {placeChips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => router.push(href.place(c.id))}
                  style={sx("display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 13px;border-radius:999px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:13.5px;font-weight:600;color:var(--text-body);cursor:pointer")}
                >
                  {c.label}
                  <span style={sx("font-weight:700;color:var(--color-primary)")}>{c.n}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {bridge && (
          <button
            type="button"
            onClick={() => router.push(href.product(bridge.cat, bridge.slug))}
            style={sx("display:flex;align-items:center;gap:14px;width:100%;margin-top:14px;padding:15px 18px;border-radius:14px;border:1px solid var(--color-primary);background:var(--color-primary-soft);font-family:inherit;text-align:start;cursor:pointer")}
          >
            <span style={sx("flex:1;min-width:0")}>
              <span style={sx("display:block;font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--color-primary-accent)")}>
                {pk({ tr: "Bunu arıyorsanız", en: "If this is what you want", ru: "Если вы ищете это", ar: "إذا كنت تبحث عن هذا" }, lang)}
              </span>
              <span style={sx("display:block;font-size:16px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em;margin-top:4px;text-wrap:pretty")}>
                {bridge.name}
              </span>
              <span style={sx("display:block;font-size:13px;color:var(--text-body);margin-top:3px")}>
                {pk({
                  tr: bridge.shops + " dükkân satıyor" + (bridge.band ? " · " + cv(bridge.band[0]) + " – " + cv(bridge.band[1]) : ""),
                  en: bridge.shops + " shops carry it" + (bridge.band ? " · " + cv(bridge.band[0]) + " – " + cv(bridge.band[1]) : ""),
                  ru: bridge.shops + " лавок" + (bridge.band ? " · " + cv(bridge.band[0]) + " – " + cv(bridge.band[1]) : ""),
                  ar: bridge.shops + " متجرًا" + (bridge.band ? " · " + cv(bridge.band[0]) + " – " + cv(bridge.band[1]) : ""),
                }, lang)}
              </span>
            </span>
            <span style={sx("flex:none;font-size:13.5px;font-weight:700;color:var(--color-primary);white-space:nowrap")}>
              {pk({ tr: "Ürün sayfasını aç", en: "Open product page", ru: "Открыть страницу товара", ar: "افتح صفحة المنتج" }, lang)} →
            </span>
          </button>
        )}

        {sponsored.length > 0 && (
          <div style={sx("margin-top:14px;padding:14px;border-radius:14px;border:1px dashed var(--color-accent);background:var(--color-accent-soft)")}>
            <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap")}>
              <span style={sx("display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:5px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;background:var(--color-accent);color:#fff")}>
                {pk({ tr: "Sponsorlu", en: "Sponsored", ru: "Реклама", ar: "مُموّل" }, lang)}
              </span>
              <span style={sx("font-size:12px;color:var(--text-muted)")}>
                {pk({ tr: "Ücretli yerleşim · organik sıralamayı etkilemez", en: "Paid placement · does not affect organic ranking", ru: "Платное размещение · не влияет на выдачу", ar: "موضع مدفوع · لا يؤثر على الترتيب" }, lang)}
              </span>
            </div>
            <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(250px,100%),1fr));gap:10px;margin-top:11px")}>
              {sponsored.map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => openRecord(rec.id, rec.curated)}
                  style={sx("display:flex;gap:11px;align-items:center;padding:12px;border-radius:12px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;text-align:start;cursor:pointer")}
                >
                  <span style={sx("flex:none;width:46px;height:46px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;background:var(--color-accent-soft);color:var(--color-accent-active)")}>
                    {String(rec.name || "?").trim().charAt(0).toLocaleUpperCase("tr-TR")}
                  </span>
                  <span style={sx("flex:1;min-width:0")}>
                    <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{rec.name}</span>
                    <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                      {[(SC.PLACES.find((x) => x.id === rec.place) || { name: "" }).name, W(lang, "doorNo") + " " + rec.door].filter(Boolean).join(" · ")}
                    </span>
                    <span style={sx("display:block;font-size:12.5px;font-weight:700;color:var(--color-primary);margin-top:3px")}>
                      {rec.band ? money(rec.band[0]) + "–" + money(rec.band[1]) : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* An address search can surface a unit with no record at all — the
            honest answer to "there is a shop here" when nobody has opened it. */}
        {unitHits.length > 0 && (
          <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:14px")}>
            {unitHits.map((u, i) => (
              <div key={i} style={sx("display:flex;align-items:center;gap:12px;padding:13px 15px;border-radius:12px;border:1px dashed var(--border-strong);background:var(--surface-card)")}>
                <span style={sx("flex:none;color:var(--text-muted);display:flex")}>
                  <Icon name="abstract" size={18} />
                </span>
                <span style={sx("flex:1;min-width:0")}>
                  <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>
                    {u.place.name + (u.door ? " · " + W(lang, "doorNo") + " " + u.door : "")}
                  </span>
                  <span style={sx("display:block;font-size:13px;color:var(--text-muted);margin-top:2px;text-wrap:pretty")}>
                    {u.hasRecord
                      ? pk({ tr: "Bu adreste onaylı kayıt var — aşağıdaki listede.", en: "There is an approved record at this address — in the list below.", ru: "По этому адресу есть подтверждённая запись — ниже в списке.", ar: "هناك سجل معتمد في هذا العنوان — في القائمة أدناه." }, lang)
                      : pk({ tr: "Bu birimde bir dükkân var; kaydı henüz açılmadı.", en: "There is a shop at this unit; its record is not opened yet.", ru: "В этом помещении есть лавка; запись пока не открыта.", ar: "هناك دكان في هذه الوحدة؛ لم يُفتح سجله بعد." }, lang)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => router.push(href.trader())}
                  style={sx("flex:none;height:34px;padding:0 13px;border-radius:7px;border:1px solid var(--color-primary);background:var(--surface-card);color:var(--color-primary);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer")}
                >
                  {pk({ tr: "Sahibi misiniz?", en: "Is it yours?", ru: "Это ваша лавка?", ar: "هل هو متجرك؟" }, lang)}
                </button>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <ResultSkeleton />
        ) : slice.length > 0 ? (
          <div style={sx("display:flex;flex-direction:column;gap:10px;margin-top:14px")}>
            {slice.map((hit) => (
              <ResultRow
                key={hit.rec.id}
                hit={hit}
                lang={lang}
                picked={(state.cmpPick || []).includes(hit.rec.id)}
                onPick={() => togglePick(hit.rec.id)}
                onOpen={() => openRecord(hit.rec.id, hit.rec.curated)}
              />
            ))}
          </div>
        ) : idle ? (
          <IdleState lang={lang} onQuery={(x) => { setDraft(x); nav({ [PARAM.q]: x }); }} />
        ) : (
          <NoResults lang={lang} hasFilters={hasFilters} scanned={res.scanned} onClear={() => nav({ [PARAM.semt]: null, yer: null, [PARAM.trade]: null, durum: null, [PARAM.flags]: null })} onRequest={() => router.push(href.work("talep"))} />
        )}

        {(state.cmpPick || []).length > 0 && (
          <div style={sx("display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px;padding:14px 16px;border-radius:13px;background:var(--color-primary);color:#fff")}>
            <div style={sx("flex:1;min-width:200px")}>
              <div style={sx("font-size:15.5px;font-weight:700;letter-spacing:-.01em")}>
                {pk({
                  tr: state.cmpPick.length + " dükkân seçili",
                  en: state.cmpPick.length + " shops selected",
                  ru: "Выбрано: " + state.cmpPick.length,
                  ar: "المحدد: " + state.cmpPick.length,
                }, lang)}
              </div>
              <div style={sx("font-size:13px;color:rgba(255,255,255,.8);margin-top:3px;text-wrap:pretty")}>
                {state.cmpPick.length < 2
                  ? pk({ tr: "Karşılaştırma için en az iki dükkân işaretleyin.", en: "Mark at least two shops to compare.", ru: "Отметьте минимум два магазина.", ar: "حدّد متجرين على الأقل." }, lang)
                  : pk({ tr: "Fiyat, minimum, teslim ve kargo yan yana gelir.", en: "Price, minimum, delivery and cargo line up side by side.", ru: "Цена, минимум, доставка — рядом.", ar: "السعر والحد الأدنى والتسليم جنبًا إلى جنب." }, lang)}
              </div>
            </div>
            <Button
              color="accent"
              size="md"
              onClick={() => {
                if (state.cmpPick.length < 2) {
                  return toast(pk({ tr: "En az iki dükkân işaretleyin", en: "Mark at least two shops", ru: "Отметьте минимум два", ar: "حدّد اثنين على الأقل" }, lang));
                }
                router.push(href.work("karsi"));
              }}
            >
              {pk({ tr: "Seçtiklerimi karşılaştır", en: "Compare my picks", ru: "Сравнить выбранные", ar: "قارن اختياراتي" }, lang)}
            </Button>
            <button
              type="button"
              onClick={() => set({ cmpPick: [] })}
              style={sx("background:none;border:1px solid rgba(255,255,255,.4);border-radius:8px;height:40px;padding:0 14px;font-family:inherit;font-size:13.5px;font-weight:600;color:#fff;cursor:pointer")}
            >
              {pk({ tr: "Seçimi bırak", en: "Clear", ru: "Сбросить", ar: "إلغاء" }, lang)}
            </button>
          </div>
        )}

        {totalPages > 1 && (
          <nav
            style={sx("display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding:12px 14px;border-radius:12px;border:1px solid var(--border-default);background:var(--surface-card)")}
            aria-label={pk({ tr: "Sayfalama", en: "Pagination", ru: "Страницы", ar: "ترقيم الصفحات" }, lang)}
          >
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => nav({ [PARAM.page]: safePage - 1 <= 1 ? null : safePage - 1 })}
              style={sx(pagerBtn(safePage > 1))}
            >
              {pk({ tr: "Önceki", en: "Previous", ru: "Назад", ar: "السابق" }, lang)}
            </button>
            <div style={sx("font-size:13.5px;color:var(--text-muted);text-align:center")}>
              {pk({
                tr: "Sayfa " + safePage + " / " + totalPages + " · " + num(res.total, lang) + " kayıt",
                en: "Page " + safePage + " of " + totalPages + " · " + num(res.total, lang) + " records",
                ru: "Стр. " + safePage + " из " + totalPages + " · " + num(res.total, lang) + " записей",
                ar: "صفحة " + safePage + " من " + totalPages + " · " + num(res.total, lang) + " سجلًا",
              }, lang)}
            </div>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => nav({ [PARAM.page]: safePage + 1 })}
              style={sx(pagerBtn(safePage < totalPages))}
            >
              {pk({ tr: "Sonraki", en: "Next", ru: "Далее", ar: "التالي" }, lang)}
            </button>
          </nav>
        )}

        {/* One request instead of walking the list: this is the product's whole
            argument for a wholesale buyer. */}
        {!!q.trim() && res.broadcast > 0 && (
          <div style={sx("display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:16px;padding:18px;border-radius:14px;background:var(--color-primary);color:#fff")}>
            <div style={sx("flex:1;min-width:240px")}>
              <div style={sx("font-size:17px;font-weight:700;letter-spacing:-.01em;text-wrap:pretty")}>
                {pk({
                  tr: "Tek tek gezmeyin: " + res.broadcast + " dükkâna aynı talebi gönderin",
                  en: "Do not browse one by one: send one request to " + res.broadcast + " shops",
                  ru: "Не листайте по одной: отправьте одну заявку " + res.broadcast + " лавкам",
                  ar: "لا تتنقل واحدًا واحدًا: أرسل طلبًا واحدًا إلى " + res.broadcast + " متجرًا",
                }, lang)}
              </div>
              <div style={sx("font-size:13.5px;color:rgba(255,255,255,.82);margin-top:4px;text-wrap:pretty")}>
                {pk({
                  tr: "Aradığınız işi yapan onaylı dükkânların hepsine gider; teklifler İşlerim'de toplanır.",
                  en: "It reaches every approved shop in this line of work; offers collect under My Work.",
                  ru: "Уйдёт всем подтверждённым лавкам этого профиля; предложения соберутся в «Мои дела».",
                  ar: "يصل إلى كل متجر معتمد في هذا المجال؛ وتُجمع العروض في «أعمالي».",
                }, lang)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => { save({ selReq: null }); router.push(href.work("talep") + "&urun=" + encodeURIComponent(q)); }}
              style={sx("flex:none;height:44px;padding:0 20px;border-radius:8px;border:none;background:#fff;color:var(--color-primary-accent);font-family:inherit;font-size:14.5px;font-weight:700;cursor:pointer")}
            >
              {pk({ tr: "Talep oluştur", en: "Create a request", ru: "Создать заявку", ar: "أنشئ طلبًا" }, lang)}
            </button>
          </div>
        )}
      </main>

      {/* ── detail ──────────────────────────────────────────────────────── */}
      <aside style={sx(areaOn("d") + (b.three ? STICKY_TOP : ""))} aria-label={W(lang, "pickTitle")}>
        <DetailPanel
          panel={panel}
          lang={lang}
          mode={mode}
          currency={currency}
          hanFloor={hanFloor}
          saved={state.saved}
          onClose={() => nav({ [PARAM.panel]: null, [PARAM.floor]: null })}
          onOpenPanel={openPanel}
          onFloor={(n) => nav({ [PARAM.floor]: n || null }, true)}
          onToggleSave={toggleSave}
          onAddToPlan={(s) => {
            const item = { id: "b" + Date.now(), name: s.name, qty: "1", target: "" };
            save({ buyList: (state.buyList || []).concat(item) });
            toast(W(lang, "addPlan"));
          }}
        />
      </aside>
    </div>
  );
}

const pagerBtn = (on: boolean) =>
  "height:36px;padding:0 15px;border-radius:8px;border:1px solid " +
  (on
    ? "var(--border-strong);background:var(--surface-card);color:var(--text-heading)"
    : "var(--border-default);background:var(--surface-muted);color:var(--text-muted)") +
  ";font-family:inherit;font-size:13.5px;font-weight:700;cursor:" + (on ? "pointer" : "default");

/** Nothing typed yet: show the ways in, with a worked example each. */
function IdleState({ lang, onQuery }: { lang: Lang; onQuery: (q: string) => void }) {
  const ways = [
    {
      icon: "magnifier", tone: "primary",
      title: pk({ tr: "Ürün adıyla", en: "By product", ru: "По товару", ar: "بالمنتج" }, lang),
      note: pk({ tr: "Ne alacağınızı yazın; satan dükkânlar kapı numarasıyla gelir.", en: "Type what you need; the shops that sell it arrive with door numbers.", ru: "Напишите товар — лавки придут с номерами дверей.", ar: "اكتب ما تحتاجه؛ تأتي المتاجر بأرقام الأبواب." }, lang),
      example: "silikon kılıf",
    },
    {
      icon: "abstract", tone: "info",
      title: pk({ tr: "Adresle", en: "By address", ru: "По адресу", ar: "بالعنوان" }, lang),
      note: pk({ tr: "Han adı ya da kapı numarası da arar.", en: "A han's name or a door number works too.", ru: "Название хана или номер двери тоже работают.", ar: "اسم الخان أو رقم الباب يعمل أيضًا." }, lang),
      example: "Yıldız Han",
    },
    {
      icon: "user", tone: "accent",
      title: pk({ tr: "Telefonla", en: "By phone", ru: "По телефону", ar: "بالهاتف" }, lang),
      note: pk({ tr: "Elinizde bir numara varsa kaydı bulur.", en: "If you have a number, it finds the record.", ru: "Если есть номер — найдём запись.", ar: "إذا كان لديك رقم، نجد السجل." }, lang),
      example: "905320000118",
    },
  ];

  return (
    <div style={sx("margin-top:14px;background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:26px")}>
      <div style={sx("font-size:19px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>{W(lang, "idleTitle")}</div>
      <div style={sx("font-size:14.5px;color:var(--text-muted);margin-top:6px;text-wrap:pretty")}>{W(lang, "idleBody")}</div>
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr));gap:10px;margin-top:18px")}>
        {ways.map((w) => (
          <button
            key={w.title}
            type="button"
            onClick={() => onQuery(w.example)}
            style={sx("display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:15px;border-radius:13px;border:1px solid var(--border-default);background:var(--surface-muted);font-family:inherit;text-align:start;cursor:pointer")}
          >
            <span style={sx(medStyle(w.tone, 36))}>
              <Icon name={w.icon} size={17} />
            </span>
            <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>{w.title}</span>
            <span style={sx("display:block;font-size:13px;color:var(--text-muted);line-height:1.45;text-wrap:pretty")}>{w.note}</span>
            <span style={sx("display:inline-block;margin-top:2px;padding:5px 10px;border-radius:7px;background:var(--color-primary-soft);color:var(--color-primary);font-size:12.5px;font-weight:600")}>{w.example}</span>
          </button>
        ))}
      </div>
      <div style={sx("font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-top:20px")}>
        {W(lang, "allCats")}
      </div>
      <div style={sx("display:flex;flex-wrap:wrap;gap:8px;margin-top:10px")}>
        {D.CATS.slice(0, 8).map((c) => (
          <button
            key={c.id as string}
            type="button"
            onClick={() => onQuery(tx(c, lang))}
            style={sx("background:var(--surface-card);border:1px solid var(--border-strong);border-radius:999px;padding:0 15px;min-height:38px;font-family:inherit;font-size:14px;font-weight:600;color:var(--text-heading);cursor:pointer")}
          >
            {tx(c, lang)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** No search ends in a dead end: if the match is weak, offer the request. */
function NoResults({
  lang, hasFilters, scanned, onClear, onRequest,
}: { lang: Lang; hasFilters: boolean; scanned: number; onClear: () => void; onRequest: () => void }) {
  return (
    <div style={sx("margin-top:14px;background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:26px")}>
      <div style={sx("font-size:20px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>{W(lang, "noResTitle")}</div>
      <div style={sx("font-size:15px;color:var(--text-body);margin-top:8px;max-width:64ch;text-wrap:pretty")}>{W(lang, "noResBody")}</div>
      {hasFilters && (
        <div style={sx("margin-top:16px")}>
          <Alert color="info" variant="light">
            {W(lang, "loosenBody", scanned)}
          </Alert>
          <div style={sx("margin-top:11px")}>
            <Button color="primary" size="md" onClick={onClear}>
              {F(lang, "clear")}
            </Button>
          </div>
        </div>
      )}
      <div style={sx("margin-top:16px")}>
        <Button color="accent" size="lg" onClick={onRequest}>
          {F(lang, "leaveReq") || pk({ tr: "Talep bırakın", en: "Leave a request", ru: "Оставить заявку", ar: "اترك طلبًا" }, lang)}
        </Button>
      </div>
    </div>
  );
}
