/**
 * Közös ingatlan kerék-séma (kliens) — kereső + feladás.
 * Alapértelmezés megegyezik a szerver defaulttal; élő config: GET /api/level1/ingatlan-wheel-schema
 */

import { escapeHtml, escapeAttr, wheelFieldHtml } from "./ingatlan-wheels.js?v=mobile2";

export const WHEEL_COLS = 12;

const FIELD_DEFS = [
  { field_key: "keresesi_hely", label: "Keresési hely", kind: "text", surfaces: ["search"] },
  { field_key: "ar_tol", label: "Ár min.", kind: "wheel", surfaces: ["search"] },
  { field_key: "ar_ig", label: "Ár max.", kind: "wheel", surfaces: ["search"] },
  { field_key: "alapterulet_tol", label: "Alapterület min.", kind: "wheel", surfaces: ["search"] },
  { field_key: "alapterulet_ig", label: "Alapterület max.", kind: "wheel", surfaces: ["search"] },
  { field_key: "alapterulet", label: "Alapterület", kind: "wheel", surfaces: ["post"] },
  { field_key: "szobaszam", label: "Szobaszám", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "ingatlan_lakas_tipus", label: "Típus", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "allapot", label: "Állapot", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "ingatlan_kora", label: "Ingatlan kora", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "min_berleti_ido", label: "Minimum bérleti idő", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "butorozott", label: "Bútorozott", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "kilatas", label: "Kilátás", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "tajolas", label: "Tájolás", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "futes", label: "Fűtés módja", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "parkolas", label: "Parkolás", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "komfort", label: "Komfort", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "tetoter", label: "Tetőtér", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "furdo_wc", label: "Fürdő és WC", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "emelet", label: "Emelet", kind: "wheel", surfaces: ["post"] },
  { field_key: "emelet_tol", label: "Emelet min.", kind: "wheel", surfaces: ["search"] },
  { field_key: "emelet_ig", label: "Emelet max.", kind: "wheel", surfaces: ["search"] },
  { field_key: "belmagassag", label: "Belmagasság", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "koltozheto", label: "Mikortól költözhető", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "lift", label: "Lift", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "erkely", label: "Erkély", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "szigeteles", label: "Szigetelés", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "energiahatekonys", label: "Energiahatékony", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "akadalymentesitett", label: "Akadálymentesített", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "legkondicionalo", label: "Légkondicionáló", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "kertkapcsolatos", label: "Kertkapcsolatos", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "panelprogram", label: "Panelprogram", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "gepesitett", label: "Gépesített", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "kisallat_megengedett", label: "Kisállat megengedett", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "dohanyzas_megengedett", label: "Dohányzás megengedett", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "ar_ft_min", label: "Ár Ft min.", kind: "wheel", surfaces: ["search"] },
];

const DEF_BY_KEY = new Map(FIELD_DEFS.map((d) => [d.field_key, d]));

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v)));
}

export function isSpacer(cell) {
  return cell?.type === "spacer" || String(cell?.field_key || "").startsWith("__spacer");
}

