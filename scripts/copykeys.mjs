/**
 * Every W(...) and F(...) call must name a key that exists in THAT table.
 *
 * The lookup falls back to Turkish and then to "" — never to the key name — so
 * a missing string does not shout, it just quietly disappears. That is the right
 * runtime behaviour (a reader should never see `secDiscover`), but it means a
 * typo or a key looked up in the wrong table produces a label that is silently
 * absent: a verified badge with no word next to it, a price with no "from".
 *
 * Four such mistakes went in with the shop card, and nothing caught them —
 * typecheck cannot, because the key is just a string. This is the check that
 * can, and it costs a single pass over the source.
 *
 * Usage: node scripts/copykeys.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "src");
const COPY = path.join(ROOT, "lib", "copy.ts");

let failures = 0;
const bad = (m) => { console.log("FAIL  " + m); failures++; };

/** Pull the key names out of one exported table. */
function keysOf(source, tableName) {
  const start = source.indexOf(tableName + ": Record<string, CopyEntry> = {");
  if (start < 0) throw new Error("could not find " + tableName + " in copy.ts");
  // The table ends at the first line that is exactly "};".
  const end = source.indexOf("\n};", start);
  const body = source.slice(start, end);
  const keys = new Set();
  for (const m of body.matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9_]*):\s*\{/gm)) keys.add(m[1]);
  return keys;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mts)$/.test(name)) out.push(p);
  }
  return out;
}

const copy = readFileSync(COPY, "utf8");
const W = keysOf(copy, "W_COPY");
const F = keysOf(copy, "F_COPY");
console.log(`  ..  ${W.size} W keys, ${F.size} F keys`);

let checked = 0;
for (const file of walk(ROOT)) {
  if (file === COPY) continue;
  const src = readFileSync(file, "utf8");
  const rel = path.relative(process.cwd(), file);

  // W(lang, "key") / F(lang, "key") — only literal keys can be checked, which
  // is all of them today.
  for (const m of src.matchAll(/\b([WF])\(\s*[A-Za-z_.]+\s*,\s*"([^"]+)"/g)) {
    const [, fn, key] = m;
    checked += 1;
    const table = fn === "W" ? W : F;
    const other = fn === "W" ? F : W;
    if (table.has(key)) continue;
    if (other.has(key)) {
      bad(`${rel}: ${fn}(…, "${key}") — that key is in ${fn === "W" ? "F_COPY" : "W_COPY"}, so this renders empty`);
    } else {
      bad(`${rel}: ${fn}(…, "${key}") — no such key in either table, so this renders empty`);
    }
  }
}

console.log(`  ..  ${checked} call sites checked`);
console.log(failures === 0 ? "\n✔ copy: every lookup names a key that exists.\n" : `\n✘ copy: ${failures} bad lookup(s).\n`);
process.exit(failures ? 1 : 0);
