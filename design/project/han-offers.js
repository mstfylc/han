// HAN — gerçek teklif deposu.
//
// K9: motordan çıkan sayı bir ÇIKARIMDIR ("tahmini aralık"), esnafın verdiği
// sayı bir TAAHHÜTTÜR ("dükkândan teklif"). İkisi asla aynı yerden gelmez —
// tahmin `han-search.js` içinde üretilir, gerçek teklif burada saklanır.
//
// Depo tarayıcıda: alıcı sekmesi ile esnaf paneli aynı anahtarı okur/yazar,
// `storage` olayıyla iki taraf da canlı görür.

const KEY = "han-offers-v1";     // { [reqId]: [offer] }
const SEEN = "han-seen-v1";      // { [reqId]: { [recordId]: ts } }  — huni "açtı"
const DECL = "han-declined-v1";  // { [reqId]: { [recordId]: {reason, at} } }

export const OFFER_VALID_DAYS = 7;

function read(k) {
  try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; }
}
function write(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  return v;
}

export function allOffers() { return read(KEY); }

export function offersOf(reqId) { return (read(KEY)[String(reqId)] || []).slice(); }

// Bir dükkân bir talebe tek teklif verir; yeniden verirse öncekini günceller.
export function putOffer(reqId, offer) {
  const all = read(KEY), id = String(reqId);
  const list = (all[id] || []).filter(o => o.recordId !== offer.recordId);
  list.push(Object.assign({
    at: Date.now(),
    validUntil: Date.now() + OFFER_VALID_DAYS * 86400000,
    real: true, estimate: false
  }, offer));
  all[id] = list;
  return write(KEY, all)[id];
}

export function dropOffer(reqId, recordId) {
  const all = read(KEY), id = String(reqId);
  all[id] = (all[id] || []).filter(o => o.recordId !== recordId);
  return write(KEY, all)[id];
}

// Huni · "açtı": esnafın paneli talebi gösterdiği an işaretlenir.
export function allSeen() { return read(SEEN); }
export function markSeen(reqIds, recordId) {
  const all = read(SEEN);
  let changed = false;
  (reqIds || []).forEach(rid => {
    const id = String(rid);
    all[id] = all[id] || {};
    if (!all[id][recordId]) { all[id][recordId] = Date.now(); changed = true; }
  });
  return changed ? write(SEEN, all) : all;
}
export function seenCount(reqId) { return Object.keys(read(SEEN)[String(reqId)] || {}).length; }

// D4 · "cevaplayamam" bir yanıttır: sessizlikten iyidir, alıcıya sebebini söyler.
export const DECLINE_REASONS = {
  stok:   { tr: "Bu iş bende yok", en: "I don't carry this", ru: "Этого у меня нет", ar: "لا أتعامل بهذا" },
  adet:   { tr: "Adet bana göre değil", en: "Quantity doesn't suit me", ru: "Объём не подходит", ar: "الكمية لا تناسبني" },
  termin: { tr: "Bu tarihe yetiştiremem", en: "Can't make that date", ru: "Не успею к сроку", ar: "لا ألحق بالموعد" },
  dolu:   { tr: "Şu an kapasitem dolu", en: "At capacity right now", ru: "Сейчас загружен", ar: "طاقتي ممتلئة الآن" }
};
export function allDeclined() { return read(DECL); }
export function putDecline(reqId, recordId, reason) {
  const all = read(DECL), id = String(reqId);
  all[id] = Object.assign({}, all[id], { [recordId]: { reason, at: Date.now() } });
  return write(DECL, all);
}
export function declineOf(reqId, recordId) {
  return (read(DECL)[String(reqId)] || {})[recordId] || null;
}

// K3 · yorum yalnız teklif kabul etmiş alıcıda. Yorumlar da aynı mantıkla
// tarayıcıda tutulur; kayda ait yorumlar dükkân sayfasında en üstte çıkar.
const REV = "han-reviews-v1";    // { [recordId]: [review] }
export function allReviews() { return read(REV); }
export function reviewsOf(recordId) { return (read(REV)[recordId] || []).slice(); }
export function putReview(recordId, review) {
  const all = read(REV);
  // Her yorumun kal\u0131c\u0131 kendi kimli\u011fi olmal\u0131: `at` tek ba\u015f\u0131na anahtar de\u011fil.
  // Ayn\u0131 milisaniyede iki yorum yaz\u0131l\u0131rsa moderasyon anahtar\u0131 \u00e7ak\u0131\u015f\u0131yor ve
  // birini gizlemek ikisini gizliyordu.
  const id = "rv" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  all[recordId] = (all[recordId] || []).concat([Object.assign({ id, at: Date.now() }, review)]);
  return write(REV, all)[recordId];
}
