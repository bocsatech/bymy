const STREET_KEY_PREFIX = "bymy.privateStreet.";
const IDENTITY_KEY_PREFIX = "bymy.deviceContractIdentity.";

export function isNativeApp() {
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export function emptyDeviceIdentity() {
  return {
    fullName: "",
    birthName: "",
    birthPlace: "",
    birthDate: "",
    motherName: "",
    idDocType: "",
    idDocNumber: "",
    homeAddress: "",
    citizenship: "",
    companyName: "",
    companySeat: "",
    companyRegistry: "",
    representative: "",
    street: "",
  };
}

function identityStorageKey(userKey) {
  return `${IDENTITY_KEY_PREFIX}${String(userKey || "").trim().toLowerCase()}`;
}

function legacyStreetKey(userKey) {
  return `${STREET_KEY_PREFIX}${String(userKey || "").trim().toLowerCase()}`;
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

async function readRaw(key) {
  try {
    const fromPrefs = await prefsGet(key);
    if (fromPrefs != null) return String(fromPrefs);
  } catch {
    /* fallback */
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeRaw(key, value) {
  const text = value == null ? "" : String(value);
  try {
    if (await prefsSet(key, text)) return true;
  } catch {
    /* fallback */
  }
  try {
    if (text) localStorage.setItem(key, text);
    else localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function normalizeIdentity(raw = {}) {
  const base = emptyDeviceIdentity();
  for (const key of Object.keys(base)) {
    base[key] = String(raw?.[key] ?? "").trim();
  }
  if (!base.homeAddress && base.street) base.homeAddress = base.street;
  if (!base.street && base.homeAddress) base.street = base.homeAddress;
  return base;
}

export async function getDeviceIdentity(userKey) {
  if (!userKey || !isNativeApp()) return emptyDeviceIdentity();
  const key = identityStorageKey(userKey);
  try {
    const raw = await readRaw(key);
    if (raw) {
      try {
        return normalizeIdentity(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  const legacy = String((await readRaw(legacyStreetKey(userKey))) || "").trim();
  if (!legacy) return emptyDeviceIdentity();
  return normalizeIdentity({ street: legacy, homeAddress: legacy });
}

export async function setDeviceIdentity(userKey, identity) {
  if (!userKey || !isNativeApp()) return false;
  const next = normalizeIdentity(identity);
  const ok = await writeRaw(identityStorageKey(userKey), JSON.stringify(next));
  if (ok) {
    await writeRaw(legacyStreetKey(userKey), next.homeAddress || next.street || "");
  }
  return ok;
}

export async function getPrivateStreet(userKey) {
  const identity = await getDeviceIdentity(userKey);
  return identity.homeAddress || identity.street || "";
}

export async function setPrivateStreet(userKey, street) {
  const current = await getDeviceIdentity(userKey);
  current.street = String(street || "").trim();
  current.homeAddress = current.street || current.homeAddress;
  return setDeviceIdentity(userKey, current);
}

export function applyDeviceIdentityToPerson(person, identity, { business = false } = {}) {
  const out = { ...(person || {}) };
  const local = normalizeIdentity(identity);
  if (business) {
    if (local.companyName) out.companyName = local.companyName;
    if (local.companySeat) {
      out.street = local.companySeat;
      out.homeAddress = local.companySeat;
    }
    if (local.companyRegistry) out.companyRegistry = local.companyRegistry;
    if (local.representative) {
      out.representative = local.representative;
      if (!out.fullName) out.fullName = local.representative;
    }
    return out;
  }
  if (local.fullName) out.fullName = local.fullName;
  if (local.birthName) out.birthName = local.birthName;
  if (local.birthPlace) out.birthPlace = local.birthPlace;
  if (local.birthDate) out.birthDate = local.birthDate;
  if (local.motherName) out.motherName = local.motherName;
  if (local.idDocType) out.idDocType = local.idDocType;
  if (local.idDocNumber) {
    out.idDocNumber = local.idDocNumber;
    out.idCardNumber = local.idDocNumber;
  }
  if (local.homeAddress || local.street) {
    out.street = local.homeAddress || local.street;
    out.homeAddress = local.homeAddress || local.street;
  }
  if (local.citizenship) out.citizenship = local.citizenship;
  return out;
}

export const DEVICE_IDENTITY_FORM_KEYS = [
  "local_fullName",
  "local_birthName",
  "local_birthPlace",
  "local_birthDate",
  "local_motherName",
  "local_idDocType",
  "local_idDocNumber",
  "local_homeAddress",
  "local_citizenship",
  "local_companyName",
  "local_companySeat",
  "local_companyRegistry",
  "local_representative",
];

export function identityFromFormData(data = {}) {
  return normalizeIdentity({
    fullName: data.local_fullName,
    birthName: data.local_birthName,
    birthPlace: data.local_birthPlace,
    birthDate: data.local_birthDate,
    motherName: data.local_motherName,
    idDocType: data.local_idDocType,
    idDocNumber: data.local_idDocNumber,
    homeAddress: data.local_homeAddress,
    citizenship: data.local_citizenship,
    companyName: data.local_companyName,
    companySeat: data.local_companySeat,
    companyRegistry: data.local_companyRegistry,
    representative: data.local_representative,
    street: data.local_homeAddress || data.street,
  });
}

export function stripDeviceIdentityFormFields(data = {}) {
  const next = { ...data };
  for (const key of DEVICE_IDENTITY_FORM_KEYS) delete next[key];
  return next;
}
