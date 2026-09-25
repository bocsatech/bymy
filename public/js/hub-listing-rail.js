import {
  createListingTileCard,
  formatListingCountBadge,
  slimListingTile,
} from "./listing-tile.js?v=listThumb1";
import { bindListingOpen, restoreListingReturn } from "./listing-return.js?v=scrollTop1";
import {
  TILE_PAGE_INITIAL,
  TILE_PAGE_MORE,
} from "./listing-tile-pager.js?v=tilePage1";

const CACHE_TTL_MS = 15 * 60 * 1000;

/** Teljes „közelben” szekció: csak ha van megjeleníthető hirdetés. */
export function setHubSectionVisible(railEl, visible) {
  const section = railEl?.closest?.(".hf-section");
  if (!section) return;
  section.hidden = !visible;
}

function sortByDate(items) {
  return [...items].sort((a, b) => {
    const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });
}

function createPromptCard(label, href) {
  const link = document.createElement("a");
  link.className = "hf-card hf-card--listing hf-card--prompt";
  link.href = href;
  link.setAttribute("role", "listitem");
  link.innerHTML = `
    <span class="hf-card-media" aria-hidden="true"></span>
    <span class="hf-card-label">${label}</span>`;
  return link;
}

/**
 * Hub listing sín: első 20 csempe, görgetésre +10 (API folytatás opcionális).
 * soha nem tölti be az összeset egyben — „Összes” csak link a listoldalra.
 */
