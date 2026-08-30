# HAN — Tarihi Yarımada'nın kayıt omurgası

Kapalıçarşı'dan Tahtakale'ye 38 yer, 14.716 dükkân birimi için tek kayıt:
alıcıya "hangi han, hangi kat, hangi kapı" der; esnafa talep taşır; yönetim
paneli kapsamayı kapatan saha işinin defterini tutar.

Bu depo, Claude Design'da üretilen HAN tasarımının (bkz. `design/`) birebir
Next.js uygulamasıdır — üç yüzey tek uygulamada:

| Yüzey | Rota | Ne yapar |
|---|---|---|
| **Alıcı** | `/` | Keşfet, ara, kategori/ürün, dükkân, han/sokak/yer, harita, gün planı, İşlerim (talep → teklif → karşı teklif), etkinlikler, 8 araç. TR·EN·RU·AR (RTL dahil), responsive — mobil hedef bu yüzeydir. |
| **Esnaf** | `/esnaf` | Kayıt sahiplenme, gelen talepler (yönetici yönlendirmesi dahil), teklif verme / "cevaplayamam", kayıt düzeltme. |
| **Yönetim** | `/panel` · `/giris` | 26 ekran: onay hattı (sahiplenme, beyan kuyruğu, toplu onay, askı, defter), pazar sağlığı (teklif denetimi + SLA, şikayet triyajı, yorum denetimi, alıcı doğrulama), saha (yerler, görevler, veri kalitesi, toplu içe aktarma, kapsama, yetkililer), gelir (sponsorluk), içerik & arama (sözlük, etkinlik/kampanya, mağaza görselleri, harita & kat planı), sistem (ayarlar, kullanıcılar, temalar). 6 rollü yetki. |

## Çalıştırma

```bash
npm install
npm run dev      # geliştirme — http://localhost:3000
# veya
npm run build && npm start
```

Veritabanı ilk istekle `.data/han.db` (SQLite) olarak kendiliğinden oluşur.
İlk açılışta `/giris` → **İlk yöneticiyi kur** → ekrandaki kodla şifreni
belirle → panel açılır. (SMS sağlayıcısı bağlı olmadığı için sıfırlama kodu
ekranda PROTOTİP etiketiyle gösterilir; üretimde SMS'e taşınır.)

## Mimari

- **Veri motoru** — `src/data/`: prototipin ölçek katmanı (14.716 birim,
  1.385 kayıt), arama (4 dilli eşanlam sözlüğü), dağıtım/teklif motoru,
  yönetim kararları. `npm run parity` motorun prototiple birebir olduğunu
  doğrular.
- **Kalıcılık** — tüm `han-*` depoları sunucuda yaşar (`/api/store`,
  SQLite KV). Tarayıcı açılışta beslenir (`StoreSync`), her yazma
  write-through gider; iki cihaz aynı çarşıyı görür. Cihaza özel anahtarlar
  (esnaf oturumu, demo rol, tema) bilerek yerel kalır.
- **Kimlik** — `/api/auth/*`: şifre sunucuda scrypt ile hash'li, 5 hatalı
  denemede kilit, tek kullanımlık + 15 dk geçerli sıfırlama kodu (hash'i
  saklanır), httpOnly çerez oturumu. İlk kullanıcı oluştuğu andan itibaren
  operasyon anahtarlarına yazmak oturum ister.
- **Tasarım kaynağı** — `design/project/`: `.dc.html` ekranlar, tasarım
  sistemi token'ları (`src/styles/tokens/` bunlardan üretildi) ve plan
  dokümanları (`WEB-PLAN.md`, `ADMIN-PLANI.md`, …). UI bu kaynaktan birebir
  taşınmıştır.

## SMS sağlayıcısı (isteğe bağlı)

Şifre sıfırlama kodu, sağlayıcı bağlanana kadar ekranda PROTOTİP etiketiyle
gösterilir. Bağlamak için ortam değişkenleri yeterlidir — kod değişikliği
gerekmez (`src/server/sms.ts`):

```bash
HAN_SMS_PROVIDER=netgsm  HAN_NETGSM_USER=… HAN_NETGSM_PASS=… HAN_NETGSM_HEADER=…
# veya
HAN_SMS_PROVIDER=twilio  HAN_TWILIO_SID=… HAN_TWILIO_TOKEN=… HAN_TWILIO_FROM=…
```

Sağlayıcı tanımlıyken kod yalnız SMS ile gider; gönderilemezse ekrana
düşmez, kullanıcıdan yeniden denemesi istenir.

## Açık ürün kararı — M4 · Ticaretin kapanışı

Tasarım sürecinde iki karar çelişik kaldı: karma model onaylandı (küçük
perakendede ödeme HAN üzerinden, toptanda ticaret teklifte biter) ↔ v1
kapsamı "işleme girmez" diyor (`design/project/DENETIM-PLANI.md` §3).
Ödeme kolu bilinçli olarak **yazılmadı**: hangisinin geçerli olduğu ve
ödeme sağlayıcısı (iyzico/PayTR/Stripe…) ürün sahibi tarafından karara
bağlanmalı. Bunun dışında plan dokümanlarındaki tüm maddeler uygulandı.

## Doğrulama

```bash
npm run typecheck   # tsc
npm run lint        # eslint
npm run parity      # veri motoru ↔ prototip birebirlik
npm run smoke       # 60 rota: hata/sızıntı/RTL/mobil taraması (sunucu açıkken)
node scripts/backend-check.mjs   # 21 auth+store sözleşme kontrolü (boş HAN_DB_DIR ile)
```
