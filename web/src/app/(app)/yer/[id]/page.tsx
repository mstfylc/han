"use client";

// Yer — a han, a bazaar, an arcade, a street or a business centre.
//
// The place layer is the product's real asset: it never gets deleted, because
// it is a physical fact (K6). So this page leads with coverage — how many units
// there are, how many have a record, and what that leaves — rather than
// pretending the directory is complete.

import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";

import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import type { Lang } from "@/data/types";
import { Badge, Button, EmptyState, Icon } from "@/ds";
import { ImageSlot } from "@/components/ImageSlot";
import { F, W } from "@/lib/copy";
import { money, num, tx } from "@/lib/i18n";
import { href } from "@/lib/routes";
import { floorLabel, placePhoto, recordName } from "@/lib/shop";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;
const CARD = "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:18px 20px;box-shadow:0 3px 4px rgba(0,0,0,.03)";
const KICKER = "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)";

export default function PlacePage() {
  const { state } = useApp();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { lang } = state;
  const id = decodeURIComponent(String(params.id || ""));

  const place = SC.PLACES.find((p) => p.id === id) || null;
  const stats = useMemo(() => (place ? SC.placeStats(place.id) : null), [place]);
  const records = useMemo(() => (place ? SC.recordsOfPlace(place.id) : []), [place]);

  if (!place || !stats) {
    return (
      <div style={sx("max-width:1480px;margin:0 auto;padding:26px 24px 48px")}>
        <EmptyState
          icon="abstract"
          tone="neutral"
          title={pk({ tr: "Bu yer bulunamadı", en: "Place not found", ru: "Место не найдено", ar: "لم يُعثر على المكان" }, lang)}
          actions={<Button color="primary" onClick={() => router.push(href.map())}>{W(lang, "mapTitle")}</Button>}
        />
      </div>
    );
  }

  const semt = SC.SEMTLER.find((s) => s.id === place.semt);
  const access = SC.accessOf(place);
  const now = SC.openState(place, new Date());
  const kind = SC.PLACE_KINDS[place.kind];

  const byFloor = place.floors.map((f) => ({
    floor: f,
    rows: records.filter((r) => r.floor === f).slice(0, 40),
    total: records.filter((r) => r.floor === f).length,
  }));

  return (
    <div style={sx("max-width:1480px;margin:0 auto;padding:18px 24px 48px")}>
      <button
        type="button"
        onClick={() => router.push(href.map())}
        style={sx("display:inline-flex;align-items:center;gap:6px;background:none;border:none;padding:0;font-family:inherit;font-size:13px;font-weight:700;color:var(--color-primary);cursor:pointer")}
      >
        <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={15} />
        {W(lang, "mapTitle")}
      </button>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:22px;margin-top:14px;align-items:start")}>
        <div>
          <div style={sx("border-radius:16px;overflow:hidden;border:1px solid var(--border-strong);background:var(--surface-muted);height:260px")}>
            <ImageSlot src={placePhoto("han")} placeholder={place.name} decorative />
          </div>
        </div>

        <div>
          <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
            <Badge color="primary" variant="light">{tx(kind, lang)}</Badge>
            <span
              style={sx(
                "display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:6px;font-size:12px;font-weight:700;background:var(--color-" +
                  (now.open ? "success" : "danger") + "-soft);color:var(--color-" + (now.open ? "success" : "danger") + ")",
              )}
            >
              {now.open ? W(lang, "openNow") : W(lang, "closedNow")}
            </span>
          </div>

          <h1 style={sx("font-size:30px;font-weight:700;color:var(--text-heading);letter-spacing:-.025em;margin:12px 0 0;line-height:1.15")}>
            {place.name}
          </h1>
          <div style={sx("font-size:14px;color:var(--text-muted);margin-top:5px")}>
            {[semt ? tx(semt, lang) : "", place.floors.length + " " + pk({ tr: "kat", en: "floors", ru: "этажей", ar: "طوابق" }, lang)]
              .filter(Boolean)
              .join(" · ")}
          </div>

          {/* Coverage stated honestly: the denominator is every physical unit,
              not just the ones we happen to have. */}
          <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr));gap:1px;background:var(--border-default);border:1px solid var(--border-default);border-radius:11px;overflow:hidden;margin-top:18px")}>
            {[
              [num(place.units, lang), pk({ tr: "dükkân birimi", en: "shop units", ru: "торговых мест", ar: "وحدة" }, lang)],
              [num(stats.openRecords, lang), pk({ tr: "açık kayıt", en: "open records", ru: "открытых записей", ar: "سجل مفتوح" }, lang)],
              ["%" + stats.coverage, pk({ tr: "kapsama", en: "coverage", ru: "покрытие", ar: "التغطية" }, lang)],
            ].map(([v, l]) => (
              <div key={l} style={sx("background:var(--surface-card);padding:13px 15px")}>
                <div style={sx("font-size:20px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em")}>{v}</div>
                <div style={sx("font-size:12px;color:var(--text-muted);margin-top:2px")}>{l}</div>
              </div>
            ))}
          </div>

          <div style={sx("margin-top:16px")}>
            <div style={sx(KICKER)}>{pk({ tr: "Fiziksel erişim", en: "Getting there", ru: "Доступ", ar: "الوصول" }, lang)}</div>
            <div style={sx("display:flex;flex-wrap:wrap;gap:6px;margin-top:8px")}>
              {[
                access.lift
                  ? pk({ tr: "Asansör var", en: "Lift", ru: "Лифт", ar: "مصعد" }, lang)
                  : pk({ tr: "Asansör yok", en: "No lift", ru: "Без лифта", ar: "بلا مصعد" }, lang),
                access.handcart
                  ? pk({ tr: "El arabası girer", en: "Handcart access", ru: "Тележка проходит", ar: "دخول عربة" }, lang)
                  : pk({ tr: "El arabası girmez", en: "No handcart", ru: "Без тележки", ar: "لا عربة" }, lang),
                access.porter ? pk({ tr: "Hamal bulunur", en: "Porters available", ru: "Есть носильщики", ar: "حمّالون" }, lang) : "",
                access.parking ? pk({ tr: "Otopark yakın", en: "Parking nearby", ru: "Парковка рядом", ar: "موقف قريب" }, lang) : "",
              ]
                .filter(Boolean)
                .map((l) => (
                  <span key={l} style={sx("display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:6px;font-size:12.5px;font-weight:600;background:var(--surface-muted);color:var(--text-body)")}>
                    {l}
                  </span>
                ))}
            </div>
          </div>

          <div style={sx("display:flex;gap:8px;margin-top:18px;flex-wrap:wrap")}>
            <Button color="primary" size="md" onClick={() => router.push("/ara?yer=" + encodeURIComponent(place.id))}>
              {pk({ tr: "Buradaki dükkânları ara", en: "Search shops here", ru: "Искать лавки здесь", ar: "ابحث عن متاجر هنا" }, lang)}
            </Button>
            <Button variant="outline" color="primary" size="md" onClick={() => router.push(href.map())}>
              {W(lang, "seeOnMap")}
            </Button>
          </div>
        </div>
      </div>

      {/* what is traded here */}
      {stats.topCats.length > 0 && (
        <section style={sx("margin-top:26px")}>
          <div style={sx(KICKER)}>{pk({ tr: "Burada ne satılıyor", en: "What is traded here", ru: "Что здесь продают", ar: "ماذا يُباع هنا" }, lang)}</div>
          <div style={sx("display:flex;flex-wrap:wrap;gap:8px;margin-top:10px")}>
            {stats.topCats.map((c) => {
              const def = [...(D.CATS || []), ...SC.CATS_EXTRA].find((x) => x.id === c.cat);
              return (
                <button
                  key={c.cat}
                  type="button"
                  onClick={() => router.push("/ara?yer=" + encodeURIComponent(place.id) + "&q=" + encodeURIComponent(def ? tx(def, lang) : c.cat))}
                  style={sx("display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 13px;border-radius:999px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:13.5px;font-weight:600;color:var(--text-body);cursor:pointer")}
                >
                  {def ? tx(def, lang) : c.cat}
                  <span style={sx("font-weight:700;color:var(--color-primary)")}>{c.n}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* floor by floor */}
      <section style={sx("margin-top:26px")}>
        <h2 style={sx("font-size:19px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em")}>
          {pk({ tr: "Kat kat", en: "Floor by floor", ru: "По этажам", ar: "طابقًا بطابق" }, lang)}
        </h2>
        <div style={sx("display:flex;flex-direction:column;gap:14px;margin-top:14px")}>
          {byFloor.map((f) => (
            <div key={f.floor} style={sx(CARD)}>
              <div style={sx("display:flex;align-items:baseline;gap:10px")}>
                <div style={sx("font-size:15.5px;font-weight:700;color:var(--text-heading)")}>{floorLabel(f.floor, lang)}</div>
                <div style={sx("font-size:13px;color:var(--text-muted)")}>{F(lang, "shopCount", f.total)}</div>
              </div>

              {f.rows.length === 0 ? (
                // An empty floor is a fact worth stating: it is exactly where
                // the field team's next round should go.
                <p style={sx("font-size:13px;color:var(--text-muted);margin-top:8px;text-wrap:pretty")}>
                  {pk({
                    tr: "Bu katta henüz kaydı açılmış dükkân yok.",
                    en: "No shop on this floor has a record yet.",
                    ru: "На этом этаже пока нет записей.",
                    ar: "لا متجر بسجل في هذا الطابق بعد.",
                  }, lang)}
                </p>
              ) : (
                <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:8px;margin-top:10px")}>
                  {f.rows.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => router.push(href.store(r.curated || r.id))}
                      style={sx("display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:10px;border:1px solid var(--border-default);background:var(--surface-card);font-family:inherit;text-align:start;cursor:pointer")}
                    >
                      <span style={sx("flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:24px;padding:0 7px;border-radius:6px;font-size:11.5px;font-weight:700;background:var(--color-primary-soft);color:var(--color-primary-accent)")}>
                        {r.door}
                      </span>
                      <span style={sx("flex:1;min-width:0")}>
                        <span style={sx("display:block;font-size:13.5px;font-weight:600;color:var(--text-heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                          {recordName(r, lang)}
                        </span>
                        <span style={sx("display:block;font-size:11.5px;color:var(--text-muted);margin-top:1px")}>
                          {r.band ? money(r.band[0]) + "–" + money(r.band[1]) : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
