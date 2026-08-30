> **28.08.2026 denetimi:** bu belgedeki bazı ✅ maddeler kodda yarım kalmıştı.
> Bulgular ve düzeltmeler `DENETIM-PLANI.md` içinde; açık kalanlar orada §3'te.

# Mağaza Sayfası Planı

Referans: Alibaba/IndiaMART (B2B güven dosyası), Etsy (kişisel vitrin), Google Business/Yelp
(bulma+gitme kararı), Trendyol/Hepsiburada (platform içi güven rozetleri). HAN'da niyet üçe
ayrılıyor: turist, toptancı, esnaf/partner — sayfa niyete göre ağırlıklanır.

Durum: iki motor var — `shopVals` (11 zengin kayıt: galeri, güven metrikleri, yorumlar) ve
`scaleShopVals` (30-50 bin ölçek kaydı: MOQ + fiyat bandı, yalın). Bu plan ikisini de kapsar.

> Ürün kararları: `URUN-KARARLARI.md` — platform işleme girmez (K1), alıcı doğrulaması gönüllü (K2),
> yorum yalnız doğrulanmış işlemden (K3), mobil = çarşı modu (K4), içerik sözlük tabanlı (K5),
> sahiplik geçici/devirli (K6), kuzey yıldızı karşılık bulan talep (K7), esnaf iknası kaçırılan talep (K8).

## Faz 0 — Yapısal düzeltme: B2B / B2C mantığı (ÖNCE BU)

Diğer tüm fazları etkiler; kozmetik iyileştirmelerden önce yapılmalı.

- [x] **0.1 `sector` tek değerli olmaktan çıkmalı** — çarşı gerçeği: aynı dükkân sabah toptancıya,
  öğleden sonra turiste satar. Şu an kayıt ya `toptan` ya `perakende`; `mode:"ikisi"` sadece bir
  arama filtresi. Doğrusu: yetenek kümesi (`sells: ["toptan","perakende"]`) + **mod başına ayrı
  fiyat ve MOQ** (perakende 1 adet / toptan 50 adet, iki farklı bant). A0 bu olmadan yarım kalır.
- [x] **0.2 B2B akışı teklifte kesiliyor** — talep → dağıtım → teklif → kabul var; sonrası yok:
  numune isteği, sipariş takibi, **tekrar sipariş**. B2B gelirinin çoğu tekrar siparişten gelir.
  Kapora/vade koşulu (K1 gereği) **esnafın beyan ettiği bilgi alanı**dır — platform tahsil etmez.
- [x] **0.3 Toptancı adet saymaz, koli sayar** — MOQ var ama koli içi adet (inner/outer carton) yok.
  "500 adet" ile "20 koli × 25" aynı şey değil; fiyat da koli üzerinden konuşulur.
- [x] **0.4 Hizmet ve imalat yanlış kalıpta** — fason dikim, kargo, gümrük müşaviri adet/MOQ/fiyat
  bandı kalıbına sokulmuş. Üçüncü mantık gerekiyor: **iş tanımı bazlı teklif** (ne kadar değil, ne işi).
- [x] **0.5 B2C tarafı sığ** — tekil ürün fiyatı ve stok yok (sadece bant), tax-free süreci mağaza
  sayfasına bağlı değil, otel/havalimanı teslim ve paketleme yok.

## Faz A — Alıcı tarafı (bağımsız, veri zaten mevcut)

- [x] **A0. Niyete göre ağırlıklanma** — mod anahtarı (toptan/perakende) sayfanın üst hiyerarşisini değiştirsin: toptan kaydında MOQ + fiyat bandı + yanıt performansı + ihracat rozetleri en üstte; perakende kaydında fotoğraf galerisi + fiyat + tax-free en üstte.
- [x] **A1. Sahiplenme rozeti + CTA** — `claims[id]` varsa "Bu esnaf tarafından yönetiliyor"
  rozeti; yoksa sahiplenme çağrısı → esnaf akışına link. CTA metni K8 gereği karne dili değil
  **kaçırılan iş** dili: "bu ay bu kategoride X talep geldi, Y'sine yanıt verilmedi".
- [x] **A2. Yer-seviyesi toplu itibar bloğu** — kendi yorumu yoksa `placeStats(place.id)`
  üzerinden "bu handa X dükkân, ortalama Y yıldız" özeti.
- [x] **A3. WhatsApp/telefon kısayolu** — kaydın `tel` alanından `wa.me/` + `tel:` linki.
- [x] **A4. Çeşit grubu bazlı hızlı soru** — her `groups[]` satırının yanına soru butonu,
  talep formunu o grup adıyla önceden doldurur.
- [x] **A5. Benzer dükkânlar + karşılaştırma** — `shSimilar` bloğu (zengin kayıtta var) ölçek sayfasına da taşınsın; üzerine İşllerim→Karşılaştır sekmesine `cmpRow` önceden dolu götüren bir "karşılaştır" linki eklensin.
- [x] **A6. Paylaşım önizlemesi** — `copyLink` var; `og:title/og:image/og:description`
  meta üretimi eksik.
