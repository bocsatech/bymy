import { FORM_FIELD_CATALOG } from "./form-field-catalog.mjs";

export const LAYOUT_COLUMNS = 12;

export const LAYOUT_PAIR_OF = {
  gyartasi_ev: "gyartasi_honap",
  forgalomba_helyezes_ev: "forgalomba_helyezes_honap",
  muszaki_ev: "muszaki_honap",
};

export const LAYOUT_SKIP_EDITOR = new Set([
  "hirdetes_cime",
  "hirdetes_vertical",
  "hirdetes_alkategoria",
  "fotok",
  "owner_user_id",
  "views_web",
  "views_app",
  "telefon1_orszag",
  "telefon1_korzet",
  "telefon1_szam",
  "telefon2_orszag",
  "telefon2_korzet",
  "telefon2_szam",
  "telefon3_orszag",
  "telefon3_korzet",
  "telefon3_szam",
  "beszelt_nyelvek",
  "gyartasi_honap",
  "forgalomba_helyezes_honap",
  "muszaki_honap",
  "egyeb_modell",
  "video_url",
  "forras_url",
  "hasznaltauto_hirdetes_id",
]);

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function editorCells(layout) {
  return (layout?.cells || []).filter((cell) => !LAYOUT_SKIP_EDITOR.has(cell.field_key) && cell.step !== 4 && cell.step !== 9);
}

function defaultsForStep(step) {
  const visible = FORM_FIELD_CATALOG.filter(
    (field) => field.step === step && !LAYOUT_SKIP_EDITOR.has(field.field_key)
  );
  const map = new Map();
  visible.forEach((field, index) => {
    map.set(field.field_key, {
      col: index % 2 === 0 ? 1 : 7,
      colSpan: 6,
      row: Math.floor(index / 2) + 1,
    });
  });
  return map;
}

function migrateLegacy(prev, fallback) {
  const col = Number(prev.col);
  const row = Number(prev.row);
  const colSpan = Number(prev.colSpan);
  const isV2 = Number.isFinite(col) && Number.isFinite(row);
  if (isV2) {
    return {
      col: clamp(col, 1, LAYOUT_COLUMNS),
      row: clamp(row, 1, 80),
      colSpan: clamp(colSpan || fallback.colSpan, 1, LAYOUT_COLUMNS),
    };
  }
  if (colSpan === 2) {
    return { col: 1, row: fallback.row, colSpan: LAYOUT_COLUMNS };
  }
  const rem = Number(prev.maxWidthRem);
  if (Number.isFinite(rem) && rem > 0) {
    return {
      col: 1,
      row: fallback.row,
      colSpan: clamp(Math.round((rem / 40) * LAYOUT_COLUMNS), 2, LAYOUT_COLUMNS),
    };
  }
  return fallback;
}

export function normalizeFormLayout(layout) {
  const incoming = layout && typeof layout === "object" ? layout : {};
  const byKey = new Map(
    (Array.isArray(incoming.cells) ? incoming.cells : []).map((cell) => [String(cell.field_key || ""), cell])
  );
  const stepDefaults = new Map();
  for (const field of FORM_FIELD_CATALOG) {
    if (!stepDefaults.has(field.step)) stepDefaults.set(field.step, defaultsForStep(field.step));
  }
  const cells = FORM_FIELD_CATALOG.map((field, index) => {
    const prev = byKey.get(field.field_key) || {};
    const fallback = stepDefaults.get(field.step)?.get(field.field_key) || {
      col: 1,
      colSpan: 6,
      row: index + 1,
    };
    const place = migrateLegacy(prev, fallback);
    if (place.col + place.colSpan - 1 > LAYOUT_COLUMNS) {
      place.colSpan = LAYOUT_COLUMNS - place.col + 1;
    }
    const stepRaw = Number(prev.step);
    const step = stepRaw === 1 || stepRaw === 2 || stepRaw === 3 || stepRaw === 4 || stepRaw === 5 ? stepRaw : field.step;
    return {
      field_key: field.field_key,
      label: field.label,
      step,
      hidden: Boolean(prev.hidden),
      col: place.col,
      row: place.row,
      colSpan: place.colSpan,
      order: (place.row - 1) * LAYOUT_COLUMNS + place.col,
    };
  });
  const lookup = new Map(cells.map((cell) => [cell.field_key, cell]));
  for (const [primary, secondary] of Object.entries(LAYOUT_PAIR_OF)) {
    const a = lookup.get(primary);
    const b = lookup.get(secondary);
    if (a && b) {
      b.col = a.col;
      b.row = a.row;
      b.colSpan = a.colSpan;
      b.order = a.order;
      b.step = a.step;
      b.hidden = a.hidden;
    }
  }
  return { version: 2, cells };
}
