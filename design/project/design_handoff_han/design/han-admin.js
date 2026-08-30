// HAN — yönetim operasyon durumu.
//
// Faz 2'nin tuttuğu şey: pazarın sağlığı üzerine verilen İNSAN KARARLARI.
// Otomatik kurallar (üç bildirim = askı, %85 altı = sponsorluk durur) veri
// katmanında; burada o kuralların üstüne binen elle kararlar durur.
//
// Kural: hiçbir karar sessizce kaybolmaz. Her biri gerekçe ve zaman taşır.

const KEY = "han-moderation-v1";   // { reports:{}, reviews:{}, buyers:{} }
const NUDGE = "han-nudges-v1";     // { [reqId]: [{recordId, at, by}] }

function read(k, def) {
  try { return JSON.parse(localStorage.getItem(k) || def) || JSON.parse(def); }
  catch (e) { return JSON.parse(def); }
}
function write(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  return v;
}
function all() {
  const m = read(KEY, "{}");
  m.reports = m.reports || {}; m.reviews = m.reviews || {}; m.buyers = m.buyers || {};
  return m;
}

// ── Şikayet / bildirim triyajı ────────────────────────────────────────────
// Üç bildirim kaydı otomatik askıya alır. Ama otomatik askı bir KARAR değil,
// bir alarmdır — her satır insan kararı bekler ve o karar burada saklanır.
export const REPORT_STATES = {
  acik:        { tr: "Açık", tone: "danger",    note: "Henüz incelenmedi" },
  sahaya:      { tr: "Sahaya atandı", tone: "warning", note: "Yetkili yerinde görecek" },
  dogrulandi:  { tr: "Doğrulandı", tone: "primary", note: "Bildirim haklı — kayıt askıda kalır" },
  reddedildi:  { tr: "Reddedildi", tone: "secondary", note: "Bildirim yersiz — kayıt geri açılır" }
};

export function reportState(recordId) {
  return all().reports[recordId] || { status: "acik", at: 0, note: "", officer: null };
}
export function setReportState(recordId, patch) {
  const m = all();
  m.reports[recordId] = Object.assign({ status: "acik", at: 0, note: "", officer: null },
    m.reports[recordId], patch, { at: Date.now() });
  write(KEY, m);
  return m.reports[recordId];
}
export function allReportStates() { return all().reports; }

// ── Yorum denetimi ────────────────────────────────────────────────────────
// Yorum yazma hakkı zaten kısıtlı (yalnız teklif kabul etmiş alıcı). Buradaki
// iş sahtekârlığı değil, kuralsızlığı ayıklamak: hakaret, kişisel veri, reklam.
export const REVIEW_REASONS = {
  hakaret: { tr: "Hakaret / uygunsuz dil" },
  kisisel: { tr: "Kişisel veri paylaşımı" },
  reklam:  { tr: "Reklam / alakasız" },
  ilgisiz: { tr: "Alışverişle ilgisi yok" }
};

// Anahtar yorumun kendi kimli\u011fi \u00fczerinden kurulur; `at` yaln\u0131z eski kay\u0131tlar i\u00e7in
// yedek. \u0130kisi ayn\u0131 milisaniyede yaz\u0131lm\u0131\u015f iki yorumu birbirinden ay\u0131ramaz.
export function reviewKey(recordId, rv) {
  const k = (rv && typeof rv === "object") ? (rv.id || rv.at) : rv;
  return recordId + ":" + k;
}
export function reviewState(recordId, rv) {
  return all().reviews[reviewKey(recordId, rv)] || null;
}
export function hideReview(recordId, rv, reason) {
  const m = all();
  m.reviews[reviewKey(recordId, rv)] = { hidden: true, reason, at: Date.now() };
  write(KEY, m);
}
export function restoreReview(recordId, rv) {
  const m = all();
  delete m.reviews[reviewKey(recordId, rv)];
  write(KEY, m);
}
export function allReviewStates() { return all().reviews; }