- [x] **A7. İade/numune politikası** — zengin kayıtta zaten var (`shPolicyCards`); ölçek sayfasına da tek satır olarak eklensin (örn. "numune gönderiyor" / "iade bilgisi yok" dürüst durumu).

## Faz B — Esnaf tarafı (yapısal, A bittikten sonra, sırayla)

- [x] **B1. Override deposu** — `han-overrides-v1`, sadece `claims[id].status==="onayli"`
  ise yazılabilir. `applyOverrides(rec)` tek merge noktası (Web + Editör aynı fonksiyonu kullanır).
  K6 gereği **devirde sıfırlanır**: yeni esnaf eski fiyatı devralmaz, fotoğraflar silinir,
  yorumlar arşivlenip "önceki işletme" olarak işaretlenir.
- [x] **B2. Erişim kontrollü rota** — `#/esnaf/<id>`; K10 gereği kontrol claims değil **oturum**:
  telefon + tek kullanımlı kod ile kalıcı esnaf oturumu (cihaz bağımsız). Oturum yoksa girişe,
  sahiplenme onayı yoksa sahiplenme akışına yönlendirir.
- [x] **B3. Tek sayfa yönetim paneli** — üstte **kaçırılan talep özeti** (K8: karne değil para dili),
  altında fiyat/MOQ + fotoğraf + saat/telefon formu. K5 gereği çeşit grupları **serbest metin değil,
  `GROUP_WORDS` sözlüğünden seçim** (4 dilde çevirisi hazır geldiği için). Kaydet → override
  yazılır, karne canlı güncellenir.
- [x] **B4. "Kaydı aç" hedefi** — durum sekmesindeki buton mağaza sayfası değil B3 paneline gitsin.

## Faz C — Alıcının gerçek soruları (planın asıl eksiğiydi)

Sayfa "hangi bloklar olacak" listesi değil, "alan kişi neyi merak ediyor, neyden korkuyor" sorusuna cevap olmalı.

### C1 · Turistin soruları
- [x] **Dil eşleşmesi** — `langs` verisi var; "sizin dilinizde konuşuyor" / "tercüman gerekebilir" gösterimi yok. Turistin ilk filtresi.
- [x] **Fiyat güveni** — kategori/yer ortalamasıyla kıyas (`band` var, karşılaştırma yok) + döviz karşılığı + pazarlık payı beklentisi. Kandırılma korkusu en büyük engel.
- [x] **Şu an açık mı** — hanlar pazar kapalı, cuma namazı arası var. Canlı açık/kapanışa kalan süre mevcut değil.
- [x] **Fiziksel erişim** — merdiven/asansör, ağır yük için el arabası/hamal, otopark. 4. kat hanlar gerçek bir engel.

### C2 · Toptancının karar kriterleri
- [x] **Üretici mi aracı mı** — `isProducer` var, sayfada belirgin değil. B2B'de en kritik ayırım.
- [x] **MOQ esnekliği** — `moqFlex` var, "pazarlığa açık" olarak gösterilmiyor.
- [x] **Kargo/gümrük detayı** — ölçek kaydında sadece `shipsAbroad` bayrağı; son kargo saati ve gümrük evrakı desteiği yok.

### C3 · Dürüstlük katmanı
- [x] **Alan kaynak işareti (K11)** — her alanın kaynağı görünür: `tahmini` (üretilmiş/çıkarım) ·
  `esnaf beyanı` · `yetkili doğruladı`. **Fiyat bandı da buna dahil** — tohumlu üretilmiş veri
  gerçek gibi gösterilmez. Esnaf doldurunca beyana, yetkili onaylayınca doğrulanmışa yükselir.
- [x] **Fotoğraf gerçekliği** — temsili kategori fotoğrafı ile dükkânın kendi fotoğrafı ayrımı kodda var (`curated`), sayfada etiketlenmiyor.
- [x] **Veri tazeliği** — `updatedDays`: "bu bilgiler 40 gün önce doğrulandı" şeffaflığı.
- [x] **Doğrulayan yetkili** — `OFFICERS`: "bu kaydı kim doğruladi" güven sinyali.
- [x] **Şikayet/bildir** — "burada değil/kapalı" bildirimi (`REPORT_THRESHOLD` 3 kurulu) mağaza sayfasından tetiklenmiyor.
- [x] **Yorum hakkı kuralı (K3)** — yorum yalnız **teklif kabul etmiş** alıcıda. Anlaşma sonrası her iki
  tarafa tek soru: "sonuçlandı mı?" (oldu / olmadı / yanıt yok) → esnafın güven metriğine işler.

## Faz D — İletişim katmanı ("buldum" ile "temas kurdum" arası)

Çarşı gerçeğinde tek kanal çalışmaz: esnafın çoğu uygulama içi gelen kutusu açmaz, WhatsApp kullanır.
Kanal, kaydın kapasitesine göre seçilir.

