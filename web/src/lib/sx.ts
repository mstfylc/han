// HAN — CSS text → React style object.
//
// The prototype is written entirely in inline styles, and it builds them as
// strings from helpers (`navBtn(on)`, `cardBox`, `chipStyle(on)` …). Those
// strings are the design: exact paddings, exact radii, exact token references.
//
// Retyping them as camelCased object literals would be hundreds of chances to
// introduce a one-pixel drift. So instead we carry the strings across verbatim
// and convert them here. `sx` is memoised because the same handful of strings
// are rebuilt on every render.

import type { CSSProperties } from "react";

const cache = new Map<string, CSSProperties>();

/** `background-color` → `backgroundColor`; `--color-primary` stays as-is,
 *  because React passes custom properties through untouched. */
function toCamel(prop: string): string {
  if (prop.startsWith("--")) return prop;
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Parse a CSS declaration list into a React style object.
 *
 * Splits on semicolons that are not inside parentheses, so `rgba(0,0,0,.03)`
 * and `url(data:…;base64,…)` survive intact.
 */
export function sx(css: string | null | undefined): CSSProperties {
  if (!css) return {};
  const hit = cache.get(css);
  if (hit) return hit;

  const out: Record<string, string> = {};
  let depth = 0;
  let start = 0;

  const take = (chunk: string) => {
    const decl = chunk.trim();
    if (!decl) return;
    const i = decl.indexOf(":");
    if (i < 0) return;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) return;
    out[toCamel(prop)] = value;
  };

  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === ";" && depth === 0) {
      take(css.slice(start, i));
      start = i + 1;
    }
  }
  take(css.slice(start));

  const style = out as CSSProperties;
  cache.set(css, style);
  return style;
}

/** Join style fragments, skipping empties. Mirrors the prototype's habit of
 *  concatenating a base string with a conditional one. */
export function join(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(";");
}
