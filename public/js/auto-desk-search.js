
const DESK_MQ = "(min-width: 901px)";

function isVehicleDeskPage() {
  const page = document.body?.getAttribute("data-site-page");
  return page === "auto" || page === "teherauto";
}

const DESK_ALAP_FALLBACK = [
  { field: "kivitel", label: "Kivitel" },
  { field: "uzemanyag", label: "Üzemanyag" },
  { field: "gyartasi_ev", label: "Gyártási év", range: true },
  { field: "km", label: "Km óra állás", range: true },
  { field: "vetelar", label: "Vételár", range: true },
];

/** These are owned by mountAutoBrandModelPicker — never mount as plain selects in gyors. */
const BRAND_MODEL_DESK_KEYS = new Set(["gyartmany", "modell", "tipus"]);

function stripStrayBrandModelFields(host) {
  if (!host) return;
  host
    .querySelectorAll(
      '[data-desk-field="gyartmany"]:not(.auto-bm-field), [data-desk-field="modell"]:not(.auto-bm-field), [data-desk-field="tipus"]'
    )
    .forEach((el) => el.remove());
}

/** Desk filter already has mobil dobkerék menü. */
export function deskFilterMenuReady(form = document.getElementById("home-qs-form")) {
  if (!form?.classList.contains("auto-desk-native")) return false;
  /* Csak akkor „kész”, ha tényleg vannak sheet triggerek — ne a üres drumsMounted flag. */
  return Boolean(
    form.querySelector(
      "#qs-layout-main .immo-wheel-trigger, #qs-layout-main .auto-search-bm-combined, #qs-more-layout .immo-wheel-trigger"
    )
  );
}

const DESK_MUSZAKI_FALLBACK = [
  { field: "teljesitmeny_le", label: "Teljesítmény", range: true },
  { field: "sebessegvalto", label: "Sebességváltó" },
  { field: "hajtas", label: "Hajtás" },
  { field: "allapot", label: "Állapot" },
];

const LEGACY_FIELD_IDS = {
  gyartmany: "qs-gyartmany",
  modell: "qs-modell",
  uzemanyag: "qs-uzemanyag",
  gyartasi_ev: "qs-ev-tol",
  vetelar: "qs-ar-tol",
  kivitel: "qs-kivitel",
  allapot: "qs-allapot",
  km: "qs-km-tol",
  teljesitmeny_le: "qs-le-tol",
  sebessegvalto: "qs-sebessegvalto",
  hajtas: "qs-hajtas",
};

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
      wrap.querySelectorAll("select.home-qs-control").length >= 2 ||
      wrap.querySelectorAll("input.home-qs-control").length >= 2;
    order.push({ field, label, range });
  }
  return order;
}

function isAutoDesk() {
  return isVehicleDeskPage() && window.matchMedia(DESK_MQ).matches;
}

