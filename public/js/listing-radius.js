export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizePlace(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildCityIndex(cities) {
  const byNorm = new Map();
  for (const row of cities ?? []) {
    const city = String(row.city ?? "").trim();
    if (!city || row.lat == null || row.lon == null) continue;
    const key = normalizePlace(city);
    if (!key || byNorm.has(key)) continue;
    byNorm.set(key, { city, lat: Number(row.lat), lon: Number(row.lon) });
  }
  return byNorm;
}

export function listingCityName(item) {
  const filter = item.preview?.filter ?? {};
  const form = item.form ?? {};
  const fromFilter = filter.telepules || form.telepules || "";
  const fromLocation = item.preview?.location || "";
  return String(fromFilter || fromLocation.split(",")[0] || "").trim();
}

export function listingPostalCode(item) {
  const filter = item.preview?.filter ?? {};
  const form = item.form ?? {};
  const raw = filter.iranyitoszam || form.iranyitoszam || "";
  return String(raw).replace(/\D/g, "").slice(0, 4);
}

export function buildPostalIndex(postals) {
  const byCode = new Map();
  for (const row of postals ?? []) {
    const code = String(row.postal_code ?? "").replace(/\D/g, "").slice(0, 4);
    if (code.length !== 4 || row.lat == null || row.lon == null) continue;
    byCode.set(code, {
      postal: code,
      city: String(row.city ?? "").trim(),
      lat: Number(row.lat),
      lon: Number(row.lon),
    });
  }
  return byCode;
}

export function resolveListingCoords(item, cityIndex, postalIndex = null) {
  const postal = listingPostalCode(item);
  if (postal && postalIndex?.has(postal)) {
    const hit = postalIndex.get(postal);
    return { city: hit.city || listingCityName(item), lat: hit.lat, lon: hit.lon, postal: hit.postal };
  }
  const name = listingCityName(item);
  const norm = normalizePlace(name);
  if (!norm || !cityIndex) return null;
  if (cityIndex.has(norm)) {
    const hit = cityIndex.get(norm);
    return { city: hit.city, lat: hit.lat, lon: hit.lon, postal: postal || "" };
  }
  for (const [key, coords] of cityIndex) {
    if (norm.includes(key) || key.includes(norm)) {
      return { city: coords.city, lat: coords.lat, lon: coords.lon, postal: postal || "" };
    }
  }
  return null;
}

export function filterListingsInRadius(items, originLat, originLon, radiusKm, cityIndex, originCity = "") {
  const radius = Number(radiusKm);
  if (!Number.isFinite(radius) || radius <= 0) return [];
  const originNorm = normalizePlace(originCity);
  return (items ?? []).filter((item) => {
    const coords = resolveListingCoords(item, cityIndex);
    if (coords) {
      return haversineKm(originLat, originLon, coords.lat, coords.lon) <= radius;
    }
    if (!originNorm) return false;
    const name = normalizePlace(listingCityName(item));
    return Boolean(name && (name === originNorm || name.includes(originNorm) || originNorm.includes(name)));
  });
}

export function countListingsInRadius(items, originLat, originLon, radiusKm, cityIndex) {
  return filterListingsInRadius(items, originLat, originLon, radiusKm, cityIndex).length;
}

export function listingTimestamp(item) {
  const raw = item.updated_at ?? item.created_at;
  if (!raw) return null;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : null;
}

export function isListingWithinHours(item, hours) {
  const timestamp = listingTimestamp(item);
  if (timestamp == null) return false;
  const cutoff = Date.now() - Number(hours) * 3600000;
  return timestamp >= cutoff;
}

export function filterListingsRecentInRadius(
  items,
  originLat,
  originLon,
  radiusKm,
  cityIndex,
  hours = 24,
  originCity = ""
) {
  const inRadius = filterListingsInRadius(items, originLat, originLon, radiusKm, cityIndex, originCity);
  return inRadius.filter((item) => isListingWithinHours(item, hours));
}
