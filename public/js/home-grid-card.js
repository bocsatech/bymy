import { escapeHtml } from "./listing-card.js?v=3e8a4a3fe2";
import { listingDetailHref } from "./listing-return.js?v=1911f0cb28";
import {
  listingTileMeta,
  listingTilePrice,
  listingTileTitle,
} from "./listing-tile.js?v=0633cb6729";
import { getAuthUser } from "./site-auth.js?v=20aa3f41c9";
import {
  getParkplatz,
  addParkplatzItem,
  removeParkplatzItem,
} from "./fok-data.js?v=289f64e75c";
import { listingFeaturedUnderPhotoHtml } from "./listing-featured-decor.js?v=e831c3517c";
import { listingShowsKiemeltDecor, promoTopAjanlatActive } from "./listing-promo.js?v=a2c84c124b";
import { listingImgFallbackAttr, listingImgSrcsetAttrs, listCardImageUrl } from "./image-variants.js?v=82833209fb";

const HU_COUNTY_KEYS = new Set(
  [
    "budapest",
    "pest",
    "fejer",
    "gyormosonsopron",
    "komaromesztergom",
    "veszprem",
    "baranya",
    "bacskiskun",
    "bekes",
    "borsodabaujzemplen",
    "csongradcsanad",
    "hajdubihar",
    "heves",
    "jasznagykunszolnok",
    "nograd",
    "somogy",
    "szabolcsszatmarbereg",
    "tolna",
    "vas",
    "zala",
  ]
);

function countyKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

function isCountyLabel(value) {
  const key = countyKey(value);
  if (!key || key === "budapest") return false;
  return HU_COUNTY_KEYS.has(key);
}

/** Kártyán csak település — megyenév / üres soha. */
function listingCardCity(item) {
  const preview = item?.preview || {};
  const form = item?.form || {};
  const filter = preview.filter || {};
  const candidates = [
    filter.telepules,
    form.telepules,
    preview.telepules,
    preview.city,
  ];
  for (const raw of candidates) {
    const v = String(raw ?? "").trim();
    if (v && !isCountyLabel(v)) return v;
  }
  const loc = String(preview.location || "").trim();
  if (loc) {
    const first = loc.split(",")[0].trim();
    if (first && !isCountyLabel(first)) return first;
  }
  return "";
}