// ── Alıcı doğrulama ───────────────────────────────────────────────────────
// Talebe alıcı kademesi yazılıyordu ama o kademeyi kimin verdiği belirsizdi.
// Cevap: burası. Doğrulanan alıcı esnafın gözünde ciddiye alınır.
export const BUYER_STATES = {
  bekliyor: { tr: "Bekliyor", tone: "warning" },
  onayli:   { tr: "Doğrulanmış firma", tone: "success" },
  red:      { tr: "Reddedildi", tone: "danger" },
  riskli:   { tr: "Riskli — izlemede", tone: "secondary" }
};

export function buyerState(tel) {
  return all().buyers[String(tel)] || { status: "bekliyor", at: 0, note: "" };
}
export function setBuyerState(tel, patch) {
  const m = all();
  const k = String(tel);
  m.buyers[k] = Object.assign({ status: "bekliyor", at: 0, note: "" }, m.buyers[k], patch, { at: Date.now() });
  write(KEY, m);
  return m.buyers[k];
}
export function allBuyerStates() { return all().buyers; }

// ── Teklif yönlendirme ────────────────────────────────────────────────────
// Yanıtsız talep kendiliğinden çözülmez. Yönetim bir dükkânı elle işaret eder;
// esnaf panelinde "yönetim bu talebi size iletti" olarak görünür.
export function nudgesOf(reqId) { return read(NUDGE, "{}")[String(reqId)] || []; }
export function allNudges() { return read(NUDGE, "{}"); }
export function addNudge(reqId, recordId, by) {
  const m = read(NUDGE, "{}"), id = String(reqId);
  const list = (m[id] || []).filter(n => n.recordId !== recordId);
  list.push({ recordId, at: Date.now(), by: by || "Yönetim" });
  m[id] = list;
  return write(NUDGE, m)[id];
}
export function dropNudge(reqId, recordId) {
  const m = read(NUDGE, "{}"), id = String(reqId);
  m[id] = (m[id] || []).filter(n => n.recordId !== recordId);
  return write(NUDGE, m)[id];
}

// ── Saha turu ve görev atama ──────────────────────────────────────────────
// %93 kapsama açığını kapatacak iş bu. Tek tek "Mağaza Ekle" formu bir araç
// değil; görev bir yetkiliye, bir yere ve bir kat aralığına atanır ve kapanır.
const TASK = "han-tasks-v1";

export const TASK_STATES = {
  atandi: { tr: "Atandı", tone: "warning", note: "Yetkili henüz gitmedi" },
  yolda:  { tr: "Turda", tone: "primary", note: "Saha turu sürüyor" },
  tamam:  { tr: "Kapandı", tone: "success", note: "Tur tamamlandı" },
  iptal:  { tr: "İptal", tone: "secondary", note: "Yapılmayacak" }
};

export const TASK_KINDS = {
  kapsama: { tr: "Kapsama turu", note: "Kayıt açılmamış birimleri gez" },
  dogrulama: { tr: "Doğrulama", note: "Bildirilen kaydı yerinde gör" },
  icerik: { tr: "İçerik toplama", note: "Fiyat, çeşit, fotoğraf al" },
  anlasma: { tr: "Han yönetimi görüşmesi", note: "Toplu onay anlaşması" }
};

export function allTasks() { return read(TASK, "[]"); }
export function addTask(task) {
  const list = read(TASK, "[]");
  const rec = Object.assign({
    id: "tk" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    kind: "kapsama", status: "atandi", createdAt: Date.now(), note: "",
    officer: null, place: null, floors: null, recordId: null, target: 0, done: 0
  }, task);
  list.push(rec);
  write(TASK, list);
  return rec;
}
export function setTask(id, patch) {
  const list = read(TASK, "[]");
  const i = list.findIndex(t => t.id === id);
  if (i >= 0) { list[i] = Object.assign({}, list[i], patch, { at: Date.now() }); write(TASK, list); return list[i]; }
  return null;
}
export function dropTask(id) {
  write(TASK, read(TASK, "[]").filter(t => t.id !== id));
}

