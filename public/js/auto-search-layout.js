/**
 * Autó / teherautó kereső — mentett admin-elrendezés
 * (szemelyauto-search | teherauto-search).
 */

import { initVehicleCatalogSelects, fillSelect } from "./vehicle-catalog-client.js";
import { KIVITEL_OPTIONS } from "./kivitel-options.js?v=kivitel1";

function searchLayoutCategory() {
  return document.body?.getAttribute("data-site-page") === "teherauto"
    ? "teherauto-search"
    : "szemelyauto-search";
}

function layoutUrl() {
  return `/api/level1/form-layout?category=${encodeURIComponent(searchLayoutCategory())}`;
}

const FIRST_YEAR = 1950;
const LAST_YEAR = 2035;
const PRICE_STEP = 500_000;
const PRICE_MAX = 50_000_000;
const KM_STEP = 10_000;
const KM_MAX = 500_000;
const LE_STEPS = [50, 75, 100, 125, 150, 175, 200, 225, 250, 300, 350, 400, 500, 600, 800];
const CCM_STEPS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500, 3000, 3500, 4000, 5000, 6000];

/** Keresőben soha ne jelenjen meg (feladás-specifikus / felesleges). */
const SEARCH_OMIT_FIELDS = new Set([
  "gyartasi_honap",
  "forgalomba_helyezes_honap",
  "muszaki_honap",
  // Egyéb típus csak a feladáson használható.
  "egyeb_tipus",
  "egyeb_modell",
  // Helyszín: irányítószám → település; megye nem kell a keresőben.
  "megye",
]);

/** Új keresőmezők: élő layoutban is jelenjenek meg (ne maradjanak rejtve). */
const SEARCH_FORCE_VISIBLE = new Set(["keresesi_korzet"]);

/** Admin mező → kereső filter kulcs / widget. */
const RANGE_SPECS = {
  gyartasi_ev: { tol: "ev_tol", ig: "ev_ig", kind: "year" },
  vetelar: { tol: "ar_tol", ig: "ar_ig", kind: "price" },
  km: { tol: "km_tol", ig: "km_ig", kind: "km" },
  teljesitmeny_le: { tol: "le_tol", ig: "le_ig", kind: "le" },
  hengerurtartalom: { tol: "ccm_tol", ig: "ccm_ig", kind: "ccm" },
  sajat_tomeg: { tol: "sajat_tomeg_tol", ig: "sajat_tomeg_ig", kind: "number" },
  ossztomeg: { tol: "ossztomeg_tol", ig: "ossztomeg_ig", kind: "number" },
  nyomatek_nm: { tol: "nyomatek_nm_tol", ig: "nyomatek_nm_ig", kind: "number" },
  hatotav: { tol: "hatotav_tol", ig: "hatotav_ig", kind: "number" },
  akkumulator_kwh: { tol: "akkumulator_kwh_tol", ig: "akkumulator_kwh_ig", kind: "number" },
  jelenlegi_akkukapacitas: { tol: "jelenlegi_akkukapacitas_tol", ig: "jelenlegi_akkukapacitas_ig", kind: "number" },
  ac_toltesi_teljesitmeny: { tol: "ac_toltesi_teljesitmeny_tol", ig: "ac_toltesi_teljesitmeny_ig", kind: "number" },
  dc_toltesi_teljesitmeny: { tol: "dc_toltesi_teljesitmeny_tol", ig: "dc_toltesi_teljesitmeny_ig", kind: "number" },
  autopalya_hatotav: { tol: "autopalya_hatotav_tol", ig: "autopalya_hatotav_ig", kind: "number" },
  teli_hatotav: { tol: "teli_hatotav_tol", ig: "teli_hatotav_ig", kind: "number" },
};

const TEHER_KIVITEL = ["Kisteher", "Dobozos", "Platós", "Ponyvás", "Hűtős", "Billenős", "Alváz"];

/** Keresési körzet: 10 km-es lépés, 200 km-ig. */
export const KERESESI_KORZET_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const km = (i + 1) * 10;
  return { value: String(km), label: `${km} km` };
});

