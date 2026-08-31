/**
 * Autó asztali — Gyártmány + Modell (mobil app kinézet).
 * Két külön sor: címke fölött, kerekített gomb ⌄-vel; panel a márka/típus választáshoz.
 */

import { fetchVehicleCatalog } from "./vehicle-catalog-client.js?v=autoDesk16";

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
    (document.body?.getAttribute("data-site-page") === "auto" ||
      document.body?.getAttribute("data-site-page") === "teherauto") &&
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

  const wrap = document.createElement("div");
  wrap.className = "auto-bm-pair";
  wrap.dataset.deskQuick = "1";
  wrap.innerHTML = `
    <div class="auto-desk-field auto-bm-field" data-desk-field="gyartmany" data-desk-quick="1">
      <span class="auto-desk-field__label">Gyártmány</span>
      <button type="button" class="auto-bm-trigger" data-auto-bm-open="brand">
        <span data-auto-bm-brand-summary>Mindegy</span>
        <span class="auto-bm-trigger__chev" aria-hidden="true">⌄</span>
      </button>
    </div>
    <div class="auto-desk-field auto-bm-field" data-desk-field="modell" data-desk-quick="1">
      <span class="auto-desk-field__label">Modell</span>
      <button type="button" class="auto-bm-trigger" data-auto-bm-open="model">
        <span data-auto-bm-model-summary>Mindegy</span>
        <span class="auto-bm-trigger__chev" aria-hidden="true">⌄</span>
      </button>
    </div>
  `;
  wrap.appendChild(brandsInput);
  wrap.appendChild(modelsInput);
  alapHost.insertBefore(wrap, alapHost.firstChild);

  const brandSummaryEl = wrap.querySelector("[data-auto-bm-brand-summary]");
  const modelSummaryEl = wrap.querySelector("[data-auto-bm-model-summary]");
  const openBrandBtn = wrap.querySelector('[data-auto-bm-open="brand"]');
  const openModelBtn = wrap.querySelector('[data-auto-bm-open="model"]');

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
        <p class="auto-bm-panel__title" data-auto-bm-title>Gyártmány</p>
        <p class="auto-bm-panel__sub" data-auto-bm-sub hidden></p>
      </div>
      <button type="button" class="auto-bm-panel__done" data-auto-bm-done>Kész</button>
    </div>
    <div class="auto-bm-panel__search" data-auto-bm-search-wrap>
      <input
        type="text"
        class="auto-bm-panel__search-input"
        data-auto-bm-search
        placeholder="Keresés…"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        inputmode="search"
        enterkeyhint="search"
      />
    </div>
    <div class="auto-bm-panel__body" data-auto-bm-body></div>
  `;
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
    if (brandSummaryEl) brandSummaryEl.textContent = labelList(selectedBrands, "márka");
    if (modelSummaryEl) modelSummaryEl.textContent = labelList(selectedModels, "modell");
  }

  function modelLabelFor(brand) {
    const allowed = new Set(modelsByBrand[brand] || []);
    const list = selectedModels.filter((m) => allowed.has(m));
    return labelList(list, "modell");
  }

  function brandsMatchingQuery(query) {
    const q = String(query ?? "")
      .trim()
      .toLocaleLowerCase("hu");
    if (!q) return brands;
    // Csak a márkanév elején egyező betűk (pl. CH → CHERY, CHEVROLET)
    return brands.filter((b) => b.toLocaleLowerCase("hu").startsWith(q));
  }

  function renderBrandRowsOnly() {
    const filtered = brandsMatchingQuery(brandQuery);
    const group = bodyEl.querySelector(".auto-bm-group");
    const rows = filtered
      .map((brand) => {
        const on = selectedBrands.includes(brand);
        const modelRow = on
          ? `<button type="button" class="auto-bm-subrow" data-auto-bm-open-models="${escapeAttr(brand)}">
              <span>${escapeHtml(brand)} — modell</span>
              <span class="auto-bm-subrow__val">${escapeHtml(modelLabelFor(brand))}</span>
            </button>`
          : "";
        return `<div class="auto-bm-row" data-auto-bm-brand-row="${escapeAttr(brand)}">
          <label class="auto-bm-toggle">
            <span>${escapeHtml(brand)}</span>
            <input type="checkbox" data-auto-bm-brand="${escapeAttr(brand)}" ${on ? "checked" : ""} />
            <span class="auto-bm-switch" aria-hidden="true"></span>
          </label>
          ${modelRow}
        </div>`;
      })
      .join("");
    const html = rows || `<p class="auto-bm-empty">Nincs találat.</p>`;
    if (group) {
      group.innerHTML = html;
    } else {
      bodyEl.innerHTML = `
        <p class="auto-bm-hint">Kapcsolók — több gyártmány is</p>
        <button type="button" class="auto-bm-clear" data-auto-bm-clear-brands>Összes kikapcsolása</button>
        <div class="auto-bm-group">${html}</div>
      `;
    }
    bodyEl.scrollTop = 0;
  }

  function renderBrandList() {
    modelBrand = null;
    titleEl.textContent = "Gyártmány";
    subEl.hidden = true;
    searchWrap.hidden = false;
    if (searchInput && searchInput.value !== brandQuery) searchInput.value = brandQuery;
    bodyEl.innerHTML = `
      <p class="auto-bm-hint">Kapcsolók — több gyártmány is</p>
      <button type="button" class="auto-bm-clear" data-auto-bm-clear-brands>Összes kikapcsolása</button>
      <div class="auto-bm-group"></div>
    `;
    renderBrandRowsOnly();
  }

  function renderModelList(brand) {
    modelBrand = brand;
    titleEl.textContent = "Modell";
    subEl.hidden = false;
    subEl.textContent = brand;
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
      <p class="auto-bm-hint">Kapcsolók — több modell is</p>
      <button type="button" class="auto-bm-clear" data-auto-bm-clear-models>Összes kikapcsolása</button>
      <div class="auto-bm-group">${
        rows || `<p class="auto-bm-empty">Nincs modell ehhez a gyártmányhoz.</p>`
      }</div>
    `;
  }

  function openPanel(mode = "brand") {
    panel.hidden = false;
    panel.style.removeProperty("display");
    panel.classList.remove("is-closed");
    document.body.classList.add("auto-bm-open");
    brandQuery = "";
    if (searchInput) searchInput.value = "";
    if (mode === "model") {
      if (selectedBrands.length === 1) {
        renderModelList(selectedBrands[0]);
      } else if (selectedBrands.length > 1) {
        renderBrandList();
      } else {
        renderBrandList();
      }
    } else {
      renderBrandList();
    }
    if (!modelBrand) {
      requestAnimationFrame(() => searchInput?.focus());
    }
  }

  function closePanel() {
    panel.hidden = true;
    panel.style.setProperty("display", "none", "important");
    panel.classList.add("is-closed");
    document.body.classList.remove("auto-bm-open");
    modelBrand = null;
    brandQuery = "";
    if (searchInput) searchInput.value = "";
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    syncHidden();
  }

  function toggleOpen(mode) {
    const open = !panel.hidden && !panel.classList.contains("is-closed");
    if (open) {
      closePanel();
      return;
    }
    openPanel(mode);
  }

  openBrandBtn?.addEventListener("click", () => toggleOpen("brand"));
  openModelBtn?.addEventListener("click", () => toggleOpen("model"));

  panel.querySelector("[data-auto-bm-back]")?.addEventListener("click", () => {
    if (modelBrand) {
      renderBrandList();
      requestAnimationFrame(() => searchInput?.focus());
    } else closePanel();
  });

  panel.querySelector("[data-auto-bm-done]")?.addEventListener("click", () => {
    if (modelBrand) {
      renderBrandList();
      requestAnimationFrame(() => searchInput?.focus());
    } else closePanel();
  });

  searchInput?.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });
  searchInput?.addEventListener("click", (event) => {
    event.stopPropagation();
    searchInput.focus();
  });
  searchInput?.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      if (brandQuery) {
        brandQuery = "";
        searchInput.value = "";
        renderBrandRowsOnly();
      } else {
        closePanel();
      }
      return;
    }
    // Enter ne küldje el a kereső formot
    if (event.key === "Enter") {
      event.preventDefault();
    }
  });
  searchInput?.addEventListener("input", () => {
    brandQuery = searchInput.value || "";
    if (modelBrand) return;
    renderBrandRowsOnly();
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
