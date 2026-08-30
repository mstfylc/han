> **28.08.2026 denetimi:** bu belgedeki bazı ✅ maddeler kodda yarım kalmıştı.
> Bulgular ve düzeltmeler `DENETIM-PLANI.md` içinde; açık kalanlar orada §3'te.

# HAN — Plan v2 · Bilgi mimarisi ve UX

**Uygulamanın tanımı:** İstanbul çarşılarının **firma rehberi + gezi + ticaret** uygulaması.
Üç iş yapar: **Bul** (10 bin dükkân, kim ne satıyor) · **Git** (rota, harita, tarif, yakındakiler) · **Al** (fiyat sor, teklif, toptan, kargo/ihracat).

**Kural:** her faz uçtan uca kapanır — veri, alıcı ekranı, satıcı tarafı, boş/hata durumları, çevrimdışı, 4 dil (TR/EN/RU/AR), giriş noktaları.

## Dosya ayrımı

| Dosya | Kim için |
|---|---|
| `HAN.dc.html` | **Mobil uygulama** — alıcı + mağaza modu (iPhone çerçevesinde) |
| `HAN Web.dc.html` | **Web müşteri** — alıcının geniş ekran sürümü |
| `HAN Panel.dc.html` | **Yönetim paneli** — HAN ekibi operasyonu |
| `han-data.js` | Ortak veri |
| `han-logic.js` | **Ortak alan mantığı** — eşleşme, filtre, sıralama, plan durakları, varış saatleri, kur |
| `han-map.html` | Ortak harita (rota modu `pts=` ile) |

---

## MOBİL — Faz 1–6 ✅ (tamamlandı)

