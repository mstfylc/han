"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import type { Lang, ShopRecord } from "@/data/types";
import { Badge, Button, Drawer, Icon, Input } from "@/ds";
import { tx } from "@/lib/i18n";
import { floorLabel, recordBadges } from "@/lib/shop";
import { sx } from "@/lib/sx";

export interface SantralFloorMapProps {
  placeId?: string;
  initialFloor?: number;
  highlightDoor?: string | null;
  highlightRecordId?: string | null;
  lang?: Lang;
  onSelectRecord?: (recordId: string) => void;
  adminMode?: boolean;
}

type AnchorKey = "giris" | "sol-merdiven" | "orta-pano" | "sag-merdiven";

const SANTRAL_FLOOR_SPECIALTY: Record<number, { tr: string; en: string; ru: string; ar: string }> = {
  0: {
    tr: "Z Kat · Zemin Altı Toptan & Depo",
    en: "Floor Z · Lower Ground Wholesale",
    ru: "Этаж Z · Цокольный опт",
    ar: "الطابق Z · جملة ومستودعات",
  },
  1: {
    tr: "A Kat · Ana Giriş · Bijuteri, Çelik Takı & Malzeme",
    en: "Floor A · Main Entrance · Costume & Steel Jewellery",
    ru: "Этаж A · Главный вход · Бижутерия и сталь",
    ar: "الطابق A · المدخل الرئيسي · إكسسوارات وستيل",
  },
  2: {
    tr: "B Kat · Bijuteri, İthal Aksesuar & Çay Ocağı",
    en: "Floor B · Costume Jewellery & Imported Accessories",
    ru: "Этаж B · Бижутерия и импортные аксессуары",
    ar: "الطابق B · إكسسوارات مستوردة ومقهى شاي",
  },
  3: {
    tr: "C Kat · Telefon Kılıfı, Elektronik & Teknik Servis",
    en: "Floor C · Phone Cases, Electronics & Tech Service",
    ru: "Этаж C · Чехлы, электроника и техсервис",
    ar: "الطابق C · أغطية هواتف وإلكترونيات وصيانة",
  },
  4: {
    tr: "D Kat · Batarya, Pil, Teknoloji & Toptan Showroom",
    en: "Floor D · Batteries, Powerbanks & Tech Showrooms",
    ru: "Этаж D · Аккумуляторы, повербанки и шоурумы",
    ar: "الطابق D · بطاريات وشواحن وصالات جملة",
  },
  5: {
    tr: "E Kat · Toptan Ofisler, İhracat & Lojistik Depolar",
    en: "Floor E · Wholesale Offices & Export Depots",
    ru: "Этаж E · Оптовые офисы и склады",
    ar: "الطابق E · مكاتب جملة ومستودعات تصدير",
  },
  6: {
    tr: "F Kat · Üst Kat Showroom, Ajans & İmalat",
    en: "Floor F · Top Floor Showrooms & Workshops",
    ru: "Этаж F · Верхние шоурумы и мастерские",
    ar: "الطابق F · صالات عرض علوية وورش",
  },
};

const PLACE_FLOOR_SPECIALTY: Record<string, Record<number, { tr: string; en: string }>> = {
  sark: {
    0: { tr: "Zemin Kat · Saat, Gözlük, Hediyelik & Ana Giriş Koridoru", en: "Ground Floor · Watches, Eyewear & Gifts" },
    1: { tr: "1. Kat · Telefon Aksesuarı, Kılıf & Elektronik Toptan", en: "1st Floor · Phone Accessories & Electronics" },
    2: { tr: "2. Kat · Bijuteri, Çelik Takı, Toka & Kozmetik", en: "2nd Floor · Costume Jewellery & Cosmetics" },
    3: { tr: "3. Kat · Oyuncak, Kırtasiye & Parti Malzemeleri", en: "3rd Floor · Toys, Stationery & Party Goods" },
    4: { tr: "4. Kat · İthalat Showroom, Koli Depo & Han Yönetimi", en: "4th Floor · Import Showrooms & Management" },
  },
  buyukyeni: {
    0: { tr: "Zemin Avlu · Tarihi Taş Avlu, Gümüş, Dokuma & Geleneksel Zanaat", en: "Ground Courtyard · Historic Courtyard, Silver & Textiles" },
    1: { tr: "1. Revan Katı · El İşi Gümüş Atölyeleri, Halı & Antika Odaları", en: "1st Gallery · Handcrafted Silver, Carpets & Antiques" },
    2: { tr: "2. Üst Galeri · Sadekâr Atölyeleri, Tasarım & İhracat Ofisleri", en: "2nd Upper Gallery · Artisan Workshops & Export Offices" },
  },
  kurkcu: {
    0: { tr: "Zemin Avlu · Havlu, Bornoz, Nevresim & Çeyiz Toptancıları", en: "Ground Courtyard · Towels, Bathrobes & Bridal Linens" },
    1: { tr: "1. Galeri Katı · Ev Tekstili, Perde & Konfeksiyon Showroom", en: "1st Gallery · Home Textiles & Apparel Showrooms" },
  },
  kalcilar: {
    0: { tr: "Zemin Avlu · Mücevher, Altın, Gümüş & El Dokuma Halı", en: "Ground Courtyard · Fine Jewellery, Gold, Silver & Carpets" },
    1: { tr: "1. Kat · Sadekâr Atölyeleri, Değerli Taş & Mıhlama", en: "1st Floor · Goldsmith Workshops & Gem Setting" },
    2: { tr: "2. Kat · Saat Tamir, Ekspertiz & Özel Tasarım Atölyeleri", en: "2nd Floor · Watchmaking, Appraisal & Custom Design" },
  },
  zincirli: {
    0: { tr: "Tarihi Avlu · Koleksiyon Halı, Mücevher & Şadırvan Çevresi", en: "Historic Courtyard · Collector Carpets & Fine Jewellery" },
    1: { tr: "Üst Revan · El Sanatları, Hat, Minyatür & Kuyum Atölyeleri", en: "Upper Gallery · Fine Arts & Jewellery Workshops" },
  },
  cukur: {
    0: { tr: "Zemin Kat · Toptan Tekstil, Triko & Çeyiz Koridoru", en: "Ground Floor · Wholesale Textiles & Knitwear" },
    1: { tr: "1. Kat · Konfeksiyon, Şal, Eşarp & Aksesuar Toptan", en: "1st Floor · Apparel, Scarves & Accessories" },
    2: { tr: "2. Kat · Atölye, Numune Dikim & Toptan Depo", en: "2nd Floor · Sample Workshops & Depots" },
  },
  dogubank: {
    [-1]: { tr: "Bodrum Kat · Elektronik Yedek Parça, Kablo & Teknik Servis", en: "Basement · Electronic Spare Parts & Service" },
    0: { tr: "Zemin Kat · Profesyonel Ses, Kulaklık, Saat & Optik", en: "Ground Floor · Pro Audio, Watches & Optics" },
    1: { tr: "1. Kat · Fotoğraf, Kamera, Bilgisayar & Oyun Sistemleri", en: "1st Floor · Cameras, Computers & Gaming" },
    2: { tr: "2. Kat · Ses Sistemleri, Sahne Ekipmanı & Elektronik", en: "2nd Floor · Sound Systems & Stage Equipment" },
    3: { tr: "3. Kat · Teknik Servis, Tamir Laboratuvarları & Ofisler", en: "3rd Floor · Repair Labs & Offices" },
    4: { tr: "4. Kat · İthalatçı Merkezleri & Toptan Dağıtım", en: "4th Floor · Importers & Wholesale Distribution" },
  },
};

