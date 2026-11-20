import type { Metadata } from "next";
import type { ReactNode } from "react";

import * as SC from "@/data/han-scale";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const normId = decodeURIComponent(String(id || "")) === "santral-han" ? "santral" : decodeURIComponent(String(id || ""));
  const place = SC.PLACES.find((p) => p.id === normId);
  if (!place) return { title: "Han & Çarşı Rehberi | HAN" };

  const title = `${place.name} — ${place.floors.length} Kat Planı, ${place.units} Birim ve Kapı Numaraları | HAN`;
  const description = `${place.name} kat krokisi, kapı numaraları, açık çalışma saatleri ve toptan/perakende firma rehberi.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: ["/assets/ph-han.png"] },
  };
}

export default async function YerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const normId = decodeURIComponent(String(id || "")) === "santral-han" ? "santral" : decodeURIComponent(String(id || ""));
  const place = SC.PLACES.find((p) => p.id === normId);
  const jsonLd = place
    ? {
        "@context": "https://schema.org",
        "@type": "ShoppingCenter",
        name: place.name,
        geo: { "@type": "GeoCoordinates", latitude: place.lat, longitude: place.lng },
        url: `https://han.mansis.com.tr/yer/${encodeURIComponent(place.id)}`,
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
