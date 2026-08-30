# Handoff: HAN — İstanbul çarşıları için firma rehberi + ticaret platformu

> **Bu paket ne değildir:** üretim kodu. `design/` altındaki HTML dosyaları **tasarım
> referansı** — hedeflenen görünümü ve davranışı gösteren, tarayıcıda gerçekten çalışan
> prototiplerdir. Görev bu tasarımları hedef kod tabanının kendi ortamında (React/Vue/
> Next/native — hangisi kuruluysa) o ortamın yerleşik desenleriyle **yeniden kurmaktır**.
> Henüz ortam yoksa, aşağıdaki "Önerilen mimari" bölümü bir başlangıç noktası verir.
>
> **Sadakat: yüksek (hi-fi).** Renkler, tipografi, boşluk, durum geçişleri ve mikro
> kopya nihaidir. Ekranlar piksel düzeyinde yeniden üretilmelidir. Prototipteki tek
> geçici katman **veri** ve **kalıcılık**tır (aşağıya bakın).

---

## 1. Genel bakış

HAN, İstanbul Tarihi Yarımada'daki (Fatih) kapalı çarşıların, hanların ve
cadde işletmelerinin **rehberi + gezi aracı + ticaret hattıdır**. Üç farklı
kullanıcı için üç ayrı arayüz vardır ve üçü **aynı veri omurgasını** paylaşır:

| Kullanıcı | Arayüz | Ne yapar |
|---|---|---|
| **Alıcı** (turist, perakendeci, ihracatçı) | `HAN Web.dc.html` | Arar, gezi planlar, talep bırakır, teklif kabul eder, yorum yazar |
| **Esnaf** | `HAN Web.dc.html` → *Esnaf* bölümü | Kaydını sahiplenir, içeriğini doldurur, gelen talebe teklif verir |
| **HAN yönetimi** | `HAN Panel.dc.html` | **26 ekran** — kapsama, pazar sağlığı, saha operasyonu, gelir, içerik, sistem |
| **HAN editörü** | `HAN Editor.dc.html` | Onay hattı — Panel'in kenar çubuğuna gömülü çalışır, tek başına da açılır |
| **Ekip girişi** | `HAN Giris.dc.html` | Giriş · şifremi unuttum · yeni şifre (prototip kimlik doğrulama) |

Ürünün özü: **çarşıda 30–50 bin işletme var, hiçbiri aranabilir değil.** Uygulama
adres omurgasını (yer → kat → kapı) kurar, üzerine kademeli bir güven modeli
(beyan → onaylı → aktif) oturtur ve alıcı ile esnaf arasına tek bir talep–teklif
hattı çeker.

**Kapsam ölçeği (prototipte gerçek sayılar):** 38 yer · 14.716 fiziksel birim ·
1.385 kayıt · 11'i elle yazılmış "zengin" referans kayıt.

---

## 2. Bu prototipin teknik gerçeği (okumadan başlama)

Prototip **Design Component** formatında yazılmıştır: her `.dc.html` dosyası bir
şablon (inline-styled HTML, `{{ hole }}` yer tutucuları, `<sc-for>`/`<sc-if>`) +
bir mantık sınıfı (`class Component extends DCLogic`, React sınıf bileşeni gibi
davranır, `renderVals()` şablonun girdilerini döndürür) içerir. `support.js` bu
runtime'ı sağlar.

**Yeniden kurarken bu formatı taşımayın.** `renderVals()`'ın döndürdüğü düz nesne
= bileşenin view-model'i. Hedef ortamda bu doğal olarak bir hook / computed /
selector olur. Şablondaki `{{ x }}` deliği doğrudan o alanın karşılığıdır.

**Kalıcılık geçicidir.** Prototipte tüm yazma işlemleri `localStorage`'a gider ve
dokümanlar arası iletişim `storage` olayıyla kurulur. Üretimde bunların tamamı
API + veritabanı olacak. Anahtar listesi §6'da; her biri bir tabloya/endpoint'e
birebir çevrilir.

**Veri katmanı üretilmiş (procedural) veridir.** `han-scale.js` 1.385 kaydı tohumlu
bir rastgele üreteçle (`rng(seed)`) inşa eder — aynı açılışta aynı sonuç. Bu
**demo verisidir**; üretimde saha ekibinin ve esnafın girdiği gerçek kayıtlarla
değişir. Ama **şema aynen korunmalıdır** (§4).

---

## 3. Ekranlar

### 3.1 HAN Web — alıcı arayüzü (`HAN Web.dc.html`, ~9.100 satır)

Tek sayfa, hash tabanlı yönlendirme. Her görünüm bir adrestir (paylaşılabilir link).

**Bölümler (`SECTIONS`):** `kesfet · ara · kategori · plan · isler · esnaf · arac · harita · etkinlik · dukkan · yer · urun`

**Rota şeması:**
```
#/kesfet
#/ara?q=kılıf&s=fiyat&semt=tahtakale&p=han:yildiz&kt=2
#/kategori?grup=aksesuar&kat=kilif
#/plan                         · niyet → rota → yürüyüş; gün takvimi + randevu
#/isler/talep?r=<talepId>     · #/isler/karsi · #/isler/kayitli · #/isler/bildirim
#/esnaf
#/arac/<doviz|rehber|taxfree|lojistik|yakin|kultur|acil|sorun>
#/harita?k=<sehir|carsida>
#/etkinlik?etur=<tür>
#/dukkan/<kayıtId>[/<sekme>]   · sekmeler: urun · guven · konum · reviews
#/urun/<kategori>[/<ürün>]     · kategori listesi / tek ürün (M2)
#/yer/<yerId>
```
Ek sorgu parametreleri: `l=<dil>` (paylaşımda), `oz=<özellik,özellik>` (bayrak filtreleri).

