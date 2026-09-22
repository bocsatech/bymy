/** Admin / éles: window.BYMY_FEATURED_LISTING_IDS = [123, 456, …] (max 4 slot). */
export const FEATURED_SLOT_IDS = [null, null, null, null];

function listingHasPhoto(item) {
  const preview = item?.preview ?? {};
  return Boolean(String(preview.imageUrl || item?.fo_kep || "").trim());
}

export function readConfiguredFeaturedIds() {
  const g = globalThis.BYMY_FEATURED_LISTING_IDS;
  if (!Array.isArray(g)) return [];
  return g.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * @param {object[]} items
 * @param {number[]} [configuredIds]
 * @returns {object[]}
 */
export function pickFeaturedListings(items, configuredIds = readConfiguredFeaturedIds()) {
  const list = Array.isArray(items) ? items : [];
  const ids = Array.isArray(configuredIds) ? configuredIds : [];
  const byId = new Map(list.map((item) => [Number(item.id), item]));
  const picked = [];

  for (const rawId of ids) {
    const id = Number(rawId);
    if (!Number.isFinite(id) || id <= 0) continue;
    const item = byId.get(id);
    if (item && listingHasPhoto(item)) picked.push(item);
  }

  if (ids.length > 0) {
    return picked;
  }

  const used = new Set(picked.map((item) => Number(item.id)));
  const rest = [...list]
    .filter((item) => listingHasPhoto(item) && !used.has(Number(item.id)))
    .sort((a, b) => {
      const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
      return tb - ta;
    });

  while (picked.length < FEATURED_SLOT_IDS.length && rest.length) {
    picked.push(rest.shift());
  }

  return picked.slice(0, FEATURED_SLOT_IDS.length);
}

export function featuredListingIdSet(items, configuredIds = readConfiguredFeaturedIds()) {
  const fromSlots = pickFeaturedListings(items, configuredIds).map((item) => Number(item.id));
  const fromPromo = (Array.isArray(items) ? items : [])
    .filter((item) => String(item?.form?.promo_kiemelt ?? "").trim() === "1")
    .map((item) => Number(item.id));
  return new Set([...fromSlots, ...fromPromo].filter((n) => Number.isFinite(n) && n > 0));
}
