import { fetchListings } from "./db-client.js?v=teherVert1";
import { createHomeGridCard, initHomeGridCardPhotos } from "./home-grid-card.js?v=tileFit1";
import {
  emptyFilters,
  filterListingsBySidebar,
  populateFilterOptions,
  initHomeSearchSidebar,
  initHomeFilterCatalog,
} from "./home-search-filter.js";
import { initHomeQuickSearch } from "./home-quicksearch.js?v=autoDrums15";
import {
  emptyIngatlanFilters,
  filterListingsByIngatlan,
  initIngatlanSearch,
} from "./ingatlan-search.js?v=scrollLock4";
import { filterByCategory, initHomeCategoryBar, renderHomeCategoryBar } from "./home-category-bar.js";
import { initHomeUnifiedScroll } from "./home-unified-scroll.js";
import { initHomeStatsBar } from "./home-stats-bar.js";
import { buildNearbyFilter, readNearbyPrefs } from "./nearby-search.js?v=nearby1";
import { getAuthUser } from "./site-auth.js?v=nearby1";
import { bindListingOpen, restoreListingReturn } from "./listing-return.js?v=scrollTop1";
import { applyNavCounts } from "./nav-counts.js?v=navCount2";

const gridTrack = document.getElementById("home-grid-track");
const emptyEl = document.getElementById("home-empty");
const filterForm = document.getElementById("home-filter-form");

const LISTINGS_FETCH_LIMIT = 50;

let allItems = [];
let sidebarFilters = emptyFilters();
let ingatlanFilters = emptyIngatlanFilters();
let categoryFilter = null;
let categoryUi = null;
let statsUi = null;
let statsFilter = null;

const PAGE = document.body?.getAttribute("data-site-page") || "";
if (gridTrack) bindListingOpen(gridTrack);

function initialTruckSubtypeFromUrl() {
  if (PAGE !== "teherauto") return null;
  const kat = new URLSearchParams(window.location.search).get("kategoria") || "35-alatt";
  return kat === "35-felett" ? "teherauto" : "kisteher";
}

let truckSubtypeFilter = initialTruckSubtypeFromUrl();

function initialCategoryFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("cat") || params.get("category") || null;
}

function scrollToListings() {
  const target = document.getElementById("home-category-bar") || gridTrack;
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function listingVertical(item) {
  const filter = item?.preview?.filter ?? {};
  const form = item?.form ?? {};
  const vertical = String(filter.hirdetes_vertical ?? form.hirdetes_vertical ?? "")
    .trim()
    .toLowerCase();
  const sub = String(filter.hirdetes_alkategoria ?? form.hirdetes_alkategoria ?? "")
    .trim()
    .toLowerCase();
  if (vertical === "teher" || vertical === "ingatlan" || vertical === "auto") {
    if (vertical === "auto" && (sub === "kisteher" || sub === "teherauto" || sub === "teher")) {
      return "teher";
    }
    return vertical;
  }
  if (sub === "kisteher" || sub === "teherauto" || sub === "teher") return "teher";
  if (sub === "ingatlan" || sub.startsWith("ingatlan")) return "ingatlan";
  return "auto";
}

function filterBySitePage(items) {
  // A szerver már vertical szerint szűr; itt csak biztonsági háló.
  if (PAGE === "teherauto") {
    return items.filter((item) => listingVertical(item) === "teher");
  }
  if (PAGE === "auto") {
    return items.filter((item) => listingVertical(item) !== "teher" && listingVertical(item) !== "ingatlan");
  }
  if (PAGE === "ingatlan") {
    return items.filter((item) => listingVertical(item) === "ingatlan");
  }
  return items;
}

function sortForHome(items) {
  return [...items].sort((a, b) => {
    const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });
}

function listingSubtype(item) {
  return String(
    item?.preview?.filter?.hirdetes_alkategoria ?? item?.form?.hirdetes_alkategoria ?? ""
  )
    .trim()
    .toLowerCase();
}

function filterByTruckSubtype(items) {
  if (PAGE !== "teherauto" || !truckSubtypeFilter) return items;
  return items.filter((item) => {
    const sub = listingSubtype(item);
    if (!sub) return true;
    return sub === truckSubtypeFilter;
  });
}

function filterItems(items) {
  let result = items;
  if (PAGE === "ingatlan") {
    result = filterListingsByIngatlan(result, ingatlanFilters);
  } else {
    result = filterListingsBySidebar(result, sidebarFilters);
    result = filterByCategory(result, categoryFilter);
    result = filterByTruckSubtype(result);
  }
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
      PAGE === "ingatlan"
        ? "Nincs találat ezekre a feltételekre. Próbálj kevesebb szűrőt, vagy adj fel ingatlan hirdetést."
        : "Még nincs hirdetés. Adj fel egyet a Hirdetésfeladáson, vagy importálj a hasznaltauto.hu listáról.";
  }

  for (const item of filtered) {
    gridTrack.appendChild(createHomeGridCard(item));
  }
  initHomeGridCardPhotos(gridTrack);
  restoreListingReturn();
}

