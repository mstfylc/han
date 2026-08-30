// HAN — the operations state.
//
// What this layer holds is the HUMAN DECISIONS made about the market's health.
// The automatic rules (three reports suspend a record, below 85% stops a
// sponsorship) live in the data layer; what sits on top of those rules — the
// decisions people make by hand — lives here.
//
// The rule: no decision disappears silently. Every one carries a reason and a
// timestamp, so a queue can always answer "who decided this, when, and why".
//
// Ported from the prototype's `han-admin.js` with types added and the raw
// localStorage calls routed through services/storage, so the whole surface
// swaps to the API in one place.

import { KEYS, readKey, writeKey } from "@/services/storage";
import type { BuyRequest, L10n, ShopRecord } from "./types";

type Dict<T> = Record<string, T>;

// ── report · review · buyer triage ────────────────────────────────────────

export interface ModerationStore {
  reports: Dict<ReportState>;
  reviews: Dict<ReviewState>;
  buyers: Dict<BuyerState>;
}

function moderation(): ModerationStore {
  const m = readKey<Partial<ModerationStore>>(KEYS.moderation, {});
  return { reports: m.reports || {}, reviews: m.reviews || {}, buyers: m.buyers || {} };
}

export type ReportStatus = "acik" | "sahaya" | "dogrulandi" | "reddedildi";

export interface ReportState {
  status: ReportStatus;
  at: number;
  note: string;
  officer: string | null;
}

/**
 * An automatic suspension is an ALARM, not a decision.
 *
 * Three buyer reports take a record out of circulation on their own, but a
 * record must not stay suspended because a counter reached three — every row
 * here waits for a person, and that person's answer is what gets stored.
 */
export const REPORT_STATES: Record<ReportStatus, L10n & { tone: string; note: string }> = {
  acik: { tr: "Açık", en: "Open", ru: "Открыто", ar: "مفتوح", tone: "danger", note: "Henüz incelenmedi" },
  sahaya: { tr: "Sahaya atandı", en: "Assigned to the field", ru: "Направлено на выезд", ar: "أُسند للميدان", tone: "warning", note: "Yetkili yerinde görecek" },
  dogrulandi: { tr: "Doğrulandı", en: "Upheld", ru: "Подтверждено", ar: "مؤكَّد", tone: "primary", note: "Bildirim haklı — kayıt askıda kalır" },
  reddedildi: { tr: "Reddedildi", en: "Dismissed", ru: "Отклонено", ar: "مرفوض", tone: "secondary", note: "Bildirim yersiz — kayıt geri açılır" },
};

export function reportState(recordId: string): ReportState {
  return moderation().reports[recordId] || { status: "acik", at: 0, note: "", officer: null };
}

export function setReportState(recordId: string, patch: Partial<ReportState>): ReportState {
  const m = moderation();
  const base: ReportState = { status: "acik", at: 0, note: "", officer: null };
  // `at` is stamped last on purpose: a decision always carries the moment it
  // was made, never the moment the row was first created.
  m.reports[recordId] = { ...base, ...m.reports[recordId], ...patch, at: Date.now() };
  writeKey(KEYS.moderation, m);
  return m.reports[recordId];
}

export function allReportStates(): Dict<ReportState> {
  return moderation().reports;
}

// ── review moderation ─────────────────────────────────────────────────────
// The right to write a review is already narrow (only a buyer who accepted an
// offer). The work here is not catching fraud but removing what breaks the
// rules: abuse, personal data, advertising.

export type ReviewReason = "hakaret" | "kisisel" | "reklam" | "ilgisiz";

export const REVIEW_REASONS: Record<ReviewReason, L10n> = {
  hakaret: { tr: "Hakaret / uygunsuz dil", en: "Abuse / bad language", ru: "Оскорбления", ar: "إساءة / لغة غير لائقة" },
  kisisel: { tr: "Kişisel veri paylaşımı", en: "Personal data shared", ru: "Личные данные", ar: "بيانات شخصية" },
  reklam: { tr: "Reklam / alakasız", en: "Advertising / off-topic", ru: "Реклама", ar: "إعلان / خارج الموضوع" },
  ilgisiz: { tr: "Alışverişle ilgisi yok", en: "Not about the trade", ru: "Не о покупке", ar: "لا علاقة بالشراء" },
};

