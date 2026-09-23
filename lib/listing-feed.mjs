/**
 * listing_feed — előkészített listakártyák (nem élő EAV összerakás a GET-nél).
 */
import { sanitizeListingListItem } from "./listing-api-access.mjs";
import { resolveListingVertical } from "./listing-vertical.mjs";
import { normalizeListingStatus } from "./listing-status.mjs";

let feedTableAvailable = null;

export function resetListingFeedTableCache() {
  feedTableAvailable = null;
}

export async function listingFeedTableExists(sb) {
  if (feedTableAvailable != null) return feedTableAvailable;
  const { error } = await sb.from("listing_feed").select("listing_id").limit(1);
  if (error && /listing_feed|schema cache|does not exist|PGRST/i.test(String(error.message || ""))) {
    feedTableAvailable = false;
    return false;
  }
  if (error) {
    // Más hiba: ne tiltsuk le örökre
    return false;
  }
  feedTableAvailable = true;
  return true;
}

export function buildListingFeedRow(listItem) {
  if (!listItem?.id) return null;
  const slim = sanitizeListingListItem({ ...listItem });
  const status = normalizeListingStatus(listItem.status || slim.preview?.status || "mentett");
  const vertical =
    resolveListingVertical(listItem) ||
    String(slim.form?.hirdetes_vertical || listItem.vertical || "").trim().toLowerCase() ||
    null;
  return {
    listing_id: Number(listItem.id),
    status,
    vertical: vertical || null,
    updated_at: listItem.updated_at || new Date().toISOString(),
    created_at: listItem.created_at || null,
    payload: {
      ...slim,
      id: Number(listItem.id),
      status,
      vertical: vertical || slim.form?.hirdetes_vertical || "",
      updated_at: listItem.updated_at || null,
      created_at: listItem.created_at || null,
    },
  };
}

export async function upsertListingFeedRow(sb, listItem) {
  if (!(await listingFeedTableExists(sb))) return false;
  const row = buildListingFeedRow(listItem);
  if (!row) return false;
  const { error } = await sb.from("listing_feed").upsert(row, { onConflict: "listing_id" });
  if (error) throw error;
  return true;
}

export async function deleteListingFeedRow(sb, listingId) {
  if (!(await listingFeedTableExists(sb))) return false;
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) return false;
  const { error } = await sb.from("listing_feed").delete().eq("listing_id", id);
  if (error) throw error;
  return true;
}

export async function listListingFeed(sb, { limit = 50, status = null, vertical = null } = {}) {
  if (!(await listingFeedTableExists(sb))) return null;
  const want = String(vertical ?? "")
    .trim()
    .toLowerCase();
  const needFilter = want === "teher" || want === "auto" || want === "ingatlan";
  const max = Math.min(Math.max(Number(limit) || 50, 1), 50);

  let q = sb
    .from("listing_feed")
    .select("listing_id, status, vertical, updated_at, created_at, payload")
    .order("updated_at", { ascending: false })
    .limit(max);
  if (status) q = q.eq("status", normalizeListingStatus(status));
  if (needFilter) q = q.eq("vertical", want);

  const { data, error } = await q;
  if (error) {
    if (/listing_feed|schema cache|does not exist/i.test(String(error.message || ""))) {
      feedTableAvailable = false;
      return null;
    }
    throw error;
  }

  return (data ?? []).map((row) => {
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    return {
      ...payload,
      id: Number(row.listing_id),
      status: row.status || payload.status,
      vertical: row.vertical || payload.vertical || "",
      updated_at: row.updated_at || payload.updated_at,
      created_at: row.created_at || payload.created_at,
    };
  });
}
