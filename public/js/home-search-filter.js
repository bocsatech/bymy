import { initVehicleCatalogSelects, shortTypeName } from "./vehicle-catalog-client.js";

const FUEL_QUICK_FILTERS = [
  { id: "benzin", label: "Benzin", match: (value) => value === "Benzin" },
  { id: "diesel", label: "Diesel", match: (value) => value === "Diesel" || value === "Dízel" },
  {
    id: "hybrid",
    label: "Hybrid",
    match: (value) => /elektromos/i.test(value ?? "") && value !== "Elektromos",
  },
  {
    id: "benzin-gaz",
    label: "Benzin/Gáz",
    match: (value) => /lpg|cng|gáz|gaz/i.test(value ?? ""),
  },
  { id: "elektromos", label: "Elektromos", match: (value) => value === "Elektromos" },
];

const FEATURE_CHECKS = [
  { id: "automata", label: "automata", match: (item) => hasBadgeOrText(item, ["AUTOMATA", "automata"]) },
  { id: "tempomat", label: "tempomat", match: (item) => hasBadgeOrText(item, ["TEMPOMAT", "tempomat"]) },
  { id: "osszker", label: "összkerékmeghajtás", match: (item) => hasBadgeOrText(item, ["4WD", "összkerék", "4x4"]) },
  { id: "alufelni", label: "alufelni", match: (item) => hasBadgeOrText(item, ["ALUFELNI", "alufelni"]) },
  { id: "elektromos_ablak", label: "elektromos ablak", match: (item) => hasBadgeOrText(item, ["elektromos ablak"]) },
  { id: "vonohorog", label: "vonóhorog", match: (item) => hasBadgeOrText(item, ["VONÓHOROG", "vonóhorog"]) },
  { id: "isofix", label: "ISOFIX rendszer", match: (item) => hasBadgeOrText(item, ["ISOFIX"]) },
  { id: "esp", label: "ESP (menetstabilizátor)", match: (item) => hasBadgeOrText(item, ["ESP"]) },
  { id: "szervizkonyv", label: "szervizkönyv", match: (item) => hasBadgeOrText(item, ["szervizkönyv"]) },
  { id: "veteran", label: "veterán", match: (item) => hasBadgeOrText(item, ["veterán"]) },
];

function hasBadgeOrText(item, needles) {
  const preview = item.preview ?? {};
  const hay = [
    preview.title,
    preview.leiras,
    preview.specLine,
    ...(preview.badges ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return needles.some((n) => hay.includes(n.toLowerCase()));
}

function normalizeForMatch(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A katalógus típusneve ("500 Coupe 1.4 TJet 140 [3 ajtós, …]") és a hirdetés
 * szabad szöveges típusa ("1.4 TJet") ritkán egyezik karakterre. Az űrlapon
 * feladott új hirdetés pontosan egyezik, az importált régiekre részleges
 * egyezés kell mindkét irányban.
 */
export function matchesCatalogTipus(item, selected) {
  if (!selected) return true;

  const short = normalizeForMatch(shortTypeName(selected));
  if (!short) return true;

  const f = item.preview?.filter ?? {};
  const listingTipus = normalizeForMatch(f.tipus);

  if (listingTipus.length >= 3) {
    if (listingTipus === short) return true;
    if (short.includes(listingTipus) || listingTipus.includes(short)) return true;
  }

  const hay = normalizeForMatch([f.tipus, item.preview?.title, item.preview?.specLine].join(" "));
  return hay.includes(short);
}

function readFilters(form) {
  const data = new FormData(form);
  const features = FEATURE_CHECKS.filter(({ id }) => data.get(`feat_${id}`) === "on").map(({ id }) => id);
  return {
    gyartmany: data.get("gyartmany")?.toString() ?? "",
    modell: data.get("modell")?.toString() ?? "",
    kivitel: data.get("kivitel")?.toString() ?? "",
    uzemanyag: data.get("uzemanyag")?.toString() ?? "",
    ev_jarat: numOrNull(data.get("ev_jarat")),
    ev_tol: numOrNull(data.get("ev_tol")),
    ev_ig: numOrNull(data.get("ev_ig")),
    ar_tol: numOrNull(data.get("ar_tol")),
    ar_ig: numOrNull(data.get("ar_ig")),
    tipus: data.get("tipus")?.toString().trim() ?? "",
    tipusKatalogus: data.get("tipus_katalogus")?.toString().trim() ?? "",
    km_tol: numOrNull(data.get("km_tol")),
    km_ig: numOrNull(data.get("km_ig")),
    ccm_tol: numOrNull(data.get("ccm_tol")),
    ccm_ig: numOrNull(data.get("ccm_ig")),
    allapot: data.get("allapot")?.toString() ?? "",
    ajtok: data.get("ajtok")?.toString() ?? "",
    ulesek: data.get("ulesek")?.toString() ?? "",
    uzemanyagQuick: data.get("uzemanyag_quick")?.toString() ?? "",
    features,
  };
}

function numOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/\D/g, ""));
  return Number.isFinite(n) ? n : null;
}

