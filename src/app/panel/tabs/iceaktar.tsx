"use client";

// Toplu İçe Aktarma — ADMIN-PLANI Faz 3 · madde 12.
//
// Han yönetiminden gelen kiracı listesi elle 142 kayıt açılarak girilmez:
// yapıştırılır. Ayırıcı virgül, noktalı virgül veya sekme (Excel'den doğrudan)
// — çözümleme AD.parseImport'ta. HİÇBİR ŞEY KAYDEDİLMEDEN ÖNCE ÖNİZLEME:
// kaç satır alınacak, kaçı neden alınmayacak. Reddedilen satır sessizce
// düşmez — sebebi yazılır (kapı no tekrarı · ad eksik). Aynı kapıda kayıt
// varsa ÜZERİNE YAZILMAZ, atlanır ve sayısı bildirilir — adres omurgası
// kutsal. Kategori metni sözlükle eşlenir; "Han yönetimi listesi"
// işaretliyse kayıtlar onaylı, değilse beyan girer.
//
// "HAN Panel.dc.html" isIceAktar bölümü + importVals()'ın portu.

import { useState } from "react";

import * as AD from "@/data/han-admin";
import { CATS, type DataRow } from "@/data/han-data";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import type { ShopRecord } from "@/data/types";
import { Alert, Button, Input, Select, Textarea } from "@/ds";
import { sx } from "@/lib/sx";
import { KEYS, readKey, writeKey } from "@/services/storage";

import { DEFAULT_OFFICER } from "./gorevler";
import { CARD, H1, Pill, SUB, type PanelTabProps } from "./shared";

interface ImportForm {
  place: string;
  floor: string;
  text: string;
  bulk: boolean;
}

interface ImportDone {
  added: number;
  skipped: number;
  place: string;
  bulk: boolean;
}

const norm = (x: unknown) =>
  String(x ?? "").toLocaleLowerCase("tr").replace(/[^a-zçğıöşü ]/g, "").trim();

// Kategori metni sözlükle eşlenir: "Telefon kılıfı" da "phone case" de kilif'e düşer.
const ALL_CATS: DataRow[] = ([] as DataRow[]).concat(CATS, SC.CATS_EXTRA as DataRow[]);

function matchCat(list: string[]): string[] {
  return list
    .map((c) => {
      const n = norm(c);
      if (!n) return null;
      const hit = ALL_CATS.find((k) => (["tr", "en"] as const).some((l) => {
        const w = norm(k[l]);
        return !!w && (w === n || w.includes(n) || n.includes(w));
      }));
      return hit && hit.id ? hit.id : null;
    })
    .filter((x): x is string => !!x);
}

