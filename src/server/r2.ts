// HAN 2.0 — Zero-dependency AWS SigV4 client for Cloudflare R2 (PUT & GET).
// Bucket: branchsound-assets · Prefix: han-media/

import { createHash, createHmac } from "node:crypto";

export interface R2Config {
  accountId: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  publicBase: string;
  host: string;
}

export function getR2Config(): R2Config | null {
  const accessKey = (process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
  if (!accessKey || !secretKey) return null;
  const accountId = (process.env.R2_ACCOUNT_ID || "29fe42720b1693ecc26d6619339d031f").trim();
  const bucket = (process.env.R2_BUCKET || "branchsound-assets").trim();
  const publicBase = (process.env.R2_PUBLIC_URL || "").trim().replace(/\/+$/, "");
  return {
    accountId,
    bucket,
    accessKey,
    secretKey,
    publicBase,
    host: `${accountId}.r2.cloudflarestorage.com`,
  };
}

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function signR2Request(opts: {
  cfg: R2Config;
  method: "GET" | "PUT";
  objectKey: string;
  payloadHash: string;
  extraHeaders?: Record<string, string>;
}): { url: string; headers: Record<string, string> } {
  const canonicalUri = `/${opts.cfg.bucket}/${opts.objectKey}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const lowerHeaders: Record<string, string> = {
    host: opts.cfg.host,
    "x-amz-content-sha256": opts.payloadHash,
    "x-amz-date": amzDate,
  };
  if (opts.extraHeaders) {
    for (const [k, v] of Object.entries(opts.extraHeaders)) {
      lowerHeaders[k.toLowerCase()] = v;
    }
  }

  const sortedKeys = Object.keys(lowerHeaders).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${lowerHeaders[k]}\n`).join("");
  const signedHeaders = sortedKeys.join(";");
  const canonicalRequest = [
    opts.method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    opts.payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac("AWS4" + opts.cfg.secretKey, dateStamp);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const headers: Record<string, string> = {
    ...(opts.extraHeaders || {}),
    "x-amz-content-sha256": opts.payloadHash,
    "x-amz-date": amzDate,
    Authorization: `AWS4-HMAC-SHA256 Credential=${opts.cfg.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };

  return { url: `https://${opts.cfg.host}${canonicalUri}`, headers };
}

export async function putR2Object(objectKey: string, body: Buffer, contentType: string): Promise<string> {
  const cfg = getR2Config();
  if (!cfg) throw new Error("R2 not configured");

  const payloadHash = sha256Hex(body);
  const { url, headers } = signR2Request({
    cfg,
    method: "PUT",
    objectKey,
    payloadHash,
    extraHeaders: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": contentType,
    },
  });

  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    throw new Error(`R2 upload failed with HTTP ${res.status}`);
  }

  // If an explicit public base URL is provided (e.g. https://han.mansis.com.tr/api/media),
  // return it cleanly; otherwise default to our Cloudflare-proxied /api/media/<filename> edge URL.
  const filename = objectKey.split("/").pop() || objectKey;
  if (cfg.publicBase) {
    if (cfg.publicBase.endsWith("/api/media")) return `${cfg.publicBase}/${filename}`;
    return `${cfg.publicBase}/${objectKey}`;
  }
  return `/api/media/${filename}`;
}

export async function getR2Object(objectKey: string): Promise<{ body: ArrayBuffer; contentType: string; etag?: string } | null> {
  const cfg = getR2Config();
  if (!cfg) return null;

  const emptyHash = sha256Hex("");
  const { url, headers } = signR2Request({
    cfg,
    method: "GET",
    objectKey,
    payloadHash: emptyHash,
  });

  const res = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (res.status === 404 || !res.ok) return null;

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const etag = res.headers.get("etag") || undefined;
  const body = await res.arrayBuffer();
  return { body, contentType, etag };
}
