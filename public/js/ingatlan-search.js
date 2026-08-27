/**
 * Ingatlan bérlés kereső — mobil-szerű kerék pickerek + szűrés.
 * Csak ezekkel a mezőkulcsokkal kötjük össze a listát.
 */

import {
  INGATLAN_UZLETAG,
  INGATLAN_LAKAS_TIPUS,
  INGATLAN_LAKAS_TIPUS_AIRBNB,
  INGATLAN_ALLAPOT,
  INGATLAN_KORA,
  MIN_BERLETI_IDO,
  MIN_BERLETI_IDO_ROVID,
  BUTOROZOTT,
  KILATAS,
  TAJOLAS,
  FUTES,
  PARKOLAS,
  KOMFORT,
  TETOTER,
  FURDO_WC,
  EMELET,
  BELMAGASSAG,
  KOLTOZHETO,
  KOLTOZHETO_ROVID,
  IGEN_MINDEGY,
  INGATLAN_BOOL_FIELDS,
  priceMillionOptions,
  alapteruletOptions,
  szobaszamOptions,
  arFtMinOptions,
  emeletRank,
  normalizeIngatlanUzletag,
  schemaVariantFromUzletag,
  isIngatlanRentUzletag,
  tipus2OptionsForParents,
} from "./ingatlan-fields.js?v=immoCatTabs1";
import {
  fillWheel,
  initMenuWheel,
  readWheel,
  readWheelList,
  setWheelValue,
  MULTI_WHEEL_KEYS,
  wheelFieldHtml,
} from "./ingatlan-wheels.js?v=immoPortalPage1";
import { initDrumWheel, syncDrumWheelDisplay, applyDrumModeClass, getDrumMode } from "./immo-drum-picker.js?v=immoPortalPage1";
import { bindAutoDrumSheet } from "./auto-drum-sheet.js?v=immoPortalPage1";
import { fetchIngatlanWheelSchema, renderIngatlanSchemaHosts, INGATLAN_DUAL_RANGE_GROUPS } from "./ingatlan-wheel-schema.js?v=telepSuggest1";
import { wireTelepulesSuggestIn } from "./telepules-suggest.js?v=telepClose1";

const EXACT_KEYS = [
  "ingatlan_uzletag",
  "ingatlan_lakas_tipus",
  "ingatlan_tipus_2",
  "allapot",
  "ingatlan_kora",
  "min_berleti_ido",
  "butorozott",
  "kilatas",
  "tajolas",
  "futes",
  "parkolas",
  "komfort",
  "tetoter",
  "furdo_wc",
  "belmagassag",
  "koltozheto",
  ...INGATLAN_BOOL_FIELDS.map((f) => f.field_key),
];

export function emptyIngatlanFilters() {
  return {
    ingatlan_uzletag: "kiado",
    keresesi_hely: "",
    ar_tol: null,
    ar_ig: null,
    ar_ft_min: null,
    alapterulet: null,
    alapterulet_tol: null,
    alapterulet_ig: null,
    szobaszam: "",
    ingatlan_lakas_tipus: "",
    ingatlan_tipus_2: "",
    allapot: "",
    ingatlan_kora: "",
    min_berleti_ido: "",
    butorozott: "",
    kilatas: "",
    tajolas: "",
    futes: "",
    parkolas: "",
    komfort: "",
    tetoter: "",
    furdo_wc: "",
    emelet_tol: "",
    emelet_ig: "",
    belmagassag: "",
    koltozheto: "",
    lift: "",
    erkely: "",
    szigeteles: "",
    energiahatekonys: "",
    akadalymentesitett: "",
    legkondicionalo: "",
    kertkapcsolatos: "",
    panelprogram: "",
    gepesitett: "",
    kisallat_megengedett: "",
    dohanyzas_megengedett: "",
  };
}

function numOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const IMMO_MOBILE_MQ = "(max-width: 800px)";

function isImmoMobileLayout() {
  return typeof window !== "undefined" && window.matchMedia(IMMO_MOBILE_MQ).matches;
}

function useDrumPicker() {
  // Ingatlan kereső: dobkerék asztali + mobil weben is (kikapcsolás: legacy mód).
  return getDrumMode() !== "legacy";
}

