
import {
  ALLAPOT_CATEGORIES,
  KLIM_OPTIONS,
  OKMANY_JELLEG_OPTIONS,
  UZEMANYAG_CATEGORIES,
  flattenSebessegvaltoOptions,
  flattenUzemanyagOptions,
  flattenAllapotOptions,
} from "./equipment-data.js?v=5a39cb5ba3";
import { KIVITEL_OPTIONS } from "./kivitel-options.js?v=be03aefc2e";
import { fetchVehicleCatalog } from "./vehicle-catalog-client.js?v=5004d33efa";
import { bindAutoBmDismiss, autoBmPanelIsOpen } from "./auto-bm-dismiss.js?v=89aa460931";
import {
  VEHICLE_KARPIT_OPTIONS,
  VEHICLE_SZIN_OPTIONS,
  VEHICLE_TETTO_OPTIONS,
} from "./vehicle-appearance-options.js?v=0b7c078fa5";

const PLACEHOLDER = "Válasszon";
const DROPDOWN_VISIBLE_ROWS = 7;
const DROPDOWN_ROW_PX = 44;
const YEAR_SELECT_MIN = 1980;
const YEAR_SELECT_MAX = 2035;

const DC_TOLTO_OPTIONS = ["CCS", "CHAdeMO", "Egyéb"];

const AD_BM_SINGLE_DROPDOWN_SPECS = [
  { id: "gyartasi_ev", title: "Gyártási év", panelClass: "ad-form-year-panel", placeholder: "év", yearMax: null, skipSingleMount: true },
  { id: "gyartasi_honap", title: "Gyártási hónap", panelClass: "ad-form-month-panel", placeholder: "hó", skipSingleMount: true },
  {
    id: "muszaki_ev",
    title: "Műszaki vizsga érvényes – év",
    panelClass: "ad-form-muszaki-ev-panel",
    placeholder: "év",
    yearMax: YEAR_SELECT_MAX,
    skipSingleMount: true,
  },
  { id: "muszaki_honap", title: "Műszaki vizsga érvényes – hónap", panelClass: "ad-form-month-panel", placeholder: "hó", skipSingleMount: true },
  { id: "forgalomba_helyezes_ev", title: "Forgalomba helyezés éve", panelClass: "ad-form-year-panel", placeholder: "év", skipSingleMount: true },
  { id: "forgalomba_helyezes_honap", title: "Forgalomba helyezés hónapja", panelClass: "ad-form-month-panel", placeholder: "hó", skipSingleMount: true },
  { id: "tulajdonosok_szama", title: "Tulajdonosok száma", panelClass: "ad-form-tulaj-panel", placeholder: "Válasszon" },
  { id: "ajtok", title: "Ajtók száma", panelClass: "ad-form-ajtok-panel", placeholder: "Válasszon" },
  { id: "szemelyek", title: "Szállítható személyek száma", panelClass: "ad-form-szemelyek-panel", placeholder: "Válasszon" },
  { id: "szin", title: "Szín", panelClass: "ad-form-szin-panel", placeholder: "Válasszon" },
  { id: "karpit1", title: "Kárpit színe (1)", panelClass: "ad-form-karpit-panel", placeholder: "Válasszon" },
  { id: "karpit2", title: "Kárpit színe (2)", panelClass: "ad-form-karpit-panel", placeholder: "Válasszon" },
  { id: "tetto", title: "Tető", panelClass: "ad-form-tetto-panel", placeholder: "Válasszon" },
  { id: "klima", title: "Klíma", panelClass: "ad-form-klima-panel", placeholder: "Válasszon" },
  { id: "sebessegvalto", title: "Sebességváltó", panelClass: "ad-form-sebesseg-panel", placeholder: "Válasszon" },
  { id: "hajtas", title: "Hajtás", panelClass: "ad-form-hajtas-panel", placeholder: "Válasszon" },
  { id: "ac_tolto_csatlakozas", title: "AC töltőcsatlakozó típusa", panelClass: "ad-form-ac-tolto-panel", placeholder: "Válasszon" },
  { id: "dc_tolto_csatlakozas", title: "DC töltőcsatlakozó típusa", panelClass: "ad-form-dc-tolto-panel", placeholder: "Válasszon" },
  { id: "tolto_csatlakozas", title: "Töltőcsatlakozó", panelClass: "ad-form-tolto-panel", placeholder: "Válasszon" },
];

const AD_BM_PICKER_IDS = [
  "allapot",
  "kivitel",
  "okmany_jelleg",
  "gyartmany",
  "modell",
  "uzemanyag",
  ...AD_BM_SINGLE_DROPDOWN_SPECS.map((spec) => spec.id),
];

function ensureSelectOptions(select, values) {
  if (!select || select.tagName !== "SELECT") return;
  const seen = new Set([...select.options].map((option) => option.value).filter(Boolean));
  for (const value of values) {
    if (seen.has(value)) continue;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
    seen.add(value);
  }
}

/** Replace all non-empty options (drops stale hardcoded HTML values). */
function replaceSelectOptions(select, values, emptyLabel = "—") {
  if (!select || select.tagName !== "SELECT") return;
  const prev = String(select.value || "").trim();
  select.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = emptyLabel;
  select.appendChild(empty);
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
  if (prev && values.includes(prev)) select.value = prev;
}

function ensureYearSelectFilled(select, maxYear = new Date().getFullYear()) {
  if (!select || select.tagName !== "SELECT") return;
  const years = [...select.options].filter((o) => /^\d{4}$/.test(o.value));
  if (years.length >= 20) return;
  const prev = String(select.value || "");
  const cap = Math.max(maxYear, new Date().getFullYear());
  select.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "év";
  select.appendChild(empty);
  for (let year = cap; year >= YEAR_SELECT_MIN; year -= 1) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    select.appendChild(option);
  }
  select.value = [...select.options].some((o) => o.value === prev) ? prev : "";
}

