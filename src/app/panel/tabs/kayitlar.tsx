"use client";

// Mağaza Kayıtları — yer omurgasındaki TÜM işletme kayıtları.
//
// Prototipin (HAN Panel.dc.html · isKayitlar) birebir portu:
//   · Arama + yer filtresi + durum filtresi, sağda canlı sayaç.
//   · Tazelik göstergesi: 30 günü aşan güncelleme kırmızı yazar.
//   · Varsayılan sıra fotoğrafı olmayanları öne alır (ADMIN-PLANI §16:
//     "listede fotoğrafsız kayıtlar önce geliyor — iş listesi bu").
//   · Satıra tıklayınca kayıt künyesi Drawer'da açılır.
//   · Saha rolü (can(role,"kayit-ekle")) "Mağaza Ekle" ile kayıt açar; kayıt
//     `han-panel-drafts`e yazılır ve SC.addRecord ile omurgaya girer — Web ve
//     Editör aynı kaydı görür.
//   · Kapsam bir kısıt değil görev tanımı (prototipteki scopeFilter): saha
//     yetkilisi kendi bölgesini, han yönetimi yalnız kendi hanını görür.

import { useEffect, useMemo, useState } from "react";

import { CATS } from "@/data/han-data";
import * as SC from "@/data/han-scale";
import type { Lang, ShopRecord } from "@/data/types";
import { Button, Drawer, EmptyState, Input, Select } from "@/ds";
import { KEYS, readKey, writeKey } from "@/services/storage";
import { sx } from "@/lib/sx";

import { H1, KICKER, Pill, SUB, num } from "./shared";
import type { PanelTabProps } from "./shared";

const PAGE_SIZE = 8;

const STATUS_TONE: Record<string, string> = { aktif: "success", onayli: "primary", beyan: "warning", askida: "danger" };
const STATUS_LABEL: Record<string, string> = { aktif: "Aktif", onayli: "Onaylı", beyan: "Beyan", askida: "Askıda" };
const floorLbl = (f: number) => (f === 0 ? "Zemin" : "Kat " + f);
const placeName = (id: string) => SC.PLACES.find((p) => p.id === id)?.name || id;
const urunOf = (r: ShopRecord) => (r.band ? r.skuCount || 0 : 0);

// ── kapsam (prototipteki scopeFilter) ─────────────────────────────────────
// Saha yetkilisi kendi bölgesini, han yönetimi kendi hanını görür.
const SCOPE_KEY = "han-panel-scope-v1";
interface ScopeSel { officer: string; place: string }

function useScope(role: string) {
  const scope = (SC.ROLES[role] || {}).scope || null;
  const [sel, setSel] = useState<ScopeSel>({ officer: "", place: "" });
  // Depodan sonradan okunur — sunucunun kapsam seçimi yok, render'da okumak
  // ilk kareyi sunucununkinden ayırırdı (usePanelRole ile aynı desen).
  useEffect(() => {
    setSel(readKey<ScopeSel>(SCOPE_KEY, { officer: "", place: "" }));
  }, []);
  const save = (next: ScopeSel) => {
    setSel(next);
    writeKey(SCOPE_KEY, next);
  };
  return { scope, sel, save };
}

function scopePlaceIds(scope: string | null, sel: ScopeSel): Set<string> | null {
  if (scope === "place" && sel.place) return new Set([sel.place]);
  if (scope === "officer" && sel.officer) {
    return new Set(
      SC.PLACES.filter((p) => SC.recordsOfPlace(p.id).some((r) => r.officer === sel.officer)).map((p) => p.id),
    );
  }
  return null;
}

function ScopePicker({ scope, sel, onChange }: { scope: string; sel: ScopeSel; onChange: (s: ScopeSel) => void }) {
  const opts = scope === "place"
    ? [{ value: "", label: "Han seçin…" }].concat(
        SC.PLACES.slice().sort((a, b) => b.units - a.units).slice(0, 40).map((p) => ({ value: p.id, label: p.name })),
      )
    : [{ value: "", label: "Tüm bölgeler" }].concat(
        Object.keys(SC.OFFICERS).map((k) => ({ value: k, label: SC.OFFICERS[k].name })),
      );
  const value = scope === "place" ? sel.place : sel.officer;
  return (
    <div style={sx("width:190px")}>
      <Select
        size="sm"
        aria-label={scope === "place" ? "Han kapsamı" : "Bölge kapsamı"}
        value={value}
        onChange={(e) =>
          onChange(scope === "place" ? { ...sel, place: e.target.value } : { ...sel, officer: e.target.value })
        }
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </div>
  );
}

