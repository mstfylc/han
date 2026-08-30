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
import type { CuratedStore, Lang, Mode, Currency } from "@/data/types";
import { Button, Icon } from "@/ds";
import { ImageSlot } from "@/components/ImageSlot";
import { F, W } from "@/lib/copy";
import { convert, money, tx, loc } from "@/lib/i18n";
import { href } from "@/lib/routes";
import { openPill, placePhoto, storeBadges, storePhoto, whereOf } from "@/lib/shop";
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
  if (panel.kind === "route") return <RoutePanel {...p} panel={panel} />;
  if (panel.kind === "street") return <StreetPanel {...p} panel={panel} />;
  return <HanPanel {...p} panel={panel} />;
}

// ── shop summary ──────────────────────────────────────────────────────────

function StoreSummary(
  p: DetailPanelProps & { panel: Panel; router: ReturnType<typeof useRouter> },
) {
  const { lang, mode, currency, panel, router } = p;
  const s = D.STORES.find((x) => x.id === panel.id) as CuratedStore | undefined;
  if (!s) return null;

  const cv = (n: number | null) => convert(n, lang, currency);
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
            <div style={sx("font-size:13.5px;color:var(--text-muted);margin-top:3px")}>{whereOf(s, lang)}</div>
          </div>
          <span style={sx(op.style)}>{op.label}</span>
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
                    <div style={sx("font-size:12px;color:var(--text-muted);margin-top:2px")}>{pr.unit || ""}</div>
                  </div>
                  <div style={sx("flex:none;text-align:end")}>
                    <div style={sx("font-size:15px;font-weight:700;color:var(--color-primary)")}>{money(value ?? null)}</div>
                    {/* The lira price stays primary; the conversion sits beside
                        it, never instead of it. */}
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
          {/* The one filled-orange button on this panel: the primary action. */}
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
                {F(lang, "hanTitle") || (han.name as string)}
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

// ── directions ────────────────────────────────────────────────────────────

function RoutePanel(p: DetailPanelProps & { panel: Panel }) {
  const { lang, panel } = p;
  const shop = D.STORES.find((x) => x.id === panel.id) as CuratedStore | undefined;
  if (!shop) return null;

  // Door → street chain → landmark → floor. GPS ends at the gate; from there
  // wayfinding is by what you can see.
  const steps = L.routeSteps(D, shop, lang);
  const total = steps.reduce((n, s) => n + (Number(s.mins) || 0), 0);

  return (
    <div style={sx(PANEL_CARD)}>
      <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:10px")}>
        <div style={sx("min-width:0")}>
          <div style={sx(KICKER)}>{F(lang, "routeTitle") || W(lang, "directions")}</div>
          <div style={sx("font-size:19px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em;margin-top:3px;text-wrap:pretty")}>{shop.name}</div>
          <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px")}>
            {pk({ tr: "Toplam ≈ " + total + " dk yürüyüş", en: "About " + total + " min on foot", ru: "Примерно " + total + " мин пешком", ar: "نحو " + total + " دقيقة سيرًا" }, lang)}
          </div>
        </div>
        <CloseButton lang={lang} onClose={p.onClose} />
      </div>

      <ol style={sx("margin-top:16px;padding:0;list-style:none")}>
        {steps.map((s, i) => (
          <li key={i} style={sx("display:flex;gap:12px")}>
            <div style={sx("flex:none;display:flex;flex-direction:column;align-items:center;width:28px")}>
              <span style={sx("flex:none;width:26px;height:26px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;background:var(--color-primary);color:#fff")}>
                {i + 1}
              </span>
              {i < steps.length - 1 && <span style={sx("flex:1;width:2px;background:var(--border-strong);min-height:20px")} />}
            </div>
            <div style={sx("flex:1;min-width:0;padding-bottom:16px")}>
              <div style={sx("font-size:14.5px;font-weight:700;color:var(--text-heading);text-wrap:pretty")}>{s.title}</div>
              {s.note ? <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:2px;text-wrap:pretty")}>{String(s.note)}</div> : null}
              <div style={sx("font-size:12px;font-weight:600;color:var(--color-primary);margin-top:4px")}>
                {s.mins ? s.mins + " " + pk({ tr: "dk", en: "min", ru: "мин", ar: "د" }, lang) : ""}
              </div>
            </div>
          </li>
        ))}
      </ol>
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

// ── han page ──────────────────────────────────────────────────────────────

function HanPanel(p: DetailPanelProps & { panel: Panel }) {
  const { lang, panel, hanFloor } = p;
  const han = D.HANS.find((x) => x.id === panel.id);
  if (!han) return null;

  const floors = (han.floors || [0]) as number[];
  const shops = D.STORES.filter((s) => s.han === han.id && (s.floor || 0) === hanFloor);
  const area = D.AREAS.find((a) => a.id === han.area);

  return (
    <div style={sx("background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;overflow:hidden;box-shadow:0 3px 4px rgba(0,0,0,.03)")}>
      <div style={sx("height:150px;background:var(--surface-muted)")}>
        <ImageSlot src={placePhoto("han")} placeholder={han.name as string} decorative />
      </div>
      <div style={sx("padding:18px")}>
        <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:10px")}>
          <div style={sx("min-width:0")}>
            <div style={sx(KICKER)}>{F(lang, "hanTitle") || pk({ tr: "Han", en: "Han", ru: "Хан", ar: "خان" }, lang)}</div>
            <div style={sx("font-size:19px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em;margin-top:3px;text-wrap:pretty")}>{han.name as string}</div>
            <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px;text-wrap:pretty")}>
              {[area ? tx(area, lang) : "", han.units ? han.units + " " + pk({ tr: "birim", en: "units", ru: "мест", ar: "وحدة" }, lang) : ""]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <CloseButton lang={lang} onClose={p.onClose} />
        </div>

        <div style={sx("display:flex;gap:6px;margin-top:14px;flex-wrap:wrap")} role="tablist" aria-label={pk({ tr: "Katlar", en: "Floors", ru: "Этажи", ar: "الطوابق" }, lang)}>
          {floors.map((f) => {
            const on = f === hanFloor;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => p.onFloor(f)}
                style={sx(
                  "height:32px;padding:0 13px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:1px solid " +
                    (on
                      ? "var(--color-primary);background:var(--color-primary);color:#fff"
                      : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
                )}
              >
                {f > 0 ? F(lang, "hanFloor", f) : F(lang, "hanGround")}
              </button>
            );
          })}
        </div>

        <div style={sx("display:flex;flex-direction:column;gap:6px;margin-top:14px")}>
          {shops.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => p.onOpenPanel("store", s.id)}
              style={sx("display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border-default);background:var(--surface-card);font-family:inherit;text-align:start;cursor:pointer")}
            >
              <span style={sx("flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:26px;padding:0 7px;border-radius:6px;font-size:12px;font-weight:700;background:var(--color-primary-soft);color:var(--color-primary-accent)")}>
                {String(s.no)}
              </span>
              <span style={sx("flex:1;min-width:0")}>
                <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{s.name}</span>
                <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                  {(s.cats || []).map((c) => tx(D.CATS.find((x) => x.id === c), lang)).join(", ")}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* An empty floor is a fact, not a failure — say so rather than showing
            nothing at all. */}
        {shops.length === 0 && (
          <div style={sx("font-size:13.5px;color:var(--text-muted);margin-top:12px;text-wrap:pretty")}>
            {pk({
              tr: "Bu katta kaydı açılmış dükkân yok.",
              en: "No shop on this floor has a record yet.",
              ru: "На этом этаже пока нет записей.",
              ar: "لا يوجد متجر بسجل في هذا الطابق بعد.",
            }, lang)}
          </div>
        )}
      </div>
    </div>
  );
}