**Dört dil:** `tr · en · ru · ar`. Arapça'da `dir="rtl"`. Tüm içerik nesneleri
`{tr, en, ru, ar}` alanlarıyla taşınır — çeviri bir katman değil, veri şemasının
parçası.

**İki ticaret modu:** `perakende` / `toptan` / `ikisi`. Mod fiyat gösterimini,
MOQ'yu, sıralamayı ve talep formunu değiştirir — kozmetik bir filtre değildir.

#### Anahtar akış: Talep → Teklif → Kabul → Yorum

Bu ürünün kalbi. Uçtan uca:

1. **Alıcı talep bırakır** (`#/isler`) — ürün, adet, birim, termin, numune isteği,
   serbest açıklama. Talebe **alıcı kademesi donarak** yazılır (`buyer: {verified,
   telOk, deals, rate}`) — esnaf, talebin geldiği andaki kimliği görür, sonradan
   değişen profil geçmiş talepleri değiştirmez.
2. **Dağıtım motoru** (`han-search.js` → `distribute(req, ctx)`) talebi uygun
   kayıtlara dağıtır: kategori eşleşmesi + MOQ uyumu + mod + durum. Döner:
   `{matched, sent, capped}`.
3. **Tahmini aralık** (`offersFor`) — motorun çıkarımı. `real: false`, **kabul
   edilemez**, "tahmini aralık" olarak etiketlenir. Fiyat kaydın `band`'ından türer.
4. **Gerçek teklif** — esnaf panelinden verilir (birim fiyat · adet · termin · not).
   `real: true`, **7 gün geçerli bir taahhüt**, kabul edilebilir. `han-offers.js`'te
   saklanır.
5. **Birleştirme** (`mergedOffers(req, real, ctx)`) — gerçekler üstte, tahminler
   altta. Gerçek teklif veren dükkânın tahmini listeden düşer: aynı dükkân iki
   fiyatla görünmez.
6. **"Cevaplayamam"** — esnaf dört gerekçeden birini seçer (bende yok · adet uymuyor ·
   termine yetişmez · kapasitem dolu). Sessizlikten iyidir; alıcı sebebi görür.
7. **Huni** — talebin altında: *gitti* (dağıtım) · *açtı* (esnaf paneli talebi
   gösterdiğinde işaretlenir) · *teklif verdi* (yalnız gerçek) · *cevaplayamadı*.
   **Hiçbiri tahmin değildir**; veri yoksa 0 yazar.
8. **Numune aşaması** — talepte numune istendiyse kabul öncesi dört durumlu bir
   aşama (istedim · yolda · geldi uygun · geldi olmadı).
9. **Kabul** — kabul edilen teklif taahhüdün kendisini saklar:
   `{recordId, name, unit, raw, qty, gun, at}`.
10. **Yorum hakkı** — yalnız bu dükkânın teklifini **kabul etmiş** alıcı yorum
    yazabilir (yıldız + metin, min. 10 karakter). Sahte yorumun tek gerçek panzehiri.
    Ayrıca üç durumlu sonuç işareti (aldım/bozuldu/dönüş olmadı) esnafın güven
    metriğine işler.

#### Mağaza sayfası (`#/dukkan/<id>`)

İki veri kaynağı, **tek şablon**: 11 zengin kayıt (`han-data.js` → `STORES`,
elle yazılmış ürün listesi, fotoğraf, saat) ve 1.374 ölçek kaydı (`han-scale.js` →
`RECORDS`, üretilmiş). Aynı bloklar ikisinde de dolar:

- **Şu an** — açık/kapalı, kapanışa kalan dakika. Kaynak: esnafın beyan ettiği saat
  > yerin tür varsayılanı.
- **Fiyat güveni** — dükkânın en düşük fiyatı vs. aynı kategorinin ortalaması
  ("kategori ortalamasının altında/üstünde/ortasında") + pazarlık payı beyanı.
  Kandırılma korkusu bu ürünün birinci engeli; bu kart onu adresler.
- **Fiziksel erişim** — asansör / el arabası / otopark + kaç kata merdiven.
  "4. kat asansörsüz han" gerçek bir engeldir.
- **Güven dosyası** — kayıt durumu, doğrulama kaynağı, yanıt hızı, alan kaynağı
  etiketleri (`tahmini` / `esnaf` / `yetkili` — üretilmiş veri asla doğrulanmış
  gibi gösterilmez).
- **Hazır soru** — dört dilde seçilir, esnafa **Türkçe** WhatsApp mesajı gider.
  Dil bariyerini kaldıran asıl unsur. Çıkışlar İşlerim'e "sordum" kaydı bırakır.
- **Fotoğraf gerçekliği + bildir** — fotoğrafın kaynağı dürüstçe söylenir; "burada
  değil / kapalı" bildirimi kuyruğa düşer.

#### Esnaf bölümü (`#/esnaf`)

Sahiplenme → onay bekleme → panel. Panelde: eksik alan karnesi (görünürlük puanı),
çeşit grubu ekleme (serbest metin değil, sözlükten seçim), fiyat bandı, çalışma
saati, fotoğraf, **gelen talepler + teklif formu**, "bu ay kaçırdığın iş"
(kendi kategorisine düşen talep, kaçı yanıtsız, yaklaşık tutar — karne dili değil
para dili).

### 3.2 HAN Panel — yönetim (`HAN Panel.dc.html`)

`AppShell` + **26 ekran**, altı grupta. Yetki tek yerde tanımlı (`han-scale.js` → `ROLES`,
`can(role,key)`, `isReadOnly`); gezinme, düğmeler ve ekran içi eylemler aynı kaynağı okur.

