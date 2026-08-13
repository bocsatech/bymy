import {
  buildCityIndex,
  filterListingsInRadius,
  filterListingsRecentInRadius,
} from "./listing-radius.js";

const STORAGE_POSTAL = "autosweb_stats_postal";
const STORAGE_RADIUS = "autosweb_stats_radius_km";

const MODE_ALL = "all";
const MODE_RECENT24H = "recent24h";

async function fetchPostalLookup(postalCode) {
  const params = new URLSearchParams({ postal_code: postalCode });
  const res = await fetch(`/api/postal-codes/lookup?${params}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? "Ismeretlen irányítószám.");
  }
  return data;
}

async function fetchCityIndex() {
  const res = await fetch("/api/postal-codes/cities");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? "Nem sikerült betölteni a településlistát.");
  }
  return buildCityIndex(data.cities ?? []);
}

function formatCount(value) {
  return Number(value).toLocaleString("hu-HU");
}

export function initHomeStatsBar({ onChange, getItems }) {
  const totalCard = document.getElementById("home-stats-total-card");
  const recentCard = document.getElementById("home-stats-recent-card");
  const postalInput = document.getElementById("home-stats-postal");
  const radiusInput = document.getElementById("home-stats-radius-km");
  const totalCountEl = document.getElementById("home-stats-total-count");
  const totalMetaEl = document.getElementById("home-stats-total-meta");
  const recentCountEl = document.getElementById("home-stats-recent-count");
  const recentMetaEl = document.getElementById("home-stats-recent-meta");
  if (
    !totalCard ||
    !recentCard ||
    !postalInput ||
    !radiusInput ||
    !totalCountEl ||
    !totalMetaEl ||
    !recentCountEl ||
    !recentMetaEl
  ) {
    return null;
  }

  const filterCards = [totalCard, recentCard];
  let cityIndexPromise = null;
  let activeFilter = null;

  function getCityIndex() {
    if (!cityIndexPromise) {
      cityIndexPromise = fetchCityIndex();
    }
    return cityIndexPromise;
  }

  function setMeta(el, message, type = "") {
    el.textContent = message ?? "";
    el.dataset.statusType = type;
  }

  function setCount(el, value) {
    el.textContent = value == null ? "—" : formatCount(value);
  }

  function readInputs() {
    const postal_code = postalInput.value.replace(/\D/g, "").slice(0, 4);
    const radiusRaw = radiusInput.value.trim();
    const radiusKm = Number(radiusRaw);
    return { postal_code, radiusRaw, radiusKm };
  }

  function validateInputs() {
    const { postal_code, radiusRaw, radiusKm } = readInputs();
    if (postal_code.length !== 4) {
      return { error: "Adj meg érvényes 4 számjegyű irányítószámot." };
    }
    if (!radiusRaw || !Number.isFinite(radiusKm) || radiusKm <= 0) {
      return { error: "Add meg a keresési sugarat km-ben." };
    }
    return { postal_code, radiusKm };
  }

  function buildActiveFilter(mode, origin, radiusKm, filtered) {
    return {
      mode,
      postal_code: origin.postal_code,
      radiusKm,
      origin,
      listingIds: new Set(filtered.map((item) => item.id)),
      count: filtered.length,
    };
  }

  function setSelectedCard(card) {
    for (const entry of filterCards) {
      entry.classList.toggle("is-active", entry === card);
    }
  }

  function resetCardUi() {
    setCount(totalCountEl, null);
    setCount(recentCountEl, null);
    setMeta(totalMetaEl, "");
    setMeta(recentMetaEl, "Kattints — az első kockában megadott körzetben.");
    filterCards.forEach((card) => card.classList.remove("is-active"));
  }

  function updateCardUi(filter) {
    const metaText = `${filter.origin.city} · ${filter.radiusKm} km`;
    if (filter.mode === MODE_ALL) {
      setCount(totalCountEl, filter.count);
      setMeta(totalMetaEl, metaText, "ok");
      setCount(recentCountEl, null);
      setMeta(recentMetaEl, "Kattints — az első kockában megadott körzetben.");
    } else {
      setCount(recentCountEl, filter.count);
      setMeta(recentMetaEl, metaText, "ok");
      setCount(totalCountEl, null);
      setMeta(totalMetaEl, "");
    }
  }

  function filterItemsForMode(mode, items, origin, radiusKm, cityIndex) {
    if (mode === MODE_RECENT24H) {
      return filterListingsRecentInRadius(
        items,
        origin.lat,
        origin.lon,
        radiusKm,
        cityIndex,
        24
      );
    }
    return filterListingsInRadius(items, origin.lat, origin.lon, radiusKm, cityIndex);
  }

  async function applyFilter(mode) {
    const parsed = validateInputs();
    const card = mode === MODE_ALL ? totalCard : recentCard;
    const metaEl = mode === MODE_ALL ? totalMetaEl : recentMetaEl;

    if (parsed.error) {
      setMeta(metaEl, parsed.error, "err");
      return null;
    }

    const { postal_code, radiusKm } = parsed;

    if (
      activeFilter &&
      activeFilter.mode === mode &&
      activeFilter.postal_code === postal_code &&
      activeFilter.radiusKm === radiusKm
    ) {
      activeFilter = null;
      resetCardUi();
      onChange?.(null);
      return null;
    }

    try {
      const origin = await fetchPostalLookup(postal_code);
      const cityIndex = await getCityIndex();
      const filtered = filterItemsForMode(mode, getItems(), origin, radiusKm, cityIndex);
      activeFilter = buildActiveFilter(mode, origin, radiusKm, filtered);
      setSelectedCard(card);
      updateCardUi(activeFilter);
      onChange?.(activeFilter);

      try {
        localStorage.setItem(STORAGE_POSTAL, postal_code);
        localStorage.setItem(STORAGE_RADIUS, String(radiusKm));
      } catch {
        /* ignore */
      }

      document.querySelector(".home-listings-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return activeFilter;
    } catch (error) {
      setMeta(metaEl, error.message ?? "Nem sikerült a keresés.", "err");
      return null;
    }
  }

  async function refreshActiveCount() {
    if (!activeFilter) return;
    try {
      const cityIndex = await getCityIndex();
      const filtered = filterItemsForMode(
        activeFilter.mode,
        getItems(),
        activeFilter.origin,
        activeFilter.radiusKm,
        cityIndex
      );
      activeFilter = buildActiveFilter(
        activeFilter.mode,
        activeFilter.origin,
        activeFilter.radiusKm,
        filtered
      );
      updateCardUi(activeFilter);
      onChange?.(activeFilter);
    } catch {
      /* keep previous count */
    }
  }

  postalInput.addEventListener("input", () => {
    postalInput.value = postalInput.value.replace(/\D/g, "").slice(0, 4);
  });

  radiusInput.addEventListener("input", () => {
    if (radiusInput.value.includes("-")) {
      radiusInput.value = radiusInput.value.replace(/-/g, "");
    }
  });

  totalCard.addEventListener("click", (event) => {
    if (event.target.closest("input, label")) return;
    applyFilter(MODE_ALL);
  });

  totalCard.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("input")) return;
    event.preventDefault();
    applyFilter(MODE_ALL);
  });

  recentCard.addEventListener("click", () => {
    applyFilter(MODE_RECENT24H);
  });

  recentCard.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    applyFilter(MODE_RECENT24H);
  });

  try {
    const savedPostal = localStorage.getItem(STORAGE_POSTAL);
    const savedRadius = localStorage.getItem(STORAGE_RADIUS);
    if (savedPostal) postalInput.value = savedPostal.replace(/\D/g, "").slice(0, 4);
    if (savedRadius) {
      radiusInput.value = savedRadius.replace(/[^\d.,]/g, "").replace(",", ".");
    }
  } catch {
    /* ignore */
  }

  resetCardUi();

  return {
    getActive: () => activeFilter,
    clear: () => {
      activeFilter = null;
      resetCardUi();
      onChange?.(null);
    },
    refreshActiveCount,
  };
}
