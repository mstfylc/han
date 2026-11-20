import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { recordMediaAsset } from "@/server/db";
import { getR2Config, putR2Object, sha256Hex } from "@/server/r2";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function slugify(raw: string): string {
  const trMap: Record<string, string> = {
    ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i", ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
  };
  return (raw || "han-media")
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => trMap[c] || c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "han-media";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const rawSlug = String(form.get("slug") || form.get("recordId") || "dukkan");
    const recordId = form.get("recordId") ? String(form.get("recordId")) : null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Görsel dosyası gerekli (file)." }, { status: 400 });
    }
    const mime = String(file.type || "").toLowerCase();
    const ext = MIME_TO_EXT[mime];
    if (!ext) {
      return NextResponse.json(
        { ok: false, error: "Yalnızca JPEG, PNG veya WebP görsel yüklenebilir." },
        { status: 415 },
      );
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Dosya boyutu 0 ile 5 MB arasında olmalıdır." },
        { status: 413 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const hash12 = sha256Hex(buf).slice(0, 12);
    const slug = slugify(rawSlug);
    const filename = `${slug}-${hash12}.${ext}`;
    const r2Key = `han-media/${filename}`;

    let url = "";
    let storage: "r2" | "local" = "local";

    if (getR2Config()) {
      url = await putR2Object(r2Key, buf, mime);
      storage = "r2";
    } else {
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), buf);
      url = `/uploads/${filename}`;
      storage = "local";
    }

    await recordMediaAsset({
      hash: hash12,
      recordId,
      slug,
      url,
      mime,
      bytes: buf.length,
      storage,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      url,
      filename,
      hash: hash12,
      bytes: buf.length,
      storage,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message || e) }, { status: 500 });
  }
}