| Grup | Ekranlar |
|---|---|
| **Operasyon** | Özet · Mağaza Kayıtları · Alıcı Talepleri |
| **Onay & moderasyon** | Sahiplenme · Beyan Kuyruğu · Askıdakiler · Toplu Onay |
| **Pazar sağlığı** | Teklif Denetimi · Şikayet Triyajı · Yorum Denetimi · Alıcı Doğrulama |
| **Saha** | Yerler · Saha Görevleri · Veri Kalitesi · Toplu İçe Aktarma · Kapsama · Yetkililer |
| **Gelir** | Sponsorluk |
| **İçerik & arama** | Arama Sözlüğü · Etkinlik & Kampanya · Mağaza Görselleri · Harita & Kat Planı |
| **Sistem** | Sistem Ayarları · Kullanıcılar · Karar Defteri · Temalar |

**Altı rol.** Yönetici 26 ekran · Editör 19 · Saha yetkilisi 13 · Satış · Salt okuma ·
Han yönetimi. `scope` bir kısıt değil görev tanımı: saha yetkilisi kendi bölgesini,
han yönetimi kendi hanını görür (`scopeFilter`). Rol değişince yetkisiz ekranda kalınmaz.

Yönetim tarafının taşıdığı kurallar — bunlar UI süsü değil, ürünün işleyişi:

- **Sistem Ayarları** — beş yayın kuralı (onaysız kayıt görünür mü, talep alabilir mi,
  kayıtsız birim aramada çıkar mı, sponsorluk açık mı, tazelik eşiği). Kod hiçbir yerde
  bunları sabitlemez. Her ayarın altında **kaç kaydı etkilediği** yazılı.
- **Sponsorluk** — organik sıralama satılmaz; ücretli yerleşim etiketli ayrı alanda çıkar
  ve **yanıt oranı %85'in altına düşen dükkânın yerleşimi otomatik durur, elle açılamaz**
  (düğme render edilmez).
- **Teklif Denetimi** — pazarın sağlık göstergesi *yanıt oranı*. **SLA 48 saat**: teklif
  almadan bu süreyi geçen talep işaretlenir ve elle bir dükkâna yönlendirilebilir;
  esnaf panelinde "Yönetim bu talebi size iletti" olarak çıkar.
- **Şikayet Triyajı** — otomatik askı bir **alarm**, karar değil: Açık → Sahaya atandı →
  Doğrulandı / Reddedildi. Reddedilen bildirim kaydı geri açar.
- **Yorum Denetimi** — yorum hakkı zaten kapıda kısıtlı; buradaki iş kuralsızlığı ayıklamak.
  Gizlenen yorum gerekçesiyle saklanır ve **alıcı tarafında da görünmez olur**.
- **Alıcı Doğrulama** — talebin üstündeki kademeyi kim verir sorusunun cevabı. Alıcılar ayrı
  tablodan değil, talep bırakanlardan türetilir.
- **Saha Görevleri** — kapsama kat kat turla kapanır. Hedef uydurulmaz: o yerdeki kayıtsız
  birim sayısı önerilir.
- **Veri Kalitesi** — altı kural, her biri bir iş listesi (fiyatsız · telefonsuz · fotoğrafsız ·
  tazeliği düşmüş · grupsuz · **mükerrer**). Liste tek tıkla saha görevine dönüşür.
- **Toplu İçe Aktarma** — yapıştırılan kiracı listesi **kaydedilmeden önce önizlenir**;
  reddedilen satır sessizce düşmez, sebebi yazılır. Aynı kapıda kayıt varsa üzerine yazılmaz.
- **Arama Sözlüğü** — sonuçsuz arama sinyaldi, burası kolu. Ekleme öncesi canlı önizleme
  kaç sonuç geleceğini söyler; çakışma uyarı verir.
- **Mağaza Görselleri** — kapak tek olabilir, kapak silinirse yayındaki ilk görsel kapak olur,
  onaysız görsel alıcıda görünmez.
- **Harita & Kat Planı** — konum, giriş kapıları, koridor adları. Fatih sınırları dışına düşen
  koordinat kabul edilmez. Kaydedilen pin alıcı tarafında da geçerli.
- **Karar Defteri** — onay, sahiplenme, bildirim ve saha kayıtları tek zaman çizgisinde.
  Bir kaydın **neden** askıya alındığı sorgulanabilir. Silinmez.

### 3.3 HAN Editör (`HAN Editor.dc.html`)

Onay hattı: sahiplenme talepleri · beyan kuyruğu · askıdakiler (sebebiyle) · toplu onay ·
yetkililer. Panel bu dokümanı `?embed=1&tab=…` ile gömer; gömülüyken kendi sekme şeridini
göstermez (iki katmanlı gezinme olmasın). Kararlar `han-approvals-v1`'e yazılır ve
**alıcı tarafını gerçekten değiştirir**.

### 3.3b HAN Giriş (`HAN Giris.dc.html`)

İki panelli giriş. Üç durum: giriş · şifremi unuttum · yeni şifre. Çıkmaz sokaklar kapalı —
şifresi kurulmamış hesap doğrudan sıfırlamaya geçer, kimse kayıtlı değilse "ilk yöneticiyi
kur" çıkar, kayıtlı olmayan telefon **aynı cevabı** alır (kimin kayıtlı olduğu sızmaz).
Kod tek kullanımlık ve 15 dakika geçerli; 5 hatalı denemede kilit.

> ⚠ **Kimlik doğrulama prototiptir** ve ekranda da böyle yazıyor: şifre tarayıcıda tutulur,
> kod ekranda görünür. Üretimde üçü de sunucu tarafına taşınır — bu paketten
> **kopyalanmamalıdır**.

### 3.4 HAN.dc.html — mobil (⚠ emekliye ayrıldı)

