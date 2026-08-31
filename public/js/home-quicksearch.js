/**
 * Gyorskereső az autó hero panelen — elrendezés: GET /api/level1/form-layout?category=szemelyauto-search
 */

import { applyAutoSearchLayout, readLayoutFilterValues } from "./auto-search-layout.js?v=valtoPick1";
import { mountAutoSearchDrums, readAutoDrumFilterValues, resetAutoSearchDrums } from "./auto-search-drums.js?v=deskGap2";
import {
  mountDetailedSearch,
  readDetailedSearchValues,
  resetDetailedSearch,
} from "./auto-detailed-search.js?v=autoDesk16";
import { readBrandModelFilterValues, mountAutoBrandModelPicker } from "./auto-brand-model-picker.js?v=valtoPick1";
import { readFuelFilterValues, mountAutoFuelPicker } from "./auto-fuel-picker.js?v=valtoPick1";
import { readKivitelFilterValues, mountAutoKivitelPicker } from "./auto-kivitel-picker.js?v=valtoPick1";
import { readAllapotFilterValues, mountAutoAllapotPicker } from "./auto-allapot-picker.js?v=valtoPick1";
import { readSebessegvaltoFilterValues, mountAutoSebessegvaltoPicker } from "./auto-sebessegvalto-picker.js?v=valtoPick1";
import {
  initAutoDeskSearch,
  updateAutoDeskAccSummaries,
  arrangeAutoDeskDemoFields,
} from "./auto-desk-search.js?v=valtoPick1";

const MOBILE_MQ = "(max-width: 900px)";
const DESK_MQ = "(min-width: 901px)";

