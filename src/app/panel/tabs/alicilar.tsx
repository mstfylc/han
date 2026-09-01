"use client";

// Alıcı Doğrulama — "kademeyi kim veriyor?" sorusunun cevabı. (ADMIN-PLANI 8)
//
// Talebin üstündeki "onaylı firma · N anlaşma" rozeti esnafın kimi ciddiye
// alacağını belirler; o rozet buradan verilir. Alıcılar ayrı bir tablodan
// gelmez — talep bırakanlardan türetilir (olmayanı uydurmuyoruz). Doğrula ·
// izlemeye al · reddet (AD.setBuyerState); karar yeni taleplerin kademesini
// belirler, talep geldiği anda kademe donar.
//
// Riskli imza: 3+ talep bırakıp teklif aldığı hâlde hiç anlaşma kapatmayan
// alıcı işaretlenir — suçlama değil, esnafın zamanını koruyan sinyal.
// Telefonlar maskeli gösterilir (AD.maskTel).

import { useState } from "react";

import * as AD from "@/data/han-admin";
import * as OF from "@/data/han-offers";
import { Alert, Button } from "@/ds";
import { sx } from "@/lib/sx";
import { KEYS, readKey } from "@/services/storage";
import type { PersistedState } from "@/state/types";

import { H1, num, Pill, SUB, type PanelTabProps } from "./shared";

const card = (tone?: string | null) =>
  "background:var(--surface-card);border:1px solid var(--border-" +
  (tone ? "strong" : "default") + ");border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);padding:18px 20px" +
  (tone ? ";border-left:3px solid var(--color-" + tone + ")" : "");

interface BuyerRow {
  tel: string;
  firm: string;
  reqs: number;
  deals: number;
  offers: number;
}

const ACTIONS: [AD.BuyerStatus, string, "light" | "ghost", "success" | "warning" | "danger"][] = [
  ["onayli", "Firmayı doğrula", "light", "success"],
  ["riskli", "İzlemeye al", "light", "warning"],
  ["red", "Reddet", "ghost", "danger"],
];

