import { mkdirSync, existsSync, copyFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { formDataToCells, cellsToFormData, FORM_FIELD_CATALOG } from "./form-field-catalog.mjs";
import {
  buildPreviewFromCells,
  sanitizeListingFieldValue,
  sanitizeListingPlainText,
} from "./listing-preview.mjs";
import { initPartnerSchema } from "./partner-schema.mjs";
import { initWebUsersSchema } from "./web-users.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function DatabaseSyncClass() {
  try {
    return require("node:sqlite").DatabaseSync;
  } catch {
    throw new Error(
      "SQLite (node:sqlite) nem elérhető ezen a Node verzión. Production: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY."
    );
  }
}
const DATA_DIR = join(__dirname, "..", "data");

/** App mappán kívül — túléli a Downloads/autosweb frissítést / újratelepítést. */
function stableHomeDbPath() {
  return join(homedir(), ".autosweb", "autosweb.db");
}

function legacyAppDbPath() {
  return join(DATA_DIR, "autosweb.db");
}

function copyDbSidecars(fromPath, toPath) {
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    const src = fromPath + suffix;
    if (existsSync(src)) {
      try {
        copyFileSync(src, toPath + suffix);
      } catch {
        /* ignore */
      }
    }
  }
}

function migrateLegacyDbIfNeeded(stablePath, legacyPath) {
  if (existsSync(stablePath) || !existsSync(legacyPath)) return;
  mkdirSync(dirname(stablePath), { recursive: true });
  copyFileSync(legacyPath, stablePath);
  copyDbSidecars(legacyPath, stablePath);
  console.log(`SQLite átmozgatva (megmarad újraindítás után): ${legacyPath} → ${stablePath}`);
}

function writeDbLocationHint(dbPath) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(join(DATA_DIR, "DB_LOCATION.txt"), `${dbPath}\n`, "utf8");
  } catch {
    /* ignore */
  }
}

function resolveDbPath() {
  if (process.env.AUTOSWEB_DB_PATH) return process.env.AUTOSWEB_DB_PATH;
  const stable = stableHomeDbPath();
  const legacy = legacyAppDbPath();
  try {
    migrateLegacyDbIfNeeded(stable, legacy);
  } catch (error) {
    console.warn("SQLite migráció sikertelen, régi útvonal:", error.message ?? error);
    writeDbLocationHint(legacy);
    return legacy;
  }
  writeDbLocationHint(stable);
  return stable;
}

let dbInstance = null;
let dbInstancePath = null;

function getDb() {
  const dbPath = resolveDbPath();
  if (dbInstance && dbInstancePath === dbPath) return dbInstance;
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  dbInstance = new (DatabaseSyncClass())(dbPath);
  dbInstancePath = dbPath;
  dbInstance.exec("PRAGMA foreign_keys = ON;");
  dbInstance.exec("PRAGMA journal_mode = DELETE;");
  dbInstance.exec("PRAGMA synchronous = FULL;");
  initSchema(dbInstance);
  return dbInstance;
}

/** Graceful shutdown — fájlba zárás Ctrl+C előtt. */
export function closeDb() {
  if (!dbInstance) return;
  try {
    dbInstance.exec("PRAGMA optimize;");
  } catch {
    /* ignore */
  }
  try {
    dbInstance.close();
  } catch {
    /* ignore */
  }
  dbInstance = null;
  dbInstancePath = null;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS field_defs (
      field_key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      step INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hirdetes_cime TEXT,
      forras_url TEXT,
      hasznaltauto_hirdetes_id TEXT,
      fo_kep TEXT,
      status TEXT NOT NULL DEFAULT 'mentett',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS listing_cells (
      listing_id INTEGER NOT NULL,
      field_key TEXT NOT NULL,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      step INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (listing_id, field_key),
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_listing_cells_listing ON listing_cells(listing_id);
    CREATE INDEX IF NOT EXISTS idx_listings_updated ON listings(updated_at DESC);
  `);

  const insertDef = db.prepare(`
    INSERT OR IGNORE INTO field_defs (field_key, label, step, sort_order)
    VALUES (?, ?, ?, ?)
  `);
  FORM_FIELD_CATALOG.forEach((def, index) => {
    insertDef.run(def.field_key, def.label, def.step, index);
  });

  migrateListingsStatus(db);
  initPartnerSchema(db);
  initWebUsersSchema(db);
}

function migrateListingsStatus(db) {
  const columns = db.prepare("PRAGMA table_info(listings)").all();
  if (!columns.some((col) => col.name === "status")) {
    db.exec("ALTER TABLE listings ADD COLUMN status TEXT NOT NULL DEFAULT 'mentett'");
  }
  if (!columns.some((col) => col.name === "fo_kep")) {
    db.exec("ALTER TABLE listings ADD COLUMN fo_kep TEXT");
  }
}

export const LISTING_STATUSES = ["mentett", "feladott"];

export function normalizeListingStatus(status) {
  const value = String(status ?? "mentett").trim().toLowerCase();
  return LISTING_STATUSES.includes(value) ? value : "mentett";
}

export function getDbPath() {
  getDb();
  return resolveDbPath();
}

export { getDb };

export function listFieldDefs() {
  const db = getDb();
  return db.prepare("SELECT field_key, label, step FROM field_defs ORDER BY sort_order").all();
}

export function listListings({ limit = 50, status = null } = {}) {
  const db = getDb();
  const normalizedStatus = status ? normalizeListingStatus(status) : null;
  if (normalizedStatus) {
    return db
      .prepare(
        `SELECT l.id, l.hirdetes_cime, l.forras_url, l.hasznaltauto_hirdetes_id, l.fo_kep, l.status,
                l.created_at, l.updated_at,
                (SELECT COUNT(*) FROM listing_cells c WHERE c.listing_id = l.id) AS cell_count
         FROM listings l WHERE l.status = ? ORDER BY l.updated_at DESC LIMIT ?`
      )
      .all(normalizedStatus, limit);
  }
  return db
    .prepare(
      `SELECT l.id, l.hirdetes_cime, l.forras_url, l.hasznaltauto_hirdetes_id, l.fo_kep, l.status,
              l.created_at, l.updated_at,
              (SELECT COUNT(*) FROM listing_cells c WHERE c.listing_id = l.id) AS cell_count
       FROM listings l ORDER BY l.updated_at DESC LIMIT ?`
    )
    .all(limit);
}

function loadCellsByListingIds(ids) {
  if (!ids.length) return new Map();
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT listing_id, field_key, label, value, step
       FROM listing_cells WHERE listing_id IN (${placeholders})`
    )
    .all(...ids);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.listing_id)) map.set(row.listing_id, []);
    map.get(row.listing_id).push(row);
  }
  return map;
}

