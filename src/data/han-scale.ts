// HAN · Ölçek katmanı (Ö1)
// Fatih'te 30–50 bin işletme var. Elle yazılan 11 kayıt tasarımı yanıltıyordu.
// Burada yer omurgası (semt → yer → kat → birim) sabit veri olarak durur; işletme
// kayıtları tohumlu rastgelelikle ÜRETİLİR: dosya küçük kalır, yoğunluk gerçekçi olur.
// Aynı tohum her zaman aynı çarşıyı verir — ekran görüntüsü, test ve adres paylaşımı tutar.

import { HANS, STORES } from "./han-data";
import { readKey, writeKey, KEYS } from "@/services/storage";
import type {
  Trade,
  AccessInfo, ApprovalVia, Band, CuratedStore, GroupEntry, L10n, Lang, Mode,
  OpenState, Place, PlaceKind, Sector, Semt, ShopRecord, SrcTag, UnitRef,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A seeded pseudo-random source. Same seed → same bazaar, every load. */
type Rand = () => number;
type Dict<T = any> = Record<string, T>;

/** A paid placement. Organic ranking is never sold; money buys a labelled,
 *  separate slot and nothing else. */
export interface Sponsor {
  recordId: string;
  kind: "kategori" | "yer" | "talep";
  cat?: string;
  place?: string;
  until: string;
  paused: boolean;
  /** set when the rule engine stopped it — cannot be re-enabled by hand */
  autoPaused?: boolean;
}

/** One line of the decision ledger. Four sources, one timeline. */
export interface AuditEntry {
  at: number;
  kind: keyof typeof AUDIT_KINDS;
  target: string;
  targetName: string;
  who: string;
  detail: string;
  via: string;
  tone: string;
}

/** Coverage figures for one place. */
export interface PlaceStats {
  place: Place;
  units: number;
  records: number;
  openRecords: number;
  coverage: number;
  byStatus: Dict<number>;
  byFloor: Dict<Dict<number>>;
  bulk: boolean;
  officer: { name: string; [k: string]: string } | null;
  topCats: { cat: string; n: number }[];
}

// ── tohumlu rastgelelik ───────────────────────────────────────────────────
function rng(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
const pickW = <T,>(r: Rand, list: [T, number][]): T => {
  // list: [[deger, agirlik], ...]
  const tot = list.reduce((n: number, x) => n + x[1], 0);
  let v = r() * tot;
  for (const x of list) { v -= x[1]; if (v <= 0) return x[0]; }
  return list[list.length - 1][0];
};
const pick = <T,>(r: Rand, arr: T[]): T => arr[Math.floor(r() * arr.length) % arr.length];
const int = (r: Rand, a: number, b: number): number => a + Math.floor(r() * (b - a + 1));

// ── semtler (Tarihi Yarımada / Fatih) ─────────────────────────────────────
export const SEMTLER: Semt[] = [
  { id: "eminonu", tr: "Eminönü", en: "Eminönü", ru: "Эминёню", ar: "إمين أونو", lat: 41.0167, lng: 28.9707 },
  { id: "tahtakale", tr: "Tahtakale", en: "Tahtakale", ru: "Тахтакале", ar: "تحتة قلعة", lat: 41.0161, lng: 28.9685 },
  { id: "kapalicarsi", tr: "Kapalıçarşı", en: "Grand Bazaar", ru: "Гранд-базар", ar: "السوق المسقوف", lat: 41.0106, lng: 28.9681 },
  { id: "mahmutpasa", tr: "Mahmutpaşa", en: "Mahmutpaşa", ru: "Махмутпаша", ar: "محمود باشا", lat: 41.0128, lng: 28.9701 },
  { id: "nuruosmaniye", tr: "Nuruosmaniye", en: "Nuruosmaniye", ru: "Нуруосмание", ar: "نور عثمانية", lat: 41.0093, lng: 28.9709 },
  { id: "misircarsisi", tr: "Mısır Çarşısı", en: "Spice Bazaar", ru: "Египетский базар", ar: "سوق البهارات", lat: 41.0165, lng: 28.9707 },
  { id: "sirkeci", tr: "Sirkeci", en: "Sirkeci", ru: "Сиркеджи", ar: "سيركجي", lat: 41.0139, lng: 28.9773 },
  { id: "sultanahmet", tr: "Sultanahmet", en: "Sultanahmet", ru: "Султанахмет", ar: "السلطان أحمد", lat: 41.0055, lng: 28.9769 },
  { id: "beyazit", tr: "Beyazıt", en: "Beyazıt", ru: "Баязид", ar: "بايزيد", lat: 41.0104, lng: 28.9640 },
  { id: "laleli", tr: "Laleli", en: "Laleli", ru: "Лалели", ar: "لاله لي", lat: 41.0100, lng: 28.9556 },
  { id: "aksaray", tr: "Aksaray", en: "Aksaray", ru: "Аксарай", ar: "أق سراي", lat: 41.0069, lng: 28.9502 },
  { id: "kucukpazar", tr: "Küçükpazar", en: "Küçükpazar", ru: "Кючюкпазар", ar: "السوق الصغير", lat: 41.0182, lng: 28.9640 },
  { id: "unkapani", tr: "Unkapanı", en: "Unkapanı", ru: "Ункапаны", ar: "أون قبانى", lat: 41.0208, lng: 28.9610 },
  { id: "cemberlitas", tr: "Çemberlitaş", en: "Çemberlitaş", ru: "Чемберлиташ", ar: "تشمبرلي طاش", lat: 41.0085, lng: 28.9714 },
  { id: "vefa", tr: "Vefa · Şehzadebaşı", en: "Vefa · Şehzadebaşı", ru: "Вефа", ar: "وفا", lat: 41.0142, lng: 28.9578 }
];

// ── sektörler ─────────────────────────────────────────────────────────────
export const SECTORS: Dict<L10n & { tone: string }> = {
  toptan:    { tr: "Toptan", en: "Wholesale", ru: "Опт", ar: "جملة", tone: "primary" },
  perakende: { tr: "Perakende", en: "Retail", ru: "Розница", ar: "تجزئة", tone: "info" },
  imalat:    { tr: "İmalat · atölye", en: "Workshop", ru: "Производство", ar: "ورشة", tone: "secondary" },
  hizmet:    { tr: "Hizmet", en: "Service", ru: "Услуги", ar: "خدمات", tone: "success" }
};

// ── kayıt durumları · editör onay hattı ───────────────────────────────────
// Kullanıcıya durum adı değil EYLEM gösterilir; durum içeride sıralama sinyalidir.
export const STATUS: Dict = {
  beyan: { key: "beyan", tone: "warning", public: true,
    tr: "Esnaf beyanı · onay bekliyor", en: "Self-declared · awaiting approval", ru: "Заявлено продавцом · на проверке", ar: "إقرار التاجر · بانتظار الموافقة",
    actTr: "Doğrulanmadı", actEn: "Not verified", actRu: "Не проверено", actAr: "غير موثّق",
    bodyTr: "Kaydı esnafın kendisi açtı; yetkili henüz doğrulamadı. Fiyat ve teklif bu kayıtta kapalı.",
    bodyEn: "The trader opened this record; it is not verified yet. Prices and offers stay closed here.",
    bodyRu: "Запись открыл сам торговец; она не проверена. Цены и предложения недоступны.",
    bodyAr: "فتح التاجر هذا السجل ولم يُتحقق منه بعد. الأسعار والعروض مغلقة." },
  onayli: { key: "onayli", tone: "primary", public: true,
    tr: "Onaylı", en: "Approved", ru: "Подтверждён", ar: "مُعتمد",
    actTr: "İletişim var", actEn: "Contact available", actRu: "Есть контакты", actAr: "بيانات التواصل متاحة",
    bodyTr: "Yetkili doğruladı; künye ve iletişim güvenilir.",
    bodyEn: "Verified by an authorised officer; details and contact are reliable.",
    bodyRu: "Проверено уполномоченным; данные надёжны.",
    bodyAr: "تحقق منه مسؤول معتمد؛ البيانات موثوقة." },
  aktif: { key: "aktif", tone: "accent", public: true,
    tr: "Aktif", en: "Active", ru: "Активен", ar: "نشط",
    actTr: "Fiyat sorulabilir", actEn: "You can ask the price", actRu: "Можно узнать цену", actAr: "يمكن السؤال عن السعر",
    bodyTr: "Onaylı, kataloğu güncel; taleplere yanıt veriyor.",
    bodyEn: "Approved with a current catalogue; answers requests.",
    bodyRu: "Подтверждён, каталог актуален; отвечает на заявки.",
    bodyAr: "معتمد وكتالوجه محدَّث؛ يجيب على الطلبات." },
  askida: { key: "askida", tone: "danger", public: false,
    tr: "Askıda", en: "Suspended", ru: "Приостановлен", ar: "موقوف",
    actTr: "Teyit bekliyor", actEn: "Needs re-checking", actRu: "Требует проверки", actAr: "يحتاج تأكيدًا" },
  birim: { key: "birim", tone: "secondary", public: true,
    tr: "Kaydı açılmadı", en: "Record not opened", ru: "Запись не открыта", ar: "لم يُفتح السجل",
    actTr: "Kaydı açılmadı", actEn: "Record not opened", actRu: "Запись не открыта", actAr: "لم يُفتح السجل" }
};

// ── ücretli yerleşim ──────────────────────────────────────────────────────
// Kural: organik sıralama satılmaz. Para yalnız ETİKETLİ ayrı alan alır ve
// yanıt performansı düşen dükkânın yerleşimi durur.
export const SPONSOR_KINDS: Dict = {
  kategori: { tr: "Kategori vitrini", en: "Category showcase", ru: "Витрина категории", ar: "واجهة الفئة",
    noteTr: "Kategori ve arama sonucunun üstünde tek şerit.", noteEn: "One strip above category and search results." },
  yer: { tr: "Yer vitrini", en: "Place showcase", ru: "Витрина места", ar: "واجهة المكان",
    noteTr: "Bulunduğu hanın sayfasında tek kart.", noteEn: "One card on its own han's page." },
  talep: { tr: "Talepte öncelikli bildirim", en: "Priority request alert", ru: "Приоритетное уведомление", ar: "تنبيه أولوية للطلب",
    noteTr: "Talep havuzunda bildirimi ilk alır; teklifi sıralamada avantaj görmez.",
    noteEn: "Gets the request alert first; the offer itself gains no ranking advantage." }
};

// ── platform ayarları ─────────────────────────────────────────────────────
// Onaysız kaydın yayında görünüp görünmemesi bir KURAL değil, ayardır: yönetim
// panelinden açılıp kapanır. Kod hiçbir yerde bunu sabitlemez.
export const SETTINGS: Dict<{ value: any; [k: string]: any }> = {
  showDeclared: { value: true, tr: "Onaysız kayıtlar yayında görünsün", en: "Show unapproved records publicly", ru: "Показывать неподтверждённые записи", ar: "إظهار السجلات غير المعتمدة",
    noteTr: "Esnaf beyanı kayıtlar listede en sonda ve 'doğrulanmadı' damgasıyla çıkar.",
    noteEn: "Self-declared records appear last, marked as unverified.",
    noteRu: "Заявленные записи идут последними с пометкой «не проверено».",
    noteAr: "تظهر السجلات المُقرّة أخيرًا وبعلامة غير موثّق." },
  declaredCanPrice: { value: false, tr: "Onaysız kayıt fiyat ve teklif verebilsin", en: "Unapproved records may show prices and take offers", ru: "Неподтверждённые могут показывать цены", ar: "يمكن للسجلات غير المعتمدة عرض الأسعار",
    noteTr: "Kapalıyken beyan kaydında fiyat gizlenir, talep gönderilemez.",
    noteEn: "When off, declared records hide prices and cannot receive requests.",
    noteRu: "Если выключено — цены скрыты, заявки не принимаются.",
    noteAr: "عند الإيقاف تُخفى الأسعار ولا تُستقبل الطلبات." },
  showUnits: { value: true, tr: "Kaydı olmayan dükkân birimleri görünsün", en: "Show shop units with no record", ru: "Показывать помещения без записи", ar: "إظهار الوحدات بلا سجل",
    noteTr: "Adres aramasında 'burada dükkân var, kaydı açılmadı' satırı çıkar.",
    noteEn: "Address searches surface 'a shop is here, no record yet'.",
    noteRu: "В поиске по адресу появляется «лавка есть, записи нет».",
    noteAr: "يظهر في البحث بالعنوان «هناك دكان بلا سجل»." },
  showSponsored: { value: true, tr: "Sponsorlu yerleşim görünsün", en: "Show sponsored placements", ru: "Показывать спонсорские блоки", ar: "إظهار المواضع المدفوعة",
    noteTr: "Ücretli yerleşim yalnız etiketli ayrı alanda çıkar; organik sıralamaya karışmaz.",
    noteEn: "Paid placement appears only in a labelled separate area; it never mixes into organic ranking.",
    noteRu: "Платное размещение — только в отдельном помеченном блоке.",
    noteAr: "الموضع المدفوع في مساحة منفصلة موسومة فقط." },
  freshDays: { value: 90, tr: "Tazelik süresi (gün)", en: "Freshness window (days)", ru: "Окно свежести (дней)", ar: "نافذة التحديث (أيام)",
    noteTr: "Bu süre dokunulmayan aktif kayıt onaylıya iner.",
    noteEn: "An active record untouched for this long drops to approved.",
    noteRu: "Активная запись без изменений опускается до подтверждённой.",
    noteAr: "يهبط السجل النشط غير المحدَّث إلى معتمد." }
};

// Onay kaynağı: kapsamanın motoru han yönetimiyle toplu onaydır.
export const APPROVAL: Dict<L10n> = {
  han: { tr: "Han yönetimi listesinden toplu onay", en: "Bulk approval from the han's own registry", ru: "Массовое подтверждение по реестру хана", ar: "موافقة جماعية من سجل الخان" },
  saha: { tr: "Saha turunda yerinde görüldü", en: "Seen on site during a field round", ru: "Осмотрено при обходе", ar: "شوهد ميدانيًا" },
  esnaf: { tr: "Esnaf başvurusu, sonra onaylandı", en: "Trader applied, then approved", ru: "Заявка торговца, затем подтверждение", ar: "طلب التاجر ثم الموافقة" }
};

// Her han ve bölge için yetkili atanabilir.
export const OFFICERS: Dict<{ name: string; [k: string]: string }> = {
  "of-ayse": { name: "Ayşe Tuna", tr: "Tahtakale · Mahmutpaşa yetkilisi", en: "Officer for Tahtakale · Mahmutpaşa", ru: "Ответственная по Тахтакале", ar: "مسؤولة تحتة قلعة" },
  "of-kemal": { name: "Kemal Arslan", tr: "Kapalıçarşı · Nuruosmaniye yetkilisi", en: "Officer for the Grand Bazaar", ru: "Ответственный по Гранд-базару", ar: "مسؤول السوق المسقوف" },
  "of-derya": { name: "Derya Soylu", tr: "Laleli · Aksaray yetkilisi", en: "Officer for Laleli · Aksaray", ru: "Ответственная по Лалели", ar: "مسؤولة لاله لي" },
  "of-murat": { name: "Murat Eren", tr: "Eminönü · Sirkeci yetkilisi", en: "Officer for Eminönü · Sirkeci", ru: "Ответственный по Эминёню", ar: "مسؤول إمين أونو" }
};

const OFFICER_OF_SEMT: Dict<string> = {
  tahtakale: "of-ayse", mahmutpasa: "of-ayse", kucukpazar: "of-ayse",
  kapalicarsi: "of-kemal", nuruosmaniye: "of-kemal", cemberlitas: "of-kemal", beyazit: "of-kemal",
  laleli: "of-derya", aksaray: "of-derya", vefa: "of-derya", unkapani: "of-derya",
  eminonu: "of-murat", misircarsisi: "of-murat", sirkeci: "of-murat", sultanahmet: "of-murat"
};

// ── yer omurgası: han · çarşı · pasaj · iş merkezi · cadde ─────────────────
// units = fiziksel dükkân birimi sayısı (sahibi olsun olmasın).
// mix = o yerde ağırlıklı kategori kimlikleri (CATS id'leri + yeme-içme kodları).
const P = (id: string, name: string, kind: PlaceKind, semt: string, floors: number[], units: number, mix: string[], lat: number, lng: number, sector: Sector): Place =>
  ({ id, name, kind, semt, floors, units, mix, lat, lng, sector });

export const PLACES: Place[] = [
  // Kapalıçarşı ve çevresi
  P("kapalicarsi-carsi", "Kapalıçarşı", "carsi", "kapalicarsi", [0], 3600, ["taki", "hali", "hediyelik", "deri", "bijuteri"], 41.0106, 28.9681, "perakende"),
  P("zincirli", "Zincirli Han", "han", "kapalicarsi", [0, 1], 42, ["taki", "hali"], 41.0111, 28.9689, "perakende"),
  P("cukur", "Çukur Han", "han", "kapalicarsi", [0, 1], 58, ["taki", "bijuteri"], 41.0109, 28.9673, "perakende"),
  P("ic-bedesten", "İç Bedesten", "carsi", "kapalicarsi", [0], 74, ["taki", "hediyelik"], 41.0108, 28.9688, "perakende"),
  P("sandal-bedesteni", "Sandal Bedesteni", "carsi", "kapalicarsi", [0], 96, ["hali", "tekstil"], 41.0110, 28.9683, "perakende"),
  // Tahtakale · Çakmakçılar
  P("yildiz", "Yıldız Han", "han", "tahtakale", [0, 1, 2, 3, 4], 640, ["kilif", "sarj", "poset", "bijuteri"], 41.0165, 28.9689, "toptan"),
  P("buyukvalide", "Büyük Valide Han", "han", "tahtakale", [0, 1, 2], 780, ["kilif", "sarj", "tekstil", "poset"], 41.0158, 28.9673, "toptan"),
  P("buyukyeni", "Büyük Yeni Han", "han", "tahtakale", [0, 1, 2, 3], 320, ["sarj", "kilif", "bijuteri"], 41.0154, 28.9678, "toptan"),
  P("cakmakcilar", "Çakmakçılar Yokuşu", "cadde", "tahtakale", [0], 410, ["poset", "tekstil", "kilif"], 41.0157, 28.9671, "toptan"),
  P("tahtakale-cd", "Tahtakale Caddesi", "cadde", "tahtakale", [0], 520, ["sarj", "kilif", "baharat", "poset"], 41.0161, 28.9685, "toptan"),
  P("hidayet", "Hidayet Han", "han", "tahtakale", [0, 1, 2], 210, ["kilif", "sarj"], 41.0163, 28.9679, "toptan"),
  P("kucukpazar-cd", "Küçükpazar Caddesi", "cadde", "kucukpazar", [0], 340, ["baharat", "poset", "gida"], 41.0182, 28.9640, "toptan"),
  // Mahmutpaşa · Uzunçarşı
  P("kurkcu", "Kürkçü Han", "han", "mahmutpasa", [0, 1, 2], 264, ["tekstil", "poset", "deri"], 41.0122, 28.9695, "toptan"),
  P("mahmutpasa-yokusu", "Mahmutpaşa Yokuşu", "cadde", "mahmutpasa", [0], 620, ["tekstil", "bijuteri", "poset"], 41.0128, 28.9701, "toptan"),
  P("sultan", "Sultan Han", "han", "mahmutpasa", [0, 1, 2, 3], 278, ["poset", "tekstil"], 41.0135, 28.9688, "toptan"),
  P("uzuncarsi", "Uzunçarşı Caddesi", "cadde", "mahmutpasa", [0], 480, ["poset", "sarj", "tekstil"], 41.0138, 28.9692, "toptan"),
  P("astarci", "Astarcı Han", "han", "mahmutpasa", [0, 1, 2], 186, ["tekstil"], 41.0125, 28.9690, "toptan"),
  P("dikranyan", "Dikranyan Han", "han", "mahmutpasa", [0, 1, 2, 3], 240, ["tekstil", "bijuteri"], 41.0131, 28.9697, "toptan"),
  // Nuruosmaniye · Çemberlitaş
  P("sark", "Şark Kahvesi Hanı", "han", "nuruosmaniye", [0, 1], 36, ["deri", "taki"], 41.0096, 28.9705, "perakende"),
  P("nuruosmaniye-cd", "Nuruosmaniye Caddesi", "cadde", "nuruosmaniye", [0], 210, ["taki", "deri", "hali"], 41.0093, 28.9709, "perakende"),
  P("cemberlitas-cd", "Vezirhan Caddesi", "cadde", "cemberlitas", [0], 260, ["hediyelik", "deri", "gida"], 41.0085, 28.9714, "perakende"),
  P("vezir", "Vezir Han", "han", "cemberlitas", [0, 1], 148, ["deri", "tekstil"], 41.0082, 28.9711, "toptan"),
  // Mısır Çarşısı · Eminönü
  P("misir-carsisi", "Mısır Çarşısı", "carsi", "misircarsisi", [0], 86, ["baharat", "gida", "hediyelik"], 41.0165, 28.9707, "perakende"),
  P("eminonu-cd", "Hasırcılar Caddesi", "cadde", "eminonu", [0], 290, ["baharat", "gida", "poset"], 41.0170, 28.9700, "toptan"),
  P("cicek-pasaji-em", "Değirmen Pasajı", "pasaj", "eminonu", [0, 1], 96, ["hediyelik", "bijuteri"], 41.0168, 28.9695, "perakende"),
  // Sirkeci
  P("sirkeci-cd", "Ankara Caddesi", "cadde", "sirkeci", [0], 240, ["hizmet", "gida", "hediyelik"], 41.0139, 28.9773, "hizmet"),
  P("hobyar", "Hobyar İş Merkezi", "is-merkezi", "sirkeci", [0, 1, 2, 3, 4, 5], 300, ["hizmet", "tekstil"], 41.0146, 28.9760, "hizmet"),
  // Sultanahmet
  P("sultanahmet-cd", "Divanyolu Caddesi", "cadde", "sultanahmet", [0], 220, ["hediyelik", "hali", "kitap"], 41.0074, 28.9756, "perakende"),
  P("arasta", "Arasta Çarşısı", "carsi", "sultanahmet", [0], 68, ["hali", "hediyelik", "taki"], 41.0053, 28.9776, "perakende"),
  // Beyazıt · Laleli · Aksaray
  P("sahaflar", "Sahaflar Çarşısı", "carsi", "beyazit", [0], 54, ["kitap", "hediyelik"], 41.0108, 28.9663, "perakende"),
  P("beyazit-cd", "Beyazıt Çarşı Caddesi", "cadde", "beyazit", [0], 320, ["tekstil", "bijuteri", "kitap"], 41.0104, 28.9640, "toptan"),
  P("laleli-tekstil", "Laleli Tekstil Merkezi", "is-merkezi", "laleli", [0, 1, 2, 3, 4, 5, 6], 980, ["tekstil", "deri"], 41.0100, 28.9556, "toptan"),
  P("laleli-cd", "Ordu Caddesi", "cadde", "laleli", [0], 460, ["tekstil", "deri", "hizmet"], 41.0097, 28.9570, "toptan"),
  P("aksaray-carsi", "Aksaray Kapalı Çarşı", "carsi", "aksaray", [0, 1], 380, ["tekstil", "bijuteri", "gida"], 41.0069, 28.9502, "toptan"),
  P("aksaray-otogar", "Aksaray Nakliyeciler Sitesi", "is-merkezi", "aksaray", [0, 1], 190, ["hizmet"], 41.0062, 28.9515, "hizmet"),
  // Unkapanı · Vefa
  P("imc", "Unkapanı İMÇ Blokları", "is-merkezi", "unkapani", [0, 1, 2], 720, ["hizmet", "tekstil", "kitap"], 41.0208, 28.9610, "toptan"),
  P("vefa-cd", "Şehzadebaşı Caddesi", "cadde", "vefa", [0], 260, ["gida", "kitap", "hizmet"], 41.0142, 28.9578, "perakende"),
  P("vefa-atolye", "Vefa Atölyeler Hanı", "han", "vefa", [0, 1, 2], 240, ["deri", "tekstil", "imalat"], 41.0138, 28.9585, "imalat")
];

// Han yönetimiyle anlaşma yapılan yerlerde kapsama tek günde kapanır.
export const BULK_APPROVED: string[] = ["yildiz", "buyukvalide", "kurkcu", "laleli-tekstil", "imc", "sultan", "hidayet", "zincirli", "misir-carsisi", "arasta"];

export const PLACE_KINDS: Record<PlaceKind, L10n> = {
  han: { tr: "Han", en: "Han", ru: "Хан", ar: "خان" },
  carsi: { tr: "Çarşı", en: "Bazaar", ru: "Базар", ar: "سوق" },
  pasaj: { tr: "Pasaj", en: "Arcade", ru: "Пассаж", ar: "ممر تجاري" },
  cadde: { tr: "Cadde", en: "Street", ru: "Улица", ar: "شارع" },
  "is-merkezi": { tr: "İş merkezi", en: "Business centre", ru: "Бизнес-центр", ar: "مركز أعمال" }
};

// ── yeme-içme ve ek kategoriler (CATS'e ek) ───────────────────────────────
export const CATS_EXTRA: (L10n & { id: string })[] = [
  { id: "gida", tr: "Gıda · kuruyemiş", en: "Grocery · nuts", ru: "Продукты · орехи", ar: "بقالة · مكسرات" },
  { id: "kitap", tr: "Kitap · kırtasiye", en: "Books · stationery", ru: "Книги · канцелярия", ar: "كتب · قرطاسية" },
  { id: "hizmet", tr: "Hizmet · nakliye · döviz", en: "Services · freight · exchange", ru: "Услуги", ar: "خدمات" },
  { id: "imalat", tr: "İmalat · atölye", en: "Workshop", ru: "Мастерская", ar: "ورشة" }
];

// ── isim havuzları ────────────────────────────────────────────────────────
const N1 = ["Emre", "Hazer", "Sedef", "Şahin", "Zenne", "Kalpakçı", "Anadolu", "Mahmut", "Nur", "Öz", "Yıldız", "Sultan", "Deniz",
  "Barış", "Kardeşler", "Vefa", "Ege", "Toros", "Gülhan", "Beyaz", "Altın", "Rüya", "Simge", "Şafak", "Bereket", "Umut",
  "Selçuk", "Aslan", "Ceylan", "Doğan", "Efe", "Ferhat", "Güven", "Hilal", "İnci", "Kaya", "Levent", "Melek", "Nazlı",
  "Onur", "Pınar", "Rana", "Sarp", "Tuna", "Uğur", "Volkan", "Yaman", "Zeynep", "Çınar", "Berrak", "Murat", "Sinan"];
// İkinci kelime KATEGORİYE bağlıdır: kategoriden bağımsız seçilince
// "Poşet · ambalaj" kategorisinde "Saat Mağazası" çıkıyor ve veri güvenilmez görünüyor.
const N2_BY_CAT: Dict<string[]> = {
  kilif: ["Aksesuar", "Telefon Aksesuar", "Kılıf", "Mobil Aksesuar", "GSM", "Teknoloji Aksesuar"],
  sarj: ["Elektronik", "GSM", "Şarj & Kablo", "Teknoloji", "Mobil Aksesuar", "Elektrik"],
  tekstil: ["Tekstil", "Kumaş", "Konfeksiyon", "Havlu", "Ev Tekstil", "Örme", "Çorap"],
  poset: ["Ambalaj", "Poşet", "Karton", "Plastik", "Etiket", "Paketleme"],
  taki: ["Kuyum", "Altın", "Mücevher", "Sarraf", "Pırlanta"],
  bijuteri: ["Bijuteri", "Aksesuar", "Takı", "Boncuk", "Saç Aksesuar"],
  hali: ["Halı", "Kilim", "Yer Döşeme", "El Dokuma"],
  deri: ["Deri", "Çanta", "Ayakkabı", "Kemer & Cüzdan", "Saraciye"],
  baharat: ["Baharat", "Kuruyemiş", "Çay & Bitki", "Lokum", "Aktar"],
  hediyelik: ["Hediyelik", "Çini & Seramik", "Souvenir", "El Sanatları", "Züccaciye"],
  gida: ["Gıda", "Bakliyat", "Şarküteri", "Zeytin & Turşu", "Kuru Gıda"],
  kitap: ["Kitap", "Kırtasiye", "Sahaf", "Ofis Malzeme"],
  hizmet: ["Nakliyat", "Kargo & Paketleme", "Döviz", "Matbaa", "Lojistik"],
  imalat: ["İmalat", "Atölye", "Fason", "Sanayi", "Üretim"]
};

const N3 = ["Ticaret", "Ltd. Şti.", "ve Oğulları", "Kollektif", "Mağazası", "Toptan", "İhracat", "Sanayi", "Koleksiyon", ""];
const SERV = ["Kargo & Paketleme", "Nakliyat", "Döviz Bürosu", "Gümrük Müşavirliği", "Matbaa", "Tercüme Bürosu",
  "Kuru Temizleme", "Terzi", "Tamir Atölyesi", "Fotokopi & Kırtasiye"];

// K5 · esnaf serbest metin yazmaz, bu sözlükten seçer — o yüzden sözlüğün
// dört dilde karşılığı olmak ZORUNDA. Kanonik anahtar Türkçe metnin kendisidir;
// kayıtlarda Türkçe durur, ekranda groupLabel() ile yerelleşir.
const GW_L10N: Dict<Partial<Record<Lang, string>>> = {
  "Silikon kılıf": { en: "Silicone case", ru: "Силиконовый чехол", ar: "غطاء سيليكون" },
  "Cüzdan kılıf": { en: "Wallet case", ru: "Чехол-кошелёк", ar: "غطاء محفظة" },
  "Ekran koruyucu": { en: "Screen protector", ru: "Защитное стекло", ar: "واقي شاشة" },
  "Tablet kılıf": { en: "Tablet case", ru: "Чехол для планшета", ar: "غطاء تابلت" },
  "Telefon standı": { en: "Phone stand", ru: "Подставка для телефона", ar: "حامل هاتف" },
  "Powerbank": { en: "Power bank", ru: "Повербанк", ar: "بطارية متنقلة" },
  "Kablo · adaptör": { en: "Cable · adapter", ru: "Кабель · адаптер", ar: "كابل · محوّل" },
  "Kulaklık": { en: "Headphones", ru: "Наушники", ar: "سماعات" },
  "Araç şarj": { en: "Car charger", ru: "Автозарядка", ar: "شاحن سيارة" },
  "Şarj başlığı": { en: "Charger plug", ru: "Зарядный блок", ar: "رأس شاحن" },
  "Havlu · bornoz": { en: "Towel · robe", ru: "Полотенце · халат", ar: "منشفة · روب" },
  "Nevresim": { en: "Bed linen", ru: "Постельное бельё", ar: "أغطية سرير" },
  "Tişört · basic": { en: "T-shirt · basics", ru: "Футболки · базовое", ar: "تي شيرت · أساسي" },
  "Şal · eşarp": { en: "Shawl · scarf", ru: "Шаль · платок", ar: "شال · وشاح" },
  "Çorap": { en: "Socks", ru: "Носки", ar: "جوارب" },
  "Pijama": { en: "Pyjamas", ru: "Пижамы", ar: "بيجامة" },
  "Kumaş top": { en: "Fabric rolls", ru: "Рулоны ткани", ar: "لفّات أقمشة" },
  "Baskılı poşet": { en: "Printed bags", ru: "Печатные пакеты", ar: "أكياس مطبوعة" },
  "Karton kutu": { en: "Cardboard boxes", ru: "Картонные коробки", ar: "علب كرتون" },
  "Kraft çanta": { en: "Kraft bags", ru: "Крафт-пакеты", ar: "أكياس كرافت" },
  "Etiket · bant": { en: "Labels · tape", ru: "Этикетки · скотч", ar: "ملصقات · شريط" },
  "Streç · balonlu naylon": { en: "Stretch · bubble wrap", ru: "Стрейч · пузырчатая плёнка", ar: "ستريتش · فقاعات" },
  "Yüzük": { en: "Rings", ru: "Кольца", ar: "خواتم" },
  "Kolye": { en: "Necklaces", ru: "Ожерелья", ar: "قلائد" },
  "Bilezik": { en: "Bracelets", ru: "Браслеты", ar: "أساور" },
  "Küpe": { en: "Earrings", ru: "Серьги", ar: "أقراط" },
  "Altın kaplama set": { en: "Gold-plated sets", ru: "Позолоченные наборы", ar: "أطقم مطلية بالذهب" },
  "Saç aksesuarı": { en: "Hair accessories", ru: "Аксессуары для волос", ar: "إكسسوارات شعر" },
  "Broş": { en: "Brooches", ru: "Брошки", ar: "بروش" },
  "Çelik takı": { en: "Steel jewellery", ru: "Стальные украшения", ar: "حلي ستيل" },
  "Boncuk set": { en: "Bead sets", ru: "Наборы бусин", ar: "أطقم خرز" },
  "Anahtarlık": { en: "Keyrings", ru: "Брелоки", ar: "سلاسل مفاتيح" },
  "Kilim": { en: "Kilim", ru: "Килим", ar: "كليم" },
  "Yün halı": { en: "Wool rug", ru: "Шерстяной ковёр", ar: "سجاد صوف" },
  "İpek halı": { en: "Silk rug", ru: "Шёлковый ковёр", ar: "سجاد حرير" },
  "Yolluk": { en: "Runner rug", ru: "Дорожка", ar: "سجاد ممرات" },
  "Sumak": { en: "Soumak", ru: "Сумах", ar: "سوماك" },
  "Deri çanta": { en: "Leather bags", ru: "Кожаные сумки", ar: "حقائب جلد" },
  "Kemer": { en: "Belts", ru: "Ремни", ar: "أحزمة" },
  "Cüzdan": { en: "Wallets", ru: "Кошельки", ar: "محافظ" },
  "Ceket": { en: "Jackets", ru: "Куртки", ar: "جاكيتات" },
  "Ayakkabı": { en: "Shoes", ru: "Обувь", ar: "أحذية" },
  "Baharat": { en: "Spices", ru: "Специи", ar: "بهارات" },
  "Kuruyemiş": { en: "Nuts", ru: "Орехи", ar: "مكسّرات" },
  "Çay · bitki": { en: "Tea · herbs", ru: "Чай · травы", ar: "شاي · أعشاب" },
  "Lokum": { en: "Turkish delight", ru: "Лукум", ar: "حلقوم" },
  "Safran · özel": { en: "Saffron · specials", ru: "Шафран · особое", ar: "زعفران · خاص" },
  "Çini · seramik": { en: "Tiles · ceramics", ru: "Изникская керамика", ar: "قيشاني · سيراميك" },
  "Nazar boncuk": { en: "Evil-eye beads", ru: "Бусины назар", ar: "خرز العين" },
  "Minyatür": { en: "Miniatures", ru: "Миниатюры", ar: "منمنمات" },
  "Magnet": { en: "Magnets", ru: "Магниты", ar: "مغناطيس" },
  "El işi kutu": { en: "Handmade boxes", ru: "Шкатулки ручной работы", ar: "علب يدوية" },
  "Bakliyat": { en: "Pulses", ru: "Бобовые", ar: "بقوليات" },
  "Zeytin · turşu": { en: "Olives · pickles", ru: "Оливки · соленья", ar: "زيتون · مخلل" },
  "Peynir · şarküteri": { en: "Cheese · deli", ru: "Сыр · деликатесы", ar: "أجبان · مقددات" },
  "Kuru meyve": { en: "Dried fruit", ru: "Сухофрукты", ar: "فواكه مجففة" },
  "Reçel · bal": { en: "Jam · honey", ru: "Джем · мёд", ar: "مربى · عسل" },
  "Sahaf kitap": { en: "Second-hand books", ru: "Букинистика", ar: "كتب مستعملة" },
  "Kırtasiye": { en: "Stationery", ru: "Канцелярия", ar: "قرطاسية" },
  "Ofis malzemesi": { en: "Office supplies", ru: "Товары для офиса", ar: "مستلزمات مكتب" },
  "Defter · ajanda": { en: "Notebooks · diaries", ru: "Блокноты · ежедневники", ar: "دفاتر · أجندة" },
  "Poster · harita": { en: "Posters · maps", ru: "Постеры · карты", ar: "ملصقات · خرائط" },
  "Kargo": { en: "Shipping", ru: "Доставка", ar: "شحن" },
  "Paketleme": { en: "Packing", ru: "Упаковка", ar: "تغليف" },
  "Gümrük evrakı": { en: "Customs paperwork", ru: "Таможенные документы", ar: "مستندات جمركية" },
  "Tercüme": { en: "Translation", ru: "Перевод", ar: "ترجمة" },
  "Baskı": { en: "Printing", ru: "Печать", ar: "طباعة" },
  "Fason dikim": { en: "Contract sewing", ru: "Пошив на заказ", ar: "خياطة تعاقدية" },
  "Deri işleme": { en: "Leather working", ru: "Обработка кожи", ar: "معالجة الجلود" },
  "Kalıp": { en: "Moulds · patterns", ru: "Формы · лекала", ar: "قوالب" },
  "Montaj": { en: "Assembly", ru: "Сборка", ar: "تجميع" }
};

export function groupLabel(word: string, lang?: Lang | string): string {
  if (!word) return "";
  if (!lang || lang === "tr") return word;
  const e = GW_L10N[word] as Dict<string> | undefined;
  return (e && e[lang]) || word;
}

const GROUP_WORDS: Dict<string[]> = {
  kilif: ["Silikon kılıf", "Cüzdan kılıf", "Ekran koruyucu", "Tablet kılıf", "Telefon standı"],
  sarj: ["Powerbank", "Kablo · adaptör", "Kulaklık", "Araç şarj", "Şarj başlığı"],
  tekstil: ["Havlu · bornoz", "Nevresim", "Tişört · basic", "Şal · eşarp", "Çorap", "Pijama", "Kumaş top"],
  poset: ["Baskılı poşet", "Karton kutu", "Kraft çanta", "Etiket · bant", "Streç · balonlu naylon"],
  taki: ["Yüzük", "Kolye", "Bilezik", "Küpe", "Altın kaplama set"],
  bijuteri: ["Saç aksesuarı", "Broş", "Çelik takı", "Boncuk set", "Anahtarlık"],
  hali: ["Kilim", "Yün halı", "İpek halı", "Yolluk", "Sumak"],
  deri: ["Deri çanta", "Kemer", "Cüzdan", "Ceket", "Ayakkabı"],
  baharat: ["Baharat", "Kuruyemiş", "Çay · bitki", "Lokum", "Safran · özel"],
  hediyelik: ["Çini · seramik", "Nazar boncuk", "Minyatür", "Magnet", "El işi kutu"],
  gida: ["Bakliyat", "Zeytin · turşu", "Peynir · şarküteri", "Kuru meyve", "Reçel · bal"],
  kitap: ["Sahaf kitap", "Kırtasiye", "Ofis malzemesi", "Defter · ajanda", "Poster · harita"],
  hizmet: ["Kargo", "Paketleme", "Gümrük evrakı", "Tercüme", "Baskı"],
  imalat: ["Fason dikim", "Deri işleme", "Kalıp", "Montaj", "Baskı"],
};

const LANG_SETS: Lang[][] = [["tr"], ["tr"], ["tr"], ["tr", "en"], ["tr", "en"], ["tr", "en", "ru"], ["tr", "en", "ar"], ["tr", "ar"], ["tr", "en", "ru", "ar"]];

// ── kayıt üretimi ─────────────────────────────────────────────────────────
// Kademe dağılımı gerçeğe yakın: çoğu kayıt henüz açılmamış (A), az kısmı aktif (D).
// Onay hattı dağılımı: editör kuyruğu her zaman doludur.
// Han yönetimiyle toplu onay yapılan yerlerde neredeyse her kayıt onaylıdır;
// diğerlerinde saha turu daha yavaş ilerler ve esnaf beyanı oranı yüksektir.
const STATUS_MIX_BULK: [string, number][] = [["beyan", 8], ["onayli", 58], ["aktif", 34]];
const STATUS_MIX_FIELD: [string, number][] = [["beyan", 38], ["onayli", 47], ["aktif", 15]];

function corridorOf(r: Rand, place: Place, _floor: number): string | null {
  if (place.kind === "cadde") return null;
  const letters = ["A", "B", "C", "D", "E"];
  return letters[int(r, 0, Math.min(4, Math.max(1, Math.round(place.units / 120))))];
}

function makeName(r: Rand, cat: string, _sector: Sector): string {
  if (cat === "hizmet") return pick(r, N1) + " " + pick(r, SERV);
  const words = N2_BY_CAT[cat] || N2_BY_CAT.hediyelik;
  return [pick(r, N1), pick(r, words), pick(r, N3)].filter(Boolean).join(" ");
}

function bandFor(r: Rand, cat: string): Band {
  const bases: Dict<number> = { kilif: 25, sarj: 60, tekstil: 45, poset: 8, taki: 900, bijuteri: 20, hali: 3200, deri: 320,
    baharat: 90, hediyelik: 60, gida: 70, kitap: 40, hizmet: 250, imalat: 150, yemek: 180, kahve: 45, tatli: 220 };
  const base = bases[cat] ?? 50;
  const lo = Math.round(base * (0.7 + r() * 0.5));
  return [lo, Math.round(lo * (1.8 + r() * 2.4))];
}

function build(): { records: ShopRecord[]; unitsByPlace: Dict<UnitRef[]> } {
  const r = rng(20260818);
  const records: ShopRecord[] = [];
  const unitsByPlace: Dict<UnitRef[]> = {};
  let n = 0;
  // Kayıtları birim sayısına göre dağıt: 2.000 kayıt / ~15.000 birim ≈ %13 kapsama.
  const totalUnits = PLACES.reduce((t, p) => t + p.units, 0);
  const target = 2000;

  PLACES.forEach(place => {
    const bulk = BULK_APPROVED.includes(place.id);
    const share = Math.max(6, Math.round((place.units / totalUnits) * target));
    const occupied: Dict<number> = {};
    unitsByPlace[place.id] = [];
    for (let i = 0; i < share; i++) {
      const floor = pick(r, place.floors);
      const door = String(floor * 100 + int(r, 1, Math.max(12, Math.round(place.units / (place.floors.length || 1) / 6))));
      const key = floor + ":" + door;
      if (occupied[key]) continue;
      occupied[key] = 1;
      const cat = pick(r, place.mix);
      const sector = cat === "hizmet" ? "hizmet"
        : cat === "imalat" ? "imalat"
        : place.sector === "toptan" ? (r() < 0.78 ? "toptan" : "perakende")
        : (r() < 0.82 ? "perakende" : "toptan");
      const status = pickW(r, bulk ? STATUS_MIX_BULK : STATUS_MIX_FIELD);
      const approvedVia = status === "beyan" ? null : bulk ? "han" : (r() < 0.7 ? "saha" : "esnaf");
      const rich = status === "aktif";
      const known = status === "aktif" || status === "onayli";
      const declared = status === "beyan";   // fiyat ve teklif kapalı
      const words = GROUP_WORDS[cat] || GROUP_WORDS.hediyelik;
      const gcount = rich ? int(r, 3, Math.min(5, words.length)) : int(r, 1, 3);
      const band = declared ? null : bandFor(r, cat);
      const id = "r" + (++n);
      const groups: GroupEntry[] = [];
      // Grup çeşitleri toplam çeşitten bağımsız üretilirse tek grup depônun 10 katını
      // iddia edebiliyordu. skuCount önce belirlenir, gruplar onun bölüşümüdür.
      const skuCount = rich ? int(r, 180, 4200) : int(r, 20, 900);
      for (let g = 0; g < gcount; g++) {
        const w = words[(g + int(r, 0, words.length - 1)) % words.length];
        if (groups.some(x => x.name === w)) continue;
        const lo = band ? Math.round(band[0] * (0.85 + r() * 0.6)) : 0;
        groups.push({ name: w, lines: 0, lo, hi: lo ? Math.round(lo * (1.4 + r() * 1.6)) : 0 });
      }
      // Listelenen gruplar deponun en az yarısını, en çok tamamını kaplar; kalanı sonuncuya gider.
      if (groups.length) {
        const share = Math.max(groups.length, Math.round(skuCount * (0.5 + r() * 0.5)));
        const weights = groups.map(() => 0.4 + r());
        const wsum = weights.reduce((a, b) => a + b, 0);
        let used = 0;
        groups.forEach((gr, i) => {
          if (i === groups.length - 1) { gr.lines = Math.max(1, share - used); return; }
          gr.lines = Math.max(1, Math.round((weights[i] / wsum) * share));
          used += gr.lines;
        });
      }
      const moq = sector === "toptan" ? pick(r, [6, 10, 12, 24, 50, 100, 144, 500]) : 1;
      // Faz 0.1 · sektör tek değerli değil YETENEK KÜMESİ: çarşıda aynı dükkân sabah
      // toptancıya, öğleden sonra turiste satar. Her mod için ayrı fiyat ve minimum.
      const quoteBased = sector === "hizmet" || sector === "imalat";
      const sells = quoteBased ? []
        : sector === "toptan" ? ["toptan"].concat(r() < 0.42 ? ["perakende"] : [])
        : ["perakende"].concat(r() < 0.26 ? ["toptan"] : []);
      // Perakende rafta fiyat toptan birim fiyatının üstünde durur.
      const retailBand = band ? [Math.round(band[0] * (1.6 + r() * 0.4)), Math.round(band[1] * (1.9 + r() * 0.5))] : null;
      const wMoq = sells.includes("toptan") ? (sector === "toptan" ? moq : pick(r, [12, 24, 50, 100])) : null;
      // Faz 0.3 · toptancı adet saymaz koli sayar.
      const carton = sells.includes("toptan") ? { inner: pick(r, [6, 10, 12, 24, 25, 50, 100]), unit: "adet" } : null;
      records.push({
        id, place: place.id, semt: place.semt, floor, door,
        corridor: corridorOf(r, place, floor),
        name: makeName(r, cat, sector),
        // İkincil kategori seyrek olmalı: yerin tüm karışımını her kayda vermek
        // "her dükkân her şeyi satıyor" yanılsaması üretir ve aramayı çöpe çevirir.
        cat, cats: r() < 0.18 ? [cat, pick(r, place.mix.filter(c => c !== cat) || [cat])].filter(Boolean) : [cat],
        sector, status: status as ShopRecord["status"], approvedVia: approvedVia as ShopRecord["approvedVia"], bulk,
        // Faz 0.1/0.3/0.4 · ticaret yeteneği ve mod başına koşullar
        trade: {
          sells, quoteBased,
          perakende: sells.includes("perakende") ? { band: retailBand as Band | null, moq: 1 } : null,
          toptan: sells.includes("toptan") ? { band, moq: wMoq, carton } : null,
          // hizmet/imalat: adet değil iş tanımı — fiyat bandı kalıbına sokulmaz
          scope: quoteBased ? (GROUP_WORDS[cat] || []).slice(0, 4) : null
        },
        // K11 · alan kaynağı: üretilmiş veri gerçek gibi gösterilmez
        src: {
          band: "tahmini", moq: "tahmini", groups: "tahmini", resp: "tahmini", rating: "tahmini",
          address: status === "beyan" ? "esnaf" : "yetkili"
        },
        // Faz 0.5 · B2C ayrıntıları
        shipsHotel: sells.includes("perakende") && r() < 0.3,
        giftWrap: sells.includes("perakende") && r() < 0.42,
        officer: OFFICER_OF_SEMT[place.semt] || "of-kemal",
        langs: pick(r, LANG_SETS),
        moq, moqFlex: r() < 0.6,
        band, groups,
        skuCount,
        isProducer: sector === "imalat" || (sector === "toptan" && r() < 0.34),
        shipsAbroad: sector === "toptan" && r() < 0.42,
        taxFree: sector === "perakende" && r() < 0.28,
        invoice: r() < 0.82,
        payments: ["cash"].concat(r() < 0.55 ? ["card"] : []).concat(sector === "toptan" && r() < 0.7 ? ["iban"] : []),
        // yanıt performansı yalnız kaydı açık olanlarda ölçülür
        respMins: rich ? int(r, 8, 90) : (known ? int(r, 40, 240) : null),
        respRate: rich ? int(r, 76, 99) : (known ? int(r, 45, 85) : null),
        rating: rich ? Math.round((3.8 + r() * 1.2) * 10) / 10 : (known && r() < 0.45 ? Math.round((3.5 + r() * 1.4) * 10) / 10 : null),
        reviews: rich ? int(r, 6, 320) : (known ? int(r, 0, 14) : 0),
        updatedDays: rich ? int(r, 0, 20) : status === "onayli" ? int(r, 5, 140) : int(r, 0, 30),
        photos: rich ? int(r, 3, 9) : status === "onayli" ? int(r, 0, 3) : 0,
        tel: "9053" + String(20000000 + n * 7).slice(0, 8),
        distance: int(r, 40, 1400),
        curated: null
      });
      unitsByPlace[place.id].push({ floor, door, recordId: id });
    }
  });

  // Elle yazılmış 11 dükkân en üst kademe olarak havuza girer; sayfaları zengin veriyle çalışır.
  const placeOfHan: Dict<string> = { yildiz: "yildiz", buyukvalide: "buyukvalide", zincirli: "zincirli", kurkcu: "kurkcu", sultan: "sultan", sark: "sark" };
  const areaPlace: Dict<string> = { kapalicarsi: "kapalicarsi-carsi", misircarsisi: "misir-carsisi", nuruosmaniye: "nuruosmaniye-cd", tahtakale: "tahtakale-cd", mahmutpasa: "mahmutpasa-yokusu" };
  // 11 zengin kaydın çeşit grubu ve fiyat bandı UYDURULMAZ: kendi ürün listesinden türer.
  // Bu olmadan kayıtlar aramada bandsız/gruppsuz görünür, teklif motoru da 40 TL varsayar.
  const curatedTrade = (s: CuratedStore, mode: Mode | string) => {
    const ps = s.products || [];
    if (!ps.length) return { band: null, groups: [], sku: 0 };
    const key = mode === "toptan" ? "wholesale" : "retail";
    const vals = ps.map((p) => Number(p[key] || p.retail || 0)).filter((v) => v > 0);
    if (!vals.length) return { band: null, groups: [], sku: 0 };
    const words = GROUP_WORDS[(s.cats || [])[0]] || [];
    // Ürünler adlarına göre sözlükteki gruplara oturur; oturmayan kendi adıyla grup olur.
    const buckets = new Map<string, GroupEntry>();
    ps.forEach(p => {
      const nm = String(p.tr || "");
      const hit = words.find(w => w.split(" ").some(tok => tok.length > 3 && nm.toLocaleLowerCase("tr").includes(tok.toLocaleLowerCase("tr"))));
      const g = hit || nm;
      const v = Number(p[key] || p.retail || 0);
      const b = buckets.get(g) || { name: g, lines: 0, lo: Infinity, hi: 0 };
      b.lines += 1; if (v > 0) { b.lo = Math.min(b.lo, v); b.hi = Math.max(b.hi, v); }
      buckets.set(g, b);
    });
    const groups = [...buckets.values()].map(b => ({
      name: b.name,
      lines: Math.max(6, b.lines * 7),                 // vitrindeki çeşit, listelenen satır değil
      lo: b.lo === Infinity ? 0 : Math.round(b.lo),
      hi: Math.round(b.hi || b.lo)
    }));
    return {
      band: [Math.round(Math.min.apply(null, vals)), Math.round(Math.max.apply(null, vals))],
      groups,
      sku: groups.reduce((a, g) => a + g.lines, 0)
    };
  };

  STORES.forEach(s => {
    const hanRec = s.han ? HANS.find(x => x.id === s.han) : null;
    const place = (s.han && placeOfHan[s.han]) || areaPlace[s.area || (hanRec ? hanRec.area : "")] || "kapalicarsi-carsi";
    const pl = PLACES.find(p => p.id === place);
    records.unshift({
      id: s.id, place, semt: pl ? pl.semt : "kapalicarsi", floor: s.floor || 0, door: String(s.no),
      corridor: null, name: s.name, cat: (s.cats || [])[0], cats: s.cats || [],
      sector: s.trade && s.trade.type === "toptan" ? "toptan" : s.trade && s.trade.type === "ikisi" ? "toptan" : "perakende",
      status: "aktif" as const, approvedVia: "saha" as const, bulk: true, officer: OFFICER_OF_SEMT[pl ? pl.semt : "kapalicarsi"] || "of-kemal", langs: (s.commerce || {}).languages || ["tr"],
      moq: ((s.trade || {}).minOrder || {}).qty || 1, moqFlex: !!(s.trade || {}).moqFlexible,
      trade: ((): Trade => {
        const t: Partial<Trade> = s.trade || {}, type = t.type || "perakende";
        // 0.1 · yetenek kümesi: mod tek değerli değil. Perakende fiyatı olan kayıt
        // perakende de satar; "ikisi" ayrı bir tür değil, iki yeteneğin birlikte olması.
        const hasRetail = (s.products || []).some(p => Number(p.retail) > 0);
        const hasWhole = (s.products || []).some(p => Number(p.wholesale) > 0);
        const sells = type === "ikisi" ? ["toptan", "perakende"]
          : [type].concat(type === "toptan" && hasRetail ? ["perakende"] : [])
                  .concat(type === "perakende" && hasWhole && ((t.minOrder || {}).qty ?? 0) > 1 ? ["toptan"] : []);
        const wq = ((t.minOrder || {}).qty) || 12;
        const wB = curatedTrade(s, "toptan"), rB = curatedTrade(s, "perakende");
        return {
          sells, quoteBased: false,
          perakende: sells.includes("perakende") ? { band: rB.band as Band | null, moq: 1 } : null,
          toptan: sells.includes("toptan") ? { band: wB.band as Band | null, moq: wq, carton: { inner: wq, unit: "adet" } } : null,
          scope: null
        };
      })(),
      src: { band: "esnaf", moq: "esnaf", groups: "esnaf", resp: "yetkili", rating: "yetkili", address: "yetkili" },
      shipsHotel: !!(s.exportInfo || {}).shipsAbroad, giftWrap: true,
      band: curatedTrade(s, (s.trade || {}).type === "perakende" ? "perakende" : "toptan").band as Band | null,
      groups: curatedTrade(s, (s.trade || {}).type === "perakende" ? "perakende" : "toptan").groups,
      skuCount: curatedTrade(s, "toptan").sku,
      isProducer: !!(s.trade || {}).isProducer,
      shipsAbroad: !!(s.exportInfo || {}).shipsAbroad,
      taxFree: !!(s.commerce || {}).taxFree, invoice: !!(s.commerce || {}).invoice,
      payments: (s.commerce || {}).payments || ["cash"],
      respMins: (s.trust || {}).respMins || null, respRate: (s.trust || {}).respRate || null,
      rating: s.rating || null, reviews: s.reviews || 0,
      updatedDays: 1, photos: 6, tel: s.tel, distance: s.distance || 200,
      curated: s.id
    });
  });

  return { records, unitsByPlace };
}

// Tazelik kuralı: SETTINGS.freshDays gün dokunulmayan aktif kayıt "onaylı"ya,
// iki katı geçince "askıya" iner. Kural koda gömülü değil, ayardan okunur.
function applyFreshness(records: ShopRecord[]): ShopRecord[] {
  const fresh = SETTINGS.freshDays.value || 90;
  records.forEach(r => {
    if (r.status === "aktif" && r.updatedDays > fresh) r.status = "onayli";
    if ((r.status === "onayli" || r.status === "aktif") && r.updatedDays > fresh * 2) r.status = "askida";
  });
  return records;
}

// Kullanıcı bildirimi: aynı kayıt için üç "burada değil / kapalı" bildirimi
// kaydı askıya alır ve yetkili kuyruğuna düşürür.
export const REPORT_THRESHOLD = 3;
export function applyReports(reportsByRecord: Dict<number>): string[] {
  const out: string[] = [];
  Object.keys(reportsByRecord || {}).forEach(id => {
    if ((reportsByRecord[id] || 0) >= REPORT_THRESHOLD) {
      const rec = RECORDS.find(r => r.id === id);
      if (rec && rec.status !== "askida") { rec.status = "askida"; out.push(id); }
    }
  });
  return out;
}

// E2 · Edit\u00f6r\u00fcn kararlar\u0131 `han-approvals-v1`'e yaz\u0131l\u0131r. Al\u0131c\u0131 taraf\u0131 da ayn\u0131
// kayd\u0131 okur: onaylanan kay\u0131t aramada y\u00fckselir, ask\u0131ya al\u0131nan g\u00f6r\u00fcnmez olur.
// Tek merge noktas\u0131 \u2014 Web, Edit\u00f6r ve Panel ayn\u0131 fonksiyonu \u00e7a\u011f\u0131r\u0131r.
// Omurgaya kayıt eklemenin tek yolu. Yer sayacını da günceller: bir birime
// kayıt açıldıysa o yerin kapsaması değişmiş demektir.
export function addRecord(rec: ShopRecord): ShopRecord | null {
  if (!rec || !rec.id || RECORDS.some(r => r.id === rec.id)) return null;
  RECORDS.push(rec);
  const ui = UNIT_INDEX[rec.place];
  if (ui && !ui.some(u => String(u.door) === String(rec.door) && u.floor === rec.floor)) {
    ui.push({ floor: rec.floor, door: rec.door, recordId: rec.id });
  }
  return rec;
}

// Sahada açılan kayıtlar kalıcı bir anahtarda durur. Her doküman (Web · Editör ·
// Panel) kendi modül örneğini yüklediği için merge'ü her biri açılışta çağırır —
// tek yerde yazılmış olması yetmez, üç tarafın da okuması gerekir.
export const DRAFT_KEY = "han-panel-drafts";
export function loadDrafts(onAdd?: (rec: ShopRecord) => void): ShopRecord[] {
  const out: ShopRecord[] = [];
  const drafts = readKey<ShopRecord[]>(DRAFT_KEY, []);
  drafts.forEach((d) => {
    const added = addRecord(d);
    if (added) { out.push(added); if (onAdd) onAdd(added); }
  });
  return out;
}

export function applyApprovals(log: Dict<{ status?: string; via?: string; officer?: string; at?: number }>): string[] {
  const out: string[] = [];
  Object.keys(log || {}).forEach(id => {
    const dec = log[id], rec = RECORDS.find(r => r.id === id);
    if (!rec || !dec || !dec.status) return;
    if (rec.status === dec.status) return;
    rec.status = dec.status as ShopRecord["status"];
    rec.approvedVia = (dec.via as ApprovalVia) || rec.approvedVia;
    if (dec.officer) rec.officer = dec.officer;
    if (dec.status === "onayli" || dec.status === "aktif") rec.updatedDays = 0;
    rec.src = Object.assign({}, rec.src, dec.status === "askida" ? {} : { address: "yetkili" });
    out.push(id);
  });
  return out;
}

const built = build();
export const RECORDS = applyFreshness(built.records);
export const UNIT_INDEX = built.unitsByPlace;

// ── türetilmiş özetler ────────────────────────────────────────────────────
// Sponsorluk aktif ve yanıt performansı eşiğin üstünde olan kayıtlara verilir;
// performans düşerse yerleşim otomatik durur (paused).
export const SPONSORS: Sponsor[] = (() => {
  const out: Sponsor[] = [];
  const r = rng(90210);
  const eligible = RECORDS.filter(x => x.status === "aktif" && (x.respRate || 0) >= 85 && (x.groups || []).length >= 2);
  const byCat: Dict<ShopRecord[]> = {};
  eligible.forEach(x => { (byCat[x.cat] = byCat[x.cat] || []).push(x); });
  Object.keys(byCat).forEach(cat => {
    byCat[cat].slice(0, 2).forEach((rec, i) => {
      out.push({
        recordId: rec.id, kind: (i === 0 ? "kategori" : "yer") as Sponsor["kind"], cat, place: rec.place,
        until: "30.09.2026", paused: (rec.respRate || 0) < 90 && r() < 0.35
      });
    });
  });
  return out;
})();

export function sponsorsFor(kind: Sponsor["kind"], key: string): (ShopRecord & { sponsor: Sponsor })[] {
  if (!SETTINGS.showSponsored.value) return [];
  return SPONSORS.filter(s => s.kind === kind && !s.paused && (kind === "kategori" ? s.cat === key : s.place === key))
    .map((s) => Object.assign({ sponsor: s }, RECORDS.find((r) => r.id === s.recordId) || {}) as ShopRecord & { sponsor: Sponsor })
    .filter((x) => x.id);
}

export function recordsOfPlace(id: string): ShopRecord[] { return RECORDS.filter(x => x.place === id); }

// ── C1 · "şu an açık mı" + fiziksel erişim ────────────────────────────────
// Çarşı gerçeği: hanlar pazar kapalı, cuma namazı arası var, 4. kat asansörsüz olabilir.
// Anahtarlar PLACE_KINDS ile birebir aynı olmalı — uyuşmazlık sessizce han
// saatine düşer ve caddeye kolektif namaz arası verirdi.
const HOURS_BY_KIND: Dict<{ open: number; close: number; closedDays: number[]; prayerBreak?: boolean }> = {
  carsi: { open: 9, close: 19, closedDays: [0] },
  han: { open: 8.5, close: 18.5, closedDays: [0], prayerBreak: true },
  pasaj: { open: 9.5, close: 20, closedDays: [0] },
  // Cadde bir işletme değil, kamusal yol: kolektif kapanışı ve namaz arası yoktur.
  cadde: { open: 8, close: 19, closedDays: [] },
  "is-merkezi": { open: 9, close: 18, closedDays: [0, 6] }
};

// Esnaf kendi saatini girdiyse (override) yerin varsay\u0131lan saatinden \u00fcst\u00fcnd\u00fcr:
// "\u015fu an a\u00e7\u0131k m\u0131" ancak b\u00f6yle ger\u00e7e\u011fi s\u00f6yler. \u0130kinci arg\u00fcman kay\u0131t da olabilir.
// ── Yönetim: kalıcı ayarlar ───────────────────────────────────────────────
// SETTINGS'in başındaki söz buydu: "yönetim panelinden açılıp kapanır."
// Değer üç dokümanda da aynı olmalı, o yüzden diskte tutulur ve açılışta okunur.
export const SETTINGS_KEY = "han-settings-v1";
export function loadSettings() {
  const s = readKey<Dict>(SETTINGS_KEY, {});
  Object.keys(s).forEach((k) => { if (SETTINGS[k]) SETTINGS[k].value = s[k]; });
  return SETTINGS;
}
export function saveSettings(patch: Dict) {
  Object.keys(patch || {}).forEach((k) => { if (SETTINGS[k]) SETTINGS[k].value = patch[k]; });
  const out: Dict = {};
  Object.keys(SETTINGS).forEach((k) => { out[k] = SETTINGS[k].value; });
  writeKey(SETTINGS_KEY, out);
  return SETTINGS;
}
// Ayarın sonucu soyut kalmasın: kaç kaydı etkilediği ekranda yazsın.
export function settingImpact(key: string): { n: number; tr: string; offTr: string } {
  if (key === "showDeclared") {
    const n = RECORDS.filter(r => r.status === "beyan").length;
    return { n, tr: n + " beyan kaydı yayında görünüyor" , offTr: n + " beyan kaydı aramadan çıkar" };
  }
  if (key === "declaredCanPrice") {
    // Beyan kaydında band zaten yok (band onayla gelir); bu ayarın gerçek etkisi
    // talep alıp alamaması. Yanlış sayı yazmaktansa değişen şeyi söylüyoruz.
    const n = RECORDS.filter(r => r.status === "beyan").length;
    return { n, tr: n + " beyan kaydı talep alabiliyor", offTr: n + " beyan kaydına talep gönderilemez" };
  }
  if (key === "showUnits") {
    const n = PLACES.reduce((t, p) => t + p.units, 0) - RECORDS.length;
    return { n, tr: n.toLocaleString("tr-TR") + " kayıtsız birim adres aramasında çıkıyor", offTr: n.toLocaleString("tr-TR") + " kayıtsız birim hiç görünmez" };
  }
  if (key === "showSponsored") {
    const n = SPONSORS.filter(s => !s.paused).length;
    return { n, tr: n + " aktif sponsorlu yerleşim yayında", offTr: "Sponsorlu yerleşim tamamen kapanır (" + n + " aktif)" };
  }
  if (key === "freshDays") {
    const n = RECORDS.filter(r => (r.updatedDays || 0) > (SETTINGS.freshDays.value || 90)).length;
    return { n, tr: n + " kayıt bu eşiğin dışında kaldı", offTr: "" };
  }
  return { n: 0, tr: "", offTr: "" };
}

// ── Yönetim: sponsorluk ───────────────────────────────────────────────────
// Gelir modeli veri katmanında kurulu ama yönetilemiyordu. Kural değişmez:
// organik sıralama satılmaz, performans düşerse yerleşim durur.
export const SPONSOR_KEY = "han-sponsors-v1";
export const SPONSOR_PAUSE_RATE = 85;
interface SponsorOverlay { patch?: Dict<Partial<Sponsor>>; custom?: Sponsor[]; dropped?: string[] }
export function loadSponsors(): Sponsor[] {
  {
    const ov = readKey<SponsorOverlay>(SPONSOR_KEY, {});
    (ov.custom || []).forEach((s) => {
      if (!SPONSORS.some(x => x.recordId === s.recordId && x.kind === s.kind)) SPONSORS.push(s);
    });
    Object.keys(ov.patch || {}).forEach((k) => {
      const s = SPONSORS.find((x) => sponsorId(x) === k);
      if (s) Object.assign(s, (ov.patch || {})[k]);
    });
    (ov.dropped || []).forEach((k) => {
      const i = SPONSORS.findIndex((x) => sponsorId(x) === k);
      if (i >= 0) SPONSORS.splice(i, 1);
    });
  }
  // Kural motoru: performansı eşiğin altına düşen yerleşim otomatik durur.
  SPONSORS.forEach(s => {
    const rec = RECORDS.find(r => r.id === s.recordId);
    if (rec && (rec.respRate || 0) < SPONSOR_PAUSE_RATE) { s.paused = true; s.autoPaused = true; }
    else if (s.autoPaused) { s.autoPaused = false; }
  });
  return SPONSORS;
}
export function sponsorId(s: Sponsor): string { return s.recordId + ":" + s.kind; }
function writeSponsors(mut: (ov: Required<SponsorOverlay>) => void): void {
  const stored = readKey<SponsorOverlay>(SPONSOR_KEY, {});
  const ov: Required<SponsorOverlay> = {
    patch: stored.patch || {}, custom: stored.custom || [], dropped: stored.dropped || [],
  };
  mut(ov);
  writeKey(SPONSOR_KEY, ov);
}
export function setSponsor(id: string, patch: Partial<Sponsor>): Sponsor | undefined {
  const s = SPONSORS.find(x => sponsorId(x) === id);
  if (s) Object.assign(s, patch);
  writeSponsors(ov => { ov.patch[id] = Object.assign({}, ov.patch[id], patch); });
  return s;
}
export function addSponsor(rec: Sponsor): Sponsor | null {
  if (!rec || !rec.recordId) return null;
  if (SPONSORS.some(x => sponsorId(x) === sponsorId(rec))) return null;
  SPONSORS.push(rec);
  writeSponsors(ov => { ov.custom.push(rec); });
  return rec;
}
export function dropSponsor(id: string): void {
  const i = SPONSORS.findIndex(x => sponsorId(x) === id);
  if (i >= 0) SPONSORS.splice(i, 1);
  writeSponsors(ov => {
    ov.dropped.push(id);
    ov.custom = ov.custom.filter((s) => sponsorId(s) !== id);
    delete ov.patch[id];
  });
}

// ── Yönetim: yer (PLACES) düzenleme ───────────────────────────────────────
export const PLACE_KEY = "han-places-v1";
interface PlaceOverlay { patch?: Dict<Partial<Place>>; custom?: Place[]; bulk?: string[]; unbulk?: string[] }
export function loadPlaces(): Place[] {
  const ov = readKey<PlaceOverlay>(PLACE_KEY, {});
  (ov.custom || []).forEach((p) => { if (!PLACES.some((x) => x.id === p.id)) PLACES.push(p); });
  Object.keys(ov.patch || {}).forEach((id) => {
    const p = PLACES.find((x) => x.id === id);
    if (p) Object.assign(p, (ov.patch || {})[id]);
  });
  (ov.bulk || []).forEach((id) => { if (!BULK_APPROVED.includes(id)) BULK_APPROVED.push(id); });
  (ov.unbulk || []).forEach((id) => {
    const i = BULK_APPROVED.indexOf(id);
    if (i >= 0) BULK_APPROVED.splice(i, 1);
  });
  return PLACES;
}
function writePlaces(mut: (ov: Required<PlaceOverlay>) => void): void {
  const stored = readKey<PlaceOverlay>(PLACE_KEY, {});
  const ov: Required<PlaceOverlay> = {
    patch: stored.patch || {}, custom: stored.custom || [],
    bulk: stored.bulk || [], unbulk: stored.unbulk || [],
  };
  mut(ov);
  writeKey(PLACE_KEY, ov);
}
export function savePlace(id: string, patch: Partial<Place>): Place | undefined {
  const p = PLACES.find(x => x.id === id);
  if (p) Object.assign(p, patch);
  writePlaces(ov => { ov.patch[id] = Object.assign({}, ov.patch[id], patch); });
  return p;
}
export function addPlace(rec: Place): Place | null {
  if (!rec || !rec.id || PLACES.some(p => p.id === rec.id)) return null;
  PLACES.push(rec);
  UNIT_INDEX[rec.id] = UNIT_INDEX[rec.id] || [];
  writePlaces(ov => { ov.custom.push(rec); });
  return rec;
}
export function setBulkApproved(id: string, on: boolean): void {
  const i = BULK_APPROVED.indexOf(id);
  if (on && i < 0) BULK_APPROVED.push(id);
  if (!on && i >= 0) BULK_APPROVED.splice(i, 1);
  writePlaces(ov => {
    ov.bulk = ov.bulk.filter((x) => x !== id);
    ov.unbulk = ov.unbulk.filter((x) => x !== id);
    (on ? ov.bulk : ov.unbulk).push(id);
  });
}

// ── Yönetim: roller ───────────────────────────────────────────────────────
// Yetki tek yerde tanımlı: hem gezinme hem ekran içi eylemler bunu okur.
// `scope` bir kısıt değil, bir görev tanımı: saha yetkilisi kendi bölgesini
// görür çünkü işi orası.
export const ROLES: Dict<{ tr: string; note: string; can: string[]; scope?: string; readOnly?: boolean }> = {
  yonetici: { tr: "Yönetici", note: "Her şeye erişir", can: ["*"] },
  editor: { tr: "Editör", note: "Onay ve moderasyon",
    can: ["ozet", "kayitlar", "sahiplenme", "kuyruk", "askidakiler", "toplu", "yetkililer",
          "sikayet", "yorum", "defter", "talepler", "teklifler", "alicilar", "kalite",
          "sozluk", "icerik", "gorsel"] },
  saha: { tr: "Saha yetkilisi", note: "Kendi bölgesi · kayıt açar", scope: "officer",
    can: ["ozet", "kayitlar", "kayit-ekle", "yerler", "kuyruk", "toplu", "gorevler", "kalite",
          "sikayet", "iceaktar", "gorsel", "harita"] },
  satis: { tr: "Satış", note: "Sponsorluk", can: ["ozet", "kayitlar", "sponsorluk", "teklifler"] },
  okuma: { tr: "Salt okuma", note: "Rapor erişimi", readOnly: true,
    can: ["ozet", "kayitlar", "yerler", "defter", "talepler", "teklifler"] },
  han: { tr: "Han yönetimi", note: "Yalnız kendi hanı", scope: "place", readOnly: true,
    can: ["ozet", "kayitlar", "yerler"] }
};
export function can(role: string, key: string): boolean {
  const r = ROLES[role] || ROLES.yonetici;
  return r.can.includes("*") || r.can.includes(key);
}
export function isReadOnly(role: string): boolean { return !!(ROLES[role] || {}).readOnly; }

// ── Yönetim: karar kayıt defteri ──────────────────────────────────────────
// Onaylar zaten saklanıyordu ama hiçbir ekran göstermiyordu: bir kaydın neden
// askıya alındığını sorgulamanın yolu yoktu. Dört kaynak tek zaman çizgisinde.
export function auditLog(): AuditEntry[] {
  const out: AuditEntry[] = [];
  const nameOf = (id: string): string => {
    const r = RECORDS.find((x) => x.id === id);
    return r ? (r.name || id) : id;
  };

  const ap = readKey<Dict<any>>(KEYS.approvals, {});
  Object.keys(ap).forEach((id) => {
    const d = ap[id] || {};
    out.push({
      at: d.at || 0, kind: "onay", target: id, targetName: nameOf(id),
      who: d.officer ? (OFFICERS[d.officer] || {}).name || d.officer : "Editör",
      detail: (STATUS[d.status] || {}).tr || d.status,
      via: (APPROVAL[d.via] || {}).tr || d.via || "",
      tone: d.status === "askida" ? "danger" : d.status === "aktif" ? "success" : "primary"
    });
  });

  const cl = readKey<Dict<any>>(KEYS.claims, {});
  Object.keys(cl).forEach((id) => {
    const c = cl[id] || {};
    out.push({
      at: c.at || 0, kind: "sahiplenme", target: id, targetName: nameOf(id),
      who: c.ad || c.tel || "Esnaf",
      detail: c.status === "onayli" ? "Sahiplenme onaylandı" : c.status === "red" ? "Sahiplenme reddedildi" : "Sahiplenme talebi",
      via: c.tel || "", tone: c.status === "onayli" ? "success" : c.status === "red" ? "danger" : "warning"
    });
  });

  readKey<any[]>(KEYS.reports, []).forEach((r) => {
    out.push({
      at: r.at || 0, kind: "bildirim", target: r.recordId, targetName: nameOf(r.recordId),
      who: "Alıcı", detail: r.reason || "Burada değil / kapalı", via: "", tone: "warning"
    });
  });

  readKey<any[]>(KEYS.drafts, []).forEach((d) => {
    out.push({
      at: Number(String(d.id).replace(/\D/g, "")) || 0, kind: "kayit-acildi",
      target: d.id, targetName: d.name || d.id,
      who: "Saha", detail: "Yeni kayıt açıldı · " + ((PLACES.find(p => p.id === d.place) || {}).name || d.place),
      via: (APPROVAL[d.approvedVia] || {}).tr || "", tone: "info"
    });
  });

  return out.sort((a, b) => b.at - a.at);
}

export const AUDIT_KINDS: Dict<{ tr: string; tone: string }> = {
  onay: { tr: "Onay kararı", tone: "primary" },
  sahiplenme: { tr: "Sahiplenme", tone: "warning" },
  bildirim: { tr: "Alıcı bildirimi", tone: "warning" },
  "kayit-acildi": { tr: "Kayıt açıldı", tone: "info" }
};

export function openState(place: Place | string | null | undefined, now?: Date | null, rec?: { hours?: { open: number; close: number } } | null): OpenState {
  // Yer nesnesi yerine id geçilirse sessizce han saatine düşmesin.
  const pl: Place | undefined = (place && typeof place === "object")
    ? place
    : PLACES.find((p) => p.id === place);
  const base = (pl && HOURS_BY_KIND[pl.kind]) || HOURS_BY_KIND.han;
  const own = rec && rec.hours;
  const h = own ? Object.assign({}, base, { open: own.open, close: own.close }) : base;
  const d = now || new Date();
  const day = d.getDay(), t = d.getHours() + d.getMinutes() / 60;
  if (h.closedDays.includes(day)) return { open: false, reason: "gun", open2: h.open, close: h.close };
  if (h.prayerBreak && day === 5 && t >= 12.5 && t < 14) return { open: false, reason: "namaz", back: 14 };
  if (t < h.open) return { open: false, reason: "erken", open2: h.open, close: h.close };
  if (t >= h.close) return { open: false, reason: "kapandi", open2: h.open, close: h.close };
  return { open: true, close: h.close, leftMins: Math.round((h.close - t) * 60) };
}

// Fiziksel erişim yerin kimliğinden türer — kat sayısı ve türü belirler.
export function accessOf(place: Place): AccessInfo {
  const seed = place.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hasLift = place.floors.length <= 2 ? true : (place.kind === "is-merkezi" || seed % 3 === 0);
  return {
    lift: hasLift,
    stairsOnly: !hasLift && place.floors.some(f => f >= 2),
    handcart: place.sector !== "perakende" && seed % 4 !== 0,
    porter: place.units > 300,
    parking: seed % 5 === 0
  };
}

// K5 · esnaf serbest metin yazmaz: çeşit grupları bu sözlükten seçilir.
export function GROUP_WORDS_FOR(cat: string, lang?: Lang): { key: string; label: string }[] {
  return (GROUP_WORDS[cat] || GROUP_WORDS.hediyelik || []).map(w => ({ key: w, label: groupLabel(w, lang) }));
}

// K11 · alan kaynağı etiketleri: üretilmiş veri "tahmini" olarak gösterilir.
export const SRC_LABELS: Record<SrcTag, any> = {
  tahmini: { tr: "tahmini", en: "estimated", ru: "оценка", ar: "تقديري", tone: "secondary",
    noteTr: "Bu değer çarşı ortalamasından çıkarıldı; esnaf doldurmadı." },
  esnaf: { tr: "esnaf beyanı", en: "trader-declared", ru: "заявлено торговцем", ar: "إقرار التاجر", tone: "warning",
    noteTr: "Esnafın kendi girdiği bilgi; yetkili doğrulaması bekliyor." },
  yetkili: { tr: "yetkili doğruladı", en: "officer-verified", ru: "проверено", ar: "موثّق", tone: "success",
    noteTr: "Yer yetkilisi bu bilgiyi yerinde ya da han listesiyle doğruladı." }
};

// Faz 0.1 · moda göre ticaret koşulu. Mod yoksa iki modun en uygunu döner.
export function tradeFor(rec: ShopRecord, mode?: Mode | string | null): any {
  const t = rec.trade || {};
  if (t.quoteBased) return { quoteBased: true, scope: t.scope || [] };
  const wanted = mode === "toptan" ? t.toptan : mode === "perakende" ? t.perakende : (t.toptan || t.perakende);
  const fb = { band: rec.band, moq: rec.moq, carton: null };
  if (!wanted) return Object.assign({ available: false }, fb);
  return {
    available: true,
    band: wanted.band || rec.band,
    moq: wanted.moq != null ? wanted.moq : rec.moq,
    carton: wanted.carton || null
  };
}

export function sellsIn(rec: ShopRecord, mode?: Mode | string | null): boolean {
  const sells = (rec.trade && rec.trade.sells) || [rec.sector];
  return mode === "ikisi" || !mode ? sells.length > 0 : sells.includes(mode);
}

export function placeStats(id: string): PlaceStats | null {
  const pl = PLACES.find(p => p.id === id);
  if (!pl) return null;
  const recs = recordsOfPlace(id);
  const byStatus: Dict<number> = { beyan: 0, onayli: 0, aktif: 0, askida: 0 };
  recs.forEach(x => { byStatus[x.status] = (byStatus[x.status] || 0) + 1; });
  const open = recs.filter(x => x.status === "onayli" || x.status === "aktif").length;
  const byFloor: Dict<Dict<number>> = {};
  recs.forEach(x => {
    byFloor[x.floor] = byFloor[x.floor] || {};
    byFloor[x.floor][x.cat] = (byFloor[x.floor][x.cat] || 0) + 1;
  });
  const catCount: Dict<number> = {};
  // Kategorisi girilmemiş kayıt "null" adlı bir kategori üretmesin.
  recs.forEach(x => { if (x.cat) catCount[x.cat] = (catCount[x.cat] || 0) + 1; });
  return {
    place: pl, units: pl.units, records: recs.length, openRecords: open,
    coverage: Math.round((open / pl.units) * 100),
    byStatus, byFloor, bulk: BULK_APPROVED.includes(id),
    officer: OFFICERS[OFFICER_OF_SEMT[pl.semt]] || null,
    topCats: Object.keys(catCount).sort((a, b) => catCount[b] - catCount[a]).slice(0, 5).map(c => ({ cat: c, n: catCount[c] }))
  };
}

export function semtStats(id: string) {
  const places = PLACES.filter(p => p.semt === id);
  const units = places.reduce((t, p) => t + p.units, 0);
  const recs = RECORDS.filter(x => x.semt === id);
  return {
    semt: SEMTLER.find(s => s.id === id), places: places.length, units,
    records: recs.length, open: recs.filter(x => x.status === "onayli" || x.status === "aktif").length
  };
}

export const SCALE_TOTALS = {
  places: PLACES.length,
  units: PLACES.reduce((t, p) => t + p.units, 0),
  records: RECORDS.length,
  open: RECORDS.filter(x => x.status === "onayli" || x.status === "aktif").length,
  active: RECORDS.filter(x => x.status === "aktif").length,
  declared: RECORDS.filter(x => x.status === "beyan").length,
  bulkPlaces: BULK_APPROVED.length,
  semtler: SEMTLER.length
};
