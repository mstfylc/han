"use client";

// Veri Kalitesi — ADMIN-PLANI Faz 3 · madde 11.
//
// "Kataloğu boş: 421" bir sayıydı, LİSTESİ yoktu — kime gidileceği belli
// değildi. Altı kural, her biri sayı değil bir İŞ LİSTESİ: fiyat bandı yok ·
// telefon yok · fotoğraf yok · tazeliği düşmüş · çeşit grubu yok · mükerrer.
// Her liste tek tıkla saha görevine dönüşür: en çok eksiği olan yer seçilir,
// görev formu ön dolu açılır ("Fiyat bandı yok · N kayıt eksik") — AD.addTask.
//
// "HAN Panel.dc.html" isKalite bölümü + qualityVals()'ın portu. Prototip
// formu Saha Görevleri sekmesine geçerek açıyordu; portta sekmeler ayrı
// bileşenler olduğundan aynı form (gorevler.tsx'ten) burada açılır — kaydeden
// yine AD.addTask, görev Saha Görevleri listesine düşer.

import { useState } from "react";

import * as AD from "@/data/han-admin";
import * as SC from "@/data/han-scale";
import type { ShopRecord } from "@/data/types";
import { Button } from "@/ds";
import { sx } from "@/lib/sx";

import { DEFAULT_OFFICER, TaskFormDrawer, type TaskFormInit } from "./gorevler";
import { CARD, H1, num, Pill, SUB, type PanelTabProps } from "./shared";

/** Prototipteki scopeFilter'ın buradaki karşılığı: saha yetkilisi yalnız
 *  kendi yerlerinin kayıtlarını görür. (Han yönetimi rolünün "place" kapsamı
 *  bu sekmeye zaten erişemez.) */
function scopedRecords(role: string): ShopRecord[] {
  const pool = SC.RECORDS.slice();
  if ((SC.ROLES[role] || {}).scope !== "officer") return pool;
  const mine = SC.PLACES
    .filter((p) => SC.recordsOfPlace(p.id).some((r) => r.officer === DEFAULT_OFFICER))
    .map((p) => p.id);
  return pool.filter((r) => mine.includes(r.place));
}

