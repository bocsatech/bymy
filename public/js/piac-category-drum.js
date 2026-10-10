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
    backBtn.hidden = false;
    backBtn.dataset.piacBack = "close";
    subEl.hidden = false;
    subEl.textContent = topNode.label || topNode.slug;
    toolbar.classList.add("is-visible");

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
    backBtn.dataset.piacBack = "main";
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
    if (view === "kids" || backBtn.dataset.piacBack === "main") {
      renderMain();
      return;
    }
    finish(false);
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

/**
 * Egy tulajdonság / almenü dobkerék sheet (egyszeres vagy többes választás).
 * @param {object} opts
 * @param {string} opts.title
 * @param {{ value: string, label: string }[]} opts.items
 * @param {string|string[]} [opts.value]
 * @param {boolean} [opts.multi]
 * @param {boolean} [opts.includeEmpty]
 * @param {string} [opts.emptyLabel]
 * @param {(value: string|string[]) => void} opts.onDone
 */
export function openPiacOptionSheet({
  title = "Választás",
  items = [],
  value = "",
  multi = false,
  includeEmpty = !multi,
  emptyLabel = "«Válassz»",
  onDone,
} = {}) {
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

  const selected = new Set(
    (Array.isArray(value) ? value : [value]).map((v) => String(v ?? "").trim()).filter(Boolean)
  );

  const root = createShell(title);
  const listEl = root.querySelector(".piac-cat-drum__list");
  const chipEl = root.querySelector(".piac-cat-drum__chip");
  const backBtn = root.querySelector(".piac-cat-drum__back");
  const subEl = root.querySelector(".piac-cat-drum__sub");
  const toolbar = root.querySelector(".piac-cat-drum__toolbar");

  backBtn.hidden = false;
  backBtn.dataset.piacBack = "close";
  subEl.hidden = false;
  subEl.textContent = title;
  toolbar.classList.add("is-visible");

  function syncChip() {
    if (!selected.size) {
      chipEl.textContent = multi ? "Válassz…" : emptyLabel;
      chipEl.classList.add("is-empty");
      return;
    }
    const labels = items.filter((it) => selected.has(String(it.value))).map((it) => it.label);
    chipEl.textContent = labels.join(", ") || [...selected].join(", ");
    chipEl.classList.remove("is-empty");
  }

  function paint() {
    const rows = [];
    if (includeEmpty && !multi) {
      rows.push({ value: "", label: emptyLabel, selected: selected.size === 0, chevron: false });
    }
    for (const it of items) {
      const v = String(it.value ?? "");
      rows.push({
        value: v,
        label: it.label || v,
        selected: selected.has(v),
        chevron: false,
      });
    }
    listEl.innerHTML = rows.map((r) => rowHtml(r)).join("");
    listEl.querySelectorAll(".piac-cat-drum__row").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.dataset.value ?? "";
        if (multi) {
          if (!v) return;
          if (selected.has(v)) selected.delete(v);
          else selected.add(v);
          paint();
          return;
        }
        selected.clear();
        if (v) selected.add(v);
        paint();
      });
    });
    syncChip();
  }

  function finish(commit) {
    const cb = active?.onDone;
    closePiacCategoryDrum();
    if (!commit || typeof cb !== "function") return;
    if (multi) cb([...selected]);
    else cb([...selected][0] || "");
  }

  backBtn.addEventListener("click", (event) => {
    event.preventDefault();
    finish(false);
  });
  root.querySelector(".piac-cat-drum__backdrop")?.addEventListener("click", () => finish(false));
  root.querySelector(".piac-cat-drum__close")?.addEventListener("click", () => finish(false));
  root.querySelector(".piac-cat-drum__done")?.addEventListener("click", () => finish(true));

  document.body.appendChild(root);
  lockBody(true);
  active = { root, onDone, kind: "option" };
  paint();
}
