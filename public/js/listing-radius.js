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
  const candidates = [
    filter.telepules,
    form.telepules,
    String(item.preview?.location || "").split(",")[0],
  ];
  for (const raw of candidates) {
    const name = String(raw ?? "").trim();
    if (!name) continue;
    // Megye név (pl. Fejér) nem település — térképen / sugaras szűrőben ne használjuk.
    const key = normalizePlace(name).replace(/\s+/g, "");
    if (
      key &&
      key !== "budapest" &&
      /^(pest|fejer|gyormosonsopron|komaromesztergom|veszprem|baranya|bacskiskun|bekes|borsodabaujzemplen|csongradcsanad|hajdubihar|heves|jasznagykunszolnok|nograd|somogy|szabolcsszatmarbereg|tolna|vas|zala)$/.test(
        key
      )
    ) {
      continue;
    }
    return name;
  }
  return "";
}

export function listingPostalCode(item) {
  const filter = item.preview?.filter ?? {};
  const form = item.form ?? {};
  const raw = filter.iranyitoszam || form.iranyitoszam || "";
  return String(raw).replace(/\D/g, "").slice(0, 4);
}

const DUMMY_LAT = 47.1625;
const DUMMY_LON = 19.5033;

function isDummyCoord(lat, lon) {
  return Math.abs(Number(lat) - DUMMY_LAT) < 1e-4 && Math.abs(Number(lon) - DUMMY_LON) < 1e-4;
}

export function buildPostalIndex(postals) {
  const byCode = new Map();
  for (const row of postals ?? []) {
    const code = String(row.postal_code ?? "").replace(/\D/g, "").slice(0, 4);
    if (code.length !== 4 || row.lat == null || row.lon == null) continue;
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || isDummyCoord(lat, lon)) continue;
    byCode.set(code, {
      postal: code,
      city: String(row.city ?? "").trim(),
      lat,
      lon,
    });
  }
  return byCode;
}

export function resolveCityCoords(cityName, cityIndex) {
  const raw = String(cityName ?? "").trim();
  if (!raw || !cityIndex) return null;
  const norm = normalizePlace(raw);
  if (!norm) return null;

  if (cityIndex.has(norm)) {
    const hit = cityIndex.get(norm);
    if (hit && !isDummyCoord(hit.lat, hit.lon)) {
      return { city: hit.city, lat: hit.lat, lon: hit.lon };
    }
  }

  /* „Tolnanémedi Tolna” → település előbb, megye nélkül */
  const parts = norm.split(" ").filter(Boolean);
  for (let n = parts.length; n >= 1; n -= 1) {
    const slice = parts.slice(0, n).join(" ");
    if (!cityIndex.has(slice)) continue;
    const hit = cityIndex.get(slice);
    if (hit && !isDummyCoord(hit.lat, hit.lon)) {
      return { city: hit.city, lat: hit.lat, lon: hit.lon };
    }
  }

  for (const [key, coords] of cityIndex) {
    if (!(key.startsWith(norm) || norm.startsWith(key) || norm.includes(key) || key.includes(norm))) {
      continue;
    }
    if (isDummyCoord(coords.lat, coords.lon)) continue;
    return { city: coords.city, lat: coords.lat, lon: coords.lon };
  }

  return null;
}

export function resolveListingCoords(item, cityIndex, postalIndex = null) {
  const postal = listingPostalCode(item);
  const name = listingCityName(item);

  /* Településnév: melyik helységhez tartozik a hirdetés. */
  let cityHit = resolveCityCoords(name, cityIndex);
  let postalHit = null;
  if (postal && postalIndex?.has(postal)) {
    postalHit = postalIndex.get(postal);
    if (!cityHit) {
      const cityFromPostal = String(postalHit?.city || "").trim();
      if (cityFromPostal) cityHit = resolveCityCoords(cityFromPostal, cityIndex);
    }
  }

  const city =
    cityHit?.city ||
    String(postalHit?.city || name || "").trim() ||
    "";

  /* Pin: pontos irsz-koordináta, ha van; különben a település középpontja. */
  if (postalHit && !isDummyCoord(postalHit.lat, postalHit.lon)) {
    return {
      city: city || postalHit.city || name,
      lat: postalHit.lat,
      lon: postalHit.lon,
      postal: postalHit.postal || postal || "",
    };
  }
  if (cityHit) {
    return {
      city: cityHit.city,
      lat: cityHit.lat,
      lon: cityHit.lon,
      postal: postal || "",
    };
  }

  return null;
}

export function filterListingsInRadius(
  items,
  originLat,
  originLon,
  radiusKm,
  cityIndex,
  originCity = "",
  postalIndex = null
) {
  const radius = Number(radiusKm);
  if (!Number.isFinite(radius) || radius <= 0) return [];
  const originNorm = normalizePlace(originCity);
  return (items ?? []).filter((item) => {
    const coords = resolveListingCoords(item, cityIndex, postalIndex);
    if (coords) {
      return haversineKm(originLat, originLon, coords.lat, coords.lon) <= radius;
    }
    if (!originNorm) return false;
    const name = normalizePlace(listingCityName(item));
    return Boolean(name && (name === originNorm || name.includes(originNorm) || originNorm.includes(name)));
  });
}

export function countListingsInRadius(items, originLat, originLon, radiusKm, cityIndex, postalIndex = null) {
  return filterListingsInRadius(items, originLat, originLon, radiusKm, cityIndex, "", postalIndex).length;
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
  originCity = "",
  postalIndex = null
) {
  const inRadius = filterListingsInRadius(
    items,
    originLat,
    originLon,
    radiusKm,
    cityIndex,
    originCity,
    postalIndex
  );
  return inRadius.filter((item) => isListingWithinHours(item, hours));
}
