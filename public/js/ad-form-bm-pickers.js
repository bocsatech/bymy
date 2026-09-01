/**
 * Hirdetésfeladás — Állapot / Kivitel / Okmány kapcsolós panel (mint az autó kereső).
 * Több érték is választható; a rejtett mező JSON listát tárol, a select csak opciókat tart.
 */

import { ALLAPOT_CATEGORIES, OKMANY_JELLEG_OPTIONS, UZEMANYAG_CATEGORIES } from "./equipment-data.js?v=teherKivitel35e";
import { KIVITEL_OPTIONS } from "./kivitel-options.js?v=kivitel1";
import { fetchVehicleCatalog } from "./vehicle-catalog-client.js?v=adBmCatalog1";
import { bindAutoBmDismiss, autoBmPanelIsOpen } from "./auto-bm-dismiss.js?v=bmDismiss1";

const PLACEHOLDER = "Válasszon";

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

function labelList(items, unit = "db") {
  if (!items.length) return PLACEHOLDER;
  if (items.length === 1) return items[0];
  if (items.length <= 3) return items.join(", ");
  return `${items.length} ${unit}`;
}

function normalizePrimaryValue(select, value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (select.id === "gyartmany") return raw.toUpperCase();
  if (select.id === "uzemanyag") {
    const aliases = { Diesel: "Dízel", "Diesel/elektromos": "Dízel/elektromos" };
    return aliases[raw] ?? raw;
  }
  return raw;
}

