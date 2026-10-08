import sharp from 'sharp';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { rewritePublicStorageUrl } from './public-url.mjs';
import {
  IMAGE_SIZE_VARIANTS,
  normalizeImageSizeVariant,
  withImageVariantSuffix,
} from '../image-variants.mjs';

export const IMAGE_BUCKETS = {
  listing: 'listing-images',
  profile: 'profile-images',
  recommendation: 'recommendation-images',
  partner: 'partner-images',
};

export function normalizeImageBucket(bucketName) {
  const normalized = String(bucketName ?? '').trim().toLowerCase();
  if (normalized === 'profile' || normalized === 'profiles') return IMAGE_BUCKETS.profile;
  if (normalized === 'recommendation' || normalized === 'recommendations') return IMAGE_BUCKETS.recommendation;
  if (normalized === 'partner' || normalized === 'partners') return IMAGE_BUCKETS.partner;
  return IMAGE_BUCKETS.listing;
}

async function readImageMetadata(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      format: metadata.format ?? null,
      size: buffer.length,
    };
  } catch {
    return { width: 0, height: 0, format: null, size: buffer.length };
  }
}

export async function validateImageBuffer(buffer, options = {}) {
  const maxBytes = Number(options.maxBytes ?? 10 * 1024 * 1024);
  const minWidth = Number(options.minWidth ?? 640);
  const minHeight = Number(options.minHeight ?? 480);
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, error: 'Invalid image payload.' };
  }
  if (buffer.length > maxBytes) {
    return { ok: false, error: `Image exceeds the maximum size of ${maxBytes} bytes.` };
  }

  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return { ok: false, error: 'Unsupported or invalid image file.' };
  }

  if (!metadata.width || !metadata.height) {
    return { ok: false, error: 'The uploaded image could not be read.' };
  }

  if (metadata.width < minWidth || metadata.height < minHeight) {
    return {
      ok: false,
      error: `Image is too small. Minimum size is ${minWidth}x${minHeight}px.`,
    };
  }

  const format = String(metadata.format ?? '').toLowerCase();
  if (!['jpeg', 'png', 'webp', 'avif'].includes(format)) {
    return { ok: false, error: 'Only JPEG, PNG, WebP, and AVIF images are supported.' };
  }

  return {
    ok: true,
    width: metadata.width,
    height: metadata.height,
    format,
    size: buffer.length,
  };
}

/**
 * Thumb / card / full WebP méretek egy forrásból (feltöltés + backfill).
 * @returns {{ full: SizeBuf, card: SizeBuf, thumb: SizeBuf }}
 */
export async function generateSizedWebpVariants(sourceBuffer, options = {}) {
  let rotated = await sharp(sourceBuffer).rotate().toBuffer();
  if (options.watermark) {
    const { applyCenteredBymyWatermark } = await import('../listing-photo-watermark.mjs');
    rotated = await applyCenteredBymyWatermark(rotated);
  }
  const kinds = ['full', 'card', 'thumb'];
  const entries = await Promise.all(
    kinds.map(async (kind) => {
      const spec = IMAGE_SIZE_VARIANTS[kind];
      const maxWidth = Number(
        options[`${kind}MaxWidth`] ??
          (kind === 'full' ? options.maxWidth : undefined) ??
          spec.maxWidth
      );
      const webpQuality = Number(
        options[`${kind}WebpQuality`] ?? options.webpQuality ?? spec.webpQuality
      );
      const buffer = await sharp(rotated)
        .resize({ width: maxWidth, withoutEnlargement: true, fit: 'inside' })
        .webp({ quality: webpQuality, lossless: false })
        .toBuffer();
      const meta = await sharp(buffer).metadata();
      return [
        kind,
        {
          buffer,
          width: meta.width ?? 0,
          height: meta.height ?? 0,
          size: buffer.length,
        },
      ];
    })
  );
  return Object.fromEntries(entries);
}

export async function generateOptimizedImageVariants(sourceBuffer, options = {}) {
  const maxWidth = Number(options.maxWidth ?? 1600);
  const jpegQuality = Number(options.jpegQuality ?? 82);
  const webpQuality = Number(options.webpQuality ?? 78);
  const avifQuality = Number(options.avifQuality ?? 68);

  const sized = await generateSizedWebpVariants(sourceBuffer, {
    ...options,
    maxWidth,
    webpQuality,
  });
  const base = sized.full.buffer;

  const [jpg, avif] = await Promise.all([
    sharp(base).jpeg({ quality: jpegQuality, mozjpeg: true }).toBuffer(),
    sharp(base).avif({ quality: avifQuality, effort: 5 }).toBuffer(),
  ]);

  return {
    original: sourceBuffer,
    resized: base,
    jpeg: jpg,
    webp: sized.full.buffer,
    avif,
    sized,
  };
}

export function buildImageVariantPaths(basePath) {
  const full = String(basePath || '').replace(/^\/+/, '');
  return {
    full,
    card: withImageVariantSuffix(full, 'card'),
    thumb: withImageVariantSuffix(full, 'thumb'),
  };
}

export function sizeVariantBuffersFromGenerated(variants) {
  if (variants?.sized?.full?.buffer) {
    return {
      full: variants.sized.full,
      card: variants.sized.card,
      thumb: variants.sized.thumb,
    };
  }
  // Legacy: csak egy webp — card/thumb is ugyanaz (backfill pótolja)
  const webp = variants?.webp;
  if (!webp) return null;
  const one = { buffer: webp, width: 0, height: 0, size: webp.length };
  return { full: one, card: one, thumb: one };
}

