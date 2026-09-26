import { fetchListings, fetchListingsPage, fetchRelatedListings } from "./db-client.js?v=ownerBoost6";
import { createHomeGridCard, initHomeGridCardPhotos } from "./home-grid-card.js?v=mobFix8";
import { promoKiemeltActive, promoTopAjanlatActive } from "./listing-promo.js?v=promo1";
import {
  emptyFilters,
  filterListingsBySidebar,
  populateFilterOptions,
  initHomeSearchSidebar,
  initHomeFilterCatalog,
} from "./home-search-filter.js?v=allapotFlat1";
import { initHomeQuickSearch } from "./home-quicksearch.js?v=allapotFlat1";
import { decodeSavedSearchParam } from "./saved-search.js?v=savedSearch5";
import { matchDetailedSearch, hasActiveDetailedSearch } from "./auto-detailed-search.js?v=autoDesk16";
import { updateAutoDeskResultCount } from "./auto-desk-search.js?v=teherKivitel35e";
import {
  emptyIngatlanFilters,
  filterListingsByIngatlan,
  initIngatlanSearch,
} from "./ingatlan-search.js?v=mobFix8";
import { normalizeIngatlanUzletag } from "./ingatlan-fields.js?v=immoEladoDefault1";
import { filterByCategory, initHomeCategoryBar, renderHomeCategoryBar } from "./home-category-bar.js?v=catLabel1";
import { initHomeUnifiedScroll } from "./home-unified-scroll.js";
import { initHomeStatsBar } from "./home-stats-bar.js";
import { buildNearbyFilter, readNearbyPrefs } from "./nearby-search.js?v=korzetFix1";
import { getAuthUser } from "./site-auth.js?v=nearby1";
import { bindListingOpen, restoreListingReturn } from "./listing-return.js?v=searchNav1";
import { normalizeKivitel } from "./kivitel-options.js?v=kivitel1";
import { featuredListingIdSet } from "./home-featured-slots.js?v=featuredNoAuto1";
import { initSearchResultsMapButtons } from "./search-results-map.js?v=mapRouteD3";
import { mountSellerInventory, updateSellerInventoryCount } from "./seller-inventory.js?v=sellerInv30";

const gridTrack = document.getElementById("home-grid-track");
const emptyEl = document.getElementById("home-empty");
const filterForm = document.getElementById("home-filter-form");

const LISTINGS_INITIAL = 20;
const LISTINGS_PAGE_MORE = 10;

let allItems = [];
let listingsTotal = null;
let listingsHasMore = false;
let listingsLoadingMore = false;
let listingsOffset = 0;
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

const PAGE = document.body?.getAttribute("data-site-page") || "";
if (gridTrack) bindListingOpen(gridTrack);

function sellerFromId() {
  return String(new URLSearchParams(window.location.search).get("hirdeto") || "").trim();
}

