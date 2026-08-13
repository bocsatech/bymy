import { cleanText, normalizeKey, pickValue } from "./parse-listing.mjs";

const KM_LABEL_KEYS = [
  "futásteljesítmény",
  "futasteljesitmeny",
  "kilométeróra",
  "kilometerora",
  "km óra állás",
  "km ora allas",
  "km. óra állás",
  "km. ora allas",
  "km óra állása",
  "km ora allasa",
  "km. óra állása",
  "km óra",
  "km",
];

export function kmDigitsFromValue(value) {
  const text = cleanText(value);
  if (!text) return "";

  if (/^0\s*[- ]?km/i.test(text) || /\b0\s*km[- ]?es\b/i.test(text) || /\b0\s*[- ]?kmes\b/i.test(text)) {
    return "0";
  }

  const ezer = text.match(/(\d[\d\s.]*)\s*(?:ezer|e\s*zer)\s*km\b/i);
  if (ezer) {
    const base = Number.parseInt(ezer[1].replace(/\s|\./g, ""), 10);
    if (Number.isFinite(base)) return String(base * 1000);
  }

  const labeled = text.match(/(\d[\d\s.]{0,12})\s*km\b/i);
  if (labeled) {
    return labeled[1].replace(/\s|\./g, "");
  }

  const plain = text.match(/^(\d[\d\s.]{0,12})$/);
  if (plain) return plain[1].replace(/\s|\./g, "");

  return "";
}

export function extractKmCandidatesFromText(text) {
  const source = cleanText(text);
  if (!source) return [];

  const found = [];
  for (const match of source.matchAll(/(\d[\d\s.]{0,12})\s*km\b/gi)) {
    const digits = match[1].replace(/\s|\./g, "");
    const value = Number.parseInt(digits, 10);
    if (Number.isFinite(value) && value >= 0 && value <= 2_000_000) {
      found.push(value);
    }
  }

  if (/\b0\s*[- ]?kmes\b/i.test(source) || /\b0\s*km[- ]?es\b/i.test(source)) {
    found.push(0);
  }

  return found;
}

export function chooseOdometerKm(candidates) {
  if (!candidates.length) return "";
  const unique = [...new Set(candidates)];
  const over100 = unique.filter((n) => n >= 100);
  if (over100.length) return String(Math.max(...over100));
  return String(Math.max(...unique));
}

export function extractOdometerKm({ maps = [], texts = [] } = {}) {
  for (const map of maps) {
    if (!map || typeof map !== "object") continue;
    const labeled = pickValue(map, KM_LABEL_KEYS);
    const digits = kmDigitsFromValue(labeled);
    if (digits !== "") return digits;
  }

  const allCandidates = [];
  for (const text of texts) {
    allCandidates.push(...extractKmCandidatesFromText(text));
  }

  return chooseOdometerKm(allCandidates);
}

export function formatKmDisplay(digits) {
  if (digits === "" || digits == null) return null;
  return `${Number(digits).toLocaleString("hu-HU")} km`;
}
