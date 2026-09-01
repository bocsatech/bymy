/**
 * Hirdetésfeladás — kapcsolós panel pickerek (személyautó / teherautó).
 * Egy mező = egy választás; a lista fixed overlay-ként nyílik.
 */

import {
  flattenAllapotOptions,
  flattenUzemanyagOptions,
  OKMANY_JELLEG_OPTIONS,
} from "./equipment-data.js?v=teherKivitel35e";
import { fetchVehicleCatalog } from "./vehicle-catalog-client.js?v=adBmCatalog1";
import { bindAutoBmDismiss, autoBmPanelIsOpen } from "./auto-bm-dismiss.js?v=bmDismiss1";

const PLACEHOLDER = "Válasszon";
const DROPDOWN_VISIBLE_ROWS = 7;
const DROPDOWN_ROW_PX = 44;

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

/** Egy választós mező: JSON tömb vagy sima string → első érték. */
function readSingleStoredValue(raw) {
  if (raw == null || raw === "") return "";
  return parseJsonList(String(raw))[0] ?? String(raw).trim();
}

function optionsFromSelect(select) {
  if (!select || select.tagName !== "SELECT") return [];
  return [...select.options].map((option) => option.value).filter(Boolean);
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

const BM_PICKER_SUBTYPES = new Set(["szemelyauto", "teherauto"]);

/** Személyautó és teherautó (3,5 t-tól) feladás — kapcsolós panel pickerek. */
export function isBmPickerAdForm(form) {
  if (!form) return false;
  const subtype = String(
    form.elements.namedItem("hirdetes_alkategoria")?.value ??
      form.elements.namedItem("jarmu_kategoria")?.value ??
      ""
  )
    .trim()
    .toLowerCase();
  if (subtype) return BM_PICKER_SUBTYPES.has(subtype);

  const vertical = String(form.elements.namedItem("hirdetes_vertical")?.value ?? "")
    .trim()
    .toLowerCase();
  if (vertical === "ingatlan" || vertical === "teher") return false;
  return vertical === "auto" || vertical === "";
}

/** @type {(() => void) | null} */
let closeOpenPanel = null;
let suppressBmFocusOpen = false;

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

function updateBmSearchTrigger(select, text, hasValue) {
  const wrap = bmWrap(select);
  const input = wrap?.querySelector("[data-ad-bm-search-trigger]");
  if (!input || input.dataset.adBmEditing === "1") return;
  input.value = hasValue ? text : "";
  input.placeholder = PLACEHOLDER;
  wrap?.classList.toggle("has-value", hasValue);
}

function hideNativeSelect(select) {
  select.classList.add("ad-form-bm-native");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  select.setAttribute("hidden", "");
}

function showNativeSelect(select) {
  select.classList.remove("ad-form-bm-native");
  select.removeAttribute("tabindex");
  select.removeAttribute("aria-hidden");
  select.removeAttribute("hidden");
  select.style.removeProperty("display");
  select.style.removeProperty("width");
  select.style.removeProperty("height");
  select.style.removeProperty("min-height");
  select.style.removeProperty("overflow");
  select.style.removeProperty("border");
}

function stashNativeSelect(select, wrap) {
  if (!select || !wrap) return;
  let host = select._adBmNativeHost;
  if (!host) {
    host = document.createElement("div");
    host.className = "ad-form-bm-native-host";
    host.hidden = true;
    select._adBmNativeHost = host;
  }
  host.appendChild(select);
  if (select._adBmHidden) host.appendChild(select._adBmHidden);
  if (host.parentElement !== wrap) wrap.appendChild(host);
}

function releaseNativeSelect(select, field) {
  const host = select._adBmNativeHost;
  const wrap = bmWrap(select);
  const parent = wrap?.parentElement || field;
  if (!parent) return;
  if (host) {
    if (wrap) parent.insertBefore(select, wrap.nextSibling);
    else parent.appendChild(select);
    if (select._adBmHidden) parent.insertBefore(select._adBmHidden, select.nextSibling);
    host.remove();
    delete select._adBmNativeHost;
  } else if (wrap) {
    parent.insertBefore(select, wrap.nextSibling);
    if (select._adBmHidden) parent.insertBefore(select._adBmHidden, select.nextSibling);
  }
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

  const restored = select.dataset.adBmRestoreList;
  if (restored) {
    writeJsonList(hidden, parseJsonList(restored));
    delete select.dataset.adBmRestoreList;
  } else {
    const initial = parseJsonList(select.value);
    writeJsonList(hidden, initial);
  }
  select.insertAdjacentElement("afterend", hidden);
  select._adBmHidden = hidden;
  return hidden;
}

function ensurePlainHiddenInput(select) {
  let hidden = select._adBmHidden;
  if (hidden?.isConnected) return hidden;

  hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.className = "ad-form-bm-hidden";
  hidden.dataset.adBmSingle = "1";
  if (select.name) {
    hidden.name = select.name;
    select.removeAttribute("name");
  }
  if (select.required) {
    hidden.required = true;
    select.removeAttribute("required");
  }

  hidden.value = readSingleStoredValue(restored ?? select.value ?? "");
  if (restored) delete select.dataset.adBmRestoreList;
  select.insertAdjacentElement("afterend", hidden);
  select._adBmHidden = hidden;
  return hidden;
}

function writePlainValue(select, value) {
  const hidden = select._adBmHidden;
  const next = String(value ?? "");
  if (hidden) {
    hidden.value = next;
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
    hidden.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (select.tagName === "SELECT") {
    if (next && ![...select.options].some((option) => option.value === next)) {
      const option = document.createElement("option");
      option.value = next;
      option.textContent = next;
      select.appendChild(option);
    }
    if (select.value !== next) {
      select.value = next;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
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
  if (hidden.dataset.adBmMulti === "1" && hidden.value) {
    select.dataset.adBmRestoreList = hidden.value;
  } else if (hidden.dataset.adBmSingle === "1") {
    select.value = hidden.value;
  }
  hidden.remove();
  delete select._adBmHidden;
}

function unmountPicker(select) {
  if (!select) return;
  const field = fieldHost(select);
  releaseNativeSelect(select, field);
  showNativeSelect(select);
  restoreHiddenInput(select);
  field?.classList.remove("ad-form-bm-anchor", "is-open");
  field?.querySelector(`.ad-form-bm-field[data-ad-bm-for="${select.id}"]`)?.remove();
  select._adBmPanel?.remove();
  delete select._adBmPanel;
  delete select._adBmClose;
  delete select._adBmRefreshDropdown;
  delete select._adBmOnBrandChange;
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
 *   singleSelect?: boolean,
 * }} opts
 */
function mountBmPicker(opts) {
  const {
    select,
    title,
    panelClass,
    openAttr,
    renderBody,
    bindBody,
    syncFromHidden,
    syncSummary,
    syncHidden,
    singleSelect = false,
  } = opts;
  if (!select || select.tagName !== "SELECT" || select.dataset.adBmPicker === "1") return;

  const field = anchorField(select);
  if (!field) return;

  unmountPicker(select);
  hideNativeSelect(select);
  const hidden = singleSelect ? ensurePlainHiddenInput(select) : ensureHiddenInput(select);

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
  stashNativeSelect(select, wrap);

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
    const hasValue = singleSelect
      ? Boolean(readSingleStoredValue(hidden.value))
      : parseJsonList(hidden.value).length > 0;
    wrap.classList.toggle("has-value", hasValue);
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
    syncFromHidden();
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
  syncFromHidden();
  refreshSummary();

  select.dataset.adBmPicker = "1";
  select._adBmClose = closePanel;
}

/**
 * Keresős legördülő: a trigger cella maga a keresőmező, a lista alatta overlay-ként nyílik.
 * @param {HTMLSelectElement} select
 * @param {{
 *   title: string,
 *   panelClass: string,
 *   unit?: string,
 *   disabledMessage?: string,
 *   isDisabled?: () => boolean,
 *   syncFromHidden: () => void,
 *   syncHidden: () => void,
 *   getSummary: () => string,
 *   getFilteredItems: (query: string) => unknown[],
 *   renderRows: (bodyEl: HTMLElement, items: unknown[], scrollTop: number) => void,
 *   bindBody: (bodyEl: HTMLElement) => void,
 *   onQueryChange?: (query: string) => void,
 *   singleSelect?: boolean,
 * }} opts
 */
function mountSearchDropdownPicker(select, opts) {
  const {
    title,
    panelClass,
    unit = "db",
    disabledMessage = "Nincs találat",
    isDisabled = () => false,
    syncFromHidden,
    syncHidden,
    getSummary,
    getFilteredItems,
    renderRows,
    bindBody,
    onQueryChange,
    singleSelect = false,
  } = opts;
  if (!select || select.tagName !== "SELECT" || select.dataset.adBmPicker === "1") return;

  const field = anchorField(select);
  if (!field) return;

  unmountPicker(select);
  hideNativeSelect(select);
  const hidden = singleSelect ? ensurePlainHiddenInput(select) : ensureHiddenInput(select);

  let query = "";
  let scrollTop = 0;
  let lastWindowStart = -1;

  const wrap = document.createElement("div");
  wrap.className = "ad-form-bm-field ad-form-bm-field--dropdown auto-bm-field";
  wrap.dataset.adBmFor = select.id;
  wrap.innerHTML = `
    <div class="ad-form-bm-input-wrap">
      <input
        type="text"
        class="ad-form-bm-search-trigger"
        data-ad-bm-search-trigger
        placeholder="${escapeAttr(PLACEHOLDER)}"
        autocomplete="off"
        enterkeyhint="search"
        aria-label="${escapeAttr(title)}"
      />
      <span class="auto-bm-trigger__chev" aria-hidden="true">⌄</span>
    </div>
  `;
  select.insertAdjacentElement("beforebegin", wrap);
  stashNativeSelect(select, wrap);

  const input = wrap.querySelector("[data-ad-bm-search-trigger]");
  const chev = wrap.querySelector(".auto-bm-trigger__chev");

  const dropdown = document.createElement("div");
  dropdown.className = `auto-bm-panel ad-form-bm-panel ad-form-bm-dropdown ${panelClass}`;
  dropdown.hidden = true;
  dropdown.setAttribute("role", "listbox");
  dropdown.setAttribute("aria-label", title);
  dropdown.innerHTML = `<div class="ad-form-bm-dropdown__body auto-bm-panel__body" data-ad-bm-body></div>`;
  wrap.appendChild(dropdown);
  select._adBmPanel = dropdown;
  const bodyEl = dropdown.querySelector("[data-ad-bm-body]");
  const inputWrap = wrap.querySelector(".ad-form-bm-input-wrap");

  function positionDropdown() {
    const anchor = inputWrap || wrap;
    const rect = anchor.getBoundingClientRect();
    dropdown.classList.add("ad-form-bm-dropdown--portaled");
    dropdown.style.position = "fixed";
    dropdown.style.top = `${Math.round(rect.bottom + 4)}px`;
    dropdown.style.left = `${Math.round(rect.left)}px`;
    dropdown.style.width = `${Math.round(rect.width)}px`;
    dropdown.style.right = "auto";
    dropdown.style.bottom = "auto";
  }

  function attachDropdownPortal() {
    if (dropdown.parentElement !== document.body) document.body.appendChild(dropdown);
    positionDropdown();
  }

  function detachDropdownPortal() {
    dropdown.classList.remove("ad-form-bm-dropdown--portaled");
    dropdown.style.removeProperty("position");
    dropdown.style.removeProperty("top");
    dropdown.style.removeProperty("left");
    dropdown.style.removeProperty("width");
    dropdown.style.removeProperty("right");
    dropdown.style.removeProperty("bottom");
    if (dropdown.parentElement !== wrap) wrap.appendChild(dropdown);
  }

  function onViewportChange() {
    if (dropdown.hidden || dropdown.classList.contains("is-closed")) return;
    positionDropdown();
  }

  function openDropdown() {
    ["gyartmany", "modell", "uzemanyag", "okmany_jelleg", "allapot", "kivitel", "forgalomba_helyezes_ev", "forgalomba_helyezes_honap"].forEach((id) => {
      const other = document.getElementById(id);
      if (!other || other === select) return;
      if (autoBmPanelIsOpen(other._adBmPanel) && typeof other._adBmClose === "function") other._adBmClose();
    });
    suppressBmFocusOpen = false;
    registerOpenPanel(closeDropdown);
    syncFromHidden();
    scrollTop = 0;
    lastWindowStart = -1;
    renderList(true);
    field.classList.add("is-open");
    wrap.classList.add("is-open");
    dropdown.hidden = false;
    dropdown.style.removeProperty("display");
    dropdown.classList.remove("is-closed");
    attachDropdownPortal();
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
  }

  function closeDropdown() {
    const wasOpen = autoBmPanelIsOpen(dropdown);
    field.classList.remove("is-open");
    wrap.classList.remove("is-open");
    dropdown.hidden = true;
    dropdown.style.setProperty("display", "none", "important");
    dropdown.classList.add("is-closed");
    detachDropdownPortal();
    window.removeEventListener("scroll", onViewportChange, true);
    window.removeEventListener("resize", onViewportChange);
    unregisterOpenPanel(closeDropdown);
    if (wasOpen) {
      suppressBmFocusOpen = true;
      window.setTimeout(() => {
        suppressBmFocusOpen = false;
      }, 50);
    }
    if (input) {
      input.dataset.adBmEditing = "0";
      if (wasOpen) input.blur();
    }
    query = "";
    onQueryChange?.(query);
    syncFromHidden();
    syncHidden();
    refreshTrigger();
  }

  function refreshTrigger() {
    const hasValue = singleSelect
      ? Boolean(readSingleStoredValue(hidden.value))
      : parseJsonList(hidden.value).length > 0;
    const summary = getSummary();
    updateBmSearchTrigger(select, summary === PLACEHOLDER ? "" : summary, hasValue);
  }

  function renderList(force = false) {
    if (isDisabled()) {
      bodyEl.innerHTML = `<p class="ad-form-bm-empty">${escapeHtml(disabledMessage)}</p>`;
      return;
    }
    const items = getFilteredItems(query);
    if (!items.length) {
      bodyEl.innerHTML = `<p class="ad-form-bm-empty">${escapeHtml(disabledMessage)}</p>`;
      return;
    }
    const nextStart = Math.max(0, Math.floor(scrollTop / DROPDOWN_ROW_PX) - 1);
    if (!force && nextStart === lastWindowStart && bodyEl.querySelector("[data-ad-bm-flat], [data-ad-bm-brand], [data-ad-bm-model]")) {
      return;
    }
    lastWindowStart = nextStart;
    renderRows(bodyEl, items, scrollTop);
    bindBody(bodyEl);
  }

  function beginSearch() {
    if (isDisabled()) return;
    input.dataset.adBmEditing = "1";
    query = "";
    onQueryChange?.(query);
    input.value = "";
    input.placeholder = "Keresés…";
    openDropdown();
    input.focus();
  }

  input?.addEventListener("focus", () => {
    if (suppressBmFocusOpen) {
      input.blur();
      return;
    }
    if (isDisabled()) {
      input.blur();
      return;
    }
    if (dropdown.hidden) beginSearch();
  });

  input?.addEventListener("input", () => {
    if (input.dataset.adBmEditing !== "1") return;
    query = input.value;
    onQueryChange?.(query);
    scrollTop = 0;
    lastWindowStart = -1;
    if (bodyEl) bodyEl.scrollTop = 0;
    renderList(true);
  });

  input?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
    }
  });

  chev?.addEventListener("click", (event) => {
    event.preventDefault();
    if (!dropdown.hidden && !dropdown.classList.contains("is-closed")) closeDropdown();
    else beginSearch();
  });

  dropdown.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  bodyEl?.addEventListener(
    "scroll",
    () => {
      scrollTop = bodyEl.scrollTop;
      renderList(false);
    },
    { passive: true }
  );

  bindAutoBmDismiss({
    panel: dropdown,
    roots: [wrap, inputWrap],
    isOpen: () => autoBmPanelIsOpen(dropdown),
    close: closeDropdown,
  });

  hidden.addEventListener("change", refreshTrigger);
  syncFromHidden();
  refreshTrigger();

  select.dataset.adBmPicker = "1";
  select._adBmClose = closeDropdown;
  select._adBmRefreshDropdown = () => renderList(true);
}

