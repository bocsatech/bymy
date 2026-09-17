import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";

function pickListingImage(listing) {
  if (!listing) return "";
  const preview = listing.preview ?? {};
  const fromPreview = String(preview.imageUrl || preview.imageUrls?.[0] || "").trim();
  if (fromPreview) return fromPreview;
  const foKep = String(listing.fo_kep || "").trim();
  if (foKep) return foKep;
  const fromDetail = Array.isArray(listing.detail?.images) ? String(listing.detail.images[0] || "").trim() : "";
  return fromDetail;
}

export async function listingImageUrlForConversation(listingId) {
  const map = await listingImageUrlsByIds([listingId]);
  return map.get(Number(listingId)) || "";
}

export async function listingImageUrlsByIds(listingIds = []) {
  const ids = [
    ...new Set(
      listingIds
        .map((value) => Number(value))
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ];
  const map = new Map();
  if (!ids.length) return map;

  if (isSupabaseBackend()) {
    const { data, error } = await getSupabase().from("listings").select("id, fo_kep").in("id", ids);
    if (!error) {
      for (const row of data ?? []) {
        const url = String(row.fo_kep ?? "").trim();
        if (url) map.set(Number(row.id), url);
      }
    }
  }

  const missing = ids.filter((id) => !map.has(id));
  if (!missing.length) return map;

  const getListing = isSupabaseBackend()
    ? (await import("./supabase/listings.mjs")).getListing
    : (await import("./db.mjs")).getListing;

  await Promise.all(
    missing.map(async (id) => {
      try {
        const listing = await getListing(id, { mode: "detail" });
        const url = pickListingImage(listing);
        if (url) map.set(id, url);
      } catch {
        /* ignore */
      }
    })
  );

  return map;
}
