This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Çalıştırma

```bash
npm install
cp .env.example .env.local     # DATABASE_URL'i kendi Postgres'ine göre düzenle
npm run dev
```

`DATABASE_URL` yoksa API 500 döner ve uygulama yalnız yerel aynayla çalışır —
yani tek tarayıcıda çalışır ama cihazlar arası paylaşım olmaz.

### Doğrulama

| Komut | Ne kanıtlar |
|---|---|
| `npm run typecheck` | Tip bütünlüğü |
| `npm run lint` | Sıfır hata; React Compiler uyarıları `eslint.config.mjs`'te gerekçeli |
| `npm run parity` | Port edilmiş motor prototiple **birebir** aynı (1.385 kayıt) |
| `npm run smoke` | 39 rota × {tr, ar} + 390px; konsol hatası, sızan `undefined`/`NaN`, `lang`/`dir`, yatay taşma |
| `npm run loop` | Sahiplenme → onay → esnaf paneli döngüsü kapalı (E1 ve E3 dahil) |
| `npm run crossdevice` | Pazar gerçekten paylaşılıyor: iki ayrı tarayıcı birbirini görüyor |
| `npm run auth` | Giriş gerçekten kimlik doğrulaması: şifre sızmıyor, çerez httpOnly, kilit sunucuda, kod tek kullanımlık |

`smoke` üretim sunucusu ister (`bash scripts/serve.sh`, :3000).
`loop`, `crossdevice` ve `auth` geliştirme sunucusu ister (`bash scripts/serve-dev.sh`, :3001)
— şifre sıfırlama kodu yalnız geliştirmede döner, üretimde dönmez ve `auth` bunu ayrıca
üretim sunucusuna karşı doğrular.

> `loop`, `crossdevice` ve `auth` yerel veritabanındaki tabloları sıfırlar ve
> `DATABASE_URL` localhost'u göstermiyorsa çalışmayı reddeder.
