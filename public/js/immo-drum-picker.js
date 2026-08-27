/**
 * Inline drum picker — fix cella + kerék gyűrű (v2).
 * Visszaállítás: ?immoDrum=legacy vagy localStorage immo-drum-mode=legacy
 *
 * Látható sorok: 1 fent + középső (kijelölt) + 1 lent.
 * Cellába kattintás: érték (többesnél toggle) + bezárás.
 */

import { readWheel, readWheelList, setWheelValue, lockPageScroll, unlockPageScroll } from "./ingatlan-wheels.js?v=immoPortalPage1";

const ITEM_H = 40;
/** Pontosan 3 sor: fent / közép / lent */
const VISIBLE_ROWS = 3;
let paintFrame = 0;
let snapTimer = 0;

/** v2 = kerék gyűrű + alatta rejtés | legacy = előző egyszerű inline */
export function getDrumMode() {
  try {
    const q = new URLSearchParams(window.location.search).get("immoDrum");
    if (q === "legacy" || q === "v2") return q;
  } catch {
    /* ignore */
  }
  try {
    const stored = localStorage.getItem("immo-drum-mode");
    if (stored === "legacy" || stored === "v2") return stored;
  } catch {
    /* ignore */
  }
  return "v2";
}

export function applyDrumModeClass() {
  document.body.classList.remove("immo-drum-mode-v2", "immo-drum-mode-legacy");
  document.body.classList.add(`immo-drum-mode-${getDrumMode()}`);
}

/** Asztali + mobil: a kerék az ingatlan oldalon mindkét nézetben nyitható. */
function isDrumViewport() {
  return true;
}

function formatTriggerShort(label, value) {
  if (!value) return label;
  const t = String(label || "").trim();
  if (!t) return label;
  return t.replace(/\s*Ft\s*$/i, "").replace(/\s*M\s*Ft\s*$/i, " M").replace(/\s*m²\s*$/i, "").trim() || t;
}

function ensureInlineDrum(wrap) {
  let drum = wrap.querySelector(".immo-drum-inline");
  if (drum) return drum;
  drum = document.createElement("div");
  drum.className = "immo-drum-inline";
  drum.hidden = true;
  drum.innerHTML =
    '<div class="immo-drum-wheel-ring" aria-hidden="false">' +
    '<div class="immo-drum-inline-highlight"></div>' +
    '<div class="immo-drum-inline-scroll" tabindex="-1"></div>' +
    "</div>";
  wrap.appendChild(drum);
  return drum;
}

function cellAnchor(wrap) {
  return wrap.querySelector(".immo-wheel-trigger") || wrap;
}

function drumHostCell(wrap) {
  return wrap.closest(".immo-dual-range__half") || wrap.closest(".immo-schema-cell");
}

function drumHostRow(wrap) {
  return wrap.closest(".immo-dual-range");
}

function setDrumOpen(wrap, open) {
  const row = drumHostRow(wrap);
  if (row) row.classList.toggle("has-drum-open", open);
  else wrap.classList.toggle("has-drum-open", open);
}

function itemHeight(scrollEl) {
  const n = Number(scrollEl?.dataset?.itemH);
  return Number.isFinite(n) && n > 0 ? n : ITEM_H;
}

function itemsOf(scrollEl) {
  return [...scrollEl.querySelectorAll(".immo-drum-inline-item")];
}

/** padding-top = itemH mellett: scrollTop = index * itemH → a sor a gyűrű közepén. */
function scrollToIndex(scrollEl, index) {
  const items = itemsOf(scrollEl);
  if (!items.length) return;
  const itemH = itemHeight(scrollEl);
  const i = Math.max(0, Math.min(items.length - 1, Number(index) || 0));
  scrollEl.scrollTop = i * itemH;
}

function nearestIndex(scrollEl) {
  const items = itemsOf(scrollEl);
  if (!items.length) return 0;
  const itemH = itemHeight(scrollEl);
  return Math.max(0, Math.min(items.length - 1, Math.round(scrollEl.scrollTop / itemH)));
}