export interface ReviewState {
  hidden: boolean;
  reason: ReviewReason | string;
  at: number;
}

/** The key is the review's own id; `at` is only a fallback for older rows.
 *  A timestamp alone cannot separate two reviews written in the same
 *  millisecond, which is why every review is given a permanent id. */
export function reviewKey(recordId: string, rv: { id?: string; at?: number } | string | number): string {
  const k = rv && typeof rv === "object" ? (rv.id ?? rv.at) : rv;
  return recordId + ":" + k;
}

export function reviewState(recordId: string, rv: { id?: string; at?: number } | string | number): ReviewState | null {
  return moderation().reviews[reviewKey(recordId, rv)] || null;
}

export function hideReview(recordId: string, rv: { id?: string; at?: number }, reason: ReviewReason | string): void {
  const m = moderation();
  m.reviews[reviewKey(recordId, rv)] = { hidden: true, reason, at: Date.now() };
  writeKey(KEYS.moderation, m);
}

export function restoreReview(recordId: string, rv: { id?: string; at?: number }): void {
  const m = moderation();
  delete m.reviews[reviewKey(recordId, rv)];
  writeKey(KEYS.moderation, m);
}

export function allReviewStates(): Dict<ReviewState> {
  return moderation().reviews;
}

// ── buyer verification ────────────────────────────────────────────────────
// A buyer tier was being written onto every request, but who granted that tier
// was undefined. This is the answer: a verified buyer is one a person checked,
// and that is why a trader takes them seriously.

export type BuyerStatus = "bekliyor" | "onayli" | "red" | "riskli";

export interface BuyerState {
  status: BuyerStatus;
  at: number;
  note: string;
}

export const BUYER_STATES: Record<BuyerStatus, L10n & { tone: string }> = {
  bekliyor: { tr: "Bekliyor", en: "Pending", ru: "Ожидает", ar: "معلّق", tone: "warning" },
  onayli: { tr: "Doğrulanmış firma", en: "Verified company", ru: "Проверенная фирма", ar: "شركة موثّقة", tone: "success" },
  red: { tr: "Reddedildi", en: "Rejected", ru: "Отклонено", ar: "مرفوض", tone: "danger" },
  riskli: { tr: "Riskli — izlemede", en: "Risky — watched", ru: "Риск — под наблюдением", ar: "خطر — تحت المراقبة", tone: "secondary" },
};

export function buyerState(tel: string | number): BuyerState {
  return moderation().buyers[String(tel)] || { status: "bekliyor", at: 0, note: "" };
}

export function setBuyerState(tel: string | number, patch: Partial<BuyerState>): BuyerState {
  const m = moderation();
  const k = String(tel);
  const base: BuyerState = { status: "bekliyor", at: 0, note: "" };
  m.buyers[k] = { ...base, ...m.buyers[k], ...patch, at: Date.now() };
  writeKey(KEYS.moderation, m);
  return m.buyers[k];
}

export function allBuyerStates(): Dict<BuyerState> {
  return moderation().buyers;
}

// ── manual offer routing ──────────────────────────────────────────────────
// An unanswered request does not resolve itself. Operations points at a shop by
// hand, and the trader's panel shows it as "management forwarded this to you" —
// which is also a nudge the trader can honourably decline.

export interface Nudge {
  recordId: string;
  at: number;
  by: string;
}

export function nudgesOf(reqId: string | number): Nudge[] {
  return readKey<Dict<Nudge[]>>(KEYS.nudges, {})[String(reqId)] || [];
}

export function allNudges(): Dict<Nudge[]> {
  return readKey<Dict<Nudge[]>>(KEYS.nudges, {});
}

export function addNudge(reqId: string | number, recordId: string, by?: string): Nudge[] {
  const m = readKey<Dict<Nudge[]>>(KEYS.nudges, {});
  const id = String(reqId);
  const list = (m[id] || []).filter((n) => n.recordId !== recordId);
  list.push({ recordId, at: Date.now(), by: by || "Yönetim" });
  m[id] = list;
  writeKey(KEYS.nudges, m);
  return list;
}

