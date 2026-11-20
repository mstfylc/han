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
import { Alert, Button, Drawer, Icon } from "@/ds";
import { DetailPanel } from "@/components/search/DetailPanel";
import { Filters } from "@/components/search/Filters";
import { ResultRow, ResultSkeleton } from "@/components/search/ResultList";
import { F, W } from "@/lib/copy";
import { convert, money, num, tx } from "@/lib/i18n";
import { CARD_BOX, STICKY_TOP, areaOn, breaks, searchGrid } from "@/lib/layout";
import { PARAM, getList, getNum, getPanel, getStr, href, panelParam, withParams } from "@/lib/routes";
import { compressForAiLens } from "@/lib/media-compress";
import { floorLabel, medStyle } from "@/lib/shop";
import { sx } from "@/lib/sx";
import { trackEvent } from "@/lib/telemetry";
import { useApp } from "@/state/AppState";
import type { Panel, SavedSearch } from "@/state/types";

interface VisualSearchExtracted {
  query: string;
  category: string;
  labelTr: string;
  tags: string[];
  confidence: number;
}

interface VisualSearchMatch {
  recordId: string;
  curated: string | null;
  name: string;
  placeId: string;
  placeName: string;
  floor: number;
  door: string;
  cat: string;
  band: [number, number] | null;
  status: string;
}

