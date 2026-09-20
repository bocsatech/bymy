import test from "node:test";
import assert from "node:assert/strict";
import { publicUrlForR2ObjectKey } from "./r2-image-storage.mjs";
import { getImageStorageBackend } from "./image-storage-backend.mjs";

test("publicUrlForR2ObjectKey builds img.bymy.hu URL", () => {
  const prev = process.env.R2_PUBLIC_BASE_URL;
  process.env.R2_PUBLIC_BASE_URL = "https://img.bymy.hu";
  try {
    assert.equal(
      publicUrlForR2ObjectKey("listing-images/42/photo-abc.webp"),
      "https://img.bymy.hu/listing-images/42/photo-abc.webp"
    );
  } finally {
    if (prev === undefined) delete process.env.R2_PUBLIC_BASE_URL;
    else process.env.R2_PUBLIC_BASE_URL = prev;
  }
});

test("getImageStorageBackend prefers r2 when configured", () => {
  const env = {
    BYMY_IMAGE_STORAGE: process.env.BYMY_IMAGE_STORAGE,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  };
  process.env.BYMY_IMAGE_STORAGE = "";
  process.env.R2_ACCOUNT_ID = "acc";
  process.env.R2_ACCESS_KEY_ID = "key";
  process.env.R2_SECRET_ACCESS_KEY = "secret";
  try {
    assert.equal(getImageStorageBackend(), "r2");
  } finally {
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