- [x] **D1. Kanal seçimi kaydın durumuna göre** — aktif + yanıt oranı yüksek kayıt → platform talebi öne (teklif karşılaştırma çalışır); sadece telefonu olan → WhatsApp/arama öne; onaysız beyan kaydı → iletişim kapalı ("önce doğrulanmalı"), fiyat gösterememesiyle aynı mantık.
- [x] **D2. Hazır çok dilli mesaj kalıpları** — alıcı kendi dilinde seçer ("şu ürün var mı", "500 adet fiyatı", "kaçta kapanıyorsunuz"), esnafa **Türkçe** gider. `quickAsk`/`sendWa` sözlükleri veride var, sistem haline getirilmemiş. Dil bariyerini kaldıran aslı unsur.
- [x] **D3. Tek yerden takip** — hangi dükkâna ne sorulduğu İşlerim'de görünsün; WhatsApp'a çıkanlar için de "sordum" kaydı bırakılabilsin.
- [x] **D4. Yanıtsızın sonucu** — yanıt gelmezse "bu dükkân genelde 3 saatte yanıtlıyor" + aynı işi yapan 3 alternatif. `respRate`/`respMins` besler. K12 gereği "yanıtsız" sayılması ancak **teslim edilmiş mesaj** için geçerli.
- [x] **D4b. Teslim kanalı (K12)** — talep esnafa **WhatsApp/SMS** olarak düşer; uygulama içi kutu yalnız arşiv. Yanıt süresi ölçümü mesajın gönderildiği anda başlar.
- [x] **D5. Karşı taraf (kritik)** — gelen talep, sahiplenmesi **onaylı** esnafa yönetim panelinde görünsun ve cevaplanabilsin; "mesajla cevapla" kısayolu bulunsun. Bu olmadan iletişim tek yönlü kuyu olur; Faz B'nin devamı (B3 paneline gelen kutusu).
- [x] **D5b. Tahmini vs gerçek teklif ayrımı (K9)** — motordan gelen **"tahmini aralık"** etiketli ve
  kabul edilemez (kabul butonu yok); sahiplenmesi onaylı esnaftan gelen **"dükkândan teklif"**
  kabul edilebilir ve taahhüt sayılır. Gerçek teklif geldiğinde tahminler alta iner.
  İşlerim→Karşılaştır yalnız gerçek teklifleri karşılaştırır.
- [x] **D6. Alıcı doğrulama rozeti + kota (K2)** — turist için doğrulama yok. Toptan: ilk talep serbest,
  telefon doğrulaması bir kez; gönüllü firma doğrulaması (firma adı + vergi no + ülke) → rozet →
  talep esnaf tarafında üstte + kota artar. 3 "sahte talep" bildirimi kotayı düşürür.
  D1 kanal seçimi bu rozeti sinyal olarak kullanır.

## Faz M — Çarşı modu (mobil, K4)

İkinci uygulama değil. Masaüstü = keşif/karşılaştırma, mobil = navigasyon/temas.
Mevcut `compact` yapısının üzerine sadeleştirilmiş görünüm:

- [x] **M1.** Rota + kapı numarası + "şu an açık" (C1'in çekirdeği buraya taşınır)
- [x] **M2.** Tek dokunuşla telefon/WhatsApp (A3'ün mobil hali)
- [x] **M3.** Kaydettiklerim — çevrimdışı açılabilir liste
- [x] **M4.** Fiziksel erişim notu (merdiven/asansör, el arabası) — çarşıda en çok gereken bilgi

> **Durum: Faz 0, A, B, C, D ve M uygulandı.** Kayıt artık yetenek kümesi (`trade.sells`) ile
> moda ayrı fiyat/MOQ/koli taşıyor; hizmet-imalat iş tanımı bazlı. Mağaza sayfasına sahiplenme
> şeridi, aracısız temas, grup bazlı hızlı soru, açık/kapalı, fiyat güveni, fiziksel erişim,
> alan kaynağı etiketleri ve şikayet yolu geldi. Esnaf tarafında telefon oturumu + içerik
> override'ı + gelen talep kutusu çalışıyor. Tahmini aralık ile gerçek teklif ayrıldı.

## Sıra
**Faz 0 en önce** — 0.1/0.3/0.4 veri modeli düzeltmesi, A/C/D'nin hepsini etkiliyor.
A1→A7 bağımsız, herhangi bir sırayla yapılabilir. C grubu da bağımsız ve verisi mevcut — güven etkisi en yüksek olanı C3 (dürüstlük), en acili C1 (turist). B1→B2→B3→B4 zorunlu sıra (her biri öncekine bağımlı). D1→D4 alıcı tarafı, bağımsız; **D5 B3'e bağımlıdır** — esnaf paneli olmadan yapılamaz.
Faz M, C1 bittikten sonra (içeriğini oradan alıyor).

## Ölçü (K7)
Kuzey yıldızı: **haftalık karşılık bulan talep sayısı** (en az bir teklif/yanıt alan talep).
Destek: onaylı kayıt oranı, esnaf sahiplenme sayısı, rota tamamlama (kapıya varış).
Kapsama yüzdesi bir **girdi** metriğidir, başarı ölçüsü değil.
