/** Admin / éles: window.BYMY_FEATURED_LISTING_IDS = [123, 456, …] (max 4 slot). */
export const FEATURED_SLOT_IDS = [null, null, null, null];

function listingHasPhoto(item) {
  const preview = item?.preview ?? {};
  return Boolean(String(preview.imageUrl || item?.fo_kep || "").trim());
}

function isPromoKiemelt(item) {
  return String(item?.form?.promo_kiemelt ?? "").trim() === "1";
}

export function readConfiguredFeaturedIds() {
  const g = globalThis.BYMY_FEATURED_LISTING_IDS;
  if (!Array.isArray(g)) return [];
  return g.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * Csak tényleges kiemelés: admin ID-k, vagy promo_kiemelt.
 * Nincs automatikus „legújabb 4” kitöltés.
 * @param {object[]} items
 * @param {number[]} [configuredIds]
 * @returns {object[]}
 */
export function pickFeaturedListings(items, configuredIds = readConfiguredFeaturedIds()) {
  const list = Array.isArray(items) ? items : [];
  const ids = Array.isArray(configuredIds) ? configuredIds : [];
  const byId = new Map(list.map((item) => [Number(item.id), item]));
  const picked = [];
  const used = new Set();

  for (const rawId of ids) {
    const id = Number(rawId);
    if (!Number.isFinite(id) || id <= 0 || used.has(id)) continue;
    const item = byId.get(id);
    if (item && listingHasPhoto(item)) {
      picked.push(item);
      used.add(id);
    }
  }

  if (ids.length > 0) {
    return picked.slice(0, FEATURED_SLOT_IDS.length);
  }

  const fromPromo = list
    .filter((item) => listingHasPhoto(item) && isPromoKiemelt(item) && !used.has(Number(item.id)))
    .sort((a, b) => {
      const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
      return tb - ta;
    });

  for (const item of fromPromo) {
    if (picked.length >= FEATURED_SLOT_IDS.length) break;
    picked.push(item);
  }

  return picked;
}

export function featuredListingIdSet(items, configuredIds = readConfiguredFeaturedIds()) {
  return new Set(pickFeaturedListings(items, configuredIds).map((item) => Number(item.id)));
}
