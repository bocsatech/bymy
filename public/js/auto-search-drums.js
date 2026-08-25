/**
 * Mobil autó kereső — ingatlan-stílusú dobkerék.
 * Összevont: gyártási év, vételár. Többi: sima dob.
 * Asztali: változatlan (select).
 */

import { fillWheel, setWheelValue, readWheel } from "./ingatlan-wheels.js?v=scrollLock7";
import { initDrumWheel, applyDrumModeClass } from "./immo-drum-picker.js?v=scrollLock4";
import { fetchVehicleCatalog } from "./vehicle-catalog-client.js";

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
];

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

function emptyLabelFromOptions(options) {
  const empty = options.find((o) => o.value === "");
  return empty?.label || "Mindegy";
}

function buildWheelCell({ filterKey, wheelName, label, options, halfClass = "" }) {
  const emptyLabel = emptyLabelFromOptions(options);
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
  initDrumWheel(wheel, { emptyLabel });
  return cell;
}

function convertSimpleField(wrap) {
  const select = wrap.querySelector("select.home-qs-control");
  if (!select) return;
  const filterKey = select.getAttribute("data-filter-key") || wrap.getAttribute("data-qs-field") || "";
  if (!filterKey) return;
  const label =
    wrap.querySelector(".home-qs-label")?.textContent?.trim() ||
    select.getAttribute("aria-label") ||
    filterKey;
  const options = optionsFromSelect(select);
  const current = select.value;
  const cell = buildWheelCell({
    filterKey,
    wheelName: filterKey === "uzemanyagQuick" ? "uzemanyag" : filterKey,
    label,
    options,
  });
  wrap.replaceWith(cell);
  if (current) {
    const wheel = cell.querySelector("[data-wheel]");
    setWheelValue(wheel, current);
  }
}

function convertRangePairToDual(wrap, cfg) {
  const tolSelect = wrap.querySelector(`[data-filter-key="${cfg.tol}"]`);
  const igSelect = wrap.querySelector(`[data-filter-key="${cfg.ig}"]`);
  if (!tolSelect || !igSelect) return;

  const tolOpts = optionsFromSelect(tolSelect);
  const igOpts = optionsFromSelect(igSelect);
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
    label: "tól",
    options: tolOpts,
    halfClass: "immo-dual-range__half immo-dual-range__half--min",
  });
  const maxCell = buildWheelCell({
    filterKey: cfg.ig,
    wheelName: cfg.ig,
    label: "ig",
    options: igOpts,
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
    const label = aria || `${baseLabel} ${filterKey.endsWith("_tol") ? "tól" : "ig"}`.trim();
    const options = optionsFromSelect(select);
    const current = select.value;
    const cell = buildWheelCell({ filterKey, wheelName: filterKey, label, options });
    frag.appendChild(cell);
    if (current) setWheelValue(cell.querySelector("[data-wheel]"), current);
  }
  wrap.replaceWith(frag);
}

async function wireCatalogDrums(form) {
  const brandWheel = form.querySelector('[data-wheel="gyartmany"]');
  const modelWheel = form.querySelector('[data-wheel="modell"]');
  if (!brandWheel || !modelWheel) return;

  let catalog;
  try {
    catalog = await fetchVehicleCatalog();
  } catch (error) {
    console.warn("Dobkerék katalógus:", error);
    return;
  }

  const brands = (catalog.gyartmanyok || []).map((b) => ({ value: b, label: b }));
  fillWheel(brandWheel, brands, { emptyLabel: "Mindegy" });
  initDrumWheel(brandWheel, { emptyLabel: "Mindegy" });

  const fillModels = (brand) => {
    const list = brand ? catalog.modellek?.[brand] ?? [] : [];
    const models = list.map((m) => ({ value: m, label: m }));
    fillWheel(modelWheel, models, { emptyLabel: "Mindegy" });
    initDrumWheel(modelWheel, { emptyLabel: "Mindegy" });
    setWheelValue(modelWheel, "");
  };

  fillModels(readWheel(brandWheel) || "");
  brandWheel.addEventListener("immo-wheel-change", () => {
    fillModels(readWheel(brandWheel) || "");
  });
}

/**
 * Select mezők → dobkerék (csak mobil).
 * @returns {Promise<boolean>} true ha dobkerék mód aktív
 */
export async function mountAutoSearchDrums(form = document.getElementById("home-qs-form")) {
  if (!form || form.dataset.drumsMounted === "1") return form.dataset.drumsMounted === "1";
  if (!isMobile()) return false;

  applyDrumModeClass();
  form.classList.add("immo-search-form", "auto-qs-drums");
  document.body.classList.add("immo-drum-active");

  const dualKeys = new Set(DUAL_RANGES.map((d) => d.fieldKey));

  for (const cfg of DUAL_RANGES) {
    const wrap = form.querySelector(`[data-qs-field="${cfg.fieldKey}"]`);
    if (wrap) convertRangePairToDual(wrap, cfg);
  }

  form.querySelectorAll("[data-qs-field]").forEach((wrap) => {
    if (wrap.closest(".immo-dual-range-block")) return;
    const key = wrap.getAttribute("data-qs-field");
    if (dualKeys.has(key)) return;
    if (wrap.querySelectorAll("select.home-qs-control").length >= 2) {
      convertRangePairToTwoDrums(wrap);
      return;
    }
    if (wrap.querySelector("select.home-qs-control")) convertSimpleField(wrap);
  });

  await wireCatalogDrums(form);
  form.dataset.drumsMounted = "1";
  return true;
}

export function resetAutoSearchDrums(form = document.getElementById("home-qs-form")) {
  if (!form || form.dataset.drumsMounted !== "1") return;
  form.querySelectorAll("[data-wheel]").forEach((wheel) => setWheelValue(wheel, ""));
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

  form.querySelectorAll('input[type="hidden"][data-filter-key]').forEach((el) => {
    const key = el.getAttribute("data-filter-key");
    if (!key) return;
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