// ── Kullanıcılar ve roller ────────────────────────────────────────────────
// OFFICERS sabit bir sözlüktü; gerçek ekipte kullanıcı eklenir, rol değişir,
// yetki devredilir. Yetki tanımı han-scale'deki ROLES'ten okunur — çift kaynak yok.
const USER = "han-users-v1";

export function allUsers() { return read(USER, "[]"); }
export function addUser(u) {
  const list = read(USER, "[]");
  if (list.some(x => String(x.tel) === String(u.tel))) return null;
  const rec = Object.assign({
    id: "us" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: "", tel: "", role: "okuma", place: null, officer: null,
    active: true, createdAt: Date.now(), lastSeen: null
  }, u);
  list.push(rec);
  write(USER, list);
  return rec;
}
export function setUser(id, patch) {
  const list = read(USER, "[]");
  const i = list.findIndex(u => u.id === id);
  if (i >= 0) { list[i] = Object.assign({}, list[i], patch); write(USER, list); return list[i]; }
  return null;
}
export function dropUser(id) { write(USER, read(USER, "[]").filter(u => u.id !== id)); }
export function userByTel(tel) {
  const t = String(tel).replace(/\D/g, "");
  return read(USER, "[]").find(u => String(u.tel).replace(/\D/g, "") === t) || null;
}

// ── Giriş · şifre sıfırlama ───────────────────────────────────────────────
// ⚠ PROTOTİP. Gerçek üretimde kimlik doğrulama sunucu tarafındadır: PIN asla
// tarayıcıda saklanmaz, sıfırlama bağlantısı SMS/e-posta ile tek kullanımlık
// gider. Burada akışın ekranlarını ve durumlarını göstermek için tutuluyor.
const AUTH = "han-auth-v1";
export const RESET_TTL_MIN = 15;
export const MAX_TRIES = 5;

function auth() {
  const a = read(AUTH, "{}");
  a.pins = a.pins || {}; a.resets = a.resets || {}; a.tries = a.tries || {};
  return a;
}
export function hasPin(userId) { return !!auth().pins[userId]; }
export function setPin(userId, pin) {
  const a = auth();
  a.pins[userId] = String(pin);
  delete a.tries[userId];
  write(AUTH, a);
}
export function session() { return auth().session || null; }
export function logout() { const a = auth(); delete a.session; write(AUTH, a); }

export function login(tel, pin) {
  const u = userByTel(tel);
  if (!u) return { ok: false, err: "yok", msg: "Bu telefonla kayıtlı kullanıcı yok." };
  if (!u.active) return { ok: false, err: "kapali", msg: "Bu hesap kapatılmış. Yöneticinize başvurun." };
  const a = auth();
  const tries = a.tries[u.id] || 0;
  if (tries >= MAX_TRIES) return { ok: false, err: "kilit", msg: "Çok fazla hatalı deneme. Şifrenizi sıfırlayın." };
  if (!a.pins[u.id]) return { ok: false, err: "pinsiz", msg: "Bu hesaba henüz şifre kurulmadı. “Şifremi unuttum” ile kurun.", userId: u.id };
  if (a.pins[u.id] !== String(pin)) {
    a.tries[u.id] = tries + 1;
    write(AUTH, a);
    return { ok: false, err: "hatali", msg: "Şifre yanlış. Kalan deneme: " + (MAX_TRIES - tries - 1) };
  }
  delete a.tries[u.id];
  a.session = { userId: u.id, at: Date.now() };
  write(AUTH, a);
  setUser(u.id, { lastSeen: Date.now() });
  return { ok: true, user: u };
}

