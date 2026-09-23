const PARK_KEY = "bymy-parkplatz";
const SEARCH_KEY = "bymy-saved-searches";
export const PARKPLATZ_CHANGED = "bymy-parkplatz-changed";

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function readMap(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function writeMap(key, map) {
  localStorage.setItem(key, JSON.stringify(map));
}

function notifyParkplatzChanged() {
  try {
    window.dispatchEvent(new CustomEvent(PARKPLATZ_CHANGED));
  } catch {
  }
}

/** Resolve list for email; merge legacy mixed-case keys into lowercase. */
function listForEmail(key, email) {
  const norm = normalizeEmail(email);
  if (!norm) return [];
  const map = readMap(key);
  const exact = Array.isArray(map[norm]) ? map[norm] : null;
  if (exact) return exact;

  const merged = [];
  const seen = new Set();
  let migrated = false;
  for (const [rawKey, rows] of Object.entries(map)) {
    if (normalizeEmail(rawKey) !== norm || !Array.isArray(rows)) continue;
    migrated = true;
    for (const row of rows) {
      const id = String(row?.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(row);
    }
    if (rawKey !== norm) delete map[rawKey];
  }
  if (migrated) {
    map[norm] = merged;
    writeMap(key, map);
  }
  return merged;
}

function saveForEmail(key, email, list) {
  const norm = normalizeEmail(email);
  if (!norm) return;
  const map = readMap(key);
  for (const rawKey of Object.keys(map)) {
    if (rawKey !== norm && normalizeEmail(rawKey) === norm) delete map[rawKey];
  }
  map[norm] = list;
  writeMap(key, map);
}

export function getParkplatz(email) {
  return listForEmail(PARK_KEY, email);
}

export function addParkplatzItem(email, item) {
  const list = getParkplatz(email);
  const id = String(item.id ?? `${Date.now()}`);
  if (list.some((row) => String(row.id) === id)) return list;
  const next = [
    {
      id,
      title: item.title || "Mentett jármű",
      price: item.price || "",
      note: item.note || "",
      url: item.url || "/listings.html",
      imageUrl: String(item.imageUrl || item.image || "").trim(),
      savedAt: Date.now(),
    },
    ...list,
  ];
  saveForEmail(PARK_KEY, email, next);
  notifyParkplatzChanged();
  return next;
}

export function removeParkplatzItem(email, id) {
  const next = getParkplatz(email).filter((row) => String(row.id) !== String(id));
  saveForEmail(PARK_KEY, email, next);
  notifyParkplatzChanged();
  return next;
}

export function updateParkplatzNote(email, id, note) {
  const next = getParkplatz(email).map((row) =>
    String(row.id) === String(id) ? { ...row, note: String(note ?? "") } : row
  );
  saveForEmail(PARK_KEY, email, next);
  return next;
}

export function patchParkplatzItem(email, id, patch = {}) {
  const next = getParkplatz(email).map((row) =>
    String(row.id) === String(id) ? { ...row, ...patch } : row
  );
  saveForEmail(PARK_KEY, email, next);
  notifyParkplatzChanged();
  return next;
}

export function getSavedSearches(email) {
  return listForEmail(SEARCH_KEY, email);
}

export function addSavedSearch(email, item) {
  const list = getSavedSearches(email);
  const filters =
    item.filters && typeof item.filters === "object" && Object.keys(item.filters).length ? item.filters : null;
  const next = [
    {
      id: String(item.id ?? `s-${Date.now()}`),
      name: item.name || "Mentett keresés",
      query: item.query || "",
      page: item.page || "auto",
      filters,
      href: String(item.href || "").trim(),
      notify: Boolean(item.notify),
      savedAt: Date.now(),
    },
    ...list,
  ];
  saveForEmail(SEARCH_KEY, email, next);
  return next;
}

export function removeSavedSearch(email, id) {
  const next = getSavedSearches(email).filter((row) => String(row.id) !== String(id));
  saveForEmail(SEARCH_KEY, email, next);
  return next;
}

export function toggleSavedSearchNotify(email, id) {
  const next = getSavedSearches(email).map((row) =>
    String(row.id) === String(id) ? { ...row, notify: !row.notify } : row
  );
  saveForEmail(SEARCH_KEY, email, next);
  return next;
}
