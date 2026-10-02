#!/usr/bin/env node
/**
 * Meglévő listing képekhez card + thumb WebP generálás (full megmarad).
 *
 * Használat:
 *   node scripts/backfill-image-size-variants.mjs [limit]
 *
 * R2 vagy filesystem backend. HA CDN URL-eket kihagyja (ott a CDN méretezi).
 */

import { listListings } from "../lib/db.mjs";
import { isBymyManagedImageUrl, stripImageVariantSuffix } from "../lib/image-variants.mjs";
import { getImageStorageBackend } from "../lib/image-storage-backend.mjs";
import { IMAGE_MEDIA_URL_PREFIX } from "../lib/filesystem-image-storage.mjs";
import { r2PublicBaseUrl } from "../lib/r2-image-storage.mjs";

function objectKeyFromPublicUrl(url) {
  const raw = stripImageVariantSuffix(String(url || "").trim());
  if (!raw) return "";
  if (raw.startsWith(`${IMAGE_MEDIA_URL_PREFIX}/`)) {
    return raw.slice(IMAGE_MEDIA_URL_PREFIX.length + 1);
  }
  try {
    const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    const base = r2PublicBaseUrl().replace(/\/$/, "");
    if (base && raw.startsWith(`${base}/`)) {
      return raw.slice(base.length + 1);
    }
    const path = u.pathname.replace(/^\/+/, "");
    if (/^listing-images\//i.test(path)) return path;
    if (/^media\/img\//i.test(path)) return path.slice("media/img/".length);
  } catch {
    /* ignore */
  }
  return "";
}

async function ensureOne(url) {
  const key = objectKeyFromPublicUrl(url);
  if (!key) return { ok: false, reason: "no-key", url };
  const backend = getImageStorageBackend();
  if (backend === "r2") {
    const { ensureR2ImageSizeVariants } = await import("../lib/r2-image-storage.mjs");
    return { ...(await ensureR2ImageSizeVariants(key)), key };
  }
  if (backend === "filesystem") {
    const { ensureFilesystemImageSizeVariants } = await import("../lib/filesystem-image-storage.mjs");
    return { ...(await ensureFilesystemImageSizeVariants(key)), key };
  }
  return { ok: false, reason: `backend-${backend}-skip`, key };
}

async function main() {
  const limit = Math.min(Math.max(Number(process.argv[2]) || 200, 1), 2000);
  const backend = getImageStorageBackend();
  console.log(`Backend: ${backend}`);

  const all = listListings({ limit: 2000, status: "feladott" });
  const targets = [];
  const seen = new Set();
  for (const row of all) {
    const fo = String(row.fo_kep || "").trim();
    if (!fo || !isBymyManagedImageUrl(fo)) continue;
    const key = objectKeyFromPublicUrl(fo);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    targets.push(fo);
    if (targets.length >= limit) break;
  }

  if (!targets.length) {
    console.log("Nincs bymy-kezelt listing kép a backfillhez.");
    return;
  }

  console.log(`${targets.length} kép feldolgozása…`);
  let ok = 0;
  let skipped = 0;
  let fail = 0;

  for (let i = 0; i < targets.length; i += 1) {
    const url = targets[i];
    try {
      const result = await ensureOne(url);
      if (result.skipped) {
        skipped += 1;
        console.log(`[${i + 1}/${targets.length}] skip ${result.key}`);
      } else if (result.ok) {
        ok += 1;
        console.log(`[${i + 1}/${targets.length}] ok   ${result.key}`);
      } else {
        fail += 1;
        console.log(`[${i + 1}/${targets.length}] fail ${result.reason || "?"} ${result.key || url}`);
      }
    } catch (error) {
      fail += 1;
      console.log(`[${i + 1}/${targets.length}] err  ${error.message ?? error}`);
    }
  }

  console.log(`\nKész: ${ok} generálva, ${skipped} már megvolt, ${fail} hiba.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
