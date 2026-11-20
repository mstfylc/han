"use client";

// HAN 2.0 — 3D WebGL Map (MapLibre GL JS) with zero-console-error 2D fallback.
// Consumes active design system tokens (--color-primary, --color-accent, .dark)
// so map markers and controls stay 100% consistent across all 4 brand themes.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Lang, Place } from "@/data/types";
import { ACTIVE_BAZAAR } from "@/data/bazaars";
import { Icon } from "@/ds";
import { sx } from "@/lib/sx";
import { useThemePref } from "@/lib/theme";

export interface Map3DPoi {
  id: string;
  kind: string;
  lat: number;
  lng: number;
  title: string;
  sub?: string;
}

export interface Map3DProps {
  places: Place[];
  pois?: Map3DPoi[];
  focusPlaceId?: string | null;
  focusPoi?: Map3DPoi | null;
  lang: Lang;
  height?: string;
  fallbackIframeSrc: string;
  onSelectPlace?: (placeId: string) => void;
  onFrameRef?: (el: HTMLIFrameElement | null) => void;
}

const MODE_STORAGE_KEY = "han-map-3d-pref";

function isWebGLSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_HAN_3D_MAP === "0") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function Map3D({
  places,
  pois = [],
  focusPlaceId,
  focusPoi,
  lang,
  height = "520px",
  fallbackIframeSrc,
  onSelectPlace,
  onFrameRef,
}: Map3DProps) {
  const { dark, theme } = useThemePref();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const [webglOk, setWebglOk] = useState<boolean>(false);
  const [use3D, setUse3D] = useState<boolean>(false);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [loadFailed, setLoadFailed] = useState<boolean>(false);

  // Detect WebGL & user preference safely on mount (zero SSR hydration mismatch)
  useEffect(() => {
    const supported = isWebGLSupported();
    setWebglOk(supported);
    if (!supported) {
      setUse3D(false);
      return;
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const saved = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (saved === "2d") setUse3D(false);
    else if (saved === "3d") setUse3D(true);
    else setUse3D(!reduced);
  }, []);

  const toggleMode = (next3D: boolean) => {
    setUse3D(next3D);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MODE_STORAGE_KEY, next3D ? "3d" : "2d");
    }
  };

  const featuredPlaces = useMemo(
    () =>
      places
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .sort((a, b) => (a.id === "santral" ? -1 : b.id === "santral" ? 1 : b.units - a.units))
        .slice(0, 18),
    [places],
  );

  // Boot MapLibre GL lazily only when 3D mode is active & supported
  useEffect(() => {
    if (!use3D || !webglOk || loadFailed || !containerRef.current) return;
    let disposed = false;

    const boot = async () => {
      try {
        const maplibregl = (await import("maplibre-gl")).default;
        if (disposed || !containerRef.current) return;

        // Inject MapLibre CSS once from CDN/stylesheet safely without cluttering initial bundle
        if (!document.getElementById("han-maplibre-css")) {
          const link = document.createElement("link");
          link.id = "han-maplibre-css";
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/maplibre-gl@5.1.0/dist/maplibre-gl.css";
          document.head.appendChild(link);
        }

        const styleUrl = dark
          ? "https://tiles.openfreemap.org/styles/dark"
          : "https://tiles.openfreemap.org/styles/positron";

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: styleUrl,
          center: [ACTIVE_BAZAAR.center.lng, ACTIVE_BAZAAR.center.lat],
          zoom: ACTIVE_BAZAAR.initialZoom,
          pitch: ACTIVE_BAZAAR.initialPitch,
          bearing: ACTIVE_BAZAAR.initialBearing,
          attributionControl: false,
        });

        mapRef.current = map;

        map.on("error", () => {
          // Graceful silent fallback if vector tile CDN is offline
          if (!disposed && !mapReady) setLoadFailed(true);
        });

        map.on("webglcontextlost", () => {
          if (!disposed) setLoadFailed(true);
        });

        map.on("load", () => {
          if (disposed) return;
          setMapReady(true);

          // Add 3D extruded buildings layer if vector source includes "building"
          try {
            const layers = map.getStyle()?.layers || [];
            const labelLayer = layers.find(
              (l: { type?: string; layout?: Record<string, unknown> }) =>
                l.type === "symbol" && l.layout && l.layout["text-field"],
            );
            const sources = map.getStyle()?.sources || {};
            const sourceId = Object.keys(sources).find((k) => sources[k]?.type === "vector") || "openmaptiles";
            if (!map.getLayer("han-3d-buildings")) {
              map.addLayer(
                {
                  id: "han-3d-buildings",
                  source: sourceId,
                  "source-layer": "building",
                  type: "fill-extrusion",
                  minzoom: 14.5,
                  paint: {
                    "fill-extrusion-color": dark ? "#24344d" : "#d8d1c5",
                    "fill-extrusion-height": ["coalesce", ["get", "render_height"], 14],
                    "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                    "fill-extrusion-opacity": 0.82,
                  },
                },
                labelLayer?.id,
              );
            }
          } catch {
            // Vector style without building heights stays 3D-pitched cleanly
          }

          // Read active CSS design system tokens dynamically (Zero hardcoded colors)
          const cs = getComputedStyle(document.documentElement);
          const primaryCol = cs.getPropertyValue("--color-primary").trim() || "#1F3864";
          const accentCol = cs.getPropertyValue("--color-accent").trim() || "#E08A2B";
          const cardBg = cs.getPropertyValue("--surface-card").trim() || "#ffffff";
          const textHead = cs.getPropertyValue("--text-heading").trim() || "#111827";

          markersRef.current.forEach((m) => m.remove());
          markersRef.current = [];

          featuredPlaces.forEach((p) => {
            const isHero = p.id === "santral";
            const el = document.createElement("button");
            el.type = "button";
            el.style.cssText =
              `display:inline-flex;align-items:center;gap:5px;padding:${isHero ? "6px 11px" : "4px 9px"};` +
              `border-radius:999px;border:2px solid ${isHero ? "#fff" : primaryCol};` +
              `background:${isHero ? accentCol : cardBg};color:${isHero ? "#fff" : textHead};` +
              `font-family:inherit;font-size:${isHero ? "12.5px" : "11.5px"};font-weight:800;` +
              `box-shadow:0 6px 16px rgba(0,0,0,.22);cursor:pointer;white-space:nowrap;`;
            el.textContent = (isHero ? "★ " : "") + p.name;
            el.onclick = () => onSelectPlace?.(p.id);
            const marker = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
            markersRef.current.push(marker);
          });

          pois.forEach((poi) => {
            const el = document.createElement("div");
            el.title = poi.title;
            el.style.cssText =
              `width:26px;height:26px;border-radius:999px;display:flex;align-items:center;justify-content:center;` +
              `background:${primaryCol};color:#fff;border:2px solid #fff;font-size:13px;box-shadow:0 4px 10px rgba(0,0,0,.22);`;
            const icons: Record<string, string> = {
              wc: "🚻",
              atm: "🏧",
              mola: "☕",
              kargo: "📦",
              ulasim: "🅿️",
              eczane: "💊",
            };
            el.textContent = icons[poi.kind] || "📍";
            const marker = new maplibregl.Marker({ element: el }).setLngLat([poi.lng, poi.lat]).addTo(map);
            markersRef.current.push(marker);
          });
        });
      } catch {
        if (!disposed) setLoadFailed(true);
      }
    };

    void boot();
    return () => {
      disposed = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          /* ignore */
        }
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [use3D, webglOk, loadFailed, dark, theme, featuredPlaces, pois]);

  // Smooth flyTo when focusPlaceId or focusPoi changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (focusPoi) {
      map.flyTo({ center: [focusPoi.lng, focusPoi.lat], zoom: 17.8, pitch: 52, duration: 750 });
      return;
    }
    if (focusPlaceId) {
      const pl = places.find((x) => x.id === focusPlaceId);
      if (pl) map.flyTo({ center: [pl.lng, pl.lat], zoom: 17.4, pitch: 52, duration: 750 });
    }
  }, [focusPlaceId, focusPoi, mapReady, places]);

  const show3D = use3D && webglOk && !loadFailed;

  return (
    <div
      data-map3d-shell="1"
      style={sx(
        `position:relative;width:100%;height:${height};border-radius:var(--radius-card, 16px);overflow:hidden;border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:var(--shadow-card, 0 2px 8px rgba(0,0,0,.04))`,
      )}
    >
      {/* Floating 3D / 2D Lightweight Mode Switcher */}
      <div
        style={sx(
          "position:absolute;top:12px;inset-inline-end:12px;z-index:12;display:inline-flex;align-items:center;gap:4px;padding:4px;border-radius:var(--radius-pill, 999px);background:var(--surface-glass, var(--surface-card));backdrop-filter:blur(14px);border:1px solid var(--border-strong);box-shadow:var(--shadow-float, 0 8px 24px rgba(0,0,0,.12))",
        )}
      >
        {webglOk && !loadFailed && (
          <button
            type="button"
            onClick={() => toggleMode(true)}
            aria-pressed={show3D}
            style={sx(
              "height:28px;padding:0 11px;border-radius:999px;border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;" +
                (show3D
                  ? "background:var(--color-primary);color:#fff"
                  : "background:transparent;color:var(--text-body)"),
            )}
          >
            <Icon name="floor-layer" size={13} />
            {lang === "tr" ? "3B Harita" : "3D Map"}
          </button>
        )}
        <button
          type="button"
          onClick={() => toggleMode(false)}
          aria-pressed={!show3D}
          style={sx(
            "height:28px;padding:0 11px;border-radius:999px;border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;" +
              (!show3D
                ? "background:var(--color-primary);color:#fff"
                : "background:transparent;color:var(--text-body)"),
          )}
        >
          <Icon name="map" size={13} />
          {lang === "tr" ? "2B Hafif" : "2D Lite"}
        </button>
      </div>

      {show3D ? (
        <>
          <div ref={containerRef} style={sx("width:100%;height:100%")} />
          <div
            style={sx(
              "position:absolute;bottom:8px;inset-inline-start:10px;z-index:10;padding:3px 9px;border-radius:999px;background:var(--surface-glass, var(--surface-card));backdrop-filter:blur(10px);border:1px solid var(--border-default);font-size:11px;font-weight:600;color:var(--text-muted)",
            )}
          >
            © OpenStreetMap · OpenFreeMap 3B
          </div>
        </>
      ) : (
        <iframe
          ref={(el) => onFrameRef?.(el)}
          src={fallbackIframeSrc}
          title={lang === "tr" ? "Tarihi Çarşı Haritası" : "Historic Bazaar Map"}
          style={sx("width:100%;height:100%;border:0;display:block")}
        />
      )}
    </div>
  );
}
export default Map3D;