// Sıfırlama kodu tek kullanımlık ve süreli: sızan kod sonsuza kadar geçerli olmaz.
export function requestReset(tel) {
  const u = userByTel(tel);
  // Kullanıcı yoksa da aynı cevabı veriyoruz: kimin kayıtlı olduğu sızmasın.
  if (!u) return { ok: true, code: null, masked: maskTel(tel) };
  const a = auth();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  a.resets[code] = { userId: u.id, at: Date.now(), used: false };
  write(AUTH, a);
  return { ok: true, code, masked: maskTel(u.tel), userId: u.id };
}
export function checkReset(code) {
  const r = auth().resets[String(code)];
  if (!r) return { ok: false, msg: "Kod geçersiz." };
  if (r.used) return { ok: false, msg: "Bu kod bir kez kullanıldı. Yeni kod isteyin." };
  if (Date.now() - r.at > RESET_TTL_MIN * 60000) return { ok: false, msg: "Kodun süresi doldu. Yeni kod isteyin." };
  return { ok: true, userId: r.userId };
}
export function applyReset(code, pin) {
  const chk = checkReset(code);
  if (!chk.ok) return chk;
  if (!/^\d{4,8}$/.test(String(pin))) return { ok: false, msg: "Şifre 4–8 haneli sayı olmalı." };
  const a = auth();
  a.pins[chk.userId] = String(pin);
  a.resets[String(code)].used = true;
  delete a.tries[chk.userId];
  a.session = { userId: chk.userId, at: Date.now() };
  write(AUTH, a);
  return { ok: true, userId: chk.userId };
}
export function maskTel(tel) {
  const t = String(tel || "").replace(/\D/g, "");
  return t.length < 6 ? "•••" : t.slice(0, 3) + " ••• •• " + t.slice(-2);
}

// ── Veri kalitesi iş listeleri ────────────────────────────────────────────
// "Kataloğu boş: 421" bir sayıydı, listesi yoktu — kime gidileceği belli değildi.
// Her kural bir iş listesi üretir ve doğrudan saha görevine dönüşebilir.
export const QUALITY_RULES = {
  fiyatsiz:  { tr: "Fiyat bandı yok", note: "Alıcı fiyat soramıyor — kaydın en büyük eksiği", tone: "danger" },
  telsiz:    { tr: "Telefon yok", note: "Temas kurulamıyor", tone: "danger" },
  fotosuz:   { tr: "Fotoğraf yok", note: "Vitrin görünmüyor, güven düşük", tone: "warning" },
  eskimis:   { tr: "Tazeliği düşmüş", note: "Uzun süre dokunulmamış", tone: "warning" },
  gruppsuz:  { tr: "Çeşit grubu yok", note: "Aramada eşleşmiyor", tone: "warning" },
  mukerrer:  { tr: "Mükerrer kayıt", note: "Aynı kapıda birden fazla kayıt", tone: "danger" }
};

export function qualityLists(records, freshDays) {
  const out = {};
  Object.keys(QUALITY_RULES).forEach(k => { out[k] = []; });
  const seen = {};
  (records || []).forEach(r => {
    if (!r.band) out.fiyatsiz.push(r);
    if (!r.tel) out.telsiz.push(r);
    if (!r.photos) out.fotosuz.push(r);
    if ((r.updatedDays || 0) > (freshDays || 90)) out.eskimis.push(r);
    if (!(r.groups || []).length) out.gruppsuz.push(r);
    const k = r.place + "|" + r.floor + "|" + r.door;
    if (seen[k]) out.mukerrer.push(r); else seen[k] = r.id;
  });
  return out;
}

