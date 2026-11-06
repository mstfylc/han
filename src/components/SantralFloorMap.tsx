"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  initialDoor?: string | null;
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
  initialDoor = null,
  highlightDoor = null,
  highlightRecordId = null,
  lang = "tr",
  onSelectRecord,
  adminMode = false,
}: SantralFloorMapProps) {
  const effectiveDoor = highlightDoor ?? initialDoor ?? null;
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
    if (effectiveDoor) {
      const hit = allPlaceRecords.find((r) => String(r.door) === String(effectiveDoor));
      if (hit) return hit.floor;
    }
    return place.id === "santral" && place.floors.includes(1) ? 1 : (place.floors[0] ?? 0);
  }, [initialFloor, highlightRecordId, effectiveDoor, allPlaceRecords, place]);

  const [floor, setFloor] = useState<number>(resolvedInitialFloor);
  const [viewMode, setViewMode] = useState<"interactive" | "official" | "split">("interactive");
  const [anchor, setAnchor] = useState<AnchorKey>("giris");
  const [startDoor, setStartDoor] = useState<string | null>(null);
  const [entryFloor, setEntryFloor] = useState<number>(place.id === "santral" && place.floors.includes(1) ? 1 : (place.floors[0] ?? 0));
  const [radarCat, setRadarCat] = useState<string>("all");
  const [zoom, setZoom] = useState<number>(1);
  const [liveStepIdx, setLiveStepIdx] = useState<number | null>(null);
  const [filterText, setFilterText] = useState("");
  const [selectedDoor, setSelectedDoor] = useState<string | null>(effectiveDoor);
  const [askTraderOpen, setAskTraderOpen] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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
    () => ANCHORS.find((a) => a.id === anchor) || ANCHORS[0],
    [anchor],
  );

  // Automatically center the horizontal scrollable SVG viewport on the selected door on mobile/narrow viewports
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !activeCell) return;
    if (el.scrollWidth <= el.clientWidth + 12) return;
    const ratio = (activeCell.x + activeCell.w / 2) / 900;
    const targetLeft = Math.max(0, ratio * el.scrollWidth - el.clientWidth / 2);
    el.scrollTo({ left: targetLeft, behavior: "smooth" });
  }, [activeCell, floor, zoom, fullScreen]);

  const startCell = useMemo(
    () => (startDoor ? cells.find((c) => c.door === startDoor) || null : null),
    [cells, startDoor],
  );

  // Start coordinates (either a custom selected startDoor on this floor, or the selected landmark anchor)
  const startPoint = useMemo(() => {
    if (startCell) {
      return {
        x: startCell.x + startCell.w / 2,
        y: startCell.y + startCell.h / 2,
        corridor: startCell.corridor,
        label: lang === "tr" ? `Kapı No: ${startCell.door} (${startCell.record?.name || "Mevcut Konum"})` : `Door No: ${startCell.door}`,
      };
    }
    return {
      x: activeAnchor.x,
      y: activeAnchor.y,
      corridor: "Orta" as const,
      label: tx(activeAnchor, lang),
    };
  }, [startCell, activeAnchor, lang]);

  // Cross-floor matches when the user searches for a shop/door located on ANOTHER floor of the same han
  const otherFloorHits = useMemo(() => {
    const q = filterText.trim().toLocaleLowerCase("tr");
    if (q.length < 2) return [];
    return allPlaceRecords
      .filter((r) => r.floor !== floor)
      .filter(
        (r) =>
          String(r.door).toLocaleLowerCase("tr").includes(q) ||
          (r.name || "").toLocaleLowerCase("tr").includes(q) ||
          (r.cat || "").toLocaleLowerCase("tr").includes(q),
      )
      .slice(0, 5);
  }, [allPlaceRecords, floor, filterText]);

  const matchesRadar = (c: UnitCell, rCat: string = radarCat): boolean => {
    if (rCat === "all") return true;
    if (rCat === "vacant" || rCat === "bos") return c.vacant;
    if (rCat === "curated" || rCat === "vitrin") return !!c.record?.curated || c.record?.status === "aktif";
    const catStr = `${c.record?.cat || ""} ${(c.record?.cats || []).join(" ")} ${c.record?.name || ""}`.toLocaleLowerCase("tr");
    if (rCat === "bijuteri") return /bijuteri|taki|takı|gümüş|gumus|çelik|celik|kolye|küpe|tesbih|toka|doğaltaş/.test(catStr);
    if (rCat === "elektronik") return /kilif|kılıf|sarj|şarj|telefon|elektronik|kablo|kulaklık|ses|kamera/.test(catStr);
    if (rCat === "saat") return /saat|pil|batarya|kumanda|optik|gözlük/.test(catStr);
    return true;
  };

  const filteredCells = useMemo(() => {
    const q = filterText.trim().toLocaleLowerCase("tr");
    return cells.filter((c) => {
      if (!matchesRadar(c, radarCat)) return false;
      if (!q) return true;
      if (c.door.toLocaleLowerCase("tr").includes(q)) return true;
      if (c.record?.name?.toLocaleLowerCase("tr").includes(q)) return true;
      if (c.record?.cat?.toLocaleLowerCase("tr").includes(q)) return true;
      return false;
    });
  }, [cells, filterText, radarCat]);

  const currentFloorLabel = floorLabel(floor, lang, place);
  const entryFloorLabel = floorLabel(entryFloor, lang, place);
  const floorDiff = floor - entryFloor;

  // Approximate indoor walking distance in meters & seconds
  const routeMetrics = useMemo(() => {
    if (!activeCell) return { meters: 0, secs: 0, midX: 450, midY: 200, pathD: "" };
    const txCoord = activeCell.x + activeCell.w / 2;
    const tyCoord = activeCell.y + activeCell.h / 2;
    const targetCorrY = activeCell.corridor === "Üst" ? 130 : activeCell.corridor === "Alt" ? 274 : 200;
    const startCorrY = startCell
      ? startCell.corridor === "Üst"
        ? 130
        : startCell.corridor === "Alt"
          ? 274
          : 200
      : targetCorrY;

    const dx = Math.abs(txCoord - startPoint.x);
    const dy = Math.abs(tyCoord - startPoint.y);
    const floorPenaltyMeters = Math.abs(floorDiff) * 18;
    const meters = Math.max(8, Math.round((dx + dy) * 0.085 + floorPenaltyMeters));
    const secs = Math.max(15, Math.round(meters * 1.1 + Math.abs(floorDiff) * 25));

    const pathD = startCell && startCorrY !== targetCorrY
      ? `M ${startPoint.x} ${startPoint.y} L ${startPoint.x} ${startCorrY} L 450 ${startCorrY} L 450 ${targetCorrY} L ${txCoord} ${targetCorrY} L ${txCoord} ${tyCoord}`
      : `M ${startPoint.x} ${startPoint.y} L ${startPoint.x} ${targetCorrY} L ${txCoord} ${targetCorrY} L ${txCoord} ${tyCoord}`;

    const midX = Math.round((startPoint.x + txCoord) / 2);
    const midY = targetCorrY;
    return { meters, secs, midX, midY, pathD };
  }, [activeCell, startCell, startPoint, floorDiff]);
  const specialty = useMemo(() => {
    if (isSantral && SANTRAL_FLOOR_SPECIALTY[floor]) {
      return tx(SANTRAL_FLOOR_SPECIALTY[floor], lang);
    }
    const byPlace = PLACE_FLOOR_SPECIALTY[place.id]?.[floor];
    if (byPlace) {
      return lang === "tr" ? byPlace.tr : byPlace.en;
    }
    const uniqueCats = Array.from(new Set(floorRecords.map((r) => r.cat).filter(Boolean))).slice(0, 3);
    const catNames = uniqueCats
      .map((cid: string) => {
        const c = D.CATS.find((x) => x.id === cid);
        return c ? tx(c, lang) : cid;
      })
      .join(", ");
    return `${currentFloorLabel} · ${place.name}${catNames ? ` — ${catNames}` : ""}`;
  }, [isSantral, floor, lang, place, currentFloorLabel, floorRecords]);

  const officialPlanUrl = isSantral ? `/assets/santral/kat-${floor}.jpg` : null;

  // Step-by-step indoor instruction from activeAnchor / startDoor (including cross-floor vertical guidance) to activeCell
  const indoorSteps = useMemo(() => {
    if (!activeCell) return [];
    const corrLabel =
      activeCell.corridor === "Üst"
        ? lang === "tr"
          ? isCourtyard ? "Kuzey Revan Galerisi" : "Üst Koridor (Kuzey Kanadı)"
          : "Upper Corridor (North Wing)"
        : activeCell.corridor === "Orta"
          ? lang === "tr"
            ? isCourtyard ? "Tarihi Orta Avlu Çevresi" : "Orta Ada Koridoru"
            : "Central Corridor"
          : lang === "tr"
            ? isCourtyard ? "Güney Revan Galerisi" : "Alt Koridor (Güney Kanadı)"
            : "Lower Corridor (South Wing)";

    const shopTitle = activeCell.record ? activeCell.record.name : `Kapı No: ${activeCell.door} (Boş / Kiralık)`;
    const dirSide = activeCell.x + activeCell.w / 2 < startPoint.x - 40
      ? (lang === "tr" ? "sol kola (Batı yönüne)" : "to the left wing")
      : activeCell.x + activeCell.w / 2 > startPoint.x + 40
        ? (lang === "tr" ? "sağ kola (Doğu yönüne)" : "to the right wing")
        : (lang === "tr" ? "doğrudan karşı hatta" : "straight ahead");

    if (lang === "tr") {
      const steps: { title: string; detail: string; badge: string }[] = [];
      if (!startCell && floorDiff !== 0) {
        steps.push({
          badge: `1 · Giriş (${entryFloorLabel})`,
          title: `${place.name} ${entryFloorLabel} kapısından girin`,
          detail: floorDiff > 0
            ? `Ana merdiven veya asansör ile ${floorDiff} kat yukarı (${currentFloorLabel} seviyesine) çıkın.`
            : `Merdiven veya asansör ile ${Math.abs(floorDiff)} kat aşağı (${currentFloorLabel} seviyesine) inin.`,
        });
      } else {
        steps.push({
          badge: `1 · Başlangıç (${currentFloorLabel})`,
          title: `${startPoint.label} noktasından yürüyüşe başlayın`,
          detail: `${place.name} · ${currentFloorLabel} seviyesindesiniz.`,
        });
      }
      steps.push({
        badge: `2 · Koridor (${corrLabel})`,
        title: `${corrLabel} hattına geçip ${dirSide} ilerleyin`,
        detail: `Yaklaşık ${routeMetrics.meters} metre (~${Math.max(1, Math.round(routeMetrics.secs / 60))} dk) yürüyün; kapı numaralarını takip edin.`,
      });
      steps.push({
        badge: `3 · Varış (No: ${activeCell.door})`,
        title: `Kapı No: ${activeCell.door} — ${shopTitle}`,
        detail: activeCell.record
          ? `Mağazaya ulaştınız. Tel: +${activeCell.record.tel} · ${activeCell.record.moq > 1 ? `Min. ${activeCell.record.moq} adet` : "Perakende & Toptan açık"}.`
          : `Müsait / kiralık birim konumuna ulaştınız.`,
      });
      return steps;
    }

    return [
      {
        badge: `1 · Start (${currentFloorLabel})`,
        title: `Start at ${startPoint.label}`,
        detail: floorDiff !== 0 ? `Take the lift or stairs from ${entryFloorLabel} to ${currentFloorLabel}.` : `You are on ${currentFloorLabel} at ${place.name}.`,
      },
      {
        badge: `2 · Corridor (${corrLabel})`,
        title: `Walk along ${corrLabel} (${dirSide})`,
        detail: `Proceed ~${routeMetrics.meters} meters following the door numbers in sequence.`,
      },
      {
        badge: `3 · Arrive (Door ${activeCell.door})`,
        title: `Door No: ${activeCell.door} — ${shopTitle}`,
        detail: `You have arrived at your destination.`,
      },
    ];
  }, [activeCell, startCell, startPoint, floorDiff, entryFloorLabel, currentFloorLabel, place.name, lang, isCourtyard, routeMetrics]);

  const speakDirections = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const text = indoorSteps.map((s) => `${s.title}. ${s.detail}`).join(" ");
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang === "tr" ? "tr-TR" : lang === "ru" ? "ru-RU" : lang === "ar" ? "ar-SA" : "en-US";
      utter.rate = 1.0;
      window.speechSynthesis.speak(utter);
    } catch {
      /* ignore speech errors */
    }
  };

  return (
    <div
      style={sx(
        fullScreen
          ? "position:fixed;inset:0;z-index:90;background:var(--surface-page);overflow-y:auto;padding-bottom:80px;width:100%;max-width:100%"
          : "border-radius:14px;border:1px solid var(--border-subtle);background:var(--surface-card);overflow:hidden;width:100%;max-width:100%;min-width:0;box-sizing:border-box",
      )}
    >
      {/* Top Header: Place & Floor Summary + View Mode Switcher */}
      <div
        style={sx(
          "padding:12px 14px;background:var(--surface-muted);border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap",
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

        <div style={sx("display:flex;gap:6px;flex-wrap:wrap;align-items:center")}>
          {isSantral && (
            <>
              <Button
                size="sm"
                color={viewMode === "interactive" ? "primary" : "secondary"}
                variant={viewMode === "interactive" ? "solid" : "outline"}
                iconStart="map"
                onClick={() => setViewMode("interactive")}
              >
                {lang === "tr" ? "İnteraktif Kat Planı" : "Interactive Map"}
              </Button>
              <Button
                size="sm"
                color={viewMode === "official" ? "primary" : "secondary"}
                variant={viewMode === "official" ? "solid" : "outline"}
                iconStart="floor-layer"
                onClick={() => setViewMode("official")}
              >
                {lang === "tr" ? "Resmi Mimari Pafta" : "Official Blueprint"}
              </Button>
              <Button
                size="sm"
                color={viewMode === "split" ? "primary" : "secondary"}
                variant={viewMode === "split" ? "solid" : "outline"}
                onClick={() => setViewMode("split")}
              >
                {lang === "tr" ? "İkisi Birlikte" : "Split View"}
              </Button>
            </>
          )}
          <Button
            size="sm"
            color={fullScreen ? "danger" : "accent"}
            variant={fullScreen ? "solid" : "light"}
            iconStart={fullScreen ? "minimize" : "maximize"}
            onClick={() => setFullScreen((v) => !v)}
          >
            {fullScreen
              ? lang === "tr"
                ? "Tam Ekrandan Çık"
                : "Exit Full Screen"
              : lang === "tr"
                ? "Tam Ekran Kroki"
                : "Full Screen"}
          </Button>
        </div>
      </div>

      {/* Floor Selector Strip (Z, A, B, C, D, E, F) + Vertical Cross-Floor Indicator */}
      <div
        style={sx(
          "padding:10px 14px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:var(--surface-card);min-width:0;max-width:100%",
        )}
      >
        <div data-han-nav="1" style={sx("display:flex;align-items:center;gap:6px;overflow-x:auto;min-width:0;max-width:100%;padding-bottom:2px")}>
          <span style={sx("font-size:11.5px;font-weight:700;color:var(--text-muted);margin-inline-end:4px;white-space:nowrap")}>
            {lang === "tr" ? "HEDEF KAT:" : "TARGET FLOOR:"}
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
                  setStartDoor(null);
                  setLiveStepIdx(null);
                }}
                style={sx(
                  "flex:none;height:34px;padding:0 12px;border-radius:8px;border:1px solid " +
                    (on ? "var(--color-primary)" : "var(--border-subtle)") +
                    ";background:" +
                    (on ? "var(--color-primary)" : "var(--surface-muted)") +
                    ";color:" +
                    (on ? "#fff" : "var(--text-primary)") +
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

        {place.floors.length > 1 && (
          <div style={sx("display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-muted)")}>
            <span style={sx("font-weight:700")}>
              {lang === "tr" ? "Giriş Yaptığım Kat:" : "My Entry Floor:"}
            </span>
            <select
              value={entryFloor}
              onChange={(e) => setEntryFloor(Number(e.target.value))}
              style={sx(
                "height:28px;padding:0 8px;border-radius:6px;border:1px solid var(--border-strong);background:var(--surface-muted);color:var(--text-primary);font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer",
              )}
            >
              {place.floors.map((f) => (
                <option key={f} value={f}>
                  {floorLabel(f, lang, place)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Cross-Floor Vertical Journey Banner when target floor !== entry floor */}
      {floorDiff !== 0 && (
        <div
          style={sx(
            "padding:8px 14px;background:var(--color-primary-soft);border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px",
          )}
        >
          <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--text-primary);font-weight:700")}>
            <span style={sx("display:inline-flex;align-items:center;gap:5px;color:var(--color-primary)")}>
              <Icon name="stairs" size={15} />
              {lang === "tr" ? "Katlar Arası Dikey Rota Aktif:" : "Cross-Floor Vertical Route:"}
            </span>
            <span style={sx("padding:2px 8px;border-radius:6px;background:var(--surface-card);border:1px solid var(--border-subtle)")}>
              1. {entryFloorLabel}
            </span>
            <span>➔</span>
            <span style={sx("padding:2px 8px;border-radius:6px;background:var(--color-accent-soft);color:var(--text-primary)")}>
              2. {floorDiff > 0 ? `+${floorDiff} Kat Yukarı (Asansör / Merdiven)` : `${Math.abs(floorDiff)} Kat Aşağı (Merdiven)`}
            </span>
            <span>➔</span>
            <span style={sx("padding:2px 8px;border-radius:6px;background:var(--color-primary);color:#fff")}>
              3. {currentFloorLabel} {activeCell ? `· Kapı No: ${activeCell.door}` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEntryFloor(floor)}
            style={sx(
              "background:none;border:none;padding:0;font-family:inherit;font-size:11.5px;font-weight:700;color:var(--color-primary);cursor:pointer;text-decoration:underline",
            )}
          >
            {lang === "tr" ? "Zaten bu kattayım" : "I am already on this floor"}
          </button>
        </div>
      )}

      {/* Indoor No-GPS Location Anchor Bar + Quick Search */}
      <div
        style={sx(
          "padding:10px 14px;background:var(--surface-subtle);border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;min-width:0;max-width:100%",
        )}
      >
        <div data-han-nav="1" style={sx("display:flex;align-items:center;gap:6px;overflow-x:auto;flex-wrap:nowrap;min-width:0;max-width:100%;padding-bottom:2px")}>
          <span style={sx("flex:none;display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:var(--color-primary);white-space:nowrap")}>
            <Icon name="pin" size={14} />
            {lang === "tr" ? "Başlangıç Noktam:" : "My Start Point:"}
          </span>
          {ANCHORS.map((a) => {
            const on = !startCell && a.id === anchor;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setStartDoor(null);
                  setAnchor(a.id);
                }}
                style={sx(
                  "flex:none;white-space:nowrap;height:28px;padding:0 10px;border-radius:6px;border:1px solid " +
                    (on ? "var(--color-primary)" : "var(--border-subtle)") +
                    ";background:" +
                    (on ? "var(--color-primary)" : "var(--surface-card)") +
                    ";color:" +
                    (on ? "#fff" : "var(--text-body)") +
                    ";font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer",
                )}
              >
                {tx(a, lang)}
              </button>
            );
          })}
          {startCell && (
            <span
              style={sx(
                "display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:6px;background:var(--color-accent);color:var(--color-accent-inverse);font-size:11.5px;font-weight:800",
              )}
            >
              <Icon name="pin" size={13} />
              {lang === "tr" ? `Başlangıç: Kapı ${startCell.door}` : `Start: Door ${startCell.door}`}
              <button
                type="button"
                onClick={() => setStartDoor(null)}
                style={sx("background:none;border:none;color:inherit;font-weight:900;cursor:pointer;padding:0 2px")}
                title={lang === "tr" ? "Başlangıç kapısını sıfırla" : "Reset start door"}
              >
                ×
              </button>
            </span>
          )}
        </div>

        <div style={sx("flex:1 1 220px;min-width:0;max-width:100%")}>
          <Input
            size="sm"
            iconLead="magnifier"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={
              lang === "tr"
                ? `${place.name} içinde kapı no, esnaf veya ürün ara…`
                : `Search door no., shop or product in ${place.name}…`
            }
          />
        </div>
      </div>

      {/* Cross-Floor Search Suggestions (if user searches for a shop located on another floor) */}
      {otherFloorHits.length > 0 && (
        <div
          style={sx(
            "padding:8px 14px;background:var(--color-warning-soft);border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:8px;flex-wrap:wrap",
          )}
        >
          <span style={sx("display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:800;color:var(--text-primary)")}>
            <Icon name="magnifier" size={13} />
            {lang === "tr" ? "Diğer katlarda bulundu (Tıklayıp o kata geçin):" : "Found on other floors (Click to jump):"}
          </span>
          {otherFloorHits.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setFloor(r.floor);
                setSelectedDoor(String(r.door));
                setFilterText("");
                if (onSelectRecord) onSelectRecord(r.curated || r.id);
              }}
              style={sx(
                "height:26px;padding:0 10px;border-radius:999px;border:1px solid var(--color-primary);background:var(--surface-card);color:var(--color-primary);font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer",
              )}
            >
              {floorLabel(r.floor, lang, place)} · Kapı {r.door} · {r.name} ➔
            </button>
          ))}
        </div>
      )}

      {/* Smart Category Radar Filter Bar + Zoom Controls */}
      <div
        style={sx(
          "padding:8px 14px;background:var(--surface-card);border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;min-width:0;max-width:100%",
        )}
      >
        <div data-han-nav="1" style={sx("display:flex;align-items:center;gap:6px;overflow-x:auto;flex-wrap:nowrap;min-width:0;max-width:100%;padding-bottom:2px")}>
          <span style={sx("flex:none;display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;white-space:nowrap")}>
            <Icon name="compass" size={13} />
            {lang === "tr" ? "Kat Radarı:" : "Floor Radar:"}
          </span>
          {(
            [
              ["all", null, lang === "tr" ? "Tümü" : "All"],
              ["vitrin", "star", lang === "tr" ? "Vitrin & Aktif" : "Active"],
              ["bijuteri", "diamond", lang === "tr" ? "Bijuteri & Takı" : "Jewelry"],
              ["elektronik", "smartphone", lang === "tr" ? "Telefon & Elektronik" : "Electronics"],
              ["saat", "watch", lang === "tr" ? "Saat & Gözlük" : "Watch & Optics"],
              ["bos", "door", lang === "tr" ? "Boş / Kiralık" : "Vacant"],
            ] as const
          ).map(([id, ic, label]) => {
            const on = radarCat === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setRadarCat(id)}
                style={sx(
                  "flex:none;white-space:nowrap;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:999px;border:1px solid " +
                    (on ? "var(--color-primary)" : "var(--border-subtle)") +
                    ";background:" +
                    (on ? "var(--color-primary)" : "var(--surface-muted)") +
                    ";color:" +
                    (on ? "#fff" : "var(--text-body)") +
                    ";font-family:inherit;font-size:11px;font-weight:700;cursor:pointer",
                )}
              >
                {ic && <Icon name={ic} size={12} />}
                {label}
              </button>
            );
          })}
        </div>

        <div style={sx("display:flex;align-items:center;gap:4px")}>
          <span style={sx("display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--text-muted);margin-inline-end:4px")}>
            <Icon name="zoom-in" size={13} />
            {lang === "tr" ? "Yakınlaştır:" : "Zoom:"}
          </span>
          {[1, 1.35, 1.75].map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              style={sx(
                "height:25px;padding:0 8px;border-radius:6px;border:1px solid " +
                  (zoom === z ? "var(--color-primary)" : "var(--border-subtle)") +
                  ";background:" +
                  (zoom === z ? "var(--color-primary)" : "var(--surface-muted)") +
                  ";color:" +
                  (zoom === z ? "#fff" : "var(--text-body)") +
                  ";font-family:inherit;font-size:11px;font-weight:700;cursor:pointer",
              )}
            >
              {Math.round(z * 100)}%
            </button>
          ))}
        </div>
      </div>

      {/* Interactive SVG Floor Plan */}
      {(viewMode === "interactive" || viewMode === "split") && (
        <div style={sx("padding:10px 12px;background:var(--surface-card);min-width:0;max-width:100%;overflow:hidden")}>
          <div
            ref={scrollContainerRef}
            style={sx(
              "width:100%;max-width:100%;min-width:0;overflow-x:auto;border-radius:12px;border:1px solid var(--border-subtle);background:var(--surface-muted);padding:10px;-webkit-overflow-scrolling:touch;box-sizing:border-box",
            )}
          >
            <svg
              viewBox="0 0 900 385"
              style={sx(`width:${Math.round(zoom * 100)}%;min-width:600px;height:auto;display:block;transition:width 180ms ease`)}
              role="img"
              aria-label={`${place.name} ${currentFloorLabel} Kat Planı`}
            >
              {/* Outer Building Frame */}
              <rect
                x="14"
                y="12"
                width="872"
                height="360"
                rx="12"
                fill="var(--surface-card)"
                stroke="var(--border-strong)"
                strokeWidth="2"
              />

              {/* Corridor Walkways */}
              <rect x="26" y="114" width="848" height="32" rx="4" fill="var(--surface-subtle)" />
              <rect x="26" y="258" width="848" height="32" rx="4" fill="var(--surface-subtle)" />

              {/* Left Staircase + Lift (Clickable Start Landmark) */}
              <g
                onClick={() => {
                  setStartDoor(null);
                  setAnchor("sol-merdiven");
                }}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x="34"
                  y="152"
                  width="108"
                  height="98"
                  rx="8"
                  fill={!startCell && anchor === "sol-merdiven" ? "var(--color-primary-soft)" : "var(--surface-muted)"}
                  stroke={!startCell && anchor === "sol-merdiven" ? "var(--color-primary)" : "var(--border-strong)"}
                  strokeWidth={!startCell && anchor === "sol-merdiven" ? "2.5" : "1.5"}
                  strokeDasharray={!startCell && anchor === "sol-merdiven" ? undefined : "4 2"}
                />
                <text
                  x="88"
                  y="186"
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize="10.5"
                  fontWeight="800"
                >
                  {isCourtyard ? "BATI REVAN" : "SOL MERDİVEN"}
                </text>
                <text
                  x="88"
                  y="204"
                  textAnchor="middle"
                  fill="var(--color-primary)"
                  fontSize="9.5"
                  fontWeight="700"
                >
                  {isCourtyard ? "🏛️ TAŞ MERDİVEN" : "⇅ ASANSÖR & WC"}
                </text>
                <text
                  x="88"
                  y="224"
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize="8.5"
                  fontWeight="700"
                >
                  {!startCell && anchor === "sol-merdiven" ? "📍 BURADASINIZ" : "(Başlangıç seç)"}
                </text>
              </g>

              {/* Central Architectural Spine (Clickable Start Landmark) */}
              <g
                onClick={() => {
                  setStartDoor(null);
                  setAnchor("orta-pano");
                }}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x="404"
                  y="148"
                  width="92"
                  height="106"
                  rx="8"
                  fill={isCourtyard ? "var(--color-accent-soft)" : "var(--color-primary-soft)"}
                  stroke={!startCell && anchor === "orta-pano" ? "var(--color-primary)" : isCourtyard ? "var(--color-accent)" : "var(--color-primary)"}
                  strokeWidth={!startCell && anchor === "orta-pano" ? "2.5" : "1.5"}
                />
                <text
                  x="450"
                  y="182"
                  textAnchor="middle"
                  fill="var(--color-primary)"
                  fontSize="12"
                  fontWeight="800"
                >
                  {currentFloorLabel.toUpperCase()}
                </text>
                <text
                  x="450"
                  y="200"
                  textAnchor="middle"
                  fill="var(--text-body)"
                  fontSize="9.5"
                  fontWeight="700"
                >
                  {isCourtyard ? "TARİHİ AVLU" : "ORTA HOL"}
                </text>
                <text
                  x="450"
                  y="218"
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize="8.5"
                  fontWeight="700"
                >
                  {!startCell && anchor === "orta-pano" ? "📍 BURADASINIZ" : "(Başlangıç seç)"}
                </text>
              </g>

              {/* Right Staircase / Tea Stall (Clickable Start Landmark) */}
              <g
                onClick={() => {
                  setStartDoor(null);
                  setAnchor("sag-merdiven");
                }}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x="758"
                  y="152"
                  width="108"
                  height="98"
                  rx="8"
                  fill={!startCell && anchor === "sag-merdiven" ? "var(--color-primary-soft)" : "var(--surface-muted)"}
                  stroke={!startCell && anchor === "sag-merdiven" ? "var(--color-primary)" : "var(--border-strong)"}
                  strokeWidth={!startCell && anchor === "sag-merdiven" ? "2.5" : "1.5"}
                  strokeDasharray={!startCell && anchor === "sag-merdiven" ? undefined : "4 2"}
                />
                <text
                  x="812"
                  y="186"
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize="10.5"
                  fontWeight="800"
                >
                  {isCourtyard ? "DOĞU REVAN" : "SAĞ MERDİVEN"}
                </text>
                <text
                  x="812"
                  y="204"
                  textAnchor="middle"
                  fill="var(--color-accent)"
                  fontSize="9.5"
                  fontWeight="700"
                >
                  ☕ ÇAY OCAĞI / WC
                </text>
                <text
                  x="812"
                  y="224"
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize="8.5"
                  fontWeight="700"
                >
                  {!startCell && anchor === "sag-merdiven" ? "📍 BURADASINIZ" : "(Başlangıç seç)"}
                </text>
              </g>

              {/* Main Entrance Gate Button at Bottom Center */}
              <g
                onClick={() => {
                  setStartDoor(null);
                  setAnchor("giris");
                }}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x="375"
                  y="348"
                  width="150"
                  height="22"
                  rx="6"
                  fill={!startCell && anchor === "giris" ? "var(--color-primary)" : "var(--surface-elevated)"}
                  stroke="var(--color-primary)"
                  strokeWidth="1.5"
                />
                <text
                  x="450"
                  y="363"
                  textAnchor="middle"
                  fill={!startCell && anchor === "giris" ? "#fff" : "var(--color-primary)"}
                  fontSize="9.5"
                  fontWeight="800"
                >
                  🚪 ANA GİRİŞ / DANIŞMA {!startCell && anchor === "giris" ? "(AKTİF)" : ""}
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
                const isStart = startCell?.door === cell.door;
                const isFilteredOut =
                  (filterText.trim().length > 0 && !filteredCells.some((fc) => fc.door === cell.door)) ||
                  !matchesRadar(cell);
                const isCurated = !!cell.record?.curated;
                const status = cell.record?.status;

                const fill = isTarget
                  ? "var(--color-accent)"
                  : isStart
                    ? "var(--color-success)"
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
                  : isStart
                    ? "var(--color-success)"
                    : cell.vacant
                      ? "var(--border-strong)"
                      : isCurated
                        ? "var(--color-primary)"
                        : status === "aktif"
                          ? "var(--color-success)"
                          : "var(--border-strong)";

                const textColor = isTarget
                  ? "var(--color-accent-inverse)"
                  : isStart || isCurated
                    ? "#fff"
                    : cell.vacant
                      ? "var(--text-muted)"
                      : "var(--text-primary)";

                return (
                  <g
                    key={cell.door}
                    onClick={() => {
                      setSelectedDoor(cell.door);
                      setLiveStepIdx(null);
                      if (cell.record && onSelectRecord) {
                        onSelectRecord(cell.record.curated || cell.record.id);
                      }
                    }}
                    style={{
                      cursor: "pointer",
                      opacity: isFilteredOut && !isTarget && !isStart ? 0.22 : 1,
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
                      strokeWidth={isTarget || isStart ? "2.5" : "1"}
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
                        {isStart
                          ? "BAŞLA"
                          : cell.vacant
                            ? "BOŞ"
                            : (cell.record?.name || "").split(" ")[0].slice(0, 6)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Animated Indoor Walking Route from Start Point (Anchor or Start Door) to Selected Target Door */}
              {activeCell && routeMetrics && (
                <g pointerEvents="none">
                  {/* Glowing background path */}
                  <path
                    d={routeMetrics.pathD}
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.28"
                  />
                  {/* Animated marching ants foreground path */}
                  <path
                    d={routeMetrics.pathD}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="8 6"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="28"
                      to="0"
                      dur="0.9s"
                      repeatCount="indefinite"
                    />
                  </path>

                  {/* Start Point Marker */}
                  <circle
                    cx={startPoint.x}
                    cy={startPoint.y}
                    r="8"
                    fill="var(--color-success)"
                    stroke="#fff"
                    strokeWidth="2.5"
                  />

                  {/* Distance & Walking Time Pill on Route Midpoint */}
                  <g transform={`translate(${Math.min(820, Math.max(80, routeMetrics.midX))}, ${routeMetrics.midY})`}>
                    <rect
                      x="-54"
                      y="-12"
                      width="108"
                      height="22"
                      rx="11"
                      fill="var(--color-primary)"
                      stroke="#fff"
                      strokeWidth="1.5"
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fill="#fff"
                      fontSize="9.5"
                      fontWeight="800"
                    >
                      🚶 ~{routeMetrics.meters}m · {routeMetrics.secs} sn
                    </text>
                  </g>

                  {/* Pulsing Target Ring on Destination Door */}
                  <circle
                    cx={activeCell.x + activeCell.w / 2}
                    cy={activeCell.y + activeCell.h / 2}
                    r="14"
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="3"
                  >
                    <animate attributeName="r" values="11;18;11" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.35;1" dur="1.5s" repeatCount="indefinite" />
                  </circle>
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
            <span style={sx("display:inline-flex;align-items:center;gap:5px")}>
              <Icon name="info-circle" size={14} />
              {lang === "tr"
                ? "Haritadaki merdivenlere/kapılara tıklayarak 'Buradayım' seçebilir, kapıdan kapıya canlı rota çizebilirsiniz."
                : "Click any stair/gate or door to set your start point and draw a live door-to-door route."}
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
            <div style={sx("display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:var(--text-primary)")}>
              <Icon name="floor-layer" size={15} />
              {place.name} · {currentFloorLabel} {lang === "tr" ? "Resmi Mimari Kat Planı Paftası" : "Official Architectural Floor Plan"}
            </div>
            <a
              href={officialPlanUrl}
              target="_blank"
              rel="noreferrer"
              style={sx("display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:var(--color-primary);text-decoration:none")}
            >
              {lang === "tr" ? "Tam Boyutlu Paftayı Yeni Sekmede Aç" : "Open Full Resolution Blueprint"}
              <Icon name="external-link" size={13} />
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

      {/* Selected Door Detail & Interactive Turn-by-Turn Indoor Navigation Card */}
      {activeCell && (
        <div
          style={sx(
            "padding:14px 16px;border-top:1px solid var(--border-subtle);background:var(--surface-subtle);display:flex;flex-direction:column;gap:12px",
          )}
        >
          <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
            <div>
              <div style={sx("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
                <Badge color="primary" variant="solid">
                  <Icon name="pin" size={12} /> {currentFloorLabel} · Kapı No: {activeCell.door}
                </Badge>
                <Badge color="secondary" variant="light">
                  {activeCell.corridor} Koridor
                </Badge>
                {routeMetrics && (
                  <Badge color="primary" variant="light">
                    <Icon name="walk" size={12} /> ~{routeMetrics.meters} m · {routeMetrics.secs} sn yürüyüş
                  </Badge>
                )}
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
              <Button
                size="sm"
                color={startDoor === activeCell.door ? "success" : "secondary"}
                variant={startDoor === activeCell.door ? "solid" : "outline"}
                iconStart="pin"
                onClick={() => {
                  setStartDoor(startDoor === activeCell.door ? null : activeCell.door);
                }}
              >
                {startDoor === activeCell.door
                  ? lang === "tr"
                    ? "Başlangıç Kapısı Seçildi"
                    : "Selected as Start Door"
                  : lang === "tr"
                    ? "Şu An Bu Kapıdayım (Başlangıç Yap)"
                    : "I'm at This Door (Set Start)"}
              </Button>
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
                color="primary"
                variant="outline"
                iconStart="qr"
                onClick={() => setAskTraderOpen(true)}
              >
                {lang === "tr" ? "Esnafa Göster (Tam Ekran)" : "Show to Trader"}
              </Button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  lang === "tr"
                    ? `📍 ${place.name} · ${currentFloorLabel} · Kapı No: ${activeCell.door}${activeCell.record ? ` (${activeCell.record.name})` : ""} konumundayım. Kat planında görmek ve yanıma gelmek için tıkla: https://han.mansis.com.tr/yer/${place.id}?kat=${floor}&kapi=${activeCell.door}`
                    : `📍 I am at ${place.name} · ${currentFloorLabel} · Door No: ${activeCell.door}. Open indoor floor map: https://han.mansis.com.tr/yer/${place.id}?kat=${floor}&kapi=${activeCell.door}`,
                )}`}
                target="_blank"
                rel="noreferrer"
                style={sx("text-decoration:none")}
              >
                <Button size="sm" color="success" variant="outline" iconStart="share">
                  {lang === "tr" ? "Bulunduğum Kapıyı Paylaş" : "Share My Door Location"}
                </Button>
              </a>
            </div>
          </div>

          {/* Interactive Step-by-Step Indoor Wayfinding + Live Walking Mode + Voice Guidance */}
          <div
            style={sx(
              "padding:12px 14px;border-radius:12px;background:var(--surface-card);border:1px solid var(--border-strong);display:flex;flex-direction:column;gap:10px",
            )}
          >
            <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap")}>
              <div style={sx("font-size:12.5px;font-weight:800;color:var(--color-primary);display:flex;align-items:center;gap:6px")}>
                <Icon name="compass" size={16} />
                <span>{lang === "tr" ? "İnteraktif Han İçi Adım Adım Rota:" : "Interactive Turn-by-Turn Indoor Route:"}</span>
                <span style={sx("font-size:11.5px;font-weight:600;color:var(--text-muted)")}>
                  ({startPoint.label} ➔ Kapı No: {activeCell.door})
                </span>
              </div>
              <div style={sx("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
                <Link
                  href={`/tarif/${activeCell.record?.curated || activeCell.record?.id || "roza"}?han=${encodeURIComponent(place.id)}&kat=${floor}&kapi=${encodeURIComponent(activeCell.door)}&ar=1`}
                  style={sx("text-decoration:none")}
                >
                  <Button size="sm" color="accent" variant="solid" iconStart="camera">
                    {lang === "tr" ? "📷 Kamera & Koridor Rehberi" : "📷 Camera & Corridor Guide"}
                  </Button>
                </Link>
                <Button
                  size="sm"
                  color="primary"
                  variant="light"
                  iconStart="walk"
                  onClick={() => setLiveStepIdx(liveStepIdx === null ? 0 : null)}
                >
                  {liveStepIdx !== null
                    ? lang === "tr"
                      ? "Adım Modunu Kapat"
                      : "Exit Step Mode"
                    : lang === "tr"
                      ? "Adım Adım Yürüyüşü Başlat"
                      : "Start Step-by-Step Walk"}
                </Button>
                <Button size="sm" color="secondary" variant="outline" iconStart="volume" onClick={speakDirections}>
                  {lang === "tr" ? "Sesli Tarif" : "Voice Guide"}
                </Button>
              </div>
            </div>

            <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:8px")}>
              {indoorSteps.map((st, idx) => {
                const isCurrentStep = liveStepIdx === idx;
                const isPassedStep = liveStepIdx !== null && idx < liveStepIdx;
                return (
                  <div
                    key={idx}
                    onClick={() => setLiveStepIdx(idx)}
                    style={sx(
                      "padding:10px 12px;border-radius:10px;cursor:pointer;border:1.5px solid " +
                        (isCurrentStep
                          ? "var(--color-accent)"
                          : isPassedStep
                            ? "var(--color-success)"
                            : "var(--border-subtle)") +
                        ";background:" +
                        (isCurrentStep
                          ? "var(--color-accent-soft)"
                          : isPassedStep
                            ? "var(--color-success-soft)"
                            : "var(--surface-muted)"),
                    )}
                  >
                    <div style={sx("font-size:10.5px;font-weight:800;color:var(--color-primary);text-transform:uppercase;letter-spacing:.04em")}>
                      {isPassedStep ? "✓ " : isCurrentStep ? "▶ " : ""}
                      {st.badge}
                    </div>
                    <div style={sx("font-size:13px;font-weight:800;color:var(--text-primary);margin-top:3px")}>
                      {st.title}
                    </div>
                    <div style={sx("font-size:11.5px;color:var(--text-body);margin-top:3px;line-height:1.4")}>
                      {st.detail}
                    </div>
                  </div>
                );
              })}
            </div>

            {liveStepIdx !== null && (
              <div
                style={sx(
                  "display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:8px;border-top:1px solid var(--border-subtle)",
                )}
              >
                <Button
                  size="sm"
                  color="secondary"
                  variant="outline"
                  disabled={liveStepIdx <= 0}
                  onClick={() => setLiveStepIdx(Math.max(0, liveStepIdx - 1))}
                >
                  ◀ {lang === "tr" ? "Önceki Adım" : "Previous Step"}
                </Button>
                <span style={sx("font-size:12px;font-weight:700;color:var(--text-primary)")}>
                  {lang === "tr"
                    ? `Adım ${liveStepIdx + 1} / ${indoorSteps.length}`
                    : `Step ${liveStepIdx + 1} of ${indoorSteps.length}`}
                </span>
                <Button
                  size="sm"
                  color="primary"
                  variant="solid"
                  disabled={liveStepIdx >= indoorSteps.length - 1}
                  onClick={() => setLiveStepIdx(Math.min(indoorSteps.length - 1, liveStepIdx + 1))}
                >
                  {lang === "tr" ? "Sonraki Adım ▶" : "Next Step ▶"}
                </Button>
              </div>
            )}
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
