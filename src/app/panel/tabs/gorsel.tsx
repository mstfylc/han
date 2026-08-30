"use client";

// Mağaza Görselleri (ADMIN-PLANI 16) — prototipteki `isGorsel` bölümünün portu.
//
// Uçtan uca akış: kayıt seç → görsel yuvası aç → tür + açıklama → sırala →
// kapak seç → onayla/reddet. Kurallar AD katmanında kodludur: kapak TEK olabilir
// (yeni kapak seçilince eskisi düşer), kapak silinirse ilk yayındaki görsel
// kapak olur, onaysız görsel alıcıda görünmez. Kayıt listesi fotoğrafı
// olmayanları öne alır — iş listesi budur.
//
// Gerçek dosya yükleme yerine prototipteki gibi placeholder/asset seçimiyle
// çalışır: MediaItem'ın `slot` alanı bu portta GÖRSELİN URL'sini taşır
// (ör. "/assets/ph-kilif.png"). Alıcı tarafı kapağı şöyle okur:
// AD.mediaOf(recordId) içinden status==="onayli" && cover olan öğenin slot'u.

import { useEffect, useState } from "react";

import * as AD from "@/data/han-admin";
import * as SC from "@/data/han-scale";
import { Alert, Button, Select } from "@/ds";
import { sx } from "@/lib/sx";

import { H1, Pill, SUB, num, type PanelTabProps } from "./shared";

/** public/assets içindeki yerleşik görsel havuzu. */
const ASSETS: { value: string; label: string }[] = [
  { value: "/assets/ph-shop.png", label: "Dükkân vitrini" },
  { value: "/assets/ph-han.png", label: "Han içi" },
  { value: "/assets/ph-gate.png", label: "Kapı · giriş" },
  { value: "/assets/ph-kilif.png", label: "Telefon kılıfı" },
  { value: "/assets/ph-sarj.png", label: "Powerbank · şarj" },
  { value: "/assets/ph-tekstil.png", label: "Tekstil" },
  { value: "/assets/ph-poset.png", label: "Poşet · ambalaj" },
  { value: "/assets/ph-taki.png", label: "Takı" },
  { value: "/assets/ph-hali.png", label: "Halı" },
  { value: "/assets/ph-deri.png", label: "Deri" },
  { value: "/assets/ph-baharat.png", label: "Baharat" },
  { value: "/assets/ph-hediyelik.png", label: "Hediyelik" },
  { value: "/assets/ph-landmark.png", label: "Simge yapı" },
  { value: "/assets/ph-kampanya.png", label: "Kampanya" },
];

const CAT_ASSET: Record<string, string> = {
  kilif: "/assets/ph-kilif.png", sarj: "/assets/ph-sarj.png", tekstil: "/assets/ph-tekstil.png",
  poset: "/assets/ph-poset.png", taki: "/assets/ph-taki.png", bijuteri: "/assets/ph-taki.png",
  hali: "/assets/ph-hali.png", deri: "/assets/ph-deri.png", baharat: "/assets/ph-baharat.png",
  hediyelik: "/assets/ph-hediyelik.png", gida: "/assets/ph-baharat.png",
};

const ACTION_BTN = (tone: string) =>
  "height:30px;padding:0 11px;border-radius:7px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;color:var(--color-" + tone + ")";

function mediaCardStyle(tone: string | null): string {
  return "background:var(--surface-card);border:1px solid var(--border-" +
    (tone ? "strong" : "default") + ");border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:14px" +
    (tone ? ";border-left:3px solid var(--color-" + tone + ")" : "");
}

