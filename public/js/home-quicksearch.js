/**
 * Gyorskereső az autó hero panelen — elrendezés: GET /api/level1/form-layout?category=szemelyauto-search
 */

import { applyAutoSearchLayout, readLayoutFilterValues } from "./auto-search-layout.js?v=searchLayout3";

export function initHomeQuickSearch({ onSearch = () => {} } = {}) {
  const form = document.getElementById("home-qs-form");
  if (!form) return;

  const hero = document.querySelector("[data-auto-search-hero]");
  const morePanel = document.getElementById("qs-more");
  const advancedBtn = document.getElementById("qs-reszletes");
  const statusEl = document.getElementById("home-qs-status");

  function readQuickSearchValues() {
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSearch(readQuickSearchValues());
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      form.querySelector("#qs-gyartmany")?.dispatchEvent(new Event("change"));
      setMoreOpen(false);
      onSearch({});
    });
  });

  advancedBtn?.addEventListener("click", () => {
    setMoreOpen(!morePanel.classList.contains("is-open"));
  });

  setMoreOpen(false);

  applyAutoSearchLayout(form)
    .then(() => {
      if (statusEl) {
        statusEl.hidden = true;
        statusEl.textContent = "";
      }
    })
    .catch((error) => {
      console.warn("Kereső elrendezés:", error);
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "A kereső elrendezés nem töltődött be. Hard refresh, majd szerver újraindítás.";
      }
    });
}
