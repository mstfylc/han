> **28.08.2026 denetimi:** bu belgedeki bazı ✅ maddeler kodda yarım kalmıştı.
> Bulgular ve düzeltmeler `DENETIM-PLANI.md` içinde; açık kalanlar orada §3'te.

> **Durum: uygulandı.** İki yol (RFQ · doğrudan al) alıcının seçimi olarak kuruldu; serbest
> açıklama kutusu, sıklık (tek/aylık/düzenli), eksiksizlik uyarısı (kapı değil uyarı),
> esnafın soru kanalı, huni görünürlüğü (gitti/açtı/teklif verdi) ve teklif geçerlilik
> süresi (7 gün, dolunca kabul edilemez) eklendi.
>
> Bilinçli olarak yapılmadı: kategori bazlı spec alanları (serbest kutu yeterli görüldü),
> esnafta sınırlı slot, çoklu dosya eki, ihracatta ülke+incoterm.

# Talep (RFQ) — dünya örnekleri ve kalan eksikler

## İncelenen örnekler ve her birinden çıkan ders

**Alibaba RFQ** — alıcı formu: ürün + kategori ağacından seçim, adet + birim, **tedarik tipi**
(hazır / özel üretim / OEM), varış ülkesi, teslim şartı, **teklifin geçerlilik tarihi**, açıklama,
ek dosyalar. Kritik mekanikler: RFQ **yayına çıkmadan önce gözden geçirilir** (spam kapısı),
tedarikçi **soru sorabilir**, alıcı bütün teklifleri tek kutuda yönetir, "24 saatte 10 teklif" taahhüdü.

**IndiaMART Buy Leads** — alıcı ihtiyacını yazar, satıcı **kredi harcayarak** talebi açar.
Ders: bedava talep = umursanmayan talep. Ayrıca form **"tek seferlik mi aylık mı"** sorar —
tek alan, tedarikçi için her şeyi değiştirir.

**Thomasnet / Europages** — teknik derinlik: malzeme, ölçü, tolerans, sertifika, teknik çizim.
Ders: sanayi/imalat talebi metinle değil **spesifikasyonla** kurulur.

**Faire / Ankorstore** — RFQ yok; yayınlanmış toptan fiyat listesi + MOQ var, alıcı doğrudan
sipariş verir. **En önemli ders: standart üründe RFQ sürtünmedir.** RFQ ancak fiyat yayınlanmamışsa,
iş özelse ya da adet yayınlanan bandın üstündeyse anlam taşır.

**Upwork/Fiverr brief** — bütçe aralığı, süre, kilometre taşları ve **soru-cevap dizisi**.

## HAN'da kalan on eksik

1. **Açıklayıcı soru kanalı yok — en büyük eksik.** Çarşıda ilk cevap asla fiyat değildir:
   "hangi mikron? kaç renk? baskılı mı?". Akış talebi eksiksiz varsayıyor. Bu kanal olmadan
   gelen fiyatlar anlamsız olur ya da kimse cevap vermez.
2. **Kategoriye göre spesifikasyon yok.** "500 poşet" bir talep değil: ebat · mikron · baskılı mı ·
   kaç renk · kulplu mu. Kılıf için: telefon modeli · malzeme · renk. `GROUP_WORDS` zaten
   kategori bazlı — aynı yapı **kategori bazlı spec alanları** taşıyabilir.
3. **Sıklık sorulmuyor.** "Tek seferlik mi, aylık mı" — aylık 500 ile tek seferlik 500 aynı iş
   değil ve daha iyi fiyatı hak eder. Tekrar siparişi olaydan *sonra* yapıyoruz, *niyet* olarak sormuyoruz.
4. **Yayın kapısı yok.** Adedi ve spesi olmayan talep 40 dükkânın vaktini alıyor. Olması gereken:
   **eksiksizlik puanı → yayın genişliği**. Zayıf talep az dükkâna gider ya da "şunu da yaz" der.
5. **RFQ ile doğrudan sipariş karışmış.** Dükkânın yayınlanmış fiyatı ve MOQ'u varsa (`band`+`moq`)
   alıcının RFQ'ya ihtiyacı yok — doğrudan temas etmeli. Şu an herkesi RFQ'ya sokuyoruz.
6. **Esnaf tarafında bedel yok.** K1 gereği para almıyoruz; parasız karşılığı **sınırlı slot**:
   bir dükkân en fazla N açık talep tutar, talebi almak bir slot harcar. Ücret almadan ciddiyet.
7. **Tek fotoğraf yetmiyor** — teknik çizim, spec sayfası, eski fatura.
8. **Teklifin geçerlilik süresi yok.** Üç hafta önceki fiyat fiyat değildir.
9. **İhracatta ülke ve teslim şartı yok.** "İhracat" çipi var ama ülke, incoterm (FOB/EXW/CIF),
   liman yok — bu haliyle teklif verilemez.
10. **Huni görünmüyor.** Alıcı "40 dükkâna gitti · 12 açtı · 5 teklif verdi" görmeli.

## Öneri: talep tek form değil, iki yollu bir karar

**Yol A — Doğrudan al.** Dükkânın fiyatı ve MOQ'u varsa, adet bandın içindeyse: RFQ yok,
doğrudan temas + hazır soru kalıpları (zaten kurulu).
**Yol B — Teklif topla (RFQ).** Fiyat yayınlanmamış, iş özel ya da adet bandın üstünde.
O zaman: kategori spesi + sıklık + eksiksizlik puanı + soru kanalı + geçerlilik süresi.