export default function Gorsel(props: PanelTabProps) {
  const [, setLocalRev] = useState(0);
  const bump = () => setLocalRev((n) => n + 1);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const [mdRec, setMdRec] = useState("");

  const locked = props.readOnly;
  // Fotoğrafsız kayıtlar önce: iş listesi buradan başlar.
  const sorted = SC.RECORDS.slice().sort(
    (a, b) => (a.photos || 0) - (b.photos || 0) ||
      (b.status === "aktif" ? 1 : 0) - (a.status === "aktif" ? 1 : 0),
  );
  const recId = mdRec || sorted[0]?.id || "";
  const rec = SC.RECORDS.find((r) => r.id === recId) || null;
  const list = ready ? AD.mediaOf(recId) : [];
  const noPhoto = SC.RECORDS.filter((r) => !r.photos).length;
  const canEdit = !locked && !!rec;
  const defaultAsset = CAT_ASSET[rec?.cat || ""] || "/assets/ph-shop.png";

  const act = (fn: () => void, msg: string) => {
    if (locked) return props.say("Salt okuma rolü görsel yönetemez");
    fn();
    bump();
    props.refresh();
    props.say(msg);
  };

  return (
    <>
      <h1 style={sx(H1)}>Mağaza Görselleri</h1>
      <p style={sx(SUB)}>Yükleme, sıra, kapak ve onay — uçtan uca.</p>

      <div style={sx("margin-top:18px;background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;padding:15px 20px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
        <div style={sx("width:290px;max-width:100%")}>
          <Select size="sm" aria-label="Kayıt seç" value={recId} onChange={(e) => setMdRec(e.target.value)}>
            {sorted.slice(0, 60).map((r) => (
              <option key={r.id} value={r.id}>
                {(r.name || r.id) + " · " + ((ready ? AD.mediaOf(r.id).length : 0) || r.photos || 0) + " görsel"}
              </option>
            ))}
          </Select>
        </div>
        <div style={sx("font-size:13px;color:var(--text-muted)")}>
          {rec ? list.length + " yuva · " + list.filter((x) => x.status === "onayli").length + " yayında" : ""}
        </div>
        {canEdit && (
          <span style={sx("margin-left:auto")}>
            <Button
              color="accent"
              size="sm"
              iconStart="plus-squared"
              onClick={() =>
                act(() => AD.addMedia(recId, { slot: defaultAsset, kind: "vitrin", caption: "" }),
                  "Görsel yuvası açıldı — onay bekliyor")}
            >
              Görsel Yuvası Ekle
            </Button>
          </span>
        )}
      </div>

      <Alert color="info" variant="light" title="Fotoğraf kaydın en zayıf alanı">
        {num(noPhoto)} kayıtta hiç fotoğraf yok. Vitrini görünmeyen dükkâna alıcı güvenmiyor — listede
        fotoğrafsız kayıtlar önce geliyor.
      </Alert>

      {list.length === 0 && (
        <div style={sx("margin-top:16px;background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;padding:34px 22px;text-align:center")}>
          <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>Bu kaydın görseli yok</div>
          <div style={sx("font-size:13px;color:var(--text-muted);margin-top:5px;max-width:56ch;margin-left:auto;margin-right:auto;text-wrap:pretty")}>
            &ldquo;Görsel Yuvası Ekle&rdquo; ile boş bir yuva açın, görsel kaynağını seçin. Kapak, sıra ve onay buradan yönetilir.
          </div>
        </div>
      )}

      <div style={sx("margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(270px,100%),1fr));gap:16px")}>
        {list.map((p, i) => {
          const st = AD.MEDIA_STATES[p.status];
          const src = p.slot && p.slot.startsWith("/") ? p.slot : defaultAsset;
          return (
            <div key={p.id} style={sx(mediaCardStyle(p.cover ? "accent" : p.status === "onayli" ? "success" : p.status === "red" ? "danger" : null))}>
              <div
                role="img"
                aria-label={(AD.MEDIA_KINDS[p.kind] || {}).tr + (p.caption ? " — " + p.caption : "")}
                style={sx("position:relative;border-radius:10px;overflow:hidden;background:var(--surface-muted) url(" + src + ") center/cover no-repeat;height:170px")}
              />
              <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px")}>
                {p.cover && <Pill label="Kapak" t="accent" />}
                <Pill label={st.tr} t={st.tone} />
                <span style={sx("font-size:12px;color:var(--text-muted)")}>{(AD.MEDIA_KINDS[p.kind] || {}).tr}</span>
              </div>

              <div style={sx("margin-top:11px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(120px,100%),1fr));gap:8px")}>
                <Select
                  size="sm"
                  aria-label="Görsel kaynağı"
                  value={src}
                  disabled={locked}
                  onChange={(e) => act(() => AD.setMedia(recId, p.id, { slot: e.target.value }), "Görsel kaynağı değişti")}
                >
                  {ASSETS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </Select>
                <Select
                  size="sm"
                  aria-label="Görsel türü"
                  value={p.kind}
                  disabled={locked}
                  onChange={(e) => act(() => AD.setMedia(recId, p.id, { kind: e.target.value as AD.MediaKind }), "Görsel türü değişti")}
                >
                  {(Object.keys(AD.MEDIA_KINDS) as AD.MediaKind[]).map((k) => (
                    <option key={k} value={k}>{AD.MEDIA_KINDS[k].tr}</option>
                  ))}
                </Select>
              </div>

              <div style={sx("margin-top:8px")}>
                <input
                  type="text"
                  aria-label="Açıklama"
                  placeholder="Açıklama — örn. Vitrin, Mahmutpaşa kapısı"
                  defaultValue={p.caption}
                  disabled={locked}
                  onBlur={(e) => {
                    if (e.target.value !== p.caption) {
                      AD.setMedia(recId, p.id, { caption: e.target.value });
                      bump();
                      props.refresh();
                    }
                  }}
                  style={sx("width:100%;height:36px;padding:0 11px;border-radius:9px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:13px;color:var(--text-body);box-sizing:border-box")}
                />
              </div>

              {!locked && (
                <div style={sx("margin-top:11px;display:flex;gap:6px;flex-wrap:wrap")}>
                  {p.status !== "onayli" && (
                    <button type="button" style={sx(ACTION_BTN("success"))} onClick={() => act(() => AD.setMedia(recId, p.id, { status: "onayli" }), "Görsel onaylandı — alıcıda görünür")}>
                      Onayla
                    </button>
                  )}
                  {p.status !== "red" && (
                    <button type="button" style={sx(ACTION_BTN("danger"))} onClick={() => act(() => AD.setMedia(recId, p.id, { status: "red", cover: false }), "Görsel reddedildi")}>
                      Reddet
                    </button>
                  )}
                  {!p.cover && p.status === "onayli" && (
                    <button type="button" style={sx(ACTION_BTN("primary"))} onClick={() => act(() => AD.setMedia(recId, p.id, { cover: true }), "Kapak değişti — kapak tek olabilir")}>
                      Kapak yap
                    </button>
                  )}
                  {i > 0 && (
                    <button type="button" aria-label="Yukarı taşı" style={sx(ACTION_BTN("secondary"))} onClick={() => act(() => AD.moveMedia(recId, p.id, -1), "Sıra değişti")}>
                      ↑
                    </button>
                  )}
                  {i < list.length - 1 && (
                    <button type="button" aria-label="Aşağı taşı" style={sx(ACTION_BTN("secondary"))} onClick={() => act(() => AD.moveMedia(recId, p.id, 1), "Sıra değişti")}>
                      ↓
                    </button>
                  )}
                  <button
                    type="button"
                    style={sx(ACTION_BTN("danger"))}
                    onClick={() => act(() => AD.dropMedia(recId, p.id),
                      p.cover ? "Görsel silindi — kapak ilk yayındaki görsele geçti" : "Görsel silindi")}
                  >
                    Sil
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
