"use client";

// W3 · the shop page.
//
// A shop is a full page with its own address, not a narrow panel. It has to
// answer the four questions a buyer actually arrives with:
//
//   Is it open?              → the trader's own hours beat the place default
//   Am I being overcharged?  → where this price sits against the going rate
//   Can I physically get in?  → lift, handcart, parking, how many flights
//   Can I trust this?         → every field labelled with where it came from
//
// One template, two data sources (see lib/shopView.ts).

import { useParams, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import * as D from "@/data/han-data";
import * as OF from "@/data/han-offers";
import * as SC from "@/data/han-scale";
import type { Lang } from "@/data/types";
import { Badge, Button, EmptyState, Icon, Textarea } from "@/ds";
import { ImageSlot } from "@/components/ImageSlot";
import { F, W } from "@/lib/copy";
import { convert, localeOf, money, num, tonePair, tx } from "@/lib/i18n";
import { href } from "@/lib/routes";
import { medStyle } from "@/lib/shop";
import { photoHonesty, resolveShop, similarShops, srcLabel, trustRows } from "@/lib/shopView";
import { sx } from "@/lib/sx";
import { useApp } from "@/state/AppState";
import type { Outcome } from "@/state/types";

const pk = (o: Record<string, string>, lang: Lang) => o[lang] || o.tr;

const CARD =
  "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:18px 20px;box-shadow:0 3px 4px rgba(0,0,0,.03)";
const KICKER = "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)";

const TABS = ["urun", "guven", "konum", "reviews"] as const;
type Tab = (typeof TABS)[number];

export default function ShopPage() {
  const { state, save, set, toast } = useApp();
  const router = useRouter();
  const params = useParams<{ id: string; tab?: string[] }>();
  const { lang, mode, currency } = state;

  const id = decodeURIComponent(String(params.id || ""));
  const tab = ((params.tab?.[0] || "urun") as Tab);
  const [reviewText, setReviewText] = useState("");
  const [stars, setStars] = useState(5);

  const view = useMemo(() => resolveShop(id, lang, mode), [id, lang, mode]);
  const similar = useMemo(() => (view ? similarShops(view) : []), [view]);

  // K3 · only a buyer who ACCEPTED an offer from this shop may write a review.
  // The most effective antidote there is to fake reviews.
  const canReview = useMemo(() => {
    const accepted = state.acceptedOffers || {};
    return Object.keys(accepted).some((k) => {
      const a = accepted[k];
      return (a && typeof a === "object" ? a.recordId : a) === (view?.rec.id ?? id);
    });
  }, [state.acceptedOffers, view?.rec.id, id]);

  const reviews = useMemo(
    () => (view ? OF.reviewsOf(view.rec.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view?.rec.id, state.offersRev],
  );

  const submitReview = useCallback(() => {
    if (!view) return;
    const text = reviewText.trim();
    if (text.length < 10) {
      return toast(pk({
        tr: "Birkaç cümle yazın — boş yorum kimseye yardım etmez",
        en: "Write a couple of sentences — an empty review helps nobody",
        ru: "Напишите несколько предложений",
        ar: "اكتب جملتين على الأقل",
      }, lang));
    }
    OF.putReview(view.rec.id, { stars, text, by: state.user?.name || state.buyer.firm || "" });
    setReviewText("");
    setStars(5);
    set({ offersRev: state.offersRev + 1 });
    toast(pk({ tr: "Yorumunuz yayınlandı", en: "Your review is live", ru: "Отзыв опубликован", ar: "نُشر تقييمك" }, lang));
  }, [view, reviewText, stars, state.user, state.buyer.firm, state.offersRev, set, toast, lang]);

  if (!view) {
    return (
      <div style={sx("max-width:1480px;margin:0 auto;padding:26px 24px 48px")}>
        <EmptyState
          icon="magnifier"
          tone="neutral"
          title={pk({ tr: "Bu kayıt bulunamadı", en: "Record not found", ru: "Запись не найдена", ar: "لم يُعثر على السجل" }, lang)}
          description={pk({
            tr: "Bağlantı eski olabilir ya da kayıt askıya alınmış olabilir.",
            en: "The link may be old, or the record may have been suspended.",
            ru: "Ссылка устарела или запись приостановлена.",
            ar: "قد يكون الرابط قديمًا أو السجل موقوفًا.",
          }, lang)}
          actions={<Button color="primary" onClick={() => router.push(href.search())}>{W(lang, "search")}</Button>}
        />
      </div>
    );
  }

  const cv = (n: number | null) => convert(n, lang, currency);
  const isSaved = state.saved.includes(view.id);
  const tone = tonePair(view.statusTone);
  const fmtDate = (ts?: number) => (ts ? new Date(ts).toLocaleDateString(localeOf(lang)) : "");

  const tabLabels: Record<Tab, string> = {
    urun: W(lang, "products"),
    guven: pk({ tr: "Güven dosyası", en: "Trust file", ru: "Досье доверия", ar: "ملف الثقة" }, lang),
    konum: pk({ tr: "Konum ve erişim", en: "Location & access", ru: "Расположение", ar: "الموقع والوصول" }, lang),
    reviews: W(lang, "reviewsTitle"),
  };

  return (
    <div style={sx("max-width:1480px;margin:0 auto;padding:18px 24px 56px")}>
      {/* ── breadcrumb ─────────────────────────────────────────────────── */}
      <div style={sx("display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;color:var(--text-muted)")}>
        <button
          type="button"
          onClick={() => router.push(href.search())}
          style={sx("display:inline-flex;align-items:center;gap:6px;background:none;border:none;padding:0;font-family:inherit;font-size:13px;font-weight:700;color:var(--color-primary);cursor:pointer")}
        >
          <Icon name={lang === "ar" ? "chevron-right" : "chevron-left"} size={15} />
          {W(lang, "secSearch")}
        </button>
        {[view.place?.name, view.catName].filter(Boolean).map((c) => (
          <span key={c as string} style={sx("display:inline-flex;align-items:center;gap:10px")}>
            <span style={sx("color:var(--border-strong)")}>/</span>
            <span style={sx("color:var(--text-muted)")}>{c}</span>
          </span>
        ))}
      </div>

      {/* ── header ─────────────────────────────────────────────────────── */}
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr));gap:24px;margin-top:16px;align-items:start")}>
        <div>
          <div style={sx("border-radius:16px;overflow:hidden;border:1px solid var(--border-strong);background:var(--surface-muted);height:352px")}>
            <ImageSlot src={view.photos[0]} placeholder={view.name} decorative />
          </div>
          {/* C3 · photo honesty. Saying whose photo this is costs nothing and
              is the difference between a directory and a catalogue of stock
              images. */}
          <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:8px;text-wrap:pretty")}>
            {photoHonesty(view, lang)}
          </div>
        </div>

        <div>
          <div style={sx("display:flex;align-items:center;gap:9px;flex-wrap:wrap")}>
            <span style={sx("display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:6px;font-size:12px;font-weight:700;background:" + tone.bg + ";color:" + tone.fg)}>
              <Icon name="verify" size={14} />
              {view.actionLabel}
            </span>
            <span
              style={sx(
                "display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:6px;font-size:12px;font-weight:700;background:var(--color-" +
                  (view.now.open ? "success" : "danger") + "-soft);color:var(--color-" + (view.now.open ? "success" : "danger") + ")",
              )}
            >
              {view.now.title}
            </span>
          </div>

          <h1 style={sx("font-size:30px;font-weight:700;color:var(--text-heading);letter-spacing:-.025em;margin:12px 0 0;line-height:1.15;text-wrap:pretty")}>
            {view.name}
          </h1>

          <div style={sx("display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:9px")}>
            {view.rating != null && (
              <span style={sx("display:inline-flex;align-items:center;gap:5px;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>
                <span style={sx("color:var(--color-warning);display:flex")}>
                  <Icon name="star" size={16} />
                </span>
                {view.rating.toFixed(1)}
                <span style={sx("font-weight:500;color:var(--text-muted)")}>({view.reviews})</span>
              </span>
            )}
            <span style={sx("font-size:14px;color:var(--text-muted)")}>{view.where}</span>
          </div>

          {/* ── right now ────────────────────────────────────────────── */}
          <div
            style={sx(
              "background:var(--surface-card);border:1px solid var(--color-" + (view.now.open ? "success" : "danger") +
                ");border-radius:14px;padding:16px 18px;margin-top:16px",
            )}
          >
            <div style={sx(KICKER)}>{pk({ tr: "Şu an", en: "Right now", ru: "Сейчас", ar: "الآن" }, lang)}</div>
            <div style={sx("font-size:17px;font-weight:700;letter-spacing:-.01em;margin-top:5px;color:var(--color-" + (view.now.open ? "success" : "danger") + ")")}>
              {view.now.title}
            </div>
            <div style={sx("font-size:13.5px;color:var(--text-body);margin-top:4px;text-wrap:pretty")}>{view.now.body}</div>
          </div>

          {/* ── ready-made questions ─────────────────────────────────── */}
          {view.asks.length > 0 && (
            <div style={sx(CARD + ";margin-top:14px")}>
              <div style={sx("font-size:15.5px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>
                {pk({ tr: "Hazır soru gönder", en: "Send a ready question", ru: "Отправить готовый вопрос", ar: "أرسل سؤالًا جاهزًا" }, lang)}
              </div>
              <div style={sx("font-size:13px;color:var(--text-muted);margin-top:4px;text-wrap:pretty")}>
                {pk({
                  tr: "Soruyu kendi dilinizde seçin — esnafa Türkçe gider, yanıtı size çevrilir.",
                  en: "Pick the question in your language — it reaches the trader in Turkish and the reply comes back translated.",
                  ru: "Выберите вопрос на своём языке — торговцу он придёт по-турецки.",
                  ar: "اختر السؤال بلغتك — يصل التاجر بالتركية.",
                }, lang)}
              </div>
              <div style={sx("display:flex;flex-wrap:wrap;gap:8px;margin-top:12px")}>
                {view.asks.map((a) => (
                  <a
                    key={a.label}
                    href={"https://wa.me/" + view.tel + "?text=" + encodeURIComponent(a.turkish + " (" + view.name + " · " + view.where + ")")}
                    target="_blank"
                    rel="noopener noreferrer"
                    // D3 · a question that leaves for WhatsApp still leaves an
                    // "I asked" record under My Work, or the trail is lost.
                    onClick={() =>
                      save({
                        askLog: (state.askLog || []).concat([{ recordId: view.rec.id, text: a.turkish, at: Date.now() }]),
                      })
                    }
                    style={sx("display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:999px;text-decoration:none;font-size:13.5px;font-weight:600;border:1px solid var(--border-strong);background:var(--surface-card);color:var(--text-body)")}
                  >
                    {a.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── actions ──────────────────────────────────────────────── */}
          <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:14px")}>
            <Button
              color="accent"
              size="lg"
              fullWidth
              onClick={() => {
                save({
                  buyList: (state.buyList || []).concat([{ id: "b" + Date.now(), name: view.name, qty: "1", target: "" }]),
                });
                toast(W(lang, "addPlan"));
              }}
            >
              {W(lang, "addPlan")}
            </Button>
            <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
              <Button
                variant="outline"
                color="dark"
                size="md"
                style={{ flex: 1 }}
                onClick={() => {
                  const had = state.saved.includes(view.id);
                  save({ saved: had ? state.saved.filter((x) => x !== view.id) : state.saved.concat(view.id) });
                  toast(had ? W(lang, "removedHint") : W(lang, "saveHint"));
                }}
              >
                {isSaved ? W(lang, "unsave") : W(lang, "save")}
              </Button>
              {view.store && (
                <Button
                  variant="outline"
                  color="primary"
                  size="md"
                  style={{ flex: 1 }}
                  onClick={() => router.push("/ara?p=route:" + encodeURIComponent(view.id))}
                >
                  {W(lang, "directions")}
                </Button>
              )}
            </div>
            {view.tel && (
              <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
                <a
                  href={"https://wa.me/" + view.tel}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={sx("flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;height:40px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;border:1px solid var(--color-success);background:var(--color-success-soft);color:var(--color-success)")}
                >
                  <Icon name="messages" size={16} />
                  WhatsApp
                </a>
                <a
                  href={"tel:+" + view.tel}
                  style={sx("flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;height:40px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;border:1px solid var(--color-primary);background:var(--color-primary-soft);color:var(--color-primary-accent)")}
                >
                  <Icon name="message-notif" size={16} />
                  {pk({ tr: "Ara", en: "Call", ru: "Позвонить", ar: "اتصل" }, lang)}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── tabs ───────────────────────────────────────────────────────── */}
      <nav
        style={sx("display:flex;gap:6px;margin-top:28px;border-bottom:1px solid var(--border-default);padding-bottom:2px;overflow-x:auto")}
        data-han-nav="1"
        role="tablist"
      >
        {TABS.map((t) => {
          const on = t === tab;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => router.push(href.store(view.id, t))}
              style={sx(
                "flex:none;height:40px;padding:0 16px;border:none;border-bottom:2px solid " +
                  (on ? "var(--color-primary)" : "transparent") +
                  ";background:none;font-family:inherit;font-size:14.5px;font-weight:" + (on ? "700" : "500") +
                  ";color:" + (on ? "var(--color-primary-accent)" : "var(--text-muted)") + ";cursor:pointer;white-space:nowrap",
              )}
            >
              {tabLabels[t]}
            </button>
          );
        })}
      </nav>

      <div style={sx("margin-top:20px")}>
        {tab === "urun" && <ProductsTab view={view} lang={lang} mode={mode} cv={cv} />}
        {tab === "guven" && <TrustTab view={view} lang={lang} />}
        {tab === "konum" && <LocationTab view={view} lang={lang} onReport={() => router.push("/arac/sorun?kayit=" + encodeURIComponent(view.rec.id))} />}
        {tab === "reviews" && (
          <ReviewsTab
            lang={lang}
            canReview={canReview}
            reviews={reviews}
            stars={stars}
            setStars={setStars}
            text={reviewText}
            setText={setReviewText}
            onSubmit={submitReview}
            outcome={(state.outcomes || {})[view.rec.id]}
            onOutcome={(o) => {
              save({ outcomes: { ...state.outcomes, [view.rec.id]: o } });
              toast(pk({ tr: "Yanıtınız esnafın güven metriğine işlendi", en: "Recorded against the trader's trust score", ru: "Учтено в рейтинге доверия", ar: "سُجّل في مؤشر الثقة" }, lang));
            }}
            fmtDate={fmtDate}
          />
        )}
      </div>

      {/* ── if nobody replies ──────────────────────────────────────────── */}
      {similar.length > 0 && (
        <section style={sx("margin-top:32px")}>
          <h2 style={sx("font-size:19px;font-weight:700;color:var(--text-heading);letter-spacing:-.015em")}>
            {pk({ tr: "Yanıt gelmezse", en: "If no one replies", ru: "Если нет ответа", ar: "إن لم يردّوا" }, lang)}
          </h2>
          <p style={sx("font-size:13.5px;color:var(--text-muted);margin-top:3px;text-wrap:pretty")}>
            {pk({
              tr: "Aynı işi yapan, kaydı açık dükkânlar.",
              en: "Shops doing the same work, with open records.",
              ru: "Лавки того же профиля с открытыми записями.",
              ar: "متاجر بالعمل نفسه ولها سجلات مفتوحة.",
            }, lang)}
          </p>
          <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr));gap:10px;margin-top:12px")}>
            {similar.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => router.push(href.store(r.curated || r.id))}
                style={sx("display:block;width:100%;text-align:start;font-family:inherit;cursor:pointer;background:var(--surface-card);border:1px solid var(--border-default);border-radius:12px;padding:14px 16px")}
              >
                <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>{r.name}</span>
                <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:3px")}>
                  {(SC.PLACES.find((p) => p.id === r.place) || { name: "" }).name}
                </span>
                <span style={sx("display:block;font-size:13px;font-weight:700;color:var(--color-primary);margin-top:5px")}>
                  {r.band ? money(r.band[0]) + "–" + money(r.band[1]) : "—"}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── tabs ──────────────────────────────────────────────────────────────────

function ProductsTab({
  view, lang, mode, cv,
}: { view: NonNullable<ReturnType<typeof resolveShop>>; lang: Lang; mode: string; cv: (n: number | null) => string }) {
  const hasProducts = view.products.length > 0;
  const hasGroups = view.groups.length > 0;

  return (
    <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:20px;align-items:start")}>
      <section style={sx(CARD)}>
        <div style={sx(KICKER)}>{W(lang, "products")}</div>
        {hasProducts ? (
          <div style={sx("display:flex;flex-direction:column;gap:1px;background:var(--border-default);border:1px solid var(--border-default);border-radius:11px;overflow:hidden;margin-top:10px")}>
            {view.products.map((p, i) => {
              const value = mode === "toptan" ? (p.wholesale ?? p.retail) : (p.retail ?? p.wholesale);
              return (
                <div key={i} style={sx("display:flex;align-items:center;gap:10px;background:var(--surface-card);padding:12px 14px")}>
                  <div style={sx("flex:1;min-width:0")}>
                    <div style={sx("font-size:14.5px;font-weight:600;color:var(--text-heading);text-wrap:pretty")}>{tx(p, lang)}</div>
                    {p.unit && <div style={sx("font-size:12px;color:var(--text-muted);margin-top:2px")}>{p.unit}</div>}
                  </div>
                  <div style={sx("flex:none;text-align:end")}>
                    <div style={sx("font-size:15px;font-weight:700;color:var(--color-primary)")}>{money(value ?? null)}</div>
                    <div style={sx("font-size:11.5px;color:var(--text-muted)")}>{cv(value ?? null)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : hasGroups ? (
          <>
            {/* A generated record has no itemised list; what it does have is
                its variety groups and a band. That is the honest amount. */}
            <p style={sx("font-size:13px;color:var(--text-muted);margin-top:6px;text-wrap:pretty")}>
              {pk({
                tr: "Bu kayıtta tek tek ürün listesi yok — çeşit grupları ve fiyat bandı var. Kesin fiyat için sorun.",
                en: "This record has no itemised list — it has variety groups and a price band. Ask for an exact price.",
                ru: "У записи нет постатейного списка — есть группы и диапазон цен.",
                ar: "لا قائمة مفصلة لهذا السجل — لديه مجموعات ونطاق سعر.",
              }, lang)}
            </p>
            <div style={sx("display:flex;flex-direction:column;gap:1px;background:var(--border-default);border:1px solid var(--border-default);border-radius:11px;overflow:hidden;margin-top:10px")}>
              {view.groups.map((g) => (
                <div key={g.name} style={sx("display:flex;align-items:center;gap:10px;background:var(--surface-card);padding:12px 14px")}>
                  <div style={sx("flex:1;min-width:0")}>
                    <div style={sx("font-size:14.5px;font-weight:600;color:var(--text-heading)")}>{SC.groupLabel(g.name, lang)}</div>
                    <div style={sx("font-size:12px;color:var(--text-muted);margin-top:2px")}>
                      {pk({ tr: num(g.lines, lang) + " çeşit", en: num(g.lines, lang) + " lines", ru: num(g.lines, lang) + " позиций", ar: num(g.lines, lang) + " صنفًا" }, lang)}
                    </div>
                  </div>
                  <div style={sx("flex:none;text-align:end")}>
                    <div style={sx("font-size:15px;font-weight:700;color:var(--color-primary)")}>
                      {g.lo ? money(g.lo) + "–" + money(g.hi) : "—"}
                    </div>
                    <div style={sx("font-size:11.5px;color:var(--text-muted)")}>{g.lo ? cv(g.lo) : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={sx("font-size:13.5px;color:var(--text-muted);margin-top:10px;text-wrap:pretty")}>
            {pk({
              tr: "Bu kayıtta henüz ürün bilgisi yok. Fiyat sormak için doğrudan yazabilirsiniz.",
              en: "No product information on this record yet. You can message the shop for a price.",
              ru: "Пока нет информации о товарах.",
              ar: "لا معلومات عن المنتجات بعد.",
            }, lang)}
          </p>
        )}
      </section>

      <section style={sx(CARD)}>
        <div style={sx(KICKER)}>{pk({ tr: "Fiyat güveni", en: "Price confidence", ru: "Доверие к цене", ar: "موثوقية السعر" }, lang)}</div>
        <div style={sx("font-size:17px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em;margin-top:6px")}>
          {view.price.verdict}
        </div>
        <p style={sx("font-size:13.5px;color:var(--text-body);margin-top:6px;text-wrap:pretty")}>{view.price.note}</p>

        {view.certs.length > 0 && (
          <div style={sx("margin-top:16px")}>
            <div style={sx(KICKER)}>{W(lang, "certs")}</div>
            <div style={sx("display:flex;flex-wrap:wrap;gap:6px;margin-top:8px")}>
              {view.certs.map((c) => {
                const def = D.CERTS.find((x) => x.id === c);
                return <Badge key={c} color="success" variant="light">{def ? tx(def, lang) : c}</Badge>;
              })}
            </div>
          </div>
        )}

        <div style={sx("display:flex;flex-wrap:wrap;gap:6px;margin-top:16px")}>
          {view.isProducer && <Badge color="success" variant="light">{F(lang, "fProducer")}</Badge>}
          {view.shipsAbroad && <Badge color="warning" variant="light">{F(lang, "fExport")}</Badge>}
          {view.taxFree && <Badge color="accent" variant="light">{F(lang, "fTaxFree")}</Badge>}
        </div>
      </section>
    </div>
  );
}

function TrustTab({ view, lang }: { view: NonNullable<ReturnType<typeof resolveShop>>; lang: Lang }) {
  const rows = trustRows(view, lang);
  return (
    <section style={sx(CARD)}>
      <div style={sx(KICKER)}>{pk({ tr: "Güven dosyası", en: "Trust file", ru: "Досье доверия", ar: "ملف الثقة" }, lang)}</div>
      {/* K11 · every field says where it came from. Estimated data is never
          presented as if an officer had checked it. */}
      <p style={sx("font-size:13px;color:var(--text-muted);margin-top:5px;text-wrap:pretty")}>
        {pk({
          tr: "Her alanın yanında bilginin kaynağı yazar: tahmini, esnaf beyanı ya da yetkili doğrulaması.",
          en: "Each field is labelled with where it came from: estimated, trader-declared, or officer-verified.",
          ru: "У каждого поля указан источник: оценка, заявление продавца или проверка.",
          ar: "لكل حقل مصدره: تقديري أو إقرار التاجر أو تحقق المسؤول.",
        }, lang)}
      </p>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:1px;background:var(--border-default);border:1px solid var(--border-default);border-radius:11px;overflow:hidden;margin-top:14px")}>
        {rows.map((r) => {
          const src = srcLabel(r.src, lang);
          return (
            <div key={r.label} style={sx("background:var(--surface-card);padding:12px 14px")}>
              <div style={sx("font-size:11.5px;color:var(--text-muted)")}>{r.label}</div>
              <div style={sx("font-size:15px;font-weight:700;color:var(--text-heading);margin-top:3px")}>{r.value}</div>
              {src && (
                <span
                  style={sx(
                    "display:inline-flex;align-items:center;height:19px;padding:0 7px;border-radius:5px;font-size:10.5px;font-weight:700;margin-top:6px;background:" +
                      tonePair(src.tone).bg + ";color:" + tonePair(src.tone).fg,
                  )}
                  title={src.note}
                >
                  {src.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:14px;margin-top:18px")}>
        <div>
          <div style={sx(KICKER)}>{pk({ tr: "Konuşulan diller", en: "Languages spoken", ru: "Языки", ar: "اللغات" }, lang)}</div>
          <div style={sx("font-size:14.5px;font-weight:600;color:var(--text-heading);margin-top:5px")}>
            {view.langs.map((x) => String(x).toUpperCase()).join(" · ")}
          </div>
        </div>
        <div>
          <div style={sx(KICKER)}>{pk({ tr: "Ödeme", en: "Payment", ru: "Оплата", ar: "الدفع" }, lang)}</div>
          <div style={sx("font-size:14.5px;font-weight:600;color:var(--text-heading);margin-top:5px")}>
            {view.payments.map((p) => tx(D.PAYMENTS.find((x) => x.id === p), lang) || p).join(" · ")}
          </div>
        </div>
      </div>
    </section>
  );
}

function LocationTab({
  view, lang, onReport,
}: { view: NonNullable<ReturnType<typeof resolveShop>>; lang: Lang; onReport: () => void }) {
  return (
    <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:20px;align-items:start")}>
      <section style={sx(CARD)}>
        <div style={sx(KICKER)}>{pk({ tr: "Adres", en: "Address", ru: "Адрес", ar: "العنوان" }, lang)}</div>
        <div style={sx("font-size:17px;font-weight:700;color:var(--text-heading);margin-top:6px;text-wrap:pretty")}>{view.where}</div>
        {view.place && (
          <div style={sx("font-size:13.5px;color:var(--text-muted);margin-top:4px")}>
            {tx(SC.SEMTLER.find((s) => s.id === view.place!.semt), lang)} ·{" "}
            {tx(SC.PLACE_KINDS[view.place.kind], lang)}
          </div>
        )}

        <div style={sx("margin-top:18px")}>
          <div style={sx(KICKER)}>{pk({ tr: "Fiziksel erişim", en: "Getting there", ru: "Доступ", ar: "الوصول" }, lang)}</div>
          <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:9px")}>
            {view.accessLines.map((line) => (
              <div key={line} style={sx("display:flex;align-items:center;gap:9px;font-size:13.5px;color:var(--text-body)")}>
                <span style={sx(medStyle("primary", 28))}>
                  <Icon name="handcart" size={14} />
                </span>
                <span style={sx("flex:1;min-width:0;text-wrap:pretty")}>{line}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={sx(CARD)}>
        <div style={sx(KICKER)}>{pk({ tr: "Bilgi yanlış mı?", en: "Wrong information?", ru: "Информация неверна?", ar: "معلومة خاطئة؟" }, lang)}</div>
        <p style={sx("font-size:13.5px;color:var(--text-body);margin-top:6px;text-wrap:pretty")}>
          {pk({
            tr: "Dükkân burada değilse ya da kapandıysa bildirin. Üç bildirim kaydı yetkili kuyruğuna düşürür.",
            en: "If the shop is not here or has closed, tell us. Three reports move the record into the officer queue.",
            ru: "Если лавки здесь нет — сообщите. Три сообщения отправят запись на проверку.",
            ar: "إن لم يكن المتجر هنا فأبلغنا. ثلاثة بلاغات تنقل السجل إلى قائمة المسؤول.",
          }, lang)}
        </p>
        <div style={sx("margin-top:12px")}>
          <Button variant="outline" color="danger" size="md" onClick={onReport}>
            {pk({ tr: "Burada değil / kapalı bildir", en: "Report closed or moved", ru: "Сообщить: закрыто/переехало", ar: "أبلغ: مغلق أو انتقل" }, lang)}
          </Button>
        </div>
      </section>
    </div>
  );
}

function ReviewsTab({
  lang, canReview, reviews, stars, setStars, text, setText, onSubmit, outcome, onOutcome, fmtDate,
}: {
  lang: Lang;
  canReview: boolean;
  reviews: { id?: string; stars: number; text: string; at?: number }[];
  stars: number;
  setStars: (n: number) => void;
  text: string;
  setText: (s: string) => void;
  onSubmit: () => void;
  outcome?: Outcome;
  onOutcome: (o: Outcome) => void;
  fmtDate: (ts?: number) => string;
}) {
  const pill = (on: boolean) =>
    "height:34px;padding:0 13px;border-radius:999px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:1px solid " +
    (on ? "var(--color-primary);background:var(--color-primary);color:#fff" : "var(--border-strong);background:var(--surface-card);color:var(--text-body)");

  return (
    <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:20px;align-items:start")}>
      <section style={sx(CARD)}>
        <div style={sx(KICKER)}>{pk({ tr: "Yorum hakkı", en: "Who can review", ru: "Кто может оставить отзыв", ar: "من يمكنه التقييم" }, lang)}</div>
        {/* K3 · the gate itself, stated plainly. It is the product's answer to
            fake reviews, so it is worth explaining rather than hiding. */}
        <p style={sx("font-size:13.5px;color:var(--text-body);margin-top:6px;text-wrap:pretty")}>
          {canReview
            ? pk({ tr: "Bu dükkânla anlaştınız — yorum yazabilirsiniz. Önce sonucu işaretleyin.", en: "You closed a deal here — you can review. Mark the outcome first.", ru: "Вы заключили сделку — можете оставить отзыв.", ar: "أتممت اتفاقًا — يمكنك التقييم." }, lang)
            : pk({ tr: "Yorum yalnız bu dükkânın teklifini kabul etmiş alıcılar tarafından yazılabilir. Sahte yorumu böyle engelliyoruz.", en: "Only buyers who accepted an offer from this shop can review it. That is how we keep reviews real.", ru: "Отзыв могут оставить только принявшие предложение.", ar: "التقييم متاح فقط لمن قبل عرضًا." }, lang)}
        </p>

        {canReview && (
          <>
            {/* K3 · HAN is not an arbiter, only a record-keeper: it asks both
                sides one question and feeds the answer into trust. */}
            <div style={sx("display:flex;flex-wrap:wrap;gap:7px;margin-top:14px")}>
              {(
                [
                  ["aldim", pk({ tr: "Aldım, sorun yok", en: "Bought it, all good", ru: "Купил, всё хорошо", ar: "اشتريت، كل شيء جيد" }, lang)],
                  ["bozuldu", pk({ tr: "Anlaşma bozuldu", en: "The deal fell through", ru: "Сделка не состоялась", ar: "فسد الاتفاق" }, lang)],
                  ["donus-yok", pk({ tr: "Dönüş olmadı", en: "No response", ru: "Не ответили", ar: "لم يردّوا" }, lang)],
                ] as [Outcome, string][]
              ).map(([id, label]) => (
                <button key={id} type="button" onClick={() => onOutcome(id)} style={sx(pill(outcome === id))}>
                  {label}
                </button>
              ))}
            </div>

            <div style={sx("margin-top:18px")}>
              <div style={sx("font-size:14px;font-weight:700;color:var(--text-heading)")}>
                {pk({ tr: "Deneyiminizi yazın", en: "Write your experience", ru: "Опишите опыт", ar: "اكتب تجربتك" }, lang)}
              </div>
              <div style={sx("display:flex;flex-wrap:wrap;gap:7px;margin-top:10px")}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setStars(n)} style={sx(pill(stars === n))} aria-pressed={stars === n}>
                    {n} ★
                  </button>
                ))}
              </div>
              <div style={sx("margin-top:10px")}>
                <Textarea
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={pk({
                    tr: "Ne aldınız, nasıl geçti? Fiyat, kalite, teslim…",
                    en: "What did you buy, how did it go? Price, quality, delivery…",
                    ru: "Что купили, как прошло?",
                    ar: "ماذا اشتريت، وكيف كانت التجربة؟",
                  }, lang)}
                  aria-label={pk({ tr: "Yorumunuz", en: "Your review", ru: "Ваш отзыв", ar: "تقييمك" }, lang)}
                />
              </div>
              <div style={sx("margin-top:10px")}>
                <Button color="accent" size="md" onClick={onSubmit}>
                  {pk({ tr: "Yorumu yayınla", en: "Publish review", ru: "Опубликовать", ar: "انشر التقييم" }, lang)}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <section style={sx(CARD)}>
        <div style={sx(KICKER)}>{W(lang, "reviewsTitle")}</div>
        {reviews.length === 0 ? (
          <p style={sx("font-size:13.5px;color:var(--text-muted);margin-top:10px;text-wrap:pretty")}>
            {pk({
              tr: "Henüz yorum yok. İlk yorumu, bu dükkânla anlaşan alıcı yazacak.",
              en: "No reviews yet. The first will come from a buyer who closes a deal here.",
              ru: "Отзывов пока нет.",
              ar: "لا تقييمات بعد.",
            }, lang)}
          </p>
        ) : (
          <div style={sx("display:flex;flex-direction:column;gap:12px;margin-top:12px")}>
            {reviews.slice().reverse().map((r, i) => (
              <div key={r.id || i} style={sx("border:1px solid var(--border-default);border-radius:11px;padding:13px 15px")}>
                <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px")}>
                  <span style={sx("font-size:14px;font-weight:700;color:var(--color-warning-accent)")}>{"★".repeat(r.stars || 5)}</span>
                  <span style={sx("font-size:12px;color:var(--text-muted)")}>{fmtDate(r.at)}</span>
                </div>
                <p style={sx("font-size:13.5px;color:var(--text-body);margin-top:6px;text-wrap:pretty")}>{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