export default function Alicilar(props: PanelTabProps) {
  const { readOnly, refresh, say } = props;

  const [filter, setFilter] = useState<string>("all");

  const web = readKey<Partial<PersistedState>>(KEYS.web, {});
  const talepler = web.talepler || [];
  const acc = web.acceptedOffers || {};

  // Alıcılar taleplerden türetilir: ayrı bir alıcı tablosu yok, olanı uydurmuyoruz.
  const byTel: Record<string, BuyerRow> = {};
  talepler.forEach((t) => {
    const tel = String(t.tel || t.buyer?.firm || "bilinmiyor");
    const b = (byTel[tel] = byTel[tel] || { tel, firm: t.buyer?.firm || "", reqs: 0, deals: 0, offers: 0 });
    b.reqs += 1;
    if (acc[String(t.id)]) b.deals += 1;
    b.offers += OF.offersOf(t.id).length;
  });

  const ST = AD.BUYER_STATES;
  const items = Object.keys(byTel).map((tel) => {
    const b = byTel[tel];
    const st = AD.buyerState(tel);
    // Riskli imza: çok talep bırakan ama hiç anlaşma kapatmayan alıcı esnafın
    // zamanını harcıyor. Suçlama değil, izleme sinyali.
    const risky = b.reqs >= 3 && b.deals === 0 && b.offers > 0;
    return { b, st, risky };
  }).sort((a, b) => b.b.reqs - a.b.reqs);

  const counts: Partial<Record<AD.BuyerStatus, number>> = {};
  (Object.keys(ST) as AD.BuyerStatus[]).forEach((k) => { counts[k] = items.filter((i) => i.st.status === k).length; });
  const rows = items.filter((i) => filter === "all" || i.st.status === filter);

  const filters = [{ value: "all", label: "Tümü · " + items.length }].concat(
    (Object.keys(ST) as AD.BuyerStatus[]).filter((k) => counts[k]).map((k) => ({ value: k, label: ST[k].tr + " · " + counts[k] })),
  );

  const set = (tel: string, status: AD.BuyerStatus) => {
    if (readOnly) return say("Salt okuma rolü karar veremez");
    AD.setBuyerState(tel, { status });
    refresh();
    say("Alıcı kademesi güncellendi: " + ST[status].tr);
  };

  return (
    <>
      <h1 style={sx(H1)}>Alıcı Doğrulama</h1>
      <p style={sx(SUB)}>Talep bırakan alıcıların kademesi — esnafın kimi ciddiye alacağını belirler.</p>

      <div style={sx("margin-top:16px")}>
        <Alert color="info" variant="light" title="Kademeyi kim veriyor?">
          Talebin üstündeki &quot;onaylı firma · N anlaşma&quot; rozeti esnafın kimi ciddiye alacağını
          belirler. O rozet buradan verilir — talep geldiği anda kademe donar, sonradan değişen profil
          geçmiş talepleri değiştirmez.
        </Alert>
      </div>

      <div style={sx("margin-top:16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;padding:15px 20px")}>
        {filters.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "light" : "ghost"}
            color={filter === f.value ? "primary" : "dark"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
        <div style={sx("margin-left:auto;font-size:13px;color:var(--text-muted)")}>{rows.length} alıcı</div>
      </div>

      {rows.length === 0 && (
        <div style={sx("margin-top:16px;background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;padding:34px 22px;text-align:center")}>
          <div style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>
            {items.length ? "Bu durumda alıcı yok" : "Henüz talep bırakan alıcı yok"}
          </div>
          <div style={sx("font-size:13px;color:var(--text-muted);margin-top:5px;max-width:60ch;margin-left:auto;margin-right:auto;text-wrap:pretty")}>
            {items.length
              ? "Diğer duruma bakın."
              : "Alıcılar ayrı bir tablodan gelmiyor — talep bırakanlardan türetiliyor. İlk talep geldiğinde doğrulama kuyruğu buradan işler."}
          </div>
        </div>
      )}

      <div style={sx("margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:14px")}>
        {rows.map((i) => {
          const meta = ST[i.st.status];
          const digits = i.b.tel.replace(/\D/g, "");
          const telLabel = i.b.tel === "bilinmiyor" ? "telefon yok" : digits.length >= 6 ? AD.maskTel(i.b.tel) : i.b.tel;
          return (
            <div key={i.b.tel} style={sx(card(i.st.status === "onayli" ? "success" : i.risky ? "warning" : null))}>
              <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:12px")}>
                <div style={sx("min-width:0")}>
                  <div style={sx("font-size:14.5px;font-weight:600;line-height:1.35;color:var(--text-heading)")}>{i.b.firm || "İsimsiz alıcı"}</div>
                  <div style={sx("font-size:12.5px;line-height:1.5;color:var(--text-muted);margin-top:3px;font-family:var(--font-mono)")}>{telLabel}</div>
                </div>
                <Pill label={meta.tr} t={meta.tone} />
              </div>

              <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(74px,1fr));gap:10px;margin-top:14px")}>
                {[
                  { value: i.b.reqs, label: "talep" },
                  { value: i.b.offers, label: "gelen teklif" },
                  { value: i.b.deals, label: "anlaşma" },
                ].map((s) => (
                  <div key={s.label}>
                    <div style={sx("font-size:18px;font-weight:700;color:var(--text-heading)")}>{num(s.value)}</div>
                    <div style={sx("font-size:11px;color:var(--text-muted)")}>{s.label}</div>
                  </div>
                ))}
              </div>

              {i.risky && (
                <div style={sx("margin-top:12px;padding:10px 12px;border-radius:9px;background:var(--color-warning-soft);color:var(--color-warning);font-size:12.5px;font-weight:600;text-wrap:pretty")}>
                  {i.b.reqs + " talep bıraktı, " + i.b.offers + " teklif aldı, hiç anlaşma kapatmadı. Esnafın zamanını harcıyor olabilir."}
                </div>
              )}

              {!readOnly && (
                <div style={sx("margin-top:13px;padding-top:13px;border-top:1px solid var(--border-default);display:flex;gap:8px;flex-wrap:wrap")}>
                  {ACTIONS.filter((a) => a[0] !== i.st.status).map((a) => (
                    <Button key={a[0]} variant={a[2]} color={a[3]} size="sm" onClick={() => set(i.b.tel, a[0])}>
                      {a[1]}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
