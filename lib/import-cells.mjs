import { formDataToCells, cellsToFormData } from "./form-field-catalog.mjs";

export const STEP_TITLES = {
  1: "Alapadatok",
  2: "Műszaki adatok",
  3: "Extrák",
  5: "Hirdetés",
};

/** Import sor kiegészítése (km, forrás URL, hirdetés azonosító). */
export function enrichFormFromImportItem(formData, item) {
  const data = { ...(formData ?? {}) };
  if ((!data.km || String(data.km).trim() === "") && item?.km) {
    const digits = String(item.km).replace(/[^\d]/g, "");
    if (digits) data.km = digits;
  }
  if (item?.url && !data.forras_url) data.forras_url = item.url;
  if (item?.id && !data.hasznaltauto_hirdetes_id) data.hasznaltauto_hirdetes_id = String(item.id);
  return data;
}
/** Űrlap adat → szerkeszthető cellák (csak kitöltött mezők + extrák). */
export function formDataToDisplayCells(formData) {
  return formDataToCells(formData);
}

/** Szerkesztett cellák → űrlap adat (mentéshez). */
export function displayCellsToFormData(cells) {
  return cellsToFormData(cells);
}

/** Cellák csoportosítása lépés szerint. */
export function groupCellsByStep(cells) {
  const groups = new Map();
  for (const cell of cells ?? []) {
    const step = cell.step ?? 1;
    if (!groups.has(step)) groups.set(step, []);
    groups.get(step).push(cell);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b);
}

/** Szerkesztett értékek összegyűjtése a DOM-ból (tesztelhető struktúra). */
export function collectEditedCells(container, baseCells) {
  const valueByKey = new Map();
  for (const input of container.querySelectorAll("[data-field-key]")) {
    const key = input.dataset.fieldKey;
    if (!key) continue;
    valueByKey.set(key, input.value.trim());
  }

  const extrasRaw = container.querySelector("[data-extras-input]")?.value ?? "";
  const extras = extrasRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const cells = [];
  for (const base of baseCells ?? []) {
    if (base.field_key?.startsWith("extra:")) continue;
    const value = valueByKey.get(base.field_key) ?? base.value;
    if (!value) continue;
    cells.push({ ...base, value: String(value).trim() });
  }

  for (const label of extras) {
    cells.push({
      field_key: `extra:${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 80)}`,
      label,
      value: "1",
      step: 3,
    });
  }

  return cells;
}
