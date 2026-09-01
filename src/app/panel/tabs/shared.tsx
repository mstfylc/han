"use client";

// Ortak panel sekme yardımcıları. page.tsx içindeki yerleşik sekmelerle aynı
// görsel dili kullanır; yeni sekmeler yalnız buradan tüketir ki iki ayrı
// "kart stili" doğmasın.

import { sx } from "@/lib/sx";

export const CARD = "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:18px 20px;box-shadow:0 3px 4px rgba(0,0,0,.03)";
export const KICKER = "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)";
export const H1 = "font-size:23px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0";
export const SUB = "font-size:14px;color:var(--text-muted);margin-top:4px;max-width:78ch;text-wrap:pretty";

export const num = (n: number) => (n || 0).toLocaleString("tr-TR");

export function tone(t: string) {
  const bg = "var(--color-" + t + "-soft)";
  const fg = "var(--color-" + t + (t === "warning" || t === "primary" ? "-accent" : "") + ")";
  return { bg, fg };
}

export function Pill({ label, t }: { label: string; t: string }) {
  const c = tone(t);
  return (
    <span style={sx("display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:6px;font-size:12px;font-weight:700;background:" + c.bg + ";color:" + c.fg)}>
      {label}
    </span>
  );
}

/**
 * Her sekme bileşeninin aldığı ortak sözleşme. Sekme veriyi kendisi okur
 * (SC/AD modülleri sayfa seviyesinde her rev'de yeniden yüklenir); yazdıktan
 * sonra refresh() çağırır, kullanıcıya kısa geri bildirimi say() verir.
 */
export interface PanelTabProps {
  role: string;
  readOnly: boolean;
  refresh: () => void;
  say: (m: string) => void;
}
