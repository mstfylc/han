"use client";

// Arama Sözlüğü (ADMIN-PLANI 14) — prototipteki `isSozluk` bölümünün portu.
//
// Sonuçsuz arama bir sinyaldi ama kolu yoktu. Burada: alıcının GERÇEK arama
// geçmişinden (han-web-v1 · qHist) türeyen sonuçsuz sorgular tek tıkla
// kategoriye bağlanır ya da elle kelime eklenir. Canlı önizleme eklemeden önce
// ne olacağını söyler; kelime başka kategoriye bağlıysa çakışma uyarısı çıkar.
// Eklenen kelime `han-lexicon-v1`'e yazılır — kalıcıdır ve Web açılışta
// loadLexicon ile okuduğu için alıcı aramasında anında geçerlidir.

import { useEffect, useMemo, useState } from "react";

import { CATS } from "@/data/han-data";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import type { Lang } from "@/data/types";
import { Button, Input, Select } from "@/ds";
import { sx } from "@/lib/sx";
import { KEYS, readKey } from "@/services/storage";

import { H1, SUB, type PanelTabProps } from "./shared";

interface ZeroQuery { q: string; n: number; total: number }

export default function Sozluk(props: PanelTabProps) {
  const [rev, setRev] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Panelde eklenenler kalıcı: modül her dokümanda ayrı yüklendiği için
    // sözlük overlay'i açılışta okunur.
    SE.loadLexicon();
    setReady(true);
  }, []);
  const bump = () => setRev((n) => n + 1);

  const [word, setWord] = useState("");
  const [cat, setCat] = useState("");
  const [err, setErr] = useState("");
  const [zeroPick, setZeroPick] = useState<Record<string, string>>({});

  const locked = props.readOnly;
  const cats = useMemo(() => ([] as { id: string; tr: string }[]).concat(
    CATS.map((c) => ({ id: String(c.id), tr: String(c.tr) })),
    SC.CATS_EXTRA.map((c) => ({ id: c.id, tr: c.tr })),
  ), []);
  const catName = (id: string) => cats.find((c) => c.id === id)?.tr || id;
  const activeCat = cat || cats[0]?.id || "";

  // Arama analitiği uydurulmaz: alıcının gerçek arama geçmişinden (qHist) türer.
  // Sonuçsuz arama tanımı da veriden gelir: search(q).total === 0.
  const queries: ZeroQuery[] = useMemo(() => {
    if (!ready) return [];
    const web = readKey<{ qHist?: string[]; lang?: Lang }>(KEYS.web, {});
    const seen: Record<string, number> = {};
    (web.qHist || []).forEach((q) => {
      const k = String(q).trim().toLocaleLowerCase("tr");
      if (k) seen[k] = (seen[k] || 0) + 1;
    });
    return Object.keys(seen)
      .map((q) => {
        const res = SE.search(q, {}, { mode: "ikisi", lang: web.lang || "tr" });
        return { q, n: seen[q], total: res ? res.total || 0 : 0 };
      })
      .sort((a, b) => b.n - a.n || b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, rev]);

  const zero = queries.filter((x) => x.total === 0);

  const add = (w: string, target: string) => {
    if (locked) return props.say("Salt okuma rolü sözlüğe yazamaz");
    const ww = String(w || "").trim();
    if (!ww) return setErr("Kelime yazın");
    if (!target) return setErr("Kategori seçin");
    const r = SE.addSynonym(target, ww);
    if (!r || !r.ok) return setErr("Kelime çok kısa");
    SE.saveLexicon(target, ww);
    setWord("");
    setErr("");
    bump();
    props.refresh();
    props.say(
      "“" + ww + "” " + catName(target) + " kategorisine bağlandı — aramada anında geçerli" +
      (r.clash ? " (" + catName(r.clash) + " bağı üzerine yazıldı)" : ""),
    );
  };

  // Kelime yazılırken canlı önizleme: eklemeden önce kaç sonuç geleceği görünür.
  const w = word.trim();
  const owner = w ? SE.synonymOwner(w) : null;
  const hits = w ? SE.search(w, {}, { mode: "ikisi", lang: "tr" }).total : 0;
  const clashes = !!owner && owner !== activeCat;
  const preview = owner
    ? "“" + w + "” şu an " + catName(owner) + " kategorisine bağlı · aramada " + hits + " sonuç veriyor" +
      (owner === activeCat ? "" : " — ekleyince " + catName(activeCat) + "'e taşınır")
    : "“" + w + "” sözlükte yok · aramada " + hits + " sonuç veriyor. " + catName(activeCat) + "'e bağlayınca bu kategorinin kayıtları da çıkar.";

  const words = ready ? SE.synonymsOf(activeCat) : [];

  return (
    <>
      <h1 style={sx(H1)}>Arama Sözlüğü</h1>
      <p style={sx(SUB)}>
        Sonuçsuz arama bir sinyaldi; burası kolu. Eşanlam eklemek anında aramaya girer.
      </p>

      <div style={sx("margin-top:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:18px;align-items:start")}>
        <div style={sx("background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);overflow:hidden")}>
          <div style={sx("padding:16px 20px;border-bottom:1px solid var(--border-default)")}>
            <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>Sonuçsuz aramalar</div>
            <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:3px;text-wrap:pretty")}>
              Alıcı aradı, karşılık bulamadı. Ya kapsama açığı var ya sözlükte kelime eksik — hangisi olduğunu karşılık sayısı söyler.
            </div>
          </div>
          {zero.length === 0 && (
            <div style={sx("padding:24px 20px;font-size:13px;color:var(--text-muted);text-wrap:pretty")}>
              {queries.length
                ? "Aranan her sorgu karşılık buldu — sözlük bu kategorilerde yeterli."
                : "Henüz arama kaydı yok. Alıcı arama yaptıkça sonuçsuz kalanlar buraya düşer."}
            </div>
          )}
          <div>
            {zero.slice(0, 12).map((x) => {
              const own = SE.synonymOwner(x.q);
              const pick = zeroPick[x.q] || "";
              // Kelime zaten bir kategoriye bağlıysa sorun sözlük değil kapsama: ekleme sunmayız.
              const canFix = !locked && !own;
              return (
                <div key={x.q} style={sx("padding:13px 20px;border-bottom:1px solid var(--border-default)")}>
                  <div style={sx("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
                    <span style={sx("font-size:13.5px;font-weight:600;color:var(--text-heading)")}>{x.q}</span>
                    <span style={sx("font-size:12px;color:var(--text-muted)")}>
                      {x.n + " kez arandı · " + (own ? catName(own) + " kategorisine bağlı ama kayıt yok" : "sözlükte yok")}
                    </span>
                  </div>
                  {canFix && (
                    <div style={sx("display:flex;gap:8px;flex-wrap:wrap;margin-top:9px;align-items:center")}>
                      <div style={sx("width:190px;max-width:100%")}>
                        <Select
                          size="sm"
                          aria-label={"“" + x.q + "” için kategori"}
                          value={pick}
                          onChange={(e) => setZeroPick((s) => ({ ...s, [x.q]: e.target.value }))}
                        >
                          <option value="">Kategori seçin…</option>
                          {cats.map((c) => (
                            <option key={c.id} value={c.id}>{c.tr}</option>
                          ))}
                        </Select>
                      </div>
                      <Button variant="light" color="primary" size="sm" disabled={!pick} onClick={() => { if (pick) add(x.q, pick); }}>
                        Bu kategoriye bağla
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={sx("display:flex;flex-direction:column;gap:16px")}>
          <div style={sx("background:var(--surface-card);border:1px solid var(--border-strong);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:20px")}>
            <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>Eşanlam ekle</div>
            <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:4px;text-wrap:pretty")}>
              Sokakta kullanılan ad, yabancı dildeki karşılığı veya yazım hatası — hepsi aynı kategoriye bağlanır. Ekleme anında aramaya girer.
            </div>
            <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(148px,100%),1fr));gap:12px;margin-top:14px")}>
              <Input
                label="Kelime"
                placeholder="naylon çuval"
                value={word}
                error={err || undefined}
                disabled={locked}
                onChange={(e) => { setWord(e.target.value); setErr(""); }}
              />
              <Select label="Kategori" value={activeCat} onChange={(e) => setCat(e.target.value)}>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.tr}</option>
                ))}
              </Select>
            </div>
            {!!w && (
              <div
                style={sx(
                  "margin-top:12px;padding:11px 13px;border-radius:9px;font-size:12.5px;font-weight:600;text-wrap:pretty;background:var(--color-" +
                  (clashes ? "warning" : "info") + "-soft);color:var(--color-" + (clashes ? "warning" : "info") + ")",
                )}
              >
                {preview}
              </div>
            )}
            <div style={sx("margin-top:14px")}>
              <Button color="accent" fullWidth disabled={locked} onClick={() => add(word, activeCat)}>
                Sözlüğe ekle
              </Button>
            </div>
          </div>

          <div style={sx("background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);overflow:hidden")}>
            <div style={sx("padding:16px 20px;border-bottom:1px solid var(--border-default);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap")}>
              <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>{catName(activeCat) + " eşanlamları"}</div>
              <span style={sx("font-size:12px;color:var(--text-muted)")}>{words.length + " kelime"}</span>
            </div>
            <div style={sx("padding:16px 20px;display:flex;gap:7px;flex-wrap:wrap")}>
              {words.length === 0 && (
                <div style={sx("font-size:13px;color:var(--text-muted)")}>Bu kategoride henüz eşanlam yok.</div>
              )}
              {words.map((x) => (
                <span
                  key={x}
                  style={sx("display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 6px 0 11px;border-radius:999px;background:var(--surface-muted);border:1px solid var(--border-default);font-size:12.5px;font-weight:600;color:var(--text-body)")}
                >
                  {x}
                  {!locked && (
                    <button
                      type="button"
                      aria-label={"“" + x + "” eşanlamını kaldır"}
                      onClick={() => {
                        SE.dropSynonym(activeCat, x);
                        SE.saveLexicon(activeCat, x, true);
                        bump();
                        props.refresh();
                        props.say("“" + x + "” sözlükten kaldırıldı");
                      }}
                      style={sx("width:18px;height:18px;border-radius:999px;border:none;background:rgba(0,0,0,.08);color:inherit;font-family:inherit;font-size:12px;line-height:1;cursor:pointer")}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