export function dropNudge(reqId: string | number, recordId: string): Nudge[] {
  const m = readKey<Dict<Nudge[]>>(KEYS.nudges, {});
  const id = String(reqId);
  m[id] = (m[id] || []).filter((n) => n.recordId !== recordId);
  writeKey(KEYS.nudges, m);
  return m[id];
}

// ── field visits ──────────────────────────────────────────────────────────
// This is the work that closes the coverage gap. A one-at-a-time "add a shop"
// form is not a tool; a visit is assigned to an officer, a place and a range of
// floors, and it closes.

export type TaskStatus = "atandi" | "yolda" | "tamam" | "iptal";
export type TaskKind = "kapsama" | "dogrulama" | "icerik" | "anlasma";

export const TASK_STATES: Record<TaskStatus, L10n & { tone: string; note: string }> = {
  atandi: { tr: "Atandı", en: "Assigned", ru: "Назначено", ar: "مُسند", tone: "warning", note: "Yetkili henüz gitmedi" },
  yolda: { tr: "Turda", en: "On the round", ru: "В обходе", ar: "في الجولة", tone: "primary", note: "Saha turu sürüyor" },
  tamam: { tr: "Kapandı", en: "Closed", ru: "Закрыто", ar: "مغلق", tone: "success", note: "Tur tamamlandı" },
  iptal: { tr: "İptal", en: "Cancelled", ru: "Отменено", ar: "ملغى", tone: "secondary", note: "Yapılmayacak" },
};

export const TASK_KINDS: Record<TaskKind, L10n & { note: string }> = {
  kapsama: { tr: "Kapsama turu", en: "Coverage round", ru: "Обход охвата", ar: "جولة تغطية", note: "Kayıt açılmamış birimleri gez" },
  dogrulama: { tr: "Doğrulama", en: "Verification", ru: "Проверка", ar: "تحقق", note: "Bildirilen kaydı yerinde gör" },
  icerik: { tr: "İçerik toplama", en: "Content collection", ru: "Сбор контента", ar: "جمع المحتوى", note: "Fiyat, çeşit, fotoğraf al" },
  anlasma: { tr: "Han yönetimi görüşmesi", en: "Han management meeting", ru: "Встреча с управлением", ar: "اجتماع إدارة الخان", note: "Toplu onay anlaşması" },
};

export interface FieldTask {
  id: string;
  kind: TaskKind;
  status: TaskStatus;
  createdAt: number;
  at?: number;
  note: string;
  officer: string | null;
  place: string | null;
  floors: number[] | null;
  recordId: string | null;
  target: number;
  done: number;
}

export function allTasks(): FieldTask[] {
  return readKey<FieldTask[]>(KEYS.tasks, []);
}

export function addTask(task: Partial<FieldTask>): FieldTask {
  const list = allTasks();
  const rec: FieldTask = {
    id: "tk" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    kind: "kapsama", status: "atandi", createdAt: Date.now(), note: "",
    officer: null, place: null, floors: null, recordId: null, target: 0, done: 0,
    ...task,
  };
  list.push(rec);
  writeKey(KEYS.tasks, list);
  return rec;
}

export function setTask(id: string, patch: Partial<FieldTask>): FieldTask | null {
  const list = allTasks();
  const i = list.findIndex((t) => t.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch, at: Date.now() };
  writeKey(KEYS.tasks, list);
  return list[i];
}

export function dropTask(id: string): void {
  writeKey(KEYS.tasks, allTasks().filter((t) => t.id !== id));
}

// ── users and roles ───────────────────────────────────────────────────────
// OFFICERS was a fixed dictionary; a real team adds people, changes roles and
// hands over authority. The permission definitions come from han-scale's ROLES
// so there is no second source of truth.

export interface OpsUser {
  id: string;
  name: string;
  tel: string;
  role: string;
  place: string | null;
  officer: string | null;
  active: boolean;
  createdAt: number;
  lastSeen: number | null;
}

export function allUsers(): OpsUser[] {
  return readKey<OpsUser[]>(KEYS.users, []);
}

export function addUser(u: Partial<OpsUser>): OpsUser | null {
  const list = allUsers();
  if (list.some((x) => String(x.tel) === String(u.tel))) return null;
  const rec: OpsUser = {
    id: "us" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: "", tel: "", role: "okuma", place: null, officer: null,
    active: true, createdAt: Date.now(), lastSeen: null,
    ...u,
  };
  list.push(rec);
  writeKey(KEYS.users, list);
  return rec;
}

