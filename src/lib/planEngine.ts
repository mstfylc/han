// HAN — the bazaar day.
//
// A plan is not a shopping list. It is a day with a fixed number of hours, real
// opening times, and a load you have to carry. So the engine has to do four
// things the list cannot:
//
//   · group by PLACE — you walk into a han once, not once per shop;
//   · order by distance, then push the heavy stops to the end;
//   · shift arrivals around closures and the Friday prayer break, and say why;
//   · cut what does not fit, and say what was cut and why.
//
// A manual reorder always wins over the automatic one: the buyer knows their
// own appointment and which han they want to see first better than we do.

import * as AD from "@/data/han-admin";
import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import type { Lang, Mode, Place, ShopRecord } from "@/data/types";
import type { BuyItem, Trip } from "@/state/types";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

/** Categories that mean bags you then have to carry all day. */
const HEAVY = ["hali", "tekstil", "gida", "poset", "baharat"];

const DAY_OFFSET: Record<string, number> = {
  today: 0,
  tomorrow: 1,
  get weekend() {
    return (6 - new Date().getDay() + 7) % 7 || 6;
  },
};

export function hhmm(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(Math.round(m % 60)).padStart(2, "0");
}

export interface Stop {
  place: Place;
  recs: ShopRecord[];
  items: BuyItem[];
}

export interface KeptStop {
  stop: Stop;
  /** minutes from midnight */
  arrive: number;
  dwell: number;
  walk: number;
  /** why the arrival moved, when it did */
  shiftNote: string;
  heavy: boolean;
}

export interface CutStop {
  stop: Stop;
  why: string;
}

export interface DayItem {
  at: number | null;
  end: number | null;
  kind: "durak" | "etkinlik" | "kargo" | "randevu";
  title: string;
  meta: string;
  n?: number;
  apptId?: string;
  clash: boolean;
}

export interface PlanResult {
  kept: KeptStop[];
  cut: CutStop[];
  unmatched: BuyItem[];
  /** the order actually used, for the reorder controls */
  orderIds: string[];
  cargoStop: { arrive: number; label: string } | null;
  /** minutes of the day budget used */
  used: number;
  budget: number;
  startClock: number;
  day: DayItem[];
}

const dist = (a: Place, b: Place) => {
  const dx = (a.lat - b.lat) * 111;
  const dy = (a.lng - b.lng) * 83;
  return Math.sqrt(dx * dx + dy * dy);
};