function mountAdSingleDropdown(spec) {
  const select = document.getElementById(spec.id);
  if (!select || select.tagName !== "SELECT" || select.dataset.adBmPicker === "1") return;
  if (spec.skipSingleMount) return;
  if (spec.yearMax !== undefined) {
    ensureYearSelectFilled(
      select,
      spec.yearMax == null ? new Date().getFullYear() : spec.yearMax
    );
  }
  mountSingleSelectDropdown(select, {
    title: spec.title,
    panelClass: spec.panelClass,
    placeholder: spec.placeholder ?? PLACEHOLDER,
  });
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

function readSingleStoredValue(raw) {
  if (raw == null || raw === "") return "";
  return parseJsonList(String(raw))[0] ?? String(raw).trim();
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

const BM_PICKER_SUBTYPES = new Set(["szemelyauto", "kisteher", "teherauto"]);

function adFormSubtype(form) {
  return String(
    form?.elements.namedItem("hirdetes_alkategoria")?.value ??
      form?.elements.namedItem("jarmu_kategoria")?.value ??
      ""
  )
    .trim()
    .toLowerCase();
}

function catalogKindForAdForm(form) {
  const subtype = adFormSubtype(form);
  // 3,5-ig és 3,5-tól: soha személyautó márkalista (kisteher JSON, amíg nincs nehéz teher katalógus).
  if (subtype === "kisteher" || subtype === "teherauto") return "kisteher";
  return "szemelyauto";
}

export function isBmPickerAdForm(form) {
  if (!form) return false;
  const subtype = adFormSubtype(form);
  if (subtype) return BM_PICKER_SUBTYPES.has(subtype);

  const vertical = String(form.elements.namedItem("hirdetes_vertical")?.value ?? "")
    .trim()
    .toLowerCase();
  if (vertical === "ingatlan") return false;
  if (vertical === "teher") return true;
  return vertical === "auto" || vertical === "";
}

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
  return select?.closest(".labeled-field, .md-outlined, .ad-layout-item, .tire-row, .tire-block");
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
  if (!input) return;
  if (hasValue) {
    input.dataset.adBmEditing = "0";
    input.value = text;
    input.placeholder = PLACEHOLDER;
    wrap?.classList.toggle("has-value", true);
    return;
  }
  if (input.dataset.adBmEditing === "1") return;
  input.value = "";
  input.placeholder = PLACEHOLDER;
  wrap?.classList.toggle("has-value", false);
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

  const initial = parseJsonList(select.value);
  writeJsonList(hidden, initial);
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

  hidden.value = String(select.value ?? "");
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
  if (select.tagName === "SELECT") {
    const value = readSingleStoredValue(hidden.value);
    if (value) {
      if (![...select.options].some((option) => option.value === value)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      }
      select.value = value;
    }
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
  const id = select.id;
  if (id) {
    document.querySelectorAll(`.ad-form-bm-field[data-ad-bm-for="${CSS.escape?.(id) || id}"]`).forEach((el) => el.remove());
  } else {
    field?.querySelector(`.ad-form-bm-field[data-ad-bm-for="${select.id}"]`)?.remove();
  }
  select._adBmPanel?.remove();
  delete select._adBmPanel;
  delete select._adBmClose;
  delete select._adBmRefreshDropdown;
  delete select._adBmRefreshSummary;
  delete select._adBmOnBrandChange;
  delete select._adBmFillWheel;
  delete select.dataset.adBmPicker;
  delete select.dataset.adBmDrum;
  delete select.dataset.adBmMode;
}

function closeAdBmPicker(select) {
  if (select && typeof select._adBmClose === "function") select._adBmClose();
}

function resetBmDropdownBody(bodyEl) {
  if (!bodyEl) return;
  bodyEl.style.removeProperty("--ad-form-bm-list-height");
  bodyEl.replaceChildren();
}

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
  wrap.className = "ad-form-bm-field ad-form-bm-field--flat auto-bm-field ad-form-cell";
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
  panel.className = `auto-bm-panel ad-form-bm-panel ad-form-bm-dropdown ${panelClass}`;
  panel.hidden = true;
  panel.setAttribute("role", "listbox");
  panel.setAttribute("aria-label", title);
  panel.innerHTML = `<div class="ad-form-bm-dropdown__body auto-bm-panel__body" data-ad-bm-body></div>`;
  wrap.appendChild(panel);
  select._adBmPanel = panel;
  const bodyEl = panel.querySelector("[data-ad-bm-body]");

  function refreshSummary() {
    syncSummary(summaryEl, hidden);
    wrap.classList.toggle(
      "has-value",
      singleSelect ? Boolean(readSingleStoredValue(hidden.value)) : parseJsonList(hidden.value).length > 0
    );
  }

  function positionPanel() {
    const rect = wrap.getBoundingClientRect();
    panel.classList.add("ad-form-bm-dropdown--portaled");
    panel.style.position = "fixed";
    panel.style.top = `${Math.round(rect.bottom + 4)}px`;
    panel.style.left = `${Math.round(rect.left)}px`;
    panel.style.width = `${Math.round(rect.width)}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  function attachPanelPortal() {
    if (panel.parentElement !== document.body) document.body.appendChild(panel);
    positionPanel();
  }

  function detachPanelPortal() {
    panel.classList.remove("ad-form-bm-dropdown--portaled");
    panel.style.removeProperty("position");
    panel.style.removeProperty("top");
    panel.style.removeProperty("left");
    panel.style.removeProperty("width");
    panel.style.removeProperty("right");
    panel.style.removeProperty("bottom");
    if (panel.parentElement !== wrap) wrap.appendChild(panel);
  }

  function onViewportChange() {
    if (panel.hidden || panel.classList.contains("is-closed")) return;
    positionPanel();
  }

  function closePanel() {
    field.classList.remove("is-open");
    wrap.classList.remove("is-open");
    panel.hidden = true;
    panel.style.setProperty("display", "none", "important");
    panel.classList.add("is-closed");
    detachPanelPortal();
    window.removeEventListener("scroll", onViewportChange, true);
    window.removeEventListener("resize", onViewportChange);
    unregisterOpenPanel(closePanel);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    syncHidden();
    refreshSummary();
  }

  function openPanel() {
    [
      "gyartmany",
      "modell",
      "uzemanyag",
      "okmany_jelleg",
      "allapot",
      "kivitel",
      "ajtok",
      "szemelyek",
      "szin",
      "karpit1",
      "karpit2",
      "tetto",
      "klima",
      "forgalomba_helyezes_ev",
      "forgalomba_helyezes_honap",
    ].forEach((id) => {
      const other = document.getElementById(id);
      if (!other || other === select) return;
      if (autoBmPanelIsOpen(other._adBmPanel) && typeof other._adBmClose === "function") other._adBmClose();
    });
    registerOpenPanel(closePanel);
    syncFromHidden();
    renderBody(bodyEl);
    bindBody(bodyEl);
    attachPanelPortal();
    field.classList.add("is-open");
    wrap.classList.add("is-open");
    panel.classList.remove("is-closed");
    panel.hidden = false;
    panel.style.removeProperty("display");
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
  }

  openBtn?.addEventListener("click", () => {
    if (!panel.hidden && !panel.classList.contains("is-closed")) closePanel();
    else openPanel();
  });

  panel.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  bindAutoBmDismiss({
    panel,
    roots: [wrap, openBtn],
    isOpen: () => autoBmPanelIsOpen(panel),
    close: closePanel,
  });

  hidden.addEventListener("change", refreshSummary);

  const formEl = select.closest("form");
  const stored = formEl?._bymyLastFormData?.[select.id];
  if (stored != null && String(stored).trim() && !readSingleStoredValue(hidden.value)) {
    writePlainValue(select, readSingleStoredValue(String(stored)));
  }

  syncFromHidden();
  refreshSummary();

  select.dataset.adBmPicker = "1";
  select._adBmClose = closePanel;
  select._adBmSyncFromValue = (value) => {
    const next = readSingleStoredValue(String(value ?? ""));
    writePlainValue(select, next);
    syncFromHidden();
    refreshSummary();
  };
}

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
    onClose,
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
  wrap.className = "ad-form-bm-field ad-form-bm-field--dropdown auto-bm-field ad-form-cell";
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
    [
      "gyartmany",
      "modell",
      "uzemanyag",
      "okmany_jelleg",
      "allapot",
      "kivitel",
      "ajtok",
      "szemelyek",
      "szin",
      "karpit1",
      "karpit2",
      "tetto",
      "klima",
      "forgalomba_helyezes_ev",
      "forgalomba_helyezes_honap",
    ].forEach((id) => {
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
    onClose?.();
    syncHidden();
    refreshTrigger();
    resetBmDropdownBody(bodyEl);
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
    if (
      !force &&
      nextStart === lastWindowStart &&
      bodyEl.querySelector(
        "[data-ad-bm-flat], [data-ad-bm-brand], [data-ad-bm-model], [data-ad-bm-fuel-child], [data-ad-bm-open-group]"
      )
    ) {
      return;
    }
    lastWindowStart = nextStart;
    renderRows(bodyEl, items, scrollTop);
    bindBody(bodyEl);
  }

  select._adBmRender = () => {
    lastWindowStart = -1;
    renderList(true);
  };

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
  refreshTrigger();

  select.dataset.adBmPicker = "1";
  select._adBmClose = closeDropdown;
  select._adBmRefreshDropdown = () => renderList(true);
}

function mountSingleSelectDropdown(select, { title, panelClass, placeholder = PLACEHOLDER } = {}) {
  if (!select || select.tagName !== "SELECT" || select.dataset.adBmPicker === "1") return;

  const field = anchorField(select);
  if (!field) return;

  unmountPicker(select);
  hideNativeSelect(select);
  const hidden = ensurePlainHiddenInput(select);

  /** Élő olvasás — ne mount-kori üres snapshot (évlista race). */
  function readOptions() {
    const fromSelect = [...select.options]
      .filter((option) => option.value !== "")
      .map((option) => ({
        value: option.value,
        label: option.textContent?.trim() || option.value,
      }));
    if (fromSelect.length) return fromSelect;
    // utolsó menedék évmezőkre
    if (/_ev$/.test(select.id) || select.id === "gyartasi_ev") {
      const max = select.id === "muszaki_ev" ? YEAR_SELECT_MAX : new Date().getFullYear();
      const out = [];
      for (let y = max; y >= YEAR_SELECT_MIN; y -= 1) {
        out.push({ value: String(y), label: String(y) });
      }
      return out;
    }
    return fromSelect;
  }

  let selected = "";
  let query = "";
  let scrollTop = 0;
  let lastWindowStart = -1;

  const wrap = document.createElement("div");
  wrap.className = "ad-form-bm-field ad-form-bm-field--dropdown ad-form-bm-field--single auto-bm-field ad-form-cell";
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
    const options = readOptions();
    const q = query.trim().toLocaleLowerCase("hu");
    if (!q) return options;
    return options.filter(
      (item) =>
        item.label.toLocaleLowerCase("hu").includes(q) || item.value.toLocaleLowerCase("hu").includes(q)
    );
  }

  function refreshTrigger() {
    if (!input) return;
    if (selected) {
      input.dataset.adBmEditing = "0";
      const opt = readOptions().find((item) => item.value === selected);
      input.value = opt?.label || selected;
      input.placeholder = placeholder;
      wrap.classList.toggle("has-value", true);
      return;
    }
    if (input.dataset.adBmEditing === "1") return;
    input.value = "";
    input.placeholder = placeholder;
    wrap.classList.toggle("has-value", false);
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
      enforceSingleToggleChecks(bodyEl, "data-ad-bm-single", selected);
      refreshTrigger();
      renderList(true);
      if (el.checked && selected) closeAdBmPicker(select);
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
      "ajtok",
      "szemelyek",
      "szin",
      "karpit1",
      "karpit2",
      "tetto",
      "klima",
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
    resetBmDropdownBody(bodyEl);
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

function enforceSingleToggleChecks(bodyEl, attrName, selectedValue) {
  bodyEl.querySelectorAll(`[${attrName}]`).forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.checked = input.getAttribute(attrName) === selectedValue;
  });
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
        enforceSingleToggleChecks(bodyEl, "data-ad-bm-flat", selected);
        updateBmSearchTrigger(select, selected || PLACEHOLDER, Boolean(selected));
        select._adBmRefreshDropdown?.();
        closeAdBmPicker(select);
      };
    },
  });
}

function mountFlatPicker(select, title, options, panelClass, openAttr) {
  let selected = "";

  mountBmPicker({
    select,
    title,
    panelClass,
    openAttr,
    singleSelect: true,
    syncFromHidden() {
      const raw = select._adBmHidden?.value ?? "";
      selected = readSingleStoredValue(raw);
      if (raw.trim().startsWith("[")) writePlainValue(select, selected);
    },
    syncSummary(summaryEl) {
      if (summaryEl) summaryEl.textContent = selected || PLACEHOLDER;
    },
    syncHidden() {
      writePlainValue(select, selected);
    },
    renderBody(bodyEl) {
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
      bodyEl.innerHTML = `<div class="auto-bm-group">${rows}</div>`;
    },
    bindBody(bodyEl) {
      bodyEl.onchange = (event) => {
        const el = event.target.closest("[data-ad-bm-flat]");
        if (!el) return;
        const opt = el.getAttribute("data-ad-bm-flat") ?? "";
        if (el.checked) selected = opt;
        else if (selected === opt) selected = "";
        writePlainValue(select, selected);
        enforceSingleToggleChecks(bodyEl, "data-ad-bm-flat", selected);
        updateBmSummary(select, selected || PLACEHOLDER, Boolean(selected));
        closeAdBmPicker(select);
      };
    },
  });
}

function mountAllapotPicker(select) {
  let openMains = new Set();
  let selected = "";

  function labelForValue(value) {
    if (!value) return "";
    for (const cat of ALLAPOT_CATEGORIES) {
      if (cat.value === value) return cat.label;
      const child = cat.children?.find((c) => c.value === value);
      if (child) return child.label;
    }
    return value;
  }

  function syncOpenFromValues() {
    openMains.clear();
    if (!selected) return;
    for (const cat of ALLAPOT_CATEGORIES) {
      if (cat.value === selected || cat.children?.some((c) => c.value === selected)) {
        openMains.add(cat.id);
      }
    }
  }

  function visibleChildren(cat) {
    return (cat.children ?? []).filter((child) => child.label !== cat.label && child.value !== cat.label);
  }

  function turnMainOn(cat) {
    openMains.clear();
    openMains.add(cat.id);
    if (!cat.children?.length && cat.value) {
      selected = cat.value;
      return;
    }
    const sameChild = cat.children?.find((child) => child.label === cat.label || child.value === cat.label);
    selected = sameChild?.value ?? "";
  }

  function turnMainOff(cat) {
    openMains.delete(cat.id);
    if (cat.value === selected || cat.children?.some((c) => c.value === selected)) {
      selected = "";
    }
  }

  function renderAllapotBody(bodyEl) {
    const rows = ALLAPOT_CATEGORIES.map((cat) => {
      const on = openMains.has(cat.id);
      const hasKids = Boolean(cat.children?.length);
      let kidsHtml = "";
      if (hasKids && on) {
        kidsHtml = `<div class="auto-fuel-children">
          ${visibleChildren(cat)
            .map((child) => {
              const childOn = selected === child.value;
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
      const mainOn = !hasKids ? selected === cat.value : on;
      return `<div class="auto-bm-row auto-fuel-main-row" data-ad-bm-allapot-main="${escapeAttr(cat.id)}">
        <label class="auto-bm-toggle auto-fuel-main-toggle">
          <span class="auto-fuel-main-label">${escapeHtml(cat.label)}</span>
          <input type="checkbox" data-ad-bm-allapot-main-toggle="${escapeAttr(cat.id)}" ${mainOn ? "checked" : ""} />
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
    singleSelect: true,
    syncFromHidden() {
      const raw = select._adBmHidden?.value ?? "";
      selected = readSingleStoredValue(raw);
      if (raw.trim().startsWith("[")) writePlainValue(select, selected);
      syncOpenFromValues();
    },
    syncSummary(summaryEl) {
      if (summaryEl) summaryEl.textContent = labelForValue(selected) || PLACEHOLDER;
    },
    syncHidden() {
      writePlainValue(select, selected);
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
          writePlainValue(select, selected);
          updateBmSummary(select, labelForValue(selected) || PLACEHOLDER, Boolean(selected));
          if (!cat.children?.length && selected) closeAdBmPicker(select);
          return;
        }

        const childEl = event.target.closest("[data-ad-bm-allapot-child]");
        if (!childEl) return;
        const value = childEl.getAttribute("data-ad-bm-allapot-child") ?? "";
        const parentId = childEl.getAttribute("data-ad-bm-allapot-parent") ?? "";
        if (childEl.checked) {
          selected = value;
          openMains.clear();
          if (parentId) openMains.add(parentId);
        } else if (selected === value) {
          selected = "";
        }
        renderAllapotBody(bodyEl);
        writePlainValue(select, selected);
        updateBmSummary(select, labelForValue(selected) || PLACEHOLDER, Boolean(selected));
        if (childEl.checked && selected) closeAdBmPicker(select);
      };
    },
  });
}

function mountHierarchicalPicker(select, { title, panelClass, openAttr, categories, attrMain, attrChild, attrParent, unit }) {
  let openMains = new Set();
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
  let openMains = new Set();
  let selected = "";
  let query = "";

  function labelForValue(value) {
    if (!value) return "";
    for (const cat of UZEMANYAG_CATEGORIES) {
      if (cat.value === value) return cat.label;
      const child = cat.children?.find((c) => c.value === value);
      if (child) return child.label;
    }
    return value;
  }

  function syncOpenFromValues() {
    openMains.clear();
    if (!selected) return;
    for (const cat of UZEMANYAG_CATEGORIES) {
      if (cat.value === selected || cat.children?.some((c) => c.value === selected)) {
        openMains.add(cat.id);
      }
    }
  }

  function turnMainOn(cat) {
    openMains.clear();
    openMains.add(cat.id);
    selected = !cat.children?.length && cat.value ? cat.value : "";
  }

  function turnMainOff(cat) {
    openMains.delete(cat.id);
    if (cat.value === selected || cat.children?.some((c) => c.value === selected)) {
      selected = "";
    }
  }

  function fuelMatchesQuery(cat, q) {
    if (!q) return true;
    if (cat.label.toLocaleLowerCase("hu").includes(q)) return true;
    return cat.children?.some((child) => child.label.toLocaleLowerCase("hu").includes(q)) ?? false;
  }

  function renderFuelBody(bodyEl) {
    const q = query.trim().toLocaleLowerCase("hu");
    const rows = UZEMANYAG_CATEGORIES.filter((cat) => fuelMatchesQuery(cat, q))
      .map((cat) => {
        const on = openMains.has(cat.id);
        const hasKids = Boolean(cat.children?.length);
        let kidsHtml = "";
        if (hasKids && on) {
          kidsHtml = `<div class="auto-fuel-children">
            ${cat.children
              .filter((child) => !q || child.label.toLocaleLowerCase("hu").includes(q))
              .map((child) => {
                const childOn = selected === child.value;
                return `<div class="auto-bm-row auto-fuel-child-row">
                  <label class="auto-bm-toggle">
                    <span>${escapeHtml(child.label)}</span>
                    <input type="checkbox" data-ad-bm-fuel-child="${escapeAttr(child.value)}" data-ad-bm-fuel-parent="${escapeAttr(cat.id)}" ${childOn ? "checked" : ""} />
                    <span class="auto-bm-switch" aria-hidden="true"></span>
                  </label>
                </div>`;
              })
              .join("")}
          </div>`;
        }
        const mainOn = !hasKids ? selected === cat.value : on;
        return `<div class="auto-bm-row auto-fuel-main-row">
          <label class="auto-bm-toggle auto-fuel-main-toggle">
            <span class="auto-fuel-main-label">${escapeHtml(cat.label)}</span>
            <input type="checkbox" data-ad-bm-fuel-main-toggle="${escapeAttr(cat.id)}" ${mainOn ? "checked" : ""} />
            <span class="auto-bm-switch" aria-hidden="true"></span>
          </label>
          ${kidsHtml}
        </div>`;
      })
      .join("");
    bodyEl.innerHTML = rows
      ? `<div class="auto-bm-group">${rows}</div>`
      : `<p class="ad-form-bm-empty">Nincs találat</p>`;
  }

  mountSearchDropdownPicker(select, {
    title: "Üzemanyag",
    panelClass: "ad-form-fuel-panel",
    unit: "üzemanyag",
    singleSelect: true,
    disabledMessage: "Nincs találat",
    syncFromHidden() {
      const raw = select._adBmHidden?.value ?? "";
      selected = normalizePrimaryValue(select, readSingleStoredValue(raw));
      if (raw.trim().startsWith("[")) writePlainValue(select, selected);
      syncOpenFromValues();
    },
    syncHidden() {
      writePlainValue(select, selected);
    },
    getSummary() {
      return labelForValue(selected) || PLACEHOLDER;
    },
    getFilteredItems() {
      return UZEMANYAG_CATEGORIES;
    },
    renderRows(bodyEl) {
      renderFuelBody(bodyEl);
    },
    bindBody(bodyEl) {
      bodyEl.onchange = (event) => {
        const mainEl = event.target.closest("[data-ad-bm-fuel-main-toggle]");
        if (mainEl) {
          const id = mainEl.getAttribute("data-ad-bm-fuel-main-toggle");
          const cat = UZEMANYAG_CATEGORIES.find((c) => c.id === id);
          if (!cat) return;
          if (mainEl.checked) turnMainOn(cat);
          else turnMainOff(cat);
          renderFuelBody(bodyEl);
          writePlainValue(select, selected);
          updateBmSearchTrigger(select, labelForValue(selected) || PLACEHOLDER, Boolean(selected));
          window.dispatchEvent(new Event("ad-form-sync-fuel-fields"));
          if (!cat.children?.length && selected) closeAdBmPicker(select);
          return;
        }

        const childEl = event.target.closest("[data-ad-bm-fuel-child]");
        if (!childEl) return;
        const value = childEl.getAttribute("data-ad-bm-fuel-child") ?? "";
        const parentId = childEl.getAttribute("data-ad-bm-fuel-parent") ?? "";
        if (childEl.checked) {
          selected = value;
          openMains.clear();
          if (parentId) openMains.add(parentId);
        } else if (selected === value) {
          selected = "";
        }
        renderFuelBody(bodyEl);
        writePlainValue(select, selected);
        updateBmSearchTrigger(select, labelForValue(selected) || PLACEHOLDER, Boolean(selected));
        window.dispatchEvent(new Event("ad-form-sync-fuel-fields"));
        if (childEl.checked && selected) closeAdBmPicker(select);
      };
    },
    onQueryChange(next) {
      query = next;
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
        enforceSingleToggleChecks(bodyEl, "data-ad-bm-brand", selected);
        updateBmSearchTrigger(select, selected || PLACEHOLDER, Boolean(selected));
        const modell = document.getElementById("modell");
        modell?._adBmOnBrandChange?.();
        closeAdBmPicker(select);
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
  /** null = top models; string = open almenü group name */
  let openGroup = null;

  function selectedBrand() {
    const gyartmany = document.getElementById("gyartmany");
    const raw = gyartmany?._adBmHidden?.value ?? "";
    return readSingleStoredValue(raw).toUpperCase();
  }

  function modelTree() {
    const brand = selectedBrand();
    if (!brand) return [];
    const tree = catalog?.modellekTree?.[brand];
    if (Array.isArray(tree) && tree.length) {
      return [...tree].sort((a, b) => a.name.localeCompare(b.name, "hu", { sensitivity: "base" }));
    }
    return [...(catalog?.modellek?.[brand] || [])]
      .sort((a, b) => a.localeCompare(b, "hu", { sensitivity: "base" }))
      .map((name) => ({ name, children: [], postRequiresChild: false }));
  }

  function flatAllowedNames() {
    const names = [];
    for (const node of modelTree()) {
      if (node?.name) names.push(node.name);
      for (const child of node.children || []) {
        if (child?.name) names.push(child.name);
      }
    }
    return names;
  }

  function matchingTopModels() {
    const q = query.trim().toLocaleLowerCase("hu");
    const options = modelTree();
    if (!q) return options;
    return options.filter((node) => {
      if (node.name.toLocaleLowerCase("hu").includes(q)) return true;
      return (node.children || []).some((c) => c.name.toLocaleLowerCase("hu").includes(q));
    });
  }

  function matchingGroupChildren() {
    const group = modelTree().find((n) => n.name === openGroup);
    const kids = [...(group?.children || [])].sort((a, b) =>
      a.name.localeCompare(b.name, "hu", { sensitivity: "base" })
    );
    const q = query.trim().toLocaleLowerCase("hu");
    if (!q) return kids;
    return kids.filter((c) => c.name.toLocaleLowerCase("hu").includes(q));
  }

  function pruneSelected() {
    const allowed = new Set(flatAllowedNames());
    if (selected && !allowed.has(selected)) selected = "";
  }

  function selectModel(model, node) {
    if (node?.postRequiresChild || (node?.children?.length && !openGroup)) {
      openGroup = node.name;
      select._adBmRender?.();
      return;
    }
    selected = model;
    writePlainValue(select, selected);
    updateBmSearchTrigger(select, selected || PLACEHOLDER, Boolean(selected));
    closeAdBmPicker(select);
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
      openGroup = null;
    },
    syncHidden() {
      writePlainValue(select, selected);
    },
    getSummary() {
      return selected || PLACEHOLDER;
    },
    getFilteredItems: () => (openGroup ? matchingGroupChildren() : matchingTopModels()),
    renderRows(bodyEl, items) {
      if (openGroup) {
        const back = `<button type="button" class="auto-bm-subrow" data-ad-bm-model-back>
          <span>‹ Vissza a modellekhez</span>
          <span class="auto-bm-subrow__val">${escapeHtml(openGroup)}</span>
        </button>`;
        bodyEl.innerHTML =
          back +
          (items
            .map((child) => {
              const name = child.name;
              const on = selected === name;
              return `<div class="auto-bm-row">
              <label class="auto-bm-toggle">
                <span>${escapeHtml(name)}</span>
                <input type="checkbox" data-ad-bm-model="${escapeAttr(name)}" ${on ? "checked" : ""} />
                <span class="auto-bm-switch" aria-hidden="true"></span>
              </label>
            </div>`;
            })
            .join("") || `<p class="auto-bm-empty">Nincs altípus.</p>`);
        return;
      }
      bodyEl.innerHTML =
        items
          .map((node) => {
            const name = node.name;
            const kids = node.children || [];
            const requires = Boolean(node.postRequiresChild || kids.length);
            const on = selected === name || kids.some((c) => c.name === selected);
            const childBtn = requires
              ? `<button type="button" class="auto-bm-subrow" data-ad-bm-open-group="${escapeAttr(name)}">
                  <span>Almenü (${kids.length})</span>
                  <span class="auto-bm-subrow__val">${
                    kids.some((c) => c.name === selected)
                      ? escapeHtml(kids.find((c) => c.name === selected).name)
                      : "Válassz"
                  }</span>
                </button>`
              : "";
            return `<div class="auto-bm-row">
              <label class="auto-bm-toggle">
                <span>${escapeHtml(name)}</span>
                <input type="checkbox" data-ad-bm-model="${escapeAttr(name)}" data-ad-bm-requires-child="${
                  requires ? "1" : "0"
                }" ${on && !requires ? "checked" : ""} ${requires ? "disabled" : ""} />
                <span class="auto-bm-switch" aria-hidden="true"></span>
              </label>
              ${childBtn}
            </div>`;
          })
          .join("") || `<p class="auto-bm-empty">Nincs modell ehhez a gyártmányhoz.</p>`;
    },
    bindBody(bodyEl) {
      bodyEl.onclick = (event) => {
        if (event.target.closest("[data-ad-bm-model-back]")) {
          openGroup = null;
          select._adBmRender?.();
          return;
        }
        const groupBtn = event.target.closest("[data-ad-bm-open-group]");
        if (groupBtn) {
          openGroup = groupBtn.getAttribute("data-ad-bm-open-group") || "";
          select._adBmRender?.();
        }
      };
      bodyEl.onchange = (event) => {
        const el = event.target.closest("[data-ad-bm-model]");
        if (!el) return;
        const model = el.getAttribute("data-ad-bm-model") ?? "";
        const requires = el.getAttribute("data-ad-bm-requires-child") === "1";
        if (requires) {
          el.checked = false;
          const node = modelTree().find((n) => n.name === model);
          selectModel(model, node);
          return;
        }
        if (el.checked) {
          selected = model;
          writePlainValue(select, selected);
          enforceSingleToggleChecks(bodyEl, "data-ad-bm-model", selected);
          updateBmSearchTrigger(select, selected || PLACEHOLDER, Boolean(selected));
          closeAdBmPicker(select);
        } else if (selected === model) {
          selected = "";
          writePlainValue(select, selected);
          updateBmSearchTrigger(select, PLACEHOLDER, false);
        }
      };
    },
    onQueryChange(next) {
      query = next;
    },
    onClose: () => {
      openGroup = null;
    },
  });

  function onBrandChange() {
    pruneSelected();
    writePlainValue(select, selected);
    updateBmSearchTrigger(select, selected || PLACEHOLDER, Boolean(selected));
    if (autoBmPanelIsOpen(select._adBmPanel)) select._adBmRefreshDropdown?.();
  }

  select._adBmOnBrandChange = onBrandChange;
  document.getElementById("gyartmany")?._adBmHidden?.addEventListener("change", onBrandChange);
}

function allapotLabelForValue(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  for (const cat of ALLAPOT_CATEGORIES) {
    if (cat.value === v) return cat.label;
    const child = cat.children?.find((c) => c.value === v);
    if (child) return child.label;
  }
  return v;
}

export function applyAdFormBmFieldValues(data) {
  if (!data || typeof data !== "object") return;
  const ids = AD_BM_PICKER_IDS;
  for (const id of ids) {
    const raw = data[id];
    if (raw == null || String(raw).trim() === "") continue;
    const select = document.getElementById(id);
    if (!select) continue;
    let list = [];
    if (Array.isArray(raw)) list = raw.map(String).filter(Boolean);
    else if (raw != null && String(raw).trim()) {
      const parsed = parseJsonList(String(raw));
      list = parsed.length ? parsed : [String(raw)];
    }
    if (id === "gyartmany") list = list.map((v) => v.toUpperCase());
    if (id === "uzemanyag") list = list.map((v) => normalizePrimaryValue(select, v)).filter(Boolean);

    if (select._adBmHidden?.dataset.adBmSingle === "1") {
      const value =
        list[0] ||
        (raw != null && !Array.isArray(raw) ? readSingleStoredValue(String(raw)) : "");
      const normalized =
        id === "gyartmany" ? value.toUpperCase() : id === "uzemanyag" ? normalizePrimaryValue(select, value) : value;
      writePlainValue(select, normalized);
      select._adBmFillWheel?.(normalized);
      select._adBmRefreshSummary?.();
      const summary =
        id === "allapot" ? allapotLabelForValue(normalized) || PLACEHOLDER : normalized || PLACEHOLDER;
      if (select._adBmPanel?.classList.contains("ad-form-bm-dropdown")) {
        updateBmSearchTrigger(select, summary === PLACEHOLDER ? "" : summary, Boolean(normalized));
      } else if (!select.dataset.adBmDrum) {
        updateBmSummary(select, summary === PLACEHOLDER ? "" : summary, Boolean(normalized));
      }
    } else if (select._adBmHidden) {
      writePickerList(select, list);
      const unit =
        id === "gyartmany" ? "márka" : id === "modell" ? "modell" : id === "uzemanyag" ? "üzemanyag" : "db";
      const summary = labelList(list, unit);
      if (select._adBmPanel?.classList.contains("ad-form-bm-dropdown")) {
        updateBmSearchTrigger(select, summary, list.length > 0);
      } else {
        updateBmSummary(select, summary, list.length > 0);
      }
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

let cachedVehicleCatalog = null;

const TIRE_ROW_SPECS = [
  { prefix: "nyari_gumi", title: "Nyári gumi méret" },
  { prefix: "teli_gumi", title: "Téli gumi méret" },
];

export function unmountAdFormBmPickers(form) {
  if (!form) return;
  unmountMuszakiDateTriple(form);
  unmountTireSizeSplitPickers(form);
  unmountAdSplitYmDrums(form);
  unmountAdBrandModelCombined(form);
  AD_BM_PICKER_IDS.forEach((id) => {
    const select = document.getElementById(id);
    if (select?._adBmClose) select._adBmClose();
    unmountPicker(select);
  });
  delete form?.dataset.adBmPickers;
}

function unmountAdBrandModelCombined(form) {
  const root = form || document;
  const wraps = [...(root.querySelectorAll?.(".ad-form-bm-field--brand-model") || [])];
  const gyartmany =
    document.getElementById("gyartmany") ||
    wraps.map((w) => w.querySelector?.("#gyartmany")).find(Boolean) ||
    null;
  const modell = document.getElementById("modell");
  const modellField = modell?.closest(".labeled-field, .md-outlined, .ad-layout-item");
  modellField?.classList.remove("ad-form-bm-modell-nested");

  /* A native #gyartmany a wrapban van (stash) — wrap.remove() előtt vissza kell tenni, különben eltűnik. */
  if (gyartmany) {
    const field =
      gyartmany.closest(".labeled-field, .md-outlined, .ad-layout-item") ||
      wraps[0]?.closest(".labeled-field, .md-outlined, .ad-layout-item") ||
      fieldHost(gyartmany);
    if (typeof gyartmany._adBmClose === "function") {
      try {
        gyartmany._adBmClose();
      } catch {
        /* ignore */
      }
    }
    delete gyartmany._adBmClose;
    delete gyartmany._adBmPanel;
    delete gyartmany._adBmRefreshSummary;
    releaseNativeSelect(gyartmany, field);
    showNativeSelect(gyartmany);
    restoreHiddenInput(gyartmany);
    delete gyartmany.dataset.adBmPicker;
    delete gyartmany.dataset.adBmDrum;
    delete gyartmany.dataset.adBrandModelCombined;
  }

  if (modell) {
    delete modell._adBmPanel;
    delete modell._adBmRefreshSummary;
    showNativeSelect(modell);
    restoreHiddenInput(modell);
    delete modell.dataset.adBmPicker;
    delete modell.dataset.adBmDrum;
    delete modell.dataset.adBrandModelNested;
  }

  wraps.forEach((el) => el.remove());
  root.querySelectorAll?.(".ad-form-bm-field--brand-model").forEach((el) => el.remove());
}

function unmountAdSplitYmDrums(form) {
  const root = form || document;
  root.querySelectorAll?.(".ad-form-split-ym:not(.ad-form-muszaki-date):not(.ad-form-tire-split)").forEach((block) => {
    const field = block.closest(".labeled-field, .md-outlined, .ad-layout-item");
    const evId = block.dataset.evId;
    const honapId = block.dataset.honapId;
    const ev =
      (evId ? document.getElementById(evId) : null) ||
      block.querySelector?.(`#${CSS.escape?.(evId) || evId}`) ||
      null;
    const honap =
      (honapId ? document.getElementById(honapId) : null) ||
      block.querySelector?.(`#${CSS.escape?.(honapId) || honapId}`) ||
      null;
    const inline = document.createElement("div");
    inline.className = "inline-2";
    if (ev) {
      releaseNativeSelect(ev, field);
      showNativeSelect(ev);
      delete ev.dataset.adBmPicker;
      delete ev.dataset.adSplitYm;
      inline.appendChild(ev);
    }
    if (honap) {
      releaseNativeSelect(honap, field);
      showNativeSelect(honap);
      delete honap.dataset.adBmPicker;
      delete honap.dataset.adSplitYm;
      inline.appendChild(honap);
    }
    block.replaceWith(inline);
    field?.classList.remove("ad-form-bm-anchor");
  });
}

function unmountMuszakiDateTriple(form) {
  const root = form || document;
  const block = root.querySelector?.(".ad-form-muszaki-date");
  const ev =
    document.getElementById("muszaki_ev") || block?.querySelector?.("#muszaki_ev") || null;
  const honap =
    document.getElementById("muszaki_honap") || block?.querySelector?.("#muszaki_honap") || null;
  const nap =
    document.getElementById("muszaki_nap") || block?.querySelector?.("#muszaki_nap") || null;
  if (block) {
    const field = block.closest(".labeled-field, .md-outlined, .ad-layout-item");
    const inline = document.createElement("div");
    inline.className = "inline-2";
    if (ev) {
      releaseNativeSelect(ev, field);
      showNativeSelect(ev);
      delete ev.dataset.adMuszakiDate;
      inline.appendChild(ev);
    }
    if (honap) {
      releaseNativeSelect(honap, field);
      showNativeSelect(honap);
      delete honap.dataset.adMuszakiDate;
      inline.appendChild(honap);
    }
    block.replaceWith(inline);
    if (nap) {
      releaseNativeSelect(nap, field);
      showNativeSelect(nap);
      delete nap.dataset.adMuszakiDate;
      nap.setAttribute("hidden", "");
      (field || inline.parentElement)?.appendChild(nap);
    }
  } else {
    [ev, honap, nap].forEach((el) => {
      if (el) delete el.dataset.adMuszakiDate;
    });
  }
}

export function markAdFormUiReady() {
  document.documentElement.classList.add("ad-form-ui-ready");
}

export async function refreshAdFormBmPickers(form, catalog = null) {
  try {
    if (catalog) cachedVehicleCatalog = catalog;
    const pending = form?._bymyLastFormData;
    unmountAdFormBmPickers(form);
    await mountAdFormBmPickers(form, catalog || cachedVehicleCatalog);
    if (pending) {
      applyAdFormBmFieldValues(pending);
      requestAnimationFrame(() => applyAdFormBmFieldValues(pending));
    }
    markAdFormUiReady();
  } catch (error) {
    console.warn("Alapadatok kapcsolós panel frissítés:", error);
    markAdFormUiReady();
  }
}

function optionsFromSelect(select, emptyLabel = "—") {
  if (!select) return [{ value: "", label: emptyLabel }];
  const rows = [...select.options].map((opt) => ({
    value: opt.value,
    label: (opt.textContent || "").trim() || opt.value || emptyLabel,
  }));
  if (!rows.some((r) => r.value === "")) {
    return [{ value: "", label: emptyLabel }, ...rows.filter((r) => r.value !== "")];
  }
  return rows;
}

function filledOptionsFromSelect(select) {
  if (!select) return [];
  const seen = new Set();
  const out = [];
  for (const opt of select.options) {
    const value = String(opt.value ?? "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({
      value,
      label: (opt.textContent || "").trim() || value,
    });
  }
  return out;
}

function hierarchyItemsFromCategories(categories) {
  return (categories || []).map((cat) => ({
    value: cat.children?.length ? cat.id : cat.value || cat.id,
    label: cat.label,
    children: (cat.children || []).map((ch) => ({ value: ch.value, label: ch.label })),
  }));
}

function labelFromHierarchy(categories, value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  for (const cat of categories || []) {
    if (cat.value === v || cat.id === v) return cat.label;
    const child = cat.children?.find((c) => c.value === v);
    if (child) return child.label;
  }
  return v;
}

/**
 * Gyártmány + modell egy dobkeréken (mint a kereső), de csak 1-1 választható.
 */
function ensureGyartmanySelectInForm(form) {
  let gyartmany = document.getElementById("gyartmany");
  if (gyartmany) return gyartmany;
  const field =
    form?.querySelector?.('label[for="gyartmany"]')?.closest(".labeled-field, .md-outlined, .ad-layout-item") ||
    form?.querySelector?.(".field-row--vehicle-ident .labeled-field");
  if (!field) return null;
  gyartmany = document.createElement("select");
  gyartmany.id = "gyartmany";
  gyartmany.name = "gyartmany";
  gyartmany.required = true;
  gyartmany.innerHTML = '<option value="">Válasszon</option>';
  field.appendChild(gyartmany);
  return gyartmany;
}

async function mountAdBrandModelCombined(form, catalog) {
  const gyartmany = ensureGyartmanySelectInForm(form);
  const modell = document.getElementById("modell");
  if (!form || !gyartmany || !modell) return;
  if (gyartmany.dataset.adBrandModelCombined === "1") return;
  if (gyartmany.tagName !== "SELECT" || modell.tagName !== "SELECT") return;

  const field = anchorField(gyartmany);
  if (!field) return;

  form._autoDrumCatalog = catalog;
  form._adFormVehicleCatalog = catalog;

  unmountPicker(gyartmany);
  unmountPicker(modell);
  hideNativeSelect(gyartmany);
  hideNativeSelect(modell);
  ensurePlainHiddenInput(gyartmany);
  ensurePlainHiddenInput(modell);
  gyartmany.dataset.adBmPicker = "1";
  gyartmany.dataset.adBmDrum = "1";
  gyartmany.dataset.adBrandModelCombined = "1";
  modell.dataset.adBmPicker = "1";
  modell.dataset.adBmDrum = "1";
  modell.dataset.adBrandModelNested = "1";

  const modellField = modell.closest(".labeled-field, .md-outlined, .ad-layout-item");
  /* Soha ne rejtsük el a gyártmány sort — csak a külön modell mezőt. */
  if (modellField && modellField !== field) {
    modellField.classList.add("ad-form-bm-modell-nested");
  } else if (modellField && modellField === field) {
    /* modell a gyartmany mezőben van: ne nesteljünk, a native #modell amúgy is hidden. */
    modellField.classList.remove("ad-form-bm-modell-nested");
  }

  const { fillWheel, setWheelValue, readWheel, syncHostClearButton } = await import("./ingatlan-wheels.js?v=6952ba469c");
  const { openBrandModelCatalogSheet } = await import("./auto-drum-sheet.js?v=switchDesignAll1");
  const { initDrumWheel, syncDrumWheelDisplay } = await import("./immo-drum-picker.js?v=c4c7ac29a2");

  const brands = [...(catalog?.gyartmanyok || [])].sort((a, b) =>
    a.localeCompare(b, "hu", { sensitivity: "base" })
  );
  /* AutoScout-stílus: „Gyártmány / Modell” üres trigger; label „Gyártmány & Modell”. */
  const emptyLabel = "Gyártmány / Modell";
  const brandLabel = field.querySelector('label[for="gyartmany"]');
  if (brandLabel && !brandLabel.dataset.adBmBrandLabel) {
    brandLabel.dataset.adBmBrandLabel = "1";
    brandLabel.innerHTML = 'Gyártmány &amp; Modell: <span class="req">*</span>';
  }

  const wrap = document.createElement("div");
  wrap.className =
    "ad-form-bm-field ad-form-bm-field--drum ad-form-bm-field--brand-model auto-bm-field ad-form-cell";
  wrap.dataset.adBmFor = "gyartmany";
  wrap.innerHTML = `<div class="immo-wheel-wrap ad-form-drum-wrap">
    <div class="immo-wheel" data-wheel="gyartmany" data-filter-key="gyartmany" role="listbox" aria-label="Gyártmány és modell"></div>
    <div class="immo-wheel" data-wheel="modell" data-filter-key="modell" role="listbox" aria-label="Modell" hidden></div>
  </div>`;
  gyartmany.insertAdjacentElement("beforebegin", wrap);
  stashNativeSelect(gyartmany, wrap);

  const brandWheelHost = wrap.querySelector(".immo-wheel-wrap");
  let brandWheel = wrap.querySelector('[data-wheel="gyartmany"]');
  let modelWheel = wrap.querySelector('[data-wheel="modell"]');

  fillWheel(
    brandWheel,
    brands.map((b) => ({ value: b, label: b })),
    { emptyLabel }
  );
  fillWheel(modelWheel, [], { emptyLabel: "—" });

  brandWheel = initDrumWheel(brandWheel, { emptyLabel, openMode: "portal", multiple: false });
  modelWheel = wrap.querySelector('[data-wheel="modell"]') || modelWheel;
  modelWheel.dataset.multiple = "0";
  modelWheel.classList.add("immo-wheel--drum-source");
  modelWheel.setAttribute("hidden", "");

  const brandVal = String(gyartmany.value || "").trim();
  const modelVal = String(modell.value || "").trim();
  if (brandVal) setWheelValue(brandWheel, brandVal);
  if (brandVal && catalog?.modellek?.[brandVal]) {
    fillWheel(
      modelWheel,
      (catalog.modellek[brandVal] || []).map((m) => ({ value: m, label: m })),
      { emptyLabel: "—" }
    );
  }
  if (modelVal) setWheelValue(modelWheel, modelVal);
  syncDrumWheelDisplay(brandWheel);

  function summaryText() {
    const b = String(readWheel(wrap.querySelector('[data-wheel="gyartmany"]') || brandWheel) ?? "").trim();
    const m = String(readWheel(wrap.querySelector('[data-wheel="modell"]') || modelWheel) ?? "").trim();
    if (!b) return emptyLabel;
    return m ? `${b} · ${m}` : b;
  }

  function clearBrandAndModel() {
    if (wrap.dataset.adBmClearing === "1") return;
    wrap.dataset.adBmClearing = "1";
    try {
      const liveBrand = wrap.querySelector('[data-wheel="gyartmany"]') || brandWheel;
      const liveModel = wrap.querySelector('[data-wheel="modell"]') || modelWheel;
      setWheelValue(liveBrand, "");
      setWheelValue(liveModel, "");
      writePlainValue(gyartmany, "");
      writePlainValue(modell, "");
      const tipus = form.querySelector?.("#tipus") || document.getElementById("tipus");
      const egyebTipus = form.querySelector?.("#egyeb_tipus") || document.getElementById("egyeb_tipus");
      if (tipus) {
        if (tipus.tagName === "SELECT") writePlainValue(tipus, "");
        else {
          tipus.value = "";
          tipus.dispatchEvent(new Event("input", { bubbles: true }));
          tipus.dispatchEvent(new Event("change", { bubbles: true }));
        }
        tipus._adBmRefreshSummary?.();
      }
      if (egyebTipus) {
        egyebTipus.value = "";
        egyebTipus.dispatchEvent(new Event("input", { bubbles: true }));
        egyebTipus.dispatchEvent(new Event("change", { bubbles: true }));
      }
      refreshSummary();
    } finally {
      delete wrap.dataset.adBmClearing;
    }
  }

  function refreshSummary() {
    const trigger = brandWheelHost.querySelector(".immo-wheel-trigger");
    const text = summaryText();
    const empty = text === emptyLabel;
    if (trigger) {
      trigger.textContent = text;
      trigger.dataset.emptyLabel = emptyLabel;
      trigger.setAttribute("aria-label", "Gyártmány és modell");
      trigger.classList.toggle("is-placeholder", empty);
    }
    wrap.classList.toggle("has-value", !empty);
    brandWheelHost?.classList.toggle("has-value", !empty);
    /* X: gyártmány + modell (+ típus) egyszerre — ne csak a márkát törölje */
    syncHostClearButton(brandWheelHost, {
      hasValue: !empty,
      onClear: clearBrandAndModel,
    });
  }

  function syncSelectsFromWheels() {
    const b = String(readWheel(wrap.querySelector('[data-wheel="gyartmany"]') || brandWheel) ?? "").trim();
    const m = String(readWheel(wrap.querySelector('[data-wheel="modell"]') || modelWheel) ?? "").trim();
    writePlainValue(gyartmany, b);
    writePlainValue(modell, m);
    refreshSummary();
  }

  brandWheel.addEventListener("immo-wheel-change", syncSelectsFromWheels);
  modelWheel.addEventListener("immo-wheel-change", syncSelectsFromWheels);
  brandWheel.addEventListener("immo-wheel-clear", clearBrandAndModel);

  const openSheet = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const trigger = brandWheelHost.querySelector(".immo-wheel-trigger");
    if (!trigger) return;
    const liveBrand = wrap.querySelector('[data-wheel="gyartmany"]') || brandWheel;
    openBrandModelCatalogSheet(liveBrand, trigger, brandWheelHost, emptyLabel, form, {
      singleSelect: true,
    });
  };

  const trigger = brandWheelHost.querySelector(".immo-wheel-trigger");
  if (trigger) {
    const next = trigger.cloneNode(true);
    next.dataset.sheetBound = "1";
    trigger.replaceWith(next);
    next.addEventListener("click", openSheet);
  }

  const onPortalGone = () => {
    if (document.body.classList.contains("auto-drum-portal-open")) return;
    syncSelectsFromWheels();
  };
  const portalObserver = new MutationObserver(onPortalGone);
  portalObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  gyartmany._adBmClose = () => portalObserver.disconnect();

  gyartmany._adBmRefreshSummary = refreshSummary;
  gyartmany._adBmPanel = wrap;
  modell._adBmRefreshSummary = refreshSummary;
  modell._adBmPanel = wrap;
  refreshSummary();

  gyartmany.addEventListener("change", () => {
    const b = String(gyartmany.value || "").trim();
    const live = wrap.querySelector('[data-wheel="gyartmany"]') || brandWheel;
    setWheelValue(live, b);
    if (b && catalog?.modellek?.[b]) {
      fillWheel(
        wrap.querySelector('[data-wheel="modell"]') || modelWheel,
        (catalog.modellek[b] || []).map((m) => ({ value: m, label: m })),
        { emptyLabel: "—" }
      );
    }
    refreshSummary();
  });
  modell.addEventListener("change", () => {
    setWheelValue(wrap.querySelector('[data-wheel="modell"]') || modelWheel, String(modell.value || ""));
    refreshSummary();
  });
}

