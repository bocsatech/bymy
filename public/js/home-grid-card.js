import { escapeHtml, formatListingDisplayTitle } from "./listing-card.js";
import { listingDetailHref } from "./listing-return.js?v=hdView1";

function buildCardTitle(preview, item) {
  const raw =
    preview.title ||
    item.hirdetes_cime ||
    `Hirdetés #${item.id}`;
  // Soha ne essünk vissza a nyers Használtautó.hu / Belépés címre
  return formatListingDisplayTitle(raw) || `Hirdetés #${item.id}`;
}

function extractYearMonth(specLine, year) {
  const match = String(specLine || "").match(/\b((?:19|20)\d{2})\/(\d{1,2})\b/);
  if (match) return `${match[1]}/${match[2]}`;
  if (year) return String(year);
  return "";
}

function formatSpecYear(preview) {
  const year = preview.filter?.gyartasi_ev;
  if (year && year > 1900) return String(year);
  const match = String(preview.specLine || "").match(/\b((?:19|20)\d{2})\b/);
  return match ? match[1] : "—";
}

function formatFuelLabel(value) {
  const fuel = String(value ?? "").trim();
  if (!fuel) return "—";
  if (/^dízel$/i.test(fuel) || /^diesel$/i.test(fuel)) return "Dizel";
  return fuel;
}

function buildDisplayTitle(preview, item) {
  const base = buildCardTitle(preview, item);
  if (/\(\d{4}(?:\/\d{1,2})?\)/.test(base)) {
    return base.toUpperCase();
  }
  const yearMonth = extractYearMonth(preview.specLine, preview.filter?.gyartasi_ev);
  return yearMonth ? `${base.toUpperCase()} (${yearMonth})` : base.toUpperCase();
}

const ICON_CALENDAR = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="3.5" width="12" height="10.5" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M5 2v2.5M11 2v2.5M2 6.5h12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
const ICON_ODOMETER = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 5.8v2.6l1.8 1.1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="8" cy="8.5" r="1" fill="currentColor"/></svg>`;
const ICON_FUEL = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 3.5h6v9H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.2"/><path d="M9 6.5h1.8L13 9.2v3.3h-4V6.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M11.5 9.2h1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;

export function createHomeGridCard(item) {
  const preview = item.preview ?? {};
  const card = document.createElement("a");
  card.className = "home-grid-card";
  card.href = listingDetailHref(item.id);
  card.dataset.listingId = String(item.id);
  card.setAttribute("role", "listitem");

  const title = buildDisplayTitle(preview, item);
  const price = preview.price || "—";
  const km = preview.km || "—";
  const year = formatSpecYear(preview);
  const fuel = formatFuelLabel(preview.filter?.uzemanyag);
  const imageUrl = preview.imageUrl || item.fo_kep || "";
  const photoHtml = imageUrl
    ? `<img class="home-grid-card-photo-img" src="${escapeHtml(imageUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : "";

  card.innerHTML = `
    <div class="home-grid-card-media">
      <div class="home-grid-card-photo" aria-hidden="true">${photoHtml}</div>
      <span class="home-grid-card-save" aria-hidden="true">
        <svg width="18" height="16" viewBox="0 0 18 16" fill="none" aria-hidden="true">
          <path d="M9 14.5 1.8 8.2a4.2 4.2 0 0 1 0-5.9 4 4 0 0 1 5.7 0L9 3.3l1.5-1.5a4 4 0 0 1 5.7 5.9L9 14.5Z" stroke="currentColor" stroke-width="1.4"/>
        </svg>
      </span>
    </div>
    <div class="home-grid-card-body">
      <div class="home-grid-card-specs">
        <span class="home-grid-card-spec">${ICON_CALENDAR}<span>${escapeHtml(year)}</span></span>
        <span class="home-grid-card-spec">${ICON_ODOMETER}<span>${escapeHtml(km)}</span></span>
        <span class="home-grid-card-spec">${ICON_FUEL}<span>${escapeHtml(fuel)}</span></span>
      </div>
      <strong class="home-grid-card-price">${escapeHtml(price)}</strong>
      <h2 class="home-grid-card-title">${escapeHtml(title)}</h2>
    </div>
  `;

  return card;
}
