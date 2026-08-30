# HAN — Yönetim Tarafı Denetimi ve Planı (29.08.2026)

> **Durum:** Dört faz da uygulandı ✅ — yönetim tarafı 6 ekrandan **21 ekran + giriş
> dokümanına** çıktı. Açık kalan ürün kararları §6'da.
> Kararlar: 6 rol · Editör Panel'e taşındı · saha hem tek tek hem toplu çalışır ·
> onaysız kayıt görünürlüğü **ayar olarak** bırakıldı (kod içinde sabitlenmedi).

Alıcı ve esnaf tarafı uçtan uca kapatıldıktan sonra aynı yöntem yönetim tarafına
uygulandı: **girdi → durum → ekran → karşı taraf → sonuç.**

Sonuç: yönetim tarafı bir *rapor ekranı* olarak kurulmuş, **operasyon aracı olarak
kurulmamış.** 30–50 bin işletmeli bir pazar yerini yürütmek için gereken günlük
işlerin çoğunun ekranı yok.

---

## 1. Şu an ne var

| Ekran | Ne yapıyor | Gerçek iş yüzeyi mi? |
|---|---|---|
| Özet | 4 kart + semt grafiği + arama analitiği | Rapor · eylem yok |
| Mağaza Kayıtları | DataGrid · arama · durum filtresi · kayıt aç | ✔ evet |
| Alıcı Talepleri | 3 kolonlu liste · "ilerlet" düğmesi | Yarım · teklif görünmüyor |
| Hanlar | Kapsama kartları | Salt okunur |
| Kapsama & Onay | Editör (toplu onay · beyan kuyruğu · askı · yetkililer) | ✔ evet |
| Temalar | Tema seçimi | Tercih |

**İki gerçek iş yüzeyi var: kayıt listesi ve onay editörü.** Gerisi ya rapor ya tercih.

---

## 2. Bulgular — eksik olan 12 süreç

Hepsi **veri katmanında karşılığı olan** ama ekranı olmayan işler. Yani uydurma
özellik listesi değil; kodun zaten sözünü verdiği ama tutmadığı yerler.

### A · Veri katmanının doğrudan bozduğu sözler

**A1 · Sistem ayarları ekranı yok.** `han-scale.js` → `SETTINGS` dört anahtar
tutuyor (`showDeclared`, `declaredCanPrice`, `showUnits`, `showSponsored`) ve
başına şu yorum yazılmış: *"Onaysız kaydın yayında görünüp görünmemesi bir KURAL
değil, ayardır: yönetim panelinden açılıp kapanır."* **O panel yok.** Ürünün en
tartışmalı kararı (onaysız kayıt yayında mı) kod içinde donmuş durumda.

**A2 · Sponsorluk yönetimi yok.** `SPONSORS`, `SPONSOR_KINDS` ve "organik sıralama
satılmaz · yanıt performansı düşen dükkânın yerleşimi durur" kuralı veri katmanında
kurulu. Gelir modeli bu. **Tek bir ekranı yok** — kim sponsor, hangi kategoride,
ne kadar süre, performans düştü mü, duraklatıldı mı.

**A3 · Onay kayıt defteri (audit log) okunamıyor.** `han-approvals-v1` her kararı
saklıyor (kim, ne zaman, hangi yolla) ama **hiçbir ekran göstermiyor.** Bir kaydın
neden askıya alındığını sorgulamanın yolu yok.

**A4 · Yer (PLACES) yönetimi yok.** Han kartları salt okunur. Yeni yer eklenemiyor,
kat/birim sayısı düzeltilemiyor, yetkili atanamıyor, `BULK_APPROVED` anlaşması
işaretlenemiyor — hepsi kod içinde sabit dizi.

### B · Pazar yeri sağlığı — hiç yok

**B1 · Teklif denetimi yok.** Panel talebi gösteriyor ama **teklifleri
göstermiyor.** Kaç teklif verildi, kaçı yanıtsız kaldı, hangi esnaf hiç
cevaplamıyor, hangi talep 3 gündür boşta — pazarın çalışıp çalışmadığını söyleyen
sayılar bunlar ve hiçbiri ekranda değil.

