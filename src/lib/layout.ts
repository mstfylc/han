// HAN — breakpoints and page frames.
//
// The template is inline-styled, so the breakpoints are computed from a measured
// viewport width rather than declared as media queries. Three columns do not fit
// under 1320px; the side columns drop away in order, and the page ends as one
// column on a phone.

export interface Breaks {
  vw: number;
  /** filters · list · detail all visible */
  three: boolean;
  /** filters · list, with detail below the list */
  two: boolean;
  /** the header's secondary controls lose their padding */
  compact: boolean;
  /** one column — a phone in the bazaar */
  single: boolean;
}

export function breaks(vw: number): Breaks {
  return {
    vw,
    three: vw >= 1320,
    two: vw >= 1040,
    compact: vw < 1300,
    single: vw < 1040,
  };
}

export const PAGE_WRAP = "max-width:1480px;margin:0 auto;padding:22px 24px 48px;display:grid;gap:20px;align-items:start;";

/** A card: 1px border first, shadow second. Depth in this system comes from the
 *  border; the shadow is deliberately almost invisible. */
export const CARD_BOX =
  "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:18px;box-shadow:0 3px 4px rgba(0,0,0,.03);";

export const TREE_BOX =
  "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:10px;box-shadow:0 3px 4px rgba(0,0,0,.03);";

export const areaOn = (name: string) => "grid-area:" + name + ";min-width:0;";

/** Search: filters (f) · list (l) · detail (d). */
export function searchGrid(b: Breaks): string {
  return (
    PAGE_WRAP +
    (b.three
      ? "grid-template-columns:274px minmax(0,1fr) 404px;grid-template-areas:'f l d';"
      : b.two
        ? "grid-template-columns:268px minmax(0,1fr);grid-template-areas:'f l' 'f d';"
        : "grid-template-columns:minmax(0,1fr);grid-template-areas:'f' 'l' 'd';")
  );
}

/** Categories: tree (c) · selection (s). The five top groups used to eat one of
 *  three columns, so they moved to a horizontal rail and two columns remain. */
export function categoryGrid(b: Breaks): string {
  return (
    PAGE_WRAP.replace("padding:22px 24px 48px", "padding:20px 24px 48px") +
    (b.three
      ? "grid-template-columns:296px minmax(0,1fr);grid-template-areas:'c s';"
      : b.two
        ? "grid-template-columns:264px minmax(0,1fr);grid-template-areas:'c s';"
        : "grid-template-columns:minmax(0,1fr);grid-template-areas:'c' 's';")
  );
}

/** Plan: route on the left, buying list on the right. */
export function planGrid(vw: number): string {
  return (
    "display:grid;gap:20px;margin-top:20px;align-items:start;" +
    (vw >= 1180 ? "grid-template-columns:minmax(0,1fr) 400px;" : "grid-template-columns:minmax(0,1fr);")
  );
}

/** Sticky side columns sit below the 58px header plus its shadow. */
export const STICKY_TOP = "position:sticky;top:84px;";
