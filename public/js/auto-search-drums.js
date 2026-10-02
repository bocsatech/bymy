
import { fillWheel, setWheelValue, readWheel, readWheelList } from "./ingatlan-wheels.js?v=6952ba469c";
import {
  initDrumWheel,
  applyDrumModeClass,
  syncDrumWheelDisplay,
  closeAllInlineDrums,
} from "./immo-drum-picker.js?v=c4c7ac29a2";
import { bindAutoDrumSheet, openAutoDrumSheet } from "./auto-drum-sheet.js?v=9ebba008fe";
import { optionsForAutoFilterKey } from "./auto-search-layout.js?v=90daaf5812";

const MOBILE_MQ = "(max-width: 900px)";
const TYPEAHEAD_CLEAR_MS = 2500;
const CATALOG_DRUM_KEYS = new Set(["gyartmany", "modell"]);

/** Mobilon kapcsolós dobkerék (nem tartomány). */
const MULTI_SWITCH_KEYS = new Set([
  "uzemanyag",
  "uzemanyagQuick",
  "kivitel",
  "allapot",
  "sebessegvalto",
  "okmany_jelleg",
  "hajtas",
  "ajtok",
  "szemelyek",
  "klima",
  "szin",
  "teto",
  "csomagtarto",
  "tolto_csatlakozas",
  "ac_tolto_csatlakozas",
  "dc_tolto_csatlakozas",
  "villamtoltes",
  "zold_rendszam",
  "alkudhato",
  "csere",
  "nem_dohanyzo",
  "holgy_tulajdonos",
]);

const MULTI_FILTER_KEY = {
  gyartmany: "gyartmanyok",
  modell: "modellek",
  uzemanyag: "uzemanyagok",
  uzemanyagQuick: "uzemanyagok",
  kivitel: "kivitelek",
  allapot: "allapotok",
  sebessegvalto: "sebessegvaltok",
  okmany_jelleg: "okmany_jellegek",
};

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
  {
    fieldKey: "sajat_tomeg",
    id: "sajat_tomeg",
    title: "Saját tömeg",
    ariaLabel: "Saját tömeg tartomány",
    tol: "sajat_tomeg_tol",
    ig: "sajat_tomeg_ig",
    unit: "kg",
  },
  {
    fieldKey: "ossztomeg",
    id: "ossztomeg",
    title: "Össztömeg",
    ariaLabel: "Össztömeg tartomány",
    tol: "ossztomeg_tol",
    ig: "ossztomeg_ig",
    unit: "kg",
  },
  {
    fieldKey: "ac_toltesi_teljesitmeny",
    id: "ac_toltesi_teljesitmeny",
    title: "AC töltő teljesítménye",
    ariaLabel: "AC töltő teljesítmény tartomány",
    tol: "ac_toltesi_teljesitmeny_tol",
    ig: "ac_toltesi_teljesitmeny_ig",
    unit: "kW",
  },
  {
    fieldKey: "akkumulator_kwh",
    id: "akkumulator_kwh",
    title: "Akkumulátor kapacitás",
    ariaLabel: "Akkumulátor kapacitás tartomány",
    tol: "akkumulator_kwh_tol",
    ig: "akkumulator_kwh_ig",
    unit: "kWh",
  },
  {
    fieldKey: "jelenlegi_akkukapacitas",
    id: "jelenlegi_akkukapacitas",
    title: "Jelenlegi kapacitás",
    ariaLabel: "Jelenlegi akkumulátor kapacitás tartomány",
    tol: "jelenlegi_akkukapacitas_tol",
    ig: "jelenlegi_akkukapacitas_ig",
    unit: "%",
  },
  {
    fieldKey: "dc_toltesi_teljesitmeny",
    id: "dc_toltesi_teljesitmeny",
    title: "DC töltő teljesítménye",
    ariaLabel: "DC töltő teljesítmény tartomány",
    tol: "dc_toltesi_teljesitmeny_tol",
    ig: "dc_toltesi_teljesitmeny_ig",
    unit: "kW",
  },
  {
    fieldKey: "hatotav",
    id: "hatotav",
    title: "WLTP hatótáv",
    ariaLabel: "WLTP hatótáv tartomány",
    tol: "hatotav_tol",
    ig: "hatotav_ig",
    unit: "km",
  },
  {
    fieldKey: "autopalya_hatotav",
    id: "autopalya_hatotav",
    title: "Autópálya hatótáv",
    ariaLabel: "Autópálya hatótáv tartomány",
    tol: "autopalya_hatotav_tol",
    ig: "autopalya_hatotav_ig",
    unit: "km",
  },
];