**B2 · Yanıtsız talep kuyruğu yok.** Alıcı tarafında "yanıt gelmezse ne olur"
çözüldü. Yönetim tarafında karşılığı yok: hangi kategoride talep karşılıksız
kalıyor (= kapsama açığı), hangi esnafa saha ziyareti gerekiyor.

**B3 · Yorum denetimi yok.** Yorumlar artık gerçek (`han-reviews-v1`), yetki
kontrolü var — ama moderasyon yüzeyi **sıfır**. Bildirilen yorum, esnafın itirazı,
kaldırma, yoruma yanıt hakkı: hiçbiri yok.

**B4 · Bildirim/şikayet kuyruğu işlenemiyor.** `han-reports-v1` üç bildirimde
kaydı otomatik askıya alıyor. Ama bildirimleri **görüp çalışacak** ekran yok:
tek tek incele, sahaya ata, doğrula, reddet, kapat. Editör sadece sonucu gösteriyor.

**B5 · Alıcı tarafı hiç yönetilmiyor.** Talebe alıcı kademesi yazılıyor
(`verified`, `telOk`, `deals`, `rate`) ama bu kademeyi **kim veriyor?** Firma
doğrulama kuyruğu, sahte talep tespiti, kötüye kullanım engeli yok.

### C · Saha operasyonu — asıl iş, en zayıf halka

**C1 · Saha turu planı yok.** 14.716 birimin 964'ünde kayıt var (%7). Kalan
%93'ü kapatmak bu ürünün bir numaralı işi. Elimizdeki tek araç: tek tek "Mağaza
Ekle" formu. Yok olanlar: yetkiliye görev atama, ziyaret listesi, kat kat
kontrol listesi, tur kapanış raporu.

**C2 · Toplu içe aktarma yok.** Han yönetiminden gelen kiracı listesi (`BULK_APPROVED`
mantığının tüm dayanağı) elle 142 kayıt açılarak mı girilecek? CSV/liste yükleme yok.

**C3 · Veri kalitesi iş listesi yok.** "Kataloğu boş: 421" sayısı var, **listesi
yok** — kime gidileceği belli değil. Tazeliği düşen kayıt (`updatedDays`),
mükerrer kayıt, telefonsuz kayıt: hiçbirinin kuyruğu yok.

**C4 · Kullanıcı ve rol yönetimi yok.** `OFFICERS` sabit bir sözlük. Yönetici /
editör / saha yetkilisi / salt okuma ayrımı yok, kullanıcı eklenemiyor,
yetki devredilemiyor.

### D · İçerik ve arama kalitesi

**D1 · Arama sözlüğü yönetilemiyor.** Özet "sonuçsuz aramalar"ı gösteriyor —
doğru sinyal. Ama üzerine **hiçbir eylem yok**: eşanlam ekle (`SYNONYMS`),
kategori aç (`CATS_EXTRA`), çeşit grubu sözlüğüne kelime ekle (`GROUP_WORDS`).
Sinyal var, kolu yok.

**D2 · İçerik yönetimi yok.** `EVENTS`, `CAMPAIGNS`, `CULTURE`, `EMERGENCY`,
`CAT_GUIDE` verileri alıcıya gösteriliyor, hiçbiri düzenlenemiyor.

---

## 3. Öncelik ve durum

Sıralama ölçütü: **ürünün kendi verdiği sözü tutmak** > **pazarın sağlığını
görebilmek** > **operasyonu ölçekleyebilmek**.

### ✅ Faz 1 — sözü tut (uygulandı)

**1a · Kabuk yeniden kuruldu**
Editör artık iframe içinde ayrı bir gezinme katmanı değil. Sekmeleri Panel'in
kenar çubuğuna taşındı (Sahiplenme · Beyan Kuyruğu · Askıdakiler · Toplu Onay ·
Yetkililer); Panel `?embed=1&tab=…` ile hangi sekmeyi istediğini söyler, Editör
gömülüyken kendi şeridini göstermez. Dosya bağımsız erişim için duruyor.

**1a · 6 rollü yetki sistemi**
`han-scale.js` → `ROLES` + `can(role, key)` + `isReadOnly(role)`. Yetki tek yerde
tanımlı; gezinme, düğmeler ve ekran içi eylemler aynı kaynağı okur.

