"use client";

// Ara — the right-hand column.
//
// One source of truth: `panel = {kind, id}` in the URL. Four modes hang off it —
// a shop summary, step-by-step directions, a han's floor plan, and a street
// page. Keeping them on one selector is deliberate; two parallel selectors drift
// apart and you end up rendering a shop that is no longer the selected one.

import { useRouter } from "next/navigation";

import * as D from "@/data/han-data";
import * as L from "@/data/han-logic";
import * as SC from "@/data/han-scale";
import type { CuratedStore, Lang, Mode, Currency, ShopRecord } from "@/data/types";
import { Badge, Button, Icon } from "@/ds";
import { ImageSlot } from "@/components/ImageSlot";
import { SantralFloorMap } from "@/components/SantralFloorMap";
import { F, W } from "@/lib/copy";
import { convert, money, tx, loc } from "@/lib/i18n";
import { href } from "@/lib/routes";
import {
  floorLabel,
  openPill,
  placePhoto,
  recordBadges,
  recordName,
  recordPhoto,
  storeBadges,
  storePhoto,
  whereOf,
  whereOfRecord,
} from "@/lib/shop";
import { sx } from "@/lib/sx";
import type { Panel } from "@/state/types";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

const PANEL_CARD =
  "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:20px;box-shadow:0 3px 4px rgba(0,0,0,.03)";
const KICKER = "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)";

export interface DetailPanelProps {
  panel: Panel | null;
  lang: Lang;
  mode: Mode;
  currency: Currency;
  hanFloor: number;
  saved: string[];
  onClose: () => void;
  onOpenPanel: (kind: Panel["kind"], id: string) => void;
  onFloor: (n: number) => void;
  onToggleSave: (id: string) => void;
  onAddToPlan: (s: CuratedStore) => void;
}

function CloseButton({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={W(lang, "close")}
      style={sx("flex:none;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:none;border-radius:8px;background:var(--surface-muted);color:var(--text-muted);cursor:pointer")}
    >
      <Icon name="cross-circle" size={17} />
    </button>
  );
}

export function DetailPanel(p: DetailPanelProps) {
  const router = useRouter();
  const { panel, lang } = p;

  if (!panel) {
    return (
      <div style={sx("background:var(--surface-card);border:1px dashed var(--border-strong);border-radius:14px;padding:38px 24px;text-align:center")}>
        <div style={sx("display:inline-flex;color:var(--text-placeholder)")}>
          <Icon name="magnifier" size={30} />
        </div>
        <div style={sx("font-size:16.5px;font-weight:700;color:var(--text-heading);margin-top:12px")}>{W(lang, "pickTitle")}</div>
        <div style={sx("font-size:13.5px;color:var(--text-muted);margin-top:5px;text-wrap:pretty")}>{W(lang, "pickBody")}</div>
      </div>
    );
  }

  if (panel.kind === "store") return <StoreSummary {...p} panel={panel} router={router} />;
  if (panel.kind === "route") return <RoutePanel {...p} panel={panel} router={router} />;
  if (panel.kind === "street") return <StreetPanel {...p} panel={panel} />;
  return <HanPanel {...p} panel={panel} router={router} />;
}

// ── shop summary (supports both CuratedStore and Scale ShopRecord) ────────

