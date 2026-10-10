import { getAuthUser, isLoggedIn, refreshAuthSession } from "./site-auth.js?v=20aa3f41c9";
import { getParkplatz, pruneParkplatzMissing, PARKPLATZ_CHANGED } from "./fok-data.js?v=289f64e75c";
import { fetchExistingListingIds } from "./db-client.js?v=6c1aeac308";
import { pickFeaturedListings } from "./home-featured-slots.js?v=76bf95d774";
import {
  createListingTileCard,
  formatListingCountBadge,
  slimListingTile,
} from "./listing-tile.js?v=0633cb6729";
import { bindListingOpen, restoreListingReturn } from "./listing-return.js?v=1911f0cb28";
import {
  buildNearbyFilter,
  ensureNearbyPrefsStored,
  filterPiacListings,
  piacNearbyHref,
  readNearbyPrefs,
  STORAGE_POSTAL,
  STORAGE_RADIUS,
} from "./nearby-search.js?v=620e979a5c";
import { initHubListingRail } from "./hub-listing-rail.js?v=28cddcfab0";
import {
  TILE_PAGE_MORE,
  fetchTilePagesUntil,
} from "./listing-tile-pager.js?v=248671f94e";

const LATEST_WANT = 9;
const FEATURED_WANT = 9;
const VERTICAL = "piac";

function el(id) {
  return document.getElementById(id);
}

function setEmpty(emptyEl, show) {
  if (!emptyEl) return;
  emptyEl.hidden = !show;
}

function setCount(countEl, n) {
  if (!countEl) return;
  const label = formatListingCountBadge(n);
  countEl.textContent = label;
  countEl.hidden = !label;
}

function listingText(item) {
  const preview = item?.preview ?? {};
  const form = item?.form ?? {};
  return [
    item?.hirdetes_cime,
    preview.title,
    preview.subtitle,
    preview.city,
    form.hirdetes_cime,
    form.leiras,
    form.varos,
    form.telepules,
  ]
    .map((v) => String(v || "").toLowerCase())
    .join(" ");
}

function matchesQuery(item, q) {
  if (!q) return true;
  return listingText(item).includes(q);
}

function sortByCreated(items) {
  return [...(items || [])].sort((a, b) => {
    const ta = new Date(a.created_at ?? a.updated_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? b.updated_at ?? 0).getTime();
    return tb - ta;
  });
}

