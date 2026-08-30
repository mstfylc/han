"use client";

// HAN — the image slot.
//
// Replaces the prototype's `<image-slot>` custom element. Photos in this
// project are local files (assets/ph-*.png), so they work offline; when one is
// missing the slot has to say what *would* be there rather than showing a
// broken frame.
//
// The alt text is not optional. The audit called out empty alt text on these
// slots (finding A5) — a buyer using a screen reader has to know whether they
// are on a shop, a han or a campaign.

import { useState } from "react";
import type { CSSProperties } from "react";

import { sx } from "@/lib/sx";

export interface ImageSlotProps {
  src?: string | null;
  /** What the picture is — used as the alt text and as the fallback caption. */
  placeholder: string;
  shape?: "rect" | "rounded" | "circle";
  radius?: number;
  style?: CSSProperties;
  /** Decorative only: the surrounding card already names the thing. */
  decorative?: boolean;
}

export function ImageSlot({
  src,
  placeholder,
  shape = "rect",
  radius,
  style,
  decorative = false,
}: ImageSlotProps) {
  const [failed, setFailed] = useState(false);

  const radiusCss =
    shape === "circle" ? "999px" : shape === "rounded" ? (radius ?? 10) + "px" : radius ? radius + "px" : "0";

  const box: CSSProperties = {
    display: "block",
    width: "100%",
    height: "100%",
    borderRadius: radiusCss,
    overflow: "hidden",
    background: "var(--surface-muted)",
    ...style,
  };

  if (!src || failed) {
    return (
      <span
        style={{ ...box, ...sx("display:flex;align-items:center;justify-content:center;padding:8px") }}
        role={decorative ? "presentation" : "img"}
        aria-label={decorative ? undefined : placeholder}
      >
        <span
          style={sx(
            "font-size:12px;font-weight:600;color:var(--text-muted);text-align:center;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical",
          )}
          aria-hidden="true"
        >
          {placeholder}
        </span>
      </span>
    );
  }

  return (
    <span style={box}>
      {/* Plain <img>: these are static local assets served straight from
          /public, and the optimiser buys nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={decorative ? "" : placeholder}
        onError={() => setFailed(true)}
        style={sx("display:block;width:100%;height:100%;object-fit:cover")}
      />
    </span>
  );
}
