"use client";

// Alıcı Talepleri — aramada karşılığı olmayan isteklerin akışı.
//
// Prototipteki üç kolonlu akış (Yeni → Mağazalara iletildi → Kapandı) birebir
// taşındı. ADMIN-PLANI'nın "Yarım · teklif görünmüyor" bulgusu burada kapanır:
// her talebin üstünde artık gelen teklif sayısı ve alıcının kademesi
// (AD.buyerState — Alıcı Doğrulama sekmesinin verdiği karar) görünür.
//
// "İlerlet" prototipte olduğu gibi ekran durumudur, depoya yazılmaz: talebin
// kalıcı sahibi alıcı tarafıdır (kabul / vazgeç oradan gelir), panel yalnız
// operasyon görünümünü ilerletir. Kapanma ise gerçek veriden okunur —
// kabul edilmiş teklif (acceptedOffers) ya da alıcının kendi durumu.

import { useState } from "react";

import * as AD from "@/data/han-admin";
import * as OF from "@/data/han-offers";
import type { BuyRequest } from "@/data/types";
import { Badge, Button, EmptyState } from "@/ds";
import { sx } from "@/lib/sx";
import { KEYS, readKey } from "@/services/storage";
import type { PersistedState } from "@/state/types";

import { H1, num, Pill, SUB, type PanelTabProps } from "./shared";

type Durum = "yeni" | "iletildi" | "kapandi";

const GROUPS: { key: Durum; title: string; color: "danger" | "warning" | "success"; advanceLabel: string | null }[] = [
  { key: "yeni", title: "Yeni", color: "danger", advanceLabel: "İlet" },
  { key: "iletildi", title: "Mağazalara iletildi", color: "warning", advanceLabel: "Kapat" },
  { key: "kapandi", title: "Kapandı", color: "success", advanceLabel: null },
];

// Talep kimliği bir zaman damgasıdır (Date.now()); içe aktarılmış eski bir
// satır olmayabilir. Saçma bir yaş basmaktansa "tarihi bilinmiyor" denir —
// marketHealth'teki kuralın aynısı.
const YEAR2020 = 1577836800000;

function ago(t: BuyRequest): string {
  const stamp = Number(t.at || t.id);
  if (!(stamp > YEAR2020 && stamp <= Date.now() + 86400000)) return t.zaman || "tarihi bilinmiyor";
  const h = Math.round((Date.now() - stamp) / 3600000);
  return h < 1 ? "Az önce" : h < 24 ? h + " saat önce" : Math.round(h / 24) + " gün önce";
}

export default function Talepler(props: PanelTabProps) {
  const { readOnly, say } = props;

  // İlerletme kalıcı değil: sayfa durumu. Prototipteki `advanced` sözlüğü.
  const [advanced, setAdvanced] = useState<Record<string, Durum>>({});

  const web = readKey<Partial<PersistedState>>(KEYS.web, {});
  const talepler = web.talepler || [];
  const acc = web.acceptedOffers || {};

  const durumOf = (t: BuyRequest): Durum =>
    advanced[t.id] ||
    (acc[String(t.id)] || t.durum === "kapandi" || t.durum === "vazgecildi" ? "kapandi" : "yeni");

  const advance = (t: BuyRequest) => {
    if (readOnly) return say("Salt okuma rolü karar veremez");
    const next: Durum = durumOf(t) === "yeni" ? "iletildi" : "kapandi";
    setAdvanced((s) => ({ ...s, [t.id]: next }));
    say(next === "iletildi" ? "Talep mağazalara iletildi olarak işaretlendi" : "Talep kapandı olarak işaretlendi");
  };

  return (
    <>
      <h1 style={sx(H1)}>Alıcı Talepleri</h1>
      <p style={sx(SUB)}>
        Aramada karşılığı olmayan istekler ve akışı. Her talebin üstünde gelen teklif sayısı ve
        alıcının kademesi görünür — kademe Alıcı Doğrulama sekmesinden verilir, talep geldiği anda donar.
      </p>

      {talepler.length === 0 ? (
        <div style={sx("margin-top:16px")}>
          <EmptyState
            icon="notepad"
            tone="neutral"
            title="Henüz alıcı talebi yok"
            description="Alıcı tarafında talep bırakıldıkça buraya düşer; teklif hunisinin ayrıntısı Teklif Denetimi sekmesindedir."
          />
        </div>
      ) : (
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(255px,100%),1fr));gap:16px;align-items:start;margin-top:16px")}>
          {GROUPS.map((g) => {
            const items = talepler.filter((t) => durumOf(t) === g.key);
            return (
              <div key={g.key} style={sx("background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;box-shadow:0 3px 4px rgba(0,0,0,.03);overflow:hidden")}>
                <div style={sx("padding:14px 18px;border-bottom:1px solid var(--border-default);display:flex;align-items:center;justify-content:space-between")}>
                  <span style={sx("font-size:14px;font-weight:600;color:var(--text-heading)")}>{g.title}</span>
                  <Badge color={g.color} variant="light">{items.length}</Badge>
                </div>
                <div style={sx("padding:14px;display:flex;flex-direction:column;gap:10px;min-height:120px")}>
                  {items.map((t) => {
                    // Alıcı anahtarı Alıcı Doğrulama sekmesiyle aynı kuraldan
                    // türetilir ki iki ekran aynı kişiyi aynı kademede görsün.
                    const tel = String(t.tel || t.buyer?.firm || "bilinmiyor");
                    const bst = AD.buyerState(tel);
                    const bmeta = AD.BUYER_STATES[bst.status];
                    const offers = OF.offersOf(t.id).length;
                    const adet = Number(String(t.adet || "").replace(/[^\d]/g, "")) || 0;
                    return (
                      <div key={t.id} style={sx("border:1px solid var(--border-default);border-radius:8px;padding:12px;background:var(--surface-page)")}>
                        <div style={sx("font-size:13px;font-weight:600;color:var(--text-heading);line-height:1.4")}>{t.urun}</div>
                        <div style={sx("font-size:12px;color:var(--text-muted);margin-top:4px")}>
                          {num(adet) + " " + (t.birim || "adet")}
                        </div>
                        <div style={sx("display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px")}>
                          <Pill label={bmeta.tr} t={bmeta.tone} />
                          <Pill label={offers ? offers + " teklif" : "teklif yok"} t={offers ? "success" : "secondary"} />
                        </div>
                        <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px")}>
                          <span style={sx("font-size:11px;color:var(--text-placeholder)")}>{ago(t)}</span>
                          {g.advanceLabel && (
                            <Button variant="light" color="primary" size="sm" disabled={readOnly} onClick={() => advance(t)}>
                              {g.advanceLabel}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <div style={sx("font-size:12px;color:var(--text-placeholder);text-align:center;padding:20px 0")}>Kayıt yok</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
