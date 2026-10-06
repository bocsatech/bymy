
import { applyAutoSearchLayout, readLayoutFilterValues, refillAutoSearchRangeSelects, prefetchAutoSearchBoot } from "./auto-search-layout.js?v=kmFill1";
import { mountAutoSearchDrums, readAutoDrumFilterValues, resetAutoSearchDrums, styleAutoSearchMoreCard, enhanceDeskDualRanges } from "./auto-search-drums.js?v=catFuelDrum1";
import {
  mountDetailedSearch,
  readDetailedSearchValues,
  resetDetailedSearch,
} from "./auto-detailed-search.js?v=18415b7f87";
import { readWheel } from "./ingatlan-wheels.js?v=6952ba469c";
import { readBrandModelFilterValues, mountAutoBrandModelPicker } from "./auto-brand-model-picker.js?v=switchDesignAll1";
import { readFuelFilterValues, mountAutoFuelPicker } from "./auto-fuel-picker.js?v=switchDesignAll1";
import { readKivitelFilterValues, mountAutoKivitelPicker } from "./auto-kivitel-picker.js?v=switchDesignAll1";
import { readAllapotFilterValues, mountAutoAllapotPicker } from "./auto-allapot-picker.js?v=switchDesignAll1";
import { readSebessegvaltoFilterValues, mountAutoSebessegvaltoPicker } from "./auto-sebessegvalto-picker.js?v=noDupValto1";
import { readOkmanyFilterValues, mountAutoOkmanyPicker } from "./auto-okmany-picker.js?v=noDupValto1";
import { readToltoFilterValues, mountAutoToltoPickers } from "./auto-tolto-picker.js?v=3cc657260b";
import {
  initAutoDeskSearch,
  updateAutoDeskAccSummaries,
  arrangeAutoDeskDemoFields,
  deskFilterMenuReady,
  syncAutoSearchAccShell,
} from "./auto-desk-search.js?v=mobileMore1";

prefetchAutoSearchBoot();
const MOBILE_MQ = "(max-width: 900px)";
const DESK_MQ = "(min-width: 901px)";

