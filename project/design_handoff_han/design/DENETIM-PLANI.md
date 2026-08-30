# HAN — Uçtan Uca Denetim (28.08.2026)

Tüm akışlar baştan sona yürütüldü; planlarda "tamamlandı" işaretli olduğu hâlde
kodda kapanmayan yerler çıkarıldı. Bu belge bulguları, yapılanları ve bilerek
bırakılanları tutar.

---

## 1. Yöntem

Her akış **girdi → durum → ekran → karşı taraf → sonuç** olarak yürütüldü:

| Akış | Uçtan uca yürüdü mü (önce) |
|---|---|
| Ara → dükkân → temas | ✔ |
| Talep → dağıtım → teklif → **kabul** → sonuç | ✘ *kabul hiç mümkün değildi* |
| Esnaf: sahiplenme → onay → panel → içerik | ✔ |
| Esnaf: gelen talep → **cevap** | ✘ *teklif verilemiyordu* |
| Editör: onay/askı → **alıcı ekranı** | ✘ *karar karşıya geçmiyordu* |
| Alıcı bildirimi → editör kuyruğu | ✘ *bildirim yenilemede uçuyordu* |
| Anlaşma → **yorum** | ✘ *hak kontrolü hep false idi* |
| Yönetim paneli sayıları | ✘ *sahte demo verisi* |

---

## 2. Bulgular ve yapılanlar

### U1 · 11 zengin kaydın çeşit grubu ve fiyat bandı boştu  ✅
`han-scale.js` içinde `curated` kayıtlar `band: null, groups: [], skuCount: 0` ile
üretiliyordu. Sonucu: çarşının en iyi doldurulmuş 11 dükkânı aramada bandsız
görünüyor, görünürlük karnesinden puan kaybediyor ve teklif motoru onlar için
sabit 40 ₺ varsayıyordu.
**Yapıldı:** grup, bant ve çeşit sayısı dükkânın kendi ürün listesinden türetiliyor;
`trade.sells` yetenek kümesi de gerçek fiyatlardan çıkarılıyor (perakende fiyatı olan
kayıt perakende de satar).

### U2 · Talep döngüsü hiç kapanmıyordu — en ağır kırık  ✅
`offersFor()` bir teklifi "gerçek" saymak için **kaydın sahiplenilmiş olmasına**
bakıyordu. Yani fiyat yine motorun uydurduğu sayıydı, sadece etiketi değişiyordu.
Temiz bir tarayıcıda hiçbir kayıt sahiplenilmemiş olduğu için **hiçbir teklif kabul
edilemiyordu**; kabul olmayınca sonuç, yorum ve tekrar sipariş de ölüydü.
Esnaf panelinde gelen talep görünüyordu ama **teklif verecek yer yoktu**.

**Yapıldı — `han-offers.js` (yeni):** gerçek tekliflerin, "açtı" işaretlerinin,
"cevaplayamam" gerekçelerinin ve yorumların ortak deposu.
- Motor artık **yalnız tahmin** üretir (`real: false`, kabul butonu yok).
- Esnaf panelinde **teklif formu**: birim fiyat · adet · termin · not. Kaydedilen
  teklif 7 gün geçerli bir taahhüttür, alıcıda **üstte** çıkar, tahminler altına iner.
- Aynı dükkân iki fiyatla görünmez: gerçek teklif veren kaydın tahmini listeden düşer.
- **"Cevaplayamam"** dört gerekçeyle (bende yok · adet uymuyor · termine yetişmez ·
  kapasitem dolu) — sessizlikten iyidir, alıcı sebebi görür.
- Teklif geçerliliği **teklifin kendi yaşından** hesaplanıyor (eskiden talebin yaşından).

### U3 · Huni uyduruyordu  ✅
"talebi açtı" satırı `sent × 0.42` idi. Artık: **gitti** = dağıtım, **açtı** = esnaf
paneli talebi gösterdiğinde işaretlenen gerçek kayıt, **teklif verdi** = gerçek teklif
sayısı, **cevaplayamadı** = gerekçeli redler.

