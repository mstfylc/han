#!/usr/bin/env bash
#
# HAN — demo kurulumu, ÜZERİNDE BAŞKA SİTELER OLAN bir sunucuya.
#
#   bash scripts/install-demo.sh                  # sadece bakar, rapor eder (varsayılan)
#   bash scripts/install-demo.sh --install        # gerçekten kurar
#   bash scripts/install-demo.sh --install --domain han.ornek.com
#
# Bu scriptin var oluş sebebi tek cümle: sunucuda zaten yayında olan siteler
# var ve kurulum onları düşürmemeli. O yüzden:
#
#   · 80/443'e HİÇ dokunmaz. Uygulama yalnız 127.0.0.1:3000'e bağlanır.
#   · Mevcut web sunucusunun yapılandırmasını KENDİ BAŞINA DEĞİŞTİRMEZ.
#     Gereken vhost'u ekrana basar; yerleştirme kararı sizindir.
#   · Hiçbir servisi `restart` etmez. En fazla, siz vhost'u koyduktan sonra
#     `nginx -t` başarılıysa `reload` önerir — restart canlı bağlantıları keser.
#   · Varsayılan modu salt okumadır. `--install` demeden hiçbir şey yazmaz.
#
# Geri alma en sonda yazılıdır ve tek komuttur.

set -euo pipefail

MODE="check"
DOMAIN=""
DIR="${HAN_DIR:-/opt/han}"
BRANCH="${HAN_BRANCH:-claude/design-screens-coding-3il7b6}"
PORT="${HAN_PORT:-3000}"
VHOST="no"
TLS="no"

while [ $# -gt 0 ]; do
  case "$1" in
    --install) MODE="install"; shift ;;
    --check)   MODE="check";   shift ;;
    --domain)  DOMAIN="${2:-}"; shift 2 ;;
    --dir)     DIR="${2:-}";    shift 2 ;;
    --port)    PORT="${2:-}";   shift 2 ;;
    --vhost)   VHOST="yes";     shift ;;
    --tls)     TLS="yes"; VHOST="yes"; shift ;;
    *) echo "bilinmeyen argüman: $1"; exit 2 ;;
  esac
done

say()  { printf '\n\033[1m── %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33muyarı\033[0m %s\n' "$1"; }
die()  { printf '\n  \033[31mDURDU\033[0m %s\n\n' "$1"; exit 1; }

# ── 1 · sunucu uygun mu ────────────────────────────────────────────────────
say "sunucu kontrolü"

command -v docker >/dev/null || die "docker yok. Kurulum: curl -fsSL https://get.docker.com | sh"
docker compose version >/dev/null 2>&1 || die "docker compose v2 yok (eski 'docker-compose' yetmez)."
ok "docker $(docker --version | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' | head -1)"

# Portu bir başkası tutuyorsa kurulum sessizce çakışır; önce söyleyelim.
#
# `ss`/`netstat` üzerinden bakmak yetmez: ikisi de yoksa grep hiçbir şey bulmaz
# ve port "boş" görünür — bakamadığı için geçen bir kontrol, kontrol değildir.
# O yüzden asıl kaynak /proc/net/tcp: her Linux'ta var, hiçbir araca bağlı değil,
# portlar onaltılık yazılıdır.
#
# Dönüş: 0 = dolu, 1 = boş, 2 = bakamadım (ki bu "boş" DEĞİLDİR).
# Hex karşılaştırma metin üzerinden yapılır: strtonum() gawk'a özgüdür, çoğu
# sunucuda /usr/bin/awk mawk'tır ve orada sessizce boş sonuç verir.
# tcp6 her sistemde yok; olmayan dosyayı awk'a vermek onu 2 ile düşürür.
port_in_use() {
  local hex files=() f
  hex=$(printf '%04X' "$1")
  for f in /proc/net/tcp /proc/net/tcp6; do [ -r "$f" ] && files+=("$f"); done
  [ ${#files[@]} -gt 0 ] || return 2
  awk -v p=":$hex" '$4 == "0A" && index($2, p) == length($2) - length(p) + 1 {f=1}
                    END {exit !f}' "${files[@]}"
}
# `set -e` altında çıplak çağrı, port BOŞ olduğunda (rc=1) scripti sessizce
# düşürürdü — hata mesajı bile olmadan. `|| rc=$?` onu koşul bağlamına alır.
rc=0; port_in_use "$PORT" || rc=$?
case "$rc" in
  0) die "${PORT} portu zaten dolu. --port 3010 gibi başka bir port verin." ;;
  2) die "/proc/net/tcp okunamadı — ${PORT} portunun boş olduğunu doğrulayamıyorum." ;;
