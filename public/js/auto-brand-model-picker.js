/**
 * Autó asztali — Gyártmány/Típus multi-select (iOS SearchScreen mintájára).
 * Csak desktop auto: nested Márka → Típus panelek, kapcsolók, Kész.
 */

import { fetchVehicleCatalog } from "./vehicle-catalog-client.js?v=autoDesk12";

function labelList(items, unit) {
  if (!items.length) return "Mindegy";
  if (items.length === 1) return items[0];
  if (items.length <= 3) return items.join(", ");
  return `${items.length} ${unit}`;
}

function parseJsonList(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  } catch {
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function writeJsonList(input, list) {
  if (!input) return;
  input.value = list.length ? JSON.stringify(list) : "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function isAutoDesk() {
  return (
    document.body?.getAttribute("data-site-page") === "auto" &&
    window.matchMedia("(min-width: 901px)").matches
  );
}

/**
 * @param {HTMLFormElement} form
 */
export async function mountAutoBrandModelPicker(form) {
  if (!form || !isAutoDesk() || form.dataset.brandModelPicker === "1") return;

  const alapHost = form.querySelector(".auto-desk-fields[data-desk-alap]");
  if (!alapHost) return;

  const brandField = alapHost.querySelector('[data-desk-field="gyartmany"]');
  const modelField = alapHost.querySelector('[data-desk-field="modell"]');
  if (!brandField && !modelField) return;

  let catalog;
  try {
    catalog = await fetchVehicleCatalog();
  } catch (error) {
    console.warn("Gyártmány picker katalógus:", error);
    return;
  }

  const brands = [...(catalog.gyartmanyok || [])].sort((a, b) =>
    a.localeCompare(b, "hu", { sensitivity: "base" })
  );
  const modelsByBrand = catalog.modellek || {};

  // Előző selectek eltávolítása — multi hidden mezők
  brandField?.remove();
  modelField?.remove();

  const brandsInput = document.createElement("input");
  brandsInput.type = "hidden";
  brandsInput.dataset.filterKey = "gyartmanyok";
  brandsInput.setAttribute("data-filter-key", "gyartmanyok");

  const modelsInput = document.createElement("input");
  modelsInput.type = "hidden";
  modelsInput.dataset.filterKey = "modellek";
  modelsInput.setAttribute("data-filter-key", "modellek");

  const trigger = document.createElement("div");
  trigger.className = "auto-desk-field auto-bm-trigger-wrap";
  trigger.dataset.deskField = "gyartmany";
  trigger.dataset.deskQuick = "1";
  trigger.innerHTML = `
    <span class="auto-desk-field__label">Gyártmány/Típus</span>
    <button type="button" class="auto-bm-trigger" data-auto-bm-open>
      <span data-auto-bm-summary>Mindegy</span>
      <span class="auto-bm-trigger__chev" aria-hidden="true">›</span>
    </button>
  `;
  trigger.appendChild(brandsInput);
  trigger.appendChild(modelsInput);
  alapHost.insertBefore(trigger, alapHost.firstChild);

  const summaryEl = trigger.querySelector("[data-auto-bm-summary]");
  const openBtn = trigger.querySelector("[data-auto-bm-open]");

  /** @type {string[]} */
  let selectedBrands = [];
  /** @type {string[]} */
  let selectedModels = [];
  /** @type {string | null} */
  let modelBrand = null;
  let brandQuery = "";

  const panel = document.createElement("div");
  panel.className = "auto-bm-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="auto-bm-panel__chrome">
      <button type="button" class="auto-bm-panel__back" data-auto-bm-back aria-label="Vissza">‹</button>
      <div class="auto-bm-panel__titles">
        <p class="auto-bm-panel__title" data-auto-bm-title>Márka</p>
        <p class="auto-bm-panel__sub" data-auto-bm-sub hidden></p>
      </div>
      <button type="button" class="auto-bm-panel__done" data-auto-bm-done>Kész</button>
    </div>
    <div class="auto-bm-panel__search" data-auto-bm-search-wrap>
      <input type="search" class="auto-bm-panel__search-input" data-auto-bm-search placeholder="Keresés…" autocomplete="off" />
    </div>
    <div class="auto-bm-panel__body" data-auto-bm-body></div>
  `;
  // Sticky a bal szűrőoszlopban
  const hero = document.querySelector(".auto-search-hero") || form.closest(".auto-search-hero") || form;
  hero.appendChild(panel);

  const titleEl = panel.querySelector("[data-auto-bm-title]");
  const subEl = panel.querySelector("[data-auto-bm-sub]");
  const bodyEl = panel.querySelector("[data-auto-bm-body]");
  const searchWrap = panel.querySelector("[data-auto-bm-search-wrap]");
  const searchInput = panel.querySelector("[data-auto-bm-search]");

  function pruneModels() {
    const allowed = new Set();
    for (const b of selectedBrands) {
      for (const m of modelsByBrand[b] || []) allowed.add(m);
    }
    selectedModels = selectedModels.filter((m) => allowed.has(m));
  }

  function syncHidden() {
    writeJsonList(brandsInput, selectedBrands);
    writeJsonList(modelsInput, selectedModels);
    const brandLbl = labelList(selectedBrands, "márka");
    const modelLbl = labelList(selectedModels, "modell");
    if (!selectedBrands.length) summaryEl.textContent = "Mindegy";
    else if (!selectedModels.length) summaryEl.textContent = brandLbl;
    else summaryEl.textContent = `${brandLbl} · ${modelLbl}`;
  }

  function modelLabelFor(brand) {
    const allowed = new Set(modelsByBrand[brand] || []);
    const list = selectedModels.filter((m) => allowed.has(m));
    return labelList(list, "modell");
  }

  function renderBrandList() {
    modelBrand = null;
    titleEl.textContent = "Márka";
    subEl.hidden = true;
    searchWrap.hidden = false;
    const q = brandQuery.trim().toLowerCase();
    const filtered = q
      ? brands.filter((b) => b.toLowerCase().includes(q))
      : brands;

    const rows = filtered
      .map((brand) => {
        const on = selectedBrands.includes(brand);
        const modelRow = on
          ? `<button type="button" class="auto-bm-subrow" data-auto-bm-open-models="${escapeAttr(brand)}">
              <span>${escapeHtml(brand)} típus választása</span>
              <span class="auto-bm-subrow__val">${escapeHtml(modelLabelFor(brand))}</span>
            </button>`
          : "";
        return `<div class="auto-bm-row">
          <label class="auto-bm-toggle">
            <span>${escapeHtml(brand)}</span>
            <input type="checkbox" data-auto-bm-brand="${escapeAttr(brand)}" ${on ? "checked" : ""} />
            <span class="auto-bm-switch" aria-hidden="true"></span>
          </label>
          ${modelRow}
        </div>`;
      })
      .join("");

    bodyEl.innerHTML = `
      <p class="auto-bm-hint">Kapcsolók — több márka is</p>
      <button type="button" class="auto-bm-clear" data-auto-bm-clear-brands>Összes kikapcsolása</button>
      <div class="auto-bm-group">${rows || `<p class="auto-bm-empty">Nincs találat.</p>`}</div>
    `;
  }

  function renderModelList(brand) {
    modelBrand = brand;
    titleEl.textContent = brand;
    subEl.hidden = false;
    subEl.textContent = "Típus — több is bekapcsolható";
    searchWrap.hidden = true;
    const models = [...(modelsByBrand[brand] || [])].sort((a, b) =>
      a.localeCompare(b, "hu", { sensitivity: "base" })
    );
    const rows = models
      .map((model) => {
        const on = selectedModels.includes(model);
        return `<div class="auto-bm-row">
          <label class="auto-bm-toggle">
            <span>${escapeHtml(model)}</span>
            <input type="checkbox" data-auto-bm-model="${escapeAttr(model)}" ${on ? "checked" : ""} />
            <span class="auto-bm-switch" aria-hidden="true"></span>
          </label>
        </div>`;
      })
      .join("");

    bodyEl.innerHTML = `
      <p class="auto-bm-hint">Kapcsolók — több típus is</p>
      <button type="button" class="auto-bm-clear" data-auto-bm-clear-models>Összes kikapcsolása</button>
      <div class="auto-bm-group">${
        rows || `<p class="auto-bm-empty">Nincs típus ehhez a gyártmányhoz.</p>`
      }</div>
    `;
  }

  function openPanel() {
    panel.hidden = false;
    document.body.classList.add("auto-bm-open");
    brandQuery = "";
    if (searchInput) searchInput.value = "";
    renderBrandList();
  }

  function closePanel() {
    panel.hidden = true;
    document.body.classList.remove("auto-bm-open");
    modelBrand = null;
    syncHidden();
  }

  openBtn?.addEventListener("click", () => {
    if (!panel.hidden) {
      closePanel();
      return;
    }
    openPanel();
  });

  // Vissza: mindig zárja a márka menüt (kiválasztás megmarad)
  panel.querySelector("[data-auto-bm-back]")?.addEventListener("click", () => {
    closePanel();
  });

  // Kész: típus panelről vissza a márkalistára; márkánál bezár
  panel.querySelector("[data-auto-bm-done]")?.addEventListener("click", () => {
    if (modelBrand) renderBrandList();
    else closePanel();
  });

  searchInput?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    closePanel();
  });

  searchInput?.addEventListener("input", () => {
    brandQuery = searchInput.value || "";
    if (!modelBrand) renderBrandList();
  });

  bodyEl.addEventListener("change", (event) => {
    const brandEl = event.target.closest("[data-auto-bm-brand]");
    if (brandEl) {
      const brand = brandEl.getAttribute("data-auto-bm-brand");
      const on = brandEl.checked;
      if (on) {
        if (!selectedBrands.includes(brand)) selectedBrands.push(brand);
      } else {
        selectedBrands = selectedBrands.filter((b) => b !== brand);
      }
      selectedBrands.sort((a, b) => a.localeCompare(b, "hu", { sensitivity: "base" }));
      pruneModels();
      renderBrandList();
      syncHidden();
      return;
    }
    const modelEl = event.target.closest("[data-auto-bm-model]");
    if (modelEl) {
      const model = modelEl.getAttribute("data-auto-bm-model");
      const on = modelEl.checked;
      if (on) {
        if (!selectedModels.includes(model)) selectedModels.push(model);
      } else {
        selectedModels = selectedModels.filter((m) => m !== model);
      }
      selectedModels.sort((a, b) => a.localeCompare(b, "hu", { sensitivity: "base" }));
      syncHidden();
    }
  });

  bodyEl.addEventListener("click", (event) => {
    const openModels = event.target.closest("[data-auto-bm-open-models]");
    if (openModels) {
      renderModelList(openModels.getAttribute("data-auto-bm-open-models"));
      return;
    }
    if (event.target.closest("[data-auto-bm-clear-brands]")) {
      selectedBrands = [];
      selectedModels = [];
      renderBrandList();
      syncHidden();
      return;
    }
    if (event.target.closest("[data-auto-bm-clear-models]") && modelBrand) {
      const allowed = new Set(modelsByBrand[modelBrand] || []);
      selectedModels = selectedModels.filter((m) => !allowed.has(m));
      renderModelList(modelBrand);
      syncHidden();
    }
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      selectedBrands = [];
      selectedModels = [];
      syncHidden();
      if (!panel.hidden) renderBrandList();
    });
  });

  form.dataset.brandModelPicker = "1";
  syncHidden();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

export function readBrandModelFilterValues(form) {
  if (!form) return {};
  const brandsEl = form.querySelector('[data-filter-key="gyartmanyok"]');
  const modelsEl = form.querySelector('[data-filter-key="modellek"]');
  if (!brandsEl && !modelsEl) return {};
  const gyartmanyok = parseJsonList(brandsEl?.value);
  const modellek = parseJsonList(modelsEl?.value);
  const out = {};
  if (gyartmanyok.length) out.gyartmanyok = gyartmanyok;
  if (modellek.length) out.modellek = modellek;
  return out;
}
