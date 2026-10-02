import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import {
  normalizeImageBucket,
  validateImageBuffer,
  generateOptimizedImageVariants,
  buildImageVariantPaths,
  sizeVariantBuffersFromGenerated,
} from "./supabase/image-storage.mjs";
import { storageRelativePath } from "./filesystem-image-storage.mjs";
import { isR2Configured } from "./image-storage-backend.mjs";

export function r2AccountId() {
  return String(process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
}

export function r2BucketName() {
  return String(process.env.R2_BUCKET_NAME || process.env.BYMY_R2_BUCKET || "bymy-listings").trim();
}

export function r2PublicBaseUrl() {
  const raw = String(
    process.env.R2_PUBLIC_BASE_URL ||
      process.env.BYMY_IMAGE_PUBLIC_BASE ||
      "https://img.bymy.hu"
  ).trim();
  return raw.replace(/\/$/, "");
}

export function publicUrlForR2ObjectKey(objectKey) {
  const key = String(objectKey || "").replace(/^\/+/, "");
  return `${r2PublicBaseUrl()}/${key}`;
}

let s3Client = null;

export function getR2S3Client() {
  if (!isR2Configured()) {
    throw new Error("R2 nincs konfigurálva (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).");
  }
  if (!s3Client) {
    const accountId = r2AccountId();
    s3Client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_S3_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
      },
    });
  }
  return s3Client;
}

async function putR2Webp(objectKey, body) {
  await getR2S3Client().send(
    new PutObjectCommand({
      Bucket: r2BucketName(),
      Key: objectKey,
      Body: body,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}

export async function r2ObjectExists(objectKey) {
  try {
    await getR2S3Client().send(
      new HeadObjectCommand({
        Bucket: r2BucketName(),
        Key: String(objectKey || "").replace(/^\/+/, ""),
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function getR2ObjectBuffer(objectKey) {
  const res = await getR2S3Client().send(
    new GetObjectCommand({
      Bucket: r2BucketName(),
      Key: String(objectKey || "").replace(/^\/+/, ""),
    })
  );
  const chunks = [];
  for await (const chunk of res.Body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function buildUploadResult({ bucketName, paths, sized, validated }) {
  const variantUrls = {};
  for (const kind of ["full", "card", "thumb"]) {
    variantUrls[kind] = {
      path: paths[kind],
      publicUrl: publicUrlForR2ObjectKey(paths[kind]),
      width: sized[kind].width,
      height: sized[kind].height,
      size: sized[kind].size,
    };
  }
  return {
    bucket: bucketName,
    path: paths.full,
    publicUrl: variantUrls.full.publicUrl,
    width: sized.full.width || validated.width,
    height: sized.full.height || validated.height,
    format: "webp",
    size: sized.full.size,
    variants: variantUrls,
  };
}

export async function uploadOptimizedImageToR2({
  fileBuffer,
  bucket,
  folder,
  fileName,
  options = {},
}) {
  const validated = await validateImageBuffer(fileBuffer, options);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const generated = await generateOptimizedImageVariants(fileBuffer, options);
  const sized = sizeVariantBuffersFromGenerated(generated);
  const objectKey = storageRelativePath(bucket, folder, fileName);
  const paths = buildImageVariantPaths(objectKey);
  const bucketName = normalizeImageBucket(bucket);

  await Promise.all([
    putR2Webp(paths.full, sized.full.buffer),
    putR2Webp(paths.card, sized.card.buffer),
    putR2Webp(paths.thumb, sized.thumb.buffer),
  ]);

  return buildUploadResult({ bucketName, paths, sized, validated });
}

/** Meglévő full objektumból card+thumb (ha hiányzik). */
export async function ensureR2ImageSizeVariants(fullObjectKey) {
  const key = String(fullObjectKey || "").replace(/^\/+/, "");
  if (!key) return { ok: false, reason: "empty-key" };
  const paths = buildImageVariantPaths(key);
  const [cardOk, thumbOk] = await Promise.all([
    r2ObjectExists(paths.card),
    r2ObjectExists(paths.thumb),
  ]);
  if (cardOk && thumbOk) return { ok: true, skipped: true, paths };

  const fullBuf = await getR2ObjectBuffer(paths.full);
  const generated = await generateOptimizedImageVariants(fullBuf, {
    minWidth: 1,
    minHeight: 1,
    maxBytes: 20 * 1024 * 1024,
  });
  const sized = sizeVariantBuffersFromGenerated(generated);
  const writes = [];
  if (!cardOk) writes.push(putR2Webp(paths.card, sized.card.buffer));
  if (!thumbOk) writes.push(putR2Webp(paths.thumb, sized.thumb.buffer));
  await Promise.all(writes);
  return { ok: true, skipped: false, paths };
}
