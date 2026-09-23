
let catalogPromise = null;
let staticCatalogPromise = null;
const typeCache = new Map();

const OLD_SERVER_HINT =
  "Régi Bymy szerver — állítsd le (Ctrl+C), futtasd: bymy/mac/frissites.command, majd indítsd újra.";

function catalogErrorMessage(data, status) {
  if (status === 404 && data?.error === "Ismeretlen API.") return OLD_SERVER_HINT;
  return data?.error ?? "Katalógus betöltése sikertelen.";
}

async function fetchStaticCatalog() {
  if (!staticCatalogPromise) {
    staticCatalogPromise = fetch("/data/vehicle-catalog.json", { cache: "force-cache" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.gyartmanyok?.length) {
          throw new Error(data.error ?? "Statikus járműkatalógus nem elérhető.");
        }
        return data;
      })
      .catch((error) => {
        staticCatalogPromise = null;
        throw error;
      });
  }
  return staticCatalogPromise;
}

function summaryFromCatalog(catalog) {
  return {
    source: catalog.source ?? null,
    imported_at: catalog.imported_at ?? null,
    count_rows: catalog.count_rows ?? 0,
    gyartmanyok: catalog.gyartmanyok ?? [],
    modellek: catalog.modellek ?? {},
  };
}

export async function fetchVehicleCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch("/api/vehicle-catalog", { credentials: "same-origin" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(catalogErrorMessage(data, response.status));
        return data;
      })
      .catch(async (apiError) => {
        try {
          const full = await fetchStaticCatalog();
          console.warn("Járműkatalógus API hiba, statikus fallback:", apiError.message);
          return summaryFromCatalog(full);
        } catch {
          catalogPromise = null;
          throw apiError;
        }
      });
  }
  return catalogPromise;
}

function typesFromStaticCatalog(catalog, gyartmany, modell) {
  const key = `${String(gyartmany ?? "").trim().toUpperCase()}|${String(modell ?? "").trim()}`;
  const altKey = `${String(gyartmany ?? "").trim()}|${String(modell ?? "").trim()}`;
  const entries = catalog?.tipusok?.[key] ?? catalog?.tipusok?.[altKey] ?? [];
  return entries.map((entry) => {
    if (typeof entry === "string") return { nev: entry, evTol: null, evIg: null };
    return {
      nev: entry.nev,
      evTol: entry.evTol ?? null,
      evIg: entry.evIg ?? null,
      ajtok: Array.isArray(entry.ajtok) ? entry.ajtok : [],
      uzemanyag: Array.isArray(entry.uzemanyag) ? entry.uzemanyag : [],
    };
  }).filter((entry) => entry.nev);

}

function yearsFromTypes(tipusok) {
  const years = new Set();
  for (const entry of tipusok) {
    const from = entry.evTol ?? entry.evIg;
    const to = entry.evIg ?? entry.evTol;
    if (from == null || to == null) continue;
    for (let year = Math.min(from, to); year <= Math.max(from, to); year += 1) {
      years.add(year);
    }
  }
  return [...years].sort((a, b) => b - a);
}

export async function fetchModelTypes(gyartmany, modell) {
  const key = `${gyartmany}|${modell}`;
  if (typeCache.has(key)) return typeCache.get(key);

  const query = new URLSearchParams({ gyartmany, modell });
  const promise = fetch(`/api/vehicle-catalog/tipusok?${query}`)
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(catalogErrorMessage(data, response.status));
      return { evek: data.evek ?? [], tipusok: data.tipusok ?? [] };
    })
    .catch(async (apiError) => {
      try {
        const catalog = await fetchStaticCatalog();
        const tipusok = typesFromStaticCatalog(catalog, gyartmany, modell);
        return { evek: yearsFromTypes(tipusok), tipusok };
      } catch {
        typeCache.delete(key);
        throw apiError;
      }
    });

  typeCache.set(key, promise);
  return promise;
}