8.600 satır, **ölçek katmanına hiç geçmemiş**: yalnız `han-data.js`'in 11 kaydıyla
çalışıyor, `han-scale.js` / `han-search.js` / `han-offers.js` yüklemiyor. Yani
ölçek verisi, sıralamalı arama, talep motoru, onay hattı ve gerçek teklif döngüsünün
hiçbiri mobilde yok. Bu haliyle **ayrı bir üründür**.

**Karar verildi: emekliye ayrıldı — yeniden kurmayın.** HAN Web zaten `compact`
kırılmasıyla telefonda çalışıyor ve "çarşı modu" (`#/harita?k=carsida`) orada uygulandı.
Dosya tarihsel referans olarak pakette ve açılışta HAN Web'e yönlendiren bir arşiv bandı
gösteriyor. Gerekçe `design/URUN-KARARLARI.md`'de.

---

## 4. Veri modeli

### 4.1 `RECORDS` — kayıt (ölçek omurgası, `han-scale.js`)

```js
{
  id: "r517",                    // panelden açılanlar: "p<timestamp>"
  place: "yildiz",               // PLACES.id
  semt: "tahtakale",             // SEMTLER.id
  floor: 2, door: "118", corridor: null,
  name: "Bereket GSM İhracat",   // null olabilir → kategori adı gösterilir
  cat: "kilif", cats: ["kilif"], sector: "toptan",

  status: "beyan",               // beyan | onayli | aktif | askida | birim
  approvedVia: "han",            // han | saha | esnaf   (APPROVAL)
  bulk: true, officer: "of-ayse",

  langs: ["tr","en"], moq: 12, moqFlex: true,
  trade: {
    sells: ["toptan","perakende"],       // yetenek KÜMESİ — tek değer değil
    quoteBased: false,
    perakende: { band: [88,320], moq: 1 },
    toptan:    { band: [42,180], moq: 12, carton: { inner: 12, unit: "adet" } },
    scope: null
  },
  band: [42,180],                        // aktif modun bandı
  groups: [{ name: "Silikon kılıf", lines: 21, lo: 42, hi: 96 }],
  skuCount: 63,

  // alan kaynağı — üretilmiş veri asla doğrulanmış gibi gösterilmez
  src: { band:"tahmini", moq:"tahmini", groups:"esnaf", resp:"yetkili",
         rating:"yetkili", address:"yetkili" },

  shipsHotel: true, giftWrap: false, isProducer: false, shipsAbroad: true,
  taxFree: false, invoice: true, payments: ["cash","card"],
  respMins: 45, respRate: 0.78, rating: 4.3, reviews: 12,
  updatedDays: 6, photos: 3, tel: "905320001122", distance: 300,
  hours: { open: 9, close: 18.5 },       // esnaf beyanı — varsa yerin varsayılanını EZER
  curated: "emre"                        // 11 zengin kayıttan biriyse STORES.id
}
```

### 4.2 `PLACES` — yer

```js
{ id, name, kind, semt, floors: [0,1,2], units: 3600,
  mix: ["taki","hali"], lat, lng, sector }
```
`kind`: `han · carsi · pasaj · cadde · is-merkezi` — **çalışma saatini belirler**
(`HOURS_BY_KIND`). Anahtarlar `PLACE_KINDS` ile birebir aynı olmalıdır; uyuşmazlık
sessizce han saatine düşer (bu hata bir kez yapıldı ve 642 kaydı etkiledi).

| kind | açılış | kapanış | kapalı günler | namaz arası |
|---|---|---|---|---|
| carsi | 09:00 | 19:00 | Paz | — |
| han | 08:30 | 18:30 | Paz | ✔ Cuma 12:30–13:30 |
| pasaj | 09:30 | 20:00 | Paz | — |
| cadde | 08:00 | 19:00 | — | — |
| is-merkezi | 09:00 | 18:00 | Cmt · Paz | — |

### 4.3 `STORES` — zengin kayıt (`han-data.js`, 11 adet)

Kayıt şemasının üstüne: `products: [{tr,en,ru,ar, retail, wholesale}]`,
`hours2.weekly` (haftalık saat tablosu), `photos`, `exportInfo`, `certs`,
`trade.tiers` (kademeli fiyat), `sample`, `location.street`.
Bu 11 kayıt `curated` alanıyla ölçek omurgasına en üst kademe olarak girer;
`band`, `groups` ve `skuCount` değerleri **kendi ürün listesinden türetilir** —
uydurulmaz.

### 4.4 Talep · teklif · yorum

```js
Talep   { id, urun, adet, birim, zaman, sure, numune, numuneDurum, aciklama,
          deadline, durum, tel, buyer: {verified, telOk, firm, deals, rate} }
Teklif  { recordId, unit, qty, raw, gun, note, at, validUntil, real, estimate }
Kabul   { recordId, name, unit, raw, qty, gun, at }
Yorum   { stars: 1..5, text, by, at }
Red     { reason: "stok"|"adet"|"termin"|"dolu", at }
```

---

## 5. Veri katmanı API'si

Üretimde bu fonksiyonlar servis katmanına taşınır. İmzalar korunmaya değer —
üç arayüz de bunları çağırır ve **tek merge noktası** olmaları kasıtlıdır.

