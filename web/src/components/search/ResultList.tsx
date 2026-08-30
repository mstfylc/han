"use client";

// Ara — the result list.
//
// Two rules shape this list:
//
//   · Say what a record is NOT. An empty shell dressed up like a filled record
//     turns search into noise, so a record missing two of {price, product list,
//     photos} says so on its own row.
//   · Show why it ranks where it does. `reasonsOf` produces the reason line, and
//     it is printed — an order nobody can account for reads as arbitrary.

import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import type { Lang, SearchHit, ShopRecord } from "@/data/types";
import { ImageSlot } from "@/components/ImageSlot";
import { F, W } from "@/lib/copy";
import { money, tonePair, tx } from "@/lib/i18n";
import { storePhoto } from "@/lib/shop";
import { sx } from "@/lib/sx";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

const catName = (id: string, lang: Lang) =>
  tx([...(D.CATS || []), ...SC.CATS_EXTRA].find((c) => c.id === id) || { tr: id }, lang);

const placeName = (id: string) => (SC.PLACES.find((p) => p.id === id) || { name: "" }).name;

const floorLbl = (n: number, lang: Lang) => (n > 0 ? F(lang, "hanFloor", n) : F(lang, "hanGround"));

/** Turn ranking reasons into a readable line. */
function reasonText(hit: SearchHit, lang: Lang): string {
  return hit.reasons
    .map((r) => {
      const v = r.v;
      const table: Record<string, string> = {
        aktif: pk({ tr: "kataloğu güncel", en: "catalogue current", ru: "каталог актуален", ar: "كتالوج محدَّث" }, lang),
        hizli: pk({ tr: "yanıt " + v + " dk", en: v + " min reply", ru: "ответ " + v + " мин", ar: "رد " + v + " د" }, lang),
        yakin: pk({ tr: v + " m", en: v + " m", ru: v + " м", ar: v + " م" }, lang),
        puan: "★ " + v,
        taze: pk({ tr: v + " gün önce güncellendi", en: "updated " + v + "d ago", ru: "обновлено " + v + " дн. назад", ar: "حُدّث قبل " + v + " يوم" }, lang),
        foto: pk({ tr: v + " fotoğraf", en: v + " photos", ru: v + " фото", ar: v + " صور" }, lang),
        moq: pk({ tr: "minimum " + v + " adet uygun", en: "MOQ " + v + " fits", ru: "минимум " + v + " подходит", ar: "الحد الأدنى " + v + " مناسب" }, lang),
        beyan: pk({ tr: "doğrulanmadı", en: "not verified", ru: "не проверено", ar: "غير موثّق" }, lang),
        hanonay: pk({ tr: "han yönetimi onaylı", en: "approved by the han's registry", ru: "подтверждён ханом", ar: "معتمد من إدارة الخان" }, lang),
        uretici: pk({ tr: "üretici", en: "manufacturer", ru: "производитель", ar: "مُصنّع" }, lang),
        dil: pk({ tr: "sizin dilinizde", en: "speaks your language", ru: "на вашем языке", ar: "بلغتك" }, lang),
      };
      return table[r.k];
    })
    .filter(Boolean)
    .join(" · ");
}

/** What this record is missing. Two or more gaps and we say it plainly. */
function flawOf(rec: ShopRecord, lang: Lang): string {
  const miss = [
    !rec.band ? pk({ tr: "fiyat", en: "price", ru: "цена", ar: "السعر" }, lang) : null,
    !(rec.groups || []).length ? pk({ tr: "ürün listesi", en: "product list", ru: "список товаров", ar: "قائمة المنتجات" }, lang) : null,
    !(rec.photos || 0) ? pk({ tr: "fotoğraf", en: "photos", ru: "фото", ar: "الصور" }, lang) : null,
  ].filter(Boolean) as string[];
  if (miss.length < 2) return "";
  return pk({
    tr: "Bu kayıtta yalnız adres doğrulandı — " + miss.join(", ") + " girilmemiş.",
    en: "Only the address is confirmed here — no " + miss.join(", ") + " yet.",
    ru: "Подтверждён только адрес — нет: " + miss.join(", ") + ".",
    ar: "العنوان فقط مؤكد — لا يوجد " + miss.join("، ") + " بعد.",
  }, lang);
}

