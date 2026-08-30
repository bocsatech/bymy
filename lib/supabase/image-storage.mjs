import sharp from 'sharp';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';

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

export async function generateOptimizedImageVariants(sourceBuffer, options = {}) {
  const maxWidth = Number(options.maxWidth ?? 1600);
  const jpegQuality = Number(options.jpegQuality ?? 82);
  const webpQuality = Number(options.webpQuality ?? 78);
  const avifQuality = Number(options.avifQuality ?? 68);

  const base = await sharp(sourceBuffer)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true, fit: 'inside' })
    .toBuffer();

  const [jpg, webp, avif] = await Promise.all([
    sharp(base).jpeg({ quality: jpegQuality, mozjpeg: true }).toBuffer(),
    sharp(base).webp({ quality: webpQuality, lossless: false }).toBuffer(),
    sharp(base).avif({ quality: avifQuality, effort: 5 }).toBuffer(),
  ]);

  return {
    original: sourceBuffer,
    resized: base,
    jpeg: jpg,
    webp,
    avif,
  };
}

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
  const uploadedClient = client || getSupabaseImageClient();
  const finalBucket = await ensureStorageBucket(bucket, uploadedClient);

  const validated = await validateImageBuffer(fileBuffer, options);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const variants = await generateOptimizedImageVariants(fileBuffer, options);
  const safeFolder = String(folder || '').replace(/^\/+|\/+$/g, '');
  const baseName = String(fileName || `image-${Date.now()}-${randomBytes(4).toString('hex')}`)
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 80);

  const finalFileName = `${safeFolder ? `${safeFolder}/` : ''}${baseName}.webp`;
  const { error: uploadError } = await uploadedClient.storage.from(finalBucket).upload(finalFileName, variants.webp, {
    contentType: 'image/webp',
    upsert: true,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = uploadedClient.storage.from(finalBucket).getPublicUrl(finalFileName);
  return {
    bucket: finalBucket,
    path: finalFileName,
    publicUrl: data?.publicUrl ?? null,
    width: validated.width,
    height: validated.height,
    format: validated.format,
    size: validated.size,
  };
}