/** Egy választós kapcsolós legördülő (év / hó). */
function mountSingleSelectDropdown(select, { title, panelClass, placeholder = PLACEHOLDER } = {}) {
  if (!select || select.tagName !== "SELECT" || select.dataset.adBmPicker === "1") return;

  const field = anchorField(select);
  if (!field) return;

  unmountPicker(select);
  hideNativeSelect(select);
  const hidden = ensurePlainHiddenInput(select);

  const options = [...select.options]
    .filter((option) => option.value !== "")
    .map((option) => ({ value: option.value, label: option.textContent?.trim() || option.value }));

  let selected = "";
  let query = "";
  let scrollTop = 0;
  let lastWindowStart = -1;

  const wrap = document.createElement("div");
  wrap.className = "ad-form-bm-field ad-form-bm-field--dropdown ad-form-bm-field--single auto-bm-field";
  wrap.dataset.adBmFor = select.id;
  wrap.innerHTML = `
    <div class="ad-form-bm-input-wrap">
      <input
        type="text"
        class="ad-form-bm-search-trigger"
        data-ad-bm-search-trigger
        placeholder="${escapeAttr(placeholder)}"
        autocomplete="off"
        enterkeyhint="search"
        aria-label="${escapeAttr(title)}"
      />
      <span class="auto-bm-trigger__chev" aria-hidden="true">⌄</span>
    </div>
  `;
  select.insertAdjacentElement("beforebegin", wrap);
  stashNativeSelect(select, wrap);

  const input = wrap.querySelector("[data-ad-bm-search-trigger]");
  const chev = wrap.querySelector(".auto-bm-trigger__chev");
  const inputWrap = wrap.querySelector(".ad-form-bm-input-wrap");

  const dropdown = document.createElement("div");
  dropdown.className = `auto-bm-panel ad-form-bm-panel ad-form-bm-dropdown ${panelClass}`;
  dropdown.hidden = true;
  dropdown.setAttribute("role", "listbox");
  dropdown.setAttribute("aria-label", title);
  dropdown.innerHTML = `<div class="ad-form-bm-dropdown__body auto-bm-panel__body" data-ad-bm-body></div>`;
  wrap.appendChild(dropdown);
  select._adBmPanel = dropdown;
  const bodyEl = dropdown.querySelector("[data-ad-bm-body]");

  function matchingOptions() {
    const q = query.trim().toLocaleLowerCase("hu");
    if (!q) return options;
    return options.filter(
      (item) =>
        item.label.toLocaleLowerCase("hu").includes(q) || item.value.toLocaleLowerCase("hu").includes(q)
    );
  }

  function refreshTrigger() {
    if (!input || input.dataset.adBmEditing === "1") return;
    input.value = selected || "";
    input.placeholder = placeholder;
    wrap.classList.toggle("has-value", Boolean(selected));
  }

  function renderList(force = false) {
    const items = matchingOptions();
    if (!items.length) {
      bodyEl.innerHTML = `<p class="ad-form-bm-empty">Nincs találat</p>`;
      return;
    }
    const nextStart = Math.max(0, Math.floor(scrollTop / DROPDOWN_ROW_PX) - 1);
    if (!force && nextStart === lastWindowStart && bodyEl.querySelector("[data-ad-bm-single]")) return;
    lastWindowStart = nextStart;
    const selectedSet = new Set(selected ? [selected] : []);
    renderWindowedToggleRows(
      bodyEl,
      items,
      scrollTop,
      (item) => item.value,
      (item) => item.label,
      selectedSet,
      "data-ad-bm-single"
    );
    bodyEl.onchange = (event) => {
      const el = event.target.closest("[data-ad-bm-single]");
      if (!el) return;
      const value = el.getAttribute("data-ad-bm-single") ?? "";
      selected = el.checked ? value : "";
      writePlainValue(select, selected);
      refreshTrigger();
      renderList(true);
    };
  }

  function positionDropdown() {
    const anchor = inputWrap || wrap;
    const rect = anchor.getBoundingClientRect();
    dropdown.classList.add("ad-form-bm-dropdown--portaled");
    dropdown.style.position = "fixed";
    dropdown.style.top = `${Math.round(rect.bottom + 4)}px`;
    dropdown.style.left = `${Math.round(rect.left)}px`;
    dropdown.style.width = `${Math.round(rect.width)}px`;
    dropdown.style.right = "auto";
    dropdown.style.bottom = "auto";
  }

  function attachDropdownPortal() {
    if (dropdown.parentElement !== document.body) document.body.appendChild(dropdown);
    positionDropdown();
  }

  function detachDropdownPortal() {
    dropdown.classList.remove("ad-form-bm-dropdown--portaled");
    dropdown.style.removeProperty("position");
    dropdown.style.removeProperty("top");
    dropdown.style.removeProperty("left");
    dropdown.style.removeProperty("width");
    dropdown.style.removeProperty("right");
    dropdown.style.removeProperty("bottom");
    if (dropdown.parentElement !== wrap) wrap.appendChild(dropdown);
  }

  function onViewportChange() {
    if (dropdown.hidden || dropdown.classList.contains("is-closed")) return;
    positionDropdown();
  }

  function openDropdown() {
    [
      "gyartmany",
      "modell",
      "uzemanyag",
      "okmany_jelleg",
      "allapot",
      "kivitel",
      "forgalomba_helyezes_ev",
      "forgalomba_helyezes_honap",
    ].forEach((id) => {
      const other = document.getElementById(id);
      if (!other || other === select) return;
      if (autoBmPanelIsOpen(other._adBmPanel) && typeof other._adBmClose === "function") other._adBmClose();
    });
    suppressBmFocusOpen = false;
    registerOpenPanel(closeDropdown);
    selected = String(hidden.value || select.value || "");
    scrollTop = 0;
    lastWindowStart = -1;
    renderList(true);
    field.classList.add("is-open");
    wrap.classList.add("is-open");
    dropdown.hidden = false;
    dropdown.style.removeProperty("display");
    dropdown.classList.remove("is-closed");
    attachDropdownPortal();
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
  }

  function closeDropdown() {
    const wasOpen = autoBmPanelIsOpen(dropdown);
    field.classList.remove("is-open");
    wrap.classList.remove("is-open");
    dropdown.hidden = true;
    dropdown.style.setProperty("display", "none", "important");
    dropdown.classList.add("is-closed");
    detachDropdownPortal();
    window.removeEventListener("scroll", onViewportChange, true);
    window.removeEventListener("resize", onViewportChange);
    unregisterOpenPanel(closeDropdown);
    if (wasOpen) {
      suppressBmFocusOpen = true;
      window.setTimeout(() => {
        suppressBmFocusOpen = false;
      }, 50);
    }
    if (input) {
      input.dataset.adBmEditing = "0";
      if (wasOpen) input.blur();
    }
    query = "";
    writePlainValue(select, selected);
    refreshTrigger();
  }

  function beginSearch() {
    input.dataset.adBmEditing = "1";
    query = "";
    input.value = "";
    input.placeholder = "Keresés…";
    openDropdown();
    input.focus();
  }

  input?.addEventListener("focus", () => {
    if (suppressBmFocusOpen) {
      input.blur();
      return;
    }
    if (dropdown.hidden) beginSearch();
  });

  input?.addEventListener("input", () => {
    if (input.dataset.adBmEditing !== "1") return;
    query = input.value;
    scrollTop = 0;
    lastWindowStart = -1;
    if (bodyEl) bodyEl.scrollTop = 0;
    renderList(true);
  });

  input?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
    }
  });

  chev?.addEventListener("click", (event) => {
    event.preventDefault();
    if (!dropdown.hidden && !dropdown.classList.contains("is-closed")) closeDropdown();
    else beginSearch();
  });

  dropdown.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  bodyEl?.addEventListener(
    "scroll",
    () => {
      scrollTop = bodyEl.scrollTop;
      renderList(false);
    },
    { passive: true }
  );

  bindAutoBmDismiss({
    panel: dropdown,
    roots: [wrap, inputWrap],
    isOpen: () => autoBmPanelIsOpen(dropdown),
    close: closeDropdown,
  });

  selected = String(hidden.value || select.value || "");
  hidden.addEventListener("change", () => {
    selected = String(hidden.value || "");
    refreshTrigger();
  });
  refreshTrigger();

  select.dataset.adBmPicker = "1";
  select._adBmClose = closeDropdown;
  select._adBmRefreshDropdown = () => renderList(true);
}

