// HAN — one shop, one shape.
//
// The store page has two data sources: 11 hand-written reference stores with
// real product lists, photos and weekly hours, and 1,374 generated scale
// records that carry a category, a price band and an address. The handoff is
// explicit that these share ONE template — so they have to share one view
// model, resolved here rather than branched in the screen.
//
// Where the generated record has less to say, this says less. It never fills a
// gap with something that reads as verified (K11).

import * as D from "@/data/han-data";
import * as L from "@/data/han-logic";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import type {
  AccessInfo, Band, CuratedStore, GroupEntry, Lang, Mode, Place, Product, ShopRecord, SrcInfo,
} from "@/data/types";
import { F, W } from "@/lib/copy";
import { tx } from "@/lib/i18n";
import { catPhoto, floorLabel, storePhoto } from "@/lib/shop";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

/** How the shop is doing right now — open, closing, or shut and why. */
export interface NowState {
  open: boolean;
  title: string;
  body: string;
}

/** Whether the price here sits under, over or at the going rate — and whether
 *  there is room to bargain. Fear of being overcharged is the first obstacle
 *  this product has to clear. */
export interface PriceTrust {
  verdict: string;
  note: string;
  mine: number | null;
  peerAvg: number | null;
}

export interface ShopView {
  id: string;
  /** the record backing this page, always present */
  rec: ShopRecord;
  /** the rich store, when this is one of the 11 */
  store: CuratedStore | null;
  place: Place | null;
  name: string;
  where: string;
  cat: string;
  catName: string;
  status: ShopRecord["status"];
  /** the action the record's state permits, not the state's internal name */
  actionLabel: string;
  statusTone: string;
  rating: number | null;
  reviews: number;
  tel: string;
  band: Band | null;
  moq: number;
  groups: GroupEntry[];
  products: Product[];
  photos: string[];
  /** whether the photos are actually of this shop */
  ownPhotos: boolean;
  src: SrcInfo;
  now: NowState;
  price: PriceTrust;
  access: AccessInfo;
  accessLines: string[];
  langs: string[];
  payments: string[];
  certs: string[];
  shipsAbroad: boolean;
  taxFree: boolean;
  isProducer: boolean;
  respMins: number | null;
  respRate: number | null;
  updatedDays: number;
  street: string | null;
  han: string | null;
  floor: number;
  door: string;
  /** ready-made questions, in the reader's language, sent in Turkish */
  asks: { label: string; turkish: string }[];
}

/** Resolve a page id — either a curated store id or a record id. */
export function resolveShop(id: string, lang: Lang, mode: Mode): ShopView | null {
  const store = (D.STORES.find((s) => s.id === id) as CuratedStore | undefined) || null;
  const rec = store
    ? SC.RECORDS.find((r) => r.curated === store.id) || SC.RECORDS.find((r) => r.id === id)
    : SC.RECORDS.find((r) => r.id === id);
  if (!rec) return null;

  const place = SC.PLACES.find((p) => p.id === rec.place) || null;
  const cat = rec.cat;
  const catDef = [...(D.CATS || []), ...SC.CATS_EXTRA].find((c) => c.id === cat);
  const catName = catDef ? tx(catDef, lang) : cat;
  const st = SE.statusOf(rec.status);
  const wsMode = mode === "toptan";

  const name = rec.name || catName;
  const where = [place ? place.name : rec.place, floorLabel(rec.floor, lang), W(lang, "doorNo") + " " + rec.door]
    .filter(Boolean)
    .join(" · ");

  return {
    id,
    rec,
    store,
    place,
    name,
    where,
    cat,
    catName,
    status: rec.status,
    actionLabel: (st["act" + lang.charAt(0).toUpperCase() + lang.slice(1)] as string) || (st.actTr as string),
    statusTone: st.tone as string,
    rating: store ? (store.rating ?? null) : rec.rating,
    reviews: store ? (store.reviews ?? 0) : rec.reviews,
    tel: String((store ? store.tel : rec.tel) || "").replace(/\D/g, ""),
    band: rec.band,
    moq: store ? (((store.trade || {}).minOrder || {}).qty as number) || 1 : rec.moq,
    groups: rec.groups || [],
    products: store ? (store.products || []) : [],
    photos: photosOf(store, cat),
    ownPhotos: !!store,
    src: rec.src || {},
    now: nowStateOf(store, place, rec, lang),
    price: priceTrustOf(store, rec, cat, wsMode, lang),
    access: place ? SC.accessOf(place) : { lift: false, stairsOnly: false, handcart: false, porter: false, parking: false },
    accessLines: accessLinesOf(place, rec.floor, lang),
    langs: (store ? (store.commerce || {}).languages : rec.langs) || ["tr"],
    payments: (store ? (store.commerce || {}).payments : rec.payments) || ["cash"],
    certs: (store ? (store.production || {}).certs : []) || [],
    shipsAbroad: store ? !!(store.exportInfo || {}).shipsAbroad : rec.shipsAbroad,
    taxFree: store ? !!(store.commerce || {}).taxFree : rec.taxFree,
    isProducer: store ? !!(store.trade || {}).isProducer : rec.isProducer,
    respMins: store ? ((store.trust || {}).respMins ?? null) : rec.respMins,
    respRate: store ? ((store.trust || {}).respRate ?? null) : rec.respRate,
    updatedDays: rec.updatedDays,
    street: store ? ((store.location || {}).street ?? null) : null,
    han: store ? (store.han ?? null) : null,
    floor: rec.floor,
    door: rec.door,
    asks: asksOf(store, rec, catName, lang),
  };
}

