"use client";

// Panel — the market's own health.
//
// Four tabs that all answer one question from different sides: is a request
// that entered this market getting an answer?
//
//   Alıcı Talepleri  — every open request, whoever raised it
//   Teklif Denetimi  — the SLA view: who is silent, and for how long
//   Yorum Denetimi   — reviews, moderated for rule-breaking, not for tone
//   Alıcı Doğrulama  — who a trader should take seriously, decided by a person
//
// K7's north star is "a request that found an answer", so the answer rate is
// the number these screens are built around — not traffic, not listings.

import { useMemo, useState } from "react";

import * as AD from "@/data/han-admin";
import * as OF from "@/data/han-offers";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import type { BuyRequest, Review } from "@/data/types";
import { Button, EmptyState, Input, Textarea } from "@/ds";
import { sx } from "@/lib/sx";

import { Pill } from "./Pill";
import { CARD, H1, KICKER, SUB, num } from "./shared";

// ── Alıcı Talepleri ───────────────────────────────────────────────────────

export function Talepler({
  requests, readOnly, officer, onNudge, say,
}: {
  requests: BuyRequest[];
  readOnly: boolean;
  officer: string;
  onNudge: () => void;
  say: (m: string) => void;
}) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const nq = q.trim().toLocaleLowerCase("tr");
    return requests
      .filter((t) => !nq || String(t.urun || "").toLocaleLowerCase("tr").includes(nq))
      .sort((a, b) => Number(b.at || b.id) - Number(a.at || a.id));
  }, [requests, q]);

  return (
    <>
      <h1 style={sx(H1)}>Alıcı talepleri</h1>
      <p style={sx(SUB)}>
        Pazara giren her talep. Bunlar panelin uydurduğu sayılar değil — alıcının kendi yazdığı,
        esnafın gördüğü taleplerin ta kendisi.
      </p>

      <div style={sx("margin-top:16px;max-width:420px")}>
        <Input size="md" placeholder="Ürün ara" aria-label="Ürün ara" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div style={sx("display:flex;flex-direction:column;gap:9px;margin-top:16px")}>
        {rows.map((t) => {
          const real = OF.offersOf(t.id);
          const seen = OF.seenCount(t.id);
          const nudges = AD.nudgesOf(t.id);
          const b = t.buyer;
          return (
            <div key={t.id} style={sx(CARD)}>
              <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
                <div style={sx("min-width:0")}>
                  <div style={sx("font-size:16px;font-weight:700;color:var(--text-heading)")}>{t.urun}</div>
                  <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px")}>
                    {[t.adet ? t.adet + " " + (t.birim === "koli" ? "koli" : "adet") : "", t.zaman, t.numune ? "numune istiyor" : ""]
                      .filter(Boolean).join(" · ")}
                  </div>
                </div>
                <Pill
                  label={real.length ? real.length + " gerçek teklif" : "yanıtsız"}
                  t={real.length ? "success" : "danger"}
                />
              </div>

              {t.aciklama && (
                <p style={sx("font-size:13px;color:var(--text-body);margin-top:9px;padding:9px 11px;border-radius:9px;background:var(--surface-muted);text-wrap:pretty")}>
                  {t.aciklama}
                </p>
              )}

              <div style={sx("display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:12.5px;color:var(--text-muted)")}>
                <span>Açıldı: {seen}</span>
                <span>
                  Alıcı: {b?.verified ? "onaylı firma" : b?.telOk ? "telefonu doğrulanmış" : "misafir"}
                  {b?.deals ? " · " + b.deals + " anlaşma" : ""}
                </span>
                {nudges.length > 0 && <span>{nudges.length} yönlendirme</span>}
              </div>

              {/* A silent request does not resolve itself. Pointing at a shop by
                  hand is the one lever operations has, and the trader sees it
                  as "management forwarded this to you". */}
              {!real.length && !readOnly && (
                <div style={sx("margin-top:12px")}>
                  <NudgeBox req={t} officer={officer} onDone={() => { onNudge(); say("Talep esnafa iletildi"); }} />
                </div>
              )}
            </div>
          );
        })}

        {rows.length === 0 && (
          <EmptyState icon="notepad" tone="neutral" title="Talep yok" description="Alıcı bir talep bıraktığında burada görünür." />
        )}
      </div>
    </>
  );
}

