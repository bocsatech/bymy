import {
  buildCityIndex,
  buildPostalIndex,
  filterListingsInRadius,
  filterListingsRecentInRadius,
  resolveCityCoords,
} from "./listing-radius.js?v=9eab9e5218";

export const STORAGE_POSTAL = "bymy_stats_postal";
export const STORAGE_RADIUS = "bymy_stats_radius_km";
export const STORAGE_CITY = "bymy_stats_city";

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
let postalIndexPromise = null;

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

function getPostalIndex() {
  if (!postalIndexPromise) {
    postalIndexPromise = fetch("/api/postal-codes/index", { credentials: "same-origin" })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (!Array.isArray(data.postals)) return null;
        return buildPostalIndex(data.postals);
      })
      .catch(() => {
        postalIndexPromise = null;
        return null;
      });
  }
  return postalIndexPromise;
}

function profilePostalCode(profile = null) {
  return String(profile?.postalCode || profile?.companyPostalCode || "")
    .replace(/\D/g, "")
    .slice(0, 4);
}

export function readNearbyPrefs(profile = null) {
  let postal = profilePostalCode(profile);
  let city = String(profile?.city || profile?.companyCity || "").trim();
  let radiusKm = Number(profile?.searchRadiusKm ?? 30);
  try {
    const savedPostal = localStorage.getItem(STORAGE_POSTAL);
    const savedRadius = localStorage.getItem(STORAGE_RADIUS);
    const savedCity = localStorage.getItem(STORAGE_CITY);
    if (savedPostal) postal = savedPostal.replace(/\D/g, "").slice(0, 4);
    if (savedCity) city = String(savedCity).trim() || city;
    if (savedRadius) {
      radiusKm = Number(savedRadius.replace(/[^\d.,]/g, "").replace(",", "."));
    } else if (Number.isFinite(Number(profile?.searchRadiusKm)) && Number(profile.searchRadiusKm) > 0) {
      radiusKm = Number(profile.searchRadiusKm);
    }
  } catch {
  }
  if (postal.length !== 4) postal = profilePostalCode(profile);
  if (!city) city = String(profile?.city || profile?.companyCity || "").trim();
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) radiusKm = 30;
  return { postal, city, radiusKm };
}

/** Profil irányítószám → localStorage, ha a keresési körzet még nincs elmentve. */
export function ensureNearbyPrefsStored(profile = null) {
  const p = profile ?? null;
  if (!p) return;
  try {
    const postal = profilePostalCode(p);
    if (postal.length === 4 && !localStorage.getItem(STORAGE_POSTAL)) {
      localStorage.setItem(STORAGE_POSTAL, postal);
    }
    const city = String(p.city || p.companyCity || "").trim();
    if (city && !localStorage.getItem(STORAGE_CITY)) {
      localStorage.setItem(STORAGE_CITY, city);
    }
    const radius = Number(p.searchRadiusKm);
    if (Number.isFinite(radius) && radius > 0 && !localStorage.getItem(STORAGE_RADIUS)) {
      localStorage.setItem(STORAGE_RADIUS, String(radius));
    }
  } catch {
  }
}

function filterItemsForMode(mode, items, origin, radiusKm, cityIndex, postalIndex = null) {
  const originCity = origin?.city || "";
  if (mode === MODE_RECENT24H) {
    return filterListingsRecentInRadius(
      items,
      origin.lat,
      origin.lon,
      radiusKm,
      cityIndex,
      24,
      originCity,
      postalIndex
    );
  }
  return filterListingsInRadius(items, origin.lat, origin.lon, radiusKm, cityIndex, originCity, postalIndex);
}

export function buildNearbyFilterState(mode, origin, radiusKm, filtered) {
  return {
    mode,
    postal_code: origin.postal_code || "",
    radiusKm,
    origin,
    listingIds: new Set(filtered.map((item) => item.id)),
    count: filtered.length,
  };
}

/**
 * Körzetes keresés CSAK településnév alapján.
 * Az irányítószám legfeljebb a településnév feloldására szolgál — soha nem a keresési középpont.
 */
