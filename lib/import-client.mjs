/**
 * Kliens-oldali hasznaltauto import — az iOS WebView HTML-jét dolgozza fel (Playwright nélkül).
 */
import { writeFileSync } from "fs";
import { join } from "path";
import {
  extractListingIdFromUrl,
  extractListingRefsFromHtml,
  extractCanonicalPublicUrl,
  isAdminListingPageUrl,
  isListingUrl,
  publicListingUrlFromId,
} from "./links.mjs";
import { parseListingHtml, mergeParsedListing } from "./parse-listing.mjs";
import { mapCardPreview } from "./map-to-form.mjs";
import {
  fetchRemoteListingImage,
  isListingImageMissing,
  listingImageDir,
  listingImagePublicPath,
} from "./listing-image.mjs";
import { findListingBySource, saveListing } from "./db-store.mjs";

const DEFAULT_IMPORT_LIMIT = 20;
const MAX_IMPORT_LIMIT = 80;

function listingKeyFromUrl(url) {
  return extractListingIdFromUrl(url) || "";
}

function resolveListingUrl(ref, html = "") {
  return (
    extractCanonicalPublicUrl(html) ||
    ref?.publicUrl ||
    ref?.adminUrl ||
    publicListingUrlFromId(ref?.id) ||
    ""
  );
}

async function existingForUrl(url, form = {}) {
  return findListingBySource({
    sourceUrl: form.forras_url || url,
    hasznaltautoId: form.hasznaltauto_hirdetes_id || listingKeyFromUrl(url),
  });
}

function applyVisibleMeta(parsed, meta = {}) {
  const next = { ...parsed };
  const title = String(meta.visibleTitle ?? "").trim();
  const desc = String(meta.visibleDescription ?? "").trim();
  if (title && (next.cim === "—" || !next.cim || next.cim.length < 8)) next.cim = title;
  if (desc && !String(next.leiras ?? "").trim()) next.leiras = desc;
  return next;
}