interface VisualSearchResult {
  provider: "gemini" | "fallback";
  extracted: VisualSearchExtracted;
  totalMatches: number;
  matches: VisualSearchMatch[];
}

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
  const visualParam = getStr(sp, "visual") === "1";
  const voiceParam = getStr(sp, "voice") === "1";

  // The text box is local so typing stays smooth; the URL updates on submit.
  const [draft, setDraft] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [visualPanelOpen, setVisualPanelOpen] = useState(visualParam);
  const [syncedVisualParam, setSyncedVisualParam] = useState(visualParam);
  const [voicePanelOpen, setVoicePanelOpen] = useState(voiceParam);
  const [syncedVoiceParam, setSyncedVoiceParam] = useState(voiceParam);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceResult, setVoiceResult] = useState<{
    provider: string;
    intent: { transcript: string; query: string; qty: number | null; replyTr: string };
    matches: VisualSearchMatch[];
  } | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const [visualLoading, setVisualLoading] = useState(false);
  const [visualError, setVisualError] = useState<string | null>(null);
  const [visualPreview, setVisualPreview] = useState<string | null>(null);
  const [visualResult, setVisualResult] = useState<VisualSearchResult | null>(null);
  const visualFileRef = useRef<HTMLInputElement | null>(null);

  if (q !== syncedQ) {
    setSyncedQ(q);
    setDraft(q);
  }
  if (visualParam !== syncedVisualParam) {
    setSyncedVisualParam(visualParam);
    if (visualParam) setVisualPanelOpen(true);
  }
  if (voiceParam !== syncedVoiceParam) {
    setSyncedVoiceParam(voiceParam);
    if (voiceParam) setVoicePanelOpen(true);
  }

  useEffect(() => {
    return () => {
      if (visualPreview) URL.revokeObjectURL(visualPreview);
    };
  }, [visualPreview]);

  const handleVisualFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (visualPreview) URL.revokeObjectURL(visualPreview);
    const previewUrl = URL.createObjectURL(file);
    setVisualPreview(previewUrl);
    setVisualPanelOpen(true);
    setVisualLoading(true);
    setVisualError(null);

    try {
      const compactFile = await compressForAiLens(file);
      const fd = new FormData();
      fd.append("file", compactFile);
      fd.append("lang", lang);
      fd.append("mode", mode);
      if (draft.trim()) fd.append("hint", draft.trim());

      const r = await fetch("/api/ai/visual-search", { method: "POST", body: fd });
      const data = (await r.json()) as {
        ok?: boolean;
        error?: string;
        provider?: "gemini" | "fallback";
        extracted?: VisualSearchExtracted;
        totalMatches?: number;
        matches?: VisualSearchMatch[];
      };

      if (!r.ok || !data.ok || !data.extracted) {
        setVisualError(data.error || pk({ tr: "Fotoğraf analiz edilemedi. Lütfen tekrar deneyin.", en: "Could not analyze image. Please try again." }, lang));
        return;
      }

      setVisualResult({
        provider: data.provider || "fallback",
        extracted: data.extracted,
        totalMatches: data.totalMatches ?? (data.matches?.length || 0),
        matches: data.matches || [],
      });
      trackEvent("ai_visual_search", {
        meta: { category: data.extracted.category, matches: data.matches?.length || 0, provider: data.provider || "fallback" },
      });
      toast(
        pk(
          {
            tr: `📸 ${data.extracted.labelTr} tespit edildi (${data.matches?.length || 0} eşleşme)`,
            en: `📸 Detected ${data.extracted.labelTr} (${data.matches?.length || 0} matches)`,
          },
          lang,
        ),
      );
    } catch {
      setVisualError(pk({ tr: "Bağlantı hatası oluştu. Lütfen tekrar deneyin.", en: "Connection error. Please try again." }, lang));
    } finally {
      setVisualLoading(false);
    }
  };

  const runVoiceSearch = async (opts: { audioBlob?: Blob; text?: string }) => {
    setVoicePanelOpen(true);
    setVoiceLoading(true);
    setVoiceError(null);
    try {
      let r: Response;
      if (opts.audioBlob) {
        const fd = new FormData();
        fd.append("audio", new File([opts.audioBlob], "voice.webm", { type: opts.audioBlob.type || "audio/webm" }));
        fd.append("lang", lang);
        fd.append("mode", mode);
        if (opts.text?.trim()) fd.append("transcript", opts.text.trim());
        r = await fetch("/api/ai/voice-search", { method: "POST", body: fd });
      } else {
        r = await fetch("/api/ai/voice-search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transcript: opts.text || "", lang, mode }),
        });
      }
      const d = await r.json();
      if (!r.ok || !d.ok || !d.intent) {
        setVoiceError(d?.error || pk({ tr: "Sesli arama tamamlanamadı.", en: "Voice search failed." }, lang));
        return;
      }
      setVoiceResult({ provider: d.provider || "fallback", intent: d.intent, matches: d.matches || [] });
      setDraft(d.intent.query || "");
      trackEvent("ai_voice_search", { meta: { provider: d.provider || "fallback", matches: d.matches?.length || 0 } });
      toast(d.intent.replyTr || pk({ tr: "Sesli arama tamamlandı", en: "Voice search ready" }, lang));
    } catch {
      setVoiceError(pk({ tr: "Bağlantı hatası oluştu.", en: "Connection error." }, lang));
    } finally {
      setVoiceLoading(false);
    }
  };

  const toggleVoiceRecording = async () => {
    if (voiceRecording && voiceRecorderRef.current) {
      voiceRecorderRef.current.stop();
      setVoiceRecording(false);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoicePanelOpen(true);
      setVoiceError(pk({ tr: "Bu tarayıcıda mikrofon kaydı desteklenmiyor — aşağıya doğal cümleyle yazabilirsiniz.", en: "Microphone recording unavailable — type naturally below." }, lang));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      voiceChunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) voiceChunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(voiceChunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 0) void runVoiceSearch({ audioBlob: blob, text: voiceText });
      };
      voiceRecorderRef.current = rec;
      rec.start();
      setVoicePanelOpen(true);
      setVoiceRecording(true);
      setVoiceError(null);
    } catch {
      setVoicePanelOpen(true);
      setVoiceError(pk({ tr: "Mikrofon izni alınamadı — aşağıya doğal cümleyle yazabilirsiniz.", en: "Microphone permission denied — type naturally below." }, lang));
    }
  };

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
  // Hoisted out of the dependency list: a dep must be a plain reference, not a
  // call, or React cannot tell when it actually changed.
  const flagKey = flagFilters.join(",");

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
  }, [q, semtFilter, placeFilter, sectorFilter, statusFilter, flagKey, qty, mode, sort, lang, state.offersRev]);

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
  const activeFilterCount =
    (semtFilter !== "all" ? 1 : 0) +
    (placeFilter !== "all" ? 1 : 0) +
    (sectorFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    flagFilters.length;

  const filtersNode = (
    <Filters
      lang={lang}
      q={draft}
      onQ={setDraft}
      onSubmitQ={() => {
        setFilterDrawerOpen(false);
        nav({ [PARAM.q]: draft || null, [PARAM.page]: null });
      }}
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
      onBrowseCats={() => {
        setFilterDrawerOpen(false);
        router.push(href.category());
      }}
      qHist={state.qHist || []}
      onPickHistory={(h) => {
        setDraft(h);
        setFilterDrawerOpen(false);
        nav({ [PARAM.q]: h, [PARAM.page]: null });
      }}
      onClearHistory={() => save({ qHist: [] })}
      savedSearches={state.savedSearches || []}
      onSaveSearch={saveSearch}
      onOpenSaved={(s) => {
        setFilterDrawerOpen(false);
        nav({ [PARAM.q]: s.q, [PARAM.semt]: (s.filters?.semt as string) === "all" ? null : (s.filters?.semt as string), [PARAM.page]: null });
      }}
      onRemoveSaved={(s) => save({ savedSearches: (state.savedSearches || []).filter((y) => y.at !== s.at) })}
      searchPlaceholder={(D.L[lang] || D.L.tr).searchPlaceholder as string}
    />
  );

  const detailNode = (
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
  );

  return (
    <div style={sx(searchGrid(b))}>
      {/* ── filters (desktop/tablet sidebar; on single-column inside Drawer) ── */}
      {!b.single && (
        <aside style={sx(areaOn("f") + CARD_BOX + (b.three ? STICKY_TOP : ""))} data-han-search aria-label={F(lang, "flags")}>
          {filtersNode}
        </aside>
      )}

      {/* ── results ─────────────────────────────────────────────────────── */}
      <main style={sx(areaOn("l") + ";min-width:0;max-width:100%")} id="han-sonuclar">
        {/* Hidden camera/gallery file picker for Visual Search */}
        <input
          ref={visualFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={handleVisualFile}
          style={{ display: "none" }}
          aria-label={pk({ tr: "Fotoğraf yükle veya çek", en: "Upload or take a photo" }, lang)}
        />

        {/* Compact Mobile Search & Filter Bar (< 1040px) */}
        {b.single && (
          <div style={sx("background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:12px;margin-bottom:12px;box-shadow:0 3px 8px rgba(0,0,0,.04);min-width:0;max-width:100%;box-sizing:border-box")}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                nav({ [PARAM.q]: draft || null, [PARAM.page]: null });
              }}
              style={sx("display:flex;gap:8px;flex-wrap:wrap;min-width:0;max-width:100%")}
            >
              <input
                type="search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={(D.L[lang] || D.L.tr).searchPlaceholder as string}
                className="mtinput mtinput--md"
                style={sx("flex:1 1 160px;min-width:0;height:42px")}
              />
              <Button type="submit" color="accent" variant="solid" size="md" iconStart="magnifier">
                {W(lang, "secSearch")}
              </Button>
              <Button
                type="button"
                color="accent"
                variant={voicePanelOpen || voiceRecording ? "solid" : "outline"}
                size="md"
                disabled={voiceLoading}
                onClick={() => (voicePanelOpen ? void toggleVoiceRecording() : setVoicePanelOpen(true))}
              >
                {pk({ tr: "🎤 Sesli", en: "🎤 Voice" }, lang)}
              </Button>
              <Button
                type="button"
                color="primary"
                variant="outline"
                size="md"
                disabled={visualLoading}
                onClick={() => visualFileRef.current?.click()}
              >
                {pk({ tr: "📷 Fotoğrafla Bul", en: "📷 Visual Search" }, lang)}
              </Button>
            </form>
            <div style={sx("display:flex;align-items:center;gap:8px;margin-top:9px;overflow-x:auto;min-width:0;max-width:100%")}>
              <button
                type="button"
                onClick={() => setFilterDrawerOpen(true)}
                style={sx(
                  "flex:none;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border-radius:9px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:1px solid " +
                    (activeFilterCount > 0
                      ? "var(--color-primary);background:var(--color-primary-soft);color:var(--color-primary)"
                      : "var(--border-strong);background:var(--surface-muted);color:var(--text-heading)"),
                )}
              >
                <Icon name="sliders" size={15} />
                <span>{lang === "tr" ? "Filtre & Sırala" : "Filter & Sort"}</span>
                {activeFilterCount > 0 && (
                  <span style={sx("display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;font-size:11px;font-weight:800;background:var(--color-primary);color:#fff")}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.push(href.category())}
                style={sx(
                  "flex:none;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border-radius:9px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:1px solid var(--border-strong);background:var(--surface-card);color:var(--text-body)",
                )}
              >
                <Icon name="category" size={15} />
                <span>{W(lang, "allCats")}</span>
              </button>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => nav({ [PARAM.semt]: null, yer: null, [PARAM.trade]: null, durum: null, [PARAM.flags]: null, [PARAM.page]: null })}
                  style={sx(
                    "flex:none;height:36px;padding:0 10px;border-radius:9px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;border:1px solid var(--color-danger);background:var(--color-danger-soft);color:var(--color-danger)",
                  )}
                >
                  {F(lang, "clear")}
                </button>
              )}
            </div>
          </div>
        )}
        <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;min-width:0;max-width:100%")}>
          <div style={sx("min-width:0")}>
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
          {!b.single && (
            <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
              <Button
                type="button"
                color="accent"
                variant={voicePanelOpen || voiceRecording ? "solid" : "outline"}
                size="sm"
                disabled={voiceLoading}
                onClick={() => (voicePanelOpen ? void toggleVoiceRecording() : setVoicePanelOpen(true))}
              >
                {voiceRecording
                  ? pk({ tr: "⏹ Kaydı Durdur", en: "⏹ Stop Recording" }, lang)
                  : pk({ tr: "🎤 Sesle Sor", en: "🎤 Voice Search" }, lang)}
              </Button>
              <Button
                type="button"
                color="primary"
                variant={visualPanelOpen ? "solid" : "outline"}
                size="sm"
                disabled={visualLoading}
                onClick={() => visualFileRef.current?.click()}
              >
                {visualLoading
                  ? pk({ tr: "⏳ Analiz ediliyor...", en: "⏳ Analyzing..." }, lang)
                  : pk({ tr: "📷 Fotoğrafla Bul", en: "📷 Visual Search" }, lang)}
              </Button>
            </div>
          )}
        </div>

        {/* Voice Search Push-to-Talk & Natural Query Panel (?voice=1 or active) */}
        {(voicePanelOpen || voiceRecording || voiceLoading || voiceResult) && (
          <section
            data-voice-search="1"
            style={sx(
              "margin-top:12px;padding:14px 16px;border-radius:14px;border:2px solid var(--color-accent);background:var(--surface-card);min-width:0;max-width:100%;box-sizing:border-box",
            )}
          >
            <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap")}>
              <div>
                <div style={sx("font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--color-accent)")}>
                  {pk({ tr: "🎤 Bas-Konuş · Gerçek Kapı Bul", en: "🎤 Push-to-Talk · Find Verified Doors" }, lang)}
                </div>
                <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                  {pk({ tr: "Örn: \"Tahtakale'de 200 adet 316L çelik kolye toptan arıyorum\"", en: "e.g. \"200 pcs 316L steel necklaces wholesale in Tahtakale\"" }, lang)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVoicePanelOpen(false);
                  setVoiceResult(null);
                  setVoiceError(null);
                  if (voiceParam) nav({ voice: null }, true);
                }}
                style={sx("height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface-muted);color:var(--text-muted);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer")}
              >
                ✕
              </button>
            </div>

            <div style={sx("display:flex;gap:8px;flex-wrap:wrap;margin-top:10px")}>
              <Button
                type="button"
                size="sm"
                color={voiceRecording ? "danger" : "accent"}
                disabled={voiceLoading}
                onClick={() => void toggleVoiceRecording()}
              >
                {voiceRecording
                  ? pk({ tr: "⏹ Durdur ve Ara", en: "⏹ Stop & Search" }, lang)
                  : pk({ tr: "🎙️ Mikrofonu Başlat", en: "🎙️ Start Mic" }, lang)}
              </Button>
              <input
                type="text"
                value={voiceText}
                onChange={(e) => setVoiceText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && voiceText.trim()) void runVoiceSearch({ text: voiceText });
                }}
                placeholder={pk({ tr: "Veya konuşur gibi yazın…", en: "Or type naturally…" }, lang)}
                className="mtinput mtinput--sm"
                style={sx("flex:1 1 200px;min-width:0")}
              />
              <Button
                type="button"
                size="sm"
                color="primary"
                disabled={voiceLoading || !voiceText.trim()}
                onClick={() => void runVoiceSearch({ text: voiceText })}
              >
                {voiceLoading ? "⏳..." : pk({ tr: "Kapıları Bul", en: "Find Doors" }, lang)}
              </Button>
            </div>

            {voiceError && (
              <div style={sx("margin-top:10px")}>
                <Alert color="warning" variant="light">{voiceError}</Alert>
              </div>
            )}

            {voiceResult && (
              <div style={sx("margin-top:12px;display:flex;flex-direction:column;gap:8px")}>
                <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap")}>
                  <span style={sx("font-size:13px;font-weight:700;color:var(--text-heading)")}>
                    ✓ {voiceResult.intent.replyTr}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    color="primary"
                    onClick={() => nav({ [PARAM.q]: voiceResult.intent.query, adet: voiceResult.intent.qty ? String(voiceResult.intent.qty) : null, [PARAM.page]: null })}
                  >
                    {pk({ tr: "Listeye Uygula ➔", en: "Apply to List ➔" }, lang)}
                  </Button>
                </div>
                {voiceResult.matches.length > 0 && (
                  <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:8px")}>
                    {voiceResult.matches.slice(0, 6).map((m) => (
                      <button
                        key={m.recordId}
                        type="button"
                        onClick={() => router.push(href.store(m.curated || m.recordId))}
                        style={sx("display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:10px 12px;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface-muted);font-family:inherit;text-align:start;cursor:pointer")}
                      >
                        <span style={sx("font-size:13px;font-weight:800;color:var(--text-heading)")}>{m.name}</span>
                        <span style={sx("font-size:11.5px;font-weight:700;color:var(--color-primary)")}>
                          {m.placeName} · {floorLabel(m.floor, lang, m.placeId)} · No: {m.door}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Visual Search Highlighted Drop / Upload Panel (?visual=1 or active) */}
        {(visualPanelOpen || visualLoading || visualError || visualResult) && (
          <section
            data-visual-search="1"
            style={sx(
              "margin-top:12px;padding:14px 16px;border-radius:14px;border:2px solid var(--color-primary);background:linear-gradient(180deg,var(--color-primary-soft) 0%,var(--surface-card) 100%);min-width:0;max-width:100%;box-sizing:border-box",
            )}
          >
            <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;min-width:0")}>
              <div style={sx("min-width:0;flex:1 1 200px")}>
                <div style={sx("font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--color-primary)")}>
                  {visualResult
                    ? pk({ tr: "📸 Görsel Analiz Sonucu", en: "📸 Visual Search Result" }, lang)
                    : pk({ tr: "📷 Fotoğrafla Ürün Bul (Görsel Arama)", en: "📷 Find Product by Photo (Visual Search)" }, lang)}
                </div>
                {!visualResult && (
                  <p style={sx("font-size:13px;color:var(--text-body);margin:4px 0 0;line-height:1.45")}>
                    {pk(
                      {
                        tr: "Aradığınız ürünün fotoğrafını çekin veya galeriden seçin; kategori ve etiketler çıkarılsın, gerçek han/kat/kapı eşleşmeleri anında listelensin.",
                        en: "Take or upload a photo of the product; we extract its category and list verified han, floor, and door matches.",
                      },
                      lang,
                    )}
                  </p>
                )}
              </div>
              <div style={sx("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
                <Button
                  type="button"
                  size="sm"
                  color="primary"
                  variant="solid"
                  disabled={visualLoading}
                  onClick={() => visualFileRef.current?.click()}
                >
                  {visualLoading
                    ? pk({ tr: "⏳ Analiz Ediliyor...", en: "⏳ Analyzing..." }, lang)
                    : visualResult
                      ? pk({ tr: "📷 Yeni Fotoğraf", en: "📷 New Photo" }, lang)
                      : pk({ tr: "📷 Fotoğraf Seç / Çek", en: "📷 Choose / Take Photo" }, lang)}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setVisualPanelOpen(false);
                    setVisualResult(null);
                    setVisualError(null);
                    if (visualParam) nav({ visual: null }, true);
                  }}
                  aria-label={pk({ tr: "Görsel aramayı kapat", en: "Close visual search" }, lang)}
                  style={sx("height:32px;padding:0 10px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface-card);color:var(--text-muted);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer")}
                >
                  ✕
                </button>
              </div>
            </div>

            {visualError && (
              <div style={sx("margin-top:10px")}>
                <Alert color="danger" variant="light">{visualError}</Alert>
              </div>
            )}

            {visualResult && (
              <div style={sx("margin-top:12px;display:flex;flex-direction:column;gap:12px;min-width:0;max-width:100%")}>
                <div style={sx("display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;padding:12px;border-radius:12px;background:var(--surface-card);border:1px solid var(--border-default);min-width:0")}>
                  {visualPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={visualPreview}
                      alt={visualResult.extracted.labelTr}
                      style={sx("width:64px;height:64px;border-radius:10px;object-fit:cover;flex:none;border:1px solid var(--border-strong)")}
                    />
                  )}
                  <div style={sx("flex:1 1 180px;min-width:0")}>
                    <div style={sx("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
                      <span style={sx("font-size:15.5px;font-weight:800;color:var(--text-heading)")}>
                        {visualResult.extracted.labelTr}
                      </span>
                      <span style={sx("font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;background:var(--color-success-soft);color:var(--color-success)")}>
                        %{Math.round((visualResult.extracted.confidence || 0.85) * 100)} {pk({ tr: "uyum", en: "match" }, lang)}
                      </span>
                    </div>
                    {visualResult.extracted.tags.length > 0 && (
                      <div style={sx("display:flex;flex-wrap:wrap;gap:6px;margin-top:7px")}>
                        {visualResult.extracted.tags.map((tag) => (
                          <span
                            key={tag}
                            style={sx("font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--surface-muted);border:1px solid var(--border-default);color:var(--text-body)")}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={sx("margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
                      <Button
                        type="button"
                        size="sm"
                        color="primary"
                        variant="solid"
                        iconStart="magnifier"
                        onClick={() => {
                          setDraft(visualResult.extracted.query);
                          nav({ [PARAM.q]: visualResult.extracted.query, [PARAM.page]: null, visual: null });
                        }}
                      >
                        {pk(
                          {
                            tr: `Aramaya Uygula: "${visualResult.extracted.query}"`,
                            en: `Apply Query: "${visualResult.extracted.query}"`,
                          },
                          lang,
                        )}
                      </Button>
                      <span style={sx("font-size:12px;color:var(--text-muted);font-weight:600")}>
                        {pk(
                          {
                            tr: `${visualResult.totalMatches} doğrulanmış katalog eşleşmesi`,
                            en: `${visualResult.totalMatches} verified catalog matches`,
                          },
                          lang,
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {visualResult.matches.length > 0 && (
                  <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:8px;min-width:0;max-width:100%")}>
                    {visualResult.matches.slice(0, 6).map((m) => {
                      const targetId = m.curated || m.recordId;
                      return (
                        <div
                          key={m.recordId}
                          style={sx("padding:10px 12px;border-radius:11px;background:var(--surface-card);border:1px solid var(--border-strong);display:flex;flex-direction:column;gap:6px;min-width:0;box-sizing:border-box")}
                        >
                          <div style={sx("font-size:13.5px;font-weight:800;color:var(--text-heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                            {m.name}
                          </div>
                          <div style={sx("font-size:12px;color:var(--text-muted);font-weight:600")}>
                            🏛️ {m.placeName} · {floorLabel(m.floor, lang, m.placeId)} · Kapı No: {m.door}
                          </div>
                          <div style={sx("display:flex;align-items:center;gap:6px;margin-top:2px;flex-wrap:wrap")}>
                            <Button
                              type="button"
                              size="sm"
                              color="primary"
                              variant="outline"
                              onClick={() => router.push(href.directions(targetId))}
                            >
                              {pk({ tr: "🧭 Tarif Al", en: "🧭 Directions" }, lang)}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              color="primary"
                              variant="light"
                              onClick={() => router.push(href.store(targetId))}
                            >
                              {pk({ tr: "🏪 Dükkâna Git", en: "🏪 Open Shop" }, lang)}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

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

      {/* ── detail (desktop/tablet sidebar; on single-column inside Drawer) ── */}
      {!b.single ? (
        <aside style={sx(areaOn("d") + (b.three ? STICKY_TOP : ""))} aria-label={W(lang, "pickTitle")}>
          {detailNode}
        </aside>
      ) : (
        <>
          <Drawer
            open={filterDrawerOpen}
            onClose={() => setFilterDrawerOpen(false)}
            title={lang === "tr" ? "Filtreler ve Sıralama" : "Filters & Sorting"}
            subtitle={lang === "tr" ? `${num(res.total, lang)} dükkân gösteriliyor` : `${num(res.total, lang)} shops matching`}
            size="md"
            footer={
              <Button color="accent" variant="solid" size="lg" fullWidth onClick={() => setFilterDrawerOpen(false)}>
                {lang === "tr" ? `${num(res.total, lang)} Sonucu Göster` : `Show ${num(res.total, lang)} Results`}
              </Button>
            }
          >
            {filtersNode}
          </Drawer>

          <Drawer
            open={!!panel}
            onClose={() => nav({ [PARAM.panel]: null, [PARAM.floor]: null })}
            title={W(lang, "pickTitle")}
            size="md"
          >
            {detailNode}
          </Drawer>
        </>
      )}
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
