/**
 * Autó / teherautó kereső dobkerék.
 * Mobil: portált gyűrű. Asztali: helyben görgethető inline dob + dupla kattintás = kézi érték.
 */

import { fillWheel, setWheelValue, readWheel } from "./ingatlan-wheels.js?v=deskDrum1";
import {
  initDrumWheel,
  applyDrumModeClass,
  syncDrumWheelDisplay,
  closeAllInlineDrums,
} from "./immo-drum-picker.js?v=deskDrum1";
import { bindAutoDrumSheet } from "./auto-drum-sheet.js?v=deskDrum1";
import { optionsForAutoFilterKey } from "./auto-search-layout.js?v=deskDrum1";

const MOBILE_MQ = "(max-width: 900px)";

const DUAL_RANGES = [
  {
    fieldKey: "gyartasi_ev",
    id: "gyartasi_ev",
    title: "Gyártási év",
    ariaLabel: "Gyártási év tartomány",
    tol: "ev_tol",
    ig: "ev_ig",
    unit: "",
  },
  {
    fieldKey: "vetelar",
    id: "vetelar",
    title: "Vételár",
    ariaLabel: "Vételár tartomány",
    tol: "ar_tol",
    ig: "ar_ig",
    unit: "Ft",
  },
  {
    fieldKey: "km",
    id: "km",
    title: "Km óra állás",
    ariaLabel: "Km óra állás tartomány",
    tol: "km_tol",
    ig: "km_ig",
    unit: "km",
  },
  {
    fieldKey: "teljesitmeny_le",
    id: "teljesitmeny_le",
    title: "Teljesítmény",
    ariaLabel: "Teljesítmény tartomány",
    tol: "le_tol",
    ig: "le_ig",
    unit: "LE",
  },
  {
    fieldKey: "hengerurtartalom",
    id: "hengerurtartalom",
    title: "Hengerűrtartalom",
    ariaLabel: "Hengerűrtartalom tartomány",
    tol: "ccm_tol",
    ig: "ccm_ig",
    unit: "cm³",
  },
];

const SEARCH_OMIT_FIELDS = new Set([
  "gyartasi_honap",
  "forgalomba_helyezes_honap",
  "muszaki_honap",
]);

function isMobile() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_MQ).matches;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function optionsFromSelect(select) {
  if (!select) return [];
  return [...select.querySelectorAll("option")].map((opt) => ({
    value: opt.value,
    label: opt.textContent?.trim() || opt.value || "Mindegy",
  }));
}

function resolveOptions(filterKey, select, emptyLabel = "Mindegy") {
  const fromSelect = optionsFromSelect(select);
  const filled = fromSelect.filter((o) => o.value !== "");
  if (filled.length) {
    const empty = fromSelect.find((o) => o.value === "");
    return empty ? fromSelect : [{ value: "", label: emptyLabel }, ...filled];
  }
  return optionsForAutoFilterKey(filterKey, emptyLabel);
}

function emptyLabelFromOptions(options) {
  const empty = options.find((o) => o.value === "");
  return empty?.label || "Mindegy";
}

function finishWheel(cell, emptyLabel) {
  const wheel = cell.querySelector("[data-wheel]");
  initDrumWheel(wheel, { emptyLabel });
  const live = cell.querySelector("[data-wheel]");
  setWheelValue(live, "");
  syncDrumWheelDisplay(live);
  if (isMobile()) bindAutoDrumSheet(live);
  else bindDesktopAutoDrum(live);
  return live;
}

/** Asztali: egérgörgő a mezőn + dupla kattintás = szabad szöveg. */
function bindDesktopAutoDrum(wheel) {
  const wrap = wheel?.closest?.(".immo-wheel-wrap");
  const trigger = wrap?.querySelector(".immo-wheel-trigger");
  if (!trigger || trigger.dataset.desktopDrumBound === "1") return;
  trigger.dataset.desktopDrumBound = "1";

  trigger.addEventListener(
    "wheel",
    (event) => {
      if (wrap.classList.contains("is-open") || wrap.classList.contains("is-typing")) return;
      event.preventDefault();
      const opts = [...wheel.querySelectorAll(".immo-wheel-opt")];
      if (!opts.length) return;
      const cur = String(readWheel(wheel) ?? "");
      let idx = opts.findIndex((o) => (o.dataset.value ?? "") === cur);
      if (idx < 0) idx = 0;
      const nextIdx =
        event.deltaY > 0 ? Math.min(opts.length - 1, idx + 1) : Math.max(0, idx - 1);
      const value = opts[nextIdx].dataset.value ?? "";
      setWheelValue(wheel, value);
      syncDrumWheelDisplay(wheel);
      wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value } }));
    },
    { passive: false }
  );

  trigger.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeAllInlineDrums(false);
    startDesktopTypedEdit(wrap, wheel, trigger);
  });
}