// ── Toplu içe aktarma ─────────────────────────────────────────────────────
// Han yönetiminden gelen kiracı listesi elle 142 kayıt açılarak girilemez.
// Serbest metin yapıştırılır; ayırıcı virgül, noktalı virgül veya sekme olabilir.
export function parseImport(text) {
  const rows = [], errors = [];
  String(text || "").split(/\r?\n/).forEach((line, i) => {
    const raw = line.trim();
    if (!raw || /^#/.test(raw)) return;
    const parts = raw.split(/\s*[;\t]\s*|\s*,\s*/).map(x => x.trim());
    const [door, name, cats, tel] = parts;
    if (!door || !name) {
      errors.push({ line: i + 1, raw, msg: "Kapı no ve ad zorunlu" });
      return;
    }
    rows.push({
      line: i + 1,
      door: String(door).replace(/^no[:.]?\s*/i, ""),
      name,
      cats: (cats || "").split("/").map(x => x.trim()).filter(Boolean),
      tel: String(tel || "").replace(/\D/g, "")
    });
  });
  // Aynı kapı listede iki kez varsa İKİNCİSİ düşer: veri girişinde en sık hata bu.
  const seenDoor = {}, keep = [];
  rows.forEach((r, i) => {
    if (seenDoor[r.door]) {
      errors.push({ line: r.line, raw: r.name, msg: "Kapı no " + r.door + " listede tekrar ediyor — bu satır alınmadı" });
      return;
    }
    seenDoor[r.door] = true;
    keep.push(r);
  });
  return { rows: keep, errors, total: rows.length };
}

// ── İçerik yönetimi: etkinlik ve kampanya ─────────────────────────────────
// EVENTS ve CAMPAIGNS alıcıya gösteriliyordu ama düzenlenemiyordu. Ekleme,
// gizleme ve düzeltme burada; alıcı tarafı aynı katmanı okur.
const CONTENT = "han-content-v1";   // { events:{add:[],hide:[],patch:{}}, camps:{...} }

function content() {
  const c = read(CONTENT, "{}");
  c.events = c.events || { add: [], hide: [], patch: {} };
  c.camps = c.camps || { add: [], hide: [], patch: {} };
  return c;
}
export const EVENT_KINDS = {
  tour: { tr: "Gezi · açık gün" }, fair: { tr: "Fuar" },
  workshop: { tr: "Atölye" }, culture: { tr: "Kültür" }, market: { tr: "Pazar günü" }
};

// Temel liste + eklenenler − gizlenenler + düzeltmeler. Kaynak veri bozulmaz.
export function mergeContent(base, kind) {
  const c = content()[kind === "events" ? "events" : "camps"];
  const out = (base || []).filter(x => !c.hide.includes(x.id))
    .map(x => (c.patch[x.id] ? Object.assign({}, x, c.patch[x.id]) : x));
  return c.add.filter(x => !c.hide.includes(x.id)).concat(out);
}
export function addContent(kind, item) {
  const c = content(), k = kind === "events" ? "events" : "camps";
  const rec = Object.assign({ id: "ct" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }, item);
  c[k].add.unshift(rec);
  write(CONTENT, c);
  return rec;
}
export function patchContent(kind, id, patch) {
  const c = content(), k = kind === "events" ? "events" : "camps";
  const own = c[k].add.find(x => x.id === id);
  if (own) Object.assign(own, patch);
  else c[k].patch[id] = Object.assign({}, c[k].patch[id], patch);
  write(CONTENT, c);
}
export function hideContent(kind, id, on) {
  const c = content(), k = kind === "events" ? "events" : "camps";
  c[k].hide = c[k].hide.filter(x => x !== id);
  if (on) c[k].hide.push(id);
  write(CONTENT, c);
}
export function isHidden(kind, id) {
  return content()[kind === "events" ? "events" : "camps"].hide.includes(id);
}

// ── Mağaza görselleri ─────────────────────────────────────────────────────
// Fotoğraf kaydın en zayıf alanı (609 kayıtta hiç yok) ama uçtan uca bir akışı
// yoktu: yükleme, sıralama, kapak seçimi, onay. Hepsi tek yerde.
const MEDIA = "han-media-v1";   // { [recordId]: [{id, slot, caption, cover, status}] }

export const MEDIA_STATES = {
  bekliyor: { tr: "Onay bekliyor", tone: "warning" },
  onayli:   { tr: "Yayında", tone: "success" },
  red:      { tr: "Reddedildi", tone: "danger" }
};
export const MEDIA_KINDS = {
  vitrin: { tr: "Vitrin" }, ic: { tr: "Dükkân içi" },
  urun: { tr: "Ürün" }, kapi: { tr: "Kapı · tabela" }
};

export function mediaOf(recordId) { return (read(MEDIA, "{}")[recordId] || []).slice(); }
export function allMedia() { return read(MEDIA, "{}"); }
export function addMedia(recordId, item) {
  const m = read(MEDIA, "{}");
  const list = m[recordId] || [];
  const rec = Object.assign({
    id: "ph" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    kind: "vitrin", caption: "", status: "bekliyor",
    cover: list.length === 0, at: Date.now()
  }, item);
  // slot kimliği kalıcı olmalı: kullanıcının bıraktığı görsel yenilemede durur.
  rec.slot = rec.slot || (recordId + "-" + rec.id);
  list.push(rec);
  m[recordId] = list;
  write(MEDIA, m);
  return rec;
}
export function setMedia(recordId, id, patch) {
  const m = read(MEDIA, "{}");
  const list = m[recordId] || [];
  const i = list.findIndex(x => x.id === id);
  if (i < 0) return null;
  list[i] = Object.assign({}, list[i], patch);
  // Kapak tek olabilir: yeni kapak seçilince eskisi düşer.
  if (patch.cover) list.forEach((x, j) => { if (j !== i) x.cover = false; });
  m[recordId] = list;
  write(MEDIA, m);
  return list[i];
}
export function dropMedia(recordId, id) {
  const m = read(MEDIA, "{}");
  let list = (m[recordId] || []).filter(x => x.id !== id);
  // Kapak silindiyse ilk yayındaki görsel kapak olur — kapaksız kalmaz.
  if (list.length && !list.some(x => x.cover)) {
    const first = list.find(x => x.status === "onayli") || list[0];
    first.cover = true;
  }
  m[recordId] = list;
  write(MEDIA, m);
}
export function moveMedia(recordId, id, dir) {
  const m = read(MEDIA, "{}");
  const list = m[recordId] || [];
  const i = list.findIndex(x => x.id === id);
  const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= list.length) return;
  const t = list[i]; list[i] = list[j]; list[j] = t;
  m[recordId] = list;
  write(MEDIA, m);
}

