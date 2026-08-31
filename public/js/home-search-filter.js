import { initVehicleCatalogSelects, shortTypeName } from "./vehicle-catalog-client.js";
import { kivitelMatches } from "./kivitel-options.js?v=kivitel1";
import { fuelValueMatches } from "./auto-fuel-picker.js?v=fogyNum1";
import { kivitelListMatches } from "./auto-kivitel-picker.js?v=fogyNum1";
import { allapotValueMatches } from "./auto-allapot-picker.js?v=fogyNum1";
import { sebessegvaltoListMatches } from "./auto-sebessegvalto-picker.js?v=fogyNum1";
import { okmanyListMatches } from "./auto-okmany-picker.js?v=fogyNum1";
import { toltoListMatches } from "./auto-tolto-picker.js?v=fogyNum1";

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
    km_tol: numOrNull(data.get("km_tol")),
    km_ig: numOrNull(data.get("km_ig")),
    le_tol: numOrNull(data.get("le_tol")),
    le_ig: numOrNull(data.get("le_ig")),
    sebessegvalto: data.get("sebessegvalto")?.toString() ?? "",
    hajtas: data.get("hajtas")?.toString() ?? "",
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

function matchesSebessegvalto(listingValue, selected) {
  if (!selected) return true;
  const got = normalizeForMatch(listingValue);
  const want = normalizeForMatch(selected);
  if (!want) return true;
  if (!got) return false;
  if (want === "automata") return /automata|fokozatmentes|cvt/.test(got);
  if (want === "manualis") return /manualis/.test(got) && !/automata|fokozatmentes|cvt/.test(got);
  return got === want || got.includes(want) || want.includes(got);
}

