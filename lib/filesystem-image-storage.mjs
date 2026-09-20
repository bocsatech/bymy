import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { randomBytes } from "crypto";
import {
  normalizeImageBucket,
  validateImageBuffer,
  generateOptimizedImageVariants,
} from "./supabase/image-storage.mjs";

/** Nyilvános URL útvonal prefix (nginx vagy Node szolgálja). */
export const IMAGE_MEDIA_URL_PREFIX = "/media/img";

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTION_NAME);
}

/**
 * Képtár mód: filesystem | supabase (BYMY_IMAGE_STORAGE).
 * Alapértelmezés: nem-Vercel → fájlrendszer (S1/S2); Vercel preview → supabase (ephemeral /tmp).
 */
export function isFilesystemImageStorage() {
  const mode = String(process.env.BYMY_IMAGE_STORAGE ?? "").trim().toLowerCase();
  if (mode === "supabase") return false;
  if (mode === "filesystem") return true;
  return !isServerlessRuntime();
}

export function imageStorageRoot() {
  const fromEnv =
    process.env.BYMY_IMAGE_ROOT ||
    process.env.BMYMY_IMAGE_ROOT ||
    process.env.AUTOSWEB_IMAGE_ROOT ||
    "";
  if (fromEnv.trim()) return fromEnv.trim().replace(/\/$/, "");
  if (isServerlessRuntime()) {
    return join(process.env.TMPDIR || "/tmp", "bymy-images");
  }
  return join(homedir(), ".bymy", "images");
}

export function imagePublicBaseUrl() {
  const raw = String(
    process.env.BYMY_IMAGE_PUBLIC_BASE ||
      process.env.PUBLIC_BASE_URL ||
      process.env.SITE_PUBLIC_URL ||
      ""
  ).trim();
  if (raw) return raw.replace(/\/$/, "");
  if (isServerlessRuntime()) return "";
  return "";
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/** Relatív tárolási útvonal: listing-images/42/photo-abc.webp */
export function storageRelativePath(bucket, folder, fileName) {
  const bucketName = normalizeImageBucket(bucket);
  const safeFolder = String(folder || "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9._/-]+/g, "-");
  const baseName = String(fileName || `image-${Date.now()}-${randomBytes(4).toString("hex")}`)
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(0, 80);
  const rel = safeFolder ? `${bucketName}/${safeFolder}/${baseName}.webp` : `${bucketName}/${baseName}.webp`;
  return rel.replace(/\/+/g, "/");
}

export function publicUrlForStoragePath(relativePath) {
  const rel = String(relativePath || "").replace(/^\/+/, "");
  const base = imagePublicBaseUrl();
  const path = `${IMAGE_MEDIA_URL_PREFIX}/${rel}`;
  if (base) return `${base}${path}`;
  return path;
}

export function resolveFilesystemImageMediaFile(urlPath) {
  const raw = String(urlPath || "").replace(/^\/+/, "");
  const prefix = IMAGE_MEDIA_URL_PREFIX.replace(/^\//, "");
  if (!raw.startsWith(`${prefix}/`)) return null;
  const rel = raw.slice(prefix.length + 1);
  if (!rel || rel.includes("..")) return null;
  const abs = join(imageStorageRoot(), rel);
  const root = imageStorageRoot();
  if (!abs.startsWith(root)) return null;
  return existsSync(abs) ? abs : null;
}

export async function uploadOptimizedImageToFilesystem({
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
  const relativePath = storageRelativePath(bucket, folder, fileName);
  const absPath = join(imageStorageRoot(), relativePath);
  ensureDir(dirname(absPath));
  writeFileSync(absPath, variants.webp);

  const bucketName = normalizeImageBucket(bucket);
  return {
    bucket: bucketName,
    path: relativePath,
    publicUrl: publicUrlForStoragePath(relativePath),
    width: validated.width,
    height: validated.height,
    format: validated.format,
    size: validated.size,
  };
}

export function readFilesystemImageFile(absPath) {
  if (!absPath || !existsSync(absPath)) return null;
  return readFileSync(absPath);
}