### `han-scale.js` — omurga
```
PLACES · RECORDS · UNIT_INDEX · SEMTLER · SECTORS · STATUS · PLACE_KINDS ·
CATS_EXTRA · APPROVAL · OFFICERS · SETTINGS · SPONSORS · SCALE_TOTALS ·
REPORT_THRESHOLD · SRC_LABELS · BULK_APPROVED · DRAFT_KEY

addRecord(rec)              → omurgaya kayıt ekler + UNIT_INDEX güncellenir
loadDrafts(onAdd)           → sahada açılan kayıtları omurgaya merge eder
applyApprovals(log)         → editör kararlarını kayıtlara uygular  ⭐ tek merge noktası
applyReports(countsByRecord)→ 3 bildirim = otomatik askı
openState(place, now, rec)  → {open, close, leftMins} · rec.hours varsa üstündür
accessOf(place)             → {lift, handcart, parking}
tradeFor(rec, mode) · sellsIn(rec, mode)
placeStats(id) · semtStats(id) · recordsOfPlace(id) · sponsorsFor(kind, key)
GROUP_WORDS_FOR(cat, lang) · groupLabel(word, lang)
ROLES · can(role,key) · isReadOnly(role)    ⭐ yetki tek kaynağı
loadSettings/saveSettings/settingImpact(key)   yayın kuralları + etkilenen kayıt sayısı
loadSponsors/setSponsor/addSponsor/dropSponsor · SPONSOR_PAUSE_RATE = 85
loadPlaces/savePlace/addPlace/setBulkApproved
addRecord(rec) · loadDrafts(onAdd)          ⭐ omurgaya kayıt eklemenin tek yolu
auditLog() · AUDIT_KINDS                    karar defteri (dört kaynak, tek çizgi)
```

### `han-search.js` — arama ve dağıtım
```
norm(s) · SYNONYMS · parseQuery(q)
search(q, filters, ctx)   → {items, total, ...}
  filters: semt · place · floor · tier · sector · moqMax · priceMax · lang ·
           payment · shipsAbroad · taxFree · producer · openOnly · hideUnclaimed
topActive(n, ctx) · unitLookup(q) · indexInfo()
scoreOf(rec, match, ctx) · reasonsOf(rec, ctx)   // sıralama gerekçesi gösterilir
canPrice(rec) · placeOf(id) · statusOf(key) · sectorOf(key)
indexRecord(rec)          → yeni kaydı arama indeksine işler ⚠ push yetmez
distribute(req, ctx)      → {matched, sent, capped}
offersFor(req, ctx)       → tahmini aralıklar (real: false)
mergedOffers(req, real, ctx) → gerçekler üstte, tahminler altta
productsIn(cat, ctx) · productDetail(cat, slug, ctx)   M2 ürün sayfası
addSynonym/dropSynonym/synonymOwner/loadLexicon        arama sözlüğü
```
> ⚠️ `INDEX` ve `RECBYID` modül yüklenirken bir kez kurulur. `RECORDS.push()`
> tek başına kaydı aranabilir yapmaz — `indexRecord` zorunludur. Üretimde bu
> "indeksi tazele" adımının karşılığı ne olacaksa (DB index, ES reindex) aynı
> disiplinle kurulmalı.

### `han-offers.js` — gerçek teklifler, huni, yorumlar
```
OFFER_VALID_DAYS = 7 · DECLINE_REASONS
offersOf(reqId) · putOffer(reqId, offer) · dropOffer(reqId, recordId) · allOffers()
markSeen(reqIds, recordId) · seenCount(reqId) · allSeen()
putDecline(reqId, recordId, reason) · declineOf(reqId, recordId) · allDeclined()
reviewsOf(recordId) · putReview(recordId, review) · allReviews()
```

### `han-admin.js` — yönetim kararları ve operasyon
```
REPORT_STATES · setReportState/reportState            şikayet triyajı
REVIEW_REASONS · hideReview/restoreReview/reviewState yorum denetimi (anahtar: yorumun kendi id'si)
BUYER_STATES · setBuyerState/buyerState               alıcı doğrulama
addNudge/dropNudge/nudgesOf                           elle teklif yönlendirme
SLA_HOURS = 48 · marketHealth(...)                    pazar sağlığı (yanıt oranı, gecikmiş)
TASK_STATES · TASK_KINDS · addTask/setTask/allTasks   saha görevleri
QUALITY_RULES · qualityLists(records, freshDays)      veri kalitesi iş listeleri
parseImport(text)                                     toplu içe aktarma (satır satır + hata sebepleri)
allUsers/addUser/setUser/userByTel                    kullanıcılar
login/requestReset/checkReset/applyReset/session      ⚠ prototip kimlik doğrulama
mergeContent/addContent/hideContent                   etkinlik & kampanya katmanı
MEDIA_STATES · mediaOf/addMedia/setMedia/moveMedia    mağaza görselleri
geoOf/setGeo/applyGeo(places)                         harita ve kat planı
```

### `han-logic.js` — zengin kayıt mantığı
```
norm · wordMatch · txt · loc · money · convert · toMin · hhmm
hoursToday(D, store, dow) · isOpenNow(D, store) · modeAllows(store, mode)
matchStore(D, store, q, lang) · filterHits · sortHits · minPrice(store, mode)
catSubs · monoText/monoG (logosuz kayıt için monogram)
planStops(D, buyList, lang) · planSchedule(D, stops) · routeSteps(D, shop, lang)
unitPriceFor(store, row, mode) · listTotal · streetPath · photoUrlOf
```

---

## 6. Kalıcılık → API haritası

Prototipteki her `localStorage` anahtarı bir kaynağa çevrilir:

