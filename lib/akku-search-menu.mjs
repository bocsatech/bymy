/**
 * Részletes keresés — Akkumulátor és hatótáv adatok menü (admin szerkeszthető).
 */

/** v2: csak a Bocsatech „Akkumulátor menü” ír ide; alapból üres a keresőn. */
export const AKKU_SEARCH_MENU_KV_KEY = "akku_search_menu_v2";

/** Alapból minden ki — a keresőn üres, amíg az admin be nem kapcsolja. */
export const DEFAULT_AKKU_SEARCH_MENU_ITEMS = [
  {
    id: "akkumulator_kwh",
    kind: "range",
    label: "Akkukapacitás",
    unit: "kWh",
    step: "0.1",
    enabled: false,
  },
  {
    id: "jelenlegi_akkukapacitas",
    kind: "range",
    label: "Jelenlegi akkukapacitás",
    unit: "%",
    step: "1",
    enabled: false,
  },
  {
    id: "ac_toltesi_teljesitmeny",
    kind: "range",
    label: "AC töltési teljesítmény",
    unit: "kW",
    step: "0.1",
    enabled: false,
  },
  {
    id: "dc_toltesi_teljesitmeny",
    kind: "range",
    label: "DC töltési teljesítmény",
    unit: "kW",
    step: "0.1",
    enabled: false,
  },
  {
    id: "hatotav",
    kind: "range",
    label: "WLTP hatótáv",
    unit: "km",
    step: "1",
    enabled: false,
  },
  {
    id: "autopalya_hatotav",
    kind: "range",
    label: "Autópálya hatótáv",
    unit: "km",
    step: "1",
    enabled: false,
  },
  {
    id: "teli_hatotav",
    kind: "range",
    label: "Téli hatótáv",
    unit: "km",
    step: "1",
    enabled: false,
  },
  {
    id: "ac_tolto_csatlakozas",
    kind: "select",
    label: "AC töltőcsatlakozó típusa",
    options: ["", "Type 1", "Type 2"],
    enabled: false,
  },
  {
    id: "dc_tolto_csatlakozas",
    kind: "select",
    label: "DC töltőcsatlakozó típusa",
    options: ["", "CCS", "CHAdeMO", "Egyéb"],
    enabled: false,
  },
  {
    id: "villamtoltes",
    kind: "toggle",
    label: "Villámtöltés",
    enabled: false,
  },
  {
    id: "zold_rendszam",
    kind: "toggle",
    label: "Zöld rendszám",
    enabled: false,
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
    // Explicit true kell a láthatósághoz (alap: false).
    enabled: raw?.enabled === true,
  };

  if (kind === "range") {
    item.unit = cleanText(raw?.unit, def.unit).slice(0, 16);
    item.step = cleanText(raw?.step, def.step || "1").slice(0, 8);
  }

  if (kind === "select") {
    // AC töltő: mindig Type 1 / Type 2 (régi mentett CCS/CHAdeMO lista ne maradjon).
    if (id === "ac_tolto_csatlakozas") {
      item.options = ["", "Type 1", "Type 2"];
    } else {
      item.options = normalizeOptions(raw?.options, def.options);
    }
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
  const enabled = normalized.items.filter((item) => item.enabled === true);

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

const AKKU_FIELD_KEYS = new Set(DEFAULT_AKKU_SEARCH_MENU_ITEMS.map((item) => item.id));

export function isAkkuSearchFieldKey(fieldKey) {
  return AKKU_FIELD_KEYS.has(String(fieldKey || ""));
}

/**
 * Személyautó kereső form-layout celláiból akku menü (láthatóság / címke / sorrend).
 * @param {Array<{ field_key?: string, label?: string, hidden?: boolean, row?: number, col?: number }>} cells
 * @param {{ title?: string }} [opts]
 */
export function menuFromFormLayoutCells(cells, opts = {}) {
  const list = Array.isArray(cells) ? cells : [];
  const byKey = new Map();
  for (const cell of list) {
    const id = String(cell?.field_key || "");
    if (!AKKU_FIELD_KEYS.has(id)) continue;
    byKey.set(id, cell);
  }

  const orderedIds = [...byKey.keys()].sort((a, b) => {
    const ca = byKey.get(a);
    const cb = byKey.get(b);
    const ra = Number(ca?.row) || 0;
    const rb = Number(cb?.row) || 0;
    if (ra !== rb) return ra - rb;
    return (Number(ca?.col) || 0) - (Number(cb?.col) || 0);
  });

  const seen = new Set();
  const items = [];
  for (const id of orderedIds) {
    const def = DEFAULT_BY_ID.get(id);
    const cell = byKey.get(id);
    if (!def || !cell) continue;
    seen.add(id);
    items.push({
      ...def,
      label: cleanText(cell.label, def.label).slice(0, 80),
      enabled: cell.hidden === true ? false : true, // layout bridge (teszt / legacy)
    });
  }
  for (const def of DEFAULT_AKKU_SEARCH_MENU_ITEMS) {
    if (seen.has(def.id)) continue;
    items.push({ ...def });
  }

  return normalizeAkkuSearchMenu({
    title: cleanText(opts.title, "Akkumulátor és hatótáv adatok"),
    items,
  });
}

/**
 * Akku menü láthatóság/címke visszaírása a kereső form-layout celláiba.
 * A col / colSpan / row megmarad (szélesség szerkesztés ne vesszen el).
 * @returns {number} módosított cellák száma
 */
export function applyAkkuMenuToFormLayoutCells(cells, menu) {
  const list = Array.isArray(cells) ? cells : [];
  const normalized = normalizeAkkuSearchMenu(menu);
  let changed = 0;
  for (const item of normalized.items) {
    const cell = list.find((c) => c?.field_key === item.id);
    if (!cell) continue;
    const nextHidden = item.enabled === false;
    const nextLabel = item.label;
    if (cell.hidden !== nextHidden || cell.label !== nextLabel) {
      cell.hidden = nextHidden;
      cell.label = nextLabel;
      changed += 1;
    }
  }
  return changed;
}