const SELECT_OPTIONS = {
  allapot: ["Normál", "Újszerű", "Sérülésmentes", "Sérült"],
  kivitel: [...KIVITEL_OPTIONS],
  keresesi_korzet: KERESESI_KORZET_OPTIONS,
  ajtok: ["2", "3", "4", "5"],
  szemelyek: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
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
  ac_tolto_csatlakozas: ["Type 2", "CCS", "CHAdeMO", "Egyéb"],
  dc_tolto_csatlakozas: ["CCS", "CHAdeMO", "Type 2", "Egyéb"],
  villamtoltes: ["Igen", "Nem"],
  zold_rendszam: ["Igen", "Nem"],
  okmany_jelleg: ["Érvényes magyar okmányokkal", "Érvényes külföldi okmányokkal"],
  tulajdonosok_szama: ["1", "2", "3", "4+"],
  nem_dohanyzo: ["Igen", "Nem"],
  holgy_tulajdonos: ["Igen", "Nem"],
  alkudhato: ["Igen", "Nem"],
  csere: ["Igen", "Nem"],
  megye: [
    "Budapest",
    "Baranya",
    "Bács-Kiskun",
    "Békés",
    "Borsod-Abaúj-Zemplén",
    "Csongrád-Csanád",
    "Fejér",
    "Győr-Moson-Sopron",
    "Hajdú-Bihar",
    "Heves",
    "Jász-Nagykun-Szolnok",
    "Komárom-Esztergom",
    "Nógrád",
    "Pest",
    "Somogy",
    "Szabolcs-Szatmár-Bereg",
    "Tolna",
    "Vas",
    "Veszprém",
    "Zala",
  ],
};

function selectOptionsFor(key) {
  if (key === "kivitel" && searchLayoutCategory() === "teherauto-search") {
    return TEHER_KIVITEL;
  }
  return SELECT_OPTIONS[key];
}

/** Rövid megjelenő címke a keresőben (a hosszú admin-címke helyett). */
const SEARCH_LABEL_SHORT = {
  szemelyek: "Személyek",
  megye: "Megye",
  telepules: "Település",
  iranyitoszam: "Irányítószám",
  keresesi_korzet: "Keresési körzet",
};

const NARROW_FIELD_KEYS = new Set(["szemelyek", "megye", "ajtok", "telepules", "iranyitoszam", "keresesi_korzet"]);

/** Szabad szöveges keresőmezők — ne legyenek dobkerék. */
const TEXT_FIELD_KEYS = new Set(["telepules", "iranyitoszam"]);

const LAYOUT_COLS = 12;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function cellGridMeta(cell) {
  const col = clamp(Number(cell.col) || 1, 1, LAYOUT_COLS);
  let span = clamp(Number(cell.colSpan) || 6, 1, LAYOUT_COLS);
  if (col + span - 1 > LAYOUT_COLS) span = LAYOUT_COLS - col + 1;
  const row = Math.max(1, Number(cell.row) || 1);
  return { col, span, row };
}

function cellGridStyle(cell, rowOverride = null) {
  const { col, span, row } = cellGridMeta(cell);
  const r = rowOverride ?? row;
  return `grid-column:${col} / span ${span};grid-row:${r}`;
}

function wrapGridCell(cell, innerHtml, rowOverride = null) {
  const { col, span, row } = cellGridMeta(cell);
  const r = rowOverride ?? row;
  return `<div class="home-qs-grid-cell" data-grid-col="${col}" data-grid-span="${span}" data-grid-row="${r}" style="${cellGridStyle(cell, r)}">${innerHtml}</div>`;
}
let cachedLayout = null;
let cachedLayoutCategory = "";