const SEARCH_OMIT_FIELDS = new Set([
  "gyartasi_honap",
  "forgalomba_helyezes_ev",
  "forgalomba_helyezes_honap",
  "muszaki_honap",
  "keresesi_korzet",
  // Feladás-only kép overlay — nem vevőszűrő
  "photo_overlay_template_id",
  "photo_overlay_base_url",
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

function finishWheel(cell, emptyLabel, { multiple = false } = {}) {
  const wheel = cell.querySelector("[data-wheel]");
  if (isMobile()) {
    initDrumWheel(wheel, { emptyLabel, openMode: "portal", multiple });
    const live = cell.querySelector("[data-wheel]");
    setWheelValue(live, "");
    syncDrumWheelDisplay(live);
    bindAutoDrumSheet(live);
    return live;
  }
  setWheelValue(wheel, "");
  mountDesktopCellDrum(cell.querySelector(".immo-wheel-wrap"), wheel, emptyLabel);
  return wheel;
}

function mountDesktopCellDrum(wrap, wheel, emptyLabel = "Mindegy") {
  if (!wrap || !wheel) return;
  closeAllInlineDrums(false);
  wrap.classList.add("auto-cell-drum");
  wrap.classList.remove("immo-wheel-wrap--drum-inline", "is-open", "has-drum-open", "is-typing");
  wrap.querySelector(".immo-wheel-trigger")?.remove();
  wrap.querySelector(".immo-drum-inline")?.remove();
  wrap.querySelector(".auto-cell-drum__viewport")?.remove();
  wrap.querySelector(".auto-drum-typed")?.remove();

  wheel.setAttribute("hidden", "");
  wheel.classList.add("immo-wheel--drum-source");

  const viewport = document.createElement("div");
  viewport.className = "auto-cell-drum__viewport";
  viewport.tabIndex = 0;
  viewport.setAttribute("role", "listbox");
  viewport.setAttribute("aria-label", emptyLabel);

  const scroll = document.createElement("div");
  scroll.className = "auto-cell-drum__scroll";
  viewport.appendChild(scroll);

  const labelEl = wrap.querySelector(".immo-label");
  if (labelEl?.nextSibling) wrap.insertBefore(viewport, labelEl.nextSibling);
  else wrap.insertBefore(viewport, wheel);

  let typeBuffer = "";
  let typeTimer = 0;
  let scrollSettle = 0;

  function optionRows() {
    return [...wheel.querySelectorAll(".immo-wheel-opt")].map((opt) => ({
      value: opt.dataset.value ?? "",
      label: (opt.textContent || "").trim() || emptyLabel,
    }));
  }

  function renderItems(prefix = "") {
    const rows = optionRows();
    const cur = String(readWheel(wheel) ?? "");
    scroll.innerHTML = rows
      .map((row) => {
        const label = row.label || emptyLabel;
        const selected = (row.value ?? "") === cur;
        let html;
        if (prefix) html = prefixHighlightHtml(label, prefix);
        else if (selected) html = `<span class="auto-cell-drum__match">${escapeHtml(label)}</span>`;
        else html = `<span class="auto-cell-drum__rest">${escapeHtml(label)}</span>`;
        return `<div class="auto-cell-drum__item" role="option" data-value="${escapeAttr(row.value)}" data-label="${escapeAttr(label)}"><span class="auto-cell-drum__text">${html}</span></div>`;
      })
      .join("");
    syncSelectedClass();
  }

  function syncSelectedClass() {
    const cur = String(readWheel(wheel) ?? "");
    scroll.querySelectorAll(".auto-cell-drum__item").forEach((item) => {
      item.classList.toggle("is-selected", (item.dataset.value ?? "") === cur);
    });
  }

  function scrollToValue(value, smooth = true) {
    const item =
      [...scroll.querySelectorAll(".auto-cell-drum__item")].find((el) => (el.dataset.value ?? "") === value) ||
      scroll.querySelector(".auto-cell-drum__item");
    if (!item) return;
    const top = item.offsetTop - (scroll.clientHeight - item.clientHeight) / 2;
    scroll.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
  }

  function selectValue(value, { smooth = true, silent = false, prefix = null } = {}) {
    setWheelValue(wheel, value);
    if (prefix != null) renderItems(prefix);
    else if (!typeBuffer) renderItems("");
    else syncSelectedClass();
    scrollToValue(value, smooth);
    if (!silent) {
      wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value } }));
    }
  }

  function nearestItem() {
    const mid = scroll.scrollTop + scroll.clientHeight / 2;
    let best = null;
    let bestDist = Infinity;
    scroll.querySelectorAll(".auto-cell-drum__item").forEach((item) => {
      const center = item.offsetTop + item.offsetHeight / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    });
    return best;
  }

  function commitNearest() {
    const item = nearestItem();
    if (!item) return;
    const value = item.dataset.value ?? "";
    if (value === String(readWheel(wheel) ?? "")) {
      syncSelectedClass();
      return;
    }
    selectValue(value, { smooth: false });
  }

  function applyTypeBuffer() {
    const q = typeBuffer.trim().toLowerCase();
    if (!q) {
      renderItems("");
      scrollToValue(String(readWheel(wheel) ?? ""), false);
      return;
    }
    const rows = optionRows();
    const hit = rows.find((row) => row.label.toLowerCase().startsWith(q) && row.value !== "");
    const emptyHit = !hit && emptyLabel.toLowerCase().startsWith(q) ? rows.find((r) => r.value === "") : null;
    const match = hit || emptyHit;
    if (match) selectValue(match.value, { smooth: true, prefix: typeBuffer });
    else renderItems(typeBuffer);
  }

  renderItems("");
  selectValue("", { smooth: false, silent: true });

  scroll.addEventListener(
    "scroll",
    () => {
      window.clearTimeout(scrollSettle);
      scrollSettle = window.setTimeout(commitNearest, 80);
    },
    { passive: true }
  );

  scroll.addEventListener(
    "wheel",
    (event) => {
      event.stopPropagation();
    },
    { passive: true }
  );

  scroll.addEventListener("click", (event) => {
    const item = event.target.closest(".auto-cell-drum__item");
    if (!item) return;
    typeBuffer = "";
    window.clearTimeout(typeTimer);
    selectValue(item.dataset.value ?? "", { smooth: true });
    renderItems("");
    viewport.focus();
  });

  viewport.addEventListener("click", () => {
    viewport.focus();
  });

  viewport.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const items = [...scroll.querySelectorAll(".auto-cell-drum__item")];
      const cur = String(readWheel(wheel) ?? "");
      let idx = items.findIndex((el) => (el.dataset.value ?? "") === cur);
      if (idx < 0) idx = 0;
      const next = event.key === "ArrowDown" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
      typeBuffer = "";
      window.clearTimeout(typeTimer);
      selectValue(items[next].dataset.value ?? "", { smooth: true });
      renderItems("");
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      typeBuffer = typeBuffer.slice(0, -1);
      window.clearTimeout(typeTimer);
      typeTimer = window.setTimeout(() => {
        typeBuffer = "";
        renderItems("");
      }, TYPEAHEAD_CLEAR_MS);
      applyTypeBuffer();
      return;
    }
    if (event.key === "Escape") {
      typeBuffer = "";
      window.clearTimeout(typeTimer);
      renderItems("");
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      typeBuffer += event.key;
      window.clearTimeout(typeTimer);
      typeTimer = window.setTimeout(() => {
        typeBuffer = "";
        renderItems("");
      }, TYPEAHEAD_CLEAR_MS);
      applyTypeBuffer();
    }
  });

  wrap._desktopCellDrum = {
    refresh(prefix = "") {
      renderItems(prefix);
      scrollToValue(String(readWheel(wheel) ?? ""), false);
    },
  };
}

