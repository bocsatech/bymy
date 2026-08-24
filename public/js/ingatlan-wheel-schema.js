/**
 * Közös ingatlan kerék-séma (kliens) — kereső + feladás.
 * Alapértelmezés megegyezik a szerver defaulttal; élő config: GET /api/level1/ingatlan-wheel-schema
 */

import { escapeHtml, escapeAttr, wheelFieldHtml } from "./ingatlan-wheels.js?v=scrollLock4";

export const WHEEL_COLS = 12;

/** Admin: Kiado (master) + eladó + Airbnb */
export const INGATLAN_WHEEL_ADMIN_CATEGORIES = ["ingatlan", "elado-ingatlan", "airbnb"];

export function normalizeIngatlanWheelVariant(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (v === "elado-ingatlan" || v === "elado_ingatlan" || v === "eladoingatlan") return "elado-ingatlan";
  if (v === "airbnb") return "airbnb";
  return "ingatlan";
}

export function isIngatlanWheelAdminCategory(category) {
  const v = String(category ?? "")
    .trim()
    .toLowerCase();
  if (v === "elado-ingatlan" || v === "elado_ingatlan" || v === "eladoingatlan") return true;
  if (v === "airbnb") return true;
  if (v === "ingatlan") return true;
  return false;
}

/** Élő keresőn osztott (min–max) kerék — adminban egy csempe. */
export const INGATLAN_DUAL_RANGE_GROUPS = [
  {
    id: "ar",
    title: "Ár",
    adminLabel: "Ár (osztott kerék · min–max)",
    tolKey: "ar_tol",
    igKey: "ar_ig",
    unit: "",
    ariaLabel: "Ár tartomány",
  },
  {
    id: "alapterulet",
    title: "Alapterület",
    adminLabel: "Alapterület (osztott kerék · min–max)",
    tolKey: "alapterulet_tol",
    igKey: "alapterulet_ig",
    unit: "m²",
    ariaLabel: "Alapterület tartomány",
  },
  {
    id: "emelet",
    title: "Emelet",
    adminLabel: "Emelet (osztott kerék · min–max)",
    tolKey: "emelet_tol",
    igKey: "emelet_ig",
    unit: "",
    ariaLabel: "Emelet tartomány",
  },
];


const FIELD_DEFS = [
  { field_key: "keresesi_hely", label: "Keresési hely", kind: "text", surfaces: ["search"] },
  { field_key: "ar_tol", label: "Ár · min", kind: "wheel", surfaces: ["search"] },
  { field_key: "ar_ig", label: "Ár · max", kind: "wheel", surfaces: ["search"] },
  { field_key: "alapterulet_tol", label: "Alapterület · min", kind: "wheel", surfaces: ["search"] },
  { field_key: "alapterulet_ig", label: "Alapterület · max", kind: "wheel", surfaces: ["search"] },
  { field_key: "alapterulet", label: "Alapterület (feladás)", kind: "wheel", surfaces: ["post"] },
  { field_key: "szobaszam", label: "Szobaszám", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "ingatlan_lakas_tipus", label: "Típus", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "ingatlan_tipus_2", label: "Típus 2", kind: "wheel", surfaces: ["search", "post"] },
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
  { field_key: "emelet", label: "Emelet (feladás)", kind: "wheel", surfaces: ["post"] },
  { field_key: "emelet_tol", label: "Emelet · min", kind: "wheel", surfaces: ["search"] },
  { field_key: "emelet_ig", label: "Emelet · max", kind: "wheel", surfaces: ["search"] },
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
  { field_key: "ar_ft_min", label: "Ár Ft min. (régi)", kind: "wheel", surfaces: ["search"] },
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
    { field_key: "ar_tol", section: "main", row: 2, col: 1, colSpan: 6, hidden: false },
    { field_key: "ar_ig", section: "main", row: 2, col: 7, colSpan: 6, hidden: false },
    { field_key: "alapterulet_tol", section: "main", row: 3, col: 1, colSpan: 6, hidden: false },
    { field_key: "alapterulet_ig", section: "main", row: 3, col: 7, colSpan: 6, hidden: false },
    { field_key: "szobaszam", section: "main", row: 4, col: 1, colSpan: 3, hidden: false },
    /* Fő szűrők legalja — meglévő sorok (1–4) érintetlenek. */
    { field_key: "ingatlan_tipus_2", section: "main", row: 5, col: 1, colSpan: 6, hidden: false },
    { field_key: "alapterulet", section: "more", row: 12, col: 1, colSpan: 6, hidden: false },
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
    { field_key: "emelet", section: "more", row: 12, col: 7, colSpan: 6, hidden: false },
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
    { field_key: "ar_ft_min", section: "more", row: 11, col: 10, colSpan: 3, hidden: true },
  ];
}

