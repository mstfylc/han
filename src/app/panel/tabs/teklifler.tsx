"use client";

// Teklif Denetimi — pazar çalışıyor mu? (ADMIN-PLANI 5 + 9)
//
// Pazarın tek gerçek sağlık göstergesi ekranda: YANIT ORANI. Her talebin
// hunisi (gitti · açtı · teklif · cevaplayamadı) ve yaşı görünür; sayılar
// AD.marketHealth'ten gelir, Özet kartıyla aynı kaynak — iki ekran asla
// çelişemez.
//
// SLA 48 saat: teklif almadan bu süreyi geçen talep kırmızıya düşer ve
// "müdahale gerekiyor" der. Yanıtsız talep kendiliğinden çözülmez: yönetim
// bir dükkânı elle işaret eder (AD.addNudge) — esnaf panelinde "yönetici bu
// talebi size iletti" olarak çıkar ve onurluca geri çevrilebilir (dropNudge).

import { useState } from "react";

import * as AD from "@/data/han-admin";
import * as OF from "@/data/han-offers";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import { Button, Select } from "@/ds";
import { sx } from "@/lib/sx";
import { KEYS, readKey } from "@/services/storage";
import type { PersistedState } from "@/state/types";

import { H1, num, Pill, SUB, type PanelTabProps } from "./shared";

type MhFilter = "all" | "gecikmis" | "sessiz" | "teklifli";

// Faz 2 ekranlarının ortak kart kabuğu — prototipteki cardStyle/statCard.
const card = (tone?: string | null) =>
  "background:var(--surface-card);border:1px solid var(--border-" +
  (tone ? "strong" : "default") + ");border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:18px 20px" +
  (tone ? ";border-left:3px solid var(--color-" + tone + ")" : "");
const STAT = "background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:18px";
const VAL = "font-size:26px;font-weight:700;letter-spacing:-.01em;color:";