esac
ok "${PORT} portu boş"

# RAM: `next build` tek başına ~1.5–2 GB ister. Az RAM'de build OOM ile ölür ve
# bu, "kurulum bozuk" gibi görünen ama aslında bellek olan bir hatadır.
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
SWAP_MB=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
TOTAL=$((MEM_MB + SWAP_MB))
if [ "$TOTAL" -lt 2600 ]; then
  warn "RAM+swap = ${TOTAL} MB. 'next build' burada OOM ile ölebilir."
  warn "Çözüm (kalıcı, mevcut siteleri etkilemez):"
  warn "  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile"
  warn "  echo '/swapfile none swap sw 0 0' >> /etc/fstab"
else
  ok "RAM+swap = ${TOTAL} MB — build için yeterli"
fi

FREE_GB=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
[ "${FREE_GB:-0}" -ge 5 ] && ok "boş disk ${FREE_GB} GB" || warn "boş disk ${FREE_GB} GB — imaj + node_modules ~4 GB ister"

# Hangi vekil sunucu önde? Vhost'u ona göre basacağız.
PROXY="yok"
for s in nginx caddy apache2 httpd traefik; do
  systemctl is-active --quiet "$s" 2>/dev/null && { PROXY="$s"; break; }
done
if [ "$PROXY" = "yok" ]; then
  warn "aktif bir ters vekil bulunamadı — 80/443 kimde, elle bakın"
else
  ok "önde çalışan vekil: $PROXY (dokunulmayacak)"
fi

if [ "$MODE" = "check" ]; then
  say "sonuç"
  echo "  Salt okuma modundaydı, hiçbir şey değişmedi."
  echo "  Kurmak için:  bash scripts/install-demo.sh --install --domain han.alanadi.com"
  exit 0
fi

# ── 2 · kurulum ────────────────────────────────────────────────────────────
[ -n "$DOMAIN" ] || die "--domain gerekli (ör: --domain han.alanadi.com)"
[ "$(id -u)" -eq 0 ] || die "kurulum root ister (sudo ile çalıştırın)."

say "kod"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH" --quiet
  git -C "$DIR" checkout -q "$BRANCH"
  git -C "$DIR" reset --hard "origin/$BRANCH" --quiet
  ok "güncellendi: $DIR"
else
  mkdir -p "$(dirname "$DIR")"
  git clone --branch "$BRANCH" --depth 1 https://github.com/mstfylc/han.git "$DIR" --quiet
  ok "klonlandı: $DIR"
fi
cd "$DIR"

say "ayarlar"
# Parola bir kez üretilir ve dosyada kalır. Postgres onu ilk açılışta veri
# dizinine yazar; sonradan değişirse uygulama kendi veritabanına bağlanamaz.
if [ ! -f .env ]; then
  {
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo "DOMAIN=${DOMAIN}"
  } > .env
  chmod 600 .env
  ok ".env üretildi (parola bir kez üretilir, saklayın)"
else
  ok ".env zaten var — parola korunuyor"
fi

# Uygulamayı loopback'e bağla. Override dosyası 3000'i sabit yazdığı için,
# farklı bir port istendiğinde kendi override'ımızı üretiyoruz.
COMPOSE_ARGS=(-f docker-compose.yml -f docker-compose.proxy.yml)
if [ "$PORT" != "3000" ]; then
  cat > docker-compose.port.yml <<YML
services:
  app:
    ports:
      - "127.0.0.1:${PORT}:3000"
