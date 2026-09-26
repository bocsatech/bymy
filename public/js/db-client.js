const LISTING_ID_KEY = "bymy-listing-id";

function authHeaders() {
  return { "Content-Type": "application/json" };
}

export function getStoredListingId() {
  const raw = sessionStorage.getItem(LISTING_ID_KEY);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function setStoredListingId(id) {
  if (id == null) sessionStorage.removeItem(LISTING_ID_KEY);
  else sessionStorage.setItem(LISTING_ID_KEY, String(id));
}

async function parseJson(response) {
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 404 && data.error === "Ismeretlen API.") {
      throw new Error("Régi Bymy szerver — futtasd: bymy/mac/frissites.command, majd indítsd újra.");
    }
    throw new Error(data.error || "Szerver hiba");
  }
  return data;
}

export async function fetchDbStats() {
  const response = await fetch("/api/db/stats");
  return parseJson(response);
}

export async function fetchListings({
  limit = 50,
  offset = 0,
  status = null,
  vertical = null,
  owner = null,
  excludeId = null,
  tile = true,
  sort = null,
} = {}) {
  const page = await fetchListingsPage({
    limit,
    offset,
    status,
    vertical,
    owner,
    excludeId,
    tile,
    sort,
  });
  return page.listings;
}

export async function fetchListingsPage({
  limit = 20,
  offset = 0,
  status = null,
  vertical = null,
  owner = null,
  excludeId = null,
  tile = true,
  sort = null,
} = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(Math.max(0, Number(offset) || 0)),
  });
  if (status) params.set("status", status);
  if (vertical) params.set("vertical", String(vertical));
  if (owner != null && owner !== "") params.set("owner", String(owner));
  if (excludeId != null && excludeId !== "") params.set("exclude", String(excludeId));
  if (sort) params.set("sort", String(sort));
  if (tile) params.set("tile", "1");
  else params.set("full", "1");
  const response = await fetch(`/api/listings?${params}`);
  const data = await parseJson(response);
  const listings = data.listings ?? [];
  return {
    listings,
    boostOwnerIds: Array.isArray(data.boostOwnerIds) ? data.boostOwnerIds.map(Number).filter((n) => n > 0) : [],
    boostListingIds: Array.isArray(data.boostListingIds)
      ? data.boostListingIds.map(Number).filter((n) => n > 0)
      : [],
    total: data.total != null ? Number(data.total) : null,
    offset: data.offset != null ? Number(data.offset) : Number(offset) || 0,
    limit: data.limit != null ? Number(data.limit) : Number(limit) || listings.length,
    hasMore: Boolean(data.hasMore ?? listings.length >= limit),
  };
}

export async function fetchLatestListing() {
  const response = await fetch("/api/listings/latest");
  const data = await parseJson(response);
  return data.listing ?? null;
}

export async function fetchListing(id, { view } = {}) {
  const params = view ? `?view=${encodeURIComponent(view)}` : "";
  const response = await fetch(`/api/listings/${id}${params}`, {
    credentials: "same-origin",
    headers: authHeaders(),
  });
  const data = await parseJson(response);
  return data.listing ?? null;
}

export async function fetchRelatedListings(listingId, { limit = 24, includeSelf = false } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (includeSelf) params.set("includeSelf", "1");
  const response = await fetch(`/api/listings/${listingId}/related?${params}`, {
    credentials: "same-origin",
  });
  const data = await parseJson(response);
  return data.listings ?? [];
}

export async function revealListingContact(listingId, turnstileToken = "") {
  const response = await fetch(`/api/listings/${listingId}/reveal-contact`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ turnstileToken }),
  });
  const data = await parseJson(response);
  return {
    phone: String(data.phone ?? "").trim(),
    phones: Array.isArray(data.phones)
      ? data.phones.map((p) => String(p ?? "").trim()).filter(Boolean)
      : String(data.phone ?? "").trim()
        ? [String(data.phone).trim()]
        : [],
    addressLines: Array.isArray(data.addressLines) ? data.addressLines : [],
  };
}

export async function fetchSellerContact(listingId) {
  const response = await fetch(`/api/listings/${listingId}/seller-contact`, {
    credentials: "same-origin",
  });
  const data = await parseJson(response);
  return data.contact ?? null;
}

export async function fetchSellerRating(listingId) {
  const response = await fetch(`/api/listings/${listingId}/seller-rating`, {
    credentials: "same-origin",
  });
  const data = await parseJson(response);
  return data.rating ?? null;
}

export async function submitSellerRating(listingId, score) {
  const response = await fetch(`/api/listings/${listingId}/seller-rating`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ score }),
  });
  const data = await parseJson(response);
  return data.rating ?? null;
}

export async function saveListingToDb(formData, listingId = null, { status = null, photos = [] } = {}) {
  const response = await fetch("/api/listings", {
    method: "POST",
    headers: authHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({ form: formData, id: listingId, status, photos }),
  });
  const data = await parseJson(response);
  const saved = data.listing;
  if (saved?.id) setStoredListingId(saved.id);
  return saved;
}

export async function saveListingsBatchToDb(forms, { status = "feladott" } = {}) {
  const response = await fetch("/api/listings/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ forms, status }),
  });
  return parseJson(response);
}

export async function deleteAllListingsFromDb() {
  const response = await fetch("/api/listings/all", {
    method: "DELETE",
    headers: authHeaders(),
    credentials: "same-origin",
  });
  return parseJson(response);
}

export async function fetchMyListings({ limit = 200 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(`/api/listings/mine?${params}`, {
    headers: authHeaders(),
    credentials: "same-origin",
  });
  const data = await parseJson(response);
  return data.listings ?? [];
}

export async function recordListingView(id, source = "web") {
  const response = await fetch(`/api/listings/${id}/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
  return parseJson(response);
}

export async function updateListingStatusInDb(id, status) {
  const response = await fetch(`/api/listings/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({ status }),
  });
  const data = await parseJson(response);
  return data.listing ?? null;
}

/** Csak megadott mezők — nem írja felül a teljes hirdetést. */
export async function patchListingFieldsInDb(id, fields) {
  const response = await fetch(`/api/listings/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({ fields }),
  });
  const data = await parseJson(response);
  return data.listing ?? null;
}

export async function saveListingPhotosOrder(id, items) {
  const response = await fetch(`/api/listings/${id}/photos`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({ items }),
  });
  const data = await parseJson(response);
  return data.listing ?? null;
}

export async function clearListingPhotosFromDb(id) {
  const response = await fetch(`/api/listings/${id}/photos`, {
    method: "DELETE",
    headers: authHeaders(),
    credentials: "same-origin",
  });
  return parseJson(response);
}

export async function deleteListingFromDb(id) {
  const response = await fetch(`/api/listings/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
    credentials: "same-origin",
  });
  return parseJson(response);
}
