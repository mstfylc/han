"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import type { CuratedStore, Lang, ShopRecord } from "@/data/types";
import IndoorWayfinder from "@/components/IndoorWayfinder";
import SantralFloorMap from "@/components/SantralFloorMap";
import { Alert, Badge, Button, Drawer, EmptyState, Icon } from "@/ds";
import { W } from "@/lib/copy";
import { tx } from "@/lib/i18n";
import { pagePad } from "@/lib/layout";
import { href } from "@/lib/routes";
import { floorLabel, recordName } from "@/lib/shop";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

const CARD =
  "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:18px 20px;box-shadow:0 3px 4px rgba(0,0,0,.03)";
const KICKER =
  "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)";

export default function DirectionsPage() {
  return (
    <Suspense fallback={null}>
      <DirectionsPageInner />
    </Suspense>
  );
}

function DirectionsPageInner() {
  const { state, save, toast } = useApp();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { lang } = state;

  const rawId = decodeURIComponent(String(params.id || ""));
  const searchParams = useSearchParams();
  const qKat = searchParams.get("kat");
  const qKapi = searchParams.get("kapi");
  const qAr = searchParams.get("ar") === "1";
  const [askTraderOpen, setAskTraderOpen] = useState(false);
  const [qrSignOpen, setQrSignOpen] = useState(false);

  const target = useMemo(() => {
    const normalizedId = rawId === "santral-han" ? "santral" : rawId;
    const curated = D.STORES.find((s) => s.id === normalizedId) as CuratedStore | undefined;
    const rec = SC.RECORDS.find((r) => r.id === normalizedId || r.curated === normalizedId);
    const directPlace = SC.PLACES.find((p) => p.id === normalizedId);

    const parseKat = (val: string | null, fallback: number) => {
      if (!val) return fallback;
      const up = val.trim().toUpperCase();
      const map: Record<string, number> = { Z: 0, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };
      if (up in map) return map[up];
      const num = parseInt(up, 10);
      return Number.isFinite(num) ? num : fallback;
    };

    if (curated || rec) {
      const placeId = curated?.han || rec?.place || "santral";
      const place = SC.PLACES.find((p) => p.id === placeId) || SC.PLACES[0];
      const floor = parseKat(qKat, curated ? (curated.floor ?? 0) : (rec?.floor ?? 0));
      const door = qKapi || (curated ? String(curated.no) : String(rec?.door || "1"));
      const title = curated ? curated.name : recordName(rec as ShopRecord, lang);
      return {
        kind: "shop" as const,
        id: curated?.id || rec!.id,
        title,
        place,
        floor,
        door,
        corridor: rec?.corridor || "Orta",
        tel: curated?.tel || rec?.tel || "",
        recId: curated?.id || rec?.id || null,
      };
    }

    if (directPlace) {
      const fallbackFloor = directPlace.id === "santral" && directPlace.floors.includes(1) ? 1 : (directPlace.floors[0] ?? 0);
      const defaultFloor = parseKat(qKat, fallbackFloor);
      return {
        kind: "place" as const,
        id: directPlace.id,
        title: qKapi ? `${directPlace.name} · Kapı No: ${qKapi}` : directPlace.name,
        place: directPlace,
        floor: defaultFloor,
        door: qKapi || ("220" as string | null),
        corridor: "Orta",
        tel: "",
        recId: null,
      };
    }

    return null;
  }, [rawId, lang, qKat, qKapi]);

  if (!target) {
    return (
      <div style={sx("max-width:1480px;margin:0 auto;padding:26px 24px 48px")}>
        <EmptyState
          icon="map"
          tone="neutral"
          title={pk({ tr: "Yol tarifi hedefi bulunamadı", en: "Directions target not found" }, lang)}
          description={pk(
            {
              tr: "Aradığınız dükkân veya han kaydı taşınmış olabilir.",
              en: "The shop or han you requested could not be found.",
            },
            lang,
          )}
          actions={
            <Button color="primary" onClick={() => router.push(href.search())}>
              {W(lang, "search")}
            </Button>
          }
        />
      </div>
    );
  }

  const { place, floor, door, title, corridor } = target;
  const flLbl = floorLabel(floor, lang, place);
  const acc = SC.accessOf(place);
  const semtObj = SC.SEMTLER.find((s) => s.id === place.semt);
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=walking`;
  const mapPts = `${place.lat},${place.lng},${encodeURIComponent(`1. ${place.name}`)},0`;

  const speakFullRoute = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const text =
        lang === "tr"
          ? `${title} için iki katmanlı yol tarifi. Birinci adım: Dış mekânda ${place.name} ana giriş kapısına yürüyün. İkinci adım: Han içine girince ${flLbl} katına ${acc.lift ? "asansör veya merdivenle" : "merdivenle"} çıkın. Üçüncü adım: ${corridor} koridor boyunca ilerleyip ${door ? `Kapı Numarası ${door}` : place.name} noktasına ulaşın.`
          : `Two-stage directions for ${title}. Step 1: Walk to ${place.name} main entrance gate. Step 2: Inside the han, go to ${flLbl}. Step 3: Follow ${corridor} corridor to ${door ? `Door number ${door}` : place.name}.`;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang === "tr" ? "tr-TR" : lang === "ru" ? "ru-RU" : lang === "ar" ? "ar-SA" : "en-US";
      window.speechSynthesis.speak(utter);
    } catch {
      /* ignore speech error */
    }
  };

  const shareWhatsAppRoute = () => {
    const pageUrl =
      typeof window !== "undefined" ? window.location.href : `https://han.ist/tarif/${encodeURIComponent(target.id)}`;
    const msg = [
      `📍 *${title}* — Han İçi Yol Tarifi`,
      `🏛️ Han: ${place.name} (${flLbl}${door ? ` · Kapı No: ${door}` : ""})`,
      `1️⃣ ${place.name} ana giriş kapısından içeri girin`,
      `2️⃣ ${acc.lift ? "Asansör veya merdivenle" : "Merdivenle"} ${flLbl} katına çıkın`,
      `3️⃣ ${corridor} koridoru takip ederek ${door ? `Kapı No: ${door}` : title} vitrinine ulaşın`,
      `🧭 Canlı Kat Planı & Kamera Rehberi: ${pageUrl}`,
    ].join("\n");
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    if (typeof window !== "undefined") {
      window.open(waUrl, "_blank", "noopener,noreferrer");
    }
  };

  const qrCells = useMemo(() => {
    const size = 21;
    const seedStr = `${place.id}:${floor}:${door || "0"}:${title}`;
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const isFinder = (r: number, c: number, r0: number, c0: number) => {
      const dr = r - r0;
      const dc = c - c0;
      if (dr < 0 || dr > 6 || dc < 0 || dc > 6) return null;
      if (dr === 0 || dr === 6 || dc === 0 || dc === 6) return true;
      if (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4) return true;
      return false;
    };
    const cells: { r: number; c: number }[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const f1 = isFinder(r, c, 0, 0);
        const f2 = isFinder(r, c, 0, size - 7);
        const f3 = isFinder(r, c, size - 7, 0);
        if (f1 !== null) {
          if (f1) cells.push({ r, c });
          continue;
        }
        if (f2 !== null) {
          if (f2) cells.push({ r, c });
          continue;
        }
        if (f3 !== null) {
          if (f3) cells.push({ r, c });
          continue;
        }
        // Quiet separator around finders
        if (
          (r <= 7 && c <= 7) ||
          (r <= 7 && c >= size - 8) ||
          (r >= size - 8 && c <= 7)
        ) {
          continue;
        }
        if (r === 6 || c === 6) {
          if ((r + c) % 2 === 0) cells.push({ r, c });
          continue;
        }
        h ^= (r * 31 + c * 17) & 0xff;
        h = Math.imul(h, 16777619);
        if ((h >>> 0) % 11 < 6) {
          cells.push({ r, c });
        }
      }
    }
    return cells;
  }, [place.id, floor, door, title]);

  return (
    <div style={sx("max-width:1480px;margin:0 auto;display:flex;flex-direction:column;gap:16px;min-width:0;width:100%;" + pagePad(state.vw))}>
      {/* Breadcrumb & Top Bar */}
      <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;min-width:0")}>
        <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--text-muted);min-width:0")}>
          <button
            type="button"
            onClick={() => router.back()}
            style={sx(
              "display:inline-flex;align-items:center;gap:6px;background:none;border:none;padding:0;font-family:inherit;font-size:13px;font-weight:700;color:var(--color-primary);cursor:pointer",
            )}
          >
            <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={15} />
            {pk({ tr: "Geri dön", en: "Back" }, lang)}
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => router.push(href.place(place.id))}
            style={sx("background:none;border:none;padding:0;font-family:inherit;font-size:13px;font-weight:600;color:var(--text-body);cursor:pointer")}
          >
            {place.name}
          </button>
          <span>/</span>
          <span style={sx("font-weight:700;color:var(--text-heading)")}>{title}</span>
        </div>

        <div style={sx("display:flex;gap:8px;flex-wrap:wrap;min-width:0")}>
          <Button size="sm" color="success" variant="solid" iconStart="messages" onClick={shareWhatsAppRoute}>
            {pk({ tr: "📲 WhatsApp'tan Tarif Gönder", en: "📲 Send Route via WhatsApp" }, lang)}
          </Button>
          <Button size="sm" color="primary" variant="solid" iconStart="qr" onClick={() => setQrSignOpen(true)}>
            {pk({ tr: "🖨️ Vitrin / Giriş QR Tabelası", en: "🖨️ Shopfront / Gate QR Sign" }, lang)}
          </Button>
          <Button size="sm" color="secondary" variant="outline" iconStart="volume" onClick={speakFullRoute}>
            {pk({ tr: "Sesli Oku", en: "Read Aloud" }, lang)}
          </Button>
          <Button size="sm" color="accent" variant="solid" iconStart="qr" onClick={() => setAskTraderOpen(true)}>
            {pk({ tr: "Esnafa Göster (Yardım Kartı)", en: "Show to Trader" }, lang)}
          </Button>
          <Button
            size="sm"
            color="primary"
            variant="outline"
            iconStart="plus-squared"
            onClick={() => {
              const item = { id: `dir_${Date.now()}`, name: title, qty: "1", target: "" };
              const activeTrip = (state.trips || [])[0];
              const nextTrips = activeTrip
                ? (state.trips || []).map((t, idx) =>
                    idx === 0 ? { ...t, items: (t.items || []).concat([item]), phase: "rota" as const } : t,
                  )
                : state.trips;
              save({
                buyList: (state.buyList || []).concat([item]),
                trips: nextTrips,
              });
              toast(pk({ tr: "Günlük rotanıza eklendi!", en: "Added to your route!" }, lang));
              router.push("/plan");
            }}
          >
            {pk({ tr: "Rotama Ekle", en: "Add to Route" }, lang)}
          </Button>
        </div>
      </div>

      {/* Hero Summary Card */}
      <section style={sx(CARD + ";border-color:var(--color-primary);min-width:0;max-width:100%;overflow:hidden")}>
        <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;min-width:0")}>
          <div style={sx("min-width:0;flex:1 1 240px")}>
            <div style={sx("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
              <Badge color="primary" variant="solid">
                <Icon name="compass" size={12} /> {pk({ tr: "Dış GPS + Han İçi Kat Rehberi", en: "Outdoor GPS + Indoor Guide" }, lang)}
              </Badge>
              <Badge color="accent" variant="solid">
                {place.name} · {flLbl} {door ? `· Kapı No: ${door}` : ""}
              </Badge>
            </div>
            <h1 style={sx("font-size:22px;font-weight:800;color:var(--text-heading);letter-spacing:-.02em;margin:10px 0 0;line-height:1.25")}>
              {title}
            </h1>
            <p style={sx("font-size:13.5px;color:var(--text-body);margin-top:4px")}>
              {place.address || `${place.name}, ${semtObj ? tx(semtObj, lang) : "Tahtakale"} · Fatih / İstanbul`}
            </p>
          </div>

          <div style={sx("display:flex;gap:8px;flex-wrap:wrap;min-width:0")}>
            <a href={gmapsUrl} target="_blank" rel="noreferrer" style={sx("text-decoration:none;max-width:100%")}>
              <Button size="md" color="primary" variant="solid" iconStart="globe">
                {pk({ tr: "Google Maps ile Han Kapısına Yürü", en: "Walk to Han Gate (Google Maps)" }, lang)}
              </Button>
            </a>
            {target.kind === "shop" && (
              <Button size="md" color="secondary" variant="outline" iconStart="shop" onClick={() => router.push(href.store(target.id))}>
                {pk({ tr: "Dükkâna Dön", en: "Back to Shop" }, lang)}
              </Button>
            )}
          </div>
        </div>

        {/* 3-Step Visual Journey Cards */}
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:12px;margin-top:16px")}>
          <div style={sx("padding:12px 14px;border-radius:12px;background:var(--surface-muted);border:1px solid var(--border-subtle)")}>
            <div style={sx("font-size:11px;font-weight:800;color:var(--color-primary);text-transform:uppercase")}>
              1. KATMAN · SOKAKTAN HAN GİRİŞİNE (GPS AÇIK)
            </div>
            <div style={sx("font-size:14px;font-weight:800;color:var(--text-heading);margin-top:4px")}>
              {place.name} Ana Giriş Kapısına Yürüyün
            </div>
            <div style={sx("font-size:12.5px;color:var(--text-body);margin-top:4px;line-height:1.45")}>
              {place.lat && place.lng
                ? `Koordinat: ${place.lat.toFixed(5)}, ${place.lng.toFixed(5)} · T1 Eminönü veya Beyazıt tramvayından yürüyerek hanın dış kapısına kadar telefon haritanızla gelin.`
                : "Hanın dış kapısına kadar sokak haritasını takip edin."}
            </div>
          </div>

          <div style={sx("padding:12px 14px;border-radius:12px;background:var(--surface-muted);border:1px solid var(--border-subtle)")}>
            <div style={sx("font-size:11px;font-weight:800;color:var(--color-accent);text-transform:uppercase")}>
              2. KATMAN · HAN GİRİŞİ & DİKEY ERİŞİM
            </div>
            <div style={sx("font-size:14px;font-weight:800;color:var(--text-heading);margin-top:4px;display:inline-flex;align-items:center;gap:6px")}>
              Hedef Kat: {flLbl} (<Icon name={acc.lift ? "elevator" : "stairs"} size={14} /> {acc.lift ? "Asansör & Merdiven Var" : "Merdiven ile Çıkış"})
            </div>
            <div style={sx("font-size:12.5px;color:var(--text-body);margin-top:4px;line-height:1.45")}>
              Han içerisine girdiğinizde GPS sinyali kesilir. Girişteki kat panosundan veya {acc.lift ? "sol/orta asansör ve merdivenlerden" : "ana taş merdivenden"} <b>{flLbl}</b> seviyesine geçin.
            </div>
          </div>

          <div style={sx("padding:12px 14px;border-radius:12px;background:var(--color-primary-soft);border:1px solid var(--color-primary)")}>
            <div style={sx("font-size:11px;font-weight:800;color:var(--color-primary);text-transform:uppercase")}>
              3. KATMAN · KORİDOR & KAPI NUMARASI
            </div>
            <div style={sx("font-size:14px;font-weight:800;color:var(--text-heading);margin-top:4px")}>
              {corridor} Koridor {door ? `· Kapı No: ${door}` : ""} — {title}
            </div>
            <div style={sx("font-size:12.5px;color:var(--text-body);margin-top:4px;line-height:1.45")}>
              Aşağıdaki interaktif kat planında bulunduğunuz merdiveni veya kapıyı seçin; koridor boyunca <b>Kapı No: {door || "—"}</b> önüne kadar canlı yürüyüş hattını takip edin.
            </div>
          </div>
        </div>
      </section>

      {/* Outdoor Map + Indoor Interactive Floor Map */}
      <div style={sx("display:grid;grid-template-columns:minmax(0,1fr);gap:18px;min-width:0;width:100%")}>
        {/* Layer 2A: Dual-Mode Indoor Turn-by-Turn & Camera AR Wayfinder */}
        <section style={sx("min-width:0;max-width:100%")}>
          <IndoorWayfinder
            place={place}
            floor={floor}
            targetDoor={door}
            targetTitle={title}
            corridor={corridor}
            lang={lang}
            defaultCameraMode={qAr}
          />
        </section>

        {/* Layer 2B: Interactive Indoor Floor Map */}
        <section style={sx("min-width:0;max-width:100%")}>
          <div style={sx("margin-bottom:10px")}>
            <Alert
              color="info"
              variant="light"
              title={pk({ tr: "Han İçinde GPS Sinyali Kesilir — Kapıdan Kapıya Kat Planını Kullanın", en: "GPS Signal Drops Indoors — Use the Door-to-Door Floor Plan" }, lang)}
            >
              {pk({
                tr: "Haritadaki merdivenlere (Sol / Orta / Sağ) veya bulunduğunuz herhangi bir dükkân kapısına tıklayarak başlangıç noktanızı seçebilir, hedef dükkâna koridor yürüyüş hattını canlı görebilirsiniz.",
                en: "Click any staircase or door number on the plan below to set your current position and trace the indoor corridor route.",
              }, lang)}
            </Alert>
          </div>
          <SantralFloorMap
            placeId={place.id}
            initialFloor={floor}
            highlightDoor={door}
            highlightRecordId={target.recId}
            lang={lang}
            onSelectRecord={(rid) => router.push(href.store(rid))}
          />
        </section>

        {/* Layer 1: Outdoor Street & Bazaar Pin Map */}
        <section style={sx(CARD)}>
          <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap")}>
            <div>
              <div style={sx(KICKER + ";display:inline-flex;align-items:center;gap:6px")}>
                <Icon name="globe" size={14} /> {pk({ tr: "Dış Mekân Sokak & Çarşı Konumu (Han Giriş Kapısı)", en: "Outdoor Street & Bazaar Location (Han Gate)" }, lang)}
              </div>
              <div style={sx("font-size:14px;font-weight:700;color:var(--text-heading);margin-top:2px")}>
                {place.name} · {place.address || "Tarihi Yarımada, Fatih / İstanbul"}
              </div>
            </div>
            <a href={gmapsUrl} target="_blank" rel="noreferrer" style={sx("text-decoration:none")}>
              <Button size="sm" color="primary" variant="outline" iconStart="map" iconEnd="external-link">
                Google Maps&apos;te Tam Ekran Aç
              </Button>
            </a>
          </div>
          <div style={sx("border-radius:12px;border:1px solid var(--border-strong);overflow:hidden;background:var(--surface-muted)")}>
            <iframe
              src={`/han-map.html?lang=${lang}&pts=${encodeURIComponent(mapPts)}`}
              title={`${place.name} Dış Mekân Haritası`}
              style={sx("display:block;width:100%;height:320px;border:none")}
            />
          </div>
        </section>
      </div>

      {/* Full-Screen "Esnafa Göster" Drawer */}
      <Drawer
        open={askTraderOpen}
        onClose={() => setAskTraderOpen(false)}
        title={lang === "tr" ? "Esnafa Göster · Han İçi Yardım Kartı" : "Show to Any Trader in the Han"}
      >
        <div style={sx("padding:16px;display:flex;flex-direction:column;gap:14px")}>
          <div style={sx("padding:20px;border-radius:14px;background:var(--color-primary);color:#fff;text-align:center")}>
            <div style={sx("font-size:12px;font-weight:700;opacity:0.85;letter-spacing:.06em;text-transform:uppercase")}>
              LÜTFEN YARDIMCI OLUR MUSUNUZ? · {place.name.toLocaleUpperCase("tr")} REHBERİ
            </div>
            <div style={sx("font-size:24px;font-weight:800;line-height:1.3;margin-top:10px")}>
              Merhaba usta / komşu,
              <br />
              {place.name} · {floorLabel(floor, "tr", place)}
              <br />
              {door ? `Kapı No: ${door}` : ""}
            </div>
            <div
              style={sx(
                "margin-top:12px;padding:10px 14px;border-radius:10px;background:var(--surface-card);color:var(--text-primary);font-size:20px;font-weight:800",
              )}
            >
              {title}
            </div>
            <div style={sx("font-size:14px;margin-top:12px;opacity:0.95")}>
              ({corridor} Koridor — Bu dükkâna hangi merdiven veya koridordan gidebilirim?)
            </div>
          </div>
        </div>
      </Drawer>

      {/* Printable Vitrin / Giriş QR Tabelası Drawer */}
      <Drawer
        open={qrSignOpen}
        onClose={() => setQrSignOpen(false)}
        title={pk({ tr: "🖨️ Vitrin / Giriş QR Tabelası", en: "🖨️ Printable Shopfront / Gate QR Sign" }, lang)}
      >
        <div style={sx("padding:16px;display:flex;flex-direction:column;gap:14px")}>
          <div
            style={sx(
              "padding:22px 20px;border-radius:16px;border:3px solid var(--color-primary);background:#fff;color:#0f172a;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,.08)",
            )}
          >
            <div
              style={sx(
                "font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#1e3a8a;background:#eff6ff;padding:4px 12px;border-radius:999px",
              )}
            >
              🏛️ {place.name} · RESMİ DİJİTAL KAPI & YÖN TABELASI
            </div>

            <div style={sx("font-size:22px;font-weight:800;color:#0f172a;line-height:1.25;margin-top:4px")}>
              {title}
            </div>

            <div
              style={sx(
                "font-size:15px;font-weight:800;color:#fff;background:#1e3a8a;padding:6px 16px;border-radius:10px",
              )}
            >
              {flLbl} · Kapı No: {door || "—"} ({corridor} Koridor)
            </div>

            {/* Deterministic SVG QR Code */}
            <div
              style={sx(
                "padding:12px;border-radius:14px;border:2px solid #cbd5e1;background:#fff;margin:6px 0;display:inline-flex;align-items:center;justify-content:center",
              )}
            >
              <svg
                width="176"
                height="176"
                viewBox="0 0 25 25"
                role="img"
                aria-label={`${title} QR Kodu`}
              >
                <rect width="25" height="25" fill="#ffffff" rx="1.5" />
                {qrCells.map((cell) => (
                  <rect
                    key={`${cell.r}_${cell.c}`}
                    x={cell.c + 2}
                    y={cell.r + 2}
                    width="1"
                    height="1"
                    fill="#0f172a"
                  />
                ))}
              </svg>
            </div>

            <div
              style={sx(
                "font-size:13px;font-weight:800;color:#0f172a;background:#f8fafc;border:1px solid #e2e8f0;padding:10px 14px;border-radius:10px;line-height:1.45;max-width:100%",
              )}
            >
              3 Adımda Bulun: 1. Kapıdaki QR&apos;ı Okutun → 2. Kat ve Koridor Okunu Takip Edin → 3. Kapı No&apos;ya Ulaşın
            </div>

            <div style={sx("font-size:11.5px;color:#475569;font-weight:600")}>
              han.ist/tarif/{target.id}
            </div>
          </div>

          <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
            <Button
              size="md"
              color="primary"
              variant="solid"
              iconStart="printer"
              fullWidth
              onClick={() => {
                if (typeof window !== "undefined") window.print();
              }}
            >
              {pk({ tr: "🖨️ Tabelayı Yazdır", en: "🖨️ Print Sign" }, lang)}
            </Button>
            <Button
              size="md"
              color="success"
              variant="outline"
              iconStart="messages"
              fullWidth
              onClick={shareWhatsAppRoute}
            >
              {pk({ tr: "📲 WhatsApp'tan Tarif Gönder", en: "📲 Share via WhatsApp" }, lang)}
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