export async function fetchAutoSearchLayout({ force = false } = {}) {
  const category = searchLayoutCategory();
  if (cachedLayout && !force && cachedLayoutCategory === category) return cachedLayout;
  const res = await fetch(layoutUrl(), { credentials: "same-origin", cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  cachedLayout = data.layout || { version: 2, category, cells: [] };
  cachedLayoutCategory = category;
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

function isSearchCellVisible(cell) {
  if (!cell) return false;
  if (SEARCH_OMIT_FIELDS.has(cell.field_key)) return false;
  if (SEARCH_FORCE_VISIBLE.has(cell.field_key)) return true;
  if (cell.hidden) return false;
  return true;
}

function cellsForStep(layout, step) {
  return (layout.cells || [])
    .filter((c) => isSearchCellVisible(c) && Number(c.step) === step)
    .sort((a, b) => (a.row - b.row) || (a.col - b.col));
}

/** Dobkerék / select közös opciólista egy filter kulcshoz. */
export function optionsForAutoFilterKey(filterKey, emptyLabel = "Mindegy") {
  const key = String(filterKey || "");
  const withEmpty = (list) => [{ value: "", label: emptyLabel }, ...list];

  if (key === "ev_tol" || key === "ev_ig") {
    return withEmpty(yearOptions().map((y) => ({ value: y, label: y })));
  }
  if (key === "ar_tol" || key === "ar_ig") {
    return withEmpty(
      priceOptions().map((n) => ({ value: String(n), label: n.toLocaleString("hu-HU") }))
    );
  }
  if (key === "km_tol" || key === "km_ig") {
    return withEmpty(
      kmOptions().map((n) => ({ value: String(n), label: `${n.toLocaleString("hu-HU")} km` }))
    );
  }
  if (key === "le_tol" || key === "le_ig") {
    return withEmpty(LE_STEPS.map((n) => ({ value: String(n), label: `${n} LE` })));
  }
  if (key === "ccm_tol" || key === "ccm_ig") {
    return withEmpty(CCM_STEPS.map((n) => ({ value: String(n), label: `${n.toLocaleString("hu-HU")} cm³` })));
  }
  if (key === "uzemanyagQuick" || key === "uzemanyag") {
    return withEmpty(
      SELECT_OPTIONS.uzemanyag.map((opt) =>
        typeof opt === "string" ? { value: opt, label: opt } : { value: opt.value, label: opt.label }
      )
    );
  }
  const selectOpts = selectOptionsFor(key);
  if (selectOpts) {
    return withEmpty(
      selectOpts.map((opt) =>
        typeof opt === "string" ? { value: opt, label: opt } : { value: opt.value, label: opt.label }
      )
    );
  }
  return [{ value: "", label: emptyLabel }];
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

function fieldWidthClass(_cell) {
  /* Szélességet a 12 oszlopos grid (colSpan) adja — ne flex wide/narrow. */
  return "";
}

function rangeHtml(cell, spec) {
  const label = cell.label || cell.field_key;
  const suffix =
    spec.kind === "price" ? '<span class="home-qs-suffix" aria-hidden="true">Ft</span>' :
    spec.kind === "le" ? '<span class="home-qs-suffix" aria-hidden="true">LE</span>' :
    spec.kind === "km" ? "" : "";
  return `<div class="home-qs-pair" data-qs-field="${cell.field_key}">
    <label class="home-qs-field">
      <span class="home-qs-label">${label}</span>
      <select class="home-qs-control" data-filter-key="${spec.tol}" aria-label="${label} -tól"></select>
      ${suffix}
    </label>
    <label class="home-qs-field">
      <select class="home-qs-control" data-filter-key="${spec.ig}" aria-label="${label} -ig"></select>
      ${suffix}
    </label>
  </div>`;
}

function fieldHtml(cell) {
  const key = cell.field_key;
  const label = SEARCH_LABEL_SHORT[key] || cell.label || key;
  const spec = RANGE_SPECS[key];
  if (spec) return rangeHtml(cell, spec);
  if (key === "gyartmany") {
    return `<label class="home-qs-field" data-qs-field="${key}">
      <span class="home-qs-label">${label}</span>
      <select class="home-qs-control" id="qs-gyartmany" data-filter-key="gyartmany"></select>
    </label>`;
  }
  if (key === "modell") {
    return `<label class="home-qs-field" data-qs-field="${key}">
      <span class="home-qs-label">Modell</span>
      <select class="home-qs-control" id="qs-modell" data-filter-key="modell"></select>
    </label>`;
  }
  if (key === "tipus") {
    return `<label class="home-qs-field" data-qs-field="${key}">
      <span class="home-qs-label">Típus</span>
      <select class="home-qs-control" id="qs-tipus" data-filter-key="tipus"></select>
    </label>`;
  }
  if (key === "uzemanyag") {
    return `<label class="home-qs-field" data-qs-field="${key}">
      <span class="home-qs-label">${label}</span>
      <select class="home-qs-control" data-filter-key="uzemanyagQuick"></select>
    </label>`;
  }
  if (selectOptionsFor(key)) {
    return `<label class="home-qs-field" data-qs-field="${key}">
      <span class="home-qs-label">${label}</span>
      <select class="home-qs-control" data-filter-key="${key}"></select>
    </label>`;
  }
  /* Település / irányítószám: szövegmező (ingatlan immo-field kinézet), nem dobkerék */
  const attrs =
    key === "iranyitoszam"
      ? 'inputmode="numeric" maxlength="4" autocomplete="postal-code"'
      : key === "telepules"
        ? 'autocomplete="address-level2"'
        : 'autocomplete="off"';
  return `<label class="immo-field home-qs-field--text" data-qs-field="${key}">
    <span class="immo-label">${label}</span>
    <input class="immo-control home-qs-control" type="text" data-filter-key="${key}" placeholder="Mindegy" ${attrs} />
  </label>`;
}

function renderGrid(host, cells, { rowOffset = 0 } = {}) {
  if (!host) return;
  if (!cells.length) {
    host.innerHTML = "";
    host.hidden = true;
    host.classList.remove("home-qs-grid");
    return;
  }
  host.classList.add("home-qs-grid");
  host.innerHTML = cells
    .map((cell) => {
      const baseRow = Math.max(1, Number(cell.row) || 1);
      const row = rowOffset + baseRow;
      return wrapGridCell(cell, fieldHtml(cell), row);
    })
    .join("");
  host.hidden = false;
}

function renderStep(host, layout, step) {
  renderGrid(host, cellsForStep(layout, step));
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
    } else if (spec.kind === "ccm") {
      fillNumberSelect(tol, CCM_STEPS, "-tól", (n) => `${n.toLocaleString("hu-HU")} cm³`);
      fillNumberSelect(ig, CCM_STEPS, "-ig", (n) => `${n.toLocaleString("hu-HU")} cm³`);
    }
  }
}

function wireSelectOptions(root) {
  const keys = new Set([...Object.keys(SELECT_OPTIONS), "kivitel"]);
  for (const key of keys) {
    const options = selectOptionsFor(key);
    if (!options) continue;
    const selectors =
      key === "uzemanyag"
        ? '[data-filter-key="uzemanyag"], [data-filter-key="uzemanyagQuick"]'
        : `[data-filter-key="${key}"]`;
    root.querySelectorAll(selectors).forEach((select) => {
      fillOptionsSelect(select, options);
    });
  }
}

async function wireCatalog(form) {
  const brandSelect = form.querySelector("#qs-gyartmany");
  const modelSelect = form.querySelector("#qs-modell");
  const typeSelect = form.querySelector("#qs-tipus");
  if (!brandSelect || !modelSelect) return;
  try {
    await initVehicleCatalogSelects({
      brandSelect,
      modelSelect,
      tipusSelect: typeSelect,
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

function setFieldValue(input, value) {
  if (!input || !("value" in input)) return;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Irányítószám ↔ település autofill (/api/postal-codes/lookup).
 */
function wirePostalCityAutofill(form) {
  if (!form || form.dataset.postalCityBound === "1") return;
  const postalInput = form.querySelector('[data-filter-key="iranyitoszam"]');
  const cityInput = form.querySelector('[data-filter-key="telepules"]');
  if (!postalInput || postalInput.tagName !== "INPUT") return;
  if (!cityInput || cityInput.tagName !== "INPUT") {
    // Csak IRSZ → település, ha nincs szöveges településmező
  }

  form.dataset.postalCityBound = "1";
  let lastPostalLookedUp = "";
  let lastCityLookedUp = "";
  let busy = false;
  /** 'postal' | 'city' — ne írjuk felül egymást visszacsatoláskor */
  let fillSource = "";

  async function lookupFromPostal() {
    const digits = String(postalInput.value ?? "")
      .replace(/\D/g, "")
      .slice(0, 4);
    if (postalInput.value !== digits) postalInput.value = digits;
    if (digits.length !== 4) return;
    if (digits === lastPostalLookedUp || busy) return;
    if (fillSource === "city") return;
    busy = true;
    fillSource = "postal";
    try {
      const params = new URLSearchParams({ postal_code: digits });
      const res = await fetch(`/api/postal-codes/lookup?${params}`, { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      lastPostalLookedUp = digits;
      if (res.ok && data.city) {
        lastCityLookedUp = String(data.city).trim();
        setFieldValue(cityInput, data.city);
      } else if (cityInput) {
        lastCityLookedUp = "";
        setFieldValue(cityInput, "");
      }
    } catch {
      lastPostalLookedUp = digits;
    } finally {
      busy = false;
      fillSource = "";
    }
  }

  async function lookupFromCity() {
    if (!cityInput) return;
    const city = String(cityInput.value ?? "").trim();
    if (city.length < 2) return;
    if (city === lastCityLookedUp || busy) return;
    if (fillSource === "postal") return;
    busy = true;
    fillSource = "city";
    try {
      const params = new URLSearchParams({ city });
      const res = await fetch(`/api/postal-codes/lookup?${params}`, { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      lastCityLookedUp = city;
      if (res.ok && data.postal_code) {
        lastPostalLookedUp = String(data.postal_code);
        setFieldValue(postalInput, data.postal_code);
        if (data.city && data.city !== city) {
          lastCityLookedUp = String(data.city).trim();
          setFieldValue(cityInput, data.city);
        }
      }
    } catch {
      lastCityLookedUp = city;
    } finally {
      busy = false;
      fillSource = "";
    }
  }

  postalInput.addEventListener("input", () => {
    const digits = String(postalInput.value ?? "").replace(/\D/g, "").slice(0, 4);
    if (digits.length < 4) lastPostalLookedUp = "";
    lookupFromPostal();
  });
  postalInput.addEventListener("change", lookupFromPostal);
  postalInput.addEventListener("blur", lookupFromPostal);

  if (cityInput) {
    let cityTimer = 0;
    cityInput.addEventListener("input", () => {
      lastCityLookedUp = "";
      window.clearTimeout(cityTimer);
      cityTimer = window.setTimeout(() => lookupFromCity(), 350);
    });
    cityInput.addEventListener("change", lookupFromCity);
    cityInput.addEventListener("blur", lookupFromCity);
  }
}

export async function applyAutoSearchLayout(form = document.getElementById("home-qs-form")) {
  if (!form) return null;
  const layout = await fetchAutoSearchLayout({ force: true });
  const mainHost = document.getElementById("qs-layout-main");
  const moreHost = document.getElementById("qs-more-layout");

  // Élő layout: új keresőmezők (pl. körzet) mindig látszanak.
  for (const cell of layout.cells || []) {
    if (!SEARCH_FORCE_VISIBLE.has(cell.field_key)) continue;
    cell.hidden = false;
    if (Number(cell.step) < 2) cell.step = 5;
  }

  const visible = (layout.cells || []).filter((c) => isSearchCellVisible(c));

  if (!visible.length) {
    hideLegacy(form);
    return layout;
  }

  hideLegacy(form);
  renderStep(mainHost, layout, 1);

  if (moreHost) {
    const moreCells = (layout.cells || [])
      .filter((c) => isSearchCellVisible(c) && Number(c.step) >= 2 && Number(c.step) <= 5)
      .sort((a, b) => (a.step - b.step) || (a.row - b.row) || (a.col - b.col));
    // Saját grid: lépésenként folyamatos sorok (ne *40 eltolás — az üres grid-sorokat hagyott).
    let rowOffset = 0;
    const withRows = [];
    for (let step = 2; step <= 5; step += 1) {
      const stepCells = moreCells.filter((c) => Number(c.step) === step);
      if (!stepCells.length) continue;
      let maxRow = 1;
      for (const c of stepCells) {
        const r = Math.max(1, Number(c.row) || 1);
        maxRow = Math.max(maxRow, r);
        withRows.push({ ...c, row: rowOffset + r });
      }
      rowOffset += maxRow;
    }
    renderGrid(moreHost, withRows);
  }

  wireRangeSelects(form);
  wireSelectOptions(form);
  wirePostalCityAutofill(form);
  /* Mobil: katalógus a dob/sheet háttérben tölt — ne várakoztassa a keresőt */
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
    return layout;
  }
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
  const seen = new Set();
  form.querySelectorAll("[data-filter-key]").forEach((el) => {
    const key = el.getAttribute("data-filter-key");
    if (!key || seen.has(key)) return;
    // Dobkerék: a hidden input a forrás (select már nincs / mellőzve)
    if (el.tagName === "SELECT" && form.querySelector(`input[type="hidden"][data-filter-key="${key}"]`)) {
      return;
    }
    if (el.matches?.("[data-wheel]")) return;
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
