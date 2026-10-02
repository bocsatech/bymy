#!/usr/bin/env node
/**
 * Meglévő listing képekhez card + thumb WebP generálás (full megmarad).
 *
 * Használat:
 *   node scripts/backfill-image-size-variants.mjs [limit]
 *
 * R2 vagy filesystem backend. HA CDN URL-eket kihagyja (ott a CDN méretezi).
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv(join(root, ".env"));
loadEnv(join(root, ".env.local"));

const { listListings } = await import("../lib/db.mjs");
const { isBymyManagedImageUrl, stripImageVariantSuffix } = await import("../lib/image-variants.mjs");
const { getImageStorageBackend } = await import("../lib/image-storage-backend.mjs");
const { IMAGE_MEDIA_URL_PREFIX } = await import("../lib/filesystem-image-storage.mjs");
const { r2PublicBaseUrl } = await import("../lib/r2-image-storage.mjs");

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

  const targets = [];
  const seen = new Set();

  // 1) Listing fo_kep (bymy-kezelt URL-ek)
  try {
    const all = listListings({ limit: 2000, status: "feladott" });
    const rows = Array.isArray(all) ? all : await all;
    for (const row of rows || []) {
      const fo = String(row.fo_kep || "").trim();
      if (!fo || !isBymyManagedImageUrl(fo)) continue;
      const key = objectKeyFromPublicUrl(fo);
      if (!key || seen.has(key)) continue;
      // /uploads/listings → nem R2 kulcs; R2 scan kezeli a valódi objecteket
      if (key.startsWith("uploads/")) continue;
      seen.add(key);
      targets.push(fo.startsWith("http") || fo.startsWith("/") ? fo : key);
      if (targets.length >= limit) break;
    }
  } catch (error) {
    console.warn("listing fo_kep scan:", error.message ?? error);
  }

  // 2) R2 bucket scan: listing-images/**/*.webp full (nem _card/_thumb)
  if (backend === "r2" && targets.length < limit) {
    try {
      const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
      const { getR2S3Client, r2BucketName, publicUrlForR2ObjectKey } = await import(
        "../lib/r2-image-storage.mjs"
      );
      let token;
      do {
        const page = await getR2S3Client().send(
          new ListObjectsV2Command({
            Bucket: r2BucketName(),
            Prefix: "listing-images/",
            ContinuationToken: token,
            MaxKeys: 500,
          })
        );
        for (const obj of page.Contents || []) {
          const key = String(obj.Key || "");
          if (!/\.webp$/i.test(key) || /_(card|thumb)\.webp$/i.test(key)) continue;
          if (seen.has(key)) continue;
          seen.add(key);
          targets.push(publicUrlForR2ObjectKey(key));
          if (targets.length >= limit) break;
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token && targets.length < limit);
    } catch (error) {
      console.warn("R2 scan:", error.message ?? error);
    }
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