function startDesktopTypedEdit(wrap, wheel, trigger) {
  if (!wrap || !wheel || !trigger) return;
  if (wrap.classList.contains("is-typing")) return;

  const emptyLabel = trigger.dataset.emptyLabel || "Mindegy";
  const current = String(readWheel(wheel) ?? "");
  wrap.classList.add("is-typing");
  trigger.hidden = true;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "auto-drum-typed home-qs-control";
  input.setAttribute("aria-label", emptyLabel);
  input.placeholder = emptyLabel;
  input.value = current;
  input.autocomplete = "off";
  trigger.insertAdjacentElement("afterend", input);
  input.focus();
  input.select();

  const finish = (commit) => {
    if (!wrap.classList.contains("is-typing")) return;
    wrap.classList.remove("is-typing");
    const raw = commit ? String(input.value ?? "").trim() : current;
    input.remove();
    trigger.hidden = false;
    applyTypedDrumValue(wheel, raw, emptyLabel);
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener("blur", () => finish(true));
}

function applyTypedDrumValue(wheel, raw, emptyLabel) {
  const value = String(raw ?? "").trim();
  if (!value || value === emptyLabel) {
    setWheelValue(wheel, "");
    syncDrumWheelDisplay(wheel);
    wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: "" } }));
    return;
  }

  const opts = [...wheel.querySelectorAll(".immo-wheel-opt")];
  const match = opts.find(
    (o) =>
      (o.dataset.value ?? "") === value ||
      (o.textContent || "").trim().toLowerCase() === value.toLowerCase()
  );
  if (match) {
    setWheelValue(wheel, match.dataset.value ?? "");
  } else {
    let typed = wheel.querySelector(".immo-wheel-opt--typed");
    if (!typed) {
      typed = document.createElement("button");
      typed.type = "button";
      typed.className = "immo-wheel-opt immo-wheel-opt--typed";
      wheel.appendChild(typed);
    }
    typed.dataset.value = value;
    typed.textContent = value;
    setWheelValue(wheel, value);
  }
  syncDrumWheelDisplay(wheel);
  wheel.dispatchEvent(
    new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: readWheel(wheel) } })
  );
}

function buildWheelCell({ filterKey, wheelName, label, options, halfClass = "", emptyLabel: emptyOverride } = {}) {
  const emptyLabel = emptyOverride || emptyLabelFromOptions(options);
  const opts = options.filter((o) => o.value !== "");
  const cell = document.createElement("div");
  cell.className = `immo-schema-cell home-qs-drum-cell${halfClass ? ` ${halfClass}` : ""}`;
  cell.dataset.qsField = filterKey;
  cell.innerHTML = `<div class="immo-wheel-wrap">
    <span class="immo-label">${escapeHtml(label)}</span>
    <div class="immo-wheel" data-wheel="${escapeAttr(wheelName)}" data-filter-key="${escapeAttr(filterKey)}" role="listbox" aria-label="${escapeAttr(label)}"></div>
    <input type="hidden" name="${escapeAttr(filterKey)}" data-filter-key="${escapeAttr(filterKey)}" value="" />
  </div>`;
  const wheel = cell.querySelector("[data-wheel]");
  fillWheel(wheel, opts, { emptyLabel });
  finishWheel(cell, emptyLabel);
  return cell;
}

function convertSimpleField(wrap) {
  const select = wrap.querySelector("select.home-qs-control");
  if (!select) return;
  const filterKey = select.getAttribute("data-filter-key") || wrap.getAttribute("data-qs-field") || "";
  if (!filterKey || SEARCH_OMIT_FIELDS.has(filterKey) || SEARCH_OMIT_FIELDS.has(wrap.getAttribute("data-qs-field"))) {
    wrap.remove();
    return;
  }
  const label =
    wrap.querySelector(".home-qs-label")?.textContent?.trim() ||
    select.getAttribute("aria-label") ||
    filterKey;
  const emptyLabel = filterKey.endsWith("_tol") ? "-tól" : filterKey.endsWith("_ig") ? "-ig" : "Mindegy";
  const options = resolveOptions(filterKey, select, emptyLabel);
  const current = select.value;
  const cell = buildWheelCell({
    filterKey,
    wheelName: filterKey === "uzemanyagQuick" ? "uzemanyag" : filterKey,
    label,
    options,
  });
  wrap.replaceWith(cell);
  if (current) setWheelValue(cell.querySelector("[data-wheel]"), current);
}