/**
 * Hirdetésfeladás select → kereső-stílusú dobkerék.
 * Opciók mindig a meglévő selectből (tartalom nem módosul).
 */
async function mountAdSelectDrum(select, {
  title,
  emptyLabel = PLACEHOLDER,
  mode = "single",
  categories = null,
  resolveItems = null,
  labelForValue = null,
  onChange = null,
} = {}) {
  if (!select || select.tagName !== "SELECT") return;
  const field = anchorField(select);
  if (!field) return;

  const wantMode = mode || "single";
  const existingWrap =
    field.querySelector(`.ad-form-bm-field--drum[data-ad-bm-for="${CSS.escape?.(select.id) || select.id}"]`) ||
    document.querySelector(`.ad-form-bm-field--drum[data-ad-bm-for="${CSS.escape?.(select.id) || select.id}"]`);
  const existingTrigger = existingWrap?.querySelector?.(".immo-wheel-trigger");
  const haveMode = String(select.dataset.adBmMode || existingWrap?.dataset?.adBmMode || "").trim();
  /* Régi single dob → switch (vagy fordítva / hiányzó módjelölés): kötelező újra mount. */
  if (select.dataset.adBmPicker === "1" && existingTrigger && haveMode !== wantMode) {
    delete select.dataset.adBmPicker;
    delete select.dataset.adBmDrum;
    delete select.dataset.adBmMode;
    existingWrap?.remove();
    showNativeSelect(select);
    restoreHiddenInput(select);
  } else if (select.dataset.adBmPicker === "1" && existingTrigger) {
    const cur = String(existingTrigger.textContent || "").trim();
    const value = readSingleStoredValue(select._adBmHidden?.value ?? select.value);
    if (!value && (!cur || cur === "—" || cur === "-" || cur === "–")) {
      existingTrigger.textContent = emptyLabel;
      existingTrigger.dataset.emptyLabel = emptyLabel;
      existingTrigger.classList.add("is-placeholder");
    }
    existingTrigger.style.removeProperty("display");
    existingTrigger.style.removeProperty("visibility");
    existingTrigger.style.removeProperty("opacity");
    existingWrap?.classList.remove("ad-layout-hidden");
    if (existingWrap) existingWrap.hidden = false;
    return;
  }
  /* Félkész mount: flag megvan, UI nincs — takarítsunk, majd újra. */
  if (select.dataset.adBmPicker === "1") {
    delete select.dataset.adBmPicker;
    delete select.dataset.adBmDrum;
    delete select.dataset.adBmMode;
    existingWrap?.remove();
    showNativeSelect(select);
  }

  unmountPicker(select);
  hideNativeSelect(select);
  ensurePlainHiddenInput(select);

  let fillWheel;
  let setWheelValue;
  let readWheel;
  let openStandaloneSwitchSheet;
  let bindAutoDrumSheet;
  let initDrumWheel;
  let syncDrumWheelDisplay;
  try {
    ({ fillWheel, setWheelValue, readWheel } = await import("./ingatlan-wheels.js?v=6952ba469c"));
    ({ openStandaloneSwitchSheet, bindAutoDrumSheet } = await import("./auto-drum-sheet.js?v=switchDesignAll1"));
    ({ initDrumWheel, syncDrumWheelDisplay } = await import("./immo-drum-picker.js?v=c4c7ac29a2"));
  } catch (error) {
    console.warn("Dobkerék betöltés:", title || select.id, error);
    showNativeSelect(select);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "ad-form-bm-field ad-form-bm-field--drum auto-bm-field ad-form-cell";
  wrap.dataset.adBmFor = select.id;
  wrap.dataset.adBmMode = wantMode;
  wrap.innerHTML = `<div class="immo-wheel-wrap ad-form-drum-wrap">
    <div class="immo-wheel" data-wheel="${escapeAttr(select.id)}" data-filter-key="${escapeAttr(select.id)}" role="listbox" aria-label="${escapeAttr(title)}"></div>
  </div>`;
  select.insertAdjacentElement("beforebegin", wrap);
  stashNativeSelect(select, wrap);

  const wheelHost = wrap.querySelector(".immo-wheel-wrap");
  let wheel = wrap.querySelector("[data-wheel]");

  function currentItems() {
    if (typeof resolveItems === "function") return resolveItems() || [];
    return filledOptionsFromSelect(select);
  }

  function displayLabel(value) {
    const v = String(value ?? "").trim();
    if (!v) return emptyLabel;
    if (typeof labelForValue === "function") {
      const custom = labelForValue(v);
      if (custom) return custom;
    }
    if (categories) {
      const fromCat = labelFromHierarchy(categories, v);
      if (fromCat) return fromCat;
    }
    const opt = currentItems().find((row) => row.value === v);
    return opt?.label || v;
  }

  function triggerEl() {
    return wheelHost?.querySelector(".immo-wheel-trigger");
  }

  function refreshSummary() {
    const value = readSingleStoredValue(select._adBmHidden?.value ?? select.value);
    const trigger = triggerEl();
    if (trigger) {
      trigger.textContent = displayLabel(value) || emptyLabel;
      trigger.dataset.emptyLabel = emptyLabel;
      trigger.setAttribute("aria-label", title);
      trigger.classList.toggle("is-placeholder", !value);
    }
    wrap.classList.toggle("has-value", Boolean(value));
  }

  function fillFromSelect(preferredValue) {
    wheel = wrap.querySelector("[data-wheel]") || wheel;
    const items = currentItems();
    fillWheel(
      wheel,
      items.filter((r) => r.value !== ""),
      { emptyLabel }
    );
    const value =
      preferredValue != null
        ? String(preferredValue)
        : readSingleStoredValue(select._adBmHidden?.value ?? select.value);
    setWheelValue(wheel, value || "");
    syncDrumWheelDisplay(wheel);
    refreshSummary();
  }

  fillFromSelect();
  wheel = initDrumWheel(wheel, { emptyLabel, openMode: "portal", multiple: false });
  if (!wheel || !triggerEl()) {
    console.warn("Dobkerék trigger hiányzik:", title || select.id);
    wrap.remove();
    showNativeSelect(select);
    return;
  }
  fillFromSelect();

  wheel.addEventListener("immo-wheel-change", () => {
    const live = wrap.querySelector("[data-wheel]") || wheel;
    const value = String(readWheel(live) ?? "");
    writePlainValue(select, value);
    refreshSummary();
    if (typeof onChange === "function") onChange(value);
  });

  function openHierarchySheet() {
    const trigger = triggerEl();
    if (!trigger) return;
    const cats = hierarchyItemsFromCategories(categories || []);
    const current = readSingleStoredValue(select._adBmHidden?.value ?? select.value);
    openStandaloneSwitchSheet({
      trigger,
      title,
      emptyLabel,
      items: cats.map((c) => ({ value: c.value, label: c.label })),
      initialSelected: current ? [current] : [],
      singleSelect: true,
      getChildren: (mainValue) => {
        const cat = cats.find((c) => c.value === mainValue);
        return cat?.children?.length ? cat.children : null;
      },
      onDone: (list) => {
        const value = list?.length ? String(list[list.length - 1]) : "";
        writePlainValue(select, value);
        setWheelValue(wrap.querySelector("[data-wheel]") || wheel, value);
        syncDrumWheelDisplay(wrap.querySelector("[data-wheel]") || wheel);
        refreshSummary();
        if (typeof onChange === "function") onChange(value);
      },
    });
  }

  function openSwitchSheet() {
    const trigger = triggerEl();
    if (!trigger) return;
    const items = currentItems();
    const current = readSingleStoredValue(select._adBmHidden?.value ?? select.value);
    openStandaloneSwitchSheet({
      trigger,
      title,
      emptyLabel,
      items,
      initialSelected: current ? [current] : [],
      singleSelect: true,
      onDone: (list) => {
        const value = list?.length ? String(list[list.length - 1]) : "";
        writePlainValue(select, value);
        setWheelValue(wrap.querySelector("[data-wheel]") || wheel, value);
        syncDrumWheelDisplay(wrap.querySelector("[data-wheel]") || wheel);
        refreshSummary();
        if (typeof onChange === "function") onChange(value);
      },
    });
  }

  if (mode === "hierarchy" || mode === "switch") {
    const trigger = triggerEl();
    if (trigger) {
      const next = trigger.cloneNode(true);
      next.dataset.sheetBound = "1";
      if (!String(next.textContent || "").trim()) next.textContent = emptyLabel;
      trigger.replaceWith(next);
      next.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        fillFromSelect();
        if (mode === "hierarchy" && categories?.length) openHierarchySheet();
        else openSwitchSheet();
      });
    }
  } else {
    bindAutoDrumSheet(wheel);
  }

  select.dataset.adBmPicker = "1";
  select.dataset.adBmDrum = "1";
  select.dataset.adBmMode = wantMode;
  select._adBmClose = () => {};
  select._adBmRefreshSummary = refreshSummary;
  select._adBmFillWheel = fillFromSelect;
  select._adBmPanel = wrap;
  refreshSummary();
}