export default function Teklifler(props: PanelTabProps) {
  const { role, readOnly, refresh, say } = props;

  const [filter, setFilter] = useState<MhFilter>("all");
  const [pick, setPick] = useState<Record<string, string>>({});

  const web = readKey<Partial<PersistedState>>(KEYS.web, {});
  const talepler = web.talepler || [];
  const declined = OF.allDeclined();
  const health = AD.marketHealth(
    talepler,
    (id) => OF.offersOf(id),
    (id) => OF.seenCount(id),
    (id) => Object.keys(declined[String(id)] || {}).length,
  );
  const nudges = AD.allNudges();
  const recName = (id: string) => SC.RECORDS.find((r) => r.id === id)?.name || id;

  const rows = health.rows.filter((r) =>
    filter === "all" ? true
    : filter === "sessiz" ? r.offers === 0
    : filter === "gecikmis" ? r.overdue
    : r.offers > 0);

  const stats = [
    { label: "Açık talep", value: num(health.open), note: "alıcıdan gelen",
      color: "var(--text-heading)" },
    { label: "Yanıt oranı", value: health.answerRate == null ? "—" : health.answerRate + "%",
      note: health.answerRate == null ? "henüz talep yok" : health.quoted + " talep teklif aldı",
      color: "var(--color-" + (health.answerRate == null ? "secondary" : health.answerRate >= 60 ? "success" : health.answerRate >= 30 ? "warning" : "danger") + ")" },
    { label: "Hiç teklif almayan", value: num(health.silent), note: "pazar buralarda çalışmıyor",
      color: "var(--color-" + (health.silent ? "warning" : "success") + ")" },
    { label: AD.SLA_HOURS + " saati geçen", value: num(health.overdue), note: "müdahale gerekiyor",
      color: "var(--color-" + (health.overdue ? "danger" : "success") + ")" },
  ];

  const filters: { value: MhFilter; label: string }[] = [
    { value: "all", label: "Tümü · " + health.open },
    { value: "gecikmis", label: "Gecikmiş · " + health.overdue },
    { value: "sessiz", label: "Teklifsiz · " + health.silent },
    { value: "teklifli", label: "Teklifli · " + health.quoted },
  ];

  return (
    <>
      <h1 style={sx(H1)}>Teklif Denetimi</h1>
      <p style={sx(SUB)}>
        Pazar çalışıyor mu: hangi talep yanıt aldı, hangisi boşta kaldı, nereye müdahale gerekiyor.
        Teklifsiz {AD.SLA_HOURS} saati geçen talep kırmızıdır — yanıtsız talep alıcıyı kaybettirir.
      </p>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:16px;margin-top:18px;margin-bottom:18px")}>
        {stats.map((s) => (
          <div key={s.label} style={sx(STAT)}>
            <div style={sx("font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:10px")}>{s.label}</div>
            <div style={sx(VAL + s.color)}>{s.value}</div>
            <div style={sx("font-size:12px;color:var(--text-muted);margin-top:4px;text-wrap:pretty")}>{s.note}</div>
          </div>
        ))}
      </div>

      <div style={sx("background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:15px 20px;margin-bottom:16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
        {filters.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "light" : "ghost"}
            color={filter === f.value ? "primary" : "dark"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
        <div style={sx("margin-left:auto;font-size:13px;color:var(--text-muted)")}>{rows.length} talep</div>
      </div>

      {rows.length === 0 && (
        <div style={sx("background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;padding:34px 22px;text-align:center")}>
          <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>
            {health.open ? "Bu filtrede talep yok" : "Henüz alıcı talebi yok"}
          </div>
          <div style={sx("font-size:13px;color:var(--text-muted);margin-top:5px;max-width:60ch;margin-left:auto;margin-right:auto;text-wrap:pretty")}>
            {health.open
              ? "Filtreyi genişletin — diğer taleplerin durumu farklı."
              : "Alıcı tarafında talep bırakıldıkça huniyle birlikte buraya düşer: kaç dükkâna gitti, kaçı açtı, kaçı teklif verdi."}
          </div>
        </div>
      )}

      <div style={sx("display:flex;flex-direction:column;gap:12px")}>
        {rows.map((r) => {
          const t = r.t;
          const nd = nudges[String(t.id)] || [];
          const dist = SE.distribute(t, { mode: "ikisi", lang: "tr" });
          const already = nd.map((n) => n.recordId);
          const cands = (dist.sent || []).filter((x) => !already.includes(x.id)).slice(0, 12);
          const picked = pick[t.id] || "";
          const funnel: [string, number, string][] = [
            ["gitti", (dist.sent || []).length, "primary"],
            ["açtı", r.seen, "info"],
            ["teklif", r.offers, r.offers ? "success" : "warning"],
            ["cevaplayamadı", r.declined, "secondary"],
          ];
          return (
            <div key={t.id} style={sx(card(r.overdue ? "danger" : r.offers ? "success" : "warning"))}>
              <div style={sx("display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap")}>
                <div style={sx("flex:1;min-width:200px")}>
                  <div style={sx("display:flex;align-items:center;gap:9px;flex-wrap:wrap")}>
                    <span style={sx("font-size:14.5px;font-weight:600;line-height:1.35;color:var(--text-heading)")}>{t.urun}</span>
                    <Pill
                      label={r.offers ? r.offers + " teklif" : r.overdue ? "Gecikmiş" : "Bekliyor"}
                      t={r.offers ? "success" : r.overdue ? "danger" : "warning"}
                    />
                  </div>
                  <div style={sx("font-size:12.5px;line-height:1.5;color:var(--text-muted);margin-top:4px")}>
                    {[
                      t.adet ? t.adet + " " + (t.birim || "adet") : "",
                      r.ageKnown && r.ageH != null
                        ? (r.ageH < 24 ? r.ageH + " saat önce" : Math.round(r.ageH / 24) + " gün önce")
                        : "tarihi bilinmiyor",
                      (dist.sent || []).length + " dükkâna gitti",
                    ].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div style={sx("display:flex;gap:16px;flex-wrap:wrap")}>
                  {funnel.map((f) => (
                    <div key={f[0]} style={sx("min-width:62px")}>
                      <div style={sx("font-size:19px;font-weight:700;letter-spacing:-.01em;color:var(--color-" + f[2] + ")")}>{f[1]}</div>
                      <div style={sx("font-size:11px;color:var(--text-muted);margin-top:1px")}>{f[0]}</div>
                    </div>
                  ))}
                </div>
              </div>

              {r.overdue && (
                <div style={sx("margin-top:12px;padding:11px 13px;border-radius:9px;background:var(--color-danger-soft);color:var(--color-danger);font-size:12.5px;font-weight:600;text-wrap:pretty")}>
                  {r.ageH + " saattir tek teklif yok. Yanıtsız talep alıcıyı kaybettirir — " +
                    (cands.length ? "aşağıdan bir dükkâna elle iletin." : "bu kategoride uygun kayıt kalmadı, kapsama açığı var.")}
                </div>
              )}

              {nd.length > 0 && (
                <div style={sx("margin-top:11px;display:flex;gap:7px;flex-wrap:wrap;align-items:center")}>
                  <span style={sx("font-size:12px;color:var(--text-muted)")}>Yönlendirildi:</span>
                  {nd.map((n) => (
                    <span key={n.recordId} style={sx("display:inline-flex;align-items:center;gap:7px;height:26px;padding:0 6px 0 11px;border-radius:999px;background:var(--color-primary-soft);color:var(--color-primary-accent);font-size:12px;font-weight:600")}>
                      {recName(n.recordId)}
                      <button
                        type="button"
                        aria-label={recName(n.recordId) + " yönlendirmesini kaldır"}
                        disabled={readOnly}
                        onClick={() => {
                          if (readOnly) return say("Salt okuma rolü karar veremez");
                          AD.dropNudge(t.id, n.recordId);
                          refresh();
                          say("Yönlendirme kaldırıldı");
                        }}
                        style={sx("width:18px;height:18px;border-radius:999px;border:none;background:rgba(0,0,0,.08);color:inherit;font-family:inherit;font-size:12px;line-height:1;cursor:pointer")}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {!readOnly && cands.length > 0 && (
                <div style={sx("margin-top:12px;padding-top:12px;border-top:1px solid var(--border-default);display:flex;gap:10px;flex-wrap:wrap;align-items:center")}>
                  <span style={sx("font-size:12.5px;color:var(--text-muted)")}>Bu talebi bir dükkâna elle ilet:</span>
                  <div style={sx("width:250px;max-width:100%")}>
                    <Select
                      size="sm"
                      aria-label="Yönlendirilecek dükkân"
                      value={picked}
                      onChange={(e) => setPick((s) => ({ ...s, [t.id]: e.target.value }))}
                    >
                      <option value="">Dükkân seçin…</option>
                      {cands.map((x) => (
                        <option key={x.id} value={x.id}>
                          {(x.name || x.id) + " · %" + Math.round(x.respRate || 0) + " yanıt"}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    variant="light"
                    color="primary"
                    size="sm"
                    disabled={!picked}
                    onClick={() => {
                      if (!picked) return;
                      AD.addNudge(t.id, picked, SC.ROLES[role]?.tr || "Yönetim");
                      setPick((s) => ({ ...s, [t.id]: "" }));
                      refresh();
                      say("Talep yönlendirildi — esnaf panelinde görünecek");
                    }}
                  >
                    Yönlendir
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