// ── Harita ve kat planı ───────────────────────────────────────────────────
// Yerin konumu ve kat planı adres omurgasının fiziksel yüzü. Pin yanlışsa
// alıcı kapıyı bulamaz — bu yüzden düzeltilebilir olmalı.
const GEO = "han-geo-v1";   // { [placeId]: {lat,lng,entrances:[],corridors:{},note} }

export function geoOf(placeId) { return read(GEO, "{}")[placeId] || null; }
export function allGeo() { return read(GEO, "{}"); }
export function setGeo(placeId, patch) {
  const g = read(GEO, "{}");
  g[placeId] = Object.assign({}, g[placeId], patch);
  write(GEO, g);
  return g[placeId];
}
// Panelde düzeltilen konum omurgaya işlenir: Web de aynı pini görür.
export function applyGeo(places) {
  const g = read(GEO, "{}");
  (places || []).forEach(p => {
    const o = g[p.id];
    if (!o) return;
    if (typeof o.lat === "number") p.lat = o.lat;
    if (typeof o.lng === "number") p.lng = o.lng;
    if (o.entrances) p.entrances = o.entrances;
    if (o.corridors) p.corridors = o.corridors;
    if (o.note) p.geoNote = o.note;
  });
  return g;
}

// ── Pazar sağlığı özeti ───────────────────────────────────────────────────
// Tek yerden hesaplanır: Özet kartı da, Teklif Denetimi ekranı da bunu okur.
// SLA eşiği: talep 48 saat yanıtsızsa müdahale gerekir.
export const SLA_HOURS = 48;

export function marketHealth(talepler, offersOf, seenOf, declinedOf) {
  const now = Date.now();
  // Talep id'si zaman damgasıdır (Date.now()). Ama dışarıdan gelen/eski kayıtta
  // öyle olmayabilir — saçma bir yaş hesaplayıp "496674 saat" yazmaktansa
  // yaşı bilinmiyor deriz. SLA de bilinmeyen yaşa uygulanmaz.
  const YEAR2020 = 1577836800000;
  const rows = (talepler || []).map(t => {
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
    quoted: rows.filter(r => r.offers > 0).length,
    silent: rows.filter(r => r.offers === 0).length,
    overdue: rows.filter(r => r.overdue).length,
    // Yanıt oranı pazarın tek gerçek sağlık göstergesi.
    answerRate: rows.length ? Math.round(rows.filter(r => r.offers > 0).length / rows.length * 100) : null
  };
}
