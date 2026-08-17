/**
 * Egységes async DB API — SQLite lokálisan, Supabase productionön.
 */
import { isSupabaseBackend } from "./supabase/client.mjs";
import * as supabase from "./supabase/listings.mjs";

export { LISTING_STATUSES, normalizeListingStatus } from "./listing-status.mjs";
export { formDataToCells, cellsToFormData } from "./form-field-catalog.mjs";

async function sqlite() {
  return import("./db.mjs");
}

function dispatch(name) {
  return async (...args) => {
    if (isSupabaseBackend()) return supabase[name](...args);
    return (await sqlite())[name](...args);
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
export const updateListingPhotoUrls = dispatch("updateListingPhotoUrls");
export const recordListingView = dispatch("recordListingView");
export const listMyListings = dispatch("listMyListings");
export const updateListingStatus = dispatch("updateListingStatus");
export const saveListing = dispatch("saveListing");
export const deleteListing = dispatch("deleteListing");
export const deleteAllListings = dispatch("deleteAllListings");
export const dbStats = dispatch("dbStats");

export async function getDbPath() {
  if (isSupabaseBackend()) return supabase.getDbPath();
  return (await sqlite()).getDbPath();
}

export async function getDb() {
  if (isSupabaseBackend()) {
    throw new Error("SQLite nem elérhető Supabase módban.");
  }
  return (await sqlite()).getDb();
}