| Rol | Gördüğü |
|---|---|
| Yönetici | Hepsi (14 ekran) |
| Editör | Onay hattı + moderasyon + defter (11) |
| Saha yetkilisi | Kayıtlar · kuyruk · toplu onay · yerler (7) — kendi bölgesi |
| Satış | Özet · kayıtlar · sponsorluk (5) |
| Salt okuma | Rapor ekranları (7) — yazma yok |
| Han yönetimi | Kendi hanı (5) — yazma yok |

Kapsam bir kısıt değil görev tanımı: saha yetkilisi kendi bölgesini, han yönetimi
kendi hanını görür (`scopeFilter`). Rol değişince yetkisi olmayan ekranda kalınmaz.

**1b · Sistem Ayarları** ✅
Beş ayar (`showDeclared` · `declaredCanPrice` · `showUnits` · `showSponsored` ·
`freshDays`) artık gerçekten açılıp kapanıyor, `han-settings-v1`'e yazılıyor ve
Web ile Editör de aynı değeri okuyor. Her ayarın altında **kaç kaydı etkilediği**
yazıyor (`settingImpact`) — soyut anahtar değil, sayılı sonuç: *"421 beyan kaydı
yayında görünüyor"* / kapatılınca *"421 beyan kaydı aramadan çıkar"*. Yanında
"Alıcı şu an ne görüyor" paneli: görünen kayıt 1.385/1.385, talep alabilen 964,
görünen kayıtsız birim 13.331.

**1c · Sponsorluk** ✅
26 yerleşim yönetilebiliyor: kim, hangi tür (kategori vitrini / yer vitrini),
nerede, ne zamana kadar, yanıt oranı ne. Duraklat · sürdür · kaldır · yeni ekle.
**Kural kodda korunuyor:** yanıt oranı %85'in altına düşen yerleşim otomatik durur
ve *elle açılamaz* — düğme bile çıkmaz. Yeni yerleşim yalnız aktif ve eşiğin
üstündeki kayıtlardan seçilebilir. Yayın anahtarı Sistem Ayarları'na bağlı.

**1d · Karar Defteri** ✅
Dört kaynak (onay kararları · sahiplenme · alıcı bildirimleri · saha kayıtları)
tek zaman çizgisinde, tür filtresi ve aramayla. Bir kaydın **neden** askıya
alındığı artık sorgulanabilir. Silinmez.

**1e · Yer Yönetimi** ✅
38 yer düzenlenebilir: ad, tür (çalışma saatini belirler), semt, kat sayısı,
birim sayısı, yetkili, toplu onay anlaşması. Yeni yer eklenebilir.
Kat/birim sayısı kapsama yüzdesinin böleni olduğu için formda bu yazıyor.
Türkçe kısaltma kuralı: `is-merkezi` gibi anahtarlar `PLACE_KINDS` ile hizalı.

### ✅ Faz 2 — pazarı gör (uygulandı)

Yeni modül: `han-admin.js` — yönetimin **insan kararları**. Otomatik kurallar
(üç bildirim = askı, %85 altı = sponsorluk durur) veri katmanında kalır; bu
modül o kuralların üstüne binen elle kararları tutar. Hiçbir karar gerekçesiz
ve zamansız saklanmaz.

**5 · Teklif Denetimi + yanıtsız talep kuyruğu** ✅
Pazarın tek gerçek sağlık göstergesi ekranda: **yanıt oranı**. Her talebin
hunisi (gitti · açtı · teklif · cevaplayamadı) ve yaşı görünüyor.
**SLA 48 saat:** teklif almadan bu süreyi geçen talep kırmızıya düşer ve
"müdahale gerekiyor" der. Filtreler: gecikmiş · teklifsiz · teklifli.

**9 · Teklif yönlendirme** ✅ *(kullanıcı notu)*
Yanıtsız talep kendiliğinden çözülmez. Yönetim bir dükkânı elle işaret eder;
esnaf panelinde **"Yönetici bu talebi size iletti — uygun değilse 'cevaplayamam'
demeniz de bir yanıttır"** olarak çıkar. Yönlendirilen talep, dağıtıma girmemiş
olsa bile o esnafın gelen kutusuna düşer. **Uçtan uca doğrulandı.**

