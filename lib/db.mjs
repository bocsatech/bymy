import { mkdirSync, existsSync, copyFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { isServerlessRuntime, supabaseMissingOnServerlessError } from "./runtime.mjs";
import { formDataToCells, cellsToFormData, FORM_FIELD_CATALOG, ALL_FORM_FIELD_DEFS, DROPPED_FORM_FIELD_KEYS } from "./form-field-catalog.mjs";
import {
  buildPreviewFromCells,
  composeVehicleTitle,
  sanitizeListingFieldValue,
  sanitizeListingPlainText,
} from "./listing-preview.mjs";
import { buildListingDetailView } from "./listing-detail-view.mjs";
import { initPartnerSchema } from "./partner-schema.mjs";
import { initWebUsersSchema } from "./web-users.mjs";
import { LISTING_STATUSES, normalizeListingStatus } from "./listing-status.mjs";
import { displayImageUrl } from "./listing-image.mjs";
import {
  listingStatsFromForm,
  mergeProtectedCells,
  ownerCell,
} from "./listing-meta.mjs";
import { normalizeFormVertical, resolveListingVertical, resolveVerticalFromFields } from "./listing-vertical.mjs";

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
  if (isServerlessRuntime()) throw supabaseMissingOnServerlessError();
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
  ALL_FORM_FIELD_DEFS.forEach((def, index) => {
    insertDef.run(def.field_key, def.label, def.step, index);
  });

  const dropped = DROPPED_FORM_FIELD_KEYS;
  if (dropped.length) {
    const ph = dropped.map(() => "?").join(",");
    db.prepare(`DELETE FROM listing_cells WHERE field_key IN (${ph})`).run(...dropped);
    db.prepare(`DELETE FROM field_defs WHERE field_key IN (${ph})`).run(...dropped);
  }

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

export function listListingsWithPreview({ limit = 50, status = null, vertical = null } = {}) {
  const want = String(vertical ?? "")
    .trim()
    .toLowerCase();
  const needFilter = want === "teher" || want === "auto" || want === "ingatlan";
  const fetchLimit = needFilter ? Math.min(Math.max(limit * 40, 400), 2000) : limit;
  const rows = listListings({ limit: fetchLimit, status });
  const cellsById = loadCellsByListingIds(rows.map((row) => row.id));
  let items = rows.map((row) => {
    const cells = (cellsById.get(row.id) ?? []).map((cell) => sanitizeListingCell(cell));
    const hirdetes_cime =
      sanitizeListingPlainText(row.hirdetes_cime) || `Hirdetés #${row.id}`;
    const preview = buildPreviewFromCells(cells, { ...row, hirdetes_cime });
    const urls = (preview.imageUrls?.length ? preview.imageUrls : [row.fo_kep])
      .map((url) => {
        try {
          return displayImageUrl(url);
        } catch {
          return "";
        }
      })
      .filter(Boolean);
    preview.imageUrl = urls[0] || "";
    preview.imageUrls = urls;
    preview.photoCount = urls.length;
    const form = cellsToFormData(cells);
    const stats = listingStatsFromForm(form, row);
    preview.views = stats.views;
    return {
      ...row,
      ...stats,
      hirdetes_cime,
      preview,
    };
  });
  if (needFilter) {
    items = items.filter((item) => resolveListingVertical(item) === want).slice(0, limit);
  }
  return items;
}

/** Menü számlálók — csak vertical cellák. */
export function countNavListings({ status = "feladott" } = {}) {
  const db = getDb();
  const wantStatus = normalizeListingStatus(status);
  const rows = db.prepare(`SELECT id FROM listings WHERE status = ?`).all(wantStatus);
  const counts = { auto: 0, teher: 0, ingatlan: 0 };
  if (!rows.length) return counts;
  const cells = db
    .prepare(
      `SELECT listing_id, field_key, value FROM listing_cells
       WHERE field_key IN ('hirdetes_vertical', 'hirdetes_alkategoria')`
    )
    .all();
  const vertById = new Map();
  for (const cell of cells) {
    const cur = vertById.get(cell.listing_id) || { vertical: "", alkategoria: "" };
    if (cell.field_key === "hirdetes_vertical") cur.vertical = cell.value;
    if (cell.field_key === "hirdetes_alkategoria") cur.alkategoria = cell.value;
    vertById.set(cell.listing_id, cur);
  }
  for (const row of rows) {
    const cur = vertById.get(row.id) || {};
    const resolved = resolveVerticalFromFields(cur.vertical, cur.alkategoria);
    if (resolved === "teher") counts.teher += 1;
    else if (resolved === "ingatlan") counts.ingatlan += 1;
    else counts.auto += 1;
  }
  return counts;
}

export function getListing(id, { mode = "full" } = {}) {
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
  const form = cellsToFormData(cells);
  const stats = listingStatsFromForm(form, listing);
  const base = {
    ...listing,
    ...stats,
    hirdetes_cime,
    detail: buildListingDetailView({ ...listing, hirdetes_cime, form, ...stats }),
  };
  if (mode === "detail") return base;
  return {
    ...base,
    cells,
    form,
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
  const data = normalizeFormVertical({ ...formData });
  data.leiras = sanitizeListingPlainText(data.leiras) || "";
  data.gyartmany = sanitizeListingFieldValue(data.gyartmany);
  data.modell = sanitizeListingFieldValue(data.modell);
  data.tipus = sanitizeListingFieldValue(data.tipus);
  data.telepules = sanitizeListingFieldValue(data.telepules);
  data.megye = sanitizeListingFieldValue(data.megye);
  data.megtekintesi_cim = sanitizeListingFieldValue(data.megtekintesi_cim);
  data.iranyitoszam = sanitizeListingFieldValue(data.iranyitoszam);
  const vehicleTitle = composeVehicleTitle(data);
  data.hirdetes_cime = vehicleTitle
    ? `Eladó ${vehicleTitle}`
    : sanitizeListingPlainText(data.hirdetes_cime) || "";
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
  const id = String(adId || "").replace(/\D/g, "");
  if (id.length < 5) return null;
  const db = getDb();
  const byCol = db
    .prepare(
      "SELECT id FROM listings WHERE hasznaltauto_hirdetes_id = ? ORDER BY updated_at DESC LIMIT 1"
    )
    .get(id);
  if (byCol) return getListing(byCol.id);
  const byUrl = db
    .prepare(
      "SELECT id FROM listings WHERE forras_url LIKE ? ORDER BY updated_at DESC LIMIT 1"
    )
    .get(`%${id}%`);
  if (byUrl) return getListing(byUrl.id);
  const byCell = db
    .prepare(
      "SELECT listing_id AS id FROM listing_cells WHERE field_key = 'hasznaltauto_hirdetes_id' AND value = ? LIMIT 1"
    )
    .get(id);
  return byCell ? getListing(byCell.id) : null;
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

export function updateListingPhotoUrls(listingId, urls) {
  const list = [...new Set((urls ?? []).map((url) => String(url ?? "").trim()).filter(Boolean))];
  if (!list.length) return null;
  const updated = updateListingFoKep(listingId, list[0]);
  if (!updated) return null;
  const db = getDb();
  db.prepare(
    `INSERT INTO listing_cells (listing_id, field_key, label, value, step)
     VALUES (?, 'fotok', 'Fotók', ?, 4)
     ON CONFLICT(listing_id, field_key) DO UPDATE SET value = excluded.value, label = excluded.label, step = excluded.step`
  ).run(Number(listingId), list.join("\n"));
  return getListing(listingId);
}

export function clearListingPhotos(listingId) {
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const db = getDb();
  db.prepare(`UPDATE listings SET fo_kep = '', updated_at = datetime('now') WHERE id = ?`).run(id);
  db.prepare(`DELETE FROM listing_cells WHERE listing_id = ? AND field_key = 'fotok'`).run(id);
  return getListing(id);
}

export function upsertListingCell(listingId, fieldKey, label, value, step = 9) {
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const db = getDb();
  db.prepare(
    `INSERT INTO listing_cells (listing_id, field_key, label, value, step)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(listing_id, field_key) DO UPDATE SET value = excluded.value, label = excluded.label, step = excluded.step`
  ).run(id, fieldKey, label, String(value ?? ""), step);
  return getListing(id);
}

export function recordListingView(listingId, source = "web") {
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const db = getDb();
  const row = db.prepare("SELECT id FROM listings WHERE id = ?").get(id);
  if (!row) return null;

  const key = source === "app" ? "views_app" : "views_web";
  const label = key === "views_app" ? "App megtekintés" : "Web megtekintés";
  const cells = db
    .prepare(
      `SELECT field_key, value FROM listing_cells
       WHERE listing_id = ? AND field_key IN ('views_web', 'views_app')`
    )
    .all(id);

  let views_web = 0;
  let views_app = 0;
  for (const cell of cells) {
    if (cell.field_key === "views_web") views_web = Math.max(0, Number(cell.value) || 0);
    if (cell.field_key === "views_app") views_app = Math.max(0, Number(cell.value) || 0);
  }
  if (key === "views_web") views_web += 1;
  else views_app += 1;

  db.prepare(
    `INSERT INTO listing_cells (listing_id, field_key, label, value, step)
     VALUES (?, ?, ?, ?, 9)
     ON CONFLICT(listing_id, field_key) DO UPDATE SET
       value = excluded.value, label = excluded.label, step = excluded.step`
  ).run(id, key, label, String(key === "views_web" ? views_web : views_app));

  return {
    views: views_web + views_app,
    views_web,
    views_app,
  };
}

export function listMyListings({ userId, limit = 200 } = {}) {
  return listListingsByOwner({ userId, limit, status: null });
}

/** Nyilvános: egy hirdető összes (vagy feladott) hirdetése. */
export function listListingsByOwner({
  userId,
  limit = 200,
  excludeId = null,
  status = "feladott",
} = {}) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return [];
  const max = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const db = getDb();
  const ownerRows = db
    .prepare(
      `SELECT listing_id FROM listing_cells
       WHERE field_key = 'owner_user_id' AND value = ?
       LIMIT ?`
    )
    .all(String(uid), Math.min(max + 20, 520));
  const skip = Number(excludeId);
  let ids = [
    ...new Set(
      ownerRows
        .map((row) => Number(row.listing_id))
        .filter((id) => id > 0 && !(Number.isFinite(skip) && skip > 0 && id === skip))
    ),
  ];
  if (!ids.length) return [];
  ids = ids.slice(0, max);

  const placeholders = ids.map(() => "?").join(",");
  const normalizedStatus = status ? normalizeListingStatus(status) : null;
  const rows = normalizedStatus
    ? db
        .prepare(
          `SELECT id, hirdetes_cime, forras_url, hasznaltauto_hirdetes_id, fo_kep, status, created_at, updated_at
           FROM listings
           WHERE id IN (${placeholders}) AND status = ?
           ORDER BY updated_at DESC`
        )
        .all(...ids, normalizedStatus)
    : db
        .prepare(
          `SELECT id, hirdetes_cime, forras_url, hasznaltauto_hirdetes_id, fo_kep, status, created_at, updated_at
           FROM listings
           WHERE id IN (${placeholders})
           ORDER BY updated_at DESC`
        )
        .all(...ids);

  const cellsById = loadCellsByListingIds(rows.map((row) => row.id));
  return rows.map((row) => {
    const cells = (cellsById.get(row.id) ?? []).map((cell) => sanitizeListingCell(cell));
    const hirdetes_cime =
      sanitizeListingPlainText(row.hirdetes_cime) || `Hirdetés #${row.id}`;
    const preview = buildPreviewFromCells(cells, { ...row, hirdetes_cime });
    const urls = (preview.imageUrls?.length ? preview.imageUrls : [row.fo_kep])
      .map((url) => {
        try {
          return displayImageUrl(url);
        } catch {
          return "";
        }
      })
      .filter(Boolean);
    preview.imageUrl = urls[0] || "";
    preview.imageUrls = urls;
    preview.photoCount = urls.length;
    const form = cellsToFormData(cells);
    const stats = listingStatsFromForm(form, row);
    preview.views = stats.views;
    return {
      ...row,
      ...stats,
      hirdetes_cime,
      preview,
    };
  });
}

export function updateListingStatus(listingId, status, userId = null) {
  const listing = getListing(listingId);
  if (!listing) return null;
  const next = normalizeListingStatus(status);
  const db = getDb();
  db.prepare(`UPDATE listings SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
    next,
    Number(listingId)
  );
  const owner = ownerCell(userId);
  if (owner && !listing.form?.owner_user_id) {
    upsertListingCell(listingId, owner.field_key, owner.label, owner.value, owner.step);
  }
  return getListing(listingId);
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
  const existing = db
    .prepare(`SELECT field_key, label, value, step FROM listing_cells WHERE listing_id = ?`)
    .all(listingId);
  const merged = mergeProtectedCells(cells, existing);
  db.prepare("DELETE FROM listing_cells WHERE listing_id = ?").run(listingId);
  const insert = db.prepare(
    `INSERT INTO listing_cells (listing_id, field_key, label, value, step)
     VALUES (?, ?, ?, ?, ?)`
  );
  for (const cell of merged) {
    insert.run(listingId, cell.field_key, cell.label, cell.value, cell.step ?? 1);
  }
}

export function saveListing(formData, listingId = null, { status = null, userId = null } = {}) {
  const db = getDb();
  const clean = sanitizeFormDataForSave(formData);
  const cells = formDataToCells(clean);
  const owner = ownerCell(userId);
  const listingStatus = normalizeListingStatus(status ?? clean.status);

  if (listingId) {
    const existing = db.prepare("SELECT id FROM listings WHERE id = ?").get(listingId);
    if (!existing) return null;
    const existingCells = db
      .prepare(`SELECT field_key FROM listing_cells WHERE listing_id = ?`)
      .all(listingId);
    if (owner && !existingCells.some((cell) => cell.field_key === "owner_user_id")) {
      cells.push(owner);
    }
    upsertListingMeta(db, listingId, clean, listingStatus);
    replaceCells(db, listingId, cells);
    return getListing(listingId);
  }

  if (owner) cells.push(owner);
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

export { LISTING_STATUSES, normalizeListingStatus } from "./listing-status.mjs";
