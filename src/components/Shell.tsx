"use client";

// HAN — the application shell: top bar, mobile bottom tab bar, skip link,
// offline band, voice search, quick door/QR jumper, PWA install, and toast.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import type { Currency, Lang, Mode } from "@/data/types";
import { Alert, Button, Drawer, Icon, Toast } from "@/ds";
import { F, W } from "@/lib/copy";
import { dirOf } from "@/lib/i18n";
import { pathOfSection, sectionOf, shareUrl } from "@/lib/routes";
import { sx } from "@/lib/sx";
import { THEMES, type BrandThemeId, useThemePref } from "@/lib/theme";
import { useApp } from "@/state/AppState";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Section pill. Compact screens lose a little padding, never a section. */
const navBtn = (on: boolean, compact: boolean) =>
  "flex:none;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 " +
  (compact ? "11px" : "14px") +
  ";border-radius:8px;font-family:inherit;font-size:" +
  (compact ? "14px" : "14.5px") +
  ";font-weight:600;cursor:pointer;white-space:nowrap;border:1px solid " +
  (on
    ? "#fff;background:#fff;color:var(--surface-brand, #14233f)"
    : "transparent;background:rgba(255,255,255,.10);color:rgba(255,255,255,.86)");

const selStyle =
  "flex:none;height:32px;max-width:132px;padding:0 8px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff";
const selStyleNarrow =
  "flex:none;height:32px;min-width:104px;padding:0 8px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff";

const mobileTopIconBtn = (active = false) =>
  "flex:none;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:36px;padding:0 10px;border-radius:9px;border:1px solid " +
  (active
    ? "#fff;background:#fff;color:var(--surface-brand, #14233f)"
    : "rgba(255,255,255,.28);background:rgba(255,255,255,.12);color:#fff") +
  ";font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap";

