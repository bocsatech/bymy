/**
 * Gyorskereső az autó hero panelen — elrendezés: GET /api/level1/form-layout?category=szemelyauto-search
 */

import { applyAutoSearchLayout, readLayoutFilterValues } from "./auto-search-layout.js?v=colSpan1";
import { mountAutoSearchDrums, readAutoDrumFilterValues, resetAutoSearchDrums } from "./auto-search-drums.js?v=autoDrums15";

const MOBILE_MQ = "(max-width: 900px)";

export function initHomeQuickSearch({ onSearch = () => {} } = {}) {
  const form = document.getElementById("home-qs-form");
  if (!form) return;

  const hero = document.querySelector("[data-auto-search-hero]");
  const morePanel = document.getElementById("qs-more");
  const advancedBtn = document.getElementById("qs-reszletes");
  const statusEl = document.getElementById("home-qs-status");
  const mobile = () => window.matchMedia(MOBILE_MQ).matches;

  function readQuickSearchValues() {
    if (form.dataset.drumsMounted === "1") return readAutoDrumFilterValues(form);
    return readLayoutFilterValues(form);
  }

  function setMoreOpen(open) {
    if (!morePanel || !advancedBtn) return;
    morePanel.hidden = !open;
    morePanel.classList.toggle("is-open", open);
    advancedBtn.setAttribute("aria-expanded", open ? "true" : "false");
    advancedBtn.textContent = open ? "Kevesebb szűrő" : "Több szűrő";
    hero?.classList.toggle("is-more-open", open);
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
      setMoreOpen(false);
      onSearch({});
    });
  });

  advancedBtn?.addEventListener("click", () => {
    setMoreOpen(!morePanel.classList.contains("is-open"));
  });

  setMoreOpen(false);
  setQsReady(false);

  applyAutoSearchLayout(form)
    .then(async () => {
      await mountAutoSearchDrums(form);
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
