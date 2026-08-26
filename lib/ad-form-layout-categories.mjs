import { FORM_FIELD_CATALOG } from "./form-field-catalog.mjs";
import { ingatlanFormFieldCatalog } from "./ingatlan-fields.mjs";

/** Admin + feladás: minden hirdetéskategória saját mezőelrendezéssel. */
export const AD_FORM_LAYOUT_CATEGORIES = [
  { id: "szemelyauto", label: "Személyautó", vertical: "auto", subtype: "szemelyauto" },
  { id: "szemelyauto-search", label: "Személyautó kereső", vertical: "auto", subtype: "szemelyauto", intent: "search" },
  { id: "teherauto-search", label: "Teherautó kereső", vertical: "teher", subtype: "teherauto", intent: "search" },
  { id: "leasing", label: "Leasing hirdetés", vertical: "auto", subtype: "leasing" },
  { id: "berauto", label: "Bérautó hirdetés", vertical: "auto", subtype: "berauto" },
  { id: "lakokocsi", label: "Bérelhető lakókocsi", vertical: "auto", subtype: "lakokocsi" },
  { id: "kisteher", label: "Kisteher 3,5 t-ig", vertical: "teher", subtype: "kisteher" },
  { id: "teherauto", label: "Teherautó 3,5 t-tól", vertical: "teher", subtype: "teherauto" },
  { id: "ingatlan", label: "Ingatlan", vertical: "ingatlan", subtype: "ingatlan" },
];

const KISTEHER_ONLY_KEYS = new Set([
  "nyomatek_nm",
  "rakter_terfogat",
  "rakter_hossz",
  "rakter_szelesseg",
  "rakter_magassag",
]);

const INGATLAN_KEYS = new Set(ingatlanFormFieldCatalog().map((f) => f.field_key));

const BY_ID = new Map(AD_FORM_LAYOUT_CATEGORIES.map((c) => [c.id, c]));

export function normalizeLayoutCategory(value) {
  const id = String(value ?? "")
    .trim()
    .toLowerCase();
  if (BY_ID.has(id)) return id;
  if (id === "auto" || id === "szemely") return "szemelyauto";
  return "szemelyauto";
}

export function layoutCategoryFromForm(formData = {}) {
  const subtype = String(formData.hirdetes_alkategoria ?? formData.jarmu_kategoria ?? "")
    .trim()
    .toLowerCase();
  if (BY_ID.has(subtype)) return subtype;
  const vertical = String(formData.hirdetes_vertical ?? "")
    .trim()
    .toLowerCase();
  if (vertical === "ingatlan") return "ingatlan";
  if (vertical === "teher") return "teherauto";
  return "szemelyauto";
}

export function layoutKvKey(category) {
  const id = normalizeLayoutCategory(category);
  if (id === "szemelyauto-search") return "ad_search_layout_szemelyauto";
  if (id === "teherauto-search") return "ad_search_layout_teherauto";
  return `ad_form_layout_${id}`;
}

export function isSearchLayoutCategory(category) {
  const id = normalizeLayoutCategory(category);
  return id === "szemelyauto-search" || id === "teherauto-search";
}

/** Kereső layout alapja: melyik feladási layout mezőiből induljon. */
export function searchPostingBaseCategory(category) {
  const id = normalizeLayoutCategory(category);
  if (id === "teherauto-search") return "kisteher";
  return "szemelyauto";
}

function vehicleCatalog({ includeKisteher = false } = {}) {
  return FORM_FIELD_CATALOG.filter((field) => {
    if (KISTEHER_ONLY_KEYS.has(field.field_key)) return includeKisteher;
    return true;
  });
}

function ingatlanCatalog() {
  const byKey = new Map();
  for (const field of FORM_FIELD_CATALOG) {
    if (INGATLAN_KEYS.has(field.field_key)) byKey.set(field.field_key, field);
  }
  for (const field of ingatlanFormFieldCatalog()) {
    if (!byKey.has(field.field_key)) byKey.set(field.field_key, field);
  }
  return [...byKey.values()];
}

/** Mezőlista az adott kategória layout szerkesztőjéhez / normalizálásához. */
export function catalogForLayoutCategory(category) {
  const id = normalizeLayoutCategory(category);
  if (id === "teherauto-search" || id === "kisteher") {
    return vehicleCatalog({ includeKisteher: true });
  }
  if (id === "szemelyauto-search") {
    return vehicleCatalog({ includeKisteher: false });
  }
  if (id === "ingatlan") return ingatlanCatalog();
  return vehicleCatalog({ includeKisteher: false });
}

export function listLayoutCategories() {
  return AD_FORM_LAYOUT_CATEGORIES.map((c) => ({ ...c }));
}
