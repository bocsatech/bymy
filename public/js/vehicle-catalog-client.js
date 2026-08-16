/** Járműkatalógus (lista.csv): gyártmány → modell → évjárat → típus. */

let catalogPromise = null;
/** Teljes katalógus a statikus fallbackból (tipusok is) — API nélkül is megy. */
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
    staticCatalogPromise = fetch("/data/vehicle-catalog.json", { cache: "no-store" })
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
    catalogPromise = fetch("/api/vehicle-catalog")
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
    return { nev: entry.nev, evTol: entry.evTol ?? null, evIg: entry.evIg ?? null };
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

/** Egy modell évjáratai + típusai. Év szűrés a kliensen, hogy ne kelljen újra kérni. */
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

/** "500 1.4 [3 ajtós, 135 LE, …]" → "500 1.4" */
export function shortTypeName(value) {
  const text = String(value ?? "").trim();
  const cut = text.split("[")[0].trim();
  return cut || text;
}

/**
 * A katalógus típusneve gyakran a modellel kezdődik ("500 Coupe 1.4 TJet 140"),
 * a Típus mezőbe viszont a modell nélküli rész való, különben a hirdetés címe
 * "ABARTH 500 500 Coupe 1.4 TJet 140" lenne.
 */
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

  // Hiányos katalógusnál ne maradjon üres a lista.
  return matching.length ? matching : tipusok;
}

/**
 * Összeköti a legördülőket. A yearSelect kétféle lehet:
 *  - yearFromCatalog: true  → az évek a katalógusból töltődnek (kereső)
 *  - yearFromCatalog: false → meglévő évlista marad (hirdetésfeladás gyártási éve)
 */
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
