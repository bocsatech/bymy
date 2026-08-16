/**
 * Gyorskereső az autó hero panelen.
 *
 * Alap: Gyártmány, Típus, Üzemanyag, Évjárat, Vételár
 * Több szűrő: Futott km, LE, Kivitel, Sebességváltó, Hajtás
 */

import { initVehicleCatalogSelects, fillSelect } from "./vehicle-catalog-client.js";

const FIRST_YEAR = 1950;
const PRICE_STEP = 500_000;
const PRICE_MAX = 50_000_000;
const KM_STEP = 10_000;
const KM_MAX = 500_000;
const LE_STEPS = [50, 75, 100, 125, 150, 175, 200, 225, 250, 300, 350, 400, 500, 600, 800];

function yearOptions() {
  const current = new Date().getFullYear();
  const years = [];
  for (let year = current; year >= FIRST_YEAR; year -= 1) years.push(String(year));
  return years;
}

function priceOptions() {
  const prices = [];
  for (let price = PRICE_STEP; price <= PRICE_MAX; price += PRICE_STEP) {
    prices.push(price);
  }
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

function numOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/\D/g, ""));
  return Number.isFinite(n) ? n : null;
}

function readQuickSearchValues(form) {
  return {
    gyartmany: form.querySelector("#qs-gyartmany")?.value ?? "",
    modell: form.querySelector("#qs-modell")?.value ?? "",
    tipusKatalogus: "",
    uzemanyagQuick: form.querySelector("#qs-uzemanyag")?.value ?? "",
    ev_tol: numOrNull(form.querySelector("#qs-ev-tol")?.value),
    ev_ig: numOrNull(form.querySelector("#qs-ev-ig")?.value),
    ar_tol: numOrNull(form.querySelector("#qs-ar-tol")?.value),
    ar_ig: numOrNull(form.querySelector("#qs-ar-ig")?.value),
    km_tol: numOrNull(form.querySelector("#qs-km-tol")?.value),
    km_ig: numOrNull(form.querySelector("#qs-km-ig")?.value),
    le_tol: numOrNull(form.querySelector("#qs-le-tol")?.value),
    le_ig: numOrNull(form.querySelector("#qs-le-ig")?.value),
    kivitel: form.querySelector("#qs-kivitel")?.value ?? "",
    sebessegvalto: form.querySelector("#qs-sebessegvalto")?.value ?? "",
    hajtas: form.querySelector("#qs-hajtas")?.value ?? "",
  };
}

export function initHomeQuickSearch({ onSearch = () => {} } = {}) {
  const form = document.getElementById("home-qs-form");
  if (!form) return;

  const hero = document.querySelector("[data-auto-search-hero]");
  const morePanel = document.getElementById("qs-more");
  const advancedBtn = document.getElementById("qs-reszletes");
  const brandSelect = document.getElementById("qs-gyartmany");
  const modelSelect = document.getElementById("qs-modell");
  const yearFrom = document.getElementById("qs-ev-tol");
  const yearTo = document.getElementById("qs-ev-ig");
  const priceFrom = document.getElementById("qs-ar-tol");
  const priceTo = document.getElementById("qs-ar-ig");
  const kmFrom = document.getElementById("qs-km-tol");
  const kmTo = document.getElementById("qs-km-ig");
  const leFrom = document.getElementById("qs-le-tol");
  const leTo = document.getElementById("qs-le-ig");

  const years = yearOptions();
  fillSelect(yearFrom, years, "-tól");
  fillSelect(yearTo, years, "-ig");
  fillNumberSelect(priceFrom, priceOptions(), "-tól");
  fillNumberSelect(priceTo, priceOptions(), "-ig");
  fillNumberSelect(kmFrom, kmOptions(), "-tól", (n) => `${n.toLocaleString("hu-HU")} km`);
  fillNumberSelect(kmTo, kmOptions(), "-ig", (n) => `${n.toLocaleString("hu-HU")} km`);
  fillNumberSelect(leFrom, LE_STEPS, "-tól", (n) => `${n} LE`);
  fillNumberSelect(leTo, LE_STEPS, "-ig", (n) => `${n} LE`);

  const statusEl = document.getElementById("home-qs-status");

  initVehicleCatalogSelects({
    brandSelect,
    modelSelect,
    brandEmptyLabel: "Mindegy",
    modelEmptyLabel: "Mindegy",
    yearFromCatalog: false,
  })
    .then((catalog) => {
      if (statusEl) {
        statusEl.hidden = true;
        statusEl.textContent = "";
      }
      if (!catalog?.gyartmanyok?.length && statusEl) {
        statusEl.hidden = false;
        statusEl.textContent =
          "Nincs járműkatalógus. Import: npm run import:catalog -- ~/Desktop/lista.csv, majd indítsd újra a Bymy-et.";
      }
    })
    .catch((error) => {
      console.error("Gyorskereső katalógus:", error);
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent =
          error?.message ||
          "A gyártmány/típus lista nem töltődött be. Indítsd újra a Bymy szervert (frissites.command).";
      }
    });

  function setMoreOpen(open) {
    if (!morePanel || !advancedBtn) return;
    morePanel.hidden = !open;
    morePanel.classList.toggle("is-open", open);
    advancedBtn.setAttribute("aria-expanded", open ? "true" : "false");
    advancedBtn.textContent = open ? "Kevesebb szűrő" : "Több szűrő";
    hero?.classList.toggle("is-more-open", open);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSearch(readQuickSearchValues(form));
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      brandSelect?.dispatchEvent(new Event("change"));
      setMoreOpen(false);
      onSearch({});
    });
  });

  advancedBtn?.addEventListener("click", () => {
    setMoreOpen(!morePanel.classList.contains("is-open"));
  });

  setMoreOpen(false);
}
