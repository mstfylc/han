"use client";

// HAN — Çarşı Yaşam Rehberi (/yasam): historic courtyards, coffee breaks, bazaar etiquette & essentials.

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import type { Lang } from "@/data/types";
import { Button, Icon } from "@/ds";
import { ImageSlot } from "@/components/ImageSlot";
import { loc, tx } from "@/lib/i18n";
import { pagePad } from "@/lib/layout";
import { href } from "@/lib/routes";
import { medStyle } from "@/lib/shop";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

const HISTORIC_COURTYARDS = [
  {
    id: "buyukyeni",
    year: "1764",
    photo: "/assets/editorial-avlu.jpg",
    title: { tr: "Büyük Yeni Han — Çift Avlulu Taş Galeri", en: "Büyük Yeni Han — Twin Stone Courtyards", ru: "Бююк Ени Хан (1764)", ar: "بويوك يني خان (١٧٦٤)" },
    desc: { tr: "Sultan III. Mustafa dönemi anıtsal hanı. Taş revaklar altında gümüş atölyeleri, dokuma ve sakin avlu molası.", en: "Monumental 1764 Ottoman han with silver workshops, heritage textiles, and peaceful stone colonnades.", ru: "Монументальный османский хан с мастерскими серебра и тихим двориком.", ar: "خان عثماني تاريخي يضم ورش الفضة والأفنية الهادئة." },
  },
  {
    id: "kurkcu",
    year: "1467",
    photo: "/assets/editorial-tekstil.jpg",
    title: { tr: "Kürkçü Han — İstanbul'un En Eski Hanı", en: "Kürkçü Han — Istanbul's Oldest Surviving Han", ru: "Кюркчю Хан (1467)", ar: "كوركجو خان (١٤٦٧)" },
    desc: { tr: "Fatih Sultan Mehmet dönemi sadrazamı Mahmud Paşa vakfı. Bugün çeyiz, havlu ve pamuklu tekstil merkezi.", en: "Commissioned in 1467 under Mehmed II; today the hub of organic cotton towels and bridal linens.", ru: "Старейший хан Стамбула, центр текстиля и полотенец.", ar: "أقدم خان في إسطنبول ومركز المنسوجات والمناشف." },
  },
  {
    id: "zincirli",
    year: "18. yy",
    photo: "/assets/editorial-han.jpg",
    title: { tr: "Zincirli Han — Şadırvanlı Kuyum & Halı Avlusu", en: "Zincirli Han — Fountain Courtyard of Carpets & Jewelry", ru: "Зинджирли Хан", ar: "زنجيرلي خان" },
    desc: { tr: "Kapalıçarşı'nın hemen içinde nefes aldıran iki katlı avlusu, el dokuma halı galerileri ve sadekâr atölyeleri.", en: "A sunlit two-story sanctuary inside the Grand Bazaar famed for heirloom carpets and goldsmiths.", ru: "Двухэтажный двор внутри Гранд-базара: ковры и ювелирные мастера.", ar: "فناء هادئ داخل السوق المسقوف للسجاد والمجوهرات." },
  },
];