async function saveImageFromUrl(imageUrl, listingKey) {
  const src = String(imageUrl ?? "").trim();
  const key = String(listingKey ?? "").replace(/[^\w.-]+/g, "_").slice(0, 64);
  if (!src || !key || !/^https?:\/\//i.test(src)) return src || "";
  try {
    const { buffer, contentType } = await fetchRemoteListingImage(src);
    const ext = String(contentType || "").includes("png")
      ? "png"
      : String(contentType || "").includes("webp")
        ? "webp"
        : "jpg";
    const fileName = `${key}.${ext}`;
    writeFileSync(join(listingImageDir(), fileName), buffer);
    return listingImagePublicPath(fileName);
  } catch {
    return src;
  }
}

export function discoverFromHtml(html, baseUrl) {
  const pageUrl = String(baseUrl ?? "").trim();
  const pageHtml = String(html ?? "");
  if (isAdminListingPageUrl(pageUrl) || isListingUrl(pageUrl)) {
    const id = extractListingIdFromUrl(pageUrl);
    const publicUrl = extractCanonicalPublicUrl(pageHtml) || publicListingUrlFromId(id) || pageUrl;
    const ref = {
      id,
      adminUrl: isAdminListingPageUrl(pageUrl) ? pageUrl : `https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/${id}`,
      publicUrl,
    };
    return {
      pageUrl,
      count: 1,
      mode: isAdminListingPageUrl(pageUrl) ? "admin-single" : "public-single",
      refs: [ref],
    };
  }
  const refs = extractListingRefsFromHtml(pageHtml, pageUrl);
  return {
    pageUrl,
    count: refs.length,
    mode: "list",
    refs,
  };
}

export async function importFromClient(options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || DEFAULT_IMPORT_LIMIT, 1), MAX_IMPORT_LIMIT);
  const autoSave = options.autoSave !== false;
  let listUrl = String(options.listUrl ?? "").trim();
  const pageMeta = {
    visibleTitle: String(options.visibleTitle ?? "").trim(),
    visibleImage: String(options.visibleImage ?? "").trim(),
    visibleDescription: String(options.visibleDescription ?? "").trim(),
  };

  const htmlByUrl = new Map();
  const cardByUrl = new Map();

  if (options.listHtml && listUrl) {
    const discovered = discoverFromHtml(options.listHtml, listUrl);
    listUrl = discovered.pageUrl || listUrl;
    if (discovered.mode !== "list") {
      const ref = discovered.refs?.[0];
      const url = resolveListingUrl(ref, options.listHtml);
      htmlByUrl.set(url, String(options.listHtml));
      cardByUrl.set(url, { url, id: ref?.id, adminUrl: ref?.adminUrl, ...pageMeta });
    } else {
      for (const ref of discovered.refs || []) {
        const url = resolveListingUrl(ref, options.listHtml);
        if (!url) continue;
        htmlByUrl.set(url, null);
        cardByUrl.set(url, { url, id: ref.id, adminUrl: ref.adminUrl });
      }
    }
  }

  for (const entry of options.listings || []) {
    const entryUrl = entry?.url || entry?.adminUrl || "";
    const id = entry?.id || extractListingIdFromUrl(entryUrl);
    const url =
      entry?.publicUrl ||
      extractCanonicalPublicUrl(entry?.html || "") ||
      publicListingUrlFromId(id) ||
      entryUrl;
    if (!url) continue;
    htmlByUrl.set(url, entry?.html ? String(entry.html) : htmlByUrl.get(url) ?? null);
    cardByUrl.set(url, {
      url,
      id,
      adminUrl: entry?.adminUrl || (isAdminListingPageUrl(entryUrl) ? entryUrl : null),
      visibleTitle: entry?.visibleTitle || "",
      visibleImage: entry?.visibleImage || "",
      visibleDescription: entry?.visibleDescription || "",
    });
  }

  let urls = [...htmlByUrl.keys()].slice(0, limit);
  if (urls.length === 0 && options.listHtml && listUrl) {
    const discovered = discoverFromHtml(options.listHtml, listUrl);
    const ref = discovered.refs?.[0];
    const url = resolveListingUrl(ref, options.listHtml) || listUrl;
    urls = [url];
    htmlByUrl.set(url, String(options.listHtml));
    cardByUrl.set(url, { url, id: ref?.id, ...pageMeta });
  }

  if (urls.length === 0) {
    throw new Error(
      "Nem találtunk hirdetés linket. Nyisd meg a Hirdetéseim / gyorsnézet oldalt (admin.hasznaltauto.hu)."
    );
  }

  const items = [];
  const errors = [];
  const skipped = [];
  let savedCount = 0;

  for (const url of urls) {
    try {
      const card = cardByUrl.get(url) || { url };
      const formHint = { forras_url: url, hasznaltauto_hirdetes_id: card.id || listingKeyFromUrl(url) };
      const existing = autoSave ? await existingForUrl(url, formHint) : null;
      if (existing && !isListingImageMissing(existing.fo_kep) && String(existing.form?.leiras ?? "").trim()) {
        skipped.push({ url, reason: "duplicate" });
        continue;
      }
      const html = htmlByUrl.get(url);
      if (!html) {
        throw new Error("Hiányzik a hirdetés HTML-je. Nyisd meg a gyorsnézetet, majd importálj újra.");
      }
      const entryMeta = {
        visibleTitle: card.visibleTitle || pageMeta.visibleTitle,
        visibleImage: card.visibleImage || pageMeta.visibleImage,
        visibleDescription: card.visibleDescription || pageMeta.visibleDescription,
      };
      let parsed = applyVisibleMeta(parseListingHtml(html, { url }), entryMeta);
      parsed = mergeParsedListing(parsed, card);
      let item = mapCardPreview(card, parsed);
      const listingId = card.id || listingKeyFromUrl(url);
      if (listingId && item.form) {
        item.form.hasznaltauto_hirdetes_id = listingId;
        item.form.forras_url = item.form.forras_url || card.adminUrl || publicListingUrlFromId(listingId) || url;
        if (entryMeta.visibleDescription && !String(item.form.leiras ?? "").trim()) {
          item.form.leiras = entryMeta.visibleDescription;
        }
      }
      const imageUrl = entryMeta.visibleImage || item.form?.fo_kep || "";
      if (imageUrl) {
        const foKep = await saveImageFromUrl(imageUrl, listingId || `img_${Date.now()}`);
        item.imageUrl = foKep;
        if (item.form) item.form.fo_kep = foKep;
      }
      if (autoSave) {
        const form = { ...(item.form || {}), fo_kep: item.form?.fo_kep || item.imageUrl || "" };
        const saved = await saveListing(form, existing?.id ?? null, { status: "feladott" });
        item.savedId = saved?.id ?? null;
        savedCount += 1;
      }
      items.push(item);
    } catch (error) {
      errors.push({ url, message: error.message ?? String(error) });
    }
  }

  return {
    listUrl,
    count: items.length,
    items,
    errors,
    skipped,
    savedCount,
    skippedCount: skipped.length,
    errorCount: errors.length,
  };
}