YML
  COMPOSE_ARGS+=(-f docker-compose.port.yml)
fi

say "derleme ve başlatma (ilk seferde 5–10 dakika)"
docker compose "${COMPOSE_ARGS[@]}" up -d --build
ok "konteynerler ayakta"

say "sağlık kontrolü"
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || true)
  [ "$code" = "200" ] && break
  sleep 2
done
[ "${code:-0}" = "200" ] \
  || { docker compose "${COMPOSE_ARGS[@]}" logs --tail 40 app; die "uygulama yanıt vermedi."; }
ok "uygulama 127.0.0.1:${PORT} üzerinde yanıt veriyor"

# Veritabanına gerçekten yazabiliyor mu? "Sayfa açıldı" bunu kanıtlamaz.
api=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/api/auth" || true)
[ "$api" = "200" ] && ok "Postgres bağlantısı çalışıyor (/api/auth 200)" \
                   || warn "/api/auth $api döndü — veritabanı bağlantısını kontrol edin"

# ── 3 · vhost ──────────────────────────────────────────────────────────────
#
# --vhost verilmediyse blok yalnızca BASILIR. Verildiyse yazılır, ama tek bir
# kural altında: `nginx -t` geçmeden hiçbir şey reload edilmez, ve test
# başarısız olursa eklediğimiz her şey geri alınıp yapılandırmanın yeniden
# geçerli olduğu DOĞRULANIR. Sunucuda iki canlı site var; bozuk bir config'le
# reload etmek üçünü birden düşürür.
if [ "$VHOST" = "yes" ] && [ "$PROXY" = "nginx" ]; then
  say "nginx vhost"
  AVAIL="/etc/nginx/sites-available/${DOMAIN}"
  LINK="/etc/nginx/sites-enabled/${DOMAIN}"
  BACKUP=""

  if [ -e "$AVAIL" ]; then
    BACKUP="${AVAIL}.han-yedek.$(date +%s)"
    cp -a "$AVAIL" "$BACKUP"
    warn "aynı isimde vhost vardı — yedeklendi: $BACKUP"
  fi

  cat > "$AVAIL" <<NGINX
# HAN — ${DOMAIN}. scripts/install-demo.sh tarafından yazıldı.
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Yükleme boyutu: toplu içe aktarma CSV'leri ve mağaza görselleri için.
    client_max_body_size 25m;

    location / {
        proxy_pass         http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        # Bu başlık olmadan giriş çalışmaz: oturum çerezi üretimde 'secure'
        # işaretlidir ve TLS'i nginx (veya Cloudflare) sonlandırdığı için
        # uygulamaya istek düz http gibi görünür.
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 300s;
    }
}
NGINX
  ln -sfn "$AVAIL" "$LINK"
  ok "vhost yazıldı: $AVAIL"

  if nginx -t 2>/tmp/han-nginx-test.log; then
    ok "nginx -t geçti"
    systemctl reload nginx
    ok "nginx reload edildi (restart DEĞİL — canlı bağlantılar kesilmedi)"
  else
    # Geri al ve config'in gerçekten kurtarıldığını doğrula.
    rm -f "$LINK"
    if [ -n "$BACKUP" ]; then mv -f "$BACKUP" "$AVAIL"; else rm -f "$AVAIL"; fi
    if nginx -t >/dev/null 2>&1; then
      warn "vhost geri alındı; nginx yapılandırması yine geçerli, siteler etkilenmedi"
    else
      warn "DİKKAT: geri alındı ama nginx -t hâlâ başarısız — sorun bizim vhost'tan ÖNCE de vardı"
    fi
    cat /tmp/han-nginx-test.log
    die "nginx yapılandırma testi başarısız. Hiçbir şey reload edilmedi."
  fi

  if [ "$TLS" = "yes" ]; then
    say "sertifika"
    if ! command -v certbot >/dev/null; then
      warn "certbot yok. Kurulum: apt install -y certbot python3-certbot-nginx"
    else
      # --nginx eklentisi vhost'u kendisi 443'e taşır ve yeniden yükler.
      if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
                 --register-unsafely-without-email --redirect; then
        ok "sertifika alındı ve nginx 443'e taşındı"
      else
        warn "certbot başarısız. Cloudflare proxy'si (turuncu bulut) açıksa"
        warn "HTTP-01 doğrulaması engellenmiş olabilir — kaydı geçici olarak"
        warn "'DNS only' (gri) yapıp tekrar deneyin, sonra istersen turuncuya alın."
      fi
    fi
  fi

  say "son adım — Cloudflare"
  cat <<TXT

  Kayıt şu an PROXIED (turuncu bulut) görünüyor. SSL/TLS → Overview'da modun
  **Full (strict)** olduğundan emin olun.

  "Flexible" seçiliyse Cloudflare ile sunucunuz arasındaki bacak ŞİFRESİZ
  http olur — tarayıcı kilidi görür ama trafik son adımda açıktır.

