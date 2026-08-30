"use client";

// Yetkililer — bölge sorumluları ve yükleri.
//
// Prototipin (HAN Editör.dc.html · isOfficers/officerRows) birebir portu:
// her yetkili için sorumlu birim sayısı, onaylı kayıt, beyan kuyruğu ve
// anlaşmalı han sayısı. Sayılar uydurulmaz — yetkilinin kayıtlarından ve
// o kayıtların durduğu yerlerden türer.

import { useMemo } from "react";

import * as SC from "@/data/han-scale";
import { sx } from "@/lib/sx";

import { H1, KICKER, SUB, num } from "./shared";
import type { PanelTabProps } from "./shared";

export default function Yetkililer(_props: PanelTabProps) {
  const rows = useMemo(
    () =>
      Object.keys(SC.OFFICERS).map((id) => {
        const o = SC.OFFICERS[id];
        const mine = SC.RECORDS.filter((r) => r.officer === id);
        const open = mine.filter((r) => r.status === "onayli" || r.status === "aktif").length;
        const beyan = mine.filter((r) => r.status === "beyan").length;
        const places = SC.PLACES.filter((p) => mine.some((r) => r.place === p.id));
        const units = places.reduce((t, p) => t + p.units, 0);
        return {
          id,
          name: o.name,
          role: o.tr,
          ini: o.name.charAt(0),
          cells: [
            { label: "Sorumlu birim", value: num(units) },
            { label: "Onaylı kayıt", value: num(open) },
            { label: "Beyan kuyruğu", value: num(beyan) },
            { label: "Anlaşmalı han", value: String(places.filter((p) => SC.BULK_APPROVED.includes(p.id)).length) },
          ],
        };
      }),
    [],
  );

  return (
    <>
      <h1 style={sx(H1)}>Yetkililer</h1>
      <p style={sx(SUB)}>Bölge sorumluları ve yükleri.</p>

      <div style={sx("margin-top:18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr));gap:14px")}>
        {rows.map((o) => (
          <div key={o.id} style={sx("border:1px solid var(--border-strong);border-radius:14px;background:var(--surface-card);padding:18px;box-shadow:0 3px 4px rgba(0,0,0,.03)")}>
            <div style={sx("display:flex;align-items:center;gap:12px")}>
              <span
                aria-hidden="true"
                style={sx("flex:none;width:44px;height:44px;border-radius:999px;background:var(--color-primary-soft);color:var(--color-primary-accent);font-size:17px;font-weight:700;display:flex;align-items:center;justify-content:center")}
              >
                {o.ini}
              </span>
              <div style={sx("flex:1;min-width:0")}>
                <div style={sx("font-size:16px;font-weight:700;color:var(--text-heading)")}>{o.name}</div>
                <div style={sx("font-size:13px;color:var(--text-muted);margin-top:2px;text-wrap:pretty")}>{o.role}</div>
              </div>
            </div>

            <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:1px;margin-top:14px;background:var(--border-default);border:1px solid var(--border-default);border-radius:10px;overflow:hidden")}>
              {o.cells.map((c) => (
                <div key={c.label} style={sx("background:var(--surface-card);padding:11px 12px")}>
                  <div style={sx(KICKER)}>{c.label}</div>
                  <div style={sx("font-size:17px;font-weight:700;color:var(--text-heading);margin-top:3px;font-variant-numeric:tabular-nums")}>
                    {c.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:12px;text-wrap:pretty")}>
              Han yönetimiyle çalışıldığında bir günde bir hanın tamamı (500+ dükkân) onaylanabilir;
              saha turu ise günde 40–60 birim ilerler.
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