/** A curated store shows its category's picture; a generated record shows the
 *  same, and the page says so out loud rather than implying a photo shoot. */
function photosOf(store: CuratedStore | null, cat: string): string[] {
  const base = store ? storePhoto(store) : catPhoto(cat);
  return [base];
}

/** C1 · "is it open now" — the trader's declared hours beat the place's
 *  default, because only that answers the question truthfully. */
function nowStateOf(store: CuratedStore | null, place: Place | null, rec: ShopRecord, lang: Lang): NowState {
  if (store) {
    const dow = new Date().getDay();
    const day = L.hoursToday(D, store, dow);
    const open = L.isOpenNow(D, store);
    const nowM = new Date().getHours() * 60 + new Date().getMinutes();
    const left = day ? Math.max(0, L.toMin(day[1]) - nowM) : 0;
    return {
      open,
      title: open
        ? pk({ tr: "Açık", en: "Open", ru: "Открыто", ar: "مفتوح" }, lang)
        : pk({ tr: "Kapalı", en: "Closed", ru: "Закрыто", ar: "مغلق" }, lang),
      body: !day
        ? pk({ tr: "Bugün kapalı — çarşı günü değil.", en: "Closed today — not a bazaar day.", ru: "Сегодня закрыто.", ar: "مغلق اليوم." }, lang)
        : open
          ? pk({ tr: day[1] + "'da kapanıyor · " + left + " dakika var", en: "Closes at " + day[1] + " · " + left + " min left", ru: "Закроется в " + day[1], ar: "يغلق في " + day[1] }, lang)
          : pk({ tr: "Bugün " + day[0] + " – " + day[1] + " arası açık", en: "Open " + day[0] + " – " + day[1] + " today", ru: "Сегодня " + day[0] + " – " + day[1], ar: "اليوم " + day[0] + " – " + day[1] }, lang),
    };
  }

  const s = SC.openState(place, new Date(), rec);
  const hh = (h?: number) => (h == null ? "" : String(Math.floor(h)).padStart(2, "0") + ":" + String(Math.round((h % 1) * 60)).padStart(2, "0"));
  if (s.open) {
    return {
      open: true,
      title: pk({ tr: "Açık", en: "Open", ru: "Открыто", ar: "مفتوح" }, lang),
      body: pk({
        tr: hh(s.close) + "'da kapanıyor · " + s.leftMins + " dakika var",
        en: "Closes at " + hh(s.close) + " · " + s.leftMins + " min left",
        ru: "Закроется в " + hh(s.close),
        ar: "يغلق في " + hh(s.close),
      }, lang),
    };
  }
  const body =
    s.reason === "namaz"
      ? pk({ tr: "Cuma namazı arası — " + hh(s.back) + "'te açılır.", en: "Friday prayer break — reopens at " + hh(s.back) + ".", ru: "Пятничный перерыв — откроется в " + hh(s.back) + ".", ar: "استراحة صلاة الجمعة — يفتح في " + hh(s.back) + "." }, lang)
      : s.reason === "gun"
        ? pk({ tr: "Bugün kapalı — bu yerin kapalı günü.", en: "Closed today — this place's closing day.", ru: "Сегодня выходной.", ar: "مغلق اليوم." }, lang)
        : pk({
            tr: "Bugün " + hh(s.open2) + " – " + hh(s.close) + " arası açık",
            en: "Open " + hh(s.open2) + " – " + hh(s.close) + " today",
            ru: "Сегодня " + hh(s.open2) + " – " + hh(s.close),
            ar: "اليوم " + hh(s.open2) + " – " + hh(s.close),
          }, lang);
  return { open: false, title: pk({ tr: "Kapalı", en: "Closed", ru: "Закрыто", ar: "مغلق" }, lang), body };
}