| Anahtar | Yazan | Okuyan | Üretimdeki karşılığı |
|---|---|---|---|
| `han-web-v1` | Web (alıcı) | Web, Panel | Kullanıcı oturumu: talepler, plan, randevular, kaydedilenler, dil, mod, arama geçmişi |
| `han-offers-v1` | Web (esnaf) | Web (alıcı) | `POST/GET /requests/:id/offers` |
| `han-seen-v1` | Web (esnaf) | Web (alıcı) | Huni telemetrisi — "açtı" olayı |
| `han-declined-v1` | Web (esnaf) | Web (alıcı) | `POST /requests/:id/decline` |
| `han-reviews-v1` | Web (alıcı) | Web, Panel | `POST/GET /records/:id/reviews` (yetki: kabul edilmiş teklif) |
| `han-claims-v1` | Web (esnaf) | Web, Editör | Sahiplenme talepleri |
| `han-approvals-v1` | Editör | Editör, Web, Panel | Onay/askı kararları (**append-only audit log**) |
| `han-reports-v1` | Web (alıcı) | Web, Editör, Panel | Kullanıcı bildirimleri; 3 = otomatik askı |
| `han-overrides-v1` | Web (esnaf) | Web | Esnafın kendi kaydına düzeltmeleri |
| `han-panel-drafts` | Panel | Panel, Web, Editör | Sahada açılan kayıtlar |
| `han-esnaf-session` | Web (esnaf) | Web | Esnaf oturumu (telefon doğrulaması) |
| `han-settings-v1` | Panel | **Panel · Web · Editör** | Yayın kuralları (feature flags) |
| `han-sponsors-v1` | Panel | Panel, Web | Ücretli yerleşimler |
| `han-places-v1` | Panel | Panel, Web, Editör | Yer düzeltmeleri (kat, birim, anlaşma) |
| `han-moderation-v1` | Panel | Panel, Web | Şikayet · yorum · alıcı kararları |
| `han-nudges-v1` | Panel | Panel, Web (esnaf) | Elle teklif yönlendirmeleri |
| `han-tasks-v1` | Panel | Panel | Saha görevleri |
| `han-users-v1` | Panel | Panel, Giriş | Ekip ve roller |
| `han-auth-v1` | Giriş | Giriş, Panel | ⚠ Oturum + PIN — **üretimde sunucuya taşınır** |
| `han-lexicon-v1` | Panel | Panel, Web | Arama eşanlamları |
| `han-content-v1` | Panel | Panel, Web | Etkinlik/kampanya ekleme·gizleme katmanı |
| `han-media-v1` | Panel | Panel, Web | Mağaza görselleri (sıra, kapak, onay) |
| `han-geo-v1` | Panel | Panel, Web, Editör | Yer konumu, giriş kapıları, kat planı |
| `han-panel-role` · `han-panel-theme` | Panel | Panel | Kullanıcı tercihleri |

**Kritik:** üç doküman da aynı anahtarları okur ve `storage` olayıyla canlı
senkronlanır. Üretimde bu "aynı gerçeği üç arayüzde eşzamanlı göster" gereksinimi
kaybolmaz — websocket / polling / revalidation ile karşılanmalı. Prototipte
her tarafın açılışta `applyApprovals` + `loadDrafts` çağırmasının sebebi budur:
her doküman kendi modül örneğini yükler, tek yerde yazmak yetmez.

---

## 7. Tasarım sistemi ve tokenlar

Arayüz **web/mobil/UI** (`WebMobilUI_422163`) tasarım sistemi üzerine kuruludur —
Metronic v9.4.13 iskeleti, lacivert+turuncu marka teması. Paket `design/_ds/`
altında bundle ve token CSS'leriyle birlikte geliyor.

**Bileşenler `window.WebMobilUI_422163` altından mount edilir:** `AppShell`,
`Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`,
`Switch`, `Slider`, `FormField`, `Card`, `Badge`, `StatusBadge`, `Avatar`, `Tabs`,
`Accordion`, `Breadcrumb`, `Stepper`, `Pagination`, `Progress`, `Tag`, `Separator`,
`DataGrid`, `Modal`, `Drawer`, `Tooltip`, `Popover`, `DropdownMenu`,
`ToastProvider`, `Alert`, `Skeleton`, `Spinner`, `EmptyState`, `Icon`.

Hedef kod tabanında bu sistem yoksa: **tokenları alın, bileşenleri kendi kitaplığınıza
eşleyin.** Sıfırdan yeniden çizmeyin.

### Renk

| Rol | Değer |
|---|---|
| primary (lacivert) | `#1F3864` · active `#162A4C` · soft `#EAEEF4` · accent `#14233F` |
| accent (turuncu) | `#E08A2B` · active `#C6751C` · soft `#FBF1E4` |
| success | `#0BC33F` · danger `#ED143B` · warning `#FEC524` · info `#4921EA` |
| metin | başlık `#1B1C22` · gövde `#4B5675` · soluk `#78829D` · placeholder `#99A1B7` |
| nötr | `grey-50 #F9F9F9` → `grey-950 #151516` |
| yüzey | canvas `#FCFCFC` · kart `#FFFFFF` |
| kenarlık | subtle `#F1F1F4` · strong `#DBDFE9` |

**Buton hiyerarşisi (katı kural):** turuncu dolu buton **ekranda en fazla bir tane**
ve yalnız birincil dönüşüm eylemi için (*Teklifi gönder*, *Kabul et*, *Giriş yap*).
Rutin kaydetmeler lacivert dolu. İkincil eylemler outline/light, üçüncül ghost.

Kod tokenları `var(--*)` ile okur: `--color-primary`, `--color-accent`,
`--surface-card`, `--surface-muted`, `--border-default`, `--border-strong`,
`--text-heading`, `--text-body`, `--text-muted`, `--color-success-soft` vb.
**Sabit hex yazmayın** — çok temalı yapı (`data-theme` × `.dark`) bunu gerektirir.

### Tipografi

Inter (Google Fonts). Varsayılan UI ağırlığı **500**, başlıklar 600, hero sayılar 700.
Gövde **13px**, etiketler 14px, caption 11–12px; başlıklar 16 → 20 → 26 → 38 → 50.
500+ ağırlıklarda `letter-spacing: -0.01em`. Kod/numerik: JetBrains Mono.

