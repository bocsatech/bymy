const KEY_PREFIX = "bymy.privateStreet.";

export function isNativeApp() {
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

function storageKey(userKey) {
  return `${KEY_PREFIX}${String(userKey || "").trim().toLowerCase()}`;
}

async function prefsGet(key) {
  const prefs = window.Capacitor?.Plugins?.Preferences;
  if (!prefs?.get) return null;
  const result = await prefs.get({ key });
  return result?.value ?? null;
}

async function prefsSet(key, value) {
  const prefs = window.Capacitor?.Plugins?.Preferences;
  if (!prefs) return false;
  if (value) {
    if (!prefs.set) return false;
    await prefs.set({ key, value });
  } else if (prefs.remove) {
    await prefs.remove({ key });
  } else if (prefs.set) {
    await prefs.set({ key, value: "" });
  }
  return true;
}

export async function getPrivateStreet(userKey) {
  const key = storageKey(userKey);
  if (!userKey || !isNativeApp()) return "";
  try {
    const fromPrefs = await prefsGet(key);
    if (fromPrefs != null) return String(fromPrefs).trim();
  } catch {
    /* fallback localStorage */
  }
  try {
    return String(localStorage.getItem(key) || "").trim();
  } catch {
    return "";
  }
}

export async function setPrivateStreet(userKey, street) {
  if (!userKey || !isNativeApp()) return false;
  const key = storageKey(userKey);
  const value = String(street || "").trim();
  try {
    if (await prefsSet(key, value)) return true;
  } catch {
    /* fallback localStorage */
  }
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
