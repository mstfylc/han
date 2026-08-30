"use client";

// Esnaf — the trader's door into the buyer surface.
//
// The rule this screen exists to enforce is a single sentence: owning a record
// is a decision, not a button. The trader finds their unit, asks for it, and an
// officer verifies. Until that verification lands, not one field of the record
// moves — no price, no catalogue, no photo. That is why the claim is stored with
// the officer it was routed to (B/K10) and why nothing on the "manage" tab is
// reachable without both an approved claim AND a phone session matching the
// phone on that claim: the record belongs to a person, not to a browser.
//
//   K9 · what the trader types here is a COMMITMENT. The engine's estimated
//        range is an inference and lives elsewhere; the two never mix.
//   K11 · every field a trader fills lifts its provenance from "tahmini" to
//        "esnaf" — applyOverrides in AppState is the single merge point.
//   K8 · the scorecard speaks money, not grades: "work you missed", counted
//        from requests that actually reached this record, never a made-up total.
//   U3 · "opened it" is recorded the moment the panel shows a request. It is an
//        event, not a percentage.

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import * as AD from "@/data/han-admin";
import * as OF from "@/data/han-offers";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import type { BuyRequest, Lang, ShopRecord } from "@/data/types";
import { Button, Icon, Input, Select, Textarea } from "@/ds";
import { F } from "@/lib/copy";
import { money, tonePair, upper } from "@/lib/i18n";
import { CARD_BOX, STICKY_TOP, areaOn, breaks, searchGrid } from "@/lib/layout";
import { PARAM, getStr, href } from "@/lib/routes";
import { recordName } from "@/lib/shop";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";
import type { Claim, OverrideEntry } from "@/state/types";

/** Any four-language string: the inline ones written here and the L10n rows
 *  that come out of the data layer read the same way. */
type Loc = { tr: string; en?: string; ru?: string; ar?: string };
const pk = (o: Loc, lang: Lang) => (o as Record<string, string | undefined>)[lang] || o.tr;

const KICKER = "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)";
const CARD = "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:20px;box-shadow:0 3px 4px rgba(0,0,0,.03)";
const HOLLOW = "background:var(--surface-card);border:1px dashed var(--border-strong);border-radius:14px;padding:32px 24px";

type Tab = "bul" | "talep" | "durum" | "yonet";
const TABS: Tab[] = ["bul", "talep", "durum", "yonet"];

/** The demo code. Real verification is an SMS the panel surface owns; here the
 *  point being demonstrated is that a number gates the record, not a device. */
const DEMO_CODE = "1234";

export default function TraderPage() {
  return (
    <Suspense fallback={null}>
      <TraderScreen />
    </Suspense>
  );
}