**Faz 1 — Bilgi mimarisi + anasayfa.** Alt menü: Keşfet · Ara · **Plan** · Etkinlik · Profil (Kayıtlı, Profil'e girdi).
Anasayfadaki "Bugün çarşıda" bloğu (açık dükkân sayısı / kargo saati / kur) kalktı; yerine **"Kaldığın yer"**
(aktif plan, randevu, kayıtlı dükkânlar) ya da hiçbiri yoksa **"Bugün ne yapıyorsun?"** → Gez · Ara · Toptan al.
Kategori ızgarası yerine **bağlamsal 6 giriş**, her karo neden orada olduğunu yazar.

**Faz 2 — Kategori gezinme.** Ana grup → kategori → alt kategori. 5 grup `CAT_GROUPS` olarak veriye eklendi;
alt kategori seviyesi **dükkân kataloglarından türetilir**. Kategori ekranında arama kutusu (ağaç filtrelenir,
eşleşen grup açılır). Aramada **karışık öneri şeridi**: Kategori · Dükkân · Sokak · Han · Ürün — 0 sonuçta bile
doğru yere götürür.

**Faz 3 — Etkinlikler görselleşti.** Fotoğraf üstte tam genişlik + beyaz tarih rozeti + renkli tür rozeti.
Zamana göre gruplandı (Bugün · Yarın · Bu hafta · Sonrası · Geçti). **"Rotaya ekle"** → `evPlan`, Plan sekmesinde
sabit saatiyle durur.

**Faz 4 — Harita ve rota.** `han-map.html` **rota modu**: `pts=` duraklar numaralı pin + kesikli çizgi, riskliler
kırmızı. Plan sekmesinde 300px harita. Her durakta **varış saati**; "Varmadan kapanıyor" / "Kapanışa %s dk" rozetleri.
Çarşı kapandıysa plan yarın 09:30'a kurulur. Cuma namazı arası ve kargo 16:00 uyarıları.

**Faz 5 — Kur, fiyatın yanına.** Mağaza kartı, liste satırı, liste toplamı, karşılaştırma toplamı ve plan bütçesinde
"≈ $/€". Kur yoksa (TR/auto) kur uyarısı ve vaat metni gizlenir.

**Faz 6 — Rehber derinliği.** **Sokak sayfası** (ne satılır, semt, çarşı içi/dışı, genişlik, sokak saatleri,
kategori çipleri, dükkânlar, komşu sokaklar). **Rehber araması**: kapı no ve telefon. Satıcıda **rehber kaydı
tamamlanma oranı** (12 alan, eksik alan etiketleri).

**Ayrıca:** monogramlar bağlaç ve Arapça `ال` tanımlığını atlar — TR `MA·ED·ET·GB·AL`, RU `МА·ДД·ЭТ·ПС·УЛ`,
AR `أإ·مد·إه·غب·تل` (hepsi ayrı).

---

## WEB MÜŞTERİ — `HAN Web.dc.html` ✅ (bu tur)

Mobilde olan hiçbir şey web'de eksik değil; geniş ekran saklamayı bırakır.

- **Üst çubuk:** logo · 6 bölüm · alışveriş modu · para birimi · dil (4). Plan sekmesinde canlı sayaç.
- **Keşfet:** hero + arama · "Kaldığın yer" kartları · bağlamsal 6 kategori · öne çıkan dükkânlar · semtler.
- **Ara — üç kolon:** filtreler solda **açık** (mobildeki alt panel gerekmiyor; sıralama, tür, semt, 7 özellik,
  hepsinde canlı sayı) · sonuç listesi ortada (yatay kart, rozetler, fiyat + ≈ karşılığı, gerekçe satırı) ·
  **detay sağda sabit** (fotoğraf, saat, min. sipariş, teslim, diller, ürün-fiyat tablosu, sertifikalar,
  plana ekle / sokak sayfası / kaydet / tarif). Sağ kolon **sokak sayfasını** da gösterir.
- **Kategoriler — üç kolon:** gruplar · kategoriler · alt kategoriler + sokaklar + o kategorinin dükkânları.
- **Plan:** kapsama/durak/yürüyüş özeti, uyarılar, rotadaki etkinlikler, duraklar (varış saati + kapanış rozeti),
  sağda alım listesi + satır ekleme + toplam ve ≈ karşılığı.
- **İşlerim — üç kolon:** sol nav (Taleplerim · Teklif karşılaştırma · Kayıtlı dükkânlar · Bildirimler) ·
  orta içerik · sağda seçili talebin gelen teklifleri. Talep bırakma formu (ne/kaç/ne zaman/telefon),
  teklifler zamanla damlar, en uygun teklif işaretlenir, **kabul et** → "Anlaşıldı". Karşılaştırma tablosu
  (birim fiyat, minimum, sertifika, teslim, kargo, tax-free, toplam) her satırda ≈ kur karşılığıyla.
- **Ara sağ kolonu dört panel:** dükkân detayı · **yol tarifi** (kapı → sokak zinciri → çapa → kat, adım adım
  süreyle) · **han sayfası** (kat seçici + o kattaki dükkânlar) · sokak sayfası.
- **Harita:** tam genişlik, "Tüm çarşı" / "Planımın rotası" katman düğmesi — rota modunda numaralı pinler.
- **Etkinlikler:** 3'lü fotoğraflı kart ızgarası, zamana göre gruplu, "Rotaya ekle".
- **Depolama:** web kendi anahtarına yazar (`han-web-v1`); mobil kaydı (`han-app-v2`) yalnızca ilk açılışta okunur.
- **Duyarlı:** kırılma noktaları `renderVals()`'ta (`vw` state + resize). Üç kolon → iki kolon → tek kolon;
  1300px altında para birimi/dil/mod tek düğmeye iner ki birincil gezinme ezilmesin.

- **Araçlar — sol nav + içerik:** Döviz çevirici · Tax-free · Yakınımda (POI, türe göre filtre) · Nakliye ve
  gönderim (navlun hesaplayıcı + kargo/emanet noktaları) · Çarşı görgüsü · Acil durum (tel: linkli) · Sorun
  bildir (kategori + detay + bildirimlerim geçmişi). Hepsi mobildeki `CU`/`TS`/`LG` sözlüklerinden besleniyor.

### Web'de henüz olmayan (mobilde var, kapsam dışı bırakıldı)
Randevu alma ve Ziyaret programı — dükkâna özel randevu rezervasyonu, bağlam (belirli mağaza) gerektirir;
Araçlar genel/mağazasız bir hub. Store detayına "Randevu al" eklenmesi ayrı bir iş kalemi.

---

## SIRADA

**1. Satıcı web paneli** (yeni dosya) — esnaf kendi rehber kaydını, kataloğunu, fiyat kademelerini, gelen
talepleri ve teklifleri masaüstünden yönetir. Mobil mağaza modunda olan her şey + geniş ekranda katalog tablosu
ve rehber tamamlanma takibi.

**2. Yönetim paneli genişletmesi** (`HAN Panel.dc.html`) — kategori ağacı yönetimi, sokak & han kapsama haritası,
etkinlik yönetimi, rehber tamamlanma takibi, alıcı plan/rota analitiği, kur & tax-free yönetimi,
doğrulama & saha kontrol kuyruğu.
