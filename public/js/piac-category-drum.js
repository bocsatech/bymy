/**
 * Piactér alkategória dobkerék:
 * 1) Fő kategória csempe marad
 * 2) Alkategória → dobkerék sheet
 * 3) Ha van almenü → osztott dobkerék (bal: alkategória, jobb: almenü)
 */

import { closeAutoDrumSheet } from "./auto-drum-sheet.js?v=f531cca4c9";
import { closeAllInlineDrums } from "./immo-drum-picker.js?v=c4c7ac29a2";

const ITEM_H = 44;
const VISIBLE = 5;

let active = null;
let paintFrame = 0;

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

function itemsOf(scrollEl) {
  return [...(scrollEl?.querySelectorAll(".immo-drum-inline-item") || [])];
}

function colItemH(scrollEl) {
  const first = itemsOf(scrollEl)[0];
  const h = first?.getBoundingClientRect?.().height;
  return h > 0 ? h : ITEM_H;
}

function nearestIndex(scrollEl) {
  const items = itemsOf(scrollEl);
  if (!items.length) return 0;
  const h = colItemH(scrollEl);
  return Math.max(0, Math.min(items.length - 1, Math.round(scrollEl.scrollTop / h)));
}

function nearestItem(scrollEl) {
  return itemsOf(scrollEl)[nearestIndex(scrollEl)] || null;
}

function scrollToIndex(scrollEl, index) {
  const items = itemsOf(scrollEl);
  if (!items.length) return;
  const i = Math.max(0, Math.min(items.length - 1, Number(index) || 0));
  scrollEl.scrollTop = i * colItemH(scrollEl);
}

function scrollToValue(scrollEl, value) {
  const items = itemsOf(scrollEl);
  const want = String(value ?? "");
  const idx = items.findIndex((el) => (el.dataset.value ?? "") === want);
  scrollToIndex(scrollEl, idx >= 0 ? idx : 0);
}

function paintCol(scrollEl) {
  const h = colItemH(scrollEl);
  const center = h > 0 ? scrollEl.scrollTop / h : 0;
  itemsOf(scrollEl).forEach((item, i) => {
    const dist = Math.abs(i - center);
    const on = dist <= 0.45;
    item.style.opacity = String(on ? 1 : Math.max(0.35, 1 - dist * 0.35));
    item.style.fontWeight = on ? "800" : "500";
    item.classList.toggle("is-in-cell", on);
  });
}

function itemHtml(row) {
  return `<div class="immo-drum-inline-item" data-value="${escapeHtml(row.value)}"><span class="immo-drum-inline-text">${escapeHtml(row.label)}</span></div>`;
}

function fillScroll(scrollEl, rows) {
  if (!scrollEl) return;
  scrollEl.innerHTML = (rows || []).map(itemHtml).join("");
  scrollEl.style.paddingTop = `${ITEM_H * 2}px`;
  scrollEl.style.paddingBottom = `${ITEM_H * 2}px`;
  scrollEl.style.height = `${ITEM_H * VISIBLE}px`;
  scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((el) => {
    el.style.height = `${ITEM_H}px`;
    el.style.minHeight = `${ITEM_H}px`;
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.boxSizing = "border-box";
  });
}

function lockBody(open) {
  document.body.classList.toggle("auto-drum-sheet-open", open);
  document.body.classList.toggle("piac-cat-drum-open", open);
}

function createShell(title) {
  const root = document.createElement("div");
  root.className =
    "auto-drum-portal auto-drum-portal--multi auto-drum-portal--sheet auto-drum-portal--ym piac-cat-drum";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", title);
  root.innerHTML = `
    <button type="button" class="auto-drum-portal__backdrop" aria-label="Bezárás"></button>
    <div class="auto-drum-portal__stage auto-drum-portal__stage--multi auto-drum-portal__stage--sheet">
      <header class="auto-drum-portal__sheet-head">
        <button type="button" class="auto-drum-portal__close" aria-label="Bezárás">×</button>
        <h2 class="auto-drum-portal__sheet-title"></h2>
        <button type="button" class="auto-drum-portal__done auto-drum-portal__done--sheet-top">Kész</button>
      </header>
      <div class="auto-drum-portal__sheet-scroll" data-sheet-scroll tabindex="-1">
        <div class="auto-drum-portal__sheet-top-space" aria-hidden="true"></div>
        <div class="immo-drum-wheel-ring auto-drum-portal__ring auto-drum-portal__ring--multi auto-drum-portal__ring--sheet piac-cat-drum__ring">
          <div class="auto-drum-ym__chips piac-cat-drum__chip-row">
            <button type="button" class="auto-drum-split__chip piac-cat-drum__chip" aria-label="Kiválasztás">
              <span class="auto-drum-split__chip-label"></span>
            </button>
          </div>
          <div class="auto-drum-ym__heads piac-cat-drum__heads" aria-hidden="true"></div>
          <div class="auto-drum-ym__body piac-cat-drum__body">
            <div class="immo-drum-inline-highlight auto-drum-ym__highlight" aria-hidden="true"></div>
            <div class="auto-drum-ym__cols piac-cat-drum__cols"></div>
          </div>
        </div>
      </div>
    </div>`;
  root.querySelector(".auto-drum-portal__sheet-title").textContent = title;
  return root;
}