function nearestItem(scrollEl) {
  return itemsOf(scrollEl)[nearestIndex(scrollEl)] || null;
}

function paintInline(scrollEl) {
  cancelAnimationFrame(paintFrame);
  paintFrame = requestAnimationFrame(() => {
    const itemH = itemHeight(scrollEl);
    const centerIdx = itemH > 0 ? scrollEl.scrollTop / itemH : 0;
    itemsOf(scrollEl).forEach((item, i) => {
      const dist = Math.abs(i - centerIdx);
      const inCenter = dist <= 0.45;
      const t = Math.min(dist / 1.15, 1);
      let opacity = 1 - t * 0.55;
      if (inCenter) opacity = 1;
      item.style.opacity = String(Math.max(0.22, opacity));
      item.style.fontWeight = inCenter ? "700" : "500";
      item.classList.toggle("is-in-cell", inCenter);
    });
  });
}

function scrollToItem(scrollEl, item) {
  if (!item || !scrollEl) return;
  const idx = itemsOf(scrollEl).indexOf(item);
  if (idx < 0) return;
  scrollToIndex(scrollEl, idx);
}

function snapToNearest(scrollEl) {
  scrollToIndex(scrollEl, nearestIndex(scrollEl));
  paintInline(scrollEl);
}

function scheduleSnap(scrollEl, wrap) {
  window.clearTimeout(snapTimer);
  snapTimer = window.setTimeout(() => {
    if (!wrap.classList.contains("is-open")) return;
    snapToNearest(scrollEl);
  }, 120);
}

function syncWheelRingWidth(ring, scrollEl) {
  let max = 0;
  const itemH = itemHeight(scrollEl);
  const ringH = itemH * VISIBLE_ROWS;
  itemsOf(scrollEl).forEach((item) => {
    item.style.height = `${itemH}px`;
    item.style.minHeight = `${itemH}px`;
    item.style.boxSizing = "border-box";
    max = Math.max(max, item.scrollWidth);
  });
  const w = Math.max(72, Math.ceil(max + 28));
  ring.style.setProperty("--immo-drum-ring-w", `${w}px`);
  ring.style.setProperty("--immo-drum-ring-h", `${ringH}px`);
  ring.style.setProperty("--immo-drum-item-h", `${itemH}px`);
  ring.style.width = `${w}px`;
  ring.style.height = `${ringH}px`;
  scrollEl.style.paddingTop = `${itemH}px`;
  scrollEl.style.paddingBottom = `${itemH}px`;
  scrollEl.style.height = `${ringH}px`;
}

function setDrumFormState(open) {
  document.body.classList.toggle("immo-price-drum-active", open);
  document.body.classList.toggle("immo-drum-active", open);

  const page = document.body.getAttribute("data-site-page") || "";
  const useNativeDrumScroll = page === "auto" || page === "teherauto";

  if (useNativeDrumScroll) {
    document.body.classList.toggle("auto-drum-open", open);
    /* Autó hero isolation/overflow alatt a full-page touch lock eltöri a dobot —
       natív pan-y + helyi húzás kell, nem immo-scroll-blocker. */
    if (!open) unlockPageScroll(true);
    return;
  }

  if (open) lockPageScroll();
  else unlockPageScroll(true);
}

/**
 * Asztali egérhúzás + görgő. Touch: `onLockedTouchMove` görget (ne duplázzuk).
 */
