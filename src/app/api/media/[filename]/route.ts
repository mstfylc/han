// HAN 2.0 — Cloudflare R2 Edge CDN Media Delivery Route (/api/media/<slug>-<hash12>.<ext>).
// Serves immutable images with standard file extensions so Cloudflare Edge caches them (cf-cache-status: HIT).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { getR2Object } from "@/server/r2";

export const dynamic = "force-dynamic";

const SAFE_NAME = /^[a-z0-9][a-z0-9._-]{1,96}\.(jpg|jpeg|png|webp)$/i;
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  if (!filename || !SAFE_NAME.test(filename) || filename.includes("..")) {
    return NextResponse.json({ ok: false, error: "invalid_filename" }, { status: 400 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const fallbackMime = EXT_TO_MIME[ext] || "application/octet-stream";

  // 1. Primary durable source: Cloudflare R2 (branchsound-assets / han-media/<filename>)
  try {
    const obj = await getR2Object(`han-media/${filename}`);
    if (obj) {
      const headers = new Headers({
        "Content-Type": obj.contentType || fallbackMime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "CDN-Cache-Control": "public, max-age=31536000, immutable",
        "X-Media-Source": "cloudflare-r2",
      });
      if (obj.etag) headers.set("ETag", obj.etag);
      return new NextResponse(obj.body, { status: 200, headers });
    }
  } catch {
    // Fall through to local disk fallback if R2 is unreachable
  }

  // 2. Local disk fallback (for pre-R2 uploads)
  try {
    const filePath = path.join(process.cwd(), "public", "uploads", filename);
    const data = await readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": fallbackMime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "CDN-Cache-Control": "public, max-age=31536000, immutable",
        "X-Media-Source": "local",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
}
