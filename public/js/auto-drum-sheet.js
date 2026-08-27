/**
 * Dobkerék portál a body-n — natív overflow görgetés (autó + ingatlan).
 * Nincs page-scroll lock / preventDefault a touchmove-on.
 */

import { readWheel, readWheelList, setWheelValue } from "./ingatlan-wheels.js?v=immoClear1";
import { syncDrumWheelDisplay } from "./immo-drum-picker.js?v=immoClear1";

const ITEM_H = 60;
let activePortal = null;
let paintFrame = 0;

document.addEventListener("immo-wheel-clear", (event) => {
  if (activePortal?.wheel && event.target === activePortal.wheel) {
    closeAutoDrumSheet(false);
  }
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function closeAutoDrumSheet(commit = false) {
  if (!activePortal) return;
  const { root, wheel, scrollEl, ring, wrap, trigger } = activePortal;
  const multiple = wheel?.dataset?.multiple === "1";
  if (commit && scrollEl && ring && wheel && !multiple) {
    const item = nearestPortalItem(scrollEl, ring);
    const value = item?.dataset.value ?? "";
    setWheelValue(wheel, value);
    syncDrumWheelDisplay(wheel);
    wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value } }));
  } else if (commit && multiple && wheel) {
    syncDrumWheelDisplay(wheel);
  }
  wrap?.classList.remove("is-open", "has-drum-open");
  wrap?.closest(".immo-dual-range")?.classList.remove("has-drum-open");
  wrap?.closest(".immo-schema-cell")?.classList.remove("is-drum-active");
  wrap?.closest(".immo-dual-range__half")?.classList.remove("is-drum-active");
  trigger?.setAttribute("aria-expanded", "false");
  root.remove();
  activePortal = null;
  document.body.classList.remove("auto-drum-portal-open", "auto-drum-sheet-open");
}

function nearestPortalItem(scrollEl, ring) {
  const ringRect = ring.getBoundingClientRect();
  const centerY = ringRect.top + ringRect.height / 2;
  let best = null;
  let bestDist = Infinity;
  scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
    const r = item.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    const dist = Math.abs(mid - centerY);
    if (dist < bestDist) {
      bestDist = dist;
      best = item;
    }
  });
  return best;
}

function paintPortal(scrollEl, ring, wheel) {
  cancelAnimationFrame(paintFrame);
  paintFrame = requestAnimationFrame(() => {
    const ringRect = ring.getBoundingClientRect();
    const centerY = ringRect.top + ringRect.height / 2;
    const cellTop = ringRect.top + ringRect.height * 0.28;
    const cellBottom = ringRect.bottom - ringRect.height * 0.28;
    const selected = new Set(wheel ? readWheelList(wheel) : []);
    scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
      const r = item.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const inCell = mid >= cellTop && mid <= cellBottom;
      const dist = Math.abs(mid - centerY);
      const t = Math.min(dist / (ITEM_H * 1.15), 1);
      const v = item.dataset.value ?? "";
      const isSel = v === "" ? selected.size === 0 : selected.has(v);
      item.style.opacity = String(Math.max(0.15, 1 - t * 0.72));
      item.style.fontWeight = dist < ITEM_H * 0.42 || isSel ? "650" : "500";
      item.classList.toggle("is-in-cell", inCell);
      item.classList.toggle("is-selected", isSel);
      item.setAttribute("aria-selected", isSel ? "true" : "false");
    });
  });
}

function scrollToPortalItem(scrollEl, ring, item) {
  if (!item) return;
  const ringRect = ring.getBoundingClientRect();
  const centerY = ringRect.top + ringRect.height / 2;
  const itemRect = item.getBoundingClientRect();
  const itemMid = itemRect.top + itemRect.height / 2;
  scrollEl.scrollTop += itemMid - centerY;
}

function syncRingWidth(ring, scrollEl) {
  let max = 0;
  scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
    max = Math.max(max, item.scrollWidth);
  });
  const capped = Math.min(Math.max(11.25 * 16, Math.ceil(max + 42)), Math.min(300, Math.floor(window.innerWidth * 0.85)));
  ring.style.setProperty("--immo-drum-ring-w", `${capped}px`);
}

function bindPortalNativeScroll(scrollEl, ring, wheel) {
  let startY = 0;
  let moved = false;

  /* Natív overflow görgetés — nincs preventDefault. */
  scrollEl.addEventListener(
    "touchstart",
    (event) => {
      startY = event.touches?.[0]?.clientY ?? 0;
      moved = false;
    },
    { passive: true }
  );

  scrollEl.addEventListener(
    "touchmove",
    (event) => {
      const y = event.touches?.[0]?.clientY ?? startY;
      if (Math.abs(y - startY) > 4) moved = true;
    },
    { passive: true }
  );

  const snapEnd = () => {
    if (!moved) return;
    const snap = nearestPortalItem(scrollEl, ring);
    if (snap) scrollToPortalItem(scrollEl, ring, snap);
    paintPortal(scrollEl, ring, wheel);
    ring.dataset.drumDragged = "1";
    window.setTimeout(() => {
      delete ring.dataset.drumDragged;
    }, 80);
  };
  scrollEl.addEventListener("touchend", snapEnd);
  scrollEl.addEventListener("touchcancel", snapEnd);

  scrollEl.addEventListener(
    "wheel",
    () => {
      requestAnimationFrame(() => paintPortal(scrollEl, ring, wheel));
    },
    { passive: true }
  );
}