const COURTYARD_HANS = new Set(["buyukyeni", "kurkcu", "zincirli", "cukur", "kalcilar", "balkapani", "cebeci"]);

const ANCHORS: {
  id: AnchorKey;
  x: number;
  y: number;
  tr: string;
  en: string;
  ru: string;
  ar: string;
}[] = [
  {
    id: "giris",
    x: 450,
    y: 356,
    tr: "Ana Giriş / Kat Merdiven Ağzı",
    en: "Main Entrance / Floor Landing",
    ru: "Главный вход / Площадка этажа",
    ar: "المدخل الرئيسي / بسطة الطابق",
  },
  {
    id: "sol-merdiven",
    x: 112,
    y: 205,
    tr: "Sol Merdiven & Asansör Önü",
    en: "Left Staircase & Lift Lobby",
    ru: "Левая лестница и лифт",
    ar: "السلم الأيسر والمصعد",
  },
  {
    id: "orta-pano",
    x: 450,
    y: 205,
    tr: "Orta Koridor · Kat Planı Panosu",
    en: "Central Spine · Floor Plan Board",
    ru: "Центральный проход · Схема этажа",
    ar: "الممر الأوسط · لوحة مخطط الطابق",
  },
  {
    id: "sag-merdiven",
    x: 788,
    y: 205,
    tr: "Sağ Merdiven & Çay Ocağı Yönü",
    en: "Right Staircase & Tea Stall Side",
    ru: "Правая лестница и чайная",
    ar: "السلم الأيمن وجهة الشاي",
  },
];

