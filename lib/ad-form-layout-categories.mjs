import { FORM_FIELD_CATALOG } from "./form-field-catalog.mjs";

/** Admin + feladás: minden hirdetéskategória saját mezőelrendezéssel. */
export const AD_FORM_LAYOUT_CATEGORIES = [
  { id: "szemelyauto", label: "Személyautó", vertical: "auto", subtype: "szemelyauto" },
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

const INGATLAN_KEYS = new Set([
  "hirdetes_cime",
  "hirdetes_vertical",
  "hirdetes_alkategoria",
  "ingatlan_tipus",
  "ingatlan_kategoria",
  "vetelar",
  "akcios_ar",
  "vetelar_eur",
  "leiras",
  "megye",
  "telepules",
  "iranyitoszam",
  "megtekintesi_cim",
  "email",
  "email_megjelenik",
  "telefon1_orszag",
  "telefon1_korzet",
  "telefon1_szam",
  "telefon2_orszag",
  "telefon2_korzet",
  "telefon2_szam",
  "fotok",
  "owner_user_id",
  "views_web",
  "views_app",
]);

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
  return `ad_form_layout_${normalizeLayoutCategory(category)}`;
}

function vehicleCatalog({ includeKisteher = false } = {}) {
  return FORM_FIELD_CATALOG.filter((field) => {
    if (KISTEHER_ONLY_KEYS.has(field.field_key)) return includeKisteher;
    return true;
  });
}

const INGATLAN_EXTRA = [
  { field_key: "ingatlan_tipus", label: "Ingatlan típus", step: 1 },
  { field_key: "ingatlan_kategoria", label: "Ingatlan kategória", step: 1 },
];

function ingatlanCatalog() {
  const fromMain = FORM_FIELD_CATALOG.filter((field) => INGATLAN_KEYS.has(field.field_key));
  const keys = new Set(fromMain.map((f) => f.field_key));
  const extras = INGATLAN_EXTRA.filter((f) => !keys.has(f.field_key));
  return [...fromMain, ...extras];
}

/** Mezőlista az adott kategória layout szerkesztőjéhez / normalizálásához. */
export function catalogForLayoutCategory(category) {
  const id = normalizeLayoutCategory(category);
  if (id === "kisteher") return vehicleCatalog({ includeKisteher: true });
  if (id === "ingatlan") return ingatlanCatalog();
  return vehicleCatalog({ includeKisteher: false });
}

export function listLayoutCategories() {
  return AD_FORM_LAYOUT_CATEGORIES.map((c) => ({ ...c }));
}