### Boşluk · yarıçap · gölge

4px ızgara: 4·8·12·16·20·24·32·40·48·64. Kart içi padding 20px.
Yarıçap: buton/input/badge **6px**, kart **12px**, panel 16–20px, pill/avatar tam.
Gölge kasıtlı olarak yumuşak — imza kart gölgesi `0 3px 4px rgba(0,0,0,.03)`;
derinlik esasen **1px kenarlıktan** gelir. Dropdown `0 7px 18px /.09`,
modal `0 10px 35px /.10`.

### Hareket

150–200ms `cubic-bezier(.4,0,.2,1)`. Hover = arka plan/renk kayması; light butonlar
hover'da dolu renge geçer. Focus = 3px primary ring. Yaylanma yok, dekoratif döngü yok.

### Dil ve kopya

Türkçe birincil dil. Ton: **doğrudan, esnafın diliyle**, karne dili değil para dili.
"Bu ay 12 talep size düştü, 7'sine yanıt vermediniz — yaklaşık ₺84.000 iş.
Yanıtsız talep başka dükkâna gider." Emoji yok. Butonlar Başlık Düzeni, gövde
normal cümle düzeni. **Kök `<html lang="tr">` şart** — Türkçe büyük harf kuralı
(İ/ı) buna bağlı; olmadan "ÇEŞIT" yazar.

---

## 8. Yeniden kurarken dikkat: 16 tuzak

Bunların hepsi bu projede bir kez yapıldı ve düzeltildi (`design/DENETIM-PLANI.md`
tam gerekçelerle tutuyor). Sırf onları tekrarlamamak için:

1. **Motorun ürettiği sayıyı taahhüt gibi göstermeyin.** Tahmin (`estimate`) kabul
   edilemez; taahhüt (`real`) esnaftan gelir. İki kaynak asla karışmaz.
2. **Huni adımlarını hesaplamayın, ölçün.** "açtı = gitti × 0.42" bir yalandır.
3. **Yorum hakkını kontrol edin.** Yalnız kabul etmiş alıcı. Aksi hâlde sahte yorum.
4. **Editörün kararı alıcı tarafına geçmeli.** Ayrı yazıp okumamak = kararın hiç
   olmaması.
5. **Bildirimler kalıcı olmalı.** Yenilemede uçan bildirim eşiği hiç dolmaz.
6. **Talep durumu gerçek tekliflere baksın.** Tahmin her zaman geldiği için talep
   anında "Değerlendirme"ye geçerse durum bilgisi anlamsızlaşır.
7. **Alıcı kademesi talebe donsun.** Esnafın cihazındaki profilden hesaplanan rozet
   yanlış bilgidir.
8. **Esnafa kendi sayısını gösterin.** Sistemdeki toplam talep değil, kendi
   kategorisine düşen.
9. **Kayıt eklemek = omurga + indeks.** `push` tek başına aranabilirlik vermez.
10. **Saat tabloları ile tür sözlüğü aynı anahtarları kullansın.** Sessiz uyuşmazlık
    642 kaydı yanlış saatle çalıştırdı.
11. **Görünen ad ile id'yi karıştırmayın.** `semt: "kapalicarsi"` bir id'dir; ekrana
    `SEMTLER` üzerinden çözülmüş ad basılır.
12. **Boş durumu dürüst yazın.** Sayı yoksa 0 veya "henüz kayıt yok" — demo verisi değil.
13. **`localStorage`'a yazan tek yer olmasın.** Panelde yazıp state'te tutmak, her
    tazelemede kaybolan kayıt demektir.
14. **Moderasyon anahtarı zaman damgası olmasın.** Yorumların anahtarı `recordId + at`
    idi; aynı milisaniyede yazılan iki yorum aynı anahtarı paylaşıp **birini gizlemek
    ikisini gizliyordu**. Her kaydın kalıcı kendi kimliği olmalı.
15. **Çok kelimeli eşanlamları unutmayın.** Sorgu ayrıştırıcı yalnız tek kelimeye bakıyordu;
    `"telefon kabi"`, `"phone case"` gibi **sözlüğün yarısı hiç çalışmıyordu.** Tüm sorgu
    ve komşu kelime ikilileri de denenmeli.
16. **Kök `<html lang="tr">` şart, her dokümanda.** Türkçe büyük harf kuralı buna bağlı —
    olmadan `text-transform:uppercase` "ÇEŞİT" yerine "ÇEŞIT", "ARŞİV" yerine "ARŞIV" yazar.
    Uygulama kökünün dışına konan bir banner bu mirası alamaz.

---

## 9. Önerilen mimari (ortam yoksa)

- **Ön yüz:** Next.js (App Router) + TypeScript. Rota şeması §3.1'deki hash
  yapısına birebir oturur (`/ara`, `/dukkan/[id]/[tab]`, `/isler/[gorunum]`).
  Dört dil için `next-intl`; Arapça'da `dir="rtl"`.
- **Durum:** sunucu durumu için TanStack Query (talep/teklif/onay akışları
  gerçek zamanlı tazeleme ister), yerel tercihler (dil, mod, plan) için hafif bir
  store.
- **Veri:** PostgreSQL. Tablolar: `places · units · records · record_groups ·
  products · requests · offers · declines · reviews · claims · approvals ·
  reports · officers · sponsors`. `records` tablosunda `status` +
  `approved_via` + `officer_id`; `approvals` **append-only audit log**.
- **Arama:** kayıt sayısı 30–50 bine çıkacağı için Postgres FTS yetmez —
  Meilisearch/Typesense. `SYNONYMS` sözlüğü (dört dil + sokak ağzı) doğrudan
  eşanlam ayarına, `scoreOf` ağırlıkları sıralama kuralına çevrilir.
  `reasonsOf`'un ürettiği "neden bu sırada" açıklaması korunmalı.
