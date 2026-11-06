"use client";

import { useCallback, useEffect, useState } from "react";

import { readKey, writeKey } from "@/services/storage";

export const THEME_KEY = "han-panel-theme";

export type BrandThemeId = "uyanik" | "han" | "mansis" | "okyanus";

export interface ThemeDefinition {
  id: BrandThemeId;
  title: string;
  desc: string;
  primary: string;
  accent: string;
}

export const THEMES: ThemeDefinition[] = [
  { id: "uyanik", title: "Uyanık", desc: "Lacivert + turuncu · kanonik", primary: "#1F3864", accent: "#E08A2B" },
  { id: "han", title: "HAN", desc: "Lacivert + altın · han keşif", primary: "#14304F", accent: "#C9A227" },
  { id: "mansis", title: "Mansis", desc: "Navy + cyan · premium SaaS", primary: "#0A6EEB", accent: "#0EA0BE" },
  { id: "okyanus", title: "Okyanus", desc: "Teal + mercan · örnek", primary: "#0F6E78", accent: "#F2674B" },
];

export interface ThemePref {
  theme: BrandThemeId;
  dark: boolean;
}

export function readThemePref(): ThemePref {
  const v = readKey<{ theme?: string; dark?: boolean }>(THEME_KEY, {});
  const valid = THEMES.find((t) => t.id === v.theme);
  return {
    theme: valid ? valid.id : "uyanik",
    dark: !!v.dark,
  };
}

export function applyThemeToDom(theme: BrandThemeId, dark: boolean) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute("data-theme", theme);
  el.classList.toggle("dark", !!dark);
  if (document.body) document.body.classList.toggle("dark", !!dark);
}

export function saveThemePref(theme: BrandThemeId, dark: boolean) {
  applyThemeToDom(theme, dark);
  writeKey(THEME_KEY, { theme, dark });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("han:theme", { detail: { theme, dark } }));
  }
}

export function useThemePref() {
  const [pref, setPref] = useState<ThemePref>({ theme: "uyanik", dark: false });

  useEffect(() => {
    const initial = readThemePref();
    setPref(initial);
    applyThemeToDom(initial.theme, initial.dark);

    const onSync = (e: Event) => {
      const detail = (e as CustomEvent<ThemePref>).detail;
      if (detail) {
        setPref(detail);
      } else {
        const next = readThemePref();
        setPref(next);
        applyThemeToDom(next.theme, next.dark);
      }
    };
    window.addEventListener("han:theme", onSync);
    window.addEventListener("storage", onSync);
    return () => {
      window.removeEventListener("han:theme", onSync);
      window.removeEventListener("storage", onSync);
    };
  }, []);

  const updateTheme = useCallback((theme: BrandThemeId, dark: boolean) => {
    setPref({ theme, dark });
    saveThemePref(theme, dark);
  }, []);

  return { theme: pref.theme, dark: pref.dark, updateTheme };
}
