import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const POSTAL_JSON = join(DATA_DIR, "postal-codes-hu.json");

/** Nagyváros: Budapest + 5 megyei jogú város — max 5 ajánlás kategóriánként. */
export function isBigCityPostalCode(postalCode) {
  const code = normalizePostalCode(postalCode);
  if (!code) return false;
  const n = Number(code);
  if (n >= 1000 && n <= 1239) return true;
  if (n >= 4000 && n <= 4032) return true;
  if (n >= 3500 && n <= 3549) return true;
  if (n >= 6700 && n <= 6791) return true;
  if (n >= 7600 && n <= 7636) return true;
  if (n >= 9000 && n <= 9030) return true;
  return false;
}

export function normalizePostalCode(value) {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);
  return digits.length === 4 ? digits : null;
}

/** Budapest irányítószámok generálása (4 számjegy elég). */
function generateBudapestPostalCodes() {
  const baseLat = 47.4979;
  const baseLon = 19.0402;
  const rows = [];
  for (let code = 1007; code <= 1239; code += 1) {
    const postal = String(code).padStart(4, "0");
    const offset = (code - 1000) * 0.0008;
    rows.push({
      postal_code: postal,
      city: "Budapest",
      lat: baseLat + Math.sin(offset) * 0.04,
      lon: baseLon + Math.cos(offset) * 0.05,
    });
  }
  return rows;
}

/** Induló HU irányítószám lista (JSON + generált Budapest + régió). */
export function loadPostalCodeSeedRows() {
  const rows = [];

  if (existsSync(POSTAL_JSON)) {
    try {
      const parsed = JSON.parse(readFileSync(POSTAL_JSON, "utf8"));
      if (Array.isArray(parsed)) {
        for (const row of parsed) {
          const postal_code = normalizePostalCode(row.postal_code);
          if (!postal_code || row.lat == null || row.lon == null) continue;
          rows.push({
            postal_code,
            city: String(row.city ?? "").trim() || postal_code,
            lat: Number(row.lat),
            lon: Number(row.lon),
          });
        }
      }
    } catch {
      /* fallback alább */
    }
  }

  const seen = new Set(rows.map((r) => r.postal_code));
  for (const row of generateBudapestPostalCodes()) {
    if (!seen.has(row.postal_code)) {
      rows.push(row);
      seen.add(row.postal_code);
    }
  }

  const regional = [
    { postal_code: "8000", city: "Székesfehérvár", lat: 47.186, lon: 18.413 },
    { postal_code: "8019", city: "Székesfehérvár", lat: 47.172, lon: 18.428 },
    { postal_code: "1900", city: "Dabas", lat: 47.186, lon: 19.308 },
    { postal_code: "2481", city: "Velence", lat: 47.238, lon: 18.654 },
    { postal_code: "2483", city: "Gárdony", lat: 47.193, lon: 18.616 },
    { postal_code: "2461", city: "Pusztaszabolcs", lat: 47.137, lon: 18.642 },
    { postal_code: "2457", city: "Adony", lat: 47.119, lon: 18.864 },
    { postal_code: "2300", city: "Ráckeve", lat: 47.161, lon: 19.006 },
    { postal_code: "2451", city: "Ercsi", lat: 47.252, lon: 18.896 },
    { postal_code: "8100", city: "Várpalota", lat: 47.196, lon: 18.139 },
    { postal_code: "8154", city: "Polgárdi", lat: 47.061, lon: 18.302 },
    { postal_code: "6000", city: "Kecskemét", lat: 46.906, lon: 19.691 },
    { postal_code: "4000", city: "Debrecen", lat: 47.531, lon: 21.627 },
    { postal_code: "4024", city: "Debrecen", lat: 47.533, lon: 21.621 },
    { postal_code: "3500", city: "Miskolc", lat: 48.103, lon: 20.778 },
    { postal_code: "6720", city: "Szeged", lat: 46.253, lon: 20.141 },
    { postal_code: "7621", city: "Pécs", lat: 46.072, lon: 18.233 },
    { postal_code: "9021", city: "Győr", lat: 47.687, lon: 17.635 },
    { postal_code: "2040", city: "Budaörs", lat: 47.461, lon: 18.958 },
    { postal_code: "1117", city: "Budapest", lat: 47.473, lon: 19.052 },
    { postal_code: "1138", city: "Budapest", lat: 47.542, lon: 19.067 },
    { postal_code: "1181", city: "Budapest", lat: 47.427, lon: 19.037 },
  ];

  for (const row of regional) {
    if (!seen.has(row.postal_code)) {
      rows.push(row);
      seen.add(row.postal_code);
    }
  }

  return rows;
}

let memoryCache = null;

function getMemoryCache() {
  if (!memoryCache) {
    const rows = loadPostalCodeSeedRows();
    const byCode = new Map();
    const cityAgg = new Map();
    for (const row of rows) {
      byCode.set(row.postal_code, {
        postal_code: row.postal_code,
        city: row.city,
        lat: row.lat,
        lon: row.lon,
      });
      const agg = cityAgg.get(row.city) ?? { city: row.city, lat: 0, lon: 0, n: 0 };
      agg.lat += row.lat;
      agg.lon += row.lon;
      agg.n += 1;
      cityAgg.set(row.city, agg);
    }
    memoryCache = {
      byCode,
      cities: [...cityAgg.values()]
        .map((c) => ({ city: c.city, lat: c.lat / c.n, lon: c.lon / c.n }))
        .sort((a, b) => a.city.localeCompare(b.city, "hu")),
    };
  }
  return memoryCache;
}

/** Serverless / Supabase: nincs helyi SQLite — beépített irányítószám-lista. */
export function lookupPostalCodeFromSeed(postalCode) {
  const code = normalizePostalCode(postalCode);
  if (!code) return null;
  return getMemoryCache().byCode.get(code) ?? null;
}

export function listPostalCitiesFromSeed() {
  return getMemoryCache().cities;
}
