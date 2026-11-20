"use client";

// HAN 2.0 — Public Trader Invite Verification & 1-Tap KVKK Opt-Out Page.
// Reached from QR code or WhatsApp/SMS invite link: /esnaf/davet/[token]

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, Button, Input } from "@/ds";
import { sx } from "@/lib/sx";

interface PublicCandidate {
  id: string;
  name: string;
  cat: string;
  placeId: string | null;
  semt: string | null;
  floor: number | null;
  door: string | null;
  address: string;
  status: string;
}

export default function TraderInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = decodeURIComponent(String(params.token || ""));

  const [loading, setLoading] = useState(true);
  const [cand, setCand] = useState<PublicCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [door, setDoor] = useState("");
  const [floor, setFloor] = useState("0");
  const [tel, setTel] = useState("");
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [doneTone, setDoneTone] = useState<"success" | "warning">("success");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/external/invite-public?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.candidate) {
          setCand(d.candidate);
          setName(d.candidate.name || "");
          setDoor(d.candidate.door || "");
          setFloor(d.candidate.floor != null ? String(d.candidate.floor) : "0");
        } else {
          setError("Bu davet bağlantısı bulunamadı veya süresi dolmuş olabilir.");
        }
      })
      .catch(() => setError("Bağlantı doğrulaması sırasında bir hata oluştu."))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (action: "confirm" | "optout") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/external/invite-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action,
          name: name.trim(),
          door: door.trim(),
          floor: Number(floor) || 0,
          tel: tel.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d?.message || "İşlem tamamlanamadı.");
      } else {
        setDoneTone(action === "confirm" ? "success" : "warning");
        setDoneMsg(d.message || "İşleminiz kaydedildi.");
      }
    } catch {
      setError("Sunucuya ulaşılamadı, lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={sx("max-width:560px;margin:32px auto;padding:0 16px 48px")}>
      <section
        style={sx(
          "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:var(--radius-card, 16px);padding:24px;box-shadow:var(--shadow-card, 0 4px 16px rgba(0,0,0,.06))",
        )}
      >
        <div style={sx("font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--color-primary)")}>
          HAN · TARİHİ YARIMADA ESNAF DOĞRULAMA
        </div>
        <h1 style={sx("font-size:24px;font-weight:800;color:var(--text-heading);margin:8px 0 6px;letter-spacing:-.02em")}>
          İşletme Kaydınızı 10 Saniyede Doğrulayın
        </h1>
        <p style={sx("font-size:13.5px;color:var(--text-muted);line-height:1.5;margin:0 0 18px")}>
          Alıcılar han, kat ve kapı numarasıyla doğrudan tezgâhınıza ulaşabilsin. Tamamen ücretsizdir; istemezseniz tek dokunuşla KVKK kapsamında kaydınızı kaldırabilirsiniz.
        </p>

        {loading && <p style={sx("font-size:14px;color:var(--text-muted)")}>Davet bilgileri yükleniyor…</p>}
        {error && (
          <div style={sx("margin-bottom:14px")}>
            <Alert color="danger" variant="light">{error}</Alert>
          </div>
        )}
        {doneMsg && (
          <div style={sx("display:flex;flex-direction:column;gap:14px")}>
            <Alert color={doneTone} variant="light">{doneMsg}</Alert>
            <div style={sx("display:flex;gap:8px;flex-wrap:wrap")}>
              <Button color="primary" onClick={() => router.push("/esnaf")}>
                Esnaf Paneline Geç
              </Button>
              <Button variant="outline" color="secondary" onClick={() => router.push("/")}>
                Ana Sayfaya Dön
              </Button>
            </div>
          </div>
        )}

        {!loading && cand && !doneMsg && (
          <div style={sx("display:flex;flex-direction:column;gap:14px")}>
            <Input
              label="İşletme / Tabela Adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:10px")}>
              <Input
                label="Kat"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="0, 1, 2..."
              />
              <Input
                label="Kapı No"
                value={door}
                onChange={(e) => setDoor(e.target.value)}
                placeholder="Örn. 142"
              />
            </div>
            <Input
              label="WhatsApp / İletişim Telefonu (Opsiyonel)"
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              placeholder="05XX XXX XX XX"
            />
            {cand.address && (
              <div style={sx("font-size:12.5px;color:var(--text-muted);background:var(--surface-muted);padding:10px 12px;border-radius:10px")}>
                📍 Konum ipucu: {cand.address}
              </div>
            )}

            <div style={sx("display:flex;flex-direction:column;gap:10px;margin-top:6px")}>
              <Button color="primary" size="lg" disabled={busy} onClick={() => submit("confirm")}>
                ✓ Bilgiler Doğru — İşletmemi Onayla
              </Button>
              <button
                type="button"
                disabled={busy}
                onClick={() => submit("optout")}
                style={sx(
                  "height:40px;border-radius:10px;border:1px solid var(--border-strong);background:transparent;color:var(--color-danger);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer",
                )}
              >
                Listelenmek İstemiyorum · Kaydımı Kaldır (KVKK)
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
