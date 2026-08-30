# Ürün Kararları

Planlar ekranları kapsıyordu, ürün kararlarını kapsamıyordu. Bunlar verildi — gerekçeleriyle.
Etkilenen plan maddeleri her kararın altında.

> **30.08.2026 · açık kalan dört karar kapatıldı.**
> **M1 · Mobil** (`HAN.dc.html`) emekliye ayrıldı — ölçek katmanına hiç geçmemişti;
> dosya arşiv bandıyla duruyor, HAN Web'e yönlendiriyor.
> **M2 · Ürün sayfası** uygulandı (`#/urun/<kategori>[/<ürün>]`).
> **M4 · Ticaretin kapanışı** — K1 ile çelişki giderildi, aşağıda §M4.
> **M5 · Gün planı takvimi** uygulandı — duraklar + etkinlikler + randevular tek çizgide.

## K1 · Platform işleme girmez (v1)
Çarşı nakit ve pazarlık kültürü; esnaf komisyon kabul etmez, kaçar. Ödeme almak = lisans,
escrow yükümlülüğü, iade/anlaşmazlık operasyonu — keşif ürününün taşıyacağı yük değil.
Alıcının çoğu (turist) zaten dükkânda ödeyecek.
- **Gelir:** sponsorluk (Ö7, kurulu) + ileride doğrulanmış toptan profil aboneliği.
- **Tek istisna:** ihracat kargosu/gümrük gibi kurumsal hizmetlerde partner yönlendirme komisyonu
  (zaten faturaya bağlı bir alan).
- Kapora/escrow v2 tartışmasıdır, v1 kapsamı dışında.
- Etki: Faz 0.2'deki "kapora/vade" maddesi **bilgi alanı** olarak kalır (esnafın beyan ettiği
  koşul), platformun tahsil ettiği bir şey değil.

## K2 · Alıcı doğrulaması kademeli ve gönüllü
Turist için doğrulama yok — guest-first bozulmaz, sürtünme kayıptır.
Toptan tarafında: ilk talep serbest, telefon doğrulaması bir kez. Gönüllü firma doğrulaması
(firma adı + vergi no + ülke) → **doğrulanmış alıcı rozeti** → talep esnaf tarafında üstte
görünür + kota artar. Doğrulama zorunluluk değil, **kimlikle öncelik kazanma** yolu (parayla değil).
Spam kontrolü: 3 "sahte talep" bildirimi kotayı düşürür.
- Etki: Faz D1 kanal seçimine "alıcı doğrulanmış mı" sinyali eklenir; Ö6 kotası bu rozete bağlanır.

## K3 · Platform hakem değil, kayıt tutucu
İşleme girmediğimiz için hakemlik yapamayız. Ama anlaşma sonrası her iki tarafa tek soru:
"sonuçlandı mı?" (oldu / olmadı / yanıt yok). Bu sinyal esnafın güven metriğine işler.
**Yorum yazma hakkı yalnız teklif kabul etmiş alıcıda** — fake review'ün en etkili panzehiri.
- Etki: Faz C3'e "yorum yalnız doğrulanmış işlemden" kuralı eklenir; A2 (yer-seviyesi itibar)
  bu kuralla beslenir.

## K4 · Mobil: ikinci uygulama değil, "çarşı modu"
Alıcı araştırmayı masaüstünde/otelde yapar, çarşıda telefonu kullanır — ikisi farklı iş.
Masaüstü = keşif/karşılaştırma. Mobil = navigasyon/temas.
Karar: mevcut responsive yapı kalır (`compact` modu zaten var), üzerine **çarşı modu**:
rota, kapı numarası, telefon, "şu an açık", kaydettiklerim. Fazlası yok.
- Etki: Faz C1'in "şu an açık mı" ve "fiziksel erişim" maddeleri çarşı modunun çekirdeği.

