> **28.08.2026 denetimi:** bu belgedeki bazı ✅ maddeler kodda yarım kalmıştı.
> Bulgular ve düzeltmeler `DENETIM-PLANI.md` içinde; açık kalanlar orada §3'te.

# Plan Kategorisi — baştan düşünme

## Şu an ne var
`buyList` (elle yazılan ürün adları) → `D.STORES` (11 seçme kayıt) üzerinden durak sırası,
yürüme süresi, "plan ≈ 17:40'ta biter", etkinlik listesi ve uyarılar.

## Teşhis — yedi kusur

1. **Ölçek dışında kalmış.** Rota 11 seçme dükkân üzerinden kuruluyor; 30-50 bin ölçek kaydı
   plana hiç girmiyor. Uygulamanın tamamı ölçeğe geçti, Plan geçmedi.
2. **Zaman girdisi yok, zaman çıktısı var.** "Plan 17:40'ta biter" diyor ama kullanıcıya hiç
   "kaç saatin var, ne zaman geliyorsun" diye sormuyor. Bütçesiz bir tahmin.
3. **Açık/kapalı gerçeğini yok sayıyor.** `openState` kurulu ama plan pazar günü kapalı hana,
   cuma namazı arasına durak koyabiliyor.
4. **Ziyaretçi tipini ayırmıyor.** Turist gezisi (gezme, yemek, etkinlik, molalar) ile toptan iş
   turu (numune toplama, kargo bırakma, gümrük evrağı) aynı şablonda.
5. **Yük hesabı yok.** Çarşıda ağır/hacimli alışveriş sıralamayı belirler — ağır olan son durak
   olmalı ya da kargo durağı eklenmeli. `accessOf` (asansör/el arabası) verisi var, plan kullanmıyor.
6. **Canlı hâli yok.** "Şu an 2. duraktayım" kavramı yok; durak işaretlenemiyor, sıradaki
   gösterilemiyor. Plan yapıldıktan sonra ölü bir liste.
7. **Etkinlikler yapıştırma.** Ayrı bir blokta listeleniyor, yürüyüş takvimine yerleşmiyor.

## Yeniden kurgu — Plan bir liste değil, bir ÇARŞI GÜNÜ

Üç aşama, tek sayfada sırayla:

### Aşama 1 · Niyet (gitmeden önce)
Dört girdi, hepsi tek satır:
- **Ne zaman** — bugün / yarın / belirli gün + başlangıç saati
- **Kaç saatim var** — 2s / 4s / tam gün
- **Niyet** — gezmek (turist) · iş (toptan) · tek ürün avı
- **Yükü nasıl taşıyorum** — elde · araba/otopark · kargoya vereceğim

### Aşama 2 · Plan (rota)
Girdilere göre sıralı duraklar, her durakta:
- **Açık mı kontrolü** seçilen saate göre — kapalıysa saat kaydırılır ve *sebebi yazılır*
  ("Cuma namazı arası, 14:00'e aldım")
- **Zaman bütçesi** — sığmayan durak sessizce düşmez, "3 saate sığmadı, şunu çıkardım" der
- **Yük sırası** — ağır/hacimli alım son durakta; kargoya verecekse kargo durağı sona eklenir
- **Kapı listesi** — hanın adı değil, gidilecek kat + kapı numaraları
- **Etkinlikler boşluğa yerleşir**, ayrı blokta durmaz
- **Fiziksel erişim uyarısı** — asansörsüz 4. kat, el arabası girmeyen koridor

### Aşama 3 · Yürüyüş (çarşıdayken)
Şu an Harita altında duran "Çarşıdayım" modu aslında Plan'ın üçüncü aşaması:
- Şu anki durak büyük, sıradaki küçük
- "Buradayım / bitti" → sıradakine geçer, kalan süre yeniden hesaplanır
- Her durakta tek dokunuş: WhatsApp · Ara · Yol tarifi
- Çevrimdışı okunabilir

## Kesilecekler
- Ayrı "etkinlik planı" bloğu (rotaya gömülür)
- Bağlamsız "kapsama / durak / yürüme" üçlüsü → yerine **zaman bütçesi çubuğu**
  ("3 saatin 2s 10dk'sı dolu")

## Taşınacak
"Çarşıdayım" modu Harita'dan Plan'a taşınır — plan yürütülüyor, harita gezinme aracı.