function defaultRaw() {
  return [
    { field_key: "keresesi_hely", section: "main", row: 1, col: 1, colSpan: 12, hidden: false },
    { field_key: "ar_tol", section: "main", row: 2, col: 1, colSpan: 3, hidden: false },
    { field_key: "ar_ig", section: "main", row: 2, col: 4, colSpan: 3, hidden: false },
    { field_key: "alapterulet_tol", section: "main", row: 2, col: 7, colSpan: 3, hidden: false },
    { field_key: "alapterulet_ig", section: "main", row: 2, col: 10, colSpan: 3, hidden: false },
    { field_key: "szobaszam", section: "main", row: 3, col: 1, colSpan: 3, hidden: false },
    { field_key: "alapterulet", section: "main", row: 2, col: 7, colSpan: 3, hidden: false },
    { field_key: "ingatlan_lakas_tipus", section: "more", row: 1, col: 1, colSpan: 6, hidden: false },
    { field_key: "allapot", section: "more", row: 1, col: 7, colSpan: 6, hidden: false },
    { field_key: "ingatlan_kora", section: "more", row: 2, col: 1, colSpan: 6, hidden: false },
    { field_key: "min_berleti_ido", section: "more", row: 2, col: 7, colSpan: 6, hidden: false },
    { field_key: "butorozott", section: "more", row: 3, col: 1, colSpan: 6, hidden: false },
    { field_key: "kilatas", section: "more", row: 3, col: 7, colSpan: 6, hidden: false },
    { field_key: "tajolas", section: "more", row: 4, col: 1, colSpan: 6, hidden: false },
    { field_key: "futes", section: "more", row: 4, col: 7, colSpan: 6, hidden: false },
    { field_key: "parkolas", section: "more", row: 5, col: 1, colSpan: 6, hidden: false },
    { field_key: "komfort", section: "more", row: 5, col: 7, colSpan: 6, hidden: false },
    { field_key: "tetoter", section: "more", row: 6, col: 1, colSpan: 6, hidden: false },
    { field_key: "furdo_wc", section: "more", row: 6, col: 7, colSpan: 6, hidden: false },
    { field_key: "emelet_tol", section: "more", row: 7, col: 1, colSpan: 6, hidden: false },
    { field_key: "emelet_ig", section: "more", row: 7, col: 7, colSpan: 6, hidden: false },
    { field_key: "emelet", section: "more", row: 7, col: 1, colSpan: 6, hidden: false },
    { field_key: "belmagassag", section: "more", row: 8, col: 1, colSpan: 6, hidden: false },
    { field_key: "koltozheto", section: "more", row: 8, col: 7, colSpan: 6, hidden: false },
    { field_key: "lift", section: "more", row: 9, col: 1, colSpan: 3, hidden: false },
    { field_key: "erkely", section: "more", row: 9, col: 4, colSpan: 3, hidden: false },
    { field_key: "szigeteles", section: "more", row: 9, col: 7, colSpan: 3, hidden: false },
    { field_key: "energiahatekonys", section: "more", row: 9, col: 10, colSpan: 3, hidden: false },
    { field_key: "akadalymentesitett", section: "more", row: 10, col: 1, colSpan: 3, hidden: false },
    { field_key: "legkondicionalo", section: "more", row: 10, col: 4, colSpan: 3, hidden: false },
    { field_key: "kertkapcsolatos", section: "more", row: 10, col: 7, colSpan: 3, hidden: false },
    { field_key: "panelprogram", section: "more", row: 10, col: 10, colSpan: 3, hidden: false },
    { field_key: "gepesitett", section: "more", row: 11, col: 1, colSpan: 3, hidden: false },
    { field_key: "kisallat_megengedett", section: "more", row: 11, col: 4, colSpan: 3, hidden: false },
    { field_key: "dohanyzas_megengedett", section: "more", row: 11, col: 7, colSpan: 3, hidden: false },
    { field_key: "ar_ft_min", section: "more", row: 11, col: 10, colSpan: 3, hidden: false },
  ];
}

const FALLBACK = new Map(defaultRaw().map((c) => [c.field_key, c]));

export function normalizeIngatlanWheelSchema(raw) {
  const incoming = raw && typeof raw === "object" ? raw : {};
  const byKey = new Map();
  const spacers = [];
  let spacerSeq = 0;

  for (const cell of Array.isArray(incoming.cells) ? incoming.cells : []) {
    if (isSpacer(cell)) {
      spacerSeq += 1;
      const id = String(cell.field_key || "").startsWith("__spacer")
        ? cell.field_key
        : `__spacer_${spacerSeq}`;
      spacers.push({
        type: "spacer",
        field_key: id,
        label: "Üres sor",
        section: cell.section === "more" ? "more" : "main",
        row: clamp(cell.row, 1, 40),
        col: 1,
        colSpan: WHEEL_COLS,
        hidden: Boolean(cell.hidden),
      });
      continue;
    }
    const key = String(cell.field_key || "");
    if (!DEF_BY_KEY.has(key)) continue;
    byKey.set(key, cell);
  }

  const cells = [];
  for (const def of FIELD_DEFS) {
    const prev = byKey.get(def.field_key) || {};
    const fallback = FALLBACK.get(def.field_key) || {
      section: "more",
      row: 20,
      col: 1,
      colSpan: 6,
      hidden: true,
    };
    const col = clamp(prev.col ?? fallback.col, 1, WHEEL_COLS);
    let colSpan = clamp(prev.colSpan ?? fallback.colSpan, 1, WHEEL_COLS);
    if (col + colSpan - 1 > WHEEL_COLS) colSpan = WHEEL_COLS - col + 1;
    const section =
      prev.section === "main" || prev.section === "more" ? prev.section : fallback.section;
    cells.push({
      field_key: def.field_key,
      label: def.label,
      kind: def.kind,
      surfaces: [...def.surfaces],
      section,
      row: clamp(prev.row ?? fallback.row, 1, 40),
      col,
      colSpan,
      hidden: prev.hidden != null ? Boolean(prev.hidden) : Boolean(fallback.hidden),
    });
  }
  for (const sp of spacers) cells.push(sp);
  cells.sort((a, b) => {
    const sa = a.section === "more" ? 1 : 0;
    const sb = b.section === "more" ? 1 : 0;
    if (sa !== sb) return sa - sb;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });
  return { version: 1, cells };
}

