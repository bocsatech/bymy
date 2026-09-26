
import { UZEMANYAG_CATEGORIES } from "./equipment-data.js";
import { bindAutoBmDismiss, autoBmPanelIsOpen } from "./auto-bm-dismiss.js?v=bmDismiss1";

function labelList(items) {
  if (!items.length) return "Mindegy";
  if (items.length === 1) return items[0];
  if (items.length <= 3) return items.join(", ");
  return `${items.length} üzemanyag`;
}

function parseJsonList(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  } catch {
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function writeJsonList(input, list) {
  if (!input) return;
  input.value = list.length ? JSON.stringify(list) : "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function isAutoDesk() {
  return (
    (document.body?.getAttribute("data-site-page") === "auto" ||
      document.body?.getAttribute("data-site-page") === "teherauto") &&
    window.matchMedia("(min-width: 901px)").matches
  );
}

function categoryValues(cat) {
  if (cat.children?.length) return cat.children.map((c) => c.value);
  return cat.value ? [cat.value] : [];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

export async function mountAutoFuelPicker(form) {
  if (!form || !isAutoDesk() || form.dataset.fuelPicker === "1") return;

  const alapHost = form.querySelector(".auto-desk-fields[data-desk-alap]");
  if (!alapHost) return;

  const fuelField = alapHost.querySelector('[data-desk-field="uzemanyag"]');
  if (!fuelField) return;

  fuelField.remove();

  const openMains = new Set();
  const selected = new Set();

  const fuelsInput = document.createElement("input");
  fuelsInput.type = "hidden";
  fuelsInput.dataset.filterKey = "uzemanyagok";
  fuelsInput.setAttribute("data-filter-key", "uzemanyagok");

  const wrap = document.createElement("div");
  wrap.className = "auto-desk-field auto-fuel-field";
  wrap.dataset.deskField = "uzemanyag";
  wrap.dataset.deskQuick = "1";
  wrap.innerHTML = `
    <span class="auto-desk-field__label">Üzemanyag</span>
    <button type="button" class="auto-bm-trigger" data-auto-fuel-open>
      <span data-auto-fuel-summary>Mindegy</span>
      <span class="auto-bm-trigger__chev" aria-hidden="true">⌄</span>
    </button>
  `;
  wrap.appendChild(fuelsInput);

  const bmPair = alapHost.querySelector(".auto-bm-pair");
  if (bmPair?.nextSibling) alapHost.insertBefore(wrap, bmPair.nextSibling);
  else if (bmPair) alapHost.appendChild(wrap);
  else alapHost.insertBefore(wrap, alapHost.firstChild);

  const summaryEl = wrap.querySelector("[data-auto-fuel-summary]");
  const openBtn = wrap.querySelector("[data-auto-fuel-open]");

  const panel = document.createElement("div");
  panel.className = "auto-bm-panel auto-fuel-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="auto-bm-panel__chrome">
      <button type="button" class="auto-bm-panel__back" data-auto-fuel-back aria-label="Vissza">‹</button>
      <div class="auto-bm-panel__titles">
        <p class="auto-bm-panel__title">Üzemanyag</p>
      </div>
    </div>
    <div class="auto-bm-panel__body" data-auto-fuel-body></div>
  `;
  const hero = document.querySelector(".auto-search-hero") || form.closest(".auto-search-hero") || form;
  hero.appendChild(panel);

  const bodyEl = panel.querySelector("[data-auto-fuel-body]");

  function selectedLabels() {
    const labels = [];
    for (const cat of UZEMANYAG_CATEGORIES) {
      if (!openMains.has(cat.id)) continue;
      if (cat.children?.length) {
        const kids = cat.children.filter((c) => selected.has(c.value));
        if (kids.length) labels.push(...kids.map((c) => c.label));
        else labels.push(cat.label);
      } else if (cat.value && selected.has(cat.value)) {
        labels.push(cat.label);
      }
    }
    return labels;
  }

  function effectiveSelectedValues() {
    const values = new Set();
    for (const cat of UZEMANYAG_CATEGORIES) {
      if (!openMains.has(cat.id)) continue;
      if (cat.children?.length) {
        const kids = cat.children.filter((c) => selected.has(c.value));
        if (kids.length) kids.forEach((c) => values.add(c.value));
        else {
          cat.children.forEach((c) => values.add(c.value));
          values.add(cat.label);
        }
      } else if (cat.value && selected.has(cat.value)) {
        values.add(cat.value);
      }
    }
    return [...values];
  }

  function syncHidden() {
    writeJsonList(fuelsInput, effectiveSelectedValues());
    if (summaryEl) summaryEl.textContent = labelList(selectedLabels());
  }

  function turnMainOn(cat) {
    openMains.add(cat.id);
    if (cat.children?.length) {
    } else if (cat.value) {
      selected.add(cat.value);
    }
  }

  function turnMainOff(cat) {
    openMains.delete(cat.id);
    for (const v of categoryValues(cat)) selected.delete(v);
  }

  function renderList() {
    const rows = UZEMANYAG_CATEGORIES.map((cat) => {
      const on = openMains.has(cat.id);
      const hasKids = Boolean(cat.children?.length);
      let kidsHtml = "";
      if (hasKids && on) {
        kidsHtml = `<div class="auto-fuel-children">
          ${cat.children
            .map((child) => {
              const childOn = selected.has(child.value);
              return `<div class="auto-bm-row auto-fuel-child-row">
                <label class="auto-bm-toggle">
                  <span>${escapeHtml(child.label)}</span>
                  <input type="checkbox" data-auto-fuel-child="${escapeAttr(child.value)}" data-auto-fuel-parent="${escapeAttr(cat.id)}" ${childOn ? "checked" : ""} />
                  <span class="auto-bm-switch" aria-hidden="true"></span>
                </label>
              </div>`;
            })
            .join("")}
        </div>`;
      }
      return `<div class="auto-bm-row auto-fuel-main-row" data-auto-fuel-main="${escapeAttr(cat.id)}">
        <label class="auto-bm-toggle auto-fuel-main-toggle">
          <span class="auto-fuel-main-label">${escapeHtml(cat.label)}</span>
          <input type="checkbox" data-auto-fuel-main-toggle="${escapeAttr(cat.id)}" ${on ? "checked" : ""} />
          <span class="auto-bm-switch" aria-hidden="true"></span>
        </label>
        ${kidsHtml}
      </div>`;
    }).join("");

    bodyEl.innerHTML = `
      <div class="auto-bm-actions">
      <button type="button" class="auto-bm-btn auto-bm-btn--clear" data-auto-fuel-clear>Összes kikapcsolása</button>
      <button type="button" class="auto-bm-btn auto-bm-btn--done" data-auto-fuel-done>Kész</button>
    </div>
      <div class="auto-bm-group">${rows}</div>
    `;
  }

  function openPanel() {
    panel.hidden = false;
    panel.style.removeProperty("display");
    panel.classList.remove("is-closed");
    document.body.classList.add("auto-bm-open");
    renderList();
  }

  function closePanel() {
    panel.hidden = true;
    panel.style.setProperty("display", "none", "important");
    panel.classList.add("is-closed");
    document.body.classList.remove("auto-bm-open");
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    syncHidden();
  }

  openBtn?.addEventListener("click", () => {
    if (!panel.hidden && !panel.classList.contains("is-closed")) closePanel();
    else openPanel();
  });

  bindAutoBmDismiss({
    panel,
    roots: [wrap],
    isOpen: () => autoBmPanelIsOpen(panel),
    close: closePanel,
  });

  panel.querySelector("[data-auto-fuel-back]")?.addEventListener("click", closePanel);
  // done handled in body click (data-auto-fuel-done)

  bodyEl.addEventListener("change", (event) => {
    const mainEl = event.target.closest("[data-auto-fuel-main-toggle]");
    if (mainEl) {
      const id = mainEl.getAttribute("data-auto-fuel-main-toggle");
      const cat = UZEMANYAG_CATEGORIES.find((c) => c.id === id);
      if (!cat) return;
      if (mainEl.checked) turnMainOn(cat);
      else turnMainOff(cat);
      renderList();
      syncHidden();
      return;
    }
    const childEl = event.target.closest("[data-auto-fuel-child]");
    if (childEl) {
      const value = childEl.getAttribute("data-auto-fuel-child");
      const parentId = childEl.getAttribute("data-auto-fuel-parent");
      if (childEl.checked) {
        selected.add(value);
        if (parentId) openMains.add(parentId);
      } else {
        selected.delete(value);
      }
      syncHidden();
    }
  });

  bodyEl.addEventListener("click", (event) => {
    if (event.target.closest("[data-auto-fuel-done]")) {
      closePanel();
      return;
    }
    if (event.target.closest("[data-auto-fuel-clear]")) {
      openMains.clear();
      selected.clear();
      renderList();
      syncHidden();
    }
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      openMains.clear();
      selected.clear();
      syncHidden();
      if (!panel.hidden) renderList();
    });
  });

  form.dataset.fuelPicker = "1";
  syncHidden();
}

export function readFuelFilterValues(form) {
  if (!form) return {};
  const el = form.querySelector('[data-filter-key="uzemanyagok"]');
  if (!el) return {};
  const uzemanyagok = parseJsonList(el.value);
  return uzemanyagok.length ? { uzemanyagok } : {};
}

export function fuelValueMatches(listingFuel, selectedValues) {
  if (!selectedValues?.length) return true;
  const got = normalizeFuel(listingFuel);
  if (!got) return false;
  return selectedValues.some((raw) => fuelsCompatible(got, normalizeFuel(raw)));
}

function normalizeFuel(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hibrid család — sima benzin/dízel NEM tartozik ide. */
const HYBRID_FUELS = new Set([
  "hibrid",
  "hybrid",
  "hibrid (benzin)",
  "hibrid (dizel)",
  "benzin/elektromos",
  "dizel/elektromos",
]);

function isHybridFuel(normalized) {
  if (!normalized) return false;
  if (HYBRID_FUELS.has(normalized)) return true;
  // „Benzin/elektromos”, „… hibrid …”, de nem tiszta Elektromos / Hidrogén
  if (normalized === "elektromos" || normalized.startsWith("hidrogen")) return false;
  return /elektromos/.test(normalized) || /\bhibrid\b|\bhybrid\b/.test(normalized);
}

/**
 * Pontos / alias egyezés — NINCS laza substring
 * (különben „benzin” átmenne a „benzin/elektromos” szűrőn).
 */
function fuelsCompatible(got, want) {
  if (!want) return true;
  if (got === want) return true;

  if ((got === "dizel" || got === "diesel") && (want === "dizel" || want === "diesel")) {
    return true;
  }

  const aliases = {
    hibrid: [...HYBRID_FUELS],
    hybrid: [...HYBRID_FUELS],
    "hibrid (benzin)": ["hibrid (benzin)", "benzin/elektromos", "hibrid", "hybrid"],
    "hibrid (dizel)": ["hibrid (dizel)", "dizel/elektromos", "hibrid", "hybrid"],
    "benzin/elektromos": ["benzin/elektromos", "hibrid (benzin)", "hibrid", "hybrid"],
    "dizel/elektromos": ["dizel/elektromos", "hibrid (dizel)", "hibrid", "hybrid"],
    lpg: ["lpg", "lpg/benzin", "benzin/gaz"],
    cng: ["cng", "cng/benzin", "benzin/gaz"],
    "benzin/gaz": ["benzin/gaz", "lpg", "cng", "lpg/benzin", "cng/benzin"],
    "lpg/dizel": ["lpg/dizel", "dizel/gaz"],
    "cng/dizel": ["cng/dizel", "dizel/gaz"],
    dizel: ["dizel", "diesel"],
    diesel: ["dizel", "diesel"],
  };

  if (want === "hibrid" || want === "hybrid" || HYBRID_FUELS.has(want)) {
    return isHybridFuel(got);
  }

  const list = aliases[want] || [want];
  return list.some((a) => got === a);
}