function renderWindowedToggleRows(bodyEl, items, scrollTop, rowKey, rowLabel, selected, attrName) {
  const rowH = DROPDOWN_ROW_PX;
  const win = DROPDOWN_VISIBLE_ROWS;
  const start = Math.max(0, Math.floor(scrollTop / rowH) - 1);
  const end = Math.min(items.length, start + win + 2);
  const topPad = start * rowH;
  const bottomPad = Math.max(0, (items.length - end) * rowH);
  const rows = items
    .slice(start, end)
    .map((item) => {
      const key = rowKey(item);
      const label = rowLabel(item);
      const on = selected.has(key);
      return `<div class="auto-bm-row" style="min-height:${rowH}px">
        <label class="auto-bm-toggle">
          <span>${escapeHtml(label)}</span>
          <input type="checkbox" ${attrName}="${escapeAttr(key)}" ${on ? "checked" : ""} />
          <span class="auto-bm-switch" aria-hidden="true"></span>
        </label>
      </div>`;
    })
    .join("");
  bodyEl.innerHTML = `<div class="ad-form-bm-dropdown__spacer" style="height:${topPad}px"></div>${rows}<div class="ad-form-bm-dropdown__spacer" style="height:${bottomPad}px"></div>`;
  bodyEl.style.setProperty("--ad-form-bm-list-height", `${items.length * rowH}px`);
}

