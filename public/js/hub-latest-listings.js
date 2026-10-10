import { restoreListingReturn } from "./listing-return.js?v=7fe28dc00b";
import { slimListingTile } from "./listing-tile.js?v=57b4ae576b";
import { initHubListingRail } from "./hub-listing-rail.js?v=46948e7dbd";
import {
  TILE_PAGE_INITIAL,
  TILE_PAGE_MORE,
  fetchTilePagesUntil,
} from "./listing-tile-pager.js?v=248671f94e";

const CACHE_KEY = "bymy-hub-latest-v1";
const ALL_HREF = "/auto.html?sort=newest";

let railApi = null;
let pageState = {
  offset: 0,
  hasMore: false,
};

/** Feladás ideje: created_at, fallback updated_at. */
function sortByCreated(items) {
  return [...(items || [])].sort((a, b) => {
    const ta = new Date(a.created_at ?? a.updated_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? b.updated_at ?? 0).getTime();
    return tb - ta;
  });
}

async function loadLatestFresh() {
  pageState = { offset: 0, hasMore: false };
  const result = await fetchTilePagesUntil({
    vertical: "auto",
    wantCount: TILE_PAGE_INITIAL,
    filterBatch: async (batch) => (batch || []).map(slimListingTile),
  });
  pageState.offset = result.offset;
  pageState.hasMore = result.hasMore;
  return {
    items: sortByCreated(result.items),
    href: ALL_HREF,
    hasMore: result.hasMore,
    total: result.total,
  };
}

async function loadLatestMore() {
  if (!pageState.hasMore) return { items: [], hasMore: false };
  const result = await fetchTilePagesUntil({
    vertical: "auto",
    offset: pageState.offset,
    wantCount: TILE_PAGE_MORE,
    filterBatch: async (batch) => (batch || []).map(slimListingTile),
  });
  pageState.offset = result.offset;
  pageState.hasMore = result.hasMore;
  return {
    items: sortByCreated(result.items),
    hasMore: result.hasMore,
    total: result.total,
  };
}

function ensureRail() {
  const railEl = document.getElementById("hub-latest-rail");
  if (!railEl) return null;
  if (!railApi) {
    railApi = initHubListingRail({
      railEl,
      statusEl: null,
      countEl: document.getElementById("hub-latest-count"),
      allLinkEl: document.getElementById("hub-latest-all"),
      cacheKey: CACHE_KEY,
      defaultAllHref: ALL_HREF,
      noun: "hirdetés",
      nounPlural: "hirdetés",
      needsPostal: false,
      loadFresh: loadLatestFresh,
      loadMoreFresh: loadLatestMore,
    });
  }
  return railApi;
}

let bootGen = 0;

async function bootHubLatestListings() {
  const api = ensureRail();
  if (!api) return;
  const gen = ++bootGen;
  await api.start({ postal: "", radiusKm: 30 });
  if (gen !== bootGen) return;
}

function scheduleHubLatestBoot() {
  void bootHubLatestListings();
}

scheduleHubLatestBoot();
window.addEventListener("pageshow", (event) => {
  const rail = document.getElementById("hub-latest-rail");
  const hasCards = Boolean(rail?.querySelector(".hf-card--listing"));
  if (event.persisted || !hasCards) scheduleHubLatestBoot();
  else restoreListingReturn();
});
