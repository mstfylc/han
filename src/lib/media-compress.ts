"use client";

// HAN 2.0 — Client-Side Image Compression (<canvas>) before R2 / AI Lens Upload.
// Reduces 6-8 MB mobile camera JPEGs down to ~180 KB (uploads) or ~55 KB (AI lens)
// directly in the browser for fast, reliable field usage inside historic stone hans.

export interface CompressOptions {
  maxEdge?: number;
  quality?: number;
  preferWebp?: boolean;
}

export async function compressImageFile(file: File, opts: CompressOptions = {}): Promise<File> {
  if (typeof window === "undefined" || typeof document === "undefined") return file;
  if (!file || !file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.82;
  const preferWebp = opts.preferWebp ?? true;

  // Skip already tiny images (< 120 KB) when doing normal uploads
  if (maxEdge >= 1400 && file.size <= 120 * 1024) return file;

  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image_decode_failed"));
      el.src = objectUrl!;
    });

    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return file;

    const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, dstW, dstH);

    const outMime = preferWebp ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (b) => {
          if (b && b.size > 0) return resolve(b);
          canvas.toBlob((fallbackBlob) => resolve(fallbackBlob), "image/jpeg", quality);
        },
        outMime,
        quality,
      );
    });

    if (!blob || blob.size >= file.size) return file;

    const ext = blob.type === "image/webp" ? ".webp" : ".jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "han-photo";
    return new File([blob], baseName + ext, {
      type: blob.type || "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/** Aggressive compression for AI Vision / Visual Search (640px max edge, ~40-70 KB). */
export function compressForAiLens(file: File): Promise<File> {
  return compressImageFile(file, { maxEdge: 640, quality: 0.78, preferWebp: false });
}
