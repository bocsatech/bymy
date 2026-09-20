import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  normalizeImageBucket,
  validateImageBuffer,
  generateOptimizedImageVariants,
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

  const variants = await generateOptimizedImageVariants(fileBuffer, options);
  const objectKey = storageRelativePath(bucket, folder, fileName);
  const bucketName = r2BucketName();

  await getR2S3Client().send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: variants.webp,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return {
    bucket: normalizeImageBucket(bucket),
    path: objectKey,
    publicUrl: publicUrlForR2ObjectKey(objectKey),
    width: validated.width,
    height: validated.height,
    format: validated.format,
    size: validated.size,
  };
}
