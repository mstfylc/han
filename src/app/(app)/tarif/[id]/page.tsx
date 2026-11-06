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

  return (
    <div style={sx("max-width:1480px;margin:0 auto;padding:20px 24px 56px;display:flex;flex-direction:column;gap:18px")}>
      {/* Breadcrumb & Top Bar */}
      <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
        <div style={sx("display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;color:var(--text-muted)")}>
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

        <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
          <Button size="sm" color="secondary" variant="outline" iconStart="volume" onClick={speakFullRoute}>
            {pk({ tr: "Yol Tarifini Sesli Oku", en: "Read Directions Aloud" }, lang)}
          </Button>
          <Button size="sm" color="accent" variant="solid" iconStart="qr" onClick={() => setAskTraderOpen(true)}>
            {pk({ tr: "Esnafa Göster (Tam Ekran Türkçe Kart)", en: "Show to Trader (Turkish Card)" }, lang)}
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
            {pk({ tr: "Bu Durağı Günlük Rotama Ekle", en: "Add Stop to My Route" }, lang)}
          </Button>
        </div>
      </div>

      {/* Hero Summary Card */}
      <section style={sx(CARD + ";border-color:var(--color-primary)")}>
        <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap")}>
          <div>
            <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
              <Badge color="primary" variant="solid">
                <Icon name="compass" size={12} /> {pk({ tr: "2 Katmanlı Hibrit Navigasyon (Dış GPS + Han İçi Kat Planı)", en: "2-Layer Hybrid Navigation (Outdoor GPS + Indoor Floor Plan)" }, lang)}
              </Badge>
              <Badge color="accent" variant="solid">
                {place.name} · {flLbl} {door ? `· Kapı No: ${door}` : ""}
              </Badge>
            </div>
            <h1 style={sx("font-size:26px;font-weight:800;color:var(--text-heading);letter-spacing:-.02em;margin:10px 0 0")}>
              {title}
            </h1>
            <p style={sx("font-size:14px;color:var(--text-body);margin-top:4px")}>
              {place.address || `${place.name}, ${semtObj ? tx(semtObj, lang) : "Tahtakale"} · Fatih / İstanbul`}
            </p>
          </div>

          <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
            <a href={gmapsUrl} target="_blank" rel="noreferrer" style={sx("text-decoration:none")}>
              <Button size="md" color="primary" variant="solid" iconStart="globe">
                {pk({ tr: "1. Adım: Google Maps ile Han Kapısına Yürü", en: "Step 1: Walk to Han Gate (Google Maps)" }, lang)}
              </Button>
            </a>
            {target.kind === "shop" && (
              <Button size="md" color="secondary" variant="outline" iconStart="shop" onClick={() => router.push(href.store(target.id))}>
                {pk({ tr: "Dükkân Sayfasına Dön", en: "Back to Shop Page" }, lang)}
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
      <div style={sx("display:grid;grid-template-columns:1fr;gap:18px")}>
        {/* Layer 2A: Dual-Mode Indoor Turn-by-Turn & Camera AR Wayfinder */}
        <section>
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
        <section>
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
    </div>
  );
}
