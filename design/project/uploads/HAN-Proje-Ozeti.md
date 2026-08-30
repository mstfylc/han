# HAN — Proje Özeti

**Durum:** Teklif aşaması · Faz 0 imzası bekleniyor
**Tarih:** 11 Ağustos 2026
**Doküman türü:** İç referans — müşteriye gitmez
**Amaç:** Projeye sonradan bakan birinin (veya üç ay sonraki bizim) tek dokümanla durumu anlaması

---

## 1. Proje nedir

HAN, İstanbul Tahtakale'deki toptancı hanlarında bulunan ~600 işletmeyi aranabilir hale getiren bir B2B keşif platformudur.

**Çözdüğü problem:** Şehir dışından veya İstanbul'un başka semtlerinden toptan alım yapmaya gelen esnaf, aradığı ürünü hangi handa, hangi katta, hangi dükkânda bulacağını bilmiyor. Ürün çok, bilgi dağınık, ticaret ölçülemiyor.

**Kanıtlanacak tek hipotez:**
> Dijital arama, Tahtakale'de fiziksel ziyarete veya ticari iletişime dönüşür mü?

Bu cümleye hizmet etmeyen hiçbir özellik ilk sürüme girmez.

**Ne değildir:** E-ticaret sitesi değil. Sepet, ödeme, sipariş yok. Ürünün sonucu bir tıklama değil, bir telefon görüşmesi veya dükkân ziyaretidir.

---

## 2. Müşteri ve bağlam

Müşteri, 600 kiracıya erişimi olan bir han yönetimi. Elinde hazır bir arz ağı var — çoğu platformun sıfırdan kurmak zorunda olduğu şey.

**Müşterinin motivasyonu:** İşletme ve değer katma. Yatırım turu hedeflemiyor. Bu, ödeme güvenilirliği ve abonelik modeli açısından olumlu.

**Müşterinin beklentisi:** Kaynak koda sahip olmak değil; uygulamaya sürekli destek verecek ve zamanla geliştirecek bir firmayla çalışmak.

**Müşterinin kısıtı:** Başlangıç rakamının yüksek görünmesini istemiyor. Kısıt üç katmanlı — toplam tutar, peşin çıkacak nakit, ve "ya çalışmazsa" endişesi.

---

## 3. Bizim rolümüz ve ticari model

Yazılım tedarikçisi değil, **ürün ortağı**yız: ürün stratejisi, MVP kapsamı, KPI'lar ve faz kapıları bizde; saha ve bütçe müşteride.

**Ürün bir yazılım teslimi değil, işlettiğimiz bir platformdur.**

| Konu | Karar |
|---|---|
| Kaynak kod | Teslim edilmez. IP, mimari ve metodoloji bizde. |
| Müşteriye ait | Veri (tam ihraç hakkıyla), HAN markası, alan adı, kullanım lisansı |
| Süreklilik garantisi | Escrow — biz teklif ederiz, sormasını beklemeyiz |
| Münhasırlık | Tarihi Yarımada, süreli, ek bedelli. Türkiye geneli asla. |
| Minimum taahhüt | 24 ay (36 hedeflenir) |

### Fiyat

| Kalem | Tutar |
|---|---|
| Faz 0 + 0.5 (7 hafta) | **1.000.000 TL** + KDV, imzada peşin |
| Faz 1 kurulum (5 ay) | 3.500.000 – 4.000.000 TL, 8 taksit |
| Aylık hizmet | İlk 6 ay 150.000 → sonrası 350.000 TL |
| Geliştirme kotası | Aylık 20 saat dahil, aşım tarifeli |

3 yıllık toplam ≈ 17 milyon TL. Tek seferlik proje modeline göre iki katı, üstelik öngörülebilir nakit akışı ve kalıcı ilişkiyle.

**Zorunlu maddeler:** KDV hariç · yıllık TÜFE endeksleme · gecikmede takvim durur ve beklenen süre faturalanır · erken fesihte kalan kurulum farkı muaccel · *Faz 0.5 bulguları Faz 1 kapsamını belirler.*

---

## 4. Ekip

| Rol | Doluluk |
|---|---|
| Ürün/teknik lider | %70 |
| Kıdemli full-stack | %100 |
| Orta seviye full-stack | %100 |
| UX | %25 |

Ortalama **3,0–3,2 FTE**, Faz 1 süresi 5 ay. Ekibi 2,5'e indirmek toplam maliyeti düşürmez, süreyi uzatır ve otobüs faktörünü 1'e çeker.

---

## 5. Kilit teknik kararlar

**Çok kiracılı (multi-tenant) — ilk günden.** Sonradan dönüştürme yasak. İkinci müşteri bu kararla kazanılır. Tenant = ticaret bölgesi / müşteri markası.

