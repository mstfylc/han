"use client";

// HAN Giriş — "HAN Giriş.dc.html" birebir portu.
//
// İki panelli giriş (tasarım sisteminin giriş deseni), tek turuncu CTA.
// Üç durum: giriş · şifremi unuttum · yeni şifre. Çıkmaz sokaklar kapalı:
// şifresi hiç kurulmamış hesap doğrudan sıfırlamaya geçer, kimse kayıtlı
// değilse "ilk yöneticiyi kur" çıkar, kayıtlı olmayan telefon da aynı cevabı
// alır — kimin kayıtlı olduğu sızmaz.
//
// ⚠ Kimlik doğrulama PROTOTİPTİR ve ekranda da böyle yazar: şifre tarayıcıda
// tutulur, kod ekranda görünür. Üretimde üçü de sunucu tarafına taşınır.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import * as AD from "@/data/han-admin";
import * as SC from "@/data/han-scale";
import { Button, Input } from "@/ds";
import { sx } from "@/lib/sx";

type View = "giris" | "girdi" | "unuttum" | "kod";

const LINK = "background:none;border:none;padding:0;font-family:inherit;font-size:13.5px;font-weight:600;color:var(--color-primary);cursor:pointer;white-space:nowrap";

const digits = (x: string) => String(x || "").replace(/\D/g, "");

