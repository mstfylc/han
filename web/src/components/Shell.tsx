"use client";

// HAN — the application shell: top bar, skip link, offline band, toast.
//
// Navigation is primary and secondary controls make room for it. Below 1120px
// the controls drop to a second row rather than squeezing the sections — an
// earlier fixed-width control cluster used to clip the nav.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import * as D from "@/data/han-data";
import type { Currency, Lang, Mode } from "@/data/types";
import { Icon } from "@/ds";
import { F, W } from "@/lib/copy";
import { dirOf } from "@/lib/i18n";
import { pathOfSection, sectionOf, shareUrl } from "@/lib/routes";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

/** Section pill. Compact screens lose a little padding, never a section. */
const navBtn = (on: boolean, compact: boolean) =>
  "flex:none;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 " +
  (compact ? "11px" : "14px") +
  ";border-radius:8px;font-family:inherit;font-size:" +
  (compact ? "14px" : "14.5px") +
  ";font-weight:600;cursor:pointer;white-space:nowrap;border:1px solid " +
  (on
    ? "#fff;background:#fff;color:var(--color-primary-accent)"
    : "transparent;background:rgba(255,255,255,.10);color:rgba(255,255,255,.86)");

const selStyle =
  "flex:none;height:32px;max-width:132px;padding:0 8px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff";
const selStyleNarrow =
  "flex:none;height:32px;min-width:104px;padding:0 8px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff";

