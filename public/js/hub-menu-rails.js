import {
  HOME_CATEGORIES,
  autoCategoryHref,
  countListingsByHomeCategory,
} from "./home-category-bar.js?v=3c1365eaf4";
import {
  categoriesForVertical,
  partnerCategoryImageUrl,
} from "./partner-categories-data.js?v=b826a00c74";
import {
  fetchTilePagesUntil,
} from "./listing-tile-pager.js?v=248671f94e";

const IMG_V = "menuRails1";
const INITIAL_COUNT = 5;
const SCROLL_BATCH = 4;

/** data-auto-cat → darabszám (null = még nincs betöltve) */
let autoCategoryCounts = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function categoryListImageUrl(cat) {
  const file = String(cat.image || "").replace(/\.png$/i, "");
  return `/images/categories/list/${file}.jpg`;
}

function ajanlasListImageUrl(cat) {
  const full = partnerCategoryImageUrl(cat);
  const name = full.split("/").pop()?.replace(/\.png$/i, "") || "ajanlas-szerelo";
  return `/images/ajanlas/list/${name}.jpg`;
}

function categoryLabelText(cat) {
  const n = autoCategoryCounts?.[cat.id];
  if (n == null) return cat.label;
  return `${cat.label} ${n}`;
}

function applyAutoCategoryCounts(rail, counts) {
  if (!rail || !counts) return;
  for (const card of rail.querySelectorAll("[data-auto-cat]")) {
    const id = String(card.dataset.autoCat || "");
    const cat = HOME_CATEGORIES.find((row) => row.id === id);
    if (!cat) continue;
    const labelEl = card.querySelector(".hf-card-label");
    if (!labelEl) continue;
    const n = counts[id];
    labelEl.textContent = n == null ? cat.label : `${cat.label} ${n}`;
  }
}

function createCategoryCard(cat, { eager = false } = {}) {
  const link = document.createElement("a");
  link.className = "hf-card hf-card--ajanlas hf-card--kategoria";
  link.href = autoCategoryHref(cat.id);
  link.dataset.autoCat = cat.id;
  link.setAttribute("role", "listitem");
  const loading = eager ? "eager" : "lazy";
  const fetchPriority = eager ? ' fetchpriority="high"' : "";
  link.innerHTML = `
    <span class="hf-card-media"><img src="${escapeHtml(categoryListImageUrl(cat))}?v=${IMG_V}" alt="" width="360" height="220" loading="${loading}" decoding="async"${fetchPriority} /></span>
    <span class="hf-card-label">${escapeHtml(categoryLabelText(cat))}</span>`;
  return link;
}

function createAjanlasCard(cat, vertical, { eager = false } = {}) {
  const link = document.createElement("a");
  link.className = "hf-card hf-card--ajanlas";
  link.href = `/ajanlasok.html?vertical=${encodeURIComponent(vertical)}&cat=${encodeURIComponent(cat.id)}`;
  link.setAttribute("role", "listitem");
  const loading = eager ? "eager" : "lazy";
  const fetchPriority = eager ? ' fetchpriority="high"' : "";
  const imageSrc = `${ajanlasListImageUrl(cat)}?v=${IMG_V}`;
  link.innerHTML = `
    <span class="hf-card-media"><img src="${escapeHtml(imageSrc)}" alt="" width="400" height="400" loading="${loading}" decoding="async"${fetchPriority} /></span>
    <span class="hf-card-label">${escapeHtml(cat.label)}</span>`;
  return link;
}

function initProgressiveRail(rail, items, createCard) {
  if (!rail || rail.dataset.menuRailBound === "1") return;
  rail.dataset.menuRailBound = "1";

  let rendered = 0;
  let loadingMore = false;

  function appendNext(count) {
    if (loadingMore || rendered >= items.length) return;
    loadingMore = true;
    const end = Math.min(items.length, rendered + count);
    for (let i = rendered; i < end; i += 1) {
      rail.appendChild(createCard(items[i], { eager: i < 3 }));
    }
    rendered = end;
    loadingMore = false;
  }

  function onScroll() {
    if (rendered >= items.length) return;
    const nearEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 140;
    if (nearEnd) appendNext(SCROLL_BATCH);
  }

  const existing = rail.querySelectorAll(".hf-card").length;
  if (existing) {
    rendered = existing;
  } else {
    rail.innerHTML = "";
    appendNext(INITIAL_COUNT);
  }

  if (rail.dataset.menuLazyBound !== "1") {
    rail.dataset.menuLazyBound = "1";
    rail.addEventListener("scroll", onScroll, { passive: true });
  }

  const section = rail.closest(".hf-section");
  if (section && section.dataset.menuVisBound !== "1") {
    section.dataset.menuVisBound = "1";
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onScroll();
        }
      },
      { threshold: 0.05, rootMargin: "80px 0px" }
    );
    io.observe(section);
  }

  requestAnimationFrame(onScroll);
}

async function loadAutoCategoryCounts() {
  const rail = document.getElementById("hub-auto-kategoriak-rail");
  if (!rail) return;
  try {
    const page = await fetchTilePagesUntil({
      vertical: "auto",
      wantCount: 5000,
      maxPages: 80,
    });
    autoCategoryCounts = countListingsByHomeCategory(page.items || []);
    applyAutoCategoryCounts(rail, autoCategoryCounts);
  } catch (error) {
    console.warn("hub category counts:", error);
  }
}

function initAutoCategoriesRail() {
  const rail = document.getElementById("hub-auto-kategoriak-rail");
  if (!rail) return;
  initProgressiveRail(rail, HOME_CATEGORIES, createCategoryCard);
  void loadAutoCategoryCounts();
}

function initAjanlasRail(railId, vertical) {
  const rail = document.getElementById(railId);
  if (!rail) return;
  const items = categoriesForVertical(vertical);
  initProgressiveRail(rail, items, (cat, opts) => createAjanlasCard(cat, vertical, opts));
}

initAutoCategoriesRail();
initAjanlasRail("hub-ajanlas-ingatlan-rail", "ingatlan");
initAjanlasRail("hub-ajanlas-auto-rail", "auto");
