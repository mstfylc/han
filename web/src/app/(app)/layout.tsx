"use client";

import { Suspense } from "react";
import type { ReactNode } from "react";

import { Shell } from "@/components/Shell";

/**
 * Every buyer screen sits inside the shell.
 *
 * The Suspense boundary is required because the shell reads `useSearchParams`
 * — a shared link's ?l=ar has to be honoured before the header renders.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
