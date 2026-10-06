import { fetchListings, fetchListingsPage, fetchRelatedListings } from "./db-client.js?v=d4237f0b1b";
import { createHomeGridCard, initHomeGridCardPhotos } from "./home-grid-card.js?v=f3c4783331";
import { promoKiemeltActive, promoTopAjanlatActive } from "./listing-promo.js?v=a2c84c124b";
import {
  emptyFilters,
  filterListingsBySidebar,
  populateFilterOptions,
  initHomeSearchSidebar,
  initHomeFilterCatalog,
} from "./home-search-filter.js?v=77d30b5c36";
import { initHomeQuickSearch } from "./home-quicksearch.js?v=fe06ec937e";
import { decodeSavedSearchParam, encodeSavedSearchParam } from "./saved-search.js?v=c636db31bd";
import { matchDetailedSearch, hasActiveDetailedSearch } from "./auto-detailed-search.js?v=24928b4442";
import { updateAutoDeskResultCount, updateAutoDeskAccSummaries } from "./auto-desk-search.js?v=f99edb6978";
import {
  emptyIngatlanFilters,
  filterListingsByIngatlan,
  initIngatlanSearch,
} from "./ingatlan-search.js?v=b7394ccb39";
import { normalizeIngatlanUzletag } from "./ingatlan-fields.js?v=3a43e30b61";
import { filterByCategory, initHomeCategoryBar, renderHomeCategoryBar, HOME_CATEGORY_IDS, searchFiltersForCategory } from "./home-category-bar.js?v=57b2d61f81";
import { initHomeUnifiedScroll } from "./home-unified-scroll.js?v=19bcc2aeb6";
import { initHomeStatsBar } from "./home-stats-bar.js?v=84ac6f75c1";
import { buildNearbyFilter, readNearbyPrefs } from "./nearby-search.js?v=0efee20d13";
import { getAuthUser } from "./site-auth.js?v=aad32d7596";
import {
  bindListingOpen,
  restoreListingReturn,
  saveVehicleSearchState,
  readVehicleSearchState,
  clearVehicleSearchState,
  consumeVehicleSearchRestorePending,
  shouldRestoreVehicleSearch,
  peekMapOpenOnReturn,
  consumeMapOpenOnReturn,
} from "./listing-return.js?v=1911f0cb28";
import { normalizeKivitel } from "./kivitel-options.js?v=be03aefc2e";
import { featuredListingIdSet, pickFeaturedListings } from "./home-featured-slots.js?v=76bf95d774";
import { mountSellerInventory, updateSellerInventoryCount } from "./seller-inventory.js?v=d0f6a9227f";

/** Map module is optional — only loaded when the user clicks the map button. */
let closeSearchResultsMapFn = null;
let mapModulePromise = null;
/** Lazy map loader — set for auto/teher pages. */
let ensureMapModule = null;
/** Utolsó lista DOM fingerprint — vissza/restore ne törölje ugyanazt a rácsot. */
let lastListingsRenderKey = "";
/** Vissza gomb: térkép ne csukódjon be restore közben / után. */
let suppressMapClose = false;
/** Vissza gomb: szűrő preview / üres onSearch ne törölje a restore-t. */
let searchRestoreInProgress = false;
/** Utolsó loadListings promise — térkép vissza ne fusson üres listával. */
let listingsReadyPromise = null;

function listingsForMap() {
  let items = [];
  try {
    items = currentFilteredListings();
  } catch {
    items = [];
  }
  if (items.length) return items;
  if (allItems?.length) {
    try {
      const filtered = filterItems(allItems);
      if (filtered.length) return filtered;
    } catch {
    }
  }
  return [...document.querySelectorAll("#home-grid-track [data-listing-id]")]
    .map((el) => el.__bymyListing)
    .filter(Boolean);
}

async function waitForListingsForMap(maxMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (listingsReadyPromise) {
      try {
        await listingsReadyPromise;
      } catch {
      }
    }
    if (typeof fillFilteredResults === "function") {
      try {
        await fillFilteredResults();
      } catch {
      }
    }
    const items = listingsForMap();
    if (items.length) return items;
    await new Promise((r) => setTimeout(r, 200));
  }
  return listingsForMap();
}

/** Nyitott térkép pinek frissítése, ha a lista később töltődött be. */
async function refreshOpenMapPins() {
  const root = document.getElementById("search-map-modal");
  if (!root || root.hidden) return;
  if (typeof ensureMapModule !== "function") return;
  const items = listingsForMap();
  if (!items.length) return;
  try {
    const mod = await ensureMapModule();
    await mod.refreshOpenSearchResultsMap(items, {
      mode: "filtered",
      preferHomeZoom: false,
    });
  } catch (error) {
    console.warn("Térkép pin frissítés:", error);
  }
}

async function reopenMapAfterReturn() {
  if (!peekMapOpenOnReturn() && !suppressMapClose) return;
  suppressMapClose = true;
  if (typeof ensureMapModule !== "function") return;

  try {
    const mod = await ensureMapModule();
    // Azonnal mutassuk a térkép panelt (üres / betöltés), ne várjuk a listát a UI előtt.
    let items = listingsForMap();
    if (!items.length) {
      await mod.openSearchResultsMap([], {
        mode: "filtered",
        preferHomeZoom: false,
        emptyHint: "Találatok betöltése a térképre…",
      });
    }
    if (listingsReadyPromise) {
      try {
        await listingsReadyPromise;
      } catch {
      }
    }
    items = items.length ? items : await waitForListingsForMap(8000);
    let result = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const useFiltered = Boolean(
        searchResultsCommitted || hasActiveClientFilters() || items.length
      );
      result = await mod.openSearchResultsMap(items, {
        mode: useFiltered ? "filtered" : "browse",
        preferHomeZoom: false,
      });
      if (!result?.stale && (result?.pins || 0) > 0) break;
      if (!result?.stale && items.length && (result?.pins || 0) === 0) {
        break;
      }
      await new Promise((r) => setTimeout(r, 400 + attempt * 250));
      if (listingsReadyPromise) {
        try {
          await listingsReadyPromise;
        } catch {
        }
      }
      items = await waitForListingsForMap(3000);
    }
    consumeMapOpenOnReturn();
    try {
      document
        .getElementById("search-map-modal")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch {
    }
  } catch (error) {
    console.warn("Térkép visszaállítás:", error);
  } finally {
    window.setTimeout(() => {
      suppressMapClose = false;
    }, 2500);
  }
}

const MAP_LABEL_BROWSE = "Autók a Közelben";
const MAP_LABEL_FILTERED = "Találatok a térképen";

function setMapButtonLabelsLocal(hasFilters) {
  const label = hasFilters ? MAP_LABEL_FILTERED : MAP_LABEL_BROWSE;
  document.querySelectorAll("[data-search-map-open]").forEach((btn) => {
    btn.textContent = label;
  });
}

let updateSearchMapButtonLabels = setMapButtonLabelsLocal;

function closeSearchMapDom() {
  if (suppressMapClose || peekMapOpenOnReturn()) return;
  closeSearchResultsMapFn?.();
  const root = document.getElementById("search-map-modal");
  if (root) root.hidden = true;
  document.body.classList.remove("search-map-open");
  document.querySelectorAll("[data-search-map-open]").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
  });
}