/** C1 · price confidence. The comparison pool is not limited to the 11 rich
 *  records — the scale records' low bands count too, or the answer would
 *  almost always be "nothing to compare with". */
function priceTrustOf(
  store: CuratedStore | null, rec: ShopRecord, cat: string, wsMode: boolean, lang: Lang,
): PriceTrust {
  const mine = store
    ? (() => { const v = L.minPrice(store, wsMode ? "toptan" : "perakende"); return v === Number.MAX_SAFE_INTEGER ? null : v; })()
    : rec.band
      ? rec.band[0]
      : null;

  const peers: number[] = [];
  if (store) {
    D.STORES.filter((x) => x.id !== store.id && (x.cats || [])[0] === (store.cats || [])[0]).forEach((x) => {
      const v = L.minPrice(x, wsMode ? "toptan" : "perakende");
      if (v && v !== Number.MAX_SAFE_INTEGER) peers.push(v);
    });
  }
  SC.RECORDS.filter((r) => r.id !== rec.id && r.cat === cat && r.band)
    .slice(0, 400)
    .forEach((r) => peers.push((r.band as Band)[0]));

  const peerAvg = peers.length ? peers.reduce((a, x) => a + x, 0) / peers.length : null;

  if (mine == null || !peerAvg) {
    return {
      verdict: pk({ tr: "Karşılaştıracak fiyat yok", en: "No comparable prices", ru: "Не с чем сравнить", ar: "لا أسعار للمقارنة" }, lang),
      note: pk({ tr: "Bu kategoride kıyaslanacak başka kayıt yok — fiyatı yerinde teyit edin.", en: "No other record to compare in this category — confirm on site.", ru: "Сравнить не с чем — уточните на месте.", ar: "لا سجل آخر للمقارنة — تأكد في الموقع." }, lang),
      mine, peerAvg,
    };
  }

  const verdict =
    mine < peerAvg * 0.9
      ? pk({ tr: "Kategori ortalamasının altında", en: "Below category average", ru: "Ниже среднего", ar: "أقل من المتوسط" }, lang)
      : mine > peerAvg * 1.1
        ? pk({ tr: "Kategori ortalamasının üstünde", en: "Above category average", ru: "Выше среднего", ar: "أعلى من المتوسط" }, lang)
        : pk({ tr: "Kategori ortalamasında", en: "At category average", ru: "На уровне среднего", ar: "عند المتوسط" }, lang);

  const negotiable = store ? !!(store.trade || {}).negotiable : !!rec.moqFlex;
  const note = pk({
    tr: "Bu dükkânın en düşük fiyatı " + L.money(mine) + "; aynı işi yapanların ortalaması " + L.money(Math.round(peerAvg)) + ". " +
      (negotiable ? "Pazarlık payı var — adet arttıkça iner." : "Fiyat sabit beyan edilmiş."),
    en: "Lowest here is " + L.money(mine) + "; peers average " + L.money(Math.round(peerAvg)) + ". " +
      (negotiable ? "There is room to bargain — it drops with quantity." : "Prices declared fixed."),
    ru: "Минимум здесь " + L.money(mine) + "; в среднем " + L.money(Math.round(peerAvg)) + ".",
    ar: "الأدنى هنا " + L.money(mine) + "؛ المتوسط " + L.money(Math.round(peerAvg)) + ".",
  }, lang);

  return { verdict, note, mine, peerAvg };
}

