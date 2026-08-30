"use client";

// Kullanıcılar — ADMIN-PLANI Faz 3 · madde 13.
//
// OFFICERS sabit bir sözlüktü; artık kullanıcı eklenir, rol değişir, kapsam
// atanır, hesap kapanır. Yetki tanımı SC.ROLES'ten okunur — çift kaynak yok.
// Rol seçilirken KAÇ EKRAN GÖRECEĞİ anında yazılır (ROLES[r].can uzunluğu;
// "*" = hepsi). Şifre durumu ve sıfırlama kodu SUNUCUDAN gelir (/api/auth):
// şifre hash'i tarayıcıya hiç inmez. Telefonlar hep maskeli gösterilir.
//
// "HAN Panel.dc.html" isKullanicilar bölümü + userVals()'ın portu.

import { useEffect, useState } from "react";

import * as AD from "@/data/han-admin";
import * as SC from "@/data/han-scale";
import { Alert, Button, Drawer, EmptyState, Input, Select } from "@/ds";
import * as AUTH from "@/lib/authClient";
import { sx } from "@/lib/sx";

import { CARD, Pill, H1, SUB, type PanelTabProps } from "./shared";

interface UserForm {
  name: string;
  tel: string;
  role: string;
  scope: string;
}

const EMPTY_FORM: UserForm = { name: "", tel: "", role: "saha", scope: "" };

const scopeOf = (role: string): string | null => (SC.ROLES[role] || {}).scope || null;

const placeOpts = () => SC.PLACES.slice().sort((a, b) => b.units - a.units).slice(0, 40);

