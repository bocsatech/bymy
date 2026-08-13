/** Fizetős partner ajánló kategóriák (fix lista). */

export const PARTNER_CATEGORIES = [
  { id: "atiras_ugyintezes", label: "Átírás ügyintézés", sort_order: 1 },
  { id: "eredetvizsga", label: "Eredetvizsga", sort_order: 2 },
  { id: "muszakivizsga", label: "Műszaki vizsga", sort_order: 3 },
  { id: "autoszerelo", label: "Autószerelő", sort_order: 4 },
  { id: "gumiszerelo", label: "Gumiszerelő", sort_order: 5 },
  { id: "lakatos", label: "Lakatos", sort_order: 6 },
  { id: "klimaszerelo", label: "Klímaszerelő", sort_order: 7 },
  { id: "autokozmetika", label: "Autókozmetika", sort_order: 8 },
  { id: "autovillamossag", label: "Autóvillamosság", sort_order: 9 },
];

export const PARTNER_CATEGORY_IDS = new Set(PARTNER_CATEGORIES.map((c) => c.id));

export function getCategoryLabel(categoryId) {
  return PARTNER_CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;
}
