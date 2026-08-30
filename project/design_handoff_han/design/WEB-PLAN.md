> **28.08.2026 denetimi:** bu belgedeki bazı ✅ maddeler kodda yarım kalmıştı.
> Bulgular ve düzeltmeler `DENETIM-PLANI.md` içinde; açık kalanlar orada §3'te.

# HAN Web Müşteri — Denetim ve Geliştirme Planı

*Kapsam: `HAN Web.dc.html` (2603 satır şablon + mantık), `han-logic.js`, `han-data.js`.
Değerlendirme ölçütü: web bir uygulamanın geniş ekran kopyası değil, kendi kuralları olan bir platformdur —
adreslenebilir, paylaşılabilir, aranabilir, oturumlu.*

---

## 1. Bugün ne var

Çalışan ve iyi olan: üç kolon arama (filtre · liste · detay), dört panelli sağ kolon (dükkân · yol tarifi · han · sokak),
kategori ağacı üç kolon, plan/rota + varış saatleri + kapanış riski, İşlerim (talep → teklif → karşılaştırma → kabul),
Araçlar hub'ı (döviz · tax-free · POI · nakliye · görgü · acil · sorun bildir), dört dil + RTL, üç kırılma noktası,
tek doğruluk kaynağı `panel:{kind,id}`, kur her fiyatın yanında. Konsol hatası yok.

**Ama:** bu bir *geniş ekran mobil uygulama*. Web'in kendi katmanı — adres, oturum, ürün sayfası, ticaretin kapanışı —
hiç yok. Eksikler üç kümede.

---

## 2. Denetim — bulgular

### A. Platform katmanı (en ağır — burası olmadan diğerleri yarım kalır)

| # | Bulgu | Sonucu |
|---|---|---|
| A1 | **Adres yok.** Tüm durum bellekte; URL hiç değişmiyor. | Bir dükkânı/sokağı/aramayı link olarak paylaşamıyorsun. Tarayıcı geri tuşu siteden atıyor. Yenilemede seçim, filtre, sekme sıfır. Web'in mobilden tek yapısal üstünlüğü kullanılmıyor. |
| A2 | **Hesap yok.** Giriş, kayıt, profil, cihaz arası senkron yok; talepler/kayıtlılar/plan yalnızca `localStorage`. | Turist telefonda arıyor, otelde masaüstünde devam edemiyor. Talep bırakan kişinin kimliği yok — teklif döngüsü gerçekte kurulamaz. |
| A3 | **Rol köprüsü yok.** "Ben esnafım" girişi, satıcı paneline geçiş yok. | Rehbere kayıt olacak esnaf web'e giriş kapısı bulamıyor (satıcı paneli yazılırken bu ilk gereksinim). |
| A4 | **Head/SEO katmanı yok.** `title`, `description`, `og:`, `hreflang` (4 dil), yapılandırılmış veri yok. | Bir firma rehberinin trafiğinin çoğu aramadan gelir. Şu an sıfır giriş noktası. |
| A5 | **Erişilebilirlik.** Odak halkası yok, üç kolon klavyeyle gezilemiyor, teklif damlaması için canlı bölge yok, atlama bağlantısı yok, `image-slot` alt metinleri boş. | Klavye/ekran okuyucu kullanan alıcı içeride kayboluyor; RTL'de odak sırası sınanmadı. |
| A6 | **Durum eksikleri.** Yalnızca ilk açılış iskeleti var. Veri gelmezse, harita iframe'i yüklenmezse, kur çekilemezse ekran boş. Metin "kayıtlılar çevrimdışı açılır" diyor — kodda çevrimdışı yok. | Verilen sözü tutmayan arayüz. |
| A7 | **Gerçek mobil web yok.** 924px altı tek kolona iniyor ama 390px telefon tarayıcısı için sınanmadı; çarşıdaki turist siteyi telefondan açar. | Web müşteri = masaüstü varsayımı yanlış. |

### B. Mobilde/veride var, web'de hiç yok

