/**
 * Cascading Gyártmány → Modell → Típus (jarmu-katalogus API).
 */

let catalogPromise = null;

export async function fetchJarmuKatalogus({ force = false } = {}) {
  if (!force && catalogPromise) return catalogPromise;
  catalogPromise = fetch(`/api/jarmu-katalogus${force ? "?force=1" : ""}`, { cache: "no-store" })
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      return data;
    })
    .catch((error) => {
      catalogPromise = null;
      throw error;
    });
  return catalogPromise;
}

function fillSelect(select, values, emptyLabel, { preserve = true } = {}) {
  if (!select) return;
  const previous = preserve ? select.value : "";
  select.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = emptyLabel;
  select.appendChild(empty);
  for (const value of values) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
  if (previous && values.includes(previous)) {
    select.value = previous;
  } else {
    select.value = "";
  }
}

function setSelectEnabled(select, enabled) {
  if (!select) return;
  select.disabled = !enabled;
  if (enabled) select.removeAttribute("disabled");
  else select.setAttribute("disabled", "disabled");
}

function resolveBrandKey(tree, brand) {
  if (!brand) return "";
  if (tree[brand]) return brand;
  const upper = brand.toUpperCase();
  if (tree[upper]) return upper;
  const found = Object.keys(tree).find((key) => key.toLowerCase() === brand.toLowerCase());
  return found ?? "";
}

function resolveModelKey(models, model) {
  if (!model || !models) return "";
  if (models[model]) return model;
  const found = Object.keys(models).find((key) => key.toLowerCase() === model.toLowerCase());
  return found ?? "";
}

function listModels(tree, brandKey) {
  if (!brandKey || !tree[brandKey]) return [];
  return Object.keys(tree[brandKey]).sort((a, b) => a.localeCompare(b, "hu"));
}

function listTypes(tree, brandKey, modelKey) {
  if (!brandKey || !modelKey) return [];
  const models = tree[brandKey] ?? {};
  const key = resolveModelKey(models, modelKey);
  if (!key) return [];
  return [...(models[key] ?? [])];
}

/**
 * @param {{
 *   brandSelect: HTMLSelectElement|null,
 *   modelSelect: HTMLSelectElement|null,
 *   typeSelect: HTMLSelectElement|null,
 *   emptyBrand?: string,
 *   emptyModel?: string,
 *   emptyType?: string,
 *   onChange?: () => void,
 * }} options
 */
export async function bindVehicleCatalogSelects(options) {
  const {
    brandSelect,
    modelSelect,
    typeSelect,
    emptyBrand = "Válasszon!",
    emptyModel = "Válasszon!",
    emptyType = "Válasszon!",
    onChange,
  } = options;

  if (!brandSelect) return null;

  let catalog;
  try {
    catalog = await fetchJarmuKatalogus();
  } catch (error) {
    console.warn("Járműkatalógus betöltés sikertelen:", error);
    fillSelect(brandSelect, [], emptyBrand, { preserve: false });
    fillSelect(modelSelect, [], emptyModel, { preserve: false });
    fillSelect(typeSelect, [], emptyType, { preserve: false });
    setSelectEnabled(modelSelect, false);
    setSelectEnabled(typeSelect, false);
    return null;
  }

  if (!catalog.ok) {
    console.warn(catalog.error);
  }

  const tree = catalog.tree ?? {};
  fillSelect(brandSelect, catalog.brands ?? [], emptyBrand);

  function refreshModels({ keepModel = false } = {}) {
    const brandKey = resolveBrandKey(tree, brandSelect.value);
    const prevModel = keepModel ? modelSelect?.value ?? "" : "";
    const models = listModels(tree, brandKey);
    fillSelect(modelSelect, models, emptyModel, { preserve: false });
    setSelectEnabled(modelSelect, Boolean(brandKey));

    if (prevModel) {
      const modelKey = resolveModelKey(tree[brandKey] ?? {}, prevModel);
      if (modelKey) modelSelect.value = modelKey;
    }

    if (modelSelect?.value) {
      refreshTypes();
    } else {
      fillSelect(typeSelect, [], emptyType, { preserve: false });
      setSelectEnabled(typeSelect, false);
    }
  }

  function refreshTypes() {
    const brandKey = resolveBrandKey(tree, brandSelect.value);
    const rawModel = modelSelect?.value ?? "";
    const modelKey = resolveModelKey(tree[brandKey] ?? {}, rawModel);
    const types = listTypes(tree, brandKey, modelKey);

    if (!rawModel) {
      fillSelect(typeSelect, [], emptyType, { preserve: false });
      setSelectEnabled(typeSelect, false);
      return;
    }

    // Előbb engedélyezünk, aztán töltünk (WebKit: disabled select option bug).
    setSelectEnabled(typeSelect, true);

    if (types.length) {
      fillSelect(typeSelect, types, emptyType, { preserve: false });
    } else {
      fillSelect(typeSelect, [], "Nincs típus a listában", { preserve: false });
      console.warn(`[katalogus] Nincs típus: ${brandKey} / ${modelKey || rawModel}`);
    }

    setSelectEnabled(typeSelect, true);
  }

  brandSelect.addEventListener("change", () => {
    refreshModels({ keepModel: false });
    onChange?.();
  });

  const onModelChange = () => {
    refreshTypes();
    onChange?.();
  };
  modelSelect?.addEventListener("change", onModelChange);
  modelSelect?.addEventListener("input", onModelChange);

  typeSelect?.addEventListener("change", () => {
    onChange?.();
  });

  brandSelect.form?.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      fillSelect(brandSelect, catalog.brands ?? [], emptyBrand, { preserve: false });
      refreshModels({ keepModel: false });
      onChange?.();
    });
  });

  if (brandSelect.value) {
    refreshModels({ keepModel: true });
  } else {
    refreshModels({ keepModel: false });
  }

  return {
    catalog,
    async setValues(brand, model, type) {
      const brandKey = resolveBrandKey(tree, brand);
      if (brandKey) {
        brandSelect.value = brandKey;
      } else if (brand) {
        ensureOption(brandSelect, brand);
        brandSelect.value = brand;
      } else {
        brandSelect.value = "";
      }

      refreshModels({ keepModel: false });

      if (model) {
        const modelKey = resolveModelKey(tree[resolveBrandKey(tree, brandSelect.value)] ?? {}, model);
        if (modelKey) {
          modelSelect.value = modelKey;
        } else {
          ensureOption(modelSelect, model);
          modelSelect.value = model;
        }
      }

      refreshTypes();

      if (type) {
        ensureOption(typeSelect, type);
        typeSelect.value = type;
        setSelectEnabled(typeSelect, true);
      }

      onChange?.();
    },
  };
}

function ensureOption(select, value) {
  if (!select || !value) return;
  const exists = [...select.options].some((opt) => opt.value === value);
  if (exists) return;
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = value;
  select.appendChild(opt);
}
