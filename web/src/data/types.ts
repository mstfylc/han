// HAN — domain types.
//
// These mirror the prototype's data model exactly (handoff §4). The prototype
// was untyped JavaScript; the shapes below are the contract that the ported
// engine modules and every screen agree on. Field names are deliberately kept
// in Turkish where the prototype used Turkish — renaming them would break the
// one-to-one reading against `han-scale.js` and the plan documents.

export type Lang = "tr" | "en" | "ru" | "ar";

/** Shopping mode. Not a cosmetic filter: it changes price display, MOQ,
 *  ranking and the request form. */
export type Mode = "perakende" | "toptan" | "ikisi";

export type Currency = "TRY" | "USD" | "EUR" | "RUB" | "SAR" | "auto";

/** Every content object carries its own translations — translation is part of
 *  the data schema, not a layer on top of it. */
export interface L10n {
  tr: string;
  en?: string;
  ru?: string;
  ar?: string;
}

export type L10nPartial = Partial<Record<Lang, string>>;

// ── place layer ───────────────────────────────────────────────────────────

/** Determines opening hours (HOURS_BY_KIND). Keys must match PLACE_KINDS
 *  exactly — a silent mismatch once ran 642 records on the wrong clock. */
export type PlaceKind = "han" | "carsi" | "pasaj" | "cadde" | "is-merkezi";

export type Sector = "toptan" | "perakende" | "imalat" | "hizmet";

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  semt: string;
  floors: number[];
  /** Physical shop units, tenanted or not. The denominator of coverage. */
  units: number;
  mix: string[];
  lat: number;
  lng: number;
  sector: Sector;
}

export interface Semt {
  id: string;
  tr: string;
  en: string;
  ru: string;
  ar: string;
  lat: number;
  lng: number;
}

// ── record layer ──────────────────────────────────────────────────────────

/** Trust ladder. `birim` is a physical unit with no record opened yet. */
export type RecordStatus = "beyan" | "onayli" | "aktif" | "askida" | "birim";

export type ApprovalVia = "han" | "saha" | "esnaf";

/** K11 · provenance. Generated data is never shown as if it were verified. */
export type SrcTag = "tahmini" | "esnaf" | "yetkili";

export interface SrcInfo {
  band?: SrcTag;
  moq?: SrcTag;
  groups?: SrcTag;
  resp?: SrcTag;
  rating?: SrcTag;
  address?: SrcTag;
}

/** Price band, [low, high] in TRY. */
export type Band = [number, number];

export interface Carton {
  inner: number;
  unit: string;
}

export interface ModeTerms {
  band: Band | null;
  moq: number | null;
  carton?: Carton | null;
}

/** Faz 0.1 · trade is a capability SET, not one value: the same shop sells
 *  wholesale in the morning and retail to tourists in the afternoon. */
export interface Trade {
  sells: string[];
  quoteBased: boolean;
  perakende: ModeTerms | null;
  toptan: ModeTerms | null;
  scope: string[] | null;
  /** curated records only — tiered pricing */
  tiers?: { from: number; price: number }[];
  type?: string;
  minOrder?: { qty?: number; unit?: string; amount?: number };
  isProducer?: boolean;
  moqFlexible?: boolean;
  /** curated stores declare whether there is room to bargain */
  negotiable?: boolean;
}

/** A variety group inside a shop's catalogue. Chosen from GROUP_WORDS — K5
 *  says traders pick from a dictionary, they never free-type. */
export interface GroupEntry {
  name: string;
  lines: number;
  lo: number;
  hi: number;
}

export interface OwnHours {
  open: number;
  close: number;
}

/** The scale backbone record (handoff §4.1). */
export interface ShopRecord {
  id: string;
  place: string;
  semt: string;
  floor: number;
  door: string;
  corridor: string | null;
  /** may be null → the category name is displayed instead */
  name: string;
  cat: string;
  cats: string[];
  sector: Sector;