export function initHomeQuickSearch({ onSearch = () => {}, onDeskSortChange } = {}) {
  const form = document.getElementById("home-qs-form");
  if (!form) return;

  const hero = document.querySelector("[data-auto-search-hero]");
  const morePanel = document.getElementById("qs-more");
  const advancedBtn = document.getElementById("qs-reszletes");
  const detailedPanel = document.getElementById("qs-detailed-panel");
  const detailedBtn = document.getElementById("qs-detailed");
  const statusEl = document.getElementById("home-qs-status");
  const mobile = () => window.matchMedia(MOBILE_MQ).matches;

  function readQuickSearchValues() {
    const base =
      form.dataset.drumsMounted === "1" ? readAutoDrumFilterValues(form) : readLayoutFilterValues(form);
    const brandModel = readBrandModelFilterValues(form);
    const fuel = readFuelFilterValues(form);
    const kivitel = readKivitelFilterValues(form);
    const allapot = readAllapotFilterValues(form);
    const sebessegvalto = readSebessegvaltoFilterValues(form);
    if (form.dataset.brandModelPicker === "1") {
      delete base.gyartmany;
      delete base.modell;
      delete base.gyartmanyok;
      delete base.modellek;
    }
    if (form.dataset.fuelPicker === "1") {
      delete base.uzemanyag;
      delete base.uzemanyagQuick;
    }
    if (form.dataset.kivitelPicker === "1") {
      delete base.kivitel;
    }
    if (form.dataset.allapotPicker === "1") {
      delete base.allapot;
    }
    if (form.dataset.sebessegvaltoPicker === "1") {
      delete base.sebessegvalto;
    }
    const detailed = readDetailedSearchValues(form);
    return { ...base, ...brandModel, ...fuel, ...kivitel, ...allapot, ...sebessegvalto, detailed };
  }

  function syncDetailedButton(moreOpen) {
    if (!detailedBtn) return;
    detailedBtn.hidden = !moreOpen;
  }

  function setMoreOpen(open) {
    if (!morePanel || !advancedBtn) return;
    morePanel.hidden = !open;
    morePanel.classList.toggle("is-open", open);
    advancedBtn.setAttribute("aria-expanded", open ? "true" : "false");
    advancedBtn.textContent = open ? "Kevesebb szűrő" : "Több szűrő";
    hero?.classList.toggle("is-more-open", open);
    syncDetailedButton(open);
    if (!open) setDetailedOpen(false);
  }

  function setDetailedOpen(open) {
    if (!detailedPanel || !detailedBtn) return;
    detailedPanel.hidden = !open;
    detailedPanel.classList.toggle("is-open", open);
    detailedBtn.setAttribute("aria-expanded", open ? "true" : "false");
    detailedBtn.textContent = open ? "Kevesebb részletes" : "Részletes keresés";
    hero?.classList.toggle("is-detailed-open", open);
  }

  function setQsReady(ready) {
    form.classList.toggle("auto-qs-booting", !ready && mobile());
    form.classList.toggle("is-qs-ready", ready);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSearch(readQuickSearchValues());
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      if (form.dataset.drumsMounted === "1") {
        resetAutoSearchDrums(form);
      } else {
        form.querySelector("#qs-gyartmany")?.dispatchEvent(new Event("change"));
      }
      resetDetailedSearch(form);
      setMoreOpen(false);
      setDetailedOpen(false);
      onSearch({});
    });
  });

  advancedBtn?.addEventListener("click", () => {
    const willOpen = !morePanel.classList.contains("is-open");
    setMoreOpen(willOpen);
  });

  detailedBtn?.addEventListener("click", async () => {
    const willOpen = !detailedPanel.classList.contains("is-open");
    if (willOpen) {
      try {
        await mountDetailedSearch(form, { force: true });
      } catch (error) {
        console.warn("Részletes keresés panel:", error);
      }
    }
    setDetailedOpen(willOpen);
  });

  setMoreOpen(false);
  setDetailedOpen(false);
  setQsReady(false);

  initAutoDeskSearch({
    mountDetailed: (f) => mountDetailedSearch(f, { force: true }),
    onSortChange: (sort) => onDeskSortChange?.(sort),
  });

  form.querySelector("[data-desk-reset]")?.addEventListener("click", () => {
    form.reset();
  });

  applyAutoSearchLayout(form)
    .then(async () => {
      const page = document.body?.getAttribute("data-site-page");
      const deskAuto =
        (page === "auto" || page === "teherauto") &&
        window.matchMedia(DESK_MQ).matches;
      // Asztali auto: natív select = demó dropdown (dob nélkül). Mobil / teher: dobok.
      if (!deskAuto) {
        try {
          await mountAutoSearchDrums(form);
        } catch (drumError) {
          console.warn("Kereső dobkerék:", drumError);
        }
      } else {
        arrangeAutoDeskDemoFields(form);
        try {
          await mountAutoBrandModelPicker(form);
        } catch (pickerError) {
          console.warn("Gyártmány/Modell picker:", pickerError);
        }
        try {
          await mountAutoFuelPicker(form);
        } catch (fuelError) {
          console.warn("Üzemanyag picker:", fuelError);
        }
        try {
          await mountAutoKivitelPicker(form);
        } catch (kivitelError) {
          console.warn("Kivitel picker:", kivitelError);
        }
        try {
          await mountAutoAllapotPicker(form);
        } catch (allapotError) {
          console.warn("Állapot picker:", allapotError);
        }
        try {
          await mountAutoSebessegvaltoPicker(form);
        } catch (valtoError) {
          console.warn("Sebességváltó picker:", valtoError);
        }
      }
      const urlKivitel = new URLSearchParams(window.location.search).get("kivitel");
      if (urlKivitel && form.dataset.kivitelPicker !== "1") {
        const el =
          form.querySelector("#qs-kivitel") ||
          form.querySelector('[name="kivitel"]') ||
          form.querySelector('[data-filter-key="kivitel"]');
        if (el && "value" in el) el.value = urlKivitel;
      }
      setQsReady(true);
      updateAutoDeskAccSummaries(form);
      if (statusEl) {
        statusEl.hidden = true;
        statusEl.textContent = "";
      }
    })
    .catch((error) => {
      console.warn("Kereső elrendezés:", error);
      form.querySelectorAll(".home-qs-static-legacy").forEach((el) => {
        el.hidden = false;
        el.style.display = "";
      });
      setQsReady(true);
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "A kereső elrendezés nem töltődött be. Hard refresh, majd szerver újraindítás.";
      }
    });
}

export { readDetailedSearchValues } from "./auto-detailed-search.js?v=autoDesk16";