function ensureMuszakiNapSelect(honapSelect) {
  let nap = document.getElementById("muszaki_nap");
  if (nap) return nap;
  nap = document.createElement("select");
  nap.id = "muszaki_nap";
  nap.name = "muszaki_nap";
  nap.setAttribute("aria-label", "Műszaki vizsga érvényes – nap");
  nap.innerHTML = `<option value="">nap</option>`;
  for (let d = 1; d <= 31; d += 1) {
    const opt = document.createElement("option");
    opt.value = String(d);
    opt.textContent = String(d);
    nap.appendChild(opt);
  }
  nap.hidden = true;
  nap.style.display = "none";
  const host = honapSelect?.closest(".inline-2") || honapSelect?.parentElement || honapSelect;
  host?.appendChild(nap);
  return nap;
}

function syncSelectToValue(select, value) {
  if (!select) return;
  const v = String(value ?? "");
  if (v && ![...select.options].some((o) => o.value === v)) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  }
  if (select.value !== v) {
    select.value = v;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

/**
 * Év + hónap osztott dobkerék (mint a kereső dual range).
 * Opciók a meglévő selectekből.
 */
async function mountAdSplitYmDrum({
  evId,
  honapId,
  title,
  emptyYear = "év",
  emptyMonth = "hó",
  yearMax,
} = {}) {
  const ev = document.getElementById(evId);
  const honap = document.getElementById(honapId);
  if (!ev || !honap || ev.dataset.adSplitYm === "1") return;
  if (ev.tagName !== "SELECT" || honap.tagName !== "SELECT") return;

  const field = ev.closest(".labeled-field, .md-outlined, .ad-layout-item") || ev.parentElement;
  if (!field) return;
  if (field.querySelector(`.ad-form-split-ym[data-ev-id="${evId}"]`)) {
    ev.dataset.adSplitYm = "1";
    honap.dataset.adSplitYm = "1";
    return;
  }

  if (yearMax !== undefined) {
    ensureYearSelectFilled(ev, yearMax == null ? new Date().getFullYear() : yearMax);
  } else {
    ensureYearSelectFilled(ev);
  }

  const { fillWheel, setWheelValue, readWheel } = await import("./ingatlan-wheels.js?v=6952ba469c");
  const { openYmDualSheet } = await import("./auto-drum-sheet.js?v=switchDesignAll1");
  const { initDrumWheel, syncDrumWheelDisplay } = await import("./immo-drum-picker.js?v=c4c7ac29a2");

  const yearOpts = optionsFromSelect(ev, emptyYear);
  const monthOpts = optionsFromSelect(honap, emptyMonth);

  const block = document.createElement("div");
  block.className = "immo-dual-range-block ad-form-split-ym";
  block.dataset.range = evId;
  block.dataset.evId = evId;
  block.dataset.honapId = honapId;

  const dual = document.createElement("div");
  dual.className = "immo-dual-range ad-form-split-ym__dual";
  dual.dataset.range = evId;
  dual.dataset.splitKind = "ym";
  dual.setAttribute("aria-label", title);

  const titleEl = document.createElement("span");
  titleEl.className = "immo-label immo-dual-range__title";
  titleEl.textContent = title;
  dual.appendChild(titleEl);

  function padMonth(raw) {
    const n = Number(String(raw ?? "").replace(/\D/g, ""));
    if (!Number.isFinite(n) || n < 1) return String(raw ?? "").trim();
    return String(n).padStart(2, "0");
  }

  function makeHalf(kind, select, options, emptyLabel) {
    const half = document.createElement("div");
    half.className = `immo-schema-cell immo-dual-range__half immo-dual-range__half--${kind}`;
    half.innerHTML = `<div class="immo-wheel-wrap">
      <div class="immo-wheel" data-wheel="${select.id}" data-filter-key="${select.id}" role="listbox" aria-label="${emptyLabel}"></div>
    </div>`;
    const wheel = half.querySelector("[data-wheel]");
    fillWheel(
      wheel,
      options.filter((o) => o.value !== ""),
      { emptyLabel }
    );
    let live = initDrumWheel(wheel, { emptyLabel, openMode: "portal", multiple: false });
    setWheelValue(live, select.value || "");
    syncDrumWheelDisplay(live);
    live = half.querySelector("[data-wheel]") || live;
    const trigger = half.querySelector(".immo-wheel-trigger");
    if (trigger) {
      trigger.dataset.emptyLabel = emptyLabel;
      if (!select.value) trigger.textContent = emptyLabel;
      trigger.hidden = false;
      trigger.removeAttribute("aria-hidden");
    }
    live.addEventListener("immo-wheel-change", () => {
      const w = half.querySelector("[data-wheel]") || live;
      syncSelectToValue(select, readWheel(w));
      syncDrumWheelDisplay(w);
      refreshSummary();
    });
    select.addEventListener("change", () => {
      const w = half.querySelector("[data-wheel]") || live;
      setWheelValue(w, select.value || "");
      syncDrumWheelDisplay(w);
      refreshSummary();
    });
    return { half, wheel: () => half.querySelector("[data-wheel]") || live };
  }

  const minHalf = makeHalf("min", ev, yearOpts, emptyYear);
  const sep = document.createElement("span");
  sep.className = "immo-dual-range__sep";
  sep.setAttribute("aria-hidden", "true");
  sep.textContent = "–";
  const maxHalf = makeHalf("max", honap, monthOpts, emptyMonth);
  dual.appendChild(minHalf.half);
  dual.appendChild(sep);
  dual.appendChild(maxHalf.half);

  /* Csukott megjelenés: egy vonal — „év 2020 hó 05” */
  const summary = document.createElement("button");
  summary.type = "button";
  summary.className = "ad-form-split-ym__summary";
  summary.setAttribute("aria-label", title);

  function refreshSummary() {
    const y = String(readWheel(minHalf.wheel()) ?? "").trim() || String(ev.value || "").trim();
    const mRaw = String(readWheel(maxHalf.wheel()) ?? "").trim() || String(honap.value || "").trim();
    const m = mRaw ? padMonth(mRaw) : "";
    if (!y && !m) {
      summary.textContent = "—";
    } else if (y && !m) {
      summary.textContent = `${y}.`;
    } else if (!y && m) {
      summary.textContent = `—. ${m}`;
    } else {
      summary.textContent = `${y}. ${m}`;
    }
    block.classList.toggle("has-value", Boolean(y || m));
    summary.classList.toggle("is-placeholder", !y && !m);
  }

  block.appendChild(summary);
  block.appendChild(dual);

  /* Selecteket előbb stash — inline.replaceWith ne törölje ki a DOM-ból (remount üres címkét hagy). */
  hideNativeSelect(ev);
  hideNativeSelect(honap);
  stashNativeSelect(ev, block);
  stashNativeSelect(honap, block);
  field.classList.add("ad-form-bm-anchor");

  const inline = field.querySelector(".inline-2");
  if (inline) inline.replaceWith(block);
  else field.appendChild(block);

  ev.dataset.adSplitYm = "1";
  honap.dataset.adSplitYm = "1";
  ev.dataset.adBmPicker = "1";
  honap.dataset.adBmPicker = "1";

  /* Egy közös év|hó sheet (gyártmány chrome) — summary vagy cella nyitja */
  const openShared = (triggerBtn) => {
    openYmDualSheet(minHalf.wheel(), maxHalf.wheel(), triggerBtn, { title });
  };
  summary.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openShared(summary);
  });
  [minHalf, maxHalf].forEach((part) => {
    const trigger = part.half.querySelector(".immo-wheel-trigger");
    if (!trigger) return;
    const next = trigger.cloneNode(true);
    next.dataset.sheetBound = "1";
    next.hidden = false;
    next.removeAttribute("aria-hidden");
    trigger.replaceWith(next);
    next.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openShared(summary);
    });
  });

  const onPortalGone = () => {
    if (document.body.classList.contains("auto-drum-portal-open")) return;
    refreshSummary();
  };
  const portalObserver = new MutationObserver(onPortalGone);
  portalObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  refreshSummary();
}

