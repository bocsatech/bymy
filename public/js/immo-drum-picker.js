/**
 * Inline drum picker — fix cella + kerék gyűrű (v2).
 * Visszaállítás: ?immoDrum=legacy vagy localStorage immo-drum-mode=legacy
 */

import { readWheel, readWheelList, setWheelValue, lockPageScroll, unlockPageScroll } from "./ingatlan-wheels.js?v=drumScroll7";

const ITEM_H = 40;
let paintFrame = 0;

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

function nearestItem(scrollEl, wrap) {
  const anchor = cellAnchor(wrap);
  const anchorRect = anchor.getBoundingClientRect();
  const cellCenterY = anchorRect.top + anchorRect.height / 2;
  let best = null;
  let bestDist = Infinity;
  scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
    const r = item.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    const dist = Math.abs(mid - cellCenterY);
    if (dist < bestDist) {
      bestDist = dist;
      best = item;
    }
  });
  return best;
}

function itemHeight(scrollEl) {
  const n = Number(scrollEl?.dataset?.itemH);
  return Number.isFinite(n) && n > 0 ? n : ITEM_H;
}

function paintInline(scrollEl, wrap) {
  cancelAnimationFrame(paintFrame);
  paintFrame = requestAnimationFrame(() => {
    const anchor = cellAnchor(wrap);
    const anchorRect = anchor.getBoundingClientRect();
    const cellTop = anchorRect.top;
    const cellBottom = anchorRect.bottom;
    const cellCenterY = anchorRect.top + anchorRect.height / 2;
    const itemH = itemHeight(scrollEl);
    scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
      const r = item.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const inCell = mid >= cellTop && mid <= cellBottom;
      const dist = Math.abs(mid - cellCenterY);
      const t = Math.min(dist / (itemH * 1.15), 1);
      let opacity = 1 - t * 0.72;
      if (getDrumMode() === "v2" && inCell) opacity = Math.max(opacity, 0.92);
      item.style.opacity = String(Math.max(0.1, opacity));
      item.style.fontWeight = dist < itemH * 0.42 ? "650" : "500";
      item.classList.toggle("is-in-cell", inCell);
    });
  });
}

function scrollToItem(scrollEl, wrap, item) {
  if (!item) return;
  const anchor = cellAnchor(wrap);
  const anchorRect = anchor.getBoundingClientRect();
  const cellCenterY = anchorRect.top + anchorRect.height / 2;
  const itemRect = item.getBoundingClientRect();
  const itemMid = itemRect.top + itemRect.height / 2;
  scrollEl.scrollTop += itemMid - cellCenterY;
}

function syncWheelRingWidth(ring, scrollEl) {
  let max = 0;
  scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
    max = Math.max(max, item.scrollWidth);
  });
  const w = Math.ceil(max + 28);
  ring.style.setProperty("--immo-drum-ring-w", `${w}px`);
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

function bindDrumTouchPan(scrollEl, ring) {
  if (!scrollEl || !ring || ring.dataset.panBound === "1") return;
  ring.dataset.panBound = "1";

  let lastY = 0;
  let active = false;
  let moved = false;

  ring.addEventListener(
    "touchstart",
    (event) => {
      if (!event.touches?.[0]) return;
      lastY = event.touches[0].clientY;
      active = true;
      moved = false;
    },
    { passive: true }
  );

  ring.addEventListener(
    "touchmove",
    (event) => {
      if (!active || !event.touches?.[0]) return;
      const y = event.touches[0].clientY;
      const dy = y - lastY;
      lastY = y;
      if (!dy) return;
      if (Math.abs(dy) > 1.5) moved = true;
      event.preventDefault();
      scrollEl.scrollTop -= dy;
      ring.dataset.drumDragged = moved ? "1" : "";
    },
    { passive: false }
  );

  const end = () => {
    active = false;
    if (moved) {
      ring.dataset.drumDragged = "1";
      window.setTimeout(() => {
        delete ring.dataset.drumDragged;
      }, 80);
    }
  };
  ring.addEventListener("touchend", end);
  ring.addEventListener("touchcancel", end);
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
  const item = nearestItem(scrollEl, wrap);
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

function populateInlineScroll(scrollEl, wheel) {
  const opts = [...wheel.querySelectorAll(".immo-wheel-opt")];
  const withPhoto = opts.some((btn) => Boolean(btn.dataset.image));
  scrollEl.dataset.itemH = withPhoto ? "48" : String(ITEM_H);
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
      return `<div class="${cls}" data-value="${esc}">${img}<span class="immo-drum-inline-text">${label
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</span></div>`;
    })
    .join("");
}

function openInlineDrum(wrap, wheel, trigger) {
  if (!isDrumViewport()) return;
  closeAllInlineDrums(true);

  const drum = ensureInlineDrum(wrap);
  const ring = drum.querySelector(".immo-drum-wheel-ring");
  const scrollEl = drum.querySelector(".immo-drum-inline-scroll");
  populateInlineScroll(scrollEl, wheel);

  const values = readWheelList(wheel);
  let start = null;
  if (wheel.dataset.multiple === "1" && values.length) {
    start = [...scrollEl.querySelectorAll(".immo-drum-inline-item")].find((el) => el.dataset.value === values[0]);
  } else {
    const current = values[0] ?? "";
    start = [...scrollEl.querySelectorAll(".immo-drum-inline-item")].find((el) => el.dataset.value === current);
  }
  if (!start) start = scrollEl.querySelector(".immo-drum-inline-item");

  scrollEl.onscroll = () => paintInline(scrollEl, wrap);

  bindDrumTouchPan(scrollEl, ring);

  const multiple = wheel.dataset.multiple === "1";
  scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
    item.onclick = (event) => {
      event.stopPropagation();
      if (ring.dataset.drumDragged === "1") return;
      const v = item.dataset.value ?? "";
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
    };
  });
  refreshDrumItemStates(scrollEl, wheel);

  drum.hidden = false;
  wrap.classList.add("is-open");
  drumHostCell(wrap)?.classList.add("is-drum-active");
  setDrumOpen(wrap, true);
  trigger.setAttribute("aria-expanded", "true");
  setDrumFormState(true);

  requestAnimationFrame(() => {
    syncWheelRingWidth(ring, scrollEl);
    scrollToItem(scrollEl, wrap, start);
    paintInline(scrollEl, wrap);
  });
}

function ensureOutsideClose() {
  if (document.documentElement.dataset.immoDrumOutside) return;
  document.documentElement.dataset.immoDrumOutside = "1";
  document.addEventListener(
    "click",
    (event) => {
      const openWraps = document.querySelectorAll(".immo-wheel-wrap--drum-inline.is-open");
      if (!openWraps.length) return;
      // Többválasztásnál: csak a kerék gyűrűn belül marad nyitva; mellette / máshol bezár.
      if (event.target.closest(".immo-drum-wheel-ring")) return;
      closeAllInlineDrums(true);
    },
    true
  );
}

export function initDrumWheel(wheel, { emptyLabel = "Mindegy", multiple = false } = {}) {
  if (!wheel) return;
  let wrap = wheel.closest(".immo-wheel-wrap");
  if (!wrap) return;

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
  syncDrumWheelDisplay(wheel);
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
