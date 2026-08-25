import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PUBLIC_DIR = join(__dirname, "..", "public");
const CATALOG_PATH = join(DATA_DIR, "vehicle-catalog.json");
/** Böngésző fallback, ha a /api/vehicle-catalog még nincs a futó szerveren. */
const PUBLIC_CATALOG_PATH = join(PUBLIC_DIR, "data", "vehicle-catalog.json");

const DEFAULT_CSV_CANDIDATES = [
  join(homedir(), "Desktop", "lista.csv"),
  join(homedir(), "Asztal", "lista.csv"),
  join(homedir(), "Downloads", "lista.csv"),
  join(homedir(), "Letöltések", "lista.csv"),
];

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeBrand(value) {
  const text = normalizeText(value);
  if (!text) return "";
  const upper = text.toUpperCase();
  if (upper === "VW") return "VOLKSWAGEN";
  if (upper === "MERCEDES") return "MERCEDES-BENZ";
  if (upper === "LAND") return "LAND ROVER";
  if (upper === "ŠKODA" || upper === "SKODA") return "SKODA";
  return upper;
}

export { normalizeBrand };

function headerKey(header) {
  return normalizeText(header)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeHeader(header) {
  const key = headerKey(header);
  if (key === "gyartmany" || key === "marka" || key.startsWith("gyartman")) return "gyartmany";
  if (key === "modell" || key === "model") return "modell";
  if (key === "tipus") return "tipus";
  if (key === "evtol" || key === "evtl") return "evtol";
  if (key === "evig") return "evig";
  return key;
}

function toYear(value) {
  const match = String(value ?? "").match(/(19|20)\d{2}/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
}

function splitCsvLine(line, delimiter) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

export function parseCsvText(text) {
  const cleaned = String(text ?? "").replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const delimiter =
    lines[0].includes(";") && lines[0].split(";").length >= lines[0].split(",").length
      ? ";"
      : ",";
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line, delimiter);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = normalizeText(values[index] ?? "");
    });
    return row;
  });
}

/** "500 1.4 [3 ajtós, 135 LE, 2008.07. – 2012.10.]" → "500 1.4" */
export function shortTypeName(value) {
  const text = normalizeText(value);
  const cut = text.split("[")[0];
  return normalizeText(cut) || text;
}

export function buildVehicleCatalog(rows, source = "lista.csv") {
  const modellek = new Map();
  const tipusok = new Map();

  for (const row of rows) {
    const brand = normalizeBrand(row.gyartmany);
    const model = normalizeText(row.modell);
    const tipus = normalizeText(row.tipus);
    if (!brand) continue;

    if (!modellek.has(brand)) modellek.set(brand, new Set());
    if (model) modellek.get(brand).add(model);

    if (!model || !tipus) continue;

    const key = `${brand}|${model}`;
    if (!tipusok.has(key)) tipusok.set(key, new Map());
    const byName = tipusok.get(key);

    const evTol = toYear(row.evtol);
    const evIg = toYear(row.evig);
    const existing = byName.get(tipus);

    if (!existing) {
      byName.set(tipus, { nev: tipus, evTol, evIg });
      continue;
    }
    // Ugyanaz a típus több sorban: a legtágabb évjárat tartomány marad.
    if (evTol != null && (existing.evTol == null || evTol < existing.evTol)) existing.evTol = evTol;
    if (evIg != null && (existing.evIg == null || evIg > existing.evIg)) existing.evIg = evIg;
  }

  const gyartmanyok = [...modellek.keys()].sort((a, b) => a.localeCompare(b, "hu"));
  const modellekObj = Object.fromEntries(
    [...modellek.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "hu"))
      .map(([brand, models]) => [brand, [...models].sort((a, b) => a.localeCompare(b, "hu"))])
  );
  const tipusokObj = Object.fromEntries(
    [...tipusok.entries()].map(([key, byName]) => [
      key,
      [...byName.values()].sort((a, b) => a.nev.localeCompare(b.nev, "hu")),
    ])
  );

  return {
    source,
    imported_at: new Date().toISOString(),
    count_rows: rows.length,
    gyartmanyok,
    modellek: modellekObj,
    tipusok: tipusokObj,
  };
}

