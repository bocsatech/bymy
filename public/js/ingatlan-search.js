/**
 * Ingatlan bérlés kereső — mobil-szerű kerék pickerek + szűrés.
 * Csak ezekkel a mezőkulcsokkal kötjük össze a listát.
 */

import {
  INGATLAN_UZLETAG,
  INGATLAN_LAKAS_TIPUS,
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
} from "./ingatlan-fields.js?v=immoWheel3";
import {
  fillWheel,
  initMenuWheel,
  readWheel,
  readWheelList,
  setWheelValue,
  MULTI_WHEEL_KEYS,
} from "./ingatlan-wheels.js?v=mobile4";
import { initDrumWheel, syncDrumWheelDisplay, applyDrumModeClass, getDrumMode } from "./immo-drum-picker.js?v=drum8";
import { fetchIngatlanWheelSchema, renderIngatlanSchemaHosts } from "./ingatlan-wheel-schema.js?v=immoWheel4";

const EXACT_KEYS = [
  "ingatlan_uzletag",
  "ingatlan_lakas_tipus",
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
    ingatlan_uzletag: "berbe",
    keresesi_hely: "",
    ar_tol: null,
    ar_ig: null,
    ar_ft_min: null,
    alapterulet: null,
    alapterulet_tol: null,
    alapterulet_ig: null,
    szobaszam: "",
    ingatlan_lakas_tipus: "",
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
  return isImmoMobileLayout() && getDrumMode() !== "legacy";
}

function initImmoSearchWheel(wheel, { emptyLabel = "Mindegy", multiple = false, customInput = false, customKind = "price" } = {}) {
  if (!wheel) return;
  if (useDrumPicker()) {
    initDrumWheel(wheel, { emptyLabel, multiple });
    return;
  }
  initMenuWheel(wheel, { emptyLabel, multiple, customInput, customKind });
}

function syncImmoSearchWheelDisplay(wheel) {
  if (!wheel) return;
  if (wheel.dataset.drumBound === "1") syncDrumWheelDisplay(wheel);
}

/** Mobil: min + max egy sorban (ár, alapterület). */
const MOBILE_DUAL_RANGES = [
  { id: "ar", tolKey: "ar_tol", igKey: "ar_ig", title: "Ár", ariaLabel: "Ár tartomány" },
  {
    id: "alapterulet",
    tolKey: "alapterulet_tol",
    igKey: "alapterulet_ig",
    title: "Alapterület",
    ariaLabel: "Alapterület tartomány",
    unit: "m²",
  },
];

function setupMobileDualRanges(mainHost) {
  if (!mainHost || !isImmoMobileLayout()) return;
  for (const cfg of MOBILE_DUAL_RANGES) {
    setupMobileDualRange(mainHost, cfg);
  }
}

function setupMobileDualRange(mainHost, { id, tolKey, igKey, title, ariaLabel, unit = "" }) {
  const tolCell = mainHost.querySelector(`.immo-schema-cell[data-schema-field="${tolKey}"]`);
  const igCell = mainHost.querySelector(`.immo-schema-cell[data-schema-field="${igKey}"]`);
  if (!tolCell || !igCell) return;

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

    const titleEl = document.createElement("span");
    titleEl.className = "immo-label immo-dual-range__title";
    titleEl.textContent = title;
    block.appendChild(titleEl);

    wrap = document.createElement("div");
    wrap.className = "immo-dual-range";
    wrap.dataset.range = id;
    wrap.setAttribute("aria-label", ariaLabel);
    block.appendChild(wrap);

    tolCell.before(block);
  } else {
    block.classList.add("immo-dual-range-block");
    block.dataset.range = id;
    if (!block.querySelector(".immo-dual-range__title")) {
      const titleEl = document.createElement("span");
      titleEl.className = "immo-label immo-dual-range__title";
      titleEl.textContent = title;
      block.insertBefore(titleEl, block.firstChild);
    }
    if (!wrap) {
      wrap = block.querySelector(".immo-dual-range, .immo-price-range");
    }
    if (wrap) {
      wrap.classList.remove("immo-price-range");
      wrap.classList.add("immo-dual-range");
      wrap.dataset.range = id;
      wrap.setAttribute("aria-label", ariaLabel);
    }
  }

  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "immo-dual-range";
    wrap.dataset.range = id;
    wrap.setAttribute("aria-label", ariaLabel);
    block.appendChild(wrap);
  }

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

function syncPriceRangeUnit(form) {
  const wrap = form?.querySelector('.immo-dual-range[data-range="ar"]');
  if (!wrap) return;
  const uz = normalizeIngatlanUzletag(form.querySelector("#immo-uzletag")?.value || "berbe");
  const unitEl = wrap.querySelector(".immo-dual-range__unit");
  if (unitEl) unitEl.textContent = uz === "berbe" ? "Ft" : "M Ft";
}

function fillDualRangeWheels(form, { tolKey, igKey, options, emptyMin = "min.", emptyMax = "max." }) {
  let tol = form.querySelector(`[data-wheel="${tolKey}"]`);
  let ig = form.querySelector(`[data-wheel="${igKey}"]`);
  const prevTol = readWheel(tol);
  const prevIg = readWheel(ig);
  fillWheel(tol, options, { emptyLabel: emptyMin });
  fillWheel(ig, options, { emptyLabel: emptyMax });
  initImmoSearchWheel(tol, { emptyLabel: emptyMin, multiple: false, customInput: false });
  initImmoSearchWheel(ig, { emptyLabel: emptyMax, multiple: false, customInput: false });
  tol = form.querySelector(`[data-wheel="${tolKey}"]`);
  ig = form.querySelector(`[data-wheel="${igKey}"]`);
  setWheelValue(tol, prevTol);
  setWheelValue(ig, prevIg);
  syncImmoSearchWheelDisplay(tol);
  syncImmoSearchWheelDisplay(ig);
}

