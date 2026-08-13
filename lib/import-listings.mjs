import {
  collectListingLinksFromPage,
  countListingLinksOnPage,
  extractListingCardsFromPage,
  hasListingLinksInHtml,
  isListPageUrl,
  isListingUrl,
  normalizeInputUrl,
} from "./links.mjs";
import { parseListingHtml, mergeParsedListing } from "./parse-listing.mjs";
import {
  mergePageExtract,
  prepareListingPage,
  revealPhoneNumber,
  waitForListingAttributes,
} from "./page-extract.mjs";
import { mapCardPreview, mapListingToForm } from "./map-to-form.mjs";
import { shortUrl } from "./url-utils.mjs";
import { acquireImportSession, openChromeForImport } from "./browser-session.mjs";
import { extractMainImageUrl, downloadMainImage, isListingImageMissing } from "./listing-image.mjs";
import { findListingBySource, saveListing, updateListingFoKep } from "./db.mjs";

export { openChromeForImport };

const DEFAULT_IMPORT_LIMIT = 20;
const MAX_IMPORT_LIMIT = 80;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function hasListPageContent(html, url) {
  if (/talalati-sor|talalatisor-infokontener|pricefield-primary|Hirdetéskód|hirdeteskod/i.test(html)) {
    return true;
  }
  return hasListingLinksInHtml(html, url || "https://www.hasznaltauto.hu/");
}

function isRealCloudflareChallenge(title, html, url) {
  if (hasListPageContent(html, url)) return false;
  if (/hirdetesadatok|Alapadatok/i.test(html)) return false;
  if (/Attention Required|biztonsági ellenőrzés|Egy pillanat/i.test(title)) return true;
  if (/challenges\.cloudflare\.com/i.test(html) && html.length < 40000) return true;
  return false;
}

function isContentReady(title, html, url) {
  if (!/hasznaltauto\.hu/i.test(url)) return false;
  if (/hirdetesadatok|Alapadatok/i.test(html)) return true;
  if (/\/szemelyauto\/.+-\d{5,}/i.test(url) && html.length > 12000) return true;
  if (hasListPageContent(html, url)) return true;
  return false;
}

function isBlocked(title, html, url) {
  return isRealCloudflareChallenge(title, html, url);
}

async function waitForAccess(page, onProgress, maxSeconds = 120) {
  const deadline = Date.now() + maxSeconds * 1000;
  let lastCfLog = 0;

  while (Date.now() < deadline) {
    const url = page.url();
    const linkCount = await countListingLinksOnPage(page);
    if (linkCount > 0) return;

    const title = await page.title();
    const html = await page.content();
    if (isContentReady(title, html, url)) return;

    if (isBlocked(title, html, url)) {
      const now = Date.now();
      if (now - lastCfLog > 8000) {
        onProgress?.("Cloudflare: jelöld meg a megnyílt Chrome ablakban, majd várunk…");
        lastCfLog = now;
      }
    } else if (/talalatilista/i.test(url)) {
      onProgress?.("Várakozás: találati lista betöltése…");
    }
    await sleep(2000);
  }
  throw new Error(
    "Az oldal nem töltődött be időben. Ellenőrizd a Chrome ablakban, hogy látszanak-e a hirdetések, majd indítsd újra az importot."
  );
}

async function openSession({ startUrl, onProgress }) {
  try {
    return await acquireImportSession(startUrl, { onProgress });
  } catch (error) {
    onProgress?.(`Böngésző indítás sikertelen: ${error.message}`);
    throw error;
  }
}

async function getWorkingPage(context, startUrl) {
  for (const page of context.pages()) {
    if (/hasznaltauto\.hu/i.test(page.url())) return page;
  }

  const page = context.pages()[0] ?? (await context.newPage());
  if (startUrl && (!page.url() || page.url() === "about:blank")) {
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  }
  return page;
}

