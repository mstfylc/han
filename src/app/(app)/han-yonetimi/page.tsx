"use client";

// HAN — Han Yönetimi Portalı (/han-yonetimi): building/han manager dashboard.
// Shows real unit occupancy, floor-by-floor tenant roster, vacant doors, and direct links
// to the official RBAC-protected bulk import & KVKK invite console (/panel/iceaktar).

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import * as SC from "@/data/han-scale";
import type { Lang } from "@/data/types";
import { Alert, Button, Select } from "@/ds";
import { getHanManagementSummary } from "@/lib/ecosystem";
import { num } from "@/lib/i18n";
import { pagePad } from "@/lib/layout";
import { PARAM, getStr, href } from "@/lib/routes";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

export default function HanManagementPage() {
  return (
    <Suspense fallback={null}>
      <HanManagementScreen />
    </Suspense>
  );
}

function HanManagementScreen() {
  const { state } = useApp();
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = state;

  const initialPlace = getStr(sp, PARAM.place, "santral");
  const [placeId, setPlaceId] = useState(initialPlace);
  const [activeFloor, setActiveFloor] = useState<number | "all">("all");

  const sortedPlaces = useMemo(
    () => SC.PLACES.slice().sort((a, b) => (a.id === "santral" ? -1 : b.id === "santral" ? 1 : b.units - a.units)),
    [],
  );

  const summary = useMemo(() => getHanManagementSummary(placeId), [placeId]);

  const visibleFloors = useMemo(
    () => (activeFloor === "all" ? summary.floors : summary.floors.filter((f) => f.floor === activeFloor)),
    [summary.floors, activeFloor],
  );

  return (
    <div style={sx("max-width:1480px;margin:0 auto;" + pagePad(state.vw))}>
      {/* Header */}
      <section
        style={sx(
          "border-radius:var(--radius-card, 16px);border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:var(--shadow-card);padding:22px 24px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap",
        )}
      >
        <div style={sx("flex:1;min-width:260px")}>
          <div style={sx("font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--color-primary)")}>
            {pk({ tr: "HAN YÖNETİMİ & BİNA MÜDÜRLÜĞÜ PORTALI", en: "HAN MANAGEMENT & BUILDING OFFICE PORTAL" }, lang)}
          </div>
          <h1 style={sx("font-size:clamp(22px, 2.8vw, 30px);font-weight:800;color:var(--text-heading);margin:6px 0 0;letter-spacing:-.02em")}>
            {summary.place.name} — {pk({ tr: "Kat, Kiracı & Kapı Yönetimi", en: "Floor, Tenant & Door Directory" }, lang)}
          </h1>
          <p style={sx("font-size:13.5px;color:var(--text-muted);margin:6px 0 0;max-width:68ch;line-height:1.5")}>
            {pk({
              tr: "Han yönetiminin onaylı kiracı listesi tek doğrulama kaynağıdır. Kat bazlı doluluk, boş kapılar, fotoğrafsız dükkânlar ve toplu Excel/CSV aktarımı buradan yönetilir.",
              en: "The han office tenant list is the single source of verification. Track floor occupancy, vacant doors, missing storefront photos, and bulk CSV imports.",
            }, lang)}
          </p>
        </div>

        <div style={sx("display:flex;flex-direction:column;gap:8px;min-width:240px")}>
          <Select
            label={pk({ tr: "Han / Çarşı Seçin", en: "Select Han / Bazaar" }, lang)}
            value={placeId}
            onChange={(e) => {
              setPlaceId(e.target.value);
              setActiveFloor("all");
            }}
          >
            {sortedPlaces.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.id === "santral" ? "★ " : "") + p.name + ` (${p.units} birim)`}
              </option>
            ))}
          </Select>
          <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
            <Button color="primary" size="sm" iconStart="floor-layer" onClick={() => router.push(href.place(summary.place.id))}>
              {pk({ tr: "Kat Planını Aç", en: "Open Floor Plan" }, lang)}
            </Button>
            <Button color="accent" size="sm" onClick={() => router.push("/panel/iceaktar")}>
              {pk({ tr: "Toplu Liste & Davet ↗", en: "Bulk Import & Invites ↗" }, lang)}
            </Button>
          </div>
        </div>
      </section>

      {/* KPI Strip */}
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:12px;margin-top:16px")}>
        {[
          { k: pk({ tr: "Toplam Birim", en: "Total Units" }, lang), v: num(summary.totalUnits, lang), tone: "primary" },
          { k: pk({ tr: "Kayıtlı Kiracı", en: "Recorded Tenants" }, lang), v: `${num(summary.recordedCount, lang)} (%${summary.occupancyPct})`, tone: "info" },
          { k: pk({ tr: "Onaylı / Aktif", en: "Verified / Active" }, lang), v: num(summary.verifiedCount, lang), tone: "success" },
          { k: pk({ tr: "Onay Bekleyen Beyan", en: "Pending Claims" }, lang), v: num(summary.pendingCount, lang), tone: "warning" },
          { k: pk({ tr: "Fotoğrafsız Vitrin", en: "Missing Photo" }, lang), v: num(summary.noPhotoCount, lang), tone: "danger" },
        ].map((kpi) => (
          <div
            key={kpi.k}
            style={sx("padding:16px 18px;border-radius:var(--radius-card, 16px);border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:var(--shadow-card)")}
          >
            <div style={sx("font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)")}>{kpi.k}</div>
            <div style={sx(`font-size:24px;font-weight:800;margin-top:6px;color:var(--color-${kpi.tone})`)}>{kpi.v}</div>
          </div>
        ))}
      </div>

      {/* RBAC Info Banner */}
      <div style={sx("margin-top:14px")}>
        <Alert color="info" variant="light" title={pk({ tr: "Yetkili Han Yönetimi İşlemleri", en: "Authenticated Han Office Actions" }, lang)}>
          {pk({
            tr: "Kiracı onaylama, Excel/CSV toplu içe aktarma ve KVKK uyumlu WhatsApp/QR davet bağlantısı üretmek için yetkilendirilmiş oturumla Çarşı Yönetim Paneli (/panel/iceaktar) açılır.",
            en: "Tenant approval, bulk CSV import, and KVKK-compliant WhatsApp/QR invites require an authenticated officer session in /panel/iceaktar.",
          }, lang)}
        </Alert>
      </div>

      {/* Floor Filter Pills */}
      <div style={sx("display:flex;gap:8px;flex-wrap:wrap;margin-top:18px")}>
        <button
          type="button"
          onClick={() => setActiveFloor("all")}
          style={sx(
            "height:34px;padding:0 13px;border-radius:999px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;border:1px solid " +
              (activeFloor === "all"
                ? "var(--color-primary);background:var(--color-primary);color:#fff"
                : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
          )}
        >
          {pk({ tr: `Tüm Katlar (${summary.floors.length})`, en: `All Floors (${summary.floors.length})` }, lang)}
        </button>
        {summary.floors.map((fl) => {
          const on = activeFloor === fl.floor;
          return (
            <button
              key={fl.floor}
              type="button"
              onClick={() => setActiveFloor(fl.floor)}
              style={sx(
                "height:34px;padding:0 13px;border-radius:999px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;border:1px solid " +
                  (on
                    ? "var(--color-primary);background:var(--color-primary);color:#fff"
                    : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
              )}
            >
              {fl.label} · {fl.occupiedCount}
            </button>
          );
        })}
      </div>

      {/* Floor-by-Floor Door Roster */}
      <div style={sx("display:flex;flex-direction:column;gap:14px;margin-top:16px")}>
        {visibleFloors.map((fl) => (
          <section
            key={fl.floor}
            style={sx("border-radius:var(--radius-card, 16px);border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:var(--shadow-card);padding:18px 20px")}
          >
            <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid var(--border-default)")}>
              <div>
                <h2 style={sx("font-size:17px;font-weight:800;color:var(--text-heading);margin:0")}>{fl.label}</h2>
                <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                  {fl.occupiedCount} {pk({ tr: "kayıtlı kapı", en: "recorded doors" }, lang)} · {fl.verifiedCount} {pk({ tr: "onaylı", en: "verified" }, lang)}
                  {fl.vacantDoors.length > 0 ? ` · ${fl.vacantDoors.length} boş/kiralık` : ""}
                </div>
              </div>
              <Button variant="outline" color="primary" size="sm" onClick={() => router.push(href.place(summary.place.id))}>
                {pk({ tr: "Kat Krokisinde Gör ➔", en: "View on Floor Plan ➔" }, lang)}
              </Button>
            </div>

            {fl.vacantDoors.length > 0 && (
              <div style={sx("display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px")}>
                <span style={sx("font-size:12px;font-weight:700;color:var(--color-warning)")}>
                  🚪 {pk({ tr: "Boş / Kiralık Kapılar:", en: "Vacant Doors:" }, lang)}
                </span>
                {fl.vacantDoors.map((d) => (
                  <span key={d} style={sx("font-size:11.5px;font-family:var(--font-mono);font-weight:700;padding:2px 8px;border-radius:6px;background:var(--color-warning-soft);color:var(--color-warning)")}>
                    No:{d}
                  </span>
                ))}
              </div>
            )}

            <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:8px;margin-top:12px")}>
              {fl.records.slice(0, 24).map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => router.push(href.store(rec.curated || rec.id))}
                  style={sx(
                    "display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid var(--border-default);background:var(--surface-muted);font-family:inherit;text-align:start;cursor:pointer",
                  )}
                >
                  <span style={sx("flex:none;min-width:44px;text-align:center;padding:4px 6px;border-radius:7px;background:var(--color-primary-soft);color:var(--color-primary);font-family:var(--font-mono);font-size:12px;font-weight:800")}>
                    {rec.door}
                  </span>
                  <span style={sx("flex:1;min-width:0")}>
                    <span style={sx("display:block;font-size:13px;font-weight:700;color:var(--text-heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                      {rec.name}
                    </span>
                    <span style={sx("display:block;font-size:11.5px;color:var(--text-muted)")}>
                      {rec.cat} · {rec.status}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
