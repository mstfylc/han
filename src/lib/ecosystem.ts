// HAN — Bazaar Ecosystem Facade (connects Han Management, Merchants, Campaigns & Bazaar Life).
// Purely derived from live authoritative sources (SC.PLACES, SC.RECORDS, D.CAMPAIGNS, AD.mergeContent)
// so there is zero duplicated data or split state.

import * as AD from "@/data/han-admin";
import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import type { Place, ShopRecord } from "@/data/types";

export interface HanFloorSnapshot {
  floor: number;
  label: string;
  occupiedCount: number;
  vacantDoors: string[];
  verifiedCount: number;
  records: ShopRecord[];
}

export interface HanManagementSummary {
  place: Place;
  totalUnits: number;
  recordedCount: number;
  verifiedCount: number;
  pendingCount: number;
  noPhotoCount: number;
  occupancyPct: number;
  vacantTotal: number;
  floors: HanFloorSnapshot[];
}

export function getHanManagementSummary(placeId: string): HanManagementSummary {
  const place = SC.PLACES.find((p) => p.id === placeId) || SC.PLACES[0];
  const all = SC.recordsOfPlace(place.id);
  const verifiedCount = all.filter((r) => r.status === "aktif" || r.status === "onayli").length;
  const pendingCount = all.filter((r) => r.status === "beyan").length;
  const noPhotoCount = all.filter((r) => !r.photos).length;

  const floors: HanFloorSnapshot[] = place.floors.map((fl) => {
    const recs = all
      .filter((r) => r.floor === fl)
      .sort((a, b) => Number(String(a.door).replace(/\D/g, "")) - Number(String(b.door).replace(/\D/g, "")));
    const vacant =
      place.id === "santral"
        ? (SC.SANTRAL_VACANT_DOORS[fl] || []).map(String)
        : [];
    const label =
      place.floorLabels?.[fl] || (fl === 0 ? "Zemin Kat" : fl < 0 ? `Bodrum (${fl})` : `${fl}. Kat`);
    return {
      floor: fl,
      label,
      occupiedCount: recs.length,
      vacantDoors: vacant,
      verifiedCount: recs.filter((r) => r.status === "aktif" || r.status === "onayli").length,
      records: recs,
    };
  });

  const vacantTotal = floors.reduce((sum, f) => sum + f.vacantDoors.length, 0);
  const occupancyPct = place.units > 0 ? Math.min(100, Math.round((all.length / place.units) * 100)) : 0;

  return {
    place,
    totalUnits: place.units,
    recordedCount: all.length,
    verifiedCount,
    pendingCount,
    noPhotoCount,
    occupancyPct,
    vacantTotal,
    floors,
  };
}

export function getActiveCampaigns() {
  return AD.mergeContent(D.CAMPAIGNS || [], "camps");
}

export interface QuickPlanGoal {
  id: "toptan-bijuteri" | "ceyiz-dugun" | "elektronik-saat" | "kultur-kahve";
  icon: string;
  hours: number;
  mode: "toptan" | "perakende";
  title: { tr: string; en: string; ru: string; ar: string };
  sub: { tr: string; en: string; ru: string; ar: string };
  stops: { name: string; qty: string; target?: string; hanHint: string }[];
}

export const QUICK_MOBILE_GOALS: QuickPlanGoal[] = [
  {
    id: "toptan-bijuteri",
    icon: "diamond",
    hours: 3,
    mode: "toptan",
    title: { tr: "Toptan Bijuteri & Çelik Takı Turu", en: "Wholesale Jewelry & Steel Tour", ru: "Оптовый тур: бижутерия", ar: "جولة جملة الإكسسوارات" },
    sub: { tr: "Santral Han A–B Kat + Şark Han toptancıları", en: "Santral Han A–B + Şark Han wholesalers", ru: "Сантрал Хан и Шарк Хан", ar: "سانترال خان وشارق خان" },
    stops: [
      { name: "Roza Bijuteri", qty: "24", target: "75", hanHint: "Santral Han · A Kat No:8" },
      { name: "Yılmaz Bijuteri", qty: "36", target: "60", hanHint: "Santral Han · A Kat No:61" },
      { name: "Emre Aksesuar", qty: "48", target: "45", hanHint: "Şark Han · Zemin" },
    ],
  },
  {
    id: "ceyiz-dugun",
    icon: "heart",
    hours: 4,
    mode: "perakende",
    title: { tr: "Düğün, Çeyiz & Kına Hazırlığı", en: "Wedding, Dowry & Henna Prep", ru: "Свадебный и приданый тур", ar: "تجهيزات الزفاف والجهاز" },
    sub: { tr: "Kürkçü Han tekstil + Büyük Yeni Han gümüş + kutu", en: "Kürkçü Han linens + Büyük Yeni Han silver", ru: "Кюркчю Хан и Бююк Ени Хан", ar: "كوركجو خان وبويوك يني خان" },
    stops: [
      { name: "Bursa Havlu Pazarı", qty: "12", target: "140", hanHint: "Kürkçü Han · Zemin Avlu" },
      { name: "Roza Aksesuar", qty: "10", target: "95", hanHint: "Santral Han · A Kat" },
      { name: "Arif Bey Baharat", qty: "2", target: "280", hanHint: "Mısır Çarşısı" },
    ],
  },
  {
    id: "elektronik-saat",
    icon: "smartphone",
    hours: 2,
    mode: "toptan",
    title: { tr: "Telefon Kılıfı, Şarj & Elektronik", en: "Phone Cases, Chargers & Tech", ru: "Чехлы, зарядки и электроника", ar: "أغطية الهواتف والإلكترونيات" },
    sub: { tr: "Santral Han C–D Kat + Doğubank Sirkeci", en: "Santral Han C–D + Doğubank Sirkeci", ru: "Сантрал Хан C–D + Догубанк", ar: "سانترال خان ودوغوبنك" },
    stops: [
      { name: "Zenta Elektronik", qty: "30", target: "85", hanHint: "Santral Han · C Kat No:367" },
      { name: "Pil Dünyası", qty: "20", target: "110", hanHint: "Santral Han · D Kat No:412" },
      { name: "Emre Aksesuar", qty: "50", target: "40", hanHint: "Tahtakale" },
    ],
  },
  {
    id: "kultur-kahve",
    icon: "compass",
    hours: 3,
    mode: "perakende",
    title: { tr: "Tarihi Hanlar, Avlu Kahvesi & Baharat", en: "Historic Hans, Courtyard Coffee & Spice", ru: "Исторические ханы, кофе и специи", ar: "الخانات التاريخية والقهوة والتوابل" },
    sub: { tr: "Büyük Yeni Han 1764 + Zincirli Han + Mısır Çarşısı", en: "Büyük Yeni Han + Zincirli Han + Spice Bazaar", ru: "Бююк Ени Хан + Египетский базар", ar: "بويوك يني خان وسوق التوابل" },
    stops: [
      { name: "Arif Bey Baharat", qty: "1", hanHint: "Mısır Çarşısı · Baharat" },
      { name: "Avlu Gümüş Atölyesi", qty: "1", hanHint: "Büyük Yeni Han · Avlu" },
      { name: "Anadolu Halı", qty: "1", hanHint: "Zincirli Han · Kapalıçarşı" },
    ],
  },
];
