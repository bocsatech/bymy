
import { fetchVehicleCatalog } from "./vehicle-catalog-client.js?v=bmKidsInline1";
import { bindAutoBmDismiss, autoBmPanelIsOpen } from "./auto-bm-dismiss.js?v=bmDismiss1";

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

export async function mountAutoBrandModelPicker(form) {
  if (!form || !isAutoDesk() || form.dataset.brandModelPicker === "1") return;

  const alapHost = form.querySelector(".auto-desk-fields[data-desk-alap]");
  if (!alapHost) return;

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
  const treeByBrand = catalog.modellekTree || {};
  const modelsByBrand = {};
  for (const brand of brands) {
    const tree = treeByBrand[brand];
    if (Array.isArray(tree) && tree.length) {
      const names = [];
      for (const node of tree) {
        if (node?.name) names.push(node.name);
        for (const child of node.children || []) {
          if (child?.name) names.push(child.name);
        }
      }
      modelsByBrand[brand] = names;
    } else {
      modelsByBrand[brand] = [...(catalog.modellek?.[brand] || [])];
    }
  }

  function treeFor(brand) {
    const tree = treeByBrand[brand];
    if (Array.isArray(tree) && tree.length) return tree;
    return (modelsByBrand[brand] || []).map((name) => ({
      name,
      children: [],
      searchSelectable: true,
      postRequiresChild: false,
    }));
  }

  /* Drop every plain Gyártmány / Modell / Típus row — picker is the only brand UI. */
  alapHost
    .querySelectorAll(
      '[data-desk-field="gyartmany"], [data-desk-field="modell"], [data-desk-field="tipus"], .auto-bm-pair'
    )
    .forEach((el) => el.remove());
  form.querySelectorAll(".auto-bm-panel").forEach((el) => el.remove());

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

  let selectedBrands = [];
  let selectedModels = [];
  let modelBrand = null;
  /** Open model group (almenü), e.g. ML-OSZTÁLY */
  let modelGroup = null;
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
    return brands.filter((b) => b.toLocaleLowerCase("hu").startsWith(q));
  }

  function actionsHtml({ clearAttr, clearLabel = "Összes kikapcsolása" }) {
    return `<div class="auto-bm-actions">
      <button type="button" class="auto-bm-btn auto-bm-btn--clear" ${clearAttr}>${clearLabel}</button>
      <button type="button" class="auto-bm-btn auto-bm-btn--done" data-auto-bm-done>Kész</button>
    </div>`;
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
        ${actionsHtml({ clearAttr: 'data-auto-bm-clear-brands' })}
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
      ${actionsHtml({ clearAttr: 'data-auto-bm-clear-brands' })}
      <div class="auto-bm-group"></div>
    `;
    renderBrandRowsOnly();
  }

  function renderModelList(brand) {
    modelBrand = brand;
    modelGroup = null;
    titleEl.textContent = "Modell";
    subEl.hidden = false;
    subEl.textContent = brand;
    searchWrap.hidden = true;
    const models = [...treeFor(brand)].sort((a, b) =>
      a.name.localeCompare(b.name, "hu", { sensitivity: "base" })
    );
    const rows = models
      .map((node) => {
        const model = node.name;
        const on = selectedModels.includes(model);
        const kids = [...(node.children || [])].sort((a, b) =>
          a.name.localeCompare(b.name, "hu", { sensitivity: "base" })
        );
        /* Gyerekek (pl. A3 CABRIO) rögtön látszanak — nem kell „Almenü” kattintás */
        const kidsHtml =
          kids.length > 0
            ? `<div class="auto-fuel-children">
                ${kids
                  .map((child) => {
                    const name = child.name;
                    const childOn = selectedModels.includes(name);
                    return `<div class="auto-bm-row">
                      <label class="auto-bm-toggle">
                        <span>${escapeHtml(name)}</span>
                        <input type="checkbox" data-auto-bm-model="${escapeAttr(name)}" ${
                          childOn ? "checked" : ""
                        } />
                        <span class="auto-bm-switch" aria-hidden="true"></span>
                      </label>
                    </div>`;
                  })
                  .join("")}
              </div>`
            : "";
        return `<div class="auto-bm-row" data-auto-bm-model-row="${escapeAttr(model)}">
          <label class="auto-bm-toggle">
            <span>${escapeHtml(model)}</span>
            <input type="checkbox" data-auto-bm-model="${escapeAttr(model)}" ${on ? "checked" : ""} />
            <span class="auto-bm-switch" aria-hidden="true"></span>
          </label>
          ${kidsHtml}
        </div>`;
      })
      .join("");

    bodyEl.innerHTML = `
      ${actionsHtml({ clearAttr: 'data-auto-bm-clear-models' })}
      <div class="auto-bm-group">${
        rows || `<p class="auto-bm-empty">Nincs modell ehhez a gyártmányhoz.</p>`
      }</div>
    `;
  }

  function renderModelGroupList(brand, groupName) {
    modelBrand = brand;
    modelGroup = groupName;
    const group = treeFor(brand).find((n) => n.name === groupName);
    const kids = [...(group?.children || [])].sort((a, b) =>
      a.name.localeCompare(b.name, "hu", { sensitivity: "base" })
    );
    titleEl.textContent = groupName;
    subEl.hidden = false;
    subEl.textContent = brand;
    searchWrap.hidden = true;
    const rows = kids
      .map((child) => {
        const model = child.name;
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
      ${actionsHtml({ clearAttr: 'data-auto-bm-clear-group-models' })}
      <div class="auto-bm-group">${
        rows || `<p class="auto-bm-empty">Nincs altípus ebben az almenüben.</p>`
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
    modelGroup = null;
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

  bindAutoBmDismiss({
    panel,
    roots: [wrap],
    isOpen: () => autoBmPanelIsOpen(panel),
    close: closePanel,
  });

  panel.querySelector("[data-auto-bm-back]")?.addEventListener("click", () => {
    if (modelGroup && modelBrand) {
      renderModelList(modelBrand);
      return;
    }
    if (modelBrand) {
      renderBrandList();
      requestAnimationFrame(() => searchInput?.focus());
    } else closePanel();
  });

  function onDoneClick() {
    closePanel();
  }

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
      syncHidden();
      /* Márka bekapcsolásakor rögtön a modell (típus) lista */
      if (on && brand) {
        renderModelList(brand);
      } else {
        renderBrandList();
      }
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
    if (event.target.closest("[data-auto-bm-done]")) {
      onDoneClick();
      return;
    }
    const openModels = event.target.closest("[data-auto-bm-open-models]");
    if (openModels) {
      renderModelList(openModels.getAttribute("data-auto-bm-open-models"));
      return;
    }
    const openGroup = event.target.closest("[data-auto-bm-open-group]");
    if (openGroup && modelBrand) {
      renderModelGroupList(modelBrand, openGroup.getAttribute("data-auto-bm-open-group"));
      return;
    }
    if (event.target.closest("[data-auto-bm-clear-brands]")) {
      selectedBrands = [];
      selectedModels = [];
      renderBrandList();
      syncHidden();
      return;
    }
    if (event.target.closest("[data-auto-bm-clear-group-models]") && modelBrand && modelGroup) {
      const group = treeFor(modelBrand).find((n) => n.name === modelGroup);
      const allowed = new Set((group?.children || []).map((c) => c.name));
      selectedModels = selectedModels.filter((m) => !allowed.has(m));
      renderModelGroupList(modelBrand, modelGroup);
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