| Katman | Karar |
|---|---|
| Repo | Tek monorepo (pnpm), **private** |
| Web | Next.js 15 + React 19 + Tailwind, SSR/ISR (SEO kritik) |
| Backend | TypeScript — Nest / Next API + Prisma |
| Worker | Ayrı küçük servis (katalog çıkarma, görsel işleme) |
| DB | PostgreSQL + PostGIS |
| Arama | Postgres FTS + unaccent + pg_trgm + elle bakımlı eş anlamlı sözlüğü |
| Harita | Google Maps + elle çizilmiş SVG kat planı |
| İletişim | `wa.me` deep link (referans kodlu). Business API Faz 1'de yok. |
| Analitik | **Kendi olay şemamız** + Sentry |
| Tasarım | Uyanık Design System + `han` teması + alıcı arayüzü override'ı |

**POS'tan kod devri: yok.** Sadece karar bilgisi ADR olarak taşınır. İskelet Uyanık Koç monorepo yapısından, domainsiz template'e indirgenerek.

**Backend gerekçesi:** Frontend zorunlu olarak Next.js (SEO). Tek dil + paylaşılan tipler, 3 kişilik ekipte en büyük hız kazancı. 5 yıllık bakım bizde — iki runtime her ay maliyet yazar.

---

## 6. Ürün kararları

- **Pilot: iki kategori.** Telefon/elektronik aksesuar (yapılandırılmış) + bijuteri/takı (yapılandırılmamış). Kontrast testi. Hediyelik eşya pilota alınmaz — kategori tanımsız, ölçülemez.
- Pilot kategoride **%80+ kapsam.** "Aradım, bulamadım" deneyimi ürünü öldürür.
- Alıcı arayüzü **açık tema, 16px gövde metni.** Dış mekân, güneş, 45–60 yaş.
- Mağaza profilinde **sabit alt aksiyon çubuğu:** WhatsApp · Ara · Yol · Talep. Ürünün tüm ticari değeri burada.
- **Katalog boşken profil tam görünür.** Esnafın çoğu ürün girmeyecek; ürün bu halde de işe yaramalı.
- Katalog yükleme WhatsApp kadar kolay: fotoğraf çek → AI çıkarım → onayla.
- Esnaf panelinde parola yok, sadece OTP.
- Saha personeli için PWA, native değil.

**Faz 1'de YOK:** Native mobil · ödeme · lojistik · çoklu teklif pazarı · çoklu dil · kampanya modülü · canlı yayın · WhatsApp Business API · gelişmiş analitik · AI çeviri

**Kapsam dışı:** Saha operasyonu · 600 profilin veri girişi · fotoğraf çekimi · esnaf eğitimi · pazarlama · marka kimliği (opsiyonel ayrı kalem)

---

## 7. Faz planı

| Faz | Süre | Çıktı |
|---|---|---|
| **Faz 0** | 3 hafta | PRD, prototip, veri modeli, mimari, kesin bütçe, işletme modeli |
| **Faz 0.5** | 4 hafta | Saha doğrulama — yazılım yok, elle liste + WhatsApp + insan |
| **Faz 1** | 5 ay | Çalışan MVP, paneller, analitik |
| **Faz 2** | 8–12 hafta | Pilot operasyon, ticari doğrulama |
| **Faz 3–4** | Kanıt sonrası | Teklif/üyelik, HAN Market ve Explore, bölgesel ölçek |

**Kritik takvim kuralı:** Faz 1 geliştirme takvimi saha veri akışına bağımlı olmayacak. Seed data ile ilerlenir, gerçek veri sonradan bağlanır.

### Faz kapıları

**Faz 0.5 → Faz 1**
- Her iki pilot kategoride ≥20 esnaf teması, ≥%50'si katalog bilgisi paylaşmaya açık
- ≥30 nitelikli alıcı talebi
- Esnafın ≥%40'ı talebe 24 saatte dönüyor
- Arama başarısı ≥%60

Tutmuyorsa **kapsam yeniden yazılır**, takvim değil. Karar yetkisi bizde.

**Faz 2 → Faz 3**
- Pilot mağazaların ≥%40'ı talebe 24 saatte dönüyor
- Aylık nitelikli talep hedefi tutuyor
- ≥%15 mağaza **gerçek ödeme** yapıyor — niyet değil, tahsilat
- 600 kiracı dışından katılım talebi geliyor

---

## 8. Riskler

