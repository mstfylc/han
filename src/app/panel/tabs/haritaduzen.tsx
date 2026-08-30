"use client";

// Harita & Kat Planı (ADMIN-PLANI 17) — prototipteki `isHaritaDuzen` bölümünün portu.
//
// Pin yanlışsa alıcı kapıyı bulamaz. Yer konumu (enlem/boylam), giriş kapıları,
// yol tarifi notu ve kat kat koridor adları AD.setGeo ile `han-geo-v1`'e yazılır;
// AD.applyGeo omurgaya işler. Fatih sınırları dışına düşen koordinat kabul
// edilmez — yazım hatası sessizce geçmez.

import { useEffect, useState } from "react";

import * as AD from "@/data/han-admin";
import * as SC from "@/data/han-scale";
import { Button, Input, Select, Textarea } from "@/ds";
import { sx } from "@/lib/sx";

import { H1, SUB, num, type PanelTabProps } from "./shared";

export default function HaritaDuzen(props: PanelTabProps) {
  const [, setLocalRev] = useState(0);
  const bump = () => setLocalRev((n) => n + 1);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Düzeltilmiş pinler omurgaya açılışta işlenir ki liste ve seçenekler doğru olsun.
    AD.applyGeo(SC.PLACES as unknown as Record<string, unknown>[]);
    setReady(true);
  }, []);

  const [gp, setGp] = useState<{ place: string; lat: string; lng: string; ent: string; note: string }>({ place: "", lat: "", lng: "", ent: "", note: "" });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [errs, setErrs] = useState<{ lat?: string; lng?: string }>({});

  const locked = props.readOnly;
  const places = SC.PLACES.slice().sort((a, b) => b.units - a.units);
  const pid = gp.place || places[0]?.id || "";
  const place = SC.PLACES.find((p) => p.id === pid) || null;
  const saved = (ready ? AD.geoOf(pid) : null) || {};
  const geo = ready ? AD.allGeo() : {};

  // Form alanları seçili yerin mevcut değerinden başlar; kullanıcı yazınca state kazanır.
  const isLoaded = loadedFor === pid;
  const lat = isLoaded ? gp.lat : String(place ? place.lat : "");
  const lng = isLoaded ? gp.lng : String(place ? place.lng : "");
  const ent = isLoaded ? gp.ent : ((saved.entrances || []) as string[]).join(", ");
  const note = isLoaded ? gp.note : saved.note || "";
  const touch = (patch: Partial<typeof gp>) => {
    setLoadedFor(pid);
    setSavedName(null);
    setGp({ place: pid, lat, lng, ent, note, ...patch });
  };

  const save = () => {
    if (locked || !place) return props.say("Salt okuma rolü konum kaydedemez");
    const la = Number(String(lat).replace(",", "."));
    const ln = Number(String(lng).replace(",", "."));
    const e: { lat?: string; lng?: string } = {};
    // Fatih sınırları dışına düşen pin bir yazım hatasıdır; sessizce kabul etmeyiz.
    if (!(la > 40.9 && la < 41.1)) e.lat = "41.00 civarı olmalı";
    if (!(ln > 28.9 && ln < 29.1)) e.lng = "28.97 civarı olmalı";
    if (e.lat || e.lng) { setErrs(e); return props.say("Koordinat Fatih sınırları dışında — kaydedilmedi"); }
    AD.setGeo(pid, {
      lat: la,
      lng: ln,
      entrances: String(ent).split(",").map((x) => x.trim()).filter(Boolean),
      note: String(note).trim(),
    });
    AD.applyGeo(SC.PLACES as unknown as Record<string, unknown>[]);
    setErrs({});
    setSavedName(place.name);
    setLoadedFor(pid);
    bump();
    props.refresh();
    props.say(place.name + " konumu kaydedildi");
  };

  const corridors = (saved.corridors || {}) as Record<string, unknown>;

  return (
    <>
      <h1 style={sx(H1)}>Harita &amp; Kat Planı</h1>
      <p style={sx(SUB)}>Yer konumu, giriş kapıları ve koridor adları.</p>

      <div style={sx("margin-top:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:18px;align-items:start")}>
        <div style={sx("background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:20px")}>
          <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>Yer seçin</div>
          <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:4px;text-wrap:pretty")}>
            Pin yanlışsa alıcı kapıyı bulamaz. Konum, giriş kapıları ve koridor adları adres omurgasının fiziksel yüzüdür.
          </div>
          <div style={sx("margin-top:14px")}>
            <Select
              aria-label="Yer"
              value={pid}
              onChange={(e) => {
                setGp({ place: e.target.value, lat: "", lng: "", ent: "", note: "" });
                setLoadedFor(null);
                setSavedName(null);
                setErrs({});
              }}
            >
              {places.slice(0, 40).map((p) => (
                <option key={p.id} value={p.id}>{p.name + (ready && AD.geoOf(p.id) ? " · düzeltilmiş" : "")}</option>
              ))}
            </Select>
          </div>
          <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(148px,100%),1fr));gap:12px;margin-top:16px")}>
            <Input label="Enlem" placeholder="41.0161" value={lat} error={errs.lat} disabled={locked} onChange={(e) => touch({ lat: e.target.value })} />
            <Input label="Boylam" placeholder="28.9685" value={lng} error={errs.lng} disabled={locked} onChange={(e) => touch({ lng: e.target.value })} />
          </div>
          <div style={sx("margin-top:14px")}>
            <Input
              label="Giriş kapıları"
              placeholder="Mahmutpaşa kapısı, Nuruosmaniye kapısı"
              hint="Virgülle ayırın"
              value={ent}
              disabled={locked}
              onChange={(e) => touch({ ent: e.target.value })}
            />
          </div>
          <div style={sx("margin-top:14px")}>
            <Textarea
              label="Yol tarifi notu"
              rows={3}
              placeholder="Kuyumcular kapısından girin, ikinci koridor sağda…"
              value={note}
              disabled={locked}
              onChange={(e) => touch({ note: e.target.value })}
            />
          </div>
          {!locked && !!place && (
            <div style={sx("margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center")}>
              <Button color="primary" onClick={save}>Konumu kaydet</Button>
              <a
                href="/harita"
                target="_blank"
                rel="noopener"
                style={sx("display:inline-flex;align-items:center;height:40px;padding:0 15px;border-radius:8px;text-decoration:none;font-size:13.5px;font-weight:600;border:1px solid var(--border-strong);background:var(--surface-card);color:var(--text-body)")}
              >
                Haritada gör
              </a>
            </div>
          )}
          {!!savedName && (
            <div style={sx("margin-top:12px;padding:11px 13px;border-radius:9px;background:var(--color-success-soft);color:var(--color-success);font-size:12.5px;font-weight:600;text-wrap:pretty")}>
              {savedName + " konumu kaydedildi — alıcı tarafındaki harita ve yol tarifi de bu pini kullanır."}
            </div>
          )}
        </div>

        <div style={sx("display:flex;flex-direction:column;gap:16px")}>
          <div style={sx("background:var(--surface-card);border:1px solid var(--border-strong);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:20px")}>
            <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>Kat planı</div>
            <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:4px;text-wrap:pretty")}>
              Her katın koridor adı varsa kapı numarası tek başına yetmez — &ldquo;2. kat D koridoru No 118&rdquo; aranır hale gelir.
            </div>
            <div style={sx("margin-top:14px;display:flex;flex-direction:column;gap:10px")}>
              {(place?.floors || []).map((f) => {
                const unitsOnFloor = (SC.UNIT_INDEX[place!.id] || []).filter((u) => u.floor === f);
                const val = ((corridors[f] as string[] | undefined) || []).join(", ");
                return (
                  <div key={f} style={sx("display:flex;align-items:center;gap:11px;flex-wrap:wrap")}>
                    <span style={sx("flex:none;min-width:66px;font-size:13px;font-weight:600;color:var(--text-heading)")}>
                      {f === 0 ? "Zemin" : "Kat " + f}
                    </span>
                    <div style={sx("flex:1;min-width:150px")}>
                      <input
                        type="text"
                        aria-label={(f === 0 ? "Zemin" : "Kat " + f) + " koridor adları"}
                        placeholder="Koridor adları — A, B, C"
                        defaultValue={val}
                        disabled={locked}
                        onBlur={(e) => {
                          if (locked) return;
                          const next = e.target.value.split(",").map((x) => x.trim()).filter(Boolean);
                          if (next.join(", ") === val) return;
                          const cs: Record<string, unknown> = { ...corridors, [f]: next };
                          AD.setGeo(pid, { corridors: cs });
                          bump();
                          props.refresh();
                          props.say((place?.name || pid) + " · kat planı güncellendi");
                        }}
                        style={sx("width:100%;height:36px;padding:0 11px;border-radius:9px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:13px;color:var(--text-body);box-sizing:border-box")}
                      />
                    </div>
                    <span style={sx("font-size:12px;color:var(--text-muted);min-width:78px")}>{num(unitsOnFloor.length) + " birim"}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={sx("background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:20px")}>
            <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading);margin-bottom:12px")}>Konumu düzeltilmiş yerler</div>
            {Object.keys(geo).length === 0 && (
              <div style={sx("font-size:13px;color:var(--text-muted);text-wrap:pretty")}>
                Henüz elle düzeltme yok. Kaydedilen her konum burada listelenir ve alıcı tarafında da geçerli olur.
              </div>
            )}
            <div style={sx("display:flex;flex-direction:column;gap:9px")}>
              {Object.keys(geo).map((id) => (
                <div key={id} style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:9px;border-bottom:1px solid var(--border-default)")}>
                  <span style={sx("font-size:13px;color:var(--text-body)")}>{SC.PLACES.find((p) => p.id === id)?.name || id}</span>
                  <span style={sx("font-size:12px;color:var(--text-muted);font-family:var(--font-mono)")}>
                    {geo[id].lat ? Number(geo[id].lat).toFixed(4) + ", " + Number(geo[id].lng).toFixed(4) : "kat planı"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
