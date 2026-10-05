/**
 * Kiemelt hirdetések: minden promo_kiemelt (kép kötelező).
 * Nincs admin ID lista, nincs max-4 kitöltés.
 * Sorrendet a hívó adja (desk Rendezés / hub: legújabb).
 */

function listingHasPhoto(item) {
  const preview = item?.preview ?? {};
  return Boolean(String(preview.imageUrl || item?.fo_kep || "").trim());
}

function isPromoKiemelt(item) {
  if (item?.preview?.promo?.kiemelt === true) return true;
  return String(item?.form?.promo_kiemelt ?? "").trim() === "1";
}

/**
 * @param {object[]} items
 * @param {{ limit?: number }} [opts]
 * @returns {object[]}
 */
export function pickFeaturedListings(items, opts = {}) {
  const list = Array.isArray(items) ? items : [];
  const limit = Number(opts?.limit);
  const hasLimit = Number.isFinite(limit) && limit > 0;

  const fromPromo = list.filter((item) => listingHasPhoto(item) && isPromoKiemelt(item));

  if (hasLimit) return fromPromo.slice(0, limit);
  return fromPromo;
}

export function featuredListingIdSet(items, opts = {}) {
  return new Set(pickFeaturedListings(items, opts).map((item) => Number(item.id)));
}