export function listListingsWithPreview({ limit = 50, status = null } = {}) {
  const rows = listListings({ limit, status });
  const cellsById = loadCellsByListingIds(rows.map((row) => row.id));
  return rows.map((row) => {
    const cells = (cellsById.get(row.id) ?? []).map((cell) => sanitizeListingCell(cell));
    const hirdetes_cime =
      sanitizeListingPlainText(row.hirdetes_cime) || `Hirdetés #${row.id}`;
    return {
      ...row,
      hirdetes_cime,
      preview: buildPreviewFromCells(cells, { ...row, hirdetes_cime }),
    };
  });
}

export function getListing(id) {
  const db = getDb();
  const listing = db
    .prepare(
      `SELECT id, hirdetes_cime, forras_url, hasznaltauto_hirdetes_id, fo_kep, status, created_at, updated_at
       FROM listings WHERE id = ?`
    )
    .get(id);
  if (!listing) return null;

  const cells = db
    .prepare(
      `SELECT field_key, label, value, step FROM listing_cells
       WHERE listing_id = ? ORDER BY step, label`
    )
    .all(id)
    .map((cell) => sanitizeListingCell(cell));

  const hirdetes_cime =
    sanitizeListingPlainText(listing.hirdetes_cime) || `Hirdetés #${listing.id}`;

  return {
    ...listing,
    hirdetes_cime,
    cells,
    form: cellsToFormData(cells),
  };
}

const CHROME_FIELD_KEYS = new Set([
  "leiras",
  "hirdetes_cime",
  "gyartmany",
  "modell",
  "tipus",
  "telepules",
  "megye",
  "megtekintesi_cim",
  "iranyitoszam",
]);

function sanitizeListingCell(cell) {
  if (!cell) return cell;
  const key = String(cell.field_key ?? "");
  if (key === "leiras" || key === "hirdetes_cime") {
    return { ...cell, value: sanitizeListingPlainText(cell.value) };
  }
  // Scrape: chrome a gyártmány/modell/település/cím mezőkbe is kerülhet
  if (CHROME_FIELD_KEYS.has(key)) {
    return { ...cell, value: sanitizeListingFieldValue(cell.value) };
  }
  return cell;
}

function sanitizeFormDataForSave(formData = {}) {
  const data = { ...formData };
  data.hirdetes_cime = sanitizeListingPlainText(data.hirdetes_cime) || "";
  data.leiras = sanitizeListingPlainText(data.leiras) || "";
  data.gyartmany = sanitizeListingFieldValue(data.gyartmany);
  data.modell = sanitizeListingFieldValue(data.modell);
  data.tipus = sanitizeListingFieldValue(data.tipus);
  data.telepules = sanitizeListingFieldValue(data.telepules);
  data.megye = sanitizeListingFieldValue(data.megye);
  data.megtekintesi_cim = sanitizeListingFieldValue(data.megtekintesi_cim);
  data.iranyitoszam = sanitizeListingFieldValue(data.iranyitoszam);
  return data;
}

export function getLatestListing() {
  const db = getDb();
  const row = db.prepare("SELECT id FROM listings ORDER BY updated_at DESC LIMIT 1").get();
  return row ? getListing(row.id) : null;
}

