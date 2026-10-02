import test from "node:test";
import assert from "node:assert/strict";
import {
  withImageVariantSuffix,
  stripImageVariantSuffix,
  bymyImageVariantUrl,
  isBymyManagedImageUrl,
  fullImageUrlFromVariant,
} from "./image-variants.mjs";
import { listFeedImageUrl } from "./listing-image.mjs";
import { sanitizeListingList, sanitizeListingTileItem } from "./listing-api-access.mjs";
import { generateSizedWebpVariants } from "./supabase/image-storage.mjs";
import sharp from "sharp";

test("variant path suffixes", () => {
  assert.equal(withImageVariantSuffix("listing-images/1/a.webp", "card"), "listing-images/1/a_card.webp");
  assert.equal(withImageVariantSuffix("listing-images/1/a.webp", "thumb"), "listing-images/1/a_thumb.webp");
  assert.equal(withImageVariantSuffix("listing-images/1/a_card.webp", "thumb"), "listing-images/1/a_thumb.webp");
  assert.equal(stripImageVariantSuffix("a_thumb.webp"), "a.webp");
  assert.equal(fullImageUrlFromVariant("https://img.bymy.hu/listing-images/1/a_card.webp"), "https://img.bymy.hu/listing-images/1/a.webp");
});

test("bymy managed URL detection + rewrite", () => {
  const full = "https://img.bymy.hu/listing-images/42/photo-abc.webp";
  assert.equal(isBymyManagedImageUrl(full), true);
  assert.equal(bymyImageVariantUrl(full, "card"), "https://img.bymy.hu/listing-images/42/photo-abc_card.webp");
  assert.equal(bymyImageVariantUrl(full, "thumb"), "https://img.bymy.hu/listing-images/42/photo-abc_thumb.webp");
  assert.equal(listFeedImageUrl(full, "card"), "https://img.bymy.hu/listing-images/42/photo-abc_card.webp");
  assert.equal(listFeedImageUrl(full, "thumb"), "https://img.bymy.hu/listing-images/42/photo-abc_thumb.webp");
});

test("HA feed still uses 640x480", () => {
  const hq = "https://img.hasznaltautocdn.com/2048x1536/23113337/26375069.jpg";
  assert.equal(
    listFeedImageUrl(hq, "card"),
    "https://img.hasznaltautocdn.com/640x480/23113337/26375069.jpg"
  );
  assert.equal(
    listFeedImageUrl(hq, "thumb"),
    "https://img.hasznaltautocdn.com/640x480/23113337/26375069.jpg"
  );
});

test("sanitizeListingList remaps bymy fo_kep to card", () => {
  const out = sanitizeListingList([
    {
      id: 9,
      fo_kep: "https://img.bymy.hu/listing-images/9/x.webp",
      preview: { imageUrl: "https://img.bymy.hu/listing-images/9/x.webp", imageUrls: [] },
    },
  ]);
  assert.equal(out[0].fo_kep, "https://img.bymy.hu/listing-images/9/x_card.webp");
  assert.equal(out[0].preview.imageUrl, "https://img.bymy.hu/listing-images/9/x_card.webp");
});

test("sanitizeListingTileItem uses thumb for bymy", () => {
  const out = sanitizeListingTileItem({
    id: 3,
    fo_kep: "https://img.bymy.hu/listing-images/3/y.webp",
    preview: { imageUrl: "https://img.bymy.hu/listing-images/3/y.webp" },
    form: { gyartmany: "BMW" },
  });
  assert.equal(out.fo_kep, "https://img.bymy.hu/listing-images/3/y_thumb.webp");
});

test("generateSizedWebpVariants produces three buffers", async () => {
  const source = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
  const sized = await generateSizedWebpVariants(source);
  assert.ok(sized.full.size > sized.card.size);
  assert.ok(sized.card.size > sized.thumb.size);
  assert.ok(sized.full.width <= 1600);
  assert.ok(sized.card.width <= 640);
  assert.ok(sized.thumb.width <= 240);
});