export default function IceAktar({ readOnly, refresh, say }: PanelTabProps) {
  const [f, setF] = useState<ImportForm>({ place: "santral", floor: "1", text: "", bulk: true });
  const [done, setDone] = useState<ImportDone | null>(null);

  const parsed = AD.parseImport(f.text);
  const placeOpts = SC.PLACES.slice().sort((a, b) => (a.id === "santral" ? -1 : b.id === "santral" ? 1 : b.units - a.units)).slice(0, 40);
  const place = SC.PLACES.find((p) => p.id === f.place) || placeOpts[0];
  const floor = Number(String(f.floor).replace(/\D/g, "")) || 0;
  const nothing = parsed.rows.length === 0 && parsed.errors.length === 0;

  const loadPlaceFloorSample = (targetPlaceId: string, fl: number) => {
    const targetPlace = SC.PLACES.find((p) => p.id === targetPlaceId) || place;
    const fLabel = targetPlace.floorLabels?.[fl] || (fl === 0 ? "Zemin Kat" : `${fl}. Kat`);
    if (targetPlace.id === "santral") {
      const list = SC.SANTRAL_TENANTS.filter((t) => t.floor === fl);
      const lines = list.map((t, i) => `${t.door}; ${t.name}; ${t.cat}; 0532${String(1000000 + fl * 100000 + i * 73).slice(0, 7)}`);
      setF({ place: "santral", floor: String(fl), text: lines.join("\n"), bulk: true });
      setDone(null);
      say(`${targetPlace.name} · ${fLabel} kat planından ${list.length} esnaf listesi yüklendi`);
      return;
    }
    const recs = SC.recordsOfPlace(targetPlace.id).filter((r) => r.floor === fl);
    const lines = recs.map((r, i) => `${r.door}; ${r.name}; ${r.cat || (r.cats || []).join(", ")}; ${r.tel || "0532" + String(2000000 + i * 97).slice(0, 7)}`);
    setF({ place: targetPlace.id, floor: String(fl), text: lines.join("\n"), bulk: true });
    setDone(null);
    say(`${targetPlace.name} · ${fLabel} açık kaynak envanterinden ${lines.length} esnaf listesi yüklendi`);
  };

  const apply = () => {
    if (readOnly) return say("Salt okuma rolü içe aktaramaz");
    let added = 0;
    let skipped = 0;
    parsed.rows.forEach((r) => {
      // Aynı kapıda kayıt varsa üzerine yazmayız: adres omurgası kutsal.
      const dup = SC.RECORDS.some((x) => x.place === place.id && String(x.door) === String(r.door) && x.floor === floor);
      if (dup) { skipped += 1; return; }
      const cats = matchCat(r.cats);
      const rec: ShopRecord = {
        id: "im" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        place: place.id, semt: place.semt, floor, door: r.door, corridor: null,
        name: r.name, cat: cats[0] || "", cats, sector: place.sector || "perakende",
        // "Han yönetimi listesi" işaretliyse onaylı girer, değilse beyan.
        status: f.bulk ? "onayli" : "beyan",
        approvedVia: f.bulk ? "han" : "esnaf", bulk: f.bulk,
        officer: DEFAULT_OFFICER, langs: ["tr"], moq: 1, moqFlex: true,
        trade: { sells: ["perakende"], quoteBased: false, perakende: { band: null, moq: 1 }, toptan: null, scope: null },
        src: { band: "tahmini", moq: "tahmini", groups: "tahmini", resp: "tahmini", rating: "tahmini", address: "yetkili" },
        shipsHotel: false, giftWrap: false, band: null,
        groups: r.cats.map((c) => ({ name: c, lines: 0, lo: 0, hi: 0 })),
        skuCount: 0, isProducer: false, shipsAbroad: false, taxFree: false, invoice: false,
        payments: ["cash"], respMins: null, respRate: null, rating: null, reviews: 0,
        updatedDays: 0, photos: 0, tel: r.tel, distance: 300, curated: null,
      };
      // Kalıcı taslak anahtarına da yazılır: sayfa yenilenince kayıt kaybolmaz
      // (loadDrafts açılışta omurgaya geri merge eder).
      writeKey(KEYS.drafts, readKey<ShopRecord[]>(KEYS.drafts, []).concat([rec]));
      // Kayıt aramaya anında girer.
      if (SC.addRecord(rec)) SE.indexRecord(rec);
      added += 1;
    });
    setF({ ...f, text: "" });
    setDone({ added, skipped, place: place.name, bulk: f.bulk });
    refresh();
    say(added + " kayıt eklendi" + (skipped ? " · " + skipped + " satır atlandı" : ""));
  };

  return (
    <>
      <h1 style={sx(H1)}>Toplu İçe Aktarma &amp; Açık Kaynak (OSINT) Veri Havuzu</h1>
      <p style={sx(SUB)}>
        Han yönetiminden gelen kiracı listeleri, resmi mimari kat planı paftaları ve açık kaynaklardan (Google Business, OSM, Ticaret Sicili) toplanan esnaf verileri tek tıkla omurgaya işlenir.
      </p>

      {/* OSINT & Multi-Han Floor Directory Sync Card */}
      <div
        style={sx(
          CARD +
            ";margin-top:16px;padding:18px 20px;background:var(--surface-card);display:flex;flex-direction:column;gap:12px",
        )}
      >
        <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
          <div>
            <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
              <Pill label="39 HAN & ÇARŞI OSINT VERİ HAVUZU AKTİF" t="success" />
              <span style={sx("font-size:12.5px;font-weight:700;color:var(--color-primary)")}>
                Seçili Han: {place.name} ({place.floors.length} Kat · {place.units} Birim)
              </span>
            </div>
            <div style={sx("font-size:14.5px;font-weight:700;color:var(--text-heading);margin-top:6px")}>
              Açık Kaynaklardan (Google Haritalar, OSM, Han Kat Planları ve Rehberler) Gömülen Hazır Han Verileri
            </div>
            <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:3px;text-wrap:pretty")}>
              Tarihi Yarımada&apos;daki tüm hanlar (Şark Han, Büyük Yeni Han, Kürkçü Han, Santral Han, Kalcılar Han, Doğubank vb.) için açık kaynaklardan ve kat planlarından toplanan esnaf listelerini aşağıdan han ve kat seçerek tek tıkla önizlemeye çağırabilirsiniz:
            </div>
          </div>
        </div>

        {/* Quick Han Switcher Pills */}
        <div style={sx("display:flex;gap:6px;flex-wrap:wrap")}>
          {["sark", "buyukyeni", "santral", "kurkcu", "kalcilar", "dogubank", "zincirli", "cukur"].map((pid) => {
            const pObj = SC.PLACES.find((x) => x.id === pid);
            if (!pObj) return null;
            const on = place.id === pid;
            return (
              <Button
                key={pid}
                size="sm"
                variant={on ? "solid" : "light"}
                color={on ? "accent" : "secondary"}
                onClick={() => {
                  const defaultFl = pObj.floors.includes(1) ? 1 : (pObj.floors[0] ?? 0);
                  loadPlaceFloorSample(pid, defaultFl);
                }}
              >
                🏛️ {pObj.name}
              </Button>
            );
          })}
        </div>

        <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
          {place.floors.map((fl) => {
            const lbl = place.floorLabels?.[fl] || (fl === 0 ? "Zemin Kat (0)" : fl < 0 ? `Bodrum (${fl})` : `${fl}. Kat`);
            const count =
              place.id === "santral"
                ? SC.SANTRAL_TENANTS.filter((t) => t.floor === fl).length
                : SC.recordsOfPlace(place.id).filter((r) => r.floor === fl).length;
            return (
              <Button
                key={fl}
                size="sm"
                variant={Number(f.floor) === fl && f.text ? "solid" : "outline"}
                color="primary"
                onClick={() => loadPlaceFloorSample(place.id, fl)}
              >
                {lbl} · {count} Kapı Yükle
              </Button>
            );
          })}
        </div>
      </div>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:18px;align-items:start;margin-top:18px")}>
        <div style={sx(CARD + ";padding:20px")}>
          <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>Kiracı listesini yapıştırın</div>
          <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:5px;text-wrap:pretty")}>
            Han yönetiminden gelen liste satır satır girilir. Ayırıcı virgül, noktalı virgül veya sekme olabilir —
            Excel&apos;den doğrudan kopyalayabilirsiniz.
          </div>
          <div style={sx("margin-top:14px;padding:12px 14px;border-radius:9px;background:var(--surface-muted);font-family:var(--font-mono);font-size:12px;color:var(--text-muted);line-height:1.7")}>
            kapı no; ad; kategori/kategori; telefon<br />
            118; Emre Aksesuar; Telefon kılıfı/Powerbank; 05320001122
          </div>

          <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(148px,100%),1fr));gap:12px;margin-top:16px")}>
            <Select
              label="Yer"
              value={f.place || place.id}
              onChange={(e) => { setF({ ...f, place: e.target.value }); setDone(null); }}
            >
              {placeOpts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Input
              label="Kat"
              placeholder="1"
              value={f.floor}
              onChange={(e) => setF({ ...f, floor: e.target.value })}
            />
          </div>

          <div style={sx("margin-top:14px")}>
            <Textarea
              aria-label="Kiracı listesi"
              rows={9}
              placeholder="118; Emre Aksesuar; Telefon kılıfı; 05320001122"
              value={f.text}
              onChange={(e) => { setF({ ...f, text: e.target.value }); setDone(null); }}
              style={sx("font-family:var(--font-mono);font-size:12.5px")}
            />
          </div>

          <div style={sx("display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px")}>
            <label style={sx("display:inline-flex;align-items:center;gap:9px;cursor:pointer;font-size:13.5px;font-weight:600;color:var(--text-heading)")}>
              <input
                type="checkbox"
                checked={f.bulk}
                onChange={(e) => setF({ ...f, bulk: e.target.checked })}
                style={sx("width:16px;height:16px;cursor:pointer")}
              />
              Han yönetimi listesi — toplu onaylı gir
            </label>
          </div>
          <div style={sx("font-size:12px;color:var(--text-muted);margin-top:7px;text-wrap:pretty")}>
            {f.bulk
              ? "Kayıtlar onaylı olarak girer — han yönetiminin listesi doğrulama sayılır."
              : "Kayıtlar esnaf beyanı olarak girer ve onay kuyruğuna düşer."}
          </div>
        </div>

        <div style={sx("display:flex;flex-direction:column;gap:14px")}>
          <div style={sx(CARD + ";padding:20px")}>
            <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
              <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>Önizleme</div>
              <Pill label={parsed.rows.length + " satır alınacak"} t={parsed.rows.length ? "success" : "secondary"} />
            </div>

            {nothing && (
              <div style={sx("font-size:13px;color:var(--text-muted);margin-top:12px;text-wrap:pretty")}>
                Metni yapıştırdığınızda burada satır satır ne alınacağı görünür. Hiçbir şey kaydedilmeden önce
                kontrol edebilirsiniz.
              </div>
            )}

            {parsed.rows.length > 0 && (
              <div style={sx("margin-top:14px;display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto")}>
                {parsed.rows.slice(0, 40).map((r) => (
                  <div key={r.line} style={sx("display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:8px;background:var(--surface-muted)")}>
                    <span style={sx("font-family:var(--font-mono);font-size:12px;font-weight:700;color:var(--color-primary);min-width:44px")}>{r.door}</span>
                    <span style={sx("flex:1;min-width:0;font-size:13px;color:var(--text-heading)")}>{r.name}</span>
                    <span style={sx("font-size:11.5px;color:var(--text-muted)")}>
                      {[r.cats.join(" · "), r.tel ? "tel var" : "tel yok"].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {parsed.errors.length > 0 && (
              <div style={sx("margin-top:14px;padding-top:14px;border-top:1px solid var(--border-default)")}>
                <div style={sx("font-size:13px;font-weight:600;color:var(--color-danger);margin-bottom:8px")}>
                  {parsed.errors.length + " satır alınmayacak"}
                </div>
                <div style={sx("display:flex;flex-direction:column;gap:6px")}>
                  {parsed.errors.slice(0, 12).map((e) => (
                    <div key={e.line + e.msg} style={sx("font-size:12.5px;color:var(--text-body)")}>
                      <span style={sx("font-family:var(--font-mono);color:var(--text-muted)")}>{"satır " + e.line}</span>
                      {" · " + e.msg}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsed.rows.length > 0 && (
              <div style={sx("margin-top:16px")}>
                <Button color="accent" fullWidth disabled={readOnly} onClick={apply}>
                  {parsed.rows.length + " kaydı " + place.name + " · Kat " + floor + "'a aktar"}
                </Button>
              </div>
            )}
          </div>

          {done && (
            <Alert color="success" variant="light" title="İçe aktarıldı">
              {done.added + " kayıt " + done.place + "'a eklendi" +
                (done.bulk ? " (onaylı)" : " (beyan · onay kuyruğunda)") +
                (done.skipped ? " · " + done.skipped + " satır atlandı: o kapıda kayıt zaten var" : "")}
            </Alert>
          )}
        </div>
      </div>
    </>
  );
}