function inRange(value, min, max) {
  if (value == null) return min == null && max == null;
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

export function filterListingsBySidebar(items, filters) {
  return items.filter((item) => {
    const f = item.preview?.filter ?? {};
    const preview = item.preview ?? {};

    if (filters.gyartmany && f.gyartmany !== filters.gyartmany) return false;
    if (filters.modell && f.modell !== filters.modell) return false;
    if (filters.kivitel && f.kivitel !== filters.kivitel) return false;
    if (filters.uzemanyagQuick) {
      const rule = FUEL_QUICK_FILTERS.find((entry) => entry.id === filters.uzemanyagQuick);
      if (rule && !rule.match(f.uzemanyag)) return false;
    } else if (filters.uzemanyag && f.uzemanyag !== filters.uzemanyag) return false;
    if (filters.allapot && f.allapot !== filters.allapot) return false;
    if (filters.ajtok && f.ajtok !== filters.ajtok) return false;
    if (filters.ulesek && f.ulesek !== filters.ulesek) return false;

    if (filters.tipus) {
      const hay = [f.tipus, preview.title, preview.specLine].join(" ").toLowerCase();
      if (!hay.includes(filters.tipus.toLowerCase())) return false;
    }

    if (!matchesCatalogTipus(item, filters.tipusKatalogus)) return false;

    if (filters.ev_jarat != null) {
      if (f.gyartasi_ev !== filters.ev_jarat) return false;
    } else if (!inRange(f.gyartasi_ev, filters.ev_tol, filters.ev_ig)) {
      return false;
    }
    if (!inRange(preview.priceNum, filters.ar_tol, filters.ar_ig)) return false;
    if (!inRange(preview.kmNum, filters.km_tol, filters.km_ig)) return false;
    if (!inRange(f.hengerurtartalom, filters.ccm_tol, filters.ccm_ig)) return false;

    for (const feat of filters?.features ?? []) {
      const rule = FEATURE_CHECKS.find((entry) => entry.id === feat);
      if (rule && !rule.match(item)) return false;
    }

    return true;
  });
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "hu"));
}