export interface ResultRowProps {
  hit: SearchHit;
  lang: Lang;
  picked: boolean;
  onPick: () => void;
  onOpen: () => void;
}

export function ResultRow({ hit, lang, picked, onPick, onOpen }: ResultRowProps) {
  const rec = hit.rec;
  const st = SE.statusOf(rec.status);
  const active = rec.status === "aktif";
  const band = rec.band;
  const flaw = flawOf(rec, lang);
  const name = rec.name || pk({ tr: "İsimsiz kayıt", en: "Unnamed record", ru: "Без названия", ar: "سجل بلا اسم" }, lang);

  const badges = [
    { label: tx(SC.SECTORS[rec.sector] || {}, lang), tone: (SC.SECTORS[rec.sector] || {}).tone || "primary" },
    rec.isProducer ? { label: F(lang, "fProducer"), tone: "success" } : null,
    rec.shipsAbroad ? { label: F(lang, "fExport"), tone: "warning" } : null,
    rec.taxFree ? { label: F(lang, "fTaxFree"), tone: "accent" } : null,
  ].filter(Boolean) as { label: string; tone: string }[];

  const where = [placeName(rec.place), floorLbl(rec.floor, lang), W(lang, "doorNo") + " " + rec.door, catName(rec.cat, lang)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div style={sx("display:flex;align-items:stretch;gap:9px")}>
      {/* C3 · comparison is no longer trapped inside the buying list: tick it
          straight off the result. */}
      <button
        type="button"
        onClick={onPick}
        aria-pressed={picked}
        aria-label={pk({ tr: "Karşılaştırmaya ekle", en: "Add to comparison", ru: "Добавить к сравнению", ar: "أضف للمقارنة" }, lang)}
        style={sx(
          "flex:none;align-self:center;width:26px;height:26px;border-radius:7px;font-family:inherit;font-size:14px;font-weight:700;line-height:1;cursor:pointer;border:1px solid " +
            (picked
              ? "var(--color-primary);background:var(--color-primary);color:#fff"
              : "var(--border-strong);background:var(--surface-card);color:transparent"),
        )}
      >
        {picked ? "✓" : ""}
      </button>

      {/* `flex:1;min-width:0`, not `width:100%`: 100% here means the whole row,
          and the row already spends 26px + 9px on the compare tick beside it.
          On a wide screen the extra 35px vanished into the page margin; at
          390px it became a sideways scroll. */}
      <button
        type="button"
        onClick={onOpen}
        style={sx("display:flex;gap:15px;flex:1;min-width:0;padding:14px;border-radius:14px;background:var(--surface-card);box-shadow:0 3px 4px rgba(0,0,0,.03);font-family:inherit;text-align:start;cursor:pointer;border:1px solid var(--border-strong)")}
      >
        {/* Downloading 40 remote images per page buys nothing at scale: only a
            record with its own photo loads one, the rest get a letter tile. */}
        {rec.curated ? (
          <span style={sx("flex:none;width:74px;height:74px;border-radius:11px;overflow:hidden;background:var(--surface-muted)")}>
            <ImageSlot src={storePhoto(D.STORES.find((x) => x.id === rec.curated) || null)} placeholder={name} decorative />
          </span>
        ) : (
          <span
            style={sx(
              "flex:none;width:74px;height:74px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;letter-spacing:-.02em;background:var(--color-" +
                (rec.status === "aktif" ? "accent" : rec.status === "beyan" ? "warning" : "primary") +
                "-soft);color:var(--color-" +
                (rec.status === "aktif" ? "accent-active" : rec.status === "beyan" ? "warning-accent" : "primary-accent") +
                ")",
            )}
            aria-hidden="true"
          >
            {String(rec.name || catName(rec.cat, lang) || "?").trim().charAt(0).toLocaleUpperCase(lang === "tr" ? "tr-TR" : lang)}
          </span>
        )}

        <span style={sx("flex:1;min-width:0")}>
          <span style={sx("display:flex;align-items:center;gap:7px;flex-wrap:wrap")}>
            <span style={sx("font-size:17px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
              {name}
            </span>
            {/* The state is shown as the action it permits, not its internal name. */}
            <span
              style={sx(
                "flex:none;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;font-size:11.5px;font-weight:700;background:" +
                  tonePair(st.tone).bg + ";color:" + tonePair(st.tone).fg,
              )}
            >
              {st["act" + lang.charAt(0).toUpperCase() + lang.slice(1)] || st.actTr}
            </span>
          </span>

          <span style={sx("display:block;font-size:13.5px;color:var(--text-muted);margin-top:4px")}>{where}</span>

          <span style={sx("display:flex;flex-wrap:wrap;gap:6px;margin-top:9px")}>
            {badges.map((b) => (
              <span
                key={b.label}
                style={sx(
                  "display:inline-flex;align-items:center;height:23px;padding:0 8px;border-radius:6px;font-size:11.5px;font-weight:700;background:var(--color-" +
                    b.tone + "-soft);color:var(--color-" + b.tone +
                    (b.tone === "accent" || b.tone === "warning" ? "-accent" : "") + ")",
                )}
              >
                {b.label}
              </span>
            ))}
          </span>

          <span style={sx("display:block;font-size:12.5px;color:var(--color-primary);margin-top:8px;text-wrap:pretty")}>
            {reasonText(hit, lang)}
          </span>

          {flaw && (
            <span style={sx("display:block;font-size:12.5px;color:var(--color-warning-accent);margin-top:5px")}>{flaw}</span>
          )}
        </span>

        <span style={sx("flex:none;width:150px;text-align:end;align-self:center")}>
          <span style={sx("display:block;font-size:11.5px;color:var(--text-muted)")}>
            {active && band
              ? pk({ tr: "fiyat bandı", en: "price band", ru: "диапазон цен", ar: "نطاق السعر" }, lang)
              : active
                ? W(lang, "from")
                : pk({ tr: "fiyat girilmemiş", en: "no price yet", ru: "цена не указана", ar: "لا سعر بعد" }, lang)}
          </span>
          <span style={sx("display:block;font-size:18px;font-weight:700;color:var(--color-primary);letter-spacing:-.01em")}>
            {active && band ? money(band[0]) + "–" + money(band[1]) : active ? "—" : ""}
          </span>
          <span style={sx("display:block;font-size:12px;color:var(--text-muted);margin-top:5px")}>
            {rec.moq > 1 ? W(lang, "minOrder") + " " + rec.moq : ""}
          </span>
        </span>
      </button>
    </div>
  );
}

/** Skeleton rows, so a slow first paint looks like the list that is coming
 *  rather than an empty page. */
export function ResultSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:10px;margin-top:14px")} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={sx("display:flex;gap:15px;padding:14px;border-radius:14px;background:var(--surface-card);border:1px solid var(--border-strong)")}>
          <span style={sx("flex:none;width:74px;height:74px;border-radius:11px;background:var(--surface-muted)")} />
          <span style={sx("flex:1;display:flex;flex-direction:column;gap:8px;padding-top:4px")}>
            <span style={sx("display:block;height:16px;width:42%;border-radius:5px;background:var(--surface-muted)")} />
            <span style={sx("display:block;height:12px;width:64%;border-radius:5px;background:var(--surface-muted)")} />
            <span style={sx("display:block;height:12px;width:30%;border-radius:5px;background:var(--surface-muted)")} />
          </span>
        </div>
      ))}
    </div>
  );
}
