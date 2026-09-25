import { pickFeaturedListings } from "./home-featured-slots.js?v=featuredNoAuto1";
import { createListingTileCard, slimListingTile } from "./listing-tile.js?v=listThumb1";
import { bindListingOpen, restoreListingReturn } from "./listing-return.js?v=scrollTop1";
import {
  TILE_PAGE_INITIAL,
  TILE_PAGE_MORE,
  fetchTilePagesUntil,
} from "./listing-tile-pager.js?v=tilePage1";

const SECTION = document.querySelector('[data-hf="kiemelt"]');
const RAIL = document.getElementById("hub-featured-rail");
const EMPTY = document.getElementById("hub-featured-empty");
const ALL = document.getElementById("hub-featured-all");

function setSectionVisible(hasListings) {
  if (SECTION) SECTION.hidden = !hasListings;
  if (RAIL) RAIL.hidden = !hasListings;
  if (EMPTY) EMPTY.hidden = true;
}

async function init() {
  if (!RAIL || !SECTION) return;
  setSectionVisible(false);
  if (ALL) ALL.href = "/auto.html?kiemelt=1";

  try {
    // Csak csempe-oldalak — max néhány lap, amíg van elég kiemelt jelölt.
    const page = await fetchTilePagesUntil({
      vertical: "auto",
      wantCount: TILE_PAGE_INITIAL,
      maxPages: 6,
    });
    let pool = (page.items || []).map(slimListingTile);
    let offset = page.offset;
    let hasMore = page.hasMore;
    let picked = pickFeaturedListings(pool);

    let guard = 0;
    while (picked.length < 4 && hasMore && guard < 5) {
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
      picked = pickFeaturedListings(pool);
    }

    RAIL.innerHTML = "";
    if (!picked.length) {
      setSectionVisible(false);
      return;
    }

    const configured = new Set(picked.map((row) => Number(row.id)));
    picked.slice(0, TILE_PAGE_INITIAL).forEach((item, index) => {
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
  } catch {
    setSectionVisible(false);
  }
}

init();