function syncCommittedSearchUrl(filters) {
  try {
    const url = new URL(window.location.href);
    const encoded = filters ? encodeSavedSearchParam(PAGE, filters) : "";
    if (encoded) url.searchParams.set("ss", encoded);
    else url.searchParams.delete("ss");
    const next = `${url.pathname}${url.search}${url.hash}`;
    const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== cur) history.replaceState(history.state, "", next);
  } catch {
  }
}

function persistCommittedSearch() {
  if (searchRestoreInProgress) return;
  if (!isVehicleSearchPage() || isSellerMode()) return;
  if (!searchResultsCommitted) {
    clearVehicleSearchState();
    syncCommittedSearchUrl(null);
    return;
  }
  const fromForm = quickSearchApi?.readQuickSearchValues?.() || {};
  const { detailed: formDetailed, ...formRest } = fromForm;
  const filters = {
    ...quickSearchFilters,
    ...formRest,
    detailed: formDetailed || detailedFilters || undefined,
  };
  if (!filters.gyartmanyok?.length && quickSearchFilters?.gyartmanyok?.length) {
    filters.gyartmanyok = quickSearchFilters.gyartmanyok;
  }
  if (!filters.modellek?.length && quickSearchFilters?.modellek?.length) {
    filters.modellek = quickSearchFilters.modellek;
  }
  const encoded = encodeSavedSearchParam(PAGE, filters);
  const cleaned = encoded ? decodeSavedSearchParam(encoded)?.filters : null;
  if (!cleaned || !Object.keys(cleaned).length) {
    saveVehicleSearchState({
      page: PAGE,
      committed: true,
      filters,
      deskSort: deskSort || "newest",
    });
    syncCommittedSearchUrl(filters);
    return;
  }
  saveVehicleSearchState({
    page: PAGE,
    committed: true,
    filters: cleaned,
    deskSort: deskSort || "newest",
  });
  syncCommittedSearchUrl(cleaned);
}

function applyRestoredFiltersToState(filters) {
  if (!filters || typeof filters !== "object") return false;
  const { detailed, ...sidebarValues } = filters;
  quickSearchFilters = { ...emptyFilters(), ...sidebarValues };
  detailedFilters = detailed ?? null;
  searchResultsCommitted = true;
  return true;
}

const gridTrack = document.getElementById("home-grid-track");
const emptyEl = document.getElementById("home-empty");
const filterForm = document.getElementById("home-filter-form");

const LISTINGS_INITIAL = 20;
const LISTINGS_PAGE_MORE = 10;
const FEATURED_POOL_MAX_PAGES = 8;

let allItems = [];
let listingsTotal = null;
let listingsHasMore = false;
let listingsLoadingMore = false;
let listingsOffset = 0;
let listingsLastFetchAt = 0;
const LISTINGS_VISIBLE_REFRESH_MS = 60_000;
let sidebarFilters = emptyFilters();
let quickSearchFilters = emptyFilters();
let ingatlanFilters = emptyIngatlanFilters();
let categoryFilter = null;
let categoryUi = null;
let statsUi = null;
let statsFilter = null;
let quickRadiusFilter = null;
let detailedFilters = null;
let deskSort = "newest";
let quickSearchApi = null;
let featuredListingIds = new Set();
let featuredOnlyMode = false;
let boostOwnerIds = new Set();
let boostListingIds = new Set();
/** Autó/teher: találatok csak „Találatok mutatása” után; addig kiemelt csempék. */
let searchResultsCommitted = false;
let listRenderCap = LISTINGS_INITIAL;
let browseFeaturedItems = [];

const PAGE = document.body?.getAttribute("data-site-page") || "";
if (gridTrack) bindListingOpen(gridTrack);
window.addEventListener("bymy-listing-open", () => {
  // Térkép / lista: mentsük a form aktuális szűrőit akkor is, ha még nem nyomtak
  // „Találatok mutatása”-t (csak előnézet / térkép szűrés).
  try {
    const values = quickSearchApi?.readQuickSearchValues?.() || {};
    const { detailed, ...sidebarValues } = values;
    const merged = { ...quickSearchFilters, ...sidebarValues };
    const has =
      hasActiveSidebarFilters(merged) ||
      (detailed && typeof hasActiveDetailedSearch === "function" && hasActiveDetailedSearch(detailed));
    if (has) {
      searchResultsCommitted = true;
      quickSearchFilters = { ...emptyFilters(), ...merged };
      if (detailed) detailedFilters = detailed;
    }
  } catch {
  }
  persistCommittedSearch();
});

/** Vissza gomb: szűrők azonnal a memóriában, még a lista-betöltés előtt. */
(function applyEarlySearchRestore() {
  if (PAGE !== "auto" && PAGE !== "teherauto") return;
  try {
    // Kategória csempe (?cat=) elsőbbség — ne írja felül a mentett keresés.
    if (new URLSearchParams(window.location.search).get("cat") || new URLSearchParams(window.location.search).get("category")) {
      return;
    }
    if (peekMapOpenOnReturn()) suppressMapClose = true;
    const ss = new URLSearchParams(window.location.search).get("ss");
    if (ss) {
      const decoded = decodeSavedSearchParam(ss);
      if (decoded?.filters && Object.keys(decoded.filters).length) {
        searchRestoreInProgress = true;
        applyRestoredFiltersToState(decoded.filters);
        return;
      }
    }
    if (!shouldRestoreVehicleSearch(PAGE)) return;
    const state = readVehicleSearchState();
    if (state?.filters && Object.keys(state.filters).length) {
      searchRestoreInProgress = true;
      applyRestoredFiltersToState(state.filters);
      if (state.deskSort) deskSort = state.deskSort;
    }
  } catch {
  }
})();

function sellerFromId() {
  return String(new URLSearchParams(window.location.search).get("hirdeto") || "").trim();
}

function isSellerMode() {
  return Boolean(sellerFromId());
}

function isVehicleSearchPage() {
  return PAGE === "auto" || PAGE === "teherauto";
}

/** Kiemelt böngésző mód: nincs commitolt találatlista. */
function isFeaturedBrowseMode() {
  return isVehicleSearchPage() && !searchResultsCommitted && !isSellerMode() && !featuredOnlyMode;
}

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

function resolveCategoryFromUrl() {
  const raw = String(initialCategoryFromUrl() || "").trim();
  if (!raw) return null;
  return HOME_CATEGORY_IDS.includes(raw) ? raw : null;
}

/** Kezdőoldal csempe → auto.html?cat=… — azonnal szűrt lista (ne a kiemelt böngésző). */
if (PAGE === "auto" || PAGE === "teherauto") {
  const fromUrl = resolveCategoryFromUrl();
  if (fromUrl) {
    categoryFilter = fromUrl;
    searchResultsCommitted = true;
  }
}