/**
 * Műszaki érvényesség: ugyanaz az év|hó osztott sheet, nap nélkül.
 */
async function mountMuszakiDateTripleDrum(form) {
  const ev = document.getElementById("muszaki_ev");
  const honap = document.getElementById("muszaki_honap");
  if (!form || !ev || !honap || ev.dataset.adMuszakiDate === "1" || ev.dataset.adSplitYm === "1") return;
  if (!isBmPickerAdForm(form)) return;

  ensureYearSelectFilled(ev, YEAR_SELECT_MAX);
  await mountAdSplitYmDrum({
    evId: "muszaki_ev",
    honapId: "muszaki_honap",
    title: "Műszaki érvényesség",
    emptyYear: "év",
    emptyMonth: "hó",
    yearMax: YEAR_SELECT_MAX,
  });
  if (ev.dataset.adSplitYm === "1") {
    ev.dataset.adMuszakiDate = "1";
    honap.dataset.adMuszakiDate = "1";
    const field = ev.closest(".labeled-field, .md-outlined, .ad-layout-item");
    const nativeLabel = field?.querySelector('label[for="muszaki_ev"], label[for="muszaki_honap"]');
    if (nativeLabel) nativeLabel.classList.add("ad-form-split-ym__native-label");
  }
}

export async function mountAdFormBmPickers(form, catalog = null) {
  if (!form) return;
  if (!isBmPickerAdForm(form)) {
    unmountAdFormBmPickers(form);
    return;
  }
  /* Mindig tiszta mount — különben a régi single dob bent maradhat (pl. Tulajdonosok). */
  if (form.dataset.adBmPickers === "1") {
    unmountAdFormBmPickers(form);
  }

  const allapot = document.getElementById("allapot");
  const kivitel = document.getElementById("kivitel");
  const okmany = document.getElementById("okmany_jelleg");
  const uzemanyag = document.getElementById("uzemanyag");

  /* Meglévő select-tartalom kiegészítése (nem cseréljük a kereső listáira). */
  ensureSelectOptions(document.getElementById("dc_tolto_csatlakozas"), DC_TOLTO_OPTIONS);
  ensureSelectOptions(document.getElementById("szin"), VEHICLE_SZIN_OPTIONS);
  ensureSelectOptions(document.getElementById("karpit1"), VEHICLE_KARPIT_OPTIONS);
  ensureSelectOptions(document.getElementById("karpit2"), VEHICLE_KARPIT_OPTIONS);
  ensureSelectOptions(document.getElementById("tetto"), VEHICLE_TETTO_OPTIONS);
  /* Klíma: mindig cseréljük (ne append), különben duplán jelenik meg a listában. */
  replaceSelectOptions(document.getElementById("klima"), KLIM_OPTIONS, "Válasszon");
  if (document.getElementById("sebessegvalto") && !filledOptionsFromSelect(document.getElementById("sebessegvalto")).length) {
    replaceSelectOptions(document.getElementById("sebessegvalto"), flattenSebessegvaltoOptions());
  }
  if (kivitel && !filledOptionsFromSelect(kivitel).length) {
    ensureSelectOptions(kivitel, KIVITEL_OPTIONS);
  }
  if (okmany && !filledOptionsFromSelect(okmany).length) {
    ensureSelectOptions(okmany, OKMANY_JELLEG_OPTIONS);
  }
  if (uzemanyag && !filledOptionsFromSelect(uzemanyag).length) {
    ensureSelectOptions(uzemanyag, flattenUzemanyagOptions());
  }
  if (allapot && !filledOptionsFromSelect(allapot).length) {
    ensureSelectOptions(allapot, flattenAllapotOptions());
  }

  if (allapot?.tagName === "SELECT") {
    await mountAdSelectDrum(allapot, {
      title: "Állapot",
      mode: "hierarchy",
      categories: ALLAPOT_CATEGORIES,
      labelForValue: allapotLabelForValue,
    });
  }
  if (kivitel?.tagName === "SELECT") {
    await mountAdSelectDrum(kivitel, { title: "Kivitel", mode: "switch" });
  }
  if (okmany?.tagName === "SELECT") {
    await mountAdSelectDrum(okmany, { title: "Okmányok jellege", mode: "switch" });
  }
  if (uzemanyag?.tagName === "SELECT") {
    await mountAdSelectDrum(uzemanyag, {
      title: "Üzemanyag",
      mode: "hierarchy",
      categories: UZEMANYAG_CATEGORIES,
      labelForValue: (value) => labelFromHierarchy(UZEMANYAG_CATEGORIES, value),
      onChange: () => window.dispatchEvent(new Event("ad-form-sync-fuel-fields")),
    });
  }

  const forgalombaEv = document.getElementById("forgalomba_helyezes_ev");
  const forgalombaHonap = document.getElementById("forgalomba_helyezes_honap");
  await mountAdSplitYmDrum({
    evId: "gyartasi_ev",
    honapId: "gyartasi_honap",
    title: "Gyártási év",
    emptyYear: "év",
    emptyMonth: "hó",
    yearMax: null,
  });
  if (forgalombaEv && forgalombaHonap) {
    await mountAdSplitYmDrum({
      evId: "forgalomba_helyezes_ev",
      honapId: "forgalomba_helyezes_honap",
      title: "Első magyarországi forgalomba helyezés",
      emptyYear: "év",
      emptyMonth: "hó",
    });
  }

  await mountMuszakiDateTripleDrum(form);

  for (const spec of AD_BM_SINGLE_DROPDOWN_SPECS) {
    if (spec.skipSingleMount) continue;
    const select = document.getElementById(spec.id);
    if (!select || select.tagName !== "SELECT") continue;
    if (spec.yearMax !== undefined) {
      ensureYearSelectFilled(select, spec.yearMax == null ? new Date().getFullYear() : spec.yearMax);
    }
    const switchIds = new Set([
      "tulajdonosok_szama",
      "ajtok",
      "szemelyek",
      "szin",
      "karpit1",
      "karpit2",
      "tetto",
      "klima",
      "sebessegvalto",
      "hajtas",
      "ac_tolto_csatlakozas",
      "dc_tolto_csatlakozas",
      "tolto_csatlakozas",
    ]);
    await mountAdSelectDrum(select, {
      title: spec.title,
      emptyLabel: spec.placeholder ?? PLACEHOLDER,
      mode: switchIds.has(spec.id) ? "switch" : "single",
    });
  }

  try {
    const cat = catalog || (await fetchVehicleCatalog({ kind: catalogKindForAdForm(form) }));
    form._adFormVehicleCatalog = cat;
    form._autoDrumCatalog = cat;
    await mountAdBrandModelCombined(form, cat);
  } catch (error) {
    console.warn("Gyártmány/modell dobkerék:", error);
  }

  await mountTireSizeSwitchPickers(form);

  form.dataset.adBmPickers = "1";
  window.dispatchEvent(new CustomEvent("ad-form-bm-ready", { detail: { form } }));
}

