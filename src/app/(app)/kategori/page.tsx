"use client";

// Kategoriler — group → category → what is actually traded there.
//
// The subcategory level is not stored anywhere: it is derived from the shops'
// own catalogues (`catSubs`). Keeping a separate taxonomy in the data would
// mean maintaining a second truth that immediately drifts from the first.
//
// Two columns, not three: the five top groups used to eat a whole column, so
// they moved to a horizontal rail.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import * as D from "@/data/han-data";
import * as L from "@/data/han-logic";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import type { Lang } from "@/data/types";
import { Icon } from "@/ds";
import { ImageSlot } from "@/components/ImageSlot";
import { F, W } from "@/lib/copy";
import { chevron, convert, num, tx } from "@/lib/i18n";
import { TREE_BOX, areaOn, breaks, categoryGrid } from "@/lib/layout";
import { PARAM, getStr, href } from "@/lib/routes";
import { catPhoto, shopsIn } from "@/lib/shop";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

export default function CategoryPage() {
  return (
    <Suspense fallback={null}>
      <CategoryScreen />
    </Suspense>
  );
}

function CategoryScreen() {
  const { state } = useApp();
  const router = useRouter();
  const sp = useSearchParams();
  const { lang, mode, currency } = state;
  const b = breaks(state.vw);

  const groups = D.CAT_GROUPS || [];
  const groupId = getStr(sp, PARAM.group, (groups[0]?.id as string) || "");
  const group = groups.find((g) => g.id === groupId) || groups[0];
  const catId = getStr(sp, PARAM.cat, ((group?.cats || [])[0] as string) || "");
  const cat = [...(D.CATS || []), ...SC.CATS_EXTRA].find((c) => c.id === catId);

  const cv = (n: number | null) => convert(n, lang, currency);

  // Subcategories come from the shops' catalogues, not from a stored taxonomy.
  const subs = useMemo(() => (catId ? L.catSubs(D, catId, lang) : []), [catId, lang]);

  // Where this line of work is concentrated. A buyer should meet places, not
  // ten thousand shops.
  const places = useMemo(() => {
    if (!catId) return [];
    const counts: Record<string, number> = {};
    SC.RECORDS.forEach((r) => {
      if (r.cat !== catId) return;
      if (r.status !== "aktif" && r.status !== "onayli") return;
      counts[r.place] = (counts[r.place] || 0) + 1;
    });
    const ids = Object.keys(counts).sort((a, c) => counts[c] - counts[a]).slice(0, 5);
    const max = ids.length ? counts[ids[0]] : 1;
    return ids.map((id) => {
      const pl = SC.PLACES.find((x) => x.id === id);
      const semt = SC.SEMTLER.find((x) => x.id === pl?.semt);
      return {
        id,
        name: pl?.name || id,
        n: counts[id],
        meta: (semt ? tx(semt, lang) : "") + " · " + num(pl?.units || 0, lang) + " " + pk({ tr: "birim", en: "units", ru: "мест", ar: "وحدة" }, lang),
        pct: Math.round((counts[id] / max) * 100),
      };
    });
  }, [catId, lang]);

  // M2 · the product bridge. A wholesaler thinks "what am I buying", not
  // "which shop"; the product question comes before the shop list.
  const products = useMemo(() => (catId ? SE.productsIn(catId, { mode }).slice(0, 5) : []), [catId, mode]);

  const shops = useMemo(
    () => (catId ? D.STORES.filter((s) => (s.cats || []).includes(catId)) : []),
    [catId],
  );

  const streets = useMemo(() => {
    if (!catId) return [];
    const ids = new Set(shops.map((s) => (s.location || {}).street).filter(Boolean));
    return D.STREETS.filter((st) => ids.has(st.id as string));
  }, [catId, shops]);

  const go = (g: string | null, c: string | null) => router.push(href.category(g, c));

  return (
    <div style={sx(categoryGrid(b))}>
      {/* ── group rail + category tree ─────────────────────────────────── */}
      <aside style={sx(areaOn("c") + TREE_BOX)} aria-label={W(lang, "allCats")}>
        <div style={sx("display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px")} data-han-nav="1">
          {groups.map((g) => {
            const on = g.id === group?.id;
            return (
              <button
                key={g.id as string}
                type="button"
                onClick={() => go(g.id as string, (g.cats || [])[0] as string)}
                style={sx(
                  "flex:none;height:34px;padding:0 13px;border-radius:999px;font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap;border:1px solid " +
                    (on
                      ? "var(--color-" + (g.tone || "primary") + ");background:var(--color-" + (g.tone || "primary") + ");color:#fff"
                      : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
                )}
              >
                {tx(g, lang)}
              </button>
            );
          })}
        </div>

        <div style={sx("display:flex;flex-direction:column;gap:2px;margin-top:6px")}>
          {((group?.cats || []) as string[]).map((id) => {
            const c = D.CATS.find((x) => x.id === id);
            if (!c) return null;
            const on = id === catId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => go(group?.id as string, id)}
                aria-current={on ? "true" : undefined}
                style={sx(
                  "display:flex;align-items:center;gap:9px;width:100%;background:" +
                    (on ? "var(--color-primary-soft)" : "none") +
                    ";border:none;padding:10px 10px;border-radius:9px;font-family:inherit;font-size:14px;font-weight:" +
                    (on ? "700" : "500") +
                    ";color:" + (on ? "var(--color-primary-accent)" : "var(--text-body)") +
                    ";text-align:start;cursor:pointer",
                )}
              >
                <span style={sx("flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{tx(c, lang)}</span>
                <span style={sx("flex:none;font-size:12px;font-weight:600;color:" + (on ? "var(--color-primary)" : "var(--text-muted)"))}>
                  {shopsIn(id)}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── the selected category ──────────────────────────────────────── */}
      <main style={sx(areaOn("s"))}>
        {!cat ? (
          <div style={sx("background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:26px")}>
            <div style={sx("font-size:18px;font-weight:700;color:var(--text-heading)")}>{W(lang, "allCats")}</div>
          </div>
        ) : (
          <>
            <header style={sx("display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap")}>
              <div style={sx("flex:1;min-width:240px")}>
                <h1 style={sx("font-size:26px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0")}>{tx(cat, lang)}</h1>
                <p style={sx("font-size:14px;color:var(--text-muted);margin-top:4px")}>
                  {F(lang, "shopCount", shopsIn(catId))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push(href.search(tx(cat, lang)))}
                style={sx("height:40px;padding:0 16px;border-radius:8px;border:1px solid var(--color-primary);background:var(--surface-card);color:var(--color-primary);font-family:inherit;font-size:14px;font-weight:700;cursor:pointer")}
              >
                {W(lang, "search")}
              </button>
            </header>

            {/* what is bought here — products before shops */}
            {products.length > 0 && (
              <section style={sx("margin-top:20px")}>
                <div style={sx("display:flex;align-items:baseline;justify-content:space-between;gap:10px")}>
                  <h2 style={sx("font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)")}>
                    {pk({ tr: "Bu kategoride ne alınır", en: "What's traded here", ru: "Что здесь покупают", ar: "ماذا يُشترى هنا" }, lang)}
                  </h2>
                  <button
                    type="button"
                    onClick={() => router.push(href.product(catId))}
                    style={sx("background:none;border:none;padding:0;font-family:inherit;font-size:12.5px;font-weight:600;color:var(--color-primary);cursor:pointer")}
                  >
                    {pk({ tr: "Hepsi →", en: "All →", ru: "Все →", ar: "الكل ←" }, lang)}
                  </button>
                </div>
                <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr));gap:10px;margin-top:10px")}>
                  {products.map((pr) => (
                    <button
                      key={pr.slug}
                      type="button"
                      onClick={() => router.push(href.product(catId, pr.slug))}
                      style={sx("display:block;width:100%;text-align:start;font-family:inherit;cursor:pointer;background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;padding:14px 16px")}
                    >
                      <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>{pr.name}</span>
                      <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:3px")}>
                        {pk({
                          tr: pr.shops + " dükkân satıyor",
                          en: pr.shops + " shops carry it",
                          ru: pr.shops + " лавок",
                          ar: pr.shops + " متجرًا",
                        }, lang)}
                      </span>
                      <span style={sx("display:block;font-size:13px;font-weight:700;color:var(--color-primary);margin-top:5px")}>
                        {pr.band ? cv(pr.band[0]) + "–" + cv(pr.band[1]) : "—"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* where this work is dense */}
            {places.length > 0 && (
              <section style={sx("margin-top:22px")}>
                <h2 style={sx("font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)")}>
                  {pk({ tr: "Bu iş nerede yoğun", en: "Where this work is dense", ru: "Где это сосредоточено", ar: "أين يتكثف هذا العمل" }, lang)}
                </h2>
                <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:10px")}>
                  {places.map((pl) => (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => router.push(href.place(pl.id))}
                      style={sx("display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--border-default);background:var(--surface-card);font-family:inherit;text-align:start;cursor:pointer")}
                    >
                      <span style={sx("flex:1;min-width:0")}>
                        <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>{pl.name}</span>
                        <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px")}>{pl.meta}</span>
                        <span style={sx("display:block;height:5px;border-radius:999px;background:var(--surface-muted);margin-top:7px;overflow:hidden")}>
                          <span style={sx("display:block;height:100%;width:" + pl.pct + "%;background:var(--color-primary)")} />
                        </span>
                      </span>
                      <span style={sx("flex:none;font-size:15px;font-weight:700;color:var(--color-primary)")}>{pl.n}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* subcategories, derived from real catalogues */}
            {subs.length > 0 && (
              <section style={sx("margin-top:22px")}>
                <h2 style={sx("font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)")}>
                  {W(lang, "subcats")}
                </h2>
                <div style={sx("display:flex;flex-wrap:wrap;gap:8px;margin-top:10px")}>
                  {subs.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => router.push(href.search(s.label))}
                      style={sx("display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:13.5px;font-weight:600;color:var(--text-heading);cursor:pointer")}
                    >
                      {s.label}
                      <span style={sx("font-weight:700;color:var(--color-primary)")}>{s.n}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* streets */}
            {streets.length > 0 && (
              <section style={sx("margin-top:22px")}>
                <h2 style={sx("font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)")}>
                  {F(lang, "street")}
                </h2>
                <div style={sx("display:flex;flex-wrap:wrap;gap:8px;margin-top:10px")}>
                  {streets.map((st) => (
                    <button
                      key={st.id as string}
                      type="button"
                      onClick={() => router.push(href.street(st.id as string))}
                      style={sx("display:inline-flex;align-items:center;height:34px;padding:0 13px;border-radius:999px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:13px;font-weight:600;color:var(--text-heading);cursor:pointer")}
                    >
                      {tx(st, lang)}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* shops in this category */}
            <section style={sx("margin-top:22px")}>
              <h2 style={sx("font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)")}>
                {W(lang, "featured")}
              </h2>
              <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(210px,100%),1fr));gap:14px;margin-top:10px")}>
                {shops.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => router.push(href.store(s.id))}
                    style={sx("display:flex;flex-direction:column;align-items:stretch;border-radius:14px;border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:0 3px 4px rgba(0,0,0,.03);overflow:hidden;font-family:inherit;text-align:start;cursor:pointer;padding:0")}
                  >
                    <span style={sx("display:block;height:110px;background:var(--surface-muted)")}>
                      <ImageSlot src={catPhoto(catId)} placeholder={s.name} decorative />
                    </span>
                    <span style={sx("display:block;padding:13px")}>
                      <span style={sx("display:block;font-size:15px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{s.name}</span>
                      <span style={sx("display:flex;align-items:center;gap:5px;font-size:12.5px;color:var(--text-muted);margin-top:4px")}>
                        <Icon name={chevron(lang)} size={13} />
                        {D.HANS.find((h) => h.id === s.han)?.name || tx(D.AREAS.find((a) => a.id === L.areaOf(D, s)), lang)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
