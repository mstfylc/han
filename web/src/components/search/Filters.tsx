"use client";

// Ara — the filter column.
//
// On the web the filters stay open: there is room, so the bottom sheet the phone
// needs is just friction here. Every facet carries a live count, because a
// filter that leads to zero results should say so before it is clicked.

import * as SC from "@/data/han-scale";
import type { Facets, Lang, SearchResult } from "@/data/types";
import { Button, Icon, Input } from "@/ds";
import { F, W } from "@/lib/copy";
import { num, tx } from "@/lib/i18n";
import { sx } from "@/lib/sx";
import type { SavedSearch } from "@/state/types";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

/** A facet row: label, live count, selected state. */
const rowStyleOf = (on: boolean) =>
  "display:flex;align-items:center;gap:9px;width:100%;background:" +
  (on ? "var(--color-primary-soft)" : "none") +
  ";border:none;padding:8px 9px;border-radius:8px;font-family:inherit;font-size:13.5px;font-weight:" +
  (on ? "700" : "500") +
  ";color:" + (on ? "var(--color-primary-accent)" : "var(--text-body)") +
  ";text-align:start;cursor:pointer";

const countStyleOf = (on: boolean) =>
  "flex:none;font-size:12px;font-weight:600;color:" + (on ? "var(--color-primary)" : "var(--text-muted)");

const SECTION_LABEL =
  "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted);margin-bottom:9px";

interface FacetDef {
  id: string;
  label: string;
  count: number | null;
  tone?: string;
}

export interface FiltersProps {
  lang: Lang;
  q: string;
  onQ: (q: string) => void;
  onSubmitQ: () => void;
  res: SearchResult;
  sort: string;
  onSort: (s: string) => void;
  qty: string;
  onQty: (v: string) => void;
  semtFilter: string;
  placeFilter: string;
  sectorFilter: string;
  statusFilter: string;
  flagFilters: string[];
  onFacet: (patch: Record<string, string | string[] | null>) => void;
  hasFilters: boolean;
  onClear: () => void;
  onBrowseCats: () => void;
  qHist: string[];
  onPickHistory: (q: string) => void;
  onClearHistory: () => void;
  savedSearches: SavedSearch[];
  onSaveSearch: () => void;
  onOpenSaved: (s: SavedSearch) => void;
  onRemoveSaved: (s: SavedSearch) => void;
  searchPlaceholder: string;
}

