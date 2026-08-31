/**
 * Autó asztali — Sebességváltó kapcsolós panel (üzemanyag / állapot stílus).
 */

import { SEBESSEGVALTO_CATEGORIES } from "./equipment-data.js";
import { bindAutoBmDismiss, autoBmPanelIsOpen } from "./auto-bm-dismiss.js?v=bmDismiss1";

function labelList(items) {
  if (!items.length) return "Mindegy";
  if (items.length === 1) return items[0];
  if (items.length <= 3) return items.join(", ");
  return `${items.length} váltó`;
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

/**
 * @param {HTMLFormElement} form
 */
export async function mountAutoSebessegvaltoPicker(form) {
  if (!form || !isAutoDesk() || form.dataset.sebessegvaltoPicker === "1") return;

  const field = form.querySelector('[data-desk-field="sebessegvalto"]');
  if (!field) return;

  const host =
    field.closest(".auto-desk-fields") ||
    form.querySelector(".auto-desk-fields[data-desk-muszaki]") ||
    form.querySelector(".auto-desk-fields[data-desk-alap]");
  if (!host) return;

  const deskQuick = field.dataset.deskQuick || "0";
  field.remove();

  /** @type {Set<string>} */
  const openMains = new Set();
  /** @type {Set<string>} */
  const selected = new Set();

  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.dataset.filterKey = "sebessegvaltok";
  hidden.setAttribute("data-filter-key", "sebessegvaltok");

  const wrap = document.createElement("div");
  wrap.className = "auto-desk-field auto-sebessegvalto-field";
  wrap.dataset.deskField = "sebessegvalto";
  wrap.dataset.deskQuick = deskQuick;
  wrap.innerHTML = `
    <span class="auto-desk-field__label">Sebességváltó</span>
    <button type="button" class="auto-bm-trigger" data-auto-valto-open>
      <span data-auto-valto-summary>Mindegy</span>
      <span class="auto-bm-trigger__chev" aria-hidden="true">⌄</span>
    </button>
  `;
  wrap.appendChild(hidden);
  host.appendChild(wrap);

  const summaryEl = wrap.querySelector("[data-auto-valto-summary]");
  const openBtn = wrap.querySelector("[data-auto-valto-open]");

  const panel = document.createElement("div");
  panel.className = "auto-bm-panel auto-sebessegvalto-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="auto-bm-panel__chrome">
      <button type="button" class="auto-bm-panel__back" data-auto-valto-back aria-label="Vissza">‹</button>
      <div class="auto-bm-panel__titles">
        <p class="auto-bm-panel__title">Sebességváltó</p>
      </div>
      <button type="button" class="auto-bm-panel__done" data-auto-valto-done>Kész</button>
    </div>
    <div class="auto-bm-panel__body" data-auto-valto-body></div>
  `;
  const hero = document.querySelector(".auto-search-hero") || form.closest(".auto-search-hero") || form;
  hero.appendChild(panel);
  const bodyEl = panel.querySelector("[data-auto-valto-body]");

  function selectedLabels() {
    const labels = [];
    for (const cat of SEBESSEGVALTO_CATEGORIES) {
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
    for (const cat of SEBESSEGVALTO_CATEGORIES) {
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
    writeJsonList(hidden, effectiveSelectedValues());
    if (summaryEl) summaryEl.textContent = labelList(selectedLabels());
  }

  function turnMainOn(cat) {
    openMains.add(cat.id);
    if (!cat.children?.length && cat.value) selected.add(cat.value);
  }

  function turnMainOff(cat) {
    openMains.delete(cat.id);
    for (const v of categoryValues(cat)) selected.delete(v);
  }

  function renderList() {
    const rows = SEBESSEGVALTO_CATEGORIES.map((cat) => {
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
                  <input type="checkbox" data-auto-valto-child="${escapeAttr(child.value)}" data-auto-valto-parent="${escapeAttr(cat.id)}" ${childOn ? "checked" : ""} />
                  <span class="auto-bm-switch" aria-hidden="true"></span>
                </label>
              </div>`;
            })
            .join("")}
        </div>`;
      }
      return `<div class="auto-bm-row auto-fuel-main-row" data-auto-valto-main="${escapeAttr(cat.id)}">
        <label class="auto-bm-toggle auto-fuel-main-toggle">
          <span class="auto-fuel-main-label">${escapeHtml(cat.label)}</span>
          <input type="checkbox" data-auto-valto-main-toggle="${escapeAttr(cat.id)}" ${on ? "checked" : ""} />
          <span class="auto-bm-switch" aria-hidden="true"></span>
        </label>
        ${kidsHtml}
      </div>`;
    }).join("");

    bodyEl.innerHTML = `
      <p class="auto-bm-hint">Kapcsolók — több váltó is</p>
      <button type="button" class="auto-bm-clear" data-auto-valto-clear>Összes kikapcsolása</button>
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

  panel.querySelector("[data-auto-valto-back]")?.addEventListener("click", closePanel);
  panel.querySelector("[data-auto-valto-done]")?.addEventListener("click", closePanel);

  bodyEl.addEventListener("change", (event) => {
    const mainEl = event.target.closest("[data-auto-valto-main-toggle]");
    if (mainEl) {
      const id = mainEl.getAttribute("data-auto-valto-main-toggle");
      const cat = SEBESSEGVALTO_CATEGORIES.find((c) => c.id === id);
      if (!cat) return;
      if (mainEl.checked) turnMainOn(cat);
      else turnMainOff(cat);
      renderList();
      syncHidden();
      return;
    }
    const childEl = event.target.closest("[data-auto-valto-child]");
    if (childEl) {
      const value = childEl.getAttribute("data-auto-valto-child");
      const parentId = childEl.getAttribute("data-auto-valto-parent");
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
    if (!event.target.closest("[data-auto-valto-clear]")) return;
    openMains.clear();
    selected.clear();
    renderList();
    syncHidden();
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      openMains.clear();
      selected.clear();
      syncHidden();
      if (!panel.hidden) renderList();
    });
  });

  form.dataset.sebessegvaltoPicker = "1";
  syncHidden();
}

