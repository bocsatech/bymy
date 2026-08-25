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

export async function fetchListings({ limit = 50, status = null, vertical = null } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  if (vertical) params.set("vertical", String(vertical));
  const response = await fetch(`/api/listings?${params}`);
  const data = await parseJson(response);
  return data.listings ?? [];
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

/** Több importált űrlap egyszerre — duplikátumokat a szerver átugorja. */
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
