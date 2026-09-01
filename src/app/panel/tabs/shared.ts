// Panel — the few style constants and one component every tab needs.
//
// Kept in one place so the tabs cannot drift into looking like different
// products, and so a change to the card treatment is one edit rather than
// fifteen.

export const CARD =
  "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:18px 20px;box-shadow:0 3px 4px rgba(0,0,0,.03)";
export const HOLLOW =
  "background:var(--surface-card);border:1px dashed var(--border-strong);border-radius:14px;padding:28px 24px";
export const KICKER =
  "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)";
export const H1 = "font-size:23px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0";
export const SUB = "font-size:14px;color:var(--text-muted);margin-top:4px;max-width:78ch;text-wrap:pretty";
export const ROW =
  "display:flex;align-items:center;gap:12px;padding:12px 15px;border-radius:12px;background:var(--surface-card);border:1px solid var(--border-strong)";

export const num = (n: number) => (n || 0).toLocaleString("tr-TR");

/** Tone pair for a badge. `warning` and `primary` need the `-accent` variant to
 *  keep enough contrast on their soft background. */
export function toneOf(t: string) {
  return {
    bg: "var(--color-" + t + "-soft)",
    fg: "var(--color-" + t + (t === "warning" || t === "primary" ? "-accent" : "") + ")",
  };
}