/** Kezdőoldal csempe → keresőmenü mezők (Üzemanyag stb.) megjelenítése. */
async function syncCategoryToSearchMenu(categoryId) {
  if (!categoryId || !isVehicleSearchPage()) return;
  const filters = searchFiltersForCategory(categoryId);
  if (!filters || !Object.keys(filters).length) return;
  const form = document.getElementById("home-qs-form") || filterForm;
  if (!form) return;
  try {
    if (quickSearchApi?.whenReady) await quickSearchApi.whenReady;
    const { mountAutoFuelPicker } = await import("./auto-fuel-picker.js?v=fafb6e20e0");
    if (window.matchMedia("(min-width: 901px)").matches) {
      await mountAutoFuelPicker(form);
    }
    const { applySavedSearchFilters } = await import("./saved-search.js?v=c636db31bd");
    await applySavedSearchFilters(form, filters);
    const { applyDrumSavedSearchFilters } = await import("./auto-search-drums.js?v=catFuelDrum1");
    applyDrumSavedSearchFilters(form, filters);
    updateAutoDeskAccSummaries(form);
    quickSearchFilters = { ...emptyFilters(), ...filters };
    form.querySelectorAll('[data-desk-field="uzemanyag"], [data-filter-key="uzemanyagok"]').forEach((el) => {
      el.closest?.(".auto-desk-field")?.classList.add("is-set");
    });
  } catch (error) {
    console.warn("Kategória → keresőmenü:", error);
  }
}