export default function Kalite({ role, readOnly, refresh, say }: PanelTabProps) {
  const [picked, setPicked] = useState<AD.QualityRule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formInit, setFormInit] = useState<TaskFormInit | undefined>(undefined);

  const RU = AD.QUALITY_RULES;
  const rules = Object.keys(RU) as AD.QualityRule[];
  const pool = scopedRecords(role);
  const lists = AD.qualityLists(pool, Number(SC.SETTINGS.freshDays.value) || 90);
  const pick: AD.QualityRule = picked || rules.find((k) => lists[k].length) || "fiyatsiz";
  const rows = lists[pick] || [];

  const assign = () => {
    if (readOnly) return say("Salt okuma rolü görev atayamaz");
    // İş listesi doğrudan saha görevine dönüşür: en çok eksiği olan yer seçilir.
    const byPlace: Record<string, number> = {};
    rows.forEach((r) => { byPlace[r.place] = (byPlace[r.place] || 0) + 1; });
    const top = Object.keys(byPlace).sort((a, b) => byPlace[b] - byPlace[a])[0];
    setFormInit({
      kind: "icerik",
      officer: DEFAULT_OFFICER,
      place: top || "",
      floors: "",
      target: String(byPlace[top] || rows.length),
      note: RU[pick].tr + " · " + (byPlace[top] || rows.length) + " kayıt eksik",
    });
    setFormOpen(true);
  };

  const statusTone = (s: string) =>
    s === "aktif" ? "success" : s === "onayli" ? "primary" : s === "askida" ? "danger" : "warning";

  return (
    <>
      <h1 style={sx(H1)}>Veri Kalitesi</h1>
      <p style={sx(SUB)}>
        Eksik kayıtların sayısı değil listesi: kime gidilecek, ne toplanacak.
      </p>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr));gap:14px;margin-top:18px")}>
        {rules.map((k) => {
          const on = k === pick;
          const n = lists[k].length;
          const t = n ? RU[k].tone : "success";
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => setPicked(k)}
              style={sx("text-align:left;cursor:pointer;font-family:inherit;padding:16px 18px;border-radius:12px;background:var(--surface-card);border:1px solid " +
                (on ? "var(--color-primary);box-shadow:0 0 0 3px var(--color-primary-soft)" : "var(--border-default)"))}
            >
              <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px")}>
                <span style={sx("font-size:13px;font-weight:600;color:var(--text-heading)")}>{RU[k].tr}</span>
                <span style={sx("display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:6px;font-size:12px;font-weight:700;background:var(--color-" + t + "-soft);color:var(--color-" + t + ")")}>
                  {num(n)}
                </span>
              </div>
              <div style={sx("font-size:12px;color:var(--text-muted);margin-top:6px;text-align:left;text-wrap:pretty")}>{RU[k].note}</div>
            </button>
          );
        })}
      </div>

      <div style={sx("margin-top:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;" + CARD + ";padding:15px 20px")}>
        <div>
          <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>
            {RU[pick].tr + " · " + num(rows.length) + " kayıt"}
          </div>
          <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:2px")}>{RU[pick].note}</div>
        </div>
        {rows.length > 0 && (
          <span style={sx("margin-left:auto")}>
            <Button variant="light" color="primary" size="sm" disabled={readOnly} onClick={assign}>
              Bu listeyi sahaya ata
            </Button>
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div style={sx("margin-top:16px;text-align:center;" + CARD + ";padding:34px 22px")}>
          <div style={sx("font-size:14px;font-weight:600;color:var(--color-success)")}>Bu kuralda eksik kayıt yok</div>
          <div style={sx("font-size:13px;color:var(--text-muted);margin-top:5px;text-wrap:pretty")}>
            Kapsamanın bu boyutu temiz — başka bir kurala bakın.
          </div>
        </div>
      ) : (
        <>
          <div style={sx("margin-top:16px;background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;overflow-x:auto")}>
            {rows.slice(0, 50).map((r) => (
              <div key={r.id} style={sx("min-width:620px;display:flex;align-items:center;gap:14px;padding:13px 20px;border-bottom:1px solid var(--border-default)")}>
                <div style={sx("flex:1;min-width:180px")}>
                  <div style={sx("font-size:13.5px;font-weight:600;line-height:1.35;color:var(--text-heading)")}>{r.name || "(adsız kayıt)"}</div>
                  <div style={sx("font-size:12px;line-height:1.5;color:var(--text-muted);margin-top:2px")}>
                    {[SC.PLACES.find((p) => p.id === r.place)?.name,
                      r.floor === 0 ? "Zemin" : "Kat " + r.floor,
                      r.door ? "No " + r.door : ""].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div style={sx("width:150px;font-size:12.5px;color:var(--text-muted)")}>
                  {SC.OFFICERS[r.officer]?.name || "Atanmamış"}
                </div>
                <Pill label={SC.STATUS[r.status]?.tr || r.status} t={statusTone(r.status)} />
                <div style={sx("width:96px;font-size:12px;color:var(--text-muted);text-align:right")}>{(r.updatedDays || 0) + " gün"}</div>
              </div>
            ))}
          </div>
          {rows.length > 50 && (
            <div style={sx("padding:13px 20px;font-size:12.5px;color:var(--text-muted);text-align:center")}>
              {"İlk 50 gösteriliyor · toplam " + num(rows.length) + " kayıt"}
            </div>
          )}
        </>
      )}

      <TaskFormDrawer
        open={formOpen}
        initial={formInit}
        onClose={() => setFormOpen(false)}
        onSaved={(task) => {
          setFormOpen(false);
          refresh();
          say("Saha görevi atandı · " + (SC.PLACES.find((p) => p.id === task.place)?.name || "") + " — Saha Görevleri sekmesinde");
        }}
      />
    </>
  );
}
