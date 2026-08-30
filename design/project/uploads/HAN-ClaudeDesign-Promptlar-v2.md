# HAN — Claude Design Prompt Seti v2

**Değişiklik:** Uyanık Design System artık projeye yükleniyor. Prompt'lar sıfırdan tasarım değil, **mevcut sistemi HAN'a uygulama** üzerine kuruldu.

---

## Kurulum

**Proje adı:** `HAN — Faz 0 Prototip`

**Design system:** `webmobilUI__2_.zip` → projeye tasarım sistemi olarak yükle

**Ek dosyalar (mutlaka yükle — geçen sefer atlandı, kötü çıktının sebebi buydu):**
- `HAN-Tasarim-Brief-ClaudeDesign-v1.md`
- `HAN-Alici-Arayuzu-Override-v2.md`

**Model:** Prompt 0–2 → Opus 5 (High) · Prompt 3–9 → Sonnet 5 · revizyonlar → Sonnet 5

---

## Prompt 0 — Tema kurulumu ve doğrulama

```
Bu projede Uyanık Design System yüklü. İki ek dosya var:
HAN-Tasarim-Brief-ClaudeDesign-v1.md (ürün ve ekran içeriği) ve
HAN-Alici-Arayuzu-Override-v2.md (alıcı arayüzü için sistem sapmaları).

Önce iki iş:

1. tokens/themes.css şablonunu kullanarak "han" temasını ekle. Değerler override
   dosyasının 1. bölümünde. Uyanık turuncusu HAN'da kullanılmaz; accent zinciri
   doğrudan set edilir, --color-orange'a alias bırakılmaz. Alıcı arayüzü için dark
   varyant üretme.

2. Sonra bana kısaca doğrula: han temasının primary/accent değerleri, alıcı
   arayüzünde geçerli tipografi ölçeği, ve override dosyasında "kullanılmayacak"
   olarak işaretlenen bileşenler.

Henüz ekran çizme.
```

Cevap yanlışsa düzelt. Buradaki hata sekiz ekrana yayılır.

---

## Prompt 1 — Mağaza profili (dolu katalog)

```
Brief'teki "Ekran 2 — Mağaza profili" ekranını tasarla. data-theme="han", light,
mobil 390px.

Bağlam: Tahtakale'de toptancı hanlarında mağaza bulmaya yarayan B2B keşif ürünü.
Kullanıcı şu anda sokakta, ayakta, telefonu tek elle kullanıyor, güneş altında,
acelesi var. E-ticaret değil — sepet, fiyat, satın alma yok. Ekranın tek amacı
kullanıcıyı WhatsApp'a, telefona veya dükkânın fiziksel adresine götürmek.

Sistem bileşenlerini kullan: Card, Badge, Tag, Button, Icon, Skeleton.
AppShell ve DataGrid KULLANMA — bunlar masaüstü panel bileşenleri.

Üç yeni bileşen yazacaksın (override dosyası 4. bölümde spesifikasyonları var):
LocationBlock, StickyActionBar, FloorPlan.

Blok sırası kesindir, değiştirme:
mağaza adı + doğrulama rozeti → LocationBlock → kategori Tag'leri →
ticari bilgiler → ürün grupları → katalog → çalışma saatleri → FloorPlan →
aynı handaki benzer mağazalar

Kritik noktalar:
- LocationBlock ekranın en okunaklı ikinci öğesi. Kullanıcı dükkânı fiziksel olarak
  arıyor.
- Ticari bilgiler 2 sütunlu sıkı ızgara: kısa etiket + kısa değer. Uzun açıklama
  cümlesi yazma. "Min. sipariş / 10 adet", "Numune / Var", "Kargo / Aynı gün",
  "Teslim / 1-2 gün". Ekranın ilk görünen bölümünde konum + ticari bilgiler +
  ürün grupları birlikte görünmeli.
- StickyActionBar kaydırmadan bağımsız sabit.
- Gövde metni 16px. Sistemin 13px varsayılanı burada geçerli değil, gerekçesi
  override dosyasında.
- Tüm metinler gerçekçi Türkçe. Lorem ipsum veya İngilizce yer tutucu yok.

Örnek mağaza: Emre Aksesuar Toptan · Yıldız Han, B Girişi, Kat 2, No 118 ·
Tahtakale, Fatih · "B girişinden girip merdivenle 2. kata çıkın, koridorun solunda" ·
telefon kılıfı, powerbank, kablo · min. sipariş 10 adet/model · numune veriliyor,
ücreti siparişten düşülür · kargo aynı gün (15:00'a kadar) · teslim 1-2 gün · toptan
```

---

## Prompt 2 — Mağaza profili (boş katalog varyantı)

```
Aynı ekranın ikinci varyantı: kataloğu boş bir mağaza.

Bu varyant kritik, çünkü esnafın büyük kısmı ürün fotoğrafı eklemeyecek. Ekran bu
haldeyken de eksik veya kusurlu görünmemeli:

- Katalog bloğu tamamen kaldırılır. Yerine "henüz ürün eklenmemiş" gibi bir eksiklik
  mesajı YAZILMAZ. EmptyState bileşeni de kullanılmaz.
- Ürün grupları, ticari bilgiler ve LocationBlock tek başına ekranı doldurur.
- StickyActionBar aynen kalır.

Kullanıcı bu ekranı gördüğünde mağazanın eksik değil, sadece farklı olduğunu
hissetmeli.
```