export default function GirisPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("giris");
  const [me, setMe] = useState<AD.OpsUser | null>(null);

  const [tel, setTel] = useState("");
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [np, setNp] = useState("");
  const [np2, setNp2] = useState("");

  const [err, setErr] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [noUsers, setNoUsers] = useState(false);

  useEffect(() => {
    const s = AD.session();
    const u = s ? AD.allUsers().find((x) => x.id === s.userId) || null : null;
    setMe(u);
    setView(u ? "girdi" : "giris");
    setNoUsers(AD.allUsers().length === 0);
    setReady(true);
  }, []);

  const clearMsgs = () => { setErr(""); setErrors({}); };

  const onLogin = () => {
    const t = digits(tel);
    const errs: Record<string, string> = {};
    if (t.length < 10) errs.tel = "Geçerli telefon yazın";
    if (!pin) errs.pin = "Şifre gerekli";
    if (Object.keys(errs).length) { setErrors(errs); setErr(""); return; }
    const r = AD.login(t, pin);
    if (!r.ok) {
      // Şifresi hiç kurulmamış hesabı çıkmaz sokakta bırakmayız: doğrudan
      // sıfırlama akışına geçer.
      if (r.err === "pinsiz") {
        const rq = AD.requestReset(t);
        setView("kod"); setErr(r.msg || ""); setDemoCode(rq.code); setSentTo(rq.masked); setErrors({});
        return;
      }
      setErr(r.msg || "Giriş yapılamadı."); setErrors({});
      return;
    }
    setMe(r.user || null); setView("girdi"); setPin(""); clearMsgs();
  };

  const onRequest = () => {
    const t = digits(tel);
    if (t.length < 10) { setErrors({ tel: "Geçerli telefon yazın" }); setView("unuttum"); return; }
    const r = AD.requestReset(t);
    setView("kod"); setDemoCode(r.code); setSentTo(r.masked);
    setCode(""); setNp(""); setNp2(""); clearMsgs();
  };

  const onApply = () => {
    const errs: Record<string, string> = {};
    if (!/^\d{6}$/.test(digits(code))) errs.code = "Altı haneli kodu yazın";
    if (!/^\d{4,8}$/.test(digits(np))) errs.np = "4–8 haneli sayı";
    if (digits(np) !== digits(np2)) errs.np2 = "Şifreler aynı değil";
    if (Object.keys(errs).length) { setErrors(errs); setErr(""); return; }
    const r = AD.applyReset(digits(code), digits(np));
    if (!r.ok) { setErr(r.msg || "Kod doğrulanamadı."); setErrors({}); return; }
    const u = AD.allUsers().find((x) => x.id === r.userId) || null;
    setMe(u); setView("girdi"); setCode(""); setNp(""); setNp2(""); setDemoCode(null); clearMsgs();
  };

  const onSeed = () => {
    // İlk yönetici: kimse yokken panele girilemez. Şifreyi kullanıcı kurar.
    const t = digits(tel) || "5320000000";
    AD.addUser({ name: "İlk Yönetici", role: "yonetici", tel: t });
    const r = AD.requestReset(t);
    setTel(t); setView("kod"); setDemoCode(r.code); setSentTo(r.masked); clearMsgs();
    setNoUsers(false);
  };

  const onLogout = () => {
    AD.logout();
    setMe(null); setView("giris"); setPin(""); setErr("");
  };

  const heroStats = [
    { n: SC.SCALE_TOTALS.units.toLocaleString("tr-TR"), label: "dükkân birimi" },
    { n: SC.RECORDS.length.toLocaleString("tr-TR"), label: "kayıt" },
    { n: String(SC.PLACES.length), label: "çarşı · han · cadde" },
  ];

  const role = me ? SC.ROLES[me.role] : null;

  return (
    <div style={sx("font-family:var(--font-sans);min-height:100vh;display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr))")}>
      <div style={sx("background:var(--color-primary);color:#fff;padding:48px 44px;display:flex;flex-direction:column;justify-content:space-between;gap:40px;min-height:320px")}>
        <div>
          <div style={sx("display:flex;align-items:center;gap:12px")}>
            <div style={sx("width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;letter-spacing:-.02em")}>H</div>
            <span style={sx("font-size:19px;font-weight:800;letter-spacing:-.01em")}>HAN</span>
            <span style={sx("font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;opacity:.6;margin-left:4px")}>Yönetim</span>
          </div>
          <h1 style={sx("margin:36px 0 0;font-size:34px;line-height:1.2;font-weight:700;letter-spacing:-.02em;max-width:20ch;text-wrap:pretty")}>
            Tarihi Yarımada&apos;nın kayıt omurgası
          </h1>
          <p style={sx("margin:16px 0 0;font-size:14.5px;line-height:1.65;opacity:.78;max-width:44ch;text-wrap:pretty")}>
            38 yer, 14.716 dükkân birimi. Kapsamayı kapatan iş sahada yürür — bu panel o işin defterini tutar.
          </p>
        </div>
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:22px")}>
          {heroStats.map((s) => (
            <div key={s.label}>
              <div style={sx("font-size:24px;font-weight:700;letter-spacing:-.01em")}>{s.n}</div>
              <div style={sx("font-size:12px;opacity:.68;margin-top:3px")}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={sx("background:var(--surface-page);padding:48px 40px;display:flex;align-items:center;justify-content:center")}>
        <div style={sx("width:100%;max-width:400px")}>
          {!ready ? null : view === "girdi" && me ? (
            <div style={sx("background:var(--surface-card);border:1px solid var(--color-success);border-radius:14px;padding:28px 26px")}>
              <div style={sx("font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--color-success)")}>Giriş yapıldı</div>
              <div style={sx("font-size:22px;font-weight:700;letter-spacing:-.015em;color:var(--text-heading);margin-top:9px")}>{me.name || "Kullanıcı"}</div>
              <div style={sx("font-size:13.5px;color:var(--text-muted);margin-top:5px;text-wrap:pretty")}>
                {role ? role.tr + " · " + role.note : me.role}
              </div>
              <div style={sx("margin-top:22px;display:flex;flex-direction:column;gap:10px")}>
                <button
                  type="button"
                  onClick={() => router.push("/panel")}
                  style={sx("display:flex;align-items:center;justify-content:center;height:44px;border-radius:8px;border:none;cursor:pointer;font-family:inherit;font-size:14px;font-weight:700;background:var(--color-accent);color:#fff")}
                >
                  Panele git
                </button>
                <Button variant="ghost" color="dark" fullWidth onClick={onLogout}>Çıkış yap</Button>
              </div>
            </div>
          ) : view === "giris" ? (
            <div>
              <h2 style={sx("margin:0;font-size:26px;font-weight:700;letter-spacing:-.02em;color:var(--text-heading)")}>Giriş yap</h2>
              <p style={sx("margin:8px 0 0;font-size:13.5px;color:var(--text-muted);text-wrap:pretty")}>
                Telefonunuz ve şifrenizle girin. Yetkiniz rolünüzden gelir.
              </p>

              <div style={sx("margin-top:26px;display:flex;flex-direction:column;gap:16px")}>
                <Input label="Telefon" placeholder="0532 000 00 00" value={tel} onChange={(e) => { setTel(e.target.value); clearMsgs(); }} error={errors.tel} />
                <Input label="Şifre" type="password" placeholder="••••" value={pin} onChange={(e) => { setPin(e.target.value); clearMsgs(); }} error={errors.pin} />
              </div>

              {!!err && (
                <div style={sx("margin-top:16px;padding:12px 14px;border-radius:9px;background:var(--color-danger-soft);color:var(--color-danger);font-size:13px;font-weight:600;text-wrap:pretty")}>{err}</div>
              )}

              <div style={sx("margin-top:22px")}>
                <Button color="accent" size="lg" fullWidth onClick={onLogin}>Giriş yap</Button>
              </div>
              <div style={sx("margin-top:14px;text-align:center")}>
                <button type="button" onClick={() => { setView("unuttum"); clearMsgs(); }} style={sx(LINK)}>Şifremi unuttum</button>
              </div>

              {noUsers && (
                <div style={sx("margin-top:26px;padding:16px 18px;border-radius:12px;background:var(--surface-card);border:1px solid var(--border-strong)")}>
                  <div style={sx("font-size:13px;font-weight:600;color:var(--text-heading)")}>Henüz kullanıcı yok</div>
                  <div style={sx("font-size:12.5px;color:var(--text-muted);margin-top:5px;text-wrap:pretty")}>
                    Sistemde tanımlı kimse olmadan giriş yapılamaz. İlk yöneticiyi buradan kurup panele girebilirsiniz.
                  </div>
                  <div style={sx("margin-top:13px")}>
                    <Button variant="outline" color="dark" size="sm" fullWidth onClick={onSeed}>İlk yöneticiyi kur</Button>
                  </div>
                </div>
              )}
            </div>
          ) : view === "unuttum" ? (
            <div>
              <h2 style={sx("margin:0;font-size:26px;font-weight:700;letter-spacing:-.02em;color:var(--text-heading)")}>Şifremi unuttum</h2>
              <p style={sx("margin:8px 0 0;font-size:13.5px;color:var(--text-muted);text-wrap:pretty")}>
                Telefonunuzu yazın; tek kullanımlık bir kod göndereceğiz. Kod {AD.RESET_TTL_MIN} dakika geçerli olur.
              </p>
              <div style={sx("margin-top:26px")}>
                <Input label="Telefon" placeholder="0532 000 00 00" value={tel} onChange={(e) => { setTel(e.target.value); clearMsgs(); }} error={errors.tel} />
              </div>
              <div style={sx("margin-top:22px")}>
                <Button color="accent" size="lg" fullWidth onClick={onRequest}>Kod gönder</Button>
              </div>
              <div style={sx("margin-top:14px;text-align:center")}>
                <button type="button" onClick={() => { setView("giris"); clearMsgs(); setCode(""); setNp(""); setNp2(""); }} style={sx(LINK)}>Girişe dön</button>
              </div>
            </div>
          ) : (
            <div>
              <h2 style={sx("margin:0;font-size:26px;font-weight:700;letter-spacing:-.02em;color:var(--text-heading)")}>Yeni şifre kurun</h2>
              <p style={sx("margin:8px 0 0;font-size:13.5px;color:var(--text-muted);text-wrap:pretty")}>
                {sentTo
                  ? sentTo + " numarasına altı haneli bir kod gönderildi. Kod " + AD.RESET_TTL_MIN + " dakika geçerli ve bir kez kullanılır."
                  : "Kod gönderildi."}
              </p>

              {!!demoCode && (
                <div style={sx("margin-top:18px;padding:14px 16px;border-radius:11px;background:var(--color-info-soft);border:1px solid var(--color-info)")}>
                  <div style={sx("font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--color-info)")}>Prototip</div>
                  <div style={sx("font-family:var(--font-mono);font-size:24px;font-weight:700;letter-spacing:.12em;color:var(--color-info);margin-top:6px")}>{demoCode}</div>
                  <div style={sx("font-size:12px;color:var(--text-muted);margin-top:7px;text-wrap:pretty")}>
                    Gerçek üretimde bu kod ekranda görünmez; SMS ile gider. Burada akışı deneyebilmeniz için gösteriliyor.
                  </div>
                </div>
              )}

              <div style={sx("margin-top:22px;display:flex;flex-direction:column;gap:16px")}>
                <Input label="Doğrulama kodu" placeholder="000000" value={code} onChange={(e) => { setCode(e.target.value); clearMsgs(); }} error={errors.code} />
                <Input label="Yeni şifre" type="password" placeholder="4–8 haneli" hint="Sadece sayı" value={np} onChange={(e) => { setNp(e.target.value); clearMsgs(); }} error={errors.np} />
                <Input label="Yeni şifre (yine)" type="password" placeholder="4–8 haneli" value={np2} onChange={(e) => { setNp2(e.target.value); clearMsgs(); }} error={errors.np2} />
              </div>

              {!!err && (
                <div style={sx("margin-top:16px;padding:12px 14px;border-radius:9px;background:var(--color-danger-soft);color:var(--color-danger);font-size:13px;font-weight:600;text-wrap:pretty")}>{err}</div>
              )}

              <div style={sx("margin-top:22px")}>
                <Button color="accent" size="lg" fullWidth onClick={onApply}>Şifreyi kur ve gir</Button>
              </div>
              <div style={sx("margin-top:14px;text-align:center;display:flex;gap:16px;justify-content:center;flex-wrap:wrap")}>
                <button type="button" onClick={onRequest} style={sx(LINK)}>Yeni kod isteyin</button>
                <button type="button" onClick={() => { setView("giris"); clearMsgs(); setCode(""); setNp(""); setNp2(""); }} style={sx(LINK)}>Girişe dön</button>
              </div>
            </div>
          )}

          <div style={sx("margin-top:30px;padding-top:20px;border-top:1px solid var(--border-default);font-size:12px;color:var(--text-muted);text-wrap:pretty")}>
            Bu bir prototiptir: kimlik doğrulama tarayıcıda yapılır. Gerçek üretimde şifre sunucuda saklanır,
            kod tek kullanımlık SMS ile gider ve oturum sunucu tarafından yönetilir.
          </div>
        </div>
      </div>
    </div>
  );
}