function syncSelectPrimary(select) {
  const hidden = select?._adBmHidden;
  if (!select || !hidden || select.tagName !== "SELECT") return;
  const first = normalizePrimaryValue(select, parseJsonList(hidden.value)[0]);
  if (!first) {
    if (select.value !== "") {
      select.value = "";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return;
  }
  if (![...select.options].some((option) => option.value === first)) {
    const option = document.createElement("option");
    option.value = first;
    option.textContent = first;
    select.appendChild(option);
  }
  if (select.value !== first) {
    select.value = first;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function writePickerList(select, list) {
  writeJsonList(select._adBmHidden, list);
  syncSelectPrimary(select);
}

function categoryValues(cat) {
  if (cat.children?.length) return cat.children.map((c) => c.value);
  return cat.value ? [cat.value] : [];
}

export function isSzemelyautoAdForm(form) {
  if (!form) return false;
  const vertical = String(form.elements.namedItem("hirdetes_vertical")?.value ?? "")
    .trim()
    .toLowerCase();
  if (vertical === "ingatlan") return false;
  const subtype = String(
    form.elements.namedItem("hirdetes_alkategoria")?.value ??
      form.elements.namedItem("jarmu_kategoria")?.value ??
      ""
  )
    .trim()
    .toLowerCase();
  if (subtype === "teherauto" || subtype === "kisteher" || subtype === "ingatlan") return false;
  if (vertical === "teher") return false;
  return true;
}

/** @type {(() => void) | null} */
let closeOpenPanel = null;

function registerOpenPanel(close) {
  if (closeOpenPanel && closeOpenPanel !== close) closeOpenPanel();
  closeOpenPanel = close;
}

function unregisterOpenPanel(close) {
  if (closeOpenPanel === close) closeOpenPanel = null;
}

function fieldHost(select) {
  return select?.closest(".labeled-field, .md-outlined, .ad-layout-item");
}

function bmWrap(select) {
  const byId = document.querySelector(`.ad-form-bm-field[data-ad-bm-for="${select.id}"]`);
  if (byId) return byId;
  const prev = select.previousElementSibling;
  return prev instanceof HTMLElement && prev.matches(".ad-form-bm-field") ? prev : null;
}

function bmSummaryEl(select) {
  return bmWrap(select)?.querySelector("[data-ad-bm-summary]") ?? null;
}

function anchorField(select) {
  const field = fieldHost(select);
  if (!field) return null;
  field.classList.add("ad-form-bm-anchor");
  return field;
}

function updateBmSummary(select, text, hasValue) {
  const wrap = bmWrap(select);
  const summaryEl = bmSummaryEl(select);
  if (summaryEl) summaryEl.textContent = text;
  wrap?.classList.toggle("has-value", hasValue);
}

function hideNativeSelect(select) {
  select.classList.add("ad-form-bm-native");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
}

function showNativeSelect(select) {
  select.classList.remove("ad-form-bm-native");
  select.removeAttribute("tabindex");
  select.removeAttribute("aria-hidden");
}

function ensureHiddenInput(select) {
  let hidden = select._adBmHidden;
  if (hidden?.isConnected) return hidden;

  hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.className = "ad-form-bm-hidden";
  hidden.dataset.adBmMulti = "1";
  if (select.name) {
    hidden.name = select.name;
    select.removeAttribute("name");
  }
  if (select.required) {
    hidden.required = true;
    select.removeAttribute("required");
  }

  const initial = parseJsonList(select.value);
  writeJsonList(hidden, initial);
  select.insertAdjacentElement("afterend", hidden);
  select._adBmHidden = hidden;
  return hidden;
}

function restoreHiddenInput(select) {
  const hidden = select._adBmHidden;
  if (!hidden) return;
  if (hidden.name && !select.name) {
    select.name = hidden.name;
  }
  if (hidden.required) {
    select.required = true;
  }
  hidden.remove();
  delete select._adBmHidden;
}

function unmountPicker(select) {
  if (!select) return;
  showNativeSelect(select);
  restoreHiddenInput(select);
  const field = fieldHost(select);
  field?.classList.remove("ad-form-bm-anchor", "is-open");
  field?.querySelector(`.ad-form-bm-field[data-ad-bm-for="${select.id}"]`)?.remove();
  select._adBmPanel?.remove();
  delete select._adBmPanel;
  delete select._adBmClose;
  delete select.dataset.adBmPicker;
}

/**
 * @param {{
 *   select: HTMLSelectElement,
 *   title: string,
 *   panelClass: string,
 *   openAttr: string,
 *   renderBody: (bodyEl: HTMLElement) => void,
 *   bindBody: (bodyEl: HTMLElement) => void,
 *   syncFromHidden: () => void,
 *   syncSummary: (summaryEl: HTMLElement | null, hidden: HTMLInputElement) => void,
 *   syncHidden: () => void,
 * }} opts
 */
function mountBmPicker(opts) {
  const { select, title, panelClass, openAttr, renderBody, bindBody, syncFromHidden, syncSummary, syncHidden } =
    opts;
  if (!select || select.tagName !== "SELECT" || select.dataset.adBmPicker === "1") return;

  const field = anchorField(select);
  if (!field) return;

  unmountPicker(select);
  hideNativeSelect(select);
  const hidden = ensureHiddenInput(select);

  const wrap = document.createElement("div");
  wrap.className = "ad-form-bm-field auto-bm-field";
  wrap.dataset.adBmFor = select.id;
  wrap.innerHTML = `
    <button type="button" class="auto-bm-trigger" ${openAttr}>
      <span data-ad-bm-summary>${escapeHtml(PLACEHOLDER)}</span>
      <span class="auto-bm-trigger__chev" aria-hidden="true">⌄</span>
    </button>
  `;
  select.insertAdjacentElement("beforebegin", wrap);

  const summaryEl = wrap.querySelector("[data-ad-bm-summary]");
  const openBtn = wrap.querySelector(`[${openAttr}]`);

  const panel = document.createElement("div");
  panel.className = `auto-bm-panel ad-form-bm-panel ${panelClass}`;
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", title);
  panel.innerHTML = `<div class="auto-bm-panel__body" data-ad-bm-body></div>`;
  field.appendChild(panel);
  select._adBmPanel = panel;
  const bodyEl = panel.querySelector("[data-ad-bm-body]");

  function refreshSummary() {
    syncSummary(summaryEl, hidden);
    wrap.classList.toggle("has-value", parseJsonList(hidden.value).length > 0);
  }

  function openPanel() {
    registerOpenPanel(closePanel);
    syncFromHidden();
    renderBody(bodyEl);
    bindBody(bodyEl);
    field.classList.add("is-open");
    panel.hidden = false;
    panel.style.removeProperty("display");
    panel.classList.remove("is-closed");
  }

  function closePanel() {
    field.classList.remove("is-open");
    panel.hidden = true;
    panel.style.setProperty("display", "none", "important");
    panel.classList.add("is-closed");
    unregisterOpenPanel(closePanel);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    syncHidden();
    refreshSummary();
  }

  openBtn?.addEventListener("click", () => {
    if (!panel.hidden && !panel.classList.contains("is-closed")) closePanel();
    else openPanel();
  });

  bindAutoBmDismiss({
    panel,
    roots: [field, wrap],
    isOpen: () => autoBmPanelIsOpen(panel),
    close: closePanel,
  });

  hidden.addEventListener("change", refreshSummary);
  refreshSummary();

  select.dataset.adBmPicker = "1";
  select._adBmClose = closePanel;
}

function mountFlatPicker(select, title, options, panelClass, openAttr) {
  /** @type {Set<string>} */
  let selected = new Set();

  mountBmPicker({
    select,
    title,
    panelClass,
    openAttr,
    syncFromHidden() {
      selected = new Set(parseJsonList(select._adBmHidden?.value));
    },
    syncSummary(summaryEl) {
      if (summaryEl) summaryEl.textContent = labelList([...selected]);
    },
    syncHidden() {
      writeJsonList(select._adBmHidden, [...selected]);
    },
    renderBody(bodyEl) {
      const rows = options
        .map((opt) => {
          const on = selected.has(opt);
          return `<div class="auto-bm-row">
            <label class="auto-bm-toggle">
              <span>${escapeHtml(opt)}</span>
              <input type="checkbox" data-ad-bm-flat="${escapeAttr(opt)}" ${on ? "checked" : ""} />
              <span class="auto-bm-switch" aria-hidden="true"></span>
            </label>
          </div>`;
        })
        .join("");
      bodyEl.innerHTML = `<div class="auto-bm-group">${rows}</div>`;
    },
    bindBody(bodyEl) {
      bodyEl.onchange = (event) => {
        const el = event.target.closest("[data-ad-bm-flat]");
        if (!el) return;
        const opt = el.getAttribute("data-ad-bm-flat") ?? "";
        if (el.checked) selected.add(opt);
        else selected.delete(opt);
        writePickerList(select, [...selected]);
        updateBmSummary(select, labelList([...selected]), selected.size > 0);
      };
    },
  });
}

function mountAllapotPicker(select) {
  /** @type {Set<string>} */
  let openMains = new Set();
  /** @type {Set<string>} */
  let selected = new Set();

  function selectedLabels() {
    const labels = [];
    for (const cat of ALLAPOT_CATEGORIES) {
      if (!openMains.has(cat.id)) continue;
      if (cat.children?.length) {
        const kids = cat.children.filter((c) => selected.has(c.value));
        if (kids.length) labels.push(...kids.map((c) => c.label));
        else labels.push(cat.label);
      } else if (cat.value && selected.has(cat.value)) {
        labels.push(cat.label);
      }
    }
    return labels;
  }

  function effectiveSelectedValues() {
    const values = new Set();
    for (const cat of ALLAPOT_CATEGORIES) {
      if (!openMains.has(cat.id)) continue;
      if (cat.children?.length) {
        const kids = cat.children.filter((c) => selected.has(c.value));
        if (kids.length) kids.forEach((c) => values.add(c.value));
        else {
          cat.children.forEach((c) => values.add(c.value));
          values.add(cat.label);
        }
      } else if (cat.value && selected.has(cat.value)) {
        values.add(cat.value);
      }
    }
    return [...values];
  }

  function syncOpenFromValues() {
    openMains.clear();
    for (const value of selected) {
      for (const cat of ALLAPOT_CATEGORIES) {
        if (cat.value === value || cat.children?.some((c) => c.value === value)) {
          openMains.add(cat.id);
        }
      }
    }
  }

  function turnMainOn(cat) {
    openMains.add(cat.id);
    if (!cat.children?.length && cat.value) selected.add(cat.value);
  }

  function turnMainOff(cat) {
    openMains.delete(cat.id);
    for (const v of categoryValues(cat)) selected.delete(v);
  }

  function renderAllapotBody(bodyEl) {
    const rows = ALLAPOT_CATEGORIES.map((cat) => {
      const on = openMains.has(cat.id);
      const hasKids = Boolean(cat.children?.length);
      let kidsHtml = "";
      if (hasKids && on) {
        kidsHtml = `<div class="auto-fuel-children">
          ${cat.children
            .map((child) => {
              const childOn = selected.has(child.value);
              return `<div class="auto-bm-row auto-fuel-child-row">
                <label class="auto-bm-toggle">
                  <span>${escapeHtml(child.label)}</span>
                  <input type="checkbox" data-ad-bm-allapot-child="${escapeAttr(child.value)}" data-ad-bm-allapot-parent="${escapeAttr(cat.id)}" ${childOn ? "checked" : ""} />
                  <span class="auto-bm-switch" aria-hidden="true"></span>
                </label>
              </div>`;
            })
            .join("")}
        </div>`;
      }
      return `<div class="auto-bm-row auto-fuel-main-row" data-ad-bm-allapot-main="${escapeAttr(cat.id)}">
        <label class="auto-bm-toggle auto-fuel-main-toggle">
          <span class="auto-fuel-main-label">${escapeHtml(cat.label)}</span>
          <input type="checkbox" data-ad-bm-allapot-main-toggle="${escapeAttr(cat.id)}" ${on ? "checked" : ""} />
          <span class="auto-bm-switch" aria-hidden="true"></span>
        </label>
        ${kidsHtml}
      </div>`;
    }).join("");

    bodyEl.innerHTML = `<div class="auto-bm-group">${rows}</div>`;
  }

  mountBmPicker({
    select,
    title: "Állapot",
    panelClass: "ad-form-allapot-panel",
    openAttr: "data-ad-bm-allapot-open",
    syncFromHidden() {
      selected = new Set(parseJsonList(select._adBmHidden?.value));
      syncOpenFromValues();
    },
    syncSummary(summaryEl) {
      if (summaryEl) summaryEl.textContent = labelList(selectedLabels());
    },
    syncHidden() {
      writeJsonList(select._adBmHidden, effectiveSelectedValues());
    },
    renderBody: renderAllapotBody,
    bindBody(bodyEl) {
      bodyEl.onchange = (event) => {
        const mainEl = event.target.closest("[data-ad-bm-allapot-main-toggle]");
        if (mainEl) {
          const id = mainEl.getAttribute("data-ad-bm-allapot-main-toggle");
          const cat = ALLAPOT_CATEGORIES.find((c) => c.id === id);
          if (!cat) return;
          if (mainEl.checked) turnMainOn(cat);
          else turnMainOff(cat);
          renderAllapotBody(bodyEl);
          writePickerList(select, effectiveSelectedValues());
          updateBmSummary(select, labelList(selectedLabels()), effectiveSelectedValues().length > 0);
          return;
        }

        const childEl = event.target.closest("[data-ad-bm-allapot-child]");
        if (!childEl) return;
        const value = childEl.getAttribute("data-ad-bm-allapot-child") ?? "";
        const parentId = childEl.getAttribute("data-ad-bm-allapot-parent") ?? "";
        if (childEl.checked) {
          if (parentId) openMains.add(parentId);
          selected.add(value);
        } else {
          selected.delete(value);
        }
        writePickerList(select, effectiveSelectedValues());
        updateBmSummary(select, labelList(selectedLabels()), effectiveSelectedValues().length > 0);
      };
    },
  });
}

function mountHierarchicalPicker(select, { title, panelClass, openAttr, categories, attrMain, attrChild, attrParent, unit }) {
  /** @type {Set<string>} */
  let openMains = new Set();
  /** @type {Set<string>} */
  let selected = new Set();

  function selectedLabels() {
    const labels = [];
    for (const cat of categories) {
      if (!openMains.has(cat.id)) continue;
      if (cat.children?.length) {
        const kids = cat.children.filter((c) => selected.has(c.value));
        if (kids.length) labels.push(...kids.map((c) => c.label));
        else labels.push(cat.label);
      } else if (cat.value && selected.has(cat.value)) {
        labels.push(cat.label);
      }
    }
    return labels;
  }

  function effectiveSelectedValues() {
    const values = new Set();
    for (const cat of categories) {
      if (!openMains.has(cat.id)) continue;
      if (cat.children?.length) {
        const kids = cat.children.filter((c) => selected.has(c.value));
        if (kids.length) kids.forEach((c) => values.add(c.value));
        else {
          cat.children.forEach((c) => values.add(c.value));
          values.add(cat.label);
        }
      } else if (cat.value && selected.has(cat.value)) {
        values.add(cat.value);
      }
    }
    return [...values];
  }

  function syncOpenFromValues() {
    openMains.clear();
    for (const value of selected) {
      for (const cat of categories) {
        if (cat.value === value || cat.children?.some((c) => c.value === value)) {
          openMains.add(cat.id);
        }
      }
    }
  }

  function turnMainOn(cat) {
    openMains.add(cat.id);
    if (!cat.children?.length && cat.value) selected.add(cat.value);
  }

  function turnMainOff(cat) {
    openMains.delete(cat.id);
    for (const v of categoryValues(cat)) selected.delete(v);
  }

  function renderBody(bodyEl) {
    const rows = categories.map((cat) => {
      const on = openMains.has(cat.id);
      const hasKids = Boolean(cat.children?.length);
      let kidsHtml = "";
      if (hasKids && on) {
        kidsHtml = `<div class="auto-fuel-children">
          ${cat.children
            .map((child) => {
              const childOn = selected.has(child.value);
              return `<div class="auto-bm-row auto-fuel-child-row">
                <label class="auto-bm-toggle">
                  <span>${escapeHtml(child.label)}</span>
                  <input type="checkbox" ${attrChild}="${escapeAttr(child.value)}" ${attrParent}="${escapeAttr(cat.id)}" ${childOn ? "checked" : ""} />
                  <span class="auto-bm-switch" aria-hidden="true"></span>
                </label>
              </div>`;
            })
            .join("")}
        </div>`;
      }
      return `<div class="auto-bm-row auto-fuel-main-row">
        <label class="auto-bm-toggle auto-fuel-main-toggle">
          <span class="auto-fuel-main-label">${escapeHtml(cat.label)}</span>
          <input type="checkbox" ${attrMain}="${escapeAttr(cat.id)}" ${on ? "checked" : ""} />
          <span class="auto-bm-switch" aria-hidden="true"></span>
        </label>
        ${kidsHtml}
      </div>`;
    }).join("");
    bodyEl.innerHTML = `<div class="auto-bm-group">${rows}</div>`;
  }

  mountBmPicker({
    select,
    title,
    panelClass,
    openAttr,
    syncFromHidden() {
      selected = new Set(parseJsonList(select._adBmHidden?.value));
      syncOpenFromValues();
    },
    syncSummary(summaryEl) {
      if (summaryEl) summaryEl.textContent = labelList(selectedLabels(), unit);
    },
    syncHidden() {
      writePickerList(select, effectiveSelectedValues());
    },
    renderBody,
    bindBody(bodyEl) {
      bodyEl.onchange = (event) => {
        const mainEl = event.target.closest(`[${attrMain}]`);
        if (mainEl) {
          const id = mainEl.getAttribute(attrMain);
          const cat = categories.find((c) => c.id === id);
          if (!cat) return;
          if (mainEl.checked) turnMainOn(cat);
          else turnMainOff(cat);
          renderBody(bodyEl);
          writePickerList(select, effectiveSelectedValues());
          updateBmSummary(select, labelList(selectedLabels(), unit), effectiveSelectedValues().length > 0);
          return;
        }

        const childEl = event.target.closest(`[${attrChild}]`);
        if (!childEl) return;
        const value = childEl.getAttribute(attrChild) ?? "";
        const parentId = childEl.getAttribute(attrParent) ?? "";
        if (childEl.checked) {
          if (parentId) openMains.add(parentId);
          selected.add(value);
        } else {
          selected.delete(value);
        }
        writePickerList(select, effectiveSelectedValues());
        updateBmSummary(select, labelList(selectedLabels(), unit), effectiveSelectedValues().length > 0);
      };
    },
  });
}

function mountFuelPicker(select) {
  mountHierarchicalPicker(select, {
    title: "Üzemanyag",
    panelClass: "ad-form-fuel-panel",
    openAttr: "data-ad-bm-fuel-open",
    categories: UZEMANYAG_CATEGORIES,
    attrMain: "data-ad-bm-fuel-main-toggle",
    attrChild: "data-ad-bm-fuel-child",
    attrParent: "data-ad-bm-fuel-parent",
    unit: "üzemanyag",
  });
}

function mountBrandPicker(select, catalog) {
  const brands = [...(catalog?.gyartmanyok || [])].sort((a, b) => a.localeCompare(b, "hu", { sensitivity: "base" }));
  /** @type {Set<string>} */
  let selected = new Set();
  let query = "";

  function matchingBrands() {
    const q = query.trim().toLocaleLowerCase("hu");
    if (!q) return brands;
    return brands.filter((brand) => brand.toLocaleLowerCase("hu").includes(q));
  }

  function renderBrandBody(bodyEl) {
    const rows = matchingBrands()
      .map((brand) => {
        const on = selected.has(brand);
        return `<div class="auto-bm-row">
          <label class="auto-bm-toggle">
            <span>${escapeHtml(brand)}</span>
            <input type="checkbox" data-ad-bm-brand="${escapeAttr(brand)}" ${on ? "checked" : ""} />
            <span class="auto-bm-switch" aria-hidden="true"></span>
          </label>
        </div>`;
      })
      .join("");
    bodyEl.innerHTML = `
      <div class="ad-form-bm-search">
        <input type="search" class="ad-form-bm-search-input" data-ad-bm-brand-search placeholder="Keresés…" value="${escapeAttr(query)}" autocomplete="off" />
      </div>
      <div class="auto-bm-group">${rows || `<p class="ad-form-bm-empty">Nincs találat</p>`}</div>
    `;
  }

  mountBmPicker({
    select,
    title: "Gyártmány",
    panelClass: "ad-form-brand-panel",
    openAttr: "data-ad-bm-brand-open",
    syncFromHidden() {
      selected = new Set(parseJsonList(select._adBmHidden?.value).map((v) => v.toUpperCase()));
    },
    syncSummary(summaryEl) {
      if (summaryEl) summaryEl.textContent = labelList([...selected], "márka");
    },
    syncHidden() {
      writePickerList(select, [...selected]);
    },
    renderBody: renderBrandBody,
    bindBody(bodyEl) {
      bodyEl.oninput = (event) => {
        const search = event.target.closest("[data-ad-bm-brand-search]");
        if (!search) return;
        query = search.value;
        renderBrandBody(bodyEl);
      };
      bodyEl.onchange = (event) => {
        const el = event.target.closest("[data-ad-bm-brand]");
        if (!el) return;
        const brand = el.getAttribute("data-ad-bm-brand") ?? "";
        if (el.checked) selected.add(brand);
        else selected.delete(brand);
        writePickerList(select, [...selected]);
        updateBmSummary(select, labelList([...selected], "márka"), selected.size > 0);
        document.getElementById("modell")?._adBmHidden?.dispatchEvent(new Event("change", { bubbles: true }));
      };
    },
  });
}

function mountModelPicker(select, catalog) {
  /** @type {Set<string>} */
  let selected = new Set();
  let query = "";

  function selectedBrands() {
    const gyartmany = document.getElementById("gyartmany");
    return parseJsonList(gyartmany?._adBmHidden?.value).map((v) => v.toUpperCase());
  }

  function modelOptions() {
    const brands = selectedBrands();
    const models = new Set();
    for (const brand of brands) {
      for (const model of catalog?.modellek?.[brand] || []) models.add(model);
    }
    return [...models].sort((a, b) => a.localeCompare(b, "hu", { sensitivity: "base" }));
  }

  function matchingModels() {
    const q = query.trim().toLocaleLowerCase("hu");
    const options = modelOptions();
    if (!q) return options;
    return options.filter((model) => model.toLocaleLowerCase("hu").includes(q));
  }

  function pruneSelected() {
    const allowed = new Set(modelOptions());
    selected = new Set([...selected].filter((model) => allowed.has(model)));
  }

  function renderModelBody(bodyEl) {
    const brands = selectedBrands();
    const rows = matchingModels()
      .map((model) => {
        const on = selected.has(model);
        return `<div class="auto-bm-row">
          <label class="auto-bm-toggle">
            <span>${escapeHtml(model)}</span>
            <input type="checkbox" data-ad-bm-model="${escapeAttr(model)}" ${on ? "checked" : ""} />
            <span class="auto-bm-switch" aria-hidden="true"></span>
          </label>
        </div>`;
      })
      .join("");
    const emptyMsg = brands.length
      ? "Nincs találat"
      : "Először válassz gyártmányt";
    bodyEl.innerHTML = `
      <div class="ad-form-bm-search">
        <input type="search" class="ad-form-bm-search-input" data-ad-bm-model-search placeholder="Keresés…" value="${escapeAttr(query)}" autocomplete="off" ${brands.length ? "" : "disabled"} />
      </div>
      <div class="auto-bm-group">${rows || `<p class="ad-form-bm-empty">${escapeHtml(emptyMsg)}</p>`}</div>
    `;
  }

  mountBmPicker({
    select,
    title: "Modell",
    panelClass: "ad-form-model-panel",
    openAttr: "data-ad-bm-model-open",
    syncFromHidden() {
      selected = new Set(parseJsonList(select._adBmHidden?.value));
      pruneSelected();
    },
    syncSummary(summaryEl) {
      if (summaryEl) summaryEl.textContent = labelList([...selected], "modell");
    },
    syncHidden() {
      writePickerList(select, [...selected]);
    },
    renderBody: renderModelBody,
    bindBody(bodyEl) {
      bodyEl.oninput = (event) => {
        const search = event.target.closest("[data-ad-bm-model-search]");
        if (!search) return;
        query = search.value;
        renderModelBody(bodyEl);
      };
      bodyEl.onchange = (event) => {
        const el = event.target.closest("[data-ad-bm-model]");
        if (!el) return;
        const model = el.getAttribute("data-ad-bm-model") ?? "";
        if (el.checked) selected.add(model);
        else selected.delete(model);
        writePickerList(select, [...selected]);
        updateBmSummary(select, labelList([...selected], "modell"), selected.size > 0);
      };
    },
  });

  document.getElementById("gyartmany")?._adBmHidden?.addEventListener("change", () => {
    pruneSelected();
    writePickerList(select, [...selected]);
    updateBmSummary(select, labelList([...selected], "modell"), selected.size > 0);
    const bodyEl = select._adBmPanel?.querySelector("[data-ad-bm-body]");
    if (bodyEl && autoBmPanelIsOpen(select._adBmPanel)) renderModelBody(bodyEl);
  });
}

export function applyAdFormBmFieldValues(data) {
  if (!data || typeof data !== "object") return;
  const ids = ["allapot", "kivitel", "okmany_jelleg", "gyartmany", "modell", "uzemanyag"];
  for (const id of ids) {
    if (!(id in data)) continue;
    const select = document.getElementById(id);
    if (!select) continue;
    const raw = data[id];
    let list = [];
    if (Array.isArray(raw)) list = raw.map(String).filter(Boolean);
    else if (raw != null && String(raw).trim()) {
      const parsed = parseJsonList(String(raw));
      list = parsed.length ? parsed : [String(raw)];
    }
    if (id === "gyartmany") list = list.map((v) => v.toUpperCase());
    if (id === "uzemanyag") list = list.map((v) => normalizePrimaryValue(select, v)).filter(Boolean);

    if (select._adBmHidden) {
      writePickerList(select, list);
      const unit =
        id === "gyartmany" ? "márka" : id === "modell" ? "modell" : id === "uzemanyag" ? "üzemanyag" : "db";
      updateBmSummary(select, labelList(list, unit), list.length > 0);
    } else if (select.tagName === "SELECT" && list.length) {
      const first = list[0];
      if (![...select.options].some((option) => option.value === first)) {
        const option = document.createElement("option");
        option.value = first;
        option.textContent = first;
        select.appendChild(option);
      }
      select.value = first;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

/** @type {object | null} */
let cachedVehicleCatalog = null;

export function unmountAdFormBmPickers(form) {
  if (!form) return;
  ["allapot", "kivitel", "okmany_jelleg", "gyartmany", "modell", "uzemanyag"].forEach((id) => {
    const select = document.getElementById(id);
    if (select?._adBmClose) select._adBmClose();
    unmountPicker(select);
  });
  delete form?.dataset.adBmPickers;
}

export async function refreshAdFormBmPickers(form, catalog = null) {
  try {
    if (catalog) cachedVehicleCatalog = catalog;
    unmountAdFormBmPickers(form);
    await mountAdFormBmPickers(form, catalog || cachedVehicleCatalog);
  } catch (error) {
    console.warn("Alapadatok kapcsolós panel frissítés:", error);
  }
}

export async function mountAdFormBmPickers(form, catalog = null) {
  if (!form) return;
  if (!isSzemelyautoAdForm(form)) {
    unmountAdFormBmPickers(form);
    return;
  }

  const allapot = document.getElementById("allapot");
  const kivitel = document.getElementById("kivitel");
  const okmany = document.getElementById("okmany_jelleg");
  const uzemanyag = document.getElementById("uzemanyag");
  const gyartmany = document.getElementById("gyartmany");
  const modell = document.getElementById("modell");

  if (allapot?.tagName === "SELECT" && allapot.dataset.adBmPicker !== "1") mountAllapotPicker(allapot);
  if (kivitel?.tagName === "SELECT" && kivitel.dataset.adBmPicker !== "1") {
    mountFlatPicker(kivitel, "Kivitel", KIVITEL_OPTIONS, "ad-form-kivitel-panel", "data-ad-bm-kivitel-open");
  }
  if (okmany?.tagName === "SELECT" && okmany.dataset.adBmPicker !== "1") {
    mountFlatPicker(
      okmany,
      "Okmányok jellege",
      OKMANY_JELLEG_OPTIONS,
      "ad-form-okmany-panel",
      "data-ad-bm-okmany-open"
    );
  }
  if (uzemanyag?.tagName === "SELECT" && uzemanyag.dataset.adBmPicker !== "1") mountFuelPicker(uzemanyag);

  try {
    const cat = catalog || (await fetchVehicleCatalog());
    if (gyartmany?.tagName === "SELECT" && gyartmany.dataset.adBmPicker !== "1") mountBrandPicker(gyartmany, cat);
    if (modell?.tagName === "SELECT" && modell.dataset.adBmPicker !== "1") mountModelPicker(modell, cat);
  } catch (error) {
    console.warn("Gyártmány/modell kapcsolós panel:", error);
  }

  form.dataset.adBmPickers = "1";
}

if (typeof window !== "undefined") {
  window.addEventListener("ad-form-layout-refresh", () => {
    refreshAdFormBmPickers(document.getElementById("ad-form"));
  });
  window.addEventListener("ad-form-ready", () => {
    refreshAdFormBmPickers(document.getElementById("ad-form"));
  });
}
