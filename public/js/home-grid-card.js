import { escapeHtml } from "./listing-card.js";
import { listingDetailHref } from "./listing-return.js?v=scrollTop1";
import {
  listingTileMeta,
  listingTilePrice,
  listingTileTitle,
} from "./listing-tile.js?v=coverAll1";

function collectPhotoUrls(item) {
  const preview = item.preview || {};
  const urls = [...(preview.imageUrls || [])];
  if (preview.imageUrl && !urls.includes(preview.imageUrl)) urls.unshift(preview.imageUrl);
  if (item.fo_kep && !urls.includes(item.fo_kep)) urls.unshift(item.fo_kep);
  return urls.filter(Boolean);
}

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
      (url) =>
        `<div class="home-grid-card-photo-slide"><img class="home-grid-card-photo-img" src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" /></div>`
    )
    .join("");
  return `<div class="home-grid-card-photo-track is-multi" tabindex="0" role="group" aria-label="Hirdetés képei">${slides}</div>`;
}

export function createHomeGridCard(item) {
  const card = document.createElement("article");
  card.className = "home-grid-card";
  card.dataset.listingId = String(item.id);
  card.setAttribute("role", "listitem");

  const title = listingTileTitle(item);
  const price = listingTilePrice(item);
  const meta = listingTileMeta(item);
  const photoUrls = collectPhotoUrls(item);
  const multi = photoUrls.length > 1;
  const detailHref = listingDetailHref(item.id);
  const desk = document.body?.getAttribute("data-site-page") === "auto";
  const preview = item?.preview || {};
  const form = item?.form || {};
  const yearNum = Number(preview.filter?.gyartasi_ev);
  const year =
    Number.isFinite(yearNum) && yearNum > 1900
      ? String(yearNum)
      : (() => {
          const m = String(preview.specLine || "").match(/\b((?:19|20)\d{2})\b/);
          return m ? m[1] : "";
        })();
  const km = String(preview.km || "").trim();
  const fuel = String(preview.filter?.uzemanyag || form.uzemanyag || "").trim();
  const city = String(preview.telepules || form.telepules || preview.city || "").trim();
  const subtitle = String(preview.specLine || form.modell || form.tipus || "")
    .trim()
    .replace(/\s*\(\d{4}(?:\/\d{1,2})?\)\s*$/u, "");

  const specsHtml = desk
    ? `<p class="home-grid-card-specs">
        ${year ? `<span class="home-grid-card-spec" data-spec="year">${escapeHtml(year)}</span>` : ""}
        ${km ? `<span class="home-grid-card-spec" data-spec="km">${escapeHtml(km)}</span>` : ""}
        ${fuel ? `<span class="home-grid-card-spec" data-spec="fuel">${escapeHtml(fuel)}</span>` : ""}
      </p>`
    : "";

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
      <button type="button" class="home-grid-card-save" aria-label="Kedvenc" data-desk-fav>
        <svg width="18" height="16" viewBox="0 0 18 16" fill="none" aria-hidden="true">
          <path d="M9 14.5 1.8 8.2a4.2 4.2 0 0 1 0-5.9 4 4 0 0 1 5.7 0L9 3.3l1.5-1.5a4 4 0 0 1 5.7 5.9L9 14.5Z" stroke="currentColor" stroke-width="1.4"/>
        </svg>
      </button>
    </div>
    <a class="home-grid-card-body" href="${escapeHtml(detailHref)}">
      <h2 class="home-grid-card-title">${escapeHtml(title)}</h2>
      ${desk && subtitle && subtitle !== title ? `<p class="home-grid-card-sub">${escapeHtml(subtitle)}</p>` : ""}
      ${specsHtml}
      <strong class="home-grid-card-price">${escapeHtml(price)}</strong>
      ${desk && city ? `<p class="home-grid-card-loc">${escapeHtml(city)}</p>` : ""}
      ${!desk && meta ? `<p class="home-grid-card-meta">${escapeHtml(meta)}</p>` : ""}
    </a>
  `;

  card.querySelector("[data-desk-fav]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.toggle("is-on");
  });

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