- **Gerçek zaman:** teklif geldiğinde/onay verildiğinde alıcı ekranı anında
  değişmeli. WebSocket ya da SSE.
- **Coğrafya:** `PLACES` lat/lng taşıyor, `han-map.html` harita katmanını
  gösteriyor. Kat planı/kapı numarası kritik veri — adres omurgası bu ürünün
  asıl varlığı.

---

## 10. Verilmiş ürün kararları

Dördü de karara bağlandı; gerekçeler `design/URUN-KARARLARI.md` ve
`design/DENETIM-PLANI.md`'de. **Uygulamaya başlamadan bunları okuyun** — hangi işin
kapsam dışı olduğu, hangi işin neden öyle kurulduğu buradan anlaşılır.

- **M1 · Mobil** — `HAN.dc.html` **emekliye ayrıldı.** Ölçek katmanına hiç geçmemişti.
  Yeniden kurmayın; HAN Web telefonda çalışır ve çarşı modunu içerir.
- **M2 · Ürün sayfası** — **uygulandı.** `#/urun/<kategori>` kategori listesi,
  `#/urun/<kategori>/<ürün>` tek ürün: o ürünü satan dükkânlar, fiyat aralığı ve medyan.
- **M4 · Ticaretin kapanışı** — **v1 ödeme işlemez**, karma model v2'ye ertelendi.
  Ödeme almak HAN'ı aracı yapar (iade, anlaşmazlık, mutabakat — hiçbirinin süreci yok);
  asıl darboğaz para akışı değil kapsama. Teklif zaten bağlayıcı bir taahhüt.
  **v2 için dört ön koşul** `URUN-KARARLARI.md` §M4'te — biri eksikse ödeme açılmaz.
- **M5 · Gün planı takvimi** — **uygulandı.** Duraklar + etkinlikler + randevular + kargo
  tek zaman çizgisinde; sabit saatli bir öğe durağın içine düşerse çakışma uyarısı çıkar.

- **M3 · Harita ↔ liste** — **uygulandı.** Çift yönlü seçim (pin↔satır), "bu alanda ara"
  ve rota duraklarını elle sıralama. Haritayı gezmek listeyi kendiliğinden değiştirmez;
  sıralamada sürükle-bırak tek yol değil, düğmeler de var (dokunmatik + klavye).

**Bilinen boşluk kalmadı.** Denetimde çıkan 13 bulgu, yönetim tarafındaki 12 eksik süreç
ve beş ürün kararının hepsi kapalı.

## 11. Paketteki dosyalar

```
design/
  HAN Web.dc.html        alıcı + esnaf arayüzü — ana referans (~9.100 satır)
  HAN Panel.dc.html      yönetim paneli — 26 ekran, 6 rol
  HAN Editor.dc.html     onay hattı (Panel'e gömülü çalışır)
  HAN Giris.dc.html      ekip girişi · şifre sıfırlama (⚠ prototip auth)
  HAN.dc.html            mobil — ⚠ emekliye ayrıldı, arşiv referansı (§3.4)
  HAN StoreCard.dc.html  paylaşılabilir mağaza kartı bileşeni

  han-data.js            11 zengin kayıt + 4 dil içerik/çeviri verisi
  han-scale.js           ölçek omurgası: 38 yer · 1.385 kayıt · onay hattı
  han-search.js          arama, sıralama, talep dağıtımı
  han-offers.js          gerçek teklifler, huni, redler, yorumlar
  han-admin.js           yönetim kararları: triyaj · görev · kullanıcı · içerik · medya · geo
  han-logic.js           zengin kayıt mantığı: eşleşme, plan, rota, kur
  han-index.js           arama indeksi yardımcıları
  han-map.html           harita katmanı
  image-slot.js          görsel yuvası bileşeni (mağaza görselleri)
  support.js             prototip runtime'ı (üretime taşınmaz)

  _ds/                   web/mobil/UI tasarım sistemi (bundle + tokenlar)
  assets/                fotoğraf ve ikon varlıkları

  DENETIM-PLANI.md       ⭐ uçtan uca denetim: 13 bulgu ve gerekçeleri
  ADMIN-PLANI.md         ⭐ yönetim tarafı: 12 eksik süreç, dört faz, ne neden böyle
  URUN-KARARLARI.md      ⭐ ürün kararları — M4 ödeme kararı burada
  OLCEK-PLANI.md         30–50 bin işletmeli ölçek planı
  PLAN.md · WEB-PLAN.md · MAGAZA-SAYFASI-PLANI.md · ISLERIM-PLANI.md
  TALEP-RFQ-PLANI.md · EDITOR-PLANI.md · PLAN-KATEGORISI.md
```

**Prototipi çalıştırmak:** `.dc.html` dosyalarını doğrudan tarayıcıda açın.
Veri `localStorage`'da birikir; temiz başlamak için `han-*` anahtarlarını silin.
Talep–teklif döngüsünü görmek için: alıcı olarak `#/isler`'de talep bırakın →
`#/esnaf`'ta bir kaydı sahiplenip teklif verin → talebe dönün.

**Okuma sırası:** bu README → `URUN-KARARLARI.md` (kapsam kararları, özellikle M4) →
`DENETIM-PLANI.md` + `ADMIN-PLANI.md` (neyin neden böyle olduğu) →
`HAN Web.dc.html` içindeki `renderVals()` (view-model'in tamamı) → `han-scale.js`
(veri şeması) → `han-admin.js` (yönetim kararlarının modeli).

---

*Ekran görüntüsü isterseniz söyleyin — varsayılan olarak eklenmedi.*