const FALLBACK = new Map(defaultRaw().map((c) => [c.field_key, c]));


export function syncDualRangeCells(cells) {
  const map = new Map(cells.filter((c) => !isSpacer(c)).map((c) => [c.field_key, c]));
  for (const g of INGATLAN_DUAL_RANGE_GROUPS) {
    const tol = map.get(g.tolKey);
    const ig = map.get(g.igKey);
    if (!tol || !ig) continue;
    if (tol.hidden !== ig.hidden) {
      const show = !tol.hidden || !ig.hidden;
      tol.hidden = !show;
      ig.hidden = !show;
    }
    const section = tol.section === "more" || ig.section === "more" ? "more" : "main";
    tol.section = section;
    ig.section = section;
    ig.row = tol.row;

    const totalSpan = clamp(Number(tol.colSpan) + Number(ig.colSpan), 2, WHEEL_COLS);
    let startCol = clamp(Math.min(Number(tol.col) || 1, Number(ig.col) || 1), 1, WHEEL_COLS);
    if (startCol + totalSpan - 1 > WHEEL_COLS) {
      startCol = Math.max(1, WHEEL_COLS - totalSpan + 1);
    }

    let leftSpan = clamp(Number(tol.colSpan) || 1, 1, totalSpan - 1);
    let rightSpan = totalSpan - leftSpan;
    if (rightSpan < 1) {
      leftSpan = Math.max(1, Math.floor(totalSpan / 2));
      rightSpan = totalSpan - leftSpan;
    }

    tol.col = startCol;
    tol.colSpan = leftSpan;
    ig.col = startCol + leftSpan;
    ig.colSpan = rightSpan;
  }
}

export function dualGroupForField(fieldKey) {
  return INGATLAN_DUAL_RANGE_GROUPS.find((g) => g.tolKey === fieldKey || g.igKey === fieldKey) || null;
}

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
  syncDualRangeCells(cells);

  /* Típus 2 csak akkor kap alap pozíciót, ha még soha nem volt a sémában.
     Mentett elrendezést (main/more/hidden) soha ne írjuk felül. */
  const tip2 = cells.find((c) => c.field_key === "ingatlan_tipus_2");
  if (tip2 && !byKey.has("ingatlan_tipus_2")) {
    const maxMain = Math.max(
      0,
      ...cells
        .filter((c) => c.section === "main" && c.field_key !== "ingatlan_tipus_2" && !isSpacer(c))
        .map((c) => Number(c.row) || 0)
    );
    tip2.section = "main";
    tip2.row = Math.max(5, maxMain + 1);
    tip2.col = 1;
    tip2.colSpan = 6;
    tip2.hidden = false;
  }

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

let cachedSchemaByVariant = new Map();

