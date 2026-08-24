/**
 * Személyautó kereső — mentett admin-elrendezés (form-layout szemelyauto-search).
 */

import { initVehicleCatalogSelects, fillSelect } from "./vehicle-catalog-client.js";

const LAYOUT_URL = "/api/level1/form-layout?category=szemelyauto-search";

const FIRST_YEAR = 1950;
const LAST_YEAR = 2035;
const PRICE_STEP = 500_000;
const PRICE_MAX = 50_000_000;
const KM_STEP = 10_000;
const KM_MAX = 500_000;
const LE_STEPS = [50, 75, 100, 125, 150, 175, 200, 225, 250, 300, 350, 400, 500, 600, 800];

/** Admin mező → kereső filter kulcs / widget. */
const RANGE_SPECS = {
  gyartasi_ev: { tol: "ev_tol", ig: "ev_ig", kind: "year" },
  vetelar: { tol: "ar_tol", ig: "ar_ig", kind: "price" },
  km: { tol: "km_tol", ig: "km_ig", kind: "km" },
  teljesitmeny_le: { tol: "le_tol", ig: "le_ig", kind: "le" },
  hengerurtartalom: { tol: "ccm_tol", ig: "ccm_ig", kind: "number" },
  sajat_tomeg: { tol: "sajat_tomeg_tol", ig: "sajat_tomeg_ig", kind: "number" },
  ossztomeg: { tol: "ossztomeg_tol", ig: "ossztomeg_ig", kind: "number" },
  nyomatek_nm: { tol: "nyomatek_nm_tol", ig: "nyomatek_nm_ig", kind: "number" },
  hatotav: { tol: "hatotav_tol", ig: "hatotav_ig", kind: "number" },
};

const SELECT_OPTIONS = {
  allapot: ["Normál", "Újszerű", "Sérülésmentes", "Sérült"],
  kivitel: ["Szedán", "Ferdehátú", "Kombi", "SUV / Crossover", "Egyterű", "Kupé", "Cabrio"],
  ajtok: ["2", "3", "4", "5"],
  sebessegvalto: ["Manuális", "Automata"],
  hajtas: ["Első kerék", "Hátsó kerék", "Összkerék"],
  uzemanyag: [
    { value: "benzin", label: "Benzin" },
    { value: "diesel", label: "Dízel" },
    { value: "hybrid", label: "Hibrid" },
    { value: "benzin-gaz", label: "Benzin/Gáz" },
    { value: "elektromos", label: "Elektromos" },
  ],
  klima: ["Nincs", "Manuális", "Digitális", "Digitális, 2 zónás", "Digitális, 3 zónás", "Digitális, 4 zónás"],
  szin: ["Fehér", "Fekete", "Szürke", "Ezüst", "Kék", "Piros", "Zöld", "Barna", "Sárga", "Narancs", "Bézs"],
  teto: ["Normál", "Nyitható", "Panoráma", "Hardtop"],
  csomagtarto: ["Normál", "Nagy"],
  tolto_csatlakozas: ["Type 2", "CCS", "CHAdeMO"],
  okmany_jelleg: ["Érvényes magyar okmányokkal", "Érvényes külföldi okmányokkal"],
  tulajdonosok_szama: ["1", "2", "3", "4+"],
  nem_dohanyzo: ["Igen", "Nem"],
  holgy_tulajdonos: ["Igen", "Nem"],
  alkudhato: ["Igen", "Nem"],
  csere: ["Igen", "Nem"],
};

let cachedLayout = null;