// Durum filtresi prototipteki ToggleGroup'un karşılığı: chip dizisi.
function Chips({
  options, value, onChange, label,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} style={sx("display:flex;gap:7px;flex-wrap:wrap")}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            style={sx(
              "height:30px;padding:0 11px;border-radius:7px;font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;border:1px solid " +
                (on
                  ? "var(--color-primary);background:var(--color-primary-soft);color:var(--color-primary-accent)"
                  : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

type SortKey = "foto" | "name" | "yer" | "urun" | "gun";

const BLANK_FORM = { name: "", han: "yildiz", no: "", cats: "", tel: "", verified: false };

export default function Kayitlar(props: PanelTabProps) {
  const { role, readOnly, refresh, say } = props;
  const { scope, sel, save } = useScope(role);

  // Yazma sonrası modül durumu değişir ama props değişmez; memolar bu yerel
  // rev ile tazelenir.
  const [rev, setRev] = useState(0);
  const bump = () => setRev((n) => n + 1);

  const [q, setQ] = useState("");
  const [placeFilter, setPlaceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "foto", dir: 1 });
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canAdd = SC.can(role, "kayit-ekle") && !readOnly;

  // Kapsam rolden gelir: saha yetkilisi kendi bölgesini, han yönetimi kendi hanını görür.
  const pool = useMemo(() => {
    const ids = scopePlaceIds(scope, sel);
    return ids ? SC.RECORDS.filter((r) => ids.has(r.place)) : SC.RECORDS.slice();
  }, [scope, sel, rev]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const qq = q.trim().toLocaleLowerCase("tr");
    const list = pool.filter((r) => {
      if (placeFilter !== "all" && r.place !== placeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!qq) return true;
      return (r.name + " " + (r.groups || []).map((g) => g.name).join(" ") + " " + placeName(r.place))
        .toLocaleLowerCase("tr")
        .includes(qq);
    });
    const dir = sort.dir;
    return list.slice().sort((a, b) => {
      // ADMIN-PLANI §16 · fotoğrafı olmayan kayıt iş listesidir, öne gelir.
      if (sort.key === "foto") {
        const d = (a.photos || 0) - (b.photos || 0);
        if (d) return d;
        return (a.updatedDays || 0) - (b.updatedDays || 0);
      }
      if (sort.key === "name") return (a.name || "").localeCompare(b.name || "", "tr") * dir;
      if (sort.key === "yer") return placeName(a.place).localeCompare(placeName(b.place), "tr") * dir;
      if (sort.key === "urun") return (urunOf(a) - urunOf(b)) * dir;
      return ((a.updatedDays || 0) - (b.updatedDays || 0)) * dir;
    });
  }, [pool, q, placeFilter, statusFilter, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const pageRows = rows.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const katalogsuz = pool.filter((r) => urunOf(r) === 0).length;
  const noPhoto = pool.filter((r) => !r.photos).length;

  // Seçenekler gerçek dağılımdan üretilir: her zaman 0 döndüren filtre gösterilmez.
  const statusOpts = [{ value: "all", label: "Tümü" }].concat(
    ([["aktif", "Aktif"], ["onayli", "Onaylı"], ["beyan", "Beyan"], ["askida", "Askıda"]] as [string, string][])
      .filter(([k]) => pool.some((r) => r.status === k))
      .map(([k, l]) => ({ value: k, label: l + " · " + num(pool.filter((r) => r.status === k).length) })),
  );

  const placeOpts = useMemo(() => {
    const ids = scopePlaceIds(scope, sel);
    const list = (ids ? SC.PLACES.filter((p) => ids.has(p.id)) : SC.PLACES.slice()).sort((a, b) => b.units - a.units);
    return [{ value: "all", label: "Tüm yerler" }].concat(list.map((p) => ({ value: p.id, label: p.name })));
  }, [scope, sel, rev]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSortKey = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const resetFilters = () => {
    setQ(""); setPlaceFilter("all"); setStatusFilter("all");
    setSort({ key: "foto", dir: 1 }); setPage(1);
  };

  // ── kayıt aç (saha) — prototipteki saveStore'un portu ────────────────────
  const saveStore = () => {
    const f = form;
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = "Mağaza adı gerekli.";
    if (!f.no.trim()) errs.no = "Dükkân no gerekli.";
    if (f.tel && !/^0?\d{10}$/.test(f.tel.replace(/\s/g, ""))) errs.tel = "10 haneli numara girin.";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const catsIn = f.cats.split(",").map((x) => x.trim()).filter(Boolean);
    // Serbest yazılan kategori metni sözlükle eşlenir: "Poşet" → cat "poset".
    const norm = (x: string) => x.toLocaleLowerCase("tr").replace(/[^a-zçğıöşü ]/g, "").trim();
    const allCats: { id: string; tr?: string; en?: string }[] = ([] as { id: string; tr?: string; en?: string }[])
      .concat(CATS as { id: string; tr?: string; en?: string }[], SC.CATS_EXTRA);
    const matched = catsIn
      .map((c) => {
        const n = norm(c);
        const hit = allCats.find((k) =>
          (["tr", "en"] as const).some((l) => {
            const v = k[l];
            return !!v && (norm(String(v)) === n || norm(String(v)).includes(n) || n.includes(norm(String(v))));
          }),
        );
        return hit ? hit.id : null;
      })
      .filter((x): x is string => !!x);
    const uniqCats = matched.filter((x, i) => matched.indexOf(x) === i);
    const place = SC.PLACES.find((p) => p.id === f.han);

    // Saha turunda açılan kayıt "onaylı" başlar; doğrulanmadıysa esnaf beyanıdır.
    const rec: ShopRecord = {
      id: "p" + Date.now(),
      place: f.han,
      semt: place?.semt || "kapalicarsi",
      floor: 1,
      door: f.no.trim(),
      corridor: null,
      name: f.name.trim(),
      cat: uniqCats[0] || "",
      cats: uniqCats,
      sector: "perakende",
      status: f.verified ? "onayli" : "beyan",
      approvedVia: "saha",
      bulk: false,
      officer: scope === "officer" ? sel.officer : "",
      langs: ["tr"] as Lang[],
      moq: 1,
      moqFlex: true,
      trade: { sells: ["perakende"], quoteBased: false, perakende: { band: null, moq: 1 }, toptan: null, scope: null },
      src: { band: "tahmini", moq: "tahmini", groups: "tahmini", resp: "tahmini", rating: "tahmini", address: "yetkili" },
      shipsHotel: false,
      giftWrap: false,
      band: null,
      groups: catsIn.map((c) => ({ name: c, lines: 0, lo: 0, hi: 0 })),
      skuCount: 0,
      isProducer: false,
      shipsAbroad: false,
      taxFree: false,
      invoice: false,
      payments: ["cash"],
      respMins: null,
      respRate: null,
      rating: null,
      reviews: 0,
      updatedDays: 0,
      photos: 0,
      tel: f.tel.replace(/\s/g, ""),
      distance: 300,
      curated: null,
    };

    // Kayıt paylaşılan katmana yazılır: Web ve Editör de aynı kaydı görür.
    const drafts = readKey<ShopRecord[]>(KEYS.drafts, []);
    writeKey(KEYS.drafts, drafts.concat([rec]));
    SC.addRecord(rec);

    setErrors({});
    setCreateOpen(false);
    setForm({ ...BLANK_FORM });
    setPage(1);
    bump();
    refresh();
    say(rec.name + (f.verified ? " · onaylı açıldı" : " · esnaf beyanı olarak açıldı"));
  };

  const det = detailId ? SC.RECORDS.find((r) => r.id === detailId) || null : null;
  const detPlace = det ? SC.PLACES.find((p) => p.id === det.place) : null;

  const th = (label: string, key: SortKey, style: string) => (
    <button
      type="button"
      onClick={() => setSortKey(key)}
      style={sx(style + ";display:flex;align-items:center;gap:4px;background:none;border:none;padding:0;font-family:inherit;font-size:11px;font-weight:700;letter-spacing:.04em;color:" + (sort.key === key ? "var(--color-primary-accent)" : "var(--text-muted)") + ";cursor:pointer;text-align:start")}
    >
      {label}
      {sort.key === key && <span aria-hidden="true">{sort.dir === 1 ? "↑" : "↓"}</span>}
    </button>
  );

  return (
    <>
      <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
        <div style={sx("min-width:0")}>
          <h1 style={sx(H1)}>Mağaza Kayıtları</h1>
          <p style={sx(SUB)}>Yer omurgasındaki tüm işletme kayıtları — durum ve tazelikleriyle.</p>
        </div>
        {canAdd && (
          <Button color="accent" iconStart="plus-squared" onClick={() => setCreateOpen(true)}>
            Mağaza Ekle
          </Button>
        )}
      </div>

      <div style={sx("margin-top:16px;background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:16px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
        {scope && <ScopePicker scope={scope} sel={sel} onChange={save} />}
        <div style={sx("width:280px;max-width:100%")}>
          <Input
            size="sm"
            iconLead="magnifier"
            placeholder="Mağaza, ürün veya han ara…"
            aria-label="Kayıt ara"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>
        <div style={sx("width:190px")}>
          <Select
            size="sm"
            aria-label="Yer filtresi"
            value={placeFilter}
            onChange={(e) => { setPlaceFilter(e.target.value); setPage(1); }}
          >
            {placeOpts.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
        <Chips
          label="Durum filtresi"
          options={statusOpts}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
        />
        <Button variant="ghost" color="dark" size="sm" iconStart="filter" onClick={resetFilters}>
          Filtreyi Sıfırla
        </Button>
        <div style={sx("margin-left:auto;font-size:13px;color:var(--text-muted)")}>{num(rows.length)} kayıt</div>
      </div>

      {noPhoto > 0 && (
        <p style={sx("margin:12px 0 0;font-size:13px;color:var(--text-muted);text-wrap:pretty")}>
          {num(noPhoto)} kayıtta hiç fotoğraf yok. Vitrini görünmeyen dükkâna alıcı güvenmiyor — listede
          fotoğrafsız kayıtlar önce geliyor.
        </p>
      )}

      <div style={sx("margin-top:14px;background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;box-shadow:0 3px 4px rgba(0,0,0,.03);overflow-x:auto")}>
        <div style={sx("min-width:860px;display:flex;align-items:center;gap:14px;padding:12px 20px;border-bottom:1px solid var(--border-strong)")}>
          {th("MAĞAZA", "name", "flex:1;min-width:200px")}
          {th("KONUM", "yer", "width:190px;flex:none")}
          {th("ÇEŞİT", "urun", "width:90px;flex:none;justify-content:flex-end")}
          {th("GÜNCELLEME", "gun", "width:110px;flex:none;justify-content:flex-end")}
          <div style={sx("width:96px;flex:none;font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--text-muted)")}>DURUM</div>
        </div>

        {pageRows.map((r) => {
          const gun = r.updatedDays || 0;
          const urun = urunOf(r);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setDetailId(r.id)}
              style={sx("min-width:860px;width:100%;display:flex;align-items:center;gap:14px;padding:13px 20px;border:none;border-bottom:1px solid var(--border-default);background:none;font-family:inherit;text-align:start;cursor:pointer")}
            >
              <span style={sx("flex:1;min-width:200px")}>
                <span style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
                  <span style={sx("font-size:13.5px;font-weight:600;line-height:1.35;color:var(--text-heading)")}>
                    {r.name || "İsimsiz kayıt"}
                  </span>
                  {!r.photos && (
                    <span style={sx("display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:5px;font-size:11px;font-weight:700;background:var(--color-warning-soft);color:var(--color-warning-accent)")}>
                      Fotoğraf yok
                    </span>
                  )}
                </span>
                <span style={sx("display:block;font-size:12px;color:var(--text-muted);margin-top:2px")}>
                  {(r.groups || []).slice(0, 3).map((g) => g.name).filter(Boolean).join(" · ") || "—"}
                </span>
              </span>
              <span style={sx("width:190px;flex:none")}>
                <span style={sx("display:block;font-size:13px;color:var(--text-heading)")}>{placeName(r.place)}</span>
                <span style={sx("display:block;font-size:12px;color:var(--text-muted);margin-top:2px")}>
                  {floorLbl(r.floor) + " · No " + r.door}
                </span>
              </span>
              <span style={sx("width:90px;flex:none;text-align:right;font-size:13px")}>
                {urun === 0
                  ? <span style={sx("color:var(--color-warning);font-weight:600")}>Fiyat yok</span>
                  : <span style={sx("font-weight:600;color:var(--text-heading)")}>{num(urun)}</span>}
              </span>
              <span style={sx("width:110px;flex:none;text-align:right;font-size:13px;color:" + (gun > 30 ? "var(--color-danger)" : "var(--text-body)"))}>
                {gun === 0 ? "Bugün" : gun + " gün önce"}
              </span>
              <span style={sx("width:96px;flex:none")}>
                <Pill label={STATUS_LABEL[r.status] || r.status} t={STATUS_TONE[r.status] || "warning"} />
              </span>
            </button>
          );
        })}

        {rows.length === 0 && (
          <EmptyState
            icon="magnifier"
            tone="neutral"
            title="Kayıt bulunamadı"
            description="Filtreleri sıfırlayın ya da yeni mağaza ekleyin."
          />
        )}

        <div style={sx("min-width:860px;display:flex;align-items:center;gap:14px;padding:12px 20px;flex-wrap:wrap")}>
          <span style={sx("font-size:12.5px;color:var(--text-muted)")}>{num(katalogsuz)} kaydın kataloğu boş</span>
          <span style={sx("margin-left:auto;display:flex;align-items:center;gap:9px")}>
            <Button variant="outline" color="dark" size="sm" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>
              Önceki
            </Button>
            <span style={sx("font-size:12.5px;color:var(--text-muted)")}>Sayfa {cur} / {pages}</span>
            <Button variant="outline" color="dark" size="sm" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>
              Sonraki
            </Button>
          </span>
        </div>
      </div>

      {/* ── kayıt künyesi ─────────────────────────────────────────────────── */}
      <Drawer
        open={!!det}
        onClose={() => setDetailId(null)}
        title={det ? det.name || "İsimsiz kayıt" : ""}
        subtitle={det ? (detPlace?.name || det.place) + " · " + floorLbl(det.floor) + " · No " + det.door : ""}
      >
        {det && (
          <div style={sx("display:flex;flex-direction:column;gap:16px")}>
            <div style={sx("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
              <Pill label={SC.STATUS[det.status]?.tr || det.status} t={STATUS_TONE[det.status] || "warning"} />
              {det.bulk && <Pill label="Han anlaşmalı yer" t="success" />}
            </div>
            {SC.STATUS[det.status]?.bodyTr && (
              <p style={sx("margin:0;font-size:13.5px;color:var(--text-body);text-wrap:pretty")}>
                {SC.STATUS[det.status].bodyTr}
              </p>
            )}

            <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;font-size:13.5px")}>
              <div>
                <div style={sx(KICKER)}>Kategori</div>
                <div style={sx("margin-top:3px;color:var(--text-heading);font-weight:600")}>
                  {(CATS.find((c) => c.id === det.cat) || SC.CATS_EXTRA.find((c) => c.id === det.cat))?.tr || det.cat || "—"}
                </div>
              </div>
              <div>
                <div style={sx(KICKER)}>Sektör</div>
                <div style={sx("margin-top:3px;color:var(--text-heading);font-weight:600")}>
                  {SC.SECTORS[det.sector]?.tr || det.sector}
                </div>
              </div>
              <div>
                <div style={sx(KICKER)}>Yetkili</div>
                <div style={sx("margin-top:3px;color:var(--text-heading);font-weight:600")}>
                  {SC.OFFICERS[det.officer]?.name || "Atanmamış"}
                </div>
              </div>
              <div>
                <div style={sx(KICKER)}>Onay dayanağı</div>
                <div style={sx("margin-top:3px;color:var(--text-heading);font-weight:600")}>
                  {det.approvedVia ? SC.APPROVAL[det.approvedVia]?.tr || det.approvedVia : "Onay bekliyor"}
                </div>
              </div>
              <div>
                <div style={sx(KICKER)}>Güncelleme</div>
                <div style={sx("margin-top:3px;font-weight:600;color:" + ((det.updatedDays || 0) > 30 ? "var(--color-danger)" : "var(--text-heading)"))}>
                  {(det.updatedDays || 0) === 0 ? "Bugün" : det.updatedDays + " gün önce"}
                </div>
              </div>
              <div>
                <div style={sx(KICKER)}>Fotoğraf</div>
                <div style={sx("margin-top:3px;font-weight:600;color:" + (det.photos ? "var(--text-heading)" : "var(--color-warning)"))}>
                  {det.photos ? det.photos + " görsel" : "Hiç yok"}
                </div>
              </div>
              <div>
                <div style={sx(KICKER)}>Telefon</div>
                <div style={sx("margin-top:3px;color:var(--text-heading);font-weight:600")}>{det.tel || "—"}</div>
              </div>
              <div>
                <div style={sx(KICKER)}>Fiyat bandı</div>
                <div style={sx("margin-top:3px;font-weight:600;color:" + (det.band ? "var(--text-heading)" : "var(--color-warning)"))}>
                  {det.band ? num(det.band[0]) + " – " + num(det.band[1]) + " ₺" : "Fiyat yok"}
                </div>
              </div>
            </div>

            {(det.groups || []).length > 0 && (
              <div>
                <div style={sx(KICKER)}>Çeşit grupları</div>
                <div style={sx("display:flex;flex-direction:column;gap:6px;margin-top:8px")}>
                  {det.groups.map((g) => (
                    <div key={g.name} style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border-radius:9px;background:var(--surface-muted);font-size:13px")}>
                      <span style={sx("font-weight:600;color:var(--text-heading)")}>{g.name}</span>
                      <span style={sx("color:var(--text-muted)")}>
                        {g.lines ? num(g.lines) + " çeşit" : "—"}
                        {g.lo ? " · " + num(g.lo) + "–" + num(g.hi) + " ₺" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={sx("margin:0;font-size:12.5px;color:var(--text-muted);text-wrap:pretty")}>
              Onay ve askı kararları bu ekrandan verilmez: kayıt durumunu yalnız Beyan Kuyruğu ve Toplu Onay değiştirir.
            </p>
          </div>
        )}
      </Drawer>

      {/* ── saha: kayıt aç ───────────────────────────────────────────────── */}
      <Drawer
        open={createOpen}
        onClose={() => { setCreateOpen(false); setErrors({}); }}
        title="Mağaza Ekle"
        subtitle="Sahada doğrulanan kaydı sisteme girin"
        footer={
          <div style={sx("display:flex;gap:10px;justify-content:flex-end")}>
            <Button variant="ghost" color="dark" onClick={() => { setCreateOpen(false); setErrors({}); }}>
              Vazgeç
            </Button>
            <Button color="primary" onClick={saveStore}>Kaydet</Button>
          </div>
        }
      >
        <div style={sx("display:flex;flex-direction:column;gap:16px")}>
          <Input
            label="Mağaza adı"
            placeholder="Örn. Emre Aksesuar Toptan"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={errors.name}
          />
          <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:12px")}>
            <Select label="Han" value={form.han} onChange={(e) => setForm((f) => ({ ...f, han: e.target.value }))}>
              {SC.PLACES.slice().sort((a, b) => b.units - a.units).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Input
              label="Dükkân no"
              placeholder="118"
              value={form.no}
              onChange={(e) => setForm((f) => ({ ...f, no: e.target.value }))}
              error={errors.no}
            />
          </div>
          <Input
            label="Kategoriler"
            placeholder="Telefon kılıfı, Powerbank"
            hint="Virgülle ayırın"
            value={form.cats}
            onChange={(e) => setForm((f) => ({ ...f, cats: e.target.value }))}
          />
          <Input
            label="Telefon"
            placeholder="0532 000 00 00"
            value={form.tel}
            onChange={(e) => setForm((f) => ({ ...f, tel: e.target.value }))}
            error={errors.tel}
          />
          <label style={sx("display:flex;align-items:center;gap:9px;font-size:13.5px;color:var(--text-body);cursor:pointer")}>
            <input
              type="checkbox"
              checked={form.verified}
              onChange={(e) => setForm((f) => ({ ...f, verified: e.target.checked }))}
              style={sx("width:17px;height:17px;cursor:pointer")}
            />
            Konum yerinde doğrulandı
          </label>
          <p style={sx("margin:0;font-size:12.5px;color:var(--text-muted);text-wrap:pretty")}>
            Doğrulanan kayıt <strong>onaylı</strong> başlar; doğrulanmadıysa esnaf beyanıdır ve fiyat gösteremez.
          </p>
        </div>
      </Drawer>
    </>
  );
}
