# HAN — Alıcı Arayüzü Override'ı

**Bu dosya bağımsız bir tasarım sistemi değildir.**
Uyanık Design System (`window.WebMobilUI_422163`) üzerine binen, yalnızca **alıcı arayüzü (A)** için geçerli sapmaları tanımlar.

Esnaf paneli (B), saha aracı (C) ve yönetim paneli (D) sistemin varsayılanlarını olduğu gibi kullanır — bu dosya onları bağlamaz.

---

## 1. Tema: `han`

`tokens/themes.css` içine eklenecek. Şablon `uyanik` temasından kopyalanır, yalnızca marka katmanı değişir.

```css
[data-theme="han"] {
  --color-primary:             #14304f;
  --color-primary-active:      #0f2439;
  --color-primary-soft:        #e8edf3;
  --color-primary-accent:      #0b1a2b;
  --color-primary-transparent: rgba(20,48,79,0.20);

  --color-accent:              #c9a227;
  --color-accent-active:       #a8851c;
  --color-accent-soft:         #faf3e0;
  --color-accent-transparent:  rgba(201,162,39,0.20);
  --color-accent-accent:       #7d6314;

  --ring-primary:              rgba(20,48,79,0.20);
}
```

**Uyanık turuncusu (`#e08a2b`) HAN'da kullanılmaz.** Accent zinciri doğrudan set edilir, `--color-orange`'a alias bırakılmaz.

**Dark tema alıcı arayüzünde üretilmez.** Kullanıcı dış mekânda, güneş altında; koyu tema okunmaz. `han` temasının dark varyantı yalnızca B/C/D için tanımlanır.

---

## 2. Tipografi override'ı — tek kritik sapma

Sistem gövde metnini 13px (`--text-sm`) alıyor. Bu masaüstü kurumsal panel yoğunluğu için doğru, **alıcı arayüzü için yanlış**: hedef kitle 45–60 yaş, dış mekân, tek el, güneş.

Alıcı arayüzünde geçerli ölçek:

| Rol | Token | Değer |
|---|---|---|
| Ekran başlığı | `--text-4xl` | 26px / 700 |
| Bölüm başlığı | `--text-2xl` | 20px / 700 |
| Kart başlığı | `--text-xl` | 18px / 600 |
| **Gövde** | `--text-lg` | **16px / 400** |
| İkincil | `--text-base` | 14px / 400 |
| Meta / dipnot | `--text-xs` | 12px / 400 |

**Kural: A arayüzünde 14px'in altında hiçbir okunması gereken metin yok.** 12px yalnızca tarih ve dipnot için.

Konum bloğu istisnası: han adı 20px/700, alt satır 16px/600.

---

## 3. Kullanılacak ve kullanılmayacak bileşenler

**Kullanılacak (sistemden, değiştirilmeden)**
`Icon` · `Button` · `IconButton` · `Badge` · `Tag` · `Card` (+ Header/Body/Footer) · `Skeleton` · `EmptyState` · `Alert` · `Input` · `Textarea` · `Select` · `FormField` · `ToggleGroup` · `Drawer` · `Modal` · `Tabs`

**Kullanılmayacak**
`AppShell` — sidebar + topbar masaüstü panel deseni, A mobil ve girişsiz
`DataGrid` — yoğun tablo, A'da tablo yok
`Breadcrumb` · `Pagination` · `Stepper` — A'da gezinme derinliği yok
`Avatar` — A'da kullanıcı hesabı yok

**Yeni yazılacak (HAN'a özgü, sisteme geri katkı olarak eklenecek)**
- `StoreCard` — arama sonuç kartı
- `LocationBlock` — han · giriş · kat · dükkân no bloğu
- `StickyActionBar` — sabit alt aksiyon çubuğu
- `FloorPlan` — basit SVG kat krokisi

---

## 4. HAN'a özgü bileşen kuralları

### LocationBlock — ürünün en kritik bileşeni

Kullanıcı o anda dükkânı fiziksel olarak arıyor. Bu blok mağaza adından sonraki en belirgin öğe.

- Zemin: `--color-primary-soft`
- Yarıçap: 12px (kart yarıçapı)
- Dolgu: 16px
- Konum ikonu solda, `--color-primary`
- Han adı: 20px/700
- Alt satır (giriş · kat · no): 16px/600
- Üçüncü satır — fiziksel tarif, 14px, `--color-text-muted`:
  "B girişinden girip merdivenle 2. kata çıkın, koridorun solunda"

Üçüncü satır opsiyoneldir ama varsa gösterilir; ilk denemede iyi çalıştı.

### StickyActionBar

- Beyaz zemin, üst 1px border (`--border-default`), 16px dolgu, güvenli alan payı
- 4 aksiyon yatay: WhatsApp · Ara · Yol · Talep
- WhatsApp: `#128C7E` dolu, beyaz metin, genişçe (yaklaşık 2 birim)
- Talep: `accent` dolu (altın)
- Ara ve Yol: `outline` varyant
- Kaydırmadan bağımsız sabit

**Buton hiyerarşisi kuralı korunur:** ekranda en fazla bir dolu accent buton. WhatsApp yeşili fonksiyonel bir renktir, accent sayılmaz.

### StoreCard

Bilgi sırası kesindir, değiştirilmez:
1. Mağaza adı (18px/600) + doğrulama rozeti
2. `LocationBlock` (kompakt varyant)
3. Kategori `Tag`'leri
4. Eşleşen ürün grupları
5. Mesafe
6. Ticari rozetler (`Badge`, `light` varyant)
7. Son güncelleme (12px, muted)

---

## 5. Düzen

- Referans genişlik **390px**, mobil birincil
- Masaüstünde içerik 480px ortalanmış — masaüstü için ayrı düzen yapılmaz
- Sayfa yatay dolgusu 16px (sistemin 28px içerik dolgusu A'da geçerli değil)
- Kart iç dolgusu 20px (sistem varsayılanı korunur)
- Kartlar arası 12px, bölümler arası 24px
- Alt sekme çubuğu **yok** — yalnızca `StickyActionBar`

---

## 6. Dokunma ve erişilebilirlik

- Minimum dokunma hedefi **44 × 44px** (sistem varsayılanından büyük)
- Buton yüksekliği A'da `lg` boyut — 48px
- Giriş alanı yüksekliği 48px
- Kontrast en az 4.5:1
- Odak halkası 3px `--ring-primary` (sistem varsayılanı korunur)

---

## 7. Korunan sistem kararları

Bunlar değiştirilmez, sistemden aynen gelir:

- Inter, tek aile
- 4px tabanlı boşluk ölçeği
- Kart 12px / buton 6px yarıçap
- Yumuşak düşük opaklık gölge (`0 3px 4px rgba(0,0,0,.03)`) — derinlik 1px kenarlıktan gelir
- KeenIcons, outline varyant
- Hareket: 150–200ms, `cubic-bezier(.4,0,.2,1)`, zıplama yok
- Buton hiyerarşisi: ekran başına tek dolu accent
- Metin: buton ve gezinmede Başlık Düzeni, gövdede cümle düzeni
- Emoji yok

---

## 8. Yasaklar (A arayüzü)

Koyu tema · AppShell · DataGrid · gradient · blur · glassmorphism · emoji · illüstrasyon · maskot · hero görsel · kaydırmalı banner · fotoğraf merkezli büyük ızgara · 14px altı okunur metin · giriş/kayıt zorunluluğu · sepet, fiyat etiketi, "satın al" gibi e-ticaret öğeleri · lorem ipsum