export function readSebessegvaltoFilterValues(form) {
  if (!form) return {};
  const el = form.querySelector('[data-filter-key="sebessegvaltok"]');
  if (!el) return {};
  const sebessegvaltok = parseJsonList(el.value);
  return sebessegvaltok.length ? { sebessegvaltok } : {};
}

function normalizeSebessegvalto(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGearCount(text) {
  const m = String(text).match(/(\d+)\s*(?:fokozatu|f\.|seb\.)/i);
  return m ? Number(m[1]) : null;
}

function transmissionKind(text) {
  if (/szekvencialis/.test(text)) return "szekvencialis";
  if (/tiptronic/.test(text)) return "tiptronic";
  if (/felautomata/.test(text)) return "felautomata";
  if (/fokozatmentes|cvt|e-cvt/.test(text)) return "fokozatmentes";
  if (/manualis/.test(text)) return "manualis";
  if (/automata/.test(text)) return "automata";
  return "";
}

function sebessegvaltoCompatible(got, want) {
  if (!want) return true;
  if (!got) return false;
  if (got === want) return true;
  if (got.includes(want) || want.includes(got)) return true;

  const gotKind = transmissionKind(got);
  const wantKind = transmissionKind(want);
  const gotGear = extractGearCount(got);
  const wantGear = extractGearCount(want);

  if (gotGear && wantGear && gotGear === wantGear && gotKind && wantKind && gotKind === wantKind) {
    return true;
  }

  if (want === "manualis") {
    return gotKind === "manualis";
  }
  if (want === "automata") {
    return gotKind === "automata";
  }
  if (want === "szekvencialis") {
    return gotKind === "szekvencialis";
  }
  if (want === "tiptronic") {
    return gotKind === "tiptronic";
  }
  if (want === "felautomata") {
    return gotKind === "felautomata";
  }
  if (want.includes("fokozatmentes")) {
    return gotKind === "fokozatmentes";
  }

  if (wantKind === "manualis" && wantGear != null) {
    return gotKind === "manualis" && gotGear === wantGear;
  }
  if (wantKind === "automata" && wantGear != null && !want.includes("tiptronic")) {
    return gotKind === "automata" && gotGear === wantGear;
  }
  if (wantKind === "szekvencialis" && wantGear != null) {
    return gotKind === "szekvencialis" && gotGear === wantGear;
  }

  return false;
}

export function sebessegvaltoListMatches(listingValue, selectedValues) {
  if (!selectedValues?.length) return true;
  const got = normalizeSebessegvalto(listingValue);
  if (!got) return false;
  return selectedValues.some((raw) => sebessegvaltoCompatible(got, normalizeSebessegvalto(raw)));
}
