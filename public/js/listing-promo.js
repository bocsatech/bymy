/** Saját hirdetés promó — listing_cells: promo_kiemelt, promo_top_ajanlat ("1" / "0"). */

export function promoKiemeltActive(item) {
  return String(item?.form?.promo_kiemelt ?? "").trim() === "1";
}

export function promoTopAjanlatActive(item) {
  return String(item?.form?.promo_top_ajanlat ?? "").trim() === "1";
}

export function listingShowsKiemeltDecor(item, configuredFeaturedIds = null) {
  const id = Number(item?.id);
  if (promoKiemeltActive(item)) return true;
  if (configuredFeaturedIds instanceof Set && Number.isFinite(id) && configuredFeaturedIds.has(id)) {
    return true;
  }
  return false;
}
