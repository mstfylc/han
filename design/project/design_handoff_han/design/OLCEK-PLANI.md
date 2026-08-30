> **28.08.2026 denetimi:** bu belgedeki bazı ✅ maddeler kodda yarım kalmıştı.
> Bulgular ve düzeltmeler `DENETIM-PLANI.md` içinde; açık kalanlar orada §3'te.

# HAN · Ölçek Planı
*30.000–50.000 işletmeli Fatih için. Yazan: tasarım · Tartışmaya açık taslak, kod yazılmadan önce.*

## 1. Şu anki yanlış varsayımlar

| Bugünkü sistem | Gerçek |
|---|---|
| 11 dükkân kaydı, elle yazılmış | 30–50 bin işletme; elle yazılamaz |
| Han = bir mağaza gibi davranıyor (kart, panel, fotoğraf) | Han = 600–1000 dükkânı barındıran **yer** |
| Arama = 11 kaydı filtrele | Arama = 10 binlerce kayıt arasında **sırala**; filtre tek başına işe yaramaz |
| "Sonuç yok" bir hata durumu | Ölçekte "sonuç yok" olmamalı; her sorgu ya sonuç ya **talep** üretir |
| Haritada her kayıt bir pin | 10 bin pin harita değil, gürültü. Han/sokak düzeyinde **kümeleme** gerekir |
| Dükkân sayfası "doldurulmuş" varsayılıyor | Kayıtların çoğu uzun süre **eksik** olacak; eksiklik dürüstçe gösterilmeli |
| Öne çıkma = doğrulama rozeti | 10 bin rakip arasında öne çıkma **ürünün kendisi**: sıralama, talep dağıtımı, vitrin |

## 2. Amaç cümlesi (bunu her karar için ölçüt alalım)

> Tarihi Yarımada'ya gelen kişi *ne aradığını* yazar; HAN ona **nereden, kaç paraya, hangi kapıdan, kiminle konuşarak** alacağını söyler.
> Esnaf ise 10 bin rakip arasında **kendisini görünür kılmak için ne yapması gerektiğini** bilir.

İki tarafın da tek ölçütü var: **ilk yanıta kadar geçen süre**.

## 3. Veri modeli — yer hiyerarşisi

Bugün `AREAS → HANS → STORES` var; ölçekte beş katmana ihtiyaç var:

```
İLÇE      Fatih
 └ SEMT   Eminönü · Sirkeci · Sultanahmet · Aksaray · Laleli · Beyazıt · Tahtakale …
    └ YER (container)   Kapalıçarşı · Yıldız Han · Mahmutpaşa Yokuşu · Mısır Çarşısı
       └ BÖLÜM         kat · koridor · blok · sokak parçası
          └ BİRİM      fiziksel dükkân yeri (kapı no) — sahibi olsun olmasın VAR
             └ KAYIT   o birimdeki işletme (isim, kategori, iletişim, katalog)
                └ ÜRÜN / SKU
```

Kritik ayrım: **BİRİM ≠ KAYIT**. Bir hanın 600 birimi bellidir (kat planı, kapı numarası); bunların 80'i sahiplenilmiş olabilir. Sistem 600'ünü de bilir, 520'si için "burada bir dükkân var, henüz kaydı yok" der. Böylece:
- adres araması ("Yıldız Han 4. kat 402") kayıt olmasa da çalışır,
- doluluk/kapsama oranı ölçülebilir olur,
- esnaf kendi birimini **sahiplenerek** (claim) girer.

## 4. Kayıt durumları — editör + han onayı

Veriyi bölgedeki editör/saha yetkilisi girer ve onaylar; **esnaf da kendi kaydını açabilir ve kaydı onay beklemeden yayına girer** — ama onaysız olduğu açıkça görünür ve sıralamada geride durur.

| Durum | Nasıl oluşur | Aramada | Kullanıcı ne görür |
|---|---|---|---|
| **Birim** | yer omurgasında var, kaydı yok | yalnız adres aramasında | "Kaydı açılmadı" · "Sahibi misiniz?" |
| **Beyan** | esnaf kendi açtı, onay bekliyor | görünür, **en sonda** | "Doğrulanmadı · esnaf beyanı" |
| **Onaylı** | editör / saha yetkilisi / han yönetimi onayladı | görünür | "İletişim var" |
| **Aktif** | onaylı + katalog ve fiyat girilmiş | görünür, **üstte** | "Fiyat sorulabilir" |
| **Askıda** | şikâyet üzerine editör kararı | görünmez | saha yetkilisi tekrar bakar |

