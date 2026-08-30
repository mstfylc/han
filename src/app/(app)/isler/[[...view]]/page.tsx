"use client";

// İşlerim — request → offer → accept → review.
//
// This is the product's heart, and the rules that hold it together are not
// cosmetic:
//
//   K9 · an estimate and a commitment never mix. The engine's inferred range is
//        labelled "estimated" and cannot be accepted; only a trader's own offer
//        can be. Real offers sort above estimates and displace the estimate for
//        the same shop, so no shop ever appears at two prices.
//   U3 · the funnel is measured, not calculated. "Opened it" is a recorded
//        event; if nobody opened it, it says 0.
//   U7 · the request's state reads real offers only. Estimates always arrive,
//        so letting them advance the state makes the state meaningless.
//   K3 · accepting stores the commitment itself, which is what later unlocks
//        the right to review.

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";

import * as D from "@/data/han-data";
import * as OF from "@/data/han-offers";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import type { BuyRequest, Lang, Offer, SampleState, ShopRecord } from "@/data/types";
import { Badge, Button, EmptyState, Icon, Input, Textarea } from "@/ds";
import { F, W } from "@/lib/copy";
import { convert, money, tonePair, tx } from "@/lib/i18n";
import { CARD_BOX, STICKY_TOP, areaOn, breaks, searchGrid } from "@/lib/layout";
import { href } from "@/lib/routes";
import { recordName } from "@/lib/shop";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

const KICKER = "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)";
const CARD = "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:18px 20px;box-shadow:0 3px 4px rgba(0,0,0,.03)";

type View = "talep" | "karsi" | "kayitli" | "bildirim";

export default function WorkPage() {
  return (
    <Suspense fallback={null}>
      <WorkScreen />
    </Suspense>
  );
}

