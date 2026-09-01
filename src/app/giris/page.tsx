"use client";

// Giriş — operations sign-in.
//
// The screen's shape is the prototype's: sign in, ask for a code, set a new
// password, signed in. What changed is everything underneath. The prototype
// compared a PIN held in localStorage and counted attempts in the same place —
// it said so itself. Here the browser never sees a secret: it posts to
// /api/auth, and what comes back is an httpOnly cookie this page cannot read.
//
// Two states the design insists on keeping distinct, because collapsing them
// sends people down the wrong path:
//   · "no account with that number"   → nothing to do here
//   · "account exists, no password"   → go and set one, not "wrong password"

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Alert, Button, Input } from "@/ds";
import { sx } from "@/lib/sx";

const CARD = "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:16px;padding:26px;box-shadow:0 3px 4px rgba(0,0,0,.03)";
const H = "font-size:22px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0";
const SUB = "font-size:14px;color:var(--text-muted);margin-top:6px;text-wrap:pretty";

type View = "giris" | "kod" | "girdi";

interface Me {
  id: string;
  name: string;
  tel: string;
  role: string;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}

function LoginScreen() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/panel";

  const [view, setView] = useState<View>("giris");
  const [me, setMe] = useState<Me | null>(null);
  const [bootstrap, setBootstrap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  const [tel, setTel] = useState("");
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [np, setNp] = useState("");
  const [np2, setNp2] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => {
        if (!live) return;
        setBootstrap(!!b.bootstrap);
        if (b.user) { setMe(b.user); setView("girdi"); }
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return { status: r.status, body: await r.json() };
    } catch {
      return { status: 0, body: { error: "network" } };
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async () => {
    if (!tel.trim()) return setErr("Telefon gerekli");
    if (!pin) return setErr("Şifre gerekli");
    const { body } = await post({ action: "login", tel, pin });
    if (body.ok) {
      setMe(body.user);
      setView("girdi");
      router.push(next);
      return;
    }
    if (body.reason === "nopin") {
      // Not a wrong password — an account with no password yet. Send them
      // straight to setting one instead of making them guess.
      setNote("Bu hesapta henüz şifre yok. Numaranıza bir kod gönderiyoruz.");
      return askCode();
    }
    setErr(
      body.reason === "unknown" ? "Bu telefonla kayıtlı kullanıcı yok."
        : body.reason === "disabled" ? "Bu hesap kapatılmış. Yöneticinize başvurun."
          : body.reason === "locked" ? "Çok fazla hatalı deneme. Şifrenizi sıfırlayın."
            : body.left != null ? "Şifre yanlış. Kalan deneme: " + body.left
              : "Giriş yapılamadı.",
    );
  };

  const askCode = async () => {
    if (!tel.trim()) return setErr("Önce telefon numaranızı yazın");
    const { body } = await post({ action: "reset", tel });
    if (!body.ok) return setErr("Kod istenemedi.");
    setView("kod");
    // Say what actually happened. Promising "a code was sent" when no channel
    // is configured leaves someone waiting for an SMS that is never coming —
    // and then blaming their phone rather than the deployment.
    setNote(
      (body.delivered
        ? body.masked + " numarasına altı haneli bir kod gönderildi."
        : "Kod üretildi, ancak bu kurulumda mesaj gönderme kanalı tanımlı değil — kod sunucu günlüğünde.") +
      " Kod " + (body.ttl || 15) + " dakika geçerli." +
      // Only present when the deployment explicitly opted in; never in
      // production. Shown so a developer can complete the flow without an SMS
      // gateway, and labelled so nobody mistakes it for normal behaviour.
      (body.devCode ? "  ⚠ Geliştirme kodu: " + body.devCode : ""),
    );
  };

  const doApply = async () => {
    if (!code.trim()) return setErr("Kodu yazın");
    if (np !== np2) return setErr("İki şifre aynı değil");
    const { body } = await post({ action: "apply", code, pin: np });
    if (body.ok) {
      setMe(body.user);
      setView("girdi");
      router.push(next);
      return;
    }
    setErr(body.reason === "weak" ? "Şifre 4–8 haneli sayı olmalı." : "Kod geçersiz ya da süresi dolmuş.");
  };

  const doLogout = async () => {
    await post({ action: "logout" });
    setMe(null);
    setPin("");
    setView("giris");
  };

  return (
    <div style={sx("min-height:100vh;background:var(--surface-page);font-family:var(--font-sans);color:var(--text-body);display:flex;align-items:center;justify-content:center;padding:24px")}>
      <div style={sx("width:100%;max-width:420px")}>
        <div style={sx("display:flex;align-items:center;gap:10px;margin-bottom:18px")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/han-mark.svg" alt="" width={32} height={32} style={sx("border-radius:8px")} />
          <span style={sx("font-size:21px;font-weight:800;color:var(--color-primary-accent);letter-spacing:.02em")}>HAN</span>
          <span style={sx("font-size:14px;color:var(--text-muted)")}>Yönetim</span>
        </div>

        <div style={sx(CARD)}>
          {view === "girdi" && me ? (
            <>
              <h1 style={sx(H)}>Girdiniz</h1>
              <p style={sx(SUB)}>{me.name || me.tel} · {me.role}</p>
              <div style={sx("display:flex;gap:9px;margin-top:18px;flex-wrap:wrap")}>
                <Button color="accent" size="lg" onClick={() => router.push(next)}>Panele git</Button>
                <Button variant="ghost" color="dark" size="lg" onClick={doLogout}>Çıkış</Button>
              </div>
            </>
          ) : view === "kod" ? (
            <>
              <h1 style={sx(H)}>Şifrenizi belirleyin</h1>
              <p style={sx(SUB)}>Telefonunuza gelen kodu yazın, sonra yeni şifrenizi kurun.</p>
              {note && <div style={sx("margin-top:14px")}><Alert color="primary">{note}</Alert></div>}
              {err && <div style={sx("margin-top:12px")}><Alert color="danger">{err}</Alert></div>}
              <div style={sx("display:grid;gap:12px;margin-top:16px")}>
                <Input label="Kod" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
                <Input label="Yeni şifre" type="password" inputMode="numeric" autoComplete="new-password" value={np} onChange={(e) => setNp(e.target.value)} hint="4–8 haneli sayı" />
                <Input label="Yeni şifre (tekrar)" type="password" inputMode="numeric" autoComplete="new-password" value={np2} onChange={(e) => setNp2(e.target.value)} />
              </div>
              <div style={sx("display:flex;gap:9px;margin-top:18px;flex-wrap:wrap")}>
                <Button color="accent" size="lg" disabled={busy} onClick={doApply}>Şifreyi kaydet</Button>
                <Button variant="ghost" color="dark" size="lg" disabled={busy} onClick={() => { setView("giris"); setErr(""); setNote(""); }}>
                  Geri
                </Button>
              </div>
            </>
          ) : (
            <>
              <h1 style={sx(H)}>Giriş</h1>
              <p style={sx(SUB)}>
                {bootstrap
                  ? "Bu kurulumda henüz kullanıcı yok. Numaranızı yazıp “Şifremi unuttum” deyin — ilk yönetici hesabı sizin adınıza açılır."
                  : "Telefon numaranız ve şifrenizle girin."}
              </p>
              {note && <div style={sx("margin-top:14px")}><Alert color="primary">{note}</Alert></div>}
              {err && <div style={sx("margin-top:12px")}><Alert color="danger">{err}</Alert></div>}
              <div style={sx("display:grid;gap:12px;margin-top:16px")}>
                <Input label="Telefon" inputMode="tel" autoComplete="username" value={tel} onChange={(e) => setTel(e.target.value)} />
                <Input label="Şifre" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} />
              </div>
              <div style={sx("display:flex;gap:9px;margin-top:18px;flex-wrap:wrap;align-items:center")}>
                <Button color="accent" size="lg" disabled={busy} onClick={doLogin}>Giriş yap</Button>
                <Button variant="ghost" color="primary" size="lg" disabled={busy} onClick={askCode}>Şifremi unuttum</Button>
              </div>
            </>
          )}
        </div>

        <p style={sx("font-size:12.5px;color:var(--text-muted);margin-top:14px;text-align:center;text-wrap:pretty")}>
          Şifreniz sunucuda yalnız karma (scrypt) olarak tutulur; oturumunuz sayfanın okuyamayacağı bir çerezdedir.
        </p>
      </div>
    </div>
  );
}
