> **28.08.2026 denetimi:** bu belgedeki bazı ✅ maddeler kodda yarım kalmıştı.
> Bulgular ve düzeltmeler `DENETIM-PLANI.md` içinde; açık kalanlar orada §3'te.

> **Durum: tamamlandı.** Bölüm adı "Talep ve Teklifler" oldu (kayıtlılar ve bildirimler
> kullanıcı kararıyla içinde kaldı). Talep formu çok satırlı hale geldi; kimlik hesaba taşındı
> (son adımda SMS onayı), koli/adet · hedef fiyat · süre · teslim · kime gitsin · numune ·
> sıklık · örnek görsel · kategori teyidi eklendi. Yaşam döngüsü, talep kapatma, teklif reddi
> sebebi, tekrar sipariş, üç kademeli alıcı ve esnaf tarafında alıcı rozeti kuruldu.

# "İşlerim" — baştan düşünme

## 1 · İsim doğru değil, çünkü içerik doğru değil

"İşlerim" dört ayrı işi tek çekmeceye koyuyor: taleplerim · karşılaştır · kayıtlılar · bildirimler.
Kapsayıcıya göre isim verilmiş, yapılan işe göre değil.

**"İhale" yanlış olur** — ihale kapalı zarf, kural, süre ve resmî usul demektir. Çarşı toptan
alımı ihale değil, **teklif toplama**dır (RFQ).

Öneri: bölümün adı yapılan işi söylesin — **"Alım"** ya da **"Teklif Topla"** — ve içine ait
olmayanlar çıksın:
- **Kayıtlılar** keşfe ait (Ara/Keşfet), alıma değil
- **Bildirimler** başlıktaki zil simgesine ait, bir sekmeye değil

Kalan bölüm tek işi anlatır: **talep → teklif → anlaşma**.

## 2 · Talep oluşturma bir dilek formu, talep formu değil

Şu an: ürün adı · adet · telefon · zaman. Dokuz eksik:

1. **Kimlik talepte değil, hesapta olmalı** — telefon her talepte elle yazılıyor. Doğrulama
   hesap seviyesinde bir kez yapılmalı: sorumluluk, spam kontrolü ve yanıt yönlendirmesi
   ancak o zaman çalışır.
2. **Koli mi adet mi** — Faz 0.3'te koli verisi geldi, talep formu hâlâ sadece adet biliyor.
3. **Hedef fiyat / bütçe** — kimin cevap vereceğini değiştirir.
4. **Numune isteği** — B2B'de ilk adım genelde numunedir; akışta hiç yok.
5. **Teslim şekli** — çarşıdan alacağım · kargo · ihracat (gümrük evrağı gerekiyor mu).
6. **Teklif toplama süresi** — son tarih yok, o yüzden talep hiç kapanmıyor.
7. **Kime gitsin** — tüm uygun kayıtlar · yalnız onaylı · yalnız üretici.
8. **Görsel/örnek** — çarşının en çok kullandığı yol: "bunun gibi" + fotoğraf.
9. **Kategori teyidi** — motor tahmin ediyor, alıcı onaylamıyor.

## 3 · Olmayan süreçler

- **Talep yaşam döngüsü** — açık → teklif toplanıyor → değerlendirme → anlaşıldı ·
  vazgeçildi · süresi doldu. Şu an sadece "teklif var / yok".
- **Numune aşaması** — teklif kabulünden önce numune isteme ve sonucu.
- **Tekrar sipariş** — geçmiş anlaşmadan tek tuşla yeni talep (Faz 0.2'de tespit edildi,
  yapılmadı; B2B gelirinin çoğu buradan gelir).
- **Talep kapatma** — alıcı "aldım / vazgeçtim" diyebilmeli; yoksa esnaf boşa mesaj atar.
- **Teklif reddi sebebi** — "pahalı · geç · MOQ yüksek". Bu esnafa geri bildirimdir,
  sonraki teklifini düzeltir.

## 4 · Onaylı müşteri — K2'nin simetrik hâli

Mağazayı doğruluyoruz, alıcıyı doğrulamıyoruz. Üç kademe:

| Kademe | Kim | Ne yapabilir |
|---|---|---|
| Misafir | turist | tek ürün soruları, doğrulama yok |
| Telefonu doğrulanmış | alıcı | talep açar, günlük kota var |
| **Onaylı firma** | toptan alıcı | rozet · talebi esnafta üstte · yüksek kota |

Onaylı firma girdisi: firma adı + vergi no + ülke (ileride vergi levhası / ticaret sicil).

Esnaf tarafında karşılığı — talep kartında **"onaylı firma · 12 anlaşma · %80
sonuçlandırma"**. Esnaf kimi ciddiye alacağını böyle bilir.

**Kısıt (K1):** doğrulama parayla satılmaz. Kimlik verirsen öncelik kazanırsın, ödeme
yapınca değil.

## Sıra
1. Bölüm adı + kayıtlılar/bildirimler taşınması
2. Talep formu (kimlik hesapta, koli, süre, numune, teslim, hedef fiyat, kime gitsin)
3. Talep yaşam döngüsü + kapatma + red sebebi
4. Onaylı müşteri kademeleri + esnaf tarafında rozet
5. Tekrar sipariş
