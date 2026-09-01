"use client";

// Sponsorluk (ADMIN-PLANI 1c) — prototipteki `isSponsorluk` bölümünün portu.
//
// Kural kodda korunur: organik sıralama satılmaz; yanıt oranı %85'in altına
// düşen yerleşim OTOMATİK durur ve elle açılamaz — düğme bile çıkmaz. Yeni
// yerleşim yalnız aktif ve eşiğin üstündeki kayıtlardan seçilir. Yayın anahtarı
// Sistem Ayarları'ndaki showSponsored'a bağlıdır: kapalıysa uyarı gösterilir.

import { useEffect, useState } from "react";

import * as SC from "@/data/han-scale";
import { Alert, Button, Drawer, Input, Select } from "@/ds";
import { sx } from "@/lib/sx";

import { Pill, type PanelTabProps, H1, SUB } from "./shared";

const STAT_CARD = "background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:18px";

export default function Sponsorluk(props: PanelTabProps) {
  const [, setLocalRev] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Sıra önemli: kural motoru kayıt performansını okur, o yüzden ayarlar önce.
    SC.loadSettings();
    SC.loadSponsors();
    setReady(true);
  }, []);
  const bump = () => setLocalRev((n) => n + 1);

  const [filter, setFilter] = useState<"all" | "aktif" | "durdu">("all");
  const [open, setOpen] = useState(false);
  const [sf, setSf] = useState<{ rec: string; kind: SC.Sponsor["kind"]; until: string }>({ rec: "", kind: "kategori", until: "30.09.2026" });

  const canEdit = SC.can(props.role, "sponsorluk") && !props.readOnly;
  const recOf = (id: string) => SC.RECORDS.find((r) => r.id === id);
  const kindLabel = (k: string) => (SC.SPONSOR_KINDS[k] || {}).tr || k;

  const all = ready ? SC.SPONSORS.slice() : [];
  const live = all.filter((x) => !x.paused);
  const auto = all.filter((x) => x.autoPaused);
  const rows = all.filter((x) => (filter === "all" ? true : filter === "aktif" ? !x.paused : !!x.paused));
  const showSponsored = !!SC.SETTINGS.showSponsored.value;

  // Yeni yerleşim yalnız aktif ve eşik üstü kayıtlardan seçilir; aynı kayıt aynı
  // türde ikinci kez eklenmez.
  const eligible = SC.RECORDS
    .filter((r) => r.status === "aktif" && (r.respRate || 0) >= SC.SPONSOR_PAUSE_RATE)
    .filter((r) => !all.some((x) => x.recordId === r.id && x.kind === sf.kind))
    .slice(0, 60);

  const stats = [
    { label: "Aktif yerleşim", value: String(live.length), note: "yayında görünüyor" },
    { label: "Duraklatılmış", value: String(all.length - live.length), note: "yayında değil" },
    { label: "Performanstan durdu", value: String(auto.length), note: "yanıt oranı %" + SC.SPONSOR_PAUSE_RATE + " altı" },
    { label: "Yayın anahtarı", value: showSponsored ? "Açık" : "Kapalı", note: showSponsored ? "Sistem Ayarları'ndan" : "Tümü gizli" },
  ];

  const addPlacement = () => {
    const rec = recOf(sf.rec);
    if (!rec) return;
    SC.addSponsor({ recordId: rec.id, kind: sf.kind, cat: rec.cat, place: rec.place, until: sf.until || "30.09.2026", paused: false });
    setOpen(false);
    setSf({ rec: "", kind: "kategori", until: "30.09.2026" });
    bump();
    props.refresh();
    props.say(rec.name + " · yerleşim eklendi");
  };

  return (
    <>
      <h1 style={sx(H1)}>Sponsorluk</h1>
      <p style={sx(SUB)}>
        Ücretli yerleşimler — kim, nerede, ne zamana kadar, performansı tutuyor mu.
      </p>

      <div style={sx("margin-top:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:16px;margin-bottom:18px")}>
        {stats.map((s) => (
          <div key={s.label} style={sx(STAT_CARD)}>
            <div style={sx("font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:10px")}>{s.label}</div>
            <div style={sx("font-size:26px;font-weight:700;letter-spacing:-.01em;color:var(--text-heading)")}>{s.value}</div>
            <div style={sx("font-size:12px;color:var(--text-muted);margin-top:4px")}>{s.note}</div>
          </div>
        ))}
      </div>

      <Alert color="info" variant="light" title="Yerleşim kuralı">
        Organik sıralama satılmaz. Ücretli yerleşim yalnız etiketli ayrı alanda çıkar ve yanıt oranı
        %{SC.SPONSOR_PAUSE_RATE}&apos;in altına düşen dükkânın yerleşimi otomatik durur — elle açılamaz.
      </Alert>

      {ready && !showSponsored && (
        <div style={sx("margin-top:12px")}>
          <Alert color="warning" variant="light" title="Yayın anahtarı kapalı">
            Sistem Ayarları&apos;ndaki &quot;Sponsorlu yerleşim görünsün&quot; kapalı: buradaki hiçbir yerleşim şu an
            alıcıya gösterilmiyor. Yayına dönmesi için anahtarın Sistem Ayarları&apos;ndan açılması gerekir.
          </Alert>
        </div>
      )}

      <div style={sx("margin-top:16px;background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);overflow:hidden")}>
        <div style={sx("padding:15px 20px;border-bottom:1px solid var(--border-default);display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
          <span style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>Yerleşimler</span>
          <div role="group" aria-label="Yerleşim filtresi" style={sx("display:inline-flex;gap:4px;padding:3px;border-radius:9px;background:var(--surface-muted);border:1px solid var(--border-default)")}>
            {([["all", "Tümü · " + all.length], ["aktif", "Aktif · " + live.length], ["durdu", "Duran · " + (all.length - live.length)]] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={filter === v}
                onClick={() => setFilter(v)}
                style={sx(
                  "height:26px;padding:0 11px;border-radius:7px;border:none;font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;" +
                  (filter === v
                    ? "background:var(--surface-card);color:var(--text-heading);box-shadow:0 1px 2px rgba(0,0,0,.08)"
                    : "background:transparent;color:var(--text-muted)"),
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {canEdit && (
            <span style={sx("margin-left:auto")}>
              <Button color="accent" size="sm" iconStart="plus-squared" onClick={() => setOpen(true)}>
                Yerleşim Ekle
              </Button>
            </span>
          )}
        </div>

        <div>
          {rows.length === 0 && (
            <div style={sx("padding:26px 20px;font-size:13px;color:var(--text-muted);text-align:center")}>
              {all.length ? "Bu filtrede yerleşim yok." : "Henüz sponsorlu yerleşim yok."}
            </div>
          )}
          {rows.map((s) => {
            const rec = recOf(s.recordId);
            const rate = Math.round(rec?.respRate || 0);
            const id = SC.sponsorId(s);
            const rateColor = rate >= 90 ? "success" : rate >= SC.SPONSOR_PAUSE_RATE ? "warning" : "danger";
            return (
              <div key={id} style={sx("display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--border-default);flex-wrap:wrap")}>
                <div style={sx("flex:none;width:9px;height:9px;border-radius:999px;background:var(--color-" + (s.paused ? (s.autoPaused ? "danger" : "secondary") : "success") + ")")} />
                <div style={sx("flex:1;min-width:180px")}>
                  <div style={sx("font-size:13.5px;font-weight:600;line-height:1.35;color:var(--text-heading)")}>{rec?.name || s.recordId}</div>
                  <div style={sx("font-size:12px;color:var(--text-muted);margin-top:2px")}>
                    {kindLabel(s.kind) + " · " + (SC.PLACES.find((p) => p.id === s.place)?.name || s.place)}
                  </div>
                </div>
                <div style={sx("width:112px")}>
                  <div style={sx("font-size:11px;color:var(--text-muted);margin-bottom:4px")}>Yanıt oranı</div>
                  <div style={sx("height:8px;border-radius:999px;background:var(--surface-muted);overflow:hidden")} role="img" aria-label={"Yanıt oranı %" + rate}>
                    <div style={sx("height:100%;border-radius:999px;width:" + Math.max(0, Math.min(100, rate)) + "%;background:var(--color-" + rateColor + ")")} />
                  </div>
                </div>
                <div style={sx("width:106px;font-size:12px;color:var(--text-muted)")}>{s.until}</div>
                <Pill
                  label={s.autoPaused ? "Otomatik durdu" : s.paused ? "Duraklatıldı" : "Aktif"}
                  t={s.autoPaused ? "danger" : s.paused ? "secondary" : "success"}
                />
                {/* Otomatik duran yerleşim elle açılamaz — kural satılamaz. */}
                {canEdit && !s.autoPaused && (
                  <span style={sx("display:flex;gap:7px")}>
                    <Button
                      variant="light"
                      color="secondary"
                      size="sm"
                      onClick={() => {
                        SC.setSponsor(id, { paused: !s.paused });
                        bump();
                        props.refresh();
                        props.say((rec?.name || s.recordId) + (s.paused ? " · yerleşim sürdürüldü" : " · yerleşim duraklatıldı"));
                      }}
                    >
                      {s.paused ? "Sürdür" : "Duraklat"}
                    </Button>
                    <Button
                      variant="ghost"
                      color="danger"
                      size="sm"
                      onClick={() => {
                        SC.dropSponsor(id);
                        bump();
                        props.refresh();
                        props.say((rec?.name || s.recordId) + " · yerleşim kaldırıldı");
                      }}
                    >
                      Kaldır
                    </Button>
                  </span>
                )}
                {s.autoPaused && (
                  <span style={sx("font-size:12px;color:var(--color-danger);font-weight:600")}>Performans düştü — elle açılamaz</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Yerleşim Ekle"
        subtitle="Yalnız aktif ve yanıt oranı eşiğin üstünde olan kayıtlar"
        footer={
          <div style={sx("display:flex;gap:10px;justify-content:flex-end")}>
            <Button variant="ghost" color="dark" onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button color="primary" disabled={!sf.rec} onClick={addPlacement}>Yerleşimi ekle</Button>
          </div>
        }
      >
        <div style={sx("display:flex;flex-direction:column;gap:16px")}>
          <Select label="Kayıt" value={sf.rec} onChange={(e) => setSf({ ...sf, rec: e.target.value })}>
            <option value="">{eligible.length ? "Kayıt seçin…" : "Uygun kayıt yok"}</option>
            {eligible.map((r) => (
              <option key={r.id} value={r.id}>{r.name + " · %" + Math.round(r.respRate || 0) + " yanıt"}</option>
            ))}
          </Select>
          <Select label="Yerleşim türü" value={sf.kind} onChange={(e) => setSf({ ...sf, kind: e.target.value as SC.Sponsor["kind"], rec: "" })}>
            {Object.keys(SC.SPONSOR_KINDS).map((k) => (
              <option key={k} value={k}>{SC.SPONSOR_KINDS[k].tr}</option>
            ))}
          </Select>
          <Input label="Bitiş tarihi" placeholder="30.09.2026" value={sf.until} onChange={(e) => setSf({ ...sf, until: e.target.value })} />
          {!!sf.rec && (
            <div style={sx("padding:13px 15px;border-radius:10px;background:var(--surface-muted);border:1px solid var(--border-default);font-size:12.5px;color:var(--text-body);text-wrap:pretty")}>
              {((SC.SPONSOR_KINDS[sf.kind] || {}).noteTr || "") + " Yanıt oranı %" + SC.SPONSOR_PAUSE_RATE + " altına düşerse yerleşim kendiliğinden durur."}
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
}
