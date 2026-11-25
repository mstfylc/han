"use client";

// HAN — Mobil PWA & 2-Step Quick Day Planner (/mobil).
// Lets field visitors install HAN as an offline-capable PWA, pick a goal in 2 taps,
// and immediately launch their live bazaar route on /plan.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Lang } from "@/data/types";
import { Alert, Button, Icon } from "@/ds";
import { QUICK_MOBILE_GOALS, type QuickPlanGoal } from "@/lib/ecosystem";
import { tx } from "@/lib/i18n";
import { pagePad } from "@/lib/layout";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function MobilePwaPage() {
  const { state, save, toast } = useApp();
  const router = useRouter();
  const { lang } = state;

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedGoal, setSelectedGoal] = useState<QuickPlanGoal>(QUICK_MOBILE_GOALS[0]);
  const [hours, setHours] = useState<number>(3);
  const [startHour, setStartHour] = useState<number>(10);
  const [swActive, setSwActive] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installedMsg, setInstalledMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) setSwActive(true);
      }).catch(() => {});
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const installApp = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalledMsg(pk({ tr: "HAN ana ekranınıza eklendi!", en: "HAN has been added to your home screen!" }, lang));
        setDeferredPrompt(null);
      }
      return;
    }
    setInstalledMsg(
      pk({
        tr: "iPhone Safari: Alt menüden 'Paylaş (↑)' → 'Ana Ekrana Ekle' dokunun. Android Chrome: Sağ üst (⋮) → 'Uygulamayı Yükle'.",
        en: "iPhone Safari: Tap Share (↑) -> 'Add to Home Screen'. Android Chrome: Menu (⋮) -> 'Install App'.",
      }, lang),
    );
  };

  const launchQuickPlan = () => {
    const tripId = "mob_" + Date.now();
    const newTrip = {
      id: tripId,
      name: tx(selectedGoal.title, lang),
      day: "today" as const,
      start: startHour,
      hours,
      intent: selectedGoal.mode === "toptan" ? ("is" as const) : ("gez" as const),
      carry: "el" as const,
      items: selectedGoal.stops.map((s, idx) => ({
        id: `${tripId}_${idx}`,
        name: s.name,
        qty: s.qty,
        target: s.target || "",
      })),
      done: [],
      phase: "rota" as const,
    };
    save({
      mode: selectedGoal.mode,
      trips: [newTrip, ...(state.trips || []).slice(0, 4)],
      tripId,
      buyList: newTrip.items,
    });
    toast(pk({ tr: "2 adımlı çarşı rotanız hazır — yürüyüşe geçiliyor!", en: "Your 2-step bazaar route is ready!" }, lang));
    router.push("/plan");
  };

  return (
    <div style={sx("max-width:1080px;margin:0 auto;" + pagePad(state.vw))}>
      {/* PWA Install Hero */}
      <section
        style={sx(
          "border-radius:var(--radius-card, 16px);padding:26px 26px;background:var(--surface-brand, #14233f);color:#fff;box-shadow:var(--shadow-float);display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap",
        )}
      >
        <div style={sx("flex:1;min-width:250px")}>
          <div style={sx("display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,.14);font-size:11.5px;font-weight:800")}>
            <span>{swActive ? "🟢 Çevrimdışı Önbellek Hazır (SW)" : "📲 Kurulabilir Mobil PWA"}</span>
          </div>
          <h1 style={sx("font-size:clamp(22px, 3vw, 32px);font-weight:800;margin:10px 0 6px;letter-spacing:-.02em;color:#fff")}>
            {pk({ tr: "HAN Mobil — Taş Hanlarda İnternetsiz Kat Planı", en: "HAN Mobile — Offline Floor Plans Inside Stone Hans" }, lang)}
          </h1>
          <p style={sx("font-size:14px;color:rgba(255,255,255,.82);margin:0;max-width:58ch;line-height:1.5")}>
            {pk({
              tr: "App Store veya Play Store indirmesi gerekmez. Tek dokunuşla ana ekranınıza ekleyin; han içinde hat çekmese bile kayıtlı kat planları ve kapı rotanız anında açılır.",
              en: "No store download required. Add to your home screen in one tap so floor plans and saved door routes stay available offline inside stone hans.",
            }, lang)}
          </p>
        </div>
        <div style={sx("display:flex;flex-direction:column;gap:8px;min-width:210px")}>
          <Button color="accent" size="lg" iconStart="download" onClick={() => void installApp()}>
            {pk({ tr: "📲 Uygulamayı Kur (PWA)", en: "📲 Install App (PWA)" }, lang)}
          </Button>
          <Button variant="outline" color="secondary" size="md" onClick={() => router.push("/harita")}>
            {pk({ tr: "🗺️ Canlı 3B Haritayı Aç", en: "🗺️ Open Live 3D Map" }, lang)}
          </Button>
        </div>
      </section>

      {installedMsg && (
        <div style={sx("margin-top:14px")}>
          <Alert color="info" variant="light">{installedMsg}</Alert>
        </div>
      )}

      {/* 2-Step Quick Day Planner Wizard */}
      <section
        style={sx(
          "margin-top:22px;border-radius:var(--radius-card, 16px);border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:var(--shadow-card);padding:22px",
        )}
      >
        <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap")}>
          <div>
            <div style={sx("font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--color-primary)")}>
              {pk({ tr: `2 ADIMLI HIZLI GÜN PLANLAYICI · ADIM ${step}/2`, en: `2-STEP QUICK DAY PLANNER · STEP ${step}/2` }, lang)}
            </div>
            <h2 style={sx("font-size:20px;font-weight:800;color:var(--text-heading);margin:4px 0 0")}>
              {step === 1
                ? pk({ tr: "1. Bugün Çarşıda Hedefiniz Nedir?", en: "1. What Is Your Goal Today?" }, lang)
                : pk({ tr: "2. Sürenizi Seçin ve Rotayı Başlatın", en: "2. Pick Your Window & Launch Route" }, lang)}
            </h2>
          </div>
          {step === 2 && (
            <Button variant="outline" color="secondary" size="sm" onClick={() => setStep(1)}>
              {pk({ tr: "← Hedefi Değiştir", en: "← Change Goal" }, lang)}
            </Button>
          )}
        </div>

        {step === 1 ? (
          <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:12px;margin-top:16px")}>
            {QUICK_MOBILE_GOALS.map((g) => {
              const on = selectedGoal.id === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  className="han-card-lift"
                  onClick={() => {
                    setSelectedGoal(g);
                    setHours(g.hours);
                    setStep(2);
                  }}
                  style={sx(
                    "display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:16px;border-radius:14px;font-family:inherit;text-align:start;cursor:pointer;border:2px solid " +
                      (on ? "var(--color-primary);background:var(--color-primary-soft)" : "var(--border-strong);background:var(--surface-muted)"),
                  )}
                >
                  <span style={sx("display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:var(--color-primary);color:#fff")}>
                    <Icon name={g.icon} size={18} />
                  </span>
                  <span style={sx("font-size:15px;font-weight:800;color:var(--text-heading)")}>{tx(g.title, lang)}</span>
                  <span style={sx("font-size:12.5px;color:var(--text-muted);line-height:1.4")}>{tx(g.sub, lang)}</span>
                  <span style={sx("font-size:11.5px;font-weight:800;color:var(--color-primary);margin-top:auto")}>
                    {g.stops.length} {pk({ tr: "gerçek durak", en: "verified stops" }, lang)} · ~{g.hours} sa ➔
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={sx("margin-top:16px;display:flex;flex-direction:column;gap:16px")}>
            <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:12px")}>
              <div style={sx("padding:14px;border-radius:12px;background:var(--surface-muted);border:1px solid var(--border-default)")}>
                <div style={sx("font-size:12px;font-weight:800;color:var(--text-muted);margin-bottom:8px")}>
                  {pk({ tr: "Başlangıç Saati", en: "Start Hour" }, lang)}
                </div>
                <div style={sx("display:flex;gap:6px;flex-wrap:wrap")}>
                  {[9, 10, 11, 13, 14].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setStartHour(h)}
                      style={sx(
                        "height:34px;padding:0 12px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;border:1px solid " +
                          (startHour === h
                            ? "var(--color-primary);background:var(--color-primary);color:#fff"
                            : "var(--border-strong);background:var(--surface-card);color:var(--text-heading)"),
                      )}
                    >
                      {String(h).padStart(2, "0")}:00
                    </button>
                  ))}
                </div>
              </div>

              <div style={sx("padding:14px;border-radius:12px;background:var(--surface-muted);border:1px solid var(--border-default)")}>
                <div style={sx("font-size:12px;font-weight:800;color:var(--text-muted);margin-bottom:8px")}>
                  {pk({ tr: "Ayrılan Süre", en: "Duration" }, lang)}
                </div>
                <div style={sx("display:flex;gap:6px;flex-wrap:wrap")}>
                  {[2, 3, 4, 5].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setHours(d)}
                      style={sx(
                        "height:34px;padding:0 12px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;border:1px solid " +
                          (hours === d
                            ? "var(--color-accent);background:var(--color-accent);color:#fff"
                            : "var(--border-strong);background:var(--surface-card);color:var(--text-heading)"),
                      )}
                    >
                      {d} {pk({ tr: "saat", en: "hrs" }, lang)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={sx("display:flex;flex-direction:column;gap:8px")}>
              <div style={sx("font-size:12.5px;font-weight:800;color:var(--text-heading)")}>
                {pk({ tr: "Rotaya Eklenecek Gerçek Duraklar:", en: "Verified Stops Included:" }, lang)}
              </div>
              {selectedGoal.stops.map((s, idx) => (
                <div
                  key={s.name}
                  style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-radius:10px;border:1px solid var(--border-default);background:var(--surface-muted)")}
                >
                  <div style={sx("display:flex;align-items:center;gap:10px")}>
                    <span style={sx("width:24px;height:24px;border-radius:999px;background:var(--color-primary);color:#fff;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center")}>
                      {idx + 1}
                    </span>
                    <div>
                      <div style={sx("font-size:14px;font-weight:800;color:var(--text-heading)")}>{s.name}</div>
                      <div style={sx("font-size:12px;color:var(--text-muted)")}>{s.hanHint}</div>
                    </div>
                  </div>
                  <span style={sx("font-size:12px;font-weight:800;color:var(--color-primary)")}>
                    {s.qty} {pk({ tr: "adet", en: "pcs" }, lang)}
                  </span>
                </div>
              ))}
            </div>

            <Button color="accent" size="lg" onClick={launchQuickPlan}>
              {pk({ tr: "🚀 Canlı Yürüyüş Rotasını Başlat (/plan)", en: "🚀 Launch Live Walking Route (/plan)" }, lang)}
            </Button>
          </div>
        )}
      </section>

      {/* Field Quick Shortcuts */}
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr));gap:12px;margin-top:18px")}>
        {[
          { label: pk({ tr: "🎤 Sesli Kapı Bul", en: "🎤 Voice Door Finder" }, lang), url: "/ara?voice=1" },
          { label: pk({ tr: "📷 Fotoğrafla Ürün Bul", en: "📷 Visual Product Search" }, lang), url: "/ara?visual=1" },
          { label: pk({ tr: "🏢 Santral Han 3B Plan", en: "🏢 Santral Han 3D Plan" }, lang), url: "/yer/santral" },
          { label: pk({ tr: "💱 Canlı TCMB Kur", en: "💱 Live TCMB Rates" }, lang), url: "/arac/doviz" },
        ].map((item) => (
          <button
            key={item.url}
            type="button"
            className="han-card-lift"
            onClick={() => router.push(item.url)}
            style={sx("padding:14px 16px;border-radius:14px;border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:var(--shadow-card);font-family:inherit;font-size:14px;font-weight:800;color:var(--text-heading);text-align:start;cursor:pointer")}
          >
            {item.label} →
          </button>
        ))}
      </div>
    </div>
  );
}
