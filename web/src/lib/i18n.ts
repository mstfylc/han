// HAN — language, direction and money formatting.
//
// Translation is part of the data schema, not a layer on top of it: every
// content object carries {tr, en, ru, ar}. So there is no message-catalogue
// lookup for content — only for chrome (see ./copy.ts). What lives here is the
// small set of rules that turn a language choice into a rendered string.

import * as D from "@/data/han-data";
import * as L from "@/data/han-logic";
import type { Currency, Lang } from "@/data/types";

export const LANGS: Lang[] = ["tr", "en", "ru", "ar"];

/** Arabic is right-to-left; everything else is left-to-right. */
export function dirOf(lang: Lang): "rtl" | "ltr" {
  return (D.RTL || []).includes(lang) ? "rtl" : "ltr";
}

export function isLang(x: unknown): x is Lang {
  return typeof x === "string" && (LANGS as string[]).includes(x);
}

/** First run: recognise the browser's language so a tourist does not have to
 *  go hunting for the language button. */
export function detectLang(): Lang {
  if (typeof navigator === "undefined") return "tr";
  const cand = (navigator.languages || [navigator.language || ""]).map((x) =>
    String(x).slice(0, 2).toLowerCase(),
  );
  return (cand.find(isLang) as Lang) || "en";
}

/** Pick the right field off a {tr,en,ru,ar} object, falling back to Turkish. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tx(o: any, lang: Lang): string {
  return L.txt(o, lang);
}

/** Pick a suffixed field: loc(area, "about", "en") → area.aboutEn. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loc(o: any, base: string, lang: Lang): string {
  return L.loc(o, base, lang);
}

/** Prices are quoted in lira. The bazaar's own unit stays primary; the
 *  conversion sits beside it, never instead of it. */
export function money(n: number | null | undefined): string {
  return L.money(n);
}

/**
 * The "≈ $12" that sits next to every price.
 *
 * Returns "" when there is nothing to convert to (Turkish, or an explicit ₺)
 * — the caller then hides the whole line rather than printing a stray "≈".
 */
export function convert(n: number | null | undefined, lang: Lang, currency: Currency): string {
  return L.convert(D, n, lang, currency);
}

/** Locale tag for Intl. RU and AR need their own decimal and digit rules. */
export function localeOf(lang: Lang): string {
  return { tr: "tr-TR", en: "en-GB", ru: "ru-RU", ar: "ar-EG" }[lang];
}

/** Numbers must localise too — a Russian buyer reading "1.385" as one point
 *  three eight five is a real misreading. */
export function num(n: number, lang: Lang): string {
  return Number(n).toLocaleString(localeOf(lang));
}

/** Soft background + readable foreground for a semantic tone. Warning and
 *  accent need their darker `-accent` ink to stay legible on their own soft. */
export function tonePair(tone: string): { bg: string; fg: string } {
  if (tone === "secondary") return { bg: "var(--color-grey-100)", fg: "var(--text-muted)" };
  const fg =
    tone === "warning" || tone === "accent"
      ? "var(--color-" + tone + "-accent)"
      : "var(--color-" + tone + ")";
  return { bg: "var(--color-" + tone + "-soft)", fg };
}

/** Chevron that points the way the language reads. */
export function chevron(lang: Lang): "chevron-left" | "chevron-right" {
  return dirOf(lang) === "rtl" ? "chevron-left" : "chevron-right";
}

/** Turkish casing depends on the document's lang attribute (İ/ı). Without it
 *  `text-transform: uppercase` prints "ÇEŞIT" instead of "ÇEŞİT" — trap 16. */
export function upper(s: string, lang: Lang): string {
  return String(s || "").toLocaleUpperCase(localeOf(lang));
}
