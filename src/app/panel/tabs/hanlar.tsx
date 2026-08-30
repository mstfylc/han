"use client";

// Kapsama — yer bazında kayıt kapsaması. SALT OKUNUR rapor.
//
// İki prototipin birleşimi:
//   · HAN Panel.dc.html · isHanlar: yer kartları — kat, dükkân (birim),
//     kayıtlı (açık kayıt), kapsama yüzdesi ve ağırlıklı kategoriler.
//   · HAN Editör.dc.html · E8 (routeRows): "Bu hafta nereye gidilecek" —
//     kapsama yüzdesi bir girdi metriğidir, başarı ölçüsü değil; sıralama
//     yüksek birim × düşük kapsama × BULK_APPROVED imkânına göre kurulur
//     (gain × 2,2 anlaşmalı yerde — 500 dükkân tek işlemde kapanır).
//
// Buradan tur atanmaz: eylem Saha Görevleri'nindir, bu ekran yalnız nereye
// bakılacağını söyler. Sayılar SC.placeStats / SC.semtStats'tan gelir —
// panelin kendi demo verisi yoktur.

import { useMemo } from "react";

import { CATS } from "@/data/han-data";
import * as SC from "@/data/han-scale";
import { sx } from "@/lib/sx";

import { CARD, H1, KICKER, Pill, SUB, num } from "./shared";
import type { PanelTabProps } from "./shared";

const semtName = (id: string) => SC.SEMTLER.find((x) => x.id === id)?.tr || id;
const catName = (id: string) => {
  const c = CATS.find((x) => x.id === id) || SC.CATS_EXTRA.find((x) => x.id === id);
  return c ? String(c.tr || id) : id;
};

function Bar({ pct, tone }: { pct: number; tone: string }) {
  return (
    <span style={sx("display:block;height:8px;border-radius:999px;background:var(--surface-muted);overflow:hidden")}>
      <span style={sx("display:block;height:100%;border-radius:999px;width:" + Math.max(2, Math.min(100, pct)) + "%;background:var(--color-" + tone + ")")} />
    </span>
  );
}

