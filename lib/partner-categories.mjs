
export const PARTNER_VERTICALS = Object.freeze(["auto", "ingatlan"]);

export const PARTNER_CATEGORIES = [
  { id: "atiras_ugyintezes", label: "Átírás ügyintézés", sort_order: 1, vertical: "auto" },
  { id: "eredetvizsga", label: "Eredetvizsga", sort_order: 2, vertical: "auto" },
  { id: "muszakivizsga", label: "Műszaki vizsga", sort_order: 3, vertical: "auto" },
  { id: "autoatvizsgalas", label: "Autoátvizsgálás", sort_order: 4, vertical: "auto" },
  { id: "autoszerelo", label: "Autószerelő", sort_order: 5, vertical: "auto" },
  { id: "gumiszerelo", label: "Gumiszerelő", sort_order: 6, vertical: "auto" },
  { id: "lakatos", label: "Lakatos", sort_order: 7, vertical: "auto" },
  { id: "klimaszerelo", label: "Klímaszerelő", sort_order: 8, vertical: "auto" },
  { id: "autokozmetika", label: "Autókozmetika", sort_order: 9, vertical: "auto" },
  { id: "autovillamossag", label: "Autóvillamosság", sort_order: 10, vertical: "auto" },

  { id: "ertekesites", label: "Értékesítés", sort_order: 20, vertical: "ingatlan" },
  { id: "ertekbecsles", label: "Értékbecslés", sort_order: 21, vertical: "ingatlan" },
  { id: "energetikai_tanusitvany", label: "Energetikai tanúsítvány", sort_order: 23, vertical: "ingatlan" },
  { id: "szerkezeti_vizsgalat", label: "Szerkezeti vizsgálat", sort_order: 24, vertical: "ingatlan" },
  { id: "hitelugyintezes", label: "Hitelügyintézés", sort_order: 25, vertical: "ingatlan" },
  { id: "foldmeres", label: "Földmérés", sort_order: 26, vertical: "ingatlan" },
  { id: "tervezok", label: "Tervezők", sort_order: 27, vertical: "ingatlan" },
  { id: "lakberendezo", label: "Lakberendező", sort_order: 28, vertical: "ingatlan" },
  { id: "kertepito", label: "Kertépítő", sort_order: 29, vertical: "ingatlan" },
  { id: "ugyvedek", label: "Ügyvédek", sort_order: 30, vertical: "ingatlan" },
  { id: "kozjegyzok", label: "Közjegyzők", sort_order: 31, vertical: "ingatlan" },
];

export const PARTNER_CATEGORY_IDS = new Set(PARTNER_CATEGORIES.map((c) => c.id));

export function normalizePartnerVertical(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (v === "ingatlan" || v === "immo" || v === "realestate") return "ingatlan";
  if (v === "auto" || v === "car" || v === "jarmu") return "auto";
  return null;
}

export function categoriesForVertical(verticalInput) {
  const vertical = normalizePartnerVertical(verticalInput) ?? "auto";
  return PARTNER_CATEGORIES.filter((c) => c.vertical === vertical);
}

export function getCategoryLabel(categoryId) {
  return PARTNER_CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;
}