TXT
  say "bitti — https://${DOMAIN}"
  echo "  İlk giriş: https://${DOMAIN}/giris → 'İlk yöneticiyi kur'"
  echo "  Kod loga düşer: docker compose ${COMPOSE_ARGS[*]} logs app | grep notify"
  echo "  Geri alma:  cd ${DIR} && docker compose ${COMPOSE_ARGS[*]} down -v"
  echo "              rm -f ${LINK} ${AVAIL} && nginx -t && systemctl reload nginx"
  exit 0
fi

say "son adım — vhost (bunu SİZ yerleştirin)"
cat <<TXT

  Mevcut siteleriniz çalışmaya devam ediyor; aşağıdaki bloğu ekleyip
  vekil sunucuyu yeniden YÜKLEYİN (restart değil, reload — canlı bağlantı kesilmez).

TXT

if [ "$PROXY" = "caddy" ]; then
  cat <<TXT
  /etc/caddy/Caddyfile sonuna:

      ${DOMAIN} {
        reverse_proxy 127.0.0.1:${PORT}
      }

  Ardından:  caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
  (Caddy sertifikayı kendisi alır.)
TXT
else
  cat <<TXT
  /etc/nginx/sites-available/${DOMAIN} :

      server {
        listen 80;
        server_name ${DOMAIN};
        location / {
          proxy_pass         http://127.0.0.1:${PORT};
          proxy_http_version 1.1;
          proxy_set_header   Host              \$host;
          proxy_set_header   X-Real-IP         \$remote_addr;
          proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
          proxy_set_header   X-Forwarded-Proto \$scheme;
          proxy_set_header   Upgrade           \$http_upgrade;
          proxy_set_header   Connection        "upgrade";
        }
      }

  Ardından sırayla:

      ln -s /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
      nginx -t                      # ← BU GEÇMEDEN reload etmeyin
      systemctl reload nginx
      certbot --nginx -d ${DOMAIN}  # HTTPS şart: oturum çerezi 'secure'

  X-Forwarded-Proto olmadan giriş çalışmaz: çerez üretimde secure işaretlidir
  ve nginx TLS'i sonlandırdığı için uygulamaya http gibi görünür.
TXT
fi

cat <<TXT

── ilk 5 dakika ────────────────────────────────────────────────────────────
  1. https://${DOMAIN}/giris → "İlk yöneticiyi kur" → telefonunuz
  2. Kod SMS sağlayıcısı bağlı olmadığı için üretimde ekrana DÜŞMEZ; loga düşer:
        docker compose ${COMPOSE_ARGS[*]} logs app | grep notify
  3. Şifrenizi belirleyin → panel açılır.

── geri alma (tek komut, mevcut sitelere dokunmaz) ─────────────────────────
      cd ${DIR} && docker compose ${COMPOSE_ARGS[*]} down -v && rm -rf ${DIR}
  (vhost'u siz koyduysanız onu da kaldırıp nginx -t && systemctl reload nginx)

── yedek ───────────────────────────────────────────────────────────────────
      cd ${DIR} && docker compose ${COMPOSE_ARGS[*]} exec app npm run backup
TXT

say "bitti"