function resolveFormSelect(form, name) {
  if (!form || !name) return null;
  const card = form.querySelector("#tire-sizes-card, .tire-sizes-grid");
  const fromCard =
    card?.querySelector?.(`select#${CSS.escape?.(name) || name}`) ||
    card?.querySelector?.(`select[name="${CSS.escape?.(name) || name}"]`) ||
    null;
  if (fromCard instanceof HTMLSelectElement) return fromCard;
  const byId = document.getElementById(name);
  if (byId instanceof HTMLSelectElement) return byId;
  const byName = form.querySelector(`select[name="${CSS.escape?.(name) || name}"]`);
  if (byName instanceof HTMLSelectElement) return byName;
  const named = form.elements?.namedItem?.(name);
  if (named instanceof HTMLSelectElement) return named;
  if (named && typeof named.length === "number") {
    return [...named].find((el) => el instanceof HTMLSelectElement) || null;
  }
  return null;
}

function ensureTireSelectInBlock(form, host, name, ariaLabel) {
  let select =
    (host?.querySelector?.(`select[name="${CSS.escape?.(name) || name}"]`) ||
      resolveFormSelect(form, name) ||
      null);
  if (!(select instanceof HTMLSelectElement)) {
    select = document.createElement("select");
    select.name = name;
    select.setAttribute("aria-label", ariaLabel || name);
  }
  if (!select.id) select.id = name;
  return select;
}