function StoreSummary(
  p: DetailPanelProps & { panel: Panel; router: ReturnType<typeof useRouter> },
) {
  const { lang, mode, currency, panel, router } = p;
  const s = D.STORES.find((x) => x.id === panel.id) as CuratedStore | undefined;
  const rec = SC.RECORDS.find((x) => x.id === panel.id || x.curated === panel.id);

  if (!s && !rec) return null;

  const cv = (n: number | null) => convert(n, lang, currency);

  // If scale record without curated entry, render unified Scale Store Summary
  if (!s && rec) {
    const place = SC.PLACES.find((x) => x.id === rec.place);
    const isSaved = p.saved.includes(rec.id);
    const name = recordName(rec, lang);
    const flLbl = floorLabel(rec.floor, lang, place || rec.place);

    return (
      <div style={sx("background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;overflow:hidden;box-shadow:0 3px 4px rgba(0,0,0,.03)")}>
        <div style={sx("height:150px;background:var(--surface-muted)")}>
          <ImageSlot src={recordPhoto(rec)} placeholder={name} decorative />
        </div>
        <div style={sx("padding:18px;max-height:calc(100vh - 280px);overflow-y:auto")}>
          <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:10px")}>
            <div style={sx("min-width:0")}>
              <div style={sx("display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px")}>
                <Badge color="primary" variant="solid">
                  {place ? place.name : rec.place} · {flLbl}
                </Badge>
                {rec.door && (
                  <Badge color="accent" variant="solid">
                    Kapı No: {rec.door}
                  </Badge>
                )}
              </div>
              <div style={sx("font-size:19px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em;text-wrap:pretty")}>{name}</div>
              <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px")}>{whereOfRecord(rec, lang)}</div>
            </div>
            <CloseButton lang={lang} onClose={p.onClose} />
          </div>

          <div style={sx("display:flex;flex-wrap:wrap;gap:6px;margin-top:12px")}>
            {recordBadges(rec, lang).map((b, i) => (
              <span key={i} style={sx(b.style)}>{b.label}</span>
            ))}
          </div>

          {rec.groups && rec.groups.length > 0 && (
            <div style={sx("margin-top:16px")}>
              <div style={sx(KICKER + ";margin-bottom:8px")}>{W(lang, "products")}</div>
              <div style={sx("display:flex;flex-direction:column;gap:1px;background:var(--border-default);border:1px solid var(--border-default);border-radius:11px;overflow:hidden")}>
                {rec.groups.map((gr, idx) => (
                  <div key={idx} style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--surface-card);padding:10px 12px")}>
                    <div>
                      <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>{SC.groupLabel(gr.name, lang)}</div>
                      <div style={sx("font-size:11.5px;color:var(--text-muted)")}>{gr.lines} çeşit</div>
                    </div>
                    {gr.lo > 0 && (
                      <div style={sx("text-align:end")}>
                        <div style={sx("font-size:14px;font-weight:700;color:var(--color-primary)")}>
                          {money(gr.lo)} – {money(gr.hi)}
                        </div>
                        <div style={sx("font-size:11px;color:var(--text-muted)")}>{cv(gr.lo)}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:18px")}>
            <div style={sx("display:flex;gap:8px")}>
              <Button variant="solid" color="primary" size="md" style={{ flex: 1 }} onClick={() => p.onOpenPanel("route", rec.id)}>
                {F(lang, "routeTitle") || W(lang, "directions")}
              </Button>
              {place && (
                <Button variant="outline" color="primary" size="md" style={{ flex: 1 }} onClick={() => p.onOpenPanel("han", place.id)}>
                  {place.name} Kat Planı
                </Button>
              )}
            </div>
            <div style={sx("display:flex;gap:8px")}>
              <Button variant="outline" color="dark" size="md" style={{ flex: 1 }} onClick={() => p.onToggleSave(rec.id)}>
                {isSaved ? W(lang, "unsave") : W(lang, "save")}
              </Button>
              <Button variant="outline" color="primary" size="md" style={{ flex: 1 }} onClick={() => router.push(href.store(rec.id))}>
                {pk({ tr: "Dükkân sayfasını aç", en: "Open shop page", ru: "Открыть магазин", ar: "افتح المتجر" }, lang)}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!s) return null;

  const op = openPill(s, lang);
  const dow = new Date().getDay();
  const day = L.hoursToday(D, s, dow);
  const han = D.HANS.find((x) => x.id === s.han);
  const street = (s.location || {}).street as string | undefined;
  const isSaved = p.saved.includes(s.id);
  const certs = ((s.production || {}).certs || []) as string[];

  const facts = [
    { label: F(lang, "hoursLbl"), value: day ? day[0] + " – " + day[1] : "—" },
    { label: W(lang, "minOrder"), value: String(((s.trade || {}).minOrder || {}).qty || 1) },
    {
      label: pk({ tr: "Diller", en: "Languages", ru: "Языки", ar: "اللغات" }, lang),
      value: (((s.commerce || {}).languages || ["tr"]) as string[]).map((x) => x.toUpperCase()).join(" · "),
    },
    {
      label: pk({ tr: "Teslim", en: "Delivery", ru: "Доставка", ar: "التسليم" }, lang),
      value: (s.exportInfo || {}).shipsAbroad
        ? pk({ tr: "Yurt dışına gönderir", en: "Ships abroad", ru: "Отправка за рубеж", ar: "شحن للخارج" }, lang)
        : pk({ tr: "Dükkândan teslim", en: "Collect in store", ru: "Самовывоз", ar: "استلام من المتجر" }, lang),
    },
  ];

  return (
    <div style={sx("background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;overflow:hidden;box-shadow:0 3px 4px rgba(0,0,0,.03)")}>
      <div style={sx("height:170px;background:var(--surface-muted)")}>
        <ImageSlot src={storePhoto(s)} placeholder={s.name} decorative />
      </div>
      <div style={sx("padding:18px;max-height:calc(100vh - 300px);overflow-y:auto")}>
        <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:10px")}>
          <div style={sx("min-width:0")}>
            <div style={sx("font-size:20px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em;text-wrap:pretty")}>{s.name}</div>
            <div style={sx("font-size:13.5px;color:var(--text-muted);margin-top:3px")}>
              {whereOf(s, lang)} · No: {String(s.no)}
            </div>
          </div>
          <div style={sx("display:flex;align-items:center;gap:6px")}>
            <span style={sx(op.style)}>{op.label}</span>
            <CloseButton lang={lang} onClose={p.onClose} />
          </div>
        </div>

        <div style={sx("display:flex;flex-wrap:wrap;gap:6px;margin-top:12px")}>
          {storeBadges(s, lang).map((b) => (
            <span key={b.label} style={sx(b.style)}>{b.label}</span>
          ))}
        </div>

        <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border-default);border:1px solid var(--border-default);border-radius:11px;overflow:hidden;margin-top:16px")}>
          {facts.map((f) => (
            <div key={f.label} style={sx("background:var(--surface-card);padding:10px 12px")}>
              <div style={sx("font-size:11.5px;color:var(--text-muted)")}>{f.label}</div>
              <div style={sx("font-size:14.5px;font-weight:700;color:var(--text-heading);margin-top:2px;text-wrap:pretty")}>{f.value}</div>
            </div>
          ))}
        </div>

        <div style={sx("margin-top:18px")}>
          <div style={sx(KICKER + ";margin-bottom:9px")}>{W(lang, "products")}</div>
          <div style={sx("display:flex;flex-direction:column;gap:1px;background:var(--border-default);border:1px solid var(--border-default);border-radius:11px;overflow:hidden")}>
            {(s.products || []).slice(0, 6).map((pr, i) => {
              const value = mode === "toptan" ? (pr.wholesale ?? pr.retail) : (pr.retail ?? pr.wholesale);
              return (
                <div key={i} style={sx("display:flex;align-items:center;gap:10px;background:var(--surface-card);padding:11px 12px")}>
                  <div style={sx("flex:1;min-width:0")}>
                    <div style={sx("font-size:14.5px;font-weight:600;color:var(--text-heading);text-wrap:pretty")}>{tx(pr, lang)}</div>
                    <div style={sx("font-size:12px;color:var(--text-muted);margin-top:2px")}>{pr.note || pr.unit || ""}</div>
                  </div>
                  <div style={sx("flex:none;text-align:end")}>
                    <div style={sx("font-size:15px;font-weight:700;color:var(--color-primary)")}>{money(value ?? null)}</div>
                    <div style={sx("font-size:11.5px;color:var(--text-muted)")}>{cv(value ?? null)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {certs.length > 0 && (
          <div style={sx("margin-top:16px")}>
            <div style={sx(KICKER + ";margin-bottom:8px")}>{W(lang, "certs")}</div>
            <div style={sx("display:flex;flex-wrap:wrap;gap:6px")}>
              {certs.map((c) => {
                const def = D.CERTS.find((x) => x.id === c);
                return (
                  <span key={c} style={sx("display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:6px;font-size:12px;font-weight:600;background:var(--color-success-soft);color:var(--color-success)")}>
                    {def ? tx(def, lang) : c}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:20px")}>
          <Button color="accent" size="lg" fullWidth onClick={() => p.onAddToPlan(s)}>
            {W(lang, "addPlan")}
          </Button>
          <div style={sx("display:flex;gap:8px")}>
            <Button variant="outline" color="primary" size="md" style={{ flex: 1 }} onClick={() => p.onOpenPanel("route", s.id)}>
              {F(lang, "routeTitle") || W(lang, "directions")}
            </Button>
            {street && (
              <Button variant="outline" color="primary" size="md" style={{ flex: 1 }} onClick={() => p.onOpenPanel("street", street)}>
                {W(lang, "streetPage")}
              </Button>
            )}
          </div>
          <div style={sx("display:flex;gap:8px")}>
            {han && (
              <Button variant="outline" color="dark" size="md" style={{ flex: 1 }} onClick={() => p.onOpenPanel("han", han.id as string)}>
                {han.name as string} Kat Planı
              </Button>
            )}
            <Button variant="outline" color="dark" size="md" style={{ flex: 1 }} onClick={() => p.onToggleSave(s.id)}>
              {isSaved ? W(lang, "unsave") : W(lang, "save")}
            </Button>
          </div>
          <Button variant="outline" color="primary" size="md" fullWidth onClick={() => router.push(href.store(s.id))}>
            {pk({ tr: "Dükkân sayfasını aç", en: "Open the shop page", ru: "Открыть страницу магазина", ar: "افتح صفحة المتجر" }, lang)}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── 2-layer hybrid directions (Outdoor Google Maps + Indoor Floor Plan) ──

function RoutePanel(
  p: DetailPanelProps & { panel: Panel; router: ReturnType<typeof useRouter> },
) {
  const { lang, panel, router } = p;
  const curated = D.STORES.find((x) => x.id === panel.id) as CuratedStore | undefined;
  const rec = SC.RECORDS.find((x) => x.id === panel.id || x.curated === panel.id);
  if (!curated && !rec) return null;

  const placeId = curated?.han || rec?.place || "santral";
  const place = SC.PLACES.find((x) => x.id === placeId);
  const hanObj = D.HANS.find((x) => x.id === placeId);
  const targetFloor = curated ? (curated.floor ?? 0) : (rec?.floor ?? 0);
  const targetDoor = curated ? String(curated.no) : (rec?.door || "");
  const shopTitle = curated ? curated.name : recordName(rec as ShopRecord, lang);
  const flLbl = floorLabel(targetFloor, lang, place || placeId);

  const lat = place?.lat ?? (hanObj?.lat as number) ?? 41.01518;
  const lng = place?.lng ?? (hanObj?.lng as number) ?? 28.96845;
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;

  const steps = curated
    ? L.routeSteps(D, curated, lang)
    : [
        {
          title:
            lang === "tr"
              ? `1. Dış Mekan: ${place?.name || "Han"} Ana Girişine Yürüyün`
              : `1. Outdoor: Walk to ${place?.name || "Han"} Main Gate`,
          note:
            place?.address ||
            (hanObj?.addressTr as string) ||
            "Tahtakale Cd. No: 7, Fatih / İstanbul (Kapıya kadar telefon haritası çalışır)",
          mins: 4,
        },
        {
          title:
            lang === "tr"
              ? `2. Han Girişi & Kat Çıkışı: ${flLbl}`
              : `2. Enter Han & Go to ${flLbl}`,
          note:
            lang === "tr"
              ? "Han içinde GPS çekmez; girişteki kat panosundan merdiven veya asansörle kata çıkın."
              : "GPS stops inside; take the staircase or lift to the target floor.",
          mins: 2,
        },
        {
          title:
            lang === "tr"
              ? `3. Han İçi Koridor & Kapı No: ${targetDoor}`
              : `3. Indoor Corridor & Door No: ${targetDoor}`,
          note: `${shopTitle} (${rec?.corridor || "Orta"} Koridor · Kapı No: ${targetDoor})`,
          mins: 1,
        },
      ];

  const total = steps.reduce((n, s) => n + (Number(s.mins) || 0), 0);

  return (
    <div style={sx(PANEL_CARD + ";display:flex;flex-direction:column;gap:16px")}>
      <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:10px")}>
        <div style={sx("min-width:0")}>
          <div style={sx(KICKER)}>{F(lang, "routeTitle") || W(lang, "directions")} · 2 KATMANLI HİBRİT ROTA</div>
          <div style={sx("font-size:19px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em;margin-top:3px;text-wrap:pretty")}>{shopTitle}</div>
          <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px")}>
            {(place?.name || (hanObj?.name as string) || "")} · {flLbl} · Kapı No: {targetDoor} ·{" "}
            {pk({ tr: "≈ " + total + " dk yürüyüş", en: "≈ " + total + " min walk", ru: "≈ " + total + " мин пешком", ar: "≈ " + total + " دقيقة سيرًا" }, lang)}
          </div>
        </div>
        <CloseButton lang={lang} onClose={p.onClose} />
      </div>

      {/* Layer 1: Outdoor Google Maps Deep-Link */}
      <div
        style={sx(
          "padding:12px 14px;border-radius:12px;background:var(--surface-muted);border:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap",
        )}
      >
        <div>
          <div style={sx("font-size:12px;font-weight:800;color:var(--color-primary)")}>
            🌍 {lang === "tr" ? "1. Katman · Sokaktan Han Kapısına (GPS Açık)" : "Layer 1 · Street to Han Gate (GPS Active)"}
          </div>
          <div style={sx("font-size:12.5px;color:var(--text-body);margin-top:2px")}>
            {place?.address || (hanObj?.addressTr as string) || "Tahtakale Cd. No: 7, Fatih / İstanbul"}
          </div>
        </div>
        <a href={gmapsUrl} target="_blank" rel="noreferrer" style={sx("text-decoration:none")}>
          <Button size="sm" color="primary" variant="solid" iconStart="map">
            {lang === "tr" ? "Google Maps ile Kapıya Yürü" : "Walk to Gate via Google Maps"}
          </Button>
        </a>
      </div>

      {/* Step-by-step Landmark Chain */}
      <ol style={sx("margin:0;padding:0;list-style:none")}>
        {steps.map((s, i) => (
          <li key={i} style={sx("display:flex;gap:12px")}>
            <div style={sx("flex:none;display:flex;flex-direction:column;align-items:center;width:28px")}>
              <span style={sx("flex:none;width:26px;height:26px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;background:var(--color-primary);color:var(--color-primary-inverse)")}>
                {i + 1}
              </span>
              {i < steps.length - 1 && <span style={sx("flex:1;width:2px;background:var(--border-strong);min-height:20px")} />}
            </div>
            <div style={sx("flex:1;min-width:0;padding-bottom:14px")}>
              <div style={sx("font-size:14px;font-weight:700;color:var(--text-heading);text-wrap:pretty")}>{s.title}</div>
              {s.note ? <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:2px;text-wrap:pretty")}>{String(s.note)}</div> : null}
            </div>
          </li>
        ))}
      </ol>

      {/* Layer 2: Indoor Offline Floor Map */}
      <div>
        <div style={sx("font-size:12px;font-weight:800;color:var(--color-accent);margin-bottom:8px")}>
          🏢 {lang === "tr" ? "2. Katman · Han İçi Kat Krokisi & Kapı Konumu (GPS Gerekmez)" : "Layer 2 · Indoor Floor Plan & Door Location (No GPS Needed)"}
        </div>
        <SantralFloorMap
          placeId={place?.id || "santral"}
          initialFloor={targetFloor}
          highlightDoor={targetDoor}
          highlightRecordId={curated?.id || rec?.id || null}
          lang={lang}
          onSelectRecord={(rid) => router.push(href.store(rid))}
        />
      </div>
    </div>
  );
}

// ── street page ───────────────────────────────────────────────────────────

function StreetPanel(p: DetailPanelProps & { panel: Panel }) {
  const { lang, panel } = p;
  const st = D.STREETS.find((x) => x.id === panel.id);
  if (!st) return null;

  const area = D.AREAS.find((a) => a.id === st.area);
  const shops = D.STORES.filter((s) => (s.location || {}).street === st.id);
  const neighbors = ((st.neighbors || []) as string[])
    .map((id) => D.STREETS.find((x) => x.id === id))
    .filter(Boolean);

  const widthLabel = ({
    wide: pk({ tr: "Geniş sokak", en: "Wide street", ru: "Широкая улица", ar: "شارع واسع" }, lang),
    narrow: pk({ tr: "Dar sokak", en: "Narrow street", ru: "Узкая улица", ar: "شارع ضيق" }, lang),
  } as Record<string, string>)[st.width as string] || "";

  return (
    <div style={sx(PANEL_CARD)}>
      <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:10px")}>
        <div style={sx("min-width:0")}>
          <div style={sx(KICKER)}>{F(lang, "street")}</div>
          <div style={sx("font-size:20px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em;margin-top:3px;text-wrap:pretty")}>{tx(st, lang)}</div>
        </div>
        <CloseButton lang={lang} onClose={p.onClose} />
      </div>

      <div style={sx("font-size:16px;font-weight:700;color:var(--color-primary-accent);margin-top:12px;text-wrap:pretty")}>{loc(st, "trade", lang)}</div>
      <div style={sx("display:flex;flex-wrap:wrap;gap:5px 12px;margin-top:8px")}>
        <span style={sx("font-size:13px;font-weight:600;color:var(--color-primary)")}>{area ? tx(area, lang) : ""}</span>
        <span style={sx("font-size:13px;color:var(--text-body)")}>
          {st.inside
            ? pk({ tr: "Çarşı içi", en: "Inside the bazaar", ru: "Внутри базара", ar: "داخل السوق" }, lang)
            : pk({ tr: "Çarşı dışı", en: "Outside the bazaar", ru: "Вне базара", ar: "خارج السوق" }, lang)}
        </span>
        <span style={sx("font-size:13px;color:var(--text-body)")}>{widthLabel}</span>
      </div>

      <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border-default);border:1px solid var(--border-default);border-radius:11px;overflow:hidden;margin-top:16px")}>
        <div style={sx("background:var(--surface-card);padding:10px 12px")}>
          <div style={sx("font-size:11.5px;color:var(--text-muted)")}>{F(lang, "shopsHere")}</div>
          <div style={sx("font-size:15px;font-weight:700;color:var(--text-heading);margin-top:2px")}>{shops.length}</div>
        </div>
        <div style={sx("background:var(--surface-card);padding:10px 12px")}>
          <div style={sx("font-size:11.5px;color:var(--text-muted)")}>{F(lang, "hoursLbl")}</div>
          <div style={sx("font-size:14px;font-weight:700;color:var(--color-primary);margin-top:2px")}>
            {st.inside ? "09:00 – 19:00" : "08:00 – 19:00"}
          </div>
        </div>
      </div>

      {shops.length > 0 && (
        <div style={sx("display:flex;flex-direction:column;gap:6px;margin-top:16px")}>
          {shops.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => p.onOpenPanel("store", s.id)}
              style={sx("display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border-default);background:var(--surface-card);font-family:inherit;text-align:start;cursor:pointer")}
            >
              <span style={sx("flex:1;min-width:0")}>
                <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>{s.name}</span>
                <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px")}>{whereOf(s, lang)}</span>
              </span>
              <span style={sx("flex:none;font-size:12.5px;font-weight:700;color:var(--text-body)")}>★ {(s.rating || 0).toFixed(1)}</span>
            </button>
          ))}
        </div>
      )}

      {neighbors.length > 0 && (
        <div style={sx("margin-top:18px")}>
          <div style={sx(KICKER + ";margin-bottom:8px")}>{F(lang, "neighbors")}</div>
          <div style={sx("display:flex;flex-wrap:wrap;gap:6px")}>
            {neighbors.map((n) => (
              <button
                key={n!.id as string}
                type="button"
                onClick={() => p.onOpenPanel("street", n!.id as string)}
                style={sx("background:var(--surface-card);border:1px solid var(--border-strong);border-radius:999px;padding:0 13px;min-height:34px;font-family:inherit;font-size:13px;font-weight:600;color:var(--text-heading);cursor:pointer")}
              >
                {tx(n, lang)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── han page (unified across D.HANS + SC.PLACES + SantralFloorMap) ────────

function HanPanel(
  p: DetailPanelProps & { panel: Panel; router: ReturnType<typeof useRouter> },
) {
  const { lang, panel, hanFloor, router } = p;
  const han = D.HANS.find((x) => x.id === panel.id);
  const place = SC.PLACES.find((x) => x.id === panel.id);
  if (!han && !place) return null;

  const placeId = (place?.id || (han?.id as string)) as string;
  const title = (place?.name || (han?.name as string)) as string;
  const floors = (place?.floors || (han?.floors as number[]) || [0]) as number[];
  const activeFloor = floors.includes(hanFloor)
    ? hanFloor
    : placeId === "santral" && floors.includes(1)
      ? 1
      : floors[0];

  const allRecs = SC.recordsOfPlace(placeId);
  const floorRecs = allRecs.filter((r) => r.floor === activeFloor);
  const area = D.AREAS.find((a) => a.id === (han?.area || place?.semt));
  const units = place?.units || (han?.units as number) || allRecs.length;
  const lat = place?.lat ?? (han?.lat as number) ?? 41.01518;
  const lng = place?.lng ?? (han?.lng as number) ?? 28.96845;

  return (
    <div style={sx("background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;overflow:hidden;box-shadow:0 3px 4px rgba(0,0,0,.03)")}>
      <div style={sx("padding:18px;display:flex;flex-direction:column;gap:14px")}>
        <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:10px")}>
          <div style={sx("min-width:0")}>
            <div style={sx(KICKER)}>{F(lang, "hanTitle") || pk({ tr: "Han & Kat Rehberi", en: "Han & Floor Guide", ru: "Хан и план этажей", ar: "الخان ودليل الطوابق" }, lang)}</div>
            <div style={sx("font-size:20px;font-weight:800;color:var(--text-heading);letter-spacing:-.015em;margin-top:3px;text-wrap:pretty")}>{title}</div>
            <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px;text-wrap:pretty")}>
              {[
                area ? tx(area, lang) : "",
                `${floors.length} ${pk({ tr: "kat", en: "floors", ru: "этажей", ar: "طوابق" }, lang)}`,
                `${allRecs.length} / ${units} ${pk({ tr: "kayıtlı dükkân", en: "registered shops", ru: "записей", ar: "متجر مسجل" }, lang)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <CloseButton lang={lang} onClose={p.onClose} />
        </div>

        <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
          <Button
            size="sm"
            color="primary"
            variant="solid"
            onClick={() => router.push(`/yer/${placeId}`)}
          >
            {lang === "tr" ? "Tam Ekran Han Rehberini Aç" : "Open Full Han Directory"}
          </Button>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`}
            target="_blank"
            rel="noreferrer"
            style={sx("text-decoration:none")}
          >
            <Button size="sm" color="accent" variant="outline" iconStart="map">
              {lang === "tr" ? "Google Maps Yürüyüş Rotası" : "Google Maps Walking Route"}
            </Button>
          </a>
        </div>

        {/* Interactive Floor Plan Component */}
        <SantralFloorMap
          placeId={placeId}
          initialFloor={activeFloor}
          lang={lang}
          onSelectRecord={(rid) => p.onOpenPanel("store", rid)}
        />

        {/* Floor tabs for quick list switching */}
        <div style={sx("display:flex;gap:6px;flex-wrap:wrap")} role="tablist">
          {floors.map((f) => {
            const on = f === activeFloor;
            const cnt = allRecs.filter((r) => r.floor === f).length;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => p.onFloor(f)}
                style={sx(
                  "height:32px;padding:0 12px;border-radius:8px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;border:1px solid " +
                    (on
                      ? "var(--color-primary);background:var(--color-primary);color:var(--color-primary-inverse)"
                      : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
                )}
              >
                {floorLabel(f, lang, place || placeId)} ({cnt})
              </button>
            );
          })}
        </div>

        <div style={sx("display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto")}>
          {floorRecs.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => p.onOpenPanel("store", r.curated || r.id)}
              style={sx("display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border-default);background:var(--surface-card);font-family:inherit;text-align:start;cursor:pointer")}
            >
              <span style={sx("flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:42px;height:26px;padding:0 7px;border-radius:6px;font-size:12px;font-weight:700;background:var(--color-primary-soft);color:var(--color-primary)")}>
                No {String(r.door)}
              </span>
              <span style={sx("flex:1;min-width:0")}>
                <span style={sx("display:block;font-size:14px;font-weight:700;color:var(--text-heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                  {recordName(r, lang)}
                </span>
                <span style={sx("display:block;font-size:12px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                  {r.corridor ? `${r.corridor} Koridor · ` : ""}
                  {(r.cats || []).map((c) => tx([...D.CATS, ...SC.CATS_EXTRA].find((x) => x.id === c), lang)).join(", ")}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
