import { initDrumWheel, syncDrumWheelDisplay } from "./immo-drum-picker.js?v=scrollLock4";
import { setWheelValue, readWheel } from "./ingatlan-wheels.js?v=scrollLock4";

const STORAGE_KEY = "bymy-hirdetes-category";
const STORAGE_VERSION = 4;

const VEHICLE_PRESETS = {
  szemelyauto: { vertical: "auto", subtype: "szemelyauto", label: "Személyautó" },
  kisteher: { vertical: "teher", subtype: "kisteher", label: "Kisteher 3,5 t-ig" },
  teherauto: { vertical: "teher", subtype: "teherauto", label: "Teherautó 3,5 t-tól" },
};

const IMMO_TIPUS = [
  { id: "elado", label: "Eladó Ingatlanok", image: "/images/hub-ingatlan-01-hazak.png" },
  { id: "kiado", label: "Kiadó Ingatlanok", image: "/images/hub-ingatlan-02-lakasok.png" },
  { id: "airbnb", label: "Airbnb Ingatlanok", image: "/images/hub-ingatlan-photo.jpg" },
];

/** Wizard „Kategória” kerék — egy választás, kis képekkel. */
const WIZARD_CATEGORY_OPTIONS = [
  {
    id: "szemelyauto",
    label: "Személyautó",
    image: "/images/categories/benzin.png",
    vertical: "auto",
    subtype: "szemelyauto",
  },
  {
    id: "leasing",
    label: "Leasingautó",
    image: "/images/categories/leasing.png",
    vertical: "auto",
    subtype: "leasing",
  },
  {
    id: "berauto",
    label: "Bérautó",
    image: "/images/categories/berelheto.png",
    vertical: "auto",
    subtype: "berauto",
  },
  {
    id: "lakokocsi",
    label: "Bérelhető Lakókocsi",
    image: "/images/categories/lakokocsi.png",
    vertical: "auto",
    subtype: "lakokocsi",
  },
  {
    id: "kisteher",
    label: "Kisteherautó",
    image: "/images/categories/kisteher.png",
    vertical: "teher",
    subtype: "kisteher",
  },
  {
    id: "teherauto",
    label: "Teherautó",
    image: "/images/categories/teherauto.png",
    vertical: "teher",
    subtype: "teherauto",
  },
  {
    id: "elado",
    label: "Eladó Ingatlanok",
    image: "/images/hub-ingatlan-01-hazak.png",
    vertical: "ingatlan",
    subtype: "ingatlan",
    immoTipus: ["elado"],
  },
  {
    id: "kiado",
    label: "Kiadó Ingatlanok",
    image: "/images/hub-ingatlan-02-lakasok.png",
    vertical: "ingatlan",
    subtype: "ingatlan",
    immoTipus: ["kiado"],
  },
  {
    id: "airbnb",
    label: "Airbnb Ingatlanok",
    image: "/images/hub-ingatlan-photo.jpg",
    vertical: "ingatlan",
    subtype: "ingatlan",
    immoTipus: ["airbnb"],
  },
];

const IMMO_KATEGORIA = [
  { id: "csaladi-haz", label: "Családi házak" },
  { id: "tarsashazi", label: "Társasházi lakások" },
  { id: "sorhaz", label: "Sorházak" },
  { id: "garazs", label: "Garázsok" },
  { id: "ipari", label: "Ipari ingatlanok" },
  { id: "telek", label: "Telkek" },
  { id: "nyaralo", label: "Nyaralók" },
  { id: "mezogazdasagi", label: "Mezőgazdasági ingatlanok" },
];

function labelList(ids, catalog) {
  if (!ids?.length) return "Mindegy";
  return ids
    .map((id) => catalog.find((x) => x.id === id)?.label)
    .filter(Boolean)
    .join(", ");
}

function readStored() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || raw.v !== STORAGE_VERSION) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeStored(value) {
  if (!value) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...value, v: STORAGE_VERSION }));
}

function selectionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const vertical = String(params.get("vertical") ?? "").trim().toLowerCase();
  const subtype = String(params.get("subtype") ?? "").trim().toLowerCase();
  if (vertical === "auto" && subtype === "szemelyauto") return { ...VEHICLE_PRESETS.szemelyauto };
  if (vertical === "teher" && subtype === "kisteher") return { ...VEHICLE_PRESETS.kisteher };
  if (vertical === "teher" && subtype === "teherauto") return { ...VEHICLE_PRESETS.teherauto };
  if (vertical === "ingatlan") {
    const tipus = String(params.get("tipus") ?? "").trim().toLowerCase();
    const hit = IMMO_TIPUS.find((x) => x.id === tipus);
    return {
      vertical: "ingatlan",
      subtype: "ingatlan",
      label: hit ? hit.label : "Ingatlan",
      immoTipus: hit ? [hit.id] : [],
      immoKategoria: [],
    };
  }
  const kategoria = String(params.get("kategoria") ?? "").trim().toLowerCase();
  if (vertical === "teher" && kategoria === "35-alatt") return { ...VEHICLE_PRESETS.kisteher };
  if (vertical === "teher" && kategoria === "35-felett") return { ...VEHICLE_PRESETS.teherauto };
  return null;
}

function selectionFromOption(opt) {
  if (!opt) return null;
  if (opt.vertical === "ingatlan") {
    return {
      vertical: "ingatlan",
      subtype: "ingatlan",
      label: opt.label,
      immoTipus: [...(opt.immoTipus || [opt.id])],
      immoKategoria: [],
    };
  }
  return {
    vertical: opt.vertical,
    subtype: opt.subtype,
    label: opt.label,
  };
}

function currentWizardCategoryId(selection = readStored()) {
  if (!selection) return "";
  if (selection.vertical === "ingatlan") {
    return String(selection.immoTipus?.[0] || "").trim();
  }
  return String(selection.subtype || "").trim();
}

function syncWizardContext(selection) {
  const contextBar = document.getElementById("wizard-context-bar");
  const wheel = document.getElementById("wizard-category-wheel");
  if (!selection?.label) {
    contextBar?.setAttribute("hidden", "");
    return;
  }
  contextBar?.removeAttribute("hidden");
  const catId = currentWizardCategoryId(selection);
  if (wheel?.dataset.drumBound === "1" && catId) {
    setWheelValue(wheel, catId);
    syncDrumWheelDisplay(wheel);
  }
}

