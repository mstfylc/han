import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { StoreSync } from "@/components/StoreSync";
import { AppProvider } from "@/state/AppState";
import "@/ds/ds.css";
import "./globals.css";

export const metadata: Metadata = {
  // Absolute URLs for og: images. Set NEXT_PUBLIC_SITE_URL in deployment.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "HAN — İstanbul çarşıları firma rehberi, rota ve toptan alım",
  description:
    "Tarihi Yarımada çarşılarında 10 binden fazla dükkân: kim ne satıyor, hangi sokakta, hangi fiyata. Rota kurun, teklif alın, kargo ve tax-free işlerini planlayın.",
  openGraph: {
    title: "HAN — İstanbul çarşıları rehberi",
    description: "Bul · Git · Al — çarşının firma rehberi, rotası ve toptan alım aracı.",
    type: "website",
    images: ["/assets/han-mark.svg"],
  },
  // A business directory earns most of its traffic from search, and it has to
  // be findable in all four of its languages (audit finding A4).
  alternates: {
    languages: {
      tr: "/?lang=tr",
      en: "/?lang=en",
      ru: "/?lang=ru",
      ar: "/?lang=ar",
      "x-default": "/?lang=en",
    },
  },
  icons: { icon: "/assets/han-mark.svg", apple: "/assets/icon-192.png" },
  // PWA: the phone installs the web app instead of us maintaining a second
  // codebase — the M1 decision ("web IS the mobile product"), taken seriously.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "HAN", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1f3864",
};

/**
 * `lang="tr"` on the root element is not decoration — Turkish casing (İ/ı)
 * depends on it. Without it `text-transform: uppercase` prints "ÇEŞIT" instead
 * of "ÇEŞİT" (trap 16). The client updates it when the reader picks another
 * language; Turkish is the correct server default.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" dir="ltr" data-theme="han">
      <body>
        <StoreSync>
          <AppProvider>{children}</AppProvider>
        </StoreSync>
      </body>
    </html>
  );
}