export { normalizeImageSizeVariant, withImageVariantSuffix, IMAGE_SIZE_VARIANTS };

export function dataUrlToBuffer(dataUrl) {
  const value = String(dataUrl ?? '').trim();
  if (!value || !value.startsWith('data:')) return null;
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/i);
  if (!match) return null;
  try {
    return Buffer.from(match[2], 'base64');
  } catch {
    return null;
  }
}

export async function saveImageAssetMetadata({
  client = getSupabaseImageClient(),
  bucket,
  path,
  publicUrl,
  entityType,
  entityId,
  uploadedByUserId,
  originalName,
  contentType,
  width,
  height,
  fileSize,
  processingStatus = 'ready',
} = {}) {
  if (!bucket || !path) {
    throw new Error('Image asset requires bucket and storage path.');
  }

  const table = 'image_assets';
  const payload = {
    bucket: normalizeImageBucket(bucket),
    path,
    public_url: publicUrl ?? null,
    entity_type: String(entityType || 'listing').trim() || 'listing',
    entity_id: entityId != null && entityId !== '' ? Number(entityId) : null,
    uploaded_by: uploadedByUserId != null && uploadedByUserId !== '' ? Number(uploadedByUserId) : null,
    original_name: originalName ? String(originalName).slice(0, 255) : null,
    content_type: contentType ?? 'image/webp',
    width: width != null ? Number(width) : null,
    height: height != null ? Number(height) : null,
    aspect_ratio: width && height ? Number((width / height).toFixed(4)) : null,
    file_size: fileSize != null ? Number(fileSize) : null,
    processing_status: processingStatus,
  };

  const { error, data } = await client.from(table).insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export function getSupabaseImageClient({ url, serviceRoleKey } = {}) {
  const finalUrl = String(url || process.env.SUPABASE_URL || '').trim();
  const finalKey = String(serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!finalUrl || !finalKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
  }
  return createClient(finalUrl, finalKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function ensureStorageBucket(bucketName, client = getSupabaseImageClient()) {
  const normalizedBucket = normalizeImageBucket(bucketName);
  const { data: existingBuckets = [] } = await client.storage.listBuckets();
  if (existingBuckets.some((bucket) => bucket.name === normalizedBucket)) {
    return normalizedBucket;
  }

  const { error } = await client.storage.createBucket(normalizedBucket, {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    fileSizeLimit: 20 * 1024 * 1024,
  });

  if (error && !/already exists|duplicate/i.test(error.message ?? '')) {
    throw error;
  }

  return normalizedBucket;
}

export async function uploadOptimizedImage({
  fileBuffer,
  bucket,
  folder,
  fileName,
  client,
  options = {},
}) {
  const bucketName = normalizeImageBucket(bucket);
  const uploadOptions = {
    ...options,
    watermark: options.watermark ?? bucketName === IMAGE_BUCKETS.listing,
  };

  const { isR2ImageStorage } = await import("../image-storage-backend.mjs");
  if (isR2ImageStorage()) {
    const { uploadOptimizedImageToR2 } = await import("../r2-image-storage.mjs");
    return uploadOptimizedImageToR2({
      fileBuffer,
      bucket,
      folder,
      fileName,
      options: uploadOptions,
    });
  }

  const { isFilesystemImageStorage } = await import("../image-storage-backend.mjs");
  if (isFilesystemImageStorage()) {
    const { uploadOptimizedImageToFilesystem } = await import("../filesystem-image-storage.mjs");
    return uploadOptimizedImageToFilesystem({
      fileBuffer,
      bucket,
      folder,
      fileName,
      options: uploadOptions,
    });
  }

  const uploadedClient = client || getSupabaseImageClient();
  const finalBucket = await ensureStorageBucket(bucket, uploadedClient);

  const validated = await validateImageBuffer(fileBuffer, uploadOptions);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  /* Csak a feltöltött WebP méretek — AVIF/JPEG generálás nem kell és lassú. */
  const sized = await generateSizedWebpVariants(fileBuffer, uploadOptions);
  const safeFolder = String(folder || '').replace(/^\/+|\/+$/g, '');
  const baseName = String(fileName || `image-${Date.now()}-${randomBytes(4).toString('hex')}`)
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 80);

  const finalFileName = `${safeFolder ? `${safeFolder}/` : ''}${baseName}.webp`;
  const paths = buildImageVariantPaths(finalFileName);

  await Promise.all(
    ['full', 'card', 'thumb'].map(async (kind) => {
      const body = sized[kind].buffer;
      const { error: uploadError } = await uploadedClient.storage.from(finalBucket).upload(paths[kind], body, {
        contentType: 'image/webp',
        upsert: true,
        cacheControl: '31536000',
      });
      if (uploadError) throw uploadError;
    })
  );

  const { data } = uploadedClient.storage.from(finalBucket).getPublicUrl(paths.full);
  const publicFull = rewritePublicStorageUrl(data?.publicUrl ?? null);
  const variantUrls = {};
  for (const kind of ['full', 'card', 'thumb']) {
    const { data: d } = uploadedClient.storage.from(finalBucket).getPublicUrl(paths[kind]);
    variantUrls[kind] = {
      path: paths[kind],
      publicUrl: rewritePublicStorageUrl(d?.publicUrl ?? null),
      width: sized[kind].width,
      height: sized[kind].height,
      size: sized[kind].size,
    };
  }

  return {
    bucket: finalBucket,
    path: paths.full,
    publicUrl: publicFull,
    width: sized.full.width || validated.width,
    height: sized.full.height || validated.height,
    format: 'webp',
    size: sized.full.size,
    variants: variantUrls,
  };
}