| # | Bulgu |
|---|---|
| B1 | **Yorumlar.** `REVIEWS` verisi duruyor, web tek yorum göstermiyor; puan dağılımı, yorum yazma, dile göre gösterim yok. Listede yalnız ★ sayısı var — güvenin en ucuz kaynağı boşta. |
| B2 | **Dükkânla iletişim.** `QUICK_MSGS` (dil bariyeri için hazır mesajlar) hiç kullanılmıyor; mesaj kutusu, WhatsApp çıkışı, çeviri yok. Alıcı fiyat soramıyor. |
| B3 | **Randevu ve ziyaret programı.** `SLOTS` + `TM` var, bilinçli kapsam dışı bırakılmış. Toptancı için randevu tek gerçek dönüşüm eylemi. |
| B4 | **Rehber tutma.** `GUIDES` verisi (dil, fiyat, alan) tamamen kullanılmıyor. |
| B5 | **Kampanyalar.** `CAMPAIGNS` verisi var; anasayfada yok. |
| B6 | **Tax-free süreci.** Araçlarda hesap var, ama fişten gümrükte iadeye adım adım akış yok. |
| B7 | **Kültür/görgü** Araçlar'a gömülü — arama sonucunda risk uyarısı olarak (`RISKY_CATS`) bağlamda çıkmıyor. |

### C. Ürün modeli ve etkileşim kalitesi

| # | Bulgu |
|---|---|
| C1 | **Ürün katmanı yok.** Her şey dükkân merkezli. "Şeffaf silikon kılıf" için ürün sayfası, o ürünü satan dükkânlar, fiyat aralığı yok. Toptancının aradığı görünüm bu. |
| C2 | **Ticaret döngüsü yarı açık.** Teklif kabul edilince "Anlaşıldı" yazıyor ve orada bitiyor. Kapora/emanet, nakliye siparişi, sipariş takibi tanımsız. **Ürün kararı gerekir:** HAN rehber mi, pazar yeri mi? |
| C3 | **Karşılaştırma dar.** Zorunlu olarak liste kalemi üzerinden, üç dükkân. Listede kutu işaretleyip "seçtiklerimi karşılaştır" yok. |
| C4 | **Harita ile liste konuşmuyor.** Pin → detay yok, sonuçlar haritada yok, "bu alanda ara" yok, rota sürükleyip sıralanamıyor. |
| C5 | **Ölçek yok.** "10 bin dükkân" iddiasına karşı sayfalama/sonsuz kaydırma, sonuç iskeleti, son aramalar, kayıtlı arama + uyarı yok. |
| C6 | **Kayıtlılar zayıf.** Koleksiyon/klasör, not, paylaşılabilir liste yok. |
| C7 | **Masaüstü alışkanlıkları yok.** `/` ile aramaya odak, `Esc` ile panel kapatma, satır seçiminde ok tuşları. |

---

## 3. Plan — sekiz faz, her biri uçtan uca kapanır

**Kural (mobilden devam):** her faz veri + ekran + boş/hata durumu + 4 dil + RTL + giriş noktası ile kapanır.

### W1 · Adres, dayanıklılık, erişilebilirlik  ✅ *tamamlandı*
Hash yönlendirme: `#/kesfet` · `#/ara?q=kılıf&sort=fiyat&semt=tahtakale` · `#/dukkan/emre` · `#/sokak/s-kalpakcilar` ·
`#/han/yildiz/2` · `#/isler/talep/r1` · `#/arac/doviz`. Geri/ileri çalışır, yenileme durumu korur, her panelde
"bağlantıyı kopyala". Head/meta + 4 dil `hreflang` + `og` görseli. Odak halkası, atlama bağlantısı, klavye ile kolon
gezme, teklif damlaması için `aria-live`. Veri/harita/kur hatası için üç gerçek hata durumu + çevrimdışı bandı
(kayıtlılar gerçekten açılır). 390px telefon tarayıcı geçişi.

### W2 · Hesap ve kimlik  ✅ *tamamlandı — misafir öncelikli*
Giriş/kayıt (telefon veya e-posta, tek kod), misafir verisini hesaba taşıma, profil (dil · para · alışveriş modu ·
ülke · ilgi kategorileri · şirket/vergi bilgisi), cihaz arası senkron, çıkış. Üst çubukta hesap menüsü.
**"Ben esnafım" kapısı** → satıcı paneline köprü (W2, satıcı panelinden önce gelmeli).

### W3 · Dükkân sayfası tam sürümü
Kalıcı URL'li tam sayfa (sağ panel özet kalır). Fotoğraf galerisi, puan dağılımı + yorumlar + **yorum yazma**,
ödeme/sertifika/konuşulan dil satırları, **randevu al** (`SLOTS`, `TM`), **mesaj gönder** (`QUICK_MSGS` + çeviri),
kapıdan tarif, benzer dükkânlar, şikâyet. Riskli kategoride bağlam uyarısı (`RISKY_CATS`).

