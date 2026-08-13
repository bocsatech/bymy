import { PARTNER_CATEGORIES } from "./partner-categories.mjs";
import { loadPostalCodeSeedRows } from "./postal-codes.mjs";

export function initPartnerSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_categories (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS postal_codes (
      postal_code TEXT PRIMARY KEY,
      city TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      phone TEXT NOT NULL,
      opening_hours TEXT,
      google_place_id TEXT,
      google_rating REAL,
      google_review_count INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_paid INTEGER NOT NULL DEFAULT 0,
      paid_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS partner_services (
      partner_id INTEGER NOT NULL,
      category_id TEXT NOT NULL,
      PRIMARY KEY (partner_id, category_id),
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES service_categories(id)
    );

    CREATE INDEX IF NOT EXISTS idx_partners_active_paid ON partners(is_active, is_paid);
    CREATE INDEX IF NOT EXISTS idx_partner_services_category ON partner_services(category_id);
  `);

  seedCategories(db);
  seedPostalCodesIfEmpty(db);
}

function seedCategories(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO service_categories (id, label, sort_order)
    VALUES (?, ?, ?)
  `);
  for (const cat of PARTNER_CATEGORIES) {
    insert.run(cat.id, cat.label, cat.sort_order);
  }
}

export function seedPostalCodesIfEmpty(db) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM postal_codes").get().n;
  if (count > 0) return { inserted: 0, total: count };

  const rows = loadPostalCodeSeedRows();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO postal_codes (postal_code, city, lat, lon)
    VALUES (?, ?, ?, ?)
  `);
  let inserted = 0;
  for (const row of rows) {
    const result = insert.run(row.postal_code, row.city, row.lat, row.lon);
    if (result.changes) inserted += 1;
  }
  return { inserted, total: rows.length };
}