function prefixHighlightHtml(label, typedPrefix) {
  const raw = String(label ?? "");
  const prefix = String(typedPrefix ?? "");
  if (!prefix) {
    return `<span class="auto-cell-drum__rest">${escapeHtml(raw)}</span>`;
  }
  if (!raw.toLowerCase().startsWith(prefix.toLowerCase())) {
    return `<span class="auto-cell-drum__rest">${escapeHtml(raw)}</span>`;
  }
  const n = prefix.length;
  return `<span class="auto-cell-drum__match">${escapeHtml(raw.slice(0, n))}</span><span class="auto-cell-drum__rest">${escapeHtml(
    raw.slice(n)
  )}</span>`;
}

function buildWheelCell({ filterKey, wheelName, label, options, halfClass = "", emptyLabel: emptyOverride, multiple = false } = {}) {
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
  finishWheel(cell, emptyLabel, { multiple: multiple || (isMobile() && MULTI_SWITCH_KEYS.has(filterKey)) });
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
  /* Gyártmány/modell: teljes katalógussal, multi dobkerékkel — mountBrandModelCatalogDrums. */
  if (CATALOG_DRUM_KEYS.has(filterKey)) return;
  const label =
    wrap.querySelector(".home-qs-label")?.textContent?.trim() ||
    select.getAttribute("aria-label") ||
    filterKey;
  const emptyLabel = filterKey.endsWith("_tol") ? "-tól" : filterKey.endsWith("_ig") ? "-ig" : "Mindegy";
  const options = resolveOptions(filterKey, select, emptyLabel);
  const current = select.value;
  const cell = buildWheelCell({
    filterKey,
    wheelName: filterKey,
    label,
    options,
  });
  wrap.replaceWith(cell);
  if (current) setWheelValue(cell.querySelector("[data-wheel]"), current);
}

