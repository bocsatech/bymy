/** Magyar megyenevek — ne jelenjenek meg településként a kártyán. */
export const HU_COUNTY_NAMES = [
  "Budapest",
  "Pest",
  "Fejér",
  "Győr-Moson-Sopron",
  "Komárom-Esztergom",
  "Veszprém",
  "Baranya",
  "Bács-Kiskun",
  "Békés",
  "Borsod-Abaúj-Zemplén",
  "Csongrád-Csanád",
  "Hajdú-Bihar",
  "Heves",
  "Jász-Nagykun-Szolnok",
  "Nógrád",
  "Somogy",
  "Szabolcs-Szatmár-Bereg",
  "Tolna",
  "Vas",
  "Zala",
];

function normalizeCountyKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

const COUNTY_KEYS = new Set(HU_COUNTY_NAMES.map(normalizeCountyKey));

export function isHungaryCountyName(value) {
  const key = normalizeCountyKey(value);
  return Boolean(key) && COUNTY_KEYS.has(key);
}

/** Kártya / település mező: megyenév tiltott, Budapest viszont város. */
export function isHungaryCountyOnlyLabel(value) {
  const key = normalizeCountyKey(value);
  if (!key || key === "budapest") return false;
  return COUNTY_KEYS.has(key);
}