---

## Prompt 3 — Arama sonuçları

```
Brief'teki "Ekran 1 — Arama sonuçları". Mobil 390px, han teması.
Mağaza profilinde oturttuğun tipografi, renk ve kart stilini birebir kullan.

Yeni bileşen: StoreCard (spesifikasyonu override dosyası 4. bölümde).

Yapı: geri + arama kutusu (terim görünür) + filtre ikonu / yatay filtre çipleri
(ToggleGroup) / sonuç sayısı ve sıralama / StoreCard listesi.

StoreCard bilgi sırası kesindir: mağaza adı + doğrulama rozeti → LocationBlock
(kompakt varyant) → kategori Tag'leri → eşleşen ürün grupları → mesafe →
ticari Badge'ler → son güncelleme.

Konum satırı karttaki ikinci en belirgin öğe.

Arama terimi: "telefon kılıfı". 4 sonuç:
- Emre Aksesuar Toptan · Yıldız Han · B Girişi · Kat 2 · No 118 · 120 m
- Şahin Elektronik · Mercan İş Hanı · Kat 4 · No 402 · 260 m
- Deniz Telefon Aksesuar · Yıldız Han · A Girişi · Kat 3 · No 51 · 140 m
- Kaya Mobil · Sultan Han · Kat 1 · No 12 · 310 m
```

---

## Prompt 4 — Sıfır sonuç

```
Arama sonuçları ekranının "sonuç bulunamadı" hali.

Bu ekran asla boş kalmaz. Dört kademeli kurtarma sırayla görünür:
1. Yazım düzeltme önerisi: "Şunu mu demek istediniz: naylon torba?"
2. Eş anlamlı bilgisi: "naylon" için "poşet" sonuçları gösteriliyor notu (Alert, info)
3. Aynı kategoride en yakın 3 StoreCard
4. "Talep bırakın, size uygun mağazalara iletelim" — accent CTA

Arama terimi: "naylan torba" (yazım hatalı).
EmptyState bileşeninin illüstrasyon alanını kullanma — sade metin ve kartlar.
Maskot, çizim, boş kutu görseli yok.
```

---

## Prompt 5 — Han sayfası ve kat listesi

```
Brief'teki "Ekran 3 — Han sayfası". Mobil 390px, han teması.

Yeni bileşen: FloorPlan — basit SVG kat krokisi. Gerçek mimari plan değil;
dükkân numaraları görünür ve tıklanabilir, koridor şematik. Amaç kullanıcının
dükkânı bulması, mimari doğruluk değil.

Yapı:
- Han adı, adres, giriş bilgisi, tek küçük fotoğraf
- Kat seçici: ToggleGroup (Zemin · Kat 1 · Kat 2 · Kat 3 · Kat 4)
- FloorPlan (seçili kat)
- Kattaki mağaza listesi, dükkân no sıralı sade satırlar:
  "No 118 · Emre Aksesuar Toptan · Telefon aksesuarı"
- Handaki kategori dağılımı Tag'leri
- Yol tarifi butonu (outline)

Han: Yıldız Han, Tahtakale. Kat 2 seçili, 14 mağaza.
```

---

## Prompt 6 — Talep formu ve teyit

```
İki kare.

Birinci — talep formu. Sistemin FormField, Input, Textarea ve ToggleGroup
bileşenlerini kullan. Tek ekran, 4 alan, ilerleme çubuğu yok, hesap açma yok.
1. Ne arıyorsunuz? (Textarea, yer tutucu: "Şeffaf telefon kılıfı, iPhone 15 uyumlu")
2. Yaklaşık adet (Input, sayı)
3. Ne zaman lazım? (ToggleGroup: Bugün / Bu hafta / Bu ay)
4. Telefon numarası (Input)
Altında 12px KVKK notu. Tek accent buton: "Talebi Gönder".

İkinci — gönderim sonrası teyit. "Talebiniz iletildi" + kısa açıklama +
"Bu arada şu mağazalara bakabilirsiniz" başlıklı 3 StoreCard.

Giriş alanı yüksekliği 48px. Form uzun ve resmi hissettirmemeli; kullanıcı sokakta.
```

---

## Prompt 7 — Esnaf onboarding (3 adım)

