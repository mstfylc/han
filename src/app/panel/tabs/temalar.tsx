"use client";

// Temalar — prototipteki `isTemalar` bölümünün portu.
//
// İki eksenli tema: `data-theme` markayı, `.dark` sınıfı şemayı belirler —
// ikisi bağımsızdır. Dört marka styles/tokens/themes.css'te tanımlıdır
// (uyanik · han · mansis · okyanus); seçim tüm arayüze anında uygulanır ve
// prototipteki anahtarla (`han-panel-theme`) depoya yazılır.

import { useEffect, useState } from "react";

import { Alert, Badge, Button } from "@/ds";
import { sx } from "@/lib/sx";
import { readKey, writeKey } from "@/services/storage";

import { H1, SUB, type PanelTabProps } from "./shared";

const THEME_KEY = "han-panel-theme";

const THEMES = [
  { id: "uyanik", title: "Uyanık", desc: "Lacivert + turuncu · kanonik", primary: "#1F3864", accent: "#E08A2B" },
  { id: "han", title: "HAN", desc: "Lacivert + altın · han keşif", primary: "#14304F", accent: "#C9A227" },
  { id: "mansis", title: "Mansis", desc: "Navy + cyan · premium SaaS", primary: "#1B3A6B", accent: "#22B8CF" },
  { id: "okyanus", title: "Okyanus", desc: "Teal + mercan · örnek", primary: "#0E7490", accent: "#FB7185" },
];

function applyTheme(theme: string, dark: boolean) {
  const el = document.documentElement;
  el.setAttribute("data-theme", theme);
  el.classList.toggle("dark", !!dark);
  if (document.body) document.body.classList.toggle("dark", !!dark);
}

export default function Temalar(props: PanelTabProps) {
  const [theme, setTheme] = useState("han");
  const [dark, setDark] = useState(false);

  // Tercih depodan gelir ve mount sonrası uygulanır — SSR html'i han/açık ile
  // gelir, seçim varsa ilk karede üstüne oturur.
  useEffect(() => {
    const v = readKey<{ theme?: string; dark?: boolean }>(THEME_KEY, {});
    const t = v.theme && THEMES.some((x) => x.id === v.theme) ? v.theme : "han";
    setTheme(t);
    setDark(!!v.dark);
    applyTheme(t, !!v.dark);
  }, []);

  const pick = (t: string, d: boolean, msg: string) => {
    setTheme(t);
    setDark(d);
    applyTheme(t, d);
    writeKey(THEME_KEY, { theme: t, dark: d });
    props.refresh();
    props.say(msg);
  };

  return (
    <>
      <h1 style={sx(H1)}>Temalar</h1>
      <p style={sx(SUB)}>Marka × şema — iki eksenli tema yapısı.</p>

      <div style={sx("margin-top:18px;background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:20px;margin-bottom:18px")}>
        <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading);margin-bottom:4px")}>İki eksenli tema</div>
        <div style={sx("font-size:13px;color:var(--text-muted);margin-bottom:16px")}>
          <code style={sx("font-family:var(--font-mono)")}>data-theme</code> markayı,{" "}
          <code style={sx("font-family:var(--font-mono)")}>.dark</code> şemayı belirler — ikisi bağımsız.
          Seçim tüm arayüze anında uygulanır.
        </div>
        <div style={sx("display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
          <div role="group" aria-label="Marka" style={sx("display:inline-flex;gap:4px;padding:3px;border-radius:10px;background:var(--surface-muted);border:1px solid var(--border-default)")}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={theme === t.id}
                onClick={() => pick(t.id, dark, t.title + " teması uygulandı")}
                style={sx(
                  "height:34px;padding:0 14px;border-radius:8px;border:none;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;" +
                  (theme === t.id
                    ? "background:var(--surface-card);color:var(--text-heading);box-shadow:0 1px 2px rgba(0,0,0,.08)"
                    : "background:transparent;color:var(--text-muted)"),
                )}
              >
                {t.title}
              </button>
            ))}
          </div>
          <div style={sx("display:flex;align-items:center;gap:8px;margin-left:8px")}>
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              aria-label="Koyu şema"
              onClick={() => pick(theme, !dark, dark ? "Açık şemaya geçildi" : "Koyu şemaya geçildi")}
              style={sx(
                "flex:none;width:40px;height:22px;border-radius:999px;border:none;padding:2px;cursor:pointer;background:" +
                (dark ? "var(--color-primary)" : "var(--border-strong)") +
                ";display:inline-flex;align-items:center;justify-content:" + (dark ? "flex-end" : "flex-start") + ";transition:background .15s ease",
              )}
            >
              <span style={sx("width:18px;height:18px;border-radius:999px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25)")} />
            </button>
            <span style={sx("font-size:13px;font-weight:500;color:var(--text-body)")}>Koyu şema</span>
          </div>
        </div>
      </div>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:16px;margin-bottom:18px")}>
        {THEMES.map((t) => {
          const active = theme === t.id;
          return (
            <div
              key={t.id}
              style={sx(
                "background:var(--surface-card);border:1px solid " +
                (active ? "var(--color-primary)" : "var(--border-default)") +
                ";border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);overflow:hidden",
              )}
            >
              <div style={sx("display:flex;height:64px")}>
                <div style={sx("flex:2;background:" + t.primary)} />
                <div style={sx("flex:1;background:" + t.accent)} />
              </div>
              <div style={sx("padding:14px 16px")}>
                <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:8px")}>
                  <span style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>{t.title}</span>
                  {active && <Badge color="primary" variant="light">Aktif</Badge>}
                </div>
                <div style={sx("font-size:12px;color:var(--text-muted);margin-top:3px")}>{t.desc}</div>
                <div style={sx("display:flex;gap:10px;margin-top:10px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted)")}>
                  <span>{t.primary}</span>
                  <span>{t.accent}</span>
                </div>
                <div style={sx("margin-top:12px")}>
                  <Button
                    variant={active ? "light" : "outline"}
                    color="dark"
                    size="sm"
                    fullWidth
                    onClick={() => pick(t.id, dark, t.title + " teması uygulandı")}
                  >
                    {active ? "Kullanılıyor" : "Uygula"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={sx("background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:20px")}>
        <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading);margin-bottom:16px")}>Bileşen önizlemesi — aktif tema</div>
        <div style={sx("display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:18px")}>
          <Button color="primary">Kaydet</Button>
          <Button color="accent">Tek CTA</Button>
          <Button variant="outline" color="dark">İkincil</Button>
          <Button variant="ghost" color="dark">Vazgeç</Button>
          <Badge color="success" variant="light">Doğrulanmış</Badge>
          <Badge color="warning" variant="light">Beklemede</Badge>
          <Badge color="secondary" variant="outline" pill>Telefon kılıfı</Badge>
        </div>
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:18px")}>
          <Alert color="info" variant="light" title="Bilgi">
            Yapısal token&apos;lar (grey / surface / text / border) tüm temalarca paylaşılır.
          </Alert>
          <Alert color="warning" variant="light" title="Kontrast notu">
            Accent&apos;i açık olan temalarda dolu accent buton metni koyulaştırılır.
          </Alert>
        </div>
      </div>
    </>
  );
}
