/** Gumi méret selectek + hátsó külön méret pipák (hirdetésfeladás). */

const TIRE_WIDTHS = [
  125, 135, 145, 155, 165, 175, 185, 195, 205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305, 315, 325, 335, 345, 355,
];

const TIRE_ASPECTS = [25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85];

const TIRE_RIMS = [10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

const EMPTY_LABEL = "—";

const REAR_GROUPS = [];

function fillSelect(select, values) {
  if (!select || select.tagName !== "SELECT") return;
  const current = select.value;
  select.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = EMPTY_LABEL;
  select.appendChild(empty);
  for (const value of values) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    select.appendChild(option);
  }
  if (current) {
    const has = [...select.options].some((option) => option.value === current);
    if (!has) {
      const option = document.createElement("option");
      option.value = current;
      option.textContent = current;
      select.appendChild(option);
    }
    select.value = current;
  }
}

function fillTireSelect(select) {
  if (!select) return;
  const name = select.name || "";
  if (name.endsWith("_szelesseg")) fillSelect(select, TIRE_WIDTHS);
  else if (name.endsWith("_magassag")) fillSelect(select, TIRE_ASPECTS);
  else if (name.endsWith("_atmero")) fillSelect(select, TIRE_RIMS);
}

function syncRearGroup(form, group) {
  const checkbox = form.elements.namedItem(group.checkboxName);
  if (!(checkbox instanceof HTMLInputElement)) return;

  const hasValue = group.fields.some((name) => {
    const field = form.elements.namedItem(name);
    return field && "value" in field && String(field.value || "").trim() !== "";
  });

  if (hasValue && !checkbox.checked) checkbox.checked = true;

  const enabled = checkbox.checked;
  for (const name of group.fields) {
    const field = form.elements.namedItem(name);
    if (!(field instanceof HTMLSelectElement)) continue;
    field.disabled = !enabled;
    if (!enabled) field.value = "";
  }
}

function syncAllRearGroups(form) {
  for (const group of REAR_GROUPS) syncRearGroup(form, group);
}

/**
 * @param {HTMLFormElement | null} form
 * @returns {{ syncRearTires: () => void }}
 */
export function initTireSizes(form) {
  if (!form) return { syncRearTires: () => {} };

  const root = form.querySelector(".tire-sizes-grid");
  if (!root) return { syncRearTires: () => {} };

  root.querySelectorAll("select[name]").forEach((select) => fillTireSelect(select));

  for (const group of REAR_GROUPS) {
    const checkbox = form.elements.namedItem(group.checkboxName);
    if (!(checkbox instanceof HTMLInputElement)) continue;
    checkbox.addEventListener("change", () => {
      syncRearGroup(form, group);
      form.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  syncAllRearGroups(form);

  return {
    syncRearTires: () => syncAllRearGroups(form),
  };
}
