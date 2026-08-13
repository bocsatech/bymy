import { getDb } from "./db.mjs";
import { haversineKm } from "./geo.mjs";
import { PARTNER_CATEGORIES, PARTNER_CATEGORY_IDS } from "./partner-categories.mjs";
import { seedPostalCodesIfEmpty } from "./partner-schema.mjs";
import {
  isBigCityPostalCode,
  normalizePostalCode,
} from "./postal-codes.mjs";

export { seedPostalCodesIfEmpty };

export const MAX_DISTANCE_KM = 30;
export const EMPTY_MESSAGE = "Hamarosan a környékeden is";

const DISTANCE_BANDS = [
  { id: "1-5", min: 0, max: 5, order: 1 },
  { id: "6-10", min: 6, max: 10, order: 2 },
  { id: "11-20", min: 11, max: 20, order: 3 },
  { id: "21-30", min: 21, max: 30, order: 4 },
];

export function upsertPostalCodes(rows) {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO postal_codes (postal_code, city, lat, lon)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(postal_code) DO UPDATE SET
      city = excluded.city,
      lat = excluded.lat,
      lon = excluded.lon
  `);
  let count = 0;
  for (const row of rows) {
    const postal_code = normalizePostalCode(row.postal_code);
    if (!postal_code || row.lat == null || row.lon == null) continue;
    insert.run(postal_code, String(row.city ?? "").trim() || postal_code, Number(row.lat), Number(row.lon));
    count += 1;
  }
  return { count };
}

export function getPostalCode(postalCode) {
  const code = normalizePostalCode(postalCode);
  if (!code) return null;
  const db = getDb();
  return db.prepare("SELECT postal_code, city, lat, lon FROM postal_codes WHERE postal_code = ?").get(code) ?? null;
}

export function listPostalCities() {
  const db = getDb();
  return db
    .prepare(
      `SELECT city, AVG(lat) AS lat, AVG(lon) AS lon
       FROM postal_codes
       GROUP BY city
       ORDER BY city`
    )
    .all()
    .map((row) => ({
      city: row.city,
      lat: Number(row.lat),
      lon: Number(row.lon),
    }));
}

function isPartnerPaid(partner) {
  if (!partner.is_active || !partner.is_paid) return false;
  if (!partner.paid_until) return true;
  const until = new Date(partner.paid_until);
  if (Number.isNaN(until.getTime())) return true;
  return until >= new Date();
}

function loadPartnerServices(db, partnerId) {
  return db
    .prepare("SELECT category_id FROM partner_services WHERE partner_id = ? ORDER BY category_id")
    .all(partnerId)
    .map((row) => row.category_id);
}

function partnerRowToObject(row, services = null) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    postal_code: row.postal_code,
    lat: row.lat,
    lon: row.lon,
    phone: row.phone,
    opening_hours: row.opening_hours ?? "",
    google_place_id: row.google_place_id ?? "",
    google_rating: row.google_rating ?? null,
    google_review_count: row.google_review_count ?? null,
    is_active: Boolean(row.is_active),
    is_paid: Boolean(row.is_paid),
    paid_until: row.paid_until ?? null,
    services: services ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function listPartners({ includeInactive = true } = {}) {
  const db = getDb();
  const where = includeInactive ? "" : "WHERE is_active = 1 AND is_paid = 1";
  const rows = db
    .prepare(
      `SELECT id, name, address, postal_code, lat, lon, phone, opening_hours,
              google_place_id, google_rating, google_review_count,
              is_active, is_paid, paid_until, created_at, updated_at
       FROM partners ${where}
       ORDER BY name COLLATE NOCASE`
    )
    .all();
  return rows.map((row) => partnerRowToObject(row, loadPartnerServices(db, row.id)));
}

export function getPartner(id) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, address, postal_code, lat, lon, phone, opening_hours,
              google_place_id, google_rating, google_review_count,
              is_active, is_paid, paid_until, created_at, updated_at
       FROM partners WHERE id = ?`
    )
    .get(id);
  return partnerRowToObject(row, loadPartnerServices(db, id));
}