/** Régi mentés: tipusok = ["A4 2.0 TDI"]. Új: [{ nev, evTol, evIg }]. */
function normalizeTypeEntry(entry) {
  if (typeof entry === "string") return { nev: entry, evTol: null, evIg: null };
  if (!entry?.nev) return null;
  return { nev: entry.nev, evTol: entry.evTol ?? null, evIg: entry.evIg ?? null };
}

function foldUpper(value) {
  return normalizeText(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Cím elején a leghosszabb katalógus-márka (ALFA ROMEO, LAND ROVER, …). */
export function findCatalogBrand(candidate, catalog) {
  const hay = foldUpper(candidate);
  if (!hay || /javascript|bongeszo nem tamogat/i.test(hay)) return "";
  const source = catalog ?? getVehicleCatalog();
  const brands = [...(source?.gyartmanyok ?? [])].sort((a, b) => b.length - a.length);
  for (const brand of brands) {
    const token = foldUpper(brand);
    if (!token) continue;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    if (new RegExp(`^${escaped}([^A-Z0-9]|$)`).test(hay)) return brand;
  }
  const first = hay.split(/\s+/)[0] || "";
  return normalizeBrand(first) || first;
}

/** Eltávolítja a cím elejéről a márka/modell tokent (szóközös / kötőjeles is). */
export function stripLeadingCatalogToken(text, token) {
  const raw = normalizeText(text);
  const foldedToken = foldUpper(token);
  if (!raw || !foldedToken) return raw;
  const escaped = foldedToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+");
  return normalizeText(raw.replace(new RegExp(`^${escaped}\\b`, "i"), ""));
}

/** A hirdetésfeladáson a Típus mező = katalógus modell (Focus, Kuga). */
export function findCatalogModel(gyartmany, candidate, catalog) {
  const brand = normalizeBrand(gyartmany);
  const hay = foldUpper(candidate);
  if (!brand || !hay) return "";
  if (/javascript|bongeszo nem tamogat/i.test(hay)) {
    return "";
  }
  const source = catalog ?? getVehicleCatalog();
  const models = source?.modellek?.[brand] ?? [];
  const sorted = [...models].sort((a, b) => b.length - a.length);
  for (const model of sorted) {
    const token = foldUpper(model);
    if (!token) continue;
    if (hay === token) return model;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`).test(hay)) return model;
  }
  return "";
}

export function modelTypeEntries(catalog, gyartmany, modell) {
  const key = `${normalizeBrand(gyartmany)}|${normalizeText(modell)}`;
  const entries = catalog?.tipusok?.[key] ?? [];
  return entries.map(normalizeTypeEntry).filter(Boolean);
}

/** Egy modellhez tartozó évek — a típusok EvTol–EvIg tartományainak uniója. */
export function listModelYears(catalog, gyartmany, modell) {
  const years = new Set();
  for (const entry of modelTypeEntries(catalog, gyartmany, modell)) {
    const from = entry.evTol ?? entry.evIg;
    const to = entry.evIg ?? entry.evTol;
    if (from == null || to == null) continue;
    for (let year = Math.min(from, to); year <= Math.max(from, to); year += 1) {
      years.add(year);
    }
  }
  return [...years].sort((a, b) => b - a);
}

/**
 * Adott évben létező típusok. Év nélkül minden típus.
 * Ha az évre nincs találat, a teljes lista jön vissza — hiányos katalógusnál
 * így sem akad el a hirdetésfeladás.
 */
export function listModelTypes(catalog, gyartmany, modell, ev = null) {
  const entries = modelTypeEntries(catalog, gyartmany, modell);
  const year = toYear(ev);
  if (year == null) return entries;

  const matching = entries.filter((entry) => {
    if (entry.evTol == null && entry.evIg == null) return true;
    const from = entry.evTol ?? entry.evIg;
    const to = entry.evIg ?? entry.evTol;
    return year >= from && year <= to;
  });

  return matching.length ? matching : entries;
}

/** Márkák + modellek — a Tipus/év/ajtó CSV mezőket most nem tároljuk. */
export function slimVehicleCatalog(catalog) {
  if (!catalog) return null;
  const gyartmanyok = [...(catalog.gyartmanyok ?? [])];
  const modellek = catalog.modellek ?? {};
  return {
    source: catalog.source ?? null,
    imported_at: catalog.imported_at ?? new Date().toISOString(),
    count_rows: catalog.count_rows ?? 0,
    count_brands: gyartmanyok.length,
    count_models: Object.values(modellek).reduce((n, arr) => n + (arr?.length ?? 0), 0),
    gyartmanyok,
    modellek,
  };
}

/** Márkák + modellek, típusok nélkül — ez megy ki a böngészőnek induláskor. */
export function catalogSummary(catalog) {
  if (!catalog) return null;
  return {
    source: catalog.source ?? null,
    imported_at: catalog.imported_at ?? null,
    count_rows: catalog.count_rows ?? 0,
    count_brands: catalog.count_brands ?? catalog.gyartmanyok?.length ?? 0,
    count_models:
      catalog.count_models ??
      Object.values(catalog.modellek ?? {}).reduce((n, arr) => n + (arr?.length ?? 0), 0),
    gyartmanyok: catalog.gyartmanyok ?? [],
    modellek: catalog.modellek ?? {},
  };
}

export function loadVehicleCatalog(path = CATALOG_PATH) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function syncVehicleCatalogToPublic(catalog, path = PUBLIC_CATALOG_PATH) {
  if (!catalog?.gyartmanyok?.length) return null;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  return path;
}

export function saveVehicleCatalog(catalog, path = CATALOG_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  // A kliens /data/vehicle-catalog.json-t is tudja olvasni API nélkül.
  if (path === CATALOG_PATH) syncVehicleCatalogToPublic(catalog);
  return path;
}

export function importVehicleCatalogFromCsv(csvPath, outPath = CATALOG_PATH) {
  const resolved = csvPath;
  if (!existsSync(resolved)) {
    throw new Error(`CSV nem található: ${resolved}`);
  }
  const text = readFileSync(resolved, "utf8");
  const rows = parseCsvText(text);
  if (!rows.length) {
    throw new Error("Üres vagy hibás CSV.");
  }
  // Személyautó keresés/eladás: egyelőre csak Gyártmány + Modell (UI: Típus).
  const catalog = slimVehicleCatalog(buildVehicleCatalog(rows, resolved));
  if (!catalog.gyartmanyok.length) {
    throw new Error("Nincs gyártmány a CSV-ben — ellenőrizd a fejlécet (Gyartmany, Modell, Tipus).");
  }
  saveVehicleCatalog(catalog, outPath);
  return catalog;
}

export function resolveDefaultCsvPath(explicitPath = null) {
  if (explicitPath) return explicitPath;
  for (const candidate of DEFAULT_CSV_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function catalogHasModels(catalog) {
  return Object.values(catalog?.modellek ?? {}).some((models) => models?.length > 0);
}

export function ensureVehicleCatalog() {
  const existing = loadVehicleCatalog();
  if (existing?.gyartmanyok?.length && catalogHasModels(existing)) {
    syncVehicleCatalogToPublic(existing);
    return existing;
  }

  const fromPublic = loadVehicleCatalog(PUBLIC_CATALOG_PATH);
  if (fromPublic?.gyartmanyok?.length && catalogHasModels(fromPublic)) {
    return fromPublic;
  }

  const csvPath = resolveDefaultCsvPath();
  if (!csvPath) {
    if (existing) syncVehicleCatalogToPublic(existing);
    return existing;
  }

  try {
    return importVehicleCatalogFromCsv(csvPath);
  } catch (error) {
    console.warn("Járműkatalógus import sikertelen:", error.message);
    if (existing) syncVehicleCatalogToPublic(existing);
    return existing ?? fromPublic;
  }
}

let cache = { mtimeMs: null, catalog: null };

/** Memóriában tartott katalógus — a nagy JSON-t nem olvassuk újra kérésenként. */
export function getVehicleCatalog(path = CATALOG_PATH) {
  let mtimeMs = null;
  try {
    mtimeMs = statSync(path).mtimeMs;
  } catch {
    mtimeMs = null;
  }

  if (cache.catalog && cache.mtimeMs === mtimeMs) return cache.catalog;

  const catalog = mtimeMs == null ? ensureVehicleCatalog() : loadVehicleCatalog(path);
  cache = { mtimeMs, catalog };
  return catalog;
}

export function clearVehicleCatalogCache() {
  cache = { mtimeMs: null, catalog: null };
}

export function getVehicleCatalogPath() {
  return CATALOG_PATH;
}

export function getPublicVehicleCatalogPath() {
  return PUBLIC_CATALOG_PATH;
}

export { CATALOG_PATH, PUBLIC_CATALOG_PATH, DEFAULT_CSV_CANDIDATES };