export async function fetchAutoSearchLayout({ force = false } = {}) {
  if (cachedLayout && !force) return cachedLayout;
  const res = await fetch(LAYOUT_URL, { credentials: "same-origin", cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  cachedLayout = data.layout || { version: 2, category: "szemelyauto-search", cells: [] };
  return cachedLayout;
}

function yearOptions() {
  const years = [];
  for (let year = LAST_YEAR; year >= FIRST_YEAR; year -= 1) years.push(String(year));
  return years;
}

function priceOptions() {
  const prices = [];
  for (let price = PRICE_STEP; price <= PRICE_MAX; price += PRICE_STEP) prices.push(price);
  return prices;
}

function kmOptions() {
  const values = [];
  for (let km = 0; km <= KM_MAX; km += KM_STEP) values.push(km);
  return values;
}

function fillNumberSelect(select, values, emptyLabel, format = (n) => n.toLocaleString("hu-HU")) {
  if (!select) return;
  select.innerHTML = `<option value="">${emptyLabel}</option>`;
  for (const value of values) {
    const opt = document.createElement("option");
    opt.value = String(value);
    opt.textContent = format(value);
    select.appendChild(opt);
  }
}

function fillOptionsSelect(select, options) {
  if (!select) return;
  select.innerHTML = `<option value="">Mindegy</option>`;
  for (const opt of options) {
    const el = document.createElement("option");
    if (typeof opt === "string") {
      el.value = opt;
      el.textContent = opt;
    } else {
      el.value = opt.value;
      el.textContent = opt.label;
    }
    select.appendChild(el);
  }
}

function cellsForStep(layout, step) {
  return (layout.cells || [])
    .filter((c) => !c.hidden && Number(c.step) === step)
    .sort((a, b) => (a.row - b.row) || (a.col - b.col));
}

function groupByRow(cells) {
  const rows = new Map();
  for (const cell of cells) {
    const row = Number(cell.row) || 1;
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row).push(cell);
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, items]) => items);
}

function fieldWidthClass(cell) {
  const span = Number(cell.colSpan) || 6;
  if (span >= 10) return "home-qs-field--wide";
  if (span <= 3) return "home-qs-field--narrow";
  return "home-qs-field--wide";
}

function rangeHtml(cell, spec) {
  const label = cell.label || cell.field_key;
  const suffix =
    spec.kind === "price" ? '<span class="home-qs-suffix" aria-hidden="true">Ft</span>' :
    spec.kind === "le" ? '<span class="home-qs-suffix" aria-hidden="true">LE</span>' :
    spec.kind === "km" ? "" : "";
  return `<div class="home-qs-pair" data-qs-field="${cell.field_key}">
    <label class="home-qs-field home-qs-field--narrow">
      <span class="home-qs-label">${label}</span>
      <select class="home-qs-control" data-filter-key="${spec.tol}" aria-label="${label} -tól"></select>
      ${suffix}
    </label>
    <label class="home-qs-field home-qs-field--narrow">
      <select class="home-qs-control" data-filter-key="${spec.ig}" aria-label="${label} -ig"></select>
      ${suffix}
    </label>
  </div>`;
}

function fieldHtml(cell) {
  const key = cell.field_key;
  const label = cell.label || key;
  const width = fieldWidthClass(cell);
  const spec = RANGE_SPECS[key];
  if (spec) return rangeHtml(cell, spec);
  if (key === "gyartmany") {
    return `<label class="home-qs-field ${width}" data-qs-field="${key}">
      <span class="home-qs-label">${label}</span>
      <select class="home-qs-control" id="qs-gyartmany" data-filter-key="gyartmany"></select>
    </label>`;
  }
  if (key === "modell") {
    return `<label class="home-qs-field ${width}" data-qs-field="${key}">
      <span class="home-qs-label">Típus</span>
      <select class="home-qs-control" id="qs-modell" data-filter-key="modell"></select>
    </label>`;
  }
  if (key === "uzemanyag") {
    return `<label class="home-qs-field ${width}" data-qs-field="${key}">
      <span class="home-qs-label">${label}</span>
      <select class="home-qs-control" data-filter-key="uzemanyagQuick"></select>
    </label>`;
  }
  if (SELECT_OPTIONS[key]) {
    return `<label class="home-qs-field ${width}" data-qs-field="${key}">
      <span class="home-qs-label">${label}</span>
      <select class="home-qs-control" data-filter-key="${key}"></select>
    </label>`;
  }
  return `<label class="home-qs-field ${width}" data-qs-field="${key}">
    <span class="home-qs-label">${label}</span>
    <input class="home-qs-control" type="text" data-filter-key="${key}" placeholder="Mindegy" autocomplete="off" />
  </label>`;
}

function renderStep(host, layout, step) {
  if (!host) return;
  const cells = cellsForStep(layout, step);
  if (!cells.length) {
    host.innerHTML = "";
    host.hidden = true;
    return;
  }
  const rows = groupByRow(cells)
    .map((items) => `<div class="home-qs-row">${items.map(fieldHtml).join("")}</div>`)
    .join("");
  host.innerHTML = rows;
  host.hidden = false;
}