function initImmoSearchWheel(wheel, { emptyLabel = "Mindegy", multiple = false, customInput = false, customKind = "price" } = {}) {
  if (!wheel) return;
  if (useDrumPicker()) {
    const name = wheel.getAttribute("data-wheel") || "";
    const live = initDrumWheel(wheel, { emptyLabel, multiple, openMode: "portal" });
    const form = live?.closest("form") || wheel.closest?.("form") || document.getElementById("immo-search-form");
    const bound =
      (name && form?.querySelector(`[data-wheel="${name}"]`)) ||
      live ||
      form?.querySelector(`[data-wheel="${name}"]`);
    if (bound) bindAutoDrumSheet(bound);
    return;
  }
  initMenuWheel(wheel, { emptyLabel, multiple, customInput, customKind });
}

function syncImmoSearchWheelDisplay(wheel) {
  if (!wheel) return;
  if (wheel.dataset.drumBound === "1") syncDrumWheelDisplay(wheel);
}

/** Mobil: min + max egy sorban (ár, alapterület). */
const MOBILE_DUAL_RANGES = INGATLAN_DUAL_RANGE_GROUPS;

function setupMobileDualRanges(mainHost) {
  if (!mainHost) return;
  for (const cfg of MOBILE_DUAL_RANGES) {
    setupMobileDualRange(mainHost, cfg);
  }
}

