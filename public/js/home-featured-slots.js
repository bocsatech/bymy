import { escapeHtml } from "./listing-card.js";

/** Felső és alsó banner helyek — kiemelt hirdetések a saját listából. */
export const FEATURED_SLOT_IDS = [
  "header-left",
  "header-right",
  "grid-bottom-left",
  "grid-bottom-right",
];

const FEATURED_LABEL = "Kiemelt hirdetés";
const EMPTY_LABEL = "Kiemelt hirdetés helye";

function listingImage(item) {
  return item.preview?.imageUrl || item.fo_kep || "";
}

function hasListingImage(item) {
  return Boolean(listingImage(item));
}

function sortByRecent(items) {
  return [...items].sort((a, b) => {
    const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });
}

export function pickFeaturedListings(items, configuredIds = []) {
  const byId = new Map(items.map((item) => [item.id, item]));

  if (configuredIds.length) {
    return configuredIds
      .map((id) => byId.get(Number(id)))
      .filter((item) => item && hasListingImage(item))
      .slice(0, FEATURED_SLOT_IDS.length);
  }

  return sortByRecent(items.filter(hasListingImage)).slice(0, FEATURED_SLOT_IDS.length);
}

function resetFeaturedSlot(slotEl) {
  slotEl.classList.remove("is-filled", "is-featured-listing");

  const label = slotEl.querySelector(".home-ad-slot-label");
  if (label) label.textContent = FEATURED_LABEL;

  const link = slotEl.querySelector("[data-ad-link]");
  if (link) {
    link.hidden = true;
    link.removeAttribute("href");
    link.removeAttribute("title");
  }

  const img = slotEl.querySelector("[data-ad-image]");
  if (img) {
    img.removeAttribute("src");
    img.alt = "";
  }

  const placeholder = slotEl.querySelector("[data-ad-placeholder]");
  if (placeholder) {
    placeholder.hidden = false;
    placeholder.textContent = EMPTY_LABEL;
  }

  slotEl.querySelector(".home-featured-caption")?.remove();
}

function renderFeaturedSlot(slotEl, item) {
  const preview = item.preview ?? {};
  const imageUrl = listingImage(item);
  const title = preview.title || item.hirdetes_cime || `Hirdetés #${item.id}`;
  const price = preview.price || "";

  slotEl.classList.add("is-filled", "is-featured-listing");

  const label = slotEl.querySelector(".home-ad-slot-label");
  if (label) label.textContent = FEATURED_LABEL;

  const frame = slotEl.querySelector(".home-ad-slot-frame");
  const link = slotEl.querySelector("[data-ad-link]");
  const img = slotEl.querySelector("[data-ad-image]");
  const placeholder = slotEl.querySelector("[data-ad-placeholder]");

  if (link && img && imageUrl) {
    link.href = `/listings.html?id=${item.id}`;
    link.hidden = false;
    link.title = [title, price].filter(Boolean).join(" — ");
    img.src = imageUrl;
    img.alt = title;
  }

  if (placeholder) placeholder.hidden = true;

  frame?.querySelector(".home-featured-caption")?.remove();
  if (frame) {
    const caption = document.createElement("div");
    caption.className = "home-featured-caption";
    caption.innerHTML = `
      <strong class="home-featured-caption-title">${escapeHtml(title)}</strong>
      ${price ? `<span class="home-featured-caption-price">${escapeHtml(price)}</span>` : ""}
    `;
    frame.append(caption);
  }
}

async function loadFeaturedListingIds() {
  try {
    const response = await fetch("/api/site-blocks?page=home");
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data.featuredListingIds)) return [];
    return data.featuredListingIds.map(Number).filter((id) => id > 0);
  } catch {
    return [];
  }
}

export async function renderHomeFeaturedSlots(items) {
  const configuredIds = await loadFeaturedListingIds();
  const featured = pickFeaturedListings(items, configuredIds);

  for (let index = 0; index < FEATURED_SLOT_IDS.length; index += 1) {
    const slotEl = document.querySelector(`[data-ad-slot="${FEATURED_SLOT_IDS[index]}"]`);
    if (!slotEl) continue;
    const item = featured[index];
    if (item) renderFeaturedSlot(slotEl, item);
    else resetFeaturedSlot(slotEl);
  }
}