export default function Kullanicilar({ readOnly, refresh, say }: PanelTabProps) {
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [f, setF] = useState<UserForm>(EMPTY_FORM);
  const [errs, setErrs] = useState<{ name?: string; tel?: string }>({});
  // SMS sağlayıcısı olmadığı için kod ekranda gösterilir (PROTOTİP etiketli);
  // üretimde SMS ile gider ve burada görünmez.
  const [codes, setCodes] = useState<Record<string, string | null>>({});

  // Şifre durumu sunucudan: hangi hesabın şifresi kurulu, yalnız oturumlu
  // yönetim kullanıcısına söylenir.
  const [pins, setPins] = useState<Record<string, boolean>>({});
  useEffect(() => {
    void AUTH.me().then((r) => setPins(r.pins || {}));
  }, []);

  const R = SC.ROLES;
  const users = AD.allUsers();
  const needle = q.trim().toLocaleLowerCase("tr");
  const rows = users.filter((u) => !needle || (u.name + " " + u.tel).toLocaleLowerCase("tr").includes(needle));
  const withPin = users.filter((u) => pins[u.id]).length;
  const fmt = (ts: number | null) => (ts ? new Date(ts).toLocaleDateString("tr-TR") : "hiç girmedi");

  const stats = [
    { label: "Kullanıcı", value: String(users.length), note: users.filter((u) => u.active).length + " aktif", color: "var(--text-heading)" },
    { label: "Şifresi kurulu", value: String(withPin), note: "giriş yapabilir", color: "var(--color-" + (withPin ? "success" : "warning") + ")" },
    { label: "Saha yetkilisi", value: String(users.filter((u) => u.role === "saha").length), note: "bölge sorumlusu", color: "var(--color-primary)" },
    { label: "Rol sayısı", value: String(Object.keys(R).length), note: "yetki tanımı", color: "var(--text-heading)" },
  ];

  const save = () => {
    const tel = f.tel.replace(/\D/g, "");
    const e: { name?: string; tel?: string } = {};
    if (!f.name.trim()) e.name = "Ad gerekli";
    if (tel.length < 10) e.tel = "Geçerli telefon gerekli";
    else if (AD.userByTel(tel)) e.tel = "Bu telefon zaten kayıtlı";
    if (e.name || e.tel) return setErrs(e);
    const sc = scopeOf(f.role);
    AD.addUser({
      name: f.name.trim(),
      tel,
      role: f.role,
      officer: sc === "officer" ? f.scope || null : null,
      place: sc === "place" ? f.scope || null : null,
    });
    setFormOpen(false);
    setF(EMPTY_FORM);
    setErrs({});
    refresh();
    say("Kullanıcı eklendi");
  };

  const selRole = R[f.role] || R.saha;
  const selScope = scopeOf(f.role);
  // Rol seçilirken kaç ekran göreceği anında yazılır — kaynak ROLES, çift kaynak yok.
  const screenCount = selRole.can.includes("*") ? "hepsi" : String(selRole.can.length);
  const roleNote =
    selRole.tr + ": " + selRole.note + ". " +
    (selRole.readOnly ? "Yazma yetkisi yok — yalnız görür." : "Yetkili olduğu ekranlarda değişiklik yapabilir.") +
    " Görebileceği ekran sayısı: " + screenCount;

  return (
    <>
      <h1 style={sx(H1)}>Kullanıcılar</h1>
      <p style={sx(SUB)}>Ekip, roller ve giriş — yetki devri ve şifre sıfırlama.</p>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:16px;margin-top:18px")}>
        {stats.map((s) => (
          <div key={s.label} style={sx(CARD)}>
            <div style={sx("font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:10px")}>{s.label}</div>
            <div style={sx("font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;color:" + s.color)}>{s.value}</div>
            <div style={sx("font-size:12px;color:var(--text-muted);margin-top:4px")}>{s.note}</div>
          </div>
        ))}
      </div>

      <div style={sx("margin-top:16px")}>
        <Alert color="warning" variant="light" title="Prototip uyarısı">
          Bu ekran giriş akışının ekranlarını gösterir. Gerçek üretimde kimlik doğrulama sunucu tarafındadır:
          şifre tarayıcıda saklanmaz, sıfırlama kodu tek kullanımlık olarak SMS ile gider.
        </Alert>
      </div>

      <div style={sx("margin-top:16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;" + CARD + ";padding:15px 20px")}>
        <div style={sx("width:240px;max-width:100%")}>
          <Input
            size="sm"
            iconLead="magnifier"
            placeholder="Ad veya telefon ara…"
            aria-label="Kullanıcı ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <a
          href="/giris"
          target="_blank"
          rel="noopener"
          style={sx("display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;border:1px solid var(--border-strong);background:var(--surface-card);color:var(--text-body)")}
        >
          Giriş ekranını aç
        </a>
        <span style={sx("margin-left:auto")}>
          <Button color="accent" size="sm" iconStart="plus-squared" disabled={readOnly} onClick={() => setFormOpen(true)}>
            Kullanıcı Ekle
          </Button>
        </span>
      </div>

      {rows.length === 0 && (
        <EmptyState
          icon="profile-circle"
          tone="neutral"
          title={users.length ? "Arama sonucu yok" : "Henüz kullanıcı yok"}
          description={users.length
            ? "Başka bir ad veya telefon deneyin."
            : "Ekibi buradan kurun: rol ekranları ve eylemleri belirler. Saha yetkilisi bir bölgeye, han yönetimi bir yere bağlanır."}
        />
      )}

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:14px")}>
        {rows.map((u) => {
          const pin = !!pins[u.id];
          const sc = scopeOf(u.role);
          const code = codes[u.id];
          const cardTone = u.active ? (pin ? "success" : "warning") : null;
          return (
            <div key={u.id} style={sx(CARD + (cardTone ? ";border-left:3px solid var(--color-" + cardTone + ")" : ""))}>
              <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:12px")}>
                <div style={sx("min-width:0")}>
                  <div style={sx("font-size:14.5px;font-weight:600;line-height:1.35;color:var(--text-heading)")}>{u.name || "(adsız)"}</div>
                  <div style={sx("font-size:12.5px;line-height:1.5;color:var(--text-muted);margin-top:3px;font-family:var(--font-mono)")}>
                    {AD.maskTel(u.tel)}
                  </div>
                </div>
                <Pill
                  label={u.active ? (pin ? "Aktif" : "Şifre bekliyor") : "Kapalı"}
                  t={u.active ? (pin ? "success" : "warning") : "secondary"}
                />
              </div>

              <div style={sx("margin-top:12px;display:flex;flex-direction:column;gap:7px")}>
                <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px")}>
                  <span style={sx("font-size:12.5px;color:var(--text-muted)")}>Rol</span>
                  <div style={sx("width:180px")}>
                    <Select
                      size="sm"
                      aria-label={u.name + " rolü"}
                      value={u.role}
                      disabled={readOnly}
                      onChange={(e) => {
                        // Rol değişince eski kapsam anlamını yitirir: sıfırlanır.
                        AD.setUser(u.id, { role: e.target.value, officer: null, place: null });
                        refresh();
                        say("Rol güncellendi · " + (R[e.target.value]?.tr || e.target.value));
                      }}
                    >
                      {Object.keys(R).map((k) => (
                        <option key={k} value={k}>{R[k].tr}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                {!!sc && (
                  <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px")}>
                    <span style={sx("font-size:12.5px;color:var(--text-muted)")}>{sc === "place" ? "Han" : "Bölge"}</span>
                    <div style={sx("width:180px")}>
                      <Select
                        size="sm"
                        aria-label={u.name + " kapsamı"}
                        value={(sc === "place" ? u.place : u.officer) || ""}
                        disabled={readOnly}
                        onChange={(e) => {
                          AD.setUser(u.id, sc === "place" ? { place: e.target.value || null } : { officer: e.target.value || null });
                          refresh();
                          say("Kapsam güncellendi");
                        }}
                      >
                        <option value="">Seçilmemiş</option>
                        {sc === "place"
                          ? placeOpts().map((p) => <option key={p.id} value={p.id}>{p.name}</option>)
                          : Object.keys(SC.OFFICERS).map((k) => <option key={k} value={k}>{SC.OFFICERS[k].name}</option>)}
                      </Select>
                    </div>
                  </div>
                )}

                <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px")}>
                  <span style={sx("font-size:12.5px;color:var(--text-muted)")}>Şifre</span>
                  <span style={sx("font-size:12.5px;font-weight:600;color:var(--color-" + (pin ? "success" : "warning") + ")")}>
                    {pin ? "Kurulu" : "Kurulmadı"}
                  </span>
                </div>
                <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px")}>
                  <span style={sx("font-size:12.5px;color:var(--text-muted)")}>Son giriş</span>
                  <span style={sx("font-size:12.5px;color:var(--text-body)")}>{fmt(u.lastSeen)}</span>
                </div>
              </div>

              <div style={sx("margin-top:13px;padding-top:13px;border-top:1px solid var(--border-default);display:flex;gap:8px;flex-wrap:wrap")}>
                <Button
                  variant="light"
                  color="primary"
                  size="sm"
                  disabled={readOnly}
                  onClick={() => {
                    void AUTH.resetRequest({ userId: u.id }).then((r) => {
                      if (!r.ok) return say(r.msg || "Kod üretilemedi — yönetici oturumu gerekir");
                      setCodes((s) => ({ ...s, [u.id]: r.demoCode || null }));
                      refresh();
                      say("Sıfırlama kodu üretildi");
                    });
                  }}
                >
                  Şifre sıfırlama kodu
                </Button>
                <Button
                  variant="light"
                  color="secondary"
                  size="sm"
                  disabled={readOnly}
                  onClick={() => {
                    AD.setUser(u.id, { active: !u.active });
                    refresh();
                    say(u.active ? "Hesap kapatıldı" : "Hesap açıldı");
                  }}
                >
                  {u.active ? "Hesabı kapat" : "Hesabı aç"}
                </Button>
                <Button
                  variant="ghost"
                  color="danger"
                  size="sm"
                  disabled={readOnly}
                  onClick={() => {
                    AD.dropUser(u.id);
                    refresh();
                    say("Kullanıcı silindi");
                  }}
                >
                  Sil
                </Button>
              </div>

              {!!code && (
                <div style={sx("margin-top:11px;padding:11px 13px;border-radius:9px;background:var(--color-info-soft);color:var(--color-info);font-size:12.5px;font-weight:600;text-wrap:pretty")}>
                  {"Sıfırlama kodu: " + code + " · " + AD.RESET_TTL_MIN +
                    " dakika geçerli, tek kullanımlık. Üretimde bu kod " + AD.maskTel(u.tel) + " numarasına SMS ile gider."}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Drawer
        open={formOpen}
        onClose={() => { setFormOpen(false); setErrs({}); }}
        title="Kullanıcı Ekle"
        subtitle="Yetki rolden gelir — ekranlar ve eylemler role göre açılır"
        footer={
          <div style={sx("display:flex;gap:10px;justify-content:flex-end")}>
            <Button variant="ghost" color="dark" onClick={() => { setFormOpen(false); setErrs({}); }}>Vazgeç</Button>
            <Button color="primary" onClick={save}>Kullanıcıyı ekle</Button>
          </div>
        }
      >
        <div style={sx("display:flex;flex-direction:column;gap:16px")}>
          <Input
            label="Ad soyad"
            placeholder="Ayşe Tuna"
            error={errs.name}
            value={f.name}
            onChange={(e) => { setF({ ...f, name: e.target.value }); setErrs({ ...errs, name: undefined }); }}
          />
          <Input
            label="Telefon"
            placeholder="0532 000 00 00"
            hint="Giriş bu numarayla yapılır"
            error={errs.tel}
            value={f.tel}
            onChange={(e) => { setF({ ...f, tel: e.target.value }); setErrs({ ...errs, tel: undefined }); }}
          />
          <Select
            label="Rol"
            value={f.role}
            onChange={(e) => setF({ ...f, role: e.target.value, scope: "" })}
          >
            {Object.keys(R).map((k) => (
              <option key={k} value={k}>{R[k].tr + " · " + R[k].note}</option>
            ))}
          </Select>

          {!!selScope && (
            <Select
              label={selScope === "place" ? "Han" : "Bölge"}
              hint={selScope === "place"
                ? "Bu kullanıcı yalnız bu hanın kayıtlarını görür"
                : "Bu yetkilinin sorumlu olduğu bölge"}
              value={f.scope}
              onChange={(e) => setF({ ...f, scope: e.target.value })}
            >
              <option value="">Seçilmemiş</option>
              {selScope === "place"
                ? placeOpts().map((p) => <option key={p.id} value={p.id}>{p.name}</option>)
                : Object.keys(SC.OFFICERS).map((k) => <option key={k} value={k}>{SC.OFFICERS[k].name}</option>)}
            </Select>
          )}

          <div style={sx("padding:13px 15px;border-radius:10px;background:var(--surface-muted);border:1px solid var(--border-default);font-size:12.5px;color:var(--text-body);text-wrap:pretty")}>
            {roleNote}
          </div>
        </div>
      </Drawer>
    </>
  );
}
