import type { MetadataRoute } from "next";

import * as D from "@/data/han-data";
import * as SC from "@/data/han-scale";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || "https://han.mansis.com.tr").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = ["", "/ara", "/harita", "/plan", "/etkinlik", "/kategori", "/arac/doviz", "/esnaf"].map(
    (p) => ({
      url: `${BASE}${p}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: p === "" ? 1 : 0.85,
    }),
  );

  const placeRoutes = SC.PLACES.map((p) => ({
    url: `${BASE}/yer/${encodeURIComponent(p.id)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: p.id === "santral" ? 0.95 : 0.75,
  }));

  const storeRoutes = D.STORES.flatMap((s) => [
    {
      url: `${BASE}/dukkan/${encodeURIComponent(String(s.id))}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    {
      url: `${BASE}/tarif/${encodeURIComponent(String(s.id))}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
  ]);

  return [...staticRoutes, ...placeRoutes, ...storeRoutes];
}
