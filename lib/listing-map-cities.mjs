/**
 * Térkép: településenkénti darabszám (hirdetés payload nélkül a kliensnek).
 */
import { listingFeedTableExists } from "./listing-feed.mjs";
import { normalizeListingStatus } from "./listing-status.mjs";
import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";
import { listListingsWithPreview } from "./db-store.mjs";
import { sanitizeListingTileItem } from "./listing-api-access.mjs";
import { resolveListingVertical } from "./listing-vertical.mjs";

function normalizePlace(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COUNTY_KEYS = new Set(
  "pest,fejer,gyormosonsopron,komaromesztergom,veszprem,baranya,bacskiskun,bekes,borsodabaujzemplen,csongradcsanad,hajdubihar,heves,jasznagykunszolnok,nograd,somogy,szabolcsszatmarbereg,tolna,vas,zala"
    .split(",")
);

function listingCityName(item) {
  const filter = item?.preview?.filter ?? {};
  const form = item?.form ?? {};
  const candidates = [
    filter.telepules,
    form.telepules,
    String(item?.preview?.location || "").split(",")[0],
  ];
  for (const raw of candidates) {
    const name = String(raw ?? "").trim();
    if (!name) continue;
    const key = normalizePlace(name).replace(/\s+/g, "");
    if (key && key !== "budapest" && COUNTY_KEYS.has(key)) continue;
    return name;
  }
  return "";
}

function citiesMatch(a, b) {
  const na = normalizePlace(a);
  const nb = normalizePlace(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.startsWith(nb) || nb.startsWith(na) || na.includes(nb) || nb.includes(na);
}

let citiesCache = new Map();

function cacheKey(vertical) {
  return `v:${String(vertical || "").trim().toLowerCase() || "all"}`;
}

export function resetListingMapCitiesCache() {
  citiesCache = new Map();
}

async function scanFeedCities(sb, { status, vertical }) {
  const want = String(vertical ?? "")
    .trim()
    .toLowerCase();
  const needFilter = want === "teher" || want === "auto" || want === "ingatlan";
  const counts = new Map();
  const pageSize = 500;
  let offset = 0;

  for (let page = 0; page < 40; page += 1) {
    let q = sb
      .from("listing_feed")
      .select("listing_id, vertical, payload")
      .eq("status", status)
      .order("listing_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (needFilter) q = q.eq("vertical", want);
    const { data, error } = await q;
    if (error) throw error;
    const rows = data || [];
    if (!rows.length) break;
    for (const row of rows) {
      const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
      const item = {
        ...payload,
        id: Number(row.listing_id),
        vertical: row.vertical || payload.vertical || "",
      };
      if (needFilter && resolveListingVertical(item) !== want) continue;
      const city = listingCityName(item);
      if (!city) continue;
      const key = normalizePlace(city);
      if (!key) continue;
      const prev = counts.get(key);
      if (prev) prev.count += 1;
      else counts.set(key, { city, count: 1 });
    }
    if (rows.length < pageSize) break;
    offset += rows.length;
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "hu"));
}

async function scanLegacyCities({ status, vertical }) {
  const want = String(vertical ?? "")
    .trim()
    .toLowerCase();
  const items = await listListingsWithPreview({
    limit: 2000,
    offset: 0,
    status,
    vertical: want || null,
  });
  const counts = new Map();
  for (const item of items || []) {
    if (want === "auto" || want === "teher" || want === "ingatlan") {
      if (resolveListingVertical(item) !== want) continue;
    }
    const city = listingCityName(item);
    if (!city) continue;
    const key = normalizePlace(city);
    if (!key) continue;
    const prev = counts.get(key);
    if (prev) prev.count += 1;
    else counts.set(key, { city, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "hu"));
}

/** @returns {Promise<{ city: string, count: number }[]>} */
export async function listMapCityCounts({ vertical = null, status = "feladott" } = {}) {
  const wantStatus = normalizeListingStatus(status || "feladott");
  const key = cacheKey(vertical);
  const hit = citiesCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.cities.map((c) => ({ ...c }));

  let cities = [];
  if (isSupabaseBackend()) {
    const sb = getSupabase();
    if (sb && (await listingFeedTableExists(sb))) {
      cities = await scanFeedCities(sb, { status: wantStatus, vertical });
    } else {
      cities = await scanLegacyCities({ status: wantStatus, vertical });
    }
  } else {
    cities = await scanLegacyCities({ status: wantStatus, vertical });
  }

  citiesCache.set(key, { at: Date.now(), cities });
  return cities.map((c) => ({ ...c }));
}

/** Egy település tile-hirdetései (kezdőlap-szerű fő adatok). */
export async function listMapCityListings({
  city,
  vertical = null,
  status = "feladott",
  limit = 80,
} = {}) {
  const cityName = String(city || "").trim();
  if (!cityName) return [];
  const wantStatus = normalizeListingStatus(status || "feladott");
  const want = String(vertical ?? "")
    .trim()
    .toLowerCase();
  const needFilter = want === "teher" || want === "auto" || want === "ingatlan";
  const max = Math.min(Math.max(Number(limit) || 80, 1), 120);
  const out = [];

  if (isSupabaseBackend()) {
    const sb = getSupabase();
    if (sb && (await listingFeedTableExists(sb))) {
      const pageSize = 200;
      let offset = 0;
      for (let page = 0; page < 30 && out.length < max; page += 1) {
        let q = sb
          .from("listing_feed")
          .select("listing_id, status, vertical, updated_at, created_at, payload")
          .eq("status", wantStatus)
          .order("updated_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (needFilter) q = q.eq("vertical", want);
        const { data, error } = await q;
        if (error) throw error;
        const rows = data || [];
        if (!rows.length) break;
        for (const row of rows) {
          const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
          const item = {
            ...payload,
            id: Number(row.listing_id),
            status: row.status || payload.status,
            vertical: row.vertical || payload.vertical || "",
            updated_at: row.updated_at || payload.updated_at,
            created_at: row.created_at || payload.created_at,
          };
          if (needFilter && resolveListingVertical(item) !== want) continue;
          if (!citiesMatch(listingCityName(item), cityName)) continue;
          out.push(sanitizeListingTileItem(item));
          if (out.length >= max) break;
        }
        if (rows.length < pageSize) break;
        offset += rows.length;
      }
      return out;
    }
  }

  const items = await listListingsWithPreview({
    limit: 800,
    offset: 0,
    status: wantStatus,
    vertical: want || null,
  });
  for (const item of items || []) {
    if (needFilter && resolveListingVertical(item) !== want) continue;
    if (!citiesMatch(listingCityName(item), cityName)) continue;
    out.push(sanitizeListingTileItem(item));
    if (out.length >= max) break;
  }
  return out;
}
