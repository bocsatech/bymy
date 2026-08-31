/**
 * Autó asztali — Okmányok jellege kapcsolós multi-select.
 */

import { OKMANY_JELLEG_OPTIONS, normalizeOkmanyJelleg } from "./equipment-data.js";
import { bindAutoBmDismiss, autoBmPanelIsOpen } from "./auto-bm-dismiss.js?v=bmDismiss1";

function labelList(items) {
  if (!items.length) return "Mindegy";
  if (items.length === 1) return items[0];
  if (items.length <= 3) return items.join(", ");
  return `${items.length} okmány`;
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
export async function mountAutoOkmanyPicker(form) {
  if (!form || !isAutoDesk() || form.dataset.okmanyPicker === "1") return;

  const field = form.querySelector('[data-desk-field="okmany_jelleg"]');
  if (!field) return;

  const host =
    field.closest(".auto-desk-fields") ||
    form.querySelector(".auto-desk-fields[data-desk-muszaki]") ||
    form.querySelector(".auto-desk-fields[data-desk-alap]");
  if (!host) return;

  const deskQuick = field.dataset.deskQuick || "0";
  field.remove();

  /** @type {Set<string>} */
  const selected = new Set();

  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.dataset.filterKey = "okmany_jellegek";
  hidden.setAttribute("data-filter-key", "okmany_jellegek");

  const wrap = document.createElement("div");
  wrap.className = "auto-desk-field auto-okmany-field";
  wrap.dataset.deskField = "okmany_jelleg";
  wrap.dataset.deskQuick = deskQuick;
  wrap.innerHTML = `
    <span class="auto-desk-field__label">Okmányok jellege</span>
    <button type="button" class="auto-bm-trigger" data-auto-okmany-open>
      <span data-auto-okmany-summary>Mindegy</span>
      <span class="auto-bm-trigger__chev" aria-hidden="true">⌄</span>
    </button>
  `;
  wrap.appendChild(hidden);
  host.appendChild(wrap);

  const summaryEl = wrap.querySelector("[data-auto-okmany-summary]");
  const openBtn = wrap.querySelector("[data-auto-okmany-open]");

  const panel = document.createElement("div");
  panel.className = "auto-bm-panel auto-okmany-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="auto-bm-panel__chrome">
      <button type="button" class="auto-bm-panel__back" data-auto-okmany-back aria-label="Vissza">‹</button>
      <div class="auto-bm-panel__titles">
        <p class="auto-bm-panel__title">Okmányok jellege</p>
      </div>
      <button type="button" class="auto-bm-panel__done" data-auto-okmany-done>Kész</button>
    </div>
    <div class="auto-bm-panel__body" data-auto-okmany-body></div>
  `;
  const hero = document.querySelector(".auto-search-hero") || form.closest(".auto-search-hero") || form;
  hero.appendChild(panel);
  const bodyEl = panel.querySelector("[data-auto-okmany-body]");

  function syncHidden() {
    const list = [...selected];
    writeJsonList(hidden, list);
    if (summaryEl) summaryEl.textContent = labelList(list);
  }

  function renderList() {
    const rows = OKMANY_JELLEG_OPTIONS.map((opt) => {
      const on = selected.has(opt);
      return `<div class="auto-bm-row">
        <label class="auto-bm-toggle">
          <span>${escapeHtml(opt)}</span>
          <input type="checkbox" data-auto-okmany-opt="${escapeAttr(opt)}" ${on ? "checked" : ""} />
          <span class="auto-bm-switch" aria-hidden="true"></span>
        </label>
      </div>`;
    }).join("");
    bodyEl.innerHTML = `
      <p class="auto-bm-hint">Kapcsolók — több is</p>
      <button type="button" class="auto-bm-clear" data-auto-okmany-clear>Összes kikapcsolása</button>
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

  panel.querySelector("[data-auto-okmany-back]")?.addEventListener("click", closePanel);
  panel.querySelector("[data-auto-okmany-done]")?.addEventListener("click", closePanel);

  bodyEl.addEventListener("change", (event) => {
    const el = event.target.closest("[data-auto-okmany-opt]");
    if (!el) return;
    const opt = el.getAttribute("data-auto-okmany-opt");
    if (el.checked) selected.add(opt);
    else selected.delete(opt);
    syncHidden();
  });

  bodyEl.addEventListener("click", (event) => {
    if (!event.target.closest("[data-auto-okmany-clear]")) return;
    selected.clear();
    renderList();
    syncHidden();
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      selected.clear();
      syncHidden();
      if (!panel.hidden) renderList();
    });
  });

  form.dataset.okmanyPicker = "1";
  syncHidden();
}

export function readOkmanyFilterValues(form) {
  if (!form) return {};
  const el = form.querySelector('[data-filter-key="okmany_jellegek"]');
  if (!el) return {};
  const okmany_jellegek = parseJsonList(el.value).map(normalizeOkmanyJelleg).filter(Boolean);
  return okmany_jellegek.length ? { okmany_jellegek } : {};
}

export function okmanyListMatches(listingValue, selectedValues) {
  if (!selectedValues?.length) return true;
  const got = normalizeOkmanyJelleg(listingValue);
  if (!got) return false;
  return selectedValues.some((want) => normalizeOkmanyJelleg(want) === got);
}
