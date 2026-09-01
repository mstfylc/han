"use client";

// Panel — the physical bazaar and the work of covering it.
//
//   Kapsama       — E8: measurement has to produce an action. A coverage
//                   percentage tells you nothing; "go to this han this week"
//                   does. Ranked by units × gap, because one agreement with a
//                   han's office closes hundreds of doors and a field round
//                   closes forty.
//   Yerler        — the places themselves, and their pins
//   Saha Görevleri— a visit assigned to a person, a place and a floor range,
//                   which closes. Not a one-at-a-time "add a shop" form.

import { useMemo, useState } from "react";

import * as AD from "@/data/han-admin";
import * as SC from "@/data/han-scale";
import { Button, EmptyState, Input } from "@/ds";
import { sx } from "@/lib/sx";

import { Pill } from "./Pill";
import { CARD, H1, KICKER, ROW, SUB, num } from "./shared";

// ── Kapsama ───────────────────────────────────────────────────────────────

export function Kapsama({ readOnly, officer, onTask, say }: {
  readOnly: boolean; officer: string; onTask: () => void; say: (m: string) => void;
}) {
  const rows = useMemo(() => {
    return SC.PLACES.map((p) => {
      const st = SC.placeStats(p.id);
      const open = st?.openRecords || 0;
      const gap = Math.max(0, p.units - open);
      const pct = p.units ? Math.round((open / p.units) * 100) : 0;
      // E8 · what deserves this week: the biggest absolute gap, because that is
      // how many doors one trip can actually add. A 40%-covered arcade with 20
      // units is not the problem; a 12%-covered han with 900 is.
      return { p, open, gap, pct, score: gap };
    }).sort((a, b) => b.score - a.score);
  }, []);

  const totals = SC.SCALE_TOTALS;
  const openAll = SC.RECORDS.filter((r) => r.status === "onayli" || r.status === "aktif").length;

  return (
    <>
      <h1 style={sx(H1)}>Kapsama</h1>
      <p style={sx(SUB)}>
        Ölçüm bir eylem üretmezse rapordur, iş değildir. Sıralama “bu hafta nereye gidilecek”
        sorusuna göre kurulur: açığı en büyük yer başta. Han yönetimiyle tek bir anlaşma yüzlerce
        kapıyı açar; saha turu günde 40–60 birim ilerler.
      </p>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:14px;margin-top:18px")}>
        <div style={sx(CARD)}>
          <div style={sx(KICKER)}>Fiziki birim</div>
          <div style={sx("font-size:28px;font-weight:700;color:var(--text-heading);margin-top:5px")}>{num(totals.units)}</div>
        </div>
        <div style={sx(CARD)}>
          <div style={sx(KICKER)}>Açık kayıt</div>
          <div style={sx("font-size:28px;font-weight:700;color:var(--color-success);margin-top:5px")}>{num(openAll)}</div>
        </div>
        <div style={sx(CARD)}>
          <div style={sx(KICKER)}>Kapanmamış kapı</div>
          <div style={sx("font-size:28px;font-weight:700;color:var(--color-danger);margin-top:5px")}>{num(totals.units - openAll)}</div>
        </div>
      </div>

      <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:18px")}>
        {rows.map(({ p, open, gap, pct }) => (
          <div key={p.id} style={sx(ROW)}>
            <span style={sx("flex:1;min-width:0")}>
              <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>{p.name}</span>
              <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                {num(open)} / {num(p.units)} birim · %{pct} · {num(gap)} kapı açık değil
              </span>
              <span style={sx("display:block;height:5px;border-radius:999px;background:var(--surface-muted);margin-top:7px;overflow:hidden")}>
                <span style={sx("display:block;height:100%;width:" + pct + "%;background:var(--color-" + (pct >= 60 ? "success" : pct >= 25 ? "warning" : "danger") + ")")} />
              </span>
            </span>
            {!readOnly && (
              <Button
                variant="outline" color="primary" size="sm"
                onClick={() => {
                  AD.addTask({
                    kind: p.units > 200 ? "anlasma" : "kapsama",
                    place: p.id, officer: officer || null, target: gap,
                    note: p.name + " · " + num(gap) + " kapı",
                  });
                  onTask();
                  say("Görev açıldı: " + p.name);
                }}
              >
                {p.units > 200 ? "Yönetim görüşmesi aç" : "Kapsama turu aç"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Yerler ────────────────────────────────────────────────────────────────

export function Yerler({ readOnly, onChange, say }: {
  readOnly: boolean; onChange: () => void; say: (m: string) => void;
}) {
  const [sel, setSel] = useState<string>("");
  const place = SC.PLACES.find((p) => p.id === sel);
  const geo = sel ? AD.geoOf(sel) : null;
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [note, setNote] = useState("");

  const pick = (id: string) => {
    setSel(id);
    const g = AD.geoOf(id);
    const p = SC.PLACES.find((x) => x.id === id);
    setLat(String(g?.lat ?? p?.lat ?? ""));
    setLng(String(g?.lng ?? p?.lng ?? ""));
    setNote(g?.note || "");
  };

  return (
    <>
      <h1 style={sx(H1)}>Yerler</h1>
      <p style={sx(SUB)}>
        Yerin konumu adres omurgasının fiziksel yüzüdür. Pin yanlışsa alıcı kapıyı bulamaz —
        bu yüzden düzeltilebilir olmalı, ve panelde düzeltilen pin alıcı tarafında da geçerlidir.
      </p>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:16px;margin-top:18px;align-items:start")}>
        <div style={sx(CARD + ";max-height:60vh;overflow-y:auto")}>
          <div style={sx(KICKER)}>Yer seçin</div>
          <div style={sx("display:flex;flex-direction:column;gap:4px;margin-top:10px")}>
            {SC.PLACES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p.id)}
                style={sx("display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;border:none;font-family:inherit;font-size:13.5px;text-align:start;cursor:pointer;background:" + (sel === p.id ? "var(--color-primary-soft)" : "none") + ";color:" + (sel === p.id ? "var(--color-primary-accent)" : "var(--text-body)"))}
              >
                <span style={sx("flex:1;min-width:0")}>{p.name}</span>
                <span style={sx("flex:none;font-size:12px;color:var(--text-muted)")}>{num(p.units)}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={sx(CARD)}>
          {!place ? (
            <EmptyState icon="category" tone="neutral" title="Bir yer seçin" description="Soldaki listeden bir han, çarşı ya da cadde seçin." />
          ) : (
            <>
              <div style={sx("font-size:18px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em")}>{place.name}</div>
              <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px")}>
                {SC.PLACE_KINDS[place.kind]?.tr} · {num(place.units)} birim · {(place.floors || []).length} kat
                {geo ? " · pin düzeltilmiş" : ""}
              </div>

              <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px")}>
                <Input size="md" label="Enlem" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
                <Input size="md" label="Boylam" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
              </div>
              <div style={sx("margin-top:10px")}>
                <Input size="md" label="Not" placeholder="Giriş kapısı, koridor, tarif" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>

              <div style={sx("margin-top:14px")}>
                <Button
                  color="accent" size="md" disabled={readOnly}
                  onClick={() => {
                    const la = Number(lat), ln = Number(lng);
                    const patch: AD.GeoEntry = { note: note.trim() };
                    if (Number.isFinite(la) && la !== 0) patch.lat = la;
                    if (Number.isFinite(ln) && ln !== 0) patch.lng = ln;
                    AD.setGeo(place.id, patch);
                    AD.applyGeo(SC.PLACES as unknown as Record<string, unknown>[]);
                    onChange();
                    say("Konum kaydedildi — alıcı tarafında da geçerli");
                  }}
                >
                  Konumu kaydet
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Saha Görevleri ────────────────────────────────────────────────────────

export function Gorevler({ readOnly, officer, onChange, say }: {
  readOnly: boolean; officer: string; onChange: () => void; say: (m: string) => void;
}) {
  const tasks = AD.allTasks();
  const [kind, setKind] = useState<AD.TaskKind>("kapsama");
  const [place, setPlace] = useState("");

  const open = tasks.filter((t) => t.status === "atandi" || t.status === "yolda");
  const done = tasks.filter((t) => t.status === "tamam" || t.status === "iptal");

  return (
    <>
      <h1 style={sx(H1)}>Saha görevleri</h1>
      <p style={sx(SUB)}>
        Kapsama açığını kapatan iş bu. Tek tek “mağaza ekle” formu bir araç değildir; görev bir
        yetkiliye, bir yere ve bir kat aralığına atanır — ve kapanır.
      </p>

      {!readOnly && (
        <div style={sx("margin-top:16px;" + CARD)}>
          <div style={sx(KICKER)}>Yeni görev</div>
          <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:10px;margin-top:12px")}>
            <select
              value={kind} onChange={(e) => setKind(e.target.value as AD.TaskKind)} aria-label="Görev türü"
              style={sx("height:40px;padding:0 10px;border-radius:9px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:14px;color:var(--text-body)")}
            >
              {(Object.keys(AD.TASK_KINDS) as AD.TaskKind[]).map((k) => (
                <option key={k} value={k}>{AD.TASK_KINDS[k].tr}</option>
              ))}
            </select>
            <select
              value={place} onChange={(e) => setPlace(e.target.value)} aria-label="Yer"
              style={sx("height:40px;padding:0 10px;border-radius:9px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:14px;color:var(--text-body)")}
            >
              <option value="">Yer seçin</option>
              {SC.PLACES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Button
              color="accent" size="md" disabled={!place}
              onClick={() => {
                const p = SC.PLACES.find((x) => x.id === place);
                const st = place ? SC.placeStats(place) : null;
                AD.addTask({
                  kind, place, officer: officer || null,
                  target: Math.max(0, (p?.units || 0) - (st?.openRecords || 0)),
                  note: p?.name || "",
                });
                onChange();
                say("Görev açıldı");
              }}
            >
              Görevi aç
            </Button>
          </div>
          <p style={sx("font-size:12.5px;color:var(--text-muted);margin-top:9px")}>{AD.TASK_KINDS[kind].note}</p>
        </div>
      )}

      <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:18px")}>
        {open.map((t) => {
          const p = SC.PLACES.find((x) => x.id === t.place);
          const meta = AD.TASK_STATES[t.status];
          return (
            <div key={t.id} style={sx(ROW)}>
              <span style={sx("flex:1;min-width:0")}>
                <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>
                  {AD.TASK_KINDS[t.kind].tr} — {p?.name || t.place || "—"}
                </span>
                <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                  {t.note || meta.note}
                  {t.target ? " · hedef " + num(t.target) : ""}
                  {t.officer ? " · " + (SC.OFFICERS[t.officer]?.name || t.officer) : " · yetkili atanmadı"}
                </span>
              </span>
              <Pill label={meta.tr} t={meta.tone} />
              {!readOnly && (
                <span style={sx("flex:none;display:flex;gap:6px")}>
                  {t.status === "atandi" && (
                    <Button variant="outline" color="primary" size="sm"
                      onClick={() => { AD.setTask(t.id, { status: "yolda" }); onChange(); say("Tur başladı"); }}>
                      Tura çık
                    </Button>
                  )}
                  <Button variant="outline" color="primary" size="sm"
                    onClick={() => { AD.setTask(t.id, { status: "tamam" }); onChange(); say("Görev kapandı"); }}>
                    Kapat
                  </Button>
                  <Button variant="ghost" color="danger" size="sm"
                    onClick={() => { AD.setTask(t.id, { status: "iptal" }); onChange(); say("Görev iptal edildi"); }}>
                    İptal
                  </Button>
                </span>
              )}
            </div>
          );
        })}

        {open.length === 0 && (
          <EmptyState icon="rocket" tone="neutral" title="Açık görev yok" description="Kapsama ya da Veri Kalitesi sekmesinden görev açabilirsiniz." />
        )}
      </div>

      {done.length > 0 && (
        <div style={sx("margin-top:22px")}>
          <div style={sx(KICKER)}>Kapanmış görevler</div>
          <div style={sx("display:flex;flex-direction:column;gap:6px;margin-top:10px")}>
            {done.slice(-10).reverse().map((t) => (
              <div key={t.id} style={sx("font-size:13px;color:var(--text-muted);padding:8px 11px;border-radius:9px;background:var(--surface-muted)")}>
                {AD.TASK_KINDS[t.kind].tr} — {SC.PLACES.find((x) => x.id === t.place)?.name || "—"} · {AD.TASK_STATES[t.status].tr}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
