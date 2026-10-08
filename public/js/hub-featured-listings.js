import { pickFeaturedListings } from "./home-featured-slots.js?v=76bf95d774";
import { createListingTileCard, slimListingTile } from "./listing-tile.js?v=0633cb6729";
import { bindListingOpen, restoreListingReturn } from "./listing-return.js?v=1911f0cb28";
import {
  TILE_PAGE_INITIAL,
  TILE_PAGE_MORE,
  fetchTilePagesUntil,
} from "./listing-tile-pager.js?v=535f30dba9";

const SECTION = document.querySelector('[data-hf="kiemelt"]');
const RAIL = document.getElementById("hub-featured-rail");
const EMPTY = document.getElementById("hub-featured-empty");
const ALL = document.getElementById("hub-featured-all");
const CACHE_KEY = "bymy-hub-featured-v1";
const CACHE_TTL_MS = 15 * 60 * 1000;

function setSectionVisible(hasListings) {
  if (SECTION) SECTION.hidden = !hasListings;
  if (RAIL) RAIL.hidden = !hasListings;
  if (EMPTY) EMPTY.hidden = true;
}

function listingKey(items) {
  return (items || []).map((row) => String(row?.id ?? "")).filter(Boolean).join(",");
}

function paintedKey() {
  if (!RAIL) return "";
  return [...RAIL.querySelectorAll("[data-listing-id]")]
    .map((el) => String(el.dataset.listingId || ""))
    .join(",");
}

function readCache() {
  try {
    const data = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (!data || !Array.isArray(data.items) || !data.items.length) return null;
    if (Date.now() - Number(data.at || 0) > CACHE_TTL_MS) return null;
    return data.items.map(slimListingTile);
  } catch {
    return null;
  }
}

function writeCache(items) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ at: Date.now(), items: items.slice(0, 40).map(slimListingTile) })
    );
  } catch {
  }
}

function paint(picked) {
  if (!RAIL) return;
  if (picked.length && listingKey(picked) === paintedKey()) {
    setSectionVisible(true);
    return;
  }
  RAIL.innerHTML = "";
  if (!picked.length) {
    setSectionVisible(false);
    return;
  }
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
  bindListingOpen(RAIL);
  restoreListingReturn();
  setSectionVisible(true);
}

async function init() {
  if (!RAIL || !SECTION) return;
  if (ALL) ALL.href = "/auto.html?kiemelt=1";

  const cached = readCache();
  if (cached?.length) paint(cached);
  else setSectionVisible(false);

  try {
    const page = await fetchTilePagesUntil({
      vertical: "auto",
      wantCount: TILE_PAGE_INITIAL,
      maxPages: 6,
    });
    let pool = (page.items || []).map(slimListingTile);
    let offset = page.offset;
    let hasMore = page.hasMore;
    let picked = pickFeaturedListings(pool, { limit: TILE_PAGE_INITIAL });

    let guard = 0;
    while (picked.length < TILE_PAGE_INITIAL && hasMore && guard < 5) {
      guard += 1;
      const more = await fetchTilePagesUntil({
        vertical: "auto",
        offset,
        wantCount: TILE_PAGE_MORE,
        maxPages: 3,
      });
      offset = more.offset;
      hasMore = more.hasMore;
      if (!more.items?.length) break;
      const seen = new Set(pool.map((row) => Number(row.id)));
      for (const item of more.items) {
        const id = Number(item.id);
        if (!Number.isFinite(id) || seen.has(id)) continue;
        seen.add(id);
        pool.push(slimListingTile(item));
      }
      picked = pickFeaturedListings(pool, { limit: TILE_PAGE_INITIAL });
    }

    paint(picked);
    if (picked.length) writeCache(picked);
  } catch {
    if (!RAIL.querySelector(".hf-card--listing")) setSectionVisible(false);
  }
}

init();
