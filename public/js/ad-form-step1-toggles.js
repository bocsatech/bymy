/**
 * Személyautó hirdetésfeladás — Alapadatok kapcsolós mezők (állapot, kivitel, okmány).
 */

import { ALLAPOT_CATEGORIES, OKMANY_JELLEG_OPTIONS } from "./equipment-data.js?v=teherKivitel35e";
import { KIVITEL_OPTIONS } from "./kivitel-options.js?v=kivitel1";

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

function setSelectValue(select, value) {
  if (!select) return;
  const next = String(value ?? "");
  if (select.value === next) return;
  select.value = next;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function fieldHost(select) {
  return select?.closest(".labeled-field, .md-outlined, .ad-layout-item");
}

function mountFlatSingleSelect(select, options) {
  if (!select || select.tagName !== "SELECT") return;

  const field = fieldHost(select);
  if (!field) return;

  field.querySelectorAll(`.ad-form-toggle-group[data-ad-toggle-for="${select.id}"]`).forEach((el, i) => {
    if (i > 0) el.remove();
  });

  let group = field.querySelector(`.ad-form-toggle-group[data-ad-toggle-for="${select.id}"]`);
  if (!group) {
    select.classList.add("ad-form-toggle-native");
    group = document.createElement("div");
    group.className = "ad-form-toggle-group";
    group.dataset.adToggleFor = select.id;
    select.insertAdjacentElement("afterend", group);
  }

  group.innerHTML = `
    <div class="ad-form-toggle-list">
      ${options
        .map(
          (label) => `
        <div class="ad-form-toggle-row">
          <label class="ad-form-toggle">
            <span>${escapeHtml(label)}</span>
            <input type="checkbox" data-ad-flat-value="${escapeAttr(label)}" />
            <span class="ad-form-switch" aria-hidden="true"></span>
          </label>
        </div>`
        )
        .join("")}
    </div>
  `;

  function syncUiFromSelect() {
    const current = String(select.value ?? "").trim();
    group.querySelectorAll("[data-ad-flat-value]").forEach((input) => {
      input.checked = input.getAttribute("data-ad-flat-value") === current;
    });
  }

  group.onchange = (event) => {
    const input = event.target.closest("[data-ad-flat-value]");
    if (!input) return;
    const value = input.getAttribute("data-ad-flat-value") ?? "";
    if (input.checked) {
      setSelectValue(select, value);
      group.querySelectorAll("[data-ad-flat-value]").forEach((el) => {
        if (el !== input) el.checked = false;
      });
    } else if (select.value === value) {
      setSelectValue(select, "");
    }
  };

  syncUiFromSelect();
  if (!group.dataset.adToggleBound) {
    select.addEventListener("change", syncUiFromSelect);
    group.dataset.adToggleBound = "1";
  }
  group.dataset.adToggleMounted = "1";
}

function mountHierarchicalAllapot(select) {
  if (!select || select.tagName !== "SELECT") return;

  const field = fieldHost(select);
  if (!field) return;

  field.querySelectorAll(`.ad-form-toggle-group[data-ad-toggle-for="${select.id}"]`).forEach((el, i) => {
    if (i > 0) el.remove();
  });

  let group = field.querySelector(`.ad-form-toggle-group[data-ad-toggle-for="${select.id}"]`);
  if (!group) {
    select.classList.add("ad-form-toggle-native");
    group = document.createElement("div");
    group.className = "ad-form-toggle-group ad-form-toggle-group--tree";
    group.dataset.adToggleFor = select.id;
    select.insertAdjacentElement("afterend", group);
  }

  /** @type {Set<string>} */
  const openMains = new Set();

  function render() {
    const current = String(select.value ?? "").trim();
    const rows = ALLAPOT_CATEGORIES.map((cat) => {
      const on = openMains.has(cat.id);
      const hasKids = Boolean(cat.children?.length);
      let kidsHtml = "";
      if (hasKids && on) {
        kidsHtml = `<div class="ad-form-toggle-children">
          ${cat.children
            .map((child) => {
              const childOn = current === child.value;
              return `<div class="ad-form-toggle-row ad-form-toggle-row--child">
                <label class="ad-form-toggle">
                  <span>${escapeHtml(child.label)}</span>
                  <input type="checkbox" data-ad-allapot-child="${escapeAttr(child.value)}" data-ad-allapot-parent="${escapeAttr(cat.id)}" ${childOn ? "checked" : ""} />
                  <span class="ad-form-switch" aria-hidden="true"></span>
                </label>
              </div>`;
            })
            .join("")}
        </div>`;
      }
      const mainOn = hasKids ? on : current === cat.value;
      return `<div class="ad-form-toggle-row ad-form-toggle-row--main" data-ad-allapot-main="${escapeAttr(cat.id)}">
        <label class="ad-form-toggle ad-form-toggle--main">
          <span class="ad-form-toggle-main-label">${escapeHtml(cat.label)}</span>
          <input type="checkbox" data-ad-allapot-main="${escapeAttr(cat.id)}" ${mainOn ? "checked" : ""} />
          <span class="ad-form-switch" aria-hidden="true"></span>
        </label>
        ${kidsHtml}
      </div>`;
    }).join("");

    group.innerHTML = `<div class="ad-form-toggle-list">${rows}</div>`;
  }

  function syncOpenFromValue() {
    openMains.clear();
    const current = String(select.value ?? "").trim();
    if (!current) return;
    const cat = findAllapotCategory(current);
    if (cat) openMains.add(cat.id);
  }

  function syncUiFromSelect() {
    syncOpenFromValue();
    render();
  }

  group.onclick = (event) => {
    const mainEl = event.target.closest("[data-ad-allapot-main]");
    if (mainEl) {
      const id = mainEl.getAttribute("data-ad-allapot-main");
      const cat = ALLAPOT_CATEGORIES.find((c) => c.id === id);
      if (!cat) return;
      if (cat.children?.length) {
        if (mainEl.checked) openMains.add(id);
        else openMains.delete(id);
        render();
        return;
      }
      if (mainEl.checked) setSelectValue(select, cat.value ?? "");
      else if (select.value === cat.value) setSelectValue(select, "");
      syncUiFromSelect();
      return;
    }

    const childEl = event.target.closest("[data-ad-allapot-child]");
    if (!childEl) return;
    const value = childEl.getAttribute("data-ad-allapot-child") ?? "";
    const parentId = childEl.getAttribute("data-ad-allapot-parent") ?? "";
    if (childEl.checked) {
      if (parentId) openMains.add(parentId);
      setSelectValue(select, value);
    } else if (select.value === value) {
      setSelectValue(select, "");
    }
    syncUiFromSelect();
  };

  syncUiFromSelect();
  if (!group.dataset.adToggleBound) {
    select.addEventListener("change", syncUiFromSelect);
    group.dataset.adToggleBound = "1";
  }
  group.dataset.adToggleMounted = "1";
}

function unmountField(select) {
  if (!select) return;
  select.classList.remove("ad-form-toggle-native");
  const field = select.closest(".labeled-field");
  field?.querySelector(`.ad-form-toggle-group[data-ad-toggle-for="${select.id}"]`)?.remove();
}

export function unmountAdFormStep1Toggles(form) {
  if (!form) return;
  ["allapot", "kivitel", "okmany_jelleg"].forEach((id) => {
    unmountField(document.getElementById(id));
  });
  delete form.dataset.adStep1Toggles;
}

export function refreshAdFormStep1Toggles(form) {
  try {
    mountAdFormStep1Toggles(form);
  } catch (error) {
    console.warn("Alapadatok kapcsolók frissítés:", error);
  }
}

export function mountAdFormStep1Toggles(form) {
  if (!form) return;
  if (!isSzemelyautoAdForm(form)) {
    unmountAdFormStep1Toggles(form);
    return;
  }

  const allapot = document.getElementById("allapot");
  const kivitel = document.getElementById("kivitel");
  const okmany = document.getElementById("okmany_jelleg");

  if (allapot?.tagName === "SELECT") mountHierarchicalAllapot(allapot);
  if (kivitel?.tagName === "SELECT") mountFlatSingleSelect(kivitel, KIVITEL_OPTIONS);
  if (okmany?.tagName === "SELECT") mountFlatSingleSelect(okmany, OKMANY_JELLEG_OPTIONS);

  form.dataset.adStep1Toggles = "1";
}

if (typeof window !== "undefined") {
  window.addEventListener("ad-form-layout-refresh", () => {
    refreshAdFormStep1Toggles(document.getElementById("ad-form"));
  });
}
