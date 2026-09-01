import { UZEMANYAG_CATEGORIES, ALLAPOT_CATEGORIES, EQUIPMENT_SECTIONS, KLIM_OPTIONS, KISTEHER_EQUIPMENT_ITEMS, TEHER_KISTEHER_KIVITEL, TEHER_35_KIVITEL_CATEGORIES } from "./equipment-data.js?v=teherKivitel35e";
import { KIVITEL_OPTIONS } from "./kivitel-options.js?v=kivitel1";
import { EGYEB_INFO_OPTIONS } from "./egyeb-info-data.js";
import { initVehicleCatalogSelects } from "./vehicle-catalog-client.js";
import { compressListingPhoto, MAX_LISTING_PHOTOS } from "./listing-photo-compress.js?v=myAds2";
import { uploadImage } from "./upload-image.js?v=supabaseUpload1";
import { applyListingAddressFromProfileSync } from "./ad-location-profile.js?v=locProf3";
import { syncIngatlanFormVisibility } from "./ingatlan-form-fields.js?v=immoTelekArea1";
import {
  DEFAULT_PHOTO_OVERLAY_ID,
  renderListingPhotoOverlay,
} from "./listing-photo-overlay.js?v=photoOverlay1";
import { refreshAdFormBmPickers, applyAdFormBmFieldValues } from "./ad-form-bm-pickers.js?v=adBmPickers20";

export function createAdForm(options = {}) {
  const mode = options.mode ?? "wizard";
  const storageKey = options.storageKey ?? "hirdetes-local-draft";
  const editing = Boolean(options.editing);

  const form = document.getElementById("ad-form");
  if (!form) return null;

  const panels = [...document.querySelectorAll(".step-panel")];
  const indicators = [...document.querySelectorAll("[data-step-indicator]")];
  const backBtn = document.getElementById("back-btn");
  const nextBtn = document.getElementById("next-btn");
  const footerActions = document.getElementById("footer-actions");
  const automaxStepTitle = document.getElementById("automax-step-title");
  const automaxStepLead = document.getElementById("automax-step-lead");
  const uploadZone = document.getElementById("upload-zone");
  const photoInput = document.getElementById("photo-input");
  const photoGrid = document.getElementById("photo-grid");
  const photoUploadBtn = document.getElementById("photo-upload-btn");
  const photoUploadProgress = document.getElementById("photo-upload-progress");
  const photoUploadLabel = document.getElementById("photo-upload-label");
  const photoOverlayApplyBtn = document.getElementById("photo-overlay-apply");
  const photoOverlayClearBtn = document.getElementById("photo-overlay-clear");
  const photoOverlayHint = document.getElementById("photo-overlay-hint");
  const summaryText = document.getElementById("summary-text");
  const newAdBtn = document.getElementById("new-ad-btn");
  const adPanel = document.getElementById("ad-panel");
  const successPanel = document.getElementById("success-panel");

  const TOTAL_STEPS = 5;
  const gyartasiEv = document.getElementById("gyartasi_ev");
  const muszakiEv = document.getElementById("muszaki_ev");
  const forgalombaHelyezesEv = document.getElementById("forgalomba_helyezes_ev");
  const gyartmany = document.getElementById("gyartmany");
  const modell = document.getElementById("modell");
  const tipus = document.getElementById("tipus");
  const hirdetesCime = document.getElementById("hirdetes_cime");
  const teljesitmenyKw = document.getElementById("teljesitmeny_kw");
  const teljesitmenyLe = document.getElementById("teljesitmeny_le");
  const leDisplay = document.getElementById("le-display");
  const klima = document.getElementById("klima");
  const equipmentRoot = document.getElementById("equipment-sections");
  const egyebInfoRoot = document.getElementById("egyeb-info-sections");
  const uzemanyag = document.getElementById("uzemanyag");
  const allapot = document.getElementById("allapot");
  const fuelMain = document.getElementById("fuel-main");
  const fuelSubpanels = document.getElementById("fuel-subpanels");
  const fuelSelected = document.getElementById("fuel-selected");

  const KEEP_ON_RESET = new Set([
    "hirdetes_vertical",
    "hirdetes_alkategoria",
    "jarmu_kategoria",
    "ingatlan_tipus",
    "ingatlan_kategoria",
    "csomag",
  ]);

  let currentStep = 1;
  let userTouchedForm = false;
  let emptyingForm = false;
  let photoItems = [];
  let photoBusy = false;
  let photoSeq = 0;

const AUTO_FILL_PRESETS = {
  TESLA: { tipus: "Long Range AWD", hengerurtartalom: "", uzemanyag: "Elektromos", sebessegvalto: "Automata", hajtas: "Összkerék", teljesitmeny_kw: "258" },
  VOLKSWAGEN: { tipus: "1.6 TDI", hengerurtartalom: "1598", uzemanyag: "Dízel", sebessegvalto: "Manuális (6 seb.)", hajtas: "Első kerék", teljesitmeny_kw: "77" },
  TOYOTA: { tipus: "1.8 Hybrid", hengerurtartalom: "1798", uzemanyag: "Benzin/elektromos", sebessegvalto: "Fokozatmentes automata", hajtas: "Első kerék", teljesitmeny_kw: "72" },
};

const YEAR_SELECT_MIN = 1980;
const YEAR_SELECT_MAX = 2035;

function fillYearSelect(select, { maxYear = new Date().getFullYear(), minYear = YEAR_SELECT_MIN } = {}) {
  if (!select) return;
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "év";
  select.appendChild(empty);
  for (let year = maxYear; year >= minYear; year -= 1) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    select.appendChild(option);
  }
  select.value = "";
}

function normalizeFuelValue(value) {
  const aliases = {
    Diesel: "Dízel",
    "Diesel/elektromos": "Dízel/elektromos",
  };
  return aliases[value] ?? value;
}

function applyCatalogTypeData(entry) {
  const doors = document.getElementById("ajtok");
  const fuel = document.getElementById("uzemanyag");
  if (doors && Array.isArray(entry?.ajtok) && entry.ajtok.length) {
    const current = doors.value;
    const values = [...new Set(entry.ajtok.map((value) => String(value).match(/\d+/)?.[0]).filter(Boolean))];
    doors.innerHTML = '<option value="">—</option>';
    for (const value of values) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      doors.appendChild(option);
    }
    doors.value = values.includes(current) ? current : values.length === 1 ? values[0] : "";
  }
  if (fuel && Array.isArray(entry?.uzemanyag) && entry.uzemanyag.length) {
    const current = fuel.value;
    const values = [...new Set(entry.uzemanyag.map(normalizeFuelValue).filter(Boolean))];
    renderFuelDropdown();
    for (const value of values) {
      if (![...fuel.options].some((option) => option.value === value)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        fuel.appendChild(option);
      }
    }
    fuel.value = values.includes(current) ? current : values.length === 1 ? values[0] : "";
    syncFuelDependentFields();
  }
}

