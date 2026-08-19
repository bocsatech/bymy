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

function collectPhotoUrls(item) {
  const preview = item.preview || {};
  const urls = [...(preview.imageUrls || [])];
  if (preview.imageUrl && !urls.includes(preview.imageUrl)) urls.unshift(preview.imageUrl);
  if (item.fo_kep && !urls.includes(item.fo_kep)) urls.unshift(item.fo_kep);
  return urls.filter(Boolean);
}

const ICON_CALENDAR = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="3.5" width="12" height="10.5" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M5 2v2.5M11 2v2.5M2 6.5h12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
const ICON_ODOMETER = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 5.8v2.6l1.8 1.1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="8" cy="8.5" r="1" fill="currentColor"/></svg>`;
const ICON_FUEL = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 3.5h6v9H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.2"/><path d="M9 6.5h1.8L13 9.2v3.3h-4V6.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M11.5 9.2h1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
const ICON_CHEVRON_LEFT = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M11.2 4.2 6.4 9l4.8 4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_CHEVRON_RIGHT = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M6.8 4.2 11.6 9l-4.8 4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function buildPhotoMarkup(urls) {
  if (!urls.length) {
    return `<div class="home-grid-card-photo" aria-hidden="true"></div>`;
  }
  if (urls.length === 1) {
    return `<div class="home-grid-card-photo" aria-hidden="true"><img class="home-grid-card-photo-img" src="${escapeHtml(urls[0])}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" /></div>`;
  }
  const slides = urls
    .map(
      (url, index) =>
        `<div class="home-grid-card-photo-slide"><img class="home-grid-card-photo-img" src="${escapeHtml(url)}" alt="" loading="${index === 0 ? "lazy" : "lazy"}" decoding="async" referrerpolicy="no-referrer" /></div>`
    )
    .join("");
  return `<div class="home-grid-card-photo-track is-multi" tabindex="0" role="group" aria-label="Hirdetés képei">${slides}</div>`;
}

export function createHomeGridCard(item) {
  const preview = item.preview ?? {};
  const card = document.createElement("article");
  card.className = "home-grid-card";
  card.dataset.listingId = String(item.id);
  card.setAttribute("role", "listitem");

  const title = buildDisplayTitle(preview, item);
  const price = preview.price || "—";
  const km = preview.km || "—";
  const year = formatSpecYear(preview);
  const fuel = formatFuelLabel(preview.filter?.uzemanyag);
  const photoUrls = collectPhotoUrls(item);
  const multi = photoUrls.length > 1;
  const detailHref = listingDetailHref(item.id);

  card.innerHTML = `
    <div class="home-grid-card-media">
      ${buildPhotoMarkup(photoUrls)}
      ${
        multi
          ? `<span class="home-grid-card-photo-count" aria-live="polite">1 / ${photoUrls.length}</span>
             <button type="button" class="home-grid-card-photo-hit home-grid-card-photo-hit--prev" aria-label="Előző kép"></button>
             <button type="button" class="home-grid-card-photo-hit home-grid-card-photo-hit--next" aria-label="Következő kép"></button>
             <button type="button" class="home-grid-card-photo-nav home-grid-card-photo-nav--prev" aria-label="Előző kép">${ICON_CHEVRON_LEFT}</button>
             <button type="button" class="home-grid-card-photo-nav home-grid-card-photo-nav--next" aria-label="Következő kép">${ICON_CHEVRON_RIGHT}</button>`
          : ""
      }
      <span class="home-grid-card-save" aria-hidden="true">
        <svg width="18" height="16" viewBox="0 0 18 16" fill="none" aria-hidden="true">
          <path d="M9 14.5 1.8 8.2a4.2 4.2 0 0 1 0-5.9 4 4 0 0 1 5.7 0L9 3.3l1.5-1.5a4 4 0 0 1 5.7 5.9L9 14.5Z" stroke="currentColor" stroke-width="1.4"/>
        </svg>
      </span>
    </div>
    <a class="home-grid-card-body" href="${escapeHtml(detailHref)}">
      <div class="home-grid-card-specs">
        <span class="home-grid-card-spec">${ICON_CALENDAR}<span>${escapeHtml(year)}</span></span>
        <span class="home-grid-card-spec">${ICON_ODOMETER}<span>${escapeHtml(km)}</span></span>
        <span class="home-grid-card-spec">${ICON_FUEL}<span>${escapeHtml(fuel)}</span></span>
      </div>
      <strong class="home-grid-card-price">${escapeHtml(price)}</strong>
      <h2 class="home-grid-card-title">${escapeHtml(title)}</h2>
    </a>
  `;

  return card;
}

function bindPhotoTrack(track) {
  if (track.dataset.photosBound === "1") return;
  track.dataset.photosBound = "1";

  const media = track.closest(".home-grid-card-media");
  const counter = media?.querySelector(".home-grid-card-photo-count");
  const prevBtn = media?.querySelector(".home-grid-card-photo-nav--prev");
  const nextBtn = media?.querySelector(".home-grid-card-photo-nav--next");
  const prevHit = media?.querySelector(".home-grid-card-photo-hit--prev");
  const nextHit = media?.querySelector(".home-grid-card-photo-hit--next");
  const slides = [...track.querySelectorAll(".home-grid-card-photo-slide")];

  function currentIndex() {
    const width = track.clientWidth;
    if (!width) return 0;
    return Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / width)));
  }

  function updateUi() {
    const index = currentIndex();
    if (counter) counter.textContent = `${index + 1} / ${slides.length}`;
    const atStart = index <= 0;
    const atEnd = index >= slides.length - 1;
    if (prevBtn) prevBtn.hidden = atStart;
    if (nextBtn) nextBtn.hidden = atEnd;
    if (prevHit) prevHit.hidden = atStart;
    if (nextHit) nextHit.hidden = atEnd;
  }

  function scrollToIndex(index, { behavior = "smooth" } = {}) {
    const width = track.clientWidth;
    if (!width) return;
    const next = Math.max(0, Math.min(slides.length - 1, index));
    track.scrollTo({ left: next * width, behavior });
    window.requestAnimationFrame(updateUi);
  }

  function stopCardNav(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  track.addEventListener("scroll", () => window.requestAnimationFrame(updateUi), { passive: true });
  track.addEventListener("scrollend", updateUi, { passive: true });

  for (const btn of [prevBtn, nextBtn, prevHit, nextHit]) {
    btn?.addEventListener("click", stopCardNav);
  }

  prevBtn?.addEventListener("click", () => scrollToIndex(currentIndex() - 1));
  prevHit?.addEventListener("click", () => scrollToIndex(currentIndex() - 1));
  nextBtn?.addEventListener("click", () => scrollToIndex(currentIndex() + 1));
  nextHit?.addEventListener("click", () => scrollToIndex(currentIndex() + 1));

  track.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToIndex(currentIndex() - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollToIndex(currentIndex() + 1);
    }
  });

  let pointerId = null;
  let startX = 0;
  let startScroll = 0;
  let moved = false;

  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") return;
    if (event.button != null && event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScroll = track.scrollLeft;
    moved = false;
  });

  track.addEventListener("pointermove", (event) => {
    if (pointerId == null || event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    if (Math.abs(dx) <= 4) return;
    if (!moved) {
      moved = true;
      track.classList.add("is-dragging");
      try {
        track.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    }
    track.scrollLeft = startScroll - dx;
  });

  function endDrag(event) {
    if (pointerId == null || event.pointerId !== pointerId) return;
    pointerId = null;
    track.classList.remove("is-dragging");
    if (moved) {
      scrollToIndex(currentIndex(), { behavior: "instant" });
      track.dataset.suppressClick = "1";
      window.setTimeout(() => {
        delete track.dataset.suppressClick;
      }, 0);
    }
    updateUi();
  }

  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  track.addEventListener(
    "click",
    (event) => {
      if (track.dataset.suppressClick === "1") stopCardNav(event);
    },
    true
  );

  updateUi();
}

export function initHomeGridCardPhotos(root = document) {
  root.querySelectorAll(".home-grid-card-photo-track.is-multi").forEach(bindPhotoTrack);
}