function wireRangeSelects(root) {
  for (const [fieldKey, spec] of Object.entries(RANGE_SPECS)) {
    const wrap = root.querySelector(`[data-qs-field="${fieldKey}"]`);
    if (!wrap) continue;
    const tol = wrap.querySelector(`[data-filter-key="${spec.tol}"]`);
    const ig = wrap.querySelector(`[data-filter-key="${spec.ig}"]`);
    if (spec.kind === "year") {
      const years = yearOptions();
      fillSelect(tol, years, "-tól");
      fillSelect(ig, years, "-ig");
    } else if (spec.kind === "price") {
      fillNumberSelect(tol, priceOptions(), "-tól");
      fillNumberSelect(ig, priceOptions(), "-ig");
    } else if (spec.kind === "km") {
      fillNumberSelect(tol, kmOptions(), "-tól", (n) => `${n.toLocaleString("hu-HU")} km`);
      fillNumberSelect(ig, kmOptions(), "-ig", (n) => `${n.toLocaleString("hu-HU")} km`);
    } else if (spec.kind === "le") {
      fillNumberSelect(tol, LE_STEPS, "-tól", (n) => `${n} LE`);
      fillNumberSelect(ig, LE_STEPS, "-ig", (n) => `${n} LE`);
    }
  }
}

function wireSelectOptions(root) {
  for (const [key, options] of Object.entries(SELECT_OPTIONS)) {
    root.querySelectorAll(`[data-filter-key="${key}"]`).forEach((select) => {
      fillOptionsSelect(select, options);
    });
  }
}

async function wireCatalog(form) {
  const brandSelect = form.querySelector("#qs-gyartmany");
  const modelSelect = form.querySelector("#qs-modell");
  if (!brandSelect || !modelSelect) return;
  try {
    await initVehicleCatalogSelects({
      brandSelect,
      modelSelect,
      brandEmptyLabel: "Mindegy",
      modelEmptyLabel: "Mindegy",
      yearFromCatalog: false,
    });
  } catch (error) {
    console.warn("Kereső katalógus:", error);
  }
}

function hideLegacy(form) {
  form.querySelectorAll(".home-qs-static-legacy").forEach((el) => {
    el.hidden = true;
    el.style.display = "none";
  });
}

export async function applyAutoSearchLayout(form = document.getElementById("home-qs-form")) {
  if (!form) return null;
  const layout = await fetchAutoSearchLayout();
  const mainHost = document.getElementById("qs-layout-main");
  const moreHost = document.getElementById("qs-more-layout");
  const visible = (layout.cells || []).filter((c) => !c.hidden);

  if (!visible.length) return layout;

  hideLegacy(form);
  renderStep(mainHost, layout, 1);

  if (moreHost) {
    const moreCells = (layout.cells || [])
      .filter((c) => !c.hidden && Number(c.step) >= 2 && Number(c.step) <= 5)
      .sort((a, b) => (a.step - b.step) || (a.row - b.row) || (a.col - b.col));
    if (!moreCells.length) {
      moreHost.innerHTML = "";
      moreHost.hidden = true;
    } else {
      const rows = groupByRow(moreCells)
        .map((items) => `<div class="home-qs-row">${items.map(fieldHtml).join("")}</div>`)
        .join("");
      moreHost.innerHTML = rows;
      moreHost.hidden = false;
    }
  }

  wireRangeSelects(form);
  wireSelectOptions(form);
  await wireCatalog(form);
  return layout;
}

export function readLayoutFilterValues(form) {
  const out = {};
  const numOrNull = (value) => {
    if (value == null || value === "") return null;
    const n = Number(String(value).replace(/\D/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  form.querySelectorAll("[data-filter-key]").forEach((el) => {
    const key = el.getAttribute("data-filter-key");
    if (!key) return;
    const raw = el.value?.trim() ?? "";
    if (!raw) return;
    if (key.endsWith("_tol") || key.endsWith("_ig")) {
      out[key] = numOrNull(raw);
    } else {
      out[key] = raw;
    }
  });
  return out;
}