function convertRangePairToDual(wrap, cfg) {
  const tolEl = wrap.querySelector(`[data-filter-key="${cfg.tol}"]`);
  const igEl = wrap.querySelector(`[data-filter-key="${cfg.ig}"]`);
  if (!tolEl || !igEl) return;

  const isSelect = tolEl.tagName === "SELECT";
  const tolOpts = isSelect
    ? resolveOptions(cfg.tol, tolEl, "Mindegy")
    : optionsForAutoFilterKey(cfg.tol, "Mindegy");
  const igOpts = isSelect
    ? resolveOptions(cfg.ig, igEl, "Mindegy")
    : optionsForAutoFilterKey(cfg.ig, "Mindegy");
  const tolVal = isSelect ? tolEl.value : String(tolEl.value || "").replace(/\D/g, "");
  const igVal = isSelect ? igEl.value : String(igEl.value || "").replace(/\D/g, "");

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

  /* Csukott: egy vonal + összefoglaló (mint feladás / műszaki) — sheet továbbra is dual */
  const summary = document.createElement("button");
  summary.type = "button";
  summary.className = "immo-dual-range__summary";
  summary.dataset.dualRangeSummary = "1";
  summary.setAttribute("aria-haspopup", "listbox");
  summary.setAttribute("aria-expanded", "false");
  summary.setAttribute("aria-label", cfg.title);
  summary.textContent = "Mindegy";
  dual.appendChild(summary);

  const minCell = buildWheelCell({
    filterKey: cfg.tol,
    wheelName: cfg.tol,
    label: "",
    options: tolOpts,
    emptyLabel: "tól",
    halfClass: "immo-dual-range__half immo-dual-range__half--min",
  });
  const maxCell = buildWheelCell({
    filterKey: cfg.ig,
    wheelName: cfg.ig,
    label: "",
    options: igOpts,
    emptyLabel: "ig",
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

  const minWheel = minCell.querySelector("[data-wheel]");
  const maxWheel = maxCell.querySelector("[data-wheel]");
  if (tolVal) setWheelValue(minWheel, tolVal);
  if (igVal) setWheelValue(maxWheel, igVal);

  function refreshSummary() {
    const min = String(readWheel(minWheel) ?? "").trim();
    const max = String(readWheel(maxWheel) ?? "").trim();
    const unit = cfg.unit ? ` ${cfg.unit}` : "";
    if (!min && !max) {
      summary.textContent = "Mindegy";
      summary.classList.add("is-placeholder");
      return;
    }
    summary.classList.remove("is-placeholder");
    if (min && max) summary.textContent = `${min} – ${max}${unit}`;
    else if (min) summary.textContent = `${min} –${unit}`;
    else summary.textContent = `– ${max}${unit}`;
  }
  refreshSummary();

  const openSheet = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const fakeTrigger =
      minWheel.closest(".immo-wheel-wrap")?.querySelector(".immo-wheel-trigger") || summary;
    openAutoDrumSheet(minWheel, fakeTrigger);
  };
  summary.addEventListener("click", openSheet);

  [minWheel, maxWheel].forEach((w) => {
    w?.addEventListener("immo-wheel-change", refreshSummary);
  });
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

function catalogKindForDrums() {
  // Teherautó: soha személyautó katalógus.
  if (document.body?.getAttribute("data-site-page") === "teherauto") return "kisteher";
  return "szemelyauto";
}

const CATALOG_STATIC_BUST = "brandCatalog5";

async function fetchCatalogQuick() {
  const kind = catalogKindForDrums();
  const staticUrl =
    kind === "kisteher"
      ? `/data/vehicle-catalog-kisteher.json?v=${CATALOG_STATIC_BUST}`
      : `/data/vehicle-catalog.json?v=${CATALOG_STATIC_BUST}`;
  try {
    // HTTP Cache-Control (1 nap) — no-store minden megnyitáskor újra húzná a JSON-t.
    const res = await fetch(staticUrl, { cache: "force-cache" });
    const data = await res.json();
    if (data?.gyartmanyok?.length) return data;
  } catch {
    /* fallback API */
  }
  const { fetchVehicleCatalog } = await import(`./vehicle-catalog-client.js?v=${CATALOG_STATIC_BUST}`);
  return fetchVehicleCatalog({ kind });
}

function rebindWheel(form, wheelName, options, emptyLabel = "Mindegy", { multiple = false } = {}) {
  const wheel = form.querySelector(`[data-wheel="${wheelName}"]`);
  if (!wheel) return null;
  fillWheel(wheel, options, { emptyLabel });
  if (isMobile()) {
    initDrumWheel(wheel, { emptyLabel, openMode: "portal", multiple });
    const live = form.querySelector(`[data-wheel="${wheelName}"]`);
    setWheelValue(live, "");
    syncDrumWheelDisplay(live);
    bindAutoDrumSheet(live);
    return live;
  }
  const live = form.querySelector(`[data-wheel="${wheelName}"]`);
  setWheelValue(live, "");
  mountDesktopCellDrum(live.closest(".immo-wheel-wrap"), live, emptyLabel);
  return live;
}

function ensureBrandModelDrumCells(form) {
  for (const filterKey of ["gyartmany", "modell"]) {
    const wrap = form.querySelector(`[data-qs-field="${filterKey}"]`);
    if (!wrap || wrap.querySelector("[data-wheel]")) continue;
    const select = wrap.querySelector("select.home-qs-control");
    if (!select) continue;
    const label =
      wrap.querySelector(".home-qs-label")?.textContent?.trim() ||
      (filterKey === "modell" ? "Modell" : "Gyártmány");
    const cell = buildWheelCell({
      filterKey,
      wheelName: filterKey,
      label,
      options: [],
      emptyLabel: "Mindegy",
    });
    wrap.replaceWith(cell);
  }
}

function labelListShort(items, unit) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length <= 3) return items.join(", ");
  return `${items.length} ${unit}`;
}

