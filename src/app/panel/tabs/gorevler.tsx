"use client";

// Saha Görevleri — ADMIN-PLANI Faz 3 · madde 10.
//
// Kapsama tek tek dükkânla değil KAT KAT TURLA kapanır. Görev bir yetkiliye,
// bir yere ve bir kat aralığına atılır; dört tür (kapsama turu · doğrulama ·
// içerik toplama · han yönetimi görüşmesi), dört durum (atandı → turda →
// kapandı / iptal). Hedef uydurulmaz: o yerdeki KAYITSIZ birim sayısı
// önerilir. Turda açılan kayıt sayısı girilir, ilerleme ondan hesaplanır.
// Saha yetkilisi yalnız kendi görevlerini görür.
//
// "HAN Panel.dc.html" isGorevler bölümü + taskVals()'ın portu; görsel dil
// shared.tsx'ten gelir. Görev formu (Drawer) dışarı da açılır: Veri Kalitesi
// sekmesi bir iş listesini ön dolu formla saha görevine çevirir.

import { useState } from "react";

import * as AD from "@/data/han-admin";
import * as SC from "@/data/han-scale";
import { Button, Drawer, EmptyState, Input, Select, Textarea } from "@/ds";
import { sx } from "@/lib/sx";

import { CARD, num, H1, Pill, SUB, type PanelTabProps } from "./shared";

/**
 * Prototipte kabuk bir "myOfficer" seçimi taşır (varsayılanı of-ayse); porttaki
 * kabuk bu seçimi henüz taşımadığı için aynı varsayılan buradan okunur. Saha
 * yetkilisi rolü (scope: "officer") listeyi bu yetkiliye süzer.
 */
export const DEFAULT_OFFICER = "of-ayse";

const toneCard = (t: string | null) =>
  CARD + (t ? ";border-left:3px solid var(--color-" + t + ")" : "");

/** Prototipin Progress bileşeni — DS portunda olmadığı için satır içi çizilir. */
function ProgressBar({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={sx("height:8px;border-radius:999px;background:var(--surface-muted);overflow:hidden")}>
      <div style={sx("height:100%;border-radius:999px;background:var(--color-" + color + ");width:" + pct + "%")} />
    </div>
  );
}

/** "1-3" → [1, 2, 3] · "0, 2" → [0, 2] · boş → null (tüm katlar).
 *  Prototip kat aralığını serbest metin sakladı; portta FieldTask.floors
 *  sayı dizisi olduğu için metin burada çözülür. */
export function parseFloors(s: string): number[] | null {
  const nums = String(s || "").match(/\d+/g);
  if (!nums || !nums.length) return null;
  if (/[-–]/.test(s) && nums.length >= 2) {
    const a = Number(nums[0]), b = Number(nums[1]);
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const out: number[] = [];
    for (let i = lo; i <= hi; i += 1) out.push(i);
    return out;
  }
  return nums.map(Number);
}

/** [1, 2, 3] → "Kat 1-3" · [0, 2] → "Kat 0, 2" · null → "Tüm katlar". */
export function floorsLabel(f: number[] | string | null | undefined): string {
  if (f == null || (Array.isArray(f) && !f.length)) return "Tüm katlar";
  if (!Array.isArray(f)) return "Kat " + f; // prototip döneminden kalan metin veri
  if (f.length === 1) return "Kat " + f[0];
  const s = f.slice().sort((a, b) => a - b);
  const consecutive = s.every((v, i) => i === 0 || v === s[i - 1] + 1);
  return "Kat " + (consecutive ? s[0] + "-" + s[s.length - 1] : s.join(", "));
}

// ── Görev Ata formu ───────────────────────────────────────────────────────

export interface TaskFormInit {
  kind?: AD.TaskKind;
  officer?: string;
  place?: string;
  floors?: string;
  target?: string;
  note?: string;
}

interface TaskFormState {
  kind: AD.TaskKind;
  officer: string;
  place: string;
  floors: string;
  target: string;
  note: string;
}

const EMPTY_FORM: TaskFormState = { kind: "kapsama", officer: "", place: "", floors: "", target: "", note: "" };

/**
 * "Görev Ata" çekmecesi. Veri Kalitesi sekmesi de bunu kullanır: iş listesi
 * tek tıkla göreve dönüşürken form ön dolu açılır ("Fiyat bandı yok · N kayıt
 * eksik"). Kaydeden AD.addTask'tır; refresh() + say() çağıran sekmede kalır.
 */
