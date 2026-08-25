/**
 * Keresés oldal — henger (dobkerék) menüelemek.
 * Alapértelmezés kódban; mentett sorrend/címke/kép level1 kv-ban.
 */

export const SEARCH_CYLINDER_KV_KEY = "search_cylinder_menu";

export const DEFAULT_SEARCH_CYLINDER_ITEMS = [
  {
    id: "szemelyauto",
    label: "Személyautó",
    group: "Autó",
    image: "/images/categories/benzin.png?v=cyl1",
    href: "/auto.html",
    enabled: true,
  },
  {
    id: "leasing",
    label: "Lizingelhető",
    group: "Autó",
    image: "/images/categories/leasing.png?v=cyl1",
    href: "/auto.html?cat=leasing",
    enabled: true,
  },
  {
    id: "berauto",
    label: "Bérelhető",
    group: "Autó",
    image: "/images/categories/berelheto.png?v=cyl1",
    href: "/auto.html?cat=berelheto",
    enabled: true,
  },
  {
    id: "lakokocsi",
    label: "Bérelhető Lakókocsi",
    group: "Autó",
    image: "/images/categories/lakokocsi.png?v=cyl1",
    href: "/auto.html?cat=lakokocsi",
    enabled: true,
  },
  {
    id: "kisteher",
    label: "Kisteherautó 3,5-ig",
    group: "Teherautó",
    image: "/images/categories/kisteher.png?v=cyl1",
    href: "/teherauto.html?kategoria=35-alatt",
    enabled: true,
  },
  {
    id: "teherauto",
    label: "Teherautó 3,5-től",
    group: "Teherautó",
    image: "/images/categories/teherauto.png?v=cyl1",
    href: "/teherauto.html?kategoria=35-felett",
    enabled: true,
  },
  {
    id: "elado",
    label: "Eladó Ingatlanok",
    group: "Ingatlan",
    image: "/images/hub-ingatlan-01-hazak.png?v=cyl1",
    href: "/ingatlan.html?tipus=elado",
    enabled: true,
  },
  {
    id: "kiado",
    label: "Kiadó Ingatlanok",
    group: "Ingatlan",
    image: "/images/hub-ingatlan-02-lakasok.png?v=cyl1",
    href: "/ingatlan.html?tipus=kiado",
    enabled: true,
  },
  {
    id: "airbnb",
    label: "Airbnb Ingatlanok",
    group: "Ingatlan",
    image: "/images/hub-ingatlan-photo.jpg?v=cyl1",
    href: "/ingatlan.html?tipus=airbnb",
    enabled: true,
  },
];

/** Admin képválasztó — meglévő publikus assetek. */
export const SEARCH_CYLINDER_IMAGE_PRESETS = [
  "/images/categories/benzin.png",
  "/images/categories/leasing.png",
  "/images/categories/berelheto.png",
  "/images/categories/lakokocsi.png",
  "/images/categories/kisteher.png",
  "/images/categories/teherauto.png",
  "/images/hub-ingatlan-01-hazak.png",
  "/images/hub-ingatlan-02-lakasok.png",
  "/images/hub-ingatlan-03-hazak-lakasok.png",
  "/images/hub-ingatlan-photo.jpg",
  "/images/hub-auto-motor.png",
  "/images/hub-auto-photo.jpg",
];

const ALLOWED_IDS = new Set(DEFAULT_SEARCH_CYLINDER_ITEMS.map((item) => item.id));
const DEFAULT_BY_ID = new Map(DEFAULT_SEARCH_CYLINDER_ITEMS.map((item) => [item.id, item]));

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function cleanHref(value, fallback) {
  const href = cleanText(value, fallback);
  if (!href) return fallback;
  if (href.startsWith("/") || /^https?:\/\//i.test(href)) return href;
  return fallback;
}

function cleanImage(value, fallback) {
  const image = cleanText(value, fallback);
  if (!image) return fallback;
  if (image.startsWith("/") || /^https?:\/\//i.test(image)) return image;
  return fallback;
}

function normalizeItem(raw, fallback) {
  const base = fallback || DEFAULT_SEARCH_CYLINDER_ITEMS[0];
  const id = cleanText(raw?.id, base.id);
  if (!ALLOWED_IDS.has(id)) return null;
  const def = DEFAULT_BY_ID.get(id) || base;
  return {
    id,
    label: cleanText(raw?.label, def.label).slice(0, 80),
    group: cleanText(raw?.group, def.group).slice(0, 40),
    image: cleanImage(raw?.image, def.image),
    href: cleanHref(raw?.href, def.href),
    enabled: raw?.enabled === false ? false : true,
  };
}

/**
 * @param {unknown} raw
 * @returns {{ version: number, items: Array<ReturnType<typeof normalizeItem>> }}
 */
export function normalizeSearchCylinderMenu(raw) {
  const inputItems = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const items = [];

  for (const rawItem of inputItems) {
    const item = normalizeItem(rawItem, DEFAULT_BY_ID.get(String(rawItem?.id || "")));
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }

  for (const def of DEFAULT_SEARCH_CYLINDER_ITEMS) {
    if (seen.has(def.id)) continue;
    items.push({ ...def });
  }

  return { version: 1, items };
}

/** Publikus / dobkerék: csak engedélyezett elemek, sorrendben. */
export function publicSearchCylinderItems(menu) {
  const normalized = normalizeSearchCylinderMenu(menu);
  return normalized.items.filter((item) => item.enabled !== false);
}