function setupMobileDualRange(mainHost, { id, tolKey, igKey, title, ariaLabel, unit = "" }) {
  const tolCell = mainHost.querySelector(`.immo-schema-cell[data-schema-field="${tolKey}"]`);
  const igCell = mainHost.querySelector(`.immo-schema-cell[data-schema-field="${igKey}"]`);
  if (!tolCell || !igCell) return;

  const existingBlock = tolCell.closest(".immo-dual-range-block");
  if (existingBlock?.dataset.range === id) {
    const wrap = existingBlock.querySelector(".immo-dual-range");
    if (wrap) {
      const titleEl = wrap.querySelector(".immo-dual-range__title");
      if (titleEl) titleEl.textContent = title;
      if (unit) {
        let unitEl = wrap.querySelector(".immo-dual-range__unit");
        if (!unitEl) {
          unitEl = document.createElement("span");
          unitEl.className = "immo-dual-range__unit";
          unitEl.setAttribute("aria-hidden", "true");
          wrap.appendChild(unitEl);
        }
        unitEl.textContent = unit;
      }
    }
    return;
  }

  let wrap =
    tolCell.closest(".immo-dual-range") ||
    tolCell.closest(".immo-price-range");
  let block =
    wrap?.closest(".immo-dual-range-block") ||
    wrap?.closest(".immo-price-range-block");

  if (!block) {
    block = document.createElement("div");
    block.className = "immo-dual-range-block";
    block.dataset.range = id;

    wrap = document.createElement("div");
    wrap.className = "immo-dual-range";
    wrap.dataset.range = id;
    wrap.setAttribute("aria-label", ariaLabel);

    const titleEl = document.createElement("span");
    titleEl.className = "immo-label immo-dual-range__title";
    titleEl.textContent = title;
    wrap.appendChild(titleEl);

    block.appendChild(wrap);
    tolCell.before(block);
  } else {
    block.classList.add("immo-dual-range-block");
    block.dataset.range = id;
    if (!wrap) {
      wrap = block.querySelector(".immo-dual-range, .immo-price-range");
    }
    if (wrap) {
      wrap.classList.remove("immo-price-range");
      wrap.classList.add("immo-dual-range");
      wrap.dataset.range = id;
      wrap.setAttribute("aria-label", ariaLabel);
    }
    let titleEl =
      wrap?.querySelector(".immo-dual-range__title") ||
      block.querySelector(":scope > .immo-dual-range__title");
    if (!titleEl && wrap) {
      titleEl = document.createElement("span");
      titleEl.className = "immo-label immo-dual-range__title";
      titleEl.textContent = title;
      wrap.insertBefore(titleEl, wrap.firstChild);
    } else if (titleEl && wrap && !wrap.contains(titleEl)) {
      wrap.insertBefore(titleEl, wrap.firstChild);
    } else if (titleEl) {
      titleEl.textContent = title;
    }
  }

  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "immo-dual-range";
    wrap.dataset.range = id;
    wrap.setAttribute("aria-label", ariaLabel);
    block.appendChild(wrap);
  }

  // Admin rácspozíció: data-attribútum (megbízható), CSS parse csak fallback.
  const parsePlacement = (el) => {
    const dataCol = Number(el.getAttribute("data-grid-col"));
    const dataSpan = Number(el.getAttribute("data-grid-span"));
    const dataRow = Number(el.getAttribute("data-grid-row"));
    if (dataCol >= 1 && dataSpan >= 1) {
      return {
        col: dataCol,
        span: dataSpan,
        row: dataRow >= 1 ? dataRow : 1,
      };
    }
    const raw = String(el.style.gridColumn || "");
    const spanMatch = raw.match(/(\d+)\s*\/\s*span\s*(\d+)/i);
    const lineMatch = !spanMatch && raw.match(/(\d+)\s*\/\s*(\d+)/);
    const rowMatch = String(el.style.gridRow || "").match(/(\d+)/);
    if (spanMatch) {
      return {
        col: Number(spanMatch[1]),
        span: Number(spanMatch[2]),
        row: rowMatch ? Number(rowMatch[1]) : 1,
      };
    }
    if (lineMatch) {
      const col = Number(lineMatch[1]);
      const end = Number(lineMatch[2]);
      return {
        col,
        span: Math.max(1, end - col),
        row: rowMatch ? Number(rowMatch[1]) : 1,
      };
    }
    return { col: 1, span: 1, row: 1 };
  };
  const tolPlace = parsePlacement(tolCell);
  const igPlace = parsePlacement(igCell);
  const startCol = Math.min(tolPlace.col, igPlace.col);
  const endCol = Math.max(tolPlace.col + tolPlace.span - 1, igPlace.col + igPlace.span - 1);
  const row = tolPlace.row || igPlace.row || 1;
  const span = Math.max(1, endCol - startCol + 1);
  block.dataset.gridCol = String(startCol);
  block.dataset.gridSpan = String(span);
  block.dataset.gridRow = String(row);
  block.style.setProperty("grid-column", `${startCol} / span ${span}`, "important");
  block.style.setProperty("grid-row", String(row), "important");
  block.style.setProperty("width", "auto", "important");
  block.style.setProperty("max-width", "100%", "important");
  block.style.removeProperty("grid-column-start");
  block.style.removeProperty("grid-column-end");

  if (!wrap.contains(tolCell)) wrap.appendChild(tolCell);
  if (!wrap.contains(igCell)) wrap.appendChild(igCell);

  tolCell.classList.add("immo-dual-range__half", "immo-dual-range__half--min");
  tolCell.classList.remove("immo-price-range__half", "immo-price-range__half--min");
  igCell.classList.add("immo-dual-range__half", "immo-dual-range__half--max");
  igCell.classList.remove("immo-price-range__half", "immo-price-range__half--max");

  if (!wrap.querySelector(".immo-dual-range__sep")) {
    const sep = document.createElement("span");
    sep.className = "immo-dual-range__sep";
    sep.setAttribute("aria-hidden", "true");
    sep.textContent = "–";
    igCell.before(sep);
  }

  let unitEl = wrap.querySelector(".immo-dual-range__unit, .immo-price-range__unit");
  if (!unitEl) {
    unitEl = document.createElement("span");
    unitEl.className = "immo-dual-range__unit";
    unitEl.setAttribute("aria-hidden", "true");
    wrap.appendChild(unitEl);
  } else {
    unitEl.classList.add("immo-dual-range__unit");
  }
  if (unit) unitEl.textContent = unit;

  for (const cell of [tolCell, igCell]) {
    cell.style.gridColumn = "";
    cell.style.gridRow = "";
  }
}

function readUzletag(form) {
  const wheel = form?.querySelector?.('[data-wheel="ingatlan_uzletag"]');
  if (wheel) return normalizeIngatlanUzletag(readWheel(wheel) || "kiado");
  return normalizeIngatlanUzletag(form?.querySelector?.("#immo-uzletag")?.value || "kiado");
}

function setUzletag(form, value) {
  const next = normalizeIngatlanUzletag(value || "kiado");
  const wheel = form?.querySelector?.('[data-wheel="ingatlan_uzletag"]');
  if (wheel) {
    setWheelValue(wheel, next);
    syncImmoSearchWheelDisplay(wheel);
    const hidden = form.querySelector("#immo-uzletag");
    if (hidden) hidden.value = next;
    return;
  }
  const el = form?.querySelector?.("#immo-uzletag");
  if (el) el.value = next;
}

