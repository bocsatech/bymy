/**
 * Autó asztali — Kivitel kapcsolós multi-select (üzemanyag / gyártmány stílus).
 */

import { KIVITEL_OPTIONS, normalizeKivitel } from "./kivitel-options.js?v=kivitel1";

const TEHER_KIVITEL = ["Kisteher", "Dobozos", "Platós", "Ponyvás", "Hűtős", "Billenős", "Alváz"];

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

function optionsForPage() {
  return document.body?.getAttribute("data-site-page") === "teherauto" ? TEHER_KIVITEL : KIVITEL_OPTIONS;
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
export async function mountAutoKivitelPicker(form) {
  if (!form || !isAutoDesk() || form.dataset.kivitelPicker === "1") return;

  const field = form.querySelector('[data-desk-field="kivitel"]');
  if (!field) return;

  const host =
    field.closest(".auto-desk-fields") ||
    form.querySelector(".auto-desk-fields[data-desk-alap]");
  if (!host) return;

  const deskQuick = field.dataset.deskQuick || "0";
  field.remove();

  const options = optionsForPage();
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

  // Üzemanyag után, vagy a host végére
  const fuelField = host.querySelector(".auto-fuel-field, [data-desk-field='uzemanyag']");
  if (fuelField?.nextSibling) host.insertBefore(wrap, fuelField.nextSibling);
  else if (fuelField) host.appendChild(wrap);
  else host.appendChild(wrap);

  // URL ?kivitel= előtöltés
  const urlKivitel = normalizeKivitel(new URLSearchParams(window.location.search).get("kivitel") || "");
  if (urlKivitel) selected.add(urlKivitel);

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

  function syncHidden() {
    const list = [...selected];
    writeJsonList(hidden, list);
    if (summaryEl) summaryEl.textContent = labelList(list);
  }

  function renderList() {
    const rows = options
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
  panel.querySelector("[data-auto-kivitel-back]")?.addEventListener("click", closePanel);
  panel.querySelector("[data-auto-kivitel-done]")?.addEventListener("click", closePanel);

  bodyEl.addEventListener("change", (event) => {
    const el = event.target.closest("[data-auto-kivitel-opt]");
    if (!el) return;
    const opt = el.getAttribute("data-auto-kivitel-opt");
    if (el.checked) selected.add(opt);
    else selected.delete(opt);
    syncHidden();
  });

  bodyEl.addEventListener("click", (event) => {
    if (!event.target.closest("[data-auto-kivitel-clear]")) return;
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

  form.dataset.kivitelPicker = "1";
  syncHidden();
}

export function readKivitelFilterValues(form) {
  if (!form) return {};
  const el = form.querySelector('[data-filter-key="kivitelek"]');
  if (!el) return {};
  const kivitelek = parseJsonList(el.value).map(normalizeKivitel).filter(Boolean);
  return kivitelek.length ? { kivitelek } : {};
}

export function kivitelListMatches(listingValue, selectedValues) {
  if (!selectedValues?.length) return true;
  const got = normalizeKivitel(listingValue);
  if (!got) return false;
  return selectedValues.some((want) => normalizeKivitel(want) === got);
}
