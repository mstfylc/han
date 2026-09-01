"use client";

// Yorum Denetimi — yayındaki yorumlar ve gizlenenler, gerekçesiyle. (ADMIN-PLANI 7)
//
// Yorum hakkı zaten kapıda kısıtlı: yalnız o dükkânın teklifini kabul etmiş
// alıcı yazabilir — sahte yorum girişte engellenir. Buradaki iş sahtecilik
// avı değil, kuralsızlığı ayıklamak: hakaret · kişisel veri · reklam · ilgisiz
// (AD.REVIEW_REASONS). Gizlenen yorum silinmez, gerekçesiyle saklanır, alıcı
// tarafında da görünmez olur ve geri açılabilir (AD.restoreReview).
//
// Moderasyon anahtarı yorumun kalıcı kimliğidir (rv…) — AD.reviewKey. `at`
// yalnız eski kayıtlar için yedektir: aynı milisaniyede yazılan iki yorum
// aynı anahtarı paylaşıyor ve birini gizlemek ikisini gizliyordu.

import { useState } from "react";

import * as AD from "@/data/han-admin";
import * as OF from "@/data/han-offers";
import * as SC from "@/data/han-scale";
import type { Review } from "@/data/types";
import { Alert, Badge, Button, Select } from "@/ds";
import { sx } from "@/lib/sx";

import { H1, SUB, type PanelTabProps } from "./shared";

type RvFilter = "all" | "yayinda" | "gizli";

const card = (tone?: string | null) =>
  "background:var(--surface-card);border:1px solid var(--border-" +
  (tone ? "strong" : "default") + ");border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:18px 20px" +
  (tone ? ";border-left:3px solid var(--color-" + tone + ")" : "");

const fmt = (ts?: number) => (ts ? new Date(ts).toLocaleDateString("tr-TR") : "");

export default function Yorumlar(props: PanelTabProps) {
  const { readOnly, refresh, say } = props;

  const [filter, setFilter] = useState<RvFilter>("all");
  const [pick, setPick] = useState<Record<string, string>>({});

  const all = OF.allReviews();
  const items: { recId: string; rv: Review; key: string; hidden: boolean; st: AD.ReviewState | null }[] = [];
  Object.keys(all).forEach((recId) => {
    (all[recId] || []).forEach((rv) => {
      const st = AD.reviewState(recId, rv);
      items.push({ recId, rv, key: AD.reviewKey(recId, rv), hidden: !!(st && st.hidden), st });
    });
  });
  items.sort((a, b) => (b.rv.at || 0) - (a.rv.at || 0));
  const shown = items.filter((i) => !i.hidden).length;
  const rows = items.filter((i) => (filter === "all" ? true : filter === "gizli" ? i.hidden : !i.hidden));
  const RR = AD.REVIEW_REASONS;

  const filters: { value: RvFilter; label: string }[] = [
    { value: "all", label: "Tümü · " + items.length },
    { value: "yayinda", label: "Yayında · " + shown },
    { value: "gizli", label: "Gizli · " + (items.length - shown) },
  ];

  return (
    <>
      <h1 style={sx(H1)}>Yorum Denetimi</h1>
      <p style={sx(SUB)}>Yayındaki yorumlar ve gizlenenler — gerekçesiyle.</p>

      <div style={sx("margin-top:16px")}>
        <Alert color="info" variant="light" title="Yorum hakkı zaten kısıtlı">
          Yorum yalnız bu dükkânın teklifini kabul etmiş alıcı tarafından yazılabilir — sahte yorum
          kapıda engellenir. Buradaki iş kuralsızlığı ayıklamak: hakaret, kişisel veri, reklam.
        </Alert>
      </div>

      <div style={sx("margin-top:16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;padding:15px 20px")}>
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
        <div style={sx("margin-left:auto;font-size:13px;color:var(--text-muted)")}>{rows.length} yorum</div>
      </div>

      {rows.length === 0 && (
        <div style={sx("margin-top:16px;background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;padding:34px 22px;text-align:center")}>
          <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>
            {items.length ? "Bu filtrede yorum yok" : "Henüz yorum yok"}
          </div>
          <div style={sx("font-size:13px;color:var(--text-muted);margin-top:5px;max-width:62ch;margin-left:auto;margin-right:auto;text-wrap:pretty")}>
            {items.length
              ? "Diğer filtreye bakın."
              : "Yorum yazabilmek için alıcının o dükkânın teklifini kabul etmiş olması gerekir. İlk anlaşmalar kapandıkça yorumlar buraya düşer."}
          </div>
        </div>
      )}

      <div style={sx("margin-top:16px;display:flex;flex-direction:column;gap:12px")}>
        {rows.map((i) => {
          const rec = SC.RECORDS.find((r) => r.id === i.recId);
          const picked = pick[i.key] || "hakaret";
          return (
            <div key={i.key} style={sx(card(i.hidden ? "danger" : null))}>
              <div style={sx("display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap")}>
                <div style={sx("flex:1;min-width:220px")}>
                  <div style={sx("display:flex;align-items:center;gap:9px;flex-wrap:wrap")}>
                    <span style={sx("font-size:14px;font-weight:600;line-height:1.35;color:var(--text-heading)")}>{rec?.name || i.recId}</span>
                    <span style={sx("font-size:13px;font-weight:700;color:var(--color-warning)")}>{"★".repeat(i.rv.stars || 5)}</span>
                    <span style={sx("font-size:12px;color:var(--text-muted)")}>{fmt(i.rv.at)}</span>
                    {i.hidden && <Badge color="danger" variant="light">Gizlendi</Badge>}
                  </div>
                  <div style={sx("font-size:13.5px;color:var(--text-body);margin-top:7px;text-wrap:pretty" + (i.hidden ? ";opacity:.55;text-decoration:line-through" : ""))}>
                    {i.rv.text}
                  </div>
                  <div style={sx("font-size:12px;color:var(--text-muted);margin-top:6px")}>
                    {i.rv.by ? "Yazan: " + i.rv.by : "Yazan: alıcı"}
                  </div>
                </div>

                {!readOnly && (
                  <div style={sx("display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start")}>
                    {i.hidden ? (
                      <Button
                        variant="light"
                        color="success"
                        size="sm"
                        onClick={() => { AD.restoreReview(i.recId, i.rv); refresh(); say("Yorum geri açıldı"); }}
                      >
                        Geri aç
                      </Button>
                    ) : (
                      <>
                        <div style={sx("width:186px;max-width:100%")}>
                          <Select
                            size="sm"
                            aria-label="Gizleme gerekçesi"
                            value={picked}
                            onChange={(e) => setPick((s) => ({ ...s, [i.key]: e.target.value }))}
                          >
                            {(Object.keys(RR) as AD.ReviewReason[]).map((k) => (
                              <option key={k} value={k}>{RR[k].tr}</option>
                            ))}
                          </Select>
                        </div>
                        <Button
                          variant="ghost"
                          color="danger"
                          size="sm"
                          onClick={() => { AD.hideReview(i.recId, i.rv, picked); refresh(); say("Yorum gizlendi — gerekçesiyle saklandı"); }}
                        >
                          Gizle
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {i.hidden && (
                <div style={sx("margin-top:10px;font-size:12px;color:var(--text-muted)")}>
                  {"Gizlenme gerekçesi: " + (RR[i.st?.reason as AD.ReviewReason]?.tr || i.st?.reason || "—") + " · " + fmt(i.st?.at)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
