/** Kiemelt lista kártya — TOP AJÁNLAT a fotón, KIEMELT a kép alatt a cím fölött. */
export function appendListingFeaturedRibbon(container) {
  if (!container || container.querySelector(".listing-featured-ribbon")) return;

  const ribbon = document.createElement("span");
  ribbon.className = "listing-featured-ribbon";
  ribbon.textContent = "TOP AJÁNLAT";
  container.append(ribbon);
}

export function createListingFeaturedBadge() {
  const badge = document.createElement("span");
  badge.className = "listing-featured-badge listing-featured-badge--under-photo";
  badge.textContent = "KIEMELT";
  badge.setAttribute("aria-hidden", "true");
  return badge;
}

export function listingFeaturedRibbonHtml() {
  return `<span class="listing-featured-ribbon" aria-hidden="true">TOP AJÁNLAT</span>`;
}

export function listingFeaturedBadgeHtml() {
  return `<span class="listing-featured-badge listing-featured-badge--under-photo" aria-hidden="true">KIEMELT</span>`;
}

/** @deprecated csak a szalag — hub régi hívások */
export function appendListingFeaturedDecor(container) {
  appendListingFeaturedRibbon(container);
}