export function Filters(p: FiltersProps) {
  const { lang, res } = p;
  const facets: Facets = res.facets;

  const semtDefs: FacetDef[] = ([
    { id: "all", label: pk({ tr: "Tüm semtler", en: "All areas", ru: "Все районы", ar: "كل المناطق" }, lang), count: res.scanned },
  ] as FacetDef[]).concat(
    SC.SEMTLER.map((s) => ({ id: s.id, label: tx(s, lang), count: facets.semt[s.id] || 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count),
  );

  const placeDefs: FacetDef[] = ([
    { id: "all", label: pk({ tr: "Tüm yerler", en: "All places", ru: "Все места", ar: "كل الأماكن" }, lang), count: null },
  ] as FacetDef[]).concat(
    SC.PLACES.map((pl) => ({ id: pl.id, label: pl.name, count: facets.place[pl.id] || 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
  );

  const sectorDefs: FacetDef[] = ([{ id: "all", label: F(lang, "all"), count: null }] as FacetDef[]).concat(
    Object.keys(SC.SECTORS)
      .map((k) => ({ id: k, label: tx(SC.SECTORS[k], lang), count: facets.sector[k] || 0 }))
      .filter((x) => x.count > 0),
  );

  // Record state is shown as the ACTION it permits, not as an internal status
  // name: "you can ask the price" tells a buyer something, "aktif" does not.
  const statusDefs: FacetDef[] = [
    { id: "all", label: pk({ tr: "Hepsi", en: "All", ru: "Все", ar: "الكل" }, lang), count: null, tone: "secondary" },
    { id: "aktif", label: pk({ tr: "Fiyat sorulabilir", en: "Price can be asked", ru: "Можно узнать цену", ar: "يمكن السؤال عن السعر" }, lang), count: facets.status.aktif || 0, tone: "accent" },
    { id: "onayli", label: pk({ tr: "İletişim var", en: "Contact available", ru: "Есть контакты", ar: "بيانات التواصل" }, lang), count: facets.status.onayli || 0, tone: "primary" },
    { id: "beyan", label: pk({ tr: "Doğrulanmadı", en: "Not verified", ru: "Не проверено", ar: "غير موثّق" }, lang), count: facets.status.beyan || 0, tone: "warning" },
  ].filter((x) => x.id !== "beyan" || (facets.status.beyan || 0) > 0);

  const sortRows: [string, string][] = [
    ["uygunluk", pk({ tr: "En uygun", en: "Best match", ru: "Наиболее подходящие", ar: "الأنسب" }, lang)],
    ["yanit", pk({ tr: "En hızlı yanıt", en: "Fastest reply", ru: "Быстрый ответ", ar: "أسرع رد" }, lang)],
    ["mesafe", pk({ tr: "En yakın", en: "Nearest", ru: "Ближайшие", ar: "الأقرب" }, lang)],
    ["fiyat", pk({ tr: "Uygun fiyat", en: "Lowest price", ru: "Дешевле", ar: "الأرخص" }, lang)],
    ["puan", pk({ tr: "Yüksek puan", en: "Top rated", ru: "Высокий рейтинг", ar: "الأعلى تقييمًا" }, lang)],
    ["taze", pk({ tr: "Yeni güncellenen", en: "Recently updated", ru: "Недавно обновлённые", ar: "المحدَّث حديثًا" }, lang)],
  ];

  const flagRows: [string, string, number][] = [
    ["export", F(lang, "fExport"), facets.flag.shipsAbroad],
    ["producer", F(lang, "fProducer"), facets.flag.producer],
    ["taxfree", F(lang, "fTaxFree"), facets.flag.taxFree],
  ];

  const facetList = (defs: FacetDef[], sel: string, apply: (id: string) => Record<string, string | null>) => (
    <div style={sx("display:flex;flex-direction:column;gap:2px")}>
      {defs.map((d) => {
        const on = sel === d.id;
        return (
          <button key={d.id} type="button" onClick={() => p.onFacet(apply(d.id))} style={sx(rowStyleOf(on))} aria-pressed={on}>
            {d.tone && (
              <span
                style={sx(
                  "flex:none;width:9px;height:9px;border-radius:999px;background:" +
                    (d.tone === "secondary" ? "var(--color-grey-400)" : "var(--color-" + d.tone + ")"),
                )}
              />
            )}
            <span style={sx("flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{d.label}</span>
            <span style={sx(countStyleOf(on))}>{d.count == null ? "" : num(d.count, lang)}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); p.onSubmitQ(); }}>
        <Input
          size="md"
          iconLead="magnifier"
          placeholder={p.searchPlaceholder}
          value={p.q}
          onChange={(e) => p.onQ(e.target.value)}
          aria-label={W(lang, "searchPh")}
        />
      </form>

      <button
        type="button"
        onClick={p.onBrowseCats}
        style={sx("display:flex;align-items:center;gap:9px;width:100%;margin-top:9px;padding:11px 12px;border-radius:10px;border:1px dashed var(--border-strong);background:none;font-family:inherit;text-align:start;cursor:pointer")}
      >
        <span style={sx("flex:none;display:flex;color:var(--color-primary)")}>
          <Icon name="category" size={16} />
        </span>
        <span style={sx("flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--text-body)")}>
          {pk({ tr: "Kategorilere göz at", en: "Browse categories", ru: "Смотреть категории", ar: "تصفّح الفئات" }, lang)}
        </span>
      </button>

      {/* W6 · recent searches. Retyping a query in a 30,000-record directory is
          pure loss. */}
      {p.qHist.length > 0 && (
        <div style={sx("margin-top:16px")}>
          <div style={sx("display:flex;align-items:baseline;justify-content:space-between;gap:8px")}>
            <span style={sx("font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)")}>
              {pk({ tr: "Son aramalar", en: "Recent searches", ru: "Недавние запросы", ar: "أحدث البحوث" }, lang)}
            </span>
            <button type="button" onClick={p.onClearHistory} style={sx("background:none;border:none;padding:0;font-family:inherit;font-size:12px;font-weight:600;color:var(--text-muted);cursor:pointer")}>
              {pk({ tr: "Temizle", en: "Clear", ru: "Очистить", ar: "مسح" }, lang)}
            </button>
          </div>
          <div style={sx("display:flex;flex-wrap:wrap;gap:6px;margin-top:8px")}>
            {p.qHist.map((h) => (
              <button key={h} type="button" onClick={() => p.onPickHistory(h)} style={sx("height:30px;padding:0 11px;border-radius:999px;border:1px solid var(--border-default);background:var(--surface-muted);font-family:inherit;font-size:12.5px;font-weight:600;color:var(--text-body);cursor:pointer")}>
                {h}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* W6 · a saved search keeps the result count from the moment it was
          saved. That difference is the concrete evidence coverage grew. */}
      <div style={sx("margin-top:16px;padding:13px 14px;border-radius:11px;background:var(--surface-muted);border:1px solid var(--border-default)")}>
        <div style={sx("font-size:12.5px;font-weight:700;color:var(--text-heading)")}>
          {pk({ tr: "Bu aramayı kaydet", en: "Save this search", ru: "Сохранить поиск", ar: "احفظ هذا البحث" }, lang)}
        </div>
        <div style={sx("font-size:12px;color:var(--text-muted);margin-top:3px;text-wrap:pretty")}>
          {pk({
            tr: "Kapsama her hafta büyüyor. Kaydettiğiniz arama, yeni kayıt açıldığında kaç tane arttığını gösterir.",
            en: "Coverage grows weekly. A saved search tells you how many new records opened since you saved it.",
            ru: "Покрытие растёт каждую неделю. Сохранённый поиск покажет, сколько записей добавилось.",
            ar: "التغطية تنمو أسبوعيًا. البحث المحفوظ يخبرك بعدد السجلات الجديدة.",
          }, lang)}
        </div>
        <div style={sx("margin-top:10px")}>
          <Button variant="outline" color="primary" size="sm" fullWidth onClick={p.onSaveSearch}>
            {pk({ tr: "Aramayı kaydet", en: "Save search", ru: "Сохранить", ar: "احفظ" }, lang)}
          </Button>
        </div>
        {p.savedSearches.length > 0 && (
          <div style={sx("display:flex;flex-direction:column;gap:6px;margin-top:10px")}>
            {p.savedSearches.map((s) => (
              <div key={s.at} style={sx("display:flex;align-items:center;gap:8px")}>
                <button type="button" onClick={() => p.onOpenSaved(s)} style={sx("flex:1;min-width:0;display:block;text-align:start;background:var(--surface-card);border:1px solid var(--border-default);border-radius:9px;padding:8px 10px;font-family:inherit;cursor:pointer")}>
                  <span style={sx("display:block;font-size:13px;font-weight:600;color:var(--text-heading);white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                    {s.q}
                    {s.filters && s.filters.semt && s.filters.semt !== "all"
                      ? " · " + tx(SC.SEMTLER.find((x) => x.id === s.filters!.semt), lang)
                      : ""}
                  </span>
                  <span style={sx("display:block;font-size:11.5px;color:var(--color-success);margin-top:2px")}>
                    {pk({
                      tr: "kaydedildiğinde " + s.count + " sonuç",
                      en: s.count + " results when saved",
                      ru: s.count + " результатов при сохранении",
                      ar: s.count + " نتيجة عند الحفظ",
                    }, lang)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => p.onRemoveSaved(s)}
                  aria-label={pk({ tr: "Kaydı sil", en: "Remove", ru: "Удалить", ar: "حذف" }, lang)}
                  style={sx("flex:none;width:28px;height:28px;border-radius:7px;border:1px solid var(--border-default);background:none;color:var(--text-muted);cursor:pointer")}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={sx("margin-top:20px")}>
        <div style={sx(SECTION_LABEL)}>{F(lang, "sort")}</div>
        <div style={sx("display:flex;flex-direction:column;gap:4px")} role="radiogroup" aria-label={F(lang, "sort")}>
          {sortRows.map(([id, label]) => {
            const on = p.sort === id;
            return (
              <button key={id} type="button" role="radio" aria-checked={on} onClick={() => p.onSort(id)} style={sx(rowStyleOf(on))}>
                <span
                  style={sx(
                    "flex:none;width:14px;height:14px;border-radius:999px;box-sizing:border-box;border:" +
                      (on ? "4px solid var(--color-primary)" : "1.5px solid var(--border-strong)") +
                      ";background:" + (on ? "#fff" : "transparent"),
                  )}
                />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quantity is not a filter, it is a ranking signal: shops whose minimum
          fits rise, shops whose minimum is too high sink. */}
      <div style={sx("margin-top:18px")}>
        <div style={sx(SECTION_LABEL)}>
          {pk({ tr: "Alacağınız adet", en: "Quantity you need", ru: "Нужное количество", ar: "الكمية المطلوبة" }, lang)}
        </div>
        <Input
          size="sm"
          inputMode="numeric"
          placeholder={pk({ tr: "örn. 200", en: "e.g. 200", ru: "напр. 200", ar: "مثال ٢٠٠" }, lang)}
          value={p.qty}
          onChange={(e) => p.onQty(e.target.value)}
          aria-label={pk({ tr: "Alacağınız adet", en: "Quantity you need", ru: "Нужное количество", ar: "الكمية المطلوبة" }, lang)}
        />
        <div style={sx("font-size:12px;color:var(--text-muted);margin-top:6px;text-wrap:pretty")}>
          {pk({
            tr: "Minimumu bu adedin altında olan dükkânlar üste çıkar.",
            en: "Shops whose minimum fits this quantity rise to the top.",
            ru: "Лавки с подходящим минимумом поднимаются выше.",
            ar: "تتقدم المتاجر التي يناسب حدها الأدنى هذه الكمية.",
          }, lang)}
        </div>
      </div>

      <div style={sx("margin-top:20px")}>
        <div style={sx(SECTION_LABEL)}>{pk({ tr: "Sektör", en: "Sector", ru: "Сектор", ar: "القطاع" }, lang)}</div>
        {facetList(sectorDefs, p.sectorFilter, (id) => ({ sectorFilter: id }))}
      </div>

      <div style={sx("margin-top:20px")}>
        <div style={sx(SECTION_LABEL)}>{pk({ tr: "Kayıt durumu", en: "Record state", ru: "Состояние записи", ar: "حالة السجل" }, lang)}</div>
        {facetList(statusDefs, p.statusFilter, (id) => ({ statusFilter: id }))}
      </div>

      <div style={sx("margin-top:20px")}>
        <div style={sx(SECTION_LABEL)}>{F(lang, "area")}</div>
        {facetList(semtDefs, p.semtFilter, (id) => ({ semtFilter: id, placeFilter: "all" }))}
      </div>

      <div style={sx("margin-top:20px")}>
        <div style={sx(SECTION_LABEL)}>
          {pk({ tr: "Yer · han · çarşı", en: "Place · han · bazaar", ru: "Место · хан · базар", ar: "المكان · خان · سوق" }, lang)}
        </div>
        {facetList(placeDefs, p.placeFilter, (id) => ({ placeFilter: id }))}
      </div>

      <div style={sx("margin-top:20px")}>
        <div style={sx(SECTION_LABEL)}>{F(lang, "flags")}</div>
        <div style={sx("display:flex;flex-direction:column;gap:2px")}>
          {flagRows.map(([id, label, count]) => {
            const on = p.flagFilters.includes(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => p.onFacet({ flagFilters: on ? p.flagFilters.filter((y) => y !== id) : p.flagFilters.concat(id) })}
                style={sx(rowStyleOf(on))}
              >
                <span
                  style={sx(
                    "flex:none;width:16px;height:16px;border-radius:4px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;color:#fff;border:1.5px solid " +
                      (on ? "var(--color-primary);background:var(--color-primary)" : "var(--border-strong);background:var(--surface-card)"),
                  )}
                >
                  {on && <Icon name="check-circle" size={12} />}
                </span>
                <span style={sx("flex:1;min-width:0")}>{label}</span>
                <span style={sx(countStyleOf(on))}>{num(count || 0, lang)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {p.hasFilters && (
        <div style={sx("margin-top:18px")}>
          <Button variant="light" color="secondary" size="sm" fullWidth onClick={p.onClear}>
            {F(lang, "clear")}
          </Button>
        </div>
      )}
    </>
  );
}