### U4 · Yorum hakkı hiçbir zaman açılmıyordu (K3)  ✅
`acceptedOffers[reqId]` düz bir id metniydi; kontrol `(...).recordId === rec.id`
diyordu → her zaman `false`. "Yorum yazabilirsiniz" cümlesi hiç görünmüyordu ve
zaten yazacak form yoktu.
**Yapıldı:** kabul edilen teklif artık taahhüdün kendisini saklıyor (fiyat, adet,
termin, tarih); ortak `reviewVals()` iki mağaza sayfasında da yıldız + metin formunu
yalnız hak sahibine açıyor; yazılan yorum `han-reviews-v1`'e gidiyor ve sayfada çıkıyor.

### U5 · Editörün kararı alıcı tarafına geçmiyordu  ✅
Editör `han-approvals-v1`'e yazıyordu, Web hiç okumuyordu. Onaylanan kayıt aramada
yükselmiyor, askıya alınan görünmeye devam ediyordu.
**Yapıldı:** `SC.applyApprovals()` tek merge noktası — Web, Editör ve Panel açılışta
ve `storage` olayında aynı fonksiyonu çağırıyor.

### U6 · Kullanıcı bildirimleri kalıcı değildi  ✅
`reports` yalnız state'teydi; yenilemede uçuyordu, üçüncü bildirim eşiği (`REPORT_THRESHOLD`)
kalıcı olmuyordu ve editör hiç görmüyordu.
**Yapıldı:** `han-reports-v1` deposu; Web açılışta okuyup uyguluyor, Editör de okuyup
askı kuyruğunu besliyor.

### U7 · Talep durumu tahminle ilerliyordu  ✅
Tahmini aralıklar her zaman geldiği için talep anında "Değerlendirme"ye geçiyor,
rozet "N teklif geldi" diyordu. Artık durum ve rozet **gerçek** tekliflere bakıyor;
tahminler ayrı ifade ediliyor ("N tahmini aralık"). Bildirim sayacı da öyle.

### U8 · Numune aşaması yoktu  ✅
Talep formu numune soruyordu, akışta karşılığı yoktu. Talepte numune istendiyse
kabul öncesi dört durumlu bir aşama eklendi (istedim · yolda · geldi uygun ·
geldi olmadı), talebin üstünde kalıcı.

### U9 · Esnafın "kaçırdığın iş" sayısı yanlıştı (K8)  ✅
Sistemdeki **toplam** talep sayısını gösteriyordu. Artık kendi kategorisine düşen
talep, kaçı yanıtsız ve yaklaşık tutarı — kaçıran esnafın kendi rakamı.

### U10 · Alıcı kademesi esnafın cihazından okunuyordu  ✅
Gelen talep kartındaki "onaylı firma · N anlaşma" rozeti, **esnafın kendi**
alıcı profilinden hesaplanıyordu. Artık kademe **talebin üstünde donuyor**:
esnaf, talebin geldiği andaki kimliği görür.

### U11 · Esnafın çalışma saati alanı ölüydü  ✅
`mf.open/close` state'te vardı, forma da kayda da bağlı değildi; "şu an açık mı"
her kayıt için yerin varsayılan saatini kullanıyordu. Form alanları eklendi,
`openState(place, now, rec)` artık esnafın girdiği saati üstün tutuyor.