/** C1/M4 · a fourth floor with no lift is a real obstacle, and nobody puts it
 *  on a sign. */
function accessLinesOf(place: Place | null, floor: number, lang: Lang): string[] {
  if (!place) return [];
  const acc = SC.accessOf(place);
  return [
    acc.lift
      ? pk({ tr: "Asansör var", en: "Lift available", ru: "Есть лифт", ar: "يوجد مصعد" }, lang)
      : floor > 0
        ? pk({ tr: "Asansör yok — " + floor + ". kata merdiven", en: "No lift — stairs to floor " + floor, ru: "Лифта нет — лестница", ar: "لا مصعد — سلالم" }, lang)
        : pk({ tr: "Zemin kat — merdiven yok", en: "Ground floor — no stairs", ru: "Первый этаж", ar: "الطابق الأرضي" }, lang),
    acc.handcart
      ? pk({ tr: "El arabası girebiliyor", en: "Handcart access", ru: "Проезд тележки", ar: "دخول عربة" }, lang)
      : pk({ tr: "El arabası giremiyor — ağır yükü hamalla taşıyın", en: "No handcart access — use a porter for heavy loads", ru: "Тележка не проходит", ar: "لا تدخل العربة" }, lang),
    acc.parking
      ? pk({ tr: "Yakınında otopark var", en: "Parking nearby", ru: "Рядом парковка", ar: "موقف قريب" }, lang)
      : pk({ tr: "Otopark yok — yaya gelin", en: "No parking — come on foot", ru: "Парковки нет", ar: "لا موقف — تعال سيرًا" }, lang),
  ];
}

/**
 * D2 · the thing that actually removes the language barrier.
 *
 * The buyer picks a question in their own language; it reaches the trader in
 * Turkish. A declared-only record gets none of these — it cannot take a
 * request yet, and offering one would be a promise the record cannot keep.
 */
function asksOf(store: CuratedStore | null, rec: ShopRecord, catName: string, lang: Lang) {
  const tel = String((store ? store.tel : rec.tel) || "").replace(/\D/g, "");
  if (!tel || rec.status === "beyan") return [];

  const firstProduct = store ? ((store.products || [])[0] || {}).tr || "" : (rec.groups || [])[0]?.name || "";
  const moq = store ? (((store.trade || {}).minOrder || {}).qty as number) || 1 : rec.moq;
  const subject = firstProduct || catName;

  const rows = [
    {
      turkish: "Merhaba, " + subject + " var mı?",
      label: pk({ tr: "Bu ürün var mı?", en: "Do you have this item?", ru: "Есть ли этот товар?", ar: "هل لديك هذه السلعة؟" }, lang),
    },
    {
      turkish: moq > 1 ? moq + " adet için fiyatınız nedir?" : "Fiyatı nedir?",
      label: pk({
        tr: moq > 1 ? moq + " adet fiyatı" : "Fiyat sor",
        en: moq > 1 ? "Price for " + moq + " pcs" : "Ask the price",
        ru: moq > 1 ? "Цена за " + moq + " шт" : "Спросить цену",
        ar: moq > 1 ? "سعر " + moq + " قطعة" : "اسأل عن السعر",
      }, lang),
    },
    {
      turkish: "Bugün kaça kadar açıksınız?",
      label: pk({ tr: "Kaçta kapanıyorsunuz?", en: "When do you close?", ru: "Когда закрываетесь?", ar: "متى تغلقون؟" }, lang),
    },
  ];

  // These two only appear when the shop actually does them — a question the
  // trader cannot answer wastes both sides' time.
  const doesSamples = store ? !!store.sample : false;
  const shipsAbroad = store ? !!(store.exportInfo || {}).shipsAbroad : rec.shipsAbroad;
  if (doesSamples) {
    rows.push({
      turkish: "Numune gönderebilir misiniz?",
      label: pk({ tr: "Numune isteyin", en: "Ask for a sample", ru: "Запросить образец", ar: "اطلب عينة" }, lang),
    });
  }
  if (shipsAbroad) {
    rows.push({
      turkish: "Yurt dışına kargo yapıyor musunuz?",
      label: pk({ tr: "Yurt dışı kargo", en: "Ship abroad?", ru: "Отправка за границу?", ar: "شحن للخارج؟" }, lang),
    });
  }
  return rows;
}