export default function Hanlar(_props: PanelTabProps) {
  // Yer kartları: birim sayısına göre, en büyük yer önde (prototipteki sıra).
  const cards = useMemo(
    () =>
      SC.PLACES.slice()
        .sort((a, b) => b.units - a.units)
        .map((p) => {
          const st = SC.placeStats(p.id);
          const registered = st ? st.openRecords : 0;
          const pct = Math.round((registered / (p.units || 1)) * 100);
          return {
            id: p.id,
            name: p.name,
            address: semtName(p.semt),
            floors: (p.floors || []).length,
            units: p.units,
            registered,
            pct,
            cats: (st?.topCats || []).slice(0, 3).map((c) => catName(c.cat)),
            color: pct > 60 ? "success" : pct > 35 ? "primary" : "warning",
            statusLabel: pct > 60 ? "Tamamlandı" : pct > 35 ? "Devam ediyor" : "Başlangıç",
            statusTone: pct > 60 ? "success" : pct > 35 ? "primary" : "warning",
            bulk: SC.BULK_APPROVED.includes(p.id),
          };
        }),
    [],
  );

  // E8 · ölçüm eylem üretmeli: "bu hafta hangi hana git".
  const route = useMemo(
    () =>
      SC.PLACES.map((p) => {
        const st = SC.placeStats(p.id);
        const open = st ? st.openRecords : 0;
        const gain = p.units - open;
        const bulk = SC.BULK_APPROVED.includes(p.id);
        return { p, cov: st ? st.coverage : 0, gain, bulk, score: gain * (bulk ? 2.2 : 1) };
      })
        .sort((a, b) => b.score - a.score)
        .slice(0, 6),
    [],
  );

  // Semt kapsaması: aynı sayılar semt semt (SC.semtStats).
  const semts = useMemo(
    () =>
      SC.SEMTLER.map((s) => SC.semtStats(s.id))
        .filter((x) => x.units > 0)
        .map((x) => ({ ...x, pct: Math.round((x.open / (x.units || 1)) * 100) }))
        .sort((a, b) => b.units - a.units),
    [],
  );

  return (
    <>
      <h1 style={sx(H1)}>Kapsama</h1>
      <p style={sx(SUB)}>Yer bazında kayıt kapsaması — birim sayısı ve açılan kayıt.</p>

      {/* E8 · bu hafta nereye gidilecek */}
      <div style={sx("margin-top:18px;border:1px solid var(--color-accent);border-radius:14px;background:var(--surface-card);padding:20px;box-shadow:0 3px 4px rgba(0,0,0,.03)")}>
        <div style={sx("font-size:18px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em")}>
          Bu hafta nereye gidilecek
        </div>
        <div style={sx("font-size:13.5px;color:var(--text-muted);margin-top:4px;max-width:76ch;text-wrap:pretty")}>
          Kapsama yüzdesi bir girdi metriğidir, başarı ölçüsü değil. Bu sıralama tek soruya cevap verir:
          bir yetkilinin bir günü nerede en çok kayıt açar? Han yönetimiyle anlaşması olan yerler öne
          alınır — orada 500 dükkân tek işlemde kapanır.
        </div>
        <div style={sx("display:flex;flex-direction:column;gap:9px;margin-top:16px")}>
          {route.map((x, i) => (
            <div
              key={x.p.id}
              style={sx("display:flex;align-items:center;gap:13px;padding:14px 16px;border-radius:13px;background:var(--surface-card);border:1px solid " + (x.bulk ? "var(--color-success)" : "var(--border-strong)"))}
            >
              <span style={sx("flex:none;width:26px;height:26px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;background:var(--color-" + (x.bulk ? "success" : "primary") + "-soft);color:var(--color-" + (x.bulk ? "success" : "primary-accent") + ")")}>
                {i + 1}
              </span>
              <div style={sx("flex:1;min-width:180px")}>
                <div style={sx("font-size:15.5px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>{x.p.name}</div>
                <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px;text-wrap:pretty")}>
                  {num(x.gain) + " birim kayıtsız · kapsama %" + x.cov +
                    (x.bulk ? " · han yönetimi anlaşmalı, tek işlemde kapanır" : " · anlaşma yok, kapı kapı gerekir")}
                </div>
              </div>
              <span style={sx("flex:none;font-size:14px;font-weight:700;color:var(--color-" + (x.bulk ? "success" : "primary") + ");font-variant-numeric:tabular-nums")}>
                {"+" + num(x.gain)}
              </span>
            </div>
          ))}
        </div>
        <p style={sx("margin:14px 0 0;font-size:12.5px;color:var(--text-muted);text-wrap:pretty")}>
          Bu ekran salt okunur bir rapordur; buradan tur atanmaz. Sıralamadaki bir yere gitmek,
          <strong> Saha Görevleri</strong>&apos;nden bir yetkiliye görev atanarak planlanır — anlaşmalı yer
          için de <strong>Toplu Onay</strong> tek işlemde kapatır.
        </p>
      </div>

      {/* semt kapsaması */}
      <div style={sx("margin-top:18px;" + CARD)}>
        <div style={sx(KICKER)}>Semt kapsaması</div>
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:14px;margin-top:12px")}>
          {semts.map((s) => (
            <div key={s.semt?.id || s.places}>
              <div style={sx("display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px")}>
                <span style={sx("font-size:13px;font-weight:600;color:var(--text-heading)")}>{s.semt?.tr}</span>
                <span style={sx("font-size:12px;font-weight:600;color:var(--text-muted)")}>
                  {num(s.open) + " / " + num(s.units) + " · %" + s.pct}
                </span>
              </div>
              <Bar pct={s.pct} tone={s.pct >= 40 ? "success" : s.pct >= 15 ? "primary" : "warning"} />
            </div>
          ))}
        </div>
      </div>

      {/* yer kartları */}
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:16px;margin-top:18px")}>
        {cards.map((h) => (
          <div key={h.id} style={sx("background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;box-shadow:0 3px 4px rgba(0,0,0,.03);overflow:hidden")}>
            <div style={sx("padding:18px 20px;border-bottom:1px solid var(--border-default)")}>
              <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:12px")}>
                <div style={sx("min-width:0")}>
                  <div style={sx("font-size:16px;font-weight:600;color:var(--text-heading);letter-spacing:-.01em")}>{h.name}</div>
                  <div style={sx("font-size:12px;color:var(--text-muted);margin-top:3px")}>
                    {h.address}
                    {h.bulk ? " · han yönetimi anlaşmalı" : ""}
                  </div>
                </div>
                <Pill label={h.statusLabel} t={h.statusTone} />
              </div>
            </div>
            <div style={sx("padding:18px 20px;display:flex;flex-direction:column;gap:14px")}>
              <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:12px")}>
                <div>
                  <div style={sx("font-size:11px;color:var(--text-muted)")}>Kat</div>
                  <div style={sx("font-size:20px;font-weight:700;color:var(--text-heading)")}>{h.floors}</div>
                </div>
                <div>
                  <div style={sx("font-size:11px;color:var(--text-muted)")}>Dükkân</div>
                  <div style={sx("font-size:20px;font-weight:700;color:var(--text-heading)")}>{num(h.units)}</div>
                </div>
                <div>
                  <div style={sx("font-size:11px;color:var(--text-muted)")}>Açık kayıt</div>
                  <div style={sx("font-size:20px;font-weight:700;color:var(--color-primary)")}>{num(h.registered)}</div>
                </div>
              </div>
              <div>
                <div style={sx("display:flex;align-items:center;justify-content:space-between;margin-bottom:6px")}>
                  <span style={sx("font-size:12px;color:var(--text-muted)")}>Kapsama</span>
                  <span style={sx("font-size:12px;font-weight:600;color:var(--text-heading)")}>{h.pct + "%"}</span>
                </div>
                <Bar pct={h.pct} tone={h.color} />
              </div>
              {h.cats.length > 0 && (
                <div style={sx("display:flex;flex-wrap:wrap;gap:5px")}>
                  {h.cats.map((c) => (
                    <span key={c} style={sx("display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:6px;font-size:12px;font-weight:600;background:var(--surface-muted);color:var(--text-body)")}>
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
