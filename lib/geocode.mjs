/** Geocode HU: Google (ha van kulcs), különben Nominatim. */

import { getGoogleMapsApiKey } from "./google-maps-key.mjs";

const UA = "bymy.hu/1.0 (seller-map; https://bymy.hu)";
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
let lastNominatimAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function googleGeocodeSearch(q) {
  const key = getGoogleMapsApiKey();
  if (!key) return null;
  const query = String(q || "").replace(/\s+/g, " ").trim();
  if (!query) return null;

  const cacheKey = `g:${query}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("components", "country:HU");
  url.searchParams.set("language", "hu");
  url.searchParams.set("region", "hu");
  url.searchParams.set("key", key);

  const res = await fetch(url);
  if (!res.ok) {
    cache.set(cacheKey, { at: Date.now(), value: null });
    return null;
  }
  const data = await res.json().catch(() => ({}));
  const hit = Array.isArray(data.results) ? data.results[0] : null;
  const loc = hit?.geometry?.location;
  const lat = loc?.lat != null ? Number(loc.lat) : NaN;
  const lon = loc?.lng != null ? Number(loc.lng) : NaN;
  const value =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? { lat, lon, label: String(hit.formatted_address || query), provider: "google" }
      : null;
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}

async function nominatimSearch(q) {
  const query = String(q || "").replace(/\s+/g, " ").trim();
  if (!query) return null;

  const cacheKey = `n:${query}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const wait = 1100 - (Date.now() - lastNominatimAt);
  if (wait > 0) await sleep(wait);
  lastNominatimAt = Date.now();

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=hu&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": UA,
    },
  });
  if (!res.ok) {
    cache.set(cacheKey, { at: Date.now(), value: null });
    return null;
  }
  const data = await res.json();
  const hit = Array.isArray(data) ? data[0] : null;
  const lat = hit?.lat != null ? Number(hit.lat) : NaN;
  const lon = hit?.lon != null ? Number(hit.lon) : NaN;
  const value =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? { lat, lon, label: String(hit.display_name || query), provider: "nominatim" }
      : null;
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}

async function searchOne(attempt) {
  try {
    const googleHit = await googleGeocodeSearch(attempt);
    if (googleHit) return googleHit;
  } catch {
    /* Nominatim fallback */
  }
  try {
    return await nominatimSearch(attempt);
  } catch {
    return null;
  }
}

/** Próbál teljes címet, majd irányítószám+település, majd település. */
export async function geocodeHungaryAddress({ query = "", addressLines = [] } = {}) {
  const lines = (Array.isArray(addressLines) ? addressLines : [])
    .map((l) => String(l || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const postalCity = lines.find((l) => /^\d{4}\b/.test(l)) || "";
  const street = lines.find((l) => l && l !== postalCity) || "";
  const q = String(query || "").replace(/\s+/g, " ").trim();

  const attempts = [];
  if (q) attempts.push(q);
  if (street && postalCity) attempts.push(`${street}, ${postalCity}, Magyarország`);
  if (postalCity) attempts.push(`${postalCity}, Magyarország`);
  const cityOnly = postalCity.replace(/^\d{4}\s*/, "").trim();
  if (cityOnly) attempts.push(`${cityOnly}, Magyarország`);

  const seen = new Set();
  for (const attempt of attempts) {
    const key = attempt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const hit = await searchOne(attempt);
    if (hit) return hit;
  }
  return null;
}