function syncPriceRangeUnit(form) {
  const wrap = form?.querySelector('.immo-dual-range[data-range="ar"]');
  if (!wrap) return;
  const uz = readUzletag(form);
  const unitEl = wrap.querySelector(".immo-dual-range__unit");
  if (unitEl) unitEl.textContent = isIngatlanRentUzletag(uz) ? "Ft" : "M Ft";
}

function fillDualRangeWheels(form, { tolKey, igKey, options, emptyMin = "min.", emptyMax = "max." }) {
  let tol = form.querySelector(`[data-wheel="${tolKey}"]`);
  let ig = form.querySelector(`[data-wheel="${igKey}"]`);
  const prevTol = readWheel(tol);
  const prevIg = readWheel(ig);
  fillWheel(tol, options, { emptyLabel: emptyMin });
  fillWheel(ig, options, { emptyLabel: emptyMax });
  /* Ár / alapterület / emelet: ugyanaz a 3-soros dobkerék, de mindig egyetlen érték. */
  initImmoSearchWheel(tol, { emptyLabel: emptyMin, multiple: false, customInput: false });
  initImmoSearchWheel(ig, { emptyLabel: emptyMax, multiple: false, customInput: false });
  tol = form.querySelector(`[data-wheel="${tolKey}"]`);
  ig = form.querySelector(`[data-wheel="${igKey}"]`);
  if (tol) {
    tol.dataset.multiple = "0";
    tol.closest(".immo-wheel-wrap")?.classList.remove("immo-wheel-wrap--multi");
  }
  if (ig) {
    ig.dataset.multiple = "0";
    ig.closest(".immo-wheel-wrap")?.classList.remove("immo-wheel-wrap--multi");
  }
  setWheelValue(tol, prevTol);
  setWheelValue(ig, prevIg);
  syncImmoSearchWheelDisplay(tol);
  syncImmoSearchWheelDisplay(ig);
}

function fillPriceRangeWheels(form) {
  const uz = readUzletag(form);
  const isRent = isIngatlanRentUzletag(uz);
  const opts = isRent ? arFtMinOptions() : priceMillionOptions();
  fillDualRangeWheels(form, { tolKey: "ar_tol", igKey: "ar_ig", options: opts });
  syncPriceRangeUnit(form);
}

function fillAreaRangeWheels(form) {
  fillDualRangeWheels(form, {
    tolKey: "alapterulet_tol",
    igKey: "alapterulet_ig",
    options: alapteruletOptions(),
  });
}

function fillEmeletRangeWheels(form) {
  fillDualRangeWheels(form, {
    tolKey: "emelet_tol",
    igKey: "emelet_ig",
    options: EMELET.filter((o) => o.value),
  });
}

function fieldBag(item, key) {
  const f = item?.preview?.filter ?? {};
  const form = item?.form ?? {};
  const v = f[key] ?? form[key];
  return v == null ? "" : String(v).trim();
}

function listingPrice(item) {
  const n = item?.preview?.priceNum;
  if (Number.isFinite(n) && n > 0) return n;
  return numOrNull(item?.form?.vetelar || item?.form?.akcios_ar);
}