function bindDrumPan(scrollEl, ring, wrap) {
  if (!scrollEl || !ring || ring.dataset.panBound === "1") return;
  ring.dataset.panBound = "1";

  let dragging = false;
  let moved = false;
  let lastY = 0;
  let startY = 0;
  let pointerId = null;

  ring.addEventListener("pointerdown", (event) => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    if (event.button != null && event.button !== 0) return;
    dragging = true;
    moved = false;
    lastY = event.clientY;
    startY = event.clientY;
    pointerId = event.pointerId;
    delete ring.dataset.drumDragged;
  });

  ring.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    const dy = event.clientY - lastY;
    lastY = event.clientY;
    if (Math.abs(event.clientY - startY) > 6) {
      moved = true;
      ring.dataset.drumDragged = "1";
      try {
        ring.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (!moved || !dy) return;
    event.preventDefault();
    scrollEl.scrollTop -= dy;
    paintInline(scrollEl);
  });

  const endDrag = (event) => {
    if (!dragging || (pointerId != null && event.pointerId !== pointerId)) return;
    dragging = false;
    pointerId = null;
    try {
      ring.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    if (moved) {
      ring.dataset.drumDragged = "1";
      scheduleSnap(scrollEl, wrap);
      window.setTimeout(() => {
        delete ring.dataset.drumDragged;
      }, 200);
    }
  };
  ring.addEventListener("pointerup", endDrag);
  ring.addEventListener("pointercancel", endDrag);

  /* Egérgörgő: a page-lock onLockedWheel intézi — itt ne duplázzuk. */
}

function refreshDrumItemStates(scrollEl, wheel) {
  const selected = new Set(readWheelList(wheel));
  scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
    const v = item.dataset.value ?? "";
    const on = v === "" ? selected.size === 0 : selected.has(v);
    item.classList.toggle("is-selected", on);
  });
}

function commitWrap(wrap, wheel) {
  const scrollEl = wrap.querySelector(".immo-drum-inline-scroll");
  const trigger = wrap.querySelector(".immo-wheel-trigger");
  const hidden = wrap.querySelector('input[type="hidden"]');
  if (!scrollEl || !trigger) return;
  if (wheel.dataset.multiple === "1") {
    syncDrumWheelDisplay(wheel);
    return;
  }
  const item = nearestItem(scrollEl);
  const value = item?.dataset.value ?? "";
  setWheelValue(wheel, value);
  syncDrumWheelDisplay(wheel);
  if (hidden) hidden.value = value;
  wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value } }));
}

function closeInlineDrum(wrap, wheel, commit = true) {
  if (!wrap?.classList.contains("is-open")) return;
  if (commit) commitWrap(wrap, wheel);
  wrap.classList.remove("is-open");
  wrap.querySelector(".immo-drum-inline")?.setAttribute("hidden", "");
  wrap.querySelector(".immo-wheel-trigger")?.setAttribute("aria-expanded", "false");
  drumHostCell(wrap)?.classList.remove("is-drum-active");
  setDrumOpen(wrap, false);
  const anyOpen = document.querySelector(".immo-wheel-wrap--drum-inline.is-open");
  setDrumFormState(Boolean(anyOpen));
}

function closeAllInlineDrums(commit = true) {
  document.querySelectorAll(".immo-wheel-wrap--drum-inline.is-open").forEach((wrap) => {
    const wheel = wrap.querySelector("[data-wheel]");
    if (wheel) closeInlineDrum(wrap, wheel, commit);
  });
}

function populateInlineScroll(scrollEl, wheel, wrap) {
  const opts = [...wheel.querySelectorAll(".immo-wheel-opt")];
  const withPhoto = opts.some((btn) => Boolean(btn.dataset.image));
  /* Sor magasság = cella magasság → a kijelölt érték pontosan a cellában van. */
  const cellH = Math.round(
    wrap?.querySelector(".immo-wheel-trigger")?.getBoundingClientRect().height || ITEM_H
  );
  scrollEl.dataset.itemH = String(withPhoto ? Math.max(48, cellH) : Math.max(ITEM_H, cellH));
  scrollEl.innerHTML = opts
    .map((btn) => {
      const v = btn.dataset.value ?? "";
      const esc = v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      const label = (btn.textContent || "").trim();
      const imgSrc = String(btn.dataset.image || "").trim();
      const img = imgSrc
        ? `<img class="immo-drum-inline-thumb" src="${imgSrc.replace(/"/g, "&quot;")}" alt="" width="32" height="32" decoding="async" />`
        : "";
      const cls = img ? "immo-drum-inline-item immo-drum-inline-item--photo" : "immo-drum-inline-item";
      return `<div class="${cls}" data-value="${esc}" role="option">${img}<span class="immo-drum-inline-text">${label
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</span></div>`;
    })
    .join("");
}