### U12 · Yönetim paneli sahte veriyle çalışıyordu  ✅
`HAN Panel.dc.html` elle yazılmış 4 han, 12 mağaza ve 5 talep üzerinden rapor
veriyordu; ölçek katmanındaki 38 yer / 1.385 kayıt ile çelişiyordu ("sayılar tek
yerden" kuralının ihlali).
**Yapıldı:** panel `han-scale.js`'i, editör kararlarını, kullanıcı bildirimlerini ve
alıcının gerçek taleplerini okuyor. Kapsama artık şişirilmiş tek sayı değil:
**964 açık kayıt / 14.716 birim**.

### U13 · Cuma günü anasayfa çöküyordu  ✅
`homeVals()` içinde ölü değişken adı (`todayRows`) kalmıştı; `dow === 5` olduğunda
`renderVals()` patlıyor ve sayfa boş açılıyordu. Denetim bugün (Cuma) bunu yakaladı.

---

## 3. Bilerek yapılmayan — karar gerekiyor

### M1 · Mobil uygulama ölçeğe hiç geçmedi  ✅ karara bağlandı (emekliye ayrıldı)
`HAN.dc.html` (8.600 satır) hâlâ **yalnız `han-data.js`'in 11 kaydıyla** çalışıyor:
`han-scale.js`, `han-search.js`, `han-offers.js` dosyalarının hiçbirini yüklemiyor.
Yani ölçek verisi, sıralamalı arama, talep motoru, sahiplenme/onay hattı, sponsorluk
ve gerçek teklif döngüsünün **hiçbiri mobilde yok**. K4 "mobil = çarşı modu" diyor;
bu haliyle mobil ayrı bir üründür, çarşı modu değil.

Üç yol var, biri seçilmeli:
1. **Emekliye ayır** — web zaten `compact` kırılmasıyla telefonda çalışıyor ve Faz M
   (çarşı modu) orada uygulandı. `HAN.dc.html` arşive kalkar. *(Önerim bu.)*
2. **Çarşı moduna indir** — mobil yalnız rota + kapı + "şu an açık" + telefon/WhatsApp
   + kaydettiklerim yapar, ölçek motorlarını kullanır. Orta büyüklükte iş.
3. **Tam eşitle** — mobili webin bütün akışlarına taşı. En pahalı yol; iki kod tabanını
   sonsuza kadar birlikte yürütmek gerekir.

### M2 · Ürün sayfası (W4) — hâlâ yok
Her şey dükkân merkezli. "Şeffaf silikon kılıf" için ürün sayfası, o ürünü satan
dükkânlar ve fiyat aralığı yok. Toptancının aradığı görünüm bu.

### M3 · Harita ↔ liste bütünleşmesi (W5) — ✅ uygulandı
Çift yönlü seçim kuruldu: pin'e dokunmak listeyi daraltıyor, listeden bir satıra
dokunmak haritadaki pin'i turuncu halkayla işaretleyip ortalıyor ve popup'ını açıyor
(`postMessage` iki yönde: `han-map` → `han-web`). **"Bu alanda ara"** düğmesi
görünen çerçevedeki yerleri listeye döküyor — haritayı gezmek listeyi kendiliğinden
değiştirmiyor, kullanıcı isteyince oluyor (istemsiz yeniden filtreleme can sıkıcıdır).

Yolda çıkan hata: odak çözümü yalnız `SC.PLACES` ve `D.HANS` içinde ad arıyordu;
harita **bölge** pin'i de gönderdiği için bölge seçimi sessizce yutuluyordu — `D.AREAS`
eklendi ve bölge seçimi artık aramayı o semte daraltıyor.

**Rota duraklarını elle sıralama** da uygulandı: sürükle-bırak + yukarı/aşağı düğmeleri
(düğmeler dokunmatikte ve klavyede de çalışır — sürükleme tek yol olsaydı erişilemezdi).
Otomatik sıra mesafe ve yük mantığına göre iyi bir tahmindir ama alıcı kendi randevusunu,
kapanış saatini ve hangi hanı önce görmek istediğini bizden iyi bilir; elle taşınan durak
sabitlenir (`trip.order`) ve "Otomatik sıraya dön" görünür kalır. Listeye sonradan eklenen
durak sona atılmaz, kendi otomatik yerine yakın düşer.

**M3 tamamen kapandı.**

### M4 · Ticaretin kapanışı (W7) — karar verildi, yazılmadı
Karma model onaylandı (küçük perakendede ödeme HAN'da, toptanda teklifte biter).
Perakende ödeme kolu hiç yazılmadı. K1 v1 kapsamını "işleme girmez" olarak
çizdiği için bu ikisi çelişiyor — **hangisi geçerli, netleşmeli.**

### M5 · Gün planı takvimi (W8)
Etkinlik + randevu + duraklar tek takvimde birleşmiyor.

---

## 4. Depo anahtarları (tek liste)

| Anahtar | Yazan | Okuyan |
|---|---|---|
| `han-web-v1` | Web (alıcı) | Web, Panel |
| `han-claims-v1` | Web (esnaf) | Web, Editör |
| `han-approvals-v1` | Editör | Editör, **Web**, **Panel** |
| `han-overrides-v1` | Web (esnaf) | Web |
| `han-reports-v1` | **Web (alıcı)** | **Web, Editör, Panel** |
| `han-offers-v1` | **Web (esnaf)** | **Web (alıcı)** |
| `han-seen-v1` | **Web (esnaf)** | **Web (alıcı huni)** |
| `han-declined-v1` | **Web (esnaf)** | **Web (alıcı huni)** |
| `han-reviews-v1` | **Web (alıcı)** | **Web** |
| `han-esnaf-session` | Web (esnaf) | Web |

**Kalın** olanlar bu turda eklendi ya da köprüsü kuruldu.