async function waitForListingHtml(page, onProgress) {
  const deadline = Date.now() + 60000;
  let lastLog = 0;
  while (Date.now() < deadline) {
    const html = await page.content();
    const title = await page.title();
    if (isContentReady(title, html, page.url()) && /hirdetesadatok|Alapadatok/i.test(html)) {
      return html;
    }
    if (Date.now() - lastLog > 8000) {
      onProgress?.("Várakozás: hirdetés oldal betöltése…");
      lastLog = Date.now();
    }
    await sleep(1500);
  }
  throw new Error("Hirdetés oldal nem töltődött be 60 mp alatt — következő hirdetés.");
}

async function scrollListPage(page, onProgress) {
  onProgress?.("Lista görgetése (lazy load)…");
  for (let i = 0; i < 6; i += 1) {
    await page.evaluate(() => window.scrollBy(0, Math.max(window.innerHeight * 1.5, 600)));
    await sleep(700);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
}

async function collectListingUrls(page, listUrl, limit, onProgress) {
  await waitForAccess(page, onProgress);
  await scrollListPage(page, onProgress);

  let cards = await extractListingCardsFromPage(page);
  let urls = cards.map((c) => c.url);

  if (urls.length === 0) {
    urls = await collectListingLinksFromPage(page, listUrl || page.url());
  }

  if (urls.length === 0) {
    onProgress?.("Még nincs link — várunk, hátha betölt a lista…");
    await sleep(5000);
    await scrollListPage(page, onProgress);
    cards = await extractListingCardsFromPage(page);
    urls = cards.map((c) => c.url);
    if (urls.length === 0) {
      urls = await collectListingLinksFromPage(page, listUrl || page.url());
    }
  }

  const unique = [...new Set(urls)];
  onProgress?.(`Lista: ${unique.length} hirdetés link (max ${limit}).`);
  return { urls: unique.slice(0, limit), cards };
}

function listingKeyFromUrl(url) {
  const match = String(url || "").match(/-(\d{5,})(?:[/?#]|$)/);
  return match?.[1] || "";
}

async function attachMainImage(page, item, onProgress, preferredImageUrl = null) {
  try {
    let imageUrl = preferredImageUrl || null;
    if (!imageUrl) imageUrl = await extractMainImageUrl(page);
    if (!imageUrl) {
      onProgress?.("Fő kép: nem található");
      return item;
    }
    const key =
      item.form?.hasznaltauto_hirdetes_id || listingKeyFromUrl(item.url || item.form?.forras_url);
    const foKep = await downloadMainImage(page, imageUrl, key || `img_${Date.now()}`);
    const finalUrl = foKep || imageUrl;
    item.imageUrl = finalUrl;
    if (item.form) item.form.fo_kep = finalUrl;
    onProgress?.(foKep ? `Fő kép mentve: ${foKep}` : `Fő kép (távoli URL): ${imageUrl.slice(0, 80)}`);
  } catch (error) {
    onProgress?.(`Fő kép hiba: ${error.message ?? error}`);
  }
  return item;
}

async function repairExistingListingImage(page, existing, listingUrl, card, onProgress) {
  onProgress?.(`Kép pótlás (#${existing.id}): ${shortUrl(listingUrl, 55)}`);
  let imageUrl = card?.imageUrl || null;

  if (!imageUrl) {
    if (page.url() !== listingUrl) {
      await page.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    await waitForListingHtml(page, onProgress);
    imageUrl = await extractMainImageUrl(page);
  }

  if (!imageUrl) {
    onProgress?.(`Kép pótlás sikertelen (#${existing.id}): nincs kép URL`);
    return false;
  }

  const key =
    existing.hasznaltauto_hirdetes_id ||
    listingKeyFromUrl(listingUrl) ||
    `listing_${existing.id}`;
  const foKep = await downloadMainImage(page, imageUrl, key);
  const finalUrl = foKep || imageUrl;
  updateListingFoKep(existing.id, finalUrl);
  onProgress?.(
    foKep
      ? `Kép pótolva (#${existing.id}): ${foKep}`
      : `Kép pótolva távoli URL-lel (#${existing.id})`
  );
  return true;
}

function existingForUrl(url, form = {}) {
  return findListingBySource({
    sourceUrl: form.forras_url || url,
    hasznaltautoId: form.hasznaltauto_hirdetes_id || listingKeyFromUrl(url),
  });
}

async function fetchListingForm(page, url, card, onProgress) {
  onProgress?.(`Részletek: ${shortUrl(url, 70)}`);
  if (page.url() !== url) {
    onProgress?.("Oldal betöltése…");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  }
  await waitForListingHtml(page, onProgress);
  await prepareListingPage(page);
  onProgress?.("Telefonszám és adatmezők…");
  const phone = await revealPhoneNumber(page);
  const extracted = await waitForListingAttributes(page, { minFields: 5, timeoutMs: 25000 });
  const html = await page.content();
  let parsed = parseListingHtml(html, { url, phone: phone ?? undefined });
  parsed = mergePageExtract(parsed, { ...extracted, phone });
  parsed = mergeParsedListing(parsed, card);
  const fieldCount = Object.keys(parsed.nyersAdatok ?? {}).length;
  onProgress?.(`Kinyerve: ${fieldCount} adatmező → űrlap kitöltés`);
  const item = mapCardPreview(card ?? { url }, parsed);
  await attachMainImage(page, item, onProgress, card?.imageUrl || null);
  return item;
}

function persistImportedItem(item, onProgress) {
  const form = { ...(item.form || {}), fo_kep: item.form?.fo_kep || item.imageUrl || "" };
  if (!form.forras_url) form.forras_url = item.url || "";
  const saved = saveListing(form, null, { status: "feladott" });
  item.savedId = saved?.id ?? null;
  item.saved = true;
  onProgress?.(
    `Mentve (#${saved?.id ?? "?"}): ${item.cim || form.hirdetes_cime || item.url} — látszik a főoldalon`
  );
  return saved;
}

export async function importListings(inputUrl, options = {}) {
  const limit = Math.min(
    Math.max(Number(options.limit) || DEFAULT_IMPORT_LIMIT, 1),
    MAX_IMPORT_LIMIT
  );
  const autoSave = options.autoSave !== false;
  const onProgress = options.onProgress;
  const url = normalizeInputUrl(inputUrl);

  const session = await openSession({ startUrl: url, onProgress });
  const items = [];
  const errors = [];
  const skipped = [];
  let savedCount = 0;
  let repairedCount = 0;

  try {
    const page = await getWorkingPage(session.context, url);

    if (isListingUrl(url)) {
      const existingSingle = existingForUrl(url);
      if (autoSave && existingSingle && !isListingImageMissing(existingSingle.fo_kep)) {
        onProgress?.(`Kihagyva (már az adatbázisban): ${shortUrl(url, 70)}`);
        skipped.push({ url, reason: "duplicate" });
        return {
          listUrl: url,
          count: 0,
          items,
          errors,
          skipped,
          savedCount: 0,
          repairedCount: 0,
          skippedCount: skipped.length,
        };
      }
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
      await waitForAccess(page, onProgress);
      const item = await fetchListingForm(page, url, { url }, onProgress);
      if (autoSave) {
        const existing = existingForUrl(url, item.form);
        if (existing) {
          if (item.form?.fo_kep && isListingImageMissing(existing.fo_kep)) {
            updateListingFoKep(existing.id, item.form.fo_kep);
            repairedCount += 1;
            item.savedId = existing.id;
            items.push(item);
            onProgress?.(`Kép pótolva (#${existing.id})`);
          } else {
            onProgress?.(`Kihagyva (már az adatbázisban): ${shortUrl(url, 70)}`);
            skipped.push({ url, reason: "duplicate" });
          }
        } else {
          persistImportedItem(item, onProgress);
          savedCount += 1;
          items.push(item);
        }
      } else {
        items.push(item);
      }
      return {
        listUrl: url,
        count: items.length,
        items,
        errors,
        skipped,
        savedCount,
        repairedCount,
        skippedCount: skipped.length,
      };
    }

    if (!isListPageUrl(url)) {
      throw new Error("Adj meg hasznaltauto.hu lista URL-t vagy egy konkrét hirdetés linket.");
    }

    if (!/hasznaltauto\.hu/i.test(page.url()) || page.url() === "about:blank") {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    } else if (!page.url().startsWith(url.split("?")[0].slice(0, 40))) {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    }

    const { urls, cards } = await collectListingUrls(page, url, limit, onProgress);
    if (urls.length === 0) {
      const title = await page.title().catch(() => "");
      const onCf = isBlocked(title, await page.content().catch(() => ""), page.url());
      throw new Error(
        onCf
          ? "Cloudflare blokkolja az oldalt. A Chrome ablakban jelöld meg a pipát, várj amíg megjelennek a hirdetések, majd indítsd újra az importot."
          : "Nem találtunk hirdetést a listán. A Chrome ablakban görgess le, ellenőrizd hogy betöltött-e a találati lista, majd indítsd újra az importot."
      );
    }

    const cardByUrl = new Map(cards.map((c) => [c.url, c]));

    for (let i = 0; i < urls.length; i += 1) {
      const listingUrl = urls[i];
      try {
        const existing = autoSave ? existingForUrl(listingUrl) : null;
        if (existing && !isListingImageMissing(existing.fo_kep)) {
          onProgress?.(`[${i + 1}/${urls.length}] Kihagyva (már van): ${shortUrl(listingUrl, 55)}`);
          skipped.push({ url: listingUrl, reason: "duplicate" });
          continue;
        }

        if (existing && isListingImageMissing(existing.fo_kep)) {
          const ok = await withTimeout(
            repairExistingListingImage(
              page,
              existing,
              listingUrl,
              cardByUrl.get(listingUrl),
              onProgress
            ),
            90000,
            "Időtúllépés kép pótláskor"
          );
          if (ok) repairedCount += 1;
          else skipped.push({ url: listingUrl, reason: "image_repair_failed" });
          continue;
        }

        onProgress?.(`[${i + 1}/${urls.length}] Import…`);
        const item = await withTimeout(
          fetchListingForm(page, listingUrl, cardByUrl.get(listingUrl), onProgress),
          90000,
          "Időtúllépés (90 mp) — a hirdetés oldal nem válaszolt időben"
        );

        if (autoSave) {
          const again = existingForUrl(listingUrl, item.form);
          if (again) {
            if (item.form?.fo_kep && isListingImageMissing(again.fo_kep)) {
              updateListingFoKep(again.id, item.form.fo_kep);
              repairedCount += 1;
              item.savedId = again.id;
            } else {
              onProgress?.(`[${i + 1}/${urls.length}] Kihagyva (már van): ${shortUrl(listingUrl, 55)}`);
              skipped.push({ url: listingUrl, reason: "duplicate" });
              continue;
            }
          } else {
            persistImportedItem(item, onProgress);
            savedCount += 1;
          }
        }

        items.push(item);
      } catch (error) {
        const message = error.message ?? String(error);
        onProgress?.(`⚠ [${i + 1}/${urls.length}] ${message}`);
        errors.push({ url: listingUrl, message });
      }
      await sleep(400);
    }

    if (autoSave) {
      onProgress?.(
        `Kész: ${savedCount} mentve, ${repairedCount} kép pótolva, ${skipped.length} kihagyva, ${errors.length} hiba.`
      );
    }

    return {
      listUrl: url,
      count: items.length,
      items,
      errors,
      skipped,
      savedCount,
      repairedCount,
      skippedCount: skipped.length,
    };
  } finally {
    onProgress?.("Chrome nyitva maradt — bezárhatod kézzel, ha kész.");
  }
}

export async function importListingFromHtml(html, url) {
  const parsed = parseListingHtml(html, { url });
  return mapCardPreview({ url }, parsed);
}

export { mapListingToForm, DEFAULT_IMPORT_LIMIT, MAX_IMPORT_LIMIT };