/** Mobil: egy „Gyártmány & Modell” pill (mint a hirdetésfeladás), külön Modell mező elrejtve. */
function combineBrandModelOnMobile(form) {
  if (!isMobile() || !form || form.dataset.bmCombinedMobile === "1") return;
  const brandCell = form.querySelector('[data-qs-field="gyartmany"]');
  const modelCell = form.querySelector('[data-qs-field="modell"]');
  const brandWrap = form.querySelector('[data-wheel="gyartmany"]')?.closest(".immo-wheel-wrap");
  const brandWheel = form.querySelector('[data-wheel="gyartmany"]');
  const modelWheel = form.querySelector('[data-wheel="modell"]');
  if (!brandCell || !brandWrap || !brandWheel) return;

  const emptyCombined = "Gyártmány / Modell";
  form.dataset.bmCombinedMobile = "1";
  brandCell.classList.add("auto-search-bm-combined");
  brandWrap.classList.add("auto-search-bm-combined__wrap");

  const hideHost = modelCell?.closest(".home-qs-grid-cell") || modelCell;
  if (hideHost) {
    hideHost.classList.add("auto-search-bm-modell-nested");
    hideHost.setAttribute("hidden", "");
    hideHost.style.setProperty("display", "none", "important");
  }

  let labelEl = brandWrap.querySelector(".immo-label");
  if (labelEl) {
    labelEl.textContent = "Gyártmány & Modell";
    if (labelEl.parentElement === brandWrap) {
      brandCell.insertBefore(labelEl, brandWrap);
    }
  } else {
    labelEl = document.createElement("span");
    labelEl.className = "immo-label";
    labelEl.textContent = "Gyártmány & Modell";
    brandCell.insertBefore(labelEl, brandWrap);
  }

  function combinedSummary() {
    const brands = readWheelList(brandWheel);
    const models = modelWheel ? readWheelList(modelWheel) : [];
    if (!brands.length) return emptyCombined;
    const bPart = labelListShort(brands, "márka");
    if (!models.length) return bPart;
    return `${bPart} · ${labelListShort(models, "modell")}`;
  }

  function refreshCombined() {
    const trigger = brandWrap.querySelector(".immo-wheel-trigger");
    if (!trigger) return;
    const text = combinedSummary();
    trigger.textContent = text;
    trigger.dataset.emptyLabel = emptyCombined;
    trigger.setAttribute("aria-label", "Gyártmány és modell");
    trigger.classList.toggle("is-placeholder", text === emptyCombined);
    brandCell.classList.toggle("has-value", text !== emptyCombined);
    brandWrap.classList.toggle("has-value", text !== emptyCombined);
  }

  brandWheel.addEventListener("immo-wheel-change", () => {
    requestAnimationFrame(refreshCombined);
  });
  modelWheel?.addEventListener("immo-wheel-change", () => {
    requestAnimationFrame(refreshCombined);
  });

  const onPortalGone = () => {
    if (document.body.classList.contains("auto-drum-portal-open")) return;
    refreshCombined();
  };
  new MutationObserver(onPortalGone).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });

  refreshCombined();
}

