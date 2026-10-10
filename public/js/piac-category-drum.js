/**
 * Piactér alkategória sheet:
 * 1) Fő kategória csempe marad
 * 2) Alkategória → lista sheet (koppintással választás)
 * 3) Ha van almenü → ugyanabban a sheetben nyílik (Vissza)
 */

import { closeAutoDrumSheet } from "./auto-drum-sheet.js?v=f531cca4c9";
import { closeAllInlineDrums } from "./immo-drum-picker.js?v=c4c7ac29a2";

let active = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hasNestedChildren(topNode) {
  return (topNode?.children || []).some((c) => (c.children || []).length > 0);
}

function lockBody(open) {
  document.body.classList.toggle("auto-drum-sheet-open", open);
  document.body.classList.toggle("piac-cat-drum-open", open);
}

function createShell(title) {
  const root = document.createElement("div");
  root.className = "piac-cat-drum";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", title);
  root.innerHTML = `
    <button type="button" class="piac-cat-drum__backdrop" aria-label="Bezárás"></button>
    <div class="piac-cat-drum__stage">
      <header class="piac-cat-drum__head">
        <button type="button" class="piac-cat-drum__close" aria-label="Bezárás">×</button>
        <h2 class="piac-cat-drum__title"></h2>
        <button type="button" class="piac-cat-drum__done">Kész</button>
      </header>
      <div class="piac-cat-drum__card">
        <div class="piac-cat-drum__toolbar">
          <button type="button" class="piac-cat-drum__back" hidden>Vissza</button>
          <p class="piac-cat-drum__sub" hidden></p>
        </div>
        <div class="piac-cat-drum__chip" aria-live="polite"></div>
        <div class="piac-cat-drum__list" role="listbox" aria-label="Alkategória"></div>
      </div>
    </div>`;
  root.querySelector(".piac-cat-drum__title").textContent = title;
  return root;
}

function rowHtml({ value, label, selected, chevron }) {
  return `<button type="button" class="piac-cat-drum__row${selected ? " is-on" : ""}" role="option" aria-selected="${
    selected ? "true" : "false"
  }" data-value="${escapeHtml(value)}">
      <span class="piac-cat-drum__row-label">${escapeHtml(label)}</span>
      ${chevron ? `<span class="piac-cat-drum__row-chev" aria-hidden="true">›</span>` : ""}
      ${selected && !chevron ? `<span class="piac-cat-drum__row-check" aria-hidden="true">✓</span>` : ""}
    </button>`;
}

/**
 * @param {object} opts
 * @param {object} opts.topNode
 * @param {string[]} [opts.initialPath]
 * @param {boolean} [opts.includeAllOption]
 * @param {string} [opts.title]
 * @param {(path: string[]) => void} opts.onDone
 */
