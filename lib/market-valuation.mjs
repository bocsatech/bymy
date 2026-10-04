/**
 * HA összevont lista alapú piaci árvélemény (offline dump → lib/ha-market/prices.json.gz).
 * Sor: [cím, év, km, ár, extra?]
 * extra: gyártmány, üzemanyag, váltó, kivitel, állapot, … — csak ha a form ki van töltve.
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

const DIESEL_TOKENS = [
  "jtdm",
  "jtd",
  "tdi",
  "cdi",
  "dci",
  "hdi",
  "bluehdi",
  "multijet",
  "crdi",
  "d4d",
  "skyactiv d",
  "dizel",
  "diesel",
];
const PETROL_TOKENS = [
  "benzin",
  "tb",
  "tsi",
  "tfsi",
  "gdi",
  "mpi",
  "multiair",
  "tce",
  "tgdi",
  "t gdi",
  "ecoboost",
];

function titleHasAnyToken(haystack, tokens) {
  const h = ` ${haystack} `;
  return tokens.some((token) => h.includes(` ${token} `) || haystack.includes(token));
}

function unpackRow(row) {
  if (!Array.isArray(row) || !row[0]) return null;
  const [title, year, listingKm, price, extra] = row;
  return {
    title,
    year,
    listingKm,
    price,
    extra: extra && typeof extra === "object" && !Array.isArray(extra) ? extra : {},
  };
}

function kindGear(value) {
  const v = normalizeText(value);
  if (!v) return "";
  if (/felautomata|szekvencialis|robotizalt/.test(v)) return "felautomata";
  if (/manualis/.test(v)) return "manualis";
  if (/automata|tiptronic|fokozatmentes|cvt|dsg|pdk/.test(v)) return "automata";
  return v;
}

function kindHajtas(value) {
  const v = normalizeText(value);
  if (!v) return "";
  if (v.includes("osszker") || v.includes("4x4") || v.includes("awd") || v.includes("4wd")) {
    return "osszker";
  }
  if (v.includes("hatso")) return "hatso";
  if (v.includes("elso") || v.includes("fwd")) return "elso";
  return v;
}

function textFieldMatches(want, got) {
  if (!want) return true;
  if (!got) return true;
  const a = normalizeText(want);
  const b = normalizeText(got);
  if (!a || !b) return true;
  return a === b || b.includes(a) || a.includes(b);
}

function parseQty(value) {
  const n = Number(String(value ?? "").replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseLe(value) {
  const s = String(value ?? "");
  const m = s.match(/(\d[\d\s]*)\s*LE\b/i);
  if (m) return parseQty(m[1]);
  const n = parseQty(s);
  return n != null && n < 2000 ? n : null;
}

function qtyMatches(want, got, slack) {
  if (want == null || got == null) return true;
  return Math.abs(want - got) <= slack;
}

function extraMatches(params, extra) {
  if (!extra || !Object.keys(extra).length) return true;
  if (params.sebessegvalto) {
    const want = kindGear(params.sebessegvalto);
    const got = kindGear(extra.g);
    if (want && got && want !== got) return false;
  }
  if (params.hajtas) {
    const want = kindHajtas(params.hajtas);
    const got = kindHajtas(extra.h);
    if (want && got && want !== got) return false;
  }
  if (!textFieldMatches(params.kivitel, extra.k)) return false;
  if (!textFieldMatches(params.allapot, extra.a)) return false;
  if (!textFieldMatches(params.szin, extra.s)) return false;
  if (!textFieldMatches(params.klima, extra.c)) return false;
  if (!textFieldMatches(params.okmany_jelleg, extra.o)) return false;
  if (params.ajtok && extra.d && String(params.ajtok).replace(/\D/g, "") !== String(extra.d).replace(/\D/g, "")) {
    return false;
  }
  if (!qtyMatches(parseQty(params.hengerurtartalom), parseQty(extra.cc), 100)) return false;
  if (!qtyMatches(parseLe(params.teljesitmeny_le), parseLe(extra.p), 15)) return false;
  return true;
}

function matchesFuel(uzemanyag, title) {
  const fuel = normalizeText(uzemanyag);
  if (!fuel || fuel === "mindegy") return true;
  const h = normalizeText(title);
  if (!h) return false;
  if (h.includes(fuel)) return true;

  const diesel = titleHasAnyToken(h, DIESEL_TOKENS);
  const petrol = titleHasAnyToken(h, PETROL_TOKENS);

  if (fuel.includes("dizel") || fuel === "diesel") {
    return diesel;
  }
  if (fuel.includes("hibrid") || fuel.includes("hybrid")) {
    return h.includes("hibrid") || h.includes("hybrid") || h.includes("phev") || h.includes("mhev");
  }
  if (fuel.includes("elektromos") || fuel === "ev") {
    return (
      h.includes("elektromos") ||
      h.includes("electric") ||
      h.includes("bev") ||
      /\bev\b/.test(h)
    );
  }
  if (fuel.includes("benzin") || fuel.includes("gaz")) {
    /* HA cím gyakran csak „1.4 TB” — benzin szó nélkül; JTDM/TDI = dízel. */
    if (diesel && !petrol) return false;
    if (petrol) return true;
    return !diesel;
  }

  const parts = fuel.split(" ").filter((p) => p.length > 2);
  if (parts.length >= 2) return parts.every((p) => h.includes(p));
  return parts.length ? h.includes(parts[0]) : false;
}