function fillSelect(select, values, emptyLabel = "Mindegy") {
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${emptyLabel}</option>`;
  for (const value of values) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
  if (current && values.includes(current)) select.value = current;
}

export function populateFilterOptions(items) {
  const filters = items.map((item) => item.preview?.filter ?? {});
  fillSelect(document.getElementById("filter-kivitel"), uniqueSorted(filters.map((f) => f.kivitel)));
  fillSelect(document.getElementById("filter-allapot"), uniqueSorted(filters.map((f) => f.allapot)));
  fillSelect(document.getElementById("filter-ajtok"), uniqueSorted(filters.map((f) => f.ajtok)));
  fillSelect(document.getElementById("filter-ulesek"), uniqueSorted(filters.map((f) => f.ulesek)));

  const years = [
    ...new Set(
      filters.map((f) => f.gyartasi_ev).filter((year) => year && year > 1900)
    ),
  ]
    .sort((a, b) => b - a)
    .map(String);
  fillSelect(document.getElementById("filter-ev-jarat"), years);
}

export function emptyFilters() {
  return {
    gyartmany: "",
    modell: "",
    kivitel: "",
    uzemanyag: "",
    ev_jarat: null,
    ev_tol: null,
    ev_ig: null,
    ar_tol: null,
    ar_ig: null,
    tipus: "",
    tipusKatalogus: "",
    km_tol: null,
    km_ig: null,
    ccm_tol: null,
    ccm_ig: null,
    allapot: "",
    ajtok: "",
    ulesek: "",
    uzemanyagQuick: "",
    features: [],
  };
}

export function initHomeSearchSidebar(onChange) {
  const form = document.getElementById("home-filter-form");
  if (!form) return () => emptyFilters();

  const trigger = () => onChange(readFilters(form));

  initFuelQuickButtons(form, trigger);
  initMoreFiltersToggle(form);

  form.addEventListener("input", trigger);
  form.addEventListener("change", trigger);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    trigger();
    document.getElementById("home-grid-track")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("filter-reset")?.addEventListener("click", (event) => {
    event.preventDefault();
    form.reset();
    syncFuelQuickButtons(form, "");
    closeMoreFilters(form);
    trigger();
  });

  return () => readFilters(form);
}

function initMoreFiltersToggle(form) {
  const toggle = form.querySelector("#filter-more-toggle");
  const panel = form.querySelector("#filter-more");
  if (!toggle || !panel) return;

  toggle.addEventListener("click", () => {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });
}

function closeMoreFilters(form) {
  const toggle = form.querySelector("#filter-more-toggle");
  const panel = form.querySelector("#filter-more");
  if (!panel || !toggle) return;
  panel.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
}

function syncFuelQuickButtons(form, quickValue) {
  form.querySelectorAll("[data-fuel-quick]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.fuelQuick === quickValue);
  });
}

function initFuelQuickButtons(form, trigger) {
  const quickInput = form.querySelector("#filter-uzemanyag-quick");
  if (!quickInput) return;

  form.querySelectorAll("[data-fuel-quick]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = quickInput.value === button.dataset.fuelQuick ? "" : button.dataset.fuelQuick;
      quickInput.value = next;
      syncFuelQuickButtons(form, next);
      trigger();
    });
  });

  form.querySelector("#filter-ev-jarat")?.addEventListener("change", (event) => {
    const value = event.target.value;
    const evTol = form.querySelector('[name="ev_tol"]');
    const evIg = form.querySelector('[name="ev_ig"]');
    if (value && evTol && evIg) {
      evTol.value = "";
      evIg.value = "";
    }
  });

  for (const input of form.querySelectorAll('[name="ev_tol"], [name="ev_ig"]')) {
    input.addEventListener("input", () => {
      const evJarat = form.querySelector("#filter-ev-jarat");
      if (!evJarat) return;
      if (form.querySelector('[name="ev_tol"]')?.value || form.querySelector('[name="ev_ig"]')?.value) {
        evJarat.value = "";
      }
    });
  }
}

export async function initHomeFilterCatalog(onChange = () => {}) {
  const brandSelect = document.getElementById("filter-gyartmany");
  const modelSelect = document.getElementById("filter-modell");
  if (!brandSelect || !modelSelect) return null;

  return initVehicleCatalogSelects({
    brandSelect,
    modelSelect,
    yearSelect: document.getElementById("filter-ev-jarat"),
    yearFromCatalog: false,
    brandEmptyLabel: "Mindegy",
    modelEmptyLabel: "Mindegy",
    onChange,
  });
}

export { FEATURE_CHECKS, FUEL_QUICK_FILTERS };