function readSearchQuery() {
  try {
    return String(new URLSearchParams(location.search).get("q") || "")
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
}

function bindSearchForm() {
  const form = el("piac-search-form");
  const input = el("piac-search-input");
  if (!form || !input) return;
  const q = String(new URLSearchParams(location.search).get("q") || "").trim();
  if (q) input.value = q;
  form.addEventListener("submit", (event) => {
    const value = String(input.value || "").trim();
    if (!value) {
      event.preventDefault();
      location.href = "/piacter.html";
    }
  });
}

/* ── Új hirdetések (9) ── */
let latestApi = null;
let latestState = { offset: 0, hasMore: false };

async function loadLatestFresh() {
  latestState = { offset: 0, hasMore: false };
  const result = await fetchTilePagesUntil({
    vertical: VERTICAL,
    wantCount: LATEST_WANT,
    filterBatch: async (batch) => (batch || []).map(slimListingTile),
  });
  latestState.offset = result.offset;
  latestState.hasMore = result.hasMore;
  const items = sortByCreated(result.items).slice(0, LATEST_WANT);
  setEmpty(el("piac-latest-empty"), !items.length);
  return {
    items,
    href: "/piacter.html?sort=newest",
    hasMore: result.hasMore,
    total: result.total,
  };
}

async function loadLatestMore() {
  if (!latestState.hasMore) return { items: [], hasMore: false };
  const result = await fetchTilePagesUntil({
    vertical: VERTICAL,
    offset: latestState.offset,
    wantCount: TILE_PAGE_MORE,
    filterBatch: async (batch) => (batch || []).map(slimListingTile),
  });
  latestState.offset = result.offset;
  latestState.hasMore = result.hasMore;
  return {
    items: sortByCreated(result.items),
    hasMore: result.hasMore,
    total: result.total,
  };
}

function ensureLatestRail() {
  const railEl = el("piac-latest-rail");
  if (!railEl) return null;
  if (!latestApi) {
    latestApi = initHubListingRail({
      railEl,
      statusEl: null,
      countEl: el("piac-latest-count"),
      allLinkEl: el("piac-latest-all"),
      cacheKey: "bymy-piac-latest-v1",
      defaultAllHref: "/piacter.html?sort=newest",
      noun: "hirdetés",
      nounPlural: "hirdetés",
      needsPostal: false,
      loadFresh: loadLatestFresh,
      loadMoreFresh: loadLatestMore,
    });
  }
  return latestApi;
}

/* ── Közelben ── */
let nearbyApi = null;
let nearbyState = { postal: "", radiusKm: 30, offset: 0, hasMore: false };

async function filterNearbyPiacBatch(batch, postal, radiusKm) {
  const pool = filterPiacListings(batch || []);
  if (!pool.length) return [];
  const filter = await buildNearbyFilter({ items: pool, postal, radiusKm });
  return pool
    .filter((item) => filter.listingIds.has(item.id))
    .map((item) => slimListingTile(item))
    .map((item) => ({ ...item, __nearbyCity: filter.origin?.city || "" }));
}

async function loadNearbyFresh({ postal, radiusKm }) {
  nearbyState = { postal, radiusKm, offset: 0, hasMore: false };
  let city = "";
  const result = await fetchTilePagesUntil({
    vertical: VERTICAL,
    wantCount: 20,
    filterBatch: async (batch) => {
      const rows = await filterNearbyPiacBatch(batch, postal, radiusKm);
      if (!city && rows[0]?.__nearbyCity) city = rows[0].__nearbyCity;
      return rows.map(({ __nearbyCity, ...rest }) => rest);
    },
  });
  nearbyState.offset = result.offset;
  nearbyState.hasMore = result.hasMore;
  setEmpty(el("piac-nearby-empty"), !result.items.length);
  return {
    items: result.items,
    city,
    href: piacNearbyHref(postal, radiusKm, city),
    hasMore: result.hasMore,
    total: result.total,
  };
}

async function loadNearbyMore() {
  const { postal, radiusKm, offset, hasMore } = nearbyState;
  if (!hasMore || postal.length !== 4) return { items: [], hasMore: false };
  const result = await fetchTilePagesUntil({
    vertical: VERTICAL,
    offset,
    wantCount: TILE_PAGE_MORE,
    filterBatch: async (batch) => {
      const rows = await filterNearbyPiacBatch(batch, postal, radiusKm);
      return rows.map(({ __nearbyCity, ...rest }) => rest);
    },
  });
  nearbyState.offset = result.offset;
  nearbyState.hasMore = result.hasMore;
  return {
    items: result.items,
    hasMore: result.hasMore,
    total: result.total,
  };
}

function ensureNearbyRail() {
  const railEl = el("piac-nearby-rail");
  if (!railEl) return null;
  if (!nearbyApi) {
    nearbyApi = initHubListingRail({
      railEl,
      statusEl: el("piac-nearby-status"),
      countEl: el("piac-nearby-count"),
      allLinkEl: el("piac-nearby-all"),
      cacheKey: "bymy-piac-nearby-v1",
      defaultAllHref: "/piacter.html?nearby=1",
      noun: "hirdetés",
      nounPlural: "hirdetés",
      needsPostal: true,
      loadFresh: loadNearbyFresh,
      loadMoreFresh: loadNearbyMore,
    });
  }
  return nearbyApi;
}

/* ── Kedvencek (csak piactér) ── */
async function bootFavorites() {
  const RAIL = el("piac-fav-rail");
  const STATUS = el("piac-fav-status");
  const COUNT_EL = el("piac-fav-count");
  const EMPTY = el("piac-fav-empty");
  const ALL = el("piac-fav-all");
  if (!RAIL) return;

  if (RAIL.dataset.listingOpenBound !== "1") {
    RAIL.dataset.listingOpenBound = "1";
    bindListingOpen(RAIL);
  }

  function setStatus(msg, { hidden = false } = {}) {
    if (!STATUS) return;
    STATUS.textContent = msg || "";
    STATUS.hidden = hidden || !msg;
  }

  if (ALL) ALL.href = "/beallitasok.html?szekcio=parkolo";

  let email = getAuthUser()?.email;
  if (!email && isLoggedIn()) {
    try {
      await refreshAuthSession();
    } catch {
    }
    email = getAuthUser()?.email;
  }

  if (!email) {
    RAIL.innerHTML = "";
    setCount(COUNT_EL, 0);
    setEmpty(EMPTY, true);
    setStatus("", { hidden: true });
    return;
  }

  let saved = getParkplatz(email);
  if (saved.length) {
    try {
      const existing = await fetchExistingListingIds(saved.map((row) => row.id));
      saved = pruneParkplatzMissing(email, existing);
    } catch {
    }
  }

  if (!saved.length) {
    RAIL.innerHTML = "";
    setCount(COUNT_EL, 0);
    setEmpty(EMPTY, true);
    setStatus("", { hidden: true });
    return;
  }

  const favIds = new Set(saved.map((row) => Number(row.id)).filter((n) => Number.isFinite(n)));
  const result = await fetchTilePagesUntil({
    vertical: VERTICAL,
    wantCount: Math.max(favIds.size, 1),
    maxPages: 80,
    filterBatch: async (batch) =>
      (batch || [])
        .filter((item) => favIds.has(Number(item.id)))
        .map(slimListingTile),
  });

  const byId = new Map(result.items.map((item) => [Number(item.id), item]));
  const ordered = saved
    .map((row) => byId.get(Number(row.id)))
    .filter(Boolean);

  RAIL.innerHTML = "";
  if (!ordered.length) {
    setCount(COUNT_EL, 0);
    setEmpty(EMPTY, true);
    setStatus("", { hidden: true });
    restoreListingReturn();
    return;
  }

  setEmpty(EMPTY, false);
  setCount(COUNT_EL, ordered.length);
  ordered.forEach((item, index) => {
    RAIL.appendChild(createListingTileCard(item, { eager: index < 4 }));
  });
  setStatus("", { hidden: true });
  restoreListingReturn();
}

/* ── Kiemelt ── */
async function bootFeatured() {
  const RAIL = el("piac-featured-rail");
  const EMPTY = el("piac-featured-empty");
  const ALL = el("piac-featured-all");
  if (!RAIL) return;
  if (ALL) ALL.href = "/piacter.html?kiemelt=1";
  if (RAIL.dataset.listingOpenBound !== "1") {
    RAIL.dataset.listingOpenBound = "1";
    bindListingOpen(RAIL);
  }

  try {
    const page = await fetchTilePagesUntil({
      vertical: VERTICAL,
      wantCount: 40,
      maxPages: 6,
    });
    const pool = (page.items || []).map(slimListingTile);
    const picked = pickFeaturedListings(pool, { limit: FEATURED_WANT });
    RAIL.innerHTML = "";
    if (!picked.length) {
      setEmpty(EMPTY, true);
      return;
    }
    setEmpty(EMPTY, false);
    const configured = new Set(picked.map((row) => Number(row.id)));
    picked.forEach((item, index) => {
      RAIL.appendChild(
        createListingTileCard(item, {
          featured: true,
          configuredFeaturedIds: configured,
          eager: index < 4,
        })
      );
    });
    restoreListingReturn();
  } catch {
    if (!RAIL.querySelector(".hf-card--listing")) setEmpty(EMPTY, true);
  }
}

/* ── Szöveges keresés ── */
async function bootSearchResults() {
  const q = readSearchQuery();
  const SECTION = el("piac-search-section");
  const RAIL = el("piac-search-rail");
  const STATUS = el("piac-search-status");
  const EMPTY = el("piac-search-empty");
  const COUNT_EL = el("piac-search-count");
  if (!SECTION || !RAIL) return;

  if (!q) {
    SECTION.hidden = true;
    return;
  }

  SECTION.hidden = false;
  if (RAIL.dataset.listingOpenBound !== "1") {
    RAIL.dataset.listingOpenBound = "1";
    bindListingOpen(RAIL);
  }
  if (STATUS) {
    STATUS.textContent = "Keresés…";
    STATUS.hidden = false;
  }
  setEmpty(EMPTY, false);

  try {
    const result = await fetchTilePagesUntil({
      vertical: VERTICAL,
      wantCount: 40,
      maxPages: 20,
      filterBatch: async (batch) =>
        (batch || [])
          .filter((item) => matchesQuery(item, q))
          .map(slimListingTile),
    });
    const items = sortByCreated(result.items);
    RAIL.innerHTML = "";
    setCount(COUNT_EL, items.length);
    if (!items.length) {
      setEmpty(EMPTY, true);
      if (STATUS) STATUS.hidden = true;
      return;
    }
    setEmpty(EMPTY, false);
    items.forEach((item, index) => {
      RAIL.appendChild(createListingTileCard(item, { eager: index < 4 }));
    });
    if (STATUS) STATUS.hidden = true;
    restoreListingReturn();
  } catch {
    RAIL.innerHTML = "";
    setCount(COUNT_EL, 0);
    setEmpty(EMPTY, true);
    if (STATUS) {
      STATUS.textContent = "A keresés most nem elérhető.";
      STATUS.hidden = false;
    }
  }
}

let bootGen = 0;

async function bootRails() {
  const gen = ++bootGen;
  bindSearchForm();
  void bootSearchResults();

  const latest = ensureLatestRail();
  if (latest) await latest.start({ postal: "", radiusKm: 30 });
  if (gen !== bootGen) return;

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
  const nearby = ensureNearbyRail();
  if (nearby) await nearby.start({ postal, radiusKm });
  if (gen !== bootGen) return;

  await Promise.all([bootFavorites(), bootFeatured()]);
  if (gen !== bootGen) return;
  restoreListingReturn();
}

function scheduleBoot() {
  void bootRails();
}

scheduleBoot();
window.addEventListener("site-auth-ready", scheduleBoot);
window.addEventListener("bymy-auth-changed", scheduleBoot);
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_POSTAL || event.key === STORAGE_RADIUS) scheduleBoot();
});
window.addEventListener("bymy-nearby-prefs-changed", scheduleBoot);
window.addEventListener(PARKPLATZ_CHANGED, () => {
  void bootFavorites();
});
window.addEventListener("pageshow", (event) => {
  const rail = el("piac-latest-rail");
  const hasCards = Boolean(rail?.querySelector(".hf-card--listing"));
  if (event.persisted || !hasCards) scheduleBoot();
  else restoreListingReturn();
});