export function Shell({ children }: { children: ReactNode }) {
  const { state, save, toast, loading } = useApp();
  const { theme, dark, updateTheme } = useThemePref();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHintOpen, setIosHintOpen] = useState(false);

  // Quick door/QR jumper state
  const [qPlace, setQPlace] = useState("santral");
  const [qFloor, setQFloor] = useState<"B" | "A">("B");
  const [qDoor, setQDoor] = useState("228");

  const { lang, currency, mode, vw } = state;
  const rawSection = sectionOf(pathname);
  const section = pathname.startsWith("/etkinlik") ? "etkinlik" : rawSection;
  const compact = vw < 1380;
  const twoRow = vw < 1340;
  const isPhone = vw < 768;

  // Document language + direction
  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = dirOf(lang);
  }, [lang]);

  // Register Service Worker (/sw.js) for offline floor plans & capture PWA install prompt
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const planCount = (state.buyList || []).length + (state.evPlan || []).length;
  const evCount = (state.evPlan || []).length;
  const talepCount = (state.talepler || []).length;

  const sections = useMemo(
    () => [
      {
        id: "kesfet" as const,
        icon: "compass",
        label: W(lang, "secDiscover"),
        short: lang === "tr" ? "Keşfet" : W(lang, "secDiscover"),
      },
      {
        id: "ara" as const,
        icon: "magnifier",
        label: lang === "tr" ? "Dükkân & Ürün Ara" : W(lang, "secSearch"),
        short: lang === "tr" ? "Ara" : W(lang, "secSearch"),
      },
      {
        id: "harita" as const,
        icon: "map",
        label: lang === "tr" ? "Harita & İhtiyaçlar" : W(lang, "secMap"),
        short: lang === "tr" ? "Harita" : W(lang, "secMap"),
      },
      {
        id: "plan" as const,
        icon: "route",
        label: lang === "tr" ? "Plan & Etkinlik Rotam" : W(lang, "secPlan"),
        short: lang === "tr" ? "Rotam" : W(lang, "secPlan"),
        count: planCount,
      },
      {
        id: "etkinlik" as const,
        icon: "calendar",
        label:
          ({ tr: "Etkinlikler", en: "Events", ru: "События", ar: "الفعاليات" } as Record<string, string>)[lang] ||
          "Etkinlikler",
        short:
          ({ tr: "Etkinlik", en: "Events", ru: "События", ar: "فعاليات" } as Record<string, string>)[lang] ||
          "Etkinlik",
        count: evCount,
      },
    ],
    [lang, planCount, evCount],
  );

  const go = useCallback(
    (id: string) => {
      setMenuOpen(false);
      router.push(
        id === "etkinlik"
          ? "/etkinlik"
          : id === "isler"
            ? "/isler/talep"
            : id === "arac"
              ? "/arac/doviz"
              : pathOfSection(id as never),
      );
    },
    [router],
  );

  const copyLink = useCallback(async () => {
    const url = shareUrl(pathname, searchParams.toString() ? "?" + searchParams.toString() : "", {
      lang,
      currency,
      mode,
    });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast(W(lang, "linkCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(url);
    }
  }, [pathname, searchParams, lang, currency, mode, toast]);

  // Hands-free Voice Search (Web Speech API)
  const startVoiceSearch = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      toast(
        lang === "tr"
          ? "Tarayıcınız sesli aramayı desteklemiyor; arama sayfasına yönlendiriliyorsunuz."
          : "Voice search not supported in this browser; opening search.",
      );
      router.push("/ara");
      return;
    }

    try {
      const rec = new SpeechRec() as {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onstart: () => void;
        onend: () => void;
        onerror: () => void;
        onresult: (e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void;
        start: () => void;
      };
      const langMap: Record<Lang, string> = { tr: "tr-TR", en: "en-US", ru: "ru-RU", ar: "ar-SA" };
      rec.lang = langMap[lang] || "tr-TR";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => {
        setListening(true);
        toast(lang === "tr" ? "🎤 Dinleniyor... (Örn: 'Santral Han gümüş' veya 'Kapı 228')" : "🎤 Listening...");
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => {
        setListening(false);
        toast(lang === "tr" ? "Ses algılanamadı, tekrar deneyin." : "Could not hear voice, please try again.");
      };
      rec.onresult = (ev) => {
        setListening(false);
        const text = (ev.results?.[0]?.[0]?.transcript || "").trim();
        if (!text) return;
        const doorMatch = text.match(/(?:kapı|kapi|no|numara)\s*(\d{2,3})/i) || text.match(/^(\d{3})$/);
        if (doorMatch) {
          const dNo = doorMatch[1];
          toast(lang === "tr" ? `Kapı ${dNo} kat planında açılıyor...` : `Opening Door ${dNo}...`);
          router.push(`/yer/santral?kat=${Number(dNo) >= 200 ? "B" : "A"}&kapi=${dNo}`);
          return;
        }
        toast(lang === "tr" ? `"${text}" aranıyor...` : `Searching "${text}"...`);
        router.push("/ara?q=" + encodeURIComponent(text));
      };
      rec.start();
    } catch {
      router.push("/ara");
    }
  }, [lang, router, toast]);

  const handleInstallPwa = useCallback(async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      setInstallPrompt(null);
      setMenuOpen(false);
      return;
    }
    setIosHintOpen((v) => !v);
  }, [installPrompt]);

  const modeOpts = [
    { id: "ikisi", label: F(lang, "all") },
    { id: "toptan", label: F(lang, "wholesale") },
    { id: "perakende", label: F(lang, "retail") },
  ];
  const curOpts = [
    { id: "auto", label: ({ tr: "Otomatik", en: "Auto", ru: "Авто", ar: "تلقائي" } as Record<string, string>)[lang] },
    { id: "TRY", label: "₺ TRY" },
    { id: "USD", label: "$ USD" },
    { id: "EUR", label: "€ EUR" },
    { id: "RUB", label: "₽ RUB" },
  ];
  const langOpts = (D.LANGS || []).map((l) => ({
    id: l.id as string,
    label: (l.native as string) || String(l.id).toUpperCase(),
  }));

  const wModeLabel = ({ tr: "Alış şekli", en: "Buying as", ru: "Формат", ar: "نوع الشراء" } as Record<string, string>)[lang];
  const wCurLabel = ({ tr: "Para birimi", en: "Currency", ru: "Валюта", ar: "العملة" } as Record<string, string>)[lang];
  const wLangLabel = ({ tr: "Dil", en: "Language", ru: "Язык", ar: "اللغة" } as Record<string, string>)[lang];

  const hdrStyle = isPhone
    ? "max-width:1480px;margin:0 auto;padding:0 12px;height:52px;display:flex;align-items:center;justify-content:space-between;gap:8px"
    : "max-width:1480px;margin:0 auto;padding:0 24px;display:flex;align-items:center;gap:16px;" +
      (twoRow ? "flex-wrap:wrap;padding-top:8px;padding-bottom:8px;row-gap:8px" : "height:58px");

  const hdrCtlStyle = twoRow
    ? "order:3;flex:1 1 100%;min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap"
    : "flex:0 1 auto;min-width:0;display:flex;align-items:center;gap:7px";

  const bottomTabs = sections.slice(0, 5);

  return (
    <div
      style={sx(
        "min-height:100vh;background:var(--surface-page);font-family:var(--font-sans);font-size:15px;line-height:1.5;color:var(--text-body);" +
          (isPhone ? "padding-bottom:calc(66px + env(safe-area-inset-bottom, 0px))" : ""),
      )}
    >
      <a data-han-skip="1" href="#han-icerik">
        {W(lang, "skip")}
      </a>

      {/* Top Sticky Bar */}
      <div
        style={sx(
          "position:sticky;top:0;z-index:35;background:radial-gradient(circle at 1px 1px, rgba(255,255,255,.11) 1px, transparent 0) 0 0/16px 16px, var(--surface-brand, var(--color-primary));box-shadow:0 4px 14px rgba(0,0,0,.14)",
        )}
      >
        <div style={sx(hdrStyle)}>
          <button
            type="button"
            onClick={() => router.push("/")}
            style={sx("flex:none;display:flex;align-items:center;gap:8px;background:none;border:none;padding:0;cursor:pointer")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/han-mark.svg" alt="" width={28} height={28} style={sx("display:block;border-radius:8px")} />
            <span style={sx("font-size:19px;font-weight:800;color:#fff;letter-spacing:.02em")}>HAN</span>
          </button>

          {isPhone ? (
            /* Compact Mobile Header Actions */
            <div style={sx("display:flex;align-items:center;gap:6px")}>
              <button
                type="button"
                onClick={startVoiceSearch}
                aria-label={lang === "tr" ? "Sesle Ara" : "Voice Search"}
                style={sx(mobileTopIconBtn(listening))}
              >
                <Icon name="mic" size={15} />
                <span>{lang === "tr" ? "Ses" : "Voice"}</span>
              </button>
              <button
                type="button"
                onClick={() => setDoorOpen(true)}
                aria-label={lang === "tr" ? "Kapı No / Kamera Rehberi" : "Door / Camera Guide"}
                style={sx(mobileTopIconBtn(doorOpen))}
              >
                <Icon name="qr" size={15} />
                <span>{lang === "tr" ? "Kapı Bul" : "Door"}</span>
              </button>
              <button
                type="button"
                onClick={() => updateTheme(theme, !dark)}
                aria-label={dark ? "Açık görünüm" : "Koyu görünüm"}
                style={sx(
                  "flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.12);color:#fff;cursor:pointer",
                )}
              >
                <Icon name={dark ? "sun" : "moon"} size={15} />
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label={lang === "tr" ? "Ayarlar ve Menü" : "Settings & Menu"}
                style={sx(
                  "flex:none;display:flex;align-items:center;justify-content:center;gap:4px;height:36px;padding:0 9px;border-radius:9px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.12);color:#fff;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer",
                )}
              >
                <Icon name="menu" size={16} />
                <span>{String(lang).toUpperCase()}</span>
              </button>
            </div>
          ) : (
            /* Desktop & Tablet Full Navigation + Controls */
            <>
              <div data-han-nav="1" style={sx("flex:1;min-width:0;display:flex;align-items:center;gap:5px;overflow-x:auto")}>
                {sections.map((s) => {
                  const on = section === s.id;
                  return (
                    <button key={s.id} type="button" onClick={() => go(s.id)} style={sx(navBtn(on, compact))}>
                      {s.label}
                      {!compact && !!s.count && (
                        <span
                          style={sx(
                            "display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:19px;padding:0 5px;border-radius:999px;font-size:11.5px;font-weight:700;" +
                              (on
                                ? "background:var(--color-primary);color:#fff"
                                : "background:rgba(255,255,255,.22);color:#fff"),
                          )}
                        >
                          {s.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={sx(hdrCtlStyle)}>
                {/* 1-Click Language Strip: TR | EN | RU | AR */}
                <div
                  role="group"
                  aria-label={wLangLabel}
                  style={sx(
                    "flex:none;display:inline-flex;align-items:center;gap:2px;height:32px;padding:2px;border-radius:8px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.10)",
                  )}
                >
                  {(["tr", "en", "ru", "ar"] as Lang[]).map((code) => {
                    const activeLang = lang === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => save({ lang: code })}
                        style={sx(
                          "height:26px;padding:0 7px;border-radius:6px;border:0;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer;" +
                            (activeLang
                              ? "background:#fff;color:var(--surface-brand,#14233f)"
                              : "background:transparent;color:rgba(255,255,255,.88)"),
                        )}
                      >
                        {code.toUpperCase()}
                      </button>
                    );
                  })}
                </div>

                {/* Buying Mode: Tümü / Perakende / Toptan */}
                <select
                  onChange={(e) => save({ mode: e.target.value as Mode })}
                  value={mode}
                  aria-label={wModeLabel}
                  title={wModeLabel}
                  style={sx(selStyle)}
                >
                  {modeOpts.map((o) => (
                    <option key={o.id} value={o.id} style={sx("color:var(--text-heading);background:var(--surface-card)")}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {/* Voice Search (mic) */}
                <button
                  type="button"
                  onClick={startVoiceSearch}
                  title={lang === "tr" ? "Sesle Ara" : "Voice Search"}
                  style={sx(
                    "flex:none;display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,.28);background:" +
                      (listening ? "#fff;color:var(--surface-brand,#14233f)" : "rgba(255,255,255,.10);color:#fff") +
                      ";font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap",
                  )}
                >
                  <Icon name="mic" size={14} />
                  {lang === "tr" ? "Sesle Ara" : "Voice"}
                </button>

                {/* Quick Door / QR Finder (qr) */}
                <button
                  type="button"
                  onClick={() => setDoorOpen(true)}
                  title={lang === "tr" ? "Hızlı Kapı / QR Bulucu" : "Quick Door / QR Finder"}
                  style={sx(
                    "flex:none;display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.10);color:#fff;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap",
                  )}
                >
                  <Icon name="qr" size={14} />
                  {lang === "tr" ? "Kapı Bul" : "Door"}
                </button>

                {/* Settings / Menu Drawer Trigger (menu) */}
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  aria-label={lang === "tr" ? "Ayarlar ve Menü" : "Settings & Menu"}
                  title={lang === "tr" ? "Ayarlar, Döviz, Tema ve B2B Girişi" : "Settings, Currency, Theme & B2B"}
                  style={sx(
                    "flex:none;display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.10);color:#fff;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap",
                  )}
                >
                  <Icon name="menu" size={15} />
                  <span>{lang === "tr" ? "Menü" : "Menu"}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Offline Banner */}
      {!state.online && (
        <div style={sx("max-width:1480px;margin:10px auto 0;padding:0 " + (isPhone ? "14px" : "24px"))}>
          <Alert color="warning" variant="light">
            {W(lang, "offline")}
          </Alert>
        </div>
      )}

      <div id="han-icerik" tabIndex={-1} style={sx("outline:none")} />

      {loading ? <ShellSkeleton /> : children}

      {/* Page Bottom Footer: Esnaf, B2B Teklifler & Yönetim Girişi */}
      <footer
        style={sx(
          "max-width:1480px;margin:28px auto 0;padding:18px " +
            (isPhone ? "14px 28px" : "24px 36px") +
            ";border-top:1px solid var(--border-default)",
        )}
      >
        <div
          style={sx(
            "padding:14px 16px;border-radius:14px;border:1px solid var(--border-strong);background:var(--surface-card);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap",
          )}
        >
          <div style={sx("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
            <span
              style={sx(
                "font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted)",
              )}
            >
              {lang === "tr"
                ? "Esnaf, B2B Teklifler & Yönetim Girişi"
                : "Traders, B2B Offers & Bazaar Management"}
            </span>
            <span style={sx("font-size:12.5px;color:var(--text-body)")}>
              {lang === "tr"
                ? "Toptan alım talebi bırakma, döviz/kargo hesaplama, dükkân sahiplenme ve çarşı yönetimi araçları:"
                : "Wholesale RFQ, currency/cargo calculators, shop claim & bazaar admin portals:"}
            </span>
          </div>
          <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
            <Button
              size="sm"
              color="primary"
              variant="light"
              iconStart="handcart"
              onClick={() => router.push("/isler/talep")}
            >
              {(lang === "tr" ? "Toptan Talep & Teklifler" : "Wholesale Requests & Offers") +
                (talepCount > 0 ? ` (${talepCount})` : "")}
            </Button>
            <Button
              size="sm"
              color="primary"
              variant="light"
              iconStart="calculator"
              onClick={() => router.push("/arac/doviz")}
            >
              {lang === "tr" ? "Ticaret & Kargo Araçları" : "Trade & Cargo Tools"}
            </Button>
            <Button
              size="sm"
              color="primary"
              variant="outline"
              iconStart="shop"
              onClick={() => router.push("/esnaf/yonet")}
            >
              {lang === "tr" ? "Esnaf Paneli" : "Trader Panel"}
            </Button>
            <Button
              size="sm"
              color="primary"
              variant="outline"
              iconStart="setting-2"
              onClick={() => router.push("/panel/ozet")}
            >
              {lang === "tr" ? "Çarşı Yönetim Paneli" : "Bazaar Admin Panel"}
            </Button>
          </div>
        </div>
      </footer>

      {/* Mobile Fixed Bottom Navigation Bar (< 768px) */}
      {isPhone && (
        <nav
          aria-label={lang === "tr" ? "Mobil alt gezinme" : "Mobile bottom navigation"}
          style={sx(
            "position:fixed;left:0;right:0;bottom:0;z-index:45;display:grid;grid-template-columns:repeat(5,1fr);height:calc(62px + env(safe-area-inset-bottom, 0px));padding-bottom:env(safe-area-inset-bottom, 0px);background:var(--surface-card);border-top:1px solid var(--border-strong);box-shadow:0 -6px 24px rgba(15,23,42,.10)",
          )}
        >
          {bottomTabs.map((t) => {
            const on = section === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => go(t.id)}
                style={sx(
                  "position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0;background:transparent;padding:4px 2px;cursor:pointer;font-family:inherit;color:" +
                    (on ? "var(--color-accent)" : "var(--text-muted)"),
                )}
              >
                {on && (
                  <span
                    style={sx(
                      "position:absolute;top:0;width:28px;height:3px;border-radius:0 0 4px 4px;background:var(--color-accent)",
                    )}
                  />
                )}
                <span style={sx("position:relative;display:inline-flex;align-items:center;justify-content:center")}>
                  <Icon name={t.icon} size={20} />
                  {!!t.count && (
                    <span
                      style={sx(
                        "position:absolute;top:-5px;right:-11px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;background:var(--color-accent);color:#fff",
                      )}
                    >
                      {t.count}
                    </span>
                  )}
                </span>
                <span style={sx("font-size:11px;font-weight:" + (on ? "800" : "600") + ";line-height:1.1;white-space:nowrap")}>
                  {t.short}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Quick Door / QR / Camera AR Finder Sheet */}
      <Drawer
        open={doorOpen}
        onClose={() => setDoorOpen(false)}
        title={lang === "tr" ? "Hızlı Kapı & Han İçi Yönbulucu" : "Quick Door & Indoor Wayfinder"}
        subtitle={
          lang === "tr"
            ? "Önünde durduğunuz veya aradığınız kapı numarasını girin; kat planı ve canlı kamera yönlendirmesi açılsın."
            : "Enter the door number to open the floor plan or live camera wayfinder."
        }
        size="sm"
      >
        <div style={sx("display:grid;gap:14px")}>
          <div>
            <div style={sx("font-size:12.5px;font-weight:700;color:var(--text-heading);margin-bottom:6px")}>
              {lang === "tr" ? "1. Bulunduğunuz Han / Çarşı" : "1. Select Han / Bazaar"}
            </div>
            <select
              value={qPlace}
              onChange={(e) => setQPlace(e.target.value)}
              className="mtinput mtinput--md"
            >
              {SC.PLACES.map((p, idx) => (
                <option key={p.id} value={p.id}>
                  {(idx === 0 ? "★ " : "") + p.name}
                </option>
              ))}
            </select>
          </div>

          <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:10px")}>
            <div>
              <div style={sx("font-size:12.5px;font-weight:700;color:var(--text-heading);margin-bottom:6px")}>
                {lang === "tr" ? "2. Kat Seçimi" : "2. Floor"}
              </div>
              <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:6px")}>
                {(["B", "A"] as const).map((fl) => (
                  <button
                    key={fl}
                    type="button"
                    onClick={() => {
                      setQFloor(fl);
                      setQDoor(fl === "B" ? "228" : "155");
                    }}
                    style={sx(
                      "height:42px;border-radius:10px;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer;border:1px solid " +
                        (qFloor === fl
                          ? "var(--color-primary);background:var(--color-primary);color:#fff"
                          : "var(--border-strong);background:var(--surface-muted);color:var(--text-heading)"),
                    )}
                  >
                    {fl === "B" ? "B Kat (200+)" : "A Kat (100+)"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={sx("font-size:12.5px;font-weight:700;color:var(--text-heading);margin-bottom:6px")}>
                {lang === "tr" ? "3. Kapı Numarası" : "3. Door No"}
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={qDoor}
                onChange={(e) => setQDoor(e.target.value.trim())}
                placeholder="Örn: 228"
                className="mtinput mtinput--md"
                style={sx("height:42px;font-weight:800")}
              />
            </div>
          </div>

          <div style={sx("display:flex;flex-wrap:wrap;gap:6px")}>
            {(qFloor === "B" ? ["201", "212", "220", "228", "232", "243"] : ["101", "117", "139", "155", "163", "189"]).map(
              (d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setQDoor(d)}
                  style={sx(
                    "height:32px;padding:0 10px;border-radius:8px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;border:1px solid " +
                      (qDoor === d
                        ? "var(--color-accent);background:var(--color-accent-soft);color:var(--color-accent-accent)"
                        : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
                  )}
                >
                  {"Kapı " + d}
                </button>
              ),
            )}
          </div>

          <div style={sx("display:grid;gap:8px;margin-top:4px")}>
            <Button
              color="accent"
              variant="solid"
              size="lg"
              fullWidth
              iconStart="camera"
              onClick={() => {
                setDoorOpen(false);
                router.push(`/tarif/roza?han=${encodeURIComponent(qPlace)}&kat=${qFloor}&kapi=${encodeURIComponent(qDoor || "228")}&ar=1`);
              }}
            >
              {lang === "tr"
                ? `📷 Kamera / Koridor Rehberi ile Kapı ${qDoor || "228"}'e Yürü`
                : `📷 Walk to Door ${qDoor || "228"} with Camera / HUD`}
            </Button>
            <Button
              color="primary"
              variant="outline"
              size="lg"
              fullWidth
              iconStart="floor-layer"
              onClick={() => {
                setDoorOpen(false);
                router.push(`/yer/${encodeURIComponent(qPlace)}?kat=${qFloor}&kapi=${encodeURIComponent(qDoor || "228")}`);
              }}
            >
              {lang === "tr"
                ? `🗺️ Kat Planında Kapı ${qDoor || "228"}'i Göster`
                : `🗺️ Show Door ${qDoor || "228"} on Floor Plan`}
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Mobile Settings & Tools Sheet */}
      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={lang === "tr" ? "Tercihler, Araçlar ve Uygulama" : "Preferences, Tools & App"}
        subtitle={lang === "tr" ? "Dil, döviz, alış şekli, marka teması ve çevrimdışı kurulum" : "Language, currency, buying mode & offline setup"}
        size="sm"
      >
        <div style={sx("display:grid;gap:14px")}>
          {/* Language */}
          <div>
            <div style={sx("font-size:12.5px;font-weight:700;color:var(--text-heading);margin-bottom:6px")}>{wLangLabel}</div>
            <div style={sx("display:grid;grid-template-columns:repeat(4,1fr);gap:6px")}>
              {langOpts.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => save({ lang: o.id as Lang })}
                  style={sx(
                    "height:38px;border-radius:9px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:1px solid " +
                      (lang === o.id
                        ? "var(--color-primary);background:var(--color-primary);color:#fff"
                        : "var(--border-strong);background:var(--surface-muted);color:var(--text-heading)"),
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Currency & Mode */}
          <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:10px")}>
            <div>
              <div style={sx("font-size:12.5px;font-weight:700;color:var(--text-heading);margin-bottom:6px")}>{wCurLabel}</div>
              <select
                value={currency}
                onChange={(e) => save({ currency: e.target.value as Currency })}
                className="mtinput mtinput--md"
              >
                {curOpts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={sx("font-size:12.5px;font-weight:700;color:var(--text-heading);margin-bottom:6px")}>{wModeLabel}</div>
              <select
                value={mode}
                onChange={(e) => save({ mode: e.target.value as Mode })}
                className="mtinput mtinput--md"
              >
                {modeOpts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Brand Theme */}
          <div>
            <div style={sx("font-size:12.5px;font-weight:700;color:var(--text-heading);margin-bottom:6px")}>
              {lang === "tr" ? "Marka Teması ve Görünüm" : "Brand Theme & Appearance"}
            </div>
            <div style={sx("display:grid;grid-template-columns:1fr auto;gap:8px")}>
              <select
                value={theme}
                onChange={(e) => {
                  const next = e.target.value as BrandThemeId;
                  updateTheme(next, dark);
                  const found = THEMES.find((t) => t.id === next);
                  if (found) toast(found.title + " teması aktif");
                }}
                className="mtinput mtinput--md"
              >
                {THEMES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title + " — " + t.desc}
                  </option>
                ))}
              </select>
              <Button
                color="primary"
                variant="outline"
                size="md"
                iconStart={dark ? "sun" : "moon"}
                onClick={() => updateTheme(theme, !dark)}
              >
                {dark ? "Açık" : "Koyu"}
              </Button>
            </div>
          </div>

          {/* Share Link & PWA Offline App Install */}
          <div style={sx("display:grid;gap:8px;padding-top:6px;border-top:1px solid var(--border-default)")}>
            <Button color="primary" variant="light" size="md" fullWidth iconStart="share" onClick={copyLink}>
              {W(lang, "copyLink")}
            </Button>
            <Button
              color="accent"
              variant="solid"
              size="lg"
              fullWidth
              iconStart="download"
              onClick={handleInstallPwa}
            >
              {lang === "tr" ? "📲 Ana Ekrana Ekle (Çevrimdışı Kat Planı)" : "📲 Add to Home Screen (Offline Ready)"}
            </Button>
            {iosHintOpen && (
              <div style={sx("margin-top:4px")}>
                <Alert color="info" variant="light" title={lang === "tr" ? "Telefonunuza Uygulama Olarak Kurun" : "Install as Mobile App"}>
                  {lang === "tr"
                    ? "Tarayıcınızın altındaki 'Paylaş' (↑) veya sağ üstteki (⋮) menüsünden 'Ana Ekrana Ekle' seçeneğine dokunun. Santral Han A ve B kat planları telefonunuza indirilir ve han içinde internet çekmese bile çevrimdışı açılır."
                    : "Tap 'Share' (↑) or browser menu (⋮) and choose 'Add to Home Screen'. Floor plans are cached for offline use inside stone hans."}
                </Alert>
              </div>
            )}
          </div>

          {/* Esnaf, B2B Teklifler & Yönetim Girişi (Bottom of Drawer) */}
          <div
            style={sx(
              "padding:12px;border-radius:12px;border:1px solid var(--border-strong);background:var(--surface-muted);display:grid;gap:8px",
            )}
          >
            <div style={sx("font-size:12px;font-weight:800;color:var(--text-heading)")}>
              {lang === "tr"
                ? "Esnaf, B2B Teklifler & Yönetim Girişi"
                : "Traders, B2B Offers & Bazaar Management"}
            </div>
            <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:8px")}>
              <Button
                color="primary"
                variant="light"
                size="sm"
                iconStart="handcart"
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/isler/talep");
                }}
              >
                {lang === "tr" ? "Toptan Talep & Teklifler" : "B2B Requests"}
              </Button>
              <Button
                color="primary"
                variant="light"
                size="sm"
                iconStart="calculator"
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/arac/doviz");
                }}
              >
                {lang === "tr" ? "Ticaret & Kargo Araçları" : "Trade & Cargo Tools"}
              </Button>
              <Button
                color="primary"
                variant="outline"
                size="sm"
                iconStart="shop"
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/esnaf/yonet");
                }}
              >
                {lang === "tr" ? "Esnaf Paneli" : "Trader Panel"}
              </Button>
              <Button
                color="primary"
                variant="outline"
                size="sm"
                iconStart="setting-2"
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/panel/ozet");
                }}
              >
                {lang === "tr" ? "Çarşı Yönetim Paneli" : "Bazaar Admin"}
              </Button>
            </div>
          </div>
        </div>
      </Drawer>

      <Toast message={state.toast} tone="primary" />
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div style={sx("max-width:1480px;margin:0 auto;padding:22px 24px 48px;display:grid;gap:16px")} aria-busy="true">
      <div style={sx("height:120px;border-radius:14px;background:var(--surface-muted)")} />
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px")}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={sx("height:150px;border-radius:14px;background:var(--surface-muted)")} />
        ))}
      </div>
    </div>
  );
}