/** Megjelenés: BM kívül, többi mező fehér Alapadatok kártyában (mint hirdetésfeladás). */
function liftAutoSearchFieldLabels(scope) {
  if (!scope) return;
  scope
    .querySelectorAll(".immo-schema-cell, .immo-dual-range-block, .immo-triple-date-block, .home-qs-field, .immo-field")
    .forEach((cell) => {
      const wrap = cell.querySelector(
        ":scope > .immo-wheel-wrap, :scope > .immo-dual-range, :scope > .immo-triple-date"
      );
      if (!wrap) return;
      const label = wrap.querySelector(
        ":scope > .immo-label, :scope > .immo-dual-range__title, :scope > .immo-triple-date__title"
      );
      if (!label) return;
      if (label.parentElement === wrap) {
        cell.insertBefore(label, wrap);
      }
    });
}

function styleAutoSearchAlapCard(form) {
  if (!isMobile() || !form) return;
  const host =
    form.querySelector("#qs-layout-main") ||
    form.querySelector(".home-qs-layout-main") ||
    form.querySelector(".auto-desk-fields[data-desk-alap]");
  if (!host) return;
  if (host.querySelector(":scope > .auto-search-alap-card")) return;

  const bm = host.querySelector(".auto-search-bm-combined");
  const bmHost =
    bm &&
    (() => {
      const grid = bm.closest(".home-qs-grid-cell");
      return grid && host.contains(grid) ? grid : bm;
    })();

  const kids = [...host.children].filter((el) => {
    if (el.classList.contains("auto-search-alap-card")) return false;
    if (bmHost && (el === bmHost || el.contains?.(bm))) return false;
    if (el.classList.contains("auto-search-bm-modell-nested")) return false;
    if (el.hasAttribute("hidden")) return false;
    if (el.style?.display === "none") return false;
    return true;
  });
  if (!kids.length) return;

  form.dataset.alapCardStyled = "1";
  const card = document.createElement("div");
  card.className = "auto-search-alap-card";
  card.innerHTML = form.hasAttribute("data-ertek-drums")
    ? `<div class="auto-search-alap-card__body"></div>`
    : `<p class="auto-search-alap-card__title">Alapadatok</p><div class="auto-search-alap-card__body"></div>`;
  const body = card.querySelector(".auto-search-alap-card__body");
  kids.forEach((el) => body.appendChild(el));

  if (bmHost?.nextSibling) host.insertBefore(card, bmHost.nextSibling);
  else if (bmHost) host.appendChild(card);
  else host.insertBefore(card, host.firstChild);

  liftAutoSearchFieldLabels(body);
}

/** Több szűrő: ugyanaz a fehér kártya + aláhúzás, mint Alapadatok (csak kinézet). */
export function styleAutoSearchMoreCard(form) {
  if (!isMobile() || !form) return;
  const host = form.querySelector("#qs-more-layout") || form.querySelector(".home-qs-more-layout");
  if (!host) return;

  let card = host.querySelector(":scope > .auto-search-alap-card");
  let body = card?.querySelector(".auto-search-alap-card__body");
  if (!card || !body) {
    const kids = [...host.children].filter((el) => {
      if (el.classList.contains("auto-search-alap-card")) return false;
      if (el.classList.contains("home-qs-static-legacy")) return false;
      if (el.hasAttribute("hidden")) return false;
      if (el.style?.display === "none") return false;
      return true;
    });
    if (!kids.length) return;
    card = document.createElement("div");
    card.className = "auto-search-alap-card auto-search-more-card";
    card.innerHTML = `<div class="auto-search-alap-card__body"></div>`;
    body = card.querySelector(".auto-search-alap-card__body");
    kids.forEach((el) => body.appendChild(el));
    host.appendChild(card);
  } else {
    [...host.children]
      .filter(
        (el) =>
          el !== card &&
          !el.classList.contains("home-qs-static-legacy") &&
          !el.hasAttribute("hidden") &&
          el.style?.display !== "none"
      )
      .forEach((el) => body.appendChild(el));
  }

  form.dataset.moreCardStyled = "1";
  liftAutoSearchFieldLabels(body);
  liftAutoSearchFieldLabels(host);
}

