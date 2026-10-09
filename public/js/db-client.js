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
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (response.status === 413) {
      throw new Error("A képek együtt túl nagyok. Próbáld kevesebb képpel.");
    }
    if (response.status === 502 || response.status === 504) {
      throw new Error("A szerver nem bírta a képek mentését (időtúllépés). Próbáld újra — a képek most egyesével mennek fel.");
    }
    throw new Error(
      response.ok
        ? "Érvénytelen válasz a szervertől."
        : `Szerver hiba (${response.status}).`
    );
  }
  if (!response.ok) {
    if (response.status === 404 && data?.error === "Ismeretlen API.") {
      throw new Error("Régi Bymy szerver — futtasd: bymy/mac/frissites.command, majd indítsd újra.");
    }
    throw new Error(data?.error || "Szerver hiba");
  }
  return data ?? {};
}

const LISTING_UPLOAD_CONCURRENCY = 4;

async function mapPool(items, concurrency, worker, onProgress) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const results = new Array(list.length);
  let cursor = 0;
  let done = 0;
  async function run() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(list[index], index);
      done += 1;
      onProgress?.(done, list.length);
    }
  }
  const n = Math.min(Math.max(1, concurrency), list.length);
  await Promise.all(Array.from({ length: n }, () => run()));
  return results;
}

/** Egy listing kép feltöltése /api/uploads-ra (kis body), URL-t ad vissza. */
export async function uploadListingPhotoDataUrl(dataUrl, listingId) {
  const response = await fetch("/api/uploads", {
    method: "POST",
    headers: authHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({
      bucket: "listing-images",
      kind: "listing",
      entityType: "listing",
      entityId: listingId,
      folder: String(listingId),
      fileName: `listing-${listingId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`,
      dataUrl,
      preoptimized: true,
    }),
  });
  const data = await parseJson(response);
  const url = String(data.url || data.publicUrl || "").trim();
  if (!url) throw new Error(data.error || "A kép feltöltése sikertelen.");
  return url;
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

export async function fetchListing(id, { view, bypassCache = false } = {}) {
  const key = String(id ?? "").trim();
  if (!bypassCache && view === "detail" && key) {
    try {
      const { takePrefetchedListing } = await import("./listing-prefetch.js?v=67ac871172");
      const warm = takePrefetchedListing(key);
      if (warm?.detail) return warm;
    } catch {
    }
  }
  const params = view ? `?view=${encodeURIComponent(view)}` : "";
  const response = await fetch(`/api/listings/${id}${params}`, {
    credentials: "same-origin",
    headers: authHeaders(),
  });
  const data = await parseJson(response);
  const listing = data.listing ?? null;
  if (listing && view === "detail" && key) {
    try {
      const { storePrefetchedListing } = await import("./listing-prefetch.js?v=67ac871172");
      storePrefetchedListing(key, listing);
    } catch {
    }
  }
  return listing;
}

export async function fetchRelatedListings(listingId, { limit = 24, includeSelf = false } = {}) {
  const page = await fetchRelatedListingsPage(listingId, { limit, includeSelf, tile: false });
  return page.listings;
}

export async function fetchRelatedListingsPage(
  listingId,
  { limit = 24, offset = 0, includeSelf = false, tile = true } = {}
) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(Math.max(0, Number(offset) || 0)),
  });
  if (includeSelf) params.set("includeSelf", "1");
  if (tile) params.set("tile", "1");
  const response = await fetch(`/api/listings/${listingId}/related?${params}`, {
    credentials: "same-origin",
  });
  const data = await parseJson(response);
  const listings = data.listings ?? [];
  return {
    listings,
    total: data.total != null ? Number(data.total) : listings.length,
    offset: data.offset != null ? Number(data.offset) : Number(offset) || 0,
    limit: data.limit != null ? Number(data.limit) : Number(limit) || listings.length,
    hasMore: Boolean(data.hasMore ?? listings.length >= limit),
  };
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
  const contact = data.contact ?? null;
  if (contact && data.rating && typeof data.rating === "object") {
    contact.rating = data.rating;
  }
  return contact;
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

async function forgetNavCounts() {
  try {
    sessionStorage.removeItem("bymy.navCounts.v1");
    sessionStorage.removeItem("bymy.navCounts.v2");
  } catch {
  }
}

export async function deleteAllListingsFromDb() {
  const response = await fetch("/api/listings/all", {
    method: "DELETE",
    headers: authHeaders(),
    credentials: "same-origin",
  });
  const data = await parseJson(response);
  await forgetNavCounts();
  return data;
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

/**
 * Új (data URL) képeket egyesével feltölti, majd csak URL-listát ment.
 * Így elkerüljük a nagy JSON POST → Cloudflare 502 hibát.
 * @param {{ onProgress?: (p: { phase: string, done: number, total: number }) => void }} [options]
 */
export async function saveListingPhotosOrder(id, items, options = {}) {
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  const list = Array.isArray(items) ? items : [];
  const prepared = new Array(list.length);
  const pending = [];

  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    const existing = String(item?.url ?? "").trim();
    if (existing) {
      prepared[i] = { url: existing };
      continue;
    }
    const data = String(item?.data ?? "").trim();
    if (!data) continue;
    pending.push({ index: i, data });
  }

  const needUpload = pending.length;
  onProgress?.({ phase: "upload", done: 0, total: needUpload });
  if (needUpload) {
    await mapPool(
      pending,
      LISTING_UPLOAD_CONCURRENCY,
      async (job) => {
        const url = await uploadListingPhotoDataUrl(job.data, id);
        prepared[job.index] = { url };
        return url;
      },
      (done, total) => onProgress?.({ phase: "upload", done, total })
    );
  }

  const urlsOnly = prepared.filter(Boolean);
  if (!urlsOnly.length) {
    throw new Error("Legalább egy kép kell.");
  }

  onProgress?.({ phase: "save", done: needUpload, total: Math.max(needUpload, 1) });
  const response = await fetch(`/api/listings/${id}/photos`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({ items: urlsOnly }),
  });
  const data = await parseJson(response);
  onProgress?.({ phase: "done", done: needUpload, total: Math.max(needUpload, 1) });
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

export async function fetchExistingListingIds(ids = []) {
  const unique = [...new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean))].slice(0, 200);
  if (!unique.length) return [];
  const params = new URLSearchParams({ ids: unique.join(",") });
  const response = await fetch(`/api/listings/exists?${params}`, {
    credentials: "same-origin",
  });
  const data = await parseJson(response);
  return Array.isArray(data.ids) ? data.ids : [];
}

export async function deleteListingFromDb(id) {
  const response = await fetch(`/api/listings/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
    credentials: "same-origin",
  });
  const data = await parseJson(response);
  await forgetNavCounts();
  try {
    const { removeParkplatzIdEverywhere } = await import("./fok-data.js?v=289f64e75c");
    removeParkplatzIdEverywhere(id);
  } catch {
  }
  return data;
}
