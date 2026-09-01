"use client";

// Panel — the records themselves, and the work lists that come out of them.
//
//   Mağaza Kayıtları    — find any record, see what it is missing
//   Veri Kalitesi       — "empty catalogue: 421" was a number with no list
//                         behind it, so nobody could tell who to go and see.
//                         Every rule here produces a list, and a list becomes
//                         a field visit.
//   Toplu İçe Aktarma   — a han's tenant list cannot be typed in 142 times

import { useMemo, useState } from "react";

import * as AD from "@/data/han-admin";
import * as SC from "@/data/han-scale";
import type { ShopRecord } from "@/data/types";
import { Button, EmptyState, Input, Textarea } from "@/ds";
import { sx } from "@/lib/sx";

import { Pill } from "./Pill";
import { CARD, H1, HOLLOW, KICKER, ROW, SUB, num } from "./shared";

const whereOf = (r: ShopRecord) => {
  const p = SC.PLACES.find((x) => x.id === r.place);
  return (p?.name || r.place) + " · " + (r.floor === 0 ? "Zemin" : r.floor + ". kat") + " · No " + r.door;
};

const STATUS_TONE: Record<string, string> = {
  beyan: "warning", onayli: "primary", aktif: "success", askida: "danger",
};

// ── Mağaza Kayıtları ──────────────────────────────────────────────────────

export function Kayitlar() {
  const [q, setQ] = useState("");
  const [place, setPlace] = useState("all");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    const nq = q.trim().toLocaleLowerCase("tr");
    // Capped deliberately: 1,385 rows in one list is not a browser, it is a
    // scroll. Narrowing is the tool.
    return SC.RECORDS.filter((r) => {
      if (place !== "all" && r.place !== place) return false;
      if (status !== "all" && r.status !== status) return false;
      if (nq && !String(r.name || "").toLocaleLowerCase("tr").includes(nq) && String(r.door) !== nq) return false;
      return true;
    }).slice(0, 80);
  }, [q, place, status]);

  const total = useMemo(() => {
    return SC.RECORDS.filter((r) => {
      if (place !== "all" && r.place !== place) return false;
      if (status !== "all" && r.status !== status) return false;
      return true;
    }).length;
  }, [place, status]);

  return (
    <>
      <h1 style={sx(H1)}>Mağaza kayıtları</h1>
      <p style={sx(SUB)}>
        Omurgadaki her kayıt. Durum, kaydın kendi hâli değil bir karardır: beyan bir iddia,
        onaylı bir doğrulama, aktif ise kataloğu güncel tutulan kayıt.
      </p>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:10px;margin-top:16px")}>
        <Input size="md" placeholder="Ad ya da kapı no" aria-label="Ad ya da kapı no" value={q} onChange={(e) => setQ(e.target.value)} />
        <select
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          aria-label="Yer"
          style={sx("height:40px;padding:0 10px;border-radius:9px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:14px;color:var(--text-body)")}
        >
          <option value="all">Tüm yerler</option>
          {SC.PLACES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Durum"
          style={sx("height:40px;padding:0 10px;border-radius:9px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:14px;color:var(--text-body)")}
        >
          <option value="all">Tüm durumlar</option>
          {Object.keys(SC.STATUS).map((k) => (
            <option key={k} value={k}>{(SC.STATUS[k] as Record<string, string>).tr}</option>
          ))}
        </select>
      </div>

      <div style={sx("font-size:13px;color:var(--text-muted);margin-top:12px")}>
        {num(total)} kayıt eşleşti{total > rows.length ? " · ilk " + rows.length + " gösteriliyor" : ""}
      </div>

      <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:12px")}>
        {rows.map((r) => {
          const missing = [
            !r.band ? "fiyat" : "", !(r.groups || []).length ? "çeşit" : "",
            !r.photos ? "fotoğraf" : "", !r.tel ? "telefon" : "",
          ].filter(Boolean);
          return (
            <div key={r.id} style={sx(ROW)}>
              <span style={sx("flex:1;min-width:0")}>
                <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>
                  {r.name || "İsimsiz kayıt"}
                </span>
                <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                  {whereOf(r)}
                  {missing.length ? " · eksik: " + missing.join(", ") : ""}
                </span>
              </span>
              <Pill label={(SC.STATUS[r.status] as Record<string, string>)?.tr || r.status} t={STATUS_TONE[r.status] || "secondary"} />
            </div>
          );
        })}

        {rows.length === 0 && (
          <EmptyState icon="files" tone="neutral" title="Eşleşen kayıt yok" description="Aramayı genişletin ya da başka bir yer seçin." />
        )}
      </div>
    </>
  );
}