function WorkScreen() {
  const { state, save, toast } = useApp();
  const router = useRouter();
  const params = useParams<{ view?: string[] }>();
  const sp = useSearchParams();
  const { lang, mode, currency } = state;
  const b = breaks(state.vw);

  const view = ((params.view?.[0] || "talep") as View);
  const selId = sp.get("r");
  const reqs = state.talepler || [];
  const selReq = reqs.find((t) => t.id === selId) || null;

  const cv = (n: number | null) => convert(n, lang, currency);
  const ctx = { mode, lang };

  // The two sources, kept apart on purpose.
  const realOf = useCallback((t: BuyRequest) => OF.offersOf(t.id), []);
  const offersOf = useCallback(
    (t: BuyRequest) => SE.mergedOffers(t, OF.offersOf(t.id), ctx),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, lang, state.offersRev],
  );

  const notifCount =
    Object.keys(state.claims || {}).filter((id) =>
      ["onayli", "red"].includes(((state.claims as Record<string, { status?: string }>)[id] || {}).status || ""),
    ).length +
    // An estimate is not news. Only a real offer is worth a badge.
    reqs.filter((t) => realOf(t).length && !state.acceptedOffers[t.id]).length;

  const tabs = [
    { id: "talep" as const, label: F(lang, "tabReq"), icon: "notepad", count: reqs.length },
    { id: "karsi" as const, label: F(lang, "tabCmp"), icon: "filter", count: 0 },
    { id: "kayitli" as const, label: F(lang, "tabSaved"), icon: "heart", count: state.saved.length },
    { id: "bildirim" as const, label: F(lang, "tabNotif"), icon: "message-notif", count: notifCount },
  ];

  return (
    <div style={sx(searchGrid(b))}>
      <aside style={sx(areaOn("f") + CARD_BOX + (b.three ? STICKY_TOP : ""))}>
        <nav style={sx("display:flex;flex-direction:column;gap:3px")} aria-label={F(lang, "secWork")}>
          {tabs.map((t) => {
            const on = t.id === view;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => router.push(href.work(t.id))}
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
                <Icon name={t.icon} size={17} />
                <span style={sx("flex:1;min-width:0")}>{t.label}</span>
                {!!t.count && (
                  <span style={sx("flex:none;font-size:12px;font-weight:700;color:" + (on ? "var(--color-primary)" : "var(--text-muted)"))}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {view === "talep" && (
          <div style={sx("margin-top:18px")}>
            <div style={sx(KICKER)}>{F(lang, "tabReq")}</div>
            <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:10px")}>
              {reqs.length === 0 && (
                <p style={sx("font-size:13px;color:var(--text-muted);text-wrap:pretty")}>
                  {pk({
                    tr: "Henüz talebiniz yok. Sağdaki formu doldurun; talep uygun dükkânlara birlikte gider.",
                    en: "No requests yet. Fill in the form; one request reaches every matching shop at once.",
                    ru: "Заявок пока нет.",
                    ar: "لا طلبات بعد.",
                  }, lang)}
                </p>
              )}
              {reqs.map((t) => {
                const on = t.id === selId;
                const real = realOf(t).length;
                const acc = state.acceptedOffers[t.id];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => router.push(href.work("talep", t.id))}
                    style={sx(
                      "display:block;width:100%;text-align:start;font-family:inherit;cursor:pointer;padding:11px 12px;border-radius:10px;background:var(--surface-card);border:1px solid " +
                        (on ? "var(--color-primary)" : "var(--border-default)"),
                    )}
                  >
                    <span style={sx("display:block;font-size:14px;font-weight:700;color:var(--text-heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                      {t.urun}
                    </span>
                    <span style={sx("display:block;font-size:12px;color:var(--text-muted);margin-top:3px")}>
                      {[t.adet ? t.adet + " " + (t.birim || "") : "", acc ? F(lang, "agreed") : real ? real + " " + pk({ tr: "teklif", en: "offers", ru: "предл.", ar: "عرض" }, lang) : pk({ tr: "bekliyor", en: "waiting", ru: "ожидание", ar: "بالانتظار" }, lang)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </aside>

      <main style={sx(areaOn("l"))}>
        {view === "talep" && (
          <RequestsView
            lang={lang}
            reqs={reqs}
            selReq={selReq}
            offersOf={offersOf}
            ctx={ctx}
            state={state}
            save={save}
            toast={toast}
            router={router}
            initialProduct={sp.get("urun") || ""}
            initialTarget={sp.get("hedef") || ""}
          />
        )}
        {view === "karsi" && <CompareView lang={lang} cv={cv} />}
        {view === "kayitli" && <SavedView lang={lang} />}
        {view === "bildirim" && <NotificationsView lang={lang} reqs={reqs} realOf={realOf} />}
      </main>

      <aside style={sx(areaOn("d") + (b.three ? STICKY_TOP : ""))}>
        {view === "talep" && selReq ? (
          <OffersPanel lang={lang} req={selReq} offers={offersOf(selReq)} cv={cv} />
        ) : (
          <div style={sx("background:var(--surface-card);border:1px dashed var(--border-strong);border-radius:14px;padding:34px 22px;text-align:center")}>
            <div style={sx("display:inline-flex;color:var(--text-placeholder)")}>
              <Icon name="notepad" size={28} />
            </div>
            <div style={sx("font-size:15.5px;font-weight:700;color:var(--text-heading);margin-top:11px")}>
              {pk({ tr: "Bir talep seçin", en: "Pick a request", ru: "Выберите заявку", ar: "اختر طلبًا" }, lang)}
            </div>
            <div style={sx("font-size:13px;color:var(--text-muted);margin-top:5px;text-wrap:pretty")}>
              {pk({
                tr: "Gelen teklifler ve dağıtım burada açılır.",
                en: "Incoming offers and distribution open here.",
                ru: "Здесь откроются предложения.",
                ar: "تُفتح العروض هنا.",
              }, lang)}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

// ── requests ──────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function RequestsView({
  lang, reqs, selReq, offersOf, ctx, state, save, toast, router, initialProduct, initialTarget,
}: any) {
  const [form, setForm] = useState({
    urun: initialProduct,
    adet: "",
    birim: state.mode === "toptan" ? "koli" : "adet",
    zaman: "week",
    hedef: initialTarget,
    numune: false,
    aciklama: "",
    tel: state.buyer.tel || "",
  });

  const submit = () => {
    if (!form.urun.trim()) {
      return toast(pk({ tr: "Ne aradığınızı yazın", en: "Say what you need", ru: "Укажите товар", ar: "اذكر ما تحتاجه" }, lang));
    }
    const req: BuyRequest = {
      id: String(Date.now()),
      urun: form.urun.trim(),
      adet: form.adet,
      birim: form.birim,
      zaman: form.zaman,
      numune: form.numune,
      numuneDurum: null,
      aciklama: form.aciklama,
      deadline: Date.now() + 3 * 86400000,
      durum: "acik",
      tel: form.tel,
      at: Date.now(),
      // U10/K2 · the buyer's tier is FROZEN onto the request. The trader sees
      // the identity as it was when the request arrived; a profile edited later
      // must not rewrite history.
      buyer: {
        verified: state.buyer.verified,
        telOk: state.buyer.telOk,
        firm: state.buyer.firm,
        deals: Object.keys(state.acceptedOffers || {}).length,
        rate: state.buyer.rate,
      },
    };
    save({ talepler: [req].concat(reqs) });
    setForm({ ...form, urun: "", adet: "", aciklama: "" });
    router.push(href.work("talep", req.id));
    toast(pk({ tr: "Talep gönderildi", en: "Request sent", ru: "Заявка отправлена", ar: "أُرسل الطلب" }, lang));
  };

  if (!selReq) {
    return (
      <section style={sx(CARD)}>
        <h1 style={sx("font-size:22px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0")}>
          {pk({ tr: "Talep bırakın", en: "Leave a request", ru: "Оставьте заявку", ar: "اترك طلبًا" }, lang)}
        </h1>
        <p style={sx("font-size:14px;color:var(--text-muted);margin-top:5px;max-width:64ch;text-wrap:pretty")}>
          {pk({
            tr: "Tek talep, işi yapan bütün onaylı dükkânlara birlikte gider. Teklifler burada toplanır; hangi dükkânın gerçekten teklif verdiğini ayrı ayrı görürsünüz.",
            en: "One request goes to every approved shop in that line of work. Offers collect here, and you see exactly which shop actually quoted.",
            ru: "Одна заявка уходит всем подходящим лавкам. Предложения собираются здесь.",
            ar: "طلب واحد يصل إلى كل المتاجر المناسبة. تُجمع العروض هنا.",
          }, lang)}
        </p>

        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:14px;margin-top:18px")}>
          <Input
            label={pk({ tr: "Ne arıyorsunuz?", en: "What do you need?", ru: "Что вам нужно?", ar: "ماذا تحتاج؟" }, lang)}
            placeholder={pk({ tr: "örn. şeffaf silikon kılıf", en: "e.g. clear silicone case", ru: "напр. силиконовый чехол", ar: "مثال: غطاء سيليكون" }, lang)}
            value={form.urun}
            onChange={(e) => setForm({ ...form, urun: e.target.value })}
          />
          <Input
            label={pk({ tr: "Adet", en: "Quantity", ru: "Количество", ar: "الكمية" }, lang)}
            inputMode="numeric"
            placeholder="200"
            value={form.adet}
            onChange={(e) => setForm({ ...form, adet: e.target.value })}
          />
          <Input
            label={pk({ tr: "Hedef birim fiyat (₺)", en: "Target unit price (₺)", ru: "Целевая цена (₺)", ar: "السعر المستهدف (₺)" }, lang)}
            inputMode="numeric"
            placeholder="—"
            value={form.hedef}
            onChange={(e) => setForm({ ...form, hedef: e.target.value })}
          />
          <Input
            label={pk({ tr: "Telefon", en: "Phone", ru: "Телефон", ar: "الهاتف" }, lang)}
            inputMode="tel"
            placeholder="+90…"
            value={form.tel}
            onChange={(e) => setForm({ ...form, tel: e.target.value })}
            hint={pk({
              tr: "Esnaf size buradan ulaşır. Hesap açmanız gerekmez.",
              en: "This is how the trader reaches you. No account needed.",
              ru: "Так торговец свяжется с вами. Аккаунт не нужен.",
              ar: "بهذا يتواصل معك التاجر. لا حاجة لحساب.",
            }, lang)}
          />
        </div>

        <div style={sx("margin-top:14px")}>
          <Textarea
            label={pk({ tr: "Açıklama", en: "Details", ru: "Описание", ar: "التفاصيل" }, lang)}
            rows={3}
            value={form.aciklama}
            onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
            placeholder={pk({
              tr: "Renk, ölçü, marka, teslim yeri… ne kadar netse teklif o kadar doğru gelir.",
              en: "Colour, size, brand, delivery point… the clearer this is, the more accurate the offers.",
              ru: "Цвет, размер, бренд, место доставки…",
              ar: "اللون والمقاس والعلامة ومكان التسليم…",
            }, lang)}
          />
        </div>

        <label style={sx("display:flex;align-items:center;gap:9px;margin-top:14px;font-size:14px;color:var(--text-body);cursor:pointer")}>
          <input
            type="checkbox"
            checked={form.numune}
            onChange={(e) => setForm({ ...form, numune: e.target.checked })}
            style={sx("width:17px;height:17px;accent-color:var(--color-primary)")}
          />
          {pk({ tr: "Önce numune istiyorum", en: "I want a sample first", ru: "Сначала образец", ar: "أريد عينة أولًا" }, lang)}
        </label>

        <div style={sx("margin-top:18px")}>
          {/* The one filled-orange button on this screen. */}
          <Button color="accent" size="lg" onClick={submit}>
            {pk({ tr: "Talebi gönder", en: "Send the request", ru: "Отправить заявку", ar: "أرسل الطلب" }, lang)}
          </Button>
        </div>
      </section>
    );
  }

  return <RequestDetail
    lang={lang} req={selReq} reqs={reqs} offersOf={offersOf}
    ctx={ctx} state={state} save={save} toast={toast} router={router}
  />;
}

function RequestDetail({ lang, req, reqs, offersOf, ctx, state, save, toast, router }: any) {
  const offers: Offer[] = offersOf(req);
  const real = offers.filter((o) => o.real);
  const acc = state.acceptedOffers[req.id];
  const dist = useMemo(() => SE.distribute(req, ctx), [req, ctx]);

  const expired = req.deadline && Date.now() > req.deadline && !acc;
  // U7 · state reads REAL offers only.
  const stateKey = req.durum === "vazgecildi" ? "vazgecildi"
    : acc ? "anlasildi"
    : expired ? "suresi_doldu"
    : real.length ? "degerlendirme"
    : "acik";

  const meta: Record<string, [string, string]> = {
    acik: ["primary", pk({ tr: "Açık · teklif toplanıyor", en: "Open · collecting offers", ru: "Открыт · сбор предложений", ar: "مفتوح · جمع العروض" }, lang)],
    degerlendirme: ["warning", pk({ tr: "Değerlendirme", en: "Under review", ru: "На рассмотрении", ar: "قيد المراجعة" }, lang)],
    anlasildi: ["success", pk({ tr: "Anlaşıldı", en: "Agreed", ru: "Договорено", ar: "تم الاتفاق" }, lang)],
    vazgecildi: ["secondary", pk({ tr: "Vazgeçildi", en: "Cancelled", ru: "Отменён", ar: "أُلغي" }, lang)],
    suresi_doldu: ["danger", pk({ tr: "Süresi doldu", en: "Expired", ru: "Истёк", ar: "انتهت المدة" }, lang)],
  };
  const [toneName, stateLabel] = meta[stateKey];
  const left = req.deadline ? Math.max(0, Math.ceil((req.deadline - Date.now()) / 3600000)) : null;

  // U3 · every number here is measured. "Opened it" is the marker the trader's
  // panel writes; if nobody opened it, this shows 0 rather than a fraction.
  const sent = dist?.sent.length || 0;
  const opened = OF.seenCount(req.id);
  const declined = Object.keys(OF.allDeclined()[String(req.id)] || {}).length;
  const funnel: [number, string, string][] = [
    [sent, pk({ tr: "dükkâna gitti", en: "shops reached", ru: "лавок получили", ar: "متجرًا وصله" }, lang), "primary"],
    [opened, pk({ tr: "talebi açtı", en: "opened it", ru: "открыли", ar: "فتحه" }, lang), "info"],
    [real.length, pk({ tr: "teklif verdi", en: "quoted", ru: "дали цену", ar: "سعّر" }, lang), real.length ? "success" : "warning"],
    [declined, pk({ tr: "cevaplayamadı", en: "declined", ru: "отказались", ar: "اعتذر" }, lang), "secondary"],
  ];

  const steps = [
    { n: 1, label: pk({ tr: "Talep gönderildi", en: "Request sent", ru: "Заявка отправлена", ar: "أُرسل الطلب" }, lang), state: "done" },
    { n: 2, label: pk({ tr: "Dükkânlara iletildi", en: "Sent to shops", ru: "Отправлено лавкам", ar: "أُرسل إلى المتاجر" }, lang), state: "done" },
    {
      n: 3,
      label: real.length
        ? pk({ tr: real.length + " teklif geldi", en: real.length + " offers in", ru: real.length + " предложений", ar: real.length + " عرضًا" }, lang)
        : pk({ tr: "Teklif bekleniyor", en: "Awaiting offers", ru: "Ожидаем предложения", ar: "بانتظار العروض" }, lang),
      state: acc ? "done" : real.length ? "now" : "idle",
    },
    { n: 4, label: pk({ tr: "Anlaşıldı", en: "Agreed", ru: "Договорено", ar: "تم الاتفاق" }, lang), state: acc ? "done" : "idle" },
  ];
  const stepStyle = (s: string) =>
    "flex:1;min-width:0;padding:9px 10px;text-align:center;background:" +
    (s === "done" ? "var(--color-success-soft);color:var(--color-success)"
      : s === "now" ? "var(--color-primary-soft);color:var(--color-primary-accent)"
      : "var(--surface-card);color:var(--text-muted)");

  const pill = (on: boolean) =>
    "height:34px;padding:0 13px;border-radius:999px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:1px solid " +
    (on ? "var(--color-primary);background:var(--color-primary);color:#fff" : "var(--border-strong);background:var(--surface-card);color:var(--text-body)");

  const patchReq = (patch: Partial<BuyRequest>) =>
    save({ talepler: reqs.map((t: BuyRequest) => (t.id === req.id ? { ...t, ...patch } : t)) });

  return (
    <>
      <section style={sx(CARD)}>
        <div style={sx("display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap")}>
          <div style={sx("flex:1;min-width:200px")}>
            <h1 style={sx("font-size:22px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0")}>{req.urun}</h1>
            <div style={sx("font-size:13.5px;color:var(--text-muted);margin-top:4px")}>
              {[req.adet ? req.adet + " " + (req.birim || "") : "", req.aciklama].filter(Boolean).join(" · ")}
            </div>
          </div>
          <span
            style={sx(
              "display:inline-flex;align-items:center;height:25px;padding:0 10px;border-radius:7px;font-size:12px;font-weight:700;background:" +
                tonePair(toneName).bg + ";color:" + tonePair(toneName).fg,
            )}
          >
            {stateLabel}
          </span>
        </div>

        {left != null && (
          <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:8px")}>
            {left > 0
              ? pk({ tr: "Teklif toplamaya " + left + " saat kaldı", en: left + " hours left to collect offers", ru: "Осталось " + left + " ч", ar: "بقي " + left + " ساعة" }, lang)
              : pk({ tr: "Toplama süresi kapandı", en: "Collection window closed", ru: "Срок закрыт", ar: "أُغلقت المدة" }, lang)}
          </div>
        )}

        <div style={sx("display:flex;gap:1px;margin-top:16px;background:var(--border-default);border:1px solid var(--border-default);border-radius:11px;overflow:hidden")}>
          {steps.map((s) => (
            <div key={s.n} style={sx(stepStyle(s.state))}>
              <div style={sx("font-size:12.5px;font-weight:700")}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Distribution transparency: who got this, and by what rule. */}
        {dist && (
          <p style={sx("font-size:12.5px;color:var(--text-muted);margin-top:12px;text-wrap:pretty")}>
            {pk({
              tr: "Talep " + dist.sent.length + " dükkâna gitti · " + dist.matched + " uygun kayıt" +
                (dist.qty ? " · minimum " + dist.qty + " adede uyanlar" : "") + (dist.producers ? " · " + dist.producers + " üretici" : ""),
              en: "Sent to " + dist.sent.length + " shops · " + dist.matched + " matching records" +
                (dist.qty ? " · minimum fits " + dist.qty : "") + (dist.producers ? " · " + dist.producers + " manufacturers" : ""),
              ru: "Отправлено " + dist.sent.length + " лавкам · " + dist.matched + " подходящих записей",
              ar: "أُرسل إلى " + dist.sent.length + " متجرًا · " + dist.matched + " سجلًا مطابقًا",
            }, lang)}
          </p>
        )}

        {sent > 0 && (
          <div style={sx("display:flex;gap:8px;margin-top:14px;flex-wrap:wrap")}>
            {funnel
              .filter((r) => r[0] > 0 || r[2] !== "secondary")
              .map(([n, label, t]) => (
                <div key={label} style={sx("flex:1;min-width:88px;padding:11px 12px;border-radius:11px;background:var(--color-" + t + "-soft)")}>
                  <div style={sx("font-size:21px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--color-" + t + (t === "warning" ? "-accent" : "") + ")")}>
                    {n}
                  </div>
                  <div style={sx("font-size:12px;color:var(--text-body);margin-top:2px")}>{label}</div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* U8 · in B2B the first step is usually a sample, not a price. */}
      {req.numune && (
        <section style={sx(CARD + ";margin-top:14px")}>
          <div style={sx(KICKER)}>{pk({ tr: "Numune aşaması", en: "Sample stage", ru: "Этап образца", ar: "مرحلة العينة" }, lang)}</div>
          <p style={sx("font-size:13px;color:var(--text-muted);margin-top:5px;text-wrap:pretty")}>
            {pk({
              tr: "Numune sonuçlanmadan teklif kabul etmek zorunda değilsiniz — aşama burada kayıtlı kalır.",
              en: "You need not accept an offer before the sample lands — the stage is tracked here.",
              ru: "Не обязаны принимать предложение до образца.",
              ar: "لست مضطرًا لقبول عرض قبل وصول العينة.",
            }, lang)}
          </p>
          <div style={sx("display:flex;flex-wrap:wrap;gap:7px;margin-top:12px")}>
            {(
              [
                ["istedim", pk({ tr: "Numune istedim", en: "Sample requested", ru: "Образец запрошен", ar: "طلبت عينة" }, lang)],
                ["yolda", pk({ tr: "Yola çıktı", en: "On its way", ru: "В пути", ar: "في الطريق" }, lang)],
                ["uygun", pk({ tr: "Geldi · uygun", en: "Arrived · good", ru: "Пришёл · подходит", ar: "وصلت · مناسبة" }, lang)],
                ["olmadi", pk({ tr: "Geldi · olmadı", en: "Arrived · not right", ru: "Пришёл · не то", ar: "وصلت · غير مناسبة" }, lang)],
              ] as [SampleState, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  patchReq({ numuneDurum: id });
                  toast(pk({ tr: "Numune aşaması güncellendi", en: "Sample stage updated", ru: "Этап обновлён", ar: "حُدّثت المرحلة" }, lang));
                }}
                style={sx(pill(req.numuneDurum === id))}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Closing the request is the buyer's to do — otherwise traders keep
          messaging into a decision that was made days ago. */}
      {(stateKey === "acik" || stateKey === "degerlendirme") && (
        <section style={sx(CARD + ";margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center")}>
          <span style={sx("flex:1;min-width:180px;font-size:13.5px;color:var(--text-body)")}>
            {pk({ tr: "İşiniz bitti mi?", en: "Done with this?", ru: "Завершили?", ar: "انتهيت؟" }, lang)}
          </span>
          <Button
            variant="outline"
            color="success"
            size="md"
            onClick={() => {
              patchReq({ durum: "kapandi" });
              toast(pk({ tr: "Talep kapatıldı", en: "Request closed", ru: "Запрос закрыт", ar: "أُغلق الطلب" }, lang));
            }}
          >
            {pk({ tr: "Aldım · kapat", en: "Bought · close", ru: "Купил · закрыть", ar: "اشتريت · إغلاق" }, lang)}
          </Button>
          <Button
            variant="outline"
            color="dark"
            size="md"
            onClick={() => {
              patchReq({ durum: "vazgecildi" });
              toast(pk({ tr: "Talepten vazgeçildi — esnafa haber verildi", en: "Request cancelled — traders notified", ru: "Запрос отменён", ar: "أُلغي الطلب" }, lang));
            }}
          >
            {pk({ tr: "Vazgeçtim", en: "Cancel", ru: "Отменить", ar: "إلغاء" }, lang)}
          </Button>
        </section>
      )}

      {/* Repeat orders are where most B2B revenue comes from. */}
      {(stateKey === "anlasildi" || req.durum === "kapandi") && (
        <section style={sx(CARD + ";margin-top:14px")}>
          <Button
            color="primary"
            size="md"
            onClick={() => {
              const t = { ...req, id: String(Date.now()), durum: "acik", deadline: Date.now() + 3 * 86400000 };
              save({ talepler: [t].concat(reqs) });
              router.push(href.work("talep", t.id));
              toast(pk({ tr: "Yeni talep açıldı", en: "New request opened", ru: "Открыт новый запрос", ar: "فُتح طلب جديد" }, lang));
            }}
          >
            {pk({ tr: "Aynısını yeniden sipariş et", en: "Order the same again", ru: "Заказать снова", ar: "أعد الطلب" }, lang)}
          </Button>
        </section>
      )}

      {acc && (
        <section style={sx(CARD + ";margin-top:14px;border-color:var(--color-success)")}>
          <div style={sx(KICKER)}>{F(lang, "agreed")}</div>
          <div style={sx("font-size:17px;font-weight:700;color:var(--text-heading);margin-top:5px")}>{acc.name}</div>
          <div style={sx("font-size:13.5px;color:var(--text-body);margin-top:4px")}>
            {money(acc.unit)} × {acc.qty} = <b>{money(acc.raw)}</b> · {acc.gun} {W(lang, "days")}
          </div>
          {/* K1 · HAN does not take the payment. The closing point is the
              agreement; what follows is between the two parties. */}
          <p style={sx("font-size:12.5px;color:var(--text-muted);margin-top:8px;text-wrap:pretty")}>
            {pk({
              tr: "HAN ödeme almaz. Anlaşma kaydedildi; ödeme ve teslim sizinle dükkân arasında. Sonucu dükkân sayfasında işaretleyip yorum yazabilirsiniz.",
              en: "HAN does not take payment. The agreement is recorded; payment and delivery are between you and the shop. Mark the outcome on the shop page and you can review it.",
              ru: "HAN не принимает оплату. Соглашение записано; оплата и доставка — между вами и лавкой.",
              ar: "لا تتقاضى HAN المدفوعات. سُجّل الاتفاق؛ الدفع والتسليم بينك وبين المتجر.",
            }, lang)}
          </p>
          <div style={sx("margin-top:12px")}>
            <Button variant="outline" color="primary" size="md" onClick={() => router.push(href.store(acc.recordId, "reviews"))}>
              {pk({ tr: "Sonucu işaretle ve yorum yaz", en: "Mark the outcome and review", ru: "Отметить результат", ar: "سجّل النتيجة وقيّم" }, lang)}
            </Button>
          </div>
        </section>
      )}
    </>
  );
}

// ── the offers panel ──────────────────────────────────────────────────────

function OffersPanel({ lang, req, offers, cv }: any) {
  const { state, save, toast } = useApp();
  const router = useRouter();
  const acc = state.acceptedOffers[req.id];
  const real = offers.filter((o: Offer) => o.real);
  // K9 · "best price" is only ever sought among real offers. An estimate
  // cannot be the best of anything.
  const bestRaw = real.length ? Math.min(...real.map((o: Offer) => o.raw)) : null;

  if (!offers.length) {
    return (
      <div style={sx(CARD)}>
        <div style={sx(KICKER)}>{pk({ tr: "Gelen teklifler", en: "Incoming offers", ru: "Предложения", ar: "العروض" }, lang)}</div>
        <p style={sx("font-size:13.5px;color:var(--text-muted);margin-top:8px;text-wrap:pretty")}>
          {pk({
            tr: "Henüz teklif yok. Esnafa mesaj olarak düştü; genelde birkaç saat içinde dönerler.",
            en: "No offers yet. The request reached traders as a message; they usually reply within a few hours.",
            ru: "Предложений пока нет.",
            ar: "لا عروض بعد.",
          }, lang)}
        </p>
      </div>
    );
  }

  return (
    <div style={sx(CARD)}>
      <div style={sx(KICKER)}>{pk({ tr: "Gelen teklifler", en: "Incoming offers", ru: "Предложения", ar: "العروض" }, lang)}</div>
      <div style={sx("display:flex;flex-direction:column;gap:10px;margin-top:12px")}>
        {offers.map((o: Offer) => {
          const until = o.validUntil || null;
          const leftDays = until ? Math.max(0, Math.ceil((until - Date.now()) / 86400000)) : null;
          const expired = !!(o.real && until && Date.now() > until);
          const isBest = o.real && o.raw === bestRaw;
          const rejected = !!(state.rejects || {})[req.id + ":" + o.recordId];

          return (
            <div
              key={o.recordId}
              style={sx(
                "padding:13px 14px;border-radius:12px;background:var(--surface-card);border:1px solid " +
                  (isBest ? "var(--color-success)" : o.estimate ? "var(--border-default)" : "var(--border-strong)") +
                  (o.estimate ? ";opacity:.82" : ""),
              )}
            >
              <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
                <button
                  type="button"
                  onClick={() => router.push(href.store(o.curated || o.recordId))}
                  style={sx("background:none;border:none;padding:0;font-family:inherit;font-size:14.5px;font-weight:700;color:var(--text-heading);cursor:pointer;text-align:start")}
                >
                  {o.name}
                </button>
                {/* The single most important distinction on this screen. */}
                <span
                  style={sx(
                    "display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;font-size:11.5px;font-weight:700;background:var(--color-" +
                      (o.real ? "success-soft);color:var(--color-success)" : "warning-soft);color:var(--color-warning-accent)"),
                  )}
                >
                  {o.real
                    ? pk({ tr: "dükkândan teklif", en: "offer from the shop", ru: "предложение лавки", ar: "عرض من المتجر" }, lang)
                    : pk({ tr: "tahmini aralık", en: "estimated range", ru: "оценочный диапазон", ar: "نطاق تقديري" }, lang)}
                </span>
                {isBest && <Badge color="success" variant="solid" size="sm">{pk({ tr: "en uygun", en: "best", ru: "лучшее", ar: "الأفضل" }, lang)}</Badge>}
              </div>

              <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:4px")}>
                {[
                  (SC.PLACES.find((p) => p.id === o.place) || { name: "" }).name,
                  o.door ? W(lang, "doorNo") + " " + o.door : "",
                  o.respMins ? W(lang, "respShort", o.respMins) : "",
                  o.gun + " " + W(lang, "days"),
                  o.moq && o.moq > 1 ? W(lang, "minOrder") + " " + o.moq : "",
                ].filter(Boolean).join(" · ")}
              </div>

              {o.note && <div style={sx("font-size:13px;color:var(--text-body);margin-top:6px;text-wrap:pretty")}>{o.note}</div>}

              <div style={sx("display:flex;align-items:baseline;gap:9px;margin-top:8px")}>
                <span style={sx("font-size:18px;font-weight:700;color:var(--color-primary);letter-spacing:-.01em")}>{money(o.raw)}</span>
                <span style={sx("font-size:12.5px;color:var(--text-muted)")}>{cv(o.raw)}</span>
              </div>

              {/* Three-week-old price is not a price: a real offer is valid for
                  seven days, counted from its own age. */}
              {o.real && leftDays != null && (
                <div style={sx("font-size:12px;font-weight:700;margin-top:4px;color:var(--color-" + (expired ? "danger" : "success") + ")")}>
                  {expired
                    ? pk({ tr: "süresi doldu", en: "expired", ru: "истёк", ar: "انتهى" }, lang)
                    : pk({ tr: leftDays + " gün geçerli", en: "valid " + leftDays + " more days", ru: "действует " + leftDays + " дн.", ar: "صالح " + leftDays + " يومًا" }, lang)}
                </div>
              )}

              {!acc && o.real && !expired && (
                <div style={sx("display:flex;gap:8px;margin-top:10px;flex-wrap:wrap")}>
                  <Button
                    color="accent"
                    size="sm"
                    onClick={() => {
                      // K3 · store the commitment itself, not just an id: this
                      // is what later proves the right to review.
                      save({
                        acceptedOffers: {
                          ...state.acceptedOffers,
                          [req.id]: { recordId: o.recordId, name: o.name || "", unit: o.unit, raw: o.raw, qty: o.qty, gun: o.gun, at: Date.now() },
                        },
                      });
                      toast(F(lang, "agreed"));
                    }}
                  >
                    {pk({ tr: "Kabul et", en: "Accept", ru: "Принять", ar: "اقبل" }, lang)}
                  </Button>
                </div>
              )}

              {/* A rejection reason is feedback: it makes the next offer better. */}
              {!acc && o.real && !rejected && (
                <div style={sx("display:flex;gap:6px;margin-top:8px;flex-wrap:wrap")}>
                  {(
                    [
                      ["pahali", pk({ tr: "Pahalı", en: "Too pricey", ru: "Дорого", ar: "غالٍ" }, lang)],
                      ["gec", pk({ tr: "Geç teslim", en: "Too slow", ru: "Долго", ar: "بطيء" }, lang)],
                      ["moq", pk({ tr: "MOQ yüksek", en: "MOQ too high", ru: "Высокий минимум", ar: "الحد الأدنى مرتفع" }, lang)],
                    ] as [string, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        save({ rejects: { ...state.rejects, [req.id + ":" + o.recordId]: id } });
                        toast(pk({ tr: "Sebep esnafa iletildi", en: "Reason sent to the shop", ru: "Причина отправлена", ar: "أُرسل السبب" }, lang));
                      }}
                      style={sx("height:28px;padding:0 10px;border-radius:7px;border:1px solid var(--border-default);background:var(--surface-muted);font-family:inherit;font-size:12px;font-weight:600;color:var(--text-muted);cursor:pointer")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {rejected && (
                <div style={sx("font-size:12px;color:var(--text-muted);margin-top:8px")}>
                  {pk({ tr: "Reddettiniz · sebep iletildi", en: "Rejected · reason sent", ru: "Отклонено · причина отправлена", ar: "مرفوض · أُرسل السبب" }, lang)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── comparison ────────────────────────────────────────────────────────────

function CompareView({ lang, cv }: { lang: Lang; cv: (n: number | null) => string }) {
  const { state, set } = useApp();
  const router = useRouter();

  // C3 · two sources, hand-ticked selection first. Being forced through a
  // buying-list row was the old limitation.
  const picked = (state.cmpPick || []).map((id) => SC.RECORDS.find((r) => r.id === id)).filter(Boolean) as ShopRecord[];
  const row = (state.buyList || [])[0] || null;
  const qty = row ? Number(row.qty) || 1 : 1;
  const cands = picked.length
    ? picked.slice(0, 5)
    : row
      ? SE.search(row.name, { activeOnly: true }, { mode: state.mode, lang, qty, sort: "fiyat" }).items.slice(0, 3).map((x) => x.rec)
      : [];

  const totals = cands.map((rec) => (rec.band ? rec.band[0] * Math.max(qty, rec.moq || 1) : null));
  const valid = totals.filter((x): x is number => x != null);
  const best = valid.length ? Math.min(...valid) : null;

  const labels = [
    F(lang, "rowUnit") || pk({ tr: "Birim fiyat", en: "Unit price", ru: "Цена за шт.", ar: "سعر الوحدة" }, lang),
    F(lang, "rowMin") || W(lang, "minOrder"),
    pk({ tr: "Fiyat bandı", en: "Price band", ru: "Диапазон цен", ar: "نطاق السعر" }, lang),
    pk({ tr: "Yanıt süresi", en: "Response time", ru: "Время ответа", ar: "زمن الرد" }, lang),
    F(lang, "rowShip") || F(lang, "fExport"),
    F(lang, "rowTax") || F(lang, "fTaxFree"),
    F(lang, "rowTotal") || pk({ tr: "Toplam", en: "Total", ru: "Итого", ar: "الإجمالي" }, lang),
  ];

  if (!cands.length) {
    return (
      <EmptyState
        icon="filter"
        tone="neutral"
        title={pk({ tr: "Karşılaştıracak dükkân seçilmedi", en: "No shops picked to compare", ru: "Не выбраны магазины", ar: "لم تُحدَّد متاجر" }, lang)}
        description={pk({
          tr: "Arama sonuçlarında en az iki dükkânı işaretleyin; fiyat, minimum ve teslim yan yana gelsin.",
          en: "Tick at least two shops in the results and price, minimum and delivery line up side by side.",
          ru: "Отметьте минимум два магазина в результатах.",
          ar: "حدّد متجرين على الأقل في النتائج.",
        }, lang)}
        actions={<Button color="primary" onClick={() => router.push(href.search())}>{W(lang, "search")}</Button>}
      />
    );
  }

  return (
    <section>
      <div style={sx("display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
        <h1 style={sx("flex:1;min-width:200px;font-size:22px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0")}>
          {F(lang, "tabCmp")}
        </h1>
        {picked.length > 0 && (
          <Button variant="outline" color="dark" size="sm" onClick={() => set({ cmpPick: [] })}>
            {pk({ tr: "Seçimi bırak", en: "Clear", ru: "Сбросить", ar: "إلغاء" }, lang)}
          </Button>
        )}
      </div>

      {/* Wide tables scroll inside their own box; the page itself never scrolls
          sideways. */}
      <div style={sx("display:flex;gap:12px;margin-top:16px;overflow-x:auto;padding-bottom:6px")}>
        <div style={sx("flex:none;width:150px;display:flex;flex-direction:column;gap:1px;padding-top:44px")}>
          {labels.map((l) => (
            <div key={l} style={sx("height:46px;display:flex;align-items:center;font-size:12.5px;font-weight:600;color:var(--text-muted)")}>
              {l}
            </div>
          ))}
        </div>

        {cands.map((rec, i) => {
          const unit = rec.band ? rec.band[0] : null;
          const total = totals[i];
          const isBest = total != null && total === best;
          const cells: { v: string; alt?: string }[] = [
            { v: unit == null ? "—" : money(unit), alt: unit == null ? "" : cv(unit) },
            { v: String(rec.moq || 1) },
            { v: rec.band ? money(rec.band[0]) + "–" + money(rec.band[1]) : "—" },
            { v: rec.respMins ? W(lang, "respShort", rec.respMins) : "—" },
            { v: rec.shipsAbroad ? "✓" : "—" },
            { v: rec.taxFree ? "✓" : "—" },
            { v: total == null ? "—" : money(total), alt: total == null ? "" : cv(total) },
          ];
          return (
            <div
              key={rec.id}
              style={sx("flex:none;width:190px;border:1px solid " + (isBest ? "var(--color-success)" : "var(--border-default)") + ";border-radius:11px;overflow:hidden;background:var(--surface-card)")}
            >
              <button
                type="button"
                onClick={() => router.push(href.store(rec.curated || rec.id))}
                style={sx("display:block;width:100%;height:44px;padding:0 12px;border:none;background:" + (isBest ? "var(--color-success-soft)" : "var(--surface-muted)") + ";font-family:inherit;font-size:13.5px;font-weight:700;color:var(--text-heading);text-align:start;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}
              >
                {rec.name || recordName(rec, lang)}
              </button>
              {cells.map((c, j) => (
                <div key={j} style={sx("height:46px;padding:0 12px;display:flex;flex-direction:column;justify-content:center;border-top:1px solid var(--border-default)")}>
                  <span style={sx("font-size:14px;font-weight:700;color:var(--text-heading)")}>{c.v}</span>
                  {c.alt && <span style={sx("font-size:11px;color:var(--text-muted)")}>{c.alt}</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── saved ─────────────────────────────────────────────────────────────────

function SavedView({ lang }: { lang: Lang }) {
  const { state, save, toast } = useApp();
  const router = useRouter();
  const [collection, setCollection] = useState("all");

  const COLLECTIONS: [string, string][] = [
    ["all", pk({ tr: "Hepsi", en: "All", ru: "Все", ar: "الكل" }, lang)],
    ["genel", pk({ tr: "Genel", en: "General", ru: "Общее", ar: "عام" }, lang)],
    ["toptan", pk({ tr: "Toptan alım", en: "Wholesale", ru: "Опт", ar: "جملة" }, lang)],
    ["hediye", pk({ tr: "Hediye", en: "Gifts", ru: "Подарки", ar: "هدايا" }, lang)],
    ["sonra", pk({ tr: "Sonra bakılacak", en: "Look at later", ru: "Посмотреть позже", ar: "لاحقًا" }, lang)],
  ];

  // A saved id can come from either engine; looking only at STORES loses every
  // scale record the buyer saved.
  const rows = state.saved
    .map((id) => {
      const store = D.STORES.find((s) => s.id === id);
      const rec = SC.RECORDS.find((r) => r.id === id || r.curated === id);
      return { id, name: store?.name || rec?.name || id, rec, store };
    })
    .filter((r) => collection === "all" || (state.savedFolders || {})[r.id] === collection);

  if (!state.saved.length) {
    return (
      <EmptyState
        icon="heart"
        tone="neutral"
        title={F(lang, "kSaved", 0)}
        description={pk({
          tr: "Kaydettiğiniz dükkânlar burada durur ve çevrimdışı da açılır.",
          en: "Shops you save live here, and they open offline too.",
          ru: "Сохранённые лавки здесь, они открываются и офлайн.",
          ar: "المتاجر المحفوظة هنا وتُفتح دون اتصال.",
        }, lang)}
        actions={<Button color="primary" onClick={() => router.push(href.search())}>{W(lang, "search")}</Button>}
      />
    );
  }

  const shareText = rows
    .map((r) => "• " + r.name + (r.rec ? " — " + (SC.PLACES.find((p) => p.id === r.rec!.place)?.name || "") + " " + W(lang, "doorNo") + " " + r.rec.door : ""))
    .join("\n");

  return (
    <section>
      <div style={sx("display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
        <h1 style={sx("flex:1;min-width:200px;font-size:22px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0")}>
          {F(lang, "tabSaved")}
        </h1>
        {/* A list you cannot pass to someone is half a list. */}
        <Button
          variant="outline"
          color="primary"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareText);
              toast(pk({ tr: "Liste kopyalandı — WhatsApp'a yapıştırabilirsiniz", en: "List copied — paste it into WhatsApp", ru: "Список скопирован", ar: "نُسخت القائمة" }, lang));
            } catch {
              toast(pk({ tr: "Kopyalanamadı", en: "Could not copy", ru: "Не удалось скопировать", ar: "تعذّر النسخ" }, lang));
            }
          }}
        >
          {pk({ tr: "Listeyi paylaş", en: "Share the list", ru: "Поделиться списком", ar: "شارك القائمة" }, lang)}
        </Button>
      </div>

      <div style={sx("display:flex;flex-wrap:wrap;gap:7px;margin-top:14px")}>
        {COLLECTIONS.map(([id, label]) => {
          const on = collection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setCollection(id)}
              style={sx(
                "height:32px;padding:0 13px;border-radius:999px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:1px solid " +
                  (on ? "var(--color-primary);background:var(--color-primary);color:#fff" : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={sx("display:flex;flex-direction:column;gap:10px;margin-top:16px")}>
        {rows.map((r) => (
          <div key={r.id} style={sx(CARD)}>
            <div style={sx("display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap")}>
              <button
                type="button"
                onClick={() => router.push(href.store(r.id))}
                style={sx("flex:1;min-width:180px;background:none;border:none;padding:0;font-family:inherit;text-align:start;cursor:pointer")}
              >
                <span style={sx("display:block;font-size:15.5px;font-weight:700;color:var(--text-heading)")}>{r.name}</span>
                {r.rec && (
                  <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:3px")}>
                    {(SC.PLACES.find((p) => p.id === r.rec!.place) || { name: "" }).name} · {W(lang, "doorNo")} {r.rec.door}
                  </span>
                )}
              </button>
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => save({ saved: state.saved.filter((x) => x !== r.id) })}
              >
                {W(lang, "unsave")}
              </Button>
            </div>

            <div style={sx("display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center")}>
              <select
                value={(state.savedFolders || {})[r.id] || "genel"}
                onChange={(e) => save({ savedFolders: { ...state.savedFolders, [r.id]: e.target.value } })}
                aria-label={pk({ tr: "Koleksiyon", en: "Collection", ru: "Коллекция", ar: "مجموعة" }, lang)}
                style={sx("height:32px;padding:0 9px;border-radius:7px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:13px;color:var(--text-body)")}
              >
                {COLLECTIONS.filter(([id]) => id !== "all").map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
              <Input
                size="sm"
                placeholder={pk({ tr: "Not ekleyin…", en: "Add a note…", ru: "Заметка…", ar: "أضف ملاحظة…" }, lang)}
                value={(state.savedNotes || {})[r.id] || ""}
                onChange={(e) => save({ savedNotes: { ...state.savedNotes, [r.id]: e.target.value } })}
                aria-label={pk({ tr: "Not", en: "Note", ru: "Заметка", ar: "ملاحظة" }, lang)}
                className="han-note"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── notifications ─────────────────────────────────────────────────────────

function NotificationsView({ lang, reqs, realOf }: { lang: Lang; reqs: BuyRequest[]; realOf: (t: BuyRequest) => Offer[] }) {
  const { state } = useApp();
  const router = useRouter();

  const rows: { id: string; tone: string; title: string; body: string; go?: () => void }[] = [];

  // Only real offers are news.
  reqs.forEach((t) => {
    const real = realOf(t);
    if (real.length && !state.acceptedOffers[t.id]) {
      rows.push({
        id: "off-" + t.id,
        tone: "success",
        title: pk({
          tr: t.urun + " için " + real.length + " teklif geldi",
          en: real.length + " offers for " + t.urun,
          ru: real.length + " предложений по " + t.urun,
          ar: real.length + " عرضًا لـ " + t.urun,
        }, lang),
        body: pk({ tr: "Teklifleri karşılaştırıp kabul edebilirsiniz.", en: "Compare them and accept one.", ru: "Сравните и примите.", ar: "قارنها واقبل واحدًا." }, lang),
        go: () => router.push(href.work("talep", t.id)),
      });
    }
  });

  (D.NOTIFS || []).forEach((n, i) => {
    rows.push({
      id: "n" + i,
      tone: ({ offer: "success", camp: "accent", info: "info", warn: "warning" } as Record<string, string>)[n.kind as string] || "info",
      title: tx(n, lang),
      body: (n["body" + lang.charAt(0).toUpperCase() + lang.slice(1)] as string) || (n.bodyTr as string) || "",
    });
  });

  if (!rows.length) {
    return (
      <EmptyState
        icon="message-notif"
        tone="neutral"
        title={pk({ tr: "Bildiriminiz yok", en: "No notifications", ru: "Нет уведомлений", ar: "لا إشعارات" }, lang)}
        description={pk({
          tr: "Talepleriniz yanıtlandığında ve yakınınızda etkinlik olduğunda burada görürsünüz.",
          en: "You will see replies to your requests and nearby events here.",
          ru: "Здесь появятся ответы на заявки и события рядом.",
          ar: "سترى هنا الردود على طلباتك والفعاليات القريبة.",
        }, lang)}
      />
    );
  }

  return (
    <section>
      <h1 style={sx("font-size:22px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0")}>{F(lang, "tabNotif")}</h1>
      <div style={sx("display:flex;flex-direction:column;gap:10px;margin-top:16px")}>
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={r.go}
            disabled={!r.go}
            style={sx(
              "display:flex;align-items:flex-start;gap:12px;width:100%;text-align:start;font-family:inherit;padding:14px 16px;border-radius:12px;border:1px solid var(--border-default);background:var(--surface-card);" +
                (r.go ? "cursor:pointer" : "cursor:default"),
            )}
          >
            <span
              style={sx(
                "flex:none;width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:" +
                  tonePair(r.tone).bg + ";color:" + tonePair(r.tone).fg,
              )}
            >
              <Icon name="message-notif" size={16} />
            </span>
            <span style={sx("flex:1;min-width:0")}>
              <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading);text-wrap:pretty")}>{r.title}</span>
              <span style={sx("display:block;font-size:13px;color:var(--text-muted);margin-top:3px;text-wrap:pretty")}>{r.body}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
