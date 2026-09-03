# HAN — Sunucuya Kurulum

Hedef: yarın sabah ekip çalışmaya başlasın. İki yol var; **Yol A önerilir**
(tek komut, otomatik HTTPS).

## Yarın için ön koşullar (bu ikisi olmadan başlamayın)

1. **Sunucu**: 1 vCPU / 1 GB RAM yeterli (Hetzner/DO/Vultr ~5 $/ay), Ubuntu 22.04+.
2. **Alan adı**: `han.alanadi.com` gibi bir A kaydı sunucu IP'sine yönlenmiş
   olmalı. **HTTPS şart** — PWA kurulumunun (telefona uygulama olarak ekleme)
   ve güvenli çerezin çalışması buna bağlı.

## Yol A — Docker Compose (önerilen, ~10 dakika)

```bash
# sunucuda:
curl -fsSL https://get.docker.com | sh          # docker yoksa
git clone https://github.com/mstfylc/han.git && cd han
git checkout feat/han-web        # (ana dala merge sonrası ana dal)
DOMAIN=han.alanadi.com POSTGRES_PASSWORD="$(openssl rand -hex 24)" \
  docker compose up -d --build
```

Bitti: `https://han.alanadi.com` yayında, sertifika kendiliğinden alınır.

> `POSTGRES_PASSWORD` her `docker compose` çağrısında aynı olmalı — Postgres onu
> ilk açılışta veri dizinine yazar, sonra değişirse uygulama bağlanamaz. Kalıcı
> yer: repo kökünde `.env` dosyası (`POSTGRES_PASSWORD=...`), compose onu
> kendiliğinden okur.

- **Veri**: `han-pg` adlı Docker volume'ünde, Postgres'in kendi veri dizininde;
  `docker compose up/down/build` veriye dokunmaz. Şema ilk istekte kendiliğinden
  uygulanır (`db/schema.sql`, idempotent) — elle migration adımı yok.
- **Güncelleme**: `git pull && DOMAIN=... docker compose up -d --build`
- **Yedek**: `docker compose exec app npm run backup`
  (crontab önerisi: `17 3 * * * cd /root/han && docker compose exec -T app npm run backup`)
  Yedekler `han-backups` volume'ünde `han-YYYYMMDD-HHmm.sql.gz` olarak durur;
  son 30 tanesi tutulur. Geri yükleme:
  `gunzip -c han-....sql.gz | docker compose exec -T db psql -U han -d han`
- **Log**: `docker compose logs -f app`

## Yol A2 — Sunucuda zaten başka siteler varken

Yol A kendi Caddy'sini getirir ve 80/443'ü tutar. Sunucuda hâlihazırda
nginx/apache/Caddy ile yayınlanan siteler varsa o portlar doludur ve yığın
ayağa kalkmaz. O durumda ikinci bir compose dosyası devreye girer:

```bash
POSTGRES_PASSWORD=... docker compose \
  -f docker-compose.yml -f docker-compose.proxy.yml up -d --build
```

Bu, kendi Caddy'sini kapatır ve uygulamayı yalnız `127.0.0.1:3000`'e bağlar;
önüne mevcut vekil sunucudan bir vhost eklersiniz (örnek nginx ve Caddy
blokları `docker-compose.proxy.yml`'nin başında). **`X-Forwarded-Proto`
başlığını iletmeyi atlamayın** — oturum çerezi üretimde `secure` işaretlidir.

HTTPS şart: hem çerez hem PWA kurulumu buna bağlı (`certbot --nginx -d …`).

## Yol B — PM2 + Nginx (Docker istemiyorsanız)

```bash
# Node 20+ ve Postgres 16 kurulu sunucuda:
sudo -u postgres createuser han --pwprompt && sudo -u postgres createdb -O han han
git clone https://github.com/mstfylc/han.git && cd han
npm ci && npm run build
npm i -g pm2
NEXT_PUBLIC_SITE_URL=https://han.alanadi.com \
DATABASE_URL=postgres://han:PAROLA@127.0.0.1:5432/han \
  pm2 start npm --name han -- start
pm2 save && pm2 startup
# nginx: 443 → proxy_pass http://127.0.0.1:3000; certbot ile TLS.
```

Veri Postgres'tedir; yedeği `DATABASE_URL=... npm run backup` alır
(`pg_dump` gerekir: `apt install postgresql-client`).

## Açılış günü akışı (ilk 15 dakika)

1. `https://.../giris` → **İlk yöneticiyi kur** → kendi telefonunuz →
   ekrandaki kodla şifrenizi belirleyin. (Bu ilk kurulumdan sonra korumalı
   veriler yalnız oturumla yazılabilir hale gelir.)
2. Panel → **Kullanıcılar**: ekibi ekleyin (saha yetkilisi/editör/satış…);
   her birine "Şifre sıfırlama kodu" üretip iletin.
3. Panel → **Sistem Ayarları**: yayın kurallarını gözden geçirin
   (onaysız kayıt görünürlüğü, tazelik süresi…).
4. Saha ekibi çalışmaya başlar: **Toplu İçe Aktarma** (han yönetimi
   listeleri) + **Saha Görevleri** + **Mağaza Kayıtları → Mağaza Ekle**.

## Bilinmesi gerekenler

- **Docker imajı**: geliştirme ortamının ağ politikası Docker Hub'ı
  engellediği için imaj orada derlenemedi; Dockerfile'ın yaptığı adımlar
  (npm ci → build → start) aynı Node 22 ortamında birebir doğrulandı.
  **Sunucudaki ilk `docker compose up --build` bu yüzden ilk gerçek denemedir**
  — açılış gününden önce bir kere çalıştırıp görün.

- **Demo/ölçek verisi**: uygulama, tasarımın 1.385 kayıtlık ölçek verisiyle
  açılır (gerçekçi ama sentetik kayıtlar; 11 küratörlü gerçek dükkân profili
  dahil). Gerçek saha verisi bunların üzerine panelden girilir. Sentetik
  kataloğun yayında kalıp kalmayacağı bir ürün kararıdır — kalksın derseniz
  tek seferlik temizlik yaparız.
- **SMS**: sağlayıcı bağlanana kadar şifre kodları **yalnız geliştirmede**
  ekrana düşer; üretimde dönmez ve sunucu logunda görünür. Açılış gününde ilk
  yöneticiyi kurarken kodu `docker compose logs -f app` ile okuyun, ya da önce
  bir sağlayıcı bağlayın — README → "Bildirim kanalı".
- **Ölçek**: tek uygulama süreci + Postgres gündelik operasyon için rahat
  yeter. Yük arttığında uygulama yatay çoğaltılabilir (durum tutmuyor);
  darboğaz önce Postgres'te görünür.
- **Ödeme (M4)**: ürün sahibi K1'i geçerli saydı — v1 ödeme almaz. Ticaretin
  kapanış noktası kabul edilen tekliftir; eksik değil, kapsam dışı.
