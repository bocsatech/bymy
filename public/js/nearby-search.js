import {
  buildCityIndex,
  filterListingsInRadius,
  filterListingsRecentInRadius,
} from "./listing-radius.js";

export const STORAGE_POSTAL = "bymy_stats_postal";
export const STORAGE_RADIUS = "bymy_stats_radius_km";

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

let cityIndexPromise = null;

function getCityIndex() {
  if (!cityIndexPromise) {
    cityIndexPromise = fetch("/api/postal-codes/cities")
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (!data.cities) throw new Error("Nem sikerült betölteni a településlistát.");
        return buildCityIndex(data.cities);
      });
  }
  return cityIndexPromise;
}

export function readNearbyPrefs(profile = null) {
  let postal = String(profile?.postalCode ?? "").replace(/\D/g, "").slice(0, 4);
  let radiusKm = Number(profile?.searchRadiusKm ?? 30);
  try {
    const savedPostal = localStorage.getItem(STORAGE_POSTAL);
    const savedRadius = localStorage.getItem(STORAGE_RADIUS);
    if (savedPostal) postal = savedPostal.replace(/\D/g, "").slice(0, 4);
    if (savedRadius) radiusKm = Number(savedRadius.replace(/[^\d.,]/g, "").replace(",", "."));
  } catch {
    /* ignore */
  }
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) radiusKm = 30;
  return { postal, radiusKm };
}

function filterItemsForMode(mode, items, origin, radiusKm, cityIndex) {
  if (mode === MODE_RECENT24H) {
    return filterListingsRecentInRadius(items, origin.lat, origin.lon, radiusKm, cityIndex, 24);
  }
  return filterListingsInRadius(items, origin.lat, origin.lon, radiusKm, cityIndex);
}

export function buildNearbyFilterState(mode, origin, radiusKm, filtered) {
  return {
    mode,
    postal_code: origin.postal_code,
    radiusKm,
    origin,
    listingIds: new Set(filtered.map((item) => item.id)),
    count: filtered.length,
  };
}

export async function buildNearbyFilter({
  items,
  postal,
  radiusKm,
  mode = MODE_ALL,
}) {
  const postal_code = String(postal ?? "").replace(/\D/g, "").slice(0, 4);
  const radius = Number(radiusKm);
  if (postal_code.length !== 4) {
    throw new Error("Adj meg érvényes 4 számjegyű irányítószámot.");
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error("Add meg a keresési sugarat km-ben.");
  }
  const origin = await fetchPostalLookup(postal_code);
  const cityIndex = await getCityIndex();
  const filtered = filterItemsForMode(mode, items ?? [], origin, radius, cityIndex);
  return buildNearbyFilterState(mode, origin, radius, filtered);
}

export function autoNearbyHref(postal, radiusKm) {
  const params = new URLSearchParams({
    nearby: "1",
    postal: String(postal ?? "").replace(/\D/g, "").slice(0, 4),
    radius: String(radiusKm ?? 30),
  });
  return `/auto.html?${params}`;
}

export function filterAutoListings(items) {
  return (items ?? []).filter((item) => {
    if ((item.status || "feladott") !== "feladott") return false;
    const vertical = String(item?.preview?.filter?.hirdetes_vertical ?? "").trim().toLowerCase();
    return vertical !== "teher" && vertical !== "ingatlan";
  });
}
