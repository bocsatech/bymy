/**
 * Hirdetésfeladás — Állapot / Kivitel / Okmány kapcsolós panel (mint az autó kereső).
 * Egy érték választható; a natív select rejtve marad validációhoz és mentéshez.
 */

import { ALLAPOT_CATEGORIES, OKMANY_JELLEG_OPTIONS } from "./equipment-data.js?v=teherKivitel35e";
import { KIVITEL_OPTIONS } from "./kivitel-options.js?v=kivitel1";
import { bindAutoBmDismiss, autoBmPanelIsOpen } from "./auto-bm-dismiss.js?v=bmDismiss1";

const PLACEHOLDER = "Válasszon";

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

function setSelectValue(select, value) {
  if (!select) return;
  const next = String(value ?? "");
  if (select.value === next) return;
  select.value = next;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function optionLabel(select, value) {
  if (!value) return PLACEHOLDER;
  for (const opt of select.options) {
    if (opt.value === value) return opt.textContent?.trim() || value;
  }
  return value;
}

function findAllapotCategory(value) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  for (const cat of ALLAPOT_CATEGORIES) {
    if (cat.value === v) return cat;
    if (cat.children?.some((c) => c.value === v)) return cat;
  }
  return null;
}

export function isSzemelyautoAdForm(form) {
  if (!form) return false;
  const vertical = String(form.elements.namedItem("hirdetes_vertical")?.value ?? "")
    .trim()
    .toLowerCase();
  if (vertical === "ingatlan") return false;
  const subtype = String(
    form.elements.namedItem("hirdetes_alkategoria")?.value ??
      form.elements.namedItem("jarmu_kategoria")?.value ??
      ""
  )
    .trim()
    .toLowerCase();
  if (subtype === "teherauto" || subtype === "kisteher" || subtype === "ingatlan") return false;
  if (vertical === "teher") return false;
  return true;
}

/** @type {(() => void) | null} */
let closeOpenPanel = null;

function registerOpenPanel(close) {
  if (closeOpenPanel && closeOpenPanel !== close) closeOpenPanel();
  closeOpenPanel = close;
}

function unregisterOpenPanel(close) {
  if (closeOpenPanel === close) closeOpenPanel = null;
}

function fieldHost(select) {
  return select?.closest(".labeled-field, .md-outlined, .ad-layout-item");
}

function anchorField(select) {
  const field = fieldHost(select);
  if (!field) return null;
  field.classList.add("ad-form-bm-anchor");
  return field;
}

function hideNativeSelect(select) {
  select.classList.add("ad-form-bm-native");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
}

function showNativeSelect(select) {
  select.classList.remove("ad-form-bm-native");
  select.removeAttribute("tabindex");
  select.removeAttribute("aria-hidden");
}

function unmountPicker(select) {
  if (!select) return;
  showNativeSelect(select);
  const field = fieldHost(select);
  field?.classList.remove("ad-form-bm-anchor", "is-open");
  field?.querySelector(`.ad-form-bm-field[data-ad-bm-for="${select.id}"]`)?.remove();
  select._adBmPanel?.remove();
  delete select._adBmPanel;
  delete select._adBmClose;
  delete select.dataset.adBmPicker;
}

/**
 * @param {{
 *   select: HTMLSelectElement,
 *   title: string,
 *   panelClass: string,
 *   openAttr: string,
 *   renderBody: (bodyEl: HTMLElement) => void,
 *   bindBody: (bodyEl: HTMLElement) => void,
 *   syncSummary: (summaryEl: HTMLElement) => void,
 *   syncFromSelect: () => void,
 * }} opts
 */