```
İkinci kullanıcı grubuna geçiyoruz: mağaza sahibi esnaf, 45-60 yaş, dükkânda,
telefondan, dijital okuryazarlığı düşük, WhatsApp dışında uygulama kullanmıyor,
"bana bir şey satacaklar" savunması yüksek.

Bu ekranlar sistemin cok-adimli-form şablonundaki Stepper desenini temel alır.
Ama mobil öncelikli ve çok daha seyrek: bir ekranda bir soru.

3 adım tasarla:

Adım 1 — "Mağazanızın adı bu mu?" Büyük yazıyla mağaza adı (Emre Aksesuar Toptan),
altında "Evet, Doğru" primary butonu ve "Düzelt" outline butonu.

Adım 4 — "Ne satıyorsunuz?" Seçilebilir Tag çipleri (telefon kılıfı, ekran koruyucu,
kablo, powerbank, kulaklık, şarj aleti, adaptör, tutucu), altında "Başka bir şey ekle"
alanı. Kullanıcı yazmak zorunda kalmamalı.

Adım 6 — "Birkaç ürün fotoğrafı ekleyin" Büyük kamera butonu, "Şimdi Değil" ghost
butonu belirgin ve utandırmayan tonda.

Her ekranda: üstte Stepper (6 adımdan biri aktif), altta tek büyük primary buton,
geri her zaman mümkün. Gövde metni 16px, buton yüksekliği 48px.
```

---

## Prompt 8 — Esnaf ana ekranı

```
Brief'teki "Ekran 6 — Esnaf ana ekranı". Tek bir soruya cevap verir:
"Şimdi ne yapmalıyım?"

Card bileşenini kullan. Alt sekme çubuğu bu arayüzde var (A'dan farklı olarak).

Yukarıdan aşağı:
1. Bekleyen talepler — en üstte, Badge ile "3 yeni talep" + ilk talebin özeti
   ("Şeffaf telefon kılıfı, 200 adet, bu hafta") + "Görüntüle" primary butonu
2. Sıradaki iş — tek öneri kutusu (Alert, warning tonunda):
   "Kataloğunuz 40 gündür güncellenmedi" + tek buton
3. Profil tamamlanma — Progress bileşeni, "%70 tamamlandı"
4. Bu haftanın özeti — GRAFİK DEĞİL, CÜMLE:
   "Bu hafta profiliniz 240 kez görüntülendi. 18 kişi yol tarifi aldı,
   6 kişi size WhatsApp'tan yazdı."
   Sayılar kalın ve büyük (sistemin "numbers as hero" motifi), cümle akıcı.
5. Altta 4 sekme: Ana Ekran · Talepler · Katalog · Profil

Dördüncü blok bu ürünün en önemli ikna ekranı — esnaf ileride ücretli pakete buna
bakarak geçecek. Somut ve anlaşılır olmalı; abartılı kutlama tonu, konfeti, emoji yok.
```

---

## Prompt 9 — Kapanış

```
İki çıktı ver:

1. Yeni yazdığın bileşenlerin (StoreCard, LocationBlock, StickyActionBar, FloorPlan)
   prop imzaları ve varyantları. Bunlar tasarım sistemine geri eklenecek.

2. Uyanık Design System'den saptığın her nokta ve gerekçesi. Özellikle tipografi
   ölçeği, boşluk ve bileşen seçimleri. Sapmaların hangileri HAN'a özgü, hangileri
   sistemin genel bir eksiği — ayır.
```

İkinci çıktı önemli: sistemin genel eksiği olanlar Uyanık DS'ye geri işlenir, HAN'a özgü olanlar override dosyasında kalır.

---

## Revizyon prompt'ları

**Sisteme uymayan çıktı**
```
Bu ekran Uyanık Design System'den sapmış. Card, Button, Badge ve Tag bileşenlerini
sistemin tanımladığı şekilde kullan; kendi kart veya buton stilini üretme.
Gölge tek seviye (0 3px 4px rgba(0,0,0,.03)), derinlik 1px kenarlıktan gelir.
```

**Metin küçük kalmışsa**
```
Gövde metinleri sistemin 13px varsayılanına düşmüş. Alıcı arayüzünde bu geçerli
değil: hedef kitle 45-60 yaş, dış mekân, güneş altında. Gövde 16px, ikincil 14px,
14px altı yalnızca tarih ve dipnot.
```

**Ticari bilgiler yayılmışsa**
```
Ticari bilgiler bloğu çok yer kaplıyor. 2 sütunlu sıkı ızgaraya al, her hücre kısa
etiket + kısa değer olsun, açıklama cümlelerini kaldır. Kullanıcı sokakta ve acelesi
var; ekranın ilk görünen bölümünde konum + ticari bilgiler + ürün grupları birlikte
görünmeli.
```

**Marka kimliği kaybolmuşsa**
```
Ekran nötr gri-beyaz kalmış, han teması uygulanmamış. Lacivert #14304F başlıklarda,
ikonlarda ve LocationBlock zemininde görünmeli. Altın #C9A227 yalnızca tek birincil
CTA'da.
```

**Aksiyon çubuğu kaymışsa**
```
StickyActionBar sayfa akışının içine girmiş. Kaydırmadan bağımsız olarak ekranın
altında sabit kalmalı, her zaman görünür olmalı, güvenli alan payı bırakmalı.
```

**Fazla accent buton**
```
Ekranda birden fazla dolu accent buton var. Sistem kuralı: ekran başına en fazla bir
dolu accent. Diğerlerini primary solid, outline veya ghost yap. WhatsApp yeşili
fonksiyonel bir renktir, accent sayılmaz.
```