  status: RecordStatus;
  approvedVia: ApprovalVia | null;
  bulk: boolean;
  officer: string;

  langs: Lang[];
  moq: number;
  moqFlex: boolean;
  trade: Trade;
  band: Band | null;
  groups: GroupEntry[];
  skuCount: number;
  src: SrcInfo;

  shipsHotel: boolean;
  giftWrap: boolean;
  isProducer: boolean;
  shipsAbroad: boolean;
  taxFree: boolean;
  invoice: boolean;
  payments: string[];

  respMins: number | null;
  respRate: number | null;
  rating: number | null;
  reviews: number;
  updatedDays: number;
  photos: number;
  tel: string;
  distance: number;

  /** trader-declared hours OVERRIDE the place's default */
  hours?: OwnHours;
  /** set when this record is one of the 11 curated STORES */
  curated: string | null;
}

export interface UnitRef {
  floor: number;
  door: string;
  recordId: string;
}

// ── curated store (han-data.js STORES) ────────────────────────────────────

export interface Product extends L10nPartial {
  tr: string;
  retail?: number | null;
  wholesale?: number | null;
  /** the unit a price is quoted in — "adet", "m²", "kg", "koli" … */
  unit?: string | null;
  note?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/** The 11 hand-written reference records. Same schema as ShopRecord plus a
 *  real product list, weekly hours, photos, certificates and tiers. Typed
 *  loosely because han-data.js carries many optional sub-objects. */
export interface CuratedStore {
  id: string;
  name: string;
  cats: string[];
  /** null for street-level shops that sit in an area rather than a han */
  han?: string | null;
  area?: string | null;
  floor?: number;
  no: number | string;
  tel: string;
  rating?: number;
  reviews?: number;
  distance?: number;
  gun?: number;
  verified?: boolean;
  products?: Product[];
  trade?: Trade;
  commerce?: {
    languages?: Lang[];
    taxFree?: boolean;
    invoice?: boolean;
    payments?: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exportInfo?: { shipsAbroad?: boolean; customsSupport?: boolean; [key: string]: any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  production?: { certs?: string[]; [key: string]: any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trust?: { respMins?: number; respRate?: number; [key: string]: any };
  /** street · gate · landmark · side — filled in by the SHOP_EXT merge */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  location?: { street?: string | null; nearestLandmark?: string | null; [key: string]: any };
  hours2?: { weekly?: (string[] | null)[]; [key: string]: unknown };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// ── search ────────────────────────────────────────────────────────────────

export interface ParsedQuery {
  raw: string;
  n: string;
  cats: string[];
  places: string[];
  semtler: string[];
  door: string | null;
  phone: string | null;
  words: string[];
  kind: "bos" | "telefon" | "yer" | "kategori" | "kapi" | "metin";
}

export interface SearchFilters {
  semt?: string;
  place?: string;
  floor?: number | string | null;
  status?: string;
  sector?: string;
  moqMax?: number;
  priceMax?: number;
  lang?: Lang;
  payment?: string;
  shipsAbroad?: boolean;
  taxFree?: boolean;
  producer?: boolean;
  openOnly?: boolean;
  activeOnly?: boolean;
  hideUnclaimed?: boolean;
  /** editor view bypasses the public-visibility setting */
  editor?: boolean;
}

export interface SearchCtx {
  mode?: Mode;
  lang?: Lang;
  qty?: number;
  sort?: SortKey;
  exclude?: string[];
}

export type SortKey = "uygunluk" | "mesafe" | "yanit" | "fiyat" | "puan" | "taze";

/** Why this record ranks where it does — shown to the user so the order never
 *  looks arbitrary. */
export interface Reason {
  k: string;
  v?: number;
  w: number;
}

export interface SearchHit {
  rec: ShopRecord;
  match: number;
  score: number;
  reasons: Reason[];
}

export interface Facets {
  semt: Record<string, number>;
  place: Record<string, number>;
  status: Record<string, number>;
  sector: Record<string, number>;
  lang: Record<string, number>;
  flag: { shipsAbroad: number; taxFree: number; producer: number };
}

export interface SearchResult {
  parsed: ParsedQuery;
  total: number;
  scanned: number;
  items: SearchHit[];
  facets: Facets;
  /** how many shops a request on this query could reach */
  broadcast: number;
  weakMatch: boolean;
  catGuess: string | null;
}

// ── product layer (M2) ────────────────────────────────────────────────────

export interface ProductSummary {
  slug: string;
  name: string;
  cat: string;
  shops: number;
  lines: number;
  lo: number | null;
  hi: number;
  band: Band | null;
  recs: ShopRecord[];
}

export interface ProductSeller {
  rec: ShopRecord;
  lo: number | null;
  hi: number | null;
  lines: number;
  moq: number;
  score: number;
}

export interface ProductDetail extends Omit<ProductSummary, "shops"> {
  shops: ProductSeller[];
  producers: number;
  exporters: number;
  median: number | null;
  spread: { lo: number; hi: number; mid: number | null } | null;
  minMoq: number;
}

// ── request · offer · review (handoff §4.4) ───────────────────────────────

export type SampleState = "istedim" | "yolda" | "uygun" | "olmadi";

/** The buyer tier is frozen onto the request: the trader sees the identity as
 *  it was when the request arrived, not as it is now. */
export interface BuyerTier {
  verified: boolean;
  telOk: boolean;
  firm?: string;
  deals: number;
  rate: number;
}

export interface BuyRequest {
  id: string;
  urun: string;
  adet: string | number;
  birim?: string;
  zaman?: string;
  sure?: string;
  numune?: boolean;
  numuneDurum?: SampleState | null;
  aciklama?: string;
  deadline?: number;
  durum?: string;
  tel?: string;
  buyer?: BuyerTier;
  at?: number;
}

export interface Offer {
  recordId: string;
  /** null unless the record is one of the curated stores */
  curated?: string | null;
  name?: string;
  place?: string;
  floor?: number;
  door?: string;
  unit: number;
  raw: number;
  qty: number;
  moq?: number;
  gun: number;
  note?: string;
  at?: number;
  validUntil?: number;
  respMins?: number | null;
  rating?: number | null;
  status?: RecordStatus;
  producer?: boolean;
  langs?: Lang[];
  shipsAbroad?: boolean;
  /** K9 · a commitment from the trader. Acceptable. */
  real: boolean;
  /** K9 · an inference from the engine. Never acceptable. */
  estimate: boolean;
}

/** What acceptance stores — the commitment itself, not just an id. */
export interface AcceptedOffer {
  recordId: string;
  name: string;
  unit: number;
  raw: number;
  qty: number;
  gun: number;
  at: number;
}

export interface Review {
  /** every review carries a permanent id: keying moderation on `at` meant two
   *  reviews written in the same millisecond shared a key (trap 14) */
  id?: string;
  stars: number;
  text: string;
  by?: string;
  at?: number;
}

export type DeclineReason = "stok" | "adet" | "termin" | "dolu";

export interface Decline {
  reason: DeclineReason;
  at: number;
}

// ── distribution ──────────────────────────────────────────────────────────

export interface DistributeRule {
  k: string;
  v: string | number | null;
  n: number;
}

export interface DistributeResult {
  cat: string | null;
  qty: number;
  matched: number;
  sent: ShopRecord[];
  rules: DistributeRule[];
  quota: number;
  langHit: number;
  producers: number;
}

// ── opening hours ─────────────────────────────────────────────────────────

export interface OpenState {
  open: boolean;
  reason?: "gun" | "namaz" | "erken" | "kapandi";
  /** opening hour, when currently closed */
  open2?: number;
  close?: number;
  /** when the Friday prayer break ends */
  back?: number;
  leftMins?: number;
}

export interface AccessInfo {
  lift: boolean;
  stairsOnly: boolean;
  handcart: boolean;
  porter: boolean;
  parking: boolean;
}
