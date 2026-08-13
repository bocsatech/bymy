/**
 * Egységes async DB API — SQLite lokálisan, Supabase productionön.
 */
import { isSupabaseBackend } from "./supabase/client.mjs";
import * as sqlite from "./db.mjs";
import * as supabase from "./supabase/listings.mjs";

export { LISTING_STATUSES, normalizeListingStatus, formDataToCells, cellsToFormData } from "./db.mjs";

function dispatch(name) {
  return async (...args) => {
    if (isSupabaseBackend()) return supabase[name](...args);
    return sqlite[name](...args);
  };
}

export const closeDb = dispatch("closeDb");
export const listFieldDefs = dispatch("listFieldDefs");
export const listListings = dispatch("listListings");
export const listListingsWithPreview = dispatch("listListingsWithPreview");
export const getListing = dispatch("getListing");
export const getLatestListing = dispatch("getLatestListing");
export const findListingBySourceUrl = dispatch("findListingBySourceUrl");
export const findListingByHasznaltautoId = dispatch("findListingByHasznaltautoId");
export const findListingBySource = dispatch("findListingBySource");
export const listingSourceExists = dispatch("listingSourceExists");
export const updateListingFoKep = dispatch("updateListingFoKep");
export const saveListing = dispatch("saveListing");
export const deleteListing = dispatch("deleteListing");
export const deleteAllListings = dispatch("deleteAllListings");
export const dbStats = dispatch("dbStats");

export async function getDbPath() {
  if (isSupabaseBackend()) return supabase.getDbPath();
  return sqlite.getDbPath();
}

export function getDb() {
  if (isSupabaseBackend()) {
    throw new Error("SQLite nem elérhető Supabase módban.");
  }
  return sqlite.getDb();
}
