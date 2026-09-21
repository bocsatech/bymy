/** Kiemelt lista kártya (F kombó) — badge + szalag a fotón. */
export function appendListingFeaturedDecor(container) {
  if (!container || container.querySelector(".listing-featured-badge")) return;

  const badge = document.createElement("span");
  badge.className = "listing-featured-badge";
  badge.textContent = "KIEMELT";

  const ribbon = document.createElement("span");
  ribbon.className = "listing-featured-ribbon";
  ribbon.textContent = "TOP AJÁNLAT";

  container.append(badge, ribbon);
}

export function listingFeaturedDecorHtml() {
  return `<span class="listing-featured-badge" aria-hidden="true">KIEMELT</span><span class="listing-featured-ribbon" aria-hidden="true">TOP AJÁNLAT</span>`;
}