| # | Risk | Seviye | Önlem |
|---|---|---|---|
| R1 | Esnaf katalog yüklemiyor (rekabet/fiyat gizliliği) | **Yüksek** | Fiyatsız katalog modeli; AI ile sıfır-efor giriş; Faz 0.5'te ölçülür |
| R2 | Alıcı trafiği gelmiyor | **Yüksek** | Müşteriden sayısal talep taahhüdü; SEO ilk günden; mevcut alternatif haritalanır |
| R3 | Atıf tartışması ("o müşteri zaten benimdi") | Yüksek | Referans kodlu deep link + panelde talep kapanış adımı |
| R4 | Kapsam kayması | Yüksek | PRD kilidi + "ekleme = ayrı teklif" |
| R6 | **Saha yavaş ilerler, son karar bizde değil** | **Yüksek** | Teslim kriterleri yalnızca yazılıma bağlı · ölçüm bizde · aylık saha sağlık raporu + eskalasyon |
| R8 | Kur/enflasyon marjı yer | Yüksek | Endeksleme maddesi |
| R5 | Veri girişi bize kalır | Orta | Sözleşmede net kapsam dışı veya birim fiyat |
| R9 | Aylık ücret destek yükünü karşılamaz | Orta | Çok kiracılı olmadan kârlı değil — ikinci müşteri şart |
| R11 | Metronic türevi DS'nin çoklu lisanslanması | **Açık** | ADR + hukuk görüşü, Faz 1'den önce |

**En kritik ikisi R1 ve R2.** İkisi de yazılımla çözülmüyor ve ikisi de Faz 0.5'in varlık sebebi.

---

## 9. Doküman haritası

| Doküman | İçerik |
|---|---|
| `HAN-Karar-Dokumani-v1.1.md` | Kilitlenmiş tüm kararlar |
| `HAN-Teklif-v1.md` | Müşteri teklifi |
| `HAN-Faz0-Calisma-Plani-v1.md` | 7 haftanın hafta hafta planı |
| `HAN-Faz05-Saha-Testi-Protokolu-v1.md` | Saha testi uygulama protokolü |
| `HAN-Bilgi-Mimarisi-Ekran-Envanteri-v1.md` | IA, URL yapısı, ekran seti |
| `HAN-Tasarim-Brief-ClaudeDesign-v1.md` | Ekran içerik brief'i |
| `HAN-Alici-Arayuzu-Override-v2.md` | DS üzerine alıcı arayüzü sapmaları |
| `HAN-ClaudeDesign-Promptlar-v2.md` | Prototip üretim prompt seti |

**Repo yapısı:** `han-internal` (gizli — teklif, ADR, risk, tahmin, sözleşme) ve `han-product` (Faz 0 imzasından sonra — PRD, tasarım, mimari).

---

## 10. Açık maddeler

| # | Konu | Durum |
|---|---|---|
| 1 | `mstfylc/han` reposu **public** — IP pozisyonuyla çelişiyor | **Acil** |
| 2 | ADR seti yazılmadı (6 karar) | Bekliyor |
| 3 | Faz 1 iş kırılımı ve takvim | Bekliyor |
| 4 | DS lisans durumu (Metronic türevi, çoklu satış) | Hukuk görüşü gerekli |
| 5 | Kendi platform adımız ve kimliğimiz | Paralel çalışma |
| 6 | HAN marka kimliği — opsiyonel kalem olarak teklife eklenecek mi | Karar bekliyor |
| 7 | Müşterinin saha koordinatörü — somut isim | Görüşmede bağlanmalı |

---

## 11. Kırmızı çizgiler

Bunlardan biri gerçekleşirse teklif geri çekilir:

- Faz 0'ın ücretsiz veya sembolik istenmesi
- Keşif atlanarak sabit fiyatlı tam MVP talebi
- Kaynak kod ve IP devri şartı
- Türkiye geneli münhasırlık talebi
- Ticari sonuca (kullanıcı sayısı, ciro) bağlı teslim kriteri
- Ödemenin yatırım turuna bağlanması

---

## 12. Bu işin bizim için asıl değeri

Tek proje değil, üç katman:

1. **Tekrar eden gelir** — 3 yılda ~17 milyon TL, öngörülebilir nakit akışı
2. **Playbook** — "bir ticaret merkezindeki 600 işletmeyi dijitalleştirme ve aktive etme" metodolojisi. Yazılımdan değerli.
3. **Ürünleşme** — ikinci han/çarşı/OSB'de geliştirme maliyeti sıfıra yakın; kurulum + lisans satılır, marj %70'e çıkar.

Bu yüzden çok kiracılı mimari ve IP maddesi pazarlık konusu değil. Üçüncü katman onlara bağlı.

---

*Vizyonu küçültmüyoruz; doğru sıraya koyuyoruz.*