function normalizePlace(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isTruthyIgen(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  return v === "igen" || v === "1" || v === "true" || v === "yes";
}

export function filterListingsByIngatlan(items, filters) {
  const f = { ...emptyIngatlanFilters(), ...filters };
  return items.filter((item) => {
    if (f.ingatlan_uzletag) {
      const want = normalizeIngatlanUzletag(f.ingatlan_uzletag);
      const uz = normalizeIngatlanUzletag(fieldBag(item, "ingatlan_uzletag"));
      if (uz && uz !== want) return false;
    }

    if (f.keresesi_hely) {
      const needle = normalizePlace(f.keresesi_hely);
      const hay = normalizePlace(
        [fieldBag(item, "telepules"), item?.preview?.location, item?.preview?.title].join(" ")
      );
      if (!hay.includes(needle)) return false;
    }

    const price = listingPrice(item);
    const minPrice = f.ar_ft_min ?? f.ar_tol;
    if (minPrice != null && price != null && price < minPrice) return false;
    if (f.ar_ig != null && price != null && price > f.ar_ig) return false;

    if (f.alapterulet_tol != null || f.alapterulet_ig != null || f.alapterulet != null) {
      const area = numOrNull(fieldBag(item, "alapterulet"));
      const minArea = f.alapterulet_tol ?? f.alapterulet;
      const maxArea = f.alapterulet_ig;
      if (minArea != null && area != null && area < minArea) return false;
      if (maxArea != null && area != null && area > maxArea) return false;
    }

    if (f.szobaszam) {
      const wants = String(f.szobaszam)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (wants.length) {
        const gotRaw = fieldBag(item, "szobaszam");
        const got = numOrNull(gotRaw);
        const ok = wants.some((want) => {
          if (want === "6" || want === "6+") return got != null && got >= 6;
          const w = numOrNull(want);
          if (got != null && w != null) return got === w;
          return String(gotRaw) === String(want);
        });
        if (gotRaw && !ok) return false;
        if (!gotRaw) return false;
      }
    }

    for (const key of EXACT_KEYS) {
      const want = f[key];
      if (!want) continue;
      if (INGATLAN_BOOL_FIELDS.some((b) => b.field_key === key)) {
        if (!isTruthyIgen(fieldBag(item, key))) return false;
        continue;
      }
      const got = fieldBag(item, key);
      if (!got) continue;
      const wants = String(want)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (wants.length && !wants.includes(got)) return false;
    }

    const floor = fieldBag(item, "emelet");
    const floorRank = emeletRank(floor);
    const fromRank = emeletRank(f.emelet_tol);
    const toRank = emeletRank(f.emelet_ig);
    if (fromRank != null && floorRank != null && floorRank < fromRank) return false;
    if (toRank != null && floorRank != null && floorRank > toRank) return false;

    return true;
  });
}

function syncTipus2Menu(form) {
  const parents = readWheelList(form.querySelector('[data-wheel="ingatlan_lakas_tipus"]'));
  const wheel = form.querySelector('[data-wheel="ingatlan_tipus_2"]');
  if (!wheel) return;
  const prev = readWheel(wheel);
  const opts = tipus2OptionsForParents(parents);
  fillWheel(wheel, opts.filter((o) => o.value), { emptyLabel: "Mindegy" });
  initImmoSearchWheel(wheel, {
    emptyLabel: "Mindegy",
    multiple: MULTI_WHEEL_KEYS.has("ingatlan_tipus_2"),
  });
  const allowed = new Set(opts.map((o) => o.value).filter(Boolean));
  const keep = String(prev)
    .split(",")
    .map((v) => v.trim())
    .filter((v) => allowed.has(v));
  setWheelValue(wheel, keep.join(","));
  const wrap = wheel.closest(".immo-wheel-wrap");
  const disabled = parents.length === 0;
  if (wrap) wrap.classList.toggle("is-disabled", disabled);
  wheel.setAttribute("aria-disabled", disabled ? "true" : "false");
}

/** Élő kereső/feladás: Tipus 2 a Tipus mellett (adminban törölt szekcióban marad a default). */
function ensureTipus2Field(root, { enable }) {
  const existing = root.querySelector('[data-schema-field="ingatlan_tipus_2"]');
  if (!enable) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const tipusCell = root.querySelector('[data-schema-field="ingatlan_lakas_tipus"]');
  const host = tipusCell?.parentElement || root.querySelector("#immo-schema-more");
  if (!host) return;
  const rows = [...host.querySelectorAll("[data-grid-row]")].map((el) => Number(el.dataset.gridRow) || 1);
  const row = Math.max(0, ...rows) + 1;
  const cell = document.createElement("div");
  cell.className = "immo-schema-cell";
  cell.dataset.schemaField = "ingatlan_tipus_2";
  cell.dataset.gridCol = "1";
  cell.dataset.gridSpan = "6";
  cell.dataset.gridRow = String(row);
  cell.style.cssText = `grid-column:1 / span 6;grid-row:${row}`;
  cell.innerHTML = wheelFieldHtml("ingatlan_tipus_2", "Típus 2");
  host.appendChild(cell);
  host.style.gridTemplateRows = `repeat(${row}, auto)`;
}

function syncRovidMenus(form) {
  const uz = readUzletag(form);
  const tipusList = readWheelList(form.querySelector('[data-wheel="ingatlan_lakas_tipus"]'));
  const rovid = uz === "airbnb" || tipusList.includes("rovid_berles");
  const berleti = form.querySelector('[data-wheel="min_berleti_ido"]');
  const koltoz = form.querySelector('[data-wheel="koltozheto"]');
  const prevBerleti = readWheel(berleti);
  const prevKoltoz = readWheel(koltoz);
  fillWheel(berleti, (rovid ? MIN_BERLETI_IDO_ROVID : MIN_BERLETI_IDO).filter((o) => o.value));
  fillWheel(koltoz, (rovid ? KOLTOZHETO_ROVID : KOLTOZHETO).filter((o) => o.value));
  initImmoSearchWheel(berleti, { emptyLabel: "Mindegy", multiple: false });
  initImmoSearchWheel(koltoz, { emptyLabel: "Mindegy", multiple: MULTI_WHEEL_KEYS.has("koltozheto") });
  const berletiOpts = new Set([...(berleti?.querySelectorAll(".immo-wheel-opt") || [])].map((b) => b.dataset.value));
  const koltozOpts = new Set([...(koltoz?.querySelectorAll(".immo-wheel-opt") || [])].map((b) => b.dataset.value));
  const berletiKeep = String(prevBerleti)
    .split(",")
    .filter((v) => berletiOpts.has(v));
  const koltozKeep = String(prevKoltoz)
    .split(",")
    .filter((v) => koltozOpts.has(v));
  setWheelValue(berleti, berletiKeep.join(","));
  setWheelValue(koltoz, koltozKeep.join(","));
}

function readForm(form) {
  const out = emptyIngatlanFilters();
  out.ingatlan_uzletag = readUzletag(form);
  out.keresesi_hely = form.querySelector('[name="keresesi_hely"]')?.value?.trim() || "";
  out.ar_tol = numOrNull(readWheel(form.querySelector('[data-wheel="ar_tol"]')));
  out.ar_ig = numOrNull(readWheel(form.querySelector('[data-wheel="ar_ig"]')));
  out.alapterulet_tol = numOrNull(readWheel(form.querySelector('[data-wheel="alapterulet_tol"]')));
  out.alapterulet_ig = numOrNull(readWheel(form.querySelector('[data-wheel="alapterulet_ig"]')));
  out.szobaszam = readWheel(form.querySelector('[data-wheel="szobaszam"]'));
  out.ingatlan_lakas_tipus = readWheel(form.querySelector('[data-wheel="ingatlan_lakas_tipus"]'));
  out.ingatlan_tipus_2 = readWheel(form.querySelector('[data-wheel="ingatlan_tipus_2"]'));
  out.allapot = readWheel(form.querySelector('[data-wheel="allapot"]'));
  out.ingatlan_kora = readWheel(form.querySelector('[data-wheel="ingatlan_kora"]'));
  out.min_berleti_ido = readWheel(form.querySelector('[data-wheel="min_berleti_ido"]'));
  out.butorozott = readWheel(form.querySelector('[data-wheel="butorozott"]'));
  out.kilatas = readWheel(form.querySelector('[data-wheel="kilatas"]'));
  out.tajolas = readWheel(form.querySelector('[data-wheel="tajolas"]'));
  out.futes = readWheel(form.querySelector('[data-wheel="futes"]'));
  out.parkolas = readWheel(form.querySelector('[data-wheel="parkolas"]'));
  out.komfort = readWheel(form.querySelector('[data-wheel="komfort"]'));
  out.tetoter = readWheel(form.querySelector('[data-wheel="tetoter"]'));
  out.furdo_wc = readWheel(form.querySelector('[data-wheel="furdo_wc"]'));
  out.emelet_tol = readWheel(form.querySelector('[data-wheel="emelet_tol"]'));
  out.emelet_ig = readWheel(form.querySelector('[data-wheel="emelet_ig"]'));
  out.belmagassag = readWheel(form.querySelector('[data-wheel="belmagassag"]'));
  out.koltozheto = readWheel(form.querySelector('[data-wheel="koltozheto"]'));
  out.ar_ft_min = numOrNull(readWheel(form.querySelector('[data-wheel="ar_ft_min"]')));
  for (const bool of INGATLAN_BOOL_FIELDS) {
    out[bool.field_key] = readWheel(form.querySelector(`[data-wheel="${bool.field_key}"]`));
  }
  return out;
}

export async function initIngatlanSearch({
  onSearch = () => {},
  form = null,
  schema = null,
  defaultUzletag = "kiado",
  lakasTipusOptions = null,
  enableTipus2 = true,
} = {}) {
  const root = form || document.getElementById("immo-search-form");
  if (!root) return;

  const initialUz = normalizeIngatlanUzletag(defaultUzletag);
  const resolvedSchema =
    schema || (await fetchIngatlanWheelSchema(schemaVariantFromUzletag(initialUz)));
  const tipusOpts = Array.isArray(lakasTipusOptions) && lakasTipusOptions.length
    ? lakasTipusOptions
    : initialUz === "airbnb"
      ? INGATLAN_LAKAS_TIPUS_AIRBNB
      : INGATLAN_LAKAS_TIPUS;
  const tipus2Enabled = enableTipus2 && initialUz !== "airbnb";
  const mainHost = root.querySelector("#immo-schema-main") || document.getElementById("immo-schema-main");
  const moreHost = root.querySelector("#immo-schema-more") || document.getElementById("immo-schema-more");
  const morePanel = root.querySelector("#immo-more") || document.getElementById("immo-more");
  const moreBtn = root.querySelector("#immo-tovabbi") || document.getElementById("immo-tovabbi");

  renderIngatlanSchemaHosts(mainHost, moreHost, resolvedSchema, "search");
  ensureTipus2Field(root, { enable: tipus2Enabled });
  setupMobileDualRanges(mainHost);
  setupMobileDualRanges(moreHost);
  applyDrumModeClass();
  wireTelepulesSuggestIn(root);

  fillPriceRangeWheels(root);
  fillAreaRangeWheels(root);
  fillEmeletRangeWheels(root);
  fillWheel(root.querySelector('[data-wheel="ingatlan_uzletag"]'), INGATLAN_UZLETAG, {
    emptyLabel: "Kategória",
    includeEmpty: false,
  });
  fillWheel(root.querySelector('[data-wheel="szobaszam"]'), szobaszamOptions(), { emptyLabel: "Mindegy" });
  fillWheel(root.querySelector('[data-wheel="ingatlan_lakas_tipus"]'), tipusOpts.filter((o) => o.value));
  fillWheel(root.querySelector('[data-wheel="allapot"]'), INGATLAN_ALLAPOT.filter((o) => o.value));
  fillWheel(root.querySelector('[data-wheel="ingatlan_kora"]'), INGATLAN_KORA.filter((o) => o.value));
  fillWheel(root.querySelector('[data-wheel="min_berleti_ido"]'), MIN_BERLETI_IDO.filter((o) => o.value));
  fillWheel(root.querySelector('[data-wheel="butorozott"]'), BUTOROZOTT.filter((o) => o.value));
  fillWheel(root.querySelector('[data-wheel="kilatas"]'), KILATAS.filter((o) => o.value));
  fillWheel(root.querySelector('[data-wheel="tajolas"]'), TAJOLAS.filter((o) => o.value));
  fillWheel(root.querySelector('[data-wheel="futes"]'), FUTES.filter((o) => o.value));
  fillWheel(root.querySelector('[data-wheel="parkolas"]'), PARKOLAS.filter((o) => o.value));
  fillWheel(root.querySelector('[data-wheel="komfort"]'), KOMFORT.filter((o) => o.value));
  fillWheel(root.querySelector('[data-wheel="tetoter"]'), TETOTER.filter((o) => o.value));
  fillWheel(root.querySelector('[data-wheel="furdo_wc"]'), FURDO_WC.filter((o) => o.value));
  fillWheel(root.querySelector('[data-wheel="belmagassag"]'), BELMAGASSAG.filter((o) => o.value));
  fillWheel(root.querySelector('[data-wheel="koltozheto"]'), KOLTOZHETO.filter((o) => o.value));
  fillWheel(root.querySelector('[data-wheel="ar_ft_min"]'), arFtMinOptions(), { emptyLabel: "Mindegy" });
  for (const bool of INGATLAN_BOOL_FIELDS) {
    fillWheel(root.querySelector(`[data-wheel="${bool.field_key}"]`), IGEN_MINDEGY.filter((o) => o.value));
  }

  const emptyByName = {
    szobaszam: "Szobaszám",
    ingatlan_uzletag: "Kategória",
  };
  const dualRangeKeys = new Set(["ar_tol", "ar_ig", "alapterulet_tol", "alapterulet_ig", "emelet_tol", "emelet_ig"]);
  root.querySelectorAll("[data-wheel]").forEach((wheel) => {
    const name = wheel.getAttribute("data-wheel") || "";
    if (dualRangeKeys.has(name)) return;
    const isRooms = name === "szobaszam";
    initImmoSearchWheel(wheel, {
      emptyLabel: emptyByName[name] || "Mindegy",
      multiple: MULTI_WHEEL_KEYS.has(name),
      customInput: useDrumPicker() ? false : isRooms,
      customKind: isRooms ? "rooms" : "price",
    });
  });
  setUzletag(root, initialUz);

  function setMoreOpen(open) {
    if (!morePanel || !moreBtn) return;
    morePanel.hidden = !open;
    moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
    moreBtn.textContent = open ? "Kevesebb feltétel" : "További feltételek";
  }

  if (!root.dataset.immoSearchBound) {
    root.dataset.immoSearchBound = "1";
    moreBtn?.addEventListener("click", () => {
      setMoreOpen(!!morePanel?.hidden);
    });

    root.querySelector('[data-wheel="ingatlan_lakas_tipus"]')?.addEventListener("immo-wheel-change", () => {
      syncRovidMenus(root);
      if (tipus2Enabled) syncTipus2Menu(root);
    });

    root.querySelector('[data-wheel="ingatlan_uzletag"]')?.addEventListener("immo-wheel-change", () => {
      fillPriceRangeWheels(root);
      const uz = readUzletag(root);
      const opts = uz === "airbnb" ? INGATLAN_LAKAS_TIPUS_AIRBNB : INGATLAN_LAKAS_TIPUS;
      const tipusWheel = root.querySelector('[data-wheel="ingatlan_lakas_tipus"]');
      const prevTipus = readWheel(tipusWheel);
      fillWheel(tipusWheel, opts.filter((o) => o.value));
      initImmoSearchWheel(tipusWheel, {
        emptyLabel: "Mindegy",
        multiple: MULTI_WHEEL_KEYS.has("ingatlan_lakas_tipus"),
      });
      const keep = String(prevTipus)
        .split(",")
        .filter((v) => opts.some((o) => o.value === v));
      setWheelValue(tipusWheel, keep.join(","));
      syncRovidMenus(root);
      if (tipus2Enabled) syncTipus2Menu(root);
    });

    root.addEventListener("submit", (event) => {
      event.preventDefault();
      if (typeof onSearch === "function") {
        onSearch(readForm(root));
        document.getElementById("home-grid-track")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    root.querySelector(".immo-submit")?.addEventListener("click", (event) => {
      if (root.tagName === "FORM") return;
      event.preventDefault();
      if (typeof onSearch === "function") onSearch(readForm(root));
    });

    root.addEventListener("reset", () => {
      requestAnimationFrame(() => {
        root.querySelectorAll("[data-wheel]").forEach((wheel) => {
          if ((wheel.getAttribute("data-wheel") || "") === "ingatlan_uzletag") return;
          setWheelValue(wheel, "");
        });
        const hely = root.querySelector('[name="keresesi_hely"]');
        if (hely) hely.value = "";
        setUzletag(root, defaultUzletag);
        fillPriceRangeWheels(root);
        fillAreaRangeWheels(root);
        fillEmeletRangeWheels(root);
        syncRovidMenus(root);
        if (tipus2Enabled) syncTipus2Menu(root);
        setMoreOpen(false);
        if (typeof onSearch === "function") onSearch(emptyIngatlanFilters());
      });
    });

    root.querySelectorAll('button[type="reset"], [data-immo-reset]').forEach((btn) => {
      btn.addEventListener("click", (event) => {
        if (root.tagName === "FORM" && btn.getAttribute("type") === "reset") return;
        event.preventDefault();
        root.querySelectorAll("[data-wheel]").forEach((wheel) => {
          if ((wheel.getAttribute("data-wheel") || "") === "ingatlan_uzletag") return;
          setWheelValue(wheel, "");
        });
        const hely = root.querySelector('[name="keresesi_hely"]');
        if (hely) hely.value = "";
        setUzletag(root, defaultUzletag);
        fillPriceRangeWheels(root);
        fillAreaRangeWheels(root);
        fillEmeletRangeWheels(root);
        syncRovidMenus(root);
        if (tipus2Enabled) syncTipus2Menu(root);
        setMoreOpen(false);
        if (typeof onSearch === "function") onSearch(emptyIngatlanFilters());
      });
    });
  }

  setMoreOpen(false);
  syncRovidMenus(root);
  if (tipus2Enabled) syncTipus2Menu(root);
}

export { readForm as readIngatlanSearchForm };
