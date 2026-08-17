/**
 * Használtautó import — ugyanaz a mentés, mint az iOS ImportAPI:
 * kinyert mezők + fotó → POST /api/listings (feladott).
 */
import { extractListingIdFromUrl, isAdminListingPageUrl, isListingUrl } from "./links.mjs";
import { parseListingHtml } from "./parse-listing.mjs";
import { mapListingToForm } from "./map-to-form.mjs";
import { listingSourceExists, saveListing, updateListingPhotoUrls } from "./db-store.mjs";
import { fetchRemoteListingImage } from "./listing-image.mjs";
import { saveListingPhotos } from "./listing-photos.mjs";

export const MAX_IMPORT_BATCH = 50;
const HA_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isChromeTitle(text) {
  const n = clean(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!n) return true;
  if (n.includes("hasznaltauto") && n.length <= 64) return true;
  if (n === "belepes" || n.startsWith("belepes ")) return true;
  if (n.includes("gyorsnezet") && n.length <= 40) return true;
  if (n.includes("javascript")) return true;
  return false;
}

function cleanTitle(raw) {
  const t = clean(raw)
    .replace(/\s*[|–-].*$/, "")
    .replace(/haszn[aá]ltaut[oó]\.?\s*hu/gi, " ")
    .replace(/\bbel[eé]p[eé]s\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (isChromeTitle(t) || t.length < 3) return "";
  return t;
}

function digits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function metaContent(html, property) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i"
  );
  return clean((html.match(re) || html.match(alt) || [])[1] || "");
}

