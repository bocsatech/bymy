/**
 * Részletes keresés — Akkumulátor és hatótáv adatok menü (admin szerkeszthető).
 */

export const AKKU_SEARCH_MENU_KV_KEY = "akku_search_menu";

export const DEFAULT_AKKU_SEARCH_MENU_ITEMS = [
  {
    id: "akkumulator_kwh",
    kind: "range",
    label: "Akkukapacitás",
    unit: "kWh",
    step: "0.1",
    enabled: true,
  },
  {
    id: "jelenlegi_akkukapacitas",
    kind: "range",
    label: "Jelenlegi akkukapacitás",
    unit: "%",
    step: "1",
    enabled: true,
  },
  {
    id: "ac_toltesi_teljesitmeny",
    kind: "range",
    label: "AC töltési teljesítmény",
    unit: "kW",
    step: "0.1",
    enabled: true,
  },
  {
    id: "dc_toltesi_teljesitmeny",
    kind: "range",
    label: "DC töltési teljesítmény",
    unit: "kW",
    step: "0.1",
    enabled: true,
  },
  {
    id: "hatotav",
    kind: "range",
    label: "WLTP hatótáv",
    unit: "km",
    step: "1",
    enabled: true,
  },
  {
    id: "autopalya_hatotav",
    kind: "range",
    label: "Autópálya hatótáv",
    unit: "km",
    step: "1",
    enabled: true,
  },
  {
    id: "teli_hatotav",
    kind: "range",
    label: "Téli hatótáv",
    unit: "km",
    step: "1",
    enabled: true,
  },
  {
    id: "ac_tolto_csatlakozas",
    kind: "select",
    label: "AC töltőcsatlakozó típusa",
    options: ["", "Type 2", "CCS", "CHAdeMO", "Egyéb"],
    enabled: true,
  },
  {
    id: "dc_tolto_csatlakozas",
    kind: "select",
    label: "DC töltőcsatlakozó típusa",
    options: ["", "CCS", "CHAdeMO", "Type 2", "Egyéb"],
    enabled: true,
  },
  {
    id: "villamtoltes",
    kind: "toggle",
    label: "Villámtöltés",
    enabled: true,
  },
  {
    id: "zold_rendszam",
    kind: "toggle",
    label: "Zöld rendszám",
    enabled: true,
  },
];

const DEFAULT_BY_ID = new Map(DEFAULT_AKKU_SEARCH_MENU_ITEMS.map((item) => [item.id, item]));

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeOptions(raw, fallback = []) {
  if (!Array.isArray(raw) || !raw.length) return [...fallback];
  return raw.map((opt) => String(opt ?? ""));
}

function normalizeItem(raw, fallback) {
  const base = fallback || DEFAULT_AKKU_SEARCH_MENU_ITEMS[0];
  const def = DEFAULT_BY_ID.get(cleanText(raw?.id, base.id)) || base;
  const id = cleanText(raw?.id, def.id).slice(0, 64);
  const kind = cleanText(raw?.kind, def.kind) || def.kind;
  const label = cleanText(raw?.label, def.label).slice(0, 80);
  if (!id || !label) return null;

  const item = {
    id,
    kind,
    label,
    enabled: raw?.enabled === false ? false : true,
  };

  if (kind === "range") {
    item.unit = cleanText(raw?.unit, def.unit).slice(0, 16);
    item.step = cleanText(raw?.step, def.step || "1").slice(0, 8);
  }

  if (kind === "select") {
    item.options = normalizeOptions(raw?.options, def.options);
  }

  return item;
}

/**
 * @param {unknown} raw
 * @returns {{ version: number, title: string, updatedAt?: string, items: Array<object> }}
 */
export function normalizeAkkuSearchMenu(raw) {
  const title = cleanText(raw?.title, "Akkumulátor és hatótáv adatok").slice(0, 80);
  const updatedAt = cleanText(raw?.updatedAt, "");
  const inputItems = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const items = [];

  for (const rawItem of inputItems) {
    const item = normalizeItem(rawItem, DEFAULT_BY_ID.get(String(rawItem?.id || "")));
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }

  for (const def of DEFAULT_AKKU_SEARCH_MENU_ITEMS) {
    if (seen.has(def.id)) continue;
    items.push({ ...def });
  }

  const out = { version: 1, title, items };
  if (updatedAt) out.updatedAt = updatedAt;
  return out;
}

/** Részletes keresés UI szekció (csak engedélyezett mezők). */
export function publicAkkuSearchSection(menu) {
  const normalized = normalizeAkkuSearchMenu(menu);
  const enabled = normalized.items.filter((item) => item.enabled !== false);

  const ranges = [];
  const selects = [];
  const toggles = [];

  for (const item of enabled) {
    if (item.kind === "range") {
      ranges.push({
        id: item.id,
        label: item.label,
        unit: item.unit || "",
        step: item.step || "1",
      });
    } else if (item.kind === "select") {
      selects.push({
        id: item.id,
        label: item.label,
        options: item.options || [""],
      });
    } else if (item.kind === "toggle") {
      toggles.push({ id: item.id, label: item.label });
    }
  }

  return {
    id: "akku",
    title: normalized.title,
    ranges,
    selects,
    toggles,
  };
}

export function akkuKindLabel(kind) {
  if (kind === "range") return "Tól–ig";
  if (kind === "select") return "Választó";
  if (kind === "toggle") return "Kapcsoló";
  return kind;
}
