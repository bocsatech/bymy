import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { randomBytes } from "crypto";
import {
  normalizeImageBucket,
  validateImageBuffer,
  generateOptimizedImageVariants,
  buildImageVariantPaths,
  sizeVariantBuffersFromGenerated,
} from "./supabase/image-storage.mjs";

/** Nyilvános URL útvonal prefix (nginx vagy Node szolgálja). */
export const IMAGE_MEDIA_URL_PREFIX = "/media/img";

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTION_NAME);
}

export { isFilesystemImageStorage } from "./image-storage-backend.mjs";

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

  const generated = await generateOptimizedImageVariants(fileBuffer, options);
  const sized = sizeVariantBuffersFromGenerated(generated);
  const relativePath = storageRelativePath(bucket, folder, fileName);
  const paths = buildImageVariantPaths(relativePath);
  const bucketName = normalizeImageBucket(bucket);

  for (const kind of ["full", "card", "thumb"]) {
    const absPath = join(imageStorageRoot(), paths[kind]);
    ensureDir(dirname(absPath));
    writeFileSync(absPath, sized[kind].buffer);
  }

  const variantUrls = {};
  for (const kind of ["full", "card", "thumb"]) {
    variantUrls[kind] = {
      path: paths[kind],
      publicUrl: publicUrlForStoragePath(paths[kind]),
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

export async function ensureFilesystemImageSizeVariants(relativePath) {
  const key = String(relativePath || "").replace(/^\/+/, "");
  if (!key) return { ok: false, reason: "empty-key" };
  const paths = buildImageVariantPaths(key);
  const fullAbs = join(imageStorageRoot(), paths.full);
  if (!existsSync(fullAbs)) return { ok: false, reason: "missing-full" };
  const cardAbs = join(imageStorageRoot(), paths.card);
  const thumbAbs = join(imageStorageRoot(), paths.thumb);
  const cardOk = existsSync(cardAbs);
  const thumbOk = existsSync(thumbAbs);
  if (cardOk && thumbOk) return { ok: true, skipped: true, paths };

  const fullBuf = readFileSync(fullAbs);
  const generated = await generateOptimizedImageVariants(fullBuf, {
    minWidth: 1,
    minHeight: 1,
    maxBytes: 20 * 1024 * 1024,
  });
  const sized = sizeVariantBuffersFromGenerated(generated);
  if (!cardOk) {
    ensureDir(dirname(cardAbs));
    writeFileSync(cardAbs, sized.card.buffer);
  }
  if (!thumbOk) {
    ensureDir(dirname(thumbAbs));
    writeFileSync(thumbAbs, sized.thumb.buffer);
  }
  return { ok: true, skipped: false, paths };
}

export function readFilesystemImageFile(absPath) {
  if (!absPath || !existsSync(absPath)) return null;
  return readFileSync(absPath);
}