function findStartItem(scrollEl, wheel) {
  const values = readWheelList(wheel);
  const items = [...scrollEl.querySelectorAll(".immo-drum-inline-item")];
  if (wheel.dataset.multiple === "1" && values.length) {
    const last = values[values.length - 1];
    return items.find((el) => el.dataset.value === last) || items.find((el) => values.includes(el.dataset.value ?? ""));
  }
  const current = values[0] ?? "";
  return items.find((el) => el.dataset.value === current) || items[0] || null;
}

function openInlineDrum(wrap, wheel, trigger) {
  if (!isDrumViewport()) return;
  closeAllInlineDrums(true);

  const drum = ensureInlineDrum(wrap);
  const ring = drum.querySelector(".immo-drum-wheel-ring");
  const scrollEl = drum.querySelector(".immo-drum-inline-scroll");
  populateInlineScroll(scrollEl, wheel, wrap);

  const start = findStartItem(scrollEl, wheel);

  scrollEl.onscroll = () => {
    paintInline(scrollEl);
    if (ring.dataset.drumDragged === "1") return;
    scheduleSnap(scrollEl, wrap);
  };

  bindDrumPan(scrollEl, ring, wrap);

  const multiple = wheel.dataset.multiple === "1";

  function selectItem(item) {
    if (!item || ring.dataset.drumDragged === "1") return;
    const v = item.dataset.value ?? "";
    scrollToItem(scrollEl, item);
    paintInline(scrollEl);
    if (multiple) {
      if (v === "") {
        setWheelValue(wheel, "");
      } else {
        const cur = new Set(readWheelList(wheel));
        if (cur.has(v)) cur.delete(v);
        else cur.add(v);
        setWheelValue(wheel, [...cur]);
      }
      refreshDrumItemStates(scrollEl, wheel);
      syncDrumWheelDisplay(wheel);
      wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: readWheel(wheel) } }));
      closeInlineDrum(wrap, wheel, false);
      return;
    }
    setWheelValue(wheel, v);
    refreshDrumItemStates(scrollEl, wheel);
    syncDrumWheelDisplay(wheel);
    wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: readWheel(wheel) } }));
    closeInlineDrum(wrap, wheel, false);
  }

  scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectItem(item);
    });
  });
  refreshDrumItemStates(scrollEl, wheel);

  drum.hidden = false;
  wrap.classList.add("is-open");
  drumHostCell(wrap)?.classList.add("is-drum-active");
  setDrumOpen(wrap, true);
  trigger.setAttribute("aria-expanded", "true");
  setDrumFormState(true);

  const centerStart = () => {
    syncWheelRingWidth(ring, scrollEl);
    scrollToItem(scrollEl, start);
    paintInline(scrollEl);
  };
  requestAnimationFrame(() => {
    centerStart();
    requestAnimationFrame(centerStart);
  });
}

function ensureOutsideClose() {
  if (document.documentElement.dataset.immoDrumOutside) return;
  document.documentElement.dataset.immoDrumOutside = "1";
  document.addEventListener(
    "pointerdown",
    (event) => {
      const openWrap = event.target?.closest?.(".immo-wheel-wrap--drum-inline.is-open");
      /* Nyitott dobon belül (trigger / lista): ne zárjuk capture-ben — a saját handler intézi. */
      if (openWrap) return;
      if (!document.querySelector(".immo-wheel-wrap--drum-inline.is-open")) return;
      closeAllInlineDrums(true);
    },
    true
  );
}

