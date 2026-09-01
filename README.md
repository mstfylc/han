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
cp .env.example .env.local     # DATABASE_URL'i kendi Postgres'ine göre düzenle
npm run pg                     # yerelde Postgres başlatır + şemayı uygular (isteğe bağlı)
npm run dev                    # geliştirme — http://localhost:3000
# veya
npm run build && npm start
```

Şema ilk istekte kendiliğinden uygulanır (`db/schema.sql`, idempotent).
`DATABASE_URL` yoksa `/api/state` 500 döner ve uygulama yalnız yerel aynayla
çalışır — tek tarayıcıda çalışır, cihazlar arası paylaşım olmaz.

İlk açılışta `/giris` → **İlk yöneticiyi kur** → ekrandaki kodla şifreni
belirle → panel açılır. (SMS sağlayıcısı bağlı olmadığı için sıfırlama kodu
yalnız geliştirmede ekrana düşer; üretimde dönmez.)

## Mimari

- **Veri motoru** — `src/data/`: prototipin ölçek katmanı (14.716 birim,
  1.385 kayıt), arama (4 dilli eşanlam sözlüğü), dağıtım/teklif motoru,
  yönetim kararları. `npm run parity` motorun prototiple birebir olduğunu
  doğrular; bu yüzden motor yeniden yazılmadı, kopyalanıp tiplendi.
- **Kalıcılık** — paylaşılan `han-*` depoları Postgres'te yaşar
  (`/api/state` → `documents` tablosu, jsonb belge deposu; kararlar ayrıca
  `decisions` append-only defterine yazılır). Tarayıcı açılışta beslenir ve
  4 saniyede bir çeker (`src/services/sync.ts`); okuma yerel aynadan
  senkron kalır, yazma write-through gider — iki cihaz aynı çarşıyı görür.
  Hangi anahtarın paylaşıldığı **tek yerde** tanımlıdır
  (`src/services/scopes.ts`) ve hem istemci hem API onu okur; burada
  ayrışma bir gizlilik hatası olurdu. Cihaza özel anahtarlar (esnaf
  oturumu, tema, dil/para tercihi) bilerek yerel kalır; `han-auth-v1`
  tarayıcıdan **hiç çıkmaz** ve API onu reddeder.
- **Kimlik** — `/api/auth`: şifre sunucuda scrypt ile hash'li, 5 hatalı
  denemede kilit (sayaç sunucuda), tek kullanımlık + 15 dk geçerli sıfırlama
  kodu (yalnız hash'i saklanır, tek-kullanım `UPDATE`'in kendisinde zorlanır),
  httpOnly çerez oturumu. Panelde rol **oturumdan** gelir — kullanıcının
  seçtiği bir rol, rol değildir. Sekme gizlemek kullanılabilirliktir; kararı
  kimin verebileceğine `/api/state` karar verir ve aynı `ROLES` tablosunu
  okur.
- **Tasarım kaynağı** — `design/project/`: `.dc.html` ekranlar, tasarım
  sistemi token'ları (`src/styles/tokens/` bunlardan üretildi) ve plan
  dokümanları (`WEB-PLAN.md`, `ADMIN-PLANI.md`, …). UI bu kaynaktan birebir
  taşınmıştır.

## Mobil

Ayrı bir mobil kod tabanı **bilinçli olarak yok** (tasarım kararı M1:
mobil prototip emekliye ayrıldı — web telefonda çalışır). Mobil ürün,
responsive web + **PWA**'dır: site telefona uygulama olarak kurulur
(Ana Ekrana Ekle), tam ekran açılır, kısayollar taşır (Ara · Harita ·
Plan · İşlerim) ve service worker statik kabuğu çevrimdışı tutar
(`public/manifest.webmanifest`, `public/sw.js`). Dil ve para birimi
cihaza özeldir; paylaşılan çarşı durumundan ayrı tutulur. Mobil tarama
smoke'ta 390px'te yatay taşma sıfır olarak doğrulanır.

## Bildirim kanalı (isteğe bağlı)

Şifre sıfırlama kodu, sağlayıcı bağlanana kadar geliştirmede ekrana düşer.
Bağlamak için ortam değişkenleri yeterlidir — kod değişikliği gerekmez
(`src/server/notify.ts`):

```bash
HAN_NOTIFY_DRIVER=webhook  HAN_NOTIFY_WEBHOOK=https://…   # genel amaçlı POST
```

Sağlayıcı tanımlı değilken sürücü `log`'dur: yüksek sesle uyarır ve
`{ok:false}` döner — eksik sağlayıcı hiçbir zaman çalışan bir sağlayıcı gibi
görünmez.

## Dağıtım

`DEPLOY.md` tek sunucuya kurulumu anlatır: `Dockerfile` + `docker-compose.yml`
(uygulama + Postgres + Caddy ile otomatik HTTPS) ve `scripts/backup-db.mjs`
ile yedek.

## Ürün kararı — M4 · Ticaretin kapanışı

Tasarım sürecinde iki karar çelişik kaldı: karma model (küçük perakendede
ödeme HAN üzerinden, toptanda ticaret teklifte biter) ↔ v1 kapsamının
"işleme girmez" demesi (`design/project/DENETIM-PLANI.md` §3). **Ürün sahibi
K1'i geçerli saydı: v1 ödeme almaz.** Ticaretin kapanış noktası kabul edilen
tekliftir; ödeme kolu bu yüzden yazılmadı — eksik değil, kapsam dışı.

## Doğrulama

| Komut | Ne kanıtlar |
|---|---|
| `npm run typecheck` | Tip bütünlüğü |
| `npm run lint` | Sıfır hata; React Compiler uyarıları `eslint.config.mjs`'te gerekçeli |
| `npm run parity` | Port edilmiş motor prototiple **birebir** aynı (1.385 kayıt) |
| `npm run smoke` | Rotalar × {tr, ar} + 390px; konsol hatası, sızan `undefined`/`NaN`, `lang`/`dir`, yatay taşma |
| `npm run loop` | Sahiplenme → onay → esnaf paneli döngüsü kapalı (E1 ve E3 dahil) |
| `npm run crossdevice` | Pazar gerçekten paylaşılıyor: iki ayrı tarayıcı birbirini görüyor |
| `npm run auth` | Giriş gerçekten kimlik doğrulaması: şifre sızmıyor, çerez httpOnly, kilit sunucuda, kod tek kullanımlık; yazma yolu role bağlı |
| `npm run panel` | Yönetim sekmelerinin hepsi gerçekten render ediyor; salt-okuma eylem alamıyor, yetkisiz rol sekmeye giremiyor |
| `npm run flows` | Denetim raporundaki **yedi akışın** tamamı uçtan uca yürüyor (K9, K3 dahil) |
| `npm run copykeys` | Her `W()`/`F()` çağrısı gerçekten var olan bir anahtarı gösteriyor — eksik anahtar sessizce boş basar |

`smoke` üretim sunucusu ister (`bash scripts/serve.sh`, :3000).
`loop`, `crossdevice` ve `auth` geliştirme sunucusu ister (`bash scripts/serve-dev.sh`, :3001)
— şifre sıfırlama kodu yalnız geliştirmede döner, üretimde dönmez ve `auth` bunu ayrıca
üretim sunucusuna karşı doğrular.

> `loop`, `crossdevice` ve `auth` yerel veritabanındaki tabloları sıfırlar ve
> `DATABASE_URL` localhost'u göstermiyorsa çalışmayı reddeder.

Tüm zincir her push'ta GitHub Actions'ta koşar (`.github/workflows/ci.yml`).