export function TaskFormDrawer({
  open, onClose, initial, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: TaskFormInit;
  onSaved: (task: AD.FieldTask) => void;
}) {
  // Kapalıyken gövde hiç kurulmaz: her açılış temiz bir formla (ön dolumla)
  // başlar, eski taslak birikmez — effect içinde setState'e gerek kalmaz.
  if (!open) return null;
  return <TaskFormBody onClose={onClose} initial={initial} onSaved={onSaved} />;
}

function TaskFormBody({
  onClose, initial, onSaved,
}: {
  onClose: () => void;
  initial?: TaskFormInit;
  onSaved: (task: AD.FieldTask) => void;
}) {
  const [f, setF] = useState<TaskFormState>(() => ({ ...EMPTY_FORM, ...initial }));
  const [err, setErr] = useState("");

  // Kapsama açığı en büyük yer önce: hedefin nereden geldiği listede yazar.
  const places = SC.PLACES.slice().sort((a, b) => {
    const ga = a.units - (SC.placeStats(a.id)?.openRecords || 0);
    const gb = b.units - (SC.placeStats(b.id)?.openRecords || 0);
    return gb - ga;
  }).slice(0, 40);

  const selPlace = SC.PLACES.find((p) => p.id === f.place) || null;
  const selStats = selPlace ? SC.placeStats(selPlace.id) : null;

  const save = () => {
    if (!f.officer) return setErr("Yetkili seçin");
    const pl = SC.PLACES.find((p) => p.id === f.place) || places[0];
    const st = SC.placeStats(pl.id);
    onSaved(AD.addTask({
      kind: f.kind,
      officer: f.officer,
      place: pl.id,
      floors: parseFloors(f.floors),
      note: f.note.trim(),
      // Hedef uydurulmaz: boş bırakılırsa o yerdeki kayıtsız birim sayısı yazılır.
      target: Number(f.target.replace(/\D/g, "")) || Math.max(10, pl.units - (st?.openRecords || 0)),
      status: "atandi",
    }));
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Görev Ata"
      subtitle="Kapsama tek tek dükkânla değil, kat kat turla kapanır"
      footer={
        <div style={sx("display:flex;gap:10px;justify-content:flex-end")}>
          <Button variant="ghost" color="dark" onClick={onClose}>Vazgeç</Button>
          <Button color="primary" onClick={save}>Görevi ata</Button>
        </div>
      }
    >
      <div style={sx("display:flex;flex-direction:column;gap:16px")}>
        <Select label="Görev türü" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as AD.TaskKind })}>
          {(Object.keys(AD.TASK_KINDS) as AD.TaskKind[]).map((k) => (
            <option key={k} value={k}>{AD.TASK_KINDS[k].tr + " · " + AD.TASK_KINDS[k].note}</option>
          ))}
        </Select>

        <Select
          label="Yetkili"
          value={f.officer}
          error={err || undefined}
          onChange={(e) => { setF({ ...f, officer: e.target.value }); setErr(""); }}
        >
          <option value="">Yetkili seçin…</option>
          {Object.keys(SC.OFFICERS).map((k) => (
            <option key={k} value={k}>{SC.OFFICERS[k].name + " · " + SC.OFFICERS[k].tr}</option>
          ))}
        </Select>

        <Select
          label="Yer"
          hint={selPlace ? "En açık yerler üstte sıralı" : "Kapsama açığı en büyük yer önce"}
          value={f.place}
          onChange={(e) => setF({ ...f, place: e.target.value })}
        >
          {places.map((p) => {
            const st = SC.placeStats(p.id);
            return (
              <option key={p.id} value={p.id}>
                {p.name + " · " + (p.units - (st?.openRecords || 0)) + " kayıtsız birim"}
              </option>
            );
          })}
        </Select>

        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(148px,100%),1fr));gap:12px")}>
          <Input
            label="Kat aralığı"
            placeholder="1-3"
            hint="Boş = tüm katlar"
            value={f.floors}
            onChange={(e) => setF({ ...f, floors: e.target.value })}
          />
          <Input
            label="Hedef kayıt"
            placeholder="40"
            hint={selPlace && selStats ? (selPlace.units - selStats.openRecords) + " kayıtsız birim var" : "Boş = tüm açık birimler"}
            value={f.target}
            onChange={(e) => setF({ ...f, target: e.target.value })}
          />
        </div>

        <Textarea
          label="Not"
          rows={3}
          placeholder="Han yönetimiyle randevu 10:00 · giriş Mahmutpaşa kapısı"
          value={f.note}
          onChange={(e) => setF({ ...f, note: e.target.value })}
        />
      </div>
    </Drawer>
  );
}