function fillPriceRangeWheels(form) {
  const uz = normalizeIngatlanUzletag(form.querySelector("#immo-uzletag")?.value || "berbe");
  const isRent = uz === "berbe";
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

function syncRovidMenus(form) {
  const tipusList = readWheelList(form.querySelector('[data-wheel="ingatlan_lakas_tipus"]'));
  const rovid = tipusList.includes("rovid_berles");
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
  out.ingatlan_uzletag = normalizeIngatlanUzletag(form.querySelector("#immo-uzletag")?.value || "berbe");
  out.keresesi_hely = form.querySelector('[name="keresesi_hely"]')?.value?.trim() || "";
  out.ar_tol = numOrNull(readWheel(form.querySelector('[data-wheel="ar_tol"]')));
  out.ar_ig = numOrNull(readWheel(form.querySelector('[data-wheel="ar_ig"]')));
  out.alapterulet_tol = numOrNull(readWheel(form.querySelector('[data-wheel="alapterulet_tol"]')));
  out.alapterulet_ig = numOrNull(readWheel(form.querySelector('[data-wheel="alapterulet_ig"]')));
  out.szobaszam = readWheel(form.querySelector('[data-wheel="szobaszam"]'));
  out.ingatlan_lakas_tipus = readWheel(form.querySelector('[data-wheel="ingatlan_lakas_tipus"]'));
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

export async function initIngatlanSearch({ onSearch = () => {} } = {}) {
  const form = document.getElementById("immo-search-form");
  if (!form) return;

  const schema = await fetchIngatlanWheelSchema();
  renderIngatlanSchemaHosts(
    document.getElementById("immo-schema-main"),
    document.getElementById("immo-schema-more"),
    schema,
    "search"
  );
  setupMobileDualRanges(document.getElementById("immo-schema-main"));
  applyDrumModeClass();

  fillPriceRangeWheels(form);
  fillAreaRangeWheels(form);
  fillWheel(form.querySelector('[data-wheel="szobaszam"]'), szobaszamOptions(), { emptyLabel: "Mindegy" });
  fillWheel(form.querySelector('[data-wheel="ingatlan_lakas_tipus"]'), INGATLAN_LAKAS_TIPUS.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="allapot"]'), INGATLAN_ALLAPOT.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="ingatlan_kora"]'), INGATLAN_KORA.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="min_berleti_ido"]'), MIN_BERLETI_IDO.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="butorozott"]'), BUTOROZOTT.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="kilatas"]'), KILATAS.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="tajolas"]'), TAJOLAS.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="futes"]'), FUTES.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="parkolas"]'), PARKOLAS.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="komfort"]'), KOMFORT.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="tetoter"]'), TETOTER.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="furdo_wc"]'), FURDO_WC.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="emelet_tol"]'), EMELET.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="emelet_ig"]'), EMELET.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="belmagassag"]'), BELMAGASSAG.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="koltozheto"]'), KOLTOZHETO.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="ar_ft_min"]'), arFtMinOptions(), { emptyLabel: "Mindegy" });
  for (const bool of INGATLAN_BOOL_FIELDS) {
    fillWheel(form.querySelector(`[data-wheel="${bool.field_key}"]`), IGEN_MINDEGY.filter((o) => o.value));
  }

  const emptyByName = {
    szobaszam: "Szobaszám",
  };
  const dualRangeKeys = new Set(["ar_tol", "ar_ig", "alapterulet_tol", "alapterulet_ig"]);
  form.querySelectorAll("[data-wheel]").forEach((wheel) => {
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

  const uzletag = form.querySelector("#immo-uzletag");
  if (uzletag) {
    uzletag.innerHTML = "";
    for (const opt of INGATLAN_UZLETAG) {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      uzletag.appendChild(el);
    }
    uzletag.value = "berbe";
  }

  const morePanel = document.getElementById("immo-more");
  const moreBtn = document.getElementById("immo-tovabbi");

  function setMoreOpen(open) {
    if (!morePanel || !moreBtn) return;
    morePanel.hidden = !open;
    moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
    moreBtn.textContent = open ? "Kevesebb feltétel" : "További feltételek";
  }

  moreBtn?.addEventListener("click", () => {
    setMoreOpen(!!morePanel?.hidden);
  });

  form.querySelector('[data-wheel="ingatlan_lakas_tipus"]')?.addEventListener("immo-wheel-change", () => {
    syncRovidMenus(form);
  });

  uzletag?.addEventListener("change", () => {
    fillPriceRangeWheels(form);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSearch(readForm(form));
    document.getElementById("home-grid-track")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      form.querySelectorAll("[data-wheel]").forEach((wheel) => setWheelValue(wheel, ""));
      const hely = form.querySelector('[name="keresesi_hely"]');
      if (hely) hely.value = "";
      if (uzletag) uzletag.value = "berbe";
      fillPriceRangeWheels(form);
      fillAreaRangeWheels(form);
      syncRovidMenus(form);
      setMoreOpen(false);
      onSearch(emptyIngatlanFilters());
    });
  });

  setMoreOpen(false);
  syncRovidMenus(form);
}