function TraderScreen() {
  const { state, save, set, toast } = useApp();
  const router = useRouter();
  const params = useParams<{ tab?: string[] }>();
  const sp = useSearchParams();
  const { lang, mode } = state;
  const b = breaks(state.vw);
  const t = (o: Loc) => pk(o, lang);

  const raw = params.tab?.[0] as Tab | undefined;
  const tab: Tab = raw && TABS.includes(raw) ? raw : "bul";
  const go = (next: Tab, opts?: Parameters<typeof href.trader>[1]) => router.push(href.trader(next, opts));

  const claims = (state.claims || {}) as Record<string, Claim>;

  // ── naming a unit the way a trader says it out loud ──────────────────────
  const placeName = (id: string) => (SC.PLACES.find((p) => p.id === id) || { name: "" }).name;
  const floorLabel = (n: number) =>
    n === 0
      ? t({ tr: "Zemin", en: "Ground", ru: "Первый", ar: "الأرضي" })
      : t({ tr: n + ". kat", en: "Floor " + n, ru: n + " этаж", ar: "الطابق " + n });
  const whereOf = (r: ShopRecord) =>
    [placeName(r.place), floorLabel(r.floor), t({ tr: "No", en: "No", ru: "№", ar: "رقم" }) + " " + r.door].join(" · ");

  // ── finder ───────────────────────────────────────────────────────────────
  // The place and door live in the URL so "is it yours?" on a search hit can
  // deep-link straight to the right unit.
  const place = getStr(sp, PARAM.place, "all");
  const door = getStr(sp, PARAM.door);
  const [q, setQ] = useState("");

  const norm = (s: string) => String(s || "").toLocaleLowerCase("tr").trim();
  const hits = useMemo(() => {
    const nq = norm(q), nd = norm(door);
    // Nothing is listed until the trader narrows: 1,385 rows is not a finder.
    if (place === "all" && !nq && !nd) return [];
    return SC.RECORDS.filter((r) => {
      if (place !== "all" && r.place !== place) return false;
      if (nd && String(r.door) !== nd) return false;
      if (nq && !norm(recordName(r, lang)).includes(nq)) return false;
      return true;
    }).slice(0, 12);
  }, [place, door, q, lang]);

  // ── claim form ───────────────────────────────────────────────────────────
  const pickId = getStr(sp, PARAM.record);
  const pick = pickId ? SC.RECORDS.find((r) => r.id === pickId) || null : null;
  const [owner, setOwner] = useState("");
  const [tel, setTel] = useState("");
  const [proof, setProof] = useState("han");
  const [errs, setErrs] = useState<{ owner?: string; tel?: string }>({});

  const proofDefs: [string, string, string][] = [
    ["han",
      t({ tr: "Han yönetimi listesinde adım var", en: "I am on the han's own registry", ru: "Я есть в реестре хана", ar: "اسمي في سجل الخان" }),
      t({ tr: "En hızlısı: yönetim listesiyle eşleşirse aynı gün onaylanır.", en: "Fastest: matched against the registry, approved the same day.", ru: "Самый быстрый путь: сверка с реестром, подтверждение в тот же день.", ar: "الأسرع: يُطابق مع السجل ويُعتمد في اليوم نفسه." })],
    ["belge",
      t({ tr: "Vergi levhası · ruhsat gönderebilirim", en: "I can send my tax plate · licence", ru: "Могу прислать налоговый документ", ar: "أستطيع إرسال البطاقة الضريبية" }),
      t({ tr: "Belgeyi yetkili görür; adres ve unvan tutarsa onaylanır.", en: "The officer checks the document against the address and title.", ru: "Инспектор сверит документ с адресом и названием.", ar: "يفحص المسؤول المستند مقابل العنوان والاسم." })],
    ["saha",
      t({ tr: "Kapıya gelip görsünler", en: "Come and see the door", ru: "Пусть придут и посмотрят", ar: "ليأتوا ويروا المحل" }),
      t({ tr: "Saha turu haftalıktır; sıraya girer, tarih bildirilir.", en: "Field rounds are weekly; you get queued and told the date.", ru: "Обход еженедельный: вас поставят в очередь и сообщат дату.", ar: "الجولة الميدانية أسبوعية؛ ستُدرج ويُبلَّغ الموعد." })],
  ];

  const submitClaim = () => {
    if (!pick) return go("bul");
    const e: { owner?: string; tel?: string } = {};
    if (!owner.trim()) e.owner = t({ tr: "Ad soyad gerekli", en: "Full name is required", ru: "Нужно имя", ar: "الاسم مطلوب" });
    if (tel.replace(/\D/g, "").length < 10) e.tel = t({ tr: "Geçerli bir telefon yazın", en: "Enter a valid phone", ru: "Введите корректный телефон", ar: "أدخل هاتفًا صحيحًا" });
    if (Object.keys(e).length) return setErrs(e);
    const claim: Claim = {
      record: pick.id, name: recordName(pick, lang), place: pick.place, floor: pick.floor, door: pick.door,
      owner: owner.trim(), tel: tel.trim(), proof,
      officer: pick.officer, status: "bekliyor", at: Date.now(),
    };
    save({ claims: { ...claims, [pick.id]: claim } });
    setOwner(""); setTel(""); setErrs({});
    toast(t({ tr: "Talebiniz yetkiliye iletildi", en: "Your request reached the officer", ru: "Заявка отправлена ответственному", ar: "وصل طلبك إلى المسؤول" }));
    go("durum");
  };

  // ── my claims ────────────────────────────────────────────────────────────
  const myClaims = Object.keys(claims)
    .map((id) => {
      const rec = SC.RECORDS.find((r) => r.id === id);
      return rec ? { claim: claims[id], rec } : null;
    })
    .filter((x): x is { claim: Claim; rec: ShopRecord } => !!x);

  const ownedIds = myClaims.filter((x) => x.claim.status === "onayli").map((x) => x.rec.id);

  // ── the phone gate ───────────────────────────────────────────────────────
  const manageParam = getStr(sp, PARAM.record);
  const manageId = manageParam && ownedIds.includes(manageParam) ? manageParam : (ownedIds[0] || null);
  const mRec = manageId ? SC.RECORDS.find((r) => r.id === manageId) || null : null;
  const mClaim = manageId ? claims[manageId] : null;
  const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
  const sessionOk = !!(state.esSession && mClaim && digits(state.esSession.tel) === digits(mClaim.tel));

  const [loginTel, setLoginTel] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const doLogin = () => {
    const want = digits(loginTel);
    const match = ownedIds.find((id) => digits(claims[id]?.tel) === want);
    if (!match) return toast(t({ tr: "Bu numaraya bağlı onaylı kayıt yok", en: "No approved record on this number", ru: "Нет записи по этому номеру", ar: "لا سجل معتمد لهذا الرقم" }));
    if (loginCode.trim() !== DEMO_CODE) return toast(t({ tr: "Kod hatalı (demo: 1234)", en: "Wrong code (demo: 1234)", ru: "Неверный код (демо: 1234)", ar: "رمز خطأ (تجريبي: 1234)" }));
    save({ esSession: { tel: want, at: Date.now() } });
    setLoginTel(""); setLoginCode("");
    router.replace(href.trader("yonet", { record: match }));
    toast(t({ tr: "Giriş yapıldı", en: "Signed in", ru: "Вы вошли", ar: "تم الدخول" }));
  };

  // ── this record's inbox ──────────────────────────────────────────────────
  // A request lands here because it matches this record's category — the same
  // distribution the buyer's funnel is measured against, not a second opinion.
  // A routed request (the panel's "Teklif Denetimi" nudge) lands in this
  // inbox even when distribution never picked the record: an unanswered
  // request does not solve itself, so management can point it at a shop.
  const nudgedIds = useMemo<Set<string>>(() => {
    if (!mRec) return new Set();
    const all = AD.allNudges();
    const mine = new Set<string>();
    Object.keys(all).forEach((reqId) => {
      if ((all[reqId] || []).some((n) => n.recordId === mRec.id)) mine.add(String(reqId));
    });
    return mine;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mRec, state.offersRev]);

  const inbox = useMemo<BuyRequest[]>(() => {
    if (!mRec) return [];
    return (state.talepler || []).filter((req) => {
      if (nudgedIds.has(String(req.id))) return true;
      const d = SE.distribute(req, { mode, lang });
      return !!d && (d.sent || []).some((x) => x.id === mRec.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mRec, state.talepler, mode, lang, state.offersRev, nudgedIds]);

  // U3 · "opened it" is recorded the instant the panel actually shows the
  // request. Written in an effect, never during render.
  const seenRef = useRef("");
  useEffect(() => {
    if (!mRec || !sessionOk || !inbox.length) return;
    const key = mRec.id + ":" + inbox.map((x) => x.id).join(",");
    if (seenRef.current === key) return;
    seenRef.current = key;
    OF.markSeen(inbox.map((x) => x.id), mRec.id);
  }, [mRec, sessionOk, inbox]);

  // ── the offer form ───────────────────────────────────────────────────────
  const [ofReq, setOfReq] = useState<string | null>(null);
  const [of, setOf] = useState({ unit: "", qty: "", days: "", note: "" });

  const sendOffer = (req: BuyRequest) => {
    if (!mRec) return;
    const n = (v: string) => {
      const x = Number(String(v).replace(/[^\d.,]/g, "").replace(",", "."));
      return x > 0 ? x : null;
    };
    const unit = n(of.unit);
    if (!unit) {
      return toast(t({ tr: "Birim fiyatı yazın — fiyatsız teklif teklif değildir", en: "Enter a unit price — an offer without a price is not an offer", ru: "Укажите цену за единицу", ar: "اكتب سعر الوحدة" }));
    }
    const qty = n(of.qty) || 1;
    const days = n(of.days) || 3;
    OF.putOffer(req.id, {
      recordId: mRec.id,
      unit: Math.round(unit * 100) / 100,
      qty: Math.round(qty),
      raw: Math.round(unit * qty * 100) / 100,
      gun: Math.round(days),
      note: of.note.trim(),
    });
    setOfReq(null);
    setOf({ unit: "", qty: "", days: "", note: "" });
    set({ offersRev: (state.offersRev || 0) + 1 });
    toast(t({ tr: "Teklifiniz alıcıya iletildi · 7 gün geçerli", en: "Your offer reached the buyer · valid 7 days", ru: "Предложение отправлено · 7 дней", ar: "وصل عرضك · صالح ٧ أيام" }));
  };

  // ── the record form ──────────────────────────────────────────────────────
  const [mf, setMf] = useState({ lo: "", hi: "", moq: "", photos: "", tel: "", open: "", close: "", groups: [] as string[] });
  // Switching records must not carry the previous shop's numbers across.
  const mfFor = useRef<string | null>(null);
  useEffect(() => {
    if (!mRec || mfFor.current === mRec.id) return;
    mfFor.current = mRec.id;
    setMf({
      lo: mRec.band ? String(mRec.band[0]) : "",
      hi: mRec.band ? String(mRec.band[1]) : "",
      moq: mRec.moq ? String(mRec.moq) : "",
      photos: mRec.photos ? String(mRec.photos) : "",
      tel: mRec.tel || "",
      open: "",
      close: "",
      groups: (mRec.groups || []).map((g) => g.name),
    });
  }, [mRec]);

  const saveRecord = () => {
    if (!mRec || !sessionOk) return;
    const num = (v: string) => { const n = Number(String(v).replace(/[^\d]/g, "")); return n > 0 ? n : null; };
    const hh = (v: string) => { const m = /^(\d{1,2})[:.](\d{2})$/.exec(v.trim()); return m ? Number(m[1]) + Number(m[2]) / 60 : null; };
    const patch: OverrideEntry = {};
    const lo = num(mf.lo), hi = num(mf.hi);
    if (lo && hi && hi >= lo) patch.band = [lo, hi];
    if (num(mf.moq)) patch.moq = num(mf.moq) as number;
    if (num(mf.photos) != null) patch.photos = Math.min(9, num(mf.photos) || 0);
    if (mf.tel.trim()) patch.tel = mf.tel.trim();
    // C1 · "is it open right now" only answers correctly once the trader has
    // given their own hours; the place's default is a fallback, not a fact.
    const op = hh(mf.open), cl = hh(mf.close);
    if (op != null && cl != null && cl > op) patch.hours = { open: op, close: cl };
    if (mf.groups.length) patch.groups = mf.groups;
    if (!Object.keys(patch).length) {
      return toast(t({ tr: "Değiştirecek bir şey yok", en: "Nothing to save", ru: "Нечего сохранять", ar: "لا شيء للحفظ" }));
    }
    const next = { ...(state.overrides || {}), [mRec.id]: { ...(state.overrides || {})[mRec.id], ...patch } };
    save({ overrides: next, offersRev: (state.offersRev || 0) + 1 });
    toast(t({ tr: "Kaydedildi · aramada güncellendi", en: "Saved · updated in search", ru: "Сохранено · обновлено в поиске", ar: "تم الحفظ · حُدّث في البحث" }));
  };

  // ── the visibility scorecard (Ö7) ────────────────────────────────────────
  // What lifts the number is a filled field, never a fee.
  const scoreRows = mRec ? scoreRowsOf(mRec, t) : [];
  const score = scoreRows.reduce((n, r) => n + (r.ok ? r.pts : 0), 0);

  const tabs: { id: Tab; label: string; icon: string; count: number }[] = [
    { id: "bul", label: t({ tr: "Kaydımı bul", en: "Find my record", ru: "Найти мою запись", ar: "ابحث عن سجلي" }), icon: "magnifier", count: 0 },
    { id: "talep", label: t({ tr: "Sahiplenme talebi", en: "Ownership request", ru: "Заявка на владение", ar: "طلب الملكية" }), icon: "notepad-edit", count: 0 },
    { id: "durum", label: t({ tr: "Taleplerimin durumu", en: "My requests", ru: "Мои заявки", ar: "طلباتي" }), icon: "verify", count: myClaims.length },
    { id: "yonet", label: t({ tr: "Kaydımı yönet", en: "Manage my record", ru: "Управление записью", ar: "إدارة سجلي" }), icon: "setting-2", count: ownedIds.length },
  ];

  const subtitle: Record<Tab, string> = {
    bul: t({ tr: "Dükkânınız büyük ihtimalle kayıtlı: çarşı listesinden yer, kat ve kapı numarasıyla bulun.", en: "Your shop is probably already listed: find it by place, floor and door number.", ru: "Ваша лавка, скорее всего, уже в реестре: найдите её по месту, этажу и номеру двери.", ar: "متجرك على الأرجح مسجل: ابحث عنه بالمكان والطابق ورقم الباب." }),
    talep: t({ tr: "Kaydı sahiplenmek onay ister. Bilgilerinizi bırakın; yer yetkilisi doğrular.", en: "Claiming a record needs approval. Leave your details; the area officer verifies them.", ru: "Присвоение записи требует подтверждения. Оставьте данные — ответственный проверит.", ar: "تملّك السجل يتطلب موافقة. اترك بياناتك ليتحقق المسؤول." }),
    durum: t({ tr: "Onaylanana kadar kayıtta hiçbir alan değişmez — ne fiyat, ne katalog, ne fotoğraf.", en: "Until approval nothing in the record changes — no price, no catalogue, no photos.", ru: "До подтверждения в записи ничего не меняется — ни цена, ни каталог, ни фото.", ar: "حتى الموافقة لا يتغير شيء في السجل — لا سعر ولا كتالوج ولا صور." }),
    yonet: t({ tr: "Doldurduğunuz her alan aramada sizi öne çıkarır. Fiyat girmeyen kayıt, aynı işi yapanın altında kalır.", en: "Every field you fill lifts you in search. A record without a price sits below its competitor.", ru: "Каждое заполненное поле поднимает вас в поиске.", ar: "كل حقل تملأه يرفعك في البحث." }),
  };

  const groupOpts = mRec ? SC.GROUP_WORDS_FOR(mRec.cat, lang) : [];

  return (
    <div style={sx(searchGrid(b))}>
      {/* ── tabs ─────────────────────────────────────────────────────── */}
      <aside style={sx(areaOn("f") + CARD_BOX + (b.three ? STICKY_TOP : ""))}>
        <nav style={sx("display:flex;flex-direction:column;gap:3px")} aria-label={t({ tr: "Esnaf", en: "Trader", ru: "Продавец", ar: "التاجر" })}>
          {tabs.map((x) => {
            const on = x.id === tab;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => go(x.id)}
                aria-current={on ? "page" : undefined}
                style={sx(
                  "display:flex;align-items:center;gap:10px;width:100%;background:" +
                    (on ? "var(--color-primary-soft)" : "none") +
                    ";border:none;padding:11px 11px;border-radius:9px;font-family:inherit;font-size:14px;font-weight:" +
                    (on ? "700" : "500") +
                    ";color:" + (on ? "var(--color-primary-accent)" : "var(--text-body)") +
                    ";text-align:start;cursor:pointer",
                )}
              >
                <Icon name={x.icon} size={17} />
                <span style={sx("flex:1;min-width:0")}>{x.label}</span>
                {!!x.count && (
                  <span style={sx("flex:none;font-size:12px;font-weight:700;color:" + (on ? "var(--color-primary)" : "var(--text-muted)"))}>
                    {x.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── main ─────────────────────────────────────────────────────── */}
      <main style={sx(areaOn("l"))}>
        <h1 style={sx("font-size:24px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0")}>
          {tabs.find((x) => x.id === tab)?.label}
        </h1>
        <p style={sx("font-size:14.5px;color:var(--text-muted);margin-top:4px;max-width:74ch;text-wrap:pretty")}>{subtitle[tab]}</p>

        {tab === "bul" && (
          <>
            <div style={sx("margin-top:20px;" + CARD)}>
              <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr));gap:10px")}>
                <Select
                  size="md"
                  value={place}
                  aria-label={t({ tr: "Yer", en: "Place", ru: "Место", ar: "المكان" })}
                  onChange={(e) => router.replace(href.trader("bul", { place: e.target.value === "all" ? undefined : e.target.value, door }))}
                >
                  <option value="all">{t({ tr: "Yer seçin · han, çarşı, cadde", en: "Pick a place · han, bazaar, street", ru: "Выберите место", ar: "اختر المكان" })}</option>
                  {SC.PLACES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <Input
                  size="md"
                  inputMode="numeric"
                  placeholder={t({ tr: "Kapı no", en: "Door no", ru: "Номер двери", ar: "رقم الباب" })}
                  aria-label={t({ tr: "Kapı no", en: "Door no", ru: "Номер двери", ar: "رقم الباب" })}
                  value={door}
                  onChange={(e) => router.replace(href.trader("bul", { place: place === "all" ? undefined : place, door: e.target.value }))}
                />
                <Input
                  size="md"
                  placeholder={t({ tr: "Dükkân adı", en: "Shop name", ru: "Название лавки", ar: "اسم المتجر" })}
                  aria-label={t({ tr: "Dükkân adı", en: "Shop name", ru: "Название лавки", ar: "اسم المتجر" })}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <p style={sx("font-size:13px;color:var(--text-muted);margin-top:11px;text-wrap:pretty")}>
                {t({ tr: "Kaydınızı bulamazsanız yeni kayıt açılır — ama o da aynı onay hattından geçer.", en: "If your record is not there a new one is opened — it goes through the same approval line.", ru: "Если записи нет, откроется новая — она пройдёт ту же проверку.", ar: "إن لم تجد سجلك يُفتح سجل جديد — ويمر بالمسار نفسه." })}
              </p>
            </div>

            <div style={sx("display:flex;flex-direction:column;gap:10px;margin-top:16px")}>
              {hits.map((r) => {
                const cl = claims[r.id];
                const taken = !!cl;
                const st = (SC.STATUS[r.status] || {}) as Record<string, string>;
                const tone = taken
                  ? ({ bekliyor: "warning", onayli: "success", red: "danger" } as Record<string, string>)[cl.status]
                  : st.tone || "secondary";
                const tp = tonePair(tone);
                const label = taken ? claimLabel(cl.status, t) : (st[lang] as string) || (st.tr as string) || "";
                const name = recordName(r, lang);
                return (
                  <div key={r.id} style={sx("display:flex;gap:14px;padding:15px 16px;border-radius:14px;background:var(--surface-card);border:1px solid var(--border-strong);box-shadow:0 3px 4px rgba(0,0,0,.03)")}>
                    <span style={sx("flex:none;width:48px;height:48px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:700;background:var(--color-primary-soft);color:var(--color-primary-accent)")}>
                      {upper(name.trim().charAt(0) || "?", lang)}
                    </span>
                    <span style={sx("flex:1;min-width:0")}>
                      <span style={sx("display:block;font-size:16px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em;text-wrap:pretty")}>{name}</span>
                      <span style={sx("display:block;font-size:13px;color:var(--text-muted);margin-top:3px")}>{whereOf(r)}</span>
                      <span style={sx("display:inline-flex;align-items:center;height:24px;padding:0 10px;margin-top:8px;border-radius:6px;font-size:12px;font-weight:700;background:" + tp.bg + ";color:" + tp.fg)}>
                        {label}
                      </span>
                    </span>
                    <span style={sx("flex:none;align-self:center")}>
                      <Button
                        variant={taken ? "light" : "solid"}
                        color="primary"
                        size="sm"
                        disabled={taken}
                        onClick={() => (taken ? go("durum") : go("talep", { record: r.id }))}
                      >
                        {taken
                          ? t({ tr: "Talep var", en: "Claimed", ru: "Заявка есть", ar: "مطلوب" })
                          : t({ tr: "Bu benim", en: "This is mine", ru: "Это моя лавка", ar: "هذا متجري" })}
                      </Button>
                    </span>
                  </div>
                );
              })}

              {hits.length === 0 && (
                <div style={sx(HOLLOW.replace("padding:32px 24px", "padding:30px 24px"))}>
                  <div style={sx("font-size:17px;font-weight:700;color:var(--text-heading)")}>
                    {place === "all" && !q && !door
                      ? t({ tr: "Önce yerinizi seçin", en: "Pick your place first", ru: "Сначала выберите место", ar: "اختر مكانك أولًا" })
                      : t({ tr: "Bu tarife uyan kayıt yok", en: "No record matches that", ru: "Нет подходящей записи", ar: "لا سجل يطابق ذلك" })}
                  </div>
                  <div style={sx("font-size:14px;color:var(--text-muted);margin-top:5px;max-width:64ch;text-wrap:pretty")}>
                    {place === "all" && !q && !door
                      ? t({ tr: "Han, çarşı ya da cadde seçin; isterseniz kapı numarasını da yazın.", en: "Choose the han, bazaar or street; add the door number if you know it.", ru: "Выберите хан, базар или улицу; добавьте номер двери.", ar: "اختر الخان أو السوق أو الشارع، وأضف رقم الباب." })
                      : t({ tr: "Kapı numarasını yazmadan yalnız yerle deneyin; kayıt başka isimle girilmiş olabilir.", en: "Try the place alone without the door number; the record may be under another name.", ru: "Попробуйте только место без номера двери — запись может быть под другим именем.", ar: "جرّب المكان وحده دون رقم الباب؛ قد يكون السجل باسم آخر." })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "talep" && (
          pick ? (
            <div style={sx("margin-top:20px;" + CARD)}>
              <div style={sx(KICKER)}>{t({ tr: "Sahiplenilecek kayıt", en: "Record to claim", ru: "Запись для присвоения", ar: "السجل المطلوب" })}</div>
              <div style={sx("font-size:19px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em;margin-top:3px")}>{recordName(pick, lang)}</div>
              <div style={sx("font-size:13.5px;color:var(--text-muted);margin-top:3px")}>{whereOf(pick)}</div>

              <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:10px;margin-top:18px")}>
                <Input
                  size="md"
                  placeholder={t({ tr: "Ad soyad", en: "Full name", ru: "Имя и фамилия", ar: "الاسم الكامل" })}
                  aria-label={t({ tr: "Ad soyad", en: "Full name", ru: "Имя и фамилия", ar: "الاسم الكامل" })}
                  value={owner}
                  error={errs.owner}
                  onChange={(e) => { setOwner(e.target.value); setErrs((s) => ({ ...s, owner: undefined })); }}
                />
                <Input
                  size="md"
                  inputMode="tel"
                  placeholder={t({ tr: "Telefon", en: "Phone", ru: "Телефон", ar: "الهاتف" })}
                  aria-label={t({ tr: "Telefon", en: "Phone", ru: "Телефон", ar: "الهاتف" })}
                  value={tel}
                  error={errs.tel}
                  onChange={(e) => { setTel(e.target.value); setErrs((s) => ({ ...s, tel: undefined })); }}
                />
              </div>

              <div style={sx("font-size:13.5px;font-weight:700;color:var(--text-heading);margin-top:18px")}>
                {t({ tr: "Kaydın sizin olduğunu nasıl gösterirsiniz?", en: "How will you show the record is yours?", ru: "Чем подтвердите, что запись ваша?", ar: "كيف تثبت أن السجل لك؟" })}
              </div>
              <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:10px")} role="radiogroup">
                {proofDefs.map(([id, label, note]) => {
                  const on = proof === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setProof(id)}
                      style={sx(
                        "display:flex;align-items:flex-start;gap:11px;width:100%;padding:13px 14px;border-radius:11px;font-family:inherit;text-align:start;cursor:pointer;background:var(--surface-card);border:1px solid " +
                          (on ? "var(--color-primary)" : "var(--border-default)"),
                      )}
                    >
                      <span style={sx(
                        "flex:none;width:16px;height:16px;border-radius:999px;margin-top:2px;border:2px solid " +
                          (on ? "var(--color-primary)" : "var(--border-strong)") + ";background:" +
                          (on ? "var(--color-primary)" : "transparent") + ";box-shadow:" +
                          (on ? "inset 0 0 0 3px var(--surface-card)" : "none"),
                      )} />
                      <span style={sx("flex:1;min-width:0")}>
                        <span style={sx("display:block;font-size:14.5px;font-weight:600;color:var(--text-heading)")}>{label}</span>
                        <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px;text-wrap:pretty")}>{note}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div style={sx("display:flex;align-items:flex-start;gap:10px;margin-top:18px;padding:14px;border-radius:11px;background:var(--color-warning-soft)")}>
                <span style={sx("flex:none;display:flex;color:var(--color-warning-accent);margin-top:1px")}>
                  <Icon name="shield-search" size={17} />
                </span>
                <span style={sx("font-size:13px;color:var(--text-body);text-wrap:pretty")}>
                  <span style={sx("font-weight:700;color:var(--color-warning-accent)")}>
                    {t({ tr: "Onay verilmeden kayıt açılmaz.", en: "No approval, no access.", ru: "Без подтверждения доступа нет.", ar: "لا وصول قبل الموافقة." })}
                  </span>{" "}
                  {t({ tr: "Talebiniz yer yetkilisine düşer. Onaylanana kadar fiyat, katalog ve fotoğraf alanlarına dokunulamaz; kaydın görünen hâli aynı kalır.", en: "Your request goes to the area officer. Until it is approved the price, catalogue and photo fields stay locked and the record looks exactly as it does now.", ru: "Заявка уходит ответственному по району. До подтверждения поля цены, каталога и фото закрыты, запись выглядит как сейчас.", ar: "يذهب طلبك إلى مسؤول المنطقة. حتى الموافقة تبقى حقول السعر والكتالوج والصور مقفلة." })}
                </span>
              </div>

              <div style={sx("display:flex;gap:9px;margin-top:18px;flex-wrap:wrap")}>
                {/* The one filled-orange button on this screen: the conversion. */}
                <Button color="accent" size="lg" onClick={submitClaim}>
                  {t({ tr: "Onaya gönder", en: "Send for approval", ru: "Отправить на проверку", ar: "أرسل للموافقة" })}
                </Button>
                <Button variant="ghost" color="dark" size="lg" onClick={() => go("bul")}>
                  {t({ tr: "Vazgeç", en: "Cancel", ru: "Отмена", ar: "إلغاء" })}
                </Button>
              </div>
            </div>
          ) : (
            <div style={sx("margin-top:20px;" + HOLLOW)}>
              <div style={sx("font-size:17px;font-weight:700;color:var(--text-heading)")}>
                {t({ tr: "Önce kaydınızı seçin", en: "Pick your record first", ru: "Сначала выберите запись", ar: "اختر سجلك أولًا" })}
              </div>
              <div style={sx("font-size:14px;color:var(--text-muted);margin-top:5px;max-width:64ch;text-wrap:pretty")}>
                {t({ tr: "“Kaydımı bul” sekmesinden dükkânınızı bulun, sonra “Bu benim” deyin.", en: "Find your shop under “Find my record”, then say “This is mine”.", ru: "Найдите лавку во вкладке «Найти мою запись», затем нажмите «Это моя лавка».", ar: "ابحث عن متجرك في تبويب «ابحث عن سجلي» ثم اضغط «هذا متجري»." })}
              </div>
              <div style={sx("margin-top:14px")}>
                <Button variant="outline" color="primary" size="md" onClick={() => go("bul")}>
                  {t({ tr: "Kaydımı bul", en: "Find my record", ru: "Найти мою запись", ar: "ابحث عن سجلي" })}
                </Button>
              </div>
            </div>
          )
        )}

        {tab === "durum" && (
          <div style={sx("display:flex;flex-direction:column;gap:12px;margin-top:20px")}>
            {myClaims.map(({ claim, rec }) => {
              const done = claim.status === "onayli", bad = claim.status === "red";
              const tp = tonePair(done ? "success" : bad ? "danger" : "warning");
              const officer = (SC.OFFICERS[claim.officer || ""] || {}).name || "—";
              const steps: [string, string, string][] = [
                ["1", t({ tr: "Talep alındı", en: "Request received", ru: "Заявка принята", ar: "استُلم الطلب" }), "done"],
                ["2", t({ tr: "Yetkili doğruluyor", en: "Officer verifying", ru: "Проверка", ar: "التحقق" }), done || bad ? "done" : "now"],
                ["3",
                  done ? t({ tr: "Kayıt açıldı", en: "Record unlocked", ru: "Запись открыта", ar: "فُتح السجل" })
                    : bad ? t({ tr: "Reddedildi", en: "Rejected", ru: "Отклонено", ar: "مرفوض" })
                      : t({ tr: "Kayıt açılır", en: "Record unlocks", ru: "Запись откроется", ar: "يُفتح السجل" }),
                  done ? "done" : bad ? "bad" : "idle"],
              ];
              return (
                <div
                  key={rec.id}
                  style={sx(
                    "background:var(--surface-card);border:1px solid " +
                      (done ? "var(--color-success)" : bad ? "var(--color-danger)" : "var(--border-strong)") +
                      ";border-radius:14px;padding:20px;box-shadow:0 3px 4px rgba(0,0,0,.03)",
                  )}
                >
                  <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
                    <div style={sx("min-width:0")}>
                      <div style={sx("font-size:17px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em;text-wrap:pretty")}>{recordName(rec, lang)}</div>
                      <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px")}>{whereOf(rec)}</div>
                    </div>
                    <span style={sx("display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:6px;font-size:12px;font-weight:700;background:" + tp.bg + ";color:" + tp.fg)}>
                      {claimLabel(claim.status, t)}
                    </span>
                  </div>

                  <div style={sx("display:flex;gap:1px;margin-top:16px;background:var(--border-default);border:1px solid var(--border-default);border-radius:10px;overflow:hidden")}>
                    {steps.map(([n, label, st]) => (
                      <span key={n} style={sx("flex:1;min-width:0;padding:11px 12px;background:" + stepBg(st))}>
                        <span style={sx("display:block;font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase")}>{n}</span>
                        <span style={sx("display:block;font-size:13px;font-weight:600;margin-top:4px;text-wrap:pretty")}>{label}</span>
                      </span>
                    ))}
                  </div>

                  <p style={sx("font-size:13.5px;color:var(--text-body);margin-top:14px;text-wrap:pretty")}>
                    {done
                      ? t({ tr: "Artık fiyat, katalog ve fotoğraf girebilirsiniz. Karnenizdeki her dolu alan aramada sizi yukarı taşır.", en: "You can now enter price, catalogue and photos. Every filled field lifts you in search.", ru: "Теперь можно вносить цену, каталог и фото. Каждое заполненное поле поднимает вас в поиске.", ar: "يمكنك الآن إدخال السعر والكتالوج والصور. كل حقل مكتمل يرفعك في البحث." })
                      : bad
                        ? (claim.reason || t({ tr: "Yetkili bu talebi doğrulayamadı. Belgeyle yeniden başvurabilirsiniz.", en: "The officer could not verify this. You can reapply with a document.", ru: "Ответственный не смог подтвердить. Можно подать снова с документом.", ar: "لم يتمكن المسؤول من التحقق. يمكنك إعادة التقديم بمستند." }))
                        : t({ tr: "Yetkili: ", en: "Officer: ", ru: "Ответственный: ", ar: "المسؤول: " }) + officer + " · " +
                          t({ tr: "kararı burada göreceksiniz.", en: "the decision will show up here.", ru: "решение появится здесь.", ar: "سيظهر القرار هنا." })}
                  </p>

                  {done && (
                    <div style={sx("margin-top:14px")}>
                      <Button color="primary" size="md" onClick={() => go("yonet", { record: rec.id })}>
                        {t({ tr: "Kaydı aç", en: "Open the record", ru: "Открыть запись", ar: "افتح السجل" })}
                      </Button>
                    </div>
                  )}
                  {claim.status === "bekliyor" && (
                    <div style={sx("margin-top:14px")}>
                      <Button
                        variant="ghost"
                        color="danger"
                        size="sm"
                        onClick={() => {
                          const next = { ...claims };
                          delete next[rec.id];
                          save({ claims: next });
                          toast(t({ tr: "Talep geri çekildi", en: "Request withdrawn", ru: "Заявка отозвана", ar: "سُحب الطلب" }));
                        }}
                      >
                        {t({ tr: "Talebi geri çek", en: "Withdraw request", ru: "Отозвать заявку", ar: "سحب الطلب" })}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {myClaims.length === 0 && (
              <div style={sx(HOLLOW)}>
                <div style={sx("font-size:17px;font-weight:700;color:var(--text-heading)")}>
                  {t({ tr: "Henüz sahiplenme talebiniz yok", en: "No ownership request yet", ru: "Заявок пока нет", ar: "لا طلبات بعد" })}
                </div>
                <div style={sx("font-size:14px;color:var(--text-muted);margin-top:5px;max-width:64ch;text-wrap:pretty")}>
                  {t({ tr: "“Kaydımı bul” sekmesinden dükkânınızı bulun ve talebi bırakın.", en: "Find your shop under “Find my record” and leave a request.", ru: "Найдите лавку во вкладке «Найти мою запись» и оставьте заявку.", ar: "ابحث عن متجرك في تبويب «ابحث عن سجلي» واترك طلبًا." })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "yonet" && (
          <>
            {ownedIds.length === 0 && (
              <div style={sx("margin-top:20px;" + HOLLOW)}>
                <div style={sx("font-size:17px;font-weight:700;color:var(--text-heading)")}>
                  {t({ tr: "Yönetebileceğiniz kayıt yok", en: "No record to manage yet", ru: "Пока нет записей", ar: "لا سجل لإدارته" })}
                </div>
                <div style={sx("font-size:14px;color:var(--text-muted);margin-top:5px;max-width:64ch;text-wrap:pretty")}>
                  {t({ tr: "Kaydınızı sahiplenip yetkili onayını aldığınızda buradan doldurabilirsiniz.", en: "Claim your record and get the officer's approval to fill it in here.", ru: "Присвойте запись и получите подтверждение.", ar: "تملّك سجلك واحصل على الموافقة." })}
                </div>
              </div>
            )}

            {ownedIds.length > 0 && !sessionOk && (
              <div style={sx("margin-top:20px;max-width:520px;" + CARD.replace("padding:20px", "padding:22px"))}>
                <div style={sx("font-size:18px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em")}>
                  {t({ tr: "Telefonunuzla girin", en: "Sign in with your phone", ru: "Вход по телефону", ar: "الدخول بهاتفك" })}
                </div>
                <div style={sx("font-size:13.5px;color:var(--text-muted);margin-top:5px;text-wrap:pretty")}>
                  {t({ tr: "Kayıt, sahiplenme talebindeki telefona bağlıdır. Başka cihazdan da aynı numarayla girebilirsiniz.", en: "The record is tied to the phone on the ownership request. The same number works from any device.", ru: "Запись привязана к телефону из заявки.", ar: "السجل مرتبط بالهاتف المذكور في الطلب." })}
                </div>
                <div style={sx("display:grid;gap:10px;margin-top:16px")}>
                  <Input
                    size="md"
                    inputMode="tel"
                    placeholder={t({ tr: "Talepteki telefon", en: "Phone from the request", ru: "Телефон из заявки", ar: "هاتف الطلب" })}
                    aria-label={t({ tr: "Talepteki telefon", en: "Phone from the request", ru: "Телефон из заявки", ar: "هاتف الطلب" })}
                    value={loginTel}
                    onChange={(e) => setLoginTel(e.target.value)}
                  />
                  <Input
                    size="md"
                    inputMode="numeric"
                    placeholder={t({ tr: "SMS kodu (demo: 1234)", en: "SMS code (demo: 1234)", ru: "Код из SMS (демо: 1234)", ar: "رمز SMS (تجريبي: 1234)" })}
                    aria-label={t({ tr: "SMS kodu", en: "SMS code", ru: "Код из SMS", ar: "رمز SMS" })}
                    value={loginCode}
                    onChange={(e) => setLoginCode(e.target.value)}
                  />
                </div>
                <div style={sx("margin-top:14px")}>
                  <Button color="accent" size="lg" onClick={doLogin}>
                    {t({ tr: "Giriş yap", en: "Sign in", ru: "Войти", ar: "دخول" })}
                  </Button>
                </div>
              </div>
            )}

            {sessionOk && mRec && (
              <>
                <div style={sx("display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:18px")}>
                  {myClaims.filter((x) => x.claim.status === "onayli").map(({ rec }) => (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => go("yonet", { record: rec.id })}
                      aria-pressed={rec.id === manageId}
                      style={sx(
                        "height:34px;padding:0 13px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid " +
                          (rec.id === manageId
                            ? "var(--color-primary);background:var(--color-primary-soft);color:var(--color-primary-accent)"
                            : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
                      )}
                    >
                      {recordName(rec, lang)}
                    </button>
                  ))}
                  <span style={sx("flex:1")} />
                  <Button variant="ghost" color="dark" size="sm" onClick={() => { save({ esSession: null }); toast(t({ tr: "Çıkış yapıldı", en: "Signed out", ru: "Вы вышли", ar: "تم الخروج" })); }}>
                    {t({ tr: "Çıkış", en: "Sign out", ru: "Выйти", ar: "خروج" })}
                  </Button>
                </div>

                {/* K8 · money language, and the number is requests that actually
                    reached THIS record — a made-up total does not persuade, it
                    destroys the trust it was meant to buy. */}
                <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:16px;margin-top:16px;align-items:start")}>
                  <div style={sx("background:var(--color-primary);border-radius:14px;padding:20px")}>
                    <div style={sx("font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.68)")}>
                      {t({ tr: "Bu ay kaçırdığınız iş", en: "Work you missed this month", ru: "Упущенная работа за месяц", ar: "أعمال فاتتك هذا الشهر" })}
                    </div>
                    <div style={sx("font-size:19px;font-weight:700;color:#fff;letter-spacing:-.015em;margin-top:6px")}>{recordName(mRec, lang)}</div>
                    <div style={sx("font-size:13px;color:rgba(255,255,255,.75);margin-top:3px")}>{whereOf(mRec)}</div>
                    <p style={sx("font-size:14px;color:rgba(255,255,255,.9);margin-top:12px;text-wrap:pretty")}>
                      {missedLine(mRec, inbox, t)}
                    </p>
                    <div style={sx("display:flex;align-items:baseline;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.18)")}>
                      <span style={sx("font-size:32px;font-weight:700;color:#fff;letter-spacing:-.02em")}>{score}</span>
                      <span style={sx("font-size:13px;color:rgba(255,255,255,.7)")}>/ 100</span>
                    </div>
                  </div>

                  <div style={sx(CARD.replace("padding:20px", "padding:18px"))}>
                    <div style={sx("display:flex;flex-direction:column;gap:6px")}>
                      {scoreRows.map((r) => (
                        <div key={r.label} style={sx("display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;background:" + (r.ok ? "var(--surface-card)" : "var(--color-danger-soft)"))}>
                          <span style={sx("flex:none;width:9px;height:9px;border-radius:999px;background:var(--color-" + (r.ok ? "success" : "danger") + ")")} />
                          <span style={sx("flex:1;min-width:0;font-size:13.5px;font-weight:600;color:var(--text-heading)")}>{r.label}</span>
                          <span style={sx("flex:none;font-size:12.5px;font-weight:700;color:var(--color-" + (r.ok ? "success" : "danger") + ")")}>+{r.pts}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* K5 · no free text: product groups come from the lexicon, so
                    every pick already exists in four languages. */}
                <div style={sx("margin-top:16px;" + CARD)}>
                  <div style={sx("font-size:16px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>
                    {t({ tr: "Ne satıyorsunuz?", en: "What do you sell?", ru: "Что вы продаёте?", ar: "ماذا تبيع؟" })}
                  </div>
                  <div style={sx("font-size:13px;color:var(--text-muted);margin-top:4px;text-wrap:pretty")}>
                    {t({ tr: "Listeden seçin — seçtiğiniz başlıklar dört dilde otomatik görünür.", en: "Pick from the list — your picks show in four languages automatically.", ru: "Выберите из списка — переводы автоматические.", ar: "اختر من القائمة — تظهر بأربع لغات تلقائيًا." })}
                  </div>
                  <div style={sx("display:flex;flex-wrap:wrap;gap:8px;margin-top:12px")}>
                    {groupOpts.map((w) => {
                      const on = mf.groups.includes(w.key);
                      return (
                        <button
                          key={w.key}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setMf((s) => ({ ...s, groups: on ? s.groups.filter((x) => x !== w.key) : s.groups.concat(w.key) }))}
                          style={sx(
                            "height:36px;padding:0 14px;border-radius:999px;font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer;border:1px solid " +
                              (on ? "var(--color-primary);background:var(--color-primary-soft);color:var(--color-primary-accent)" : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
                          )}
                        >
                          {w.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr));gap:10px;margin-top:18px")}>
                    {([
                      ["lo", t({ tr: "En düşük fiyat", en: "Lowest price", ru: "Мин. цена", ar: "أدنى سعر" })],
                      ["hi", t({ tr: "En yüksek fiyat", en: "Highest price", ru: "Макс. цена", ar: "أعلى سعر" })],
                      ["moq", t({ tr: "Minimum sipariş (adet)", en: "Minimum order (pcs)", ru: "Мин. заказ (шт)", ar: "الحد الأدنى (قطعة)" })],
                      ["photos", t({ tr: "Fotoğraf sayısı", en: "Photo count", ru: "Число фото", ar: "عدد الصور" })],
                      ["tel", t({ tr: "Dükkân telefonu", en: "Shop phone", ru: "Телефон лавки", ar: "هاتف المتجر" })],
                      ["open", t({ tr: "Açılış saati (örn. 08:30)", en: "Opening time (e.g. 08:30)", ru: "Открытие (08:30)", ar: "وقت الفتح (٨:٣٠)" })],
                      ["close", t({ tr: "Kapanış saati (örn. 19:00)", en: "Closing time (e.g. 19:00)", ru: "Закрытие (19:00)", ar: "وقت الإغلاق (١٩:٠٠)" })],
                    ] as [keyof typeof mf, string][]).map(([k, label]) => (
                      <Input
                        key={k as string}
                        size="md"
                        placeholder={label}
                        aria-label={label}
                        value={mf[k] as string}
                        onChange={(e) => setMf((s) => ({ ...s, [k]: e.target.value }))}
                      />
                    ))}
                  </div>

                  <div style={sx("margin-top:16px")}>
                    <Button color="accent" size="lg" onClick={saveRecord}>
                      {t({ tr: "Kaydet ve yayına al", en: "Save and publish", ru: "Сохранить и опубликовать", ar: "احفظ وانشر" })}
                    </Button>
                  </div>
                </div>

                {/* D5 · the other side of İşlerim: what the buyer sent, answerable here. */}
                <div style={sx("margin-top:16px;" + CARD)}>
                  <div style={sx("font-size:16px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>
                    {t({ tr: "Size gelen talepler", en: "Requests sent to you", ru: "Заявки для вас", ar: "الطلبات الواردة إليك" })}
                  </div>
                  <div style={sx("font-size:13px;color:var(--text-muted);margin-top:4px;text-wrap:pretty")}>
                    {t({ tr: "Bu talepler kategorinize uyduğu için size düştü. Cevaplamadığınız talep başka dükkâna gider.", en: "These requests reached you because they match your category. Unanswered ones go to another shop.", ru: "Эти заявки подходят вашей категории. Без ответа они уйдут другому.", ar: "هذه الطلبات تطابق فئتك. غير المُجابة تذهب لغيرك." })}
                  </div>

                  <div style={sx("display:flex;flex-direction:column;gap:9px;margin-top:14px")}>
                    {inbox.map((req) => {
                      const mine = OF.offersOf(req.id).find((o) => o.recordId === mRec.id) || null;
                      const dec = OF.declineOf(req.id, mRec.id);
                      const open = ofReq === req.id;
                      const bt = tonePair(req.buyer?.verified ? "success" : req.buyer?.telOk ? "primary" : "secondary");
                      const unitWord = req.birim === "koli"
                        ? t({ tr: "koli", en: "cartons", ru: "кор.", ar: "كرتونة" })
                        : t({ tr: "adet", en: "pcs", ru: "шт", ar: "قطعة" });
                      const meta = [
                        req.adet ? req.adet + " " + unitWord : "",
                        req.zaman === "today" ? t({ tr: "bugün lazım", en: "needed today", ru: "нужно сегодня", ar: "مطلوب اليوم" })
                          : req.zaman === "week" ? t({ tr: "bu hafta", en: "this week", ru: "на этой неделе", ar: "هذا الأسبوع" })
                            : req.zaman === "month" ? t({ tr: "bu ay", en: "this month", ru: "в этом месяце", ar: "هذا الشهر" }) : "",
                        req.numune ? t({ tr: "numune istiyor", en: "wants a sample", ru: "просит образец", ar: "يطلب عينة" }) : "",
                      ].filter(Boolean).join(" · ");
                      return (
                        <div key={req.id} style={sx("display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;padding:14px 16px;border-radius:12px;background:var(--surface-card);border:1px solid var(--border-strong)")}>
                          <div style={sx("flex:1;min-width:min(180px,100%)")}>
                            <div style={sx("display:flex;align-items:center;gap:9px;flex-wrap:wrap")}>
                              <span style={sx("font-size:15px;font-weight:700;color:var(--text-heading)")}>{req.urun}</span>
                              <span style={sx("display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:6px;font-size:12px;font-weight:700;background:" + bt.bg + ";color:" + bt.fg)}>
                                {buyerLabel(req, t)}
                              </span>
                            </div>
                            {!!meta && <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px")}>{meta}</div>}
                            {nudgedIds.has(String(req.id)) && (
                              <div style={sx("display:flex;align-items:flex-start;gap:8px;font-size:13px;font-weight:600;color:var(--color-warning-accent);margin-top:7px;padding:9px 11px;border-radius:9px;background:var(--color-warning-soft);text-wrap:pretty")}>
                                <Icon name="shield" size={15} />
                                <span>
                                  {t({
                                    tr: "Yönetici bu talebi size iletti — uygun değilse “cevaplayamam” demeniz de bir yanıttır.",
                                    en: "Management routed this request to you — if it doesn't fit, saying “I can't answer” is also an answer.",
                                    ru: "Администрация направила эту заявку вам — «не могу ответить» тоже ответ.",
                                    ar: "وجّهت الإدارة هذا الطلب إليك — إن لم يناسبك فقول «لا أستطيع» يُعدّ ردًا.",
                                  })}
                                </span>
                              </div>
                            )}
                            {!!req.aciklama && (
                              <div style={sx("font-size:13px;color:var(--text-body);margin-top:6px;padding:9px 11px;border-radius:9px;background:var(--surface-muted);text-wrap:pretty")}>
                                {req.aciklama}
                              </div>
                            )}
                          </div>

                          {!!req.tel && (
                            <a
                              href={"https://wa.me/" + digits(req.tel) + "?text=" + encodeURIComponent("Merhaba, " + req.urun + " talebiniz için " + recordName(mRec, lang) + " olarak yazıyorum.")}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={sx("display:inline-flex;align-items:center;height:34px;padding:0 14px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;background:var(--color-success-soft);color:var(--color-success);border:1px solid var(--color-success)")}
                            >
                              {t({ tr: "Mesajla cevapla", en: "Reply by message", ru: "Ответить сообщением", ar: "أجب برسالة" })}
                            </a>
                          )}

                          {mine && (
                            <div style={sx("flex:1 0 100%;padding:11px 13px;border-radius:10px;background:var(--color-success-soft);border:1px solid var(--color-success)")}>
                              <div style={sx("font-size:13.5px;font-weight:700;color:var(--color-success)")}>
                                {t({ tr: "Teklifiniz: ", en: "Your offer: ", ru: "Ваше предложение: ", ar: "عرضك: " }) +
                                  money(mine.unit) + " / " + unitWord + " · " + mine.qty + " " + unitWord + " · " + mine.gun + " " +
                                  t({ tr: "gün", en: "days", ru: "дн.", ar: "يومًا" })}
                              </div>
                              <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                                {when(mine.at ?? Date.now(), lang) + " · " + t({ tr: "geçerlilik: ", en: "valid until ", ru: "до ", ar: "حتى " }) + when(mine.validUntil ?? Date.now(), lang)}
                              </div>
                            </div>
                          )}

                          {!mine && dec && (
                            <div style={sx("flex:1 0 100%;font-size:13px;color:var(--text-muted);padding:9px 11px;border-radius:9px;background:var(--surface-muted)")}>
                              {t({ tr: "Cevaplayamadınız olarak işaretlendi: ", en: "Marked as declined: ", ru: "Отказ: ", ar: "اعتذرت: " }) +
                                t(OF.DECLINE_REASONS[dec.reason] || { tr: dec.reason })}
                            </div>
                          )}

                          <div style={sx("flex:1 0 100%;display:flex;gap:8px;flex-wrap:wrap;align-items:center")}>
                            <Button
                              color="accent"
                              variant={open ? "outline" : mine ? "light" : "solid"}
                              size="sm"
                              onClick={() => {
                                if (open) return setOfReq(null);
                                setOfReq(req.id);
                                setOf({
                                  unit: mine ? String(mine.unit) : "",
                                  qty: mine ? String(mine.qty) : String(Number(String(req.adet || "").replace(/[^\d]/g, "")) || mRec.moq || 1),
                                  days: mine ? String(mine.gun) : "",
                                  note: mine?.note || "",
                                });
                              }}
                            >
                              {open
                                ? t({ tr: "Vazgeç", en: "Cancel", ru: "Отмена", ar: "إلغاء" })
                                : mine
                                  ? t({ tr: "Teklifi güncelle", en: "Update offer", ru: "Обновить", ar: "حدّث العرض" })
                                  : t({ tr: "Teklif ver", en: "Send an offer", ru: "Дать цену", ar: "قدّم عرضًا" })}
                            </Button>

                            {/* Saying "I can't" is an answer. Silence is what
                                actually costs the buyer their day. */}
                            {!mine && !dec && Object.keys(OF.DECLINE_REASONS).map((k) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => {
                                  OF.putDecline(req.id, mRec.id, k as keyof typeof OF.DECLINE_REASONS);
                                  set({ offersRev: (state.offersRev || 0) + 1 });
                                  toast(t({ tr: "Alıcıya iletildi — sessiz kalmaktan iyidir", en: "Sent to the buyer — better than silence", ru: "Отправлено покупателю", ar: "أُرسل للمشتري" }));
                                }}
                                style={sx("height:30px;padding:0 11px;border-radius:999px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:12.5px;font-weight:600;color:var(--text-muted);cursor:pointer")}
                              >
                                {t(OF.DECLINE_REASONS[k as keyof typeof OF.DECLINE_REASONS])}
                              </button>
                            ))}
                          </div>

                          {open && (
                            <div style={sx("flex:1 0 100%;padding:14px;border-radius:11px;background:var(--surface-muted);border:1px solid var(--border-strong)")}>
                              <div style={sx("font-size:13px;font-weight:700;color:var(--text-heading)")}>
                                {t({ tr: "Teklifiniz", en: "Your offer", ru: "Ваше предложение", ar: "عرضك" })}
                              </div>
                              {/* K9 · the sentence that keeps estimate and
                                  commitment apart, said to the person making one. */}
                              <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:3px;text-wrap:pretty")}>
                                {t({ tr: "Bu bir taahhüttür: alıcı kabul edebilir. Motorun ürettiği tahmini aralıktan farklı olarak sizin verdiğiniz fiyat bağlayıcıdır.", en: "This is a commitment: the buyer can accept it. Unlike the engine's estimated range, your price binds you.", ru: "Это обязательство: покупатель может его принять.", ar: "هذا التزام: يمكن للمشتري قبوله." })}
                              </div>
                              <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:10px;margin-top:11px")}>
                                {([
                                  ["unit", t({ tr: "Birim fiyat (₺)", en: "Unit price (₺)", ru: "Цена за ед. (₺)", ar: "سعر الوحدة (₺)" })],
                                  ["qty", t({ tr: "Bu fiyat kaç adetten", en: "Quantity this price holds for", ru: "От какого количества", ar: "الكمية" })],
                                  ["days", t({ tr: "Termin (gün)", en: "Lead time (days)", ru: "Срок (дней)", ar: "المدة (أيام)" })],
                                ] as ["unit" | "qty" | "days", string][]).map(([k, label]) => (
                                  <Input
                                    key={k}
                                    size="md"
                                    inputMode="numeric"
                                    placeholder={label}
                                    aria-label={label}
                                    value={of[k]}
                                    onChange={(e) => setOf((s) => ({ ...s, [k]: e.target.value }))}
                                  />
                                ))}
                              </div>
                              <div style={sx("margin-top:10px")}>
                                <Textarea
                                  rows={2}
                                  placeholder={t({ tr: "Not: koli içi adet, baskı, numune koşulu…", en: "Note: carton size, print, sample terms…", ru: "Заметка: упаковка, печать, образец…", ar: "ملاحظة: الكرتون، الطباعة، العينة…" })}
                                  aria-label={t({ tr: "Not", en: "Note", ru: "Заметка", ar: "ملاحظة" })}
                                  value={of.note}
                                  onChange={(e) => setOf((s) => ({ ...s, note: e.target.value }))}
                                />
                              </div>
                              <div style={sx("display:flex;gap:9px;align-items:center;margin-top:11px;flex-wrap:wrap")}>
                                <Button color="accent" size="md" onClick={() => sendOffer(req)}>
                                  {t({ tr: "Teklifi gönder", en: "Send the offer", ru: "Отправить", ar: "أرسل العرض" })}
                                </Button>
                                <span style={sx("font-size:12.5px;color:var(--text-muted)")}>
                                  {t({ tr: "7 gün geçerli olur", en: "Valid for 7 days", ru: "Действует 7 дней", ar: "صالح ٧ أيام" })}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {inbox.length === 0 && (
                      <p style={sx("font-size:13.5px;color:var(--text-muted);text-wrap:pretty")}>
                        {t({ tr: "Şu an size düşen talep yok. Fiyat ve çeşitlerinizi doldurmak talep gelme olasılığını yükseltir.", en: "No requests right now. Filling in price and product lines raises your chances.", ru: "Заявок пока нет. Заполните цену и ассортимент.", ar: "لا طلبات الآن. املأ السعر والأصناف." })}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* ── how it works ─────────────────────────────────────────────── */}
      <aside style={sx(areaOn("d") + (b.three ? STICKY_TOP : ""))}>
        <div style={sx(CARD)}>
          <div style={sx(KICKER)}>{t({ tr: "Sahiplenme nasıl işler", en: "How claiming works", ru: "Как работает присвоение", ar: "كيف يعمل التملّك" })}</div>
          <div style={sx("display:flex;flex-direction:column;gap:14px;margin-top:14px")}>
            {[
              [t({ tr: "Kaydınızı bulun", en: "Find your record", ru: "Найдите запись", ar: "اعثر على سجلك" }),
               t({ tr: "Çarşıdaki her birim zaten adreslidir; çoğu dükkân listede vardır.", en: "Every unit in the bazaar already has an address; most shops are listed.", ru: "У каждого места на базаре уже есть адрес; большинство лавок в списке.", ar: "كل وحدة في السوق لها عنوان؛ معظم المتاجر مدرجة." })],
              [t({ tr: "Talebi bırakın", en: "Leave the request", ru: "Оставьте заявку", ar: "اترك الطلب" }),
               t({ tr: "Ad, telefon ve nasıl doğrulanacağınız yeter. Belge şart değil, hızlandırır.", en: "Name, phone and how you can be verified is enough. A document is optional but faster.", ru: "Достаточно имени, телефона и способа проверки. Документ ускоряет.", ar: "الاسم والهاتف وطريقة التحقق تكفي. المستند يسرّع الأمر." })],
              [t({ tr: "Yetkili onaylar", en: "The officer approves", ru: "Ответственный подтверждает", ar: "يوافق المسؤول" }),
               t({ tr: "Onaydan önce kayıt kilitli kalır. Bu kural kimse için esnetilmez.", en: "The record stays locked until then. This rule bends for no one.", ru: "До этого запись заблокирована. Исключений нет.", ar: "يبقى السجل مقفلًا حتى ذلك. لا استثناء." })],
            ].map(([title, body], i) => (
              <div key={title} style={sx("display:flex;gap:12px")}>
                <span style={sx("flex:none;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:var(--color-primary-soft);color:var(--color-primary-accent);font-size:13px;font-weight:700")}>
                  {i + 1}
                </span>
                <span style={sx("flex:1;min-width:0")}>
                  <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>{title}</span>
                  <span style={sx("display:block;font-size:13px;color:var(--text-muted);margin-top:3px;text-wrap:pretty")}>{body}</span>
                </span>
              </div>
            ))}
          </div>
          {/* The whole business model in one paragraph: what lifts a record is
              verification and filled fields, never a payment. */}
          <p style={sx("margin-top:18px;padding-top:16px;border-top:1px solid var(--border-default);font-size:13px;color:var(--text-muted);text-wrap:pretty")}>
            {t({ tr: "Onaysız kayıt yayından kalkmaz — sadece aramada en sonda kalır ve fiyat gösteremez. Sahiplenme bunu değiştirir, para değiştirmez.", en: "An unapproved record is not removed — it just ranks last and cannot show prices. Claiming changes that; money does not.", ru: "Неподтверждённая запись не удаляется — она просто в конце и без цен. Это меняет присвоение, а не оплата.", ar: "السجل غير المعتمد لا يُحذف — يبقى في الآخر بلا أسعار. التملّك يغيّر ذلك، لا المال." })}
          </p>
          <div style={sx("margin-top:16px")}>
            <Button variant="outline" color="primary" size="md" onClick={() => router.push(href.work())}>
              {F(lang, "secWork")}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ── small pure helpers ─────────────────────────────────────────────────────

type T = (o: Loc) => string;

function claimLabel(status: Claim["status"], t: T): string {
  if (status === "onayli") return t({ tr: "Onaylandı · kayıt sizin", en: "Approved · the record is yours", ru: "Подтверждено · запись ваша", ar: "تمت الموافقة · السجل لك" });
  if (status === "red") return t({ tr: "Reddedildi", en: "Rejected", ru: "Отклонено", ar: "مرفوض" });
  return t({ tr: "Onay bekliyor", en: "Awaiting approval", ru: "Ожидает подтверждения", ar: "بانتظار الموافقة" });
}

function stepBg(state: string): string {
  if (state === "done") return "var(--color-success-soft);color:var(--color-success)";
  if (state === "now") return "var(--color-primary-soft);color:var(--color-primary-accent)";
  if (state === "bad") return "var(--color-danger-soft);color:var(--color-danger)";
  return "var(--surface-card);color:var(--text-muted)";
}

function when(ts: number, lang: Lang): string {
  const l = lang === "tr" ? "tr-TR" : lang === "ru" ? "ru-RU" : lang === "ar" ? "ar-EG" : "en-GB";
  return new Date(ts).toLocaleDateString(l);
}

function buyerLabel(req: BuyRequest, t: T): string {
  // The trader has to know whom to take seriously — and that has to come from
  // the REQUEST, not from a buyer profile living on the trader's own device.
  const b = req.buyer;
  const deals = b?.deals || 0;
  const rate = b?.rate ?? 0;
  if (!b) return t({ tr: "Misafir alıcı · geçmişi yok", en: "Guest buyer · no history", ru: "Гость · без истории", ar: "زائر · لا سجل" });
  if (b.verified) return t({ tr: "Onaylı firma · " + deals + " anlaşma · %" + rate + " sonuçlandırma", en: "Verified company · " + deals + " deals · " + rate + "% closed", ru: "Проверенная фирма · " + deals + " сделок", ar: "شركة موثّقة · " + deals + " اتفاقًا" });
  if (b.telOk) return t({ tr: "Telefonu doğrulanmış alıcı · " + deals + " anlaşma", en: "Phone-verified buyer · " + deals + " deals", ru: "Телефон подтверждён · " + deals + " сделок", ar: "هاتف موثّق · " + deals + " اتفاقًا" });
  return t({ tr: "Misafir alıcı · geçmişi yok", en: "Guest buyer · no history", ru: "Гость · без истории", ar: "زائر · لا سجل" });
}

/** K8 · the count is requests that reached THIS record, and the money is the
 *  record's own band — never a platform-wide total dressed up as personal. */
function missedLine(rec: ShopRecord, inbox: BuyRequest[], t: T): string {
  const mine = inbox.length;
  if (!mine) {
    return t({ tr: "Bu ay kategorinize düşen talep olmadı. Fiyat ve çeşitlerinizi doldurmak dağıtımda öne çıkarır.", en: "No requests reached your category this month. Filling price and product lines lifts you in distribution.", ru: "В этом месяце заявок не было.", ar: "لم ترد طلبات لفئتك هذا الشهر." });
  }
  const answered = inbox.filter((req) => OF.offersOf(req.id).some((o) => o.recordId === rec.id)).length;
  const missed = Math.max(0, mine - answered);
  const val = rec.band ? Math.round((missed * (rec.band[0] + rec.band[1])) / 2 * 50) : 0;
  const cash = val ? money(val) : "";
  return t({
    tr: mine + " talep size düştü, " + missed + " tanesine yanıt vermediniz" + (cash ? " — yaklaşık " + cash + " iş" : "") + ". Yanıtsız talep başka dükkâna gider.",
    en: mine + " requests reached you, " + missed + " went unanswered" + (cash ? " — about " + cash + " of work" : "") + ". Unanswered requests go to another shop.",
    ru: mine + " заявок пришло, " + missed + " без ответа. Они уйдут другим.",
    ar: "وصلك " + mine + " طلبًا، " + missed + " منها بلا رد. الطلب غير المُجاب يذهب لغيرك.",
  });
}

/** Ö7 · the visibility scorecard. Every row is something the trader can do
 *  today; not one of them is "pay". */
function scoreRowsOf(r: ShopRecord, t: T): { ok: boolean; pts: number; label: string }[] {
  return [
    { ok: r.status === "onayli" || r.status === "aktif", pts: 25, label: t({ tr: "Yetkili onayı", en: "Officer approval", ru: "Подтверждение", ar: "موافقة المسؤول" }) },
    { ok: r.status === "aktif", pts: 15, label: t({ tr: "Kayıt aktif", en: "Record active", ru: "Запись активна", ar: "السجل نشط" }) },
    { ok: !!r.band, pts: 12, label: t({ tr: "Fiyat bandı girilmiş", en: "Price band filled", ru: "Указан диапазон цен", ar: "نطاق السعر مُدخل" }) },
    { ok: (r.groups || []).length >= 3, pts: 12, label: t({ tr: "En az üç çeşit grubu", en: "At least three groups", ru: "Минимум три группы", ar: "ثلاث مجموعات على الأقل" }) },
    { ok: !!r.respMins && r.respMins <= 30, pts: 12, label: t({ tr: "Yarım saat içinde yanıt", en: "Reply within 30 min", ru: "Ответ за 30 мин", ar: "الرد خلال ٣٠ دقيقة" }) },
    { ok: r.updatedDays <= 30, pts: 10, label: t({ tr: "Son 30 günde güncellendi", en: "Updated in 30 days", ru: "Обновлено за 30 дней", ar: "حُدّث خلال ٣٠ يومًا" }) },
    { ok: (r.photos || 0) >= 3, pts: 8, label: t({ tr: "En az üç fotoğraf", en: "At least three photos", ru: "Минимум три фото", ar: "ثلاث صور على الأقل" }) },
    { ok: (r.langs || []).length >= 2, pts: 6, label: t({ tr: "İkinci dil", en: "A second language", ru: "Второй язык", ar: "لغة ثانية" }) },
  ];
}
