import { fetchVehicleCatalog } from "./vehicle-catalog-client.js?v=5004d33efa";
import { fillWheel, setWheelValue, readWheelList } from "./ingatlan-wheels.js?v=6952ba469c";
import { openBrandModelCatalogSheet, closeAutoDrumSheet } from "./auto-drum-sheet.js?v=sheetLeft1";

function catalogKindForPage() {
  if (document.body?.getAttribute("data-site-page") === "teherauto") {
    return "kisteher";
  }
  return "szemelyauto";
}

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

function ensureHiddenWheel(host, name, { multiple = true } = {}) {
  let wrap = host.querySelector(`.auto-bm-wheel-host[data-wheel-host="${name}"]`);
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "auto-bm-wheel-host";
    wrap.dataset.wheelHost = name;
    wrap.hidden = true;
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = `<div class="immo-wheel-wrap">
      <div class="immo-wheel" data-wheel="${name}" data-filter-key="${name}" role="listbox"></div>
    </div>`;
    host.appendChild(wrap);
  }
  const wheel = wrap.querySelector("[data-wheel]");
  if (multiple) wheel.dataset.multiple = "1";
  return wheel;
}

export async function mountAutoBrandModelPicker(form) {
  if (!form || !isAutoDesk()) return;

  const wantKind = catalogKindForPage();
  if (form.dataset.brandModelPicker === "1" && form.dataset.brandModelCatalogKind === wantKind) return;
  if (form.dataset.brandModelPicker === "1") {
    form.querySelectorAll(".auto-bm-pair, .auto-bm-field, .auto-bm-wheel-host").forEach((el) => el.remove());
    document.querySelectorAll(".auto-bm-panel").forEach((el) => el.remove());
    delete form.dataset.brandModelPicker;
  }

  const alapHost = form.querySelector(".auto-desk-fields[data-desk-alap]");
  if (!alapHost) return;

  let catalog;
  try {
    if (wantKind === "kisteher") {
      const res = await fetch(`/data/vehicle-catalog-kisteher.json?v=teherStrict4`, { cache: "force-cache" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.gyartmanyok?.length) {
        catalog = await fetchVehicleCatalog({ kind: "kisteher" });
      } else {
        catalog = data;
      }
    } else {
      catalog = await fetchVehicleCatalog({ kind: wantKind });
    }
    if (
      wantKind === "kisteher" &&
      (catalog?.gyartmanyok?.includes?.("FERRARI") ||
        catalog?.gyartmanyok?.includes?.("BMW") ||
        catalog?.gyartmanyok?.includes?.("HONDA") ||
        catalog?.gyartmanyok?.includes?.("JAGUAR") ||
        (catalog?.count_brands || catalog?.gyartmanyok?.length || 0) > 80)
    ) {
      console.warn("Kisteher picker: személyautó katalógus detektálva, elvetve.");
      return;
    }
  } catch (error) {
    console.warn("Gyártmány picker katalógus:", error);
    return;
  }

  form.dataset.brandModelCatalogKind = wantKind;
  form._autoDrumCatalog = {
    gyartmanyok: [...(catalog.gyartmanyok || [])],
    modellek: catalog.modellek || {},
    modellekTree: catalog.modellekTree || {},
  };

  const brands = [...(catalog.gyartmanyok || [])].sort((a, b) =>
    a.localeCompare(b, "hu", { sensitivity: "base" })
  );
  const fold = (v) =>
    String(v ?? "")
      .trim()
      .toLocaleUpperCase("hu-HU")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  const modelsByBrand = {};
  for (const brand of brands) {
    const tree = catalog.modellekTree?.[brand];
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
    /* Alias: kisbetűs / eltérő casing kulcs is ugyanarra a listára mutasson. */
    const folded = fold(brand);
    if (folded && folded !== brand) modelsByBrand[folded] = modelsByBrand[brand];
  }

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

  const emptyCombinedLabel = "Gyártmány / Modell";
  const wrap = document.createElement("div");
  wrap.className = "auto-bm-pair auto-bm-brand-block";
  wrap.dataset.deskQuick = "1";
  wrap.innerHTML = `
    <div class="auto-desk-field auto-bm-field auto-bm-field--combined" data-desk-field="gyartmany" data-desk-quick="1">
      <span class="auto-desk-field__label">Gyártmány &amp; Modell: <span class="req" aria-hidden="true">*</span></span>
      <button type="button" class="auto-bm-trigger auto-bm-trigger--pill" data-auto-bm-open="brand" aria-label="Gyártmány és modell">
        <span data-auto-bm-combined-summary class="is-placeholder">${emptyCombinedLabel}</span>
      </button>
    </div>
  `;
  wrap.appendChild(brandsInput);
  wrap.appendChild(modelsInput);
  alapHost.insertBefore(wrap, alapHost.firstChild);

  const brandWheel = ensureHiddenWheel(wrap, "gyartmany", { multiple: true });
  const modelWheel = ensureHiddenWheel(wrap, "modell", { multiple: true });
  fillWheel(
    brandWheel,
    brands.map((b) => ({ value: b, label: b })),
    { emptyLabel: emptyCombinedLabel }
  );
  fillWheel(modelWheel, [], { emptyLabel: "Mindegy" });
  brandWheel.dataset.multiple = "1";
  modelWheel.dataset.multiple = "1";

  const combinedSummaryEl = wrap.querySelector("[data-auto-bm-combined-summary]");
  const openBrandBtn = wrap.querySelector('[data-auto-bm-open="brand"]');

  function modelsOf(brand) {
    return modelsByBrand[brand] || modelsByBrand[fold(brand)] || [];
  }

  function pruneModels(selectedBrands, selectedModels) {
    const allowed = new Set();
    for (const b of selectedBrands) {
      for (const m of modelsOf(b)) allowed.add(m);
    }
    const allowedFold = new Set([...allowed].map(fold));
    return selectedModels.filter((m) => allowed.has(m) || allowedFold.has(fold(m)));
  }

  function combinedSummaryText(selectedBrands, selectedModels) {
    if (!selectedBrands.length) return emptyCombinedLabel;
    const bPart =
      selectedBrands.length === 1 ? selectedBrands[0] : labelList(selectedBrands, "márka");
    if (!selectedModels.length) return bPart;
    const mPart =
      selectedModels.length === 1 ? selectedModels[0] : labelList(selectedModels, "modell");
    return `${bPart} · ${mPart}`;
  }

  function syncHiddenFromWheels() {
    const selectedBrands = readWheelList(brandWheel);
    let selectedModels = readWheelList(modelWheel);
    selectedModels = pruneModels(selectedBrands, selectedModels);
    writeJsonList(brandsInput, selectedBrands);
    writeJsonList(modelsInput, selectedModels);
    if (combinedSummaryEl) {
      const text = combinedSummaryText(selectedBrands, selectedModels);
      combinedSummaryEl.textContent = text;
      combinedSummaryEl.classList.toggle("is-placeholder", text === emptyCombinedLabel);
      openBrandBtn?.classList.toggle("has-value", text !== emptyCombinedLabel);
    }
  }

  function applyListsToWheels(brandsList, modelsList) {
    const selectedBrands = [...brandsList].sort((a, b) =>
      a.localeCompare(b, "hu", { sensitivity: "base" })
    );
    let selectedModels = pruneModels(
      selectedBrands,
      [...modelsList].sort((a, b) => a.localeCompare(b, "hu", { sensitivity: "base" }))
    );
    setWheelValue(brandWheel, selectedBrands);
    const modelOpts = [];
    const seen = new Set();
    for (const b of selectedBrands) {
      for (const m of modelsOf(b)) {
        if (seen.has(m)) continue;
        seen.add(m);
        modelOpts.push({ value: m, label: m });
      }
    }
    fillWheel(modelWheel, modelOpts, { emptyLabel: "Mindegy" });
    modelWheel.dataset.multiple = "1";
    setWheelValue(modelWheel, selectedModels);
    syncHiddenFromWheels();
  }

  function openSheet() {
    applyListsToWheels(parseJsonList(brandsInput.value), parseJsonList(modelsInput.value));
    openBrandModelCatalogSheet(brandWheel, openBrandBtn, wrap, emptyCombinedLabel, form, {
      singleSelect: false,
    });
    const portal = document.querySelector(".auto-drum-portal--bm");
    const sync = () => syncHiddenFromWheels();
    brandWheel.addEventListener("immo-wheel-change", sync);
    modelWheel.addEventListener("immo-wheel-change", sync);
    const stop = () => {
      brandWheel.removeEventListener("immo-wheel-change", sync);
      modelWheel.removeEventListener("immo-wheel-change", sync);
      syncHiddenFromWheels();
    };
    portal?.querySelector(".auto-drum-portal__done")?.addEventListener("click", stop, { once: true });
    portal?.querySelector(".auto-drum-portal__close")?.addEventListener("click", stop, { once: true });
    portal?.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", stop, { once: true });
  }

  openBrandBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    if (document.querySelector(".auto-drum-portal--bm")) {
      closeAutoDrumSheet(true);
      syncHiddenFromWheels();
      return;
    }
    openSheet();
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      applyListsToWheels([], []);
    });
  });

  form.addEventListener("bymy-saved-search-applied", (event) => {
    const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
    const brandsList = Array.isArray(detail.gyartmanyok)
      ? detail.gyartmanyok.map((v) => String(v)).filter(Boolean)
      : parseJsonList(brandsInput.value);
    const modelsList = Array.isArray(detail.modellek)
      ? detail.modellek.map((v) => String(v)).filter(Boolean)
      : parseJsonList(modelsInput.value);
    applyListsToWheels(brandsList, modelsList);
  });

  form.dataset.brandModelPicker = "1";
  applyListsToWheels(parseJsonList(brandsInput.value), parseJsonList(modelsInput.value));
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