function convertRangePairToDual(wrap, cfg) {
  const tolSelect = wrap.querySelector(`[data-filter-key="${cfg.tol}"]`);
  const igSelect = wrap.querySelector(`[data-filter-key="${cfg.ig}"]`);
  if (!tolSelect || !igSelect) return;

  const tolOpts = resolveOptions(cfg.tol, tolSelect, "-tól");
  const igOpts = resolveOptions(cfg.ig, igSelect, "-ig");
  const tolVal = tolSelect.value;
  const igVal = igSelect.value;

  const block = document.createElement("div");
  block.className = "immo-dual-range-block";
  block.dataset.range = cfg.id;

  const dual = document.createElement("div");
  dual.className = "immo-dual-range";
  dual.dataset.range = cfg.id;
  dual.setAttribute("aria-label", cfg.ariaLabel);

  const title = document.createElement("span");
  title.className = "immo-label immo-dual-range__title";
  title.textContent = cfg.title;
  dual.appendChild(title);

  const minCell = buildWheelCell({
    filterKey: cfg.tol,
    wheelName: cfg.tol,
    label: "",
    options: tolOpts,
    emptyLabel: "Mindegy",
    halfClass: "immo-dual-range__half immo-dual-range__half--min",
  });
  const maxCell = buildWheelCell({
    filterKey: cfg.ig,
    wheelName: cfg.ig,
    label: "",
    options: igOpts,
    emptyLabel: "Mindegy",
    halfClass: "immo-dual-range__half immo-dual-range__half--max",
  });

  const sep = document.createElement("span");
  sep.className = "immo-dual-range__sep";
  sep.setAttribute("aria-hidden", "true");
  sep.textContent = "–";

  dual.appendChild(minCell);
  dual.appendChild(sep);
  dual.appendChild(maxCell);

  if (cfg.unit) {
    const unit = document.createElement("span");
    unit.className = "immo-dual-range__unit";
    unit.setAttribute("aria-hidden", "true");
    unit.textContent = cfg.unit;
    dual.appendChild(unit);
  }

  block.appendChild(dual);
  wrap.replaceWith(block);

  if (tolVal) setWheelValue(minCell.querySelector("[data-wheel]"), tolVal);
  if (igVal) setWheelValue(maxCell.querySelector("[data-wheel]"), igVal);
}

function convertRangePairToTwoDrums(wrap) {
  const selects = [...wrap.querySelectorAll("select.home-qs-control[data-filter-key]")];
  if (selects.length < 2) {
    convertSimpleField(wrap);
    return;
  }
  const frag = document.createDocumentFragment();
  const baseLabel = wrap.querySelector(".home-qs-label")?.textContent?.trim() || "";
  for (const select of selects) {
    const filterKey = select.getAttribute("data-filter-key");
    const aria = select.getAttribute("aria-label") || "";
    const emptyLabel = filterKey.endsWith("_tol") ? "-tól" : "-ig";
    const label = aria || `${baseLabel} ${filterKey.endsWith("_tol") ? "tól" : "ig"}`.trim();
    const options = resolveOptions(filterKey, select, emptyLabel);
    const current = select.value;
    const cell = buildWheelCell({ filterKey, wheelName: filterKey, label, options });
    frag.appendChild(cell);
    if (current) setWheelValue(cell.querySelector("[data-wheel]"), current);
  }
  wrap.replaceWith(frag);
}

async function fetchCatalogQuick() {
  try {
    const res = await fetch("/data/vehicle-catalog.json", { cache: "force-cache" });
    const data = await res.json();
    if (data?.gyartmanyok?.length) return data;
  } catch {
    /* fallback below */
  }
  const { fetchVehicleCatalog } = await import("./vehicle-catalog-client.js");
  return fetchVehicleCatalog();
}

function rebindWheel(form, wheelName, options, emptyLabel = "Mindegy") {
  const wheel = form.querySelector(`[data-wheel="${wheelName}"]`);
  if (!wheel) return null;
  fillWheel(wheel, options, { emptyLabel });
  initDrumWheel(wheel, { emptyLabel });
  const live = form.querySelector(`[data-wheel="${wheelName}"]`);
  setWheelValue(live, "");
  syncDrumWheelDisplay(live);
  if (isMobile()) bindAutoDrumSheet(live);
  else bindDesktopAutoDrum(live);
  return live;
}