export function setUser(id: string, patch: Partial<OpsUser>): OpsUser | null {
  const list = allUsers();
  const i = list.findIndex((u) => u.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  writeKey(KEYS.users, list);
  return list[i];
}

export function dropUser(id: string): void {
  writeKey(KEYS.users, allUsers().filter((u) => u.id !== id));
}

export function userByTel(tel: string | number): OpsUser | null {
  const t = String(tel).replace(/\D/g, "");
  return allUsers().find((u) => String(u.tel).replace(/\D/g, "") === t) || null;
}

// ── sign-in · password reset ──────────────────────────────────────────────
//
// ⚠ PROTOTYPE. This is NOT authentication and must never be shipped as such.
//
// PINs, reset codes and the session all sit in the browser, which means any
// script on the origin — and anyone holding the device — can read them, and a
// "one-time code sent to your phone" can simply be read out of storage instead
// of received. It is kept only so the screens and their states (locked out, no
// PIN yet, expired code) can be built and demonstrated.
//
// Real verification belongs on the server: the PIN is hashed, never returned,
// attempts are counted server-side, and the reset code is delivered out of band.
// That replacement is the Giriş phase; until then treat everything below as a
// UI fixture, not a security boundary.

export const RESET_TTL_MIN = 15;
export const MAX_TRIES = 5;

interface AuthStore {
  pins: Dict<string>;
  resets: Dict<{ userId: string; at: number; used: boolean }>;
  tries: Dict<number>;
  session?: { userId: string; at: number };
}

function auth(): AuthStore {
  const a = readKey<Partial<AuthStore>>(KEYS.auth, {});
  return { pins: a.pins || {}, resets: a.resets || {}, tries: a.tries || {}, session: a.session };
}

export function hasPin(userId: string): boolean {
  return !!auth().pins[userId];
}

export function setPin(userId: string, pin: string | number): void {
  const a = auth();
  a.pins[userId] = String(pin);
  delete a.tries[userId];
  writeKey(KEYS.auth, a);
}

export function session(): { userId: string; at: number } | null {
  return auth().session || null;
}

export function logout(): void {
  const a = auth();
  delete a.session;
  writeKey(KEYS.auth, a);
}

export type LoginError = "yok" | "kapali" | "kilit" | "pinsiz" | "hatali";

export interface LoginResult {
  ok: boolean;
  err?: LoginError;
  msg?: string;
  user?: OpsUser;
  userId?: string;
}

export function login(tel: string, pin: string): LoginResult {
  const u = userByTel(tel);
  if (!u) return { ok: false, err: "yok", msg: "Bu telefonla kayıtlı kullanıcı yok." };
  if (!u.active) return { ok: false, err: "kapali", msg: "Bu hesap kapatılmış. Yöneticinize başvurun." };
  const a = auth();
  const tries = a.tries[u.id] || 0;
  if (tries >= MAX_TRIES) return { ok: false, err: "kilit", msg: "Çok fazla hatalı deneme. Şifrenizi sıfırlayın." };
  if (!a.pins[u.id]) {
    return { ok: false, err: "pinsiz", msg: "Bu hesaba henüz şifre kurulmadı. “Şifremi unuttum” ile kurun.", userId: u.id };
  }
  if (a.pins[u.id] !== String(pin)) {
    a.tries[u.id] = tries + 1;
    writeKey(KEYS.auth, a);
    return { ok: false, err: "hatali", msg: "Şifre yanlış. Kalan deneme: " + (MAX_TRIES - tries - 1) };
  }
  delete a.tries[u.id];
  a.session = { userId: u.id, at: Date.now() };
  writeKey(KEYS.auth, a);
  setUser(u.id, { lastSeen: Date.now() });
  return { ok: true, user: u };
}

/** A reset code is single-use and expires: a leaked code must not stay valid
 *  forever. */
export function requestReset(tel: string): { ok: boolean; code: string | null; masked: string; userId?: string } {
  const u = userByTel(tel);
  // The same answer is given when no user exists, so the queue cannot be used
  // to discover which phone numbers are registered.
  if (!u) return { ok: true, code: null, masked: maskTel(tel) };
  const a = auth();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  a.resets[code] = { userId: u.id, at: Date.now(), used: false };
  writeKey(KEYS.auth, a);
  return { ok: true, code, masked: maskTel(u.tel), userId: u.id };
}

export function checkReset(code: string): { ok: boolean; msg?: string; userId?: string } {
  const r = auth().resets[String(code)];
  if (!r) return { ok: false, msg: "Kod geçersiz." };
  if (r.used) return { ok: false, msg: "Bu kod bir kez kullanıldı. Yeni kod isteyin." };
  if (Date.now() - r.at > RESET_TTL_MIN * 60000) return { ok: false, msg: "Kodun süresi doldu. Yeni kod isteyin." };
  return { ok: true, userId: r.userId };
}

export function applyReset(code: string, pin: string): { ok: boolean; msg?: string; userId?: string } {
  const chk = checkReset(code);
  if (!chk.ok) return chk;
  if (!/^\d{4,8}$/.test(String(pin))) return { ok: false, msg: "Şifre 4–8 haneli sayı olmalı." };
  const a = auth();
  a.pins[chk.userId as string] = String(pin);
  a.resets[String(code)].used = true;
  delete a.tries[chk.userId as string];
  a.session = { userId: chk.userId as string, at: Date.now() };
  writeKey(KEYS.auth, a);
  return { ok: true, userId: chk.userId };
}

export function maskTel(tel: string | number): string {
  const t = String(tel || "").replace(/\D/g, "");
  return t.length < 6 ? "•••" : t.slice(0, 3) + " ••• •• " + t.slice(-2);
}

// ── data-quality work lists ───────────────────────────────────────────────
// "Empty catalogue: 421" was a number with no list behind it — nobody could
// tell who to go and see. Every rule produces a work list that can turn
// straight into a field visit.

export type QualityRule = "fiyatsiz" | "telsiz" | "fotosuz" | "eskimis" | "gruppsuz" | "mukerrer";

export const QUALITY_RULES: Record<QualityRule, L10n & { note: string; tone: string }> = {
  fiyatsiz: { tr: "Fiyat bandı yok", en: "No price band", ru: "Нет диапазона цен", ar: "لا نطاق سعر", note: "Alıcı fiyat soramıyor — kaydın en büyük eksiği", tone: "danger" },
  telsiz: { tr: "Telefon yok", en: "No phone", ru: "Нет телефона", ar: "لا هاتف", note: "Temas kurulamıyor", tone: "danger" },
  fotosuz: { tr: "Fotoğraf yok", en: "No photos", ru: "Нет фото", ar: "لا صور", note: "Vitrin görünmüyor, güven düşük", tone: "warning" },
  eskimis: { tr: "Tazeliği düşmüş", en: "Gone stale", ru: "Устарело", ar: "قديم", note: "Uzun süre dokunulmamış", tone: "warning" },
  gruppsuz: { tr: "Çeşit grubu yok", en: "No product groups", ru: "Нет групп товаров", ar: "لا مجموعات", note: "Aramada eşleşmiyor", tone: "warning" },
  mukerrer: { tr: "Mükerrer kayıt", en: "Duplicate record", ru: "Дубликат", ar: "سجل مكرر", note: "Aynı kapıda birden fazla kayıt", tone: "danger" },
};

export function qualityLists(records: ShopRecord[], freshDays?: number): Record<QualityRule, ShopRecord[]> {
  const out = {} as Record<QualityRule, ShopRecord[]>;
  (Object.keys(QUALITY_RULES) as QualityRule[]).forEach((k) => { out[k] = []; });
  const seen: Dict<string> = {};
  (records || []).forEach((r) => {
    if (!r.band) out.fiyatsiz.push(r);
    if (!r.tel) out.telsiz.push(r);
    if (!r.photos) out.fotosuz.push(r);
    if ((r.updatedDays || 0) > (freshDays || 90)) out.eskimis.push(r);
    if (!(r.groups || []).length) out.gruppsuz.push(r);
    const k = r.place + "|" + r.floor + "|" + r.door;
    if (seen[k]) out.mukerrer.push(r);
    else seen[k] = r.id;
  });
  return out;
}

// ── bulk import ───────────────────────────────────────────────────────────
// A tenant list from a han's management cannot be entered by opening 142
// records by hand. Free text is pasted; the separator may be a comma, a
// semicolon or a tab.

export interface ImportRow {
  line: number;
  door: string;
  name: string;
  cats: string[];
  tel: string;
}

export interface ImportError {
  line: number;
  raw: string;
  msg: string;
}

export function parseImport(text: string): { rows: ImportRow[]; errors: ImportError[]; total: number } {
  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  String(text || "").split(/\r?\n/).forEach((line, i) => {
    const raw = line.trim();
    if (!raw || /^#/.test(raw)) return;
    const parts = raw.split(/\s*[;\t]\s*|\s*,\s*/).map((x) => x.trim());
    const [door, name, cats, tel] = parts;
    if (!door || !name) {
      errors.push({ line: i + 1, raw, msg: "Kapı no ve ad zorunlu" });
      return;
    }
    rows.push({
      line: i + 1,
      door: String(door).replace(/^no[:.]?\s*/i, ""),
      name,
      cats: (cats || "").split("/").map((x) => x.trim()).filter(Boolean),
      tel: String(tel || "").replace(/\D/g, ""),
    });
  });
  // When the same door appears twice, the SECOND one is dropped: this is the
  // single most common mistake in a hand-typed tenant list.
  const seenDoor: Dict<boolean> = {};
  const keep: ImportRow[] = [];
  rows.forEach((r) => {
    if (seenDoor[r.door]) {
      errors.push({ line: r.line, raw: r.name, msg: "Kapı no " + r.door + " listede tekrar ediyor — bu satır alınmadı" });
      return;
    }
    seenDoor[r.door] = true;
    keep.push(r);
  });
  return { rows: keep, errors, total: rows.length };
}

// ── content: events and campaigns ─────────────────────────────────────────
// EVENTS and CAMPAIGNS were shown to the buyer but could not be edited. Adding,
// hiding and correcting happen here; the buyer surface reads the same layer.

export type ContentKind = "events" | "camps";

interface ContentLayer {
  add: Dict<unknown>[];
  hide: string[];
  patch: Dict<Dict<unknown>>;
}

interface ContentStore {
  events: ContentLayer;
  camps: ContentLayer;
}

function emptyLayer(): ContentLayer {
  return { add: [], hide: [], patch: {} };
}

function content(): ContentStore {
  const c = readKey<Partial<ContentStore>>(KEYS.content, {});
  return {
    events: { ...emptyLayer(), ...c.events },
    camps: { ...emptyLayer(), ...c.camps },
  };
}

export const EVENT_KINDS: Dict<L10n> = {
  tour: { tr: "Gezi · açık gün", en: "Tour · open day", ru: "Экскурсия", ar: "جولة · يوم مفتوح" },
  fair: { tr: "Fuar", en: "Fair", ru: "Ярмарка", ar: "معرض" },
  workshop: { tr: "Atölye", en: "Workshop", ru: "Мастер-класс", ar: "ورشة" },
  culture: { tr: "Kültür", en: "Culture", ru: "Культура", ar: "ثقافة" },
  market: { tr: "Pazar günü", en: "Market day", ru: "Базарный день", ar: "يوم السوق" },
};

/** Base list + additions − hidden + corrections. The source data is never
 *  mutated, so an edit can always be taken back. */
export function mergeContent<T extends { id?: string }>(base: T[], kind: ContentKind): T[] {
  const c = content()[kind === "events" ? "events" : "camps"];
  const out = (base || [])
    .filter((x) => !c.hide.includes(String(x.id)))
    .map((x) => (c.patch[String(x.id)] ? { ...x, ...c.patch[String(x.id)] } : x));
  return (c.add as T[]).filter((x) => !c.hide.includes(String(x.id))).concat(out);
}

export function addContent(kind: ContentKind, item: Dict<unknown>): Dict<unknown> {
  const c = content();
  const k = kind === "events" ? "events" : "camps";
  const rec = { id: "ct" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ...item };
  c[k].add.unshift(rec);
  writeKey(KEYS.content, c);
  return rec;
}

export function patchContent(kind: ContentKind, id: string, patch: Dict<unknown>): void {
  const c = content();
  const k = kind === "events" ? "events" : "camps";
  const own = c[k].add.find((x) => x.id === id);
  if (own) Object.assign(own, patch);
  else c[k].patch[id] = { ...c[k].patch[id], ...patch };
  writeKey(KEYS.content, c);
}

export function hideContent(kind: ContentKind, id: string, on: boolean): void {
  const c = content();
  const k = kind === "events" ? "events" : "camps";
  c[k].hide = c[k].hide.filter((x) => x !== id);
  if (on) c[k].hide.push(id);
  writeKey(KEYS.content, c);
}

export function isHidden(kind: ContentKind, id: string): boolean {
  return content()[kind === "events" ? "events" : "camps"].hide.includes(id);
}

// ── store images ──────────────────────────────────────────────────────────
// Photos are the weakest field on a record (609 have none at all) but there was
// no end-to-end flow: upload, ordering, cover selection, approval. All of it
// lives here, and only an approved image reaches the buyer.

export type MediaStatus = "bekliyor" | "onayli" | "red";
export type MediaKind = "vitrin" | "ic" | "urun" | "kapi";

export const MEDIA_STATES: Record<MediaStatus, L10n & { tone: string }> = {
  bekliyor: { tr: "Onay bekliyor", en: "Awaiting approval", ru: "На проверке", ar: "بانتظار الموافقة", tone: "warning" },
  onayli: { tr: "Yayında", en: "Published", ru: "Опубликовано", ar: "منشور", tone: "success" },
  red: { tr: "Reddedildi", en: "Rejected", ru: "Отклонено", ar: "مرفوض", tone: "danger" },
};

export const MEDIA_KINDS: Record<MediaKind, L10n> = {
  vitrin: { tr: "Vitrin", en: "Storefront", ru: "Витрина", ar: "الواجهة" },
  ic: { tr: "Dükkân içi", en: "Inside", ru: "Внутри", ar: "الداخل" },
  urun: { tr: "Ürün", en: "Product", ru: "Товар", ar: "منتج" },
  kapi: { tr: "Kapı · tabela", en: "Door · sign", ru: "Дверь · вывеска", ar: "الباب · اللافتة" },
};

export interface MediaItem {
  id: string;
  slot: string;
  kind: MediaKind;
  caption: string;
  status: MediaStatus;
  cover: boolean;
  at: number;
}

export function mediaOf(recordId: string): MediaItem[] {
  return (readKey<Dict<MediaItem[]>>(KEYS.media, {})[recordId] || []).slice();
}

export function allMedia(): Dict<MediaItem[]> {
  return readKey<Dict<MediaItem[]>>(KEYS.media, {});
}

export function addMedia(recordId: string, item: Partial<MediaItem>): MediaItem {
  const m = readKey<Dict<MediaItem[]>>(KEYS.media, {});
  const list = m[recordId] || [];
  const rec: MediaItem = {
    id: "ph" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    slot: "", kind: "vitrin", caption: "", status: "bekliyor",
    cover: list.length === 0, at: Date.now(),
    ...item,
  };
  // The slot id must be stable: an image someone left has to survive a reload.
  rec.slot = rec.slot || recordId + "-" + rec.id;
  list.push(rec);
  m[recordId] = list;
  writeKey(KEYS.media, m);
  return rec;
}

export function setMedia(recordId: string, id: string, patch: Partial<MediaItem>): MediaItem | null {
  const m = readKey<Dict<MediaItem[]>>(KEYS.media, {});
  const list = m[recordId] || [];
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  // There can be only one cover: choosing a new one drops the old.
  if (patch.cover) list.forEach((x, j) => { if (j !== i) x.cover = false; });
  m[recordId] = list;
  writeKey(KEYS.media, m);
  return list[i];
}

export function dropMedia(recordId: string, id: string): void {
  const m = readKey<Dict<MediaItem[]>>(KEYS.media, {});
  const list = (m[recordId] || []).filter((x) => x.id !== id);
  // If the cover was deleted the first published image takes over — a record
  // never ends up with photos but no cover.
  if (list.length && !list.some((x) => x.cover)) {
    const first = list.find((x) => x.status === "onayli") || list[0];
    first.cover = true;
  }
  m[recordId] = list;
  writeKey(KEYS.media, m);
}

export function moveMedia(recordId: string, id: string, dir: number): void {
  const m = readKey<Dict<MediaItem[]>>(KEYS.media, {});
  const list = m[recordId] || [];
  const i = list.findIndex((x) => x.id === id);
  const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= list.length) return;
  const t = list[i];
  list[i] = list[j];
  list[j] = t;
  m[recordId] = list;
  writeKey(KEYS.media, m);
}

// ── geography and floor plans ─────────────────────────────────────────────
// A place's position and floor plan are the physical face of the address
// backbone. If the pin is wrong the buyer cannot find the door, which is
// exactly why it has to be correctable.

export interface GeoEntry {
  lat?: number;
  lng?: number;
  entrances?: unknown[];
  corridors?: Dict<unknown>;
  note?: string;
}

export function geoOf(placeId: string): GeoEntry | null {
  return readKey<Dict<GeoEntry>>(KEYS.geo, {})[placeId] || null;
}

export function allGeo(): Dict<GeoEntry> {
  return readKey<Dict<GeoEntry>>(KEYS.geo, {});
}

export function setGeo(placeId: string, patch: GeoEntry): GeoEntry {
  const g = readKey<Dict<GeoEntry>>(KEYS.geo, {});
  g[placeId] = { ...g[placeId], ...patch };
  writeKey(KEYS.geo, g);
  return g[placeId];
}

/** A position corrected in the panel is written onto the backbone, so the buyer
 *  surface shows the same pin. */
export function applyGeo(places: Record<string, unknown>[]): Dict<GeoEntry> {
  const g = readKey<Dict<GeoEntry>>(KEYS.geo, {});
  (places || []).forEach((p) => {
    const o = g[p.id as string];
    if (!o) return;
    if (typeof o.lat === "number") p.lat = o.lat;
    if (typeof o.lng === "number") p.lng = o.lng;
    if (o.entrances) p.entrances = o.entrances;
    if (o.corridors) p.corridors = o.corridors;
    if (o.note) p.geoNote = o.note;
  });
  return g;
}

// ── market health ─────────────────────────────────────────────────────────
// Computed in one place: the summary card and the offer-audit screen both read
// this, so the two can never disagree.

/** A request unanswered for 48 hours needs someone to intervene. */
export const SLA_HOURS = 48;

export interface HealthRow {
  t: BuyRequest;
  offers: number;
  seen: number;
  declined: number;
  ageH: number | null;
  ageKnown: boolean;
  overdue: boolean;
}

export function marketHealth(
  talepler: BuyRequest[],
  offersOf: (id: string) => unknown[],
  seenOf: (id: string) => number,
  declinedOf: (id: string) => number,
): {
  rows: HealthRow[];
  open: number;
  quoted: number;
  silent: number;
  overdue: number;
  answerRate: number | null;
} {
  const now = Date.now();
  // A request id is a timestamp (Date.now()). An imported or older row may not
  // be, and rather than computing a nonsense age and printing "496674 hours" we
  // say the age is unknown — and the SLA is not applied to an unknown age.
  const YEAR2020 = 1577836800000;
  const rows: HealthRow[] = (talepler || []).map((t) => {
    const stamp = Number(t.at || t.id);
    const known = stamp > YEAR2020 && stamp <= now + 86400000;
    const offers = offersOf(t.id) || [];
    const seen = seenOf(t.id) || 0;
    const declined = declinedOf(t.id) || 0;
    const ageH = known ? Math.max(0, Math.round((now - stamp) / 3600000)) : null;
    const overdue = offers.length === 0 && ageH != null && ageH >= SLA_HOURS;
    return { t, offers: offers.length, seen, declined, ageH, ageKnown: known, overdue };
  });
  return {
    rows,
    open: rows.length,
    quoted: rows.filter((r) => r.offers > 0).length,
    silent: rows.filter((r) => r.offers === 0).length,
    overdue: rows.filter((r) => r.overdue).length,
    // The answer rate is the market's only real health indicator.
    answerRate: rows.length ? Math.round((rows.filter((r) => r.offers > 0).length / rows.length) * 100) : null,
  };
}