function pageVerticalParam() {
  if (PAGE === "teherauto") return "teher";
  if (PAGE === "auto") return "auto";
  if (PAGE === "ingatlan") return "ingatlan";
  return null;
}

async function loadListings() {
  const all = await fetchListings({
    limit: LISTINGS_FETCH_LIMIT,
    status: "feladott",
    vertical: pageVerticalParam(),
  });
  const active = all.filter((item) => (item.status || "feladott") === "feladott");
  allItems = sortForHome(filterBySitePage(active));
  const vert = pageVerticalParam();
  if (vert === "auto" || vert === "teher" || vert === "ingatlan") {
    // Ha a /api/nav/counts elbukik vagy 0-t cache-el, a lista a forrás.
    applyNavCounts({ [vert]: active.length });
  }
  populateFilterOptions(allItems);
  renderListings(allItems);
  updateFilterResultCount();
  statsUi?.refreshActiveCount?.();
  // Ne görgessünk a listához betöltéskor — a lap a tetején maradjon (menüből nyitás).
  await applyNearbyFromUrl();
}

async function applyNearbyFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("nearby") !== "1") return;

  const prefs = readNearbyPrefs(getAuthUser()?.profile ?? null);
  const postal = (params.get("postal") || prefs.postal).replace(/\D/g, "").slice(0, 4);
  const radiusKm = Number(params.get("radius") || prefs.radiusKm);
  if (postal.length !== 4 || !Number.isFinite(radiusKm) || radiusKm <= 0) return;

  try {
    if (statsUi?.applyNearby) {
      await statsUi.applyNearby({ postal, radiusKm });
      return;
    }
    statsFilter = await buildNearbyFilter({
      items: allItems,
      postal,
      radiusKm,
    });
    categoryUi?.clear();
    categoryFilter = null;
    applyFilters();
    scrollToListings();
  } catch {
    /* ignore invalid nearby params */
  }
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
      filters.sebessegvalto ||
      filters.hajtas ||
      filters.tipus ||
      filters.features?.length ||
      filters.ev_jarat != null ||
      filters.ev_tol != null ||
      filters.ev_ig != null ||
      filters.ar_tol != null ||
      filters.ar_ig != null ||
      filters.km_tol != null ||
      filters.km_ig != null ||
      filters.le_tol != null ||
      filters.le_ig != null ||
      filters.ccm_tol != null ||
      filters.ccm_ig != null
  );
}

initHomeUnifiedScroll();

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

if (PAGE !== "ingatlan") {
  renderHomeCategoryBar(document.getElementById("home-category-bar"));
}

const initialCategory = PAGE === "ingatlan" ? null : initialCategoryFromUrl();

if (PAGE !== "ingatlan") {
  categoryUi = initHomeCategoryBar({
    onChange: (category) => {
      categoryFilter = category;
      applyFilters();
      if (category) scrollToListings();
    },
    getForm: () => filterForm,
    initialCategory,
  });
}

if (PAGE === "ingatlan") {
  initIngatlanSearch({
    onSearch: (values) => {
      ingatlanFilters = { ...emptyIngatlanFilters(), ...values };
      applyFilters();
    },
  });
} else {
  initHomeQuickSearch({
    onSearch: (values) => {
      sidebarFilters = { ...emptyFilters(), ...values };
      categoryUi?.clear();
      categoryFilter = null;
      applyFilters();
    },
  });
}

if (PAGE !== "ingatlan") {
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
      categoryUi?.clear();
      categoryFilter = null;
    }
    applyFilters();
  });
  sidebarFilters = readSidebarFilters?.() ?? emptyFilters();

  initHomeFilterCatalog(() => {
    sidebarFilters = readSidebarFilters?.() ?? emptyFilters();
    if (hasActiveSidebarFilters(sidebarFilters)) {
      categoryUi?.clear();
      categoryFilter = null;
    }
    applyFilters();
  }).catch((error) => console.error("Járműkatalógus (szűrő):", error));
}

import("./site-side-content.js")
  .then((mod) => mod.initSiteSideContent())
  .catch((error) => console.error("Oldalsáv betöltés:", error));

loadListings()
  .then(() => {
    let fromDetail = false;
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      fromDetail = !!(ref && ref.origin === window.location.origin && /\/hirdetes\.html$/i.test(ref.pathname));
    } catch {
      fromDetail = false;
    }
    if (!fromDetail && !new URLSearchParams(window.location.search).has("nearby")) {
      window.scrollTo(0, 0);
    }
  })
  .catch((error) => {
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