export function imageUrlFromHtml(html) {
  const og = metaContent(html, "og:image");
  if (/^https?:\/\//i.test(og)) return og;
  const m = String(html ?? "").match(/https?:\/\/[^"'>\s]+(?:hasznaltauto|hazn)[^"'>\s]+\.(?:jpg|jpeg|png|webp)/i);
  return m ? m[0] : "";
}

export function buildFormFromPage(page = {}) {
  const url = clean(page.url || page.adminUrl || page.publicUrl || page.forras_url);
  const html = String(page.html ?? "");
  let form = {};
  if (html.length > 400) {
    form = mapListingToForm(parseListingHtml(html, { url }));
  }

  const id = clean(page.listingId || page.hasznaltauto_hirdetes_id || extractListingIdFromUrl(url) || form.hasznaltauto_hirdetes_id);
  const title = cleanTitle(page.visibleTitle || page.title || form.hirdetes_cime);
  const brand = clean(page.brand || form.gyartmany);
  const model = clean(page.model || form.modell);
  const priceDigits = digits(page.price || page.ar || form.vetelar);
  const kmDigits = digits(page.km || form.km);
  const yearDigits = digits(page.year || page.evjarat || form.gyartasi_ev).slice(0, 4);
  const fuel = clean(page.fuel || page.uzemanyag || form.uzemanyag);
  const desc = clean(page.visibleDescription || page.description || form.leiras).slice(0, 2000);

  let cim = "";
  if (title && !isChromeTitle(title)) {
    cim = /^eladó\s+/i.test(title) ? title : `Eladó ${title}`;
  } else if (brand) {
    const parts = [brand, model].filter(Boolean).join(" ");
    cim = yearDigits.length === 4 ? `Eladó ${parts} (${yearDigits})` : `Eladó ${parts}`;
  }
  if (!cim) cim = id ? `Importált autó #${id}` : "Importált autó";

  return {
    ...form,
    jarmu_kategoria: form.jarmu_kategoria || "szemelyauto",
    forras_url: form.forras_url || url,
    hasznaltauto_hirdetes_id: id,
    hirdetes_cime: cim,
    gyartmany: brand || form.gyartmany || "",
    modell: model || form.modell || "",
    vetelar: priceDigits || form.vetelar || "",
    km: kmDigits || form.km || "",
    gyartasi_ev: yearDigits.length === 4 ? yearDigits : form.gyartasi_ev || "",
    uzemanyag: fuel || form.uzemanyag || "",
    leiras: desc || form.leiras || "",
    fo_kep: /^https?:\/\//i.test(clean(page.visibleImage || page.imageUrl || form.fo_kep))
      ? clean(page.visibleImage || page.imageUrl || form.fo_kep)
      : form.fo_kep || "",
  };
}

export function validateReadyToSave(page = {}, form = {}) {
  const title = cleanTitle(page.visibleTitle || page.title || form.hirdetes_cime);
  const brand = clean(page.brand || form.gyartmany);
  const priceOk = digits(page.price || page.ar || form.vetelar).length > 0;
  const hasName = (title && !isChromeTitle(title)) || brand.length >= 2;
  const hasImage =
    Boolean(clean(page.imageJpegBase64 || page.photo)) ||
    /^https?:\/\//i.test(clean(page.visibleImage || page.imageUrl || form.fo_kep));
  if (!hasName && !priceOk) {
    return "Nem sikerült kiolvasni a hirdetés adatait (cím / ár). Nyisd meg a konkrét autó gyorsnézetét vagy a nyilvános hirdetés oldalt, majd próbáld újra.";
  }
  if (!hasImage) {
    return "Nincs fénykép a hirdetéshez — nyisd meg a gyorsnézetet / hirdetés oldalt, ahol látszik az autó képe.";
  }
  return "";
}

function stripDataUrl(raw) {
  const s = String(raw ?? "").trim();
  const idx = s.search(/base64,/i);
  return idx >= 0 ? s.slice(idx + 7).replace(/\s/g, "") : s.replace(/\s/g, "");
}

export async function resolvePhotoBase64(page = {}, form = {}) {
  const raw = clean(page.imageJpegBase64 || page.photo);
  if (raw) return stripDataUrl(raw);
  const imageUrl = clean(page.visibleImage || page.imageUrl || form.fo_kep);
  if (!/^https?:\/\//i.test(imageUrl)) return "";
  try {
    const { buffer } = await fetchRemoteListingImage(imageUrl);
    return buffer.toString("base64");
  } catch {
    return "";
  }
}

function isCloudflareHtml(html, title = "") {
  const source = `${title}\n${html}`.slice(0, 80000);
  if (/hirdetesadatok|Alapadatok|og:title/i.test(html) && html.length > 8000) return false;
  if (/Attention Required|biztonsági ellenőrzés|Egy pillanat/i.test(source)) return true;
  if (/challenges\.cloudflare\.com/i.test(html) && html.length < 40000) return true;
  return false;
}

export async function fetchHaHtml(url) {
  const target = clean(url);
  if (!/^https?:\/\/(?:www\.|admin\.)?hasznaltauto\.hu\//i.test(target)) {
    throw new Error("Csak hasznaltauto.hu link támogatott.");
  }
  const response = await fetch(target, {
    headers: {
      "User-Agent": HA_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });
  const html = await response.text();
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  if (isCloudflareHtml(html, title)) {
    throw new Error(
      "A hasznaltauto.hu Cloudflare-t mutat. Nyisd meg a hirdetést a böngészőben, majd húzd a Bymy import könyvjelzőt a címsorra."
    );
  }
  if (!response.ok) {
    throw new Error(`A hasznaltauto.hu nem adta a oldalt (${response.status}).`);
  }
  return html;
}

export async function pageFromPublicUrl(url) {
  const target = clean(url);
  if (isAdminListingPageUrl(target) && !isListingUrl(target)) {
    throw new Error(
      "Admin / gyorsnézet oldalt a szerver nem tud beolvasni. Használd a könyvjelzőt, vagy illeszd be a nyilvános hirdetés URL-jét."
    );
  }
  const html = await fetchHaHtml(target);
  const parsed = parseListingHtml(html, { url: target });
  const listingId = extractListingIdFromUrl(target) || extractListingIdFromUrl(parsed.url);
  return {
    url: target,
    html: html.slice(0, 220000),
    listingId,
    visibleTitle: parsed.cim || "",
    visibleImage: imageUrlFromHtml(html),
    visibleDescription: parsed.leiras || "",
    price: parsed.ar || "",
    km: parsed.km || "",
    year: parsed.evjarat || "",
    fuel: parsed.nyersAdatok?.["Üzemanyag"] || parsed.nyersAdatok?.uzemanyag || "",
  };
}

export async function saveExtractedPages({ pages = [], userId = null, limit = MAX_IMPORT_BATCH } = {}) {
  const cap = Math.min(Math.max(Number(limit) || MAX_IMPORT_BATCH, 1), MAX_IMPORT_BATCH);
  const list = (Array.isArray(pages) ? pages : []).slice(0, cap);
  const items = [];
  const errors = [];
  let savedCount = 0;
  let skippedCount = 0;

  for (const page of list) {
    const url = clean(page?.url || page?.adminUrl || page?.publicUrl);
    try {
      const form = buildFormFromPage(page || {});
      const invalid = validateReadyToSave(page || {}, form);
      if (invalid) {
        errors.push({ url, message: invalid });
        continue;
      }
      const haId = clean(form.hasznaltauto_hirdetes_id);
      if (await listingSourceExists({ sourceUrl: form.forras_url, hasznaltautoId: haId })) {
        skippedCount += 1;
        items.push({ url, cim: form.hirdetes_cime, ar: form.vetelar, km: form.km, skipped: true });
        continue;
      }
      const photo = await resolvePhotoBase64(page || {}, form);
      if (!photo) {
        errors.push({
          url,
          message: "Nincs fénykép a hirdetéshez — nyisd meg a gyorsnézetet / hirdetés oldalt, ahol látszik az autó képe.",
        });
        continue;
      }
      let saved = await saveListing(form, null, { status: "feladott", userId });
      const urls = await saveListingPhotos(saved.id, [photo]);
      if (urls[0]) {
        const updated = await updateListingPhotoUrls(saved.id, urls);
        if (updated) saved = updated;
      }
      savedCount += 1;
      items.push({
        url,
        cim: saved.hirdetes_cime || form.hirdetes_cime,
        ar: form.vetelar,
        km: form.km,
        savedId: saved.id,
      });
    } catch (error) {
      errors.push({ url, message: error.message ?? String(error) });
    }
  }

  if (savedCount === 0 && skippedCount === 0 && errors[0]?.message) {
    const err = new Error(errors[0].message);
    err.importResult = { savedCount, skippedCount, errorCount: errors.length, items, errors };
    throw err;
  }

  return {
    savedCount,
    skippedCount,
    errorCount: errors.length,
    count: items.length,
    items,
    errors,
  };
}
