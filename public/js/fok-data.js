/** Fiókom (Mein mobile.de mintára) — helyi adatok parkóóhoz, keresésekhez, üzenetekhez. */

const PARK_KEY = "bymy-parkplatz";
const SEARCH_KEY = "bymy-saved-searches";
const MSG_KEY = "bymy-messages";

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

function listForEmail(key, email) {
  if (!email) return [];
  const map = readMap(key);
  return Array.isArray(map[email]) ? map[email] : [];
}

function saveForEmail(key, email, list) {
  if (!email) return;
  const map = readMap(key);
  map[email] = list;
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
      savedAt: Date.now(),
    },
    ...list,
  ];
  saveForEmail(PARK_KEY, email, next);
  return next;
}

export function removeParkplatzItem(email, id) {
  const next = getParkplatz(email).filter((row) => String(row.id) !== String(id));
  saveForEmail(PARK_KEY, email, next);
  return next;
}

export function updateParkplatzNote(email, id, note) {
  const next = getParkplatz(email).map((row) =>
    String(row.id) === String(id) ? { ...row, note: String(note ?? "") } : row
  );
  saveForEmail(PARK_KEY, email, next);
  return next;
}

export function getSavedSearches(email) {
  return listForEmail(SEARCH_KEY, email);
}

export function addSavedSearch(email, item) {
  const list = getSavedSearches(email);
  const next = [
    {
      id: String(item.id ?? `s-${Date.now()}`),
      name: item.name || "Mentett keresés",
      query: item.query || "",
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

export function getMessages(email) {
  return listForEmail(MSG_KEY, email);
}

export function ensureDemoMessages(email) {
  const existing = getMessages(email);
  if (existing.length) return existing;
  const demo = [
    {
      id: "m1",
      from: "Érdeklődő",
      subject: "Érdeklődés a hirdetésed iránt",
      body: "Szia! Még eladó a jármű? Mikor lehet megnézni?",
      read: false,
      at: Date.now() - 3600_000,
    },
    {
      id: "m2",
      from: "Bymy",
      subject: "Üdvözlünk a fiókodban",
      body: "Itt kezelheted a parkolót, mentett kereséseket és a fiókadatokat.",
      read: true,
      at: Date.now() - 86_400_000,
    },
  ];
  saveForEmail(MSG_KEY, email, demo);
  return demo;
}

export function markMessageRead(email, id) {
  const next = getMessages(email).map((row) =>
    String(row.id) === String(id) ? { ...row, read: true } : row
  );
  saveForEmail(MSG_KEY, email, next);
  return next;
}

export function deleteMessage(email, id) {
  const next = getMessages(email).filter((row) => String(row.id) !== String(id));
  saveForEmail(MSG_KEY, email, next);
  return next;
}