export function initHomeQuickSearch({ onSearch = () => {}, onFilterPreview, onDeskSortChange, onReady } = {}) {
  const form = document.getElementById("home-qs-form");
  if (!form) return null;

  let resolveReady;
  const whenReady = new Promise((resolve) => {
    resolveReady = resolve;
  });

  const hero = document.querySelector("[data-auto-search-hero]");
  const morePanel = document.getElementById("qs-more");
  const advancedBtn = document.getElementById("qs-reszletes");
  const detailedPanel = document.getElementById("qs-detailed-panel");
  const detailedBtn = document.getElementById("qs-detailed");
  const statusEl = document.getElementById("home-qs-status");
  const mobile = () => window.matchMedia(MOBILE_MQ).matches;
  const vehicleDesk = () => {
    const page = document.body?.getAttribute("data-site-page");
    return (page === "auto" || page === "teherauto") && window.matchMedia(DESK_MQ).matches;
  };

  function enrichDrumFilterValues(base) {
    if (form.dataset.drumsMounted !== "1" || !base || typeof base !== "object") return base;
    const fuelWheel = form.querySelector('[data-filter-key="uzemanyagQuick"][data-wheel]');
    const fuelFromWheel = fuelWheel ? readWheel(fuelWheel) : "";
    if (fuelFromWheel) base.uzemanyagQuick = fuelFromWheel;
    return base;
  }

  function readQuickSearchValues() {
    const base = enrichDrumFilterValues(
      form.dataset.drumsMounted === "1" ? readAutoDrumFilterValues(form) : readLayoutFilterValues(form)
    );
    const brandModel = readBrandModelFilterValues(form);
    const fuel = readFuelFilterValues(form);
    const kivitel = readKivitelFilterValues(form);
    const allapot = readAllapotFilterValues(form);
    const sebessegvalto = readSebessegvaltoFilterValues(form);
    const okmany = readOkmanyFilterValues(form);
    const tolto = readToltoFilterValues(form);
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
    if (form.dataset.okmanyPicker === "1") {
      delete base.okmany_jelleg;
    }
    if (form.dataset.acToltoPicker === "1") {
      delete base.ac_tolto_csatlakozas;
    }
    if (form.dataset.toltoPicker === "1") {
      delete base.tolto_csatlakozas;
    }
    const detailed = readDetailedSearchValues(form);
    return { ...base, ...brandModel, ...fuel, ...kivitel, ...allapot, ...sebessegvalto, ...okmany, ...tolto, detailed };
  }

  function syncDetailedButton(moreOpen) {
    if (!detailedBtn) return;
    detailedBtn.hidden = !moreOpen;
  }

  function setMoreOpen(open) {
    if (!morePanel || !advancedBtn) return;
    morePanel.hidden = !open;
    morePanel.classList.toggle("is-open", open);
    if (open) {
      morePanel.style.removeProperty("display");
      form.querySelector("#qs-more-layout")?.style.removeProperty("display");
    }
    advancedBtn.setAttribute("aria-expanded", open ? "true" : "false");
    advancedBtn.textContent = open ? "Kevesebb szűrő" : "Több szűrő";
    hero?.classList.toggle("is-more-open", open);
    syncDetailedButton(open);
    if (!open) setDetailedOpen(false);
    if (open) styleAutoSearchMoreCard(form);
  }

  function setDetailedOpen(open) {
    if (!detailedPanel || !detailedBtn) return;
    detailedPanel.hidden = !open;
    detailedPanel.classList.toggle("is-open", open);
    if (open) detailedPanel.style.removeProperty("display");
    detailedBtn.setAttribute("aria-expanded", open ? "true" : "false");
    detailedBtn.textContent = open ? "Kevesebb részletes" : "Részletes keresés";
    hero?.classList.toggle("is-detailed-open", open);
  }

  function setQsReady(ready) {
    form.classList.toggle("auto-qs-booting", !ready && mobile());
    form.classList.toggle("is-qs-ready", ready);
  }

  let wheelSearchTimer = null;

  function triggerSearchFromForm() {
    onSearch(readQuickSearchValues());
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    triggerSearchFromForm();
  });

  function triggerPreviewFromForm() {
    if (typeof onFilterPreview === "function") {
      onFilterPreview(readQuickSearchValues());
      return;
    }
    triggerSearchFromForm();
  }

  function schedulePreviewFromForm({ scroll = false } = {}) {
    clearTimeout(wheelSearchTimer);
    wheelSearchTimer = setTimeout(() => {
      if (!form.classList.contains("is-qs-ready")) return;
      triggerPreviewFromForm();
      if (scroll) scrollToListingsAfterSearch();
    }, 120);
  }

  form.addEventListener("immo-wheel-change", () => {
    // Mobil: ne ugorjon a találatokhoz — a felhasználó még szűrőket állít.
    schedulePreviewFromForm({ scroll: false });
  });

  form.addEventListener("change", (event) => {
    if (!form.classList.contains("is-qs-ready")) return;
    if (!event.target?.closest?.("#home-qs-form")) return;
    schedulePreviewFromForm({ scroll: false });
  });

  document.addEventListener(
    "immo-wheel-change",
    (event) => {
      const wheel = event.target?.closest?.("[data-wheel]");
      if (!wheel || !form.contains(wheel)) return;
      schedulePreviewFromForm({ scroll: false });
    },
    true
  );

  function scrollToListingsAfterSearch() {
    const target = document.getElementById("home-category-bar") || document.getElementById("home-grid-track");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
  // Never leave the form permanently blocked if a picker hangs.
  const bootFailsafe = window.setTimeout(() => {
    if (!form.classList.contains("is-qs-ready")) {
      console.warn("Kereső boot timeout — feloldom a formot.");
      try {
        if (vehicleDesk()) void mountDeskFilterMenu(form);
        else arrangeAutoDeskDemoFields(form);
      } catch {
        /* ignore */
      }
      setQsReady(true);
      resolveReady?.();
    }
  }, 4500);

  let deskMenuMountPromise = null;

  async function mountDeskFilterMenu(f) {
    /* Desk = mobil dobkerék/sheet menü 1:1 (ne slim select lista). */
    if (deskFilterMenuReady(f)) {
      arrangeAutoDeskDemoFields(f);
      try {
        if (f.dataset.brandModelPicker !== "1" || !f.querySelector(".auto-bm-brand-block")) {
          await mountAutoBrandModelPicker(f);
        }
        if (f.dataset.fuelPicker !== "1") {
          await mountAutoFuelPicker(f);
        }
        f.querySelectorAll(
          '#qs-layout-main [data-qs-field="gyartmany"], #qs-layout-main [data-qs-field="modell"], #qs-layout-main [data-qs-field="tipus"], #qs-layout-main [data-wheel="gyartmany"], #qs-layout-main [data-wheel="modell"]'
        ).forEach((el) => {
          const cell = el.closest(".home-qs-grid-cell, .immo-schema-cell, .immo-dual-range-block") || el;
          cell.hidden = true;
          cell.style.setProperty("display", "none", "important");
        });
        syncAutoSearchAccShell(f);
        updateAutoDeskAccSummaries(f);
      } catch {
        /* ignore */
      }
      return;
    }
    if (deskMenuMountPromise) return deskMenuMountPromise;

    deskMenuMountPromise = (async () => {
      /* Layout nélkül ne mountoljunk — különben drumsMounted=1 üresen ragad. */
      if (!f?.querySelector("#qs-layout-main [data-qs-field], #qs-more-layout [data-qs-field]")) {
        return;
      }
      arrangeAutoDeskDemoFields(f);
      try {
        delete f.dataset.drumsMounted;
        f.classList.remove("auto-qs-drums", "auto-qs-drums--mobile", "auto-qs-drums--desktop");
        await mountAutoSearchDrums(f);
      } catch (drumError) {
        console.warn("Desk kereső dobkerék:", drumError);
      }
      /* Önálló fehér Gyártmány & Modell kártya (pill) — ne duplikálja a drums sort. */
      try {
        await mountAutoBrandModelPicker(f);
        f.querySelectorAll(
          '#qs-layout-main [data-qs-field="gyartmany"], #qs-layout-main [data-qs-field="modell"], #qs-layout-main [data-qs-field="tipus"], #qs-layout-main [data-wheel="gyartmany"], #qs-layout-main [data-wheel="modell"]'
        ).forEach((el) => {
          const cell = el.closest(".home-qs-grid-cell, .immo-schema-cell, .immo-dual-range-block") || el;
          cell.hidden = true;
          cell.style.setProperty("display", "none", "important");
        });
      } catch (bmError) {
        console.warn("Gyártmány/Modell picker:", bmError);
      }
      try {
        await mountAutoFuelPicker(f);
      } catch (fuelError) {
        console.warn("Üzemanyag picker:", fuelError);
      }
      try {
        refillAutoSearchRangeSelects(f);
        syncAutoSearchAccShell(f);
        updateAutoDeskAccSummaries(f);
      } catch {
        /* ignore */
      }
    })().finally(() => {
      deskMenuMountPromise = null;
    });

    return deskMenuMountPromise;
  }

  initAutoDeskSearch({
    mountDetailed: (f) => mountDetailedSearch(f, { force: true }),
    onSortChange: (sort) => onDeskSortChange?.(sort),
    onDeskLayout: mountDeskFilterMenu,
    onModeChange: (mode) => {
      if (mode === "reszletes" || mode === "muszaki-open") {
        void mountMuszakiPickersLazy().then(() => {
          try {
            refillAutoSearchRangeSelects(form);
            enhanceDeskDualRanges(form);
            updateAutoDeskAccSummaries(form);
          } catch {
            /* ignore */
          }
        });
      }
    },
  });

  form.querySelector("[data-desk-reset]")?.addEventListener("click", () => {
    form.reset();
  });

  function qsHasFields() {
    return Boolean(
      form.querySelector(
        "#qs-layout-main [data-qs-field], #qs-layout-main [data-wheel], .auto-desk-fields [data-desk-field], .auto-desk-fields [data-qs-field]"
      )
    );
  }

  function clearQsStatus() {
    if (!statusEl) return;
    statusEl.hidden = true;
    statusEl.textContent = "";
  }

  function showQsStatus(message) {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = message;
  }

  function finishQsBoot({ deskAuto = false, ok = true } = {}) {
    setQsReady(true);
    try {
      updateAutoDeskAccSummaries(form);
    } catch (sumError) {
      console.warn("Desk összefoglaló:", sumError);
    }
    onReady?.();
    resolveReady?.();
    window.clearTimeout(bootFailsafe);
    if (ok || qsHasFields()) clearQsStatus();
    else {
      showQsStatus("A kereső elrendezés nem töltődött be. Hard refresh, majd szerver újraindítás.");
    }
  }

  function mountMuszakiPickersLazy() {
    const hasDrum = (key) =>
      Boolean(form.querySelector(`[data-qs-field="${key}"] .immo-wheel-trigger, [data-wheel="${key}"]`));
    const mountSafe = (fn, label) =>
      fn(form).catch((error) => {
        console.warn(label, error);
      });
    return Promise.all([
      hasDrum("sebessegvalto") ? Promise.resolve() : mountSafe(mountAutoSebessegvaltoPicker, "Sebességváltó picker:"),
      hasDrum("okmany_jelleg") ? Promise.resolve() : mountSafe(mountAutoOkmanyPicker, "Okmány picker:"),
      mountSafe(mountAutoToltoPickers, "Töltőcsatlakozó picker:"),
    ]).then(() => {
      try {
        refillAutoSearchRangeSelects(form);
        enhanceDeskDualRanges(form);
        updateAutoDeskAccSummaries(form);
      } catch {
        /* ignore */
      }
    });
  }

  applyAutoSearchLayout(form)
    .then(async () => {
      const page = document.body?.getAttribute("data-site-page");
      const deskAuto =
        (page === "auto" || page === "teherauto") &&
        window.matchMedia(DESK_MQ).matches;
      const mountSafe = (fn, label) =>
        fn(form).catch((error) => {
          console.warn(label, error);
        });
      try {
        if (!deskAuto) {
          try {
            await mountAutoSearchDrums(form);
          } catch (drumError) {
            console.warn("Kereső dobkerék:", drumError);
          }
        } else {
          /* Single path with onDeskLayout — avoids double Gyártmány/Modell (+ Típus) rows. */
          await mountDeskFilterMenu(form);
        }
        // Empty "success" (poisoned session cache) — one forced remount before giving up.
        if (!qsHasFields() && !deskAuto) {
          await applyAutoSearchLayout(form, { force: true }).catch(() => null);
          try {
            await mountAutoSearchDrums(form);
          } catch (retryDrumError) {
            console.warn("Kereső dobkerék retry:", retryDrumError);
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
        finishQsBoot({ deskAuto, ok: qsHasFields() });
      } catch (bootError) {
        console.warn("Kereső boot:", bootError);
        throw bootError;
      }
    })
    .catch(async (error) => {
      console.warn("Kereső elrendezés:", error);
      const page = document.body?.getAttribute("data-site-page");
      const deskAuto =
        (page === "auto" || page === "teherauto") &&
        window.matchMedia(DESK_MQ).matches;
      const mountSafe = (fn, label) =>
        fn(form).catch((err) => {
          console.warn(label, err);
        });
      let recovered = qsHasFields();
      if (!recovered && deskAuto) {
        try {
          await applyAutoSearchLayout(form, { force: true }).catch(() => null);
          await mountDeskFilterMenu(form);
          recovered = qsHasFields();
        } catch (deskError) {
          console.warn("Desk fallback kereső:", deskError);
        }
      } else if (!recovered) {
        try {
          await applyAutoSearchLayout(form, { force: true }).catch(() => null);
          await mountAutoSearchDrums(form);
          recovered = qsHasFields();
          if (!recovered) {
            form.querySelectorAll(".home-qs-static-legacy").forEach((el) => {
              el.hidden = false;
              el.removeAttribute("aria-hidden");
              el.style.setProperty("display", "flex", "important");
            });
            recovered = Boolean(form.querySelector(".home-qs-static-legacy select, .home-qs-static-legacy [data-filter-key]"));
          }
        } catch (mobileError) {
          console.warn("Mobil kereső fallback:", mobileError);
        }
      }
      finishQsBoot({ deskAuto, ok: recovered });
    });

  async function applySavedFilters(filters) {
    const { applySavedSearchFilters } = await import("./saved-search.js?v=ae250042e8");
    await applySavedSearchFilters(form, filters || {});
    updateAutoDeskAccSummaries(form);
    // A mentett payload a forrás — ne a form újraolvasása (picker race miatt üres lehet).
    await onSearch({ ...(filters || {}) });
  }

  return {
    readQuickSearchValues: () => readQuickSearchValues(),
    applySavedFilters,
    whenReady,
  };
}

export { readDetailedSearchValues } from "./auto-detailed-search.js?v=18415b7f87";
