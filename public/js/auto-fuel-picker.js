import { openStandaloneSwitchSheet, closeAutoDrumSheet } from "./auto-drum-sheet.js?v=711df91eaf";

const FUEL_OPTIONS = [
  { value: "Benzin", label: "Benzin" },
  { value: "Dízel", label: "Dízel" },
  { value: "Benzin/Gáz", label: "Benzin/Gáz" },
  { value: "Dízel/Gáz", label: "Dízel/Gáz" },
  { value: "Hibrid", label: "Hibrid" },
  { value: "Elektromos", label: "Elektromos" },
  { value: "Etanol", label: "Etanol" },
  { value: "Biodízel", label: "Biodízel" },
  { value: "Gáz", label: "Gáz" },
];

const EMPTY_LABEL = "Mindegy";
const SUMMARY_EMPTY = "Mindegy";

function labelList(items) {
  if (!items.length) return SUMMARY_EMPTY;
  if (items.length === 1) return items[0];
  if (items.length <= 3) return items.join(", ");
  return `${items.length} üzemanyag`;
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

export async function mountAutoFuelPicker(form) {
  if (!form || !isAutoDesk()) return;

  if (form.dataset.fuelPicker === "1") {
    form.querySelectorAll(".auto-fuel-field, .auto-fuel-panel").forEach((el) => el.remove());
    document.querySelectorAll(".auto-fuel-panel").forEach((el) => el.remove());
    delete form.dataset.fuelPicker;
  }

  const alapHost = form.querySelector(".auto-desk-fields[data-desk-alap]");
  if (!alapHost) return;

  const fuelField = alapHost.querySelector('[data-desk-field="uzemanyag"]');
  if (fuelField) fuelField.remove();
  form.querySelectorAll(".auto-fuel-panel").forEach((el) => el.remove());

  const fuelsInput = document.createElement("input");
  fuelsInput.type = "hidden";
  fuelsInput.dataset.filterKey = "uzemanyagok";
  fuelsInput.setAttribute("data-filter-key", "uzemanyagok");

  const wrap = document.createElement("div");
  wrap.className = "auto-desk-field auto-fuel-field";
  wrap.dataset.deskField = "uzemanyag";
  wrap.dataset.deskQuick = "1";
  wrap.innerHTML = `
    <span class="auto-desk-field__label">Üzemanyag</span>
    <button type="button" class="auto-bm-trigger" data-auto-fuel-open aria-label="Üzemanyag">
      <span data-auto-fuel-summary>${SUMMARY_EMPTY}</span>
    </button>
  `;
  wrap.appendChild(fuelsInput);

  const bmPair = alapHost.querySelector(".auto-bm-pair, .auto-bm-brand-block");
  if (bmPair?.nextSibling) alapHost.insertBefore(wrap, bmPair.nextSibling);
  else if (bmPair) alapHost.appendChild(wrap);
  else alapHost.insertBefore(wrap, alapHost.firstChild);

  const summaryEl = wrap.querySelector("[data-auto-fuel-summary]");
  const openBtn = wrap.querySelector("[data-auto-fuel-open]");

  function syncSummary(list) {
    if (!summaryEl) return;
    const text = labelList(list);
    summaryEl.textContent = text;
    summaryEl.classList.toggle("is-placeholder", !list.length);
    openBtn?.classList.toggle("has-value", Boolean(list.length));
  }

  function applyList(list) {
    const clean = [...new Set((list || []).map((v) => String(v).trim()).filter(Boolean))];
    writeJsonList(fuelsInput, clean);
    syncSummary(clean);
  }

  function openSheet() {
    if (document.querySelector(".auto-drum-portal--sheet")) {
      closeAutoDrumSheet(true);
      return;
    }
    openStandaloneSwitchSheet({
      trigger: openBtn,
      title: "Üzemanyag",
      emptyLabel: EMPTY_LABEL,
      items: FUEL_OPTIONS,
      initialSelected: parseJsonList(fuelsInput.value),
      singleSelect: false,
      onDone: (selected) => {
        applyList(selected || []);
      },
    });
  }

  openBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    openSheet();
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => applyList([]));
  });

  form.addEventListener("bymy-saved-search-applied", (event) => {
    const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
    const list = Array.isArray(detail.uzemanyagok)
      ? detail.uzemanyagok.map((v) => String(v)).filter(Boolean)
      : parseJsonList(fuelsInput.value);
    applyList(list);
  });

  form.dataset.fuelPicker = "1";
  syncSummary(parseJsonList(fuelsInput.value));
}

export function readFuelFilterValues(form) {
  if (!form) return {};
  const el = form.querySelector('[data-filter-key="uzemanyagok"]');
  if (!el) return {};
  const uzemanyagok = parseJsonList(el.value);
  return uzemanyagok.length ? { uzemanyagok } : {};
}

export function fuelValueMatches(listingFuel, selectedValues) {
  if (!selectedValues?.length) return true;
  const got = normalizeFuel(listingFuel);
  if (!got) return false;
  return selectedValues.some((raw) => fuelsCompatible(got, normalizeFuel(raw)));
}

function normalizeFuel(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hibrid család — sima benzin/dízel NEM tartozik ide. */
const HYBRID_FUELS = new Set([
  "hibrid",
  "hybrid",
  "hibrid (benzin)",
  "hibrid (dizel)",
  "benzin/elektromos",
  "dizel/elektromos",
]);

function isHybridFuel(normalized) {
  if (!normalized) return false;
  if (HYBRID_FUELS.has(normalized)) return true;
  if (normalized === "elektromos" || normalized.startsWith("hidrogen")) return false;
  return /elektromos/.test(normalized) || /\bhibrid\b|\bhybrid\b/.test(normalized);
}

/**
 * Pontos / alias egyezés — NINCS laza substring
 * (különben „benzin” átmenne a „benzin/elektromos” szűrőn).
 */
function fuelsCompatible(got, want) {
  if (!want) return true;
  if (got === want) return true;

  if ((got === "dizel" || got === "diesel") && (want === "dizel" || want === "diesel")) {
    return true;
  }

  const aliases = {
    hibrid: [...HYBRID_FUELS],
    hybrid: [...HYBRID_FUELS],
    "hibrid (benzin)": ["hibrid (benzin)", "benzin/elektromos", "hibrid", "hybrid"],
    "hibrid (dizel)": ["hibrid (dizel)", "dizel/elektromos", "hibrid", "hybrid"],
    "benzin/elektromos": ["benzin/elektromos", "hibrid (benzin)", "hibrid", "hybrid"],
    "dizel/elektromos": ["dizel/elektromos", "hibrid (dizel)", "hibrid", "hybrid"],
    lpg: ["lpg", "lpg/benzin", "benzin/gaz"],
    cng: ["cng", "cng/benzin", "benzin/gaz"],
    "benzin/gaz": ["benzin/gaz", "lpg", "cng", "lpg/benzin", "cng/benzin"],
    "lpg/dizel": ["lpg/dizel", "dizel/gaz"],
    "cng/dizel": ["cng/dizel", "dizel/gaz"],
    dizel: ["dizel", "diesel"],
    diesel: ["dizel", "diesel"],
  };

  if (want === "hibrid" || want === "hybrid" || HYBRID_FUELS.has(want)) {
    return isHybridFuel(got);
  }

  const list = aliases[want] || [want];
  return list.some((a) => got === a);
}
