"use client";

// Yönetim paneli — onay hattı.
//
// Bu ekranların varlık sebebi tek bir cümle: alıcı yüzeyi `han-approvals-v1`'i
// OKUYOR ama hiçbir yüzey YAZMIYORDU. Esnaf kaydını sahipleniyor, talep
// "bekliyor"da kalıyor, güven merdiveni (beyan → onaylı → aktif) hiç hareket
// etmiyordu. Yazan taraf burası.
//
// EDITOR-PLANI.md'nin kuralları burada uygulanır:
//   E1 · Sahiplenme onayı KAYIT onayı değildir. Sahiplenme kişinin dükkânın
//        sahibi olduğunu doğrular; kaydın bilgilerinin doğruluğunu doğrulamaz.
//        İki ayrı hat, birbirine bağlanmaz.
//   E3 · Onay bir karar, tek tuş değil: neye dayanarak onaylandığı seçilir ve
//        kim/ne zaman ile birlikte denetim izine geçer.
//   E4 · Geri alma ve askıya alma var; yanlış onay düzeltilebilir.
//   E6 · Kuyruk önceliksiz olmaz: talep gelen, şikayet alan, sahiplenme
//        bekleyen ve yüksek birimli yerdeki kayıt öne çıkar.
//   E7 · Üç bildirim otomatik askıya alır ama bu bir ALARM'dır, karar değil —
//        her satır insan kararı bekler.
//   E9 · Kapı kaydı kalıcı, sahiplik geçici: mevcut sahibi olan kapıya yeni
//        talep gelirse eski sahibe 7 gün itiraz süresi tanınır.

import { useParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import * as AD from "@/data/han-admin";
import * as SC from "@/data/han-scale";
import type { ApprovalVia, RecordStatus, ShopRecord } from "@/data/types";
import { Button, EmptyState, Icon, Textarea } from "@/ds";
import { PanelShell, usePanelRole } from "@/components/PanelShell";
import type { PanelTab } from "@/components/PanelShell";
import { KEYS, readKey, writeKey } from "@/services/storage";
import { sx } from "@/lib/sx";
import type { Claim, UserReport } from "@/state/types";

const CARD = "background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:18px 20px;box-shadow:0 3px 4px rgba(0,0,0,.03)";
const KICKER = "font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)";
const H1 = "font-size:23px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin:0";
const SUB = "font-size:14px;color:var(--text-muted);margin-top:4px;max-width:78ch;text-wrap:pretty";

/** E9 · how long the current holder has to object before a door transfers. */
const OBJECTION_DAYS = 7;

const num = (n: number) => (n || 0).toLocaleString("tr-TR");

function tone(t: string) {
  const bg = "var(--color-" + t + "-soft)";
  const fg = "var(--color-" + t + (t === "warning" || t === "primary" ? "-accent" : "") + ")";
  return { bg, fg };
}

function Pill({ label, t }: { label: string; t: string }) {
  const c = tone(t);
  return (
    <span style={sx("display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:6px;font-size:12px;font-weight:700;background:" + c.bg + ";color:" + c.fg)}>
      {label}
    </span>
  );
}

export default function PanelPage() {
  return (
    <Suspense fallback={null}>
      <PanelScreen />
    </Suspense>
  );
}

function PanelScreen() {
  const params = useParams<{ tab?: string[] }>();
  const router = useRouter();
  const [role, setRole] = usePanelRole();

  // Everything below is read from storage AFTER mount and re-read whenever a
  // decision is written. Reading during render would disagree with the server's
  // render and would be one more impure read to unpick when the API lands.
  const [rev, setRev] = useState(0);

  // One snapshot, set once. Five separate setState calls would have queued five
  // renders for a single load; the queues below all read from this object, so
  // they recompute together and can never show a half-loaded mix.
  interface Snapshot {
    ready: boolean;
    claims: Record<string, Claim>;
    reports: UserReport[];
    approvals: Record<string, SC.ApprovalDecision>;
    reportStates: Record<string, AD.ReportState>;
  }
  const [snap, setSnap] = useState<Snapshot>({
    ready: false, claims: {}, reports: [], approvals: {}, reportStates: {},
  });
  const { ready, claims, reports, approvals, reportStates } = snap;

  useEffect(() => {
    // The engine's decisions have to be re-applied on every read: each surface
    // loads its own copy of the modules, so writing in one place is not enough.
    SC.loadSettings();
    SC.loadPlaces();
    SC.loadDrafts();
    const ap = SC.allApprovals();
    SC.applyApprovals(ap);
    const rp = readKey<UserReport[]>(KEYS.reports, []);
    const counts: Record<string, number> = {};
    rp.forEach((x) => { if (x.recordId) counts[x.recordId] = (counts[x.recordId] || 0) + 1; });
    SC.applyReports(counts);
    setSnap({
      ready: true,
      approvals: ap,
      reports: rp,
      claims: readKey<Record<string, Claim>>(KEYS.claims, {}),
      reportStates: AD.allReportStates(),
    });
  }, [rev]);

  const refresh = useCallback(() => setRev((n) => n + 1), []);

  const [toast, setToast] = useState<string | null>(null);
  const say = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  }, []);

  // ── derived queues ──────────────────────────────────────────────────────

  const reportCounts = useMemo(() => {
    const c: Record<string, number> = {};
    reports.forEach((x) => { if (x.recordId) c[x.recordId] = (c[x.recordId] || 0) + 1; });
    return c;
  }, [reports]);

  const pendingClaims = useMemo(
    () => Object.keys(claims).filter((id) => claims[id]?.status === "bekliyor"),
    [claims],
  );

  const suspended = useMemo(
    () => (ready ? SC.RECORDS.filter((r) => r.status === "askida") : []),
    [ready, rev], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * E6 · the declaration queue, ordered by what actually deserves an officer's
   * next hour rather than by record id.
   *
   * The signals are the ones the plan names: a record buyers are already asking
   * about, a record someone reported, a record with an ownership claim waiting,
   * and a record sitting in a place with many units (where one visit closes
   * many doors at once).
   */
  const queue = useMemo(() => {
    if (!ready) return [];
    const placeUnits: Record<string, number> = {};
    SC.PLACES.forEach((p) => { placeUnits[p.id] = p.units; });
    const maxUnits = Math.max(1, ...Object.values(placeUnits));
    return SC.RECORDS
      .filter((r) => r.status === "beyan")
      .map((r) => {
        const reported = reportCounts[r.id] || 0;
        const claimed = claims[r.id]?.status === "bekliyor" ? 1 : 0;
        const density = (placeUnits[r.place] || 0) / maxUnits;
        // Weighted so a reported record always outranks a merely dense one.
        const score = reported * 100 + claimed * 60 + density * 30 + (r.band ? 5 : 0);
        return { r, reported, claimed, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 60);
  }, [ready, rev, reportCounts, claims]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * E9 · ownership conflicts. A door's record is permanent, its ownership is
   * not: when a claim arrives for a record someone already holds, the current
   * holder gets a window to object before anything transfers.
   */
  const conflicts = useMemo(() => {
    const byRecord: Record<string, Claim[]> = {};
    Object.values(claims).forEach((c) => {
      if (!c?.record) return;
      (byRecord[c.record] = byRecord[c.record] || []).push(c);
    });
    return Object.keys(byRecord)
      .filter((id) => byRecord[id].length > 1 && byRecord[id].some((c) => c.status === "onayli"))
      .map((id) => ({ recordId: id, rows: byRecord[id] }));
  }, [claims]);

  // ── writers ─────────────────────────────────────────────────────────────

  const saveClaims = useCallback((next: Record<string, Claim>) => {
    writeKey(KEYS.claims, next);
    refresh();
  }, [refresh]);

  const [via, setVia] = useState<ApprovalVia>("han");
  const [officer, setOfficer] = useState<string>("");

  const decide = useCallback((ids: string[], status: RecordStatus, note: string) => {
    if (SC.isReadOnly(role)) return say("Salt okuma rolü karar veremez");
    if (!ids.length) return say("Önce kayıt seçin");
    SC.setApprovals(ids, status, { via, officer: officer || null });
    refresh();
    say(note);
  }, [role, via, officer, refresh, say]);

  // ── tabs ────────────────────────────────────────────────────────────────

  const TABS: PanelTab[] = [
    { id: "ozet", label: "Özet", icon: "home", perm: "ozet" },
    { id: "sahiplenme", label: "Sahiplenme", icon: "profile-circle", perm: "sahiplenme", count: pendingClaims.length },
    { id: "kuyruk", label: "Beyan Kuyruğu", icon: "notepad", perm: "kuyruk", count: queue.length },
    { id: "toplu", label: "Toplu Onay", icon: "verify", perm: "toplu" },
    { id: "sikayet", label: "Şikayet Triyajı", icon: "shield", perm: "sikayet", count: Object.keys(reportCounts).length },
    { id: "askidakiler", label: "Askıdakiler", icon: "trash", perm: "askidakiler", count: suspended.length },
    { id: "defter", label: "Karar Defteri", icon: "files", perm: "defter" },
    // Faz 4 · henüz yazılmadı. Boş sekme göstermektense açıkça "yakında" der.
    { id: "kayitlar", label: "Mağaza Kayıtları", icon: "files", perm: "kayitlar", soon: true },
    { id: "talepler", label: "Alıcı Talepleri", icon: "notepad", perm: "talepler", soon: true },
    { id: "teklifler", label: "Teklif Denetimi", icon: "chart-line-up", perm: "teklifler", soon: true },
    { id: "yorumlar", label: "Yorum Denetimi", icon: "star", perm: "yorum", soon: true },
    { id: "alicilar", label: "Alıcı Doğrulama", icon: "verify", perm: "alicilar", soon: true },
    { id: "gorevler", label: "Saha Görevleri", icon: "rocket", perm: "gorevler", soon: true },
    { id: "kalite", label: "Veri Kalitesi", icon: "shield", perm: "kalite", soon: true },
    { id: "iceaktar", label: "Toplu İçe Aktarma", icon: "folder", perm: "iceaktar", soon: true },
    { id: "yerler", label: "Yerler", icon: "category", perm: "yerler", soon: true },
    { id: "sozluk", label: "Arama Sözlüğü", icon: "magnifier", perm: "sozluk", soon: true },
    { id: "icerik", label: "Etkinlik & Kampanya", icon: "calendar", perm: "icerik", soon: true },
  ];

  const raw = params.tab?.[0] || "ozet";
  const tab = TABS.some((t) => t.id === raw) ? raw : "ozet";
  const current = TABS.find((t) => t.id === tab)!;
  const allowed = SC.can(role, current.perm);

  return (
    <PanelShell tabs={TABS} active={tab} role={role} onRole={setRole}>
      {!ready ? (
        <div style={sx(CARD)}>
          <div style={sx("font-size:14px;color:var(--text-muted)")}>Ölçek verisi ve kararlar yükleniyor…</div>
        </div>
      ) : !allowed ? (
        <EmptyState
          icon="lock"
          tone="neutral"
          title="Bu bölüm rolünüzde yok"
          description={SC.ROLES[role].tr + " — " + SC.ROLES[role].note + ". Bölüme erişmesi gereken biri varsa rolü Yetkililer'den değiştirilir."}
        />
      ) : current.soon ? (
        <EmptyState
          icon="rocket"
          tone="neutral"
          title={current.label + " henüz yazılmadı"}
          description="Onay hattı önce geldi: kayıt durumunu değiştirebilen tek yüzey bu olduğu için sırayı o aldı. Bu sekme sonraki turda gelecek — boş bir ekran göstermektense açıkça söylüyoruz."
        />
      ) : (
        <>
          {tab === "ozet" && (
            <Ozet queue={queue} claims={pendingClaims.length} suspended={suspended.length} reports={reportCounts} />
          )}

          {tab === "sahiplenme" && (
            <Sahiplenme
              claims={claims}
              conflicts={conflicts}
              readOnly={SC.isReadOnly(role)}
              onSave={saveClaims}
              say={say}
            />
          )}

          {tab === "kuyruk" && (
            <Kuyruk
              rows={queue}
              via={via} setVia={setVia}
              officer={officer} setOfficer={setOfficer}
              readOnly={SC.isReadOnly(role)}
              decide={decide}
            />
          )}

          {tab === "toplu" && (
            <Toplu
              via={via} setVia={setVia}
              officer={officer} setOfficer={setOfficer}
              readOnly={SC.isReadOnly(role)}
              decide={decide}
            />
          )}

          {tab === "sikayet" && (
            <Sikayet
              reportCounts={reportCounts}
              reports={reports}
              states={reportStates}
              readOnly={SC.isReadOnly(role)}
              onDecide={(recordId, status, note) => {
                AD.setReportState(recordId, { status, note, officer: officer || null });
                // E7 · the human decision is what moves the record, not the counter.
                if (status === "reddedildi") SC.setApprovals([recordId], "onayli", { via, officer: officer || null });
                if (status === "dogrulandi") SC.setApprovals([recordId], "askida", { via, officer: officer || null });
                refresh();
                say("Karar işlendi");
              }}
            />
          )}

          {tab === "askidakiler" && (
            <Askidakiler
              rows={suspended}
              reportCounts={reportCounts}
              readOnly={SC.isReadOnly(role)}
              onReinstate={(id) => decide([id], "onayli", "Kayıt yeniden yayında")}
            />
          )}

          {tab === "defter" && <Defter approvals={approvals} />}
        </>
      )}

      {toast && (
        <div
          role="status"
          style={sx("position:fixed;inset-inline:0;bottom:22px;display:flex;justify-content:center;z-index:60;pointer-events:none")}
        >
          <span style={sx("background:var(--color-primary);color:#fff;font-size:14px;font-weight:600;padding:11px 18px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.22)")}>
            {toast}
          </span>
        </div>
      )}
    </PanelShell>
  );
}

// ── Özet ──────────────────────────────────────────────────────────────────

function Ozet({
  queue, claims, suspended, reports,
}: {
  queue: { r: ShopRecord }[];
  claims: number;
  suspended: number;
  reports: Record<string, number>;
}) {
  const totals = SC.SCALE_TOTALS;
  const open = SC.RECORDS.filter((r) => r.status === "onayli" || r.status === "aktif").length;
  const cover = Math.round((open / Math.max(1, totals.units)) * 100);

  const cards = [
    { label: "Fiziki birim", value: num(totals.units), note: "Adres omurgasının tamamı" },
    { label: "Açık kayıt", value: num(open), note: "%" + cover + " kapsama — geri kalanı hâlâ kapalı kapı" },
    { label: "Bekleyen sahiplenme", value: num(claims), note: "Esnaf kendi kaydını istiyor" },
    { label: "Beyan kuyruğu", value: num(queue.length), note: "Onay bekleyen, önceliklendirilmiş" },
    { label: "Askıdaki kayıt", value: num(suspended), note: "Bildirim eşiği aşıldı" },
    { label: "Şikayet alan kayıt", value: num(Object.keys(reports).length), note: "İnsan kararı bekliyor" },
  ];

  return (
    <>
      <h1 style={sx(H1)}>Özet</h1>
      <p style={sx(SUB)}>
        Bu sayılar tek kaynaktan gelir: ölçek katmanı, editör kararları ve alıcının gerçek bildirimleri.
        Panelin kendi demo verisi yoktur — gördüğünüz sayı alıcının gördüğü sayıdır.
      </p>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:14px;margin-top:18px")}>
        {cards.map((c) => (
          <div key={c.label} style={sx(CARD)}>
            <div style={sx(KICKER)}>{c.label}</div>
            <div style={sx("font-size:30px;font-weight:700;color:var(--text-heading);letter-spacing:-.02em;margin-top:6px;font-variant-numeric:tabular-nums")}>{c.value}</div>
            <div style={sx("font-size:13px;color:var(--text-muted);margin-top:4px;text-wrap:pretty")}>{c.note}</div>
          </div>
        ))}
      </div>

      <div style={sx("margin-top:18px;" + CARD)}>
        <div style={sx(KICKER)}>Kapsama nasıl kapanır</div>
        <p style={sx("font-size:14px;color:var(--text-body);margin-top:8px;text-wrap:pretty")}>
          Kapsama tek tek dükkânla değil han han kapatılır. Han yönetiminin kiracı listesiyle bir yetkili
          bir günde 500 dükkânı onaylayabilir; saha turu ise günde 40–60 birim ilerler. Bu yüzden
          <strong> Toplu Onay</strong> sekmesi tek tek onaydan önce gelir.
        </p>
      </div>
    </>
  );
}

// ── Sahiplenme ────────────────────────────────────────────────────────────

function Sahiplenme({
  claims, conflicts, readOnly, onSave, say,
}: {
  claims: Record<string, Claim>;
  conflicts: { recordId: string; rows: Claim[] }[];
  readOnly: boolean;
  onSave: (next: Record<string, Claim>) => void;
  say: (m: string) => void;
}) {
  const ids = Object.keys(claims);
  const rows = ids
    .map((id) => ({ id, c: claims[id], r: SC.RECORDS.find((x) => x.id === id) }))
    .filter((x): x is { id: string; c: Claim; r: ShopRecord } => !!x.r)
    .sort((a, b) => (b.c.status === "bekliyor" ? 1 : 0) - (a.c.status === "bekliyor" ? 1 : 0));

  const proofLabel: Record<string, string> = {
    han: "Han listesiyle eşleşme", belge: "Belge sunuyor", saha: "Saha turu istiyor",
  };

  const set = (id: string, patch: Partial<Claim>, msg: string) => {
    if (readOnly) return say("Salt okuma rolü karar veremez");
    onSave({ ...claims, [id]: { ...claims[id], ...patch } });
    say(msg);
  };

  return (
    <>
      <h1 style={sx(H1)}>Sahiplenme talepleri</h1>
      <p style={sx(SUB)}>
        Sahiplenme, kişinin dükkânın sahibi olduğunu doğrular — kaydın bilgilerinin doğruluğunu değil.
        Bu yüzden bir sahiplenmeyi onaylamak kaydın durumunu <strong>değiştirmez</strong>; kayıt onayı
        ayrı bir karardır ve Beyan Kuyruğu’ndan verilir.
      </p>

      {conflicts.length > 0 && (
        <div style={sx("margin-top:16px;background:var(--color-warning-soft);border:1px solid var(--color-warning);border-radius:14px;padding:16px 18px")}>
          <div style={sx("display:flex;align-items:center;gap:8px")}>
            <Icon name="shield-search" size={17} />
            <strong style={sx("font-size:14.5px;color:var(--color-warning-accent)")}>
              {conflicts.length} kapıda sahiplik çakışması
            </strong>
          </div>
          <p style={sx("font-size:13.5px;color:var(--text-body);margin-top:6px;text-wrap:pretty")}>
            Kapı kaydı kalıcıdır, sahiplik geçicidir. Mevcut sahibe {OBJECTION_DAYS} gün itiraz süresi
            tanınır; itiraz gelmezse devir onaylanır, devirde eski fiyat ve fotoğraflar sıfırlanır.
          </p>
        </div>
      )}

      <div style={sx("display:flex;flex-direction:column;gap:12px;margin-top:16px")}>
        {rows.map(({ id, c, r }) => {
          const t = c.status === "onayli" ? "success" : c.status === "red" ? "danger" : "warning";
          const place = SC.PLACES.find((p) => p.id === r.place);
          return (
            <div
              key={id}
              style={sx("background:var(--surface-card);border:1px solid " + (c.status === "onayli" ? "var(--color-success)" : c.status === "red" ? "var(--color-danger)" : "var(--border-strong)") + ";border-radius:14px;padding:18px 20px")}
            >
              <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
                <div style={sx("min-width:0")}>
                  <div style={sx("font-size:16.5px;font-weight:700;color:var(--text-heading);letter-spacing:-.01em")}>{r.name || c.name}</div>
                  <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px")}>
                    {(place?.name || r.place) + " · " + (r.floor === 0 ? "Zemin" : r.floor + ". kat") + " · No " + r.door}
                  </div>
                </div>
                <Pill label={c.status === "onayli" ? "Onaylandı" : c.status === "red" ? "Reddedildi" : "Bekliyor"} t={t} />
              </div>

              <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:10px;margin-top:14px;font-size:13.5px")}>
                <div><span style={sx("color:var(--text-muted)")}>Talep eden</span><br />{c.owner}</div>
                <div><span style={sx("color:var(--text-muted)")}>Telefon</span><br />{AD.maskTel(c.tel)}</div>
                <div><span style={sx("color:var(--text-muted)")}>Dayanak</span><br />{proofLabel[c.proof] || c.proof}</div>
                <div><span style={sx("color:var(--text-muted)")}>Yetkili</span><br />{SC.OFFICERS[c.officer || ""]?.name || "—"}</div>
              </div>

              {c.status === "bekliyor" && (
                <div style={sx("display:flex;gap:9px;margin-top:16px;flex-wrap:wrap")}>
                  <Button
                    color="primary"
                    size="md"
                    disabled={readOnly}
                    onClick={() => set(id, { status: "onayli" }, r.name + " · sahiplenme onaylandı (kayıt durumu değişmedi)")}
                  >
                    Sahiplenmeyi onayla
                  </Button>
                  <Button
                    variant="outline"
                    color="danger"
                    size="md"
                    disabled={readOnly}
                    onClick={() => set(id, { status: "red", reason: "Yetkili belgeyi doğrulayamadı." }, r.name + " talebi reddedildi")}
                  >
                    Reddet
                  </Button>
                </div>
              )}

              {c.status !== "bekliyor" && !readOnly && (
                <div style={sx("margin-top:14px")}>
                  {/* E4 · a wrong decision has to be correctable. */}
                  <Button variant="ghost" color="dark" size="sm" onClick={() => set(id, { status: "bekliyor" }, "Karar geri alındı")}>
                    Kararı geri al
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {rows.length === 0 && (
          <EmptyState
            icon="profile-circle"
            tone="neutral"
            title="Bekleyen sahiplenme talebi yok"
            description="Esnaf alıcı tarafındaki /esnaf ekranından kaydını bulup talep bıraktığında burada görünür."
          />
        )}
      </div>
    </>
  );
}

// ── Karar başlığı: E3 · dayanak ve yetkili seçimi ─────────────────────────

function DecisionBasis({
  via, setVia, officer, setOfficer,
}: {
  via: ApprovalVia; setVia: (v: ApprovalVia) => void;
  officer: string; setOfficer: (o: string) => void;
}) {
  return (
    <div style={sx("margin-top:16px;" + CARD)}>
      <div style={sx(KICKER)}>Karar dayanağı</div>
      <p style={sx("font-size:13.5px;color:var(--text-muted);margin-top:5px;text-wrap:pretty")}>
        Onay tek tuş değil bir karardır: neye dayanarak onayladığınız, kim olduğunuz ve zamanı
        kayda geçer. Bir kaydın neden onaylı olduğu sonradan sorulabilmeli.
      </p>
      <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:12px")} role="radiogroup" aria-label="Karar dayanağı">
        {(Object.keys(SC.APPROVAL) as ApprovalVia[]).map((k) => {
          const on = via === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setVia(k)}
              style={sx("display:flex;align-items:flex-start;gap:11px;width:100%;padding:12px 13px;border-radius:11px;font-family:inherit;text-align:start;cursor:pointer;background:var(--surface-card);border:1px solid " + (on ? "var(--color-primary)" : "var(--border-default)"))}
            >
              <span style={sx("flex:none;width:16px;height:16px;border-radius:999px;margin-top:2px;border:2px solid " + (on ? "var(--color-primary)" : "var(--border-strong)") + ";background:" + (on ? "var(--color-primary)" : "transparent") + ";box-shadow:" + (on ? "inset 0 0 0 3px var(--surface-card)" : "none"))} />
              <span style={sx("flex:1;min-width:0;font-size:14px;font-weight:600;color:var(--text-heading)")}>
                {SC.APPROVAL[k].tr}
              </span>
            </button>
          );
        })}
      </div>

      <label style={sx("display:block;margin-top:14px")}>
        <span style={sx("display:block;font-size:13px;font-weight:600;color:var(--text-heading);margin-bottom:5px")}>Kararı veren yetkili</span>
        <select
          value={officer}
          onChange={(e) => setOfficer(e.target.value)}
          style={sx("width:100%;max-width:340px;height:40px;padding:0 10px;border-radius:9px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:14px;color:var(--text-body)")}
        >
          <option value="">Belirtilmedi</option>
          {Object.keys(SC.OFFICERS).map((id) => (
            <option key={id} value={id}>{SC.OFFICERS[id].name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

// ── Beyan kuyruğu ─────────────────────────────────────────────────────────

function Kuyruk({
  rows, via, setVia, officer, setOfficer, readOnly, decide,
}: {
  rows: { r: ShopRecord; reported: number; claimed: number }[];
  via: ApprovalVia; setVia: (v: ApprovalVia) => void;
  officer: string; setOfficer: (o: string) => void;
  readOnly: boolean;
  decide: (ids: string[], status: RecordStatus, note: string) => void;
}) {
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const picked = Object.keys(sel).filter((k) => sel[k]);

  return (
    <>
      <h1 style={sx(H1)}>Beyan kuyruğu</h1>
      <p style={sx(SUB)}>
        Sıra kayıt numarasına göre değil, bir yetkilinin bir sonraki saatini hak edene göre kurulur:
        şikayet alan, sahiplenme bekleyen, alıcının sorduğu ve çok birimli yerde duran kayıt öne çıkar.
      </p>

      <DecisionBasis via={via} setVia={setVia} officer={officer} setOfficer={setOfficer} />

      <div style={sx("display:flex;align-items:center;gap:9px;margin-top:16px;flex-wrap:wrap")}>
        <Button
          color="accent"
          size="md"
          disabled={readOnly || !picked.length}
          onClick={() => { decide(picked, "onayli", picked.length + " kayıt onaylandı"); setSel({}); }}
        >
          Seçileni onayla{picked.length ? " · " + picked.length : ""}
        </Button>
        <Button
          variant="outline"
          color="danger"
          size="md"
          disabled={readOnly || !picked.length}
          onClick={() => { decide(picked, "askida", picked.length + " kayıt askıya alındı"); setSel({}); }}
        >
          Askıya al
        </Button>
        {!!picked.length && (
          <Button variant="ghost" color="dark" size="sm" onClick={() => setSel({})}>Seçimi temizle</Button>
        )}
      </div>

      <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:16px")}>
        {rows.map(({ r, reported, claimed }) => {
          const place = SC.PLACES.find((p) => p.id === r.place);
          const on = !!sel[r.id];
          return (
            <div key={r.id} style={sx("display:flex;align-items:center;gap:12px;padding:13px 15px;border-radius:12px;background:var(--surface-card);border:1px solid " + (on ? "var(--color-primary)" : "var(--border-strong)"))}>
              <input
                type="checkbox"
                checked={on}
                disabled={readOnly}
                aria-label={(r.name || r.id) + " seç"}
                onChange={(e) => setSel((s) => ({ ...s, [r.id]: e.target.checked }))}
                style={sx("flex:none;width:17px;height:17px;cursor:pointer")}
              />
              <span style={sx("flex:1;min-width:0")}>
                <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>{r.name || "İsimsiz kayıt"}</span>
                <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                  {(place?.name || r.place) + " · " + (r.floor === 0 ? "Zemin" : r.floor + ". kat") + " · No " + r.door + " · " + num(place?.units || 0) + " birimli yer"}
                </span>
              </span>
              <span style={sx("flex:none;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end")}>
                {reported > 0 && <Pill label={reported + " şikayet"} t="danger" />}
                {claimed > 0 && <Pill label="sahiplenme" t="warning" />}
              </span>
            </div>
          );
        })}

        {rows.length === 0 && (
          <EmptyState icon="verify" tone="primary" title="Kuyruk boş" description="Beyan durumunda onay bekleyen kayıt kalmadı." />
        )}
      </div>
    </>
  );
}

// ── Toplu onay ────────────────────────────────────────────────────────────

function Toplu({
  via, setVia, officer, setOfficer, readOnly, decide,
}: {
  via: ApprovalVia; setVia: (v: ApprovalVia) => void;
  officer: string; setOfficer: (o: string) => void;
  readOnly: boolean;
  decide: (ids: string[], status: RecordStatus, note: string) => void;
}) {
  const [placeId, setPlaceId] = useState("");

  const places = useMemo(
    () => SC.PLACES.slice().sort((a, b) => b.units - a.units),
    [],
  );

  const targets = useMemo(() => {
    if (!placeId) return [];
    return SC.RECORDS.filter((r) => r.place === placeId && r.status === "beyan");
  }, [placeId]);

  const place = places.find((p) => p.id === placeId);
  const stats = placeId ? SC.placeStats(placeId) : null;

  return (
    <>
      <h1 style={sx(H1)}>Toplu onay</h1>
      <p style={sx(SUB)}>
        Kapsamanın motoru budur. Han yönetiminin kiracı listesiyle bir yetkili bir günde bir hanın
        tamamını onaylayabilir; saha turu ise günde 40–60 birim ilerler. Tek tek onay istisnadır,
        kural değil.
      </p>

      <div style={sx("margin-top:16px;" + CARD)}>
        <label style={sx("display:block")}>
          <span style={sx("display:block;font-size:13px;font-weight:600;color:var(--text-heading);margin-bottom:5px")}>Yer</span>
          <select
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            style={sx("width:100%;max-width:460px;height:40px;padding:0 10px;border-radius:9px;border:1px solid var(--border-strong);background:var(--surface-card);font-family:inherit;font-size:14px;color:var(--text-body)")}
          >
            <option value="">Han, çarşı ya da cadde seçin</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>{p.name + " — " + num(p.units) + " birim"}</option>
            ))}
          </select>
        </label>

        {place && stats && (
          <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:12px;margin-top:16px")}>
            <div><div style={sx(KICKER)}>Birim</div><div style={sx("font-size:20px;font-weight:700;color:var(--text-heading);margin-top:3px")}>{num(place.units)}</div></div>
            <div><div style={sx(KICKER)}>Açık kayıt</div><div style={sx("font-size:20px;font-weight:700;color:var(--text-heading);margin-top:3px")}>{num(stats.openRecords)}</div></div>
            <div><div style={sx(KICKER)}>Bu turda onaylanacak</div><div style={sx("font-size:20px;font-weight:700;color:var(--color-accent-active);margin-top:3px")}>{num(targets.length)}</div></div>
          </div>
        )}
      </div>

      <DecisionBasis via={via} setVia={setVia} officer={officer} setOfficer={setOfficer} />

      <div style={sx("margin-top:16px")}>
        <Button
          color="accent"
          size="lg"
          disabled={readOnly || !targets.length}
          onClick={() => decide(targets.map((r) => r.id), "onayli", targets.length + " kayıt onaylandı · " + (place?.name || ""))}
        >
          {targets.length ? num(targets.length) + " kaydı onayla" : "Onaylanacak kayıt yok"}
        </Button>
      </div>
    </>
  );
}

// ── Şikayet triyajı ───────────────────────────────────────────────────────

function Sikayet({
  reportCounts, reports, states, readOnly, onDecide,
}: {
  reportCounts: Record<string, number>;
  reports: UserReport[];
  states: Record<string, AD.ReportState>;
  readOnly: boolean;
  onDecide: (recordId: string, status: AD.ReportStatus, note: string) => void;
}) {
  const [note, setNote] = useState<Record<string, string>>({});
  const ids = Object.keys(reportCounts).sort((a, b) => reportCounts[b] - reportCounts[a]);

  return (
    <>
      <h1 style={sx(H1)}>Şikayet triyajı</h1>
      <p style={sx(SUB)}>
        Üç bildirim bir kaydı kendiliğinden askıya alır — ama otomatik askı bir <strong>alarmdır</strong>,
        karar değil. İnsan bakmadan kalıcı olmaz: doğrularsanız kayıt askıda kalır, reddederseniz geri açılır.
      </p>

      <div style={sx("display:flex;flex-direction:column;gap:12px;margin-top:16px")}>
        {ids.map((id) => {
          const rec = SC.RECORDS.find((r) => r.id === id);
          const st = states[id]?.status || "acik";
          const meta = AD.REPORT_STATES[st];
          const mine = reports.filter((x) => x.recordId === id);
          const place = rec ? SC.PLACES.find((p) => p.id === rec.place) : null;
          return (
            <div key={id} style={sx(CARD)}>
              <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
                <div style={sx("min-width:0")}>
                  <div style={sx("font-size:16px;font-weight:700;color:var(--text-heading)")}>{rec?.name || id}</div>
                  <div style={sx("font-size:13px;color:var(--text-muted);margin-top:3px")}>
                    {rec ? (place?.name || rec.place) + " · No " + rec.door : "Kayıt bulunamadı"} · {reportCounts[id]} bildirim
                  </div>
                </div>
                <Pill label={meta.tr} t={meta.tone} />
              </div>

              <div style={sx("display:flex;flex-direction:column;gap:6px;margin-top:12px")}>
                {mine.slice(0, 5).map((x, i) => (
                  <div key={i} style={sx("font-size:13px;color:var(--text-body);padding:9px 11px;border-radius:9px;background:var(--surface-muted)")}>
                    <strong>{x.reason}</strong>{x.detail ? " — " + x.detail : ""}
                  </div>
                ))}
              </div>

              <div style={sx("margin-top:12px")}>
                <Textarea
                  rows={2}
                  placeholder="Karar gerekçesi — sonradan bu satır okunacak"
                  aria-label="Karar gerekçesi"
                  value={note[id] || ""}
                  onChange={(e) => setNote((s) => ({ ...s, [id]: e.target.value }))}
                />
              </div>

              <div style={sx("display:flex;gap:9px;margin-top:12px;flex-wrap:wrap")}>
                <Button color="primary" size="sm" disabled={readOnly} onClick={() => onDecide(id, "dogrulandi", note[id] || "")}>
                  Doğrulandı · askıda kalsın
                </Button>
                <Button variant="outline" color="primary" size="sm" disabled={readOnly} onClick={() => onDecide(id, "reddedildi", note[id] || "")}>
                  Yersiz · geri aç
                </Button>
                <Button variant="ghost" color="dark" size="sm" disabled={readOnly} onClick={() => onDecide(id, "sahaya", note[id] || "")}>
                  Sahaya ata
                </Button>
              </div>
            </div>
          );
        })}

        {ids.length === 0 && (
          <EmptyState icon="shield" tone="primary" title="Bekleyen şikayet yok" description="Alıcı bir kaydı bildirdiğinde satır burada açılır." />
        )}
      </div>
    </>
  );
}

// ── Askıdakiler ───────────────────────────────────────────────────────────

function Askidakiler({
  rows, reportCounts, readOnly, onReinstate,
}: {
  rows: ShopRecord[];
  reportCounts: Record<string, number>;
  readOnly: boolean;
  onReinstate: (id: string) => void;
}) {
  return (
    <>
      <h1 style={sx(H1)}>Askıdaki kayıtlar</h1>
      <p style={sx(SUB)}>
        Askıya alınan kayıt silinmez — aramada görünmez olur ve fiyat gösteremez. Yanlış askı
        düzeltilebilir olmalı: geri açmak da bir karardır ve defterde iz bırakır.
      </p>

      <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:16px")}>
        {rows.map((r) => {
          const place = SC.PLACES.find((p) => p.id === r.place);
          return (
            <div key={r.id} style={sx("display:flex;align-items:center;gap:12px;padding:13px 15px;border-radius:12px;background:var(--surface-card);border:1px solid var(--color-danger)")}>
              <span style={sx("flex:1;min-width:0")}>
                <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>{r.name || r.id}</span>
                <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px")}>
                  {(place?.name || r.place) + " · No " + r.door}
                  {reportCounts[r.id] ? " · " + reportCounts[r.id] + " bildirim" : ""}
                </span>
              </span>
              <Button variant="outline" color="primary" size="sm" disabled={readOnly} onClick={() => onReinstate(r.id)}>
                Geri aç
              </Button>
            </div>
          );
        })}

        {rows.length === 0 && (
          <EmptyState icon="verify" tone="primary" title="Askıda kayıt yok" description="Hiçbir kayıt bildirim eşiğini aşmamış." />
        )}
      </div>
    </>
  );
}

// ── Karar defteri ─────────────────────────────────────────────────────────

function Defter({ approvals }: { approvals: Record<string, SC.ApprovalDecision> }) {
  const rows = Object.keys(approvals)
    .map((id) => ({ id, d: approvals[id], r: SC.RECORDS.find((x) => x.id === id) }))
    .sort((a, b) => (b.d.at || 0) - (a.d.at || 0));

  return (
    <>
      <h1 style={sx(H1)}>Karar defteri</h1>
      <p style={sx(SUB)}>
        Hiçbir karar sessizce kaybolmaz. Bir kaydın neden onaylı ya da askıda olduğu buradan sorulur:
        kim, ne zaman, neye dayanarak.
      </p>

      <div style={sx("display:flex;flex-direction:column;gap:8px;margin-top:16px")}>
        {rows.map(({ id, d, r }) => (
          <div key={id} style={sx("display:flex;align-items:flex-start;gap:12px;padding:13px 15px;border-radius:12px;background:var(--surface-card);border:1px solid var(--border-strong)")}>
            <span style={sx("flex:1;min-width:0")}>
              <span style={sx("display:block;font-size:14.5px;font-weight:700;color:var(--text-heading)")}>{r?.name || id}</span>
              <span style={sx("display:block;font-size:12.5px;color:var(--text-muted);margin-top:2px;text-wrap:pretty")}>
                {SC.APPROVAL[d.via]?.tr || d.via}
                {d.officer ? " · " + (SC.OFFICERS[d.officer]?.name || d.officer) : " · yetkili belirtilmedi"}
                {d.at ? " · " + new Date(d.at).toLocaleString("tr-TR") : ""}
              </span>
            </span>
            <Pill
              label={d.status === "askida" ? "Askıya alındı" : d.status === "aktif" ? "Aktif" : "Onaylandı"}
              t={d.status === "askida" ? "danger" : "success"}
            />
          </div>
        ))}

        {rows.length === 0 && (
          <EmptyState icon="files" tone="neutral" title="Henüz karar yok" description="Onayladığınız ya da askıya aldığınız her kayıt buraya düşer." />
        )}
      </div>
    </>
  );
}