interface UnitCell {
  door: string;
  corridor: "Üst" | "Orta" | "Alt";
  record: ShopRecord | null;
  vacant: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function SantralFloorMap({
  placeId = "santral",
  initialFloor,
  highlightDoor = null,
  highlightRecordId = null,
  lang = "tr",
  onSelectRecord,
  adminMode = false,
}: SantralFloorMapProps) {
  const place = useMemo(
    () => SC.PLACES.find((p) => p.id === placeId) || SC.PLACES[0],
    [placeId],
  );
  const allPlaceRecords = useMemo(() => SC.recordsOfPlace(place.id), [place.id]);

  // Determine default floor from highlighted record/door or default to Floor 1 (A Kat) for Santral
  const resolvedInitialFloor = useMemo(() => {
    if (typeof initialFloor === "number" && place.floors.includes(initialFloor)) {
      return initialFloor;
    }
    if (highlightRecordId) {
      const hit = allPlaceRecords.find((r) => r.id === highlightRecordId || r.curated === highlightRecordId);
      if (hit) return hit.floor;
    }
    if (highlightDoor) {
      const hit = allPlaceRecords.find((r) => String(r.door) === String(highlightDoor));
      if (hit) return hit.floor;
    }
    return place.id === "santral" && place.floors.includes(1) ? 1 : (place.floors[0] ?? 0);
  }, [initialFloor, highlightRecordId, highlightDoor, allPlaceRecords, place]);

  const [floor, setFloor] = useState<number>(resolvedInitialFloor);
  const [viewMode, setViewMode] = useState<"interactive" | "official" | "split">("interactive");
  const [anchor, setAnchor] = useState<AnchorKey>("orta-pano");
  const [filterText, setFilterText] = useState("");
  const [selectedDoor, setSelectedDoor] = useState<string | null>(highlightDoor);
  const [askTraderOpen, setAskTraderOpen] = useState(false);

  const isSantral = place.id === "santral";
  const isCourtyard = COURTYARD_HANS.has(place.id);

  const floorRecords = useMemo(
    () => allPlaceRecords.filter((r) => r.floor === floor),
    [allPlaceRecords, floor],
  );

  const vacantDoors = useMemo(() => {
    if (isSantral) return SC.SANTRAL_VACANT_DOORS[floor] || [];
    // Deterministic vacant / available units for any other han in the Historic Peninsula
    const used = new Set(floorRecords.map((r) => String(r.door)));
    const base = floor === 0 ? 18 : floor < 0 ? 12 : floor * 100 + 18;
    const out: string[] = [];
    for (let step = 0; step < 5; step++) {
      const candidate = String(base + step * 9);
      if (!used.has(candidate)) out.push(candidate);
    }
    return out;
  }, [isSantral, floor, floorRecords]);

  // Build geometric cells matching Santral Han's architectural layout:
  // Top Wing (Üst Koridor), Central Double Island (Orta Ada), Bottom Wing (Alt Koridor)
  const cells = useMemo<UnitCell[]>(() => {
    const rawUnits: { door: string; corridor: "Üst" | "Orta" | "Alt"; record: ShopRecord | null; vacant: boolean }[] = [];
    const seen = new Set<string>();

    floorRecords.forEach((rec) => {
      seen.add(String(rec.door));
      const corr: "Üst" | "Orta" | "Alt" =
        rec.corridor === "Üst" || rec.corridor === "Orta" || rec.corridor === "Alt"
          ? rec.corridor
          : Number(String(rec.door).replace(/\D/g, "")) % 3 === 0
            ? "Orta"
            : Number(String(rec.door).replace(/\D/g, "")) % 2 === 0
              ? "Üst"
              : "Alt";
      rawUnits.push({ door: String(rec.door), corridor: corr, record: rec, vacant: false });
    });

    vacantDoors.forEach((vd, idx) => {
      if (seen.has(vd)) return;
      const corr: "Üst" | "Orta" | "Alt" = idx % 3 === 0 ? "Üst" : idx % 3 === 1 ? "Orta" : "Alt";
      rawUnits.push({ door: vd, corridor: corr, record: null, vacant: true });
    });

    const sortByDoor = (a: { door: string }, b: { door: string }) => {
      const na = parseInt(a.door.replace(/\D/g, ""), 10) || 0;
      const nb = parseInt(b.door.replace(/\D/g, ""), 10) || 0;
      return na - nb;
    };

    const topList = rawUnits.filter((u) => u.corridor === "Üst").sort(sortByDoor);
    const midList = rawUnits.filter((u) => u.corridor === "Orta").sort(sortByDoor);
    const botList = rawUnits.filter((u) => u.corridor === "Alt").sort(sortByDoor);

    const out: UnitCell[] = [];

    // Layout helper for a horizontal strip
    const placeStrip = (
      list: typeof rawUnits,
      xStart: number,
      xEnd: number,
      y: number,
      h: number,
      maxPerRow: number,
      rowGap: number,
    ) => {
      if (!list.length) return;
      const rows = Math.ceil(list.length / maxPerRow);
      for (let r = 0; r < rows; r++) {
        const slice = list.slice(r * maxPerRow, (r + 1) * maxPerRow);
        const totalW = xEnd - xStart;
        const gap = 4;
        const cellW = Math.max(26, Math.floor((totalW - gap * (slice.length - 1)) / slice.length));
        const rowY = y + r * (h + rowGap);
        slice.forEach((item, idx) => {
          out.push({
            ...item,
            x: xStart + idx * (cellW + gap),
            y: rowY,
            w: cellW,
            h,
          });
        });
      }
    };

    // Top Wing: y=22..72
    placeStrip(topList, 34, 866, 24, 42, 22, 6);

    // Middle Island: split into Left Island (x=152..402) and Right Island (x=498..748) around central KAT PLANI spine
    const midLeft = midList.slice(0, Math.ceil(midList.length / 2));
    const midRight = midList.slice(Math.ceil(midList.length / 2));
    placeStrip(midLeft, 154, 398, 152, 38, 7, 28);
    placeStrip(midRight, 502, 746, 152, 38, 7, 28);

    // Bottom Wing: y=302..344
    placeStrip(botList, 34, 866, 298, 42, 22, 6);

    return out;
  }, [floorRecords, vacantDoors]);

  // Active target cell (either user-selected door, highlighted door, or highlighted record)
  const activeCell = useMemo(() => {
    if (selectedDoor) {
      const bySelected = cells.find((c) => c.door === selectedDoor);
      if (bySelected) return bySelected;
    }
    if (highlightRecordId) {
      const byRec = cells.find(
        (c) => c.record && (c.record.id === highlightRecordId || c.record.curated === highlightRecordId),
      );
      if (byRec) return byRec;
    }
    if (highlightDoor) {
      const byDoor = cells.find((c) => c.door === String(highlightDoor));
      if (byDoor) return byDoor;
    }
    return cells.find((c) => c.record?.curated) || cells.find((c) => c.record) || null;
  }, [cells, selectedDoor, highlightRecordId, highlightDoor]);

  const activeAnchor = useMemo(
    () => ANCHORS.find((a) => a.id === anchor) || ANCHORS[2],
    [anchor],
  );

  const filteredCells = useMemo(() => {
    const q = filterText.trim().toLocaleLowerCase("tr");
    if (!q) return cells;
    return cells.filter((c) => {
      if (c.door.toLocaleLowerCase("tr").includes(q)) return true;
      if (c.record?.name?.toLocaleLowerCase("tr").includes(q)) return true;
      if (c.record?.cat?.toLocaleLowerCase("tr").includes(q)) return true;
      return false;
    });
  }, [cells, filterText]);

  const currentFloorLabel = floorLabel(floor, lang, place);
  const specialty = useMemo(() => {
    if (isSantral && SANTRAL_FLOOR_SPECIALTY[floor]) {
      return tx(SANTRAL_FLOOR_SPECIALTY[floor], lang);
    }
    const byPlace = PLACE_FLOOR_SPECIALTY[place.id]?.[floor];
    if (byPlace) {
      return lang === "tr" ? byPlace.tr : byPlace.en;
    }
    const catNames = (place.cats || [])
      .slice(0, 3)
      .map((cid: string) => {
        const c = D.CATS.find((x) => x.id === cid);
        return c ? tx(c, lang) : cid;
      })
      .join(", ");
    return `${currentFloorLabel} · ${place.name}${catNames ? ` — ${catNames}` : ""}`;
  }, [isSantral, floor, lang, place, currentFloorLabel]);

  const officialPlanUrl = isSantral ? `/assets/santral/kat-${floor}.jpg` : null;

  // Step-by-step indoor instruction from activeAnchor to activeCell
  const indoorSteps = useMemo(() => {
    if (!activeCell) return [];
    const corrLabel =
      activeCell.corridor === "Üst"
        ? lang === "tr"
          ? "Üst Koridor (Kuzey Kanadı)"
          : "Upper Corridor (North Wing)"
        : activeCell.corridor === "Orta"
          ? lang === "tr"
            ? "Orta Ada Koridoru"
            : "Central Island Corridor"
          : lang === "tr"
            ? "Alt Koridor (Güney Kanadı)"
            : "Lower Corridor (South Wing)";

    const shopTitle = activeCell.record ? activeCell.record.name : `Kapı No: ${activeCell.door} (Boş / Kiralık)`;
    if (lang === "tr") {
      return [
        `1. Başlangıç: ${activeAnchor.tr} noktasındasınız (${place.name} · ${currentFloorLabel}).`,
        `2. Yönelim: ${corrLabel} hattına ilerleyin; kapı numaraları sırayla yükselir.`,
        `3. Hedef: Kapı No: ${activeCell.door} — ${shopTitle}.`,
      ];
    }
    return [
      `1. Start at: ${tx(activeAnchor, lang)} (${place.name} · ${currentFloorLabel}).`,
      `2. Walk along: ${corrLabel}; follow the door numbers in sequence.`,
      `3. Arrive at: Door No: ${activeCell.door} — ${shopTitle}.`,
    ];
  }, [activeCell, activeAnchor, place.name, currentFloorLabel, lang]);

  return (
    <div
      style={sx(
        "border-radius:14px;border:1px solid var(--border-subtle);background:var(--surface-card);overflow:hidden",
      )}
    >
      {/* Top Header: Place & Floor Summary + View Mode Switcher */}
      <div
        style={sx(
          "padding:14px 16px;background:var(--surface-muted);border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap",
        )}
      >
        <div>
          <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
            <Badge color="primary" variant="solid">
              {place.name} · {currentFloorLabel}
            </Badge>
            <span style={sx("font-size:12px;font-weight:700;color:var(--color-success)")}>
              ● {floorRecords.length} {lang === "tr" ? "Kayıtlı Dükkân" : "Registered Shops"}
            </span>
            {vacantDoors.length > 0 && (
              <span style={sx("font-size:12px;font-weight:600;color:var(--text-muted)")}>
                · {vacantDoors.length} {lang === "tr" ? "Boş / Kiralık Birim" : "Vacant Units"}
              </span>
            )}
          </div>
          <div style={sx("font-size:13px;font-weight:700;color:var(--text-primary);margin-top:4px")}>
            {specialty}
          </div>
        </div>

        {isSantral && (
          <div style={sx("display:flex;gap:6px;flex-wrap:wrap")}>
            <Button
              size="sm"
              color={viewMode === "interactive" ? "primary" : "secondary"}
              variant={viewMode === "interactive" ? "solid" : "outline"}
              onClick={() => setViewMode("interactive")}
            >
              {lang === "tr" ? "İnteraktif Kat Planı" : "Interactive Map"}
            </Button>
            <Button
              size="sm"
              color={viewMode === "official" ? "primary" : "secondary"}
              variant={viewMode === "official" ? "solid" : "outline"}
              onClick={() => setViewMode("official")}
            >
              {lang === "tr" ? "Resmi Mimari Pafta" : "Official Blueprint"}
            </Button>
            <Button
              size="sm"
              color={viewMode === "split" ? "accent" : "secondary"}
              variant={viewMode === "split" ? "solid" : "outline"}
              onClick={() => setViewMode("split")}
            >
              {lang === "tr" ? "İkisi Birlikte" : "Split View"}
            </Button>
          </div>
        )}
      </div>

      {/* Floor Selector Strip (Z, A, B, C, D, E, F) */}
      <div
        style={sx(
          "padding:10px 14px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:6px;overflow-x:auto;background:var(--surface-card)",
        )}
      >
        <span style={sx("font-size:11.5px;font-weight:700;color:var(--text-muted);margin-inline-end:4px;white-space:nowrap")}>
          {lang === "tr" ? "KAT SEÇİN:" : "FLOOR:"}
        </span>
        {place.floors.map((f) => {
          const on = f === floor;
          const cnt = allPlaceRecords.filter((r) => r.floor === f).length;
          const fLbl = floorLabel(f, lang, place);
          return (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFloor(f);
                setSelectedDoor(null);
              }}
              style={sx(
                "flex:none;height:34px;padding:0 12px;border-radius:8px;border:1px solid " +
                  (on ? "var(--color-primary)" : "var(--border-subtle)") +
                  ";background:" +
                  (on ? "var(--color-primary)" : "var(--surface-muted)") +
                  ";color:" +
                  (on ? "var(--color-primary-inverse)" : "var(--text-primary)") +
                  ";font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px",
              )}
            >
              <span>{fLbl}</span>
              <span
                style={sx(
                  "padding:1px 6px;border-radius:999px;font-size:10.5px;background:" +
                    (on ? "var(--surface-card)" : "var(--surface-elevated)") +
                    ";color:" +
                    (on ? "var(--color-primary)" : "var(--text-muted)"),
                )}
              >
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {/* Indoor No-GPS Location Anchor Bar + Quick Search */}
      <div
        style={sx(
          "padding:10px 14px;background:var(--surface-subtle);border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap",
        )}
      >
        <div style={sx("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
          <span style={sx("font-size:11.5px;font-weight:700;color:var(--color-primary)")}>
            📍 {lang === "tr" ? "Han İçi Konum Çapası (GPS Gerekmez):" : "Indoor Anchor (No GPS):"}
          </span>
          {ANCHORS.map((a) => {
            const on = a.id === anchor;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAnchor(a.id)}
                style={sx(
                  "height:26px;padding:0 9px;border-radius:6px;border:1px solid " +
                    (on ? "var(--color-accent)" : "var(--border-subtle)") +
                    ";background:" +
                    (on ? "var(--color-accent-soft)" : "var(--surface-card)") +
                    ";color:" +
                    (on ? "var(--text-primary)" : "var(--text-body)") +
                    ";font-family:inherit;font-size:11.5px;font-weight:600;cursor:pointer",
                )}
              >
                {tx(a, lang)}
              </button>
            );
          })}
        </div>

        <div style={sx("min-width:210px;flex:1;max-width:280px")}>
          <Input
            size="sm"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={
              lang === "tr"
                ? `${currentFloorLabel} içinde kapı no veya esnaf ara…`
                : `Filter door no. or trader on ${currentFloorLabel}…`
            }
          />
        </div>
      </div>

      {/* Interactive SVG Floor Plan */}
      {(viewMode === "interactive" || viewMode === "split") && (
        <div style={sx("padding:14px;background:var(--surface-card)")}>
          <div
            style={sx(
              "width:100%;overflow-x:auto;border-radius:12px;border:1px solid var(--border-subtle);background:var(--surface-muted);padding:10px",
            )}
          >
            <svg
              viewBox="0 0 900 380"
              style={sx("width:100%;min-width:680px;height:auto;display:block")}
              role="img"
              aria-label={`${place.name} ${currentFloorLabel} Kat Planı`}
            >
              {/* Outer Building Frame */}
              <rect
                x="14"
                y="12"
                width="872"
                height="356"
                rx="12"
                fill="var(--surface-card)"
                stroke="var(--border-strong)"
                strokeWidth="2"
              />

              {/* Corridor Walkways */}
              <rect x="26" y="114" width="848" height="32" rx="4" fill="var(--surface-subtle)" />
              <rect x="26" y="258" width="848" height="32" rx="4" fill="var(--surface-subtle)" />

              {/* Left & Right Staircases + Lift */}
              <g>
                <rect
                  x="34"
                  y="152"
                  width="108"
                  height="98"
                  rx="8"
                  fill="var(--surface-muted)"
                  stroke="var(--border-strong)"
                  strokeDasharray="4 2"
                />
                <text
                  x="88"
                  y="192"
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize="11"
                  fontWeight="700"
                >
                  {isCourtyard ? "BATI REVAN" : "SOL MERDİVEN"}
                </text>
                <text
                  x="88"
                  y="210"
                  textAnchor="middle"
                  fill="var(--color-primary)"
                  fontSize="10"
                  fontWeight="700"
                >
                  {isCourtyard ? "🏛️ TAŞ MERDİVEN" : "⇅ ASANSÖR & WC"}
                </text>
              </g>

              {/* Central Architectural Spine (Courtyard vs Multi-Corridor Center) */}
              <g>
                <rect
                  x="404"
                  y="148"
                  width="92"
                  height="106"
                  rx="8"
                  fill={isCourtyard ? "var(--color-accent-soft)" : "var(--color-primary-soft)"}
                  stroke={isCourtyard ? "var(--color-accent)" : "var(--color-primary)"}
                  strokeWidth="1.5"
                />
                <text
                  x="450"
                  y="186"
                  textAnchor="middle"
                  fill="var(--color-primary)"
                  fontSize="12.5"
                  fontWeight="800"
                >
                  {currentFloorLabel.toUpperCase()}
                </text>
                <text
                  x="450"
                  y="205"
                  textAnchor="middle"
                  fill="var(--text-body)"
                  fontSize="10"
                  fontWeight="700"
                >
                  {isCourtyard ? "TARİHİ AVLU" : "KAT PLANI"}
                </text>
                <text
                  x="450"
                  y="223"
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize="9.5"
                  fontWeight="600"
                >
                  {isCourtyard ? "ŞADIRVAN / REVAN" : "ORTA HOL"}
                </text>
              </g>

              <g>
                <rect
                  x="758"
                  y="152"
                  width="108"
                  height="98"
                  rx="8"
                  fill="var(--surface-muted)"
                  stroke="var(--border-strong)"
                  strokeDasharray="4 2"
                />
                <text
                  x="812"
                  y="192"
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize="11"
                  fontWeight="700"
                >
                  {isCourtyard ? "DOĞU REVAN" : "SAĞ MERDİVEN"}
                </text>
                <text
                  x="812"
                  y="210"
                  textAnchor="middle"
                  fill="var(--color-accent)"
                  fontSize="10"
                  fontWeight="700"
                >
                  ☕ ÇAY OCAĞI / WC
                </text>
              </g>

              {/* Corridor Labels */}
              <text x="450" y="134" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontWeight="700" letterSpacing="1.5">
                {isCourtyard ? "KUZEY REVAN GALERİSİ · YÜRÜYÜŞ HATTI" : "ÜST KORİDOR · YÜRÜYÜŞ HATTI"}
              </text>
              <text x="450" y="278" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontWeight="700" letterSpacing="1.5">
                {isCourtyard ? "GÜNEY REVAN GALERİSİ · YÜRÜYÜŞ HATTI" : "ALT KORİDOR · YÜRÜYÜŞ HATTI"}
              </text>

              {/* Shop Unit Cells */}
              {cells.map((cell) => {
                const isTarget = activeCell?.door === cell.door;
                const isFilteredOut =
                  filterText.trim().length > 0 && !filteredCells.some((fc) => fc.door === cell.door);
                const isCurated = !!cell.record?.curated;
                const status = cell.record?.status;

                const fill = isTarget
                  ? "var(--color-accent)"
                  : cell.vacant
                    ? "var(--surface-subtle)"
                    : isCurated
                      ? "var(--color-primary)"
                      : status === "aktif"
                        ? "var(--color-success-soft)"
                        : status === "onayli"
                          ? "var(--color-primary-soft)"
                          : "var(--color-warning-soft)";

                const stroke = isTarget
                  ? "var(--color-primary)"
                  : cell.vacant
                    ? "var(--border-strong)"
                    : isCurated
                      ? "var(--color-primary)"
                      : status === "aktif"
                        ? "var(--color-success)"
                        : "var(--border-strong)";

                const textColor = isTarget
                  ? "var(--color-accent-inverse)"
                  : isCurated
                    ? "var(--color-primary-inverse)"
                    : cell.vacant
                      ? "var(--text-muted)"
                      : "var(--text-primary)";

                return (
                  <g
                    key={cell.door}
                    onClick={() => {
                      setSelectedDoor(cell.door);
                      if (cell.record && onSelectRecord) {
                        onSelectRecord(cell.record.curated || cell.record.id);
                      }
                    }}
                    style={{
                      cursor: "pointer",
                      opacity: isFilteredOut ? 0.25 : 1,
                      transition: "opacity 150ms ease",
                    }}
                  >
                    <rect
                      x={cell.x}
                      y={cell.y}
                      width={cell.w}
                      height={cell.h}
                      rx="5"
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isTarget ? "2.5" : "1"}
                      strokeDasharray={cell.vacant ? "3 2" : undefined}
                    />
                    <text
                      x={cell.x + cell.w / 2}
                      y={cell.y + (cell.h > 34 ? 15 : 13)}
                      textAnchor="middle"
                      fill={textColor}
                      fontSize="10"
                      fontWeight="800"
                    >
                      {cell.door}
                    </text>
                    {cell.w >= 32 && (
                      <text
                        x={cell.x + cell.w / 2}
                        y={cell.y + cell.h - 7}
                        textAnchor="middle"
                        fill={textColor}
                        fontSize="7.5"
                        fontWeight="600"
                      >
                        {cell.vacant
                          ? "BOŞ"
                          : (cell.record?.name || "").split(" ")[0].slice(0, 6)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Animated Indoor Walking Route from Active Anchor to Selected Door */}
              {activeCell && (
                <g pointerEvents="none">
                  <circle
                    cx={activeAnchor.x}
                    cy={activeAnchor.y}
                    r="7"
                    fill="var(--color-primary)"
                    stroke="var(--surface-card)"
                    strokeWidth="2"
                  />
                  <path
                    d={`M ${activeAnchor.x} ${activeAnchor.y} L ${activeAnchor.x} ${
                      activeCell.corridor === "Üst" ? 130 : activeCell.corridor === "Alt" ? 274 : 200
                    } L ${activeCell.x + activeCell.w / 2} ${
                      activeCell.corridor === "Üst" ? 130 : activeCell.corridor === "Alt" ? 274 : 200
                    } L ${activeCell.x + activeCell.w / 2} ${activeCell.y + activeCell.h / 2}`}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="3"
                    strokeDasharray="6 4"
                  />
                  <circle
                    cx={activeCell.x + activeCell.w / 2}
                    cy={activeCell.y + activeCell.h / 2}
                    r="11"
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="2.5"
                  />
                </g>
              )}
            </svg>
          </div>

          {/* Legend */}
          <div
            style={sx(
              "display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:10px;font-size:11.5px;color:var(--text-muted)",
            )}
          >
            <div style={sx("display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
              <span style={sx("display:inline-flex;align-items:center;gap:5px")}>
                <i style={sx("width:10px;height:10px;border-radius:3px;background:var(--color-primary);display:inline-block")} />
                {lang === "tr" ? "Vitrin / Kataloglu Mağaza" : "Curated Showcase"}
              </span>
              <span style={sx("display:inline-flex;align-items:center;gap:5px")}>
                <i style={sx("width:10px;height:10px;border-radius:3px;background:var(--color-success-soft);border:1px solid var(--color-success);display:inline-block")} />
                {lang === "tr" ? "Aktif Esnaf" : "Active Trader"}
              </span>
              <span style={sx("display:inline-flex;align-items:center;gap:5px")}>
                <i style={sx("width:10px;height:10px;border-radius:3px;background:var(--color-primary-soft);border:1px solid var(--border-strong);display:inline-block")} />
                {lang === "tr" ? "Han Yönetimi Onaylı" : "Han Verified"}
              </span>
              <span style={sx("display:inline-flex;align-items:center;gap:5px")}>
                <i style={sx("width:10px;height:10px;border-radius:3px;background:var(--surface-subtle);border:1px dashed var(--border-strong);display:inline-block")} />
                {lang === "tr" ? "Boş / Kiralık Birim" : "Vacant / For Rent"}
              </span>
            </div>
            <span>
              {lang === "tr"
                ? "💡 Bir kapı numarasına dokunarak dükkân kartını ve yürüyüş rotasını açın."
                : "💡 Tap any door number to view shop details and walking route."}
            </span>
          </div>
        </div>
      )}

      {/* Official Architectural Floor Plan Blueprint Image (kat-0.jpg .. kat-6.jpg) */}
      {isSantral && officialPlanUrl && (viewMode === "official" || viewMode === "split") && (
        <div
          style={sx(
            "padding:14px;border-top:1px solid var(--border-subtle);background:var(--surface-muted)",
          )}
        >
          <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap")}>
            <div style={sx("font-size:12.5px;font-weight:700;color:var(--text-primary)")}>
              📐 {place.name} · {currentFloorLabel} {lang === "tr" ? "Resmi Mimari Kat Planı Paftası" : "Official Architectural Floor Plan"}
            </div>
            <a
              href={officialPlanUrl}
              target="_blank"
              rel="noreferrer"
              style={sx("font-size:12px;font-weight:700;color:var(--color-primary);text-decoration:none")}
            >
              {lang === "tr" ? "Tam Boyutlu Paftayı Yeni Sekmede Aç ↗" : "Open Full Resolution Blueprint ↗"}
            </a>
          </div>
          <div
            style={sx(
              "border-radius:10px;border:1px solid var(--border-subtle);background:var(--surface-card);padding:8px;overflow:hidden",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={officialPlanUrl}
              alt={`${place.name} ${currentFloorLabel} Resmi Kat Planı`}
              style={sx("width:100%;height:auto;display:block;border-radius:6px")}
            />
          </div>
        </div>
      )}

      {/* Selected Door Detail & Step-by-step Indoor Route Card */}
      {activeCell && (
        <div
          style={sx(
            "padding:14px 16px;border-top:1px solid var(--border-subtle);background:var(--surface-subtle);display:flex;flex-direction:column;gap:10px",
          )}
        >
          <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
            <div>
              <div style={sx("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
                <Badge color="accent" variant="solid">
                  {currentFloorLabel} · Kapı No: {activeCell.door}
                </Badge>
                <Badge color="secondary" variant="light">
                  {activeCell.corridor} Koridor
                </Badge>
                {activeCell.record ? (
                  recordBadges(activeCell.record, lang).map((b, idx) => (
                    <span key={idx} style={sx(b.style)}>
                      {b.label}
                    </span>
                  ))
                ) : (
                  <Badge color="warning" variant="light">
                    {lang === "tr" ? "Boş / Kiralık Dükkân" : "Vacant Unit"}
                  </Badge>
                )}
              </div>
              <div style={sx("font-size:16px;font-weight:800;color:var(--text-primary);margin-top:6px")}>
                {activeCell.record
                  ? activeCell.record.name
                  : lang === "tr"
                    ? `${place.name} ${currentFloorLabel} No: ${activeCell.door} (Kiralık / Müsait Birim)`
                    : `${place.name} ${currentFloorLabel} No: ${activeCell.door} (Available Unit)`}
              </div>
              {activeCell.record && (
                <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                  {activeCell.record.skuCount > 0 ? `${activeCell.record.skuCount} çeşit ürün · ` : ""}
                  {activeCell.record.moq > 1 ? `Min. sipariş: ${activeCell.record.moq} adet · ` : "Perakende tek parça satış var · "}
                  Tel: +{activeCell.record.tel}
                </div>
              )}
            </div>

            <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
              {activeCell.record && (
                <>
                  <Link
                    href={`/dukkan/${activeCell.record.curated || activeCell.record.id}`}
                    style={sx("text-decoration:none")}
                  >
                    <Button size="sm" color="primary" variant="solid" iconStart="shop">
                      {lang === "tr" ? "Dükkânı Aç" : "Open Shop"}
                    </Button>
                  </Link>
                  <a
                    href={`https://wa.me/${activeCell.record.tel}?text=${encodeURIComponent(
                      `Merhaba ${activeCell.record.name}, HAN uygulaması üzerinden (${place.name} ${currentFloorLabel} No: ${activeCell.door}) ulaşıyorum.`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    style={sx("text-decoration:none")}
                  >
                    <Button size="sm" color="success" variant="light" iconStart="whatsapp">
                      WhatsApp
                    </Button>
                  </a>
                </>
              )}
              <Button
                size="sm"
                color="accent"
                variant="outline"
                onClick={() => setAskTraderOpen(true)}
              >
                🗣️ {lang === "tr" ? "Esnafa Göster (Tam Ekran)" : "Show to Trader (Turkish Card)"}
              </Button>
            </div>
          </div>

          {/* Step-by-step Indoor Wayfinding */}
          <div
            style={sx(
              "padding:10px 12px;border-radius:10px;background:var(--surface-card);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:4px",
            )}
          >
            <div style={sx("font-size:11.5px;font-weight:700;color:var(--color-primary)")}>
              🧭 {lang === "tr" ? "Han İçi Adım Adım Yürüyüş Tarifi (İnternetsiz / GPS'siz):" : "Step-by-Step Indoor Directions (No GPS):"}
            </div>
            {indoorSteps.map((st, idx) => (
              <div key={idx} style={sx("font-size:12.5px;color:var(--text-body)")}>
                {st}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin / Han Owner Occupancy Summary Bar */}
      {adminMode && (
        <div
          style={sx(
            "padding:12px 16px;border-top:1px solid var(--border-subtle);background:var(--surface-elevated);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px",
          )}
        >
          <div>
            <b>{place.name} · {currentFloorLabel} Doluluk Özeti:</b>{" "}
            {floorRecords.filter((r) => r.status === "aktif").length} Aktif ·{" "}
            {floorRecords.filter((r) => r.status === "onayli").length} Onaylı ·{" "}
            {floorRecords.filter((r) => r.status === "beyan").length} Beyan ·{" "}
            <span style={sx("color:var(--color-warning);font-weight:700")}>
              {vacantDoors.length} Boş/Kiralık Kapı ({vacantDoors.slice(0, 8).join(", ")}
              {vacantDoors.length > 8 ? "…" : ""})
            </span>
          </div>
          <span style={sx("color:var(--text-muted)")}>
            {isSantral
              ? "Kaynak: Tahtakale Santral Center Resmi Kat Planları (Z–F)"
              : `Kaynak: ${place.name} Dijital Kat & Kapı Envanteri`}
          </span>
        </div>
      )}

      {/* Full-Screen "Esnafa Göster" (Ask a Trader) Drawer for Tourists & Visitors */}
      <Drawer
        open={askTraderOpen}
        onClose={() => setAskTraderOpen(false)}
        title={lang === "tr" ? "Esnafa Göster · Han İçi Yardım Kartı" : "Show to Any Trader in the Han"}
      >
        <div style={sx("padding:16px;display:flex;flex-direction:column;gap:14px")}>
          <div
            style={sx(
              "padding:20px;border-radius:14px;background:var(--color-primary);color:#fff;text-align:center",
            )}
          >
            <div style={sx("font-size:12px;font-weight:700;opacity:0.85;letter-spacing:.06em;text-transform:uppercase")}>
              LÜTFEN YARDIMCI OLUR MUSUNUZ? · {place.name.toLocaleUpperCase("tr")} REHBERİ
            </div>
            <div style={sx("font-size:24px;font-weight:800;line-height:1.3;margin-top:10px")}>
              Merhaba usta / komşu,
              <br />
              {place.name} · {floorLabel(floor, "tr", place)}
              <br />
              Kapı No: {activeCell?.door || "—"}
            </div>
            <div
              style={sx(
                "margin-top:12px;padding:10px 14px;border-radius:10px;background:var(--surface-card);color:var(--text-primary);font-size:20px;font-weight:800",
              )}
            >
              {activeCell?.record?.name || `Kapı No: ${activeCell?.door}`}
            </div>
            <div style={sx("font-size:14px;margin-top:12px;opacity:0.95")}>
              ({activeCell?.corridor || "Orta"} Koridor — Bu dükkâna hangi merdiven veya koridordan gidebilirim?)
            </div>
          </div>

          <div style={sx("font-size:13px;color:var(--text-body);line-height:1.5")}>
            {lang === "tr"
              ? "Bu ekranı han girişindeki güvenliğe, çay ocağına veya herhangi bir komşu esnafa gösterin; sizi doğrudan doğru koridora yönlendirecektir."
              : "Show this Turkish card to security at the gate, the tea stall, or any shopkeeper inside the han — they will point you straight to the right corridor and door."}
          </div>

          {place.lat && place.lng && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=walking`}
              target="_blank"
              rel="noreferrer"
              style={sx("text-decoration:none")}
            >
              <Button fullWidth color="primary" variant="outline" iconStart="map">
                {lang === "tr"
                  ? `${place.name} Dış Kapısına Google Maps Yürüyüş Rotası Aç`
                  : `Open Google Maps Walking Route to ${place.name} Gate`}
              </Button>
            </a>
          )}
        </div>
      </Drawer>
    </div>
  );
}
export default SantralFloorMap;