function scrollToListings() {
  if (isSellerMode()) {
    document.getElementById("seller-inv-root")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
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

function listingOwnerId(item) {
  return (
    Number(item?.form?.owner_user_id ?? item?.preview?.filter?.owner_user_id ?? item?.user_id ?? 0) || 0
  );
}

function isOwnerBoosted(item) {
  const id = Number(item?.id);
  if (Number.isFinite(id) && id > 0 && boostListingIds.has(id)) return true;
  if (item?.ownerBoost === true) return true;
  const oid = listingOwnerId(item);
  return oid > 0 && boostOwnerIds.has(oid);
}

/** Boost mindig előrébb; boostoltakon belül is a választott rendezés. Home kiemelés gombot nem érinti. */
function applyOwnerBoostSort(items, secondaryCompare) {
  if (featuredOnlyMode) return items;
  const cmp =
    typeof secondaryCompare === "function"
      ? secondaryCompare
      : (a, b) => {
          const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
          const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
          return tb - ta;
        };
  return [...items].sort((a, b) => {
    const aB = isOwnerBoosted(a) ? 0 : 1;
    const bB = isOwnerBoosted(b) ? 0 : 1;
    if (aB !== bB) return aB - bB;
    return cmp(a, b);
  });
}

function readDeskSort() {
  const el = document.querySelector("[data-desk-sort]");
  const fromDom = String(el?.value || "").trim();
  if (fromDom) return fromDom;
  return deskSort || "newest";
}

function listingPriceNum(item) {
  const fromNum = Number(item?.preview?.priceNum);
  if (Number.isFinite(fromNum) && fromNum > 0) return fromNum;
  const raw = String(item?.preview?.price ?? item?.form?.vetelar ?? "").replace(/\D/g, "");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function listingKmNum(item) {
  const fromNum = Number(item?.preview?.kmNum);
  if (Number.isFinite(fromNum) && fromNum >= 0) return fromNum;
  const raw = String(item?.preview?.km ?? item?.form?.km ?? "").replace(/\D/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function sortDeskListings(items) {
  deskSort = readDeskSort();
  let secondary;
  if (deskSort === "price-asc") {
    secondary = (a, b) => (listingPriceNum(a) ?? Infinity) - (listingPriceNum(b) ?? Infinity);
  } else if (deskSort === "price-desc") {
    secondary = (a, b) => (listingPriceNum(b) ?? -1) - (listingPriceNum(a) ?? -1);
  } else if (deskSort === "km-asc") {
    secondary = (a, b) => (listingKmNum(a) ?? Infinity) - (listingKmNum(b) ?? Infinity);
  } else {
    secondary = (a, b) => {
      const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
      return tb - ta;
    };
  }
  return applyOwnerBoostSort(items, secondary);
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

function mergedVehicleFilters() {
  const merged = { ...emptyFilters(), ...sidebarFilters };
  if (hasActiveSidebarFilters(quickSearchFilters)) {
    Object.assign(merged, quickSearchFilters);
  }
  return merged;
}

function filterItems(items) {
  if (isSellerMode()) return items;
  let result = items;
  if (PAGE === "ingatlan") {
    result = filterListingsByIngatlan(result, ingatlanFilters);
  } else {
    result = filterListingsBySidebar(result, mergedVehicleFilters());
    if (detailedFilters && hasActiveDetailedSearch(detailedFilters)) {
      result = result.filter((item) => matchDetailedSearch(item, detailedFilters));
    }
    result = filterByCategory(result, categoryFilter);
    result = filterByTruckSubtype(result);
  }
  if (statsFilter) {
    result = result.filter((item) => statsFilter.listingIds.has(item.id));
  } else if (quickRadiusFilter) {
    result = result.filter((item) => quickRadiusFilter.listingIds.has(item.id));
  }
  if (featuredOnlyMode) {
    result = result.filter((item) => featuredListingIds.has(Number(item.id)));
  }
  return result;
}

function currentFilteredListings() {
  const filtered = filterItems(allItems);
  if (PAGE === "auto" || PAGE === "teherauto") return sortDeskListings(filtered);
  return applyOwnerBoostSort(filtered);
}

function renderListings(items, { bypassFilters = false, force = false } = {}) {
  if (!gridTrack) return;

  const fullFiltered = bypassFilters
    ? [...(items || [])]
    : PAGE === "auto" || PAGE === "teherauto"
      ? sortDeskListings(filterItems(items))
      : applyOwnerBoostSort(filterItems(items));
  const filtered =
    !bypassFilters && (PAGE === "auto" || PAGE === "teherauto") && searchResultsCommitted
      ? fullFiltered.slice(0, listRenderCap)
      : fullFiltered;

  const renderKey = `${bypassFilters ? "b" : "f"}:${deskSort}:${searchResultsCommitted ? 1 : 0}:${listRenderCap}:${fullFiltered.length}:${filtered
    .map((item) => String(item?.id ?? ""))
    .join(",")}`;
  if (
    !force &&
    renderKey === lastListingsRenderKey &&
    gridTrack.childElementCount === filtered.length &&
    filtered.length > 0
  ) {
    if (PAGE === "auto" || PAGE === "teherauto") {
      if (bypassFilters || isFeaturedBrowseMode()) updateDeskResultCount(filterItems(allItems));
      else updateDeskResultCount(fullFiltered);
    }
    return;
  }

  gridTrack.innerHTML = "";
  lastListingsRenderKey = renderKey;

  emptyEl.hidden = filtered.length > 0;
  if (!filtered.length && bypassFilters && isFeaturedBrowseMode()) {
    emptyEl.hidden = false;
    emptyEl.textContent = "Nincs kiemelt hirdetés.";
  } else if (!filtered.length && (statsFilter || quickRadiusFilter)) {
    emptyEl.hidden = false;
    const radiusMeta = statsFilter || quickRadiusFilter;
    if (statsFilter?.mode === "recent24h") {
      emptyEl.textContent = `Nincs új hirdetés ${radiusMeta.origin.city} ${radiusMeta.radiusKm} km-es körzetében az elmúlt 24 órában.`;
    } else {
      emptyEl.textContent = `Nincs hirdetés ${radiusMeta.origin?.city || ""} ${radiusMeta.radiusKm} km-es körzetében.`;
    }
  } else if (!filtered.length && featuredOnlyMode) {
    emptyEl.textContent = "Jelenleg nincs kiemelt autó hirdetés.";
  } else if (!filtered.length && isSellerMode()) {
    emptyEl.textContent = "Ennek a hirdetőnek jelenleg nincs aktív hirdetése.";
  } else if (!filtered.length) {
    emptyEl.textContent =
      PAGE === "ingatlan"
        ? "Nincs találat ezekre a feltételekre. Próbálj kevesebb szűrőt, vagy adj fel ingatlan hirdetést."
        : "Nincs találat ezekre a feltételekre. Próbálj kevesebb szűrőt, vagy adj fel hirdetést.";
  }

  if (PAGE === "auto" || PAGE === "teherauto") {
    if (bypassFilters || isFeaturedBrowseMode()) {
      updateDeskResultCount(filterItems(allItems));
    } else {
      updateDeskResultCount(fullFiltered);
    }
  }
  if (PAGE === "ingatlan") {
    const el = document.querySelector("[data-immo-result-count]");
    if (el) el.textContent = `${filtered.length} találat`;
  }

  for (const item of filtered) {
    const card = createHomeGridCard(item, {
      featured: featuredListingIds.has(Number(item.id)) || promoKiemeltActive(item),
      topOffer: promoTopAjanlatActive(item),
      configuredFeaturedIds: featuredListingIds,
    });
    card.__bymyListing = item;
    gridTrack.appendChild(card);
  }
  initHomeGridCardPhotos(gridTrack);
  restoreListingReturn();
}

function renderFeaturedBrowse() {
  browseFeaturedItems = sortDeskListings(pickFeaturedListings(allItems));
  featuredListingIds = featuredListingIdSet(allItems);
  /* Nincs kiemelt: ne hagyjunk üres rácsot 530-as számmal — mutassuk a listát. */
  if (!browseFeaturedItems.length && allItems.length) {
    searchResultsCommitted = true;
    renderListings(allItems);
    updateFilterResultCount();
    updateSearchMapButtonLabels(true);
    return;
  }
  renderListings(browseFeaturedItems, { bypassFilters: true });
  updateFilterResultCount();
  updateSearchMapButtonLabels(searchResultsCommitted || hasActiveClientFilters());
}

function pageVerticalParam() {
  if (PAGE === "teherauto") return "teher";
  if (PAGE === "auto") return "auto";
  if (PAGE === "ingatlan") return "ingatlan";
  return null;
}

async function loadSellerListings(fromId) {
  if (!gridTrack) return;
  if (emptyEl) {
    emptyEl.hidden = true;
    emptyEl.textContent = "";
  }
  if (PAGE === "ingatlan") {
    ingatlanFilters = { ...emptyIngatlanFilters(), ingatlan_uzletag: "" };
  }
  categoryFilter = null;
  featuredOnlyMode = false;
  statsFilter = null;
  quickRadiusFilter = null;
  const shellPromise = mountSellerInventory({ fromId, count: 0 });
  const itemsPromise = fetchRelatedListings(fromId, { limit: 500, includeSelf: true });
  const [, items] = await Promise.all([shellPromise, itemsPromise]);
  const active = (items || []).filter((item) => (item.status || "feladott") === "feladott");
  allItems = sortForHome(active);
  featuredListingIds = featuredListingIdSet(allItems);
  populateFilterOptions(allItems);
  renderListings(allItems);
  updateSellerInventoryCount(allItems.length);
  updateFilterResultCount();
  statsUi?.refreshActiveCount?.();
  scrollToListings();
}

async function loadListings() {
  const run = async () => {
  const sellerFrom = sellerFromId();
  if (sellerFrom) {
    await loadSellerListings(sellerFrom);
    listingsLastFetchAt = Date.now();
    return;
  }
  listingsLoadingMore = false;
  listingsOffset = 0;
  listingsHasMore = false;
  listingsTotal = null;
  const page = await fetchListingsPage({
    limit: LISTINGS_INITIAL,
    offset: 0,
    status: "feladott",
    vertical: pageVerticalParam(),
    tile: true,
    sort: readDeskSort(),
  });
  listingsLastFetchAt = Date.now();
  if (Array.isArray(page.boostOwnerIds)) {
    boostOwnerIds = new Set(page.boostOwnerIds.map(Number).filter((n) => n > 0));
  }
  boostListingIds = new Set(
    (Array.isArray(page.boostListingIds) ? page.boostListingIds : [])
      .map(Number)
      .filter((n) => n > 0)
  );
  for (const item of page.listings || []) {
    if (item?.ownerBoost === true) {
      const id = Number(item.id);
      if (id > 0) boostListingIds.add(id);
    }
  }
  const active = (page.listings || []).filter((item) => (item.status || "feladott") === "feladott");
  // Ne rendezünk újra newest-re itt — a render boost+desk sortot alkalmaz.
  allItems = filterBySitePage(active);
  listingsOffset = (Number(page.offset) || 0) + (page.listings?.length || 0);
  listingsTotal = page.total != null ? Number(page.total) : allItems.length;
  listingsHasMore = Boolean(page.hasMore);
  featuredListingIds = featuredListingIdSet(allItems);
  populateFilterOptions(allItems);

  if (isFeaturedBrowseMode()) {
    // Először rajzoljunk — a többi lap háttérben, ne fagyjon a UI.
    if (!searchRestoreInProgress) renderFeaturedBrowse();
  } else {
    renderListings(allItems);
  }

  updateFilterResultCount();
  statsUi?.refreshActiveCount?.();
  updateSearchMapButtonLabels(searchResultsCommitted || hasActiveClientFilters());
  bindListingsInfiniteScroll();
  bindListingsScrollHide();
  await applyNearbyFromUrl();
  applyFeaturedFromUrl();
  if (searchResultsCommitted && hasActiveClientFilters()) {
    const grew = await fillFilteredResults();
    if (grew || searchRestoreInProgress) renderListings(allItems);
    void fillMatchPoolSilent();
  }
  if (!searchRestoreInProgress) await refreshOpenMapPins();

  if (isFeaturedBrowseMode()) {
    void fillFeaturedBrowsePool();
  }
  };
  listingsReadyPromise = run();
  return listingsReadyPromise;
}

async function fillFeaturedBrowsePool() {
  if (!isFeaturedBrowseMode()) return;
  let guard = 0;
  while (listingsHasMore && guard < FEATURED_POOL_MAX_PAGES && isFeaturedBrowseMode()) {
    guard += 1;
    const before = allItems.length;
    const beforeFeatured = pickFeaturedListings(allItems).length;
    await loadMoreListings({ silent: true });
    if (allItems.length === before) break;
    if (!searchRestoreInProgress && isFeaturedBrowseMode()) {
      const afterFeatured = pickFeaturedListings(allItems).length;
      if (afterFeatured !== beforeFeatured) renderFeaturedBrowse();
    }
    // Engedjük a böngészőt festeni / kattintani a következő oldal előtt.
    await new Promise((r) => window.setTimeout(r, 0));
  }
  if (!searchRestoreInProgress && isFeaturedBrowseMode()) renderFeaturedBrowse();
}

function mergeListings(existing, incoming) {
  const seen = new Set(existing.map((item) => Number(item.id)));
  const next = [...existing];
  for (const item of incoming) {
    const id = Number(item.id);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    next.push(item);
  }
  return next;
}

async function loadMoreListings({ silent = false } = {}) {
  if (isSellerMode()) return;
  if (!listingsHasMore || listingsLoadingMore) return;
  if (PAGE !== "auto" && PAGE !== "teherauto" && PAGE !== "ingatlan") return;
  if (!silent && isFeaturedBrowseMode()) return;
  listingsLoadingMore = true;
  try {
    let guard = 0;
    while (listingsHasMore && guard < 20) {
      guard += 1;
      const page = await fetchListingsPage({
        limit: LISTINGS_PAGE_MORE,
        offset: listingsOffset,
        status: "feladott",
        vertical: pageVerticalParam(),
        tile: true,
        sort: readDeskSort(),
      });
      if (Array.isArray(page.boostOwnerIds) && page.boostOwnerIds.length) {
        for (const id of page.boostOwnerIds) {
          const n = Number(id);
          if (n > 0) boostOwnerIds.add(n);
        }
      }
      if (Array.isArray(page.boostListingIds)) {
        for (const id of page.boostListingIds) {
          const n = Number(id);
          if (n > 0) boostListingIds.add(n);
        }
      }
      for (const item of page.listings || []) {
        if (item?.ownerBoost === true) {
          const id = Number(item.id);
          if (id > 0) boostListingIds.add(id);
        }
      }
      const active = (page.listings || []).filter((item) => (item.status || "feladott") === "feladott");
      const batch = filterBySitePage(active);
      const got = Math.max(page.listings?.length || 0, 1);
      listingsOffset = (Number(page.offset) || listingsOffset) + got;
      if (page.total != null) listingsTotal = Number(page.total);
      listingsHasMore = Boolean(page.hasMore);
      if (!batch.length) {
        if (!listingsHasMore) break;
        continue;
      }
      allItems = mergeListings(allItems, batch);
      featuredListingIds = featuredListingIdSet(allItems);
      if (!silent) {
        populateFilterOptions(allItems);
        listRenderCap = Math.max(listRenderCap, LISTINGS_INITIAL);
        if (isFeaturedBrowseMode()) renderFeaturedBrowse();
        else renderListings(allItems);
        updateFilterResultCount();
        statsUi?.refreshActiveCount?.();
        void refreshOpenMapPins();
      }
      break;
    }
  } catch (error) {
    console.warn("Lista folytatás:", error);
  } finally {
    listingsLoadingMore = false;
  }
}

function formLooksFiltered() {
  const form = document.getElementById("home-qs-form");
  if (!form) return false;
  const controls = form.querySelectorAll(
    "select[data-filter-key], select[name], input[data-filter-key]:not([type='hidden']), input[name]:not([type='hidden'])"
  );
  for (const el of controls) {
    const v = String(el.value || "").trim();
    if (!v) continue;
    if (/^mindegy$/i.test(v)) continue;
    return true;
  }
  /* Only desk field "is-set" markers — not unrelated aria-pressed toggles in the form. */
  return Boolean(form.querySelector(".auto-desk-field.is-set, [data-desk-field].is-set"));
}

function hasActiveClientFilters() {
  if (featuredOnlyMode || statsFilter || quickRadiusFilter || categoryFilter) return true;
  if (PAGE === "ingatlan") {
    return Object.values(ingatlanFilters || {}).some((v) => v != null && v !== "");
  }
  if (hasActiveSidebarFilters(mergedVehicleFilters())) return true;
  if (detailedFilters && hasActiveDetailedSearch(detailedFilters)) return true;
  if (formLooksFiltered()) return true;
  return false;
}

function updateDeskResultCount(filtered) {
  if (PAGE !== "auto" && PAGE !== "teherauto") return;
  if (hasActiveClientFilters()) {
    const n = Array.isArray(filtered) ? filtered.length : Number(filtered) || 0;
    updateAutoDeskResultCount(n);
    return;
  }
  const total = listingsTotal != null ? Number(listingsTotal) : NaN;
  if (Number.isFinite(total)) {
    updateAutoDeskResultCount(total);
    return;
  }
  const n = Array.isArray(filtered) ? filtered.length : Number(filtered) || 0;
  updateAutoDeskResultCount(n);
}

async function fillMatchPoolSilent() {
  if (!hasActiveClientFilters()) return;
  let guard = 0;
  while (listingsHasMore && guard < 80) {
    guard += 1;
    const before = allItems.length;
    await loadMoreListings({ silent: true });
    if (allItems.length === before) break;
    updateDeskResultCount(filterItems(allItems));
    await new Promise((r) => window.setTimeout(r, 0));
  }
  updateDeskResultCount(filterItems(allItems));
}

async function fillFilteredResults() {
  if (!searchResultsCommitted && isVehicleSearchPage()) return;
  let guard = 0;
  let grew = false;
  while (
    hasActiveClientFilters() &&
    listingsHasMore &&
    filterItems(allItems).length < LISTINGS_INITIAL &&
    guard < 40
  ) {
    guard += 1;
    const before = allItems.length;
    await loadMoreListings({ silent: true });
    if (allItems.length === before) break;
    grew = true;
  }
  return grew;
}

function previewFilterCountsOnly() {
  updateDeskResultCount(filterItems(allItems));
  updateFilterResultCount();
  updateSearchMapButtonLabels(searchResultsCommitted || hasActiveClientFilters());
  if (isFeaturedBrowseMode()) {
    browseFeaturedItems = sortDeskListings(pickFeaturedListings(allItems));
    featuredListingIds = featuredListingIdSet(allItems);
  }
}

function applyFilters({ commit = false } = {}) {
  if (searchRestoreInProgress && !commit) {
    previewFilterCountsOnly();
    return;
  }
  if (commit && isVehicleSearchPage() && !isSellerMode()) {
    searchResultsCommitted = true;
    listRenderCap = LISTINGS_INITIAL;
    closeSearchMapDom();
  }

  if (isFeaturedBrowseMode()) {
    previewFilterCountsOnly();
    renderFeaturedBrowse();
    if (commit) persistCommittedSearch();
    return;
  }

  renderListings(allItems);
  updateFilterResultCount();
  if (PAGE === "auto" || PAGE === "teherauto") {
    updateSearchMapButtonLabels(searchResultsCommitted || hasActiveClientFilters());
  }
  if (hasActiveClientFilters()) {
    void fillFilteredResults().then((grew) => {
      if (grew) renderListings(allItems);
    });
  }
  if (commit) persistCommittedSearch();
}

function bindListingsInfiniteScroll() {
  if (bindListingsInfiniteScroll.bound) return;
  bindListingsInfiniteScroll.bound = true;

  const nearEnd = (el) => {
    if (!el) return false;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 560;
  };

  const onScroll = () => {
    if (listingsLoadingMore) return;
    if (isFeaturedBrowseMode()) return;
    const filteredN = filterItems(allItems).length;
    if ((PAGE === "auto" || PAGE === "teherauto") && listRenderCap < filteredN) {
      const panel = document.querySelector(".home-listings-panel");
      const nearPanel = panel && panel.scrollHeight > panel.clientHeight + 40
        ? panel.scrollHeight - panel.scrollTop - panel.clientHeight < 560
        : false;
      const nearDoc = document.documentElement.scrollHeight - window.scrollY - window.innerHeight < 720;
      if (nearPanel || nearDoc) {
        listRenderCap += LISTINGS_PAGE_MORE;
        renderListings(allItems, { force: true });
      }
      return;
    }
    if (!listingsHasMore) return;
    const panel = document.querySelector(".home-listings-panel");
    if (panel && panel.scrollHeight > panel.clientHeight + 40) {
      if (nearEnd(panel)) void loadMoreListings();
      return;
    }
    const doc = document.documentElement;
    if (doc.scrollHeight - window.scrollY - window.innerHeight < 720) {
      void loadMoreListings();
    }
  };

  document.querySelector(".home-listings-panel")?.addEventListener("scroll", onScroll, {
    passive: true,
  });
  window.addEventListener("scroll", onScroll, { passive: true });
}

/** Görgetés közben a kategória-csempék elrejtése — a hirdetések maradnak. */
function bindListingsScrollHide() {
  if (bindListingsScrollHide.bound) return;
  if (PAGE !== "teherauto") return;
  if (!document.getElementById("home-category-bar")) return;
  bindListingsScrollHide.bound = true;

  let stopTimer = 0;
  let scrolling = false;

  const applyHide = (on) => {
    if (scrolling === on) return;
    scrolling = on;
    document.body.classList.toggle("is-cat-scrolling", on);
    const bar = document.getElementById("home-category-bar");
    bar?.classList.toggle("is-cat-scrolling", on);
    if (!bar) return;
    if (on) {
      bar.style.setProperty("opacity", "0", "important");
      bar.style.setProperty("pointer-events", "none", "important");
    } else {
      bar.style.removeProperty("opacity");
      bar.style.removeProperty("pointer-events");
    }
  };

  const onScrollActivity = () => {
    applyHide(true);
    window.clearTimeout(stopTimer);
    stopTimer = window.setTimeout(() => applyHide(false), 180);
  };

  const panel = document.querySelector(".home-listings-panel");
  for (const t of [panel, window, document].filter(Boolean)) {
    t.addEventListener("scroll", onScrollActivity, { passive: true, capture: true });
  }
  panel?.addEventListener("wheel", onScrollActivity, { passive: true });
  panel?.addEventListener("touchmove", onScrollActivity, { passive: true });
  document.getElementById("home-category-bar")?.addEventListener("wheel", onScrollActivity, { passive: true });
  document.addEventListener(
    "scroll",
    (event) => {
      const t = event.target;
      if (!(t instanceof Element)) return;
      if (
        t.classList?.contains("home-listings-panel") ||
        t.classList?.contains("home-category-track") ||
        t.id === "home-category-bar" ||
        t.closest?.(".home-listings-panel") ||
        t.closest?.(".home-category-bar")
      ) {
        onScrollActivity();
      }
    },
    { passive: true, capture: true }
  );
}

async function applyNearbyFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("nearby") !== "1") return;

  const prefs = readNearbyPrefs(getAuthUser()?.profile ?? null);
  const postal = (params.get("postal") || prefs.postal).replace(/\D/g, "").slice(0, 4);
  const city = String(params.get("city") || prefs.city || "").trim();
  const radiusKm = Number(params.get("radius") || prefs.radiusKm);
  if ((!city && postal.length !== 4) || !Number.isFinite(radiusKm) || radiusKm <= 0) return;

  try {
    if (statsUi?.applyNearby) {
      await statsUi.applyNearby({ postal, city, radiusKm });
      return;
    }
    statsFilter = await buildNearbyFilter({
      items: allItems,
      postal,
      city,
      radiusKm,
    });
    categoryUi?.clear();
    categoryFilter = null;
    searchResultsCommitted = true;
    applyFilters({ commit: true });
    scrollToListings();
  } catch {
  }
}

function applyFeaturedFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("kiemelt") !== "1") return;
  if (PAGE !== "auto" && PAGE !== "teherauto") return;

  featuredOnlyMode = true;
  searchResultsCommitted = true;
  categoryUi?.clear();
  categoryFilter = null;
  applyFilters({ commit: true });
  scrollToListings();
}

function updateFilterResultCount() {
  const el = document.getElementById("filter-result-count");
  if (!el) return;
  el.textContent = filterItems(allItems).length.toLocaleString("hu-HU");
}

function hasActiveSidebarFilters(filters) {
  return Boolean(
    filters.gyartmany ||
      filters.gyartmanyok?.length ||
      filters.modell ||
      filters.modellek?.length ||
      filters.kivitel ||
      filters.kivitelek?.length ||
      filters.uzemanyag ||
      filters.uzemanyagQuick ||
      filters.uzemanyagok?.length ||
      filters.allapot ||
      filters.allapotok?.length ||
      filters.sebessegvalto ||
      filters.sebessegvaltok?.length ||
      filters.okmany_jelleg ||
      filters.okmany_jellegek?.length ||
      filters.ac_tolto_csatlakozasok?.length ||
      filters.tolto_csatlakozasok?.length ||
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

async function ensureAllListingsLoadedForMap() {
  if (!searchResultsCommitted && isVehicleSearchPage()) return;
  let guard = 0;
  while (listingsHasMore && guard < 80) {
    guard += 1;
    const before = allItems.length;
    await loadMoreListings({ silent: true });
    if (allItems.length === before) break;
  }
  if (!isFeaturedBrowseMode()) renderListings(allItems);
  updateFilterResultCount();
}

if (PAGE === "auto" || PAGE === "teherauto") {
  ensureMapModule = () => {
    if (!mapModulePromise) {
      mapModulePromise = import("./search-results-map.js?v=d7d331ace3")
        .then((mod) => {
          updateSearchMapButtonLabels = mod.updateSearchMapButtonLabels;
          closeSearchResultsMapFn = mod.closeSearchResultsMap;
          mod.initSearchResultsMapButtons({
            getItems: () => {
              try {
                const filtered = currentFilteredListings();
                if (filtered.length) return filtered;
              } catch {
              }
              if (allItems?.length) return filterItems(allItems);
              return [];
            },
            hasActiveFilters: () => hasActiveClientFilters(),
            useListResults: () => searchResultsCommitted || hasActiveClientFilters(),
            ensureAllListingsLoaded: ensureAllListingsLoadedForMap,
            getVertical: () => pageVerticalParam(),
          });
          updateSearchMapButtonLabels(searchResultsCommitted || hasActiveClientFilters());
          return mod;
        })
        .catch((error) => {
          mapModulePromise = null;
          console.warn("Térkép modul:", error);
          throw error;
        });
    }
    return mapModulePromise;
  };

  document.querySelectorAll("[data-search-map-open]").forEach((btn) => {
    btn.addEventListener(
      "click",
      async (event) => {
        // Modul már felkötötte a buborékoló handlert — ne állítsuk meg.
        if (btn.dataset.searchMapBound === "1") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const prevLabel = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Térkép betöltése…";
        try {
          const mod = await ensureMapModule();
          btn.disabled = false;
          await mod.openSearchMapNow(btn);
        } catch {
          btn.textContent = prevLabel;
          setMapButtonLabelsLocal(searchResultsCommitted || hasActiveClientFilters());
          btn.disabled = false;
        }
      },
      true
    );
  });

  setMapButtonLabelsLocal(searchResultsCommitted || hasActiveClientFilters());
  document.getElementById("home-qs-form")?.addEventListener("change", () => {
    const useList = searchResultsCommitted || hasActiveClientFilters();
    if (mapModulePromise) updateSearchMapButtonLabels(useList);
    else setMapButtonLabelsLocal(useList);
  });
}

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

const initialCategory = PAGE === "teherauto" ? categoryFilter : null;

if (PAGE === "teherauto") {
  const teherCatBar = document.getElementById("home-category-bar");
  if (teherCatBar) {
    renderHomeCategoryBar(teherCatBar);
    categoryUi = initHomeCategoryBar({
      onChange: (category) => {
        categoryFilter = category;
        if (category) {
          quickSearchFilters = emptyFilters();
          detailedFilters = null;
          sidebarFilters = emptyFilters();
          void syncCategoryToSearchMenu(category);
        }
        applyFilters({ commit: Boolean(category) });
        if (category) scrollToListings();
      },
      getForm: () => filterForm,
      initialCategory,
    });
    bindListingsScrollHide();
  }
}

if (PAGE === "ingatlan") {
  const params = new URLSearchParams(location.search);
  const tipParam = params.get("tipus") || "";
  const uzParam = params.get("uzletag") || "";
  const katParam = ["lakas", "haz"].includes(String(params.get("kat") || "").toLowerCase())
    ? String(params.get("kat")).toLowerCase()
    : "";
  const defaultUzletag = normalizeIngatlanUzletag(
    uzParam ||
      (tipParam === "elado" || tipParam === "airbnb" || tipParam === "kiado" ? tipParam : "elado")
  );
  ingatlanFilters = {
    ...emptyIngatlanFilters(),
    ingatlan_uzletag: defaultUzletag,
    ...(katParam ? { ingatlan_lakas_tipus: katParam } : {}),
  };
  initIngatlanSearch({
    defaultUzletag,
    onSearch: (values) => {
      if (isSellerMode()) {
        applyFilters();
        return;
      }
      ingatlanFilters = { ...emptyIngatlanFilters(), ...values };
      applyFilters();
    },
  }).then(() => {
    if (!katParam) return;
    const form = document.getElementById("immo-search-form");
    const wheel = form?.querySelector?.('[data-wheel="ingatlan_lakas_tipus"]');
    if (!wheel) return;
    import("./ingatlan-wheels.js?v=6952ba469c")
      .then(({ setWheelValue }) => {
        setWheelValue(wheel, katParam);
        wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true }));
      })
      .catch(() => {});
  });
} else {
  quickSearchApi = initHomeQuickSearch({
    onSearch: async (values) => {
      if (isSellerMode()) {
        applyFilters({ commit: true });
        return;
      }
      const { detailed, ...sidebarValues } = values ?? {};
      quickSearchFilters = { ...emptyFilters(), ...sidebarValues };
      detailedFilters = detailed ?? null;

      const empty =
        !values ||
        (typeof values === "object" &&
          !Object.keys(values).filter((k) => k !== "detailed").length &&
          !detailed);
      const hasSidebar =
        hasActiveSidebarFilters(sidebarValues) ||
        (detailed && hasActiveDetailedSearch(detailed));

      // Desk / gyorskereső indítás: csak valódi szűrőnél kapcsoljuk ki a kategória csempét.
      // Üres onSearch({}) (form boot / zaj) ne törölje a ?cat= szűrőt.
      if (hasSidebar) {
        categoryUi?.clear();
        categoryFilter = null;
        const url = new URL(window.location.href);
        if (url.searchParams.has("cat")) {
          url.searchParams.delete("cat");
          history.replaceState(null, "", url);
        }
      }

      const postal = String(values.iranyitoszam || "")
        .replace(/\D/g, "")
        .slice(0, 4);
      const city = String(values.telepules || "").trim();
      const radiusKm = Number(values.keresesi_korzet);
      if ((city || postal.length === 4) && Number.isFinite(radiusKm) && radiusKm > 0) {
        try {
          quickRadiusFilter = await buildNearbyFilter({
            items: allItems,
            postal,
            city,
            radiusKm,
          });
          sidebarFilters = { ...sidebarFilters, _locationByRadius: true };
        } catch {
          quickRadiusFilter = null;
        }
      } else {
        quickRadiusFilter = null;
      }

      if (empty && isVehicleSearchPage()) {
        if (searchRestoreInProgress) return;
        // Aktív kategória (?cat= / csempe): maradjon a szűrt lista + keresőmenü mező.
        if (categoryFilter) {
          const catFilters = searchFiltersForCategory(categoryFilter);
          if (catFilters && Object.keys(catFilters).length) {
            quickSearchFilters = { ...emptyFilters(), ...catFilters };
          }
          applyFilters({ commit: true });
          return;
        }
        searchResultsCommitted = false;
        quickRadiusFilter = null;
        clearVehicleSearchState();
        syncCommittedSearchUrl(null);
        closeSearchMapDom();
        applyFilters();
        return;
      }

      // Restore: szűrőállapot megvan, ne rendereljünk / zárjuk a térképet külön.
      if (searchRestoreInProgress) {
        searchResultsCommitted = true;
        return;
      }

      applyFilters({ commit: true });
      scrollToListings();
    },
    onFilterPreview: async (values) => {
      if (searchRestoreInProgress) return;
      if (isSellerMode() || !isVehicleSearchPage()) return;
      const { detailed, ...sidebarValues } = values ?? {};
      quickSearchFilters = { ...emptyFilters(), ...sidebarValues };
      detailedFilters = detailed ?? null;
      const postal = String(values?.iranyitoszam || "")
        .replace(/\D/g, "")
        .slice(0, 4);
      const city = String(values?.telepules || "").trim();
      const radiusKm = Number(values?.keresesi_korzet);
      if ((city || postal.length === 4) && Number.isFinite(radiusKm) && radiusKm > 0) {
        try {
          quickRadiusFilter = await buildNearbyFilter({
            items: allItems,
            postal,
            city,
            radiusKm,
          });
        } catch {
          quickRadiusFilter = null;
        }
      } else {
        quickRadiusFilter = null;
      }
      // Szűrőváltozás: csak számláló, a rács marad kiemelt / előző commitig.
      if (!searchResultsCommitted) {
        previewFilterCountsOnly();
        renderFeaturedBrowse();
      } else {
        previewFilterCountsOnly();
      }
    },
    onDeskSortChange: (sort) => {
      deskSort = sort || readDeskSort() || "newest";
      // Boost blokk lapozása szerveren rendezett — újrarendezéskor újratöltés kell.
      void loadListings();
    },
    onReady: () => {
      if (categoryFilter) void syncCategoryToSearchMenu(categoryFilter);
    },
  });

  const savedParam = new URLSearchParams(window.location.search).get("ss");
  const urlCategory = initialCategoryFromUrl();
  const restoreFromSession = !savedParam && !urlCategory && shouldRestoreVehicleSearch(PAGE);
  if ((savedParam || restoreFromSession || (searchResultsCommitted && !urlCategory)) && quickSearchApi) {
    quickSearchApi.whenReady.then(async () => {
      try {
        let filters = null;
        if (savedParam) {
          filters = decodeSavedSearchParam(savedParam)?.filters || null;
        }
        if (!filters || !Object.keys(filters).length) {
          filters = readVehicleSearchState()?.filters || null;
        }
        if (!filters || !Object.keys(filters).length) {
          if (searchResultsCommitted && hasActiveSidebarFilters(quickSearchFilters)) {
            filters = { ...quickSearchFilters, detailed: detailedFilters };
          }
        }
        if (!filters || !Object.keys(filters).length) {
          if (peekMapOpenOnReturn()) void reopenMapAfterReturn();
          return;
        }

        searchRestoreInProgress = true;
        if (peekMapOpenOnReturn()) suppressMapClose = true;
        applyRestoredFiltersToState(filters);
        await quickSearchApi.applySavedFilters(filters);
        // Preview race után újra a mentett szűrők legyenek a forrás.
        applyRestoredFiltersToState(filters);
        searchResultsCommitted = true;
        if (listingsReadyPromise) {
          try {
            await listingsReadyPromise;
          } catch {
          }
        }
        renderListings(allItems);
        updateSearchMapButtonLabels(searchResultsCommitted || hasActiveClientFilters());
        // URL + session — ne a form-olvasás döntsön restore közben
        saveVehicleSearchState({
          page: PAGE,
          committed: true,
          filters,
          deskSort: deskSort || "newest",
        });
        syncCommittedSearchUrl(filters);
        consumeVehicleSearchRestorePending(PAGE);
        scrollToListings();
        // Térkép + további lapok háttérben — ne blokkolják / villogtassák a listát.
        void reopenMapAfterReturn();
        void (async () => {
          try {
            const grew = await fillFilteredResults();
            if (grew) renderListings(allItems);
            applyRestoredFiltersToState(filters);
            await refreshOpenMapPins();
          } catch (error) {
            console.warn("Keresés háttér-frissítés:", error);
          }
        })();
        applyRestoredFiltersToState(filters);
      } catch (error) {
        console.warn("Keresés visszaállítás:", error);
      } finally {
        window.setTimeout(() => {
          searchRestoreInProgress = false;
        }, 3000);
      }
    });
  } else if (PAGE === "auto" || PAGE === "teherauto") {
    if (categoryFilter) {
      void syncCategoryToSearchMenu(categoryFilter);
    }
    // Szűrő nélkül is: térképről nyitott hirdetés vissza → térkép újra
    if (peekMapOpenOnReturn()) {
      loadListings()
        .then(() => reopenMapAfterReturn())
        .catch(() => {});
    }
  }
}

if (PAGE !== "ingatlan") {
  statsUi = initHomeStatsBar({
    onChange: (active) => {
      statsFilter = active;
      if (active) applyFilters({ commit: true });
      else applyFilters();
    },
    getItems: () => allItems,
  });

  const readSidebarFilters = initHomeSearchSidebar((filters) => {
    sidebarFilters = filters;
    if (hasActiveSidebarFilters(filters)) {
      categoryUi?.clear();
      categoryFilter = null;
    }
    if (isVehicleSearchPage() && !searchResultsCommitted) {
      previewFilterCountsOnly();
      renderFeaturedBrowse();
      return;
    }
    applyFilters();
  });
  sidebarFilters = readSidebarFilters?.() ?? emptyFilters();

  if (PAGE === "auto") {
    const urlKivitel = normalizeKivitel(new URLSearchParams(window.location.search).get("kivitel") || "");
    if (urlKivitel) {
      sidebarFilters = { ...sidebarFilters, kivitel: urlKivitel };
      const qsKivitel = document.getElementById("qs-kivitel");
      if (qsKivitel) qsKivitel.value = urlKivitel;
      const filterKivitel = document.getElementById("filter-kivitel");
      if (filterKivitel) {
        if (![...filterKivitel.options].some((o) => o.value === urlKivitel)) {
          filterKivitel.appendChild(new Option(urlKivitel, urlKivitel));
        }
        filterKivitel.value = urlKivitel;
      }
    }
  }

  initHomeFilterCatalog(() => {
    if (searchRestoreInProgress) return;
    // A hero gyorskereső szűrőit ne írjuk felül, amikor a katalógus később betölt.
    if (!hasActiveSidebarFilters(sidebarFilters)) {
      sidebarFilters = readSidebarFilters?.() ?? emptyFilters();
      if (hasActiveSidebarFilters(sidebarFilters)) {
        categoryUi?.clear();
        categoryFilter = null;
      }
    }
    applyFilters();
  }).catch((error) => console.error("Járműkatalógus (szűrő):", error));
}

import("./site-side-content.js?v=418fecb6a2")
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
    const qs = new URLSearchParams(window.location.search);
    const restoring = shouldRestoreVehicleSearch(PAGE);
    if (!fromDetail && !restoring && !qs.has("nearby") && !qs.has("kiemelt")) {
      window.scrollTo(0, 0);
    }
  })
  .catch((error) => {
  emptyEl.hidden = false;
  emptyEl.textContent = error.message ?? "Nem sikerült betölteni a hirdetéseket.";
});