export function fillSelect(select, values, emptyLabel = "Mindegy") {
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${emptyLabel}</option>`;
  for (const value of values ?? []) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
  if (current && values?.includes(current)) select.value = current;
}

export function ensureSelectOption(select, value) {
  if (!select || value == null) return;
  const applied = String(Array.isArray(value) ? value[0] : value).trim();
  if (!applied) return;
  const has = [...select.options].some(
    (option) => option.value === applied || option.textContent === applied
  );
  if (!has) {
    const option = document.createElement("option");
    option.value = applied;
    option.textContent = applied;
    select.appendChild(option);
  }
  select.value = applied;
}

export function matchCatalogBrand(catalog, raw) {
  const v = String(raw ?? "").trim();
  if (!v || !catalog?.gyartmanyok?.length) return "";
  const upper = v.toLocaleUpperCase("hu-HU").replace(/\s+/g, " ");
  for (const brand of catalog.gyartmanyok) {
    if (String(brand).toLocaleUpperCase("hu-HU") === upper) return brand;
  }
  if (/^MERCEDES[\s-]?BENZ$/i.test(upper) || upper === "MERCEDES") {
    return catalog.gyartmanyok.find((b) => b === "MERCEDES-BENZ") || "MERCEDES-BENZ";
  }
  if (upper === "VW") return catalog.gyartmanyok.find((b) => b === "VOLKSWAGEN") || "VOLKSWAGEN";
  return upper;
}

function guessCatalogModel(models, modell, tipus) {
  const m = String(modell ?? "").trim();
  const t = String(tipus ?? "").trim();
  if (!m) return "";
  const list = Array.isArray(models) ? models : [];
  if (list.includes(m)) return m;
  const firstTip = t.split(/\s+/).find(Boolean) || "";
  if (firstTip) {
    const combo = `${m} ${firstTip}`;
    if (list.includes(combo)) return combo;
    const prefixHit = list.find((name) => name.toUpperCase().startsWith(`${combo.toUpperCase()}`));
    if (prefixHit) return prefixHit;
  }
  const loose = list.find(
    (name) =>
      name.toUpperCase() === m.toUpperCase() ||
      name.toUpperCase().startsWith(`${m.toUpperCase()} `)
  );
  return loose || m;
}

function guessCatalogTipus(tipusok, tipusRaw, modell) {
  const raw = String(tipusRaw ?? "").trim();
  if (!raw) return "";
  const names = (tipusok ?? [])
    .map((entry) => (typeof entry === "string" ? entry : entry?.nev))
    .filter(Boolean);
  if (names.includes(raw)) return raw;
  const field = typeNameForField(raw, modell);
  if (names.includes(field)) return field;
  const lower = raw.toLowerCase();
  const hit = names.find((name) => {
    const short = shortTypeName(name).toLowerCase();
    return short.includes(lower) || lower.includes(short);
  });
  return hit || raw;
}

/** Import / szerkesztés: gyártmány–modell–típus megmarad a katalógus-selectekben. */
export async function applyImportedVehicleToSelects({
  brandSelect,
  modelSelect,
  tipusSelect = null,
  egyebTipusInput = null,
  catalog,
  formData,
}) {
  if (!brandSelect || !modelSelect || !catalog || !formData) return;

  const brand = matchCatalogBrand(catalog, formData.gyartmany);
  if (!brand) return;

  brandSelect.value = brand;
  const models = catalog.modellek?.[brand] ?? [];
  fillSelect(modelSelect, models, "Válasszon");

  const model = guessCatalogModel(models, formData.modell, formData.tipus);
  ensureSelectOption(modelSelect, model);

  let typeList = [];
  if (modelSelect.value) {
    try {
      const data = await fetchModelTypes(brand, modelSelect.value);
      typeList = data.tipusok ?? [];
    } catch (error) {
      console.error("Import típusok betöltése:", error);
    }
  }

  if (tipusSelect) {
    fillSelect(
      tipusSelect,
      typeList.map((entry) => entry.nev),
      "Válasszon"
    );
    const tipus = guessCatalogTipus(typeList, formData.tipus, modelSelect.value);
    ensureSelectOption(tipusSelect, tipus);
    if (!tipusSelect.value && formData.tipus && egyebTipusInput) {
      egyebTipusInput.value = formData.tipus;
    }
  }
}

export function shortTypeName(value) {
  const text = String(value ?? "").trim();
  const cut = text.split("[")[0].trim();
  return cut || text;
}

export function typeNameForField(tipusNev, modell) {
  const short = shortTypeName(tipusNev);
  const model = String(modell ?? "").trim();
  if (!model) return short;

  const prefix = `${model.toLowerCase()} `;
  if (short.toLowerCase().startsWith(prefix)) {
    return short.slice(model.length).trim() || short;
  }
  return short;
}

export function typesForYear(tipusok, year) {
  const y = Number(year);
  if (!Number.isFinite(y) || y <= 0) return tipusok;

  const matching = tipusok.filter((entry) => {
    if (entry.evTol == null && entry.evIg == null) return true;
    const from = entry.evTol ?? entry.evIg;
    const to = entry.evIg ?? entry.evTol;
    return y >= from && y <= to;
  });

  return matching.length ? matching : tipusok;
}

export function bindCatalogSelects({
  brandSelect,
  modelSelect,
  yearSelect = null,
  tipusSelect = null,
  catalog,
  yearFromCatalog = false,
  brandEmptyLabel = "Válasszon",
  modelEmptyLabel = "Válasszon",
  yearEmptyLabel = "Mindegy",
  tipusEmptyLabel = "Válasszon",
  onTypeDataChange = () => {},
  onChange = () => {},
}) {
  if (!brandSelect || !modelSelect || !catalog) return;

  let currentTypes = [];

  fillSelect(brandSelect, catalog.gyartmanyok, brandEmptyLabel);

  function refreshTipusok() {
    if (!tipusSelect) return;
    const types = typesForYear(currentTypes, yearSelect?.value);
    fillSelect(
      tipusSelect,
      types.map((entry) => entry.nev),
      tipusEmptyLabel
    );
    onTypeDataChange(types.find((entry) => entry.nev === tipusSelect.value) || null, types);
  }

  async function loadTypes() {
    currentTypes = [];
    const brand = brandSelect.value;
    const model = modelSelect.value;

    if (!brand || !model) {
      if (yearFromCatalog && yearSelect) fillSelect(yearSelect, [], yearEmptyLabel);
      refreshTipusok();
      return;
    }

    try {
      const data = await fetchModelTypes(brand, model);
      currentTypes = data.tipusok;
      if (yearFromCatalog && yearSelect) {
        fillSelect(yearSelect, data.evek.map(String), yearEmptyLabel);
      }
    } catch (error) {
      console.error("Típusok betöltése:", error);
    }
    refreshTipusok();
  }

  function refreshModels() {
    const brand = brandSelect.value;
    const models = brand ? catalog.modellek[brand] ?? [] : [];
    fillSelect(modelSelect, models, modelEmptyLabel);
  }

  brandSelect.addEventListener("change", async () => {
    refreshModels();
    await loadTypes();
    onChange();
  });

  modelSelect.addEventListener("change", async () => {
    await loadTypes();
    onChange();
  });

  tipusSelect?.addEventListener("change", () => {
    const types = typesForYear(currentTypes, yearSelect?.value);
    onTypeDataChange(types.find((entry) => entry.nev === tipusSelect.value) || null, types);
    onChange();
  });

  yearSelect?.addEventListener("change", () => {
    refreshTipusok();
    onChange();
  });

  refreshModels();
  loadTypes();
}

export async function initVehicleCatalogSelects(options) {
  const catalog = await fetchVehicleCatalog();
  bindCatalogSelects({ ...options, catalog });
  return catalog;
}