## K5 · İçerik çevirisi: sözlük tabanlı, serbest metin çevrilmez
Esnafın serbest yazdığını makine çevirisiyle göstermek yanlış bilgi riski (fiyat, ürün adı).
Karar: esnaf içeriği **yapılandırılmış** girilir — çeşit grupları var olan `GROUP_WORDS`
sözlüğünden seçilir, serbest metin değil. Sözlük 4 dilde hazır olduğu için çeviri otomatik ve doğru.
Serbest metin alanı çevrilmez, "esnafın kendi dilinde" etiketiyle gösterilir.
- Etki: Faz B3 formu serbest metin kutusu değil, **sözlükten seçim** arayüzü olacak.

## K6 · Kapı kaydı kalıcı, sahiplik geçici
Yer katmanı (han/kat/kapı) hiç silinmez — fiziksel gerçek. Sahiplik kiracıya bağlı ve süreli.
Yeni sahiplenme talebi gelir ve mevcut sahiplik varsa → **çakışma kuyruğu**: eski sahibe 7 gün
itiraz bildirimi; itiraz yoksa devir onaylanır, itiraz varsa yetkili saha turuyla karar verir.
Devirde içerik override'ı sıfırlanır (yeni esnaf eski fiyatı devralmaz), fotoğraflar silinir,
yorumlar arşivlenir ve "önceki işletme" olarak işaretlenir.
- Etki: Faz B1'e devir/sıfırlama kuralı, Editör planına çakışma kuyruğu (E kuyruğuna 9. madde).

## K7 · Kuzey yıldızı: karşılık bulan talep
Kapsama (kaç kayıt) girdi metriğidir, sonuç değil. Ürünün sonucu talebin yanıt almasıdır.
**Kuzey yıldızı: haftalık karşılık bulan talep sayısı** (en az bir teklif/yanıt alan talep).
Destek metrikleri: onaylı kayıt oranı, esnaf sahiplenme sayısı, rota tamamlama (kapıya varış).
- Etki: Editör planı E8 (ölçüm eylem üretmiyor) bu metriğe göre yeniden kurulur.

