"use client";

// M2 · the product layer.
//
// Everything else in this app is shop-centred, and that is the wrong shape for
// a wholesale buyer: they are looking for "transparent silicone case", not for
// a shop. So a product page answers three questions the shop list cannot —
// who sells it, what does it cost, and where does a quote land in that range.
//
// There is no product table. Products are derived from the shops' own variety
// groups; inventing a catalogue we do not have would be fiction.

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import type { Lang } from "@/data/types";
import { Button, EmptyState } from "@/ds";
import { F, W } from "@/lib/copy";
import { convert, num, tonePair, tx } from "@/lib/i18n";
import { href } from "@/lib/routes";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

const CARD =
  "background:var(--surface-card);border:1px solid var(--border-default);border-radius:14px;padding:18px 20px;box-shadow:0 3px 4px rgba(0,0,0,.03)";
const KICKER = "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)";

const toneChip = (t: string) => {
  const p = tonePair(t);
  return "display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:5px;font-size:11px;font-weight:700;background:" + p.bg + ";color:" + p.fg;
};

export default function ProductPage() {
  const { state, save, toast } = useApp();
  const router = useRouter();
  const params = useParams<{ cat: string; slug?: string[] }>();
  const { lang, mode, currency } = state;

  const catId = decodeURIComponent(String(params.cat || ""));
  const slug = params.slug?.[0] ? decodeURIComponent(params.slug[0]) : null;
  const [sort, setSort] = useState<"onerilen" | "ucuz" | "moq">("onerilen");
  const [limit, setLimit] = useState(12);

  const cat = [...(D.CATS || []), ...SC.CATS_EXTRA].find((c) => c.id === catId);
  const catName = cat ? tx(cat, lang) : catId;
  // Prices on this page are shown in the reader's currency: it is a comparison
  // view, and comparison is what the conversion is for.
  const price = (n: number | null | undefined) => (n == null ? "—" : convert(n, lang, currency) || ("₺" + num(n, lang)));

  const list = useMemo(() => SE.productsIn(catId, { mode }), [catId, mode]);
  const detail = useMemo(() => (slug ? SE.productDetail(catId, slug, { mode }) : null), [catId, slug, mode]);

  if (!cat) {
    return (
      <div style={sx("max-width:1480px;margin:0 auto;padding:26px 24px 48px")}>
        <EmptyState
          icon="magnifier"
          tone="neutral"
          title={pk({ tr: "Bu kategori yok", en: "No such category", ru: "Такой категории нет", ar: "لا توجد هذه الفئة" }, lang)}
          description={pk({ tr: "Kategori listesinden devam edin.", en: "Continue from the category list.", ru: "Продолжите из списка категорий.", ar: "تابع من قائمة الفئات." }, lang)}
          actions={<Button color="primary" onClick={() => router.push(href.category())}>{W(lang, "allCats")}</Button>}
        />
      </div>
    );
  }

  const back = (
    <button
      type="button"
      onClick={() => router.push(slug ? href.product(catId) : href.category())}
      style={sx("background:none;border:none;padding:0;font-family:inherit;font-size:13px;font-weight:600;color:var(--color-primary);cursor:pointer")}
    >
      {slug
        ? "← " + catName
        : pk({ tr: "← Kategoriler", en: "← Categories", ru: "← Категории", ar: "← الفئات" }, lang)}
    </button>
  );

  // ── category list ───────────────────────────────────────────────────────
  if (!slug || !detail) {
    return (
      <div style={sx("max-width:1100px;margin:0 auto;padding:22px 24px 48px")}>
        {back}
        <h1 style={sx("font-size:26px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:12px 0 0")}>
          {pk({ tr: catName + " · ürünler", en: catName + " · products", ru: catName + " · товары", ar: catName + " · المنتجات" }, lang)}
        </h1>
        <p style={sx("font-size:14.5px;color:var(--text-muted);margin-top:6px;max-width:68ch;text-wrap:pretty")}>
          {pk({
            tr: "Bu kategoride aranan çeşitler. Her ürün için kaç dükkânın sattığını ve fiyatın nereye düştüğünü görün — dükkân dükkân gezmeden.",
            en: "The lines traded in this category. For each one: how many shops carry it and where the price lands — without walking shop to shop.",
            ru: "Товары этой категории: сколько лавок продаёт и какова цена.",
            ar: "أصناف هذه الفئة: كم متجرًا يبيعها وأين يقع السعر.",
          }, lang)}
        </p>

        {list.length === 0 ? (
          <div style={sx("margin-top:18px")}>
            <EmptyState
              icon="files"
              tone="neutral"
              title={pk({ tr: "Bu kategoride henüz çeşit girilmemiş", en: "No lines recorded in this category yet", ru: "В этой категории пока нет позиций", ar: "لا أصناف مسجلة بعد" }, lang)}
              description={pk({
                tr: "Kayıtlar doldukça burası kendiliğinden dolar. Şimdilik talep bırakabilirsiniz.",
                en: "This fills in as records get filled in. In the meantime you can leave a request.",
                ru: "Раздел заполнится по мере записей. Пока можно оставить заявку.",
                ar: "يمتلئ هذا مع امتلاء السجلات. يمكنك ترك طلب الآن.",
              }, lang)}
              actions={<Button color="accent" onClick={() => router.push(href.work("talep"))}>{F(lang, "leaveReq")}</Button>}
            />
          </div>
        ) : (
          <div style={sx("display:flex;flex-direction:column;gap:10px;margin-top:18px")}>
            {list.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => router.push(href.product(catId, p.slug))}
                style={sx("display:flex;align-items:center;gap:16px;width:100%;text-align:start;font-family:inherit;cursor:pointer;" + CARD)}
              >
                <span style={sx("flex:1;min-width:0")}>
                  <span style={sx("display:block;font-size:16px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>{p.name}</span>
                  <span style={sx("display:block;font-size:13px;color:var(--text-muted);margin-top:3px")}>
                    {pk({
                      tr: p.shops + " dükkân satıyor · " + num(p.lines, lang) + " çeşit",
                      en: p.shops + " shops carry it · " + num(p.lines, lang) + " lines",
                      ru: p.shops + " лавок · " + num(p.lines, lang) + " позиций",
                      ar: p.shops + " متجرًا · " + num(p.lines, lang) + " صنفًا",
                    }, lang)}
                  </span>
                </span>
                <span style={sx("flex:none;text-align:end")}>
                  <span style={sx("display:block;font-size:15px;font-weight:700;color:var(--color-primary)")}>
                    {p.band ? price(p.band[0]) + " – " + price(p.band[1]) : pk({ tr: "Fiyat yok", en: "No price", ru: "Нет цены", ar: "لا سعر" }, lang)}
                  </span>
                  {p.band && (
                    <span style={sx("display:block;font-size:11.5px;color:var(--text-muted)")}>
                      {pk({ tr: "arası", en: "range", ru: "диапазон", ar: "المدى" }, lang)}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── one product ─────────────────────────────────────────────────────────
  const sorters = {
    onerilen: (a: typeof detail.shops[0], b: typeof detail.shops[0]) => b.score - a.score,
    ucuz: (a: typeof detail.shops[0], b: typeof detail.shops[0]) => (a.lo || Infinity) - (b.lo || Infinity),
    moq: (a: typeof detail.shops[0], b: typeof detail.shops[0]) => (a.moq || 1) - (b.moq || 1),
  };
  const shops = detail.shops.slice().sort(sorters[sort]);
  const shown = shops.slice(0, limit);
  const spread = detail.spread;
  // Where the median sits in the range. With a single price there is no spread
  // to draw, and drawing one anyway would imply a distribution we do not have.
  const pct = spread && spread.hi > spread.lo ? Math.round(((spread.mid || spread.lo) - spread.lo) / (spread.hi - spread.lo) * 100) : 50;

  const facts: [string, string][] = [
    [String(detail.shops.length), pk({ tr: "satan dükkân", en: "shops", ru: "лавок", ar: "متجرًا" }, lang)],
    [detail.minMoq === Infinity ? "—" : String(detail.minMoq), pk({ tr: "en düşük adet", en: "lowest MOQ", ru: "мин. партия", ar: "أقل كمية" }, lang)],
    [String(detail.producers), pk({ tr: "imalatçı", en: "producers", ru: "производителей", ar: "مصنّع" }, lang)],
    [String(detail.exporters), pk({ tr: "yurt dışına gönderiyor", en: "ship abroad", ru: "шлют за рубеж", ar: "يشحن للخارج" }, lang)],
  ];

  return (
    <div style={sx("max-width:1100px;margin:0 auto;padding:22px 24px 48px")}>
      {back}
      <h1 style={sx("font-size:30px;font-weight:700;color:var(--text-heading);letter-spacing:-.025em;margin:12px 0 0;line-height:1.15")}>
        {detail.name}
      </h1>
      <p style={sx("font-size:14.5px;color:var(--text-muted);margin-top:5px")}>
        {pk({
          tr: catName + " · " + detail.shops.length + " dükkân satıyor",
          en: catName + " · carried by " + detail.shops.length + " shops",
          ru: catName + " · " + detail.shops.length + " лавок",
          ar: catName + " · " + detail.shops.length + " متجرًا",
        }, lang)}
      </p>

      {/* ── price range ────────────────────────────────────────────────── */}
      <section style={sx(CARD + ";margin-top:18px")}>
        <div style={sx(KICKER)}>{pk({ tr: "Fiyat aralığı", en: "Price range", ru: "Диапазон цен", ar: "نطاق السعر" }, lang)}</div>
        <div style={sx("display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:6px")}>
          <div style={sx("font-size:24px;font-weight:700;color:var(--color-primary);letter-spacing:-.02em")}>
            {detail.band ? price(detail.band[0]) + " – " + price(detail.band[1]) : pk({ tr: "Fiyat beyan edilmemiş", en: "No declared price", ru: "Цена не указана", ar: "لا سعر معلن" }, lang)}
          </div>
          <div style={sx("font-size:13px;color:var(--text-muted)")}>
            {mode === "toptan"
              ? pk({ tr: "toptan · adet başı", en: "wholesale · per unit", ru: "опт · за шт.", ar: "جملة · للوحدة" }, lang)
              : pk({ tr: "perakende · adet başı", en: "retail · per unit", ru: "розница · за шт.", ar: "تجزئة · للوحدة" }, lang)}
          </div>
        </div>

        {spread && (
          <div style={sx("margin-top:14px")}>
            <div style={sx("position:relative;height:8px;border-radius:999px;background:var(--surface-muted);overflow:hidden")}>
              <div style={sx("position:absolute;left:0;top:0;bottom:0;width:" + pct + "%;background:var(--color-primary);border-radius:999px")} />
            </div>
            <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px;font-size:12px;color:var(--text-muted)")}>
              <span>{price(spread.lo)}</span>
              <span style={sx("font-weight:700;color:var(--color-primary)")}>
                {pk({ tr: "medyan " + price(spread.mid), en: "median " + price(spread.mid), ru: "медиана " + price(spread.mid), ar: "الوسيط " + price(spread.mid) }, lang)}
              </span>
              <span>{price(spread.hi)}</span>
            </div>
          </div>
        )}

        {/* Fear of being overcharged is this product's first obstacle. Saying
            where the middle is, is the cheapest way to address it. */}
        <p style={sx("font-size:13.5px;color:var(--text-body);margin-top:12px;text-wrap:pretty")}>
          {spread
            ? pk({
                tr: "Dükkânların yarısı " + price(spread.mid) + " altında veriyor. Bu aralığın çok üstünde bir fiyat duyarsanız pazarlık payı var demektir.",
                en: "Half the shops quote below " + price(spread.mid) + ". A price well above this range means there is room to bargain.",
                ru: "Половина лавок даёт ниже " + price(spread.mid) + ".",
                ar: "نصف المتاجر تعرض أقل من " + price(spread.mid) + ".",
              }, lang)
            : pk({
                tr: "Bu üründe kıyaslanacak yeterli fiyat yok — talep bırakıp gerçek teklif toplayın.",
                en: "Not enough prices to compare — send a request and collect real offers.",
                ru: "Недостаточно цен для сравнения.",
                ar: "لا أسعار كافية للمقارنة.",
              }, lang)}
        </p>

        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(140px,100%),1fr));gap:1px;background:var(--border-default);border:1px solid var(--border-default);border-radius:11px;overflow:hidden;margin-top:16px")}>
          {facts.map(([value, label]) => (
            <div key={label} style={sx("background:var(--surface-card);padding:12px 14px")}>
              <div style={sx("font-size:19px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em")}>{value}</div>
              <div style={sx("font-size:12px;color:var(--text-muted);margin-top:2px")}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── one request instead of many ────────────────────────────────── */}
      <section style={sx("margin-top:16px;padding:18px 20px;border-radius:14px;background:var(--color-primary);color:#fff;display:flex;align-items:center;gap:16px;flex-wrap:wrap")}>
        <div style={sx("flex:1;min-width:240px")}>
          <div style={sx("font-size:17px;font-weight:700;letter-spacing:-.01em")}>
            {pk({ tr: "Tek tek sormayın", en: "Don't ask one by one", ru: "Не спрашивайте по одному", ar: "لا تسأل واحدًا تلو الآخر" }, lang)}
          </div>
          <div style={sx("font-size:13.5px;color:rgba(255,255,255,.82);margin-top:4px;text-wrap:pretty")}>
            {pk({
              tr: detail.shops.length + " dükkâna aynı anda talep gönderin; teklifler İşlerim'de yan yana gelsin.",
              en: "Send one request to all " + detail.shops.length + " shops; compare the offers side by side.",
              ru: "Отправьте один запрос всем " + detail.shops.length + " лавкам.",
              ar: "أرسل طلبًا واحدًا إلى " + detail.shops.length + " متجرًا.",
            }, lang)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            // The product goes straight in as a request line: nobody should
            // have to type the same thing twice.
            toast(pk({
              tr: detail.name + " talebe eklendi — adet yazıp gönderin",
              en: detail.name + " added to your request — set the quantity and send",
              ru: detail.name + " добавлен в запрос",
              ar: "أُضيف " + detail.name + " إلى طلبك",
            }, lang));
            save({ selReq: null });
            router.push(href.work("talep") + "&urun=" + encodeURIComponent(detail.name) +
              (detail.median ? "&hedef=" + detail.median : ""));
          }}
          style={sx("flex:none;height:44px;padding:0 20px;border-radius:8px;border:none;background:#fff;color:var(--color-primary-accent);font-family:inherit;font-size:14.5px;font-weight:700;cursor:pointer")}
        >
          {pk({ tr: "Bu ürün için talep bırak", en: "Request quotes for this", ru: "Запросить цены", ar: "اطلب عروضًا" }, lang)}
        </button>
      </section>

      {/* ── who sells it ───────────────────────────────────────────────── */}
      <section style={sx("margin-top:24px")}>
        <div style={sx("display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap")}>
          <div>
            <h2 style={sx("font-size:19px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em")}>
              {pk({ tr: "Satan dükkânlar", en: "Shops carrying it", ru: "Где купить", ar: "المتاجر" }, lang)}
            </h2>
            {/* Ranking is not for sale — and saying so is part of the product. */}
            <p style={sx("font-size:13px;color:var(--text-muted);margin-top:3px;text-wrap:pretty")}>
              {pk({
                tr: "Sıralama satın alınmaz: kayıt kademesi, yanıt hızı ve tazelik belirler.",
                en: "Ranking is not for sale: record tier, response speed and freshness decide it.",
                ru: "Позиция не продаётся: её определяют статус, скорость ответа и свежесть.",
                ar: "الترتيب لا يُشترى.",
              }, lang)}
            </p>
          </div>
          <div style={sx("display:flex;gap:7px;flex-wrap:wrap")}>
            {([
              ["onerilen", pk({ tr: "Önerilen", en: "Suggested", ru: "Рекомендуем", ar: "مقترح" }, lang)],
              ["ucuz", pk({ tr: "En uygun", en: "Lowest price", ru: "Дешевле", ar: "الأرخص" }, lang)],
              ["moq", pk({ tr: "Az adetle", en: "Low MOQ", ru: "Мал. партия", ar: "كمية أقل" }, lang)],
            ] as const).map(([id, label]) => {
              const on = sort === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSort(id)}
                  aria-pressed={on}
                  style={sx(
                    "height:32px;padding:0 13px;border-radius:999px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:1px solid " +
                      (on
                        ? "var(--color-primary);background:var(--color-primary);color:#fff"
                        : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={sx("display:flex;flex-direction:column;gap:10px;margin-top:14px")}>
          {shown.map((s) => {
            const r = s.rec;
            const place = SC.PLACES.find((x) => x.id === r.place);
            const tel = String(r.tel || "").replace(/\D/g, "");
            const badges = [
              r.status === "aktif" ? { label: pk({ tr: "Aktif", en: "Active", ru: "Активен", ar: "نشط" }, lang), tone: "success" } : null,
              r.isProducer ? { label: pk({ tr: "İmalatçı", en: "Producer", ru: "Производитель", ar: "مصنّع" }, lang), tone: "primary" } : null,
              r.shipsAbroad ? { label: pk({ tr: "İhracat", en: "Export", ru: "Экспорт", ar: "تصدير" }, lang), tone: "info" } : null,
            ].filter(Boolean) as { label: string; tone: string }[];

            return (
              <div
                key={r.id}
                style={sx("background:var(--surface-card);border:1px solid var(--border-" + (r.status === "aktif" ? "strong" : "default") + ");border-radius:13px;padding:15px 17px;box-shadow:0 3px 4px rgba(0,0,0,.03)")}
              >
                <div style={sx("display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap")}>
                  <div style={sx("flex:1;min-width:200px")}>
                    <button
                      type="button"
                      onClick={() => router.push(href.store(r.curated || r.id))}
                      style={sx("background:none;border:none;padding:0;font-family:inherit;font-size:14.5px;font-weight:700;letter-spacing:-.01em;color:var(--text-heading);cursor:pointer;text-align:start")}
                    >
                      {r.name || pk({ tr: "İsimsiz kayıt", en: "Unnamed record", ru: "Без названия", ar: "سجل بلا اسم" }, lang)}
                    </button>
                    <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:3px")}>
                      {[place?.name, r.floor > 0 ? F(lang, "hanFloor", r.floor) : F(lang, "hanGround"), W(lang, "doorNo") + " " + r.door]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <div style={sx("display:flex;flex-wrap:wrap;gap:5px;margin-top:8px")}>
                      {badges.map((bd) => (
                        <span key={bd.label} style={sx(toneChip(bd.tone))}>{bd.label}</span>
                      ))}
                    </div>
                  </div>

                  <div style={sx("flex:none;text-align:end")}>
                    <div style={sx("font-size:16px;font-weight:700;color:var(--color-primary)")}>
                      {s.lo ? price(s.lo) : pk({ tr: "Fiyat sorun", en: "Ask", ru: "Уточнить", ar: "اسأل" }, lang)}
                    </div>
                    <div style={sx("font-size:12px;color:var(--text-muted);margin-top:2px")}>
                      {pk({ tr: "en az " + (s.moq || 1) + " adet", en: "min " + (s.moq || 1), ru: "от " + (s.moq || 1), ar: "الحد الأدنى " + (s.moq || 1) }, lang)}
                    </div>
                  </div>
                </div>

                <div style={sx("display:flex;gap:8px;margin-top:12px;flex-wrap:wrap")}>
                  <Button variant="outline" color="primary" size="sm" onClick={() => router.push(href.store(r.curated || r.id))}>
                    {pk({ tr: "Dükkânı aç", en: "Open shop", ru: "Открыть", ar: "افتح المتجر" }, lang)}
                  </Button>
                  {/* The ready-made question goes out in Turkish whatever the
                      reader's language: that is what removes the barrier. */}
                  {tel && (
                    <a
                      href={"https://wa.me/" + tel + "?text=" + encodeURIComponent(detail.name + " fiyatınız nedir? (" + (r.name || "") + " · " + (place?.name || "") + ")")}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={sx("display:inline-flex;align-items:center;height:30px;padding:0 13px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;border:1px solid var(--border-strong);background:var(--surface-card);color:var(--text-body)")}
                    >
                      {pk({ tr: "Sor", en: "Ask", ru: "Спросить", ar: "اسأل" }, lang)}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {shops.length > limit && (
          <div style={sx("margin-top:12px")}>
            <Button variant="outline" color="primary" size="md" fullWidth onClick={() => setLimit(limit + 24)}>
              {pk({
                tr: (shops.length - limit) + " dükkân daha",
                en: (shops.length - limit) + " more shops",
                ru: "ещё " + (shops.length - limit),
                ar: (shops.length - limit) + " متجرًا آخر",
              }, lang)}
            </Button>
          </div>
        )}
      </section>

      {/* ── siblings ───────────────────────────────────────────────────── */}
      {list.length > 1 && (
        <section style={sx("margin-top:26px")}>
          <h2 style={sx(KICKER)}>
            {pk({ tr: "Aynı kategoride", en: "Same category", ru: "В той же категории", ar: "في الفئة نفسها" }, lang)}
          </h2>
          <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(230px,100%),1fr));gap:10px;margin-top:10px")}>
            {list.filter((x) => x.slug !== slug).slice(0, 8).map((x) => (
              <button
                key={x.slug}
                type="button"
                onClick={() => { setLimit(12); router.push(href.product(catId, x.slug)); }}
                style={sx("display:block;width:100%;text-align:start;font-family:inherit;cursor:pointer;background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;padding:14px 16px")}
              >
                <span style={sx("display:block;font-size:14px;font-weight:700;color:var(--text-heading)")}>{x.name}</span>
                <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:3px")}>
                  {x.band
                    ? price(x.band[0]) + " – " + price(x.band[1]) + " · " + x.shops + pk({ tr: " dükkân", en: " shops", ru: " лавок", ar: " متجرًا" }, lang)
                    : x.shops + pk({ tr: " dükkân", en: " shops", ru: " лавок", ar: " متجرًا" }, lang)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
