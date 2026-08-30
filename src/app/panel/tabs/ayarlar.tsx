"use client";

// Sistem Ayarları (ADMIN-PLANI 1b) — prototipteki `isAyarlar` bölümünün portu.
//
// Beş ayar (showDeclared · declaredCanPrice · showUnits · showSponsored ·
// freshDays) gerçekten açılıp kapanır ve `han-settings-v1`'e yazılır; Web ile
// Editör aynı değeri okur. Her ayarın altında KAÇ KAYDI ETKİLEDİĞİ yazar
// (SC.settingImpact) — soyut anahtar değil, sayılı sonuç. Yanda "Alıcı şu an
// ne görüyor" paneli ayarların toplam sonucunu canlı omurgadan gösterir.

import { useEffect, useState } from "react";

import * as SC from "@/data/han-scale";
import { Alert } from "@/ds";
import { sx } from "@/lib/sx";

import { H1, SUB, num, type PanelTabProps } from "./shared";

const SETTING_KEYS = ["showDeclared", "declaredCanPrice", "showUnits", "showSponsored", "freshDays"];

/** DS'te Switch yok; prototipteki 40×22 anahtarın küçük yerel karşılığı. */
function Switch({ on, disabled, label, onToggle }: { on: boolean; disabled: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      style={sx(
        "flex:none;width:40px;height:22px;border-radius:999px;border:none;padding:2px;cursor:" + (disabled ? "not-allowed" : "pointer") +
        ";background:" + (on ? "var(--color-primary)" : "var(--border-strong)") +
        ";display:inline-flex;align-items:center;justify-content:" + (on ? "flex-end" : "flex-start") +
        ";transition:background .15s ease;opacity:" + (disabled ? ".55" : "1"),
      )}
    >
      <span style={sx("width:18px;height:18px;border-radius:999px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25)")} />
    </button>
  );
}

export default function Ayarlar(props: PanelTabProps) {
  // Ayar overlay'i diskte durur; modül her dokümanda ayrı yüklendiği için
  // açılışta okunması şart. SSR ile uyuşmazlık çıkmasın diye mount sonrası.
  const [, setLocalRev] = useState(0);
  useEffect(() => {
    SC.loadSettings();
    SC.loadSponsors();
    setLocalRev((n) => n + 1);
  }, []);
  const bump = () => setLocalRev((n) => n + 1);

  const write = (patch: Record<string, unknown>, msg: string) => {
    if (props.readOnly) return props.say("Salt okuma rolü ayar değiştiremez");
    SC.saveSettings(patch);
    bump();
    props.refresh();
    props.say(msg);
  };

  const beyan = SC.RECORDS.filter((r) => r.status === "beyan").length;
  const pub = SC.RECORDS.filter((r) => r.status === "aktif" || r.status === "onayli").length;
  const vis = pub + (SC.SETTINGS.showDeclared.value ? beyan : 0);
  const units = SC.PLACES.reduce((t, p) => t + p.units, 0);

  const visibilityRows: [string, string, string][] = [
    ["Aramada görünen kayıt", num(vis) + " / " + num(SC.RECORDS.length), vis > pub ? "success" : "warning"],
    ["Bunun beyan olanı", SC.SETTINGS.showDeclared.value ? num(beyan) : "0 · gizli", SC.SETTINGS.showDeclared.value ? "warning" : "secondary"],
    ["Talep alabilen kayıt", num(pub + (SC.SETTINGS.declaredCanPrice.value ? beyan : 0)), "primary"],
    ["Görünen kayıtsız birim", SC.SETTINGS.showUnits.value ? num(units - SC.RECORDS.length) : "0 · gizli", "secondary"],
    ["Sponsorlu yerleşim", SC.SETTINGS.showSponsored.value ? SC.SPONSORS.filter((x) => !x.paused).length + " aktif" : "kapalı", SC.SETTINGS.showSponsored.value ? "info" : "secondary"],
  ];

  return (
    <>
      <h1 style={sx(H1)}>Sistem Ayarları</h1>
      <p style={sx(SUB)}>
        Yayın kuralları kod içinde sabit değil: buradan açılıp kapanır ve alıcı aramasını anında etkiler.
      </p>

      <div style={sx("margin-top:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(310px,100%),1fr));gap:18px;align-items:start")}>
        <div style={sx("display:flex;flex-direction:column;gap:14px")}>
          {SETTING_KEYS.map((k) => {
            const s = SC.SETTINGS[k];
            const isNum = typeof s.value === "number";
            const im = SC.settingImpact(k);
            const good = isNum ? true : !!s.value;
            return (
              <div key={k} style={sx("background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:18px 20px")}>
                <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:16px")}>
                  <div style={sx("min-width:0")}>
                    <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>{s.tr}</div>
                    <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:4px;text-wrap:pretty")}>{s.noteTr}</div>
                  </div>
                  <div style={sx("flex:none;display:flex;align-items:center;gap:9px")}>
                    {isNum ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={s.tr}
                        defaultValue={String(s.value)}
                        disabled={props.readOnly}
                        onBlur={(e) => {
                          const n = Number(String(e.target.value).replace(/\D/g, ""));
                          if (n > 0 && n !== s.value) write({ [k]: n }, "Tazelik süresi " + n + " gün olarak kaydedildi");
                        }}
                        style={sx("width:96px;height:36px;padding:0 10px;border-radius:9px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:14px;color:var(--text-body)")}
                      />
                    ) : (
                      <Switch
                        on={!!s.value}
                        disabled={props.readOnly}
                        label={s.tr}
                        onToggle={() => write({ [k]: !s.value }, s.tr + (s.value ? " — kapatıldı" : " — açıldı"))}
                      />
                    )}
                  </div>
                </div>
                <div
                  style={sx(
                    "margin-top:12px;padding:10px 12px;border-radius:8px;font-size:12.5px;font-weight:600;background:var(--color-" +
                    (good ? "info" : "warning") + "-soft);color:var(--color-" + (good ? "info" : "warning") + ")",
                  )}
                >
                  {(good ? im.tr : im.offTr) || im.tr}
                </div>
              </div>
            );
          })}
        </div>

        <div style={sx("display:flex;flex-direction:column;gap:14px")}>
          <div style={sx("background:var(--surface-card);border:1px solid var(--border-strong);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:20px")}>
            <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading);margin-bottom:6px")}>Alıcı şu an ne görüyor</div>
            <div style={sx("font-size:12.5px;color:var(--text-muted);margin-bottom:14px;text-wrap:pretty")}>
              Ayarların toplam sonucu. Kayıt sayıları canlı omurgadan gelir.
            </div>
            <div style={sx("display:flex;flex-direction:column;gap:11px")}>
              {visibilityRows.map((v) => (
                <div key={v[0]} style={sx("display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:11px;border-bottom:1px solid var(--border-default)")}>
                  <span style={sx("font-size:13px;color:var(--text-body)")}>{v[0]}</span>
                  <span style={sx("font-size:13px;font-weight:700;color:var(--color-" + v[2] + ")")}>{v[1]}</span>
                </div>
              ))}
            </div>
          </div>
          <Alert color="warning" variant="light" title="Bu ayarlar yürürlükte">
            Değişiklik anında kaydedilir ve alıcı aramasını doğrudan etkiler. Onaysız kaydı yayından
            kaldırmak kapsamanın görünen kısmını üçte bire düşürür.
          </Alert>
        </div>
      </div>
    </>
  );
}
