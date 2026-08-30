import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  IMAGE_BUCKETS,
  normalizeImageBucket,
  validateImageBuffer,
  generateOptimizedImageVariants,
} from './image-storage.mjs';

test('normalizeImageBucket resolves the configured bucket names', () => {
  assert.equal(normalizeImageBucket('listing'), IMAGE_BUCKETS.listing);
  assert.equal(normalizeImageBucket('PROFILE'), IMAGE_BUCKETS.profile);
  assert.equal(normalizeImageBucket('unknown'), IMAGE_BUCKETS.listing);
});

test('validateImageBuffer accepts valid JPEG payloads and rejects tiny files', async () => {
  const buffer = await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 255, g: 128, b: 0 } } })
    .jpeg({ quality: 85 })
    .toBuffer();

  const valid = await validateImageBuffer(buffer, { minWidth: 200, minHeight: 200, maxBytes: 20 * 1024 * 1024 });
  assert.equal(valid.ok, true);

  const invalid = await validateImageBuffer(Buffer.from('tiny'), { minWidth: 200, minHeight: 200, maxBytes: 10 * 1024 * 1024 });
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /valid image|too small|supported/i);
});

test('generateOptimizedImageVariants creates webp/avif variants', async () => {
  const source = await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 0, g: 120, b: 200 } } })
    .png()
    .toBuffer();

  const variants = await generateOptimizedImageVariants(source, {
    maxWidth: 800,
    jpegQuality: 80,
    webpQuality: 75,
    avifQuality: 60,
  });

  assert.ok(variants.webp.length > 0);
  assert.ok(variants.avif.length > 0);
});
