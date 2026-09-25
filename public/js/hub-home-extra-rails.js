import { getAuthUser, refreshAuthSession } from "./site-auth.js?v=nearbyBoot1";
import { getParkplatz, PARKPLATZ_CHANGED } from "./fok-data.js?v=favShow2";
import {
  createListingTileCard,
  formatListingCountBadge,
  slimListingTile,
} from "./listing-tile.js?v=listThumb1";
import { restoreListingReturn, bindListingOpen } from "./listing-return.js?v=scrollTop1";
import {
  buildNearbyFilter,
  filterIngatlanListings,
  ingatlanNearbyHref,
  ensureNearbyPrefsStored,
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

function el(id) {
  return document.getElementById(id);
}

function makeIngatlanLoader({ uzletag, tipus, cacheKey }) {
  const state = { postal: "", radiusKm: 30, offset: 0, hasMore: false };

  async function filterBatch(batch, postal, radiusKm) {
    const pool = filterIngatlanListings(batch || [], { uzletag, tipus });
    if (!pool.length) return [];
    const filter = await buildNearbyFilter({ items: pool, postal, radiusKm });
    return pool
      .filter((item) => filter.listingIds.has(item.id))
      .map((item) => slimListingTile(item))
      .map((item) => ({ ...item, __nearbyCity: filter.origin?.city || "" }));
  }

  return {
    async loadFresh({ postal, radiusKm }) {
      state.postal = postal;
      state.radiusKm = radiusKm;
      state.offset = 0;
      state.hasMore = false;
      let city = "";
      const result = await fetchTilePagesUntil({
        vertical: "ingatlan",
        wantCount: TILE_PAGE_INITIAL,
        filterBatch: async (batch) => {
          const rows = await filterBatch(batch, postal, radiusKm);
          if (!city && rows[0]?.__nearbyCity) city = rows[0].__nearbyCity;
          return rows.map(({ __nearbyCity, ...rest }) => rest);
        },
      });
      state.offset = result.offset;
      state.hasMore = result.hasMore;
      void cacheKey;
      return {
        items: result.items,
        city,
        href: ingatlanNearbyHref(postal, radiusKm, { uzletag, tipus }),
        hasMore: result.hasMore,
        total: result.total,
      };
    },
    async loadMoreFresh() {
      if (!state.hasMore || state.postal.length !== 4) return { items: [], hasMore: false };
      const result = await fetchTilePagesUntil({
        vertical: "ingatlan",
        offset: state.offset,
        wantCount: TILE_PAGE_MORE,
        filterBatch: async (batch) => {
          const rows = await filterBatch(batch, state.postal, state.radiusKm);
          return rows.map(({ __nearbyCity, ...rest }) => rest);
        },
      });
      state.offset = result.offset;
      state.hasMore = result.hasMore;
      return { items: result.items, hasMore: result.hasMore, total: result.total };
    },
  };
}

function initNearbyIngatlanRail({
  railId,
  statusId,
  countId,
  allId,
  cacheKey,
  uzletag,
  tipus,
  noun,
  nounPlural,
  defaultHref,
}) {
  const loader = makeIngatlanLoader({ uzletag, tipus, cacheKey });
  return initHubListingRail({
    railEl: el(railId),
    statusEl: el(statusId),
    countEl: el(countId),
    allLinkEl: el(allId),
    cacheKey,
    defaultAllHref: defaultHref,
    noun,
    nounPlural,
    needsPostal: true,
    loadFresh: loader.loadFresh,
    loadMoreFresh: loader.loadMoreFresh,
  });
}

async function initFavoritesRail() {
  const RAIL = el("hub-fav-rail");
  const STATUS = el("hub-fav-status");
  const COUNT_EL = el("hub-fav-count");
  const ALL = el("hub-fav-all");
  const SECTION = RAIL?.closest?.(".hf-section") || document.querySelector('[data-hf="kedvencek"]');
  if (!RAIL) return;

  function setSectionVisible(visible) {
    if (SECTION) SECTION.hidden = !visible;
  }

  if (RAIL.dataset.listingOpenBound !== "1") {
    RAIL.dataset.listingOpenBound = "1";
    bindListingOpen(RAIL);
  }

  function setStatus(msg, { hidden = false } = {}) {
    if (!STATUS) return;
    STATUS.textContent = msg || "";
    STATUS.hidden = hidden || !msg;
  }

  function setCount(n) {
    if (!COUNT_EL) return;
    const label = formatListingCountBadge(n);
    COUNT_EL.textContent = label;
    COUNT_EL.hidden = !label;
  }

  function rowsToTiles(rows) {
    return rows.map((row) =>
      slimListingTile({
        id: row.id,
        hirdetes_cime: row.title,
        fo_kep: row.imageUrl || "",
        preview: { title: row.title, price: row.price, imageUrl: row.imageUrl || "" },
      })
    );
  }

  let items = [];
  let rendered = 0;
  let loading = false;

  function ensureAllPrompt() {
    RAIL.querySelectorAll(".hf-card--prompt-all").forEach((node) => node.remove());
    if (items.length <= rendered) return;
    const more = document.createElement("a");
    more.className = "hf-card hf-card--listing hf-card--prompt hf-card--prompt-all";
    more.href = "/beallitasok.html?szekcio=parkolo";
    more.setAttribute("role", "listitem");
    more.innerHTML = `<span class="hf-card-media" aria-hidden="true"></span><span class="hf-card-label">Összes megnyitása</span>`;
    RAIL.appendChild(more);
  }

  function appendNext(count) {
    if (loading) return;
    const remaining = items.length - rendered;
    if (remaining <= 0) {
      ensureAllPrompt();
      return;
    }
    loading = true;
    RAIL.querySelectorAll(".hf-card--prompt-all").forEach((node) => node.remove());
    const slice = items.slice(rendered, rendered + count);
    for (const item of slice) RAIL.appendChild(createListingTileCard(item));
    rendered += slice.length;
    ensureAllPrompt();
    loading = false;
  }

  function paintItems(list) {
    items = list;
    rendered = 0;
    RAIL.innerHTML = "";
    if (!items.length) {
      setCount(0);
      setSectionVisible(false);
      return;
    }
    setSectionVisible(true);
    setCount(items.length);
    appendNext(TILE_PAGE_INITIAL);
    setStatus("", { hidden: true });
  }

  function onScroll() {
    if (!items.length) return;
    const nearEnd = RAIL.scrollLeft + RAIL.clientWidth >= RAIL.scrollWidth - 140;
    if (nearEnd) appendNext(TILE_PAGE_MORE);
  }

  if (RAIL.dataset.favLazyBound !== "1") {
    RAIL.dataset.favLazyBound = "1";
    RAIL.addEventListener("scroll", onScroll, { passive: true });
  }

  setStatus("Kedvencek betöltése…", { hidden: true });
  try {
    let email = getAuthUser()?.email;
    if (!email) {
      try {
        await refreshAuthSession();
      } catch {
      }
      email = getAuthUser()?.email;
    }
    if (!email) {
      RAIL.innerHTML = "";
      setCount(0);
      setSectionVisible(false);
      restoreListingReturn();
      return;
    }

    if (ALL) ALL.href = "/beallitasok.html?szekcio=parkolo";
    const saved = getParkplatz(email);
    if (!saved.length) {
      RAIL.innerHTML = "";
      setCount(0);
      setSectionVisible(false);
      restoreListingReturn();
      return;
    }

    // Csak csempe-adat a Parkolóból — teljes hirdetés csak megnyitáskor.
    paintItems(rowsToTiles(saved));
    restoreListingReturn();
  } catch {
    const email = getAuthUser()?.email;
    const saved = email ? getParkplatz(email) : [];
    if (saved.length) paintItems(rowsToTiles(saved));
    else {
      RAIL.innerHTML = "";
      setCount(0);
      setSectionVisible(false);
    }
  }
  restoreListingReturn();
}

let lakasRail = null;
let hazRail = null;
let bootGen = 0;

async function init() {
  const profile = getAuthUser()?.profile ?? null;
  ensureNearbyPrefsStored(profile);
  const { postal, radiusKm } = readNearbyPrefs(profile);

  if (!lakasRail) {
    lakasRail = initNearbyIngatlanRail({
      railId: "hub-nearby-lakas-rail",
      statusId: "hub-nearby-lakas-status",
      countId: "hub-nearby-lakas-count",
      allId: "hub-nearby-lakas-all",
      cacheKey: "bymy-hub-nearby-lakas-v2",
      uzletag: "elado",
      tipus: "lakas",
      noun: "lakás",
      nounPlural: "lakás",
      defaultHref: "/ingatlan.html?uzletag=elado&kat=lakas",
    });
  }

  if (!hazRail) {
    hazRail = initNearbyIngatlanRail({
      railId: "hub-nearby-haz-rail",
      statusId: "hub-nearby-haz-status",
      countId: "hub-nearby-haz-count",
      allId: "hub-nearby-haz-all",
      cacheKey: "bymy-hub-nearby-haz-v2",
      uzletag: "elado",
      tipus: "haz",
      noun: "ház",
      nounPlural: "ház",
      defaultHref: "/ingatlan.html?uzletag=elado&kat=haz",
    });
  }

  await Promise.all([
    lakasRail?.start({ postal, radiusKm }),
    hazRail?.start({ postal, radiusKm }),
    initFavoritesRail(),
  ]);
}

async function bootHomeExtraRails() {
  const gen = ++bootGen;
  try {
    await refreshAuthSession();
  } catch {
  }
  if (gen !== bootGen) return;
  await init();
}

function scheduleHomeExtraRailsBoot() {
  void bootHomeExtraRails();
}

scheduleHomeExtraRailsBoot();
window.addEventListener("site-auth-ready", scheduleHomeExtraRailsBoot);
window.addEventListener("bymy-auth-changed", scheduleHomeExtraRailsBoot);
window.addEventListener(PARKPLATZ_CHANGED, scheduleHomeExtraRailsBoot);
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_POSTAL || event.key === STORAGE_RADIUS || event.key === "bymy-parkplatz") {
    scheduleHomeExtraRailsBoot();
  }
});
window.addEventListener("bymy-nearby-prefs-changed", scheduleHomeExtraRailsBoot);
window.addEventListener("pageshow", (event) => {
  const needsBoot =
    event.persisted ||
    !document.getElementById("hub-nearby-lakas-rail")?.querySelector(".hf-card--listing");
  if (needsBoot) scheduleHomeExtraRailsBoot();
  else restoreListingReturn();
});
