/**
 * Listacsemepe lapozás: első 20, majd +10 — teljes hirdetés nélkül.
 */
import { fetchListingsPage } from "./db-client.js?v=listPage1";

export const TILE_PAGE_INITIAL = 20;
export const TILE_PAGE_MORE = 10;

export async function fetchTilePage({
  vertical = null,
  status = "feladott",
  offset = 0,
  limit = TILE_PAGE_INITIAL,
} = {}) {
  const page = await fetchListingsPage({
    limit,
    offset,
    status,
    vertical,
    tile: true,
  });
  const listings = Array.isArray(page.listings) ? page.listings : [];
  return {
    listings,
    total: page.total != null ? Number(page.total) : null,
    offset: (Number(page.offset) || 0) + listings.length,
    hasMore: Boolean(page.hasMore),
  };
}

/**
 * Oldalanként húz, amíg a filterBatch után elég találat nincs, vagy elfogy a feed.
 * @param {(batch: object[]) => object[] | Promise<object[]>} filterBatch
 */
export async function fetchTilePagesUntil({
  vertical = null,
  status = "feladott",
  offset = 0,
  wantCount = TILE_PAGE_INITIAL,
  filterBatch = async (items) => items,
  maxPages = 40,
} = {}) {
  let items = [];
  let off = Math.max(0, Number(offset) || 0);
  let hasMore = true;
  let total = null;
  let pages = 0;

  while (items.length < wantCount && hasMore && pages < maxPages) {
    pages += 1;
    const limit = pages === 1 && off === 0 ? TILE_PAGE_INITIAL : TILE_PAGE_MORE;
    const page = await fetchTilePage({ vertical, status, offset: off, limit });
    off = page.offset;
    hasMore = page.hasMore;
    if (page.total != null) total = page.total;
    if (!page.listings.length) {
      hasMore = false;
      break;
    }
    const filtered = await filterBatch(page.listings);
    if (Array.isArray(filtered) && filtered.length) {
      const seen = new Set(items.map((row) => Number(row.id)));
      for (const row of filtered) {
        const id = Number(row.id);
        if (!Number.isFinite(id) || seen.has(id)) continue;
        seen.add(id);
        items.push(row);
      }
    }
  }

  return { items, offset: off, hasMore, total };
}
