"use client";

// Araçlar — the eight things a buyer needs that are not a shop.
//
// Currency, a guide, tax-free, freight, what's nearby, bazaar etiquette,
// emergencies and reporting a problem. They live behind one nav because they
// share a shape: each answers a question the shop list cannot.

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import type { Lang } from "@/data/types";
import { Alert, Button, EmptyState, Icon, Input, Select, Textarea } from "@/ds";
import { F } from "@/lib/copy";
import { num, tonePair, tx } from "@/lib/i18n";
import { CARD_BOX, STICKY_TOP, areaOn, breaks, searchGrid } from "@/lib/layout";
import { href } from "@/lib/routes";
import { medStyle } from "@/lib/shop";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;
const CARD = "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:18px 20px;box-shadow:0 3px 4px rgba(0,0,0,.03)";
const KICKER = "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)";

const TOOLS = ["doviz", "rehber", "taxfree", "lojistik", "yakin", "kultur", "acil", "sorun"] as const;
type Tool = (typeof TOOLS)[number];

export default function ToolsPage() {
  return (
    <Suspense fallback={null}>
      <ToolsScreen />
    </Suspense>
  );
}

function ToolsScreen() {
  const { state } = useApp();
  const router = useRouter();
  const params = useParams<{ tool?: string[] }>();
  const { lang } = state;
  const b = breaks(state.vw);
  const tool = ((params.tool?.[0] || "doviz") as Tool);

  const labels: Record<Tool, { label: string; icon: string }> = {
    doviz: { label: F(lang, "toolFx") || pk({ tr: "Döviz çevirici", en: "Currency converter", ru: "Конвертер", ar: "محوّل العملات" }, lang), icon: "chart-line-up" },
    rehber: { label: pk({ tr: "Rehber tut", en: "Hire a guide", ru: "Нанять гида", ar: "استأجر مرشدًا" }, lang), icon: "user" },
    taxfree: { label: F(lang, "toolTax") || pk({ tr: "Tax-free", en: "Tax-free", ru: "Tax-free", ar: "الإعفاء الضريبي" }, lang), icon: "files" },
    lojistik: { label: F(lang, "toolShip") || pk({ tr: "Nakliye ve gönderim", en: "Shipping & freight", ru: "Доставка", ar: "الشحن" }, lang), icon: "handcart" },
    yakin: { label: F(lang, "toolNear") || pk({ tr: "Yakınımda", en: "Near me", ru: "Рядом", ar: "بالقرب مني" }, lang), icon: "abstract" },
    kultur: { label: F(lang, "toolCulture") || pk({ tr: "Çarşı görgüsü", en: "Bazaar etiquette", ru: "Этикет базара", ar: "آداب السوق" }, lang), icon: "shield-search" },
    acil: { label: F(lang, "toolEmergency") || pk({ tr: "Acil durum", en: "Emergency", ru: "Экстренно", ar: "الطوارئ" }, lang), icon: "cross-circle" },
    sorun: { label: F(lang, "toolReport") || pk({ tr: "Sorun bildir", en: "Report a problem", ru: "Сообщить", ar: "أبلغ" }, lang), icon: "message-notif" },
  };

  return (
    <div style={sx(searchGrid(b))}>
      <aside style={sx(areaOn("f") + CARD_BOX + (b.three ? STICKY_TOP : ""))}>
        <nav style={sx("display:flex;flex-direction:column;gap:3px")} aria-label={F(lang, "secTools")}>
          {TOOLS.map((t) => {
            const on = t === tool;
            return (
              <button
                key={t}
                type="button"
                onClick={() => router.push(href.tool(t))}
                aria-current={on ? "page" : undefined}
                style={sx(
                  "display:flex;align-items:center;gap:10px;width:100%;background:" +
                    (on ? "var(--color-primary-soft)" : "none") +
                    ";border:none;padding:11px;border-radius:9px;font-family:inherit;font-size:14px;font-weight:" +
                    (on ? "700" : "500") +
                    ";color:" + (on ? "var(--color-primary-accent)" : "var(--text-body)") +
                    ";text-align:start;cursor:pointer",
                )}
              >
                <Icon name={labels[t].icon} size={17} />
                <span style={sx("flex:1;min-width:0")}>{labels[t].label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main style={sx(areaOn("l") + areaOn("d").replace("grid-area:d;", ""))}>
        {tool === "doviz" && <Converter lang={lang} />}
        {tool === "rehber" && <Guides lang={lang} />}
        {tool === "taxfree" && <TaxFree lang={lang} />}
        {tool === "lojistik" && <Freight lang={lang} />}
        {tool === "yakin" && <Nearby lang={lang} />}
        {tool === "kultur" && <Culture lang={lang} />}
        {tool === "acil" && <Emergency lang={lang} />}
        {tool === "sorun" && <ReportProblem lang={lang} />}
      </main>
    </div>
  );
}

function ToolHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <header style={sx("margin-bottom:16px")}>
      <h1 style={sx("font-size:24px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0")}>{title}</h1>
      {sub && <p style={sx("font-size:14px;color:var(--text-muted);margin-top:5px;max-width:70ch;text-wrap:pretty")}>{sub}</p>}
    </header>
  );
}

// ── currency ──────────────────────────────────────────────────────────────

function Converter({ lang }: { lang: Lang }) {
  const { state, set } = useApp();
  const [amount, setAmount] = useState(state.fxAmount || "1000");
  const CU = D.CU;
  const value = Number(String(amount).replace(/[^\d.]/g, "")) || 0;

  const rows = (D.CURRENCIES || [])
    .filter((c) => c.id !== "TRY")
    .map((c) => ({
      id: c.id as string,
      label: (c.label as string) || (c.id as string),
      sym: (c.sym as string) || "",
      value: value * ((D.RATES as Record<string, number>)[c.id as string] || 0),
    }));

  return (
    <>
      <ToolHead title={tx(CU.title, lang)} sub={tx(CU.sub, lang)} />
      <section style={sx(CARD)}>
        <Input
          label={tx(CU.amount, lang)}
          inputMode="decimal"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); set({ fxAmount: e.target.value }); }}
        />
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(140px,100%),1fr));gap:1px;background:var(--border-default);border:1px solid var(--border-default);border-radius:11px;overflow:hidden;margin-top:16px")}>
          {rows.map((r) => (
            <div key={r.id} style={sx("background:var(--surface-card);padding:14px 15px")}>
              <div style={sx("font-size:11.5px;color:var(--text-muted)")}>{r.label}</div>
              <div style={sx("font-size:20px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin-top:3px;font-variant-numeric:tabular-nums")}>
                {r.sym}
                {r.value >= 100 ? Math.round(r.value).toLocaleString() : r.value.toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        <div style={sx("display:flex;gap:14px;flex-wrap:wrap;margin-top:16px;font-size:13px;color:var(--text-muted)")}>
          <span>
            <b style={sx("color:var(--text-body)")}>{tx(CU.rateSource, lang)}:</b> {tx(CU.rateSourceVal, lang)}
          </span>
        </div>

        {/* The rate is indicative and the screen says so. A tourist who takes
            this as the exchange-office rate has been misled by us. */}
        <div style={sx("margin-top:14px")}>
          <Alert color="warning" variant="light">
            {state.online ? tx(CU.estimate, lang) : tx(CU.offlineFrozen, lang)}
          </Alert>
        </div>
      </section>
    </>
  );
}

// ── guides ────────────────────────────────────────────────────────────────

function Guides({ lang }: { lang: Lang }) {
  const { toast } = useApp();
  const guides = D.GUIDES || [];
  // Whether the guide speaks the reader's language is the first thing that
  // matters, so the list splits on it rather than burying it in a chip.
  const mine = guides.filter((g) => (g.langs || []).includes(lang));
  const others = guides.filter((g) => !(g.langs || []).includes(lang));

  const card = (g: Record<string, unknown>) => (
    <article key={g.id as string} style={sx(CARD)}>
      <div style={sx("display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap")}>
        <div style={sx("flex:1;min-width:180px")}>
          <div style={sx("font-size:16.5px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>{g.name as string}</div>
          <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:3px")}>
            {(g.langs as string[]).map((l) => l.toUpperCase()).join(" · ")} ·{" "}
            {tx(D.AREAS.find((a) => a.id === g.area), lang)}
          </div>
          <p style={sx("font-size:13.5px;color:var(--text-body);margin-top:8px;text-wrap:pretty")}>
            {(g["n" + lang.charAt(0).toUpperCase() + lang.slice(1)] as string) || (g.nTr as string)}
          </p>
        </div>
        <div style={sx("flex:none;text-align:end")}>
          <div style={sx("font-size:18px;font-weight:700;color:var(--color-primary)")}>₺{num(g.price as number, lang)}</div>
          <div style={sx("font-size:12px;color:var(--text-muted)")}>{pk({ tr: "günlük", en: "per day", ru: "в день", ar: "يوميًا" }, lang)}</div>
          <span
            style={sx(
              "display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;font-size:11.5px;font-weight:700;margin-top:6px;background:" +
                tonePair(g.free ? "success" : "warning").bg + ";color:" + tonePair(g.free ? "success" : "warning").fg,
            )}
          >
            {g.free
              ? pk({ tr: "bu hafta uygun", en: "free this week", ru: "свободен", ar: "متاح" }, lang)
              : pk({ tr: "bu hafta dolu", en: "booked", ru: "занят", ar: "محجوز" }, lang)}
          </span>
        </div>
      </div>
      <div style={sx("margin-top:12px")}>
        <Button
          variant="outline"
          color="primary"
          size="sm"
          disabled={!g.free}
          onClick={() => toast(pk({ tr: "Rehbere talebiniz iletildi", en: "Your request reached the guide", ru: "Заявка отправлена гиду", ar: "وصل طلبك إلى المرشد" }, lang))}
        >
          {pk({ tr: "Talep gönder", en: "Send a request", ru: "Отправить заявку", ar: "أرسل طلبًا" }, lang)}
        </Button>
      </div>
    </article>
  );

  return (
    <>
      <ToolHead
        title={pk({ tr: "Rehber tut", en: "Hire a guide", ru: "Нанять гида", ar: "استأجر مرشدًا" }, lang)}
        sub={pk({
          tr: "Çarşıyı bilen biriyle gezmek, pazarlıkta da yol bulmakta da fark yaratır.",
          en: "Walking the bazaar with someone who knows it changes both the haggling and the wayfinding.",
          ru: "С тем, кто знает базар, и торг, и дорога проще.",
          ar: "التجول مع من يعرف السوق يغيّر الفصال والاتجاه معًا.",
        }, lang)}
      />

      {/* Commission honesty: saying plainly that we take none, and telling the
          buyer to check the guide takes none either. */}
      <Alert color="primary" variant="light" title={pk({ tr: "Ücret rehbere ödenir", en: "The fee goes to the guide", ru: "Оплата — гиду", ar: "الأجر للمرشد" }, lang)}>
        {pk({
          tr: "HAN komisyon almaz. Rehberden de dükkândan komisyon almadığını teyit etmesini isteyin — aldığı yerde sizi oraya götürür.",
          en: "HAN takes no commission. Ask the guide to confirm they take none from the shops either — where they do, that is where they take you.",
          ru: "HAN не берёт комиссию. Попросите гида подтвердить, что он тоже не берёт её с лавок.",
          ar: "لا تأخذ HAN عمولة. اطلب من المرشد تأكيد أنه لا يأخذ عمولة من المتاجر.",
        }, lang)}
      </Alert>

      {mine.length > 0 && (
        <section style={sx("margin-top:18px")}>
          <div style={sx(KICKER)}>{pk({ tr: "Sizin dilinizde", en: "In your language", ru: "На вашем языке", ar: "بلغتك" }, lang)}</div>
          <div style={sx("display:flex;flex-direction:column;gap:12px;margin-top:10px")}>{mine.map(card)}</div>
        </section>
      )}
      {others.length > 0 && (
        <section style={sx("margin-top:22px")}>
          <div style={sx(KICKER)}>{pk({ tr: "Başka dillerde", en: "In other languages", ru: "На других языках", ar: "بلغات أخرى" }, lang)}</div>
          <div style={sx("display:flex;flex-direction:column;gap:12px;margin-top:10px")}>{others.map(card)}</div>
        </section>
      )}
    </>
  );
}

// ── tax free ──────────────────────────────────────────────────────────────

function TaxFree({ lang }: { lang: Lang }) {
  const CU = D.CU;
  const [spend, setSpend] = useState("5000");
  const value = Number(String(spend).replace(/[^\d.]/g, "")) || 0;
  // Turkish VAT on most retail goods is 20%; the refund is net of the operator's
  // cut, so we show a realistic figure rather than the headline one.
  const vat = value - value / 1.2;
  const refund = vat * 0.75;

  const steps = [1, 2, 3, 4].map((n) => ({
    title: tx(CU["taxStep" + n], lang),
    body: tx(CU["taxStep" + n + "b"], lang),
  })).filter((s) => s.title);

  return (
    <>
      <ToolHead title={tx(CU.taxTitle, lang)} sub={tx(CU.taxSub, lang)} />

      <section style={sx(CARD)}>
        <Input
          label={pk({ tr: "Harcadığınız tutar (₺)", en: "What you spent (₺)", ru: "Потраченная сумма (₺)", ar: "المبلغ المنفق (₺)" }, lang)}
          inputMode="decimal"
          value={spend}
          onChange={(e) => setSpend(e.target.value)}
        />
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr));gap:1px;background:var(--border-default);border:1px solid var(--border-default);border-radius:11px;overflow:hidden;margin-top:14px")}>
          <div style={sx("background:var(--surface-card);padding:14px 15px")}>
            <div style={sx("font-size:11.5px;color:var(--text-muted)")}>{pk({ tr: "İçindeki KDV", en: "VAT included", ru: "НДС в сумме", ar: "الضريبة المتضمنة" }, lang)}</div>
            <div style={sx("font-size:20px;font-weight:700;color:var(--text-heading);margin-top:3px")}>₺{num(Math.round(vat), lang)}</div>
          </div>
          <div style={sx("background:var(--surface-card);padding:14px 15px")}>
            <div style={sx("font-size:11.5px;color:var(--text-muted)")}>{pk({ tr: "Elinize geçecek (yaklaşık)", en: "You get back (approx.)", ru: "Вернётся (примерно)", ar: "ما ستستردّه (تقريبًا)" }, lang)}</div>
            <div style={sx("font-size:20px;font-weight:700;color:var(--color-success);margin-top:3px")}>₺{num(Math.round(refund), lang)}</div>
          </div>
        </div>
        <p style={sx("font-size:12.5px;color:var(--text-muted);margin-top:10px;text-wrap:pretty")}>
          {pk({
            tr: "İade tutarı operatör komisyonu düşülerek hesaplandı. Gerçek tutar mağazanın çalıştığı operatöre göre değişir.",
            en: "The refund is shown net of the operator's commission. The real figure depends on which operator the shop works with.",
            ru: "Возврат показан за вычетом комиссии оператора.",
            ar: "يُعرض الاسترداد بعد خصم عمولة المشغّل.",
          }, lang)}
        </p>
      </section>

      {steps.length > 0 && (
        <section style={sx("margin-top:18px")}>
          <div style={sx(KICKER)}>{pk({ tr: "Adım adım", en: "Step by step", ru: "Шаг за шагом", ar: "خطوة بخطوة" }, lang)}</div>
          <div style={sx("display:flex;flex-direction:column;gap:12px;margin-top:12px")}>
            {steps.map((s, i) => (
              <div key={i} style={sx("display:flex;gap:12px")}>
                <span style={sx("flex:none;width:28px;height:28px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:var(--color-primary);color:#fff")}>
                  {i + 1}
                </span>
                <div style={sx("flex:1;min-width:0")}>
                  <div style={sx("font-size:15px;font-weight:700;color:var(--text-heading)")}>{s.title}</div>
                  {s.body && <p style={sx("font-size:13.5px;color:var(--text-body);margin-top:3px;text-wrap:pretty")}>{s.body}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ── freight ───────────────────────────────────────────────────────────────

function Freight({ lang }: { lang: Lang }) {
  const [boxes, setBoxes] = useState("4");
  const [weight, setWeight] = useState("18");
  const [region, setRegion] = useState("eu");
  const [modeKey, setModeKey] = useState<"express" | "road" | "sea">("express");

  const n = Number(boxes) || 1;
  const kg = Number(weight) || 1;
  const band = ((D.FREIGHT as Record<string, Record<string, number[] | Record<string, string>>>)[modeKey] || {})[region] as number[] | undefined;
  const days = ((D.FREIGHT as Record<string, Record<string, unknown>>)[modeKey] || {}).days as Record<string, string> | undefined;
  const total = band && band[0] ? [Math.round(band[0] * kg * n / 10), Math.round(band[1] * kg * n / 10)] : null;

  const regions: [string, string][] = [
    ["eu", pk({ tr: "Avrupa", en: "Europe", ru: "Европа", ar: "أوروبا" }, lang)],
    ["near", pk({ tr: "Yakın çevre", en: "Neighbouring", ru: "Соседние", ar: "الجوار" }, lang)],
    ["gulf", pk({ tr: "Körfez", en: "Gulf", ru: "Залив", ar: "الخليج" }, lang)],
    ["far", pk({ tr: "Uzak Doğu · Amerika", en: "Far East · Americas", ru: "Дальний Восток · Америка", ar: "الشرق الأقصى · الأمريكتان" }, lang)],
  ];
  const modes: [typeof modeKey, string][] = [
    ["express", pk({ tr: "Hava · ekspres", en: "Air · express", ru: "Авиа · экспресс", ar: "جوي · سريع" }, lang)],
    ["road", pk({ tr: "Karayolu", en: "Road", ru: "Автотранспорт", ar: "بري" }, lang)],
    ["sea", pk({ tr: "Deniz · konteyner", en: "Sea · container", ru: "Море · контейнер", ar: "بحري · حاوية" }, lang)],
  ];

  const points = (D.POIS || []).filter((p) => ["kargo", "emanet"].includes(p.kind as string));

  return (
    <>
      <ToolHead
        title={pk({ tr: "Nakliye ve gönderim", en: "Shipping & freight", ru: "Доставка и фрахт", ar: "الشحن والنقل" }, lang)}
        sub={pk({
          tr: "Aldıklarınızı kendiniz taşımak zorunda değilsiniz. Kaba bir maliyet ve çarşıdaki kargo noktaları.",
          en: "You do not have to carry it yourself. A rough cost, and the cargo points inside the bazaar.",
          ru: "Не обязательно везти самому. Примерная стоимость и точки карго.",
          ar: "لست مضطرًا لحملها بنفسك. تكلفة تقريبية ونقاط الشحن.",
        }, lang)}
      />

      <section style={sx(CARD)}>
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr));gap:14px")}>
          <Input label={pk({ tr: "Koli sayısı", en: "Boxes", ru: "Коробок", ar: "عدد الطرود" }, lang)} inputMode="numeric" value={boxes} onChange={(e) => setBoxes(e.target.value)} />
          <Input label={pk({ tr: "Koli başı kg", en: "Kg per box", ru: "Кг на коробку", ar: "كجم للطرد" }, lang)} inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} />
          <Select label={pk({ tr: "Nereye", en: "Destination", ru: "Куда", ar: "الوجهة" }, lang)} value={region} onChange={(e) => setRegion(e.target.value)}>
            {regions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </Select>
          <Select label={pk({ tr: "Yöntem", en: "Method", ru: "Способ", ar: "الطريقة" }, lang)} value={modeKey} onChange={(e) => setModeKey(e.target.value as typeof modeKey)}>
            {modes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </Select>
        </div>

        <div style={sx("margin-top:16px;padding:16px 18px;border-radius:12px;background:var(--color-primary-soft)")}>
          {total ? (
            <>
              <div style={sx("font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--color-primary-accent)")}>
                {pk({ tr: "Yaklaşık navlun", en: "Approximate freight", ru: "Примерный фрахт", ar: "الشحن التقريبي" }, lang)}
              </div>
              <div style={sx("font-size:24px;font-weight:700;color:var(--color-primary-accent);letter-spacing:-.02em;margin-top:4px")}>
                ${num(total[0], lang)} – ${num(total[1], lang)}
              </div>
              {days && <div style={sx("font-size:13px;color:var(--color-primary-accent);opacity:.8;margin-top:3px")}>{tx(days, lang)}</div>}
            </>
          ) : (
            <div style={sx("font-size:14px;color:var(--color-primary-accent)")}>
              {pk({
                tr: "Bu yöntem bu bölgeye çalışmıyor — başka bir yöntem seçin.",
                en: "This method does not serve that region — pick another.",
                ru: "Этот способ не обслуживает регион.",
                ar: "هذه الطريقة لا تخدم تلك المنطقة.",
              }, lang)}
            </div>
          )}
        </div>
        <p style={sx("font-size:12.5px;color:var(--text-muted);margin-top:10px;text-wrap:pretty")}>
          {pk({
            tr: "Bu bir tahmindir; gerçek fiyat hacme, gümrük evrağına ve taşıyıcıya göre değişir.",
            en: "This is an estimate; the real price depends on volume, customs paperwork and the carrier.",
            ru: "Это оценка; реальная цена зависит от объёма и перевозчика.",
            ar: "هذا تقدير؛ السعر الحقيقي يعتمد على الحجم والناقل.",
          }, lang)}
        </p>
      </section>

      {points.length > 0 && (
        <section style={sx("margin-top:18px")}>
          <div style={sx(KICKER)}>{pk({ tr: "Çarşıdaki kargo ve emanet noktaları", en: "Cargo and storage points in the bazaar", ru: "Точки карго и хранения", ar: "نقاط الشحن والأمانات" }, lang)}</div>
          <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr));gap:12px;margin-top:12px")}>
            {points.map((p) => (
              <div key={p.id as string} style={sx(CARD)}>
                <div style={sx("font-size:15px;font-weight:700;color:var(--text-heading)")}>{tx(p, lang)}</div>
                <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:3px")}>{p.hours as string}</div>
                <p style={sx("font-size:13px;color:var(--text-body);margin-top:6px;text-wrap:pretty")}>
                  {(p["note" + lang.charAt(0).toUpperCase() + lang.slice(1)] as string) || (p.noteTr as string)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ── nearby ────────────────────────────────────────────────────────────────

function Nearby({ lang }: { lang: Lang }) {
  const [kind, setKind] = useState("all");
  const kinds = D.POI_KINDS || [];
  const rows = (D.POIS || []).filter((p) => kind === "all" || p.kind === kind);

  return (
    <>
      <ToolHead
        title={pk({ tr: "Yakınımda", en: "Near me", ru: "Рядом", ar: "بالقرب مني" }, lang)}
        sub={pk({
          tr: "Kargo, döviz, emanet, tuvalet, eczane — çarşıda lazım olan pratik noktalar. Hepsi çevrimdışı çalışır.",
          en: "Cargo, exchange, storage, toilets, pharmacy — the practical points you need inside the bazaar. All work offline.",
          ru: "Карго, обмен, хранение, туалеты, аптека — всё работает офлайн.",
          ar: "شحن وصرافة وأمانات ودورات مياه وصيدلية — تعمل جميعها دون اتصال.",
        }, lang)}
      />

      <div style={sx("display:flex;gap:7px;flex-wrap:wrap")}>
        {([["all", F(lang, "all")] as [string, string]].concat(kinds.map((k) => [k.id as string, tx(k, lang)] as [string, string]))).map(([id, label]) => {
          const on = kind === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              aria-pressed={on}
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

      {rows.length === 0 ? (
        <div style={sx("margin-top:18px")}>
          <EmptyState icon="abstract" tone="neutral" title={F(lang, "poiEmpty")} />
        </div>
      ) : (
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr));gap:12px;margin-top:16px")}>
          {rows.map((p) => {
            const def = kinds.find((k) => k.id === p.kind);
            const st = D.STREETS.find((s) => s.id === p.street);
            return (
              <div key={p.id as string} style={sx(CARD)}>
                <div style={sx("display:flex;align-items:center;gap:10px")}>
                  <span style={sx(medStyle((def?.tone as string) || "primary", 34))}>
                    <Icon name={(def?.icon as string) || "abstract"} size={16} />
                  </span>
                  <div style={sx("flex:1;min-width:0")}>
                    <div style={sx("font-size:14.5px;font-weight:700;color:var(--text-heading)")}>{tx(p, lang)}</div>
                    <div style={sx("font-size:12px;color:var(--text-muted);margin-top:2px")}>
                      {[st ? tx(st, lang) : "", p.hours as string].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
                <p style={sx("font-size:13px;color:var(--text-body);margin-top:9px;text-wrap:pretty")}>
                  {(p["note" + lang.charAt(0).toUpperCase() + lang.slice(1)] as string) || (p.noteTr as string) || ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── etiquette ─────────────────────────────────────────────────────────────

function Culture({ lang }: { lang: Lang }) {
  return (
    <>
      <ToolHead
        title={pk({ tr: "Çarşı görgüsü", en: "Bazaar etiquette", ru: "Этикет базара", ar: "آداب السوق" }, lang)}
        sub={pk({
          tr: "Pazarlık bir tartışma değil, bir usul. Bilirseniz hem daha ucuza alırsınız hem de kimseyi kırmazsınız.",
          en: "Haggling is a procedure, not an argument. Knowing it gets you a better price without offending anyone.",
          ru: "Торг — это процедура, а не спор.",
          ar: "الفصال إجراء لا جدال.",
        }, lang)}
      />
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:12px")}>
        {(D.CULTURE || []).map((c, i) => (
          <div key={i} style={sx(CARD)}>
            <div style={sx("display:flex;align-items:center;gap:10px")}>
              <span style={sx(medStyle((c.tone as string) || "primary", 34))}>
                <Icon name={(c.icon as string) || "shield-search"} size={16} />
              </span>
              <div style={sx("font-size:15px;font-weight:700;color:var(--text-heading);text-wrap:pretty")}>{tx(c, lang)}</div>
            </div>
            <p style={sx("font-size:13.5px;color:var(--text-body);margin-top:9px;line-height:1.55;text-wrap:pretty")}>
              {(c["body" + lang.charAt(0).toUpperCase() + lang.slice(1)] as string) || (c.bodyTr as string)}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

// ── emergency ─────────────────────────────────────────────────────────────

function Emergency({ lang }: { lang: Lang }) {
  return (
    <>
      <ToolHead
        title={pk({ tr: "Acil durum", en: "Emergency", ru: "Экстренная помощь", ar: "الطوارئ" }, lang)}
        sub={pk({
          tr: "Numaralar aranabilir. Bu sayfa çevrimdışı da açılır.",
          en: "The numbers dial. This page opens offline too.",
          ru: "Номера кликабельны. Страница работает офлайн.",
          ar: "الأرقام قابلة للاتصال. تعمل الصفحة دون اتصال.",
        }, lang)}
      />
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr));gap:12px")}>
        {(D.EMERGENCY || []).map((e, i) => (
          <a
            key={i}
            href={"tel:" + String(e.tel || "").replace(/\s/g, "")}
            style={sx("display:block;text-decoration:none;" + CARD)}
          >
            <div style={sx("display:flex;align-items:center;gap:10px")}>
              <span style={sx(medStyle((e.tone as string) || "danger", 34))}>
                <Icon name={(e.icon as string) || "cross-circle"} size={16} />
              </span>
              <div style={sx("flex:1;min-width:0")}>
                <div style={sx("font-size:14.5px;font-weight:700;color:var(--text-heading)")}>{tx(e, lang)}</div>
                <div style={sx("font-size:19px;font-weight:700;color:var(--color-danger);margin-top:2px;letter-spacing:-.01em")}>{e.tel as string}</div>
              </div>
            </div>
            {(e.noteTr as string) && (
              <p style={sx("font-size:12.5px;color:var(--text-muted);margin-top:8px;text-wrap:pretty")}>
                {(e["note" + lang.charAt(0).toUpperCase() + lang.slice(1)] as string) || (e.noteTr as string)}
              </p>
            )}
          </a>
        ))}
      </div>
    </>
  );
}

// ── report a problem ──────────────────────────────────────────────────────

function ReportProblem({ lang }: { lang: Lang }) {
  const { state, save, toast } = useApp();
  const sp = useSearchParams();
  const preset = sp.get("kayit") || "";
  const [recordId, setRecordId] = useState(preset);
  const [reason, setReason] = useState("burada-degil");
  const [detail, setDetail] = useState("");

  const reasons: [string, string][] = [
    ["burada-degil", pk({ tr: "Burada değil / taşınmış", en: "Not here / moved", ru: "Не здесь / переехал", ar: "ليس هنا / انتقل" }, lang)],
    ["kapali", pk({ tr: "Kalıcı olarak kapanmış", en: "Permanently closed", ru: "Закрыт навсегда", ar: "مغلق نهائيًا" }, lang)],
    ["bilgi", pk({ tr: "Bilgiler yanlış", en: "The details are wrong", ru: "Данные неверны", ar: "البيانات خاطئة" }, lang)],
    ["fiyat", pk({ tr: "Fiyat çok farklı", en: "The price is very different", ru: "Цена сильно отличается", ar: "السعر مختلف كثيرًا" }, lang)],
  ];

  const submit = () => {
    if (!recordId.trim()) {
      return toast(pk({ tr: "Hangi kayıt olduğunu yazın", en: "Say which record", ru: "Укажите запись", ar: "حدّد السجل" }, lang));
    }
    const report = { recordId: recordId.trim(), reason, detail: detail.trim(), at: Date.now() };
    const next = (state.reports || []).concat([report]);
    save({ reports: next });
    // U6 · reports must survive a reload: a threshold that resets never fills.
    // Three of them suspend the record and put it in the officer's queue.
    const counts: Record<string, number> = {};
    next.forEach((r) => { counts[r.recordId] = (counts[r.recordId] || 0) + 1; });
    SC.applyReports(counts);
    setDetail("");
    toast(pk({
      tr: "Bildiriminiz yetkiliye iletildi",
      en: "Your report reached the officer's queue",
      ru: "Ваше сообщение отправлено",
      ar: "وصل بلاغك إلى المسؤول",
    }, lang));
  };

  const mine = (state.reports || []).slice().reverse();

  return (
    <>
      <ToolHead
        title={pk({ tr: "Sorun bildir", en: "Report a problem", ru: "Сообщить о проблеме", ar: "أبلغ عن مشكلة" }, lang)}
        sub={pk({
          tr: "Yanlış bir kayıt gördüyseniz söyleyin. Aynı kayıt için üç bildirim geldiğinde kayıt askıya alınır ve yetkili kuyruğuna düşer.",
          en: "If a record is wrong, say so. Three reports on the same record suspend it and move it into the officer's queue.",
          ru: "Если запись неверна — сообщите. Три сообщения приостановят её.",
          ar: "إن كان السجل خاطئًا فأبلغنا. ثلاثة بلاغات توقف السجل.",
        }, lang)}
      />

      <section style={sx(CARD)}>
        <Input
          label={pk({ tr: "Kayıt", en: "Record", ru: "Запись", ar: "السجل" }, lang)}
          placeholder={pk({ tr: "Kayıt kimliği ya da dükkân adı", en: "Record id or shop name", ru: "ID записи или название", ar: "معرّف السجل أو اسم المتجر" }, lang)}
          value={recordId}
          onChange={(e) => setRecordId(e.target.value)}
        />
        <div style={sx("margin-top:14px")}>
          <Select label={pk({ tr: "Konu", en: "Subject", ru: "Тема", ar: "الموضوع" }, lang)} value={reason} onChange={(e) => setReason(e.target.value)}>
            {reasons.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </Select>
        </div>
        <div style={sx("margin-top:14px")}>
          <Textarea
            label={pk({ tr: "Ayrıntı", en: "Details", ru: "Подробности", ar: "التفاصيل" }, lang)}
            rows={3}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={pk({ tr: "Ne gördünüz?", en: "What did you see?", ru: "Что вы увидели?", ar: "ماذا رأيت؟" }, lang)}
          />
        </div>
        <div style={sx("margin-top:16px")}>
          <Button color="accent" size="md" onClick={submit}>
            {pk({ tr: "Bildir", en: "Report", ru: "Отправить", ar: "أبلغ" }, lang)}
          </Button>
        </div>
      </section>

      {mine.length > 0 && (
        <section style={sx("margin-top:18px")}>
          <div style={sx(KICKER)}>{pk({ tr: "Bildirimlerim", en: "My reports", ru: "Мои сообщения", ar: "بلاغاتي" }, lang)}</div>
          <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:10px")}>
            {mine.map((r, i) => (
              <div key={i} style={sx("display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:10px;border:1px solid var(--border-default);background:var(--surface-card)")}>
                <span style={sx("flex:1;min-width:0")}>
                  <span style={sx("display:block;font-size:13.5px;font-weight:700;color:var(--text-heading)")}>{r.recordId}</span>
                  <span style={sx("display:block;font-size:12px;color:var(--text-muted);margin-top:2px")}>
                    {(reasons.find(([id]) => id === r.reason) || ["", r.reason])[1]}
                  </span>
                </span>
                <span style={sx("flex:none;font-size:12px;color:var(--text-muted)")}>
                  {new Date(r.at).toLocaleDateString(lang === "tr" ? "tr-TR" : lang)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
