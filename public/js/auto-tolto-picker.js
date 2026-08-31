/**
 * Autó asztali — AC töltőcsatlakozó kapcsolós multi-select (Type 1 / Type 2).
 */

import { AC_TOLTO_CSATLAKOZAS_OPTIONS, normalizeAcToltoCsatlakozas } from "./equipment-data.js";
import { bindAutoBmDismiss, autoBmPanelIsOpen } from "./auto-bm-dismiss.js?v=bmDismiss1";

const FIELD_SPECS = [
  {
    deskField: "ac_tolto_csatlakozas",
    filterKey: "ac_tolto_csatlakozasok",
    label: "AC töltőcsatlakozó típusa",
    datasetFlag: "acToltoPicker",
    options: AC_TOLTO_CSATLAKOZAS_OPTIONS,
  },
  {
    deskField: "tolto_csatlakozas",
    filterKey: "tolto_csatlakozasok",
    label: "Töltőcsatlakozó",
    datasetFlag: "toltoPicker",
    options: AC_TOLTO_CSATLAKOZAS_OPTIONS,
  },
];

function labelList(items) {
  if (!items.length) return "Mindegy";
  if (items.length === 1) return items[0];
  return items.join(", ");
}

function parseJsonList(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  } catch {
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function writeJsonList(input, list) {
  if (!input) return;
  input.value = list.length ? JSON.stringify(list) : "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function isAutoDesk() {
  return (
    (document.body?.getAttribute("data-site-page") === "auto" ||
      document.body?.getAttribute("data-site-page") === "teherauto") &&
    window.matchMedia("(min-width: 901px)").matches
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function mountOne(form, spec) {
  if (!form || form.dataset[spec.datasetFlag] === "1") return false;

  const field = form.querySelector(`[data-desk-field="${spec.deskField}"]`);
  if (!field) return false;

  const host =
    field.closest(".auto-desk-fields") ||
    form.querySelector(".auto-desk-fields[data-desk-muszaki]") ||
    form.querySelector(".auto-desk-fields[data-desk-alap]");
  if (!host) return false;

  const deskQuick = field.dataset.deskQuick || "0";
  field.remove();

  /** @type {Set<string>} */
  const selected = new Set();

  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.dataset.filterKey = spec.filterKey;
  hidden.setAttribute("data-filter-key", spec.filterKey);

  const wrap = document.createElement("div");
  wrap.className = "auto-desk-field auto-tolto-field";
  wrap.dataset.deskField = spec.deskField;
  wrap.dataset.deskQuick = deskQuick;
  wrap.innerHTML = `
    <span class="auto-desk-field__label">${escapeHtml(spec.label)}</span>
    <button type="button" class="auto-bm-trigger" data-auto-tolto-open>
      <span data-auto-tolto-summary>Mindegy</span>
      <span class="auto-bm-trigger__chev" aria-hidden="true">⌄</span>
    </button>
  `;
  wrap.appendChild(hidden);
  host.appendChild(wrap);

  const summaryEl = wrap.querySelector("[data-auto-tolto-summary]");
  const openBtn = wrap.querySelector("[data-auto-tolto-open]");

  const panel = document.createElement("div");
  panel.className = "auto-bm-panel auto-tolto-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="auto-bm-panel__chrome">
      <button type="button" class="auto-bm-panel__back" data-auto-tolto-back aria-label="Vissza">‹</button>
      <div class="auto-bm-panel__titles">
        <p class="auto-bm-panel__title">${escapeHtml(spec.label)}</p>
      </div>
      <button type="button" class="auto-bm-panel__done" data-auto-tolto-done>Kész</button>
    </div>
    <div class="auto-bm-panel__body" data-auto-tolto-body></div>
  `;
  const hero = document.querySelector(".auto-search-hero") || form.closest(".auto-search-hero") || form;
  hero.appendChild(panel);
  const bodyEl = panel.querySelector("[data-auto-tolto-body]");

  function syncHidden() {
    const list = [...selected];
    writeJsonList(hidden, list);
    if (summaryEl) summaryEl.textContent = labelList(list);
  }

  function renderList() {
    const rows = spec.options
      .map((opt) => {
        const on = selected.has(opt);
        return `<div class="auto-bm-row">
          <label class="auto-bm-toggle">
            <span>${escapeHtml(opt)}</span>
            <input type="checkbox" data-auto-tolto-opt="${escapeAttr(opt)}" ${on ? "checked" : ""} />
            <span class="auto-bm-switch" aria-hidden="true"></span>
          </label>
        </div>`;
      })
      .join("");
    bodyEl.innerHTML = `
      <p class="auto-bm-hint">Kapcsolók — több is</p>
      <button type="button" class="auto-bm-clear" data-auto-tolto-clear>Összes kikapcsolása</button>
      <div class="auto-bm-group">${rows}</div>
    `;
  }

  function openPanel() {
    panel.hidden = false;
    panel.style.removeProperty("display");
    panel.classList.remove("is-closed");
    document.body.classList.add("auto-bm-open");
    renderList();
  }

  function closePanel() {
    panel.hidden = true;
    panel.style.setProperty("display", "none", "important");
    panel.classList.add("is-closed");
    document.body.classList.remove("auto-bm-open");
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    syncHidden();
  }

  openBtn?.addEventListener("click", () => {
    if (!panel.hidden && !panel.classList.contains("is-closed")) closePanel();
    else openPanel();
  });

  bindAutoBmDismiss({
    panel,
    roots: [wrap],
    isOpen: () => autoBmPanelIsOpen(panel),
    close: closePanel,
  });

  panel.querySelector("[data-auto-tolto-back]")?.addEventListener("click", closePanel);
  panel.querySelector("[data-auto-tolto-done]")?.addEventListener("click", closePanel);

  bodyEl.addEventListener("change", (event) => {
    const el = event.target.closest("[data-auto-tolto-opt]");
    if (!el) return;
    const opt = el.getAttribute("data-auto-tolto-opt");
    if (el.checked) selected.add(opt);
    else selected.delete(opt);
    syncHidden();
  });

  bodyEl.addEventListener("click", (event) => {
    if (!event.target.closest("[data-auto-tolto-clear]")) return;
    selected.clear();
    renderList();
    syncHidden();
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      selected.clear();
      syncHidden();
      if (!panel.hidden) renderList();
    });
  });

  form.dataset[spec.datasetFlag] = "1";
  syncHidden();
  return true;
}

/**
 * @param {HTMLFormElement} form
 */
export async function mountAutoToltoPickers(form) {
  if (!form || !isAutoDesk()) return;
  for (const spec of FIELD_SPECS) mountOne(form, spec);
}

export function readToltoFilterValues(form) {
  if (!form) return {};
  const out = {};
  for (const spec of FIELD_SPECS) {
    const el = form.querySelector(`[data-filter-key="${spec.filterKey}"]`);
    if (!el) continue;
    const list = parseJsonList(el.value).map(normalizeAcToltoCsatlakozas).filter(Boolean);
    if (list.length) out[spec.filterKey] = list;
  }
  return out;
}

export function toltoListMatches(listingValue, selectedValues) {
  if (!selectedValues?.length) return true;
  const got = normalizeAcToltoCsatlakozas(listingValue);
  if (!got) return false;
  return selectedValues.some((want) => normalizeAcToltoCsatlakozas(want) === got);
}
