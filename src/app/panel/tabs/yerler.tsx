"use client";

// Yerler — adres omurgasının yönetimi (ADMIN-PLANI 1e).
//
// Prototipin (HAN Panel.dc.html · isYerler + placeVals) birebir portu:
//   · 38 yer düzenlenebilir: ad, tür (çalışma saatini belirler), semt,
//     kat sayısı, birim sayısı, yetkili, toplu onay anlaşması.
//   · Yeni yer eklenebilir (SC.addPlace); düzeltme SC.savePlace ile,
//     anlaşma SC.setBulkApproved ile `han-places-v1`e yazılır.
//   · Kat/birim sayısı kapsama yüzdesinin BÖLENİ olduğu için formda bu
//     yazar: "tahmin yazmayın".
//   · Tablo görünümü dar ekranda yatay kaydırılır (min-width + overflow-x).
//   · Kapsam rolden gelir (scopeFilter): saha yetkilisi kendi bölgesini,
//     han yönetimi kendi hanını görür; salt okuma düzenleyemez.

import { useEffect, useMemo, useState } from "react";

import * as SC from "@/data/han-scale";
import type { Place } from "@/data/types";
import { Badge, Button, Drawer, EmptyState, Input, Select } from "@/ds";
import { readKey, writeKey } from "@/services/storage";
import { sx } from "@/lib/sx";

import { H1, SUB, num } from "./shared";
import type { PanelTabProps } from "./shared";

const semtName = (id: string) => SC.SEMTLER.find((x) => x.id === id)?.tr || id;
const kindName = (k: string) => (SC.PLACE_KINDS as Record<string, { tr: string }>)[k]?.tr || k;

// ── kapsam (prototipteki scopeFilter) ─────────────────────────────────────
const SCOPE_KEY = "han-panel-scope-v1";
interface ScopeSel { officer: string; place: string }