// ── Sekme ─────────────────────────────────────────────────────────────────

type TaskFilter = "acik" | "tamam" | "all";

export default function Gorevler({ role, readOnly, refresh, say }: PanelTabProps) {
  const [filter, setFilter] = useState<TaskFilter>("acik");
  const [formOpen, setFormOpen] = useState(false);

  const ST = AD.TASK_STATES;
  const KD = AD.TASK_KINDS;

  let tasks = AD.allTasks();
  // Saha yetkilisi kendi görevlerini görür — başkasının turu onun listesini kirletmez.
  const scope = (SC.ROLES[role] || {}).scope;
  if (scope === "officer") tasks = tasks.filter((t) => t.officer === DEFAULT_OFFICER);
  tasks = tasks.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const openTasks = tasks.filter((t) => t.status === "atandi" || t.status === "yolda");
  const rows = tasks.filter((t) =>
    filter === "all" ? true
      : filter === "acik" ? (t.status === "atandi" || t.status === "yolda")
      : t.status === filter);
  const closedTargets = tasks.filter((t) => t.status === "tamam").reduce((a, t) => a + (t.done || 0), 0);
  const gap = SC.SCALE_TOTALS.units - SC.RECORDS.length;

  const placeName = (id: string | null) => SC.PLACES.find((p) => p.id === id)?.name || "—";
  const offName = (id: string | null) => SC.OFFICERS[id || ""]?.name || "Atanmamış";

  const setStatus = (t: AD.FieldTask, status: AD.TaskStatus, msg: string) => {
    if (readOnly) return say("Salt okuma rolü görev değiştiremez");
    AD.setTask(t.id, { status });
    refresh();
    say(msg);
  };

  const stats = [
    { label: "Açık görev", value: String(openTasks.length), note: "atandı veya turda", color: "var(--color-" + (openTasks.length ? "primary" : "secondary") + ")" },
    { label: "Turda", value: String(tasks.filter((t) => t.status === "yolda").length), note: "şu an sahada", color: "var(--color-warning)" },
    { label: "Turlarda açılan kayıt", value: num(closedTargets), note: "kapanan görevlerden", color: "var(--color-success)" },
    { label: "Kapsama açığı", value: num(gap), note: "kayıtsız birim", color: "var(--text-heading)" },
  ];

  const filters: { value: TaskFilter; label: string }[] = [
    { value: "acik", label: "Açık · " + openTasks.length },
    { value: "tamam", label: "Kapanan · " + tasks.filter((t) => t.status === "tamam").length },
    { value: "all", label: "Tümü · " + tasks.length },
  ];

  return (
    <>
      <h1 style={sx(H1)}>Saha Görevleri</h1>
      <p style={sx(SUB)}>
        Kapsama tek tek dükkânla değil kat kat turla kapanır — görev bir yetkiliye ve bir yere atılır.
      </p>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:16px;margin-top:18px")}>
        {stats.map((s) => (
          <div key={s.label} style={sx(CARD)}>
            <div style={sx("font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:10px")}>{s.label}</div>
            <div style={sx("font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;color:" + s.color)}>{s.value}</div>
            <div style={sx("font-size:12px;color:var(--text-muted);margin-top:4px")}>{s.note}</div>
          </div>
        ))}
      </div>

      <div style={sx("margin-top:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;" + CARD + ";padding:15px 20px")}>
        <div style={sx("display:inline-flex;gap:4px;padding:3px;border-radius:9px;background:var(--surface-muted)")} role="group" aria-label="Görev filtresi">
          {filters.map((o) => {
            const on = filter === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(o.value)}
                style={sx("height:30px;padding:0 12px;border:none;border-radius:7px;font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;" +
                  (on ? "background:var(--surface-card);box-shadow:0 1px 2px rgba(0,0,0,.08);color:var(--text-heading)" : "background:transparent;color:var(--text-muted)"))}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <span style={sx("margin-left:auto")}>
          <Button color="accent" size="sm" iconStart="plus-squared" disabled={readOnly} onClick={() => setFormOpen(true)}>
            Görev Ata
          </Button>
        </span>
      </div>

      {rows.length === 0 && (
        <div style={sx("margin-top:16px")}>
          <EmptyState
            icon="rocket"
            tone="neutral"
            title={tasks.length ? "Bu filtrede görev yok" : "Henüz saha görevi yok"}
            description={tasks.length
              ? "Diğer filtreye bakın."
              : "14.716 birimin " + num(gap) + " tanesinde kayıt yok. Görev bir yetkiliye, bir yere ve bir kat aralığına atanır; kapanışta kaç kayıt açıldığı yazılır."}
          />
        </div>
      )}

      <div style={sx("display:flex;flex-direction:column;gap:12px;margin-top:16px")}>
        {rows.map((t) => {
          const pct = t.target ? Math.min(100, Math.round(((t.done || 0) / t.target) * 100)) : 0;
          const pctColor = pct >= 80 ? "success" : pct >= 30 ? "primary" : "warning";
          const cardTone = t.status === "tamam" ? "success" : t.status === "yolda" ? "primary" : t.status === "iptal" ? null : "warning";
          const canAct = !readOnly && t.status !== "tamam" && t.status !== "iptal";
          return (
            <div key={t.id} style={sx(toneCard(cardTone))}>
              <div style={sx("display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap")}>
                <div style={sx("flex:1;min-width:220px")}>
                  <div style={sx("display:flex;align-items:center;gap:9px;flex-wrap:wrap")}>
                    <span style={sx("font-size:14.5px;font-weight:600;line-height:1.35;color:var(--text-heading)")}>
                      {(KD[t.kind]?.tr || t.kind) + " · " + placeName(t.place)}
                    </span>
                    <Pill label={ST[t.status]?.tr || t.status} t={ST[t.status]?.tone || "secondary"} />
                  </div>
                  <div style={sx("font-size:12.5px;line-height:1.5;color:var(--text-muted);margin-top:4px")}>
                    {[offName(t.officer), floorsLabel(t.floors), new Date(t.createdAt).toLocaleDateString("tr-TR")].join(" · ")}
                  </div>
                  {!!t.note && (
                    <div style={sx("font-size:13px;color:var(--text-body);margin-top:7px;text-wrap:pretty")}>{t.note}</div>
                  )}
                </div>
                <div style={sx("min-width:160px")}>
                  <div style={sx("display:flex;align-items:center;justify-content:space-between;margin-bottom:5px")}>
                    <span style={sx("font-size:11px;color:var(--text-muted)")}>İlerleme</span>
                    <span style={sx("font-size:12px;font-weight:600;color:var(--text-heading)")}>{(t.done || 0) + " / " + t.target}</span>
                  </div>
                  <ProgressBar value={pct} color={pctColor} />
                </div>
              </div>

              {canAct && (
                <div style={sx("margin-top:13px;padding-top:13px;border-top:1px solid var(--border-default);display:flex;gap:8px;flex-wrap:wrap;align-items:center")}>
                  {t.status === "atandi" && (
                    <Button variant="light" color="primary" size="sm" onClick={() => setStatus(t, "yolda", "Tur başladı")}>
                      Tura başla
                    </Button>
                  )}
                  {t.status === "yolda" && (
                    <Button variant="light" color="success" size="sm" onClick={() => setStatus(t, "tamam", "Tur kapandı · " + (t.done || 0) + " kayıt açıldı")}>
                      Turu kapat
                    </Button>
                  )}
                  <Button variant="ghost" color="dark" size="sm" onClick={() => setStatus(t, "iptal", "Görev iptal edildi")}>
                    İptal
                  </Button>
                  {t.status === "yolda" && (
                    <span style={sx("display:flex;align-items:center;gap:7px;margin-left:auto")}>
                      <span style={sx("font-size:12.5px;color:var(--text-muted)")}>Bugün açılan kayıt:</span>
                      <span style={sx("display:inline-block;width:82px")}>
                        <Input
                          size="sm"
                          aria-label="Bugün açılan kayıt"
                          value={String(t.done || 0)}
                          onChange={(e) => {
                            AD.setTask(t.id, { done: Number(String(e.target.value).replace(/\D/g, "")) || 0 });
                            refresh();
                          }}
                        />
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <TaskFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(task) => {
          setFormOpen(false);
          refresh();
          say("Görev atandı · " + placeName(task.place));
        }}
      />
    </>
  );
}
