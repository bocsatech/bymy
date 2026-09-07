/** Kliens oldali kategória lista (mobil PartnerCategoryCatalog). */

export const PARTNER_VERTICALS = Object.freeze(["auto", "ingatlan"]);

export const PARTNER_CATEGORIES = [
  // Autó
  { id: "atiras_ugyintezes", label: "Átírás ügyintézés", image: "ajanlas-atiras", vertical: "auto" },
  { id: "eredetvizsga", label: "Eredetvizsga", image: "ajanlas-eredet", vertical: "auto" },
  { id: "muszakivizsga", label: "Műszaki vizsga", image: "ajanlas-muszaki", vertical: "auto" },
  { id: "autoatvizsgalas", label: "Autoátvizsgálás", image: "ajanlas-atvizsgalas", vertical: "auto" },
  { id: "autoszerelo", label: "Autószerelő", image: "ajanlas-szerelo", vertical: "auto" },
  { id: "gumiszerelo", label: "Gumiszerelő", image: "ajanlas-gumi", vertical: "auto" },
  { id: "lakatos", label: "Lakatos", image: "ajanlas-lakatos", vertical: "auto" },
  { id: "klimaszerelo", label: "Klímaszerelő", image: "ajanlas-klima", vertical: "auto" },
  { id: "autokozmetika", label: "Autókozmetika", image: "ajanlas-kozmetika", vertical: "auto" },
  { id: "autovillamossag", label: "Autóvillamosság", image: "ajanlas-villamos", vertical: "auto" },

  // Ingatlan
  { id: "ertekesites", label: "Értékesítés", image: "ajanlas-ertekesites", vertical: "ingatlan" },
  { id: "ertekbecsles", label: "Értékbecslés", image: "ajanlas-ertekbecsles", vertical: "ingatlan" },
  { id: "allapotfelmeres", label: "Állapotfelmérés", image: "ajanlas-allapotfelmeres", vertical: "ingatlan" },
  {
    id: "energetikai_tanusitvany",
    label: "Energetikai tanúsítvány",
    image: "ajanlas-energetikai",
    vertical: "ingatlan",
  },
  {
    id: "szerkezeti_vizsgalat",
    label: "Szerkezeti vizsgálat",
    image: "ajanlas-szerkezeti",
    vertical: "ingatlan",
  },
  { id: "hitelugyintezes", label: "Hitelügyintézés", image: "ajanlas-hitel", vertical: "ingatlan" },
  { id: "foldmeres", label: "Földmérés", image: "ajanlas-foldmeres", vertical: "ingatlan" },
  { id: "tervezok", label: "Tervezők", image: "ajanlas-tervezok", vertical: "ingatlan" },
  { id: "lakberendezo", label: "Lakberendező", image: "ajanlas-lakberendezo", vertical: "ingatlan" },
  { id: "kertepito", label: "Kertépítő", image: "ajanlas-kertepito", vertical: "ingatlan" },
  { id: "ugyvedek", label: "Ügyvédek", image: "ajanlas-ugyvedek", vertical: "ingatlan" },
  { id: "kozjegyzok", label: "Közjegyzők", image: "ajanlas-kozjegyzok", vertical: "ingatlan" },
];

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

export function partnerCategoryImageUrl(category) {
  const image =
    (typeof category === "string"
      ? PARTNER_CATEGORIES.find((c) => c.id === category)?.image
      : category?.image) ?? "ajanlas-szerelo";
  return `/images/ajanlas/${image}.png`;
}
