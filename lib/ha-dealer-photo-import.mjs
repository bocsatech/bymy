import { extractListingIdFromUrl, publicListingUrlFromId } from "./links.mjs";
import {
  clearListingPhotos,
  findListingBySource,
  saveListing,
  updateListingFoKep,
} from "./db-store.mjs";
import { MAX_IMPORT_BATCH } from "./ha-import-save.mjs";
import { upgradeHaImageUrl, isHaThumbImageUrl } from "./listing-image.mjs";

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPhotoOnlyForm(page = {}) {
  const url = clean(page.url || page.clickUrl || page.adminUrl || page.publicUrl || page.forras_url);
  const haId = clean(
    page.listingId || page.hasznaltauto_hirdetes_id || extractListingIdFromUrl(url)
  );
  const forras = haId ? publicListingUrlFromId(haId) : url;
  const title = haId ? `Eladó importált autó (${haId})` : "Eladó importált autó";
  return {
    hirdetes_vertical: "auto",
    hirdetes_alkategoria: "szemelyauto",
    jarmu_kategoria: "szemelyauto",
    hasznaltauto_hirdetes_id: haId,
    forras_url: forras || url,
    hirdetes_cime: title,
  };
}

function resolveRemoteHqImage(page = {}) {
  const raw = clean(page.visibleImage || page.imageUrl || page.fo_kep || "");
  const hq = upgradeHaImageUrl(raw) || raw;
  if (!/^https?:\/\//i.test(hq)) return "";
  if (isHaThumbImageUrl(hq)) return "";
  return hq;
}

/**
 * Kereskedői import: listáról autó → csak első kép HQ CDN URL a fo_kep-be.
 * Nincs base64 /uploads (Vercelen eltűnik → törött kép).
 */
export async function saveDealerPhotoImportPages({ pages = [], userId = null, limit = MAX_IMPORT_BATCH } = {}) {
  const cap = Math.min(Math.max(Number(limit) || MAX_IMPORT_BATCH, 1), MAX_IMPORT_BATCH);
  const list = (Array.isArray(pages) ? pages : []).slice(0, cap);
  const items = [];
  const errors = [];
  let savedCount = 0;

  const uid = Number(userId);
  if (!(Number.isFinite(uid) && uid > 0)) {
    const err = new Error("Csak regisztrált felhasználók importálhatnak.");
    err.code = "AUTH_REQUIRED";
    throw err;
  }

  for (const page of list) {
    const url = clean(page?.url || page?.clickUrl || page?.adminUrl || page?.publicUrl);
    try {
      const form = buildPhotoOnlyForm(page || {});
      const haId = form.hasznaltauto_hirdetes_id;
      if (!haId) {
        errors.push({ url, message: "Hiányzik a hirdetés ID." });
        continue;
      }

      const remoteImage = resolveRemoteHqImage(page || {});
      if (!remoteImage) {
        errors.push({ url, message: "Nincs menthető első kép (HQ URL hiányzik)." });
        continue;
      }

      const sourceUrls = [
        form.forras_url,
        url,
        publicListingUrlFromId(haId),
        `https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/${haId}`,
        `https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto?id=${haId}`,
      ].filter(Boolean);

      let existing = null;
      for (const sourceUrl of sourceUrls) {
        try {
          existing = await findListingBySource({ sourceUrl, hasznaltautoId: haId });
          if (existing) break;
        } catch {
          existing = null;
        }
      }

      if (existing?.id) {
        try {
          await clearListingPhotos(existing.id);
        } catch {
          /* best-effort */
        }
      }

      form.fo_kep = remoteImage;

      let saved = await saveListing(form, existing?.id ?? null, {
        status: existing?.status || "feladott",
        userId: uid,
        replaceImport: true,
      });

      try {
        const updated = await updateListingFoKep(saved.id, remoteImage);
        if (updated) saved = updated;
      } catch {
        /* fo_kep a saveListing-ben is mehetett */
      }

      if (!saved?.fo_kep && !remoteImage) {
        errors.push({ url, message: "Nem sikerült az első képet menteni." });
        continue;
      }

      savedCount += 1;
      items.push({
        url,
        cim: saved?.form?.hirdetes_cime || saved?.hirdetes_cime || form.hirdetes_cime,
        savedId: saved?.id ?? null,
        updated: Boolean(existing),
        photoOnly: true,
      });
    } catch (error) {
      errors.push({ url, message: error.message ?? String(error) });
    }
  }

  if (savedCount === 0 && errors[0]?.message) {
    const err = new Error(errors[0].message);
    err.importResult = { savedCount, skippedCount: 0, errorCount: errors.length, items, errors };
    throw err;
  }

  return {
    savedCount,
    skippedCount: 0,
    errorCount: errors.length,
    count: items.length,
    items,
    errors,
    photoOnly: true,
  };
}