export async function buildNearbyFilter({
  items,
  postal,
  radiusKm,
  mode = MODE_ALL,
  city = "",
}) {
  const radius = Number(radiusKm);
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error("Add meg a keresési sugarat km-ben.");
  }

  let cityName = String(city || "").trim();
  const postal_code = String(postal ?? "").replace(/\D/g, "").slice(0, 4);
  const [cityIndex, postalIndex] = await Promise.all([getCityIndex(), getPostalIndex()]);

  if (!cityName && postal_code.length === 4) {
    try {
      const looked = await fetchPostalLookup(postal_code);
      cityName = String(looked?.city || "").trim();
    } catch {
      /* ignore */
    }
  }

  if (!cityName) {
    throw new Error("Adj meg települést a térképes / körzetes kereséshez.");
  }

  let hit = resolveCityCoords(cityName, cityIndex);
  if (!hit) {
    /* Kis falvak: seedben gyakran nincs valódi koord → Nominatim. */
    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(`${cityName}, Magyarország`)}`,
        { credentials: "same-origin" }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.lat != null && data.lon != null) {
        hit = { city: cityName, lat: Number(data.lat), lon: Number(data.lon) };
      }
    } catch {
      /* ignore */
    }
  }
  if (!hit) {
    throw new Error(`Ismeretlen település: ${cityName}`);
  }

  const origin = {
    lat: hit.lat,
    lon: hit.lon,
    city: hit.city,
    postal_code,
  };
  const filtered = filterItemsForMode(mode, items ?? [], origin, radius, cityIndex, postalIndex);
  return buildNearbyFilterState(mode, origin, radius, filtered);
}

export function autoNearbyHref(postal, radiusKm, city = "") {
  const params = new URLSearchParams({
    nearby: "1",
    radius: String(radiusKm ?? 30),
  });
  const code = String(postal ?? "").replace(/\D/g, "").slice(0, 4);
  if (code.length === 4) params.set("postal", code);
  const cityName = String(city || "").trim();
  if (cityName) params.set("city", cityName);
  return `/auto.html?${params}`;
}

export function filterAutoListings(items) {
  return (items ?? []).filter((item) => {
    if ((item.status || "feladott") !== "feladott") return false;
    const vertical = String(item?.preview?.filter?.hirdetes_vertical ?? "").trim().toLowerCase();
    return vertical !== "teher" && vertical !== "ingatlan" && vertical !== "piac";
  });
}

export function filterPiacListings(items) {
  return (items ?? []).filter((item) => {
    if ((item.status || "feladott") !== "feladott") return false;
    const vertical = String(
      item?.preview?.filter?.hirdetes_vertical ?? item?.form?.hirdetes_vertical ?? ""
    )
      .trim()
      .toLowerCase();
    return vertical === "piac";
  });
}

export function piacNearbyHref(postal, radiusKm, city = "") {
  const params = new URLSearchParams({
    nearby: "1",
    radius: String(radiusKm ?? 30),
  });
  const code = String(postal ?? "").replace(/\D/g, "").slice(0, 4);
  if (code.length === 4) params.set("postal", code);
  const cityName = String(city || "").trim();
  if (cityName) params.set("city", cityName);
  return `/piacter.html?${params}`;
}

function listingField(item, key) {
  const f = item?.preview?.filter ?? {};
  const form = item?.form ?? {};
  const v = f[key] ?? form[key];
  return v == null ? "" : String(v).trim();
}

function listingVertical(item) {
  const vertical = listingField(item, "hirdetes_vertical").toLowerCase();
  const sub = listingField(item, "hirdetes_alkategoria").toLowerCase();
  if (vertical === "ingatlan" || sub === "ingatlan" || sub.startsWith("ingatlan")) return "ingatlan";
  return vertical || "auto";
}

function normalizeUzletag(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (v === "elado" || v === "kinal" || v === "eladó") return "elado";
  if (v === "airbnb" || v === "rovid" || v === "rövid") return "airbnb";
  if (v === "kiado" || v === "kiadó" || v === "berbe" || v === "berles" || v === "berelheto" || v === "keres") {
    return "kiado";
  }
  return v;
}

function tipustTokens(item) {
  const raw = listingField(item, "ingatlan_lakas_tipus");
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function filterIngatlanListings(items, { uzletag = "", tipus = "" } = {}) {
  const wantUz = uzletag ? normalizeUzletag(uzletag) : "";
  const wantTipus = String(tipus || "")
    .trim()
    .toLowerCase();
  return (items ?? []).filter((item) => {
    if ((item.status || "feladott") !== "feladott") return false;
    if (listingVertical(item) !== "ingatlan") return false;
    if (wantUz) {
      const got = normalizeUzletag(listingField(item, "ingatlan_uzletag"));
      if (got && got !== wantUz) return false;
      if (!got && wantUz === "elado") return false;
    }
    if (wantTipus) {
      const tokens = tipustTokens(item);
      if (!tokens.length) return false;
      if (!tokens.includes(wantTipus)) return false;
    }
    return true;
  });
}

export function ingatlanNearbyHref(postal, radiusKm, { uzletag = "", tipus = "", city = "" } = {}) {
  const params = new URLSearchParams({
    nearby: "1",
    radius: String(radiusKm ?? 30),
  });
  const code = String(postal ?? "").replace(/\D/g, "").slice(0, 4);
  if (code.length === 4) params.set("postal", code);
  const cityName = String(city || "").trim();
  if (cityName) params.set("city", cityName);
  if (uzletag) params.set("uzletag", normalizeUzletag(uzletag));
  if (tipus) params.set("kat", String(tipus).trim().toLowerCase());
  return `/ingatlan.html?${params}`;
}
