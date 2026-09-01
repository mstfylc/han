"use client";

// Panel — the levers, and who is allowed to pull them.
//
//   Yetkililer   — the team. OFFICERS was a fixed dictionary; a real team adds
//                  people and hands over authority.
//   Sponsorluk   — paid placement, with the rule that makes it survivable:
//                  money buys a labelled slot, never a position in the organic
//                  ranking, and a shop that stops answering loses the slot
//                  automatically.
//   Arama Sözlüğü— what a buyer calls a thing is not what a trader calls it.
//                  This is where "телефон kılıfı" learns to find a shop.
//   Etkinlik     — events and campaigns were shown to buyers but could not be
//                  edited. Add, hide and correct here; the buyer reads the
//                  same layer.

import { useEffect, useMemo, useState } from "react";

import * as AD from "@/data/han-admin";
import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import * as SE from "@/data/han-search";
import { Button, EmptyState, Input } from "@/ds";
import { sx } from "@/lib/sx";

import { Pill } from "./Pill";
import { CARD, H1, KICKER, ROW, SUB } from "./shared";

// ── Yetkililer ────────────────────────────────────────────────────────────

interface OpsUser { id: string; name: string; tel: string; role: string; active: boolean; lastSeen: string | null }

export function Yetkililer({ me, readOnly, say }: {
  me: { id: string; role: string };
  readOnly: boolean;
  say: (m: string) => void;
}) {
  const [users, setUsers] = useState<OpsUser[] | null>(null);
  const [name, setName] = useState("");
  const [tel, setTel] = useState("");
  const [role, setRole] = useState("saha");
  const [rev, setRev] = useState(0);

  // An effect, not a memo: this fetches and sets state. `useMemo` is for
  // deriving a value during render, and using it for a side effect means the
  // cleanup never runs and React may call it twice or not at all.
  useEffect(() => {
    let live = true;
    fetch("/api/users", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => { if (live) setUsers(b.users || []); })
      .catch(() => { if (live) setUsers([]); });
    return () => { live = false; };
  }, [rev]);

  const call = async (payload: Record<string, unknown>, msg: string) => {
    const r = await fetch("/api/users", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    const b = await r.json();
    if (b.ok) { setRev((n) => n + 1); say(msg); }
    else say(b.error === "exists" ? "Bu telefon zaten kayıtlı" : "İşlem yapılamadı");
  };

  return (
    <>
      <h1 style={sx(H1)}>Yetkililer</h1>
      <p style={sx(SUB)}>
        Ekipte kim var, ne yapabilir. Yetki tanımı tek yerden gelir — bu listedeki rol, hem
        gezinmeyi hem de sunucunun kabul ettiği yazmaları belirler.
      </p>

      {!readOnly && (
        <div style={sx("margin-top:16px;" + CARD)}>
          <div style={sx(KICKER)}>Yeni kullanıcı</div>
          <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:10px;margin-top:12px")}>
            <Input size="md" placeholder="Ad soyad" aria-label="Ad soyad" value={name} onChange={(e) => setName(e.target.value)} />
            <Input size="md" inputMode="tel" placeholder="Telefon" aria-label="Telefon" value={tel} onChange={(e) => setTel(e.target.value)} />
            <select
              value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rol"
              style={sx("height:40px;padding:0 10px;border-radius:9px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:14px;color:var(--text-body)")}
            >
              {Object.keys(SC.ROLES).map((r) => <option key={r} value={r}>{SC.ROLES[r].tr}</option>)}
            </select>
            <Button
              color="accent" size="md" disabled={!tel.trim()}
              onClick={() => { call({ action: "create", name, tel, role }, "Kullanıcı eklendi"); setName(""); setTel(""); }}
            >
              Ekle
            </Button>
          </div>
          {/* No password is set here on purpose: the new person sets their own
              via the reset flow, so nobody else ever knows it. */}
          <p style={sx("font-size:12.5px;color:var(--text-muted);margin-top:9px;text-wrap:pretty")}>
            Şifre buradan verilmez. Eklenen kişi giriş ekranında “Şifremi unuttum” ile kendi
            şifresini kurar — böylece şifresini sizin de bilmeniz gerekmez.
          </p>
        </div>
      )}

      <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:18px")}>
        {(users || []).map((u) => (
          <div key={u.id} style={sx(ROW + (u.active ? "" : ";opacity:.55"))}>
            <span style={sx("flex:1;min-width:0")}>
              <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>
                {u.name || AD.maskTel(u.tel)}{u.id === me.id ? " · siz" : ""}
              </span>
              <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                {AD.maskTel(u.tel)} · {SC.ROLES[u.role]?.tr || u.role}
                {u.lastSeen ? " · son giriş " + new Date(u.lastSeen).toLocaleDateString("tr-TR") : " · hiç girmedi"}
              </span>
            </span>
            {!u.active && <Pill label="Kapalı" t="danger" />}
            {!readOnly && u.id !== me.id && (
              <span style={sx("flex:none;display:flex;gap:6px;align-items:center")}>
                <select
                  value={u.role}
                  onChange={(e) => call({ action: "role", id: u.id, role: e.target.value }, "Rol değişti")}
                  aria-label={u.name + " rolü"}
                  style={sx("height:32px;padding:0 8px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:12.5px;color:var(--text-body)")}
                >
                  {Object.keys(SC.ROLES).map((r) => <option key={r} value={r}>{SC.ROLES[r].tr}</option>)}
                </select>
                <Button
                  variant="ghost" color={u.active ? "danger" : "primary"} size="sm"
                  onClick={() => call({ action: "active", id: u.id, active: !u.active }, u.active ? "Hesap kapatıldı" : "Hesap açıldı")}
                >
                  {u.active ? "Kapat" : "Aç"}
                </Button>
              </span>
            )}
          </div>
        ))}

        {users && users.length === 0 && (
          <EmptyState icon="profile-circle" tone="neutral" title="Kullanıcı yok" description="İlk kullanıcı giriş ekranından açılır." />
        )}
      </div>
    </>
  );
}

// ── Sponsorluk ────────────────────────────────────────────────────────────

export function Sponsorluk({ readOnly, onChange, say }: {
  readOnly: boolean; onChange: () => void; say: (m: string) => void;
}) {
  const sponsors = SC.loadSponsors();

  return (
    <>
      <h1 style={sx(H1)}>Sponsorluk</h1>
      <p style={sx(SUB)}>
        Ücretli yerleşim yalnız etiketli, ayrı bir alanda çıkar; organik sıralamaya karışmaz.
        Ve yanıt oranı %{SC.SPONSOR_PAUSE_RATE}’in altına düşen kayıt yerleşimini
        <strong> kendiliğinden</strong> kaybeder — parayla satın alınan şey görünürlük,
        güven değil.
      </p>

      <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:18px")}>
        {sponsors.map((s) => {
          const rec = SC.RECORDS.find((r) => r.id === s.recordId);
          const id = SC.sponsorId(s);
          return (
            <div key={id} style={sx(ROW)}>
              <span style={sx("flex:1;min-width:0")}>
                <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>
                  {rec?.name || s.recordId}
                </span>
                <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                  {(SC.SPONSOR_KINDS[s.kind] as Record<string, string>)?.tr || s.kind}
                  {s.cat ? " · " + s.cat : ""}{s.place ? " · " + s.place : ""}
                  {" · " + s.until + " tarihine kadar"}
                  {rec?.respRate != null ? " · yanıt %" + rec.respRate : ""}
                </span>
              </span>
              {s.autoPaused
                ? <Pill label="Kural durdurdu" t="danger" />
                : s.paused ? <Pill label="Duraklatıldı" t="warning" /> : <Pill label="Yayında" t="success" />}
              {!readOnly && !s.autoPaused && (
                <Button
                  variant="outline" color="primary" size="sm"
                  onClick={() => { SC.setSponsor(id, { paused: !s.paused }); onChange(); say(s.paused ? "Yerleşim açıldı" : "Yerleşim duraklatıldı"); }}
                >
                  {s.paused ? "Aç" : "Duraklat"}
                </Button>
              )}
              {/* An automatic pause is not something a salesperson can undo:
                  that is the whole point of the rule. */}
              {s.autoPaused && (
                <span style={sx("flex:none;font-size:12px;color:var(--text-muted);max-width:22ch;text-wrap:pretty")}>
                  Elle açılamaz — yanıt oranı düzelince kendiliğinden döner.
                </span>
              )}
            </div>
          );
        })}

        {sponsors.length === 0 && (
          <EmptyState icon="star" tone="neutral" title="Sponsorlu yerleşim yok" description="Yerleşim, yanıt oranı eşiğin üstündeki aktif kayıtlara verilir." />
        )}
      </div>
    </>
  );
}

// ── Arama Sözlüğü ─────────────────────────────────────────────────────────

export function Sozluk({ readOnly, onChange, say }: {
  readOnly: boolean; onChange: () => void; say: (m: string) => void;
}) {
  const [cat, setCat] = useState("");
  const [word, setWord] = useState("");
  const [rev, setRev] = useState(0);

  const cats = useMemo(
    () => [...(D.CATS || []), ...SC.CATS_EXTRA].filter((c) => c && c.id),
    [],
  );
  const words = useMemo(() => (cat ? SE.synonymsOf(cat) : []), [cat, rev]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <h1 style={sx(H1)}>Arama sözlüğü</h1>
      <p style={sx(SUB)}>
        Alıcının kullandığı kelime esnafın kullandığı kelime değildir. Buraya eklenen her eşanlam,
        dört dilde aramanın doğru kategoriye düşmesini sağlar — ve alıcı tarafında hemen geçerlidir.
      </p>

      <div style={sx("margin-top:16px;" + CARD)}>
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:10px")}>
          <select
            value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategori"
            style={sx("height:40px;padding:0 10px;border-radius:9px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:14px;color:var(--text-body)")}
          >
            <option value="">Kategori seçin</option>
            {cats.map((c) => <option key={c.id as string} value={c.id as string}>{(c.tr as string) || (c.id as string)}</option>)}
          </select>
          <Input
            size="md" placeholder="Yeni kelime" aria-label="Yeni kelime"
            value={word} onChange={(e) => setWord(e.target.value)}
          />
          <Button
            color="accent" size="md" disabled={readOnly || !cat || !word.trim()}
            onClick={() => {
              const res = SE.addSynonym(cat, word.trim());
              if (!res) return say("Bu kelime eklenemedi");
              // A word that already points somewhere else is the interesting
              // case: silently reassigning it would break the other category's
              // search without anyone noticing.
              if (res.clash) say("Uyarı: bu kelime “" + res.clash + "” kategorisinde de var");
              else say("Kelime eklendi — aramada hemen geçerli");
              SE.saveLexicon(cat, word.trim());
              setWord("");
              setRev((n) => n + 1);
              onChange();
            }}
          >
            Ekle
          </Button>
        </div>

        {cat && (
          <div style={sx("display:flex;flex-wrap:wrap;gap:7px;margin-top:16px")}>
            {words.map((w) => (
              <span key={w} style={sx("display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 6px 0 11px;border-radius:999px;border:1px solid var(--border-strong);background:var(--surface-card);font-size:13px;color:var(--text-body)")}>
                {w}
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={w + " kelimesini kaldır"}
                    onClick={() => {
                      SE.dropSynonym(cat, w);
                      SE.saveLexicon(cat, w, true);
                      setRev((n) => n + 1);
                      onChange();
                      say("Kelime kaldırıldı");
                    }}
                    style={sx("width:20px;height:20px;border-radius:999px;border:none;background:var(--surface-muted);color:var(--text-muted);font-family:inherit;font-size:13px;line-height:1;cursor:pointer")}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {words.length === 0 && (
              <span style={sx("font-size:13px;color:var(--text-muted)")}>Bu kategoride eşanlam yok.</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Etkinlik & Kampanya ───────────────────────────────────────────────────

export function Icerik({ readOnly, onChange, say }: {
  readOnly: boolean; onChange: () => void; say: (m: string) => void;
}) {
  const [rev, setRev] = useState(0);
  const events = useMemo(() => {
    // `rev` is not read here — it is the re-read trigger. mergeContent goes to
    // storage, so after an edit the memo has to run again, and bumping rev is
    // what says so. Referencing it keeps the dependency honest rather than
    // silencing the rule that noticed.
    void rev;
    return AD.mergeContent((D.EVENTS || []) as Record<string, unknown>[], "events");
  }, [rev]);
  const [title, setTitle] = useState("");
  const [day, setDay] = useState("");
  const [kind, setKind] = useState("fair");

  const bump = () => { setRev((n) => n + 1); onChange(); };

  return (
    <>
      <h1 style={sx(H1)}>Etkinlik & kampanya</h1>
      <p style={sx(SUB)}>
        Etkinlikler alıcıya gösteriliyordu ama düzenlenemiyordu. Ekleme, gizleme ve düzeltme
        burada; alıcı tarafı aynı katmanı okur. Kaynak veri bozulmaz — gizlenen etkinlik silinmez,
        geri açılabilir.
      </p>

      {!readOnly && (
        <div style={sx("margin-top:16px;" + CARD)}>
          <div style={sx(KICKER)}>Yeni etkinlik</div>
          <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr));gap:10px;margin-top:12px")}>
            <Input size="md" placeholder="Başlık" aria-label="Başlık" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input size="md" inputMode="numeric" placeholder="Gün" aria-label="Gün" value={day} onChange={(e) => setDay(e.target.value)} />
            <select
              value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tür"
              style={sx("height:40px;padding:0 10px;border-radius:9px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:14px;color:var(--text-body)")}
            >
              {Object.keys(AD.EVENT_KINDS).map((k) => <option key={k} value={k}>{AD.EVENT_KINDS[k].tr}</option>)}
            </select>
            <Button
              color="accent" size="md" disabled={!title.trim() || !day.trim()}
              onClick={() => {
                AD.addContent("events", { tr: title.trim(), day: day.trim(), monthTr: "", kind, time: "" });
                setTitle(""); setDay("");
                bump();
                say("Etkinlik eklendi — alıcı tarafında görünür");
              }}
            >
              Ekle
            </Button>
          </div>
        </div>
      )}

      <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:18px")}>
        {events.map((e) => {
          const id = String((e as Record<string, unknown>).id || "");
          const hidden = AD.isHidden("events", id);
          return (
            <div key={id} style={sx(ROW + (hidden ? ";opacity:.55" : ""))}>
              <span style={sx("flex:1;min-width:0")}>
                <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>
                  {String((e as Record<string, unknown>).tr || id)}
                </span>
                <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                  {String((e as Record<string, unknown>).day || "")} {String((e as Record<string, unknown>).monthTr || "")}
                  {" · " + (AD.EVENT_KINDS[String((e as Record<string, unknown>).kind || "")]?.tr || "")}
                </span>
              </span>
              {hidden && <Pill label="Gizli" t="danger" />}
              {!readOnly && (
                <Button
                  variant="outline" color="primary" size="sm"
                  onClick={() => { AD.hideContent("events", id, !hidden); bump(); say(hidden ? "Etkinlik geri açıldı" : "Etkinlik gizlendi"); }}
                >
                  {hidden ? "Geri aç" : "Gizle"}
                </Button>
              )}
            </div>
          );
        })}

        {events.length === 0 && (
          <EmptyState icon="calendar" tone="neutral" title="Etkinlik yok" description="Yeni bir etkinlik ekleyin." />
        )}
      </div>
    </>
  );
}