// ── Veri Kalitesi ─────────────────────────────────────────────────────────

export function Kalite({ readOnly, officer, onTask, say }: {
  readOnly: boolean; officer: string; onTask: () => void; say: (m: string) => void;
}) {
  const freshDays = (SC.SETTINGS.freshDays?.value as number) || 90;
  const lists = useMemo(() => AD.qualityLists(SC.RECORDS, freshDays), [freshDays]);
  const [open, setOpen] = useState<AD.QualityRule | null>(null);

  return (
    <>
      <h1 style={sx(H1)}>Veri kalitesi</h1>
      <p style={sx(SUB)}>
        Her kural bir iş listesi üretir. “Kataloğu boş: 421” bir sayıydı, listesi yoktu —
        kime gidileceği belli değildi. Buradan doğrudan saha görevi açılır.
      </p>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr));gap:14px;margin-top:18px")}>
        {(Object.keys(AD.QUALITY_RULES) as AD.QualityRule[]).map((k) => {
          const rule = AD.QUALITY_RULES[k];
          const list = lists[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => setOpen(open === k ? null : k)}
              style={sx(CARD + ";text-align:start;cursor:pointer;font-family:inherit;border-color:" + (open === k ? "var(--color-primary)" : "var(--border-strong)"))}
            >
              <div style={sx(KICKER)}>{rule.tr}</div>
              <div style={sx("font-size:28px;font-weight:700;letter-spacing:-.02em;margin-top:5px;color:var(--color-" + rule.tone + (rule.tone === "warning" ? "-accent" : "") + ")")}>
                {num(list.length)}
              </div>
              <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:4px;text-wrap:pretty")}>{rule.note}</div>
            </button>
          );
        })}
      </div>

      {open && (
        <div style={sx("margin-top:18px;" + CARD)}>
          <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
            <div style={sx("font-size:16px;font-weight:700;color:var(--text-heading)")}>
              {AD.QUALITY_RULES[open].tr} · {num(lists[open].length)} kayıt
            </div>
            {!readOnly && (
              <Button
                variant="outline" color="primary" size="sm"
                onClick={() => {
                  // Turn the list into work: one visit, aimed at the place with
                  // the most of this problem.
                  const byPlace: Record<string, number> = {};
                  lists[open].forEach((r) => { byPlace[r.place] = (byPlace[r.place] || 0) + 1; });
                  const worst = Object.keys(byPlace).sort((a, b) => byPlace[b] - byPlace[a])[0];
                  if (!worst) return say("Görev açacak kayıt yok");
                  AD.addTask({
                    kind: "icerik", place: worst, officer: officer || null,
                    target: byPlace[worst],
                    note: AD.QUALITY_RULES[open].tr + " — " + byPlace[worst] + " kayıt",
                  });
                  onTask();
                  say("Saha görevi açıldı: " + (SC.PLACES.find((p) => p.id === worst)?.name || worst));
                }}
              >
                En yoğun yere saha görevi aç
              </Button>
            )}
          </div>

          <div style={sx("display:flex;flex-direction:column;gap:6px;margin-top:14px")}>
            {lists[open].slice(0, 40).map((r) => (
              <div key={r.id} style={sx("font-size:13px;color:var(--text-body);padding:8px 11px;border-radius:9px;background:var(--surface-muted)")}>
                <strong>{r.name || r.id}</strong> — {whereOf(r)}
              </div>
            ))}
            {lists[open].length > 40 && (
              <div style={sx("font-size:12.5px;color:var(--text-muted)")}>…ve {num(lists[open].length - 40)} kayıt daha</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Toplu İçe Aktarma ─────────────────────────────────────────────────────

export function IceAktar({ readOnly, officer, onDone, say }: {
  readOnly: boolean; officer: string; onDone: () => void; say: (m: string) => void;
}) {
  const [place, setPlace] = useState("");
  const [text, setText] = useState("");
  const parsed = useMemo(() => (text.trim() ? AD.parseImport(text) : null), [text]);

  const commit = () => {
    if (!place) return say("Önce yeri seçin");
    if (!parsed || !parsed.rows.length) return say("Alınacak satır yok");
    const p = SC.PLACES.find((x) => x.id === place);
    if (!p) return say("Yer bulunamadı");

    // Imported rows enter as DECLARATIONS, never as approved records. A tenant
    // list from a han's office is a good lead, not a verification — it still
    // goes through the same approval line as everything else.
    const drafts = SC.RECORDS.filter((r) => r.place === place);
    let added = 0;
    parsed.rows.forEach((row) => {
      if (drafts.some((d) => String(d.door) === String(row.door))) return;
      const rec = SC.draftRecord({
        place, floor: 0, door: String(row.door), name: row.name,
        tel: row.tel || "", officer: officer || null,
      });
      if (rec) added += 1;
    });
    onDone();
    say(added + " kayıt beyan olarak açıldı — onay kuyruğuna düştü");
    setText("");
  };

  return (
    <>
      <h1 style={sx(H1)}>Toplu içe aktarma</h1>
      <p style={sx(SUB)}>
        Han yönetiminden gelen kiracı listesi elle 142 kayıt açılarak girilemez. Listeyi yapıştırın;
        ayırıcı virgül, noktalı virgül ya da sekme olabilir. Gelen satırlar <strong>beyan</strong>
        olarak açılır — kiracı listesi iyi bir ipucudur, doğrulama değil, aynı onay hattından geçer.
      </p>

      <div style={sx("margin-top:16px;" + CARD)}>
        <label style={sx("display:block")}>
          <span style={sx("display:block;font-size:13px;font-weight:600;color:var(--text-heading);margin-bottom:5px")}>Yer</span>
          <select
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            style={sx("width:100%;max-width:440px;height:40px;padding:0 10px;border-radius:9px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:14px;color:var(--text-body)")}
          >
            <option value="">Han, çarşı ya da cadde seçin</option>
            {SC.PLACES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>

        <div style={sx("margin-top:14px")}>
          <Textarea
            rows={8}
            label="Kiracı listesi"
            hint="kapı no, ad, kategoriler (a/b), telefon — her satır bir dükkân"
            placeholder={"12, Yılmaz Kuyumculuk, taki/gumus, 05321112233\n13; Demir Tekstil; kumas; 05329998877"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {parsed && (
          <div style={sx("margin-top:14px")}>
            <div style={sx("font-size:13.5px;color:var(--text-body)")}>
              {num(parsed.rows.length)} satır alınacak
              {parsed.errors.length > 0 ? " · " + num(parsed.errors.length) + " satır atlandı" : ""}
            </div>
            {parsed.errors.length > 0 && (
              <div style={sx("display:flex;flex-direction:column;gap:5px;margin-top:9px")}>
                {parsed.errors.slice(0, 8).map((e, i) => (
                  <div key={i} style={sx("font-size:12.5px;color:var(--color-danger);padding:7px 10px;border-radius:8px;background:var(--color-danger-soft)")}>
                    Satır {e.line}: {e.msg}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={sx("margin-top:16px")}>
          <Button color="accent" size="lg" disabled={readOnly || !parsed?.rows.length || !place} onClick={commit}>
            {parsed?.rows.length ? num(parsed.rows.length) + " kaydı beyan olarak aç" : "Alınacak satır yok"}
          </Button>
        </div>
      </div>

      <div style={sx("margin-top:16px;" + HOLLOW)}>
        <div style={sx(KICKER)}>Neden doğrudan onaylı değil</div>
        <p style={sx("font-size:13.5px;color:var(--text-body);margin-top:7px;text-wrap:pretty")}>
          Kiracı listesi bir kapının kime ait olduğunu söyler; o dükkânın ne sattığını, fiyatını ya da
          hâlâ açık olduğunu söylemez. Toplu onay ayrı bir karardır ve “Toplu Onay” sekmesinden,
          dayanağı seçilerek verilir.
        </p>
      </div>
    </>
  );
}
