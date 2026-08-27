/**
 * Autó mobil kereső — dobkerék portál a body-n.
 * Ugyanaz a gyűrűs kinézet, mint az ingatlan dob; a hero stacking contexten kívül.
 */

import { readWheel, setWheelValue } from "./ingatlan-wheels.js?v=drumScroll7";
import { syncDrumWheelDisplay } from "./immo-drum-picker.js?v=drumScrollFix1";

const ITEM_H = 40;
let activePortal = null;
let paintFrame = 0;

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
  if (commit && scrollEl && ring && wheel) {
    const item = nearestPortalItem(scrollEl, ring);
    const value = item?.dataset.value ?? "";
    setWheelValue(wheel, value);
    syncDrumWheelDisplay(wheel);
    wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value } }));
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

function paintPortal(scrollEl, ring) {
  cancelAnimationFrame(paintFrame);
  paintFrame = requestAnimationFrame(() => {
    const ringRect = ring.getBoundingClientRect();
    const centerY = ringRect.top + ringRect.height / 2;
    const cellTop = ringRect.top + ringRect.height * 0.28;
    const cellBottom = ringRect.bottom - ringRect.height * 0.28;
    scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
      const r = item.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const inCell = mid >= cellTop && mid <= cellBottom;
      const dist = Math.abs(mid - centerY);
      const t = Math.min(dist / (ITEM_H * 1.15), 1);
      item.style.opacity = String(Math.max(0.15, 1 - t * 0.72));
      item.style.fontWeight = dist < ITEM_H * 0.42 ? "650" : "500";
      item.classList.toggle("is-in-cell", inCell);
      item.classList.toggle("is-selected", inCell);
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
  const capped = Math.min(Math.max(7.5 * 16, Math.ceil(max + 28)), Math.min(200, Math.floor(window.innerWidth * 0.7)));
  ring.style.setProperty("--immo-drum-ring-w", `${capped}px`);
}

function bindPortalNativeScroll(scrollEl, ring) {
  let startY = 0;
  let moved = false;

  /* Natív overflow görgetés (ugyanaz, ami a sheetnél ment) — nincs preventDefault. */
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
    paintPortal(scrollEl, ring);
    ring.dataset.drumDragged = "1";
    window.setTimeout(() => {
      delete ring.dataset.drumDragged;
    }, 80);
  };
  scrollEl.addEventListener("touchend", snapEnd);
  scrollEl.addEventListener("touchcancel", snapEnd);

  scrollEl.addEventListener(
    "wheel",
    (event) => {
      /* hagyjuk a natív wheel scrollt; csak festünk */
      requestAnimationFrame(() => paintPortal(scrollEl, ring));
    },
    { passive: true }
  );
}

function positionPortal(stage, trigger) {
  const rect = trigger.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const pad = 12;
  const approxW = 140;
  const approxH = 160;
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
  const current = String(readWheel(wheel) ?? "");
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
      setWheelValue(wheel, value);
      syncDrumWheelDisplay(wheel);
      wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value } }));
      closeAutoDrumSheet(false);
    });
  });

  scrollEl.addEventListener("scroll", () => paintPortal(scrollEl, ring), { passive: true });
  bindPortalNativeScroll(scrollEl, ring);

  document.body.appendChild(root);
  document.body.classList.add("auto-drum-portal-open");
  wrap?.classList.add("is-open", "has-drum-open");
  wrap?.closest(".immo-dual-range")?.classList.add("has-drum-open");
  (wrap?.closest(".immo-dual-range__half") || wrap?.closest(".immo-schema-cell"))?.classList.add("is-drum-active");
  trigger.setAttribute("aria-expanded", "true");

  positionPortal(stage, trigger);
  activePortal = { root, wheel, scrollEl, ring, wrap, trigger };

  const start =
    [...scrollEl.querySelectorAll(".immo-drum-inline-item")].find((el) => (el.dataset.value ?? "") === current) ||
    scrollEl.querySelector(".immo-drum-inline-item");

  requestAnimationFrame(() => {
    syncRingWidth(ring, scrollEl);
    scrollToPortalItem(scrollEl, ring, start);
    paintPortal(scrollEl, ring);
  });
}

/** Trigger → portált dobkerék. */
export function bindAutoDrumSheet(wheel) {
  const wrap = wheel?.closest?.(".immo-wheel-wrap");
  const trigger = wrap?.querySelector(".immo-wheel-trigger");
  if (!trigger || trigger.dataset.sheetBound === "1") return;

  const wheelName = wheel.getAttribute("data-wheel") || "";
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
    const form = next.closest("form");
    const live =
      (wheelName && form?.querySelector(`[data-wheel="${wheelName}"]`)) ||
      next.closest(".immo-wheel-wrap")?.querySelector("[data-wheel]");
    if (live) openAutoDrumSheet(live, next);
  });
}