export async function fetchIngatlanWheelSchema(variant = "ingatlan") {
  const key = String(variant || "ingatlan").trim() || "ingatlan";
  if (cachedSchemaByVariant.has(key)) return cachedSchemaByVariant.get(key);
  try {
    const q = key === "ingatlan" ? "" : `?variant=${encodeURIComponent(key)}`;
    const res = await fetch(`/api/level1/ingatlan-wheel-schema${q}`, { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.schema) {
      const normalized = normalizeIngatlanWheelSchema(data.schema);
      cachedSchemaByVariant.set(key, normalized);
      return normalized;
    }
  } catch {
    /* offline / default */
  }
  const fallback = defaultIngatlanWheelSchema();
  cachedSchemaByVariant.set(key, fallback);
  return fallback;
}

export function getCachedIngatlanWheelSchema(variant = "ingatlan") {
  const key = String(variant || "ingatlan").trim() || "ingatlan";
  return cachedSchemaByVariant.get(key) || defaultIngatlanWheelSchema();
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
    const col = clamp(cell.col, 1, WHEEL_COLS);
    const span = clamp(cell.colSpan, 1, WHEEL_COLS - col + 1);
    const row = clamp(cell.row, 1, 40);
    return `<div class="immo-schema-spacer" data-grid-col="${col}" data-grid-span="${span}" data-grid-row="${row}" style="${cellStyle(cell)}" aria-hidden="true"></div>`;
  }
  const def = DEF_BY_KEY.get(cell.field_key);
  const label = cell.label || def?.label || cell.field_key;
  const kind = cell.kind || def?.kind || "wheel";
  const inner =
    kind === "text" ? textFieldHtml(cell.field_key, label) : wheelFieldHtml(cell.field_key, label);
  const col = clamp(cell.col, 1, WHEEL_COLS);
  const span = clamp(cell.colSpan, 1, WHEEL_COLS - col + 1);
  const row = clamp(cell.row, 1, 40);
  return `<div class="immo-schema-cell" data-schema-field="${escapeAttr(cell.field_key)}" data-grid-col="${col}" data-grid-span="${span}" data-grid-row="${row}" style="${cellStyle(cell)}">${inner}</div>`;
}

function dualPlacement(tol, ig) {
  const startCol = Math.min(tol.col, ig.col);
  const endCol = Math.max(tol.col + tol.colSpan - 1, ig.col + ig.colSpan - 1);
  const span = Math.max(1, endCol - startCol + 1);
  const row = tol.row || ig.row || 1;
  return { startCol, span, row };
}

function dualHalfHtml(fieldKey, halfClass) {
  const def = DEF_BY_KEY.get(fieldKey);
  const label = def?.label || fieldKey;
  const kind = def?.kind || "wheel";
  const inner =
    kind === "text" ? textFieldHtml(fieldKey, label) : wheelFieldHtml(fieldKey, label);
  return `<div class="immo-schema-cell immo-dual-range__half immo-dual-range__half--${halfClass}" data-schema-field="${escapeAttr(fieldKey)}">${inner}</div>`;
}

function dualRangeBlockHtml(group, tol, ig) {
  const { startCol, span, row } = dualPlacement(tol, ig);
  const style = `grid-column:${startCol} / span ${span};grid-row:${row}`;
  const unitHtml = group.unit
    ? `<span class="immo-dual-range__unit" aria-hidden="true">${escapeHtml(group.unit)}</span>`
    : "";
  return `<div class="immo-dual-range-block" data-range="${escapeAttr(group.id)}" data-grid-col="${startCol}" data-grid-span="${span}" data-grid-row="${row}" style="${style}">
  <div class="immo-dual-range" data-range="${escapeAttr(group.id)}" aria-label="${escapeAttr(group.ariaLabel || group.title)}">
    <span class="immo-label immo-dual-range__title">${escapeHtml(group.title)}</span>
    ${dualHalfHtml(group.tolKey, "min")}
    <span class="immo-dual-range__sep" aria-hidden="true">–</span>
    ${dualHalfHtml(group.igKey, "max")}
    ${unitHtml}
  </div>
</div>`;
}

function sectionItemsHtml(cells) {
  const byKey = new Map(cells.map((c) => [c.field_key, c]));
  const skip = new Set();
  const out = [];
  for (const cell of cells) {
    if (skip.has(cell.field_key)) continue;
    const group = dualGroupForField(cell.field_key);
    if (group) {
      const tol = byKey.get(group.tolKey);
      const ig = byKey.get(group.igKey);
      if (tol && ig && !tol.hidden && !ig.hidden) {
        skip.add(group.tolKey);
        skip.add(group.igKey);
        out.push(dualRangeBlockHtml(group, tol, ig));
        continue;
      }
    }
    out.push(cellHtml(cell));
  }
  return out.join("");
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
    mainHost.innerHTML = sectionItemsHtml(main);
  }
  if (moreHost) {
    moreHost.className = "immo-schema-grid";
    moreHost.style.gridTemplateRows = `repeat(${maxMore}, auto)`;
    moreHost.innerHTML = sectionItemsHtml(more);
  }
}

export { FIELD_DEFS as INGATLAN_WHEEL_FIELD_DEFS };