**6 · Şikayet Triyajı** ✅
Dört durumlu akış: Açık → Sahaya atandı → Doğrulandı / Reddedildi.
Otomatik askının bir **alarm**, karar olmadığı ekranda yazıyor: kaydın gerçekten
kapandığını yalnız saha doğrulayabilir, reddedilen bildirim kaydı geri açar.
Gerekçeler ve sayılar bildirim başına görünür.

**7 · Yorum Denetimi** ✅
Yorum hakkı zaten kapıda kısıtlı (yalnız teklif kabul etmiş alıcı); buradaki iş
kuralsızlığı ayıklamak: hakaret · kişisel veri · reklam · ilgisiz. Gizlenen yorum
gerekçesiyle saklanır, **alıcı tarafında da görünmez olur**, geri açılabilir.

**8 · Alıcı Doğrulama** ✅
"Kademeyi kim veriyor?" sorusunun cevabı. Alıcılar ayrı bir tablodan gelmiyor —
talep bırakanlardan türetiliyor (olmayanı uydurmuyoruz). Doğrula · izlemeye al ·
reddet. **Riskli imza:** 3+ talep bırakıp teklif aldığı hâlde hiç anlaşma
kapatmayan alıcı işaretlenir — suçlama değil, esnafın zamanını koruyan sinyal.
Doğrulama kararı **yeni** taleplerin kademesini belirler (geçmiş talepler donar).

**Yolda çıkan gerçek hata (düzeltildi):** yorumların moderasyon anahtarı
`recordId + at` idi. Aynı milisaniyede yazılan iki yorum aynı anahtarı paylaşıyor
ve **birini gizlemek ikisini gizliyordu**. Her yorum artık kalıcı kendi kimliğini
taşıyor (`rv…`); `at` yalnız eski kayıtlar için yedek.

**Responsive:** sabit kolon sayıları (`repeat(4,1fr)` vb.) 13 yerde
`repeat(auto-fit,minmax(…))`'a çevrildi — medya sorgusu olmadan kolon sayısı
kapsayıcı genişliğine göre düşüyor. Tablo görünümlü listeler (Yerler)
dar ekranda yatay kaydırılıyor. Başlıklara `line-height` verildi.

### ✅ Faz 3 — operasyonu ölçekle (uygulandı)

**10 · Saha Görevleri** ✅
Kapsama tek tek dükkânla değil **kat kat turla** kapanır. Görev bir yetkiliye,
bir yere ve bir kat aralığına atılır; dört tür (kapsama turu · doğrulama ·
içerik toplama · han yönetimi görüşmesi), dört durum (atandı → turda → kapandı /
iptal). Hedef uydurulmaz: o yerdeki **kayıtsız birim sayısı** önerilir.
Turda açılan kayıt sayısı girilir, ilerleme yüzdesi ondan hesaplanır.
Saha yetkilisi yalnız kendi görevlerini görür.

**11 · Veri Kalitesi** ✅
"Kataloğu boş: 421" bir sayıydı, **listesi yoktu** — kime gidileceği belli değildi.
Altı kural, her biri bir iş listesi: fiyat bandı yok (421) · telefon yok (0) ·
fotoğraf yok (609) · tazeliği düşmüş (243) · çeşit grubu yok (0) ·
**mükerrer kayıt (2 — gerçek veride bulundu)**.
Her liste tek tıkla saha görevine dönüşür: en çok eksiği olan yer seçilir,
görev formu ön dolu açılır (*"Fiyat bandı yok · 135 kayıt eksik"*). **Doğrulandı.**