export function buildPlan(
  trip: Trip,
  opts: {
    lang: Lang;
    mode: Mode;
    events: string[];
    appointments: { id: string; time: string; title: string; where: string }[];
  },
): PlanResult {
  const { lang, mode } = opts;

  const when = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (DAY_OFFSET[trip.day] || 0));
    d.setHours(Math.floor(trip.start), Math.round((trip.start % 1) * 60), 0, 0);
    return d;
  })();

  // Each line resolves through the scale engine, so a plan is not limited to
  // the 11 rich records.
  const picks = (trip.items || []).map((it) => {
    const res = SE.search(it.name || "", {}, { mode, lang });
    return { item: it, rec: (res.items[0] || {}).rec || null };
  });
  const unmatched = picks.filter((p) => !p.rec).map((p) => p.item);

  const byPlace: Record<string, Stop> = {};
  picks.forEach((p) => {
    if (!p.rec) return;
    const id = p.rec.place;
    const place = SC.PLACES.find((x) => x.id === id);
    if (!place) return;
    if (!byPlace[id]) byPlace[id] = { place, recs: [], items: [] };
    byPlace[id].recs.push(p.rec);
    byPlace[id].items.push(p.item);
  });

  let stops = Object.values(byPlace);
  const isHeavy = (s: Stop) => s.recs.some((r) => HEAVY.includes(r.cat));

  // Nearest-neighbour, then heavy stops to the end.
  if (stops.length > 1) {
    const rest = stops.slice(1);
    const out = [stops[0]];
    while (rest.length) {
      const last = out[out.length - 1].place;
      rest.sort((x, y) => dist(last, x.place) - dist(last, y.place));
      out.push(rest.shift() as Stop);
    }
    stops = out;
  }
  stops.sort((a, b) => (isHeavy(a) ? 1 : 0) - (isHeavy(b) ? 1 : 0));

  // W5 · a manual order overrides the automatic one. A stop added afterwards
  // does not get dumped at the end — it lands near where the automatic order
  // would have put it.
  const manual = trip.order || [];
  if (manual.length) {
    const rank: Record<string, number> = {};
    manual.forEach((id, i) => { rank[id] = i; });
    stops.sort((a, b) => {
      const ra = rank[a.place.id];
      const rb = rank[b.place.id];
      if (ra == null && rb == null) return 0;
      if (ra == null) return 1;
      if (rb == null) return -1;
      return ra - rb;
    });
  }

  const orderIds = stops.map((s) => s.place.id);

  // Time budget: 20 min per stop, +10 if heavy, plus the walk between places.
  const budget = Math.round(trip.hours * 60);
  const startClock = when.getHours() * 60 + when.getMinutes();
  let clock = startClock;
  const kept: KeptStop[] = [];
  const cut: CutStop[] = [];

  stops.forEach((s, i) => {
    const walk = i === 0 ? 0 : Math.max(4, Math.round(dist(stops[i - 1].place, s.place) * 13));
    const dwell = 20 + (isHeavy(s) ? 10 : 0) + Math.min(15, (s.items.length - 1) * 6);

    let arrive = clock + walk;
    let shiftNote = "";
    const probe = new Date(when.getTime());
    probe.setHours(Math.floor(arrive / 60), arrive % 60, 0, 0);

    // A trader's own declared hours beat the place's default.
    const os = SC.openState(s.place, probe, s.recs.find((r) => r.hours) || null);
    if (!os.open) {
      if (os.reason === "namaz") {
        arrive = 14 * 60;
        shiftNote = pk({ tr: "Cuma namazı arası — 14:00'e aldım", en: "Friday prayer break — moved to 14:00", ru: "Пятничный перерыв — сдвинул на 14:00", ar: "فترة صلاة الجمعة — نُقل إلى ١٤:٠٠" }, lang);
      } else if (os.reason === "erken" && os.open2 != null) {
        arrive = Math.round(os.open2 * 60);
        shiftNote = pk({ tr: "Açılışı bekledim — " + hhmm(arrive), en: "Waited for opening — " + hhmm(arrive), ru: "Ждём открытия — " + hhmm(arrive), ar: "بانتظار الفتح — " + hhmm(arrive) }, lang);
      } else {
        cut.push({
          stop: s,
          why: os.reason === "gun"
            ? pk({ tr: "Bu gün kapalı", en: "Closed that day", ru: "В этот день закрыто", ar: "مغلق ذلك اليوم" }, lang)
            : pk({ tr: "Siz oradayken kapanmış olur", en: "Would already be closed", ru: "Уже будет закрыто", ar: "سيكون مغلقًا" }, lang),
        });
        return;
      }
    }

    if (arrive + dwell - startClock > budget) {
      cut.push({
        stop: s,
        why: pk({ tr: trip.hours + " saate sığmadı", en: "Did not fit in " + trip.hours + "h", ru: "Не влезло в " + trip.hours + " ч", ar: "لم يتسع في " + trip.hours + " ساعة" }, lang),
      });
      return;
    }

    kept.push({ stop: s, arrive, dwell, walk, shiftNote, heavy: isHeavy(s) });
    clock = arrive + dwell;
  });

  // Shipping instead of carrying adds a cargo stop at the end of the walk.
  const cargoStop =
    trip.carry === "kargo" && kept.some((k) => k.heavy)
      ? { arrive: clock + 8, label: pk({ tr: "Kargo · aldıklarını gönder", en: "Cargo · ship your purchases", ru: "Карго · отправка покупок", ar: "شحن · أرسل مشترياتك" }, lang) }
      : null;

  // ── M5 · the day's calendar ─────────────────────────────────────────────
  // Stops, events, appointments and cargo on ONE line. Kept in separate lists
  // they never showed a time collision, so a planned event got missed or a stop
  // was walked to for nothing.
  const items: Omit<DayItem, "clash">[] = [];

  kept.forEach((k, i) =>
    items.push({
      at: k.arrive,
      end: k.arrive + k.dwell,
      kind: "durak",
      title: k.stop.place.name,
      n: i + 1,
      meta: k.stop.items.map((x) => x.name).slice(0, 3).join(", "),
    }),
  );

  (opts.events || []).forEach((id) => {
    const e = AD.mergeContent(D.EVENTS || [], "events").find((x) => x.id === id);
    if (!e) return;
    const m = /^(\d{1,2})[:.](\d{2})/.exec(String(e.time || ""));
    const h = D.HANS.find((x) => x.id === e.han);
    const a = D.AREAS.find((x) => x.id === e.area);
    items.push({
      at: m ? Number(m[1]) * 60 + Number(m[2]) : null,
      end: null,
      kind: "etkinlik",
      title: (e[lang] as string) || (e.tr as string),
      meta: [e.time as string, h ? (h.name as string) : a ? ((a[lang] as string) || (a.tr as string)) : ""].filter(Boolean).join(" · "),
    });
  });

  if (cargoStop) items.push({ at: cargoStop.arrive, end: null, kind: "kargo", title: cargoStop.label, meta: "" });

  // The third source: the buyer's own appointments. A bazaar day is not only
  // shopping — a sample handover, the customs broker and the bank land on it too.
  (opts.appointments || []).forEach((ap) => {
    const m = /^(\d{1,2})[:.](\d{2})/.exec(String(ap.time || ""));
    const at = m ? Number(m[1]) * 60 + Number(m[2]) : null;
    items.push({
      at,
      end: at == null ? null : at + 30,
      kind: "randevu",
      title: ap.title,
      meta: [ap.time, ap.where].filter(Boolean).join(" · "),
      apptId: ap.id,
    });
  });

  // An item with no known time goes last; we do not invent a time for it.
  items.sort((a, b) => (a.at == null ? 1e9 : a.at) - (b.at == null ? 1e9 : b.at));

  const clashes = (it: Omit<DayItem, "clash">) =>
    (it.kind === "etkinlik" || it.kind === "randevu") &&
    it.at != null &&
    items.some(
      (x) =>
        x !== it &&
        x.at != null &&
        ((x.kind === "durak" && x.end != null && x.at <= it.at! && it.at! < x.end) ||
          ((x.kind === "etkinlik" || x.kind === "randevu") && x.end != null && x.at <= it.at! && it.at! < x.end)),
    );

  const day: DayItem[] = items.map((it) => ({ ...it, clash: clashes(it) }));

  return {
    kept,
    cut,
    unmatched,
    orderIds,
    cargoStop,
    used: kept.length ? clock - startClock : 0,
    budget,
    startClock,
    day,
  };
}

/** Move a stop one position and return the new explicit order. */
export function reorder(orderIds: string[], id: string, dir: -1 | 1): string[] {
  const i = orderIds.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= orderIds.length) return orderIds;
  const next = orderIds.slice();
  next.splice(j, 0, next.splice(i, 1)[0]);
  return next;
}

/** Drop `from` in front of `onto`. */
export function moveBefore(orderIds: string[], from: string, onto: string): string[] {
  if (!from || from === onto) return orderIds;
  const next = orderIds.slice();
  const fi = next.indexOf(from);
  if (fi < 0) return orderIds;
  next.splice(fi, 1);
  next.splice(next.indexOf(onto), 0, from);
  return next;
}
