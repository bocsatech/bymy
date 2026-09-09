import { extractListingIdFromUrl, publicListingUrlFromId } from "./links.mjs";
import {
  clearListingPhotos,
  findListingBySource,
  saveListing,
  updateListingFoKep,
  updateListingPhotoUrls,
} from "./db-store.mjs";
import { saveListingPhotos } from "./listing-photos.mjs";
import { MAX_IMPORT_BATCH } from "./ha-import-save.mjs";
import { upgradeHaImageUrl, isHaThumbImageUrl, MIN_IMPORT_PHOTO_BYTES } from "./listing-image.mjs";

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDataUrl(raw) {
  const s = String(raw ?? "").trim();
  const idx = s.search(/base64,/i);
  return idx >= 0 ? s.slice(idx + 7).replace(/\s/g, "") : s.replace(/\s/g, "");
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

function photoBase64IfLarge(page = {}) {
  const raw = clean(page.imageJpegBase64 || page.photo);
  if (!raw) return "";
  const stripped = stripDataUrl(raw);
  try {
    const bytes = Buffer.from(stripped, "base64");
    if (bytes.length < MIN_IMPORT_PHOTO_BYTES) return "";
    return stripped;
  } catch {
    return "";
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label || "timeout")), ms);
    }),
  ]);
}

/**
 * Kereskedői import: listáról autó → csak első kép (HQ CDN URL).
 * Gyors út: fo_kep = 2048x1536 URL. Base64 feltöltés opcionális, timeouttal.
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
      const photoB64 = photoBase64IfLarge(page || {});
      if (!remoteImage && !photoB64) {
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

      // Gyors: HQ URL azonnal a formban (proxy megjeleníti)
      if (remoteImage) form.fo_kep = remoteImage;

      let saved = await saveListing(form, existing?.id ?? null, {
        status: existing?.status || "feladott",
        userId: uid,
        replaceImport: true,
      });

      let stored = Boolean(remoteImage && saved?.fo_kep);
      if (remoteImage) {
        try {
          const updated = await updateListingFoKep(saved.id, remoteImage);
          if (updated) {
            saved = updated;
            stored = true;
          }
        } catch {
          /* fo_kep a saveListing-ben is mehetett */
        }
      }

      // Opcionális saját tárhely — max 8 mp, ne ragadjon be a batch
      if (photoB64) {
        try {
          const urls = await withTimeout(saveListingPhotos(saved.id, [photoB64]), 8000, "photo-upload-timeout");
          if (urls?.[0]) {
            const updated = await withTimeout(
              updateListingPhotoUrls(saved.id, urls),
              5000,
              "photo-meta-timeout"
            );
            if (updated) {
              saved = updated;
              stored = true;
            }
          }
        } catch {
          /* marad a CDN HQ URL */
        }
      }

      if (!stored && !remoteImage) {
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
