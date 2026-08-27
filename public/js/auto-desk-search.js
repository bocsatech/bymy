/**
 * Autó oldal — asztali kereső: Gyors / Részletes (app menüszerkezet).
 * Csak desktop (min-width 901px), data-site-page=auto.
 */

const DESK_MQ = "(min-width: 901px)";

function isAutoDesk() {
  return (
    document.body?.getAttribute("data-site-page") === "auto" &&
    window.matchMedia(DESK_MQ).matches
  );
}

function setMode(mode) {
  const gyors = mode !== "reszletes";
  document.body.classList.toggle("auto-desk-gyors", gyors);
  document.body.classList.toggle("auto-desk-reszletes", !gyors);
  document.querySelectorAll("[data-desk-mode]").forEach((btn) => {
    const on = btn.getAttribute("data-desk-mode") === (gyors ? "gyors" : "reszletes");
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  return gyors;
}

function openAccordion(id) {
  document.querySelectorAll("[data-desk-acc]").forEach((el) => {
    const on = el.getAttribute("data-desk-acc") === id;
    el.classList.toggle("is-open", on);
    const btn = el.querySelector("[data-desk-acc-toggle]");
    if (btn) btn.setAttribute("aria-expanded", on ? "true" : "false");
  });
}

export function initAutoDeskSearch({
  onModeChange,
  mountDetailed,
} = {}) {
  if (document.body?.getAttribute("data-site-page") !== "auto") return;

  const form = document.getElementById("home-qs-form");
  const morePanel = document.getElementById("qs-more");
  const detailedPanel = document.getElementById("qs-detailed-panel");
  const advancedBtn = document.getElementById("qs-reszletes");
  const detailedBtn = document.getElementById("qs-detailed");

  setMode("gyors");
  openAccordion("alap");

  document.querySelectorAll("[data-desk-mode]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!isAutoDesk()) return;
      const mode = btn.getAttribute("data-desk-mode");
      const gyors = setMode(mode);
      if (gyors) {
        if (morePanel) {
          morePanel.hidden = true;
          morePanel.classList.remove("is-open");
        }
        if (detailedPanel) {
          detailedPanel.hidden = true;
          detailedPanel.classList.remove("is-open");
        }
        openAccordion("alap");
      } else {
        if (morePanel) {
          morePanel.hidden = false;
          morePanel.classList.add("is-open");
        }
        openAccordion("alap");
        try {
          await mountDetailed?.(form);
          if (detailedPanel) {
            detailedPanel.hidden = false;
            detailedPanel.classList.add("is-open");
          }
        } catch (error) {
          console.warn("Részletes panel:", error);
        }
      }
      onModeChange?.(gyors ? "gyors" : "reszletes");
    });
  });

  document.querySelectorAll("[data-desk-acc-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isAutoDesk() || document.body.classList.contains("auto-desk-gyors")) return;
      const acc = btn.closest("[data-desk-acc]");
      const id = acc?.getAttribute("data-desk-acc");
      if (!id) return;
      const wasOpen = acc.classList.contains("is-open");
      openAccordion(wasOpen ? "" : id);
    });
  });

  // Asztali: régi Több szűrő / Részletes gombok ne zavarjanak
  function syncChrome() {
    const desk = isAutoDesk();
    document.body.classList.toggle("auto-desk-active", desk);
    if (desk) {
      if (advancedBtn) advancedBtn.hidden = true;
      if (detailedBtn) detailedBtn.hidden = true;
      if (document.body.classList.contains("auto-desk-gyors")) {
        if (morePanel) {
          morePanel.hidden = true;
          morePanel.classList.remove("is-open");
        }
        if (detailedPanel) {
          detailedPanel.hidden = true;
          detailedPanel.classList.remove("is-open");
        }
      }
    } else {
      if (advancedBtn) advancedBtn.hidden = false;
      document.body.classList.remove("auto-desk-gyors", "auto-desk-reszletes");
    }
  }

  syncChrome();
  window.matchMedia(DESK_MQ).addEventListener("change", syncChrome);
}

export function updateAutoDeskResultCount(n) {
  const el = document.querySelector("[data-desk-result-count]");
  if (!el) return;
  const count = Number(n) || 0;
  el.textContent = `${count.toLocaleString("hu-HU")} találat`;
}