function mountBmPicker(opts) {
  const { select, title, panelClass, openAttr, renderBody, bindBody, syncSummary, syncFromSelect } = opts;
  if (!select || select.tagName !== "SELECT" || select.dataset.adBmPicker === "1") return;

  const field = anchorField(select);
  if (!field) return;

  unmountPicker(select);
  hideNativeSelect(select);

  const wrap = document.createElement("div");
  wrap.className = "ad-form-bm-field auto-bm-field";
  wrap.dataset.adBmFor = select.id;
  wrap.innerHTML = `
    <button type="button" class="auto-bm-trigger" ${openAttr}>
      <span data-ad-bm-summary>${escapeHtml(PLACEHOLDER)}</span>
      <span class="auto-bm-trigger__chev" aria-hidden="true">⌄</span>
    </button>
  `;
  select.insertAdjacentElement("beforebegin", wrap);

  const summaryEl = wrap.querySelector("[data-ad-bm-summary]");
  const openBtn = wrap.querySelector(`[${openAttr}]`);

  const panel = document.createElement("div");
  panel.className = `auto-bm-panel ad-form-bm-panel ${panelClass}`;
  panel.hidden = true;
  panel.innerHTML = `
    <div class="auto-bm-panel__chrome">
      <button type="button" class="auto-bm-panel__back" data-ad-bm-back aria-label="Vissza">‹</button>
      <div class="auto-bm-panel__titles">
        <p class="auto-bm-panel__title">${escapeHtml(title)}</p>
      </div>
      <button type="button" class="auto-bm-panel__done" data-ad-bm-done>Kész</button>
    </div>
    <div class="auto-bm-panel__body" data-ad-bm-body></div>
  `;
  field.appendChild(panel);
  select._adBmPanel = panel;
  const bodyEl = panel.querySelector("[data-ad-bm-body]");

  function refreshSummary() {
    if (summaryEl) summaryEl.textContent = optionLabel(select, select.value);
    wrap.classList.toggle("has-value", Boolean(String(select.value || "").trim()));
  }

  function openPanel() {
    registerOpenPanel(closePanel);
    syncFromSelect();
    renderBody(bodyEl);
    bindBody(bodyEl);
    field.classList.add("is-open");
    panel.hidden = false;
    panel.style.removeProperty("display");
    panel.classList.remove("is-closed");
  }

  function closePanel() {
    field.classList.remove("is-open");
    panel.hidden = true;
    panel.style.setProperty("display", "none", "important");
    panel.classList.add("is-closed");
    unregisterOpenPanel(closePanel);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    refreshSummary();
  }

  openBtn?.addEventListener("click", () => {
    if (!panel.hidden && !panel.classList.contains("is-closed")) closePanel();
    else openPanel();
  });

  bindAutoBmDismiss({
    panel,
    roots: [field, wrap],
    isOpen: () => autoBmPanelIsOpen(panel),
    close: closePanel,
  });

  panel.querySelector("[data-ad-bm-back]")?.addEventListener("click", closePanel);
  panel.querySelector("[data-ad-bm-done]")?.addEventListener("click", closePanel);

  select.addEventListener("change", refreshSummary);
  refreshSummary();

  select.dataset.adBmPicker = "1";
  select._adBmClose = closePanel;
}

function renderFlatBody(bodyEl, options, current) {
  const rows = options
    .map((opt) => {
      const on = current === opt;
      return `<div class="auto-bm-row">
        <label class="auto-bm-toggle">
          <span>${escapeHtml(opt)}</span>
          <input type="checkbox" data-ad-bm-flat="${escapeAttr(opt)}" ${on ? "checked" : ""} />
          <span class="auto-bm-switch" aria-hidden="true"></span>
        </label>
      </div>`;
    })
    .join("");
  bodyEl.innerHTML = `
    <p class="auto-bm-hint">Kapcsolók — válasszon egyet</p>
    <button type="button" class="auto-bm-clear" data-ad-bm-clear>Törlés</button>
    <div class="auto-bm-group">${rows}</div>
  `;
}

function mountFlatPicker(select, title, options, panelClass, openAttr) {
  mountBmPicker({
    select,
    title,
    panelClass,
    openAttr,
    syncFromSelect: () => {},
    renderBody(bodyEl) {
      renderFlatBody(bodyEl, options, String(select.value || "").trim());
    },
    bindBody(bodyEl) {
      bodyEl.onchange = (event) => {
        const el = event.target.closest("[data-ad-bm-flat]");
        if (!el) return;
        const opt = el.getAttribute("data-ad-bm-flat") ?? "";
        if (el.checked) setSelectValue(select, opt);
        else if (select.value === opt) setSelectValue(select, "");
        renderFlatBody(bodyEl, options, String(select.value || "").trim());
      };
      bodyEl.onclick = (event) => {
        if (!event.target.closest("[data-ad-bm-clear]")) return;
        setSelectValue(select, "");
        renderFlatBody(bodyEl, options, "");
      };
    },
    syncSummary(summaryEl) {
      summaryEl.textContent = optionLabel(select, select.value);
    },
  });
}