async function mountBrandModelCatalogDrums(form) {
  ensureBrandModelDrumCells(form);
  if (!form.querySelector('[data-wheel="gyartmany"]')) return;

  const brandWrap = form.querySelector('[data-wheel="gyartmany"]')?.closest(".immo-wheel-wrap");
  const brandTrigger = brandWrap?.querySelector(".immo-wheel-trigger");
  if (brandTrigger) {
    brandTrigger.disabled = true;
    brandTrigger.textContent = "Betöltés…";
  }

  let catalog;
  try {
    catalog = await fetchCatalogQuick();
  } catch (error) {
    console.warn("Dobkerék katalógus:", error);
    if (brandTrigger) {
      brandTrigger.disabled = false;
      brandTrigger.textContent = "Mindegy";
    }
    return;
  }

  form._autoDrumCatalog = catalog;
  const brands = (catalog.gyartmanyok || []).map((b) => ({ value: b, label: b }));
  const brandEmpty = isMobile() ? "Gyártmány / Modell" : "Mindegy";
  const brandWheel = rebindWheel(form, "gyartmany", brands, brandEmpty, { multiple: true });
  if (brandTrigger) brandTrigger.disabled = false;
  if (!brandWheel) return;

  const fillModels = (brandList) => {
    const brandsSelected = Array.isArray(brandList)
      ? brandList.filter(Boolean)
      : brandList
        ? [String(brandList)]
        : [];
    let list = [];
    if (brandsSelected.length === 1) {
      list = catalog.modellek?.[brandsSelected[0]] ?? [];
    } else if (brandsSelected.length > 1) {
      const set = new Set();
      brandsSelected.forEach((brand) => {
        (catalog.modellek?.[brand] || []).forEach((model) => set.add(model));
      });
      list = [...set].sort((a, b) => a.localeCompare(b, "hu", { sensitivity: "base" }));
    }
    const models = list.map((m) => ({ value: m, label: m }));
    const modelWheel = form.querySelector('[data-wheel="modell"]');
    /* BM portal már kitölti a modell kereket — ne wipe-oljuk rebind-del. */
    if (modelWheel?.dataset?.drumBound === "1") {
      const prev = readWheelList(modelWheel);
      fillWheel(modelWheel, models, { emptyLabel: "Mindegy" });
      modelWheel.dataset.multiple = "1";
      setWheelValue(
        modelWheel,
        prev.filter((m) => list.includes(m))
      );
      syncDrumWheelDisplay(modelWheel);
      return modelWheel;
    }
    return rebindWheel(form, "modell", models, "Mindegy", { multiple: true });
  };

  if (form.querySelector('[data-wheel="modell"]')) {
    fillModels([]);
    brandWheel.addEventListener("immo-wheel-change", () => {
      fillModels(readWheelList(form.querySelector('[data-wheel="gyartmany"]')));
    });
  }

  combineBrandModelOnMobile(form);
  styleAutoSearchAlapCard(form);
  styleAutoSearchMoreCard(form);
}

function convertMuszakiToDateTriple(wrap) {
  if (!wrap) return;
  const yearStart = new Date().getFullYear();
  const yearOpts = [{ value: "", label: "Mindegy" }];
  for (let y = yearStart; y <= yearStart + 5; y += 1) {
    yearOpts.push({ value: String(y), label: String(y) });
  }
  const monthOpts = [{ value: "", label: "Mindegy" }];
  for (let m = 1; m <= 12; m += 1) {
    const v = String(m).padStart(2, "0");
    monthOpts.push({ value: v, label: v });
  }
  const dayOpts = [{ value: "", label: "Mindegy" }];
  for (let d = 1; d <= 31; d += 1) {
    const v = String(d).padStart(2, "0");
    dayOpts.push({ value: v, label: v });
  }

  const prevYear =
    wrap.querySelector('[data-filter-key="muszaki_ev"]')?.value ||
    wrap.querySelector("select")?.value ||
    "";

  const block = document.createElement("div");
  block.className = "immo-triple-date-block";
  block.dataset.range = "muszaki";

  const triple = document.createElement("div");
  triple.className = "immo-triple-date";
  triple.dataset.range = "muszaki";
  triple.setAttribute("aria-label", "Műszaki érvényesség");

  const title = document.createElement("span");
  title.className = "immo-label immo-triple-date__title";
  title.textContent = "Műszaki érvényesség";
  triple.appendChild(title);

  const summary = document.createElement("button");
  summary.type = "button";
  summary.className = "immo-triple-date__summary";
  summary.dataset.muszakiSummary = "1";
  summary.setAttribute("aria-haspopup", "listbox");
  summary.setAttribute("aria-expanded", "false");
  summary.textContent = "Mindegy";
  triple.appendChild(summary);

  const yearCell = buildWheelCell({
    filterKey: "muszaki_ev",
    wheelName: "muszaki_ev",
    label: "",
    options: yearOpts,
    emptyLabel: "Mindegy",
    halfClass: "immo-triple-date__half immo-triple-date__half--year",
  });
  const monthCell = buildWheelCell({
    filterKey: "muszaki_honap",
    wheelName: "muszaki_honap",
    label: "",
    options: monthOpts,
    emptyLabel: "Mindegy",
    halfClass: "immo-triple-date__half immo-triple-date__half--month",
  });
  const dayCell = buildWheelCell({
    filterKey: "muszaki_nap",
    wheelName: "muszaki_nap",
    label: "",
    options: dayOpts,
    emptyLabel: "Mindegy",
    halfClass: "immo-triple-date__half immo-triple-date__half--day",
  });

  yearCell.hidden = true;
  monthCell.hidden = true;
  dayCell.hidden = true;

  triple.appendChild(yearCell);
  triple.appendChild(monthCell);
  triple.appendChild(dayCell);
  block.appendChild(triple);
  wrap.replaceWith(block);

  const yWheel = yearCell.querySelector("[data-wheel]");
  const mWheel = monthCell.querySelector("[data-wheel]");
  const dWheel = dayCell.querySelector("[data-wheel]");
  if (prevYear) setWheelValue(yWheel, String(prevYear));

  function refreshSummary() {
    const y = String(readWheel(yWheel) ?? "");
    const m = String(readWheel(mWheel) ?? "");
    const d = String(readWheel(dWheel) ?? "");
    summary.textContent = y ? `${y}. ${m || "—"}. ${d || "—"}` : "Mindegy";
  }
  refreshSummary();

  const openSheet = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const fakeTrigger = yWheel.closest(".immo-wheel-wrap")?.querySelector(".immo-wheel-trigger") || summary;
    openAutoDrumSheet(yWheel, fakeTrigger);
  };
  summary.addEventListener("click", openSheet);

  [yWheel, mWheel, dWheel].forEach((w) => {
    w?.addEventListener("immo-wheel-change", refreshSummary);
  });
}

