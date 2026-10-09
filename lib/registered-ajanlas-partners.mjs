/**
 * Regisztrált cégek az Ajánlások listához (companyAjanlasok + munkaterület).
 */
import { createRequire } from "module";
import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";
import { getDbPath } from "./db.mjs";
import {
  publicCompanyAjanlasServices,
  normalizeCompanyWorkRadiusKm,
} from "./company-ajanlasok.mjs";
import { adminFlagsFromProfile } from "./user-admin-flags.mjs";
import { normalizePostalCode } from "./postal-codes.mjs";

const require = createRequire(import.meta.url);

const CACHE_MS = 30_000;
let cache = { at: 0, rows: null };

export { normalizeCompanyWorkRadiusKm, COMPANY_WORK_RADIUS_KM_VALUES } from "./company-ajanlasok.mjs";

export function normalizeAjanlasPriority(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < 1 || i > 5) return null;
  return i;
}

function parseProfileJson(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function rowToCandidate(row, getPostalCode) {
  const profile = parseProfileJson(row.profile_json);
  if (profile.companyAjanlasok !== true) return null;
  const services = publicCompanyAjanlasServices(profile);
  if (!services.length) return null;

  const postal = normalizePostalCode(profile.companyPostalCode);
  if (!postal) return null;
  const street = String(profile.companyStreet || profile.companyAddress || "").trim();
  const city = String(profile.companyCity || "").trim();
  if (!street || !city) return null;

  const coords = getPostalCode(postal);
  if (!coords || coords.lat == null || coords.lon == null) return null;

  const flags = adminFlagsFromProfile(profile);
  const name =
    String(profile.companyListingName || profile.company || row.display_name || "").trim() ||
    "Partner";
  const phone = String(profile.companyPhone || profile.phone || "").trim();
  if (!phone) return null;

  return {
    userId: Number(row.id),
    name,
    address: street,
    postal_code: postal,
    city,
    lat: Number(coords.lat),
    lon: Number(coords.lon),
    phone,
    services,
    workRadiusKm: normalizeCompanyWorkRadiusKm(profile.companyWorkRadiusKm, 30),
    ajanlasPriority: normalizeAjanlasPriority(flags.ajanlasPriority),
    slug: "",
  };
}

async function loadRawRows() {
  if (isSupabaseBackend()) {
    const { data, error } = await getSupabase()
      .from("web_users")
      .select("id, display_name, profile_json")
      .limit(5000);
    if (error) throw error;
    return data || [];
  }
  const DatabaseSync = require("node:sqlite").DatabaseSync;
  const db = new DatabaseSync(getDbPath());
  try {
    return db.prepare(`SELECT id, display_name, profile_json FROM web_users`).all();
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
}

async function attachSlugs(candidates) {
  if (!candidates.length || !isSupabaseBackend()) return candidates;
  const ids = candidates.map((c) => c.userId).filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return candidates;
  try {
    const { data, error } = await getSupabase()
      .from("partner_profiles")
      .select("user_id, slug")
      .in("user_id", ids)
      .eq("is_public", true);
    if (error || !data?.length) return candidates;
    const byUser = new Map(data.map((r) => [Number(r.user_id), String(r.slug || "").trim()]));
    for (const c of candidates) {
      c.slug = byUser.get(c.userId) || "";
    }
  } catch {
    /* slug opcionális */
  }
  return candidates;
}

/** Rövid cache-elt lista a bekapcsolt ajánlásos cégekről. */
export async function listRegisteredAjanlasPartners({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.rows && now - cache.at < CACHE_MS) return cache.rows;
  try {
    const { getPostalCode } = await import("./partners.mjs");
    const rows = await loadRawRows();
    const candidates = [];
    for (const row of rows) {
      const c = rowToCandidate(row, getPostalCode);
      if (c) candidates.push(c);
    }
    await attachSlugs(candidates);
    cache = { at: now, rows: candidates };
    return candidates;
  } catch (err) {
    console.warn("[ajanlas] registered partners load failed:", err?.message || err);
    return cache.rows || [];
  }
}

export function clearRegisteredAjanlasPartnersCache() {
  cache = { at: 0, rows: null };
}