Kullanıcıya **durum adı değil eylem** gösterilir (itiraz 2 kabul edildi). Durum adı yalnız editör panelinde ve sıralama sinyali olarak yaşar.

### Onay hattı üç kaynaktan beslenir

1. **Han/bölge yetkilisi — toplu onay.** Her han ve her bölge için ayrı yetkili atanabilir. Han yönetimiyle çalışan yetkili 500 dükkânlık bir hanın onayını **tek günde** kapatabilir. Bu, kapsamanın asıl motoru: tek tek dükkân peşinde koşmak değil, **han han kapatmak**.
2. **Saha turu.** Yetkilinin yerinde gördüğü, henüz yönetim listesinde olmayan birimler.
3. **Esnaf başvurusu.** Kendi kaydını açar, beyan olarak yayına girer, sıraya düşer.

Editör paneli buna göre kurgulanır (Ö4): **han seç → 500 satır → toplu onay**, tek tek değil. Yanında beyan kuyruğu, kullanıcı bildirimleri ve yetkili ataması.

### İki sonucu
- **Kapsama iki sayı**: kaç birim var, kaçı onaylı. Şişirilmiş tek sayı yok.
- **Beyan kaydı yayında ama ödülsüz**: fiyat/teklif hakkı yok, sıralamada geride, üstünde doğrulanmadı damgası. Esnafı onaya iten şey bu.

## 5. Veri nereden gelir

1. **Yer omurgası** (öncelik): han/çarşı/sokak/kapı + kat planları — sabit, elle küratörlü. ~40 büyük yer, ~15.000 birim.
2. **Han yönetimi listeleri**: yetkili aracılığıyla toplu giriş + toplu onay.
3. **Saha turu**: yetkilinin birim birim doldurması.
4. **Esnaf başvurusu**: beyan olarak yayına, sonra onaya.
5. **Kullanıcı bildirimi**: "kapalıydı", "burada değil", "isim değişmiş" — üç kullanıcı aynı şeyi derse kayıt **askıya** düşer, yetkili kuyruğuna girer.
6. **Tazelik**: 90 gün dokunulmayan aktif kayıt onaylıya, 180 gün sonra askıya iner. Esnaf haftada bir dokunuşla korur.

> Satın alınan POI/sicil verisi prototipten çıkarıldı; operasyon kararı olarak sonraya bırakıldı.

## 6. Arama: filtre değil sıralama

Ölçekte arama üç aşama:

1. **Anlama** — yazılan şey ürün mü, kategori mi, dükkân adı mı, kapı no mu, telefon mu? Çok dilli eşanlam sözlüğü (kılıf / case / чехол / غطاء), yazım toleransı, tekil-çoğul.
2. **Aday havuzu** — kategori + semt/yer + moda göre (toptan/perakende) daraltma. 10 binden ~yüzlere.
3. **Sıralama** — asıl ürün burada:
   - kayıt kademesi (D > C > B > A)
   - yanıt hızı ve oranı (son 30 gün)
   - mesafe / bulunma kolaylığı (kapıya yakınlık, kat)
   - sorguya uygunluk: MOQ, fiyat aralığı, dil, ödeme, ihracat
   - katalog kalitesi (fotoğraf, fiyat girilmiş mi, stok tazeliği)
   - **ceza**: yanıtsız talep, iptal, kullanıcı şikâyeti

Yan çıktı: **"sonuç yok" ekranı kalkar.** Eşleşme zayıfsa ekran şunu der: *"Bu ürünü listeleyen 3 dükkân var; ayrıca aynı kategoride 240 dükkâna tek talep gönderebilirsiniz."*

Filtreler de ölçeğe göre değişir: semt → yer → kat, MOQ aralığı, birim fiyat aralığı, dil, ödeme, ihracat, üretici/toptancı, açık/kapalı, kademe.

