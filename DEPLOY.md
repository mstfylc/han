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
git checkout claude/design-screens-coding-3il7b6  # (ya da main'e merge sonrası main)
DOMAIN=han.alanadi.com docker compose up -d --build
```

Bitti: `https://han.alanadi.com` yayında, sertifika kendiliğinden alınır.

- **Veri**: `han-data` adlı Docker volume'ünde; `docker compose up/down/build`
  veriye dokunmaz.
- **Güncelleme**: `git pull && DOMAIN=... docker compose up -d --build`
- **Yedek**: `docker compose exec app node scripts/backup-db.mjs`
  (crontab önerisi: `17 3 * * * cd /root/han && docker compose exec -T app node scripts/backup-db.mjs`)
- **Log**: `docker compose logs -f app`

## Yol B — PM2 + Nginx (Docker istemiyorsanız)

```bash
# Node 20+ kurulu sunucuda:
git clone https://github.com/mstfylc/han.git && cd han
npm ci && npm run build
npm i -g pm2
NEXT_PUBLIC_SITE_URL=https://han.alanadi.com pm2 start npm --name han -- start
pm2 save && pm2 startup
# nginx: 443 → proxy_pass http://127.0.0.1:3000; certbot ile TLS.
```

Veri `./.data/han.db` dosyasındadır; yedeği `node scripts/backup-db.mjs` alır.

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
  Sunucuda ilk `docker compose up --build` sırasında beklenmedik şekilde
  `better-sqlite3` derleme hatası görürseniz Dockerfile'daki ilk aşamaya
  şu satırı ekleyin: `RUN apt-get update && apt-get install -y python3 make g++`.

- **Demo/ölçek verisi**: uygulama, tasarımın 1.385 kayıtlık ölçek verisiyle
  açılır (gerçekçi ama sentetik kayıtlar; 11 küratörlü gerçek dükkân profili
  dahil). Gerçek saha verisi bunların üzerine panelden girilir. Sentetik
  kataloğun yayında kalıp kalmayacağı bir ürün kararıdır — kalksın derseniz
  tek seferlik temizlik yaparız.
- **SMS**: sağlayıcı bağlanana kadar şifre kodları ekranda görünür (ekip içi
  kullanım için yeterli). Bağlamak için README → "SMS sağlayıcısı".
- **Ölçek**: tek süreç + SQLite gündelik operasyon (onlarca eşzamanlı
  kullanıcı) için rahat yeter; halka açık yoğun trafik aşamasında Postgres'e
  geçiş planlanır (depo katmanı bu takas için tasarlandı).
- **Ödeme (M4)**: bilinçli olarak yazılmadı — README'deki açık karar.