export function findListingBySourceUrl(url) {
  if (!url) return null;
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM listings WHERE forras_url = ? ORDER BY updated_at DESC LIMIT 1")
    .get(url);
  return row ? getListing(row.id) : null;
}

export function findListingByHasznaltautoId(adId) {
  const id = String(adId || "").trim();
  if (!id) return null;
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id FROM listings WHERE hasznaltauto_hirdetes_id = ? ORDER BY updated_at DESC LIMIT 1"
    )
    .get(id);
  return row ? getListing(row.id) : null;
}

/** True if a listing with this Használtautó URL or ad id already exists. */
export function listingSourceExists({ sourceUrl = "", hasznaltautoId = "" } = {}) {
  return Boolean(findListingBySource({ sourceUrl, hasznaltautoId }));
}

export function findListingBySource({ sourceUrl = "", hasznaltautoId = "" } = {}) {
  const byUrl = findListingBySourceUrl(sourceUrl);
  if (byUrl) return byUrl;
  return findListingByHasznaltautoId(hasznaltautoId);
}

export function updateListingFoKep(listingId, foKep) {
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const path = String(foKep || "").trim();
  if (!path) return null;
  const db = getDb();
  const info = db
    .prepare(
      `UPDATE listings SET fo_kep = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .run(path, id);
  if (!info.changes) return null;
  return getListing(id);
}

function upsertListingMeta(db, id, formData, status) {
  const existing = db.prepare("SELECT fo_kep FROM listings WHERE id = ?").get(id);
  const nextFoKep = String(formData.fo_kep ?? "").trim() || existing?.fo_kep || "";
  db.prepare(
    `UPDATE listings SET
      hirdetes_cime = ?,
      forras_url = ?,
      hasznaltauto_hirdetes_id = ?,
      fo_kep = ?,
      status = ?,
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    formData.hirdetes_cime ?? "",
    formData.forras_url ?? "",
    formData.hasznaltauto_hirdetes_id ?? "",
    nextFoKep,
    normalizeListingStatus(status ?? formData.status),
    id
  );
}

function replaceCells(db, listingId, cells) {
  db.prepare("DELETE FROM listing_cells WHERE listing_id = ?").run(listingId);
  const insert = db.prepare(
    `INSERT INTO listing_cells (listing_id, field_key, label, value, step)
     VALUES (?, ?, ?, ?, ?)`
  );
  for (const cell of cells) {
    insert.run(listingId, cell.field_key, cell.label, cell.value, cell.step ?? 1);
  }
}

export function saveListing(formData, listingId = null, { status = null } = {}) {
  const db = getDb();
  const clean = sanitizeFormDataForSave(formData);
  const cells = formDataToCells(clean);
  const listingStatus = normalizeListingStatus(status ?? clean.status);

  if (listingId) {
    const existing = db.prepare("SELECT id FROM listings WHERE id = ?").get(listingId);
    if (!existing) return null;
    upsertListingMeta(db, listingId, clean, listingStatus);
    replaceCells(db, listingId, cells);
    return getListing(listingId);
  }

  const insert = db.prepare(
    `INSERT INTO listings (hirdetes_cime, forras_url, hasznaltauto_hirdetes_id, fo_kep, status)
     VALUES (?, ?, ?, ?, ?)`
  );
  const result = insert.run(
    clean.hirdetes_cime ?? "",
    clean.forras_url ?? "",
    clean.hasznaltauto_hirdetes_id ?? "",
    clean.fo_kep ?? formData.fo_kep ?? "",
    listingStatus
  );
  const id = Number(result.lastInsertRowid);
  replaceCells(db, id, cells);
  return getListing(id);
}

export function deleteListing(id) {
  const db = getDb();
  db.prepare("DELETE FROM listings WHERE id = ?").run(id);
  return { ok: true };
}

/** Összes hirdetés + cellák törlése. Vissza: törölt darabszám. */
export function deleteAllListings() {
  const db = getDb();
  const before = Number(db.prepare("SELECT COUNT(*) AS n FROM listings").get()?.n ?? 0);
  db.exec("DELETE FROM listing_cells");
  db.exec("DELETE FROM listings");
  try {
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('listings')");
  } catch {
    /* nincs sqlite_sequence */
  }
  return { ok: true, deleted: before };
}

export function dbStats() {
  const db = getDb();
  const listings = db.prepare("SELECT COUNT(*) AS n FROM listings").get().n;
  const cells = db.prepare("SELECT COUNT(*) AS n FROM listing_cells").get().n;
  const mentett = db.prepare("SELECT COUNT(*) AS n FROM listings WHERE status = 'mentett'").get().n;
  const feladott = db.prepare("SELECT COUNT(*) AS n FROM listings WHERE status = 'feladott'").get().n;
  return { listings, cells, mentett, feladott, path: resolveDbPath() };
}

export { formDataToCells, cellsToFormData };