function midRows(topNode, { includeAll }) {
  const rows = [];
  if (includeAll) rows.push({ value: "", label: "Összes" });
  for (const c of topNode?.children || []) {
    rows.push({ value: c.slug, label: c.label || c.slug });
  }
  return rows;
}

function leafRows(midNode) {
  const kids = midNode?.children || [];
  if (!kids.length) {
    return [{ value: "", label: midNode?.label || "Összes" }];
  }
  return kids.map((c) => ({ value: c.slug, label: c.label || c.slug }));
}

/**
 * @param {object} opts
 * @param {object} opts.topNode catalog top
 * @param {string[]} [opts.initialPath] [top, mid?, leaf?]
 * @param {boolean} [opts.includeAllOption]
 * @param {string} [opts.title]
 * @param {(path: string[]) => void} opts.onDone path slugs (top + optional mid/leaf)
 */
export function openPiacCategoryDrum({
  topNode,
  initialPath = [],
  includeAllOption = false,
  title = "Alkategória",
  onDone,
} = {}) {
  if (!topNode?.slug) return;
  closePiacCategoryDrum(false);
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

  const split = hasNestedChildren(topNode);
  const mids = topNode.children || [];
  let midSlug = String(initialPath[1] || "");
  let leafSlug = String(initialPath[2] || "");
  if (!midSlug && mids[0] && !includeAllOption) midSlug = mids[0].slug;

  const root = createShell(title);
  const heads = root.querySelector(".piac-cat-drum__heads");
  const cols = root.querySelector(".piac-cat-drum__cols");
  const chipLabel = root.querySelector(".piac-cat-drum__chip .auto-drum-split__chip-label");
  const highlight = root.querySelector(".auto-drum-ym__highlight");

  if (split) {
    heads.innerHTML = "<span>Alkategória</span><span>Almenü</span>";
    heads.classList.add("is-split");
    cols.classList.add("is-split");
    cols.innerHTML = `
      <div class="auto-drum-split__col" data-half="mid">
        <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
      </div>
      <div class="auto-drum-split__col" data-half="leaf">
        <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
      </div>`;
  } else {
    heads.innerHTML = "<span>Alkategória</span>";
    cols.innerHTML = `
      <div class="auto-drum-split__col" data-half="mid">
        <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
      </div>`;
  }

  const midScroll = root.querySelector('[data-half="mid"] .auto-drum-split__scroll');
  const leafScroll = root.querySelector('[data-half="leaf"] .auto-drum-split__scroll');

  function currentMid() {
    return mids.find((c) => c.slug === midSlug) || null;
  }

  function pathSlugs() {
    if (!midSlug) return [topNode.slug];
    const mid = currentMid();
    if (!mid) return [topNode.slug];
    if (split && (mid.children || []).length && leafSlug) {
      return [topNode.slug, mid.slug, leafSlug];
    }
    return [topNode.slug, mid.slug];
  }

  function pathLabels() {
    const parts = [topNode.label || topNode.slug];
    const mid = currentMid();
    if (mid) parts.push(mid.label || mid.slug);
    if (split && mid && leafSlug) {
      const leaf = (mid.children || []).find((c) => c.slug === leafSlug);
      if (leaf) parts.push(leaf.label || leaf.slug);
    }
    return parts;
  }

  function syncChip() {
    if (!chipLabel) return;
    const labels = pathLabels();
    chipLabel.textContent = labels.length > 1 ? labels.slice(1).join(" › ") : "Összes";
  }

  let midSyncTimer = 0;

  function paintAll() {
    cancelAnimationFrame(paintFrame);
    paintFrame = requestAnimationFrame(() => {
      paintCol(midScroll);
      if (leafScroll) paintCol(leafScroll);
      const midItem = nearestItem(midScroll);
      const nextMid = midItem?.dataset.value ?? "";
      if (leafScroll) {
        const leafItem = nearestItem(leafScroll);
        leafSlug = leafItem?.dataset.value ?? "";
      }
      if (split && nextMid !== midSlug) {
        window.clearTimeout(midSyncTimer);
        midSyncTimer = window.setTimeout(() => {
          midSlug = nearestItem(midScroll)?.dataset.value ?? "";
          refillLeaves("");
          paintCol(midScroll);
          if (leafScroll) paintCol(leafScroll);
          syncChip();
        }, 90);
      } else {
        midSlug = nextMid;
      }
      syncChip();
    });
  }

  function refillLeaves(preserveLeaf) {
    if (!leafScroll) return;
    const mid = currentMid();
    const rows = midSlug ? leafRows(mid) : [{ value: "", label: "—" }];
    fillScroll(leafScroll, rows);
    const want =
      preserveLeaf && rows.some((r) => r.value === preserveLeaf)
        ? preserveLeaf
        : rows[0]?.value || "";
    leafSlug = want;
    scrollToValue(leafScroll, want);
    bindColClicks(leafScroll, (value) => {
      leafSlug = value;
      scrollToValue(leafScroll, value);
      paintAll();
    });
  }

  function bindColClicks(scrollEl, onPick) {
    if (!scrollEl || scrollEl.dataset.bound === "1") return;
    scrollEl.dataset.bound = "1";
    scrollEl.addEventListener("scroll", () => paintAll(), { passive: true });
    let moved = false;
    let startY = 0;
    scrollEl.addEventListener(
      "touchstart",
      (e) => {
        startY = e.touches?.[0]?.clientY ?? 0;
        moved = false;
      },
      { passive: true }
    );
    scrollEl.addEventListener(
      "touchmove",
      (e) => {
        if (Math.abs((e.touches?.[0]?.clientY ?? startY) - startY) > 4) moved = true;
      },
      { passive: true }
    );
    const snap = () => {
      if (!moved) return;
      const item = nearestItem(scrollEl);
      if (item) scrollToValue(scrollEl, item.dataset.value ?? "");
      paintAll();
      if (scrollEl === midScroll && split) {
        midSlug = nearestItem(midScroll)?.dataset.value ?? "";
        refillLeaves(leafSlug);
        paintAll();
      }
    };
    scrollEl.addEventListener("touchend", snap);
    scrollEl.addEventListener("touchcancel", snap);
    scrollEl.addEventListener("click", (event) => {
      const item = event.target.closest(".immo-drum-inline-item");
      if (!item || !scrollEl.contains(item)) return;
      event.preventDefault();
      const value = item.dataset.value ?? "";
      onPick(value);
      if (scrollEl === midScroll && split) refillLeaves(leafSlug);
      paintAll();
    });
  }

  fillScroll(midScroll, midRows(topNode, { includeAll: includeAllOption }));
  scrollToValue(midScroll, midSlug);
  bindColClicks(midScroll, (value) => {
    midSlug = value;
    scrollToValue(midScroll, value);
    if (split) refillLeaves("");
  });

  if (split) {
    refillLeaves(leafSlug);
  }

  function finish(commit) {
    const path = pathSlugs();
    const cb = active?.onDone;
    closePiacCategoryDrum(false);
    if (commit && typeof cb === "function") cb(path);
  }

  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => finish(false));
  root.querySelector(".auto-drum-portal__close")?.addEventListener("click", () => finish(false));
  root.querySelector(".auto-drum-portal__done")?.addEventListener("click", () => finish(true));

  document.body.appendChild(root);
  lockBody(true);
  active = { root, onDone, topSlug: topNode.slug };

  const align = () => {
    scrollToValue(midScroll, midSlug);
    if (leafScroll) scrollToValue(leafScroll, leafSlug);
    paintCol(midScroll);
    if (leafScroll) paintCol(leafScroll);
    syncChip();
    if (highlight) {
      highlight.style.left = "0.4rem";
      highlight.style.right = "0.4rem";
      highlight.style.width = "auto";
      highlight.style.transform = "translateY(-50%)";
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(align));
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
