/**
 * Autó asztali — Állapot kapcsolós panel (üzemanyag stílus).
 * Fő kategóriák becsukva; bekapcsoláskor nyílnak a részletek; több is lehet egyszerre.
 */

import { ALLAPOT_CATEGORIES } from "./equipment-data.js";
import { bindAutoBmDismiss, autoBmPanelIsOpen } from "./auto-bm-dismiss.js?v=bmDismiss1";

function labelList(items) {
  if (!items.length) return "Mindegy";
  if (items.length === 1) return items[0];
  if (items.length <= 3) return items.join(", ");
  return `${items.length} állapot`;
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
export async function mountAutoAllapotPicker(form) {
  if (!form || !isAutoDesk() || form.dataset.allapotPicker === "1") return;

  const alapHost = form.querySelector(".auto-desk-fields[data-desk-alap]");
  if (!alapHost) return;

  form.querySelectorAll('[data-desk-field="allapot"]').forEach((el) => el.remove());

  /** @type {Set<string>} */
  const openMains = new Set();
  /** @type {Set<string>} */
  const selected = new Set();

  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.dataset.filterKey = "allapotok";
  hidden.setAttribute("data-filter-key", "allapotok");

  const wrap = document.createElement("div");
  wrap.className = "auto-desk-field auto-allapot-field";
  wrap.dataset.deskField = "allapot";
  wrap.dataset.deskQuick = "1";
  wrap.innerHTML = `
    <span class="auto-desk-field__label">Állapot</span>
    <button type="button" class="auto-bm-trigger" data-auto-allapot-open>
      <span data-auto-allapot-summary>Mindegy</span>
      <span class="auto-bm-trigger__chev" aria-hidden="true">⌄</span>
    </button>
  `;
  wrap.appendChild(hidden);

  const after =
    alapHost.querySelector(".auto-kivitel-field, [data-desk-field='kivitel']") ||
    alapHost.querySelector(".auto-fuel-field, [data-desk-field='uzemanyag']");
  if (after?.nextSibling) alapHost.insertBefore(wrap, after.nextSibling);
  else if (after) alapHost.appendChild(wrap);
  else alapHost.appendChild(wrap);

  const summaryEl = wrap.querySelector("[data-auto-allapot-summary]");
  const openBtn = wrap.querySelector("[data-auto-allapot-open]");

  const panel = document.createElement("div");
  panel.className = "auto-bm-panel auto-allapot-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="auto-bm-panel__chrome">
      <button type="button" class="auto-bm-panel__back" data-auto-allapot-back aria-label="Vissza">‹</button>
      <div class="auto-bm-panel__titles">
        <p class="auto-bm-panel__title">Állapot</p>
      </div>
      <button type="button" class="auto-bm-panel__done" data-auto-allapot-done>Kész</button>
    </div>
    <div class="auto-bm-panel__body" data-auto-allapot-body></div>
  `;
  const hero = document.querySelector(".auto-search-hero") || form.closest(".auto-search-hero") || form;
  hero.appendChild(panel);
  const bodyEl = panel.querySelector("[data-auto-allapot-body]");

  function selectedLabels() {
    const labels = [];
    for (const cat of ALLAPOT_CATEGORIES) {
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
    for (const cat of ALLAPOT_CATEGORIES) {
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
    const rows = ALLAPOT_CATEGORIES.map((cat) => {
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
                  <input type="checkbox" data-auto-allapot-child="${escapeAttr(child.value)}" data-auto-allapot-parent="${escapeAttr(cat.id)}" ${childOn ? "checked" : ""} />
                  <span class="auto-bm-switch" aria-hidden="true"></span>
                </label>
              </div>`;
            })
            .join("")}
        </div>`;
      }
      return `<div class="auto-bm-row auto-fuel-main-row" data-auto-allapot-main="${escapeAttr(cat.id)}">
        <label class="auto-bm-toggle auto-fuel-main-toggle">
          <span class="auto-fuel-main-label">${escapeHtml(cat.label)}</span>
          <input type="checkbox" data-auto-allapot-main-toggle="${escapeAttr(cat.id)}" ${on ? "checked" : ""} />
          <span class="auto-bm-switch" aria-hidden="true"></span>
        </label>
        ${kidsHtml}
      </div>`;
    }).join("");

    bodyEl.innerHTML = `
      <p class="auto-bm-hint">Kapcsolók — több állapot is</p>
      <button type="button" class="auto-bm-clear" data-auto-allapot-clear>Összes kikapcsolása</button>
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

  panel.querySelector("[data-auto-allapot-back]")?.addEventListener("click", closePanel);
  panel.querySelector("[data-auto-allapot-done]")?.addEventListener("click", closePanel);

  bodyEl.addEventListener("change", (event) => {
    const mainEl = event.target.closest("[data-auto-allapot-main-toggle]");
    if (mainEl) {
      const id = mainEl.getAttribute("data-auto-allapot-main-toggle");
      const cat = ALLAPOT_CATEGORIES.find((c) => c.id === id);
      if (!cat) return;
      if (mainEl.checked) turnMainOn(cat);
      else turnMainOff(cat);
      renderList();
      syncHidden();
      return;
    }
    const childEl = event.target.closest("[data-auto-allapot-child]");
    if (childEl) {
      const value = childEl.getAttribute("data-auto-allapot-child");
      const parentId = childEl.getAttribute("data-auto-allapot-parent");
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
    if (!event.target.closest("[data-auto-allapot-clear]")) return;
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

  form.dataset.allapotPicker = "1";
  syncHidden();
}

export function readAllapotFilterValues(form) {
  if (!form) return {};
  const el = form.querySelector('[data-filter-key="allapotok"]');
  if (!el) return {};
  const allapotok = parseJsonList(el.value);
  return allapotok.length ? { allapotok } : {};
}

export function allapotValueMatches(listingAllapot, selectedValues) {
  if (!selectedValues?.length) return true;
  const got = normalizeAllapot(listingAllapot);
  if (!got) return false;
  return selectedValues.some((raw) => allapotokCompatible(got, normalizeAllapot(raw)));
}

function normalizeAllapot(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function allapotokCompatible(got, want) {
  if (!want) return true;
  if (got === want) return true;
  if (got.includes(want) || want.includes(got)) return true;
  return false;
}
