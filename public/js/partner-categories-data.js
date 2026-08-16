/** Kliens oldali kategória lista (mobil PartnerCategoryCatalog). */
export const PARTNER_CATEGORIES = [
  { id: "atiras_ugyintezes", label: "Átírás ügyintézés", image: "ajanlas-atiras" },
  { id: "eredetvizsga", label: "Eredetvizsga", image: "ajanlas-eredet" },
  { id: "muszakivizsga", label: "Műszaki vizsga", image: "ajanlas-muszaki" },
  { id: "autoatvizsgalas", label: "Autoátvizsgálás", image: "ajanlas-atvizsgalas" },
  { id: "autoszerelo", label: "Autószerelő", image: "ajanlas-szerelo" },
  { id: "gumiszerelo", label: "Gumiszerelő", image: "ajanlas-gumi" },
  { id: "lakatos", label: "Lakatos", image: "ajanlas-lakatos" },
  { id: "klimaszerelo", label: "Klímaszerelő", image: "ajanlas-klima" },
  { id: "autokozmetika", label: "Autókozmetika", image: "ajanlas-kozmetika" },
  { id: "autovillamossag", label: "Autóvillamosság", image: "ajanlas-villamos" },
];

export function partnerCategoryImageUrl(category) {
  const image =
    (typeof category === "string"
      ? PARTNER_CATEGORIES.find((c) => c.id === category)?.image
      : category?.image) ?? "ajanlas-szerelo";
  return `/images/ajanlas/${image}.png`;
}