window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  const mapWasOpen =
    Boolean(document.getElementById("search-map-modal")) &&
    document.getElementById("search-map-modal")?.hidden === false;
  if (mapWasOpen || peekMapOpenOnReturn()) suppressMapClose = true;
  // bfcache: a lista DOM megvan — ne töröljük újra loadListings-szel.
  const hasCards = Boolean(gridTrack?.querySelector("[data-listing-id]"));
  const softRefresh = async () => {
    if (searchResultsCommitted) {
      updateDeskResultCount(filterItems(allItems));
      updateFilterResultCount();
    }
    if (peekMapOpenOnReturn()) {
      void reopenMapAfterReturn();
      return;
    }
    if (mapWasOpen && typeof ensureMapModule === "function") {
      try {
        await refreshOpenMapPins();
      } catch (error) {
        console.warn("Térkép bfcache frissítés:", error);
      } finally {
        window.setTimeout(() => {
          suppressMapClose = false;
        }, 2500);
      }
    } else {
      suppressMapClose = false;
    }
  };
  if (hasCards) {
    softRefresh().catch(() => {
      suppressMapClose = false;
    });
    return;
  }
  loadListings()
    .then(async () => {
      if (searchResultsCommitted) applyFilters({ commit: true });
      await softRefresh();
    })
    .catch(() => {
      suppressMapClose = false;
    });
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - listingsLastFetchAt < LISTINGS_VISIBLE_REFRESH_MS) return;
  // Vissza / restore közben ne indítsunk párhuzamos újratöltést (villogás).
  if (searchRestoreInProgress || suppressMapClose) return;
  loadListings().catch(() => {});
});