function renderFuelDropdown() {
  if (!uzemanyag || uzemanyag.tagName !== "SELECT") return;

  const current = normalizeFuelValue(uzemanyag.value);
  uzemanyag.innerHTML = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Válasszon!";
  uzemanyag.appendChild(empty);

  for (const category of UZEMANYAG_CATEGORIES) {
    if (category.children?.length) {
      const group = document.createElement("optgroup");
      group.label = category.label;

      for (const child of category.children) {
        const option = document.createElement("option");
        option.value = child.value;
        option.textContent = child.label;
        group.appendChild(option);
      }

      uzemanyag.appendChild(group);
      continue;
    }

    if (!category.value) continue;

    const option = document.createElement("option");
    option.value = category.value;
    option.textContent = category.label;
    uzemanyag.appendChild(option);
  }

  if (current) uzemanyag.value = current;
}

function renderAllapotDropdown() {
  if (!allapot || allapot.tagName !== "SELECT") return;

  const current = String(allapot.value || "").trim();
  allapot.innerHTML = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Válasszon";
  allapot.appendChild(empty);

  for (const category of ALLAPOT_CATEGORIES) {
    if (category.children?.length) {
      const group = document.createElement("optgroup");
      group.label = category.label;
      for (const child of category.children) {
        const option = document.createElement("option");
        option.value = child.value;
        option.textContent = child.label;
        group.appendChild(option);
      }
      allapot.appendChild(group);
      continue;
    }
    if (!category.value) continue;
    const option = document.createElement("option");
    option.value = category.value;
    option.textContent = category.label;
    allapot.appendChild(option);
  }

  if (current) allapot.value = current;
}

function renderFuelSelector() {
  if (!fuelMain || !fuelSubpanels || uzemanyag?.tagName === "SELECT") return;

  fuelMain.innerHTML = "";
  fuelSubpanels.innerHTML = "";

  for (const category of UZEMANYAG_CATEGORIES) {
    const mainBtn = document.createElement("button");
    mainBtn.type = "button";
    mainBtn.className = "fuel-btn";
    mainBtn.dataset.categoryId = category.id;
    mainBtn.textContent = category.label;

    if (category.children) {
      mainBtn.addEventListener("click", () => toggleFuelPanel(category.id));
    } else {
      mainBtn.addEventListener("click", () => selectFuel(category.value, category.id));
    }

    fuelMain.appendChild(mainBtn);

    if (!category.children) continue;

    const panel = document.createElement("div");
    panel.className = "fuel-subpanel";
    panel.dataset.panelFor = category.id;

    for (const child of category.children) {
      const subBtn = document.createElement("button");
      subBtn.type = "button";
      subBtn.className = "fuel-btn";
      subBtn.dataset.parentId = category.id;
      subBtn.dataset.value = child.value;
      subBtn.textContent = child.label;
      subBtn.addEventListener("click", () => selectFuel(child.value, category.id, child.label));
      panel.appendChild(subBtn);
    }

    fuelSubpanels.appendChild(panel);
  }
}

function toggleFuelPanel(categoryId) {
  const targetPanel = document.querySelector(`.fuel-subpanel[data-panel-for="${categoryId}"]`);
  const willOpen = !targetPanel?.classList.contains("open");

  document.querySelectorAll(".fuel-subpanel").forEach((panel) => panel.classList.remove("open"));
  document.querySelectorAll(".fuel-btn[data-category-id]").forEach((btn) => btn.classList.remove("parent-open"));

  if (willOpen && targetPanel) {
    targetPanel.classList.add("open");
    document.querySelector(`.fuel-btn[data-category-id="${categoryId}"]`)?.classList.add("parent-open");
  }
}

function closeFuelPanels() {
  document.querySelectorAll(".fuel-subpanel").forEach((panel) => panel.classList.remove("open"));
  document.querySelectorAll(".fuel-btn.parent-open").forEach((btn) => btn.classList.remove("parent-open"));
}

function syncFuelButtonState(categoryId, subLabel = null) {
  document.querySelectorAll(".fuel-btn").forEach((btn) => btn.classList.remove("active"));

  if (categoryId) {
    const mainBtn = document.querySelector(`.fuel-btn[data-category-id="${categoryId}"]`);
    mainBtn?.classList.add("active");
  }

  if (subLabel) {
    const subBtn = [...document.querySelectorAll(".fuel-btn[data-parent-id]")].find(
      (btn) => btn.dataset.parentId === categoryId && btn.textContent === subLabel
    );
    subBtn?.classList.add("active");
  }
}

function selectFuel(value, categoryId, subLabel = null) {
  if (!uzemanyag) return;
  uzemanyag.value = value;
  uzemanyag.dataset.userEdited = "1";

  if (fuelMain && uzemanyag.tagName !== "SELECT") {
    closeFuelPanels();
    syncFuelButtonState(categoryId, subLabel);

    const category = UZEMANYAG_CATEGORIES.find((item) => item.id === categoryId);
    const display = subLabel ? `${category?.label ?? ""} — ${subLabel}` : value;
    if (fuelSelected) fuelSelected.textContent = `Kiválasztva: ${display}`;
  }

  syncFuelDependentFields();
  saveDraft();
}

function restoreFuelSelection(value) {
  if (!value) return;

  if (uzemanyag?._adBmHidden) {
    applyAdFormBmFieldValues({ uzemanyag: value });
    syncFuelDependentFields();
    return;
  }

  const primary = Array.isArray(value) ? value[0] : value;
  if (!primary) return;

  if (uzemanyag?.tagName === "SELECT") {
    uzemanyag.value = normalizeFuelValue(primary);
    syncFuelDependentFields();
    return;
  }

  for (const category of UZEMANYAG_CATEGORIES) {
    if (category.value === primary) {
      selectFuel(primary, category.id);
      return;
    }
    if (category.children) {
      const child = category.children.find((item) => item.value === primary);
      if (child) {
        selectFuel(primary, category.id, child.label);
        return;
      }
    }
  }

  if (uzemanyag && !uzemanyag.value) {
    uzemanyag.value = primary;
    if (fuelSelected) fuelSelected.textContent = `Kiválasztva: ${primary}`;
    syncFuelDependentFields();
  }
}

function renderKlimaOptions() {
  for (const option of KLIM_OPTIONS) {
    const el = document.createElement("option");
    el.value = option;
    el.textContent = option;
    klima.appendChild(el);
  }
}

