import { createHash, createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { recordMediaAsset } from "@/server/db";

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

function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

/** Minimal zero-dependency AWS SigV4 PUT to Cloudflare R2. */
async function uploadToR2(objectKey: string, body: Buffer, contentType: string): Promise<string> {
  const accountId = process.env.R2_ACCOUNT_ID || "29fe42720b1693ecc26d6619339d031f";
  const bucket = process.env.R2_BUCKET || "branchsound-assets";
  const accessKey = process.env.R2_ACCESS_KEY_ID || "";
  const secretKey = process.env.R2_SECRET_ACCESS_KEY || "";
  const publicBase = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${bucket}/${objectKey}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);

  const canonicalHeaders =
    `cache-control:public, max-age=31536000, immutable\n` +
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "cache-control;content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmac("AWS4" + secretKey, dateStamp);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${host}${canonicalUri}`, {
    method: "PUT",
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authHeader,
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    throw new Error(`R2 upload failed with HTTP ${res.status}`);
  }
  return publicBase ? `${publicBase}/${objectKey}` : `https://${host}${canonicalUri}`;
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

    if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
      url = await uploadToR2(r2Key, buf, mime);
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
