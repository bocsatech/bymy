/**
 * Asztali Kivitel kapcsolós multi-select.
 * Autó / kisteher: lapos lista.
 * Teherautó 3,5-tól: hierarchikus (állapot / üzemanyag stílus).
 */

import { KIVITEL_OPTIONS, normalizeKivitel } from "./kivitel-options.js?v=kivitel1";
import {
  TEHER_KISTEHER_KIVITEL,
  TEHER_35_KIVITEL_CATEGORIES,
  flattenTeher35KivitelOptions,
} from "./equipment-data.js?v=teherKivitel35b";
import { bindAutoBmDismiss, autoBmPanelIsOpen } from "./auto-bm-dismiss.js?v=bmDismiss1";

function labelList(items) {
  if (!items.length) return "Mindegy";
  if (items.length === 1) return items[0];
  if (items.length <= 3) return items.join(", ");
  return `${items.length} kivitel`;
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

function truckKategoria() {
  return new URLSearchParams(window.location.search).get("kategoria") || "35-alatt";
}

function useTeher35Categories() {
  return document.body?.getAttribute("data-site-page") === "teherauto" && truckKategoria() === "35-felett";
}

function flatOptionsForPage() {
  if (document.body?.getAttribute("data-site-page") !== "teherauto") return KIVITEL_OPTIONS;
  if (useTeher35Categories()) return flattenTeher35KivitelOptions();
  return TEHER_KISTEHER_KIVITEL;
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

function normKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * @param {HTMLFormElement} form
 */
export async function mountAutoKivitelPicker(form) {
  if (!form || !isAutoDesk() || form.dataset.kivitelPicker === "1") return;

  const alapHost = form.querySelector(".auto-desk-fields[data-desk-alap]");
  const muszakiHost = form.querySelector(".auto-desk-fields[data-desk-muszaki]");
  const host = alapHost || muszakiHost;
  if (!host) return;

  const existing = form.querySelector('[data-desk-field="kivitel"]');
  const deskQuick = existing?.dataset.deskQuick || "1";
  form.querySelectorAll('[data-desk-field="kivitel"]').forEach((el) => el.remove());
  // Régi natív select forrás — ne maradjon szűrési zaj
  form.querySelector("#qs-kivitel")?.remove();

  const hierarchical = useTeher35Categories();
  const categories = hierarchical ? TEHER_35_KIVITEL_CATEGORIES : null;
  const flatOptions = hierarchical ? null : flatOptionsForPage();

  /** @type {Set<string>} */
  const openMains = new Set();
  /** @type {Set<string>} */
  const selected = new Set();

  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.dataset.filterKey = "kivitelek";
  hidden.setAttribute("data-filter-key", "kivitelek");

  const wrap = document.createElement("div");
  wrap.className = "auto-desk-field auto-kivitel-field";
  wrap.dataset.deskField = "kivitel";
  wrap.dataset.deskQuick = deskQuick;
  wrap.innerHTML = `
    <span class="auto-desk-field__label">Kivitel</span>
    <button type="button" class="auto-bm-trigger" data-auto-kivitel-open>
      <span data-auto-kivitel-summary>Mindegy</span>
      <span class="auto-bm-trigger__chev" aria-hidden="true">⌄</span>
    </button>
  `;
  wrap.appendChild(hidden);

  const insertHost = alapHost || host;
  const fuelField = insertHost.querySelector(".auto-fuel-field, [data-desk-field='uzemanyag']");
  if (fuelField?.nextSibling) insertHost.insertBefore(wrap, fuelField.nextSibling);
  else if (fuelField) insertHost.appendChild(wrap);
  else insertHost.appendChild(wrap);

  const urlKivitel = String(new URLSearchParams(window.location.search).get("kivitel") || "").trim();
  if (urlKivitel) {
    if (hierarchical && categories) {
      const cat = categories.find(
        (c) =>
          c.value === urlKivitel ||
          c.label === urlKivitel ||
          c.children?.some((ch) => ch.value === urlKivitel)
      );
      if (cat) {
        openMains.add(cat.id);
        if (cat.children?.length) {
          const child = cat.children.find((ch) => ch.value === urlKivitel);
          if (child) selected.add(child.value);
          else cat.children.forEach((ch) => selected.add(ch.value));
        } else if (cat.value) {
          selected.add(cat.value);
        }
      } else {
        selected.add(urlKivitel);
      }
    } else {
      selected.add(normalizeKivitel(urlKivitel) || urlKivitel);
    }
  }

  const summaryEl = wrap.querySelector("[data-auto-kivitel-summary]");
  const openBtn = wrap.querySelector("[data-auto-kivitel-open]");

  const panel = document.createElement("div");
  panel.className = "auto-bm-panel auto-kivitel-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="auto-bm-panel__chrome">
      <button type="button" class="auto-bm-panel__back" data-auto-kivitel-back aria-label="Vissza">‹</button>
      <div class="auto-bm-panel__titles">
        <p class="auto-bm-panel__title">Kivitel</p>
      </div>
      <button type="button" class="auto-bm-panel__done" data-auto-kivitel-done>Kész</button>
    </div>
    <div class="auto-bm-panel__body" data-auto-kivitel-body></div>
  `;
  const hero = document.querySelector(".auto-search-hero") || form.closest(".auto-search-hero") || form;
  hero.appendChild(panel);
  const bodyEl = panel.querySelector("[data-auto-kivitel-body]");

  function selectedLabelsHierarchical() {
    const labels = [];
    for (const cat of categories) {
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
    if (!hierarchical) return [...selected];
    const values = new Set();
    for (const cat of categories) {
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
    const list = hierarchical ? effectiveSelectedValues() : [...selected];
    writeJsonList(hidden, list);
    if (summaryEl) {
      summaryEl.textContent = labelList(hierarchical ? selectedLabelsHierarchical() : list);
    }
  }

  function turnMainOn(cat) {
    openMains.add(cat.id);
    if (!cat.children?.length && cat.value) selected.add(cat.value);
  }

  function turnMainOff(cat) {
    openMains.delete(cat.id);
    for (const v of categoryValues(cat)) selected.delete(v);
  }

  function renderHierarchical() {
    const rows = categories
      .map((cat) => {
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
                    <input type="checkbox" data-auto-kivitel-child="${escapeAttr(child.value)}" data-auto-kivitel-parent="${escapeAttr(cat.id)}" ${childOn ? "checked" : ""} />
                    <span class="auto-bm-switch" aria-hidden="true"></span>
                  </label>
                </div>`;
              })
              .join("")}
          </div>`;
        }
        return `<div class="auto-bm-row auto-fuel-main-row" data-auto-kivitel-main="${escapeAttr(cat.id)}">
          <label class="auto-bm-toggle auto-fuel-main-toggle">
            <span class="auto-fuel-main-label">${escapeHtml(cat.label)}</span>
            <input type="checkbox" data-auto-kivitel-main-toggle="${escapeAttr(cat.id)}" ${on ? "checked" : ""} />
            <span class="auto-bm-switch" aria-hidden="true"></span>
          </label>
          ${kidsHtml}
        </div>`;
      })
      .join("");

    bodyEl.innerHTML = `
      <p class="auto-bm-hint">Kapcsolók — több kivitel is</p>
      <button type="button" class="auto-bm-clear" data-auto-kivitel-clear>Összes kikapcsolása</button>
      <div class="auto-bm-group">${rows}</div>
    `;
  }

  function renderFlat() {
    const rows = flatOptions
      .map((opt) => {
        const on = selected.has(opt);
        return `<div class="auto-bm-row">
          <label class="auto-bm-toggle">
            <span>${escapeHtml(opt)}</span>
            <input type="checkbox" data-auto-kivitel-opt="${escapeAttr(opt)}" ${on ? "checked" : ""} />
            <span class="auto-bm-switch" aria-hidden="true"></span>
          </label>
        </div>`;
      })
      .join("");
    bodyEl.innerHTML = `
      <p class="auto-bm-hint">Kapcsolók — több kivitel is</p>
      <button type="button" class="auto-bm-clear" data-auto-kivitel-clear>Összes kikapcsolása</button>
      <div class="auto-bm-group">${rows}</div>
    `;
  }

  function renderList() {
    if (hierarchical) renderHierarchical();
    else renderFlat();
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

  panel.querySelector("[data-auto-kivitel-back]")?.addEventListener("click", closePanel);
  panel.querySelector("[data-auto-kivitel-done]")?.addEventListener("click", closePanel);

  bodyEl.addEventListener("change", (event) => {
    const mainToggle = event.target.closest("[data-auto-kivitel-main-toggle]");
    if (mainToggle && hierarchical) {
      const id = mainToggle.getAttribute("data-auto-kivitel-main-toggle");
      const cat = categories.find((c) => c.id === id);
      if (!cat) return;
      if (mainToggle.checked) turnMainOn(cat);
      else turnMainOff(cat);
      renderList();
      syncHidden();
      return;
    }

    const child = event.target.closest("[data-auto-kivitel-child]");
    if (child && hierarchical) {
      const value = child.getAttribute("data-auto-kivitel-child");
      const parentId = child.getAttribute("data-auto-kivitel-parent");
      if (child.checked) {
        selected.add(value);
        if (parentId) openMains.add(parentId);
      } else {
        selected.delete(value);
      }
      syncHidden();
      return;
    }

    const opt = event.target.closest("[data-auto-kivitel-opt]");
    if (!opt) return;
    const value = opt.getAttribute("data-auto-kivitel-opt");
    if (opt.checked) selected.add(value);
    else selected.delete(value);
    syncHidden();
  });

  bodyEl.addEventListener("click", (event) => {
    if (!event.target.closest("[data-auto-kivitel-clear]")) return;
    selected.clear();
    openMains.clear();
    renderList();
    syncHidden();
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      selected.clear();
      openMains.clear();
      syncHidden();
      if (!panel.hidden) renderList();
    });
  });

  form.dataset.kivitelPicker = "1";
  syncHidden();
}

export function readKivitelFilterValues(form) {
  if (!form) return {};
  const el = form.querySelector('[data-filter-key="kivitelek"]');
  if (!el) return {};
  const kivitelek = parseJsonList(el.value)
    .map((x) => String(x).trim())
    .filter(Boolean);
  return kivitelek.length ? { kivitelek } : {};
}

export function kivitelListMatches(listingValue, selectedValues) {
  if (!selectedValues?.length) return true;
  const got = String(listingValue ?? "").trim();
  if (!got) return false;
  const gotN = normKey(got);
  const gotCar = normalizeKivitel(got);
  return selectedValues.some((raw) => {
    const want = String(raw ?? "").trim();
    if (!want) return false;
    if (gotCar && normalizeKivitel(want) === gotCar) return true;
    const wantN = normKey(want);
    return gotN === wantN || gotN.includes(wantN) || wantN.includes(gotN);
  });
}