export function initDrumWheel(wheel, { emptyLabel = "Mindegy", multiple = false, openMode = "inline" } = {}) {
  if (!wheel) return null;
  let wrap = wheel.closest(".immo-wheel-wrap");
  if (!wrap) return null;

  const key = String(wheel.getAttribute("data-wheel") || "");
  const SINGLE_RANGE_KEYS = new Set([
    "ar_tol",
    "ar_ig",
    "alapterulet_tol",
    "alapterulet_ig",
    "emelet_tol",
    "emelet_ig",
  ]);
  if (SINGLE_RANGE_KEYS.has(key)) multiple = false;

  if (wheel.dataset.drumBound === "1") {
    const clone = wheel.cloneNode(true);
    wheel.replaceWith(clone);
    wheel = clone;
    wrap = wheel.closest(".immo-wheel-wrap");
  }

  applyDrumModeClass();
  wrap.classList.remove("immo-wheel-wrap--menu", "immo-wheel-wrap--multi", "immo-wheel-wrap--custom", "is-open", "has-drum-open");
  wrap.querySelector(".immo-drum-inline")?.remove();
  wrap.querySelector(".immo-wheel-trigger")?.remove();
  wrap.querySelector(".immo-wheel-custom")?.remove();

  wheel.dataset.drumBound = "1";
  wheel.dataset.menuBound = "";
  wheel.dataset.menu = "1";
  wheel.dataset.multiple = multiple ? "1" : "0";
  wheel.dataset.drumOpenMode = openMode === "portal" ? "portal" : "inline";
  wheel.classList.remove("immo-wheel--menu");
  wheel.classList.add("immo-wheel--drum-source");
  wheel.setAttribute("hidden", "");
  wrap.classList.add("immo-wheel-wrap--drum-inline");
  if (multiple) wrap.classList.add("immo-wheel-wrap--multi");
  else wrap.classList.remove("immo-wheel-wrap--multi");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "immo-wheel-trigger";
  trigger.dataset.emptyLabel = emptyLabel;
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const labelEl = wrap.querySelector(".immo-label");
  if (labelEl?.nextSibling) wrap.insertBefore(trigger, labelEl.nextSibling);
  else wrap.insertBefore(trigger, wheel);

  /* portal: a bindAutoDrumSheet köti a kattintást (natív görgetés). */
  if (openMode !== "portal") {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!isDrumViewport()) return;
      if (wrap.classList.contains("is-open")) {
        closeInlineDrum(wrap, wheel, true);
        return;
      }
      openInlineDrum(wrap, wheel, trigger);
    });
    ensureOutsideClose();
  }

  syncDrumWheelDisplay(wheel);
  return wheel;
}

export function syncDrumWheelDisplay(wheel) {
  if (!wheel || wheel.dataset.drumBound !== "1") return;
  const wrap = wheel.closest(".immo-wheel-wrap");
  const trigger = wrap?.querySelector(".immo-wheel-trigger");
  if (!trigger) return;
  const emptyLabel = trigger.dataset.emptyLabel || "Mindegy";
  const multiple = wheel.dataset.multiple === "1";
  const values = readWheelList(wheel);
  wheel.querySelectorAll(".immo-wheel-opt").forEach((b) => {
    const v = b.dataset.value ?? "";
    const on = v === "" ? values.length === 0 : values.includes(v);
    b.classList.toggle("is-active", on);
  });
  const labels = values
    .map((v) => {
      const btn = [...wheel.querySelectorAll(".immo-wheel-opt")].find((b) => (b.dataset.value ?? "") === v);
      return btn?.textContent?.trim() || v;
    })
    .filter(Boolean);
  if (!labels.length) {
    trigger.textContent = emptyLabel;
    trigger.removeAttribute("title");
    return;
  }
  if (multiple && values.length > 1) {
    trigger.textContent = `${values.length} kiválasztva`;
    trigger.title = labels.join(", ");
    return;
  }
  const shown = labels.map((t) => formatTriggerShort(t, values[0])).join(", ");
  trigger.textContent = shown;
  trigger.title = labels.join(", ");
}

export { isDrumViewport, formatTriggerShort, closeAllInlineDrums };
