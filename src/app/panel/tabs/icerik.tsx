"use client";

// Etkinlik & Kampanya (ADMIN-PLANI 15) — prototipteki `isIcerik` bölümünün portu.
//
// EVENTS ve CAMPAIGNS alıcıya gösteriliyordu ama düzenlenemiyordu. Burada
// ekleme, yayına alma ve yayından çıkarma var. Temel veri BOZULMAZ — üzerine
// AD.mergeContent'in okuduğu ekleme / gizleme / düzeltme katmanı (han-content-v1)
// biner. Yeni içerik GİZLİ başlar: yarım içerik alıcıya gösterilmez. Yayından
// alınan içerik aynı katmanı okuyan alıcı yüzeyinde de kaybolur.

import { useEffect, useState } from "react";

import * as AD from "@/data/han-admin";
import { CAMPAIGNS, EVENTS, type DataRow } from "@/data/han-data";
import { Button } from "@/ds";
import { sx } from "@/lib/sx";
import { KEYS, readKey, writeKey } from "@/services/storage";

import { H1, Pill, SUB, type PanelTabProps } from "./shared";

/** Yönetim listesi gizli içeriği de göstermek ZORUNDA (yoksa yayına geri
 *  alınamaz); AD.mergeContent ise alıcı görünümüdür ve gizliyi eler. Bu yüzden
 *  panel listesi katman deposundaki eklemeler + temel veriden kurulur. */
function adminRows(kind: "events" | "camps", base: DataRow[]): DataRow[] {
  const layer = readKey<Partial<Record<"events" | "camps", { add?: DataRow[] }>>>(KEYS.content, {});
  const adds = layer[kind]?.add || [];
  return adds.concat(base);
}

function cardStyle(tone: string | null): string {
  return "background:var(--surface-card);border:1px solid var(--border-" +
    (tone ? "strong" : "default") + ");border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:18px 20px" +
    (tone ? ";border-left:3px solid var(--color-" + tone + ")" : "");
}