export function defaultIngatlanWheelSchema() {
  return normalizeIngatlanWheelSchema({ version: 1, cells: defaultRaw() });
}

export function cellsForSurface(schema, surface) {
  const s = surface === "post" ? "post" : "search";
  return (schema?.cells || []).filter((cell) => {
    if (cell.hidden) return false;
    if (isSpacer(cell)) return true;
    const def = DEF_BY_KEY.get(cell.field_key);
    return def?.surfaces?.includes(s);
  });
}

export function createSpacerCell(section = "main", row = 1) {
  return {
    type: "spacer",
    field_key: `__spacer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    label: "Üres sor",
    section: section === "more" ? "more" : "main",
    row: clamp(row, 1, 40),
    col: 1,
    colSpan: WHEEL_COLS,
    hidden: false,
  };
}

let cachedSchema = null;

export async function fetchIngatlanWheelSchema() {
  try {
    const res = await fetch("/api/level1/ingatlan-wheel-schema", { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.schema) {
      cachedSchema = normalizeIngatlanWheelSchema(data.schema);
      return cachedSchema;
    }
  } catch {
    /* offline / default */
  }
  cachedSchema = defaultIngatlanWheelSchema();
  return cachedSchema;
}

export function getCachedIngatlanWheelSchema() {
  return cachedSchema || defaultIngatlanWheelSchema();
}

function cellStyle(cell) {
  const col = clamp(cell.col, 1, WHEEL_COLS);
  const span = clamp(cell.colSpan, 1, WHEEL_COLS - col + 1);
  const row = clamp(cell.row, 1, 40);
  return `grid-column:${col} / span ${span};grid-row:${row}`;
}

function textFieldHtml(name, label) {
  return `<label class="immo-field" data-schema-field="${escapeAttr(name)}">
    <span class="immo-label">${escapeHtml(label)}</span>
    <input class="immo-control" id="immo-${escapeAttr(name)}" name="${escapeAttr(name)}" type="text" placeholder="Város vagy falu neve" autocomplete="address-level2" />
  </label>`;
}

function cellHtml(cell) {
  if (isSpacer(cell)) {
    return `<div class="immo-schema-spacer" style="${cellStyle(cell)}" aria-hidden="true"></div>`;
  }
  const def = DEF_BY_KEY.get(cell.field_key);
  const label = cell.label || def?.label || cell.field_key;
  const kind = cell.kind || def?.kind || "wheel";
  const inner =
    kind === "text" ? textFieldHtml(cell.field_key, label) : wheelFieldHtml(cell.field_key, label);
  return `<div class="immo-schema-cell" data-schema-field="${escapeAttr(cell.field_key)}" style="${cellStyle(cell)}">${inner}</div>`;
}

/** Kitölti a main/more hostokat a sémából (kategória nélkül). */
export function renderIngatlanSchemaHosts(mainHost, moreHost, schema, surface) {
  const cells = cellsForSurface(schema, surface);
  const main = cells.filter((c) => c.section !== "more");
  const more = cells.filter((c) => c.section === "more");
  const maxMain = Math.max(1, ...main.map((c) => Number(c.row) || 1));
  const maxMore = Math.max(1, ...more.map((c) => Number(c.row) || 1));
  if (mainHost) {
    mainHost.className = "immo-schema-grid";
    mainHost.style.gridTemplateRows = `repeat(${maxMain}, auto)`;
    mainHost.innerHTML = main.map(cellHtml).join("");
  }
  if (moreHost) {
    moreHost.className = "immo-schema-grid";
    moreHost.style.gridTemplateRows = `repeat(${maxMore}, auto)`;
    moreHost.innerHTML = more.map(cellHtml).join("");
  }
}

export { FIELD_DEFS as INGATLAN_WHEEL_FIELD_DEFS };
