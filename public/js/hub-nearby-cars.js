import { fetchListings } from "./db-client.js?v=nearby1";
import { getAuthUser } from "./site-auth.js?v=nearby1";
import {
  bindListingOpen,
  restoreListingReturn,
} from "./listing-return.js?v=scrollTop1";
import {
  createListingTileCard,
  formatListingCountBadge,
  slimListingTile,
} from "./listing-tile.js?v=coverAll1";
import {
  autoNearbyHref,
  buildNearbyFilter,
  filterAutoListings,
  readNearbyPrefs,
} from "./nearby-search.js?v=nearby1";

const RAIL = document.getElementById("hub-nearby-rail");
const STATUS = document.getElementById("hub-nearby-status");
const ALL_LINK = document.getElementById("hub-nearby-all");
const COUNT_EL = document.getElementById("hub-nearby-count");

const CACHE_KEY = "bymy-hub-nearby-v4";
const CACHE_TTL_MS = 5 * 60 * 1000;
const INITIAL_COUNT = 9;
const SCROLL_BATCH = 5;
const RAIL_CAP = 13;

/** @type {object[]} */
let nearbyItems = [];
let renderedCount = 0;
let allHref = "/auto.html?nearby=1";
let cityLabel = "";
let radiusLabel = 30;
let loadingMore = false;
let hasAllPrompt = false;

function sortByDate(items) {
  return [...items].sort((a, b) => {
    const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });
}

function setCountBadge(n) {
  if (!COUNT_EL) return;
  const label = formatListingCountBadge(n);
  COUNT_EL.textContent = label;
  COUNT_EL.hidden = !label;
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

function setStatus(message, { hidden = false } = {}) {
  if (!STATUS) return;
  STATUS.textContent = message || "";
  STATUS.hidden = hidden || !message;
}

function removeAllPrompt() {
  RAIL?.querySelectorAll(".hf-card--prompt-all").forEach((el) => el.remove());
  hasAllPrompt = false;
}

function ensureAllPrompt() {
  if (!RAIL || hasAllPrompt) return;
  if (renderedCount < RAIL_CAP) return;
  if (nearbyItems.length <= RAIL_CAP) return;
  const card = createPromptCard("Összes megnyitása", allHref);
  card.classList.add("hf-card--prompt-all");
  RAIL.appendChild(card);
  hasAllPrompt = true;
}

function appendNext(count) {
  if (!RAIL || loadingMore) return;
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
  if (!RAIL) return;
  nearbyItems = items;
  renderedCount = 0;
  hasAllPrompt = false;
  RAIL.innerHTML = "";
  setCountBadge(items.length);
  appendNext(INITIAL_COUNT);
}

function onRailScroll() {
  if (!RAIL || !nearbyItems.length) return;
  if (renderedCount >= Math.min(RAIL_CAP, nearbyItems.length)) {
    ensureAllPrompt();
    return;
  }
  const nearEnd = RAIL.scrollLeft + RAIL.clientWidth >= RAIL.scrollWidth - 120;
  if (nearEnd) appendNext(SCROLL_BATCH);
}

function bindRailLazy() {
  if (!RAIL || RAIL.dataset.nearbyLazyBound === "1") return;
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
    /* quota */
  }
}

async function loadNearbyFresh(postal, radiusKm) {
  const all = await fetchListings({ limit: 500 });
  const autos = sortByDate(filterAutoListings(all));
  const filter = await buildNearbyFilter({ items: autos, postal, radiusKm });
  const nearby = autos.filter((item) => filter.listingIds.has(item.id)).map(slimListingTile);
  writeCache(postal, radiusKm, nearby, { city: filter.origin?.city || "" });
  return {
    nearby,
    city: filter.origin?.city || "",
    href: autoNearbyHref(postal, radiusKm),
  };
}

async function initHubNearbyCars() {
  if (!RAIL) return;

  bindListingOpen(RAIL);
  bindRailLazy();

  const profile = getAuthUser()?.profile ?? null;
  const { postal, radiusKm } = readNearbyPrefs(profile);
  radiusLabel = radiusKm;

  if (ALL_LINK && postal.length === 4) {
    ALL_LINK.href = autoNearbyHref(postal, radiusKm);
    allHref = ALL_LINK.href;
  }

  if (postal.length !== 4) {
    renderInitial([]);
    RAIL.appendChild(
      createPromptCard("Keresési körzet beállítása", "/beallitasok.html?szekcio=keresesi-korzet")
    );
    setStatus("Add meg az irányítószámot a Beállításokban a közeli autók megjelenítéséhez.");
    restoreListingReturn();
    return;
  }

  const cached = readCache(postal, radiusKm);
  if (cached?.items?.length) {
    cityLabel = cached.city || "";
    allHref = autoNearbyHref(postal, radiusKm);
    if (ALL_LINK) ALL_LINK.href = allHref;
    renderInitial(cached.items);
    setStatus(
      `${cached.items.length} autó${cityLabel ? ` ${cityLabel}` : ""} ${radiusKm} km-en belül.`,
      { hidden: true }
    );
    restoreListingReturn();
    loadNearbyFresh(postal, radiusKm)
      .then((fresh) => {
        if (!fresh.nearby.length) return;
        const sameIds =
          fresh.nearby.length === nearbyItems.length &&
          fresh.nearby.every((item, i) => Number(item.id) === Number(nearbyItems[i]?.id));
        if (sameIds) return;
        cityLabel = fresh.city;
        allHref = fresh.href;
        if (ALL_LINK) ALL_LINK.href = allHref;
        const keepScroll = RAIL.scrollLeft;
        renderInitial(fresh.nearby);
        RAIL.scrollLeft = keepScroll;
      })
      .catch(() => {});
    return;
  }

  setStatus("Közeli autók betöltése…");
  try {
    const fresh = await loadNearbyFresh(postal, radiusKm);
    allHref = fresh.href;
    cityLabel = fresh.city;
    if (ALL_LINK) ALL_LINK.href = allHref;

    if (!fresh.nearby.length) {
      renderInitial([]);
      RAIL.appendChild(createPromptCard("Nincs autó a körzetben", allHref));
      setStatus(`Nincs autó ${cityLabel || ""} ${radiusKm} km-es körzetében.`);
      restoreListingReturn();
      return;
    }

    renderInitial(fresh.nearby);
    setStatus(`${fresh.nearby.length} autó ${cityLabel} ${radiusKm} km-en belül.`, { hidden: true });
  } catch (error) {
    renderInitial([]);
    RAIL.appendChild(createPromptCard("Újrapróbálás", "/beallitasok.html?szekcio=keresesi-korzet"));
    setStatus(error.message ?? "Nem sikerült betölteni a közeli autókat.");
  }
  restoreListingReturn();
}

initHubNearbyCars();

window.addEventListener("pageshow", (event) => {
  if (event.persisted && RAIL?.children.length) {
    restoreListingReturn();
  }
});