function isSellerMode() {
  return Boolean(sellerFromId());
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

function renderListings(items) {
  if (!gridTrack) return;

  gridTrack.innerHTML = "";

  const filtered =
    PAGE === "auto" || PAGE === "teherauto"
      ? sortDeskListings(filterItems(items))
      : applyOwnerBoostSort(filterItems(items));
  emptyEl.hidden = filtered.length > 0;
  if (!filtered.length && (statsFilter || quickRadiusFilter)) {
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

  if (PAGE === "auto" || PAGE === "teherauto") updateDeskResultCount(filtered);
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
  const sellerFrom = sellerFromId();
  if (sellerFrom) {
    await loadSellerListings(sellerFrom);
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
  renderListings(allItems);
  updateFilterResultCount();
  statsUi?.refreshActiveCount?.();
  bindListingsInfiniteScroll();
  await applyNearbyFromUrl();
  applyFeaturedFromUrl();
  if (hasActiveClientFilters()) {
    void fillFilteredResults();
  }
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

async function loadMoreListings() {
  if (isSellerMode()) return;
  if (!listingsHasMore || listingsLoadingMore) return;
  if (PAGE !== "auto" && PAGE !== "teherauto" && PAGE !== "ingatlan") return;
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
      populateFilterOptions(allItems);
      renderListings(allItems);
      updateFilterResultCount();
      statsUi?.refreshActiveCount?.();
      break;
    }
  } catch (error) {
    console.warn("Lista folytatás:", error);
  } finally {
    listingsLoadingMore = false;
  }
}

function hasActiveClientFilters() {
  if (featuredOnlyMode || statsFilter || quickRadiusFilter || categoryFilter) return true;
  if (PAGE === "ingatlan") {
    return Object.values(ingatlanFilters || {}).some((v) => v != null && v !== "");
  }
  if (hasActiveSidebarFilters(mergedVehicleFilters())) return true;
  if (detailedFilters && hasActiveDetailedSearch(detailedFilters)) return true;
  return false;
}

function updateDeskResultCount(filtered) {
  if (PAGE !== "auto" && PAGE !== "teherauto") return;
  if (!hasActiveClientFilters() && listingsTotal != null) {
    updateAutoDeskResultCount(listingsTotal);
    return;
  }
  updateAutoDeskResultCount(filtered.length);
}

async function fillFilteredResults() {
  let guard = 0;
  while (
    hasActiveClientFilters() &&
    listingsHasMore &&
    filterItems(allItems).length < LISTINGS_INITIAL &&
    guard < 40
  ) {
    guard += 1;
    const before = allItems.length;
    await loadMoreListings();
    if (allItems.length === before) break;
  }
}

function bindListingsInfiniteScroll() {
  if (bindListingsInfiniteScroll.bound) return;
  bindListingsInfiniteScroll.bound = true;

  const nearEnd = (el) => {
    if (!el) return false;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 560;
  };

  const onScroll = () => {
    if (!listingsHasMore || listingsLoadingMore) return;
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
  }
}

function applyFeaturedFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("kiemelt") !== "1") return;
  if (PAGE !== "auto" && PAGE !== "teherauto") return;

  featuredOnlyMode = true;
  categoryUi?.clear();
  categoryFilter = null;
  applyFilters();
  scrollToListings();
}

function applyFilters() {
  renderListings(allItems);
  updateFilterResultCount();
  if (hasActiveClientFilters()) void fillFilteredResults();
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

if (PAGE === "auto" || PAGE === "teherauto") {
  initSearchResultsMapButtons({ getItems: currentFilteredListings });
}

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
    import("./ingatlan-wheels.js?v=immoSearchMenu1")
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
        applyFilters();
        return;
      }
      const { detailed, ...sidebarValues } = values ?? {};
      quickSearchFilters = { ...emptyFilters(), ...sidebarValues };
      detailedFilters = detailed ?? null;
      categoryUi?.clear();
      categoryFilter = null;
      const url = new URL(window.location.href);
      if (url.searchParams.has("cat")) {
        url.searchParams.delete("cat");
        history.replaceState(null, "", url);
      }

      const postal = String(values.iranyitoszam || "")
        .replace(/\D/g, "")
        .slice(0, 4);
      const radiusKm = Number(values.keresesi_korzet);
      if (postal.length === 4 && Number.isFinite(radiusKm) && radiusKm > 0) {
        try {
          quickRadiusFilter = await buildNearbyFilter({
            items: allItems,
            postal,
            radiusKm,
          });
          sidebarFilters = { ...sidebarFilters, _locationByRadius: true };
        } catch {
          quickRadiusFilter = null;
        }
      } else {
        quickRadiusFilter = null;
      }

      applyFilters();
      if (postal.length === 4 && radiusKm > 0) scrollToListings();
    },
    onDeskSortChange: (sort) => {
      deskSort = sort || readDeskSort() || "newest";
      // Boost blokk lapozása szerveren rendezett — újrarendezéskor újratöltés kell.
      void loadListings();
    },
  });

  const savedParam = new URLSearchParams(window.location.search).get("ss");
  if (savedParam && quickSearchApi) {
    quickSearchApi.whenReady.then(async () => {
      const decoded = decodeSavedSearchParam(savedParam);
      if (!decoded?.filters || !Object.keys(decoded.filters).length) return;
      await quickSearchApi.applySavedFilters(decoded.filters);
      scrollToListings();
    });
  }
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
    const qs = new URLSearchParams(window.location.search);
    if (!fromDetail && !qs.has("nearby") && !qs.has("kiemelt")) {
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