## K8 · Esnaf ikna katmanı: karne değil, kaçırılan talep
Esnaf soyut puana değil paraya bakar. Sahiplenme çağrısı "kaydını doldur, puanın artsın" değil:
**"bu ay senin kategorinde X talep geldi, Y'sine yanıt verilmedi."** Veri talep motorundan (Ö6)
zaten üretilebiliyor.
- Etki: Faz A1 (sahiplenme CTA'sı) metni ve Faz B3 panelinin üst bloğu bu çerçeveyle yazılır.

---

# Uçtan uca kopmalar (denetim sonrası verilen kararlar)

Akışları tek tek yürüyünce dört yerde yarım iş çıktığı görüldü. Kararları:

## K9 · Tahmini teklif ile gerçek teklif asla karışmaz
Sorun: teklifleri şu an `offersFor` motoru üretiyor; D5 ile esnaf gerçek teklif verecek.
Aynı listede yan yana durursa alıcı hangisinin gerçek olduğunu bilemez.
**Karar:** iki ayrı tür, görsel olarak ayrışır ve asıl sıralama gerçeğin.
- **"Tahmini aralık"** — motordan gelen, fiyat bandına dayalı, açıkça etiketli, **kabul edilemez**
  (kabul butonu yok). Amacı yön vermek: "bu iş bu civarda konuşulur".
- **"Dükkândan teklif"** — sahiplenmesi onaylı esnaftan gelen, kabul edilebilir, taahhüt sayılır.
- Gerçek teklif geldiğinde tahminler listenin altına iner.
- Etki: Faz D5 ve Ö6 teklif listesi; İşlerim→Karşılaştır yalnız gerçek teklifleri karşılaştırır.

## K10 · Esnaf ve editör için kimlik zorunlu, alıcı guest kalır
Sorun: sahiplenme onaylandı ama her şey `localStorage`'da; esnaf başka cihazdan kaydına erişemez.
**Karar:** **telefon = kimlik.** Esnaf ve editör için telefon + tek kullanımlı kod ile kalıcı oturum
(cihaz bağımsız). Alıcı tarafında guest-first bozulmaz (K2).
Sahiplenme talebindeki telefon zaten alınıyor — kimliğin çekirdeiği o.
- Etki: Faz B2 erişim kontrolü "claims kontrolü" değil **oturum kontrolü** olur;
  Editör E5 (rol) bu oturuma bağlanır — yetkili kendi bölgesini görür.

## K11 · Üretilmiş veri "tahmini" olarak etiketlenir
Sorun: 2000 kayıt tohumlu üretilmiş — fiyat bandı, yanıt oranı, puanlar uydurma. C3 fotoğraf ve
tazelik dürüstlüğünü getiriyor ama verinin kendisinin tahmini olduğunu söylemiyor.
**Karar:** her alanın bir **kaynak** işareti olur: `tahmini` (üretilmiş/çıkarım) · `esnaf beyanı` ·
`yetkili doğruladı`. Tahmini alan açıkça öyle gösterilir ve **fiyat bandı da buna dahildir**.
Esnaf doldurunca alan `esnaf beyanı`na, yetkili onaylayınca `yetkili doğruladı`ya yükselir.
- Etki: Faz C3'e "alan kaynak işareti" maddesi; A0/A7 gösterimleri bu işarete göre yazılır.

## K12 · Bildirim teslimi WhatsApp/SMS üzerinden
Sorun: çarşı esnafı uygulamayı gün boyu açık tutmaz; D5 gelen kutusu boş bir oda olur ve
D4'ün "yanıt gelmedi" akışı yanlış sinyal üretir.
**Karar:** teslim kanalı **WhatsApp/SMS**; uygulama içi kutu yalnız arşiv ve geçmiş.
Talep esnafa mesaj olarak düşer, esnaf mesajla ya da linke tıklayıp panelden cevaplar.
Yanıt süresi ölçümü mesajın gönderildiği andan başlar.
- Etki: Faz D4 "yanıtsız" tanımı ancak teslim edilmiş mesaj için geçerli olur;
  D5 paneline "mesajla cevapla" kısayolu eklenir.


---

## M4 · Ticaretin kapanışı — karar (30.08.2026)

**Çelişki neydi.** Bir yerde "karma model onaylandı: küçük perakendede ödeme HAN'da,
toptanda teklifte biter" yazıyordu; başka yerde v1 kapsamı "işleme girmez" diyordu.
İkisi aynı anda doğru olamaz ve kod ikincisine göre yazılmıştı.

**Karar: v1 ödeme işlemez.** Karma model **v2'ye ertelendi**.

**Gerekçe.**
1. Ödeme almak HAN'ı *aracı* yapar: iade, anlaşmazlık, çağrı merkezi, mutabakat ve
   yasal yükümlülük gelir. Bunların hiçbirinin ekranı, ekibi veya süreci yok.
2. Ürünün çözdüğü asıl sorun ödeme değil **bulunamamak**. 14.716 birimin %93'ünde
   kayıt yok — para akışı değil kapsama darboğaz.
3. Çarşının kendi ticareti zaten nakit ve pazarlıkla yürüyor. Esnafı ödeme akışına
   zorlamak, sahiplenme oranını düşürür — kaybedeceğimiz şey tam da omurga.
4. Teklif zaten **bağlayıcı bir taahhüt** (7 gün geçerli, kabul edilebilir).
   Anlaşma noktası nettir; sonrası tarafların bilinen usulüdür.

**v1'in kapanış noktası:** alıcı teklifi kabul eder → HAN anlaşmayı kaydeder →
ödeme ve teslim taraflar arasında. HAN yalnız **sonucu** sorar (aldım / bozuldu /
dönüş olmadı) ve bunu güven metriğine işler.

**v2 için ön koşullar** (biri eksikse ödeme açılmaz):
- Anlaşmazlık çözüm süreci ve ekibi
- İade politikası (çarşıda karşılığı olan, kopyalanmış değil)
- Esnafın vergi/fatura durumunun kayıt bazında doğrulanmış olması
- En az bir kategoride %40+ kapsama — ödeme, kapsama sorununu çözmez, üstüne biner