/** The honest sentence about where these photos came from. */
export function photoHonesty(view: ShopView, lang: Lang): string {
  return view.ownPhotos
    ? pk({
        tr: "Fotoğraflar bu dükkânın kendi fotoğrafları; kayıt HAN ekibince yerinde doğrulandı.",
        en: "The photos belong to this shop; the record was verified on site by the HAN team.",
        ru: "Фото принадлежат этой лавке; запись проверена на месте.",
        ar: "الصور تخص هذا المتجر؛ وقد جرى التحقق ميدانيًا.",
      }, lang)
    : pk({
        tr: "Bu kaydın kendi fotoğrafı yok — gördüğünüz görsel kategoriyi temsil ediyor, dükkânı değil.",
        en: "This record has no photo of its own — the image shows the category, not this shop.",
        ru: "У записи нет собственного фото — изображение показывает категорию, а не лавку.",
        ar: "لا صورة خاصة بهذا السجل — الصورة تمثل الفئة لا المتجر.",
      }, lang);
}

/** K11 · provenance chip for a field. Generated data is never dressed up as
 *  verified. */
export function srcLabel(tag: string | undefined, lang: Lang): { label: string; tone: string; note: string } | null {
  if (!tag) return null;
  const def = SC.SRC_LABELS[tag as keyof typeof SC.SRC_LABELS];
  if (!def) return null;
  return {
    label: (def[lang] as string) || (def.tr as string),
    tone: def.tone as string,
    note: (def.noteTr as string) || "",
  };
}

/** Shops doing the same work nearby — the answer to "what if nobody replies". */
export function similarShops(view: ShopView, limit = 4): ShopRecord[] {
  return SE.search("", { sector: view.rec.sector, activeOnly: true }, { mode: "ikisi" })
    .items.map((h) => h.rec)
    .filter((r) => r.id !== view.rec.id && r.cat === view.cat)
    .slice(0, limit);
}

/** Trust file rows, each with its provenance. */
export function trustRows(view: ShopView, lang: Lang) {
  const rows: { label: string; value: string; src?: string }[] = [
    {
      label: pk({ tr: "Kayıt durumu", en: "Record state", ru: "Состояние записи", ar: "حالة السجل" }, lang),
      value: view.actionLabel,
      src: view.src.address,
    },
    {
      label: pk({ tr: "Yanıt hızı", en: "Response speed", ru: "Скорость ответа", ar: "سرعة الرد" }, lang),
      value: view.respMins ? view.respMins + " " + pk({ tr: "dk", en: "min", ru: "мин", ar: "د" }, lang) : "—",
      src: view.src.resp,
    },
    {
      label: pk({ tr: "Yanıt oranı", en: "Response rate", ru: "Доля ответов", ar: "نسبة الرد" }, lang),
      value: view.respRate ? Math.round(view.respRate > 1 ? view.respRate : view.respRate * 100) + "%" : "—",
      src: view.src.resp,
    },
    {
      label: pk({ tr: "Fiyat bandı", en: "Price band", ru: "Диапазон цен", ar: "نطاق السعر" }, lang),
      value: view.band ? L.money(view.band[0]) + " – " + L.money(view.band[1]) : "—",
      src: view.src.band,
    },
    {
      label: W(lang, "minOrder"),
      value: String(view.moq),
      src: view.src.moq,
    },
    {
      label: pk({ tr: "Güncellik", en: "Last updated", ru: "Обновлено", ar: "آخر تحديث" }, lang),
      value: pk({
        tr: view.updatedDays + " gün önce",
        en: view.updatedDays + " days ago",
        ru: view.updatedDays + " дн. назад",
        ar: "قبل " + view.updatedDays + " يومًا",
      }, lang),
    },
  ];
  return rows;
}

export { F, W };
