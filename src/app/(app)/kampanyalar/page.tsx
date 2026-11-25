"use client";

// HAN — Kampanyalar (/kampanyalar): live bazaar campaigns, wholesale & retail deals.
// Consumes AD.mergeContent(D.CAMPAIGNS, "camps") + 2026 unified design tokens.

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import * as D from "@/data/han-data";
import * as L from "@/data/han-logic";
import type { Lang } from "@/data/types";
import { Button, EmptyState, Icon } from "@/ds";
import { ImageSlot } from "@/components/ImageSlot";
import { getActiveCampaigns } from "@/lib/ecosystem";
import { loc, tx } from "@/lib/i18n";
import { pagePad } from "@/lib/layout";
import { href } from "@/lib/routes";
import { storePhoto } from "@/lib/shop";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

export default function CampaignsPage() {
  const { state, save, toast } = useApp();
  const router = useRouter();
  const { lang } = state;
  const [areaFilter, setAreaFilter] = useState<string>("all");

  const items = useMemo(() => {
    const all = getActiveCampaigns();
    return all
      .filter((c) => areaFilter === "all" || c.area === areaFilter)
      .map((c) => {
        const st = c.store ? D.STORES.find((s) => s.id === c.store) : null;
        const area = D.AREAS.find((a) => a.id === c.area);
        const tone = String(c.tone || "primary");
        return {
          id: String(c.id),
          title: tx(c, lang),
          sub: loc(c, "sub", lang),
          tag: loc(c, "tag", lang),
          until: loc(c, "until", lang),
          areaId: String(c.area || ""),
          areaName: area ? tx(area, lang) : "",
          storeId: st ? String(st.id) : null,
          storeName: st ? String(st.name) : null,
          photo: st ? storePhoto(st) : "/assets/editorial-bijuteri.jpg",
          tone,
        };
      });
  }, [areaFilter, lang]);

  const addDealToPlan = (title: string) => {
    const next = (state.buyList || []).concat([{ id: "cmp_" + Date.now(), name: title, qty: "1", target: "" }]);
    save({ buyList: next });
    toast(pk({ tr: "Kampanya gün planına eklendi", en: "Campaign added to your day plan", ru: "Акция добавлена в план", ar: "تمت إضافة العرض إلى خطتك" }, lang));
  };

  return (
    <div style={sx("max-width:1480px;margin:0 auto;" + pagePad(state.vw))}>
      {/* Editorial Hero */}
      <section
        style={sx(
          "position:relative;overflow:hidden;border-radius:var(--radius-card, 16px);padding:26px 28px;background:var(--surface-brand, #14233f);background-image:linear-gradient(125deg, rgba(16,28,50,.92) 0%, rgba(16,28,50,.78) 60%, rgba(16,28,50,.64) 100%), url('/assets/editorial-bijuteri.jpg');background-size:cover;background-position:center;box-shadow:var(--shadow-float, 0 8px 24px rgba(0,0,0,.10))",
        )}
      >
        <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap")}>
          <div>
            <div style={sx("font-size:11.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--color-accent)")}>
              {pk({ tr: "TARİHİ YARIMADA · CANLI FIRSATLAR", en: "HISTORIC PENINSULA · LIVE DEALS", ru: "ИСТОРИЧЕСКИЙ ПОЛУОСТРОВ · АКЦИИ", ar: "شبه الجزيرة التاريخية · عروض حية" }, lang)}
            </div>
            <h1 style={sx("font-size:clamp(24px, 3vw, 34px);font-weight:800;color:#fff;margin:8px 0 0;letter-spacing:-.02em")}>
              {pk({ tr: "Bu Hafta Çarşıda Kampanyalar", en: "Bazaar Campaigns This Week", ru: "Акции и скидки на базаре", ar: "عروض وحملات السوق هذا الأسبوع" }, lang)}
            </h1>
            <p style={sx("font-size:14.5px;color:rgba(255,255,255,.82);margin:8px 0 0;max-width:60ch;line-height:1.5")}>
              {pk({
                tr: "Toptan koli avantajları, sezon sonu indirimleri ve esnafın doğrudan açtığı süreli kampanyalar — yönetim panelinden onaylı.",
                en: "Wholesale carton deals, seasonal clearances, and merchant-published limited offers — verified via the admin panel.",
                ru: "Оптовые предложения, сезонные скидки и акции напрямую от лавок.",
                ar: "عروض الجملة وتخفيضات الموسم مباشرة من التجار.",
              }, lang)}
            </p>
          </div>
          <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
            <Button color="accent" size="md" onClick={() => router.push("/plan")}>
              {pk({ tr: "Rotamı Aç", en: "Open My Route", ru: "Мой маршрут", ar: "افتح مساري" }, lang)}
            </Button>
            <Button variant="outline" color="secondary" size="md" onClick={() => router.push("/esnaf")}>
              {pk({ tr: "Esnaf Kampanya Yayınla", en: "Post Merchant Deal", ru: "Разместить акцию", ar: "نشر عرض تاجر" }, lang)}
            </Button>
          </div>
        </div>
      </section>

      {/* Semt Filter Bar */}
      <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:18px")}>
        <button
          type="button"
          onClick={() => setAreaFilter("all")}
          style={sx(
            "height:34px;padding:0 14px;border-radius:var(--radius-pill, 999px);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:1px solid " +
              (areaFilter === "all"
                ? "var(--color-primary);background:var(--color-primary);color:#fff"
                : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
          )}
        >
          {pk({ tr: "Tüm Semtler", en: "All Areas", ru: "Все районы", ar: "كل المناطق" }, lang)}
        </button>
        {D.AREAS.map((a) => {
          const on = areaFilter === a.id;
          return (
            <button
              key={String(a.id)}
              type="button"
              onClick={() => setAreaFilter(String(a.id))}
              style={sx(
                "height:34px;padding:0 14px;border-radius:var(--radius-pill, 999px);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:1px solid " +
                  (on
                    ? "var(--color-primary);background:var(--color-primary);color:#fff"
                    : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
              )}
            >
              {tx(a, lang)}
            </button>
          );
        })}
      </div>

      {/* Campaign Cards */}
      {items.length === 0 ? (
        <div style={sx("margin-top:20px")}>
          <EmptyState
            icon="star"
            tone="neutral"
            title={pk({ tr: "Bu semtte aktif kampanya yok", en: "No active campaigns in this area", ru: "Нет акций в этом районе", ar: "لا توجد عروض في هذه المنطقة" }, lang)}
            description={pk({ tr: "Tüm semtleri seçerek çarşı genelindeki fırsatları görebilirsiniz.", en: "Select all areas to view bazaar-wide offers.", ru: "Выберите все районы.", ar: "اختر كل المناطق." }, lang)}
            actions={<Button color="primary" size="sm" onClick={() => setAreaFilter("all")}>{pk({ tr: "Tümünü Göster", en: "Show All", ru: "Показать все", ar: "عرض الكل" }, lang)}</Button>}
          />
        </div>
      ) : (
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(310px,100%),1fr));gap:16px;margin-top:18px")}>
          {items.map((c) => (
            <article
              key={c.id}
              className="han-card-lift"
              style={sx(
                "display:flex;flex-direction:column;border-radius:var(--radius-card, 16px);border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:var(--shadow-card, 0 2px 8px rgba(0,0,0,.04));overflow:hidden",
              )}
            >
              <div style={sx("position:relative;height:168px;background:var(--surface-muted)")}>
                <ImageSlot src={c.photo} placeholder={c.title} decorative />
                <span
                  style={sx(
                    "position:absolute;top:12px;inset-inline-start:12px;display:inline-flex;align-items:center;height:26px;padding:0 11px;border-radius:var(--radius-pill, 999px);font-size:12px;font-weight:800;background:var(--color-" +
                      c.tone + ");color:#fff",
                  )}
                >
                  {c.tag}
                </span>
                {c.areaName && (
                  <span
                    style={sx(
                      "position:absolute;bottom:10px;inset-inline-end:10px;padding:3px 9px;border-radius:var(--radius-pill, 999px);font-size:11.5px;font-weight:700;background:var(--surface-glass, var(--surface-card));backdrop-filter:blur(10px);color:var(--text-heading)",
                    )}
                  >
                    📍 {c.areaName}
                  </span>
                )}
              </div>

              <div style={sx("padding:16px 18px;display:flex;flex-direction:column;gap:8px;flex:1")}>
                <h2 style={sx("font-size:17px;font-weight:800;color:var(--text-heading);margin:0;line-height:1.3")}>
                  {c.title}
                </h2>
                <p style={sx("font-size:13.5px;color:var(--text-muted);margin:0;line-height:1.45")}>
                  {c.sub}
                </p>
                <div style={sx("display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:var(--color-primary);margin-top:auto;padding-top:6px")}>
                  <Icon name="time" size={14} />
                  <span>{c.until}</span>
                </div>
                <div style={sx("display:flex;gap:8px;flex-wrap:wrap;margin-top:6px")}>
                  <Button
                    color="primary"
                    size="sm"
                    onClick={() =>
                      c.storeId
                        ? router.push(href.store(c.storeId))
                        : router.push(
                            href.search(
                              tx(
                                D.CATS.find((k) =>
                                  D.STORES.some((s) => L.areaOf(D, s) === c.areaId && (s.cats || []).includes(String(k.id))),
                                ) || D.CATS[0],
                                lang,
                              ),
                            ),
                          )
                    }
                  >
                    {c.storeName
                      ? pk({ tr: `${c.storeName} Vitrinine Git`, en: `Open ${c.storeName}` }, lang)
                      : pk({ tr: "Bölgedeki Dükkânları Gör", en: "Browse Area Shops" }, lang)}
                  </Button>
                  <Button
                    variant="outline"
                    color="accent"
                    size="sm"
                    onClick={() => addDealToPlan(c.storeName || c.title)}
                  >
                    {pk({ tr: "+ Rotaya Ekle", en: "+ Add to Plan" }, lang)}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