function NudgeBox({ req, officer, onDone }: { req: BuyRequest; officer: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const candidates = useMemo(() => {
    if (!open) return [];
    const d = SE.distribute(req, { mode: "ikisi", lang: "tr" });
    return (d?.sent || []).slice(0, 8);
  }, [open, req]);

  if (!open) {
    return <Button variant="outline" color="primary" size="sm" onClick={() => setOpen(true)}>Bir dükkâna ilet</Button>;
  }

  return (
    <div style={sx("padding:12px;border-radius:11px;background:var(--surface-muted);border:1px solid var(--border-strong)")}>
      <div style={sx("font-size:13px;font-weight:700;color:var(--text-heading)")}>Bu talebi kime iletelim?</div>
      <div style={sx("display:flex;flex-wrap:wrap;gap:7px;margin-top:9px")}>
        {candidates.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              AD.addNudge(req.id, r.id, SC.OFFICERS[officer]?.name || "Yönetim");
              setOpen(false);
              onDone();
            }}
            style={sx("height:32px;padding:0 12px;border-radius:999px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:12.5px;font-weight:600;color:var(--text-body);cursor:pointer")}
          >
            {r.name || r.id}
          </button>
        ))}
        {candidates.length === 0 && (
          <span style={sx("font-size:13px;color:var(--text-muted)")}>Bu talebe uyan kayıt bulunamadı.</span>
        )}
      </div>
      <div style={sx("margin-top:10px")}>
        <Button variant="ghost" color="dark" size="sm" onClick={() => setOpen(false)}>Vazgeç</Button>
      </div>
    </div>
  );
}

// ── Teklif Denetimi ───────────────────────────────────────────────────────

