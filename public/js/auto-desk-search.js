/**
 * Autó oldal — asztali kereső: Gyors / Részletes + demó mezősorrend.
 * Csak desktop (min-width 901px), data-site-page=auto|teherauto.
 */

const DESK_MQ = "(min-width: 901px)";

function isVehicleDeskPage() {
  const page = document.body?.getAttribute("data-site-page");
  return page === "auto" || page === "teherauto";
}

/** Fallback sorrend, ha nincs admin layout. */
const DESK_ALAP_FALLBACK = [
  { field: "gyartmany", label: "Gyártmány" },
  { field: "modell", label: "Modell" },
  { field: "gyartasi_ev", label: "Évjárat", range: true },
  { field: "vetelar", label: "Vételár", range: true },
  { field: "uzemanyag", label: "Üzemanyag" },
  { field: "kivitel", label: "Kivitel" },
];

function deskOrderFromAdminLayout(mainHost) {
  if (!mainHost) return [];
  const gridCells = [...mainHost.querySelectorAll(".home-qs-grid-cell")];
  gridCells.sort((a, b) => {
    const ra = Number(a.dataset.gridRow) || 0;
    const rb = Number(b.dataset.gridRow) || 0;
    if (ra !== rb) return ra - rb;
    return (Number(a.dataset.gridCol) || 0) - (Number(b.dataset.gridCol) || 0);
  });
  const order = [];
  for (const gridCell of gridCells) {
    const wrap = gridCell.querySelector("[data-qs-field]");
    if (!wrap) continue;
    const field = wrap.getAttribute("data-qs-field");
    if (!field) continue;
    const label = wrap.querySelector(".home-qs-label, .immo-label")?.textContent?.trim() || field;
    const range =
      wrap.classList.contains("home-qs-pair") ||
      Boolean(wrap.querySelector(".home-qs-pair")) ||
      wrap.querySelectorAll("select.home-qs-control").length >= 2;
    order.push({ field, label, range });
  }
  return order;
}