export default function BazaarLifePage() {
  const { state } = useApp();
  const router = useRouter();
  const { lang } = state;

  const breakSpots = useMemo(
    () => SC.SERVICE_POIS.filter((p) => p.kind === "mola" || p.kind === "wc" || p.kind === "atm"),
    [],
  );

  return (
    <div style={sx("max-width:1480px;margin:0 auto;" + pagePad(state.vw))}>
      {/* Editorial Hero */}
      <section
        style={sx(
          "position:relative;overflow:hidden;border-radius:var(--radius-card, 16px);padding:28px 30px;background:var(--surface-brand, #14233f);background-image:linear-gradient(125deg, rgba(16,28,50,.90) 0%, rgba(16,28,50,.76) 58%, rgba(16,28,50,.58) 100%), url('/assets/editorial-avlu.jpg');background-size:cover;background-position:center;box-shadow:var(--shadow-float, 0 8px 24px rgba(0,0,0,.10))",
        )}
      >
        <div style={sx("font-size:11.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--color-accent)")}>
          {pk({ tr: "ÇARŞI YAŞAM & KÜLTÜR REHBERİ", en: "BAZAAR LIFE & CULTURE GUIDE", ru: "ЖИЗНЬ И КУЛЬТУРА БАЗАРА", ar: "دليل الحياة والثقافة في السوق" }, lang)}
        </div>
        <h1 style={sx("font-size:clamp(24px, 3vw, 34px);font-weight:800;color:#fff;margin:8px 0 0;letter-spacing:-.02em")}>
          {pk({ tr: "Tarihi Avlular, Kahve Molaları ve Çarşı Adabı", en: "Historic Courtyards, Coffee Breaks & Bazaar Etiquette", ru: "Исторические дворики, кофе и этикет базара", ar: "الأفنية التاريخية واستراحات القهوة وآداب السوق" }, lang)}
        </h1>
        <p style={sx("font-size:14.5px;color:rgba(255,255,255,.84);margin:8px 0 0;max-width:62ch;line-height:1.5")}>
          {pk({
            tr: "Alışveriş arasında 500 yıllık taş avlularda soluklanın, düz ayak yürüyüş ipuçlarını görün ve çarşının yaşayan ritmini keşfedin.",
            en: "Pause between stops in 500-year-old stone courtyards, follow flat-walk tips, and experience the living rhythm of the bazaar.",
            ru: "Отдохните между покупками в старинных каменных дворах и узнайте живой ритм базара.",
            ar: "استرح بين المتاجر في أفنية عثمانية عريقة واكتشف إيقاع السوق الحي.",
          }, lang)}
        </p>
        <div style={sx("display:flex;gap:8px;flex-wrap:wrap;margin-top:16px")}>
          <Button color="accent" size="md" onClick={() => router.push("/harita?poi=mola")}>
            {pk({ tr: "☕ Kahve & Mola Noktalarını Haritada Gör", en: "☕ Open Coffee Breaks on Map" }, lang)}
          </Button>
          <Button variant="outline" color="secondary" size="md" onClick={() => router.push("/etkinlik")}>
            {pk({ tr: "📅 Bu Haftaki Etkinlikler", en: "📅 Events This Week" }, lang)}
          </Button>
        </div>
      </section>

      {/* Historic Courtyards */}
      <section style={sx("margin-top:26px")}>
        <h2 style={sx("font-size:21px;font-weight:800;color:var(--text-heading);margin:0")}>
          {pk({ tr: "Mutlaka Görülmesi Gereken Tarihi Avlular", en: "Must-Visit Historic Courtyards", ru: "Главные исторические дворы", ar: "أهم الأفنية التاريخية" }, lang)}
        </h2>
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:16px;margin-top:14px")}>
          {HISTORIC_COURTYARDS.map((h) => (
            <article
              key={h.id}
              className="han-card-lift"
              style={sx("border-radius:var(--radius-card, 16px);border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:var(--shadow-card);overflow:hidden;display:flex;flex-direction:column")}
            >
              <div style={sx("position:relative;height:176px;background:var(--surface-muted)")}>
                <ImageSlot src={h.photo} placeholder={tx(h.title, lang)} decorative />
                <span style={sx("position:absolute;top:12px;inset-inline-start:12px;padding:3px 10px;border-radius:999px;background:var(--color-primary);color:#fff;font-size:12px;font-weight:800")}>
                  🏛️ {h.year}
                </span>
              </div>
              <div style={sx("padding:16px 18px;display:flex;flex-direction:column;gap:8px;flex:1")}>
                <h3 style={sx("font-size:16.5px;font-weight:800;color:var(--text-heading);margin:0")}>{tx(h.title, lang)}</h3>
                <p style={sx("font-size:13.5px;color:var(--text-muted);margin:0;line-height:1.5")}>{tx(h.desc, lang)}</p>
                <div style={sx("margin-top:auto;padding-top:8px;display:flex;gap:8px;flex-wrap:wrap")}>
                  <Button color="primary" size="sm" iconStart="floor-layer" onClick={() => router.push(href.place(h.id))}>
                    {pk({ tr: "Kat Planı & Rehber", en: "Floor Plan & Guide" }, lang)}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Field Breaks & Essentials */}
      <section style={sx("margin-top:28px")}>
        <div style={sx("display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
          <div>
            <h2 style={sx("font-size:21px;font-weight:800;color:var(--text-heading);margin:0")}>
              {pk({ tr: "Mola, Kahve, WC & ATM Noktaları", en: "Coffee Breaks, WC & ATM Stops", ru: "Кофе, WC и банкоматы", ar: "نقاط الاستراحة والمقاهي والصرافات" }, lang)}
            </h2>
            <p style={sx("font-size:13.5px;color:var(--text-muted);margin:4px 0 0")}>
              {pk({ tr: "Tek dokunuşla Google Haritalar yürüyüş tarifi açılır.", en: "One tap opens walking directions in Google Maps." }, lang)}
            </p>
          </div>
          <Button variant="outline" color="primary" size="sm" onClick={() => router.push("/harita?poi=all")}>
            {pk({ tr: "Tümünü Haritada Gör ↗", en: "View All on Map ↗" }, lang)}
          </Button>
        </div>

        <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(270px,100%),1fr));gap:12px;margin-top:14px")}>
          {breakSpots.slice(0, 8).map((poi) => (
            <div
              key={poi.id}
              style={sx("padding:14px 16px;border-radius:var(--radius-card, 16px);border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:var(--shadow-card);display:flex;flex-direction:column;gap:6px")}
            >
              <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:8px")}>
                <span style={sx("font-size:14px;font-weight:800;color:var(--text-heading)")}>{tx(poi.title, lang)}</span>
                <span style={sx("font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--surface-muted);color:var(--text-muted)")}>
                  {poi.hours}
                </span>
              </div>
              <div style={sx("font-size:12.5px;font-weight:700;color:var(--color-primary)")}>📍 {tx(poi.sub, lang)}</div>
              <div style={sx("font-size:12.5px;color:var(--text-body);line-height:1.45")}>{tx(poi.tip, lang)}</div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}&travelmode=walking`}
                target="_blank"
                rel="noreferrer"
                style={sx("margin-top:4px;font-size:12px;font-weight:700;color:var(--color-accent);text-decoration:none")}
              >
                🌍 {pk({ tr: "Google Haritalar ile Yürü ↗", en: "Walk with Google Maps ↗" }, lang)}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Bazaar Etiquette (from D.KNOW) */}
      <section style={sx("margin-top:28px")}>
        <h2 style={sx("font-size:21px;font-weight:800;color:var(--text-heading);margin:0")}>
          {pk({ tr: "Çarşıda Bilmeniz Gerekenler", en: "Bazaar Etiquette & Local Tips", ru: "Полезно знать на базаре", ar: "نصائح وآداب السوق" }, lang)}
        </h2>
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr));gap:14px;margin-top:14px")}>
          {(D.KNOW || []).map((k, idx) => (
            <div
              key={idx}
              style={sx("border-radius:var(--radius-card, 16px);border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:var(--shadow-card);padding:18px")}
            >
              <div style={sx("display:flex;align-items:center;gap:10px")}>
                <span style={sx(medStyle(String(k.tone || "primary"), 36))}>
                  <Icon name={String(k.icon || "compass")} size={18} />
                </span>
                <div style={sx("font-size:15px;font-weight:800;color:var(--text-heading)")}>{tx(k, lang)}</div>
              </div>
              <p style={sx("font-size:13.5px;color:var(--text-body);margin:10px 0 0;line-height:1.5")}>{loc(k, "body", lang)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