function mountSearchFlatPicker(select, title, options, panelClass, unit = "db") {
  let selected = "";

  mountSearchDropdownPicker(select, {
    title,
    panelClass,
    unit,
    singleSelect: true,
    disabledMessage: "Nincs találat",
    syncFromHidden() {
      const raw = select._adBmHidden?.value ?? "";
      selected = readSingleStoredValue(raw);
      if (raw.trim().startsWith("[")) writePlainValue(select, selected);
    },
    syncHidden() {
      writePlainValue(select, selected);
    },
    getSummary() {
      return selected || PLACEHOLDER;
    },
    getFilteredItems(query) {
      const q = query.trim().toLocaleLowerCase("hu");
      if (!q) return options;
      return options.filter((opt) => opt.toLocaleLowerCase("hu").includes(q));
    },
    renderRows(bodyEl, items, scrollTop) {
      const selectedSet = new Set(selected ? [selected] : []);
      renderWindowedToggleRows(
        bodyEl,
        items,
        scrollTop,
        (item) => String(item),
        (item) => String(item),
        selectedSet,
        "data-ad-bm-flat"
      );
    },
    bindBody(bodyEl) {
      bodyEl.onchange = (event) => {
        const el = event.target.closest("[data-ad-bm-flat]");
        if (!el) return;
        const opt = el.getAttribute("data-ad-bm-flat") ?? "";
        if (el.checked) selected = opt;
        else if (selected === opt) selected = "";
        writePlainValue(select, selected);
        updateBmSearchTrigger(select, selected, Boolean(selected));
        select._adBmRefreshDropdown?.();
      };
    },
  });
}