export function initCategoryPicker({
  onVehicleSelected,
  onIngatlanSelected,
  onReset,
  requireLogin,
} = {}) {
  const root = document.getElementById("category-picker");
  if (!root) return null;

  const pickerShell = document.getElementById("category-picker-shell");
  const wizardShell = document.getElementById("ad-wizard-shell");
  const stepsBar = document.getElementById("wizard-steps-bar");
  const contextBar = document.getElementById("wizard-context-bar");
  const stub = document.getElementById("ingatlan-stub");
  const stubSummary = document.getElementById("ingatlan-stub-summary");
  const stubBack = document.getElementById("ingatlan-stub-back");

  const state = {
    open: "auto",
    immoTipus: [],
    immoKategoria: [],
    sheet: null,
  };

  const stored = readStored();
  if (stored?.immoTipus) state.immoTipus = stored.immoTipus;
  if (stored?.immoKategoria) state.immoKategoria = stored.immoKategoria;

  const backdrop = document.createElement("div");
  backdrop.className = "cp-sheet-backdrop";
  backdrop.hidden = true;

  const sheet = document.createElement("div");
  sheet.className = "cp-sheet";
  sheet.hidden = true;
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.innerHTML = `
    <div class="cp-sheet-bar">
      <button type="button" data-sheet-back>Vissza</button>
      <h2 data-sheet-title>Típus</h2>
      <button type="button" data-sheet-done>Kész</button>
    </div>
    <div class="cp-sheet-body">
      <p class="cp-sheet-label" data-sheet-section>TÍPUS</p>
      <button type="button" class="cp-sheet-clear" data-sheet-clear>Összes kikapcsolása</button>
      <div class="cp-toggle-list" data-sheet-list></div>
    </div>
  `;
  document.body.append(backdrop, sheet);

  function ensureCategoryDrum() {
    const wrap = document.getElementById("wizard-category-wheel-wrap");
    const wheel = document.getElementById("wizard-category-wheel");
    if (!wrap || !wheel) return null;
    if (wheel.dataset.drumBound === "1") return wheel;
    wheel.innerHTML = WIZARD_CATEGORY_OPTIONS.map(
      (opt) =>
        `<button type="button" class="immo-wheel-opt" data-value="${opt.id}" data-image="${opt.image}?v=immoCat4">${opt.label}</button>`
    ).join("");
    initDrumWheel(wheel, { emptyLabel: "Válassz kategóriát" });
    wheel.addEventListener("immo-wheel-change", () => {
      const id = readWheel(wheel);
      if (!id || id === currentWizardCategoryId()) return;
      void applyCatWheelChoice(id);
    });
    return wheel;
  }

  async function applyCatWheelChoice(catId) {
    const opt = WIZARD_CATEGORY_OPTIONS.find((x) => x.id === catId);
    const selection = selectionFromOption(opt);
    if (!selection) return;
    await showVehicleWizard(selection);
  }

  function syncOpenGroups() {
    root.querySelectorAll(".cp-group").forEach((group) => {
      const id = group.getAttribute("data-group");
      const open = state.open === id;
      group.classList.toggle("is-open", open);
      const toggle = group.querySelector("[data-toggle-group]");
      if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function syncImmoLabels() {
    const tipusEl = root.querySelector("[data-immo-tipus-label]");
    const katEl = root.querySelector("[data-immo-kat-label]");
    if (tipusEl) tipusEl.textContent = labelList(state.immoTipus, IMMO_TIPUS);
    if (katEl) katEl.textContent = labelList(state.immoKategoria, IMMO_KATEGORIA);
  }

  function setHiddenFields(selection) {
    const map = {
      hirdetes_vertical: selection?.vertical || "",
      hirdetes_alkategoria: selection?.subtype || "",
      jarmu_kategoria: selection?.subtype || "",
      ingatlan_tipus: (selection?.immoTipus || []).join(","),
      ingatlan_kategoria: (selection?.immoKategoria || []).join(","),
    };
    for (const [id, value] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.value = value;
    }
  }

  function showPicker() {
    pickerShell?.removeAttribute("hidden");
    wizardShell?.setAttribute("hidden", "");
    stepsBar?.setAttribute("hidden", "");
    contextBar?.setAttribute("hidden", "");
    stub?.setAttribute("hidden", "");
    writeStored(null);
    setHiddenFields(null);
    onReset?.();
  }

  async function showVehicleWizard(selection) {
    writeStored(selection);
    setHiddenFields(selection);
    ensureCategoryDrum();
    syncWizardContext(selection);

    if (typeof requireLogin === "function") {
      const ok = await requireLogin(selection);
      if (!ok) return;
    }

    pickerShell?.setAttribute("hidden", "");
    stub?.setAttribute("hidden", "");
    wizardShell?.removeAttribute("hidden");
    stepsBar?.removeAttribute("hidden");
    onVehicleSelected?.(selection);
  }

  function showIngatlanStub(selection) {
    writeStored(selection);
    setHiddenFields(selection);
    pickerShell?.setAttribute("hidden", "");
    wizardShell?.setAttribute("hidden", "");
    stepsBar?.setAttribute("hidden", "");
    contextBar?.setAttribute("hidden", "");
    if (stub && stubSummary) {
      stub.removeAttribute("hidden");
      const tipus = labelList(selection.immoTipus, IMMO_TIPUS);
      const kat = labelList(selection.immoKategoria, IMMO_KATEGORIA);
      stubSummary.textContent = `Típus: ${tipus}. Kategória: ${kat}. Az ingatlan űrlap hamarosan érkezik — a választásod elmentve.`;
    }
    onIngatlanSelected?.(selection);
  }

  function closeSheet() {
    state.sheet = null;
    sheet.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    document.body.classList.remove("cp-sheet-open");
    window.setTimeout(() => {
      sheet.hidden = true;
      backdrop.hidden = true;
    }, 200);
  }

  function openSheet(kind) {
    state.sheet = kind;
    const catalog = kind === "tipus" ? IMMO_TIPUS : IMMO_KATEGORIA;
    const selected = kind === "tipus" ? state.immoTipus : state.immoKategoria;
    sheet.querySelector("[data-sheet-title]").textContent =
      kind === "tipus" ? "Típus" : "Kategória";
    sheet.querySelector("[data-sheet-section]").textContent =
      kind === "tipus" ? "TÍPUS" : "KATEGÓRIA";
    const list = sheet.querySelector("[data-sheet-list]");
    list.innerHTML = catalog
      .map(
        (item) => `
      <label class="cp-toggle-row">
        <span>${item.label}</span>
        <span class="cp-switch">
          <input type="checkbox" value="${item.id}" ${selected.includes(item.id) ? "checked" : ""} />
          <span></span>
        </span>
      </label>`
      )
      .join("");
    sheet.hidden = false;
    backdrop.hidden = false;
    requestAnimationFrame(() => {
      sheet.classList.add("is-open");
      backdrop.classList.add("is-open");
      document.body.classList.add("cp-sheet-open");
    });
  }

  function applySheet() {
    if (!state.sheet) return;
    const checked = [...sheet.querySelectorAll('input[type="checkbox"]:checked')].map(
      (el) => el.value
    );
    if (state.sheet === "tipus") state.immoTipus = checked;
    else state.immoKategoria = checked;
    syncImmoLabels();
    closeSheet();
  }

  root.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-toggle-group]");
    if (toggle) {
      const id = toggle.getAttribute("data-toggle-group");
      state.open = state.open === id ? null : id;
      syncOpenGroups();
      return;
    }

    const pick = event.target.closest("[data-pick]");
    if (pick && !pick.disabled) {
      root.querySelectorAll(".cp-option.is-active").forEach((el) => el.classList.remove("is-active"));
      pick.classList.add("is-active");
      let payload;
      try {
        payload = JSON.parse(pick.getAttribute("data-pick"));
      } catch {
        return;
      }
      void showVehicleWizard(payload);
      return;
    }

    const openSheetBtn = event.target.closest("[data-open-sheet]");
    if (openSheetBtn) {
      openSheet(openSheetBtn.getAttribute("data-open-sheet"));
      return;
    }

    const immoPick = event.target.closest("[data-pick-immo]");
    if (immoPick) {
      const tipusId = String(immoPick.getAttribute("data-pick-immo") || "").trim().toLowerCase();
      const hit = IMMO_TIPUS.find((x) => x.id === tipusId);
      if (!hit) return;
      root.querySelectorAll(".cp-option.is-active").forEach((el) => el.classList.remove("is-active"));
      immoPick.classList.add("is-active");
      void showVehicleWizard({
        vertical: "ingatlan",
        subtype: "ingatlan",
        label: hit.label,
        immoTipus: [hit.id],
        immoKategoria: [],
      });
      return;
    }

    if (event.target.closest("[data-immo-continue]")) {
      void showVehicleWizard({
        vertical: "ingatlan",
        subtype: "ingatlan",
        label: "Ingatlan",
        immoTipus: [...state.immoTipus],
        immoKategoria: [...state.immoKategoria],
      });
    }
  });

  sheet.querySelector("[data-sheet-back]").addEventListener("click", closeSheet);
  sheet.querySelector("[data-sheet-done]").addEventListener("click", applySheet);
  sheet.querySelector("[data-sheet-clear]").addEventListener("click", () => {
    sheet.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      el.checked = false;
    });
  });
  backdrop.addEventListener("click", closeSheet);

  stubBack?.addEventListener("click", () => {
    showPicker();
    state.open = "ingatlan";
    syncOpenGroups();
  });

  ensureCategoryDrum();
  syncOpenGroups();
  syncImmoLabels();

  const params = new URLSearchParams(window.location.search);
  const urlSelection = selectionFromUrl();
  const shouldContinue =
    params.get("continue") === "1" &&
    (stored?.vertical === "auto" || stored?.vertical === "teher" || stored?.vertical === "ingatlan");
  const shouldStart = params.get("start") === "1" && urlSelection;

  if (shouldStart) {
    void showVehicleWizard(urlSelection);
  } else if (shouldContinue) {
    void showVehicleWizard(stored);
  } else {
    if (urlSelection?.vertical === "teher") {
      state.open = "teher";
      syncOpenGroups();
    } else if (urlSelection?.vertical === "auto") {
      state.open = "auto";
      syncOpenGroups();
    } else if (urlSelection?.vertical === "ingatlan") {
      state.open = "ingatlan";
      syncOpenGroups();
    }
    showPicker();
  }

  return {
    reset: showPicker,
    getSelection: () => readStored(),
    syncWizardContext,
  };
}
