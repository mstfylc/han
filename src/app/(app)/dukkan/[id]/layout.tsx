import type { Metadata } from "next";
import type { ReactNode } from "react";

import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import { floorLabel } from "@/lib/shop";

function resolveShop(rawId: string) {
  const curated = D.STORES.find((s) => s.id === rawId);
  const rec = SC.RECORDS.find((r) => r.id === rawId || r.curated === rawId);
  const placeId = curated?.han || rec?.place || "santral";
  const place = SC.PLACES.find((p) => p.id === placeId) || SC.PLACES[0];
  if (!curated && !rec) return null;
  const name = curated ? String(curated.name) : String(rec?.name || "Mağaza");
  const fl = floorLabel(curated ? (curated.floor ?? 0) : (rec?.floor ?? 0), "tr", place);
  const door = curated ? String(curated.no) : String(rec?.door || "1");
  const tel = curated?.tel || rec?.tel || "";
  return { name, place, fl, door, tel, id: curated?.id || rec!.id };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const info = resolveShop(decodeURIComponent(String(id || "")));
  if (!info) {
    return { title: "Mağaza Vitrini | HAN" };
  }
  const title = `${info.name} (${info.place.name} · ${info.fl} · Kapı No: ${info.door}) | HAN`;
  const description = `${info.place.name}, ${info.fl}, Kapı No: ${info.door} konumundaki ${info.name} mağazasının toptan/perakende ürünleri, çalışma saatleri ve han içi yol tarifi.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: ["/assets/ph-shop.png"] },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function DukkanLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const info = resolveShop(decodeURIComponent(String(id || "")));
  const jsonLd = info
    ? {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: info.name,
        telephone: info.tel || undefined,
        address: {
          "@type": "PostalAddress",
          streetAddress: `${info.place.name}, ${info.fl}, Kapı No: ${info.door}`,
          addressLocality: "Fatih",
          addressRegion: "İstanbul",
          addressCountry: "TR",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: info.place.lat,
          longitude: info.place.lng,
        },
        url: `https://han.mansis.com.tr/dukkan/${encodeURIComponent(info.id)}`,
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