export default function Icerik(props: PanelTabProps) {
  const [, setLocalRev] = useState(0);
  const bump = () => setLocalRev((n) => n + 1);

  // Katman depodan okunur; sunucu tarafı render ile uyuşmazlık çıkmasın diye
  // overlay yalnız mount sonrası uygulanır.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const [ctKind, setCtKind] = useState<"events" | "camps">("events");
  const locked = props.readOnly;
  const isEv = ctKind === "events";
  const base = isEv ? EVENTS : CAMPAIGNS;
  const rows = ready ? adminRows(ctKind, base) : base;
  const KD = AD.EVENT_KINDS;

  const kindOpts: { value: "events" | "camps"; label: string }[] = [
    { value: "events", label: "Etkinlik · " + (ready ? AD.mergeContent(EVENTS, "events").length : EVENTS.length) },
    { value: "camps", label: "Kampanya · " + (ready ? AD.mergeContent(CAMPAIGNS, "camps").length : CAMPAIGNS.length) },
  ];

  const openNew = () => {
    if (locked) return props.say("Salt okuma rolü içerik ekleyemez");
    // Yeni içerik boş bir kabuk olarak eklenir ve hemen gizli başlar:
    // yarım içerik alıcıya gösterilmez.
    const rec = isEv
      ? { day: String(new Date().getDate()).padStart(2, "0"), monthTr: "EYL", kind: "tour",
          tr: "Yeni etkinlik", en: "New event", ru: "Новое событие", ar: "حدث جديد" }
      : { tone: "primary", tagTr: "Yeni", titleTr: "Yeni kampanya", area: "tahtakale" };
    const added = AD.addContent(ctKind, rec);
    AD.hideContent(ctKind, String(added.id), true);
    bump();
    props.refresh();
    props.say(isEv ? "Yeni etkinlik eklendi — gizli başladı" : "Yeni kampanya eklendi — gizli başladı");
  };

  return (
    <>
      <h1 style={sx(H1)}>Etkinlik &amp; Kampanya</h1>
      <p style={sx(SUB)}>
        Alıcıya gösterilen içerik — ekle, düzelt, yayından al. Temel veri bozulmaz; yayından alınan
        içerik alıcı tarafında da kaybolur.
      </p>

      <div style={sx("margin-top:18px;background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;padding:15px 20px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
        <div role="group" aria-label="İçerik türü" style={sx("display:inline-flex;gap:4px;padding:3px;border-radius:9px;background:var(--surface-muted);border:1px solid var(--border-default)")}>
          {kindOpts.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={ctKind === o.value}
              onClick={() => setCtKind(o.value)}
              style={sx(
                "height:26px;padding:0 11px;border-radius:7px;border:none;font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;" +
                (ctKind === o.value
                  ? "background:var(--surface-card);color:var(--text-heading);box-shadow:0 1px 2px rgba(0,0,0,.08)"
                  : "background:transparent;color:var(--text-muted)"),
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div style={sx("font-size:13px;color:var(--text-muted)")}>
          {(ready ? rows.filter((x) => !AD.isHidden(ctKind, String(x.id))).length : rows.length) + " yayında"}
        </div>
        {!locked && (
          <span style={sx("margin-left:auto")}>
            <Button color="accent" size="sm" iconStart="plus-squared" onClick={openNew}>
              {isEv ? "Etkinlik Ekle" : "Kampanya Ekle"}
            </Button>
          </span>
        )}
      </div>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:14px")}>
        {rows.map((x) => {
          const id = String(x.id);
          const hidden = ready && AD.isHidden(ctKind, id);
          // Temel içerik silinmez — yalnız gizlenir. "Sil" yalnız panelde
          // eklenen (ct...) içeriklerde çıkar; o da katmanda gizleme olarak durur.
          const own = id.startsWith("ct");
          const title = isEv ? String(x.tr || "—") : String(x.titleTr || x.tagTr || "—");
          const meta = isEv
            ? [KD[String(x.kind)]?.tr || String(x.kind || ""), String(x.han || x.area || ""), own ? "panelde eklendi" : "temel içerik"].filter(Boolean).join(" · ")
            : [String(x.tagTr || ""), x.store ? "dükkân: " + String(x.store) : String(x.area || ""), own ? "panelde eklendi" : "temel içerik"].filter(Boolean).join(" · ");
          return (
            <div key={id} style={sx(cardStyle(hidden ? null : "success"))}>
              <div style={sx("display:flex;align-items:flex-start;gap:13px")}>
                {isEv && !!x.day && (
                  <div style={sx("flex:none;width:50px;text-align:center;padding:8px 0;border-radius:9px;background:var(--color-primary-soft)")}>
                    <div style={sx("font-size:19px;font-weight:700;line-height:1;color:var(--color-primary-accent)")}>{String(x.day)}</div>
                    <div style={sx("font-size:10.5px;font-weight:700;letter-spacing:.04em;color:var(--color-primary-accent);margin-top:3px")}>{String(x.monthTr || "")}</div>
                  </div>
                )}
                <div style={sx("flex:1;min-width:0")}>
                  <div style={sx("font-size:14px;font-weight:600;line-height:1.35;color:var(--text-heading)")}>{title}</div>
                  <div style={sx("font-size:12.5px;line-height:1.5;color:var(--text-muted);margin-top:4px")}>{meta}</div>
                </div>
                <Pill label={hidden ? "Yayında değil" : "Yayında"} t={hidden ? "secondary" : "success"} />
              </div>
              {!locked && (
                <div style={sx("margin-top:13px;padding-top:13px;border-top:1px solid var(--border-default);display:flex;gap:8px;flex-wrap:wrap")}>
                  <Button
                    variant="light"
                    color={hidden ? "success" : "secondary"}
                    size="sm"
                    onClick={() => {
                      AD.hideContent(ctKind, id, !hidden);
                      bump();
                      props.refresh();
                      props.say(title + (hidden ? " · yayına alındı" : " · yayından alındı — alıcı tarafında da kayboldu"));
                    }}
                  >
                    {hidden ? "Yayına al" : "Yayından al"}
                  </Button>
                  {own && (
                    <Button
                      variant="ghost"
                      color="danger"
                      size="sm"
                      onClick={() => {
                        // Panelde eklenen içerik katmandan tümüyle düşürülür;
                        // temel veri zaten silinemez, yalnız gizlenir.
                        const layer = readKey<Partial<Record<"events" | "camps", { add?: DataRow[]; hide?: string[]; patch?: Record<string, unknown> }>>>(KEYS.content, {});
                        const lk = { add: [] as DataRow[], hide: [] as string[], patch: {}, ...layer[ctKind] };
                        lk.add = (lk.add || []).filter((a) => String(a.id) !== id);
                        lk.hide = (lk.hide || []).filter((h) => h !== id);
                        writeKey(KEYS.content, { ...layer, [ctKind]: lk });
                        bump();
                        props.refresh();
                        props.say(title + " · silindi");
                      }}
                    >
                      Sil
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