function resolvePartnerCoords(data) {
  const postal_code = normalizePostalCode(data.postal_code);
  if (!postal_code) throw new Error("Érvénytelen irányítószám.");
  if (data.lat != null && data.lon != null) {
    return { postal_code, lat: Number(data.lat), lon: Number(data.lon) };
  }
  const lookup = getPostalCode(postal_code);
  if (!lookup) throw new Error(`Ismeretlen irányítószám: ${postal_code}`);
  return { postal_code, lat: lookup.lat, lon: lookup.lon };
}

function normalizeServices(services) {
  if (!Array.isArray(services)) return [];
  return [...new Set(services.map((s) => String(s).trim()).filter((s) => PARTNER_CATEGORY_IDS.has(s)))];
}

function replacePartnerServices(db, partnerId, services) {
  db.prepare("DELETE FROM partner_services WHERE partner_id = ?").run(partnerId);
  const insert = db.prepare("INSERT INTO partner_services (partner_id, category_id) VALUES (?, ?)");
  for (const categoryId of services) {
    insert.run(partnerId, categoryId);
  }
}

export function savePartner(data, partnerId = null) {
  const db = getDb();
  const name = String(data.name ?? "").trim();
  const address = String(data.address ?? "").trim();
  const phone = String(data.phone ?? "").trim();
  if (!name || !address || !phone) {
    throw new Error("Név, cím és telefon kötelező.");
  }

  const coords = resolvePartnerCoords(data);
  const services = normalizeServices(data.services);
  const opening_hours =
    typeof data.opening_hours === "string"
      ? data.opening_hours
      : data.opening_hours
        ? JSON.stringify(data.opening_hours)
        : "";
  const google_place_id = String(data.google_place_id ?? "").trim();
  const google_rating = data.google_rating != null && data.google_rating !== "" ? Number(data.google_rating) : null;
  const google_review_count =
    data.google_review_count != null && data.google_review_count !== "" ? Number(data.google_review_count) : null;
  const is_active = data.is_active === false || data.is_active === 0 ? 0 : 1;
  const is_paid = data.is_paid === true || data.is_paid === 1 ? 1 : 0;
  const paid_until = data.paid_until ? String(data.paid_until).trim() : null;

  if (partnerId) {
    const existing = db.prepare("SELECT id FROM partners WHERE id = ?").get(partnerId);
    if (!existing) return null;
    db.prepare(
      `UPDATE partners SET
        name = ?, address = ?, postal_code = ?, lat = ?, lon = ?, phone = ?,
        opening_hours = ?, google_place_id = ?, google_rating = ?, google_review_count = ?,
        is_active = ?, is_paid = ?, paid_until = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      name,
      address,
      coords.postal_code,
      coords.lat,
      coords.lon,
      phone,
      opening_hours,
      google_place_id,
      google_rating,
      google_review_count,
      is_active,
      is_paid,
      paid_until,
      partnerId
    );
    replacePartnerServices(db, partnerId, services);
    return getPartner(partnerId);
  }

  const result = db
    .prepare(
      `INSERT INTO partners (
        name, address, postal_code, lat, lon, phone, opening_hours,
        google_place_id, google_rating, google_review_count,
        is_active, is_paid, paid_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      address,
      coords.postal_code,
      coords.lat,
      coords.lon,
      phone,
      opening_hours,
      google_place_id,
      google_rating,
      google_review_count,
      is_active,
      is_paid,
      paid_until
    );
  const id = Number(result.lastInsertRowid);
  replacePartnerServices(db, id, services);
  return getPartner(id);
}

export function deletePartner(id) {
  const db = getDb();
  db.prepare("DELETE FROM partners WHERE id = ?").run(id);
  return { ok: true };
}

export function importPartners(rows) {
  const results = [];
  for (const row of rows) {
    try {
      const saved = savePartner(row, row.id ?? null);
      results.push({ ok: true, partner: saved });
    } catch (error) {
      results.push({ ok: false, error: error.message ?? String(error), row });
    }
  }
  return results;
}

function distanceBandForKm(km) {
  for (const band of DISTANCE_BANDS) {
    if (km >= band.min && km <= band.max) return band;
  }
  return null;
}

function googleMapsUrl(partner) {
  if (partner.google_place_id) {
    return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(partner.google_place_id)}`;
  }
  const q = encodeURIComponent(`${partner.name} ${partner.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function formatRecommendationPartner(partner, distanceKm, band) {
  return {
    id: partner.id,
    name: partner.name,
    address: partner.address,
    postal_code: partner.postal_code,
    phone: partner.phone,
    opening_hours: partner.opening_hours,
    google_rating: partner.google_rating,
    google_review_count: partner.google_review_count,
    google_maps_url: googleMapsUrl(partner),
    distance_km: Math.round(distanceKm * 10) / 10,
    distance_band: band.id,
  };
}

function pickPartnersForCategory(candidates, isBigCity) {
  if (!candidates.length) return [];
  if (candidates.length === 1) return candidates;
  const max = isBigCity ? 5 : 3;
  return candidates.slice(0, max);
}

export function getPartnerRecommendations(postalCodeInput) {
  const postal_code = normalizePostalCode(postalCodeInput);
  if (!postal_code) {
    throw new Error("Adj meg érvényes 4 számjegyű irányítószámot.");
  }

  const origin = getPostalCode(postal_code);
  if (!origin) {
    throw new Error(`Ismeretlen irányítószám: ${postal_code}. Próbálj másik kódot.`);
  }

  const is_big_city = isBigCityPostalCode(postal_code);
  const db = getDb();

  const paidPartners = db
    .prepare(
      `SELECT p.id, p.name, p.address, p.postal_code, p.lat, p.lon, p.phone, p.opening_hours,
              p.google_place_id, p.google_rating, p.google_review_count,
              p.is_active, p.is_paid, p.paid_until
       FROM partners p
       WHERE p.is_active = 1 AND p.is_paid = 1`
    )
    .all()
    .filter(isPartnerPaid);

  const servicesByPartner = new Map();
  if (paidPartners.length) {
    const ids = paidPartners.map((p) => p.id);
    const placeholders = ids.map(() => "?").join(",");
    const serviceRows = db
      .prepare(
        `SELECT partner_id, category_id FROM partner_services WHERE partner_id IN (${placeholders})`
      )
      .all(...ids);
    for (const row of serviceRows) {
      if (!servicesByPartner.has(row.partner_id)) servicesByPartner.set(row.partner_id, []);
      servicesByPartner.get(row.partner_id).push(row.category_id);
    }
  }

  const categories = PARTNER_CATEGORIES.map((category) => {
    const withDistance = paidPartners
      .filter((partner) => servicesByPartner.get(partner.id)?.includes(category.id))
      .map((partner) => {
        const distanceKm = haversineKm(origin.lat, origin.lon, partner.lat, partner.lon);
        const band = distanceBandForKm(distanceKm);
        return { partner, distanceKm, band };
      })
      .filter((item) => item.band && item.distanceKm <= MAX_DISTANCE_KM)
      .sort((a, b) => {
        if (a.band.order !== b.band.order) return a.band.order - b.band.order;
        if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
        return a.partner.name.localeCompare(b.partner.name, "hu");
      });

    const picked = pickPartnersForCategory(withDistance, is_big_city);
    const partners = picked.map((item) =>
      formatRecommendationPartner(item.partner, item.distanceKm, item.band)
    );

    return {
      id: category.id,
      label: category.label,
      partners,
      empty_message: partners.length ? null : EMPTY_MESSAGE,
    };
  });

  return {
    postal_code,
    city: origin.city,
    is_big_city,
    max_results: is_big_city ? 5 : 3,
    categories,
  };
}

export function partnerStats() {
  const db = getDb();
  const total = db.prepare("SELECT COUNT(*) AS n FROM partners").get().n;
  const activePaid = db
    .prepare("SELECT COUNT(*) AS n FROM partners WHERE is_active = 1 AND is_paid = 1")
    .get().n;
  const postalCodes = db.prepare("SELECT COUNT(*) AS n FROM postal_codes").get().n;
  return { total, activePaid, postalCodes };
}
