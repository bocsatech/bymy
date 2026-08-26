/**
 * Gyorskereső az autó hero panelen — elrendezés: GET /api/level1/form-layout?category=szemelyauto-search
 */

import { applyAutoSearchLayout, readLayoutFilterValues } from "./auto-search-layout.js?v=cityPostal1";
import { mountAutoSearchDrums, readAutoDrumFilterValues, resetAutoSearchDrums } from "./auto-search-drums.js?v=korzet1";
import {
  mountDetailedSearch,
  readDetailedSearchValues,
  resetDetailedSearch,
} from "./auto-detailed-search.js?v=detailedSearch1";

const MOBILE_MQ = "(max-width: 900px)";

export function initHomeQuickSearch({ onSearch = () => {} } = {}) {
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
    const detailed = readDetailedSearchValues(form);
    return { ...base, detailed };
  }

  function setMoreOpen(open) {
    if (!morePanel || !advancedBtn) return;
    morePanel.hidden = !open;
    morePanel.classList.toggle("is-open", open);
    advancedBtn.setAttribute("aria-expanded", open ? "true" : "false");
    advancedBtn.textContent = open ? "Kevesebb szűrő" : "Több szűrő";
    hero?.classList.toggle("is-more-open", open);
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
    if (willOpen) setDetailedOpen(false);
    setMoreOpen(willOpen);
  });

  detailedBtn?.addEventListener("click", () => {
    const willOpen = !detailedPanel.classList.contains("is-open");
    if (willOpen) setMoreOpen(false);
    setDetailedOpen(willOpen);
  });

  setMoreOpen(false);
  setDetailedOpen(false);
  setQsReady(false);
  if (detailedPanel) mountDetailedSearch(form);

  applyAutoSearchLayout(form)
    .then(async () => {
      try {
        await mountAutoSearchDrums(form);
      } catch (drumError) {
        console.warn("Kereső dobkerék:", drumError);
      }
      const urlKivitel = new URLSearchParams(window.location.search).get("kivitel");
      if (urlKivitel) {
        const el =
          form.querySelector("#qs-kivitel") ||
          form.querySelector('[name="kivitel"]') ||
          form.querySelector('[data-filter-key="kivitel"]');
        if (el && "value" in el) el.value = urlKivitel;
      }
      setQsReady(true);
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

export { readDetailedSearchValues } from "./auto-detailed-search.js?v=detailedSearch1";
