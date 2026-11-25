// HAN — Universal Intent Router (maps natural user goals/queries directly to the right surface).
// Used on Discover, Mobile PWA, and quick search prompts so visitors reach the exact action in 1 tap.

import type { Lang } from "@/data/types";

export interface ResolvedIntent {
  kind: "search" | "map" | "plan" | "campaigns" | "life" | "han-admin" | "tools" | "trader" | "mobile";
  href: string;
  label: { tr: string; en: string; ru: string; ar: string };
  badge: { tr: string; en: string; ru: string; ar: string };
  icon: string;
}

export function resolveUniversalIntent(rawQuery: string): ResolvedIntent {
  const q = String(rawQuery || "").trim();
  const low = q.toLocaleLowerCase("tr");

  if (/(wc|tuvalet|mescit|eczane|otopark|ispark|atm|tramvay|metro|otobüs|park)/.test(low)) {
    const poi = /eczane/.test(low)
      ? "eczane"
      : /(wc|tuvalet|mescit)/.test(low)
        ? "wc"
        : /(atm)/.test(low)
          ? "atm"
          : /(otopark|ispark|tramvay|metro|park)/.test(low)
            ? "ulasim"
            : "all";
    return {
      kind: "map",
      href: `/harita?poi=${poi}`,
      label: { tr: "Haritada İhtiyaç Noktalarını Aç", en: "Open Field Essentials on Map", ru: "Открыть точки на карте", ar: "افتح النقاط على الخريطة" },
      badge: { tr: "Canlı Harita", en: "Live Map", ru: "Карта", ar: "خريطة" },
      icon: "map",
    };
  }

  if (/(kampanya|indirim|fırsat|firsat|outlet|sezon|toptan fırsat)/.test(low)) {
    return {
      kind: "campaigns",
      href: "/kampanyalar",
      label: { tr: "Bu Haftaki Çarşı Kampanyaları", en: "This Week's Bazaar Campaigns", ru: "Акции базара на этой неделе", ar: "عروض السوق هذا الأسبوع" },
      badge: { tr: "Fırsatlar", en: "Deals", ru: "Акции", ar: "عروض" },
      icon: "star",
    };
  }

  if (/(kahve|çay|cay|yemek|lokanta|mola|avlu|kültür|kultur|gezi|fotoğraf)/.test(low)) {
    return {
      kind: "life",
      href: "/yasam",
      label: { tr: "Çarşı Yaşam & Avlu Rehberi", en: "Bazaar Life & Courtyard Guide", ru: "Жизнь и дворики базара", ar: "الحياة والأفنية في السوق" },
      badge: { tr: "Yaşam", en: "Life", ru: "Гид", ar: "دليل" },
      icon: "compass",
    };
  }

  if (/(döviz|doviz|dolar|euro|kur|usd|eur|tax.?free|kargo|nakliye|acil)/.test(low)) {
    const tool = /(tax.?free)/.test(low)
      ? "taxfree"
      : /(kargo|nakliye)/.test(low)
        ? "lojistik"
        : /(acil)/.test(low)
          ? "acil"
          : "doviz";
    return {
      kind: "tools",
      href: `/arac/${tool}`,
      label: { tr: "Canlı TCMB Kur & Çarşı Araçları", en: "Live FX & Bazaar Tools", ru: "Курс валют и инструменты", ar: "أسعار الصرف والأدوات" },
      badge: { tr: "Araçlar", en: "Tools", ru: "Инструменты", ar: "أدوات" },
      icon: "chart-line-up",
    };
  }

  if (/(han yönetimi|han yonetimi|kiracı listesi|kiraci|boş dükkan|bos dukkan|aidat|yönetici)/.test(low)) {
    return {
      kind: "han-admin",
      href: "/han-yonetimi",
      label: { tr: "Han Yönetimi & Kiracı Portalı", en: "Han Management Portal", ru: "Управление ханом", ar: "إدارة الخان" },
      badge: { tr: "Yönetim", en: "Management", ru: "Управление", ar: "إدارة" },
      icon: "building",
    };
  }

  if (/(düğün|dugun|çeyiz|ceyiz|nişan|nisan|mevlüt|mevlut|rota|plan|saatim var)/.test(low)) {
    return {
      kind: "plan",
      href: "/plan",
      label: { tr: "Akıllı Gün & Rota Planlayıcı", en: "Smart Day & Route Planner", ru: "Планировщик маршрута", ar: "مخطط المسار اليومي" },
      badge: { tr: "Rota", en: "Route", ru: "Маршрут", ar: "مسار" },
      icon: "route",
    };
  }

  if (/(uygulama|indir|pwa|telefon|çevrimdışı|cevrimdisi)/.test(low)) {
    return {
      kind: "mobile",
      href: "/mobil",
      label: { tr: "Mobil PWA & Çevrimdışı Rehber", en: "Mobile PWA & Offline Guide", ru: "Мобильное PWA", ar: "تطبيق الجوال" },
      badge: { tr: "PWA", en: "PWA", ru: "PWA", ar: "PWA" },
      icon: "smartphone",
    };
  }

  return {
    kind: "search",
    href: q ? `/ara?q=${encodeURIComponent(q)}` : "/ara",
    label: { tr: "Gerçek Kapı & Esnaf Ara", en: "Search Verified Shops & Doors", ru: "Поиск лавок и дверей", ar: "ابحث عن المتاجر والأبواب" },
    badge: { tr: "Arama", en: "Search", ru: "Поиск", ar: "بحث" },
    icon: "magnifier",
  };
}

export function pickIntentText(obj: { tr: string; en: string; ru: string; ar: string }, lang: Lang): string {
  return obj[lang] || obj.tr;
}
