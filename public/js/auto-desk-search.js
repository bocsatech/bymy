
const DESK_MQ = "(min-width: 901px)";

function isVehicleDeskPage() {
  const page = document.body?.getAttribute("data-site-page");
  return page === "auto" || page === "teherauto";
}

const DESK_ALAP_FALLBACK = [
  { field: "gyartmany", label: "Gyártmány" },
  { field: "modell", label: "Modell" },
  { field: "gyartasi_ev", label: "Évjárat", range: true },
  { field: "vetelar", label: "Vételár", range: true },
  { field: "uzemanyag", label: "Üzemanyag" },
  { field: "kivitel", label: "Kivitel" },
  { field: "allapot", label: "Állapot" },
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

/** Desk filter already has pickers — avoid wiping/remounting (catalog fetch + DOM rebuild). */
export function deskFilterMenuReady(form = document.getElementById("home-qs-form")) {
  if (!form?.classList.contains("auto-desk-native")) return false;
  if (form.dataset.brandModelPicker !== "1") return false;
  const host = form.querySelector(".auto-desk-fields[data-desk-alap]");
  return Boolean(host?.querySelector(".auto-bm-pair"));
}

const DESK_MUSZAKI_FALLBACK = [
  { field: "km", label: "Futott km", range: true },
  { field: "teljesitmeny_le", label: "Teljesítmény", range: true },
  { field: "kivitel", label: "Kivitel" },
  { field: "sebessegvalto", label: "Sebességváltó" },
  { field: "hajtas", label: "Hajtás" },
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
  const next =
    mode === "reszletes" ? "reszletes" : mode === "ertekbecslo" ? "ertekbecslo" : "gyors";
  /* Értékbecslő = ugyanaz a Gyors menü, csak más a submit működés. */
  document.body.classList.toggle("auto-desk-gyors", next === "gyors" || next === "ertekbecslo");
  document.body.classList.toggle("auto-desk-reszletes", next === "reszletes");
  document.body.classList.toggle("auto-desk-ertekbecslo", next === "ertekbecslo");
  document.querySelectorAll("[data-desk-mode]").forEach((btn) => {
    const on = btn.getAttribute("data-desk-mode") === next;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  const submitBtn = document.querySelector("#home-qs-form .home-qs-submit");
  if (submitBtn) {
    submitBtn.textContent = next === "ertekbecslo" ? "Értékbecslés" : "Találatok mutatása";
  }
  const form = document.getElementById("home-qs-form");
  syncGyorsFieldVisibility(form);
  syncErtekModeChrome(form);
  return next;
}

/** Értékbecslő: a Vételár helyére kerül a becsült ár; km látszik (kötelező). */
function syncErtekModeChrome(form = document.getElementById("home-qs-form")) {
  if (!form) return;
  const ertek = document.body.classList.contains("auto-desk-ertekbecslo");
  const alapHost = form.querySelector(".auto-desk-fields[data-desk-alap]");
  const vetelar = form.querySelector('[data-desk-field="vetelar"]');
  let out = form.querySelector("[data-auto-ertek-out]");
  if (!out) {
    out = document.createElement("div");
    out.className = "auto-ertek-out ertek-out";
    out.setAttribute("data-auto-ertek-out", "");
  }

  if (vetelar) {
    const label = vetelar.querySelector(".auto-desk-field__label");
    if (ertek) {
      if (label) {
        if (!vetelar.dataset.ertekLabelOrig) {
          vetelar.dataset.ertekLabelOrig = label.textContent || "Vételár";
        }
        label.textContent = "Becsült ár";
      }
      vetelar.hidden = false;
      vetelar.dataset.deskQuick = "1";
      if (!vetelar.contains(out)) vetelar.appendChild(out);
      out.hidden = false;
      if (!out.dataset.hasResult && !out.querySelector(".ertek-result")) {
        out.innerHTML =
          '<p class="ertek-msg">Itt jelenik meg a becsült ár az Értékbecslés gomb után.</p>';
      }
    } else if (label && vetelar.dataset.ertekLabelOrig) {
      label.textContent = vetelar.dataset.ertekLabelOrig;
    }
  }

  let km = form.querySelector('[data-desk-field="km"]');
  if (ertek && alapHost) {
    if (km && !km.dataset.ertekParked) {
      km.dataset.ertekParked = "1";
      km._ertekHomeParent = km.parentElement;
      km._ertekHomeNext = km.nextSibling;
    }
    if (km && km.parentElement !== alapHost) {
      alapHost.appendChild(km);
    }
    if (km) {
      km.hidden = false;
      km.dataset.deskQuick = "1";
      const kmLabel = km.querySelector(".auto-desk-field__label");
      if (kmLabel) kmLabel.textContent = "Km";
    }
  } else if (km?.dataset.ertekParked === "1") {
    const parent = km._ertekHomeParent;
    const next = km._ertekHomeNext;
    if (parent) {
      if (next && next.parentElement === parent) parent.insertBefore(km, next);
      else parent.appendChild(km);
    }
    delete km.dataset.ertekParked;
    km.hidden = document.body.classList.contains("auto-desk-gyors");
  }

  if (!ertek && out) {
    const actions = form.querySelector(".home-qs-row--actions");
    if (actions?.parentElement && out.parentElement !== actions.parentElement) {
      actions.parentElement.insertBefore(out, actions.nextSibling);
    }
    out.hidden = true;
    out.innerHTML = "";
    delete out.dataset.hasResult;
  }
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

export function arrangeAutoDeskDemoFields(form = document.getElementById("home-qs-form")) {
  if (!form || !isAutoDesk()) return;
  const alapBody = form.querySelector('[data-desk-acc="alap"] .auto-desk-acc__body');
  const muszakiBody = form.querySelector('[data-desk-acc="muszaki"] .auto-desk-acc__body');
  if (!alapBody) return;

  const mainHost = document.getElementById("qs-layout-main");
  const moreHost = document.getElementById("qs-more-layout");

  const quickKeys = new Set((form.dataset.deskQuickKeys || "").split(",").filter(Boolean));
  if (!quickKeys.size) {
    ["gyartmany", "modell", "uzemanyag", "gyartasi_ev", "vetelar", "kivitel", "allapot"].forEach((k) => quickKeys.add(k));
    form.dataset.deskQuickKeys = [...quickKeys].join(",");
  }

  let host = alapBody.querySelector(".auto-desk-fields[data-desk-alap]");
  if (!host) {
    host = document.createElement("div");
    host.className = "auto-desk-fields";
    host.dataset.deskAlap = "1";
    alapBody.insertBefore(host, alapBody.firstChild);
  }

  /* Already built once: keep pickers, only drop stray plain Gyártmány/Modell/Típus. */
  if (deskFilterMenuReady(form)) {
    stripStrayBrandModelFields(host);
    form.classList.add("auto-desk-native");
    syncGyorsFieldVisibility(form);
    return;
  }

  host.innerHTML = "";

  form.querySelectorAll(".home-qs-static-legacy").forEach((el) => {
    el.hidden = true;
    el.style.setProperty("display", "none", "important");
  });

  const used = new Set();
  const mountOpts = { quickKeys, used };
  const order = deskOrderFromAdminLayout(mainHost).filter(
    (item) => quickKeys.has(item.field) && !BRAND_MODEL_DESK_KEYS.has(item.field)
  );
  const fieldOrder = order.length
    ? order
    : DESK_ALAP_FALLBACK.filter((item) => !BRAND_MODEL_DESK_KEYS.has(item.field));

  for (const item of fieldOrder) {
    mountDeskField(host, item, form, mountOpts);
  }
  /* Layout API empty / failed → always show the classic gyors row set (sans brand/model) */
  if (host.children.length < 2) {
    host.innerHTML = "";
    used.clear();
    for (const item of DESK_ALAP_FALLBACK.filter((item) => !BRAND_MODEL_DESK_KEYS.has(item.field))) {
      mountDeskField(host, item, form, mountOpts);
    }
  }
  /* Prevent admin "tipus" / stray brand selects from reappearing next to the picker */
  used.add("gyartmany");
  used.add("modell");
  used.add("tipus");
  const isTeherDesk = document.body?.getAttribute("data-site-page") === "teherauto";
  if (isTeherDesk) {
    for (const k of ["tipus", "csomagtarto", "tetto", "karpit1", "karpit2", "egyeb_tipus", "egyeb_modell"]) {
      used.add(k);
    }
  }

  if (!used.has("kivitel")) {
    mountDeskField(host, { field: "kivitel", label: "Kivitel" }, form, mountOpts);
  }
  host.querySelector('[data-desk-field="kivitel"]')?.setAttribute("data-desk-quick", "1");
  used.add("kivitel");
  form.dataset.deskQuickKeys = [...new Set([...(form.dataset.deskQuickKeys || "").split(",").filter(Boolean), "kivitel"])].join(",");

  if (muszakiBody) {
    let muszakiHost = muszakiBody.querySelector(".auto-desk-fields[data-desk-muszaki]");
    if (!muszakiHost) {
      muszakiHost = document.createElement("div");
      muszakiHost.className = "auto-desk-fields";
      muszakiHost.dataset.deskMuszaki = "1";
      muszakiBody.insertBefore(muszakiHost, muszakiBody.firstChild);
    }
    muszakiHost.innerHTML = "";

    const moreOrder = deskOrderFromAdminLayout(moreHost);
    const muszakiOrder = moreOrder.length ? moreOrder : DESK_MUSZAKI_FALLBACK;

    for (const item of muszakiOrder) {
      if (used.has(item.field)) continue;
      if (isTeherDesk && ["tipus", "csomagtarto", "tetto", "karpit1", "karpit2"].includes(item.field)) continue;
      mountDeskField(muszakiHost, item, form, mountOpts);
    }

    if (moreHost) {
      moreHost.querySelectorAll("[data-qs-field]").forEach((el) => {
        const key = el.getAttribute("data-qs-field");
        if (!key || used.has(key)) return;
        const label =
          el.querySelector(".home-qs-label, .immo-label")?.textContent?.trim() || key;
        const range =
          el.classList.contains("home-qs-pair") ||
          el.querySelectorAll("select.home-qs-control").length >= 2;
        mountDeskField(muszakiHost, { field: key, label, range }, form, mountOpts);
      });
    }

    muszakiHost.querySelectorAll('[data-desk-field="kivitel"]').forEach((el) => {
      el.dataset.deskQuick = "1";
      host.appendChild(el);
    });

    let moreWrap = muszakiBody.querySelector("#qs-more");
    if (moreWrap) {
      moreWrap.hidden = true;
      moreWrap.classList.remove("is-open");
      moreWrap.querySelectorAll(".home-qs-static-legacy, #qs-more-layout").forEach((el) => {
        el.hidden = true;
        el.style.setProperty("display", "none", "important");
        if (el.id === "qs-more-layout") el.innerHTML = "";
      });
    }
  }

  if (mainHost) {
    mainHost.innerHTML = "";
    mainHost.hidden = true;
  }
  if (moreHost) {
    moreHost.innerHTML = "";
    moreHost.hidden = true;
    moreHost.removeAttribute("style");
  }

  form.classList.add("auto-desk-native");
  syncGyorsFieldVisibility(form);

}

function syncGyorsFieldVisibility(form = document.getElementById("home-qs-form")) {
  if (!form) return;
  const gyors = document.body.classList.contains("auto-desk-gyors");
  const ertek = document.body.classList.contains("auto-desk-ertekbecslo");
  form.querySelectorAll(".auto-desk-fields[data-desk-alap] .auto-desk-field").forEach((el) => {
    const key = el.getAttribute("data-desk-field");
    if (ertek && (key === "vetelar" || key === "km")) {
      el.hidden = false;
      return;
    }
    const isQuick = el.getAttribute("data-desk-quick") === "1";
    el.hidden = gyors && !isQuick;
  });
  if (ertek) syncErtekModeChrome(form);
  syncAutoSearchAccShell(form);
}

/** Feladás-szerű héj: brand kártya a shellben, Alapadatok fehér kártya + pill menük. */
export function syncAutoSearchAccShell(form = document.getElementById("home-qs-form")) {
  if (!form || !isAutoDesk()) return;
  const shell = form.querySelector("#auto-search-desk-shell");
  const alap = form.querySelector('#auto-search-desk-shell > [data-desk-acc="alap"], [data-desk-acc="alap"]');
  if (!shell || !alap) return;

  const brand = form.querySelector(".auto-bm-brand-block");
  if (brand && (brand.parentElement !== shell || brand.nextElementSibling !== alap)) {
    shell.insertBefore(brand, alap);
  }

  const alapBody = alap.querySelector(":scope > .auto-desk-acc__body");
  let host = form.querySelector(".auto-desk-fields[data-desk-alap]");
  if (!alapBody) return;

  if (!host) {
    host = document.createElement("div");
    host.className = "auto-desk-fields";
    host.dataset.deskAlap = "1";
  }

  let card = alapBody.querySelector(":scope > .ad-form-alap-card");
  if (!card) {
    card = document.createElement("div");
    card.className = "ad-form-alap-card";
    card.innerHTML =
      '<button type="button" class="ad-form-alap-card__title" aria-expanded="true"><span class="ad-form-alap-card__title-text">Alapadatok</span><span class="ad-form-alap-card__chev" aria-hidden="true">▼</span></button><div class="ad-form-alap-card__body"></div>';
    const title = card.querySelector(".ad-form-alap-card__title");
    title.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const closed = card.classList.toggle("is-collapsed");
      title.setAttribute("aria-expanded", closed ? "false" : "true");
    });
    alapBody.insertBefore(card, alapBody.firstChild);
  }

  const cardBody = card.querySelector(".ad-form-alap-card__body");
  if (host.parentElement !== cardBody) cardBody.appendChild(host);

  /* Üzemanyag / Kivitel / Állapot / Évjárat / Vételár az Alapadatok kártyában marad. */
  const quickFieldKeys = ["uzemanyag", "kivitel", "allapot", "gyartasi_ev", "vetelar", "km"];
  quickFieldKeys.forEach((key) => {
    const el = form.querySelector(`[data-desk-field="${key}"]`);
    if (!el) return;
    if (el.closest(".auto-bm-brand-block")) return;
    if (!host.contains(el)) host.appendChild(el);
    el.dataset.deskQuick = "1";
    el.hidden = false;
    el.style.removeProperty("display");
  });

  card.classList.remove("is-collapsed");
  card.querySelector(".ad-form-alap-card__title")?.setAttribute("aria-expanded", "true");
  alap.classList.add("is-open");
  alap.querySelector("[data-desk-acc-toggle]")?.setAttribute("aria-expanded", "true");
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
      const mode = btn.getAttribute("data-desk-mode") || "gyors";
      const next = setMode(mode);
      syncGyorsFieldVisibility(form);
      if (morePanel) {
        morePanel.hidden = true;
        morePanel.classList.remove("is-open");
      }
      openAccordion("alap");
      /* Menüpillök mindig látszanak — részletes tartalom előkészítése Extrákhoz is. */
      try {
        await mountDetailed?.(form);
        if (detailedPanel) {
          detailedPanel.hidden = false;
          detailedPanel.classList.toggle("is-open", next === "reszletes");
        }
      } catch (error) {
        console.warn("Részletes panel:", error);
      }
      updateAutoDeskAccSummaries(form);
      onModeChange?.(next);
    });
  });

  document.querySelectorAll("[data-desk-acc-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!isAutoDesk()) return;
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
    return Boolean(form?.querySelector(".auto-desk-fields[data-desk-alap] .auto-desk-field, .auto-desk-fields[data-desk-alap] [data-desk-field]"));
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
        !document.body.classList.contains("auto-desk-reszletes") &&
        !document.body.classList.contains("auto-desk-ertekbecslo")
      ) {
        setMode("gyors");
      }
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
      openAccordion("alap");
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
      updateAutoDeskAccSummaries(form);
    } else {
      if (advancedBtn) advancedBtn.hidden = false;
      document.body.classList.remove("auto-desk-gyors", "auto-desk-reszletes", "auto-desk-ertekbecslo");
      const submitBtn = document.querySelector("#home-qs-form .home-qs-submit");
      if (submitBtn) submitBtn.textContent = "Találatok mutatása";
    }
  }

  syncChrome();
  window.matchMedia(DESK_MQ).addEventListener("change", () => {
    void syncChrome({ fromChange: true });
  });
}