function isAutoDesk() {
  return isVehicleDeskPage() && window.matchMedia(DESK_MQ).matches;
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

function findFieldWrap(form, fieldKey) {
  return (
    form.querySelector(`[data-qs-field="${fieldKey}"]`) ||
    form
      .querySelector(`[data-filter-key="${fieldKey}"]`)
      ?.closest("[data-qs-field], .home-qs-field, .home-qs-pair, label") ||
    null
  );
}

function ensureDeskSelectPlaceholders(wrap, range) {
  if (!wrap) return;
  const selects = [...wrap.querySelectorAll("select")];
  selects.forEach((sel, i) => {
    const first = sel.querySelector("option");
    if (!first) return;
    if (range) {
      if (!first.value) first.textContent = i === 0 ? "-tól" : "-ig";
    } else if (!first.value) {
      first.textContent = "Mindegy";
    }
  });
}

/**
 * Demó Alap sorrend: meglévő layout mezőket átrendezi natív selectként.
 * Gyors mód: csak az 1. lépés (admin gyorskereső) mezői látszanak.
 */
export function arrangeAutoDeskDemoFields(form = document.getElementById("home-qs-form")) {
  if (!form || !isAutoDesk()) return;
  const alapBody = form.querySelector('[data-desk-acc="alap"] .auto-desk-acc__body');
  const muszakiBody = form.querySelector('[data-desk-acc="muszaki"] .auto-desk-acc__body');
  if (!alapBody) return;

  const mainHost = document.getElementById("qs-layout-main");
  const moreHost = document.getElementById("qs-more-layout");

  // Admin / layout 1. lépés = eddigi gyorskereső mezők
  let quickKeys = new Set();
  if (form.dataset.deskQuickKeys) {
    form.dataset.deskQuickKeys.split(",").filter(Boolean).forEach((k) => quickKeys.add(k));
  } else if (mainHost) {
    mainHost.querySelectorAll("[data-qs-field]").forEach((el) => {
      const key = el.getAttribute("data-qs-field");
      if (key) quickKeys.add(key);
    });
    form.dataset.deskQuickKeys = [...quickKeys].join(",");
  }
  if (!quickKeys.size) {
    // Fallback: alapértelmezett gyorskereső
    ["gyartmany", "modell", "uzemanyag", "gyartasi_ev", "vetelar"].forEach((k) => quickKeys.add(k));
    form.dataset.deskQuickKeys = [...quickKeys].join(",");
  }

  let host = alapBody.querySelector(".auto-desk-fields[data-desk-alap]");
  if (!host) {
    host = document.createElement("div");
    host.className = "auto-desk-fields";
    host.dataset.deskAlap = "1";
    alapBody.insertBefore(host, alapBody.firstChild);
  }
  host.innerHTML = "";

  const used = new Set();
  const order = deskOrderFromAdminLayout(mainHost);
  const fieldOrder = order.length ? order : DESK_ALAP_FALLBACK;

  for (const item of fieldOrder) {
    const wrap = findFieldWrap(form, item.field);
    if (!wrap || host.contains(wrap)) continue;
    used.add(item.field);

    const field = document.createElement("div");
    field.className = "auto-desk-field";
    field.dataset.deskField = item.field;
    field.dataset.deskQuick = quickKeys.has(item.field) ? "1" : "0";

    const label = document.createElement("span");
    label.className = "auto-desk-field__label";
    label.textContent = item.label;
    field.appendChild(label);

    wrap.querySelectorAll(".home-qs-label, .immo-label").forEach((el) => {
      el.style.display = "none";
    });

    ensureDeskSelectPlaceholders(wrap, item.range);

    if (item.range) {
      const range = document.createElement("div");
      range.className = "auto-desk-range";
      const selects = [...wrap.querySelectorAll("select")];
      if (selects.length >= 2) {
        selects.slice(0, 2).forEach((sel) => range.appendChild(sel));
        field.appendChild(range);
        wrap.remove();
      } else {
        field.appendChild(wrap);
      }
    } else {
      const sel = wrap.querySelector("select, input");
      if (sel && wrap.matches("label, .home-qs-field, .home-qs-pair")) {
        field.appendChild(sel);
        wrap.remove();
      } else {
        field.appendChild(wrap);
      }
    }

    host.appendChild(field);
  }

  const leftovers = [];
  [mainHost, moreHost].forEach((root) => {
    if (!root) return;
    root.querySelectorAll("[data-qs-field]").forEach((el) => {
      const key = el.getAttribute("data-qs-field");
      if (!key || used.has(key)) return;
      if (host.contains(el) || el.closest(".auto-desk-fields")) return;
      leftovers.push(el);
    });
  });

  if (muszakiBody && leftovers.length) {
    let moreWrap = muszakiBody.querySelector("#qs-more");
    if (!moreWrap) {
      moreWrap = document.createElement("div");
      moreWrap.id = "qs-more";
      moreWrap.className = "home-qs-more";
      muszakiBody.appendChild(moreWrap);
    }
    moreWrap.hidden = false;
    let catcher = moreWrap.querySelector("[data-desk-more-rest]");
    if (!catcher) {
      catcher = document.createElement("div");
      catcher.className = "auto-desk-fields";
      catcher.dataset.deskMoreRest = "1";
      moreWrap.appendChild(catcher);
    }
    leftovers.forEach((el) => catcher.appendChild(el));
  }

  if (mainHost) {
    mainHost.innerHTML = "";
    mainHost.hidden = true;
  }

  form.classList.add("auto-desk-native");
  syncGyorsFieldVisibility(form);

}

function syncGyorsFieldVisibility(form = document.getElementById("home-qs-form")) {
  if (!form) return;
  const gyors = document.body.classList.contains("auto-desk-gyors");
  form.querySelectorAll(".auto-desk-fields[data-desk-alap] .auto-desk-field").forEach((el) => {
    const isQuick = el.getAttribute("data-desk-quick") === "1";
    el.hidden = gyors && !isQuick;
  });
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
  if (!isVehicleDeskPage()) return;

  const form = document.getElementById("home-qs-form");
  const morePanel = document.getElementById("qs-more");
  const detailedPanel = document.getElementById("qs-detailed-panel");
  const advancedBtn = document.getElementById("qs-reszletes");
  const detailedBtn = document.getElementById("qs-detailed");

  setMode("gyors");
  openAccordion("alap");
  updateAutoDeskAccSummaries(form);

  if (isAutoDesk()) {
    if (morePanel) {
      morePanel.hidden = true;
      morePanel.classList.remove("is-open");
    }
    if (detailedPanel) {
      detailedPanel.hidden = true;
      detailedPanel.classList.remove("is-open");
    }
    syncGyorsFieldVisibility(form);
  }

  document.querySelectorAll("[data-desk-mode]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!isAutoDesk()) return;
      const mode = btn.getAttribute("data-desk-mode");
      const gyors = setMode(mode);
      syncGyorsFieldVisibility(form);
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
