"use client";

import { sx } from "@/lib/sx";
import { toneOf } from "./shared";

/** A small status badge. One shape for every queue, so a state means the same
 *  thing wherever it appears. */
export function Pill({ label, t }: { label: string; t: string }) {
  const c = toneOf(t);
  return (
    <span
      style={sx(
        "display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:6px;font-size:12px;font-weight:700;background:" +
          c.bg + ";color:" + c.fg,
      )}
    >
      {label}
    </span>
  );
}