## 7. Yer sayfaları (han bir mağaza değil)

**Han / çarşı sayfası** şunları yapar:
- kimlik: kaç birim, kaç kayıt açık (kapsama %), kaç kat, hangi girişler, çalışma saatleri
- **kat planı / kat kat kategori dağılımı**: "2. kat ağırlıklı kılıf-şarj, 4. kat tekstil"
- içinde arama: "bu handa ara" (600 birim arasında)
- en çok bulunan kategoriler + o kategorinin en iyi 5 kaydı
- giriş tarifi, hangi kapıdan girilir, asansör/merdiven, yük indirme
- etkinlik/kampanya, çay ocağı gibi pratik noktalar

**Sokak / koridor sayfası** aynı mantıkla: hangi işin sokağı, hangi kapılara açılır, kaç dükkân.

Böylece kullanıcı "10 bin dükkân" ile değil, **"bu iş bu üç handa"** bilgisiyle karşılaşır.

## 8. Keşif: 10 bini gezmeye kimse kalkmaz

- **Kategori → yer eşlemesi**: her kategori sayfası "bu iş nerede yoğun" haritası + en iyi kayıtlar.
- **Yoğunluk haritası**: pin değil, han/sokak düzeyinde sayı ve kategori ısısı. Zoom'a göre kırılır (semt → yer → birim).
- **Rehberli girişler**: "ilk kez geliyorsanız", "toptan alacaksanız", "tek parça hediyelik".
- **Plan/rota**: alım listesi → durak sırası (bugün de var, ölçekte asıl değer bu).

## 9. Talep motoru (RFQ) — ölçekte en güçlü kozumuz

10 bin dükkânı gezmek yerine: tek talep → eşleşen dükkânlara dağılır → teklifler gelir → karşılaştırılır.

Dağıtım kuralları: kategori uyumu, MOQ uyumu, dil, kapasite, kayıt durumu, son 30 gün yanıt performansı.
Koruma: dükkân başına günlük talep kotası; yanıt vermeyen dükkân havuzdan düşer; alıcı tarafında sahte talep limiti.

Bu motor aynı zamanda **veri üretir**: hangi ürün aranıyor, hangi dükkân yanıt veriyor — sıralamayı besler.

## 10. Esnafın öne çıkması

**Ücretsiz ve hak edilen** (sıralamayı gerçekten değiştirir):
editör onayını al → katalog gir → fiyat/MOQ yaz → hızlı yanıt ver → stok tazele → ikinci dil ekle.
Panelde tek bir "görünürlük karnesi": *"Kataloğunuzda fiyat girilmemiş 40 ürün var; girerseniz aramada ortalama 6 sıra yükselirsiniz."*

**Ücretli** (yerleşim satın alır, sıralamayı satın almaz):
kategori/koridor vitrini, kampanya kartı, talep havuzunda öncelikli bildirim, çoklu dil çeviri, profesyonel fotoğraf, ihracat evrak desteği.
Kural: para yalnızca **etiketli** alanları alır ("Sponsorlu"); organik sıralama satılmaz. Yanıt performansı düşen dükkânın ücretli yerleşimi de durur.

## 11. Teknik ölçek (web tarafı)

- `han-data.js` elle yazılmış tek dosya olarak kalamaz: **veri parçalanır** (semt/yer bazlı), arama indeksi ayrı üretilir.
- Sonuçlar sayfalı + sanal liste; hiçbir ekran 10 bin düğüm basmaz.
- Çevrimdışı: yalnız kullanıcının indirdiği bölge (bir semt / bir han) önbellekte.
- Sayılar tek yerden: "kayıtlı dükkân" ile "kataloğu açık dükkân" ayrı ayrı, asla şişirilmiş tek sayı değil.

## 12. Ölçüm (bunları göremezsek plan çalışmıyor)

kapsama oranı (birim başına onaylı kayıt %) · durum dağılımı (bekliyor / onaylı / aktif) · editörün haftalık onay hızı · medyan ilk yanıt süresi · arama → iletişim dönüşümü · talep başına gelen teklif sayısı · teyit bekleyen kayıt oranı.

## 13. Sıra önerisi

