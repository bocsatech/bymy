import {
  getImporterListingAddressFromProfile,
  getListingAddressFromProfile,
} from "./listing-address-from-profile.mjs";
import { lookupPostalCodeFromSeed } from "./postal-codes.mjs";

function blank(value) {
  return !String(value ?? "").trim();
}

export function previewNeedsLocationEnrichment(preview) {
  const filter = preview?.filter ?? {};
  return blank(filter.telepules);
}

export function enrichPreviewLocationFromPostal(preview) {
  if (!preview || !previewNeedsLocationEnrichment(preview)) return preview;
  const filter = { ...(preview.filter ?? {}) };
  const postal = String(filter.iranyitoszam ?? "").replace(/\D/g, "").slice(0, 4);
  if (postal.length !== 4) return preview;
  const hit = lookupPostalCodeFromSeed(postal);
  if (!hit?.city) return preview;
  filter.telepules = hit.city;
  if (blank(filter.megye) && hit.megye) filter.megye = hit.megye;
  const location = [filter.telepules, filter.megye].filter(Boolean).join(", ");
  return { ...preview, filter, location: location || preview.location || "" };
}

export function enrichPreviewLocationFromProfile(preview, profile) {
  if (!preview || !profile) return preview;
  const fromPostal = enrichPreviewLocationFromPostal(preview);
  if (!previewNeedsLocationEnrichment(fromPostal)) return fromPostal;

  const addr = getImporterListingAddressFromProfile(profile);
  const filter = { ...(fromPostal.filter ?? {}) };
  const postal = addr.postalCode || String(filter.iranyitoszam ?? "").replace(/\D/g, "").slice(0, 4);
  let city = addr.city;
  let megye = String(filter.megye ?? "").trim();

  const hit = postal ? lookupPostalCodeFromSeed(postal) : null;
  if (!city && hit?.city) city = hit.city;
  if (blank(megye) && hit?.megye) megye = hit.megye;

  if (blank(city) && blank(postal)) return preview;

  if (blank(filter.telepules) && city) filter.telepules = city;
  if (blank(filter.iranyitoszam) && postal) filter.iranyitoszam = postal;
  if (blank(filter.megye) && megye) filter.megye = megye;

  const location = [filter.telepules, filter.megye].filter(Boolean).join(", ");
  return {
    ...fromPostal,
    filter,
    location: location || fromPostal.location || "",
  };
}

export function enrichListingItemLocationFromProfile(item, profile) {
  if (!item?.preview) return item;
  const preview = enrichPreviewLocationFromProfile(item.preview, profile);
  if (preview === item.preview) return item;
  return { ...item, preview };
}

function ownerIdsNeedingLocation(items) {
  return [
    ...new Set(
      (items ?? [])
        .filter((item) => previewNeedsLocationEnrichment(item.preview))
        .map((item) => Number(item.user_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ];
}

function mapItemsWithProfiles(items, profileById) {
  return (items ?? []).map((item) => {
    let next = item;
    if (previewNeedsLocationEnrichment(next.preview)) {
      const fromPostal = enrichPreviewLocationFromPostal(next.preview);
      if (fromPostal !== next.preview) {
        next = { ...next, preview: fromPostal };
      }
    }
    if (!previewNeedsLocationEnrichment(next.preview)) return next;
    const profile = profileById.get(Number(next.user_id));
    if (!profile) return next;
    return enrichListingItemLocationFromProfile(next, profile);
  });
}

export function enrichListingsWithOwnerProfileLocationSync(items, getUserById) {
  const ownerIds = ownerIdsNeedingLocation(items);
  if (!ownerIds.length || typeof getUserById !== "function") return items;

  const profileById = new Map();
  for (const id of ownerIds) {
    try {
      const user = getUserById(id);
      if (user?.profile) profileById.set(id, user.profile);
    } catch {
    }
  }
  return mapItemsWithProfiles(items, profileById);
}

export async function enrichListingsWithOwnerProfileLocation(items, getUserById) {
  const ownerIds = ownerIdsNeedingLocation(items);
  if (!ownerIds.length || typeof getUserById !== "function") return items;

  const profileById = new Map();
  await Promise.all(
    ownerIds.map(async (id) => {
      try {
        const user = await getUserById(id);
        if (user?.profile) profileById.set(id, user.profile);
      } catch {
      }
    })
  );
  return mapItemsWithProfiles(items, profileById);
}