function renderEgyebInfo() {
  if (!egyebInfoRoot) return;
  egyebInfoRoot.innerHTML = "";
  for (const item of EGYEB_INFO_OPTIONS) {
    const id = `info_${item.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;
    const label = document.createElement("label");
    label.className = "check";
    label.innerHTML = `<input type="checkbox" name="egyeb_info" value="${item}" id="${id}" /> ${item}`;
    egyebInfoRoot.appendChild(label);
  }
}

function renderEquipment() {
  if (!equipmentRoot) return;
  const checked = new Set(
    [...form.querySelectorAll('input[name="felszereltseg"]:checked')].map((el) => el.value)
  );
  equipmentRoot.innerHTML = "";

  if (isKisteherAd()) {
    const block = document.createElement("div");
    block.className = "equipment-block";
    block.innerHTML = `<h3>Felszereltség</h3>`;
    const grid = document.createElement("div");
    grid.className = "equipment-grid";
    for (const item of KISTEHER_EQUIPMENT_ITEMS) {
      const id = `kisteher_${item.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;
      const label = document.createElement("label");
      label.className = "check";
      label.innerHTML = `<input type="checkbox" name="felszereltseg" value="${item}" id="${id}" ${
        checked.has(item) ? "checked" : ""
      } /> ${item}`;
      grid.appendChild(label);
    }
    block.appendChild(grid);
    equipmentRoot.appendChild(block);
    return;
  }

  for (const [key, section] of Object.entries(EQUIPMENT_SECTIONS)) {
    const block = document.createElement("div");
    block.className = "equipment-block";
    block.innerHTML = `<h3>${section.title}</h3>`;
    const grid = document.createElement("div");
    grid.className = "equipment-grid";
    for (const item of section.items) {
      const id = `${key}_${item.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;
      const label = document.createElement("label");
      label.className = "check";
      label.innerHTML = `<input type="checkbox" name="felszereltseg" value="${item}" id="${id}" ${
        checked.has(item) ? "checked" : ""
      } /> ${item}`;
      grid.appendChild(label);
    }
    block.appendChild(grid);
    equipmentRoot.appendChild(block);
  }
}

function syncEgyebInfoVisibility() {
  const card = egyebInfoRoot?.closest(".card");
  if (!card) return;
  const show = !isKisteherAd();
  card.hidden = !show;
  card.classList.toggle("hidden", !show);
}

function applyAutoFill() {
  if (mode === "wizard") return;
  const preset = AUTO_FILL_PRESETS[gyartmany.value];
  document.querySelectorAll(".auto-filled").forEach((field) => {
    field.classList.remove("auto-filled");
    if (!field.dataset.userEdited) field.value = "";
  });

  if (!preset) return;

  for (const [name, value] of Object.entries(preset)) {
    if (name === "modell") continue;
    const field = form.elements.namedItem(name);
    if (!field || field.dataset.userEdited === "1") continue;
    field.value = value;
    if (name !== "uzemanyag") field.classList.add("auto-filled");
  }
  modell?.classList.remove("auto-filled");
  syncFuelDependentFields();
  updateLeDisplay();
  fitAllFormFields();
}

function isElectricFuel(value) {
  return String(value ?? "").trim().toLowerCase() === "elektromos";
}

function isKisteherAd() {
  const subtype = String(
    form.elements.namedItem("hirdetes_alkategoria")?.value ??
      form.elements.namedItem("jarmu_kategoria")?.value ??
      ""
  )
    .trim()
    .toLowerCase();
  return subtype === "kisteher";
}

function isTeher35Ad() {
  const subtype = String(
    form.elements.namedItem("hirdetes_alkategoria")?.value ??
      form.elements.namedItem("jarmu_kategoria")?.value ??
      ""
  )
    .trim()
    .toLowerCase();
  return subtype === "teherauto";
}

function renderKivitelDropdown() {
  const kivitel = document.getElementById("kivitel");
  if (!kivitel || kivitel.tagName !== "SELECT") return;

  const current = String(kivitel.value || "").trim();
  kivitel.innerHTML = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Válasszon";
  kivitel.appendChild(empty);

  if (isTeher35Ad()) {
    for (const category of TEHER_35_KIVITEL_CATEGORIES) {
      if (category.children?.length) {
        const group = document.createElement("optgroup");
        group.label = category.label;
        for (const child of category.children) {
          const option = document.createElement("option");
          option.value = child.value;
          option.textContent = child.label;
          group.appendChild(option);
        }
        kivitel.appendChild(group);
        continue;
      }
      if (!category.value) continue;
      const option = document.createElement("option");
      option.value = category.value;
      option.textContent = category.label;
      kivitel.appendChild(option);
    }
  } else if (isKisteherAd()) {
    for (const label of TEHER_KISTEHER_KIVITEL) {
      const option = document.createElement("option");
      option.value = label;
      option.textContent = label;
      kivitel.appendChild(option);
    }
  } else {
    for (const label of KIVITEL_OPTIONS) {
      const option = document.createElement("option");
      option.value = label;
      option.textContent = label;
      kivitel.appendChild(option);
    }
  }

  if (current) kivitel.value = current;
}

function syncKisteherFields() {
  const show = isKisteherAd();
  document.querySelectorAll(".kisteher-only").forEach((el) => {
    el.hidden = !show;
    el.classList.toggle("hidden", !show);
  });
  syncEgyebInfoVisibility();
  renderEquipment();
  renderKivitelDropdown();
  void syncIngatlanFormVisibility(form);
  window.dispatchEvent(new Event("ad-form-layout-refresh"));
}

function syncFuelDependentFields() {
  const value = uzemanyag?.value ?? "";
  const electric = isElectricFuel(value);
  document.querySelectorAll(".fuel-electric-only").forEach((el) => {
    el.classList.toggle("hidden", !electric);
  });
  document.querySelectorAll(".fuel-combustion-only").forEach((el) => {
    el.classList.toggle("hidden", electric);
  });
}

function updateLeDisplay() {
  const kw = Number(teljesitmenyKw.value);
  const le = Number.isFinite(kw) ? Math.round(kw * 1.36) : 0;
  leDisplay.textContent = `(= ${le.toLocaleString("hu-HU")} LE)`;
  if (teljesitmenyLe) teljesitmenyLe.value = le > 0 ? String(le) : "";
}

function updateTitle() {
  if (!hirdetesCime) return;
  if (hirdetesCime.type !== "hidden" && hirdetesCime.dataset.userEdited === "1") return;
  const parts = [gyartmany.value, modell.value].filter(Boolean);
  const year = gyartasiEv.value;
  hirdetesCime.value = parts.length
    ? `Eladó ${parts.join(" ")}${year ? ` (${year})` : ""}`
    : "";
  if (hirdetesCime.type !== "hidden") fitInputWidth(hirdetesCime);
}

function syncTipusFromModell() {
  if (!tipus || !modell) return;
  if (tipus.tagName === "SELECT") return;
  if (tipus.dataset.userEdited === "1") return;
  tipus.value = modell.value || "";
}

function measureTextWidth(text, font) {
  const measure = document.createElement("span");
  measure.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;";
  measure.style.font = font;
  measure.textContent = text || " ";
  document.body.appendChild(measure);
  const width = measure.offsetWidth;
  measure.remove();
  return width;
}

function shouldUseFluidFieldWidths() {
  return (
    document.body.classList.contains("theme-m7") ||
    document.body.classList.contains("theme-automax") ||
    document.body.classList.contains("site-app")
  );
}

function fitSelectWidth(select) {
  if (!select || select.tagName !== "SELECT") return;
  if (select.classList.contains("ad-form-bm-native")) return;
  if (shouldUseFluidFieldWidths()) return;
  const style = getComputedStyle(select);
  const option = select.options[select.selectedIndex];
  const text = option?.text?.trim() || "—";
  select.style.width = `${Math.ceil(measureTextWidth(text, style.font)) + 34}px`;
}

function fitInputWidth(input) {
  if (!input || input.tagName !== "INPUT") return;
  if (input.classList.contains("ad-form-bm-search-trigger")) return;
  if (shouldUseFluidFieldWidths()) return;
  if (input.type === "checkbox" || input.type === "radio" || input.type === "file") return;
  const style = getComputedStyle(input);
  const text = input.value?.trim() || input.placeholder?.trim() || " ";
  const min = input.type === "number" ? 3 : 2;
  const width = Math.max(measureTextWidth(text, style.font), min * 8);
  input.style.width = `${Math.ceil(width) + 22}px`;
}

function fitAllFormFields() {
  if (shouldUseFluidFieldWidths()) {
    form.querySelectorAll("select, input, textarea").forEach((el) => {
      el.style.width = "";
    });
    return;
  }
  form.querySelectorAll("select").forEach(fitSelectWidth);
  form.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="file"])').forEach(fitInputWidth);
  if (hirdetesCime) fitInputWidth(hirdetesCime);
}

function wrapMdOutlinedFields() {
  document.querySelectorAll(".form-grid").forEach((grid) => {
    const items = [...grid.children];
    for (const el of items) {
      if (el.tagName !== "LABEL") continue;
      const next = el.nextElementSibling;
      if (!next || next.closest(".md-outlined")) continue;
      if (next.classList.contains("full") || next.classList.contains("field-row")) continue;
      const wrap = document.createElement("div");
      wrap.className = "md-outlined";
      grid.insertBefore(wrap, el);
      wrap.append(el, next);
    }
  });

  document.querySelectorAll(".labeled-field, .autofelvitele-title").forEach((block) => {
    block.classList.add("md-outlined");
  });

  document.querySelectorAll(".md-outlined, .labeled-field").forEach((wrap) => {
    if (wrap.querySelector("#gyartasi_ev, #muszaki_ev")) {
      wrap.classList.add("md-has-calendar");
    }
  });
}

function showSuccess() {
  updatePublishSuccessCopy();
  adPanel?.classList.add("hidden");
  successPanel?.classList.remove("hidden");
  footerActions.classList.add("hidden");
}

function updatePublishSuccessCopy() {
  const vertical = String(form.elements.namedItem("hirdetes_vertical")?.value ?? "").trim().toLowerCase();
  const hint = document.getElementById("success-publish-hint");
  const listLink = document.getElementById("success-list-link");
  if (!hint || !listLink) return;
  if (vertical === "teher") {
    hint.textContent =
      "A hirdetés a Bymy adatbázisban van — megjelenik a Teherautó oldalon és a Hirdetéseim listában.";
    listLink.textContent = "Teherautó oldal";
    listLink.href = "/teherauto.html";
    return;
  }
  hint.textContent =
    "A hirdetés a Bymy adatbázisban van — megjelenik az Autó oldalon és a Hirdetéseim listában.";
  listLink.textContent = "Autó oldal";
  listLink.href = "/auto.html";
}

function resetSuccess() {
  adPanel?.classList.remove("hidden");
  successPanel?.classList.add("hidden");
  footerActions.classList.remove("hidden");
}

function isIngatlanAd() {
  return (
    String(form.elements.namedItem("hirdetes_vertical")?.value ?? "")
      .trim()
      .toLowerCase() === "ingatlan"
  );
}

/** Ingatlan: 2–3. (műszaki / felszereltség) lépés kihagyása. */
function nextWizardStep(from) {
  if (isIngatlanAd()) {
    if (from === 1) return 4;
    if (from === 4) return 5;
  }
  return from + 1;
}

function prevWizardStep(from) {
  if (isIngatlanAd()) {
    if (from === 4) return 1;
    if (from === 5) return 4;
  }
  return from - 1;
}

function shouldSkipWizardStep(step) {
  return isIngatlanAd() && (step === 2 || step === 3);
}

function goToStep(step) {
  if (step < 1 || step > TOTAL_STEPS || step === currentStep) return false;
  if (shouldSkipWizardStep(step)) return false;
  if (step > 4 && !photosReadyForNext()) {
    alert(photoBlockMessage());
    showStep(4);
    return false;
  }
  if (step > currentStep) {
    for (let s = currentStep; s < step; s += 1) {
      if (shouldSkipWizardStep(s)) continue;
      if (!validateStep(s)) return false;
    }
  }
  saveDraft();
  if (currentStep === TOTAL_STEPS) resetSuccess();
  showStep(step);
  return true;
}

async function tryGoToStep(step) {
  if (step < 1 || step > TOTAL_STEPS || step === currentStep) return false;
  if (shouldSkipWizardStep(step)) return false;
  if (step > 4 && !photosReadyForNext()) {
    alert(photoBlockMessage());
    showStep(4);
    return false;
  }
  if (step > currentStep) {
    for (let s = currentStep; s < step; s += 1) {
      if (shouldSkipWizardStep(s)) continue;
      if (!validateStep(s)) return false;
    }
  }
  saveDraft();
  if (options.onStepPersist) {
    try {
      await options.onStepPersist(collectFormData(), { fromStep: currentStep, toStep: step });
    } catch (error) {
      console.warn("Lépés mentése sikertelen, a navigáció továbbra is engedélyezett:", error);
    }
  }
  if (currentStep === TOTAL_STEPS) resetSuccess();
  showStep(step);
  return true;
}

function updateAutomaxStepHeader(step) {
  if (!automaxStepTitle) return;
  const activeIndicator = indicators.find((el) => Number(el.dataset.stepIndicator) === step);
  automaxStepTitle.textContent = activeIndicator?.textContent?.trim() || "";

  if (!automaxStepLead) return;
  const panel = panels.find((el) => Number(el.dataset.step) === step);
  const hint = panel?.querySelector(".card-body > .hint, .form-grid + .hint");
  const uploadStrong = panel?.querySelector(".upload-zone strong");
  const cardHead = panel?.querySelector(".card-head");

  let lead = "";
  if (step === 1) {
    lead = "A csillaggal jelölt mezők kitöltése kötelező!";
  } else if (hint) {
    lead = hint.textContent.trim();
  } else if (uploadStrong) {
    lead = uploadStrong.textContent.trim();
  } else if (cardHead) {
    lead = cardHead.textContent.trim();
  }

  automaxStepLead.textContent = lead;
  automaxStepLead.hidden = !lead;
}

function showStep(step) {
  currentStep = step;
  panels.forEach((panel) => {
    panel.classList.toggle("hidden", Number(panel.dataset.step) !== step);
  });
  indicators.forEach((indicator) => {
    const n = Number(indicator.dataset.stepIndicator);
    indicator.classList.toggle("active", n === step);
    indicator.classList.toggle("done", n < step);
  });
  updateAutomaxStepHeader(step);
  backBtn.classList.toggle("hidden", step <= 1);
  if (step === TOTAL_STEPS && successPanel && !successPanel.classList.contains("hidden")) {
    footerActions.classList.add("hidden");
  } else {
    footerActions.classList.remove("hidden");
  }
  if (step === 1) nextBtn.textContent = "Hirdetésfeladás folytatása";
  if (step === 2) nextBtn.textContent = "Tovább az extrákhoz";
  if (step === 3) nextBtn.textContent = "Tovább a képekhez";
  if (step === 4) nextBtn.textContent = "Tovább a hirdetéshez";
  if (step === 5) {
    nextBtn.textContent = "Hirdetés feladása";
    applyListingAddressFromProfileSync(form);
    window.dispatchEvent(new Event("ad-form-sync-location"));
  }
  syncPhotoNextButton();
}

function collectFormData() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.felszereltseg = [...form.querySelectorAll('input[name="felszereltseg"]:checked')].map((el) => el.value);
  data.egyeb_info = [...form.querySelectorAll('input[name="egyeb_info"]:checked')].map((el) => el.value);
  return data;
}

function saveDraft() {
  if (mode === "import") return;
  if (mode === "wizard" && !userTouchedForm) return;
  localStorage.setItem(storageKey, JSON.stringify(collectFormData()));
}

function ensureSelectOption(select, value) {
  if (!select || !value) return;
  const has = [...select.options].some((option) => option.value === value || option.textContent === value);
  if (!has) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
  select.value = value;
}

function applyFormData(data, { fromImport = false } = {}) {
  if (!data || typeof data !== "object") return;

  form.querySelectorAll('input[name="felszereltseg"]').forEach((box) => {
    box.checked = false;
  });
  form.querySelectorAll('input[name="egyeb_info"]').forEach((box) => {
    box.checked = false;
  });

  for (const [key, value] of Object.entries(data)) {
    if (key === "felszereltseg" || key === "egyeb_info") continue;
    const field = form.elements.namedItem(key);
    if (!field) continue;
    const appliedValue = key === "gyartmany" && value ? String(value).toUpperCase() : value;
    if (field instanceof RadioNodeList) {
      [...field].forEach((node) => {
        node.checked = node.value === appliedValue;
      });
    } else if (field.type === "checkbox") {
      field.checked = appliedValue === "1" || appliedValue === true || appliedValue === "on";
    } else if (field.tagName === "SELECT") {
      ensureSelectOption(field, Array.isArray(appliedValue) ? appliedValue[0] : appliedValue);
    } else if (Array.isArray(appliedValue)) {
      field.value = JSON.stringify(appliedValue);
    } else {
      field.value = appliedValue;
    }
    if (fromImport) {
      field.dataset.userEdited = "1";
      field.classList.remove("auto-filled");
    }
  }

  for (const item of data.felszereltseg ?? []) {
    const needle = String(item).toLowerCase();
    const box = [...form.querySelectorAll('input[name="felszereltseg"]')].find(
      (el) => el.value === item || el.value.toLowerCase() === needle || el.value.toLowerCase().includes(needle)
    );
    if (box) box.checked = true;
  }

  for (const item of data.egyeb_info ?? []) {
    const needle = String(item).toLowerCase();
    const box = [...form.querySelectorAll('input[name="egyeb_info"]')].find(
      (el) => el.value === item || el.value.toLowerCase() === needle
    );
    if (box) box.checked = true;
  }

  if (data.hirdetes_cime && hirdetesCime) {
    hirdetesCime.dataset.userEdited = "1";
  }

  syncPackageSelection();
  if (fromImport && data.hirdetes_cime && hirdetesCime) {
    hirdetesCime.value = data.hirdetes_cime;
    hirdetesCime.dataset.userEdited = "1";
    fitInputWidth(hirdetesCime);
  } else {
    updateTitle();
  }

  const kmInput = document.getElementById("km");
  if (kmInput && data.km != null && String(data.km).trim() !== "") {
    kmInput.value = String(data.km);
    if (fromImport) kmInput.dataset.userEdited = "1";
  }
  updateLeDisplay();
  restoreFuelSelection(data.uzemanyag);
  applyAdFormBmFieldValues(data);
  syncFuelDependentFields();
  fitAllFormFields();
  loadExistingPhotos(data);
  if (mode === "import") {
    options.onApplied?.(data);
  } else {
    saveDraft();
    goToStep(1);
  }
}

function clearDraft() {
  localStorage.removeItem(storageKey);
}

function showAllSteps() {
  panels.forEach((panel) => panel.classList.remove("hidden"));
}

function resetForm({ fresh = false } = {}) {
  if (fresh) userTouchedForm = false;
  if (emptyingForm) return;
  emptyingForm = true;
  try {
  clearDraft();
  form.querySelectorAll("input, select, textarea").forEach((el) => {
    if (KEEP_ON_RESET.has(el.name) || KEEP_ON_RESET.has(el.id)) return;
    if (el.type === "hidden") {
      el.value = "";
      delete el.dataset.userEdited;
      return;
    }
    if (el.type === "file") {
      if (fresh) el.value = "";
      return;
    }
    if (el.type === "checkbox") {
      el.checked = false;
      return;
    }
    if (el.type === "radio") {
      el.checked = el.defaultChecked;
      return;
    }
    el.value = "";
    delete el.dataset.userEdited;
    el.classList.remove("auto-filled");
  });
  form.querySelectorAll("select.phone-country").forEach((el) => {
    if ([...el.options].some((option) => option.value === "+36")) el.value = "+36";
  });
  const primaryLang = form.querySelector('select[name="telefon1_nyelv1"]');
  if (primaryLang && [...primaryLang.options].some((option) => option.value === "Magyar")) {
    primaryLang.value = "Magyar";
  }
  if (fuelSelected) fuelSelected.textContent = "";
  if (fresh) {
    clearPhotoItems();
  } else {
    renderPhotoPreview();
  }
  syncPackageSelection();
  syncFuelDependentFields();
  updateLeDisplay();
  updateTitle();
  fitAllFormFields();
  window.dispatchEvent(new Event("ad-form-sync-location"));
  } finally {
    emptyingForm = false;
  }
}

function isLayoutHidden(field) {
  const el = field instanceof RadioNodeList ? field[0] : field;
  return Boolean(el?.closest?.(".ad-layout-hidden"));
}

function fieldStep(field) {
  const el = field instanceof RadioNodeList ? field[0] : field;
  return Number(el?.closest?.(".step-panel")?.dataset.step);
}

function validateFields(names, onlyStep = null) {
  for (const name of names) {
    const field = form.elements.namedItem(name);
    if (!field) continue;
    if (isLayoutHidden(field)) continue;
    if (onlyStep != null && fieldStep(field) !== onlyStep) continue;
    const el = field instanceof RadioNodeList ? field[0] : field;
    const value = el?.value?.trim?.() ?? "";
    if (!value) {
      el?.focus();
      return false;
    }
  }
  return true;
}

function validateStep(step) {
  if (shouldSkipWizardStep(step)) return true;
  const isIngatlan = isIngatlanAd();

  const basicRequired = isIngatlan
    ? ["allapot", "ingatlan_uzletag"]
    : ["gyartasi_ev", "gyartmany", "modell", "kivitel", "allapot", "okmany_jelleg", "km"];
  const techRequired = isIngatlan ? [] : ["uzemanyag"];
  const adRequired = [
    "vetelar",
    "megtekintesi_cim",
    "iranyitoszam",
    "telepules",
    "telefon1_korzet",
    "telefon1_szam",
  ];

  if (step === 1) {
    if (!validateFields(basicRequired, 1) || !validateFields(techRequired, 1) || !validateFields(adRequired, 1)) {
      alert("Kérjük, töltsd ki a kötelező (*) mezőket.");
      return false;
    }
    return true;
  }

  if (step === 2) {
    if (!validateFields(basicRequired, 2) || !validateFields(techRequired, 2) || !validateFields(adRequired, 2)) {
      alert("Kérjük, töltsd ki a kötelező (*) mezőket.");
      return false;
    }
    return true;
  }

  if (step === 3) {
    if (!validateFields(basicRequired, 3) || !validateFields(techRequired, 3) || !validateFields(adRequired, 3)) {
      alert("Kérjük, töltsd ki a kötelező (*) mezőket.");
      return false;
    }
    return true;
  }

  if (step === 4) {
    if (!photosReadyForNext()) {
      alert(photoBlockMessage());
      return false;
    }
    if (!validateFields(basicRequired, 4) || !validateFields(techRequired, 4) || !validateFields(adRequired, 4)) {
      alert("Kérjük, töltsd ki a kötelező (*) mezőket.");
      return false;
    }
    return true;
  }

  if (step === TOTAL_STEPS) {
    applyListingAddressFromProfileSync(form);
    window.dispatchEvent(new Event("ad-form-sync-location"));
    if (!validateFields(basicRequired)) {
      alert("Kérjük, töltsd ki a kötelező (*) mezőket.");
      return false;
    }
    if (!validateFields(techRequired)) {
      alert("Kérjük, válassz üzemanyagot.");
      return false;
    }
    if (!validateFields(adRequired)) {
      alert("Kérjük, töltsd ki a kötelező (*) mezőket.");
      return false;
    }
    if (!photosReadyForNext()) {
      alert(photoBlockMessage());
      showStep(4);
      return false;
    }
    return true;
  }

  return true;
}

function buildSummary() {
  const data = collectFormData();
  const phone = `${data.telefon1_orszag ?? ""} ${data.telefon1_korzet ?? ""} ${data.telefon1_szam ?? ""}`.trim();
  summaryText.textContent = `${data.hirdetes_cime || `${data.gyartmany} ${data.modell}`} · ${Number(data.km).toLocaleString("hu-HU")} km · ${Number(data.vetelar).toLocaleString("hu-HU")} Ft · ${phone}`;
}

function syncPackageSelection() {
  document.querySelectorAll(".package").forEach((card) => {
    const radio = card.querySelector('input[type="radio"]');
    card.classList.toggle("selected", radio?.checked);
  });
}

function isPhotoFile(file) {
  return Boolean(
    file &&
      (String(file.type || "").startsWith("image/") ||
        /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || ""))
  );
}

function revokePhotoPreview(item) {
  if (item?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
}

function clearPhotoItems() {
  photoItems.forEach(revokePhotoPreview);
  photoItems = [];
  if (photoInput) photoInput.value = "";
  renderPhotoPreview();
}

function existingPhotoUrls(data = {}) {
  const urls = [];
  const fo = String(data.fo_kep ?? "").trim();
  if (fo) urls.push(fo);
  for (const line of String(data.fotok ?? "").split(/\n+/)) {
    const url = line.trim();
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

function loadExistingPhotos(data) {
  if (photoItems.length) return;
  const urls = existingPhotoUrls(data).slice(0, MAX_LISTING_PHOTOS);
  if (!urls.length) {
    renderPhotoPreview();
    return;
  }
  photoItems = urls.map((url) => ({
    id: `url-${++photoSeq}`,
    file: null,
    previewUrl: url,
    basePreviewUrl: url,
    dataUrl: null,
    url,
    status: "ready",
    error: "",
    overlayTemplateId: null,
    overlayDataUrl: null,
  }));
  renderPhotoPreview();
}

function applyPhotoUrls(urls) {
  const list = (urls ?? []).map((url) => String(url ?? "").trim()).filter(Boolean).slice(0, MAX_LISTING_PHOTOS);
  if (!list.length) return;
  list.forEach((url, index) => {
    const item = photoItems[index];
    if (item) {
      item.url = url;
      item.previewUrl = url;
      item.status = "ready";
      item.dataUrl = null;
      item.error = "";
      return;
    }
    photoItems.push({
      id: `url-${++photoSeq}`,
      file: null,
      previewUrl: url,
      basePreviewUrl: url,
      dataUrl: null,
      url,
      status: "ready",
      error: "",
      overlayTemplateId: null,
      overlayDataUrl: null,
    });
  });
  renderPhotoPreview();
}

function addPhotoFiles(files) {
  userTouchedForm = true;
  const incoming = [...(files ?? [])].filter(isPhotoFile);
  const room = MAX_LISTING_PHOTOS - photoItems.length;
  if (room <= 0) {
    alert("Legfeljebb 12 kép tölthető fel.");
    return;
  }
  for (const file of incoming.slice(0, room)) {
    photoItems.push({
      id: `file-${++photoSeq}`,
      file,
      previewUrl: URL.createObjectURL(file),
      basePreviewUrl: null,
      dataUrl: null,
      url: null,
      status: "pending",
      error: "",
      overlayTemplateId: null,
      overlayDataUrl: null,
    });
    const last = photoItems[photoItems.length - 1];
    last.basePreviewUrl = last.previewUrl;
  }
  if (incoming.length > room) {
    alert("Legfeljebb 12 kép tölthető fel. A többletet nem vettük fel.");
  }
  renderPhotoPreview();
}

function photosReadyForNext() {
  if (photoBusy) return false;
  if (!photoItems.length) return editing;
  return photoItems.every((item) => item.status === "ready");
}

function photoBlockMessage() {
  if (photoBusy) return "Várj, amíg minden kép feltöltődik.";
  if (!photoItems.length) return "Legalább egy fénykép kell a hirdetéshez.";
  if (photoItems.some((item) => item.status === "error")) {
    return "Van hibás kép. Töröld, vagy töltsd fel újra a Feltöltés gombbal.";
  }
  return "Először töltsd fel a képeket a Feltöltés gombbal.";
}

function syncPhotoNextButton() {
  if (!nextBtn) return;
  if (currentStep !== 4) {
    nextBtn.disabled = false;
    nextBtn.removeAttribute("title");
    return;
  }
  const ready = photosReadyForNext();
  nextBtn.disabled = !ready;
  nextBtn.title = ready ? "" : photoBlockMessage();
}

function updatePhotoStatus() {
  const total = photoItems.length;
  const ready = photoItems.filter((item) => item.status === "ready").length;
  const pending = photoItems.filter((item) => item.status === "pending" || item.status === "error").length;
  const uploading = photoItems.filter((item) => item.status === "uploading").length;
  const first = photoItems[0];
  const hasOverlay = Boolean(first?.overlayTemplateId);
  if (photoUploadProgress) {
    photoUploadProgress.max = Math.max(total, 1);
    photoUploadProgress.value = ready;
  }
  if (photoUploadBtn) {
    photoUploadBtn.disabled = photoBusy || pending === 0;
    photoUploadBtn.textContent = photoBusy ? "Feltöltés…" : "Feltöltés";
  }
  if (photoOverlayApplyBtn) {
    photoOverlayApplyBtn.disabled = photoBusy || !first || first.status === "uploading";
  }
  if (photoOverlayClearBtn) {
    photoOverlayClearBtn.disabled = photoBusy || !hasOverlay;
  }
  if (photoOverlayHint) {
    photoOverlayHint.textContent = hasOverlay
      ? "Sablon aktív a főképen. „Sablon törlése” visszaállítja az eredeti fotót."
      : "Sablon: az első képre (főkép) kerül. Később több sablon közül lehet választani.";
  }
  if (photoUploadLabel) {
    if (!total) {
      photoUploadLabel.textContent = editing
        ? "Ha új képet adsz, a Feltöltés után lehet továbbmenni."
        : "Válassz képeket, majd kattints a Feltöltésre.";
    } else if (photoBusy || uploading) {
      photoUploadLabel.textContent = `Feltöltés: ${ready} / ${total}`;
    } else if (pending) {
      photoUploadLabel.textContent = `${pending} kép vár feltöltésre. Kattints a Feltöltésre.`;
    } else {
      photoUploadLabel.textContent = `Minden kép kész (${ready} / ${MAX_LISTING_PHOTOS}). Továbbmehetsz.`;
    }
  }
  syncPhotoNextButton();
}

function renderPhotoPreview() {
  if (!photoGrid) return;
  photoGrid.innerHTML = "";
  if (!photoItems.length) {
    const slot = document.createElement("div");
    slot.className = "photo-slot";
    slot.textContent = "Még nincs kép";
    photoGrid.appendChild(slot);
    updatePhotoStatus();
    return;
  }
  photoItems.forEach((item, index) => {
    const slot = document.createElement("div");
    slot.className = "photo-slot";
    slot.dataset.id = item.id;
    const img = document.createElement("img");
    img.src = item.previewUrl || item.url || "";
    img.alt = item.file?.name || `Kép ${index + 1}`;
    slot.appendChild(img);
    if (index === 0) {
      const badge = document.createElement("span");
      badge.className = "photo-slot-badge";
      badge.textContent = "Főkép";
      slot.appendChild(badge);
      if (item.overlayTemplateId) {
        const overlayBadge = document.createElement("span");
        overlayBadge.className = "photo-slot-badge photo-slot-badge--overlay";
        overlayBadge.textContent = "Sablon";
        slot.appendChild(overlayBadge);
      }
    }
    if (item.status === "uploading" || item.status === "pending" || item.status === "error") {
      const state = document.createElement("span");
      state.className = "photo-slot-state";
      state.textContent =
        item.status === "uploading" ? "Feltöltés…" : item.status === "error" ? "Hiba" : "Várakozik";
      slot.appendChild(state);
    }
    const actions = document.createElement("div");
    actions.className = "photo-slot-actions";
    actions.innerHTML = `
      <button type="button" data-photo-up="${item.id}" ${index === 0 ? "disabled" : ""}>↑</button>
      <button type="button" data-photo-down="${item.id}" ${index === photoItems.length - 1 ? "disabled" : ""}>↓</button>
      <button type="button" data-photo-del="${item.id}">×</button>
    `;
    slot.appendChild(actions);
    photoGrid.appendChild(slot);
  });
  updatePhotoStatus();
}

async function uploadPendingPhotos() {
  const pending = photoItems.filter((item) => item.status === "pending" || item.status === "error");
  if (!pending.length || photoBusy) return;
  photoBusy = true;
  updatePhotoStatus();
  for (const item of pending) {
    if (!item.file) {
      item.status = "error";
      item.error = "Hiányzó fájl.";
      renderPhotoPreview();
      continue;
    }
    item.status = "uploading";
    item.error = "";
    renderPhotoPreview();
    try {
      try {
        const uploaded = await uploadImage({
          file: item.file,
          kind: "listing",
          entityType: "listing",
          folder: "listings",
          fileName: item.file.name,
          onProgress: () => {},
        });
        item.url = uploaded?.url || uploaded?.publicUrl || null;
        item.dataUrl = null;
        item.status = item.url ? "ready" : "error";
        item.error = item.url ? "" : "A feltöltés sikertelen.";
      } catch (uploadError) {
        const localDataUrl = await compressListingPhoto(item.file);
        item.dataUrl = localDataUrl;
        item.url = null;
        item.status = "ready";
        item.error = "";
        console.warn("Supabase upload fallback (local compression):", uploadError?.message ?? uploadError);
      }
    } catch (error) {
      item.status = "error";
      item.error = error?.message ?? "A feltöltés sikertelen.";
    }
    renderPhotoPreview();
  }
  photoBusy = false;
  updatePhotoStatus();
  if (photoItems.some((item) => item.status === "error")) {
    alert("Van kép, amit nem sikerült feltölteni. Töröld, vagy próbáld újra.");
  }
}

function preparedPhotoItems() {
  return photoItems
    .filter((item) => item.status === "ready")
    .map((item) => {
      if (item.overlayDataUrl) return { data: item.overlayDataUrl };
      return item.url ? { url: item.url } : { data: item.dataUrl };
    })
    .filter((item) => item.url || item.data);
}

function overlayInfoFromForm() {
  const le = String(teljesitmenyLe?.value ?? "").trim();
  const kw = String(teljesitmenyKw?.value ?? "").trim();
  const power = le ? `${le} LE` : kw ? `${kw} kW` : "";
  const fuel = String(uzemanyag?.value ?? "").trim();
  return {
    templateId: DEFAULT_PHOTO_OVERLAY_ID,
    brand: String(gyartmany?.value ?? "").trim(),
    model: String(modell?.value ?? "").trim(),
    year: String(gyartasiEv?.value ?? "").trim(),
    km: String(document.getElementById("km")?.value ?? "").trim(),
    power,
    fuel,
    price: String(document.getElementById("vetelar")?.value ?? "").trim(),
    place: String(document.getElementById("telepules")?.value ?? "").trim() || "bymy",
  };
}

function clearPhotoOverlay(item) {
  if (!item?.overlayTemplateId && !item?.overlayDataUrl) return;
  item.previewUrl = item.basePreviewUrl || item.url || item.previewUrl;
  item.overlayTemplateId = null;
  item.overlayDataUrl = null;
}

async function applyPhotoOverlayToFirst() {
  const item = photoItems[0];
  if (!item) {
    alert("Előbb adj hozzá legalább egy képet.");
    return;
  }
  const src = item.basePreviewUrl || item.url || item.previewUrl;
  if (!src) {
    alert("A főkép még nem elérhető.");
    return;
  }
  if (!item.basePreviewUrl) item.basePreviewUrl = src;

  photoItems.forEach((other, index) => {
    if (index !== 0) clearPhotoOverlay(other);
  });

  if (photoOverlayApplyBtn) {
    photoOverlayApplyBtn.disabled = true;
    photoOverlayApplyBtn.textContent = "Sablon…";
  }
  try {
    const dataUrl = await renderListingPhotoOverlay(src, overlayInfoFromForm());
    item.overlayTemplateId = DEFAULT_PHOTO_OVERLAY_ID;
    item.overlayDataUrl = dataUrl;
    item.previewUrl = dataUrl;
    renderPhotoPreview();
  } catch (error) {
    alert(error?.message || "A sablon nem alkalmazható erre a képre.");
    updatePhotoStatus();
  } finally {
    if (photoOverlayApplyBtn) photoOverlayApplyBtn.textContent = "Sablon használata";
    updatePhotoStatus();
  }
}

function removePhotoOverlayFromFirst() {
  const item = photoItems[0];
  if (!item) return;
  clearPhotoOverlay(item);
  renderPhotoPreview();
}

form.querySelectorAll(".auto-filled, #tipus, #hengerurtartalom, #sebessegvalto, #hajtas, #teljesitmeny_kw").forEach((field) => {
  field?.addEventListener("input", () => {
    field.dataset.userEdited = "1";
    field.classList.remove("auto-filled");
  });
});

[gyartmany, modell, tipus, gyartasiEv].forEach((field) => {
  field?.addEventListener("input", updateTitle);
  field?.addEventListener("change", updateTitle);
});

hirdetesCime?.addEventListener("input", () => {
  hirdetesCime.dataset.userEdited = "1";
});

gyartmany?.addEventListener("change", applyAutoFill);
teljesitmenyKw?.addEventListener("input", updateLeDisplay);

if (mode === "wizard") {
  backBtn?.addEventListener("click", async () => {
    if (currentStep > 1) await tryGoToStep(prevWizardStep(currentStep));
  });

  indicators.forEach((indicator) => {
    const step = Number(indicator.dataset.stepIndicator);
    indicator.setAttribute("role", "tab");
    indicator.setAttribute("tabindex", "0");
    indicator.addEventListener("click", () => {
      if (shouldSkipWizardStep(step)) return;
      void tryGoToStep(step);
    });
    indicator.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (shouldSkipWizardStep(step)) return;
        void tryGoToStep(step);
      }
    });
  });

  nextBtn?.addEventListener("click", async () => {
    if (!validateStep(currentStep)) return;
    saveDraft();
    if (currentStep < TOTAL_STEPS) {
      await tryGoToStep(nextWizardStep(currentStep));
      return;
    }
    buildSummary();
    const formData = collectFormData();
    nextBtn.disabled = true;
    try {
      await options.onWizardComplete?.(formData);
      showSuccess();
    } catch (error) {
      alert(error?.message ?? "A hirdetés mentése nem sikerült.");
    } finally {
      nextBtn.disabled = false;
    }
  });

  newAdBtn?.addEventListener("click", () => {
    resetForm({ fresh: true });
    resetSuccess();
    showStep(1);
    options.onNewAd?.();
  });

  form.addEventListener(
    "pointerdown",
    () => {
      userTouchedForm = true;
    },
    { capture: true }
  );
  form.addEventListener(
    "keydown",
    () => {
      userTouchedForm = true;
    },
    { capture: true }
  );

  form.addEventListener("input", saveDraft);
  form.addEventListener("change", saveDraft);
}

uploadZone?.addEventListener("click", () => photoInput.click());
uploadZone?.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadZone.style.borderColor = "#f57c00";
});
uploadZone?.addEventListener("dragleave", () => {
  uploadZone.style.borderColor = "";
});
uploadZone?.addEventListener("drop", (event) => {
  event.preventDefault();
  uploadZone.style.borderColor = "";
  if (event.dataTransfer?.files?.length) {
    addPhotoFiles(event.dataTransfer.files);
  }
});
photoInput?.addEventListener("change", () => {
  if (photoInput.files) addPhotoFiles(photoInput.files);
  photoInput.value = "";
});
photoUploadBtn?.addEventListener("click", () => {
  uploadPendingPhotos();
});
photoOverlayApplyBtn?.addEventListener("click", () => {
  applyPhotoOverlayToFirst();
});
photoOverlayClearBtn?.addEventListener("click", () => {
  removePhotoOverlayFromFirst();
});
photoGrid?.addEventListener("click", (event) => {
  const up = event.target.closest("[data-photo-up]");
  const down = event.target.closest("[data-photo-down]");
  const del = event.target.closest("[data-photo-del]");
  if (up) {
    const i = photoItems.findIndex((item) => item.id === up.dataset.photoUp);
    if (i > 0) {
      const [moved] = photoItems.splice(i, 1);
      photoItems.splice(i - 1, 0, moved);
      photoItems.forEach((item, index) => {
        if (index !== 0) clearPhotoOverlay(item);
      });
      renderPhotoPreview();
    }
  }
  if (down) {
    const i = photoItems.findIndex((item) => item.id === down.dataset.photoDown);
    if (i >= 0 && i < photoItems.length - 1) {
      const [moved] = photoItems.splice(i, 1);
      photoItems.splice(i + 1, 0, moved);
      photoItems.forEach((item, index) => {
        if (index !== 0) clearPhotoOverlay(item);
      });
      renderPhotoPreview();
    }
  }
  if (del) {
    const i = photoItems.findIndex((item) => item.id === del.dataset.photoDel);
    if (i >= 0) {
      revokePhotoPreview(photoItems[i]);
      photoItems.splice(i, 1);
      photoItems.forEach((item, index) => {
        if (index !== 0) clearPhotoOverlay(item);
      });
      renderPhotoPreview();
    }
  }
});

form.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("select")) fitSelectWidth(target);
  else if (target.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"])')) fitInputWidth(target);
});

form.addEventListener("change", (event) => {
  if (event.target.matches("select")) fitSelectWidth(event.target);
});

document.querySelectorAll(".package").forEach((card) => {
  card.addEventListener("click", () => {
    const radio = card.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
    syncPackageSelection();
    saveDraft();
  });
});

fillYearSelect(gyartasiEv);
fillYearSelect(muszakiEv, { maxYear: YEAR_SELECT_MAX });
fillYearSelect(forgalombaHelyezesEv);
initVehicleCatalogSelects({
  brandSelect: gyartmany,
  modelSelect: modell,
  tipusSelect: tipus,
  yearSelect: gyartasiEv,
  yearFromCatalog: false,
  brandEmptyLabel: "Válasszon",
  modelEmptyLabel: "Válasszon",
  onChange: () => {
    syncTipusFromModell();
    applyAutoFill();
    updateTitle();
    fitAllFormFields();
  },
  onTypeDataChange: (entry) => applyCatalogTypeData(entry),
})
  .then((catalog) => {
    if (mode === "wizard" && !userTouchedForm && !editing) resetForm();
    refreshAdFormBmPickers(form, catalog);
    options.onCatalogReady?.();
    window.dispatchEvent(new Event("ad-form-ready"));
  })
  .catch(() => {});

modell?.addEventListener("change", () => {
  syncTipusFromModell();
  updateTitle();
});
renderFuelDropdown();
renderAllapotDropdown();
renderFuelSelector();
renderKlimaOptions();
renderEquipment();
renderEgyebInfo();
wrapMdOutlinedFields();
syncFuelDependentFields();
fitAllFormFields();

uzemanyag?.addEventListener("change", () => {
  if (uzemanyag.tagName !== "SELECT") return;
  uzemanyag.dataset.userEdited = "1";
  syncFuelDependentFields();
  saveDraft();
});

if (mode === "wizard") {
  form.setAttribute("autocomplete", "off");
  form.querySelectorAll("input, select, textarea").forEach((el) => {
    el.setAttribute("autocomplete", "off");
  });
  if (editing) {
    userTouchedForm = true;
    showStep(1);
  } else {
    userTouchedForm = false;
    resetForm({ fresh: true });
    showStep(1);
    const emptyIfPristine = () => {
      if (!userTouchedForm) resetForm();
    };
    form.addEventListener(
      "input",
      (event) => {
        if (userTouchedForm) return;
        // Profilból / kézzel töltött cím ne törlődjön az első billentyűre.
        if (event.target?.closest?.(".ad-location-fields, .field-stack--location, #email")) {
          userTouchedForm = true;
          return;
        }
        resetForm();
      },
      { capture: true }
    );
    requestAnimationFrame(emptyIfPristine);
    window.setTimeout(emptyIfPristine, 80);
    window.setTimeout(emptyIfPristine, 300);
    window.addEventListener("pageshow", emptyIfPristine);
  }
} else {
  showAllSteps();
}

renderPhotoPreview();
window.dispatchEvent(new Event("ad-form-ready"));

return {
  applyFormData,
  collectFormData,
  resetForm,
  markTouched: () => {
    userTouchedForm = true;
  },
  applyPhotoUrls,
  getPhotoFiles: () => photoItems.map((item) => item.file).filter(Boolean),
  getPreparedPhotoItems: preparedPhotoItems,
  showAllSteps,
  syncFuelDependentFields,
  syncKisteherFields,
  fitAllFormFields,
};
}
