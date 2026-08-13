import { listListingsWithPreview } from "./db.mjs";
import { getVehicleCatalog } from "./vehicle-catalog.mjs";

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeBrand(value) {
  return normalizeText(value).toUpperCase();
}

function parseNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/\D/g, ""));
  return Number.isFinite(n) ? n : null;
}

function matchesModellTipus(query, preview) {
  const needle = normalizeText(query).toLowerCase();
  if (!needle) return true;
  const f = preview?.filter ?? {};
  const hay = [f.modell, f.tipus, preview?.title].filter(Boolean).join(" ").toLowerCase();
  return needle.split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
}

function matchesKm(inputKm, listingKm) {
  if (inputKm == null) return true;
  if (listingKm == null) return false;
  const tolerance = Math.max(30_000, inputKm * 0.2);
  return Math.abs(listingKm - inputKm) <= tolerance;
}

function formatFt(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString("hu-HU")} Ft`;
}

export function estimateValuation(params = {}) {
  const gyartmany = normalizeBrand(params.gyartmany);
  const modell_tipus = normalizeText(params.modell_tipus);
  const gyartasi_ev = parseNumber(params.gyartasi_ev);
  const km = parseNumber(params.km);

  if (!gyartmany) {
    return { error: "Add meg a márkát." };
  }

  const listings = listListingsWithPreview({ limit: 5000 });
  const matched = listings.filter((item) => {
    const f = item.preview?.filter ?? {};
    const price = item.preview?.priceNum;
    if (!price || price <= 0) return false;
    if (normalizeBrand(f.gyartmany) !== gyartmany) return false;
    if (!matchesModellTipus(modell_tipus, item.preview)) return false;
    if (gyartasi_ev != null && f.gyartasi_ev !== gyartasi_ev) return false;
    if (!matchesKm(km, item.preview?.kmNum)) return false;
    return true;
  });

  const prices = matched.map((item) => item.preview.priceNum).filter((n) => n > 0);
  if (!prices.length) {
    return {
      gyartmany,
      modell_tipus,
      gyartasi_ev,
      km,
      count: 0,
      average_price: null,
      average_price_formatted: null,
      message: "Nincs egyező hirdetés az adatbázisban.",
    };
  }

  const average = Math.round(prices.reduce((sum, n) => sum + n, 0) / prices.length);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return {
    gyartmany,
    modell_tipus,
    gyartasi_ev,
    km,
    count: prices.length,
    average_price: average,
    min_price: min,
    max_price: max,
    average_price_formatted: formatFt(average),
    min_price_formatted: formatFt(min),
    max_price_formatted: formatFt(max),
    message: `${prices.length} hirdetés átlaga az adatbázisból`,
  };
}

export function valuationOptions() {
  const listings = listListingsWithPreview({ limit: 5000 });
  const brands = new Set();
  const modelsByBrand = new Map();

  for (const item of listings) {
    const f = item.preview?.filter ?? {};
    const brand = normalizeBrand(f.gyartmany);
    if (!brand) continue;
    brands.add(brand);
    if (!modelsByBrand.has(brand)) modelsByBrand.set(brand, new Set());
    const model = normalizeText(f.modell);
    if (model) modelsByBrand.get(brand).add(model);
  }

  // Ha nincs még hirdetés, a járműkatalógus (lista.csv) márkái jönnek.
  const catalog = getVehicleCatalog();
  for (const brand of catalog?.gyartmanyok ?? []) {
    const key = normalizeBrand(brand);
    if (!key) continue;
    brands.add(key);
    if (!modelsByBrand.has(key)) modelsByBrand.set(key, new Set());
    for (const model of catalog.modellek?.[brand] ?? []) {
      if (model) modelsByBrand.get(key).add(normalizeText(model));
    }
  }

  return {
    gyartmanyok: [...brands].sort((a, b) => a.localeCompare(b, "hu")),
    modellek: Object.fromEntries(
      [...modelsByBrand.entries()].map(([brand, models]) => [
        brand,
        [...models].sort((a, b) => a.localeCompare(b, "hu")),
      ])
    ),
  };
}