export function filterListingsBySidebar(items, filters) {
  return items.filter((item) => {
    const f = item.preview?.filter ?? {};
    const preview = item.preview ?? {};

    if (filters.gyartmanyok?.length) {
      const brands = filters.gyartmanyok.map((b) => normalizeForMatch(b)).filter(Boolean);
      const got = normalizeForMatch(f.gyartmany || "");
      const title = normalizeForMatch(preview.title || "");
      if (!brands.some((b) => got.includes(b) || title.includes(b) || b.includes(got))) return false;
    } else if (filters.gyartmany && f.gyartmany !== filters.gyartmany) {
      return false;
    }
    if (filters.modellek?.length) {
      const models = filters.modellek.map((m) => normalizeForMatch(m)).filter(Boolean);
      const got = normalizeForMatch(f.modell || "");
      const title = normalizeForMatch(preview.title || preview.specLine || "");
      if (!models.some((m) => got.includes(m) || title.includes(m) || m.includes(got))) return false;
    } else if (filters.modell && f.modell !== filters.modell) {
      return false;
    }
    if (filters.kivitelek?.length) {
      if (!kivitelListMatches(f.kivitel, filters.kivitelek)) return false;
    } else if (filters.kivitel && !kivitelMatches(f.kivitel, filters.kivitel)) return false;
    if (filters.hajtas && f.hajtas !== filters.hajtas) return false;
    if (filters.sebessegvaltok?.length) {
      if (!sebessegvaltoListMatches(f.sebessegvalto, filters.sebessegvaltok)) return false;
    } else if (!matchesSebessegvalto(f.sebessegvalto, filters.sebessegvalto)) return false;
    if (filters.uzemanyagok?.length) {
      if (!fuelValueMatches(f.uzemanyag, filters.uzemanyagok)) return false;
    } else if (filters.uzemanyagQuick) {
      const rule = FUEL_QUICK_FILTERS.find((entry) => entry.id === filters.uzemanyagQuick);
      if (rule && !rule.match(f.uzemanyag)) return false;
    } else if (filters.uzemanyag && f.uzemanyag !== filters.uzemanyag) return false;
    if (filters.allapotok?.length) {
      if (!allapotValueMatches(f.allapot, filters.allapotok)) return false;
    } else if (filters.allapot && f.allapot !== filters.allapot) return false;
    if (filters.okmany_jellegek?.length) {
      if (!okmanyListMatches(f.okmany_jelleg, filters.okmany_jellegek)) return false;
    } else if (filters.okmany_jelleg && !okmanyListMatches(f.okmany_jelleg, [filters.okmany_jelleg])) {
      return false;
    }
    if (filters.ac_tolto_csatlakozasok?.length) {
      if (!toltoListMatches(f.ac_tolto_csatlakozas || f.tolto_csatlakozas, filters.ac_tolto_csatlakozasok)) {
        return false;
      }
    } else if (filters.tolto_csatlakozasok?.length) {
      if (!toltoListMatches(f.tolto_csatlakozas || f.ac_tolto_csatlakozas, filters.tolto_csatlakozasok)) {
        return false;
      }
    }
    if (filters.ajtok && f.ajtok !== filters.ajtok) return false;
    if (filters.ulesek && f.ulesek !== filters.ulesek) return false;

    for (const key of ["fogyasztas_varosi", "fogyasztas_orszaguti", "fogyasztas_kombinalt", "co2_kibocsatas"]) {
      if (filters[key] == null || filters[key] === "") continue;
      const max = Number(filters[key]);
      if (!Number.isFinite(max)) continue;
      const got = Number(String(f[key] ?? "").replace(",", ".").replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(got) || got > max) return false;
    }

    if (filters.tipus) {
      const hay = [f.tipus, preview.title, preview.specLine].join(" ").toLowerCase();
      if (!hay.includes(filters.tipus.toLowerCase())) return false;
    }

    if (filters.ev_jarat != null) {
      if (f.gyartasi_ev !== filters.ev_jarat) return false;
    } else if (!inRange(f.gyartasi_ev, filters.ev_tol, filters.ev_ig)) {
      return false;
    }
    if (!inRange(preview.priceNum, filters.ar_tol, filters.ar_ig)) return false;
    if (!inRange(preview.kmNum, filters.km_tol, filters.km_ig)) return false;
    if (!inRange(f.teljesitmeny_le, filters.le_tol, filters.le_ig)) return false;
    if (!inRange(f.hengerurtartalom, filters.ccm_tol, filters.ccm_ig)) return false;

    // Helyszín: pontos település / irányítószám (körzet nélkül).
    // Körzet aktív esetén ezeket a radius-szűrő kezeli — ne essen el a találat.
    if (!filters._locationByRadius) {
      if (filters.telepules) {
        const got = normalizeForMatch(f.telepules || preview.location || "");
        const want = normalizeForMatch(filters.telepules);
        if (!got || !got.includes(want) && !want.includes(got)) return false;
      }
      if (filters.iranyitoszam) {
        const want = String(filters.iranyitoszam).replace(/\D/g, "").slice(0, 4);
        const got = String(f.iranyitoszam || "").replace(/\D/g, "").slice(0, 4);
        if (want && got && got !== want) return false;
        // Ha a hirdetésen nincs irányítószám, a település-egyezés elég.
      }
    }

    for (const [key, value] of Object.entries(filters)) {
      if (value == null || value === "") continue;
      if (
        [
          "gyartmany",
          "gyartmanyok",
          "modell",
          "modellek",
          "kivitel",
          "hajtas",
          "sebessegvalto",
          "sebessegvaltok",
          "uzemanyag",
          "uzemanyagQuick",
          "allapot",
          "allapotok",
          "okmany_jelleg",
          "okmany_jellegek",
          "ac_tolto_csatlakozas",
          "ac_tolto_csatlakozasok",
          "tolto_csatlakozas",
          "tolto_csatlakozasok",
          "fogyasztas_varosi",
          "fogyasztas_orszaguti",
          "fogyasztas_kombinalt",
          "co2_kibocsatas",
          "ajtok",
          "ulesek",
          "tipus",
          "ev_jarat",
          "ev_tol",
          "ev_ig",
          "ar_tol",
          "ar_ig",
          "km_tol",
          "km_ig",
          "le_tol",
          "le_ig",
          "ccm_tol",
          "ccm_ig",
          "features",
          // Nem hirdetésmező / helyszín (fent kezelve)
          "keresesi_korzet",
          "telepules",
          "iranyitoszam",
          "megye",
          "_locationByRadius",
        ].includes(key)
      ) {
        continue;
      }
      if (key.endsWith("_tol") || key.endsWith("_ig")) {
        const base = key.replace(/_(tol|ig)$/, "");
        const listingVal = Number(f[base] ?? preview[base]);
        if (!inRange(listingVal, filters[`${base}_tol`], filters[`${base}_ig`])) return false;
        continue;
      }
      const listingVal = f[key];
      if (listingVal == null || listingVal === "") return false;
      if (normalizeForMatch(listingVal) !== normalizeForMatch(value)) return false;
    }

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

  const listingYears = filters
    .map((f) => f.gyartasi_ev)
    .filter((year) => year && year > 1900);
  const yearSet = new Set(listingYears.map(String));
  const lastYear = new Date().getFullYear();
  for (let year = lastYear; year >= 1990; year -= 1) yearSet.add(String(year));
  const years = [...yearSet].sort((a, b) => Number(b) - Number(a));
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
    km_tol: null,
    km_ig: null,
    le_tol: null,
    le_ig: null,
    sebessegvalto: "",
    hajtas: "",
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