function upgradeHaThumbClient(url) {
  let s = String(url || "").trim();
  if (!s) return "";
  if (s.startsWith("/api/media/proxy")) {
    try {
      const inner = new URL(s, location.origin).searchParams.get("url");
      if (inner) s = inner;
    } catch {
    }
  }
  if (/hasznaltautocdn\.com/i.test(s)) {
    const m = s.match(/\/(\d{5,12})\/(\d{5,12})\.(jpe?g|png|webp)/i);
    if (m) {
      const ext = m[3].toLowerCase().replace("jpeg", "jpg");
      return `https://img.hasznaltautocdn.com/2048x1536/${m[1]}/${m[2]}.${ext}`;
    }
    return s.replace(/\/\d{2,4}x\d{2,4}\//i, "/2048x1536/");
  }
  return s;
}

function parseClientPhotoList(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
      }
    } catch {
    }
  }
  return raw
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectPhotoUrls(item) {
  const preview = item.preview || {};
  const form = item.form || {};
  const urls = [...(preview.imageUrls || [])];
  if (preview.imageUrl && !urls.includes(preview.imageUrl)) urls.unshift(preview.imageUrl);
  const fo = String(item.fo_kep || "").trim();
  if (
    fo &&
    !urls.includes(fo) &&
    (/^https?:\/\//i.test(fo) || fo.startsWith("/api/media/proxy") || fo.startsWith("/uploads/"))
  ) {
    urls.unshift(fo);
  }
  for (const extra of parseClientPhotoList(form.fotok)) {
    if (extra && !urls.includes(extra)) urls.push(extra);
  }
  return [...new Set(urls.map(upgradeHaThumbClient).filter(Boolean))].slice(0, 5);
}

const ICON_YEAR = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const ICON_KM = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 18 12 6l8 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 18h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const ICON_POWER = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="13" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M12 13 16 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 6v1.5M5.5 10.5 6.6 11.2M18.5 10.5 17.4 11.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const ICON_CAMERA = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="13.5" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M8 7 9.2 5h5.6L16 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_PIN = `<svg width="12" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10" r="2.2" stroke="currentColor" stroke-width="1.6"/></svg>`;
const ICON_HEART = `<svg width="18" height="16" viewBox="0 0 18 16" fill="none" aria-hidden="true"><path d="M9 14.5 1.8 8.2a4.2 4.2 0 0 1 0-5.9 4 4 0 0 1 5.7 0L9 3.3l1.5-1.5a4 4 0 0 1 5.7 5.9L9 14.5Z" stroke="currentColor" stroke-width="1.4"/></svg>`;
const ICON_CHEVRON_LEFT = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M11.2 4.2 6.4 9l4.8 4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_CHEVRON_RIGHT = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M6.8 4.2 11.6 9l-4.8 4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function pickField(preview, form, key) {
  return String(preview?.filter?.[key] ?? form?.[key] ?? "").trim();
}

function formatPower(preview, form) {
  const le = Number(String(preview?.filter?.teljesitmeny_le ?? form?.teljesitmeny_le ?? "").replace(/\D/g, ""));
  const kw = Number(String(preview?.filter?.teljesitmeny_kw ?? form?.teljesitmeny_kw ?? "").replace(/\D/g, ""));
  if (Number.isFinite(le) && le > 0 && Number.isFinite(kw) && kw > 0) return `${le} LE (${kw} kW)`;
  if (Number.isFinite(le) && le > 0) return `${le} LE`;
  if (Number.isFinite(kw) && kw > 0) return `${kw} kW`;
  return "";
}

function cardSubtitle(preview, form) {
  const fuel = pickField(preview, form, "uzemanyag");
  const gear = pickField(preview, form, "sebessegvalto");
  return [fuel, gear].filter(Boolean).join(", ");
}

function isMobileCardViewport() {
  try {
    return window.matchMedia("(max-width: 900px)").matches;
  } catch {
    return false;
  }
}

/** Egy kép — mint a kezdőlap hf-card (nincs horizontal scrollport → Android lapgörgetés OK). */
function buildSinglePhotoMarkup(url) {
  const fb = listingImgFallbackAttr();
  if (!url) return `<div class="home-grid-card-photo" aria-hidden="true"></div>`;
  const sizes = "(max-width: 768px) 100vw, 640px";
  const src = listCardImageUrl(url) || url;
  const ss = listingImgSrcsetAttrs(url, { sizes });
  return `<div class="home-grid-card-photo" aria-hidden="true"><img class="home-grid-card-photo-img" src="${escapeHtml(src)}" alt="" width="640" height="400" loading="lazy" decoding="async" referrerpolicy="no-referrer" ${ss} ${fb} /></div>`;
}

function buildPhotoMarkup(urls, { singleOnly = false } = {}) {
  if (!urls.length) {
    return `<div class="home-grid-card-photo" aria-hidden="true"></div>`;
  }
  /* Mobil / single: kezdőlap-stílus — ne legyen overflow-x sáv a csempén. */
  if (urls.length === 1 || singleOnly) {
    return buildSinglePhotoMarkup(urls[0]);
  }
  const sizes = "(max-width: 768px) 100vw, 640px";
  const fb = listingImgFallbackAttr();
  const slides = urls
    .map((url) => {
      const src = listCardImageUrl(url) || url;
      const ss = listingImgSrcsetAttrs(url, { sizes });
      return `<div class="home-grid-card-photo-slide"><img class="home-grid-card-photo-img" src="${escapeHtml(src)}" alt="" width="640" height="400" loading="lazy" decoding="async" referrerpolicy="no-referrer" ${ss} ${fb} /></div>`;
    })
    .join("");
  return `<div class="home-grid-card-photo-track is-multi" tabindex="0" role="group" aria-label="Hirdetés képei">${slides}</div>`;
}

export function createHomeGridCard(item, { featured = false, topOffer = false, configuredFeaturedIds = null } = {}) {
  const showKiemelt =
    featured || listingShowsKiemeltDecor(item, configuredFeaturedIds);
  const showTop = topOffer || promoTopAjanlatActive(item);
  const card = document.createElement("article");
  card.className = showKiemelt ? "home-grid-card home-grid-card--featured" : "home-grid-card";
  card.dataset.listingId = String(item.id);
  card.setAttribute("role", "listitem");

  const title = listingTileTitle(item);
  const price = listingTilePrice(item);
  const meta = listingTileMeta(item);
  const photoUrls = collectPhotoUrls(item);
  /* Mobilon = kezdőlap: egy kép, nincs carousel (Android scroll trap). */
  const mobileSingle = isMobileCardViewport();
  const multi = !mobileSingle && photoUrls.length > 1;
  const detailHref = listingDetailHref(item.id);
  const page = document.body?.getAttribute("data-site-page");
  const desk = page === "auto" || page === "teherauto";
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
  const power = formatPower(preview, form);
  const subtitle = cardSubtitle(preview, form);
  const city = listingCardCity(item);
  const email = getAuthUser()?.email;
  const favOn = Boolean(
    email && getParkplatz(email).some((row) => String(row.id) === String(item.id))
  );

  const specsHtml = desk
    ? `<div class="home-grid-card-specs">
        <div class="home-grid-card-specs-row">
          ${year ? `<span class="home-grid-card-spec" data-spec="year">${ICON_YEAR}<span>${escapeHtml(year)}</span></span>` : ""}
          ${km ? `<span class="home-grid-card-spec" data-spec="km">${ICON_KM}<span>${escapeHtml(km)}</span></span>` : ""}
          ${power ? `<span class="home-grid-card-spec" data-spec="power">${ICON_POWER}<span>${escapeHtml(power)}</span></span>` : ""}
        </div>
      </div>`
    : "";

  card.innerHTML = `
    <div class="home-grid-card-media">
      ${buildPhotoMarkup(photoUrls, { singleOnly: mobileSingle })}
      ${
        multi
          ? `<span class="home-grid-card-photo-count" aria-live="polite">${ICON_CAMERA}<span>1/${photoUrls.length}</span></span>
             <button type="button" class="home-grid-card-photo-nav home-grid-card-photo-nav--prev" aria-label="Előző kép">${ICON_CHEVRON_LEFT}</button>
             <button type="button" class="home-grid-card-photo-nav home-grid-card-photo-nav--next" aria-label="Következő kép">${ICON_CHEVRON_RIGHT}</button>`
          : ""
      }
      <button type="button" class="home-grid-card-save${favOn ? " is-on" : ""}" aria-label="${favOn ? "Eltávolítás a kedvencekből" : "Kedvencekhez adás"}" aria-pressed="${favOn ? "true" : "false"}" data-desk-fav>
        ${ICON_HEART}
      </button>
    </div>
    <a class="home-grid-card-body" href="${escapeHtml(detailHref)}">
      ${showKiemelt || showTop ? listingFeaturedUnderPhotoHtml({ kiemelt: showKiemelt, topOffer: showTop }) : ""}
      <h2 class="home-grid-card-title">${escapeHtml(title)}</h2>
      ${desk && subtitle ? `<p class="home-grid-card-sub">${escapeHtml(subtitle)}</p>` : ""}
      <strong class="home-grid-card-price">${escapeHtml(price)}</strong>
      ${specsHtml}
      ${desk && city ? `<p class="home-grid-card-loc">${ICON_PIN}<span>${escapeHtml(city)}</span></p>` : ""}
      ${!desk && meta ? `<p class="home-grid-card-meta">${escapeHtml(meta)}</p>` : ""}
    </a>
  `;

  card.querySelector("[data-desk-fav]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const btn = event.currentTarget;
    const email = getAuthUser()?.email;
    if (!email) {
      const next = `${location.pathname}${location.search}`;
      window.location.href = `/belepes.html?next=${encodeURIComponent(next)}`;
      return;
    }
    const listingId = String(item.id);
    const on = btn.classList.contains("is-on");
    if (on) {
      removeParkplatzItem(email, listingId);
      btn.classList.remove("is-on");
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", "Kedvencekhez adás");
    } else {
      addParkplatzItem(email, {
        id: listingId,
        title,
        price,
        url: detailHref,
        imageUrl: photoUrls[0] || "",
      });
      btn.classList.add("is-on");
      btn.setAttribute("aria-pressed", "true");
      btn.setAttribute("aria-label", "Eltávolítás a kedvencekből");
    }
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
  const slides = [...track.querySelectorAll(".home-grid-card-photo-slide")];

  function currentIndex() {
    const width = track.clientWidth;
    if (!width) return 0;
    return Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / width)));
  }

  function updateUi() {
    const index = currentIndex();
    if (counter) {
      const label = counter.querySelector("span:last-child");
      const text = `${index + 1}/${slides.length}`;
      if (label) label.textContent = text;
      else counter.textContent = text;
    }
    const atStart = index <= 0;
    const atEnd = index >= slides.length - 1;
    if (prevBtn) prevBtn.hidden = atStart;
    if (nextBtn) nextBtn.hidden = atEnd;
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

  for (const btn of [prevBtn, nextBtn]) {
    btn?.addEventListener("click", stopCardNav);
  }

  prevBtn?.addEventListener("click", () => scrollToIndex(currentIndex() - 1));
  nextBtn?.addEventListener("click", () => scrollToIndex(currentIndex() + 1));

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