function positionPortal(stage, trigger) {
  const rect = trigger.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const pad = 12;
  const approxW = 210;
  const approxH = 240;
  let left = cx;
  let top = cy;
  left = Math.min(Math.max(left, pad + approxW / 2), window.innerWidth - pad - approxW / 2);
  top = Math.min(Math.max(top, pad + approxH / 2), window.innerHeight - pad - approxH / 2);
  stage.style.left = `${left}px`;
  stage.style.top = `${top}px`;
}

/** Dobkerék gyűrű a mező felett (body portál). */
export function openAutoDrumSheet(wheel, trigger) {
  if (!wheel || !trigger) return;
  closeAutoDrumSheet(false);

  const wrap = wheel.closest(".immo-wheel-wrap");
  const emptyLabel = trigger.dataset.emptyLabel || "Mindegy";
  const multiple = wheel.dataset.multiple === "1";
  const current = String(readWheel(wheel) ?? "");
  const selected = readWheelList(wheel);
  const opts = [...wheel.querySelectorAll(".immo-wheel-opt")];

  const root = document.createElement("div");
  root.className = "auto-drum-portal";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", emptyLabel);

  root.innerHTML = `
    <button type="button" class="auto-drum-portal__backdrop" aria-label="Bezárás"></button>
    <div class="auto-drum-portal__stage">
      <div class="immo-drum-wheel-ring auto-drum-portal__ring">
        <div class="immo-drum-inline-highlight" aria-hidden="true"></div>
        <div class="auto-drum-portal__scroll immo-drum-inline-scroll" tabindex="-1"></div>
      </div>
      <button type="button" class="auto-drum-portal__done">Kész</button>
    </div>`;

  const stage = root.querySelector(".auto-drum-portal__stage");
  const ring = root.querySelector(".auto-drum-portal__ring");
  const scrollEl = root.querySelector(".auto-drum-portal__scroll");

  scrollEl.innerHTML = opts
    .map((btn) => {
      const value = btn.dataset.value ?? "";
      const label = (btn.textContent || "").trim() || emptyLabel;
      return `<div class="immo-drum-inline-item" data-value="${escapeHtml(value)}"><span class="immo-drum-inline-text">${escapeHtml(label)}</span></div>`;
    })
    .join("");

  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => closeAutoDrumSheet(true));
  root.querySelector(".auto-drum-portal__done")?.addEventListener("click", () => closeAutoDrumSheet(true));

  scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      if (ring.dataset.drumDragged === "1") return;
      const value = item.dataset.value ?? "";
      if (multiple) {
        if (value === "") {
          setWheelValue(wheel, "");
        } else {
          const cur = new Set(readWheelList(wheel));
          if (cur.has(value)) cur.delete(value);
          else cur.add(value);
          setWheelValue(wheel, [...cur]);
        }
        syncDrumWheelDisplay(wheel);
        wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: readWheel(wheel) } }));
        closeAutoDrumSheet(false);
        return;
      }
      setWheelValue(wheel, value);
      syncDrumWheelDisplay(wheel);
      wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value } }));
      closeAutoDrumSheet(false);
    });
  });

  scrollEl.addEventListener("scroll", () => paintPortal(scrollEl, ring, wheel), { passive: true });
  bindPortalNativeScroll(scrollEl, ring, wheel);

  document.body.appendChild(root);
  document.body.classList.add("auto-drum-portal-open");
  wrap?.classList.add("is-open", "has-drum-open");
  wrap?.closest(".immo-dual-range")?.classList.add("has-drum-open");
  (wrap?.closest(".immo-dual-range__half") || wrap?.closest(".immo-schema-cell"))?.classList.add("is-drum-active");
  trigger.setAttribute("aria-expanded", "true");

  positionPortal(stage, trigger);
  activePortal = { root, wheel, scrollEl, ring, wrap, trigger };

  const start =
    (multiple && selected.length
      ? [...scrollEl.querySelectorAll(".immo-drum-inline-item")].find((el) => selected.includes(el.dataset.value ?? ""))
      : null) ||
    [...scrollEl.querySelectorAll(".immo-drum-inline-item")].find((el) => (el.dataset.value ?? "") === current) ||
    scrollEl.querySelector(".immo-drum-inline-item");

  requestAnimationFrame(() => {
    syncRingWidth(ring, scrollEl);
    scrollToPortalItem(scrollEl, ring, start);
    paintPortal(scrollEl, ring, wheel);
  });
}

/** Trigger → portált dobkerék (felülírja az inline nyitást). */
export function bindAutoDrumSheet(wheel) {
  if (!wheel) return;
  const name = wheel.getAttribute?.("data-wheel") || "";
  const form = wheel.closest?.("form") || document.getElementById("immo-search-form");
  const live =
    (name && form?.querySelector(`[data-wheel="${name}"]`)) ||
    (wheel.isConnected ? wheel : null) ||
    wheel;
  const wrap = live?.closest?.(".immo-wheel-wrap");
  const trigger = wrap?.querySelector(".immo-wheel-trigger");
  if (!trigger) return;

  /* Újrainításkor a trigger cserélődik — mindig kössük újra. */
  const next = trigger.cloneNode(true);
  next.dataset.sheetBound = "1";
  trigger.replaceWith(next);

  next.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (activePortal) {
      closeAutoDrumSheet(true);
      return;
    }
    const host = next.closest("form") || document;
    const current =
      (name && host.querySelector?.(`[data-wheel="${name}"]`)) ||
      next.closest(".immo-wheel-wrap")?.querySelector("[data-wheel]");
    if (current) openAutoDrumSheet(current, next);
  });
}