export function Shell({ children }: { children: ReactNode }) {
  const { state, save, toast, loading } = useApp();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const { lang, currency, mode, vw } = state;
  const section = sectionOf(pathname);
  const compact = vw < 1300;
  const twoRow = vw < 1120;

  // The document's language and direction are what make Turkish casing and
  // Arabic mirroring correct; they must follow the reader's choice.
  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = dirOf(lang);
  }, [lang]);

  // A shared link carries its own language (?l=ar), and that is resolved during
  // boot in AppState — not here. Doing it here meant comparing the parameter
  // against a state value that had not booted yet, so "?l=tr" looked identical
  // to the default and was dropped: a Turkish link opened in English.

  const planCount = (state.buyList || []).length + (state.evPlan || []).length;

  // Categories are part of search and events are part of discovery: neither is
  // its own tab. One row, six sections — no overflow rail, no secondary strip.
  const sections = useMemo(
    () => [
      { id: "kesfet" as const, label: W(lang, "secDiscover") },
      { id: "ara" as const, label: W(lang, "secSearch") },
      { id: "harita" as const, label: W(lang, "secMap") },
      { id: "plan" as const, label: W(lang, "secPlan"), count: planCount },
      {
        id: "isler" as const,
        label:
          ({ tr: "Talep ve Teklifler", en: "Requests & Offers", ru: "Запросы и предложения", ar: "الطلبات والعروض" } as Record<string, string>)[lang] ||
          "Talep ve Teklifler",
        count: (state.talepler || []).length,
      },
      { id: "arac" as const, label: F(lang, "secTools") },
    ],
    [lang, planCount, state.talepler],
  );

  const go = useCallback(
    (id: string) => {
      router.push(id === "isler" ? "/isler/talep" : id === "arac" ? "/arac/doviz" : pathOfSection(id as never));
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
      // Clipboard denied (insecure context, or the user said no). Say nothing
      // rather than claiming a copy that did not happen.
      toast(url);
    }
  }, [pathname, searchParams, lang, currency, mode, toast]);

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
  // Language is always four visible options, never a single cycling button:
  // that is why, once in Arabic, there was no way back out.
  const langOpts = (D.LANGS || []).map((l) => ({
    id: l.id as string,
    label: (l.native as string) || String(l.id).toUpperCase(),
  }));

  const wModeLabel = ({ tr: "Alış şekli", en: "Buying as", ru: "Формат", ar: "نوع الشراء" } as Record<string, string>)[lang];
  const wCurLabel = ({ tr: "Para birimi", en: "Currency", ru: "Валюта", ar: "العملة" } as Record<string, string>)[lang];
  const wLangLabel = ({ tr: "Dil", en: "Language", ru: "Язык", ar: "اللغة" } as Record<string, string>)[lang];

  const hdrStyle =
    "max-width:1480px;margin:0 auto;padding:0 24px;display:flex;align-items:center;gap:16px;" +
    (twoRow ? "flex-wrap:wrap;padding-top:8px;padding-bottom:8px;row-gap:8px" : "height:58px");
  const hdrCtlStyle = twoRow
    ? "order:3;flex:1 1 100%;min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap"
    : "flex:0 1 auto;min-width:0;display:flex;align-items:center;gap:7px";

  return (
    <div
      style={sx(
        "min-height:100vh;background:var(--surface-page);font-family:var(--font-sans);font-size:15px;line-height:1.5;color:var(--text-body)",
      )}
    >
      <a data-han-skip="1" href="#han-icerik">
        {W(lang, "skip")}
      </a>

      <div
        style={sx(
          "position:sticky;top:0;z-index:30;background:radial-gradient(circle at 1px 1px, rgba(255,255,255,.13) 1px, transparent 0) 0 0/16px 16px, var(--color-primary);box-shadow:0 4px 14px rgba(0,0,0,.12)",
        )}
      >
        <div style={sx(hdrStyle)}>
          <button
            type="button"
            onClick={() => router.push("/")}
            style={sx("flex:none;display:flex;align-items:center;gap:9px;background:none;border:none;padding:0;cursor:pointer")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/han-mark.svg" alt="" width={30} height={30} style={sx("display:block;border-radius:8px")} />
            <span style={sx("font-size:20px;font-weight:800;color:#fff;letter-spacing:.02em")}>HAN</span>
          </button>

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
                          (on ? "background:var(--color-primary);color:#fff" : "background:rgba(255,255,255,.22);color:#fff"),
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
            {/* Nobody reads "T·P" as a buying mode: the word is always spelled out. */}
            <select
              onChange={(e) => save({ mode: e.target.value as Mode })}
              value={mode}
              aria-label={wModeLabel}
              title={wModeLabel}
              style={sx(selStyle)}
            >
              {modeOpts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              onChange={(e) => save({ currency: e.target.value as Currency })}
              value={currency}
              aria-label={wCurLabel}
              title={wCurLabel}
              style={sx(selStyleNarrow)}
            >
              {curOpts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              onChange={(e) => save({ lang: e.target.value as Lang })}
              value={lang}
              aria-label={wLangLabel}
              title={wLangLabel}
              style={sx(selStyle)}
            >
              {langOpts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={copyLink}
              aria-label={W(lang, "copyLink")}
              title={W(lang, "copyLink")}
              style={sx(
                "flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.08);color:#fff;cursor:pointer",
              )}
            >
              <Icon name={copied ? "check-circle" : "share"} size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* The promise the copy makes — "saved shops open offline" — has to be
          visible when it matters. */}
      {!state.online && (
        <div
          style={sx(
            "background:var(--color-warning-soft);color:var(--color-warning-accent);font-size:13px;font-weight:600;padding:9px 24px;text-align:center;text-wrap:pretty",
          )}
          role="status"
        >
          {W(lang, "offline")}
        </div>
      )}

      <div id="han-icerik" tabIndex={-1} style={sx("outline:none")} />

      {loading ? <ShellSkeleton /> : children}

      {state.toast && (
        <div
          role="status"
          aria-live="polite"
          style={sx(
            "position:fixed;inset-inline-start:50%;transform:translateX(-50%);bottom:24px;z-index:60;background:var(--color-primary-accent);color:#fff;font-size:14px;font-weight:600;padding:11px 18px;border-radius:10px;box-shadow:0 10px 35px rgba(0,0,0,.10)",
          )}
        >
          {state.toast}
        </div>
      )}
    </div>
  );
}

/** Shown for the moment between first paint and the engine being ready. The
 *  bazaar's 1,385 records are generated in the browser, so there is a real
 *  beat here — it should look like the page that is coming. */
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
