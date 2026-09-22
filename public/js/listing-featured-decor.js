/** Kiemelt lista kártya — KIEMELT + TOP AJÁNLAT a kép alatt, cím fölött. */
export function createListingFeaturedBadge() {
  const badge = document.createElement("span");
  badge.className = "listing-featured-badge listing-featured-badge--under-photo";
  badge.textContent = "KIEMELT";
  badge.setAttribute("aria-hidden", "true");
  return badge;
}

export function createListingFeaturedRibbon() {
  const ribbon = document.createElement("span");
  ribbon.className = "listing-featured-ribbon listing-featured-ribbon--under-photo";
  ribbon.textContent = "TOP AJÁNLAT";
  ribbon.setAttribute("aria-hidden", "true");
  return ribbon;
}

export function createListingFeaturedUnderPhotoStrip({ kiemelt = true, topOffer = true } = {}) {
  const wrap = document.createElement("span");
  wrap.className = "listing-featured-under-photo";
  wrap.setAttribute("aria-hidden", "true");
  if (kiemelt) wrap.append(createListingFeaturedBadge());
  if (topOffer) wrap.append(createListingFeaturedRibbon());
  if (!wrap.childNodes.length) return null;
  return wrap;
}

export function listingFeaturedUnderPhotoHtml({ kiemelt = true, topOffer = true } = {}) {
  const parts = [];
  if (kiemelt) {
    parts.push(
      `<span class="listing-featured-badge listing-featured-badge--under-photo">KIEMELT</span>`
    );
  }
  if (topOffer) {
    parts.push(
      `<span class="listing-featured-ribbon listing-featured-ribbon--under-photo">TOP AJÁNLAT</span>`
    );
  }
  if (!parts.length) return "";
  return `<span class="listing-featured-under-photo" aria-hidden="true">${parts.join("")}</span>`;
}

/** @deprecated hub — használd createListingFeaturedUnderPhotoStrip */
export function appendListingFeaturedDecor(container) {
  if (!container || container.querySelector(".listing-featured-under-photo")) return;
  const parent = container.parentElement;
  const strip = createListingFeaturedUnderPhotoStrip();
  if (parent && container.nextSibling) {
    parent.insertBefore(strip, container.nextSibling);
  } else if (parent) {
    parent.appendChild(strip);
  }
}
