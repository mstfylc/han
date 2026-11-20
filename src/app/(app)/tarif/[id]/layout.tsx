import type { Metadata } from "next";
import type { ReactNode } from "react";

import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";
import { floorLabel } from "@/lib/shop";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const rawId = decodeURIComponent(String(id || ""));
  const normId = rawId === "santral-han" ? "santral" : rawId;

  const curated = D.STORES.find((s) => s.id === normId);
  const rec = SC.RECORDS.find((r) => r.id === normId || r.curated === normId);
  const directPlace = SC.PLACES.find((p) => p.id === normId);

  if (curated || rec) {
    const placeId = curated?.han || rec?.place || "santral";
    const place = SC.PLACES.find((p) => p.id === placeId) || SC.PLACES[0];
    const fl = floorLabel(curated ? (curated.floor ?? 0) : (rec?.floor ?? 0), "tr", place);
    const door = curated ? String(curated.no) : String(rec?.door || "1");
    const name = curated ? String(curated.name) : String(rec?.name || "Dükkân");
    const title = `📍 ${name} — ${place.name}, ${fl}, Kapı No: ${door} | Han İçi Yol Tarifi`;
    const description = `${name} için dış harita + ${place.name} ${fl} Kapı No: ${door} 3 adımlı görsel kavşak, kat krokisi ve kameralı koridor rehberi.`;
    return {
      title,
      description,
      openGraph: { title, description, type: "website", images: ["/assets/ph-han.png"] },
      twitter: { card: "summary_large_image", title, description },
    };
  }

  if (directPlace) {
    const title = `📍 ${directPlace.name} — Han İçi Kat Planı & Kapı Yönlendirme | HAN`;
    const description = `${directPlace.name} giriş kapıları, kat krokisi ve kamera/sensör destekli koridor yol tarifi.`;
    return {
      title,
      description,
      openGraph: { title, description, type: "website", images: ["/assets/ph-han.png"] },
    };
  }

  return {
    title: "Han İçi Yol Tarifi & Koridor Rehberi | HAN",
    description: "Tarihi Yarımada hanları için dış harita, kat krokisi ve 3 adımlı iç mekân tarifi.",
  };
}

export default function TarifLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