export async function mountAutoSearchDrums(form = document.getElementById("home-qs-form")) {
  if (!form || form.dataset.drumsMounted === "1") return form.dataset.drumsMounted === "1";
  const page = document.body?.getAttribute("data-site-page") || "";
  const force = form.hasAttribute("data-force-drums") || form.hasAttribute("data-ertek-drums");
  if (!force && page !== "auto" && page !== "teherauto") return false;

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

  const muszakiWrap = form.querySelector('[data-qs-field="muszaki_ev"]');
  if (muszakiWrap) convertMuszakiToDateTriple(muszakiWrap);

  form.querySelectorAll("[data-qs-field]").forEach((wrap) => {
    if (wrap.closest(".immo-dual-range-block")) return;
    if (wrap.closest(".immo-triple-date-block")) return;
    const key = wrap.getAttribute("data-qs-field");
    if (dualKeys.has(key) || SEARCH_OMIT_FIELDS.has(key)) return;
    if (key === "muszaki_ev" || key === "muszaki_nap") return;
    if (CATALOG_DRUM_KEYS.has(key)) return;
    if (wrap.querySelector("input.home-qs-control--price, input.home-qs-control[type='text'][data-filter-key^='ar_']")) {
      return;
    }
    if (wrap.querySelector("input.home-qs-control[type='text'], input.immo-control[type='text']")) return;
    if (wrap.querySelectorAll("select.home-qs-control").length >= 2) {
      convertRangePairToTwoDrums(wrap);
      return;
    }
    if (wrap.querySelector("select.home-qs-control")) convertSimpleField(wrap);
  });

  try {
    await mountBrandModelCatalogDrums(form);
  } catch (error) {
    console.warn("Dobkerék katalógus:", error);
  }
  styleAutoSearchAlapCard(form);
  styleAutoSearchMoreCard(form);
  form.dataset.drumsMounted = "1";
  return true;
}

export function resetAutoSearchDrums(form = document.getElementById("home-qs-form")) {
  if (!form || form.dataset.drumsMounted !== "1") return;
  form.querySelectorAll("[data-wheel]").forEach((wheel) => setWheelValue(wheel, ""));
  form.querySelectorAll('input.home-qs-control[data-filter-key]').forEach((el) => {
    el.value = "";
  });
  form.querySelectorAll(".auto-cell-drum").forEach((wrap) => {
    wrap._desktopCellDrum?.refresh("");
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

  form.querySelectorAll("[data-wheel][data-filter-key]").forEach((wheel) => {
    const key = wheel.getAttribute("data-filter-key");
    if (!key || seen.has(key)) return;
    if (wheel.dataset.multiple === "1") {
      const list = readWheelList(wheel);
      if (!list.length) return;
      seen.add(key);
      const outKey = MULTI_FILTER_KEY[key] || key;
      if (outKey === "gyartmanyok") out.gyartmanyok = list;
      else if (outKey === "modellek") out.modellek = list;
      else out[outKey] = list;
      return;
    }
    const raw = String(readWheel(wheel) ?? "").trim();
    if (!raw) return;
    seen.add(key);
    if (key.endsWith("_tol") || key.endsWith("_ig")) out[key] = numOrNull(raw);
    else out[key] = raw;
  });

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
