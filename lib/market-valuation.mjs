/**
 * HA lista_ar alapú piaci árvélemény (offline dump → lib/ha-market/prices.json.gz).
 * Effektív ár a dumpban: akciós || listaár.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { gunzipSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GZ_PATH = join(__dirname, "ha-market", "prices.json.gz");
const OPINION_BAND = 0.1;

let cachedRows = null;

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/\D/g, ""));
  return Number.isFinite(n) ? n : null;
}

function loadRows() {
  if (cachedRows) return cachedRows;
  if (!existsSync(GZ_PATH)) {
    cachedRows = [];
    return cachedRows;
  }
  const raw = gunzipSync(readFileSync(GZ_PATH));
  cachedRows = JSON.parse(raw.toString("utf8"));
  return cachedRows;
}

function matchesExactTipus(query, title) {
  const q = normalizeText(query);
  const h = normalizeText(title);
  if (!q || !h) return false;
  const words = q.split(" ").filter(Boolean);
  if (words.length < 2) return false;
  return words.every((w) => h.includes(w));
}

function matchesKm(inputKm, listingKm) {
  if (inputKm == null) return true;
  if (listingKm == null) return false;
  const tol = Math.max(30_000, Math.round(inputKm * 0.2));
  return Math.abs(listingKm - inputKm) <= tol;
}

function median(sorted) {
  const n = sorted.length;
  if (!n) return null;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function formatFt(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString("hu-HU")} Ft`;
}

/**
 * bars: 1–4 (több = olcsóbb a piachoz képest; 3 = jó ár — képernyőkép szerint)
 * opinion: kevés | jó ár | sok
 */
function opinionFromPrice(userPrice, recommended) {
  if (userPrice == null || recommended == null) {
    return { opinion: null, bars: 0 };
  }
  const ratio = userPrice / recommended;
  if (ratio < 1 - OPINION_BAND) {
    // jelentősen olcsó
    return { opinion: "kevés", bars: ratio < 0.8 ? 4 : 4 };
  }
  if (ratio > 1 + OPINION_BAND) {
    return { opinion: "sok", bars: ratio > 1.25 ? 1 : 2 };
  }
  return { opinion: "jó ár", bars: 3 };
}

export function marketDataAvailable() {
  return existsSync(GZ_PATH);
}

export function estimateMarketValuation(params = {}) {
  const gyartmany = String(params.gyartmany ?? "").trim();
  const modell = String(params.modell ?? params.modell_tipus ?? "").trim();
  const tipus = String(params.tipus ?? "").trim();
  const tipQuery = [gyartmany, modell, tipus].filter(Boolean).join(" ");
  const gyartasi_ev = parseNumber(params.gyartasi_ev);
  const km = parseNumber(params.km);
  const ar = parseNumber(params.ar);

  if (!gyartmany || !modell) {
    return { error: "Add meg a márkát és a modellt." };
  }

  const rows = loadRows();
  if (!rows.length) {
    return {
      count: 0,
      message: "Nincs piaci lista betöltve.",
      source: "ha-market",
    };
  }

  const prices = [];
  for (const row of rows) {
    const [title, year, listingKm, price] = row;
    if (!price || price <= 0) continue;
    if (!matchesExactTipus(tipQuery, title)) continue;
    if (gyartasi_ev != null && year !== gyartasi_ev) continue;
    if (!matchesKm(km, listingKm)) continue;
    prices.push(price);
  }

  if (!prices.length) {
    return {
      gyartmany,
      modell_tipus: tipQuery,
      gyartasi_ev,
      km,
      ar,
      count: 0,
      recommended: null,
      opinion: null,
      bars: 0,
      message: "Nincs egyező hirdetés a piaci listában.",
      source: "ha-market",
    };
  }

  prices.sort((a, b) => a - b);
  const recommended = median(prices);
  const average = Math.round(prices.reduce((s, n) => s + n, 0) / prices.length);
  const { opinion, bars } = opinionFromPrice(ar, recommended);

  return {
    gyartmany,
    modell_tipus: tipQuery,
    gyartasi_ev,
    km,
    ar,
    count: prices.length,
    average_price: average,
    median_price: recommended,
    min_price: prices[0],
    max_price: prices[prices.length - 1],
    recommended,
    recommended_formatted: formatFt(recommended),
    average_price_formatted: formatFt(average),
    min_price_formatted: formatFt(prices[0]),
    max_price_formatted: formatFt(prices[prices.length - 1]),
    opinion,
    bars,
    message: `${prices.length} hirdetés mediánja a piaci listából`,
    source: "ha-market",
  };
}

/** Teszt / warm: előtöltés */
export function warmMarketValuation() {
  return loadRows().length;
}