| Faz | İş | Neden bu sırada |
|---|---|---|
| **Ö1** | Veri modeli: BİRİM/KAYIT ayrımı, kademe alanı, yer hiyerarşisi + ~2.000 üretilmiş kayıtla gerçekçi yoğunluk | Her şey buna dayanıyor; 11 kayıtla tasarım yanıltıyor |
| **Ö2** | Ölçekli arama: anlama + sıralama + yeni filtreler + sonuçsuzluğun kalkması | Ürünün kalbi |
| **Ö3** | Yer sayfaları: han/çarşı/sokak (kat planı, kapsama, içinde arama) | Han'ın mağaza sanılması buradan düzelir |
| **Ö4** | Editör paneli: han han toplu onay, beyan kuyruğu, yetkili atama, kullanıcı bildirimleri | Kapsama bu hattan geliyor |
| **Ö5** | Yoğunluk haritası (kümeleme) | "10 bin dükkân" hissi ilk temasta buradan gelir |
| **Ö6** | Talep motoru dağıtımı ve teklif karşılaştırma | Kayıt hacmi oluştuktan sonra |
| **Ö7** | Esnaf görünürlük karnesi + ücretli vitrin | Kayıt hacmi oluştuktan sonra anlamlı |

## 13b. Kararlar (bu turda alındı)

- Sahipsiz birimler görünür: "Yıldız Han 4. kat 402 — kaydı henüz açılmadı".
- Yer omurgası önce; işletme kayıtları üzerine oturur.
- Prototipte ~2.000 kayıt; hepsi editör/saha yetkilisi elinden geçmiş ya da esnaf beyanı — uydurma kirlilik yok.
- Esnaf kaydı **onaysız yayına girer**, "doğrulanmadı" damgasıyla ve sıralamada geride.
- Han/bölge başına **yetkili atanabilir**; han yönetimiyle toplu onay (500 dükkân/gün) kapsamanın motoru.
- Editör paneli tek tek değil **han han toplu onay** üzerine kurulur.
- **Yeme-içme bu aşamada kapsam dışı** (lokanta/kahve sonraya).
- Sıra: Ö1 → Ö2 → Ö3 → Ö4 → Ö5 → Ö6 → Ö7.
- Ücretli katman Ö7'ye bırakıldı; kural şimdi yazıldı: **organik sıralama satılmaz**, para yalnız "Sponsorlu" etiketli yerleşim alır.
- Sıralama şeffaflığı: her sonuç satırında tek satır **"neden bu sırada"** (yanıt süresi · kat · fiyat girilmiş mi) + "sıralama nasıl çalışır" açıklaması.
- Toptancının kimliği ürün listesi değil: **çeşit grubu + fiyat bandı + MOQ** bloğu, temsili vitrin, "bunu satıyor mu?" kutusu, katalog isteği.
- Her yer sayfasında kapsama sayacı: "640 birim · 84 kayıt onaylı (%13)".

## 14. Açık kalan sorular

1. **Kapsama stratejisi**: birimleri (sahipsiz dükkân yerlerini) de gösterecek miyiz, yoksa yalnız sahiplenilmiş kayıtlar mı? (Bence birimler de görünmeli — adres araması ve kapsama ölçümü buna bağlı.)
2. **Veri kaynağı**: satın alınan POI/sicil verisi mi, saha ekibi mi, esnafın kendi kaydı mı — hangisi omurga?
3. **Doğrulama kapasitesi**: haftada kaç dükkân yerinde doğrulanabilir? Bu sayı C/D kademesinin hızını belirler.
4. **Yeme-içme dahil mi?** 30–50 bin sayısı lokantayı da içeriyor; ticaret ile aynı sayfa şablonu mu, ayrı mı?
5. **Ücretli katman şimdi mi konuşulsun**, yoksa Ö7'ye mi bırakılsın?
6. **Prototipte kaç kayıt simüle edelim?** (2.000 kayıt gerçek ölçek hissi verir ve tarayıcıda rahat döner; 50.000 için indeks/parçalama gerekir.)


---

## 15. Uygulama durumu (bu turda)