function useScope(role: string) {
  const scope = (SC.ROLES[role] || {}).scope || null;
  const [sel, setSel] = useState<ScopeSel>({ officer: "", place: "" });
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

/** Kapsama çubuğu — prototipteki Progress'in karşılığı. */
function Bar({ pct, tone }: { pct: number; tone: string }) {
  return (
    <span style={sx("display:block;height:8px;border-radius:999px;background:var(--surface-muted);overflow:hidden")}>
      <span style={sx("display:block;height:100%;border-radius:999px;width:" + Math.max(2, Math.min(100, pct)) + "%;background:var(--color-" + tone + ")")} />
    </span>
  );
}

interface PlaceForm {
  name: string; kind: string; semt: string;
  floors: string; units: string; officer: string; bulk: boolean;
}

const BLANK_PF: PlaceForm = { name: "", kind: "han", semt: "tahtakale", floors: "", units: "", officer: "", bulk: false };

export default function Yerler(props: PanelTabProps) {
  const { role, readOnly, refresh, say } = props;
  const { scope, sel, save } = useScope(role);
  const locked = readOnly;

  const [rev, setRev] = useState(0);
  const bump = () => setRev((n) => n + 1);

  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [pf, setPf] = useState<PlaceForm>({ ...BLANK_PF });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const list = useMemo(() => {
    const ids = scopePlaceIds(scope, sel);
    const qq = q.trim().toLocaleLowerCase("tr");
    return (ids ? SC.PLACES.filter((p) => ids.has(p.id)) : SC.PLACES.slice())
      .filter((p) => kind === "all" || p.kind === kind)
      .filter((p) => !qq || p.name.toLocaleLowerCase("tr").includes(qq))
      .sort((a, b) => b.units - a.units);
  }, [scope, sel, q, kind, rev]); // eslint-disable-line react-hooks/exhaustive-deps

  // Yetkili sütunu uydurulmaz: o yerdeki kayıtların en sık yetkilisinden türer.
  const officerOf = (p: Place): string | null => {
    const c: Record<string, number> = {};
    SC.recordsOfPlace(p.id).forEach((r) => { if (r.officer) c[r.officer] = (c[r.officer] || 0) + 1; });
    const top = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
    return top ? SC.OFFICERS[top]?.name || top : null;
  };

  const kinds = Object.keys(SC.PLACE_KINDS);
  const kindOpts = [{ value: "all", label: "Tüm türler" }].concat(
    kinds
      .filter((k) => SC.PLACES.some((p) => p.kind === k))
      .map((k) => ({ value: k, label: kindName(k) + " · " + SC.PLACES.filter((p) => p.kind === k).length })),
  );

  const openFor = (p: Place | null) => {
    setEditId(p ? p.id : null);
    setPf(
      p
        ? {
            name: p.name, kind: p.kind, semt: p.semt,
            floors: String((p.floors || []).length), units: String(p.units),
            officer: "", bulk: SC.BULK_APPROVED.includes(p.id),
          }
        : { ...BLANK_PF },
    );
    setErrors({});
    setOpen(true);
  };

  const close = () => { setOpen(false); setEditId(null); setErrors({}); };

  const savePlace = () => {
    const fl = Number(String(pf.floors).replace(/\D/g, ""));
    const un = Number(String(pf.units).replace(/\D/g, ""));
    const errs: Record<string, string> = {};
    if (!pf.name.trim()) errs.name = "Yer adı gerekli";
    if (!(fl > 0)) errs.floors = "Kat sayısı gerekli";
    if (!(un > 0)) errs.units = "Birim sayısı gerekli";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const floors: number[] = [];
    for (let i = 0; i < fl; i++) floors.push(i);
    const patch = { name: pf.name.trim(), kind: pf.kind as Place["kind"], semt: pf.semt, floors, units: un };

    if (editId) {
      SC.savePlace(editId, patch);
      SC.setBulkApproved(editId, !!pf.bulk);
      say(patch.name + " güncellendi");
    } else {
      const sm = SC.SEMTLER.find((x) => x.id === pf.semt);
      const id = "pl" + Date.now();
      SC.addPlace({
        id, mix: [], lat: sm?.lat || 41.0161, lng: sm?.lng || 28.9685, sector: "perakende", ...patch,
      });
      if (pf.bulk) SC.setBulkApproved(id, true);
      say(patch.name + " eklendi · " + num(un) + " birim omurgaya girdi");
    }
    close();
    bump();
    refresh();
  };

  return (
    <>
      <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
        <div style={sx("min-width:0")}>
          <h1 style={sx(H1)}>Yerler</h1>
          <p style={sx(SUB)}>
            Adres omurgası: yer ekle, kat ve birim sayısını düzelt, yetkili ata, toplu anlaşma işaretle.
          </p>
        </div>
        {!locked && (
          <Button variant="outline" color="dark" iconStart="plus-squared" onClick={() => openFor(null)}>
            Yer Ekle
          </Button>
        )}
      </div>

      <div style={sx("margin-top:16px;background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:16px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
        {scope && (
          <div style={sx("width:190px")}>
            <Select
              size="sm"
              aria-label={scope === "place" ? "Han kapsamı" : "Bölge kapsamı"}
              value={scope === "place" ? sel.place : sel.officer}
              onChange={(e) =>
                save(scope === "place" ? { ...sel, place: e.target.value } : { ...sel, officer: e.target.value })
              }
            >
              {(scope === "place"
                ? [{ value: "", label: "Han seçin…" }].concat(
                    SC.PLACES.slice().sort((a, b) => b.units - a.units).slice(0, 40).map((p) => ({ value: p.id, label: p.name })),
                  )
                : [{ value: "", label: "Tüm bölgeler" }].concat(
                    Object.keys(SC.OFFICERS).map((k) => ({ value: k, label: SC.OFFICERS[k].name })),
                  )
              ).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
        )}
        <div style={sx("width:250px;max-width:100%")}>
          <Input
            size="sm"
            iconLead="magnifier"
            placeholder="Yer adı ara…"
            aria-label="Yer ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div role="radiogroup" aria-label="Tür filtresi" style={sx("display:flex;gap:7px;flex-wrap:wrap")}>
          {kindOpts.map((o) => {
            const on = o.value === kind;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKind(o.value)}
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
        <div style={sx("margin-left:auto;font-size:13px;color:var(--text-muted)")}>
          {list.length + " yer · " + num(list.reduce((t, p) => t + p.units, 0)) + " birim"}
        </div>
      </div>

      {/* Dar ekranda tablo yatay kayar; gövde asla yana taşmaz. */}
      <div style={sx("margin-top:16px;background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;box-shadow:0 3px 4px rgba(0,0,0,.03);overflow-x:auto")}>
        <div style={sx("min-width:860px;display:flex;align-items:center;gap:14px;padding:12px 20px;border-bottom:1px solid var(--border-strong);font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--text-muted)")}>
          <div style={sx("flex:1;min-width:170px")}>YER</div>
          <div style={sx("width:78px")}>KAT</div>
          <div style={sx("width:88px")}>BİRİM</div>
          <div style={sx("width:150px")}>KAPSAMA</div>
          <div style={sx("width:150px")}>YETKİLİ</div>
          <div style={sx("width:118px")}>ANLAŞMA</div>
          <div style={sx("width:74px")} />
        </div>

        {list.slice(0, 60).map((p) => {
          const st = SC.placeStats(p.id);
          const openRecs = st ? st.openRecords : 0;
          const pct = Math.round((openRecs / (p.units || 1)) * 100);
          const off = officerOf(p);
          const bulk = SC.BULK_APPROVED.includes(p.id);
          const covColor = pct >= 40 ? "success" : pct >= 15 ? "warning" : "danger";
          return (
            <div key={p.id} style={sx("min-width:860px;display:flex;align-items:center;gap:14px;padding:13px 20px;border-bottom:1px solid var(--border-default)")}>
              <div style={sx("flex:1;min-width:170px")}>
                <div style={sx("font-size:13.5px;font-weight:600;line-height:1.35;color:var(--text-heading)")}>{p.name}</div>
                <div style={sx("font-size:12px;color:var(--text-muted);margin-top:2px")}>
                  {kindName(p.kind) + " · " + semtName(p.semt)}
                </div>
              </div>
              <div style={sx("width:78px;font-size:14px;font-weight:600;color:var(--text-body)")}>{(p.floors || []).length}</div>
              <div style={sx("width:88px;font-size:14px;font-weight:600;color:var(--text-body)")}>{num(p.units)}</div>
              <div style={sx("width:150px")}>
                <div style={sx("font-size:12px;color:var(--text-muted);margin-bottom:4px")}>
                  {num(openRecs) + " kayıt · %" + pct}
                </div>
                <Bar pct={pct} tone={covColor} />
              </div>
              <div style={sx("width:150px;font-size:12.5px;color:" + (off ? "var(--text-body)" : "var(--color-warning)"))}>
                {off || "Atanmamış"}
              </div>
              <div style={sx("width:118px")}>
                <Badge color={bulk ? "success" : "secondary"} variant="light">
                  {bulk ? "Toplu onay" : "Anlaşma yok"}
                </Badge>
              </div>
              <div style={sx("width:74px;text-align:right")}>
                {!locked && (
                  <Button variant="light" color="secondary" size="sm" onClick={() => openFor(p)}>
                    Düzelt
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {list.length === 0 && (
          <EmptyState
            icon="category"
            tone="neutral"
            title="Bu filtrede yer yok"
            description="Aramayı temizleyin ya da tür filtresini değiştirin."
          />
        )}
      </div>

      <Drawer
        open={open}
        onClose={close}
        title={editId ? "Yeri Düzelt" : "Yer Ekle"}
        subtitle="Kat ve birim sayısı kapsama yüzdesinin böleni — tahmin yazmayın"
        footer={
          <div style={sx("display:flex;gap:10px;justify-content:flex-end")}>
            <Button variant="ghost" color="dark" onClick={close}>Vazgeç</Button>
            <Button color="primary" disabled={locked} onClick={savePlace}>
              {editId ? "Değişiklikleri kaydet" : "Yeri ekle"}
            </Button>
          </div>
        }
      >
        <div style={sx("display:flex;flex-direction:column;gap:16px")}>
          <Input
            label="Yer adı"
            placeholder="Örn. Yıldız Han"
            value={pf.name}
            onChange={(e) => setPf((f) => ({ ...f, name: e.target.value }))}
            error={errors.name}
          />
          <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:12px")}>
            <Select
              label="Tür"
              hint="Çalışma saatini belirler"
              value={pf.kind}
              onChange={(e) => setPf((f) => ({ ...f, kind: e.target.value }))}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>{kindName(k)}</option>
              ))}
            </Select>
            <Select label="Semt" value={pf.semt} onChange={(e) => setPf((f) => ({ ...f, semt: e.target.value }))}>
              {SC.SEMTLER.map((s) => (
                <option key={s.id} value={s.id}>{s.tr}</option>
              ))}
            </Select>
          </div>
          <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:12px")}>
            <Input
              label="Kat sayısı"
              placeholder="5"
              hint="Zemin dahil"
              value={pf.floors}
              onChange={(e) => setPf((f) => ({ ...f, floors: e.target.value }))}
              error={errors.floors}
            />
            <Input
              label="Fiziksel birim"
              placeholder="142"
              hint="Kapı sayısı"
              value={pf.units}
              onChange={(e) => setPf((f) => ({ ...f, units: e.target.value }))}
              error={errors.units}
            />
          </div>
          <Select
            label="Yetkili"
            hint="Bu yerin saha sorumlusu"
            value={pf.officer}
            onChange={(e) => setPf((f) => ({ ...f, officer: e.target.value }))}
          >
            <option value="">Atanmamış</option>
            {Object.keys(SC.OFFICERS).map((k) => (
              <option key={k} value={k}>{SC.OFFICERS[k].name + " · " + SC.OFFICERS[k].tr}</option>
            ))}
          </Select>
          <div style={sx("padding:14px 16px;border-radius:10px;background:var(--surface-muted);border:1px solid var(--border-default)")}>
            <label style={sx("display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;color:var(--text-heading);cursor:pointer")}>
              <input
                type="checkbox"
                checked={pf.bulk}
                onChange={(e) => setPf((f) => ({ ...f, bulk: e.target.checked }))}
                style={sx("width:17px;height:17px;cursor:pointer")}
              />
              Han yönetimiyle toplu onay anlaşması var
            </label>
            <div style={sx("font-size:12px;color:var(--text-muted);margin-top:7px;text-wrap:pretty")}>
              Anlaşmalı yerde kiracı listesi tek seferde onaylanır; kapsama bir günde kapanır.
              Kapsamanın asıl motoru budur.
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
