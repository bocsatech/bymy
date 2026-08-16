import { initVehicleCatalogSelects, typeNameForField } from "./vehicle-catalog-client.js";

const VALUATION_UI_VERSION = "valuation20260728catalog";

let valuationInitialized = false;

function setStatus(statusEl, message, type = "") {
  if (!statusEl) return;
  statusEl.hidden = !message;
  statusEl.textContent = message ?? "";
  statusEl.dataset.statusType = type;
}

async function fetchValuationEstimate(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && String(value).trim() !== "") query.set(key, String(value).trim());
  }
  const response = await fetch(`/api/valuation/estimate?${query}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Becslés sikertelen.");
  return data;
}

function renderResult(resultEl, data) {
  if (!resultEl) return;
  if (!data.count) {
    resultEl.hidden = false;
    resultEl.className = "home-valuation-result home-valuation-result--empty";
    resultEl.textContent = data.message ?? "Nincs egyező hirdetés.";
    return;
  }

  resultEl.hidden = false;
  resultEl.className = "home-valuation-result home-valuation-result--ok";
  resultEl.innerHTML = `
    <p class="home-valuation-result-label">Becsült átlagár</p>
    <p class="home-valuation-result-price">${data.average_price_formatted ?? "—"}</p>
    <p class="home-valuation-result-meta">${data.message ?? ""}</p>
    ${
      data.min_price_formatted && data.max_price_formatted
        ? `<p class="home-valuation-result-range">${data.min_price_formatted} – ${data.max_price_formatted}</p>`
        : ""
    }
  `;
}

/** Modell + típus → a becslő fuzzy keresőjének. */
function buildModellTipus(modell, tipus) {
  const model = String(modell ?? "").trim();
  const tip = typeNameForField(tipus, model);
  return [model, tip].filter(Boolean).join(" ").trim();
}

export function initHomeValuation(rootId = "home-valuation") {
  if (valuationInitialized) return;
  const root = document.getElementById(rootId);
  const toggleBtn = document.getElementById("home-valuation-toggle");
  const bodyEl = document.getElementById("home-valuation-body");
  const form = document.getElementById("home-valuation-form");
  const brandSelect = document.getElementById("valuation-gyartmany");
  const modelSelect = document.getElementById("valuation-modell");
  const yearSelect = document.getElementById("valuation-ev");
  const tipusSelect = document.getElementById("valuation-tipus");
  const statusEl = document.getElementById("home-valuation-status");
  const resultEl = document.getElementById("home-valuation-result");
  if (!root || !toggleBtn || !bodyEl || !form || !brandSelect) return;

  valuationInitialized = true;
  root.dataset.valuationUiVersion = VALUATION_UI_VERSION;

  let catalogReady = false;

  function setExpanded(expanded) {
    root.classList.toggle("is-collapsed", !expanded);
    bodyEl.hidden = !expanded;
    toggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  async function loadCatalog() {
    if (catalogReady || !modelSelect || !yearSelect) return;
    setStatus(statusEl, "Katalógus betöltése…", "info");
    try {
      await initVehicleCatalogSelects({
        brandSelect,
        modelSelect,
        yearSelect,
        yearFromCatalog: false,
        brandEmptyLabel: "Válassz gyártmányt",
        modelEmptyLabel: "Válassz típust",
        yearEmptyLabel: "Mindegy",
      });
      catalogReady = true;
      setStatus(statusEl, "", "");
    } catch (error) {
      setStatus(statusEl, error.message ?? "Nem sikerült betölteni a katalógust.", "err");
    }
  }

  toggleBtn.addEventListener("click", () => {
    const willExpand = root.classList.contains("is-collapsed");
    if (willExpand) {
      setExpanded(true);
      loadCatalog();
      return;
    }
    setExpanded(false);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const modell = formData.get("modell")?.toString() ?? "";
    const tipus = formData.get("tipus")?.toString() ?? "";
    setStatus(statusEl, "Számítás…", "info");
    resultEl.hidden = true;

    try {
      const data = await fetchValuationEstimate({
        gyartmany: formData.get("gyartmany"),
        modell_tipus: buildModellTipus(modell, tipus),
        gyartasi_ev: formData.get("gyartasi_ev"),
        km: formData.get("km"),
      });
      if (data.error) {
        setStatus(statusEl, data.error, "err");
        return;
      }
      setStatus(statusEl, "", "");
      renderResult(resultEl, data);
    } catch (error) {
      setStatus(statusEl, error.message ?? "Nem sikerült kiszámítani az átlagárat.", "err");
    }
  });

  setExpanded(false);
}
