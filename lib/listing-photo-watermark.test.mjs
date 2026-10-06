import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { applyCenteredBymyWatermark } from "./listing-photo-watermark.mjs";
import { generateSizedWebpVariants } from "./supabase/image-storage.mjs";

test("applyCenteredBymyWatermark keeps dimensions and changes pixels", async () => {
  const source = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 40, g: 40, b: 40 } },
  })
    .jpeg()
    .toBuffer();

  const out = await applyCenteredBymyWatermark(source);
  const meta = await sharp(out).metadata();
  assert.equal(meta.width, 800);
  assert.equal(meta.height, 600);
  assert.notEqual(out.equals(source), true);
});

test("generateSizedWebpVariants watermark option burns text into full variant", async () => {
  const source = await sharp({
    create: { width: 900, height: 700, channels: 3, background: { r: 20, g: 20, b: 20 } },
  })
    .png()
    .toBuffer();

  const plain = await generateSizedWebpVariants(source, { maxWidth: 900 });
  const marked = await generateSizedWebpVariants(source, { maxWidth: 900, watermark: true });
  assert.notEqual(plain.full.buffer.equals(marked.full.buffer), true);
});
