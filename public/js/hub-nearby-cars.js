import { getAuthUser, isLoggedIn, refreshAuthSession } from "./site-auth.js?v=nearbyBoot1";
import { restoreListingReturn } from "./listing-return.js?v=scrollTop1";
import { slimListingTile } from "./listing-tile.js?v=listThumb1";
import {
  autoNearbyHref,
  buildNearbyFilter,
  ensureNearbyPrefsStored,
  filterAutoListings,
  readNearbyPrefs,
  STORAGE_POSTAL,
  STORAGE_RADIUS,
} from "./nearby-search.js?v=nearbyPrefs2";
import { initHubListingRail } from "./hub-listing-rail.js?v=tilePage1";
import {
  TILE_PAGE_INITIAL,
  TILE_PAGE_MORE,
  fetchTilePagesUntil,
} from "./listing-tile-pager.js?v=tilePage1";

const CACHE_KEY = "bymy-hub-nearby-v8";

let railApi = null;
let pageState = {
  postal: "",
  radiusKm: 30,
  offset: 0,
  hasMore: false,
};

async function filterNearbyAutoBatch(batch, postal, radiusKm) {
  const autos = filterAutoListings(batch || []);
  if (!autos.length) return [];
  const filter = await buildNearbyFilter({ items: autos, postal, radiusKm });
  return autos
    .filter((item) => filter.listingIds.has(item.id))
    .map((item) => slimListingTile(item))
    .map((item) => ({ ...item, __nearbyCity: filter.origin?.city || "" }));
}

async function loadNearbyFresh({ postal, radiusKm }) {
  pageState = { postal, radiusKm, offset: 0, hasMore: false };
  let city = "";
  const result = await fetchTilePagesUntil({
    vertical: "auto",
    wantCount: TILE_PAGE_INITIAL,
    filterBatch: async (batch) => {
      const rows = await filterNearbyAutoBatch(batch, postal, radiusKm);
      if (!city && rows[0]?.__nearbyCity) city = rows[0].__nearbyCity;
      return rows.map(({ __nearbyCity, ...rest }) => rest);
    },
  });
  pageState.offset = result.offset;
  pageState.hasMore = result.hasMore;
  return {
    items: result.items,
    city,
    href: autoNearbyHref(postal, radiusKm),
    hasMore: result.hasMore,
    total: result.total,
  };
}

async function loadNearbyMore() {
  const { postal, radiusKm, offset, hasMore } = pageState;
  if (!hasMore || postal.length !== 4) return { items: [], hasMore: false };
  const result = await fetchTilePagesUntil({
    vertical: "auto",
    offset,
    wantCount: TILE_PAGE_MORE,
    filterBatch: async (batch) => {
      const rows = await filterNearbyAutoBatch(batch, postal, radiusKm);
      return rows.map(({ __nearbyCity, ...rest }) => rest);
    },
  });
  pageState.offset = result.offset;
  pageState.hasMore = result.hasMore;
  return {
    items: result.items,
    hasMore: result.hasMore,
    total: result.total,
  };
}

function ensureRail() {
  const railEl = document.getElementById("hub-nearby-rail");
  if (!railEl) return null;
  if (!railApi) {
    railApi = initHubListingRail({
      railEl,
      statusEl: document.getElementById("hub-nearby-status"),
      countEl: document.getElementById("hub-nearby-count"),
      allLinkEl: document.getElementById("hub-nearby-all"),
      cacheKey: CACHE_KEY,
      defaultAllHref: "/auto.html?nearby=1",
      noun: "autó",
      nounPlural: "autó",
      needsPostal: true,
      loadFresh: loadNearbyFresh,
      loadMoreFresh: loadNearbyMore,
    });
  }
  return railApi;
}

let bootGen = 0;

async function bootHubNearbyCars() {
  const api = ensureRail();
  if (!api) return;
  const gen = ++bootGen;
  if (isLoggedIn()) {
    try {
      await refreshAuthSession();
    } catch {
    }
  }
  if (gen !== bootGen) return;
  const profile = getAuthUser()?.profile ?? null;
  ensureNearbyPrefsStored(profile);
  const { postal, radiusKm } = readNearbyPrefs(profile);
  await api.start({ postal, radiusKm });
}

function scheduleHubNearbyBoot() {
  void bootHubNearbyCars();
}

scheduleHubNearbyBoot();
window.addEventListener("site-auth-ready", scheduleHubNearbyBoot);
window.addEventListener("bymy-auth-changed", scheduleHubNearbyBoot);
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_POSTAL || event.key === STORAGE_RADIUS) scheduleHubNearbyBoot();
});
window.addEventListener("bymy-nearby-prefs-changed", scheduleHubNearbyBoot);
window.addEventListener("pageshow", (event) => {
  const rail = document.getElementById("hub-nearby-rail");
  const hasCards = Boolean(rail?.querySelector(".hf-card--listing"));
  if (event.persisted || !hasCards) scheduleHubNearbyBoot();
  else restoreListingReturn();
});
