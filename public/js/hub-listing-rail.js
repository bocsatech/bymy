import {
  createListingTileCard,
  formatListingCountBadge,
  slimListingTile,
} from "./listing-tile.js?v=titleChrome1";
import { bindListingOpen, restoreListingReturn } from "./listing-return.js?v=scrollTop1";

const INITIAL_COUNT = 9;
const SCROLL_BATCH = 5;
const RAIL_CAP = 13;
const CACHE_TTL_MS = 15 * 60 * 1000;

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

export function initHubListingRail(opts) {
  const {
    railEl: RAIL,
    statusEl: STATUS,
    countEl: COUNT_EL,
    allLinkEl: ALL_LINK,
    cacheKey: CACHE_KEY,
    defaultAllHref,
    settingsHref = "/beallitasok.html?szekcio=keresesi-korzet",
    noun,
    nounPlural,
    needsPostal = true,
    loadFresh,
    emptyPrompt,
    noPostalPrompt,
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
    if (hasAllPrompt) return;
    if (renderedCount < RAIL_CAP) return;
    if (nearbyItems.length <= RAIL_CAP) return;
    const card = createPromptCard("Összes megnyitása", allHref);
    card.classList.add("hf-card--prompt-all");
    RAIL.appendChild(card);
    hasAllPrompt = true;
  }

  function appendNext(count) {
    if (loadingMore) return;
    const remaining = Math.min(RAIL_CAP, nearbyItems.length) - renderedCount;
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

  function renderInitial(items) {
    nearbyItems = items;
    renderedCount = 0;
    hasAllPrompt = false;
    RAIL.innerHTML = "";
    setCountBadge(items.length);
    appendNext(INITIAL_COUNT);
  }

  function onRailScroll() {
    if (!nearbyItems.length) return;
    if (renderedCount >= Math.min(RAIL_CAP, nearbyItems.length)) {
      ensureAllPrompt();
      return;
    }
    const nearEnd = RAIL.scrollLeft + RAIL.clientWidth >= RAIL.scrollWidth - 120;
    if (nearEnd) appendNext(SCROLL_BATCH);
  }

  function bindRailLazy() {
    if (RAIL.dataset.nearbyLazyBound === "1") return;
    RAIL.dataset.nearbyLazyBound = "1";
    RAIL.addEventListener("scroll", onRailScroll, { passive: true });
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onRailScroll();
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
          items: items.map(slimListingTile),
        })
      );
    } catch {
    }
  }

  bindListingOpen(RAIL);
  bindRailLazy();

  return {
    sortByDate,
    slimListingTile,
    createPromptCard,
    writeCache,
    async start({ postal, radiusKm }) {
      radiusLabel = radiusKm;
      if (ALL_LINK && postal.length === 4 && needsPostal) {
      }

      if (needsPostal && postal.length !== 4) {
        renderInitial([]);
        const prompt = noPostalPrompt || {
          label: "Keresési körzet beállítása",
          href: settingsHref,
          status: `Add meg az irányítószámot a Beállításokban a közeli ${plural} megjelenítéséhez.`,
        };
        RAIL.appendChild(createPromptCard(prompt.label, prompt.href));
        setStatus(prompt.status);
        restoreListingReturn();
        return;
      }

      const cached = needsPostal ? readCache(postal, radiusKm) : null;
      if (cached?.items?.length) {
        cityLabel = cached.city || "";
        renderInitial(cached.items);
        setStatus(
          `${cached.items.length} ${cached.items.length === 1 ? noun : plural}${cityLabel ? ` ${cityLabel}` : ""} ${radiusKm} km-en belül.`,
          { hidden: true }
        );
        restoreListingReturn();
        loadFresh({ postal, radiusKm })
          .then((fresh) => {
            const items = fresh.items || [];
            if (!items.length) return;
            const sameIds =
              items.length === nearbyItems.length &&
              items.every((item, i) => Number(item.id) === Number(nearbyItems[i]?.id));
            if (sameIds) return;
            cityLabel = fresh.city || "";
            allHref = fresh.href || allHref;
            if (ALL_LINK && allHref) ALL_LINK.href = allHref;
            const keepScroll = RAIL.scrollLeft;
            renderInitial(items);
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
          const empty =
            emptyPrompt?.({ href: allHref, city: cityLabel, radiusKm }) || {
              label: `Nincs ${noun} a körzetben`,
              href: allHref,
              status: `Nincs ${noun} ${cityLabel || ""} ${radiusKm} km-es körzetében.`,
            };
          RAIL.appendChild(createPromptCard(empty.label, empty.href));
          setStatus(empty.status);
          restoreListingReturn();
          return;
        }

        if (needsPostal && !fresh.skipCache) {
          writeCache(postal, radiusKm, items, { city: cityLabel });
        }
        renderInitial(items);
        setStatus(
          `${items.length} ${items.length === 1 ? noun : plural}${cityLabel ? ` ${cityLabel}` : ""} ${radiusKm} km-en belül.`,
          { hidden: true }
        );
      } catch (error) {
        renderInitial([]);
        RAIL.appendChild(createPromptCard("Újrapróbálás", settingsHref));
        setStatus(error.message ?? `Nem sikerült betölteni a közeli ${plural}.`);
      }
      restoreListingReturn();
    },
  };
}

export { createPromptCard, sortByDate, slimListingTile };
