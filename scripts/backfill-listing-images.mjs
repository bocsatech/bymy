#!/usr/bin/env node
/** Hiányzó főoldal-képek letöltése meglévő hirdetésekhez (hasznaltauto forrás URL alapján). */

import { listListings, updateListingFoKep } from "../lib/db.mjs";
import {
  extractMainImageUrl,
  downloadMainImage,
  listingImageFileExists,
} from "../lib/listing-image.mjs";
import { acquireImportSession } from "../lib/browser-session.mjs";
import { prepareListingPage } from "../lib/page-extract.mjs";

function listingKey(listing) {
  return (
    listing.hasznaltauto_hirdetes_id ||
    String(listing.forras_url || "").match(/-(\d{5,})(?:[/?#]|$)/)?.[1] ||
    String(listing.id)
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfillOne(page, listing, onProgress) {
  const url = listing.forras_url;
  if (!url) return { ok: false, reason: "nincs forras_url" };

  if (listingImageFileExists(listing.fo_kep)) {
    return { ok: true, skipped: true, path: listing.fo_kep };
  }

  onProgress?.(`#${listing.id}: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(1500);
  await prepareListingPage(page);

  const imageUrl = await extractMainImageUrl(page);
  if (!imageUrl) return { ok: false, reason: "nincs kép URL" };

  const key = listingKey(listing);
  const foKep = await downloadMainImage(page, imageUrl, key);
  if (!foKep) return { ok: false, reason: "letöltés sikertelen" };

  updateListingFoKep(listing.id, foKep);
  return { ok: true, path: foKep };
}

async function main() {
  const limit = Math.min(Math.max(Number(process.argv[2]) || 100, 1), 500);
  const onProgress = (msg) => console.log(msg);

  const all = listListings({ limit: 500 });
  const targets = all.filter((row) => row.forras_url && !listingImageFileExists(row.fo_kep)).slice(0, limit);

  if (!targets.length) {
    console.log("Minden hirdetésnek megvan a képe (vagy nincs forrás URL).");
    return;
  }

  console.log(`${targets.length} hirdetés képét töltjük le…`);
  console.log("Chrome megnyílik — Cloudflare esetén jelöld meg a pipát.\n");

  const session = await acquireImportSession(targets[0].forras_url, { onProgress });
  const page = session.context.pages()[0] ?? (await session.context.newPage());

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < targets.length; i += 1) {
    const listing = targets[i];
    try {
      onProgress(`[${i + 1}/${targets.length}]`);
      const result = await backfillOne(page, listing, onProgress);
      if (result.skipped) {
        onProgress(`  ✓ már megvan: ${result.path}`);
        ok += 1;
      } else if (result.ok) {
        onProgress(`  ✓ mentve: ${result.path}`);
        ok += 1;
      } else {
        onProgress(`  ✗ ${result.reason}`);
        fail += 1;
      }
    } catch (error) {
      onProgress(`  ✗ ${error.message ?? error}`);
      fail += 1;
    }
    await sleep(500);
  }

  console.log(`\nKész: ${ok} siker, ${fail} hiba.`);
  console.log("Frissítsd a főoldalt: Cmd+Shift+R");
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