function mountFlatPicker(select, title, options, panelClass, openAttr) {
  if (!select || select.tagName !== "SELECT" || select.dataset.adBmPicker === "1") return;

  const field = anchorField(select);
  if (!field) return;

  unmountPicker(select);
  hideNativeSelect(select);
  const hidden = ensurePlainHiddenInput(select);

  let selected = "";

  const wrap = document.createElement("div");
  wrap.className = "ad-form-bm-field ad-form-bm-field--dropdown ad-form-bm-field--flat auto-bm-field";
  wrap.dataset.adBmFor = select.id;
  wrap.innerHTML = `
    <button type="button" class="auto-bm-trigger" ${openAttr}>
      <span data-ad-bm-summary>${escapeHtml(PLACEHOLDER)}</span>
      <span class="auto-bm-trigger__chev" aria-hidden="true">⌄</span>
    </button>
  `;
  select.insertAdjacentElement("beforebegin", wrap);
  stashNativeSelect(select, wrap);

  const summaryEl = wrap.querySelector("[data-ad-bm-summary]");
  const openBtn = wrap.querySelector(`[${openAttr}]`);

  const dropdown = document.createElement("div");
  dropdown.className = `auto-bm-panel ad-form-bm-panel ad-form-bm-dropdown ${panelClass}`;
  dropdown.hidden = true;
  dropdown.setAttribute("role", "listbox");
  dropdown.setAttribute("aria-label", title);
  dropdown.innerHTML = `<div class="ad-form-bm-dropdown__body auto-bm-panel__body" data-ad-bm-body></div>`;
  wrap.appendChild(dropdown);
  select._adBmPanel = dropdown;
  const bodyEl = dropdown.querySelector("[data-ad-bm-body]");

  function syncFromHidden() {
    const raw = select._adBmHidden?.value ?? "";
    selected = readSingleStoredValue(raw);
    if (raw.trim().startsWith("[")) writePlainValue(select, selected);
  }

  function refreshSummary() {
    if (summaryEl) summaryEl.textContent = selected || PLACEHOLDER;
    wrap.classList.toggle("has-value", Boolean(selected));
  }

  function renderBody() {
    const rows = options
      .map((opt) => {
        const on = selected === opt;
        return `<div class="auto-bm-row">
            <label class="auto-bm-toggle">
              <span>${escapeHtml(opt)}</span>
              <input type="checkbox" data-ad-bm-flat="${escapeAttr(opt)}" ${on ? "checked" : ""} />
              <span class="auto-bm-switch" aria-hidden="true"></span>
            </label>
          </div>`;
      })
      .join("");
    bodyEl.innerHTML = rows
      ? `<div class="auto-bm-group">${rows}</div>`
      : `<p class="ad-form-bm-empty">Nincs találat</p>`;
  }

  function bindBody() {
    bodyEl.onchange = (event) => {
      const el = event.target.closest("[data-ad-bm-flat]");
      if (!el) return;
      const opt = el.getAttribute("data-ad-bm-flat") ?? "";
      if (el.checked) selected = opt;
      else if (selected === opt) selected = "";
      writePlainValue(select, selected);
      renderBody();
      refreshSummary();
    };
  }

  function positionDropdown() {
    const rect = wrap.getBoundingClientRect();
    dropdown.classList.add("ad-form-bm-dropdown--portaled");
    dropdown.style.position = "fixed";
    dropdown.style.top = `${Math.round(rect.bottom + 4)}px`;
    dropdown.style.left = `${Math.round(rect.left)}px`;
    dropdown.style.width = `${Math.round(rect.width)}px`;
    dropdown.style.right = "auto";
    dropdown.style.bottom = "auto";
  }

  function attachDropdownPortal() {
    if (dropdown.parentElement !== document.body) document.body.appendChild(dropdown);
    positionDropdown();
  }

  function detachDropdownPortal() {
    dropdown.classList.remove("ad-form-bm-dropdown--portaled");
    dropdown.style.removeProperty("position");
    dropdown.style.removeProperty("top");
    dropdown.style.removeProperty("left");
    dropdown.style.removeProperty("width");
    dropdown.style.removeProperty("right");
    dropdown.style.removeProperty("bottom");
    if (dropdown.parentElement !== wrap) wrap.appendChild(dropdown);
  }

  function onViewportChange() {
    if (dropdown.hidden || dropdown.classList.contains("is-closed")) return;
    positionDropdown();
  }

  function closeDropdown() {
    field.classList.remove("is-open");
    wrap.classList.remove("is-open");
    dropdown.hidden = true;
    dropdown.style.setProperty("display", "none", "important");
    dropdown.classList.add("is-closed");
    detachDropdownPortal();
    window.removeEventListener("scroll", onViewportChange, true);
    window.removeEventListener("resize", onViewportChange);
    unregisterOpenPanel(closeDropdown);
    syncFromHidden();
    writePlainValue(select, selected);
    refreshSummary();
  }

  function openDropdown() {
    ["gyartmany", "modell", "uzemanyag", "okmany_jelleg", "allapot", "kivitel", "forgalomba_helyezes_ev", "forgalomba_helyezes_honap"].forEach((id) => {
      const other = document.getElementById(id);
      if (!other || other === select) return;
      if (autoBmPanelIsOpen(other._adBmPanel) && typeof other._adBmClose === "function") other._adBmClose();
    });
    registerOpenPanel(closeDropdown);
    syncFromHidden();
    renderBody();
    bindBody();
    field.classList.add("is-open");
    wrap.classList.add("is-open");
    dropdown.hidden = false;
    dropdown.style.removeProperty("display");
    dropdown.classList.remove("is-closed");
    attachDropdownPortal();
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
  }

  openBtn?.addEventListener("click", () => {
    if (!dropdown.hidden && !dropdown.classList.contains("is-closed")) closeDropdown();
    else openDropdown();
  });

  dropdown.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  bindAutoBmDismiss({
    panel: dropdown,
    roots: [wrap, openBtn],
    isOpen: () => autoBmPanelIsOpen(dropdown),
    close: closeDropdown,
  });

  hidden.addEventListener("change", refreshSummary);
  syncFromHidden();
  refreshSummary();

  select.dataset.adBmPicker = "1";
  select._adBmClose = closeDropdown;
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

function mountBrandPicker(select, catalog) {
  const brands = [...(catalog?.gyartmanyok || [])].sort((a, b) => a.localeCompare(b, "hu", { sensitivity: "base" }));
  let selected = "";
  let query = "";

  function matchingBrands() {
    const q = query.trim().toLocaleLowerCase("hu");
    if (!q) return brands;
    return brands.filter((brand) => brand.toLocaleLowerCase("hu").includes(q));
  }

  mountSearchDropdownPicker(select, {
    title: "Gyártmány",
    panelClass: "ad-form-brand-panel",
    unit: "márka",
    singleSelect: true,
    disabledMessage: "Nincs találat",
    syncFromHidden() {
      const raw = select._adBmHidden?.value ?? "";
      selected = readSingleStoredValue(raw).toUpperCase();
      if (raw.trim().startsWith("[")) writePlainValue(select, selected);
    },
    syncHidden() {
      writePlainValue(select, selected);
    },
    getSummary() {
      return selected || PLACEHOLDER;
    },
    getFilteredItems: matchingBrands,
    renderRows(bodyEl, items, scrollTop) {
      const selectedSet = new Set(selected ? [selected] : []);
      renderWindowedToggleRows(
        bodyEl,
        items,
        scrollTop,
        (item) => String(item),
        (item) => String(item),
        selectedSet,
        "data-ad-bm-brand"
      );
    },
    bindBody(bodyEl) {
      bodyEl.onchange = (event) => {
        const el = event.target.closest("[data-ad-bm-brand]");
        if (!el) return;
        const brand = el.getAttribute("data-ad-bm-brand") ?? "";
        if (el.checked) selected = brand;
        else if (selected === brand) selected = "";
        writePlainValue(select, selected);
        updateBmSearchTrigger(select, selected, Boolean(selected));
        select._adBmRefreshDropdown?.();
        document.getElementById("modell")?._adBmOnBrandChange?.();
      };
    },
    onQueryChange(next) {
      query = next;
    },
  });
}

function mountModelPicker(select, catalog) {
  let selected = "";
  let query = "";

  function selectedBrand() {
    const gyartmany = document.getElementById("gyartmany");
    const raw = gyartmany?._adBmHidden?.value ?? gyartmany?.value ?? "";
    return readSingleStoredValue(raw).toUpperCase();
  }

  function modelOptions() {
    const brand = selectedBrand();
    if (!brand) return [];
    return [...(catalog?.modellek?.[brand] || [])].sort((a, b) => a.localeCompare(b, "hu", { sensitivity: "base" }));
  }

  function matchingModels() {
    const q = query.trim().toLocaleLowerCase("hu");
    const options = modelOptions();
    if (!q) return options;
    return options.filter((model) => model.toLocaleLowerCase("hu").includes(q));
  }

  function pruneSelected() {
    const allowed = new Set(modelOptions());
    if (selected && !allowed.has(selected)) selected = "";
  }

  mountSearchDropdownPicker(select, {
    title: "Modell",
    panelClass: "ad-form-model-panel",
    unit: "modell",
    singleSelect: true,
    disabledMessage: "Először válassz gyártmányt",
    isDisabled: () => !selectedBrand(),
    syncFromHidden() {
      const raw = select._adBmHidden?.value ?? "";
      selected = readSingleStoredValue(raw);
      if (raw.trim().startsWith("[")) writePlainValue(select, selected);
      pruneSelected();
    },
    syncHidden() {
      writePlainValue(select, selected);
    },
    getSummary() {
      return selected || PLACEHOLDER;
    },
    getFilteredItems: matchingModels,
    renderRows(bodyEl, items, scrollTop) {
      const selectedSet = new Set(selected ? [selected] : []);
      renderWindowedToggleRows(
        bodyEl,
        items,
        scrollTop,
        (item) => String(item),
        (item) => String(item),
        selectedSet,
        "data-ad-bm-model"
      );
    },
    bindBody(bodyEl) {
      bodyEl.onchange = (event) => {
        const el = event.target.closest("[data-ad-bm-model]");
        if (!el) return;
        const model = el.getAttribute("data-ad-bm-model") ?? "";
        if (el.checked) selected = model;
        else if (selected === model) selected = "";
        writePlainValue(select, selected);
        updateBmSearchTrigger(select, selected, Boolean(selected));
        select._adBmRefreshDropdown?.();
      };
    },
    onQueryChange(next) {
      query = next;
    },
  });

  function onBrandChange() {
    pruneSelected();
    writePlainValue(select, selected);
    updateBmSearchTrigger(select, selected, Boolean(selected));
    if (autoBmPanelIsOpen(select._adBmPanel)) select._adBmRefreshDropdown?.();
  }

  select._adBmOnBrandChange = onBrandChange;
  document.getElementById("gyartmany")?._adBmHidden?.addEventListener("change", onBrandChange);
}

export function applyAdFormBmFieldValues(data) {
  if (!data || typeof data !== "object") return;
  const ids = [
    "allapot",
    "kivitel",
    "okmany_jelleg",
    "gyartmany",
    "modell",
    "uzemanyag",
    "forgalomba_helyezes_ev",
    "forgalomba_helyezes_honap",
  ];
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
    const value =
      list[0] ?? (raw != null && !Array.isArray(raw) ? readSingleStoredValue(String(raw)) : "");

    if (select._adBmHidden) {
      writePlainValue(select, value);
      if (select._adBmPanel?.classList.contains("ad-form-bm-dropdown")) {
        updateBmSearchTrigger(select, value, Boolean(value));
      } else {
        updateBmSummary(select, value || PLACEHOLDER, Boolean(value));
      }
    } else if (select.tagName === "SELECT" && value) {
      if (![...select.options].some((option) => option.value === value)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      }
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

/** @type {object | null} */
let cachedVehicleCatalog = null;

const BM_PICKER_FIELD_IDS = [
  "allapot",
  "kivitel",
  "okmany_jelleg",
  "gyartmany",
  "modell",
  "uzemanyag",
  "forgalomba_helyezes_ev",
  "forgalomba_helyezes_honap",
];

function snapshotBmPickerValues(form) {
  /** @type {Record<string, unknown>} */
  const snap = {};
  if (!form) return snap;
  for (const id of BM_PICKER_FIELD_IDS) {
    const select = document.getElementById(id);
    if (!select) continue;
    const hidden = select._adBmHidden;
    if (hidden?.value) {
      snap[id] = readSingleStoredValue(hidden.value);
      continue;
    }
    if (select.dataset.adBmRestoreList) {
      snap[id] = readSingleStoredValue(select.dataset.adBmRestoreList);
    } else if (select.value) {
      snap[id] = readSingleStoredValue(select.value);
    }
  }
  return snap;
}

export function unmountAdFormBmPickers(form) {
  if (!form) return;
  [
    "allapot",
    "kivitel",
    "okmany_jelleg",
    "gyartmany",
    "modell",
    "uzemanyag",
    "forgalomba_helyezes_ev",
    "forgalomba_helyezes_honap",
  ].forEach((id) => {
    const select = document.getElementById(id);
    if (select?._adBmClose) select._adBmClose();
    unmountPicker(select);
  });
  delete form?.dataset.adBmPickers;
}

export async function refreshAdFormBmPickers(form, catalog = null) {
  try {
    if (catalog) cachedVehicleCatalog = catalog;
    const snap = snapshotBmPickerValues(form);
    unmountAdFormBmPickers(form);
    await mountAdFormBmPickers(form, catalog || cachedVehicleCatalog);
    applyAdFormBmFieldValues(snap);
  } catch (error) {
    console.warn("Alapadatok kapcsolós panel frissítés:", error);
  }
}

export async function mountAdFormBmPickers(form, catalog = null) {
  if (!form) return;
  if (!isBmPickerAdForm(form)) {
    unmountAdFormBmPickers(form);
    return;
  }

  const allapot = document.getElementById("allapot");
  const kivitel = document.getElementById("kivitel");
  const okmany = document.getElementById("okmany_jelleg");
  const uzemanyag = document.getElementById("uzemanyag");
  const gyartmany = document.getElementById("gyartmany");
  const modell = document.getElementById("modell");

  if (allapot?.tagName === "SELECT" && allapot.dataset.adBmPicker !== "1") {
    mountFlatPicker(allapot, "Állapot", flattenAllapotOptions(), "ad-form-allapot-panel", "data-ad-bm-allapot-open");
  }
  if (kivitel?.tagName === "SELECT" && kivitel.dataset.adBmPicker !== "1") {
    mountFlatPicker(kivitel, "Kivitel", optionsFromSelect(kivitel), "ad-form-kivitel-panel", "data-ad-bm-kivitel-open");
  }
  if (okmany?.tagName === "SELECT" && okmany.dataset.adBmPicker !== "1") {
    mountSearchFlatPicker(
      okmany,
      "Okmányok jellege",
      OKMANY_JELLEG_OPTIONS,
      "ad-form-okmany-panel",
      "db"
    );
  }
  if (uzemanyag?.tagName === "SELECT" && uzemanyag.dataset.adBmPicker !== "1") {
    mountSearchFlatPicker(
      uzemanyag,
      "Üzemanyag",
      flattenUzemanyagOptions(),
      "ad-form-fuel-panel",
      "üzemanyag"
    );
  }

  const forgalombaEv = document.getElementById("forgalomba_helyezes_ev");
  const forgalombaHonap = document.getElementById("forgalomba_helyezes_honap");
  if (forgalombaEv?.tagName === "SELECT" && forgalombaEv.dataset.adBmPicker !== "1") {
    mountSingleSelectDropdown(forgalombaEv, {
      title: "Forgalomba helyezés éve",
      panelClass: "ad-form-year-panel",
      placeholder: "év",
    });
  }
  if (forgalombaHonap?.tagName === "SELECT" && forgalombaHonap.dataset.adBmPicker !== "1") {
    mountSingleSelectDropdown(forgalombaHonap, {
      title: "Forgalomba helyezés hónapja",
      panelClass: "ad-form-month-panel",
      placeholder: "hó",
    });
  }

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