export function initHubListingRail(opts) {
  const {
    railEl: RAIL,
    statusEl: STATUS,
    countEl: COUNT_EL,
    allLinkEl: ALL_LINK,
    cacheKey: CACHE_KEY,
    defaultAllHref,
    noun,
    nounPlural,
    needsPostal = true,
    loadFresh,
    loadMoreFresh = null,
  } = opts;

  if (!RAIL) return;

  const plural = nounPlural || `${noun}ok`;
  let nearbyItems = [];
  let renderedCount = 0;
  let allHref = defaultAllHref;
  let cityLabel = "";
  let radiusLabel = 30;
  let loadingMore = false;
  let hasAllPrompt = false;
  let apiHasMore = false;
  let totalCount = null;

  function setCountBadge(n) {
    if (!COUNT_EL) return;
    const label = formatListingCountBadge(n);
    COUNT_EL.textContent = label;
    COUNT_EL.hidden = !label;
  }

  function setStatus(message, { hidden = false } = {}) {
    if (!STATUS) return;
    STATUS.textContent = message || "";
    STATUS.hidden = hidden || !message;
  }

  function removeAllPrompt() {
    RAIL.querySelectorAll(".hf-card--prompt-all").forEach((el) => el.remove());
    hasAllPrompt = false;
  }

  function ensureAllPrompt() {
    if (hasAllPrompt || !allHref) return;
    const moreOnList = apiHasMore || nearbyItems.length > renderedCount;
    if (!moreOnList && nearbyItems.length <= TILE_PAGE_INITIAL) return;
    if (renderedCount < Math.min(TILE_PAGE_INITIAL, nearbyItems.length)) return;
    const card = createPromptCard("Összes megnyitása", allHref);
    card.classList.add("hf-card--prompt-all");
    RAIL.appendChild(card);
    hasAllPrompt = true;
  }

  function appendNext(count) {
    if (loadingMore) return;
    const remaining = nearbyItems.length - renderedCount;
    if (remaining <= 0) {
      ensureAllPrompt();
      return;
    }
    loadingMore = true;
    const take = Math.min(count, remaining);
    const slice = nearbyItems.slice(renderedCount, renderedCount + take);
    removeAllPrompt();
    for (const item of slice) {
      RAIL.appendChild(createListingTileCard(item));
    }
    renderedCount += slice.length;
    ensureAllPrompt();
    loadingMore = false;
  }

  async function maybeFetchMore() {
    if (!loadMoreFresh || loadingMore || !apiHasMore) return;
    if (nearbyItems.length - renderedCount > TILE_PAGE_MORE) return;
    loadingMore = true;
    try {
      const more = await loadMoreFresh();
      const batch = Array.isArray(more?.items) ? more.items : [];
      if (more?.hasMore != null) apiHasMore = Boolean(more.hasMore);
      if (more?.total != null) {
        totalCount = Number(more.total);
        setCountBadge(totalCount);
      }
      if (batch.length) {
        const seen = new Set(nearbyItems.map((row) => Number(row.id)));
        for (const item of batch) {
          const id = Number(item.id);
          if (!Number.isFinite(id) || seen.has(id)) continue;
          seen.add(id);
          nearbyItems.push(item);
        }
      } else if (!apiHasMore) {
        /* nothing */
      }
    } catch (error) {
      console.warn("hub rail more:", error);
    } finally {
      loadingMore = false;
    }
  }

  function renderInitial(items, meta = {}) {
    nearbyItems = items;
    renderedCount = 0;
    hasAllPrompt = false;
    apiHasMore = Boolean(meta.hasMore);
    if (meta.total != null) totalCount = Number(meta.total);
    RAIL.innerHTML = "";
    setCountBadge(totalCount != null ? totalCount : items.length);
    appendNext(TILE_PAGE_INITIAL);
    requestAnimationFrame(() => {
      if (renderedCount < Math.min(TILE_PAGE_INITIAL, nearbyItems.length)) {
        appendNext(Math.min(TILE_PAGE_INITIAL, nearbyItems.length) - renderedCount);
      }
      onRailScroll();
    });
  }

  function bindSectionVisibility() {
    const section = RAIL.closest(".hf-section");
    if (!section || section.dataset.nearbyVisBound === "1") return;
    section.dataset.nearbyVisBound = "1";
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onRailScroll();
        }
      },
      { threshold: 0.05 }
    );
    io.observe(section);
  }

  async function onRailScroll() {
    if (!nearbyItems.length && !apiHasMore) return;
    const nearEnd = RAIL.scrollLeft + RAIL.clientWidth >= RAIL.scrollWidth - 140;
    if (!nearEnd) return;
    if (nearbyItems.length - renderedCount < TILE_PAGE_MORE) {
      await maybeFetchMore();
    }
    if (renderedCount < nearbyItems.length) {
      appendNext(TILE_PAGE_MORE);
    } else {
      ensureAllPrompt();
    }
  }

  function bindRailLazy() {
    if (RAIL.dataset.nearbyLazyBound === "1") return;
    RAIL.dataset.nearbyLazyBound = "1";
    RAIL.addEventListener(
      "scroll",
      () => {
        void onRailScroll();
      },
      { passive: true }
    );
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) void onRailScroll();
        }
      },
      { root: RAIL, rootMargin: "0px 80px 0px 0px", threshold: 0.01 }
    );
    const watch = () => {
      const last = RAIL.querySelector(".hf-card--listing:last-of-type");
      if (last) io.observe(last);
    };
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(RAIL, { childList: true });
  }

  function readCache(postal, radiusKm) {
    try {
      const data = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (!data || !Array.isArray(data.items)) return null;
      if (data.postal !== postal || Number(data.radiusKm) !== Number(radiusKm)) return null;
      if (Date.now() - Number(data.at || 0) > CACHE_TTL_MS) return null;
      return data;
    } catch {
      return null;
    }
  }

  function writeCache(postal, radiusKm, items, meta = {}) {
    try {
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          postal,
          radiusKm,
          at: Date.now(),
          city: meta.city || "",
          hasMore: Boolean(meta.hasMore),
          total: meta.total ?? null,
          items: items.slice(0, 40).map(slimListingTile),
        })
      );
    } catch {
    }
  }

  bindListingOpen(RAIL);
  bindRailLazy();
  bindSectionVisibility();

  return {
    sortByDate,
    slimListingTile,
    createPromptCard,
    writeCache,
    async start({ postal, radiusKm }) {
      radiusLabel = radiusKm;
      setHubSectionVisible(RAIL, false);
      totalCount = null;
      apiHasMore = false;

      if (needsPostal && postal.length !== 4) {
        renderInitial([]);
        setStatus("", { hidden: true });
        restoreListingReturn();
        return;
      }

      const cached = needsPostal ? readCache(postal, radiusKm) : null;
      if (cached?.items?.length) {
        cityLabel = cached.city || "";
        setHubSectionVisible(RAIL, true);
        renderInitial(cached.items, {
          hasMore: cached.hasMore,
          total: cached.total,
        });
        setStatus(
          `${cached.items.length} ${cached.items.length === 1 ? noun : plural}${cityLabel ? ` ${cityLabel}` : ""} ${radiusKm} km-en belül.`,
          { hidden: true }
        );
        restoreListingReturn();
        loadFresh({ postal, radiusKm })
          .then((fresh) => {
            const items = fresh.items || [];
            if (!items.length) {
              renderInitial([]);
              setStatus("", { hidden: true });
              setHubSectionVisible(RAIL, false);
              return;
            }
            cityLabel = fresh.city || "";
            allHref = fresh.href || allHref;
            if (ALL_LINK && allHref) ALL_LINK.href = allHref;
            setHubSectionVisible(RAIL, true);
            const keepScroll = RAIL.scrollLeft;
            renderInitial(items, {
              hasMore: fresh.hasMore,
              total: fresh.total,
            });
            RAIL.scrollLeft = keepScroll;
          })
          .catch(() => {});
        return;
      }

      setStatus(`Közeli ${plural} betöltése…`);
      try {
        const fresh = await loadFresh({ postal, radiusKm });
        allHref = fresh.href || defaultAllHref;
        cityLabel = fresh.city || "";
        if (ALL_LINK && allHref) ALL_LINK.href = allHref;

        const items = fresh.items || [];
        if (!items.length) {
          renderInitial([]);
          setStatus("", { hidden: true });
          setHubSectionVisible(RAIL, false);
          restoreListingReturn();
          return;
        }

        if (needsPostal && !fresh.skipCache) {
          writeCache(postal, radiusKm, items, {
            city: cityLabel,
            hasMore: fresh.hasMore,
            total: fresh.total,
          });
        }
        setHubSectionVisible(RAIL, true);
        renderInitial(items, { hasMore: fresh.hasMore, total: fresh.total });
        setStatus(
          `${items.length} ${items.length === 1 ? noun : plural}${cityLabel ? ` ${cityLabel}` : ""} ${radiusKm} km-en belül.`,
          { hidden: true }
        );
      } catch (error) {
        renderInitial([]);
        setStatus("", { hidden: true });
        setHubSectionVisible(RAIL, false);
        console.warn("hub listing rail:", error);
      }
      restoreListingReturn();
    },
  };
}

export { createPromptCard, sortByDate, slimListingTile, TILE_PAGE_INITIAL, TILE_PAGE_MORE };