export function estimateMarketValuation(params = {}) {
  const gyartmany = String(params.gyartmany ?? "").trim();
  const modell = String(params.modell ?? params.modell_tipus ?? "").trim();
  const tipus = String(params.tipus ?? "").trim();
  const uzemanyag = String(params.uzemanyag ?? "").trim();
  const tipQuery = [gyartmany, modell, tipus].filter(Boolean).join(" ");
  const gyartasi_ev = parseNumber(params.gyartasi_ev);
  const km = parseNumber(params.km);
  const ar = parseNumber(params.ar);

  if (!gyartmany || !modell) {
    return { error: "Add meg a gyártmányt és a modellt." };
  }
  if (params.requireCore && (gyartasi_ev == null || km == null)) {
    return { error: "Add meg az évjáratot és a km-t is." };
  }

  const rows = loadRows();
  if (!rows.length) {
    return {
      count: 0,
      message: "Nincs piaci lista betöltve.",
      source: "ha-osszevont",
    };
  }

  const prices = [];
  for (const raw of rows) {
    const row = unpackRow(raw);
    if (!row) continue;
    const { title, year, listingKm, price, extra } = row;
    if (!price || price <= 0) continue;
    if (!matchesExactTipus(tipQuery, title)) continue;
    if (gyartasi_ev != null && year !== gyartasi_ev) continue;
    if (!matchesKm(km, listingKm)) continue;
    const fuelHay = [extra.f, title].filter(Boolean).join(" ");
    if (!matchesFuel(uzemanyag, fuelHay)) continue;
    if (!extraMatches(params, extra)) continue;
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
      source: "ha-osszevont",
    };
  }

  prices.sort((a, b) => a - b);
  const recommended = median(prices);
  const average = Math.round(prices.reduce((s, n) => s + n, 0) / prices.length);
  const { opinion, bars } = opinionFromPrice(ar, recommended);

  const goodFrom = prices[0];
  const goodTo = prices[prices.length - 1];
  return {
    gyartmany,
    modell_tipus: tipQuery,
    gyartasi_ev,
    km,
    ar,
    count: prices.length,
    average_price: average,
    median_price: recommended,
    min_price: goodFrom,
    max_price: goodTo,
    good_price_from: goodFrom,
    good_price_to: goodTo,
    recommended,
    recommended_formatted: formatFt(recommended),
    average_price_formatted: formatFt(average),
    min_price_formatted: formatFt(goodFrom),
    max_price_formatted: formatFt(goodTo),
    good_price_from_formatted: formatFt(goodFrom),
    good_price_to_formatted: formatFt(goodTo),
    opinion,
    bars,
    message: `${prices.length} hasonló a mintában · jó ár ${formatFt(goodFrom)} – ${formatFt(goodTo)}`,
    source: "ha-osszevont",
  };
}

/** Teszt / warm: előtöltés */
export function warmMarketValuation() {
  return loadRows().length;
}
