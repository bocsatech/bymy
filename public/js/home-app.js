import { fetchListings } from "./db-client.js";
import { createHomeGridCard } from "./home-grid-card.js";
import {
  emptyFilters,
  filterListingsBySidebar,
  populateFilterOptions,
  initHomeSearchSidebar,
  initHomeFilterCatalog,
} from "./home-search-filter.js";
import { filterByQuickPreset, initHomeQuickFilters } from "./home-quick-filters.js";
import { initHomeQuickSearch } from "./home-quicksearch.js";
import { filterByCategory, initHomeCategoryBar } from "./home-category-bar.js";
import { initHomeUnifiedScroll } from "./home-unified-scroll.js";
import { initHomeStatsBar } from "./home-stats-bar.js";

const gridTrack = document.getElementById("home-grid-track");
const emptyEl = document.getElementById("home-empty");
const filterForm = document.getElementById("home-filter-form");

const LISTINGS_FETCH_LIMIT = 500;

let allItems = [];
let sidebarFilters = emptyFilters();
let quickPreset = null;
let categoryFilter = null;
let quickFilterUi = null;
let categoryUi = null;
let statsUi = null;
let statsFilter = null;

function sortForHome(items) {
  return [...items].sort((a, b) => {
    const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });
}

function filterItems(items) {
  let result = filterListingsBySidebar(items, sidebarFilters);
  result = filterByQuickPreset(result, quickPreset);
  result = filterByCategory(result, categoryFilter);
  if (statsFilter) {
    result = result.filter((item) => statsFilter.listingIds.has(item.id));
  }
  return result;
}

function renderListings(items) {
  if (!gridTrack) return;

  gridTrack.innerHTML = "";

  const filtered = filterItems(items);
  emptyEl.hidden = filtered.length > 0;
  if (!filtered.length && statsFilter) {
    emptyEl.hidden = false;
    if (statsFilter.mode === "recent24h") {
      emptyEl.textContent = `Nincs új hirdetés ${statsFilter.origin.city} ${statsFilter.radiusKm} km-es körzetében az elmúlt 24 órában.`;
    } else {
      emptyEl.textContent = `Nincs hirdetés ${statsFilter.origin.city} ${statsFilter.radiusKm} km-es körzetében.`;
    }
  } else if (!filtered.length) {
    emptyEl.textContent =
      "Még nincs hirdetés. Importálj a hasznaltauto.hu listáról (Import oldal) — a mentett autók azonnal itt jelennek meg.";
  }

  for (const item of filtered) {
    gridTrack.appendChild(createHomeGridCard(item));
  }
}

async function loadListings() {
  const all = await fetchListings({ limit: LISTINGS_FETCH_LIMIT });
  allItems = sortForHome(all);
  populateFilterOptions(allItems);
  renderListings(allItems);
  updateFilterResultCount();
  statsUi?.refreshActiveCount?.();
}

function applyFilters() {
  renderListings(allItems);
  updateFilterResultCount();
}

function updateFilterResultCount() {
  const el = document.getElementById("filter-result-count");
  if (!el) return;
  el.textContent = filterItems(allItems).length.toLocaleString("hu-HU");
}

function hasActiveSidebarFilters(filters) {
  return Boolean(
    filters.gyartmany ||
      filters.modell ||
      filters.kivitel ||
      filters.uzemanyag ||
      filters.uzemanyagQuick ||
      filters.allapot ||
      filters.tipus ||
      filters.tipusKatalogus ||
      filters.features?.length ||
      filters.ev_jarat != null ||
      filters.ev_tol != null ||
      filters.ev_ig != null ||
      filters.ar_tol != null ||
      filters.ar_ig != null ||
      filters.km_tol != null ||
      filters.km_ig != null ||
      filters.ccm_tol != null ||
      filters.ccm_ig != null
  );
}

initHomeUnifiedScroll();

quickFilterUi = initHomeQuickFilters({
  onChange: (preset) => {
    quickPreset = preset;
    if (preset) {
      categoryUi?.clear();
      categoryFilter = null;
    }
    applyFilters();
  },
  getForm: () => filterForm,
});

categoryUi = initHomeCategoryBar({
  onChange: (category) => {
    categoryFilter = category;
    if (category) {
      quickPreset = null;
      quickFilterUi?.clear();
    }
    applyFilters();
  },
  getForm: () => filterForm,
});

initHomeQuickSearch({
  onSearch: (values) => {
    sidebarFilters = { ...emptyFilters(), ...values };
    quickPreset = null;
    quickFilterUi?.clear();
    categoryUi?.clear();
    categoryFilter = null;
    applyFilters();
  },
});

statsUi = initHomeStatsBar({
  onChange: (active) => {
    statsFilter = active;
    applyFilters();
  },
  getItems: () => allItems,
});

const readSidebarFilters = initHomeSearchSidebar((filters) => {
  sidebarFilters = filters;
  if (hasActiveSidebarFilters(filters)) {
    quickPreset = null;
    quickFilterUi?.clear();
    categoryUi?.clear();
    categoryFilter = null;
  }
  applyFilters();
});
sidebarFilters = readSidebarFilters?.() ?? emptyFilters();

initHomeFilterCatalog(() => {
  sidebarFilters = readSidebarFilters?.() ?? emptyFilters();
  if (hasActiveSidebarFilters(sidebarFilters)) {
    quickPreset = null;
    quickFilterUi?.clear();
    categoryUi?.clear();
    categoryFilter = null;
  }
  applyFilters();
}).catch((error) => console.error("Járműkatalógus (szűrő):", error));

import("./site-side-content.js")
  .then((mod) => mod.initSiteSideContent())
  .catch((error) => console.error("Oldalsáv betöltés:", error));

loadListings().catch((error) => {
  emptyEl.hidden = false;
  emptyEl.textContent = error.message ?? "Nem sikerült betölteni a hirdetéseket.";
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) loadListings().catch(() => {});
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    loadListings().catch(() => {});
  }
});
