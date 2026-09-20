import test from "node:test";
import assert from "node:assert/strict";
import {
  storageRelativePath,
  publicUrlForStoragePath,
  IMAGE_MEDIA_URL_PREFIX,
} from "./filesystem-image-storage.mjs";

test("storageRelativePath builds safe listing path", () => {
  const rel = storageRelativePath("listing", "42", "My Photo!.jpg");
  assert.match(rel, /^listing-images\/42\/.+\.webp$/);
});

test("publicUrlForStoragePath uses media prefix", () => {
  const prev = process.env.BYMY_IMAGE_PUBLIC_BASE;
  process.env.BYMY_IMAGE_PUBLIC_BASE = "https://bymy.hu";
  try {
    const url = publicUrlForStoragePath("listing-images/1/a.webp");
    assert.equal(url, `https://bymy.hu${IMAGE_MEDIA_URL_PREFIX}/listing-images/1/a.webp`);
  } finally {
    if (prev === undefined) delete process.env.BYMY_IMAGE_PUBLIC_BASE;
    else process.env.BYMY_IMAGE_PUBLIC_BASE = prev;
  }
});
