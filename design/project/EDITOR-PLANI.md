> **28.08.2026 denetimi:** bu belgedeki bazı ✅ maddeler kodda yarım kalmıştı.
> Bulgular ve düzeltmeler `DENETIM-PLANI.md` içinde; açık kalanlar orada §3'te.

# Editör Planı — kapsama ve onay mantığı

Yer: `HAN Panel.dc.html` → "Kapsama & Onay" (editör artık bağımsız sayfa değil, admin panel içinde).
Mevcut sekmeler: toplu onay · beyan kuyruğu · yetkililer · sahiplenme talepleri · görünürlük karnesi · ölçüm.

## Kusurlar

- [ ] **E1. Sahiplenme onayı ile kayıt onayı karışmış (HATA)** — `onApprove` sahiplenmeyi onaylarken
  kaydı da otomatik `onaylı` yapıyor. Sahiplenme *kişinin sahibi olduğunu* doğrular; kaydın
  *bilgilerinin doğruluğunu* doğrulamaz. İki ayrı hat, birbirine bağlanmamalı.
- [ ] **E2. Onaylar kalıcı değil** — `over[]` yalnız state'te; sayfa yenilenince uçuyor.
  Sahiplenme talepleri `han-claims-v1`'e yazılıyor ama durum onayları hiçbir yere yazılmıyor.
  Gerekli: `han-approvals-v1` deposu (id → {status, via, officer, at}).
- [ ] **E3. Onay bir karar değil, tek tuş** — `APPROVAL` sözlüğü var (han listesi / saha turu /
  esnaf beyanı) ama onaylarken kaynak seçilmiyor, otomatik atanıyor. Denetim izi yok:
  kim, ne zaman, neye dayanarak onayladı.
- [ ] **E4. Geri alma / askıya alma yok** — yanlış onay düzeltilemiyor; `askida` durumu var ama
  editörden tetiklenmiyor.
- [ ] **E5. Rol yok** — `OFFICERS` semte atanmış, ama editör herkesin kuyruğunu görüyor.
  Yetkili yalnız kendi bölgesini görmeli; "kimim ben" seçimi yok.
  K10 gereği bu bir seçim değil **oturum** olmalı (telefon + tek kullanımlı kod).
- [ ] **E6. Kuyruk önceliksiz** — 2000 beyan kaydı düz liste. Gerçek öncelik sinyalleri:
  (a) talep gelen ama onaysız kayıt, (b) şikayet alan kayıt, (c) yeni sahiplenme talebi olan kayıt,
  (d) yüksek birimli yerde duran kayıt.
- [ ] **E7. Şikayet kuyruğu yok** — `applyReports` 3 bildirimde otomatik askıya alıyor, insan
  denetimi olmadan kalıcı hale geliyor. "Askıya alınanlar / itiraz" sekmesi gerekli.
- [ ] **E8. Ölçüm eylem üretmiyor** — kapsama yüzdesi gösteriyor, "bu hafta hangi hana git"
  demiyor. Editörün tek sorusu bu: yüksek birim + düşük kapsama + han yönetimiyle toplu onay
  imkânı olan yer sıralaması. (K7: kuzey yıldızı "karşılık bulan talep" — ölçüm buna göre kurulur.)
- [ ] **E9. Sahiplik çakışma kuyruğu** (K6) — mevcut sahipliği olan kapıya yeni talep gelirse:
  eski sahibe 7 gün itiraz bildirimi, itiraz yoksa devir; itiraz varsa yetkili saha turuyla karar verir.

> Kararlar: `URUN-KARARLARI.md`

> **Durum: E1–E9 uygulandı.** Sahiplenme/kayıt onayı ayrıldı, onaylar `han-approvals-v1`'e
> kalıcı yazılıyor (kaynak + yetkili + zaman izi), onay kaynağı seçimi ve geri alma geldi,
> kuyruk önceliklendi, "Askıya alınanlar" sekmesi ve devir çakışma kuyruğu eklendi,
> ölçüm sekmesi "bu hafta nereye gidilecek" sıralamasıyla eylem üretiyor.

## Sıra
E1 (hata düzeltme) → E2 (kalıcılık, diğer her şeyin önkoşulu) → E3/E4 (karar kalitesi) →
E6/E7 (kuyruk yönetimi) → E5 (rol) → E8 (yönlendirme).