async function wireCatalogDrums(form) {
  if (!form.querySelector('[data-wheel="gyartmany"]') || !form.querySelector('[data-wheel="modell"]')) return;

  let catalog;
  try {
    catalog = await fetchCatalogQuick();
  } catch (error) {
    console.warn("Dobkerék katalógus:", error);
    return;
  }

  const brands = (catalog.gyartmanyok || []).map((b) => ({ value: b, label: b }));
  const brandWheel = rebindWheel(form, "gyartmany", brands);
  if (!brandWheel) return;

  const fillModels = (brand) => {
    const list = brand ? catalog.modellek?.[brand] ?? [] : [];
    const models = list.map((m) => ({ value: m, label: m }));
    rebindWheel(form, "modell", models);
  };

  fillModels("");
  brandWheel.addEventListener("immo-wheel-change", () => {
    fillModels(readWheel(form.querySelector('[data-wheel="gyartmany"]')) || "");
  });
}

/**
 * Select mezők → dobkerék (mobil: portál, asztali: inline + kézi szerkesztés).
 * @returns {Promise<boolean>}
 */
export async function mountAutoSearchDrums(form = document.getElementById("home-qs-form")) {
  if (!form || form.dataset.drumsMounted === "1") return form.dataset.drumsMounted === "1";
  const page = document.body?.getAttribute("data-site-page") || "";
  if (page !== "auto" && page !== "teherauto") return false;

  applyDrumModeClass();
  form.classList.add("immo-search-form", "auto-qs-drums");
  form.classList.toggle("auto-qs-drums--desktop", !isMobile());
  form.classList.toggle("auto-qs-drums--mobile", isMobile());

  form.querySelectorAll("[data-qs-field]").forEach((wrap) => {
    const key = wrap.getAttribute("data-qs-field");
    if (SEARCH_OMIT_FIELDS.has(key)) wrap.remove();
  });

  const dualKeys = new Set(DUAL_RANGES.map((d) => d.fieldKey));

  for (const cfg of DUAL_RANGES) {
    const wrap = form.querySelector(`[data-qs-field="${cfg.fieldKey}"]`);
    if (wrap) convertRangePairToDual(wrap, cfg);
  }

  form.querySelectorAll("[data-qs-field]").forEach((wrap) => {
    if (wrap.closest(".immo-dual-range-block")) return;
    const key = wrap.getAttribute("data-qs-field");
    if (dualKeys.has(key) || SEARCH_OMIT_FIELDS.has(key)) return;
    if (wrap.querySelector("input.home-qs-control[type='text'], input.immo-control[type='text']")) return;
    if (wrap.querySelectorAll("select.home-qs-control").length >= 2) {
      convertRangePairToTwoDrums(wrap);
      return;
    }
    if (wrap.querySelector("select.home-qs-control")) convertSimpleField(wrap);
  });

  form.dataset.drumsMounted = "1";
  wireCatalogDrums(form).catch((error) => console.warn("Dobkerék katalógus:", error));
  return true;
}

export function resetAutoSearchDrums(form = document.getElementById("home-qs-form")) {
  if (!form || form.dataset.drumsMounted !== "1") return;
  form.querySelectorAll("[data-wheel]").forEach((wheel) => setWheelValue(wheel, ""));
  form.querySelectorAll('input.home-qs-control[data-filter-key]').forEach((el) => {
    el.value = "";
  });
  form
    .querySelector('[data-wheel="gyartmany"]')
    ?.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: "" } }));
}

export function readAutoDrumFilterValues(form) {
  const out = {};
  const numOrNull = (value) => {
    if (value == null || value === "") return null;
    const n = Number(String(value).replace(/\D/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const seen = new Set();

  /* Dob: hidden; Település / irányítószám: megmaradt text input */
  form.querySelectorAll("[data-filter-key]").forEach((el) => {
    const key = el.getAttribute("data-filter-key");
    if (!key || seen.has(key)) return;
    if (el.matches?.("[data-wheel]")) return;
    if (el.tagName === "SELECT" && form.querySelector(`input[type="hidden"][data-filter-key="${key}"]`)) {
      return;
    }
    seen.add(key);
    const raw = String(el.value ?? "").trim();
    if (!raw) return;
    if (key.endsWith("_tol") || key.endsWith("_ig")) {
      out[key] = numOrNull(raw);
    } else {
      out[key] = raw;
    }
  });
  return out;
}