function setMode(mode) {
  const next = mode === "reszletes" ? "reszletes" : "gyors";
  document.body.classList.toggle("auto-desk-gyors", next === "gyors");
  document.body.classList.toggle("auto-desk-reszletes", next === "reszletes");
  document.body.classList.remove("auto-desk-ertekbecslo");
  document.querySelectorAll("[data-desk-mode]").forEach((btn) => {
    const on = btn.getAttribute("data-desk-mode") === next;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  const submitBtn = document.querySelector("#home-qs-form .home-qs-submit");
  if (submitBtn) submitBtn.textContent = "Találatok mutatása";
  const form = document.getElementById("home-qs-form");
  if (isAutoDesk()) syncGyorsFieldVisibility(form);
  return next;
}

function openAccordion(id) {
  document.querySelectorAll("[data-desk-acc]").forEach((el) => {
    const on = Boolean(id) && el.getAttribute("data-desk-acc") === id;
    el.classList.toggle("is-open", on);
    const btn = el.querySelector("[data-desk-acc-toggle]");
    if (btn) btn.setAttribute("aria-expanded", on ? "true" : "false");
  });
}

/** Több accordion egyszerre nyitva (mobil teljes menü desken). */
function openAccordions(ids = []) {
  const want = new Set(ids.filter(Boolean));
  document.querySelectorAll("[data-desk-acc]").forEach((el) => {
    const on = want.has(el.getAttribute("data-desk-acc"));
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
  const fromLayout =
    form.querySelector(`.auto-desk-fields [data-qs-field="${fieldKey}"]`) ||
    form.querySelector(`#qs-layout-main [data-qs-field="${fieldKey}"]`) ||
    form.querySelector(`#qs-more-layout [data-qs-field="${fieldKey}"]`) ||
    form.querySelector(`[data-qs-field="${fieldKey}"]`);
  if (fromLayout) return fromLayout;

  const fromFilter = form
    .querySelector(`[data-filter-key="${fieldKey}"]`)
    ?.closest("[data-qs-field], .home-qs-field, .home-qs-pair, label");
  if (fromFilter) return fromFilter;

  const legacyId = LEGACY_FIELD_IDS[fieldKey];
  if (!legacyId) return null;
  const legacyEl = form.querySelector(`#${legacyId}`);
  if (!legacyEl) return null;
  return legacyEl.closest(".home-qs-pair, .home-qs-field, label") || legacyEl;
}

const LEGACY_RANGE_IDS = {
  gyartasi_ev: ["qs-ev-tol", "qs-ev-ig"],
  vetelar: ["qs-ar-tol", "qs-ar-ig"],
  km: ["qs-km-tol", "qs-km-ig"],
  teljesitmeny_le: ["qs-le-tol", "qs-le-ig"],
};

function findLegacyRangeSelects(form, fieldKey) {
  const ids = LEGACY_RANGE_IDS[fieldKey];
  if (!ids) return null;
  const els = ids.map((id) => form.querySelector(`#${id}`)).filter(Boolean);
  return els.length >= 2 ? els : null;
}

function mountDeskField(host, item, form, { quickKeys, used }) {
  if (used.has(item.field)) return false;

  const field = document.createElement("div");
  field.className = "auto-desk-field";
  field.dataset.deskField = item.field;
  field.dataset.deskQuick = quickKeys.has(item.field) ? "1" : "0";

  const label = document.createElement("span");
  label.className = "auto-desk-field__label";
  label.textContent = item.label;
  field.appendChild(label);

  if (item.range) {
    const range = document.createElement("div");
    range.className = "auto-desk-range";
    const wrap = findFieldWrap(form, item.field);
    let pair = null;
    if (wrap) {
      ensureDeskSelectPlaceholders(wrap, true);
      const selects = wrap.matches?.("select")
        ? [wrap]
        : [...wrap.querySelectorAll("select")];
      const inputs = [...wrap.querySelectorAll("input.home-qs-control, input[type='number']")];
      if (selects.length >= 2) pair = selects.slice(0, 2);
      else if (inputs.length >= 2) pair = inputs.slice(0, 2);
    }
    if (!pair) pair = findLegacyRangeSelects(form, item.field);
    if (pair?.length >= 2) {
      pair.forEach((el) => {
        if (!el.querySelector("option")) {
          const opt = document.createElement("option");
          opt.value = "";
          el.appendChild(opt);
        }
        const first = el.querySelector("option");
        if (first && !first.value) {
          first.textContent = pair.indexOf(el) === 0 ? "-tól" : "-ig";
        }
        range.appendChild(el);
      });
      field.appendChild(range);
      if (wrap && !pair.includes(wrap)) wrap.remove();
      used.add(item.field);
      host.appendChild(field);
      return true;
    }
  }

  const wrap = findFieldWrap(form, item.field);
  if (!wrap) return false;
  used.add(item.field);

  wrap.querySelectorAll?.(".home-qs-label, .immo-label")?.forEach((el) => {
    el.style.display = "none";
  });

  ensureDeskSelectPlaceholders(wrap, item.range);

  const sel =
    wrap.matches?.("select, input") ? wrap : wrap.querySelector?.("select, input");
  if (sel) {
    field.appendChild(sel);
    if (wrap !== sel && wrap.matches?.("label, .home-qs-field, .home-qs-pair")) {
      wrap.remove();
    }
  } else {
    field.appendChild(wrap);
  }

  host.appendChild(field);
  return true;
}

function ensureDeskSelectPlaceholders(wrap, range) {
  if (!wrap) return;
  const selects = wrap.matches?.("select")
    ? [wrap]
    : [...wrap.querySelectorAll("select")];
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
 * Desk = mobil menüszerkezet 1:1.
 * NE töröld / NE másold slim auto-desk-fields-be a qs-layout-main / qs-more tartalmát.
 */
export function arrangeAutoDeskDemoFields(form = document.getElementById("home-qs-form")) {
  if (!form || !isAutoDesk()) return;

  const mainHost = document.getElementById("qs-layout-main");
  const moreHost = document.getElementById("qs-more-layout");
  const moreWrap = document.getElementById("qs-more");

  form.querySelectorAll(".home-qs-static-legacy").forEach((el) => {
    el.hidden = true;
    el.style.setProperty("display", "none", "important");
  });

  /* Régi slim desk lista — ne takarja a mobil layoutot */
  form.querySelectorAll(
    ".auto-desk-fields[data-desk-alap], .auto-desk-fields[data-desk-muszaki], .auto-desk-fields[data-desk-more-rest]"
  ).forEach((el) => el.remove());

  if (mainHost) {
    mainHost.hidden = false;
    mainHost.style.removeProperty("display");
    mainHost.style.removeProperty("height");
    mainHost.style.removeProperty("overflow");
  }
  if (moreHost) {
    moreHost.hidden = false;
    moreHost.style.removeProperty("display");
    moreHost.style.removeProperty("height");
    moreHost.style.removeProperty("overflow");
  }
  if (moreWrap) {
    moreWrap.hidden = false;
    moreWrap.classList.add("is-open");
    moreWrap.style.removeProperty("display");
    moreWrap.style.removeProperty("height");
    moreWrap.style.removeProperty("overflow");
  }

  form.classList.add("auto-desk-native");
  form.dataset.deskFullMenu = "1";
  syncGyorsFieldVisibility(form);
  if (isDeskGyorsOnly()) openAccordions(["alap"]);
  else openAccordions(["alap", "muszaki", "extrak"]);
}

function isDeskGyorsOnly() {
  return (
    isAutoDesk() &&
    document.body.classList.contains("auto-desk-gyors") &&
    !document.body.classList.contains("auto-desk-reszletes")
  );
}

export function clearDeskGyorsHideStyles(form = document.getElementById("home-qs-form")) {
  if (!form) return;
  for (const el of [
    form.querySelector("#qs-more"),
    form.querySelector("#qs-more-layout"),
    form.querySelector("#qs-detailed-panel"),
    form.querySelector('[data-desk-acc="extrak"]'),
  ]) {
    if (!el) continue;
    el.style.removeProperty("display");
  }
}

function syncGyorsFieldVisibility(form = document.getElementById("home-qs-form")) {
  if (!form) return;
  if (!isAutoDesk()) {
    clearDeskGyorsHideStyles(form);
    return;
  }
  const gyorsOnly = isDeskGyorsOnly();
  form.querySelectorAll(".auto-desk-fields[data-desk-alap] .auto-desk-field").forEach((el) => {
    el.hidden = false;
    el.style.removeProperty("display");
  });

  const more = form.querySelector("#qs-more");
  const moreLayout = form.querySelector("#qs-more-layout");
  const extrak = form.querySelector('[data-desk-acc="extrak"]');
  const detailed = form.querySelector("#qs-detailed-panel");
  if (gyorsOnly) {
    if (more) {
      more.hidden = true;
      more.classList.remove("is-open");
      more.style.setProperty("display", "none", "important");
    }
    if (moreLayout) {
      moreLayout.hidden = true;
      moreLayout.style.setProperty("display", "none", "important");
    }
    if (extrak) {
      extrak.hidden = true;
      extrak.setAttribute("aria-hidden", "true");
      extrak.style.setProperty("display", "none", "important");
    }
    if (detailed) {
      detailed.hidden = true;
      detailed.classList.remove("is-open");
    }
  } else {
    if (more) {
      more.hidden = false;
      more.classList.add("is-open");
      more.style.removeProperty("display");
    }
    if (moreLayout) {
      moreLayout.hidden = false;
      moreLayout.style.removeProperty("display");
    }
    if (extrak) {
      extrak.hidden = false;
      extrak.removeAttribute("aria-hidden");
      extrak.style.removeProperty("display");
    }
  }

  syncAutoSearchAccShell(form);
}

/** Mobil HTML 1:1: qs-layout-main + qs-more egymás alatt, egy scrollban — nincs Műszaki darabolás. */
export function syncAutoSearchAccShell(form = document.getElementById("home-qs-form")) {
  if (!form || !isAutoDesk()) return;
  const shell = form.querySelector("#auto-search-desk-shell");
  const alap = form.querySelector('#auto-search-desk-shell > [data-desk-acc="alap"], [data-desk-acc="alap"]');
  const muszaki = form.querySelector('#auto-search-desk-shell > [data-desk-acc="muszaki"], [data-desk-acc="muszaki"]');
  if (!shell || !alap) return;

  const brand = form.querySelector(".auto-bm-brand-block, .auto-search-bm-combined")?.closest(".auto-bm-brand-block, .immo-schema-cell, .auto-search-bm-combined")
    || form.querySelector(".auto-bm-brand-block");
  if (brand && brand.classList.contains("auto-bm-brand-block") && (brand.parentElement !== shell || brand.nextElementSibling !== alap)) {
    shell.insertBefore(brand, alap);
  }

  const alapBody = alap.querySelector(":scope > .auto-desk-acc__body");
  if (!alapBody) return;

  const main = form.querySelector("#qs-layout-main");
  const more = form.querySelector("#qs-more");
  const moreLayout = form.querySelector("#qs-more-layout");

  if (main && main.parentElement !== alapBody) {
    alapBody.insertBefore(main, alapBody.firstChild);
  }
  if (main) {
    main.hidden = false;
    main.style.removeProperty("display");
    main.style.removeProperty("height");
    main.style.removeProperty("overflow");
  }

  /* qs-more közvetlenül a main után — mint a mobil HTML, ne külön Műszaki accordionba */
  if (more) {
    if (more.parentElement !== alapBody || more.previousElementSibling !== main) {
      if (main?.nextSibling) alapBody.insertBefore(more, main.nextSibling);
      else alapBody.appendChild(more);
    }
    if (isDeskGyorsOnly()) {
      more.hidden = true;
      more.classList.remove("is-open");
      more.style.setProperty("display", "none", "important");
      if (moreLayout) {
        moreLayout.hidden = true;
        moreLayout.style.setProperty("display", "none", "important");
      }
    } else {
      more.hidden = false;
      more.classList.add("is-open");
      more.style.removeProperty("display");
      more.style.removeProperty("height");
      more.style.removeProperty("overflow");
      if (moreLayout) {
        moreLayout.hidden = false;
        moreLayout.style.removeProperty("display");
      }
    }
  }

  /* Műszaki accordion üres héj — a tartalom a mobil more-ban van */
  if (muszaki) {
    muszaki.hidden = true;
    muszaki.classList.remove("is-open");
    muszaki.setAttribute("aria-hidden", "true");
    muszaki.style.setProperty("display", "none", "important");
  }

  alap.classList.add("is-open");
  alap.hidden = false;
  alap.querySelector("[data-desk-acc-toggle]")?.setAttribute("aria-expanded", "true");
  /* Accordion fej elrejtve: a mobil Alapadatok kártyacím elég */
  alap.querySelector(".auto-desk-acc__head")?.setAttribute("hidden", "");
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

export function initAutoDeskSearch({
  onModeChange,
  mountDetailed,
  onSortChange,
  onViewChange,
  onDeskLayout,
} = {}) {
  if (!isVehicleDeskPage()) return;

  const form = document.getElementById("home-qs-form");
  const morePanel = document.getElementById("qs-more");
  const detailedPanel = document.getElementById("qs-detailed-panel");
  const advancedBtn = document.getElementById("qs-reszletes");
  const detailedBtn = document.getElementById("qs-detailed");
  let deskLayoutGen = 0;

  async function ensureDetailedOnDesk() {
    if (!isAutoDesk()) return;
    try {
      await mountDetailed?.(form);
      if (detailedPanel) {
        detailedPanel.hidden = false;
        detailedPanel.classList.add("is-open");
      }
    } catch (error) {
      console.warn("Extrák panel:", error);
    }
  }

  if (isAutoDesk()) {
    setMode("gyors");
    openAccordions(["alap"]);
    syncGyorsFieldVisibility(form);
  } else {
    document.body.classList.remove("auto-desk-gyors", "auto-desk-reszletes", "auto-desk-ertekbecslo");
    clearDeskGyorsHideStyles(form);
    openAccordions(["alap", "muszaki", "extrak"]);
  }
  updateAutoDeskAccSummaries(form);

  document.querySelectorAll("[data-desk-mode]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!isAutoDesk()) return;
      const mode = btn.getAttribute("data-desk-mode") || "gyors";
      const next = setMode(mode);
      syncGyorsFieldVisibility(form);
      if (next === "reszletes") {
        openAccordions(["alap", "muszaki", "extrak"]);
        await ensureDetailedOnDesk();
      } else {
        openAccordions(["alap"]);
      }
      updateAutoDeskAccSummaries(form);
      onModeChange?.(next);
    });
  });

  document.querySelectorAll("[data-desk-acc-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!isAutoDesk()) return;
      /* Native desk kereső = mobil lapos menü — ne accordionozzon. */
      if (form.classList.contains("auto-desk-native")) return;
      const acc = btn.closest("[data-desk-acc]");
      const id = acc?.getAttribute("data-desk-acc");
      if (!id) return;
      const wasOpen = acc.classList.contains("is-open");
      const scrollY = window.scrollY;
      openAccordion(wasOpen ? "" : id);
      if (!wasOpen && id === "extrak") {
        try {
          await mountDetailed?.(form);
          if (detailedPanel) {
            detailedPanel.hidden = false;
            detailedPanel.classList.add("is-open");
          }
        } catch (error) {
          console.warn("Extrák panel:", error);
        }
      }
      if (!wasOpen && id === "muszaki") {
        onModeChange?.("muszaki-open");
      }
      window.scrollTo(0, scrollY);
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
        if (wasOpen || !acc) return;
        const panel =
          document.querySelector(".home-main.auto-desk-main > .auto-search-hero") ||
          document.querySelector(".auto-search-hero");
        const head = acc.querySelector(".auto-desk-acc__head");
        if (!panel || !head) return;
        const panelRect = panel.getBoundingClientRect();
        const headRect = head.getBoundingClientRect();
        const delta = headRect.top - panelRect.top - 8;
        if (Math.abs(delta) > 2) panel.scrollTop += delta;
      });
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

  function deskFieldsMounted() {
    return Boolean(
      form?.querySelector(
        "#qs-layout-main [data-qs-field], #qs-more-layout [data-qs-field], .auto-bm-brand-block, .auto-bm-pair"
      )
    );
  }

  async function syncChrome({ fromChange = false } = {}) {
    const desk = isAutoDesk();
    const wasDesk = document.body.classList.contains("auto-desk-active");
    document.body.classList.toggle("auto-desk-active", desk);
    if (desk) {
      if (advancedBtn) advancedBtn.hidden = true;
      if (detailedBtn) detailedBtn.hidden = true;
      if (
        !document.body.classList.contains("auto-desk-gyors") &&
        !document.body.classList.contains("auto-desk-reszletes")
      ) {
        setMode("gyors");
      }
      if (document.body.classList.contains("auto-desk-reszletes")) {
        if (morePanel) {
          morePanel.hidden = false;
          morePanel.classList.add("is-open");
        }
        openAccordions(["alap", "muszaki", "extrak"]);
      } else {
        openAccordions(["alap"]);
      }
      /* After resize into desk (or empty sidebar): rebuild filter rows */
      const enteredDesk = fromChange && !wasDesk;
      const emptyDesk = deskFieldsMounted() === false;
      if ((enteredDesk || (fromChange && emptyDesk) || (!fromChange && wasDesk && emptyDesk)) && typeof onDeskLayout === "function") {
        const gen = ++deskLayoutGen;
        try {
          await onDeskLayout(form);
        } catch (error) {
          console.warn("Desk kereső újraépítés:", error);
        }
        if (gen !== deskLayoutGen) return;
        syncGyorsFieldVisibility(form);
      } else {
        syncGyorsFieldVisibility(form);
      }
      if (document.body.classList.contains("auto-desk-reszletes")) {
        await ensureDetailedOnDesk();
      }
      updateAutoDeskAccSummaries(form);
    } else {
      if (advancedBtn) advancedBtn.hidden = false;
      document.body.classList.remove("auto-desk-gyors", "auto-desk-reszletes", "auto-desk-ertekbecslo");
      clearDeskGyorsHideStyles(form);
      const submitBtn = document.querySelector("#home-qs-form .home-qs-submit");
      if (submitBtn) submitBtn.textContent = "Találatok mutatása";
    }
  }

  syncChrome();
  window.matchMedia(DESK_MQ).addEventListener("change", () => {
    void syncChrome({ fromChange: true });
  });
}
