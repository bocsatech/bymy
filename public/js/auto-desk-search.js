/**
 * Autó oldal — asztali kereső: Gyors / Részletes + találati sáv.
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
    const on = Boolean(id) && el.getAttribute("data-desk-acc") === id;
    el.classList.toggle("is-open", on);
    const btn = el.querySelector("[data-desk-acc-toggle]");
    if (btn) btn.setAttribute("aria-expanded", on ? "true" : "false");
  });
}

function filledControl(el) {
  if (!el) return false;
  if (el.type === "checkbox" || el.type === "radio") return el.checked;
  return String(el.value ?? "").trim() !== "";
}

function countFilled(root) {
  if (!root) return 0;
  const seen = new Set();
  let n = 0;
  root.querySelectorAll("select, input, [data-filter-key], [data-wheel]").forEach((el) => {
    if (el.closest("[hidden]")) return;
    if (el.type === "hidden" && !el.matches("[data-filter-key],[data-wheel]")) return;
    const key =
      el.getAttribute("data-filter-key") ||
      el.getAttribute("data-wheel") ||
      el.id ||
      el.name ||
      "";
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    if (filledControl(el)) n += 1;
  });
  return n;
}

export function updateAutoDeskAccSummaries(form = document.getElementById("home-qs-form")) {
  if (!form) return;
  const map = {
    alap: form.querySelector('[data-desk-acc="alap"] .auto-desk-acc__body'),
    muszaki: form.querySelector('[data-desk-acc="muszaki"] .auto-desk-acc__body'),
    extrak: form.querySelector('[data-desk-acc="extrak"] .auto-desk-acc__body'),
  };
  for (const [id, body] of Object.entries(map)) {
    const sum = form.querySelector(`[data-desk-acc="${id}"] [data-desk-acc-sum]`);
    if (!sum) continue;
    const n = countFilled(body);
    sum.textContent = n > 0 ? `${n} feltétel` : "Mindegy";
  }
}

export function updateAutoDeskResultCount(n) {
  const el = document.querySelector("[data-desk-result-count]");
  if (!el) return;
  const count = Number(n) || 0;
  el.textContent = `${count.toLocaleString("hu-HU")} találat`;
}

/**
 * @param {{
 *   onModeChange?: (mode: string) => void,
 *   mountDetailed?: (form: HTMLElement) => Promise<unknown>,
 *   onSortChange?: (sort: string) => void,
 *   onViewChange?: (view: 'grid' | 'list') => void,
 * }} [opts]
 */
export function initAutoDeskSearch({
  onModeChange,
  mountDetailed,
  onSortChange,
  onViewChange,
} = {}) {
  if (document.body?.getAttribute("data-site-page") !== "auto") return;

  const form = document.getElementById("home-qs-form");
  const morePanel = document.getElementById("qs-more");
  const detailedPanel = document.getElementById("qs-detailed-panel");
  const advancedBtn = document.getElementById("qs-reszletes");
  const detailedBtn = document.getElementById("qs-detailed");

  setMode("reszletes");
  openAccordion("alap");
  updateAutoDeskAccSummaries(form);

  // Demó kinézet: Részletes nyitva indul asztalon
  if (isAutoDesk()) {
    if (morePanel) {
      morePanel.hidden = false;
      morePanel.classList.add("is-open");
    }
    void (async () => {
      try {
        await mountDetailed?.(form);
        if (detailedPanel) {
          detailedPanel.hidden = false;
          detailedPanel.classList.add("is-open");
        }
      } catch (error) {
        console.warn("Részletes panel:", error);
      }
      updateAutoDeskAccSummaries(form);
    })();
  }

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
      updateAutoDeskAccSummaries(form);
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

  form?.addEventListener("change", () => updateAutoDeskAccSummaries(form));
  form?.addEventListener("input", () => updateAutoDeskAccSummaries(form));

  const sortEl = document.querySelector("[data-desk-sort]");
  sortEl?.addEventListener("change", () => {
    onSortChange?.(String(sortEl.value || "newest"));
  });

  document.querySelectorAll("[data-desk-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-desk-view") === "list" ? "list" : "grid";
      document.querySelectorAll("[data-desk-view]").forEach((b) => {
        b.classList.toggle("is-active", b.getAttribute("data-desk-view") === view);
      });
      document.getElementById("home-grid-track")?.classList.toggle("is-list-view", view === "list");
      onViewChange?.(view);
    });
  });

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
      updateAutoDeskAccSummaries(form);
    } else {
      if (advancedBtn) advancedBtn.hidden = false;
      document.body.classList.remove("auto-desk-gyors", "auto-desk-reszletes");
    }
  }

  syncChrome();
  window.matchMedia(DESK_MQ).addEventListener("change", syncChrome);
}