/** Gumi méret: műszaki érvényesség-stílusú summary + 3 oszlopos sheet (tire-block alapú). */
export async function mountTireSizeSwitchPickers(form) {
  if (!form || !isBmPickerAdForm(form)) return;
  const card = form.querySelector("#tire-sizes-card") || form.querySelector(".tire-sizes-grid")?.closest(".card");
  const grid = card?.querySelector(".tire-sizes-grid") || form.querySelector(".tire-sizes-grid");
  if (!grid) return;

  if (card) {
    card.hidden = false;
    card.classList.remove("ad-immo-orphan", "ad-layout-hidden");
    card.removeAttribute("hidden");
    card.style.removeProperty("display");
  }

  try {
    const { fillTireSelect } = await import("./tire-sizes-ui.js?v=d01f914c82");
    const { openTireTripleSheet } = await import("./auto-drum-sheet.js?v=switchDesignAll1");
    const blocks = [...grid.querySelectorAll(":scope > .tire-block")];

    for (let index = 0; index < TIRE_ROW_SPECS.length; index += 1) {
      const spec = TIRE_ROW_SPECS[index];
      try {
        let host = blocks[index] || null;
        if (!host) {
          host = document.createElement("div");
          host.className = "tire-block";
          const label = document.createElement("span");
          label.className = "tire-block-label";
          label.textContent = `${spec.title}:`;
          host.appendChild(label);
          grid.appendChild(host);
        }

        const widthName = `${spec.prefix}_szelesseg`;
        const aspectName = `${spec.prefix}_magassag`;
        const rimName = `${spec.prefix}_atmero`;
        const width = ensureTireSelectInBlock(form, host, widthName, `${spec.title} szélesség`);
        const aspect = ensureTireSelectInBlock(form, host, aspectName, `${spec.title} magasság`);
        const rim = ensureTireSelectInBlock(form, host, rimName, `${spec.title} átmérő`);

        const existing = host.querySelector(`.ad-form-tire-split[data-tire-prefix="${spec.prefix}"]`);
        if (
          existing?.querySelector(".ad-form-tire-split__summary") &&
          width.dataset.adTireSplit === "1" &&
          host.contains(existing) &&
          existing.contains(width)
        ) {
          continue;
        }

        for (const select of [width, aspect, rim]) {
          if (typeof select._adBmClose === "function") {
            try {
              select._adBmClose();
            } catch {
              /* ignore */
            }
          }
          const oldWrap = select.closest?.(".ad-form-bm-field--drum");
          if (oldWrap) {
            releaseNativeSelect(select, oldWrap.parentElement);
            showNativeSelect(select);
            oldWrap.remove();
          }
          delete select.dataset.adBmPicker;
          delete select.dataset.adBmDrum;
          delete select.dataset.adTireSplit;
        }

        fillTireSelect(width);
        fillTireSelect(aspect);
        fillTireSelect(rim);

        host.querySelectorAll(`.ad-form-tire-split[data-tire-prefix="${spec.prefix}"]`).forEach((el) => el.remove());
        host.querySelectorAll(".tire-row").forEach((row) => row.remove());

        const block = document.createElement("div");
        block.className = "ad-form-split-ym ad-form-tire-split";
        block.dataset.tirePrefix = spec.prefix;

        const summary = document.createElement("button");
        summary.type = "button";
        summary.className = "ad-form-split-ym__summary ad-form-tire-split__summary";
        summary.setAttribute("aria-label", spec.title);
        summary.setAttribute("aria-haspopup", "dialog");

        function refreshSummary() {
          const w = String(width.value || "").trim();
          const a = String(aspect.value || "").trim();
          const r = String(rim.value || "").trim();
          summary.textContent = !w && !a && !r ? "—" : `${w || "—"} / ${a || "—"} R ${r || "—"}`;
          block.classList.toggle("has-value", Boolean(w || a || r));
          summary.classList.toggle("is-placeholder", !w && !a && !r);
        }

        block.appendChild(summary);
        hideNativeSelect(width);
        hideNativeSelect(aspect);
        hideNativeSelect(rim);
        stashNativeSelect(width, block);
        stashNativeSelect(aspect, block);
        stashNativeSelect(rim, block);

        const label = host.querySelector(".tire-block-label");
        if (label) label.after(block);
        else host.appendChild(block);

        width.dataset.adTireSplit = "1";
        aspect.dataset.adTireSplit = "1";
        rim.dataset.adTireSplit = "1";
        width.dataset.adBmPicker = "1";
        aspect.dataset.adBmPicker = "1";
        rim.dataset.adBmPicker = "1";
        width._adBmRefreshSummary = refreshSummary;
        aspect._adBmRefreshSummary = refreshSummary;
        rim._adBmRefreshSummary = refreshSummary;

        summary.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openTireTripleSheet(width, aspect, rim, summary, { title: spec.title });
        });
        block.addEventListener("ad-tire-change", () => refreshSummary());
        width.addEventListener("change", refreshSummary);
        aspect.addEventListener("change", refreshSummary);
        rim.addEventListener("change", refreshSummary);

        const onPortalGone = () => {
          if (document.body.classList.contains("auto-drum-portal-open")) return;
          refreshSummary();
        };
        const portalObserver = new MutationObserver(onPortalGone);
        portalObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
        refreshSummary();
      } catch (rowError) {
        console.warn("Gumi méret menü:", spec.title, rowError);
      }
    }
  } catch (error) {
    console.warn("Gumi méret menük:", error);
  }
}