function mountAllapotPicker(select) {
  /** @type {Set<string>} */
  let openMains = new Set();

  function syncOpenFromValue() {
    openMains = new Set();
    const cat = findAllapotCategory(select.value);
    if (cat) openMains.add(cat.id);
  }

  function renderAllapotBody(bodyEl) {
    const current = String(select.value || "").trim();
    const rows = ALLAPOT_CATEGORIES.map((cat) => {
      const hasKids = Boolean(cat.children?.length);
      const expanded = openMains.has(cat.id);
      let kidsHtml = "";
      if (hasKids && expanded) {
        kidsHtml = `<div class="auto-fuel-children">
          ${cat.children
            .map((child) => {
              const childOn = current === child.value;
              return `<div class="auto-bm-row auto-fuel-child-row">
                <label class="auto-bm-toggle">
                  <span>${escapeHtml(child.label)}</span>
                  <input type="checkbox" data-ad-bm-allapot-child="${escapeAttr(child.value)}" data-ad-bm-allapot-parent="${escapeAttr(cat.id)}" ${childOn ? "checked" : ""} />
                  <span class="auto-bm-switch" aria-hidden="true"></span>
                </label>
              </div>`;
            })
            .join("")}
        </div>`;
      }
      const mainOn = hasKids ? expanded : current === cat.value;
      return `<div class="auto-bm-row auto-fuel-main-row" data-ad-bm-allapot-main="${escapeAttr(cat.id)}">
        <label class="auto-bm-toggle auto-fuel-main-toggle">
          <span class="auto-fuel-main-label">${escapeHtml(cat.label)}</span>
          <input type="checkbox" data-ad-bm-allapot-main="${escapeAttr(cat.id)}" ${mainOn ? "checked" : ""} />
          <span class="auto-bm-switch" aria-hidden="true"></span>
        </label>
        ${kidsHtml}
      </div>`;
    }).join("");

    bodyEl.innerHTML = `
      <p class="auto-bm-hint">Kapcsolók — válasszon egyet</p>
      <button type="button" class="auto-bm-clear" data-ad-bm-clear>Törlés</button>
      <div class="auto-bm-group">${rows}</div>
    `;
  }

  mountBmPicker({
    select,
    title: "Állapot",
    panelClass: "ad-form-allapot-panel",
    openAttr: "data-ad-bm-allapot-open",
    syncFromSelect: syncOpenFromValue,
    renderBody: renderAllapotBody,
    bindBody(bodyEl) {
      bodyEl.onchange = (event) => {
        const mainEl = event.target.closest("[data-ad-bm-allapot-main]");
        if (mainEl) {
          const id = mainEl.getAttribute("data-ad-bm-allapot-main");
          const cat = ALLAPOT_CATEGORIES.find((c) => c.id === id);
          if (!cat) return;
          if (cat.children?.length) {
            if (mainEl.checked) openMains.add(id);
            else {
              openMains.delete(id);
              if (cat.children.some((c) => c.value === select.value)) setSelectValue(select, "");
            }
            renderAllapotBody(bodyEl);
            return;
          }
          if (mainEl.checked) setSelectValue(select, cat.value ?? "");
          else if (select.value === cat.value) setSelectValue(select, "");
          renderAllapotBody(bodyEl);
          return;
        }

        const childEl = event.target.closest("[data-ad-bm-allapot-child]");
        if (!childEl) return;
        const value = childEl.getAttribute("data-ad-bm-allapot-child") ?? "";
        const parentId = childEl.getAttribute("data-ad-bm-allapot-parent") ?? "";
        if (childEl.checked) {
          if (parentId) openMains.add(parentId);
          setSelectValue(select, value);
        } else if (select.value === value) {
          setSelectValue(select, "");
        }
        renderAllapotBody(bodyEl);
      };

      bodyEl.onclick = (event) => {
        if (!event.target.closest("[data-ad-bm-clear]")) return;
        openMains.clear();
        setSelectValue(select, "");
        renderAllapotBody(bodyEl);
      };
    },
    syncSummary(summaryEl) {
      summaryEl.textContent = optionLabel(select, select.value);
    },
  });
}

export function unmountAdFormBmPickers(form) {
  if (!form) return;
  ["allapot", "kivitel", "okmany_jelleg"].forEach((id) => {
    const select = document.getElementById(id);
    if (select?._adBmClose) select._adBmClose();
    unmountPicker(select);
  });
  delete form?.dataset.adBmPickers;
}

export function refreshAdFormBmPickers(form) {
  try {
    unmountAdFormBmPickers(form);
    mountAdFormBmPickers(form);
  } catch (error) {
    console.warn("Alapadatok kapcsolós panel frissítés:", error);
  }
}

export function mountAdFormBmPickers(form) {
  if (!form) return;
  if (!isSzemelyautoAdForm(form)) {
    unmountAdFormBmPickers(form);
    return;
  }

  const allapot = document.getElementById("allapot");
  const kivitel = document.getElementById("kivitel");
  const okmany = document.getElementById("okmany_jelleg");

  if (allapot?.tagName === "SELECT" && allapot.dataset.adBmPicker !== "1") mountAllapotPicker(allapot);
  if (kivitel?.tagName === "SELECT" && kivitel.dataset.adBmPicker !== "1") {
    mountFlatPicker(kivitel, "Kivitel", KIVITEL_OPTIONS, "ad-form-kivitel-panel", "data-ad-bm-kivitel-open");
  }
  if (okmany?.tagName === "SELECT" && okmany.dataset.adBmPicker !== "1") {
    mountFlatPicker(
      okmany,
      "Okmányok jellege",
      OKMANY_JELLEG_OPTIONS,
      "ad-form-okmany-panel",
      "data-ad-bm-okmany-open"
    );
  }

  form.dataset.adBmPickers = "1";
}

if (typeof window !== "undefined") {
  window.addEventListener("ad-form-layout-refresh", () => {
    refreshAdFormBmPickers(document.getElementById("ad-form"));
  });
  window.addEventListener("ad-form-ready", () => {
    refreshAdFormBmPickers(document.getElementById("ad-form"));
  });
}