| Faz | Durum | Nerede |
|---|---|---|
| **Ö1** Veri modeli | ✅ | `han-scale.js` — 15 semt, 38 yer, ~14.700 birim, ~2.000 kayıt, onay hattı (beyan/onaylı/aktif/askıda), yetkililer, toplu onaylı hanlar, `SETTINGS` |
| **Ö2** Ölçekli arama | ✅ | `han-search.js` — çok dilli eşanlam, aday havuzu, 8 sinyalli sıralama, "neden bu sırada", sayfalama, birim (adres) araması, talep önerisi |
| **Ö3** Yer sayfaları | ✅ | HAN Web `#/yer/<id>` — kapsama çubuğu, kat kat kategori dağılımı, içinde arama, buradaki en iyi kayıtlar, yakın yerler |
| **Ö4** Editör paneli | ✅ | `HAN Editör.dc.html` — han han toplu onay, beyan kuyruğu, yetkili karnesi |
| **Ö5** Yoğunluk | ✅ | HAN Web · Harita → Yoğunluk: semt → yer → kat kümeleme (pin değil sayı) |
| **Ö6** Talep motoru | ✅ | `han-search.js` `distribute()` / `offersFor()` — kategori + MOQ + dil + yanıt performansına göre dağıtım, kota, şeffaf dağıtım satırı |
| **Ö7** Görünürlük karnesi | ✅ | `HAN Editör.dc.html` → Görünürlük karnesi: 8 maddelik puan, sıradaki en kârlı adım, "sıralama satın alınamaz" kuralı |

### Denetim sonrası kapatılan boşluklar

- **Teklif karşılaştırma** eski 11 kayıtlık havuzdan besleniyordu → ölçek kayıtlarına bağlandı (fiyat bandı ve yanıt süresi satırlarıyla).
- **Tazelik kuralı** yalnız ayar olarak duruyordu → `applyFreshness()`: `freshDays` geçen aktif kayıt onaylıya, iki katı geçen askıya iner.
- **Kullanıcı bildirimi eşiği** yoktu → aynı kayıt için üçüncü bildirim kaydı askıya alır (`REPORT_THRESHOLD`), sorun bildir akışına bağlı.
- **§ 12 ölçüm** hiçbir yerde görünmüyordu → editör panelinde "Ölçüm" sekmesi: kapsama, fiyat sorulabilir oranı, beyan kuyruğu, medyan yanıt, teyit bekleyen, ölü kayıt oranı, toplu onay kapsamı + semt semt kapsama tablosu.
- **§ 8 kategori → yer eşlemesi** yalnız aramada vardı → kategori sayfasında "bu iş nerede yoğun" listesi (yerlere gider).
- **§ 8 rehberli girişler** yoktu → anasayfada "ilk kez mi geliyorsunuz" (yoğunluk haritası) ve "toptan alacaksanız" (adet ile arama) kartları.

### Son üç boşluk da kapatıldı

- **Ücretli katman** → `SPONSOR_KINDS` (kategori vitrini, yer vitrini, talepte öncelikli bildirim) + `SPONSORS`/`sponsorsFor()`.
  Yerleşim aramada **etiketli ayrı şerit**: turuncu kesik çerçeve, "Sponsorlu · organik sıralamayı etkilemez".
  Sponsorluk yalnız aktif ve yanıt oranı ≥ %85 kayda verilir; performans düşerse yerleşim otomatik durur (`paused`).
  `SETTINGS.showSponsored` ile kapatılabilir.
- **Veri parçalanması + ayrı arama indeksi** (§ 11) → `han-index.js`: semt bazlı parçalar (`data/records-<semt>.json`),
  ters indeks (`data/index.json`), `candidatesFor()` yalnız sorgunun dokunduğu parçaları yükler,
  `searchAsync()` bu yolu kullanır. Dosya yoksa bellekte üretir — prototip her koşulda çalışır.
  Build çıktısı `han-index-build.html` sayfasından üretilip `data/` klasörüne konur.
- **Sokak/cadde şablonu** → cadde tipi yerlerde kat listesi yerine "bu sokak ne satar" (ağırlıklı iş, kapı aralığı,
  ticaret tipi, açıldığı yerler) + kapı bloklarına göre dağılım.

### Kapsam dışı

- **Yeme-içme**: kararı gereği yok.