**12 · Toplu İçe Aktarma** ✅
Han yönetiminden gelen kiracı listesi yapıştırılır — ayırıcı virgül, noktalı
virgül veya sekme (Excel'den doğrudan). **Hiçbir şey kaydedilmeden önce
önizleme:** kaç satır alınacak, kaçı neden alınmayacak. Reddedilen satır
sessizce düşmez — sebebi yazılır (kapı no tekrarı · ad eksik). Aynı kapıda kayıt
varsa **üzerine yazılmaz**, atlanır ve sayısı bildirilir — adres omurgası kutsal.
Kategori metni sözlükle eşlenir; kayıtlar aramaya anında girer.
"Han yönetimi listesi" işaretlenirse **onaylı**, değilse **beyan** olarak girer.

**13 · Kullanıcılar + Giriş** ✅ *(kullanıcı notu)*
`OFFICERS` sabit sözlüğüydü; artık kullanıcı eklenir, rol değişir, kapsam atanır,
hesap kapanır. Rol seçilirken **kaç ekran göreceği** anında yazılır.
Yetki tanımı `ROLES`'ten okunur — çift kaynak yok.

Yeni doküman **`HAN Giriş.dc.html`** — iki panelli giriş (tasarım sisteminin
*giriş* deseni), tek turuncu CTA. Üç durum:
- **Giriş**: telefon + şifre · hatalı denemede *kalan deneme* sayısı · 5 hatada kilit
- **Şifremi unuttum**: tek kullanımlık 6 haneli kod, **15 dakika** geçerli
- **Yeni şifre**: kod + iki kez şifre · uyuşmazlık kontrolü · başarıda oturum açılır

Akışın çıkmaz sokakları kapatıldı: **şifresi hiç kurulmamış hesap** giriş denerse
doğrudan sıfırlama ekranına geçer; **kimse kayıtlı değilse** "ilk yöneticiyi kur"
çıkar. Kayıtlı olmayan telefon da **aynı cevabı** alır — kimin kayıtlı olduğu sızmaz.
Kullanılan kod ikinci kez geçmez (*"Bu kod bir kez kullanıldı"*). **Doğrulandı.**

> ⚠ Kimlik doğrulama **prototiptir** ve ekranda da böyle yazıyor: şifre tarayıcıda
> tutulur, kod ekranda görünür. Üretimde üçü de sunucu tarafına taşınır.

### ✅ Faz 4 — içerik ve arama kalitesi (uygulandı)

**14 · Arama Sözlüğü** ✅
Sonuçsuz arama bir sinyaldi ama **kolu yoktu**. Artık: sonuçsuz sorgu listesinden
tek tıkla kategoriye bağlanır, ya da elle kelime eklenir. **Canlı önizleme**
ekleme öncesi ne olacağını söyler: *"‘naylon çuval’ sözlükte yok · aramada 58
sonuç veriyor. Poşet'e bağlayınca bu kategorinin kayıtları da çıkar."*
Çakışma sessizce geçmez — kelime başka kategoriye bağlıysa uyarı çıkar.
Eklenen kelime **kalıcı** ve alıcı aramasında anında geçerli.

> **Yolda çıkan gerçek hata (düzeltildi):** `parseQuery` yalnız **tek kelimeye**
> bakıyordu. Sözlükteki çok kelimeli eşanlamlar — `"telefon kabi"`, `"phone case"`,
> `"silikon kılıf"` — **hiçbir zaman eşleşmiyordu.** Artık tüm sorgu ve komşu
> kelime ikilileri de denenir: "telefon kabı" 0 → **84 sonuç**, "phone case" → **84**,
> "vitrin mankeni" 0 → **126**. Bu, sözlüğün yarısının ölü olduğu anlamına geliyordu.

**15 · Etkinlik & Kampanya** ✅ *(kullanıcı notu: "etkinlik kısmı yok")*
`EVENTS` ve `CAMPAIGNS` alıcıya gösteriliyordu ama düzenlenemiyordu. Artık ekleme,
yayına alma ve yayından çıkarma var. Temel veri **bozulmaz** — üzerine ekleme /
gizleme / düzeltme katmanı biner. Yeni içerik **gizli başlar**: yarım içerik
alıcıya gösterilmez. Yayından alınan etkinlik alıcı tarafında da kaybolur —
hem etkinlik sayfasında hem anasayfada. **Doğrulandı.**

**16 · Mağaza Görselleri** ✅ *(kullanıcı notu: "uçtan uca değil")*
Uçtan uca akış: yuva aç → fotoğrafı sürükle bırak → tür ve açıklama → sırala →
kapak seç → onayla/reddet → alıcıda görün. Kurallar kodda: **kapak tek olabilir**
(yeni kapak seçilince eskisi düşer), **kapak silinirse** ilk yayındaki görsel kapak
olur (kapaksız kalmaz), **onaysız görsel alıcıda görünmez**. Kayıt listesi
fotoğrafı olmayanları öne alır — 609 kayıtta hiç fotoğraf yok, iş listesi bu.
**Doğrulandı:** onaylanan kapak mağaza sayfasında çıktı, onay bekleyen çıkmadı.

**17 · Harita & Kat Planı** ✅ *(kullanıcı notu)*
Pin yanlışsa alıcı kapıyı bulamaz. Yer konumu (enlem/boylam), **giriş kapıları**,
yol tarifi notu ve **kat kat koridor adları** düzenlenebiliyor — "2. kat D koridoru
No 118" aranır hale gelir. Fatih sınırları dışına düşen koordinat kabul edilmez
(yazım hatası sessizce geçmez). Kaydedilen konum omurgaya işlenir ve **alıcı
tarafındaki harita ile yol tarifi de aynı pini kullanır.** **Doğrulandı.**

## 6. Açık kalan ürün kararları

Bunlar yönetim eksiği değil, **karar bekleyen ürün konuları**:

- **M1 · Mobil uygulama** (`HAN.dc.html`) ölçeğe hiç geçmedi — 11 kayıtla çalışıyor.
  Öneri: emekliye ayırmak (web zaten telefonda çalışıyor).
- **M2 · Ürün sayfası** — her şey dükkân merkezli. "Şeffaf silikon kılıf" için
  ürün sayfası + o ürünü satan dükkânlar + fiyat aralığı yok.
- **M4 · Ticaretin kapanışı** — karma ödeme modeli onaylandı ama v1 kapsamı
  "işleme girmez" diyor. **İkisi çelişiyor, netleşmeli.**
- **M5 · Gün planı takvimi** — etkinlik + randevu + duraklar tek takvimde
  birleşmiyor.

---

## 4. Yapısal karar (verildi)

Editör'ün sekmeleri Panel'in kendi gezinmesine taşındı — iki katmanlı gezinme
sorunu çözüldü. Editör dosyası bağımsız erişim için duruyor ve `?embed=1`
parametresiyle gömülüyken kendi şeridini göstermiyor.

Tam birleştirme (Editör'ün 900 satırlık mantığını Panel'e taşımak) yapılmadı:
kazanç yok, risk var. Panel'in gezinmesi tek katman olduğu sürece kullanıcı
iki dosya olduğunu görmüyor.

## 5. Yeni depo anahtarları

| Anahtar | Yazan | Okuyan |
|---|---|---|
| `han-settings-v1` | Panel (Sistem Ayarları) | **Panel · Web · Editör** |
| `han-sponsors-v1` | Panel (Sponsorluk) | Panel · Web (yerleşim) |
| `han-places-v1` | Panel (Yerler) | Panel · Web · Editör |
| `han-panel-role` | Panel | Panel |
| `han-moderation-v1` | **Panel (şikayet · yorum · alıcı)** | **Panel · Web** |
| `han-nudges-v1` | **Panel (Teklif Denetimi)** | **Panel · Web (esnaf paneli)** |
| `han-tasks-v1` | **Panel (Saha Görevleri)** | **Panel** |
| `han-users-v1` | **Panel (Kullanıcılar)** | **Panel · Giriş** |
| `han-auth-v1` | **Giriş** | **Giriş · Panel** |
| `han-lexicon-v1` | **Panel (Arama Sözlüğü)** | **Panel · Web (arama)** |
| `han-content-v1` | **Panel (Etkinlik & Kampanya)** | **Panel · Web** |
| `han-media-v1` | **Panel (Mağaza Görselleri)** | **Panel · Web (mağaza sayfası)** |
| `han-geo-v1` | **Panel (Harita & Kat Planı)** | **Panel · Web · Editör** |

Üçü de omurgaya `load*()` fonksiyonlarıyla merge edilir; her doküman kendi modül
örneğini yüklediği için üç tarafın da açılışta çağırması gerekir.