export function Teklifler({ requests }: { requests: BuyRequest[] }) {
  const health = useMemo(
    () => AD.marketHealth(
      requests,
      (id) => OF.offersOf(id),
      (id) => OF.seenCount(id),
      (id) => OF.declineCount(id),
    ),
    [requests],
  );

  const cards = [
    { label: "Açık talep", value: num(health.open) },
    { label: "Teklif almış", value: num(health.quoted), tone: "success" },
    { label: "Sessiz", value: num(health.silent), tone: "warning" },
    { label: AD.SLA_HOURS + " saati geçmiş", value: num(health.overdue), tone: "danger" },
  ];

  return (
    <>
      <h1 style={sx(H1)}>Teklif denetimi</h1>
      <p style={sx(SUB)}>
        Pazarın tek gerçek sağlık göstergesi yanıt oranıdır: kaç talep bir esnaftan gerçek bir
        fiyat aldı. Trafik değil, listelenen dükkân sayısı değil — cevaplanan talep.
      </p>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:14px;margin-top:18px")}>
        <div style={sx("background:var(--color-primary);border-radius:14px;padding:20px")}>
          <div style={sx("font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.68)")}>Yanıt oranı</div>
          <div style={sx("font-size:38px;font-weight:700;color:#fff;letter-spacing:-.02em;margin-top:6px")}>
            {health.answerRate == null ? "—" : "%" + health.answerRate}
          </div>
        </div>
        {cards.map((c) => (
          <div key={c.label} style={sx(CARD)}>
            <div style={sx(KICKER)}>{c.label}</div>
            <div style={sx("font-size:28px;font-weight:700;letter-spacing:-.02em;margin-top:5px;font-variant-numeric:tabular-nums;color:" + (c.tone ? "var(--color-" + c.tone + (c.tone === "warning" ? "-accent" : "") + ")" : "var(--text-heading)"))}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:18px")}>
        {health.rows
          .slice()
          .sort((a, b) => (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0) || (b.ageH || 0) - (a.ageH || 0))
          .map((r) => (
            <div key={r.t.id} style={sx("display:flex;align-items:center;gap:12px;padding:12px 15px;border-radius:12px;background:var(--surface-card);border:1px solid " + (r.overdue ? "var(--color-danger)" : "var(--border-strong)"))}>
              <span style={sx("flex:1;min-width:0")}>
                <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>{r.t.urun}</span>
                <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                  {/* An id that is not a timestamp gives a nonsense age. Saying
                      "unknown" beats printing "496674 hours". */}
                  {r.ageKnown ? r.ageH + " saattir açık" : "yaşı bilinmiyor"}
                  {" · açıldı " + r.seen + " · teklif " + r.offers + " · cevaplayamadı " + r.declined}
                </span>
              </span>
              {r.overdue && <Pill label="SLA aşıldı" t="danger" />}
            </div>
          ))}

        {health.rows.length === 0 && (
          <EmptyState icon="chart-line-up" tone="neutral" title="Ölçecek talep yok" description="Pazar bir talep aldığında sağlık tablosu dolar." />
        )}
      </div>
    </>
  );
}

// ── Yorum Denetimi ────────────────────────────────────────────────────────

export function Yorumlar({ readOnly, onChange, say }: { readOnly: boolean; onChange: () => void; say: (m: string) => void }) {
  const all = useMemo(() => {
    const out: { recordId: string; name: string; rv: Review }[] = [];
    const store = OF.allReviews();
    Object.keys(store).forEach((recordId) => {
      const rec = SC.RECORDS.find((r) => r.id === recordId);
      (store[recordId] || []).forEach((rv) => {
        out.push({ recordId, name: rec?.name || recordId, rv });
      });
    });
    return out.sort((a, b) => (b.rv.at || 0) - (a.rv.at || 0));
  }, []);

  const states = AD.allReviewStates();

  return (
    <>
      <h1 style={sx(H1)}>Yorum denetimi</h1>
      <p style={sx(SUB)}>
        Yorum yazma hakkı zaten dar: yalnız o dükkândan teklif kabul etmiş alıcı yazabilir.
        Buradaki iş sahtekârlığı ayıklamak değil, kuralsızlığı — hakaret, kişisel veri, reklam.
        Beğenilmeyen yorum gizlenmez.
      </p>

      <div style={sx("display:flex;flex-direction:column;gap:9px;margin-top:16px")}>
        {all.map(({ recordId, name, rv }) => {
          const key = AD.reviewKey(recordId, rv);
          const st = states[key];
          return (
            <div key={key} style={sx(CARD + (st?.hidden ? ";opacity:.6" : ""))}>
              <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
                <div style={sx("min-width:0")}>
                  <div style={sx("font-size:15px;font-weight:700;color:var(--text-heading)")}>{name}</div>
                  <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                    {"★".repeat(Math.max(0, Math.min(5, rv.stars || 0)))}
                    {rv.at ? " · " + new Date(rv.at).toLocaleDateString("tr-TR") : ""}
                  </div>
                </div>
                {st?.hidden && <Pill label={"Gizlendi · " + (AD.REVIEW_REASONS[st.reason as AD.ReviewReason]?.tr || st.reason)} t="danger" />}
              </div>

              {rv.text && (
                <p style={sx("font-size:13.5px;color:var(--text-body);margin-top:9px;text-wrap:pretty")}>{rv.text}</p>
              )}

              <div style={sx("display:flex;gap:7px;flex-wrap:wrap;margin-top:12px")}>
                {st?.hidden ? (
                  <Button variant="outline" color="primary" size="sm" disabled={readOnly}
                    onClick={() => { AD.restoreReview(recordId, rv); onChange(); say("Yorum geri açıldı"); }}>
                    Geri aç
                  </Button>
                ) : (
                  (Object.keys(AD.REVIEW_REASONS) as AD.ReviewReason[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      disabled={readOnly}
                      onClick={() => { AD.hideReview(recordId, rv, k); onChange(); say("Yorum gizlendi"); }}
                      style={sx("height:30px;padding:0 11px;border-radius:999px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:12.5px;font-weight:600;color:var(--text-muted);cursor:pointer")}
                    >
                      {AD.REVIEW_REASONS[k].tr}
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}

        {all.length === 0 && (
          <EmptyState icon="star" tone="neutral" title="Yorum yok" description="Bir alıcı teklif kabul edip yorum yazdığında burada görünür." />
        )}
      </div>
    </>
  );
}

// ── Alıcı Doğrulama ───────────────────────────────────────────────────────

export function Alicilar({
  requests, readOnly, onChange, say,
}: {
  requests: BuyRequest[];
  readOnly: boolean;
  onChange: () => void;
  say: (m: string) => void;
}) {
  const [note, setNote] = useState<Record<string, string>>({});
  const states = AD.allBuyerStates();

  // One row per phone number, with what that buyer has actually done.
  const buyers = useMemo(() => {
    const by: Record<string, { tel: string; firm: string; reqs: number; verified: boolean }> = {};
    requests.forEach((t) => {
      const tel = String(t.tel || "").replace(/\D/g, "");
      if (!tel) return;
      by[tel] = by[tel] || { tel, firm: t.buyer?.firm || "", reqs: 0, verified: !!t.buyer?.verified };
      by[tel].reqs += 1;
      if (t.buyer?.firm) by[tel].firm = t.buyer.firm;
    });
    return Object.values(by).sort((a, b) => b.reqs - a.reqs);
  }, [requests]);

  return (
    <>
      <h1 style={sx(H1)}>Alıcı doğrulama</h1>
      <p style={sx(SUB)}>
        Talebin üstündeki “onaylı firma” rozetini kim veriyor? Burası. Doğrulanan alıcı esnafın
        gözünde ciddiye alınır — ve bu, ödediği için değil, kim olduğu belli olduğu için.
      </p>

      <div style={sx("display:flex;flex-direction:column;gap:9px;margin-top:16px")}>
        {buyers.map((b) => {
          const st = states[b.tel] || { status: "bekliyor", at: 0, note: "" };
          const meta = AD.BUYER_STATES[st.status];
          return (
            <div key={b.tel} style={sx(CARD)}>
              <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
                <div style={sx("min-width:0")}>
                  <div style={sx("font-size:15.5px;font-weight:700;color:var(--text-heading)")}>{b.firm || AD.maskTel(b.tel)}</div>
                  <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                    {AD.maskTel(b.tel)} · {b.reqs} talep
                  </div>
                </div>
                <Pill label={meta.tr} t={meta.tone} />
              </div>

              {st.note && (
                <p style={sx("font-size:13px;color:var(--text-muted);margin-top:8px")}>{st.note}</p>
              )}

              {!readOnly && (
                <>
                  <div style={sx("margin-top:10px")}>
                    <Input
                      size="md"
                      placeholder="Karar notu"
                      aria-label="Karar notu"
                      value={note[b.tel] || ""}
                      onChange={(e) => setNote((s) => ({ ...s, [b.tel]: e.target.value }))}
                    />
                  </div>
                  <div style={sx("display:flex;gap:7px;flex-wrap:wrap;margin-top:10px")}>
                    {(Object.keys(AD.BUYER_STATES) as AD.BuyerStatus[]).filter((k) => k !== st.status).map((k) => (
                      <Button
                        key={k}
                        variant={k === "onayli" ? "solid" : "outline"}
                        color={k === "red" || k === "riskli" ? "danger" : "primary"}
                        size="sm"
                        onClick={() => {
                          AD.setBuyerState(b.tel, { status: k, note: note[b.tel] || "" });
                          onChange();
                          say("Alıcı durumu güncellendi");
                        }}
                      >
                        {AD.BUYER_STATES[k].tr}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {buyers.length === 0 && (
          <EmptyState icon="verify" tone="neutral" title="Doğrulanacak alıcı yok" description="Telefonuyla talep bırakan alıcılar burada listelenir." />
        )}
      </div>
    </>
  );
}

/** Shared by Talepler: a free-text note field is not always wanted, but when a
 *  decision needs a reason the box has to be there. */
export function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Not" />;
}