export function openPiacCategoryDrum({
  topNode,
  initialPath = [],
  includeAllOption = false,
  title = "Alkategória",
  onDone,
} = {}) {
  if (!topNode?.slug) return;
  closePiacCategoryDrum();
  try {
    closeAutoDrumSheet(false);
  } catch {
    /* ignore */
  }
  try {
    closeAllInlineDrums(false);
  } catch {
    /* ignore */
  }

  const mids = topNode.children || [];
  let midSlug = String(initialPath[1] || "");
  let leafSlug = String(initialPath[2] || "");
  if (!includeAllOption && !midSlug && mids[0]) midSlug = mids[0].slug;

  /** @type {"main"|"kids"} */
  let view = "main";
  let parentSlug = "";

  const root = createShell(title);
  const listEl = root.querySelector(".piac-cat-drum__list");
  const chipEl = root.querySelector(".piac-cat-drum__chip");
  const backBtn = root.querySelector(".piac-cat-drum__back");
  const subEl = root.querySelector(".piac-cat-drum__sub");
  const toolbar = root.querySelector(".piac-cat-drum__toolbar");

  function midNode(slug) {
    return mids.find((c) => c.slug === slug) || null;
  }

  function pathSlugs() {
    if (!midSlug) return [topNode.slug];
    const mid = midNode(midSlug);
    if (!mid) return [topNode.slug];
    if ((mid.children || []).length && leafSlug) {
      return [topNode.slug, mid.slug, leafSlug];
    }
    return [topNode.slug, mid.slug];
  }

  function syncChip() {
    const parts = [];
    const mid = midNode(midSlug);
    if (mid) parts.push(mid.label || mid.slug);
    if (mid && leafSlug) {
      const leaf = (mid.children || []).find((c) => c.slug === leafSlug);
      if (leaf) parts.push(leaf.label || leaf.slug);
    }
    chipEl.textContent = parts.length ? parts.join(" › ") : includeAllOption ? "Összes" : "Válassz…";
    chipEl.classList.toggle("is-empty", !parts.length);
  }

  function renderMain() {
    view = "main";
    parentSlug = "";
    backBtn.hidden = true;
    subEl.hidden = true;
    toolbar.classList.remove("is-visible");

    const rows = [];
    if (includeAllOption) {
      rows.push({
        value: "",
        label: "Összes",
        selected: !midSlug,
        chevron: false,
      });
    }
    for (const mid of mids) {
      const hasKids = (mid.children || []).length > 0;
      rows.push({
        value: mid.slug,
        label: mid.label || mid.slug,
        selected: midSlug === mid.slug,
        chevron: hasKids,
      });
    }

    listEl.innerHTML = rows.map((r) => rowHtml(r)).join("");
    listEl.querySelectorAll(".piac-cat-drum__row").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.value ?? "";
        if (value === "") {
          midSlug = "";
          leafSlug = "";
          syncChip();
          renderMain();
          return;
        }
        const mid = midNode(value);
        const kids = mid?.children || [];
        if (kids.length) {
          midSlug = value;
          if (!kids.some((k) => k.slug === leafSlug)) leafSlug = "";
          renderKids(value);
          return;
        }
        midSlug = value;
        leafSlug = "";
        syncChip();
        renderMain();
      });
    });
    syncChip();
  }

  function renderKids(midValue) {
    const mid = midNode(midValue);
    if (!mid) {
      renderMain();
      return;
    }
    view = "kids";
    parentSlug = midValue;
    midSlug = midValue;
    backBtn.hidden = false;
    subEl.hidden = false;
    subEl.textContent = mid.label || mid.slug;
    toolbar.classList.add("is-visible");

    const kids = mid.children || [];
    listEl.innerHTML = kids
      .map((k) =>
        rowHtml({
          value: k.slug,
          label: k.label || k.slug,
          selected: leafSlug === k.slug,
          chevron: false,
        })
      )
      .join("");

    listEl.querySelectorAll(".piac-cat-drum__row").forEach((btn) => {
      btn.addEventListener("click", () => {
        leafSlug = btn.dataset.value ?? "";
        midSlug = parentSlug;
        syncChip();
        renderKids(parentSlug);
      });
    });
    syncChip();
  }

  function finish(commit) {
    const cb = active?.onDone;
    if (commit) {
      const mid = midNode(midSlug);
      const kids = mid?.children || [];
      if (kids.length && !leafSlug) {
        if (view !== "kids") {
          renderKids(midSlug);
          return;
        }
        leafSlug = kids[0].slug;
      }
    }
    const finalPath = pathSlugs();
    closePiacCategoryDrum();
    if (commit && typeof cb === "function") cb(finalPath);
  }

  backBtn.addEventListener("click", (event) => {
    event.preventDefault();
    renderMain();
  });
  root.querySelector(".piac-cat-drum__backdrop")?.addEventListener("click", () => finish(false));
  root.querySelector(".piac-cat-drum__close")?.addEventListener("click", () => finish(false));
  root.querySelector(".piac-cat-drum__done")?.addEventListener("click", () => finish(true));

  document.body.appendChild(root);
  lockBody(true);
  active = { root, onDone, topSlug: topNode.slug };

  if (leafSlug && midSlug && (midNode(midSlug)?.children || []).length) {
    renderKids(midSlug);
  } else {
    renderMain();
  }
}

export function closePiacCategoryDrum() {
  if (!active) return;
  active.root?.remove();
  active = null;
  lockBody(false);
}

export function piacTopHasNested(topNode) {
  return hasNestedChildren(topNode);
}
