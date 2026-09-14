import { assertSupabaseConfigured } from "./supabase/client.mjs";

export { LISTING_STATUSES, normalizeListingStatus } from "./listing-status.mjs";
export { formDataToCells, cellsToFormData } from "./form-field-catalog.mjs";

export * from "./supabase/listings.mjs";

export async function getDb() {
  assertSupabaseConfigured("getDb");
  throw new Error("SQLite eltávolítva — csak Supabase (listings API: db-store).");
}