function unmountTireSizeSplitPickers(form) {
  const root = form || document;
  root.querySelectorAll?.(".ad-form-tire-split").forEach((block) => {
    const prefix = block.dataset.tirePrefix;
    const names = prefix
      ? [`${prefix}_szelesseg`, `${prefix}_magassag`, `${prefix}_atmero`]
      : [];
    const selects = names
      .map(
        (name) =>
          block.querySelector?.(`select[name="${CSS.escape?.(name) || name}"]`) ||
          block.querySelector?.(`#${CSS.escape?.(name) || name}`) ||
          resolveFormSelect(form || root, name)
      )
      .filter((el) => el instanceof HTMLSelectElement);
    const host = block.closest(".tire-block") || block.parentElement;
    const row = document.createElement("div");
    row.className = "tire-row";
    const seps = ["/", "R"];
    selects.forEach((select, index) => {
      releaseNativeSelect(select, host);
      showNativeSelect(select);
      delete select.dataset.adTireSplit;
      delete select.dataset.adBmPicker;
      delete select._adBmRefreshSummary;
      row.appendChild(select);
      if (index < seps.length) {
        const sep = document.createElement("span");
        sep.textContent = seps[index];
        row.appendChild(sep);
      }
    });
    /* Üres sorral ne cseréljük a summary-t — különben címke alatt semmi nem marad. */
    if (!selects.length) {
      block.remove();
      return;
    }
    block.replaceWith(row);
  });
  root.querySelectorAll?.(".tire-row--kapcsol")?.forEach((row) => row.classList.remove("tire-row--kapcsol"));
}