### W4 · Ürün katmanı ve karşılaştırma  ◐ *karşılaştırma tamamlandı*
Listede **çoklu seçim → "seçtiklerimi karşılaştır"** (2–5 dükkân) kuruldu; karşılaştırma tablosu artık
iki kaynaktan besleniyor (elle işaretlenen seçim önceliklidir, yoksa alım listesi satırı).
Ürün sayfası (bu ürünü satan dükkânlar, fiyat aralığı, kademeler tek tabloda) henüz yok.

### W5 · Harita ↔ liste bütünleşmesi
Bölünmüş görünüm (liste + canlı harita), pin ↔ satır iki yönlü seçim, "bu alanda ara", kümeleme,
rota duraklarını sürükleyerek sıralama, yeniden hesaplanan varış saatleri, kat planı görünümü (han katları).

### W6 · Ölçek ve geri dönüş  ✅ *tamamlandı*
Sayfalama + sonuç iskeleti (kuruldu), **son aramalar** (son 8 sorgu, tek dokunuşla geri dönüş),
**kayıtlı arama** (kaydedildiği andaki sonuç sayısıyla kıyas — kapsamanın somut kanıtı, en çok 6 arama),
`/` ve `Esc` kısayolları. Kayıtlılarda **koleksiyon** (Genel · Toptan alım · Hediye · Sonra bakılacak),
**not** ve **paylaşılabilir liste** (WhatsApp'a yapıştırılabilir metin) kuruldu; kayıtlılar artık iki
motordan da (11 zengin + 30 bin ölçek) çözülüyor.

### W7 · Ticaretin kapanışı  ← *ürün kararı gerektirir*
İki yol: **(a) Rehber** — teklif kabulünde biter, sonrası dükkânla; kapanışı "randevu + mesaj + kargo noktası" kurar.
**(b) Pazar yeri** — kapora/emanet, sipariş, ödeme, nakliye siparişi, kargo takibi, uyuşmazlık.
Karar verilmeden bu faz yazılamaz; ben (a)'yı öneriyorum: veri ve ekip yapısı ona uygun, (b) ayrı bir ürün.

### W8 · Gezi katmanı  ◐ *rehber + kampanya + tax-free tamamlandı*
**Rehber tutma** (`GUIDES`) Araçlar'a eklendi: dil eşleşmesi ("sizin dilinizde" / "başka dillerde"),
bildiği bölge, günlük ücret + döviz karşılığı, bu hafta uygun/dolu durumu, talep gönderme.
Komisyon dürüstlüğü notu ("ücret rehbere ödenir, HAN komisyon almaz; rehberden de dükkândan
komisyon almadığını teyit etmesini isteyin"). Kampanyalar (`CAMPAIGNS`) anasayfada, tax-free
adım adım iade akışı Araçlar'da kurulu. Gün planı takvimi (etkinlik + randevu + duraklar birlikte) henüz yok.

---

## 4. Sıra önerim

1. **W1** (adres + dayanıklılık) — diğer her şeyin üstüne inşa edilir, ertelenirse iki kez yazılır.
2. **W2** (hesap) — satıcı panelinden önce, çünkü esnaf girişi buradan geçer.
3. **W3** (dükkân sayfası) — en büyük dönüşüm kazancı; veri hazır, yalnız ekran yok.
4. **Satıcı paneli** (`HAN Seller.dc.html`) — W2 bitince.
5. **W4 → W6** — ölçek ve karar araçları.
6. **W7 kararı**, sonra **W8**.

## 4b. Kararlar (onaylandı)

- **Ticaret modeli: karma** — küçük perakendede ödeme HAN'da, toptanda teklifte biter. W7 buna göre iki koldan yazılır.
- **Giriş isteğe bağlı** — misafir her şeyi yapar; hesap yalnızca cihazlar arası taşıma, teklif bildirimi ve kayıtlı arama için.
- **Masaüstü odak**, telefon tarayıcısı çalışır düzeyde.
- **Veri ölçeği: yüzlerce kayıt** simüle edilecek (W6 ile).
- **Dört kullanıcı da birinci** — toptan alıcı, turist, tedarikçi arayan, rehber/tur operatörü.
- **Satıcı paneli en sona.**

## 5. Yol boyunca düzeltilecek küçükler
`image-slot` alt metinleri · sağ panel kapanışında odak dönüşü · `Esc` · sayı biçimlerinin dile göre yerelleşmesi
(RU/AR ondalık) · kur uyarısının her ≈ değerinin yanında erişilebilir olması · `tick` sayacının panel kapalıyken durması.
