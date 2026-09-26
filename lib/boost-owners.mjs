import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";
import { adminFlagsFromProfile } from "./user-admin-flags.mjs";
import { createRequire } from "module";
import { getDbPath } from "./db.mjs";

const require = createRequire(import.meta.url);

let cache = { at: 0, ids: [] };
const CACHE_MS = 30_000;

function parseBoostIdsFromRows(rows) {
  const ids = [];
  for (const row of rows || []) {
    try {
      const profile =
        typeof row.profile_json === "string"
          ? JSON.parse(row.profile_json)
          : row.profile_json && typeof row.profile_json === "object"
            ? row.profile_json
            : {};
      if (adminFlagsFromProfile(profile).listingBoost) {
        const id = Number(row.id);
        if (Number.isFinite(id) && id > 0) ids.push(id);
      }
    } catch {
      /* ignore */
    }
  }
  return ids;
}

async function loadBoostOwnerIds() {
  if (isSupabaseBackend()) {
    const { data, error } = await getSupabase()
      .from("web_users")
      .select("id, profile_json")
      .limit(5000);
    if (error) throw error;
    return parseBoostIdsFromRows(data);
  }
  const DatabaseSync = require("node:sqlite").DatabaseSync;
  const db = new DatabaseSync(getDbPath());
  try {
    const rows = db.prepare(`SELECT id, profile_json FROM web_users`).all();
    return parseBoostIdsFromRows(rows);
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
}

/** Felhasználók, akiknek listingBoost be van kapcsolva (rövid cache). */
export async function listBoostOwnerIds({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.ids && now - cache.at < CACHE_MS) return cache.ids;
  try {
    const ids = await loadBoostOwnerIds();
    cache = { at: now, ids };
    return ids;
  } catch {
    return cache.ids || [];
  }
}

export function clearBoostOwnerIdsCache() {
  cache = { at: 0, ids: [] };
}
