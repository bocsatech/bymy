/**
 * Inline drum picker — fix cella + kerék gyűrű (v2).
 * Visszaállítás: ?immoDrum=legacy vagy localStorage immo-drum-mode=legacy
 */

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

function isDrumViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 800px)").matches;
}

function formatTriggerShort(label, value) {
  if (!value) return label;
  const t = String(label || "").trim();
  if (!t) return label;
  return t.replace(/\s*Ft\s*$/i, "").replace(/\s*M\s*Ft\s*$/i, " M").trim() || t;
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

function nearestItem(scrollEl, wrap) {
  const wrapRect = wrap.getBoundingClientRect();
  const cellCenterY = wrapRect.top + wrapRect.height / 2;
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

function paintInline(scrollEl, wrap) {
  cancelAnimationFrame(paintFrame);
  paintFrame = requestAnimationFrame(() => {
    const wrapRect = wrap.getBoundingClientRect();
    const cellTop = wrapRect.top;
    const cellBottom = wrapRect.bottom;
    const cellCenterY = wrapRect.top + wrapRect.height / 2;
    scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
      const r = item.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const inCell = mid >= cellTop && mid <= cellBottom;
      const dist = Math.abs(mid - cellCenterY);
      const t = Math.min(dist / (ITEM_H * 1.15), 1);
      let opacity = 1 - t * 0.72;
      if (getDrumMode() === "v2" && inCell) opacity = Math.max(opacity, 0.92);
      item.style.opacity = String(Math.max(0.1, opacity));
      item.style.fontWeight = dist < ITEM_H * 0.42 ? "650" : "500";
      item.classList.toggle("is-in-cell", inCell);
    });
  });
}

function scrollToItem(scrollEl, wrap, item) {
  if (!item) return;
  const wrapRect = wrap.getBoundingClientRect();
  const cellCenterY = wrapRect.top + wrapRect.height / 2;
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
}

function commitWrap(wrap, wheel) {
  const scrollEl = wrap.querySelector(".immo-drum-inline-scroll");
  const trigger = wrap.querySelector(".immo-wheel-trigger");
  const hidden = wrap.querySelector('input[type="hidden"]');
  if (!scrollEl || !trigger) return;
  const item = nearestItem(scrollEl, wrap);
  const value = item?.dataset.value ?? "";
  wheel.querySelectorAll(".immo-wheel-opt").forEach((btn) => {
    btn.classList.toggle("is-active", (btn.dataset.value ?? "") === value);
  });
  if (hidden) hidden.value = value;
  if (!value) {
    trigger.textContent = trigger.dataset.emptyLabel || "Mindegy";
  } else {
    trigger.textContent = formatTriggerShort(item?.textContent?.trim(), value);
  }
  wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value } }));
}

function closeInlineDrum(wrap, wheel, commit = true) {
  if (!wrap?.classList.contains("is-open")) return;
  if (commit) commitWrap(wrap, wheel);
  wrap.classList.remove("is-open");
  wrap.querySelector(".immo-drum-inline")?.setAttribute("hidden", "");
  wrap.querySelector(".immo-wheel-trigger")?.setAttribute("aria-expanded", "false");
  wrap.closest(".immo-price-range__half")?.classList.remove("is-drum-active");
  wrap.closest(".immo-price-range")?.classList.remove("has-drum-open");
  setDrumFormState(false);
}

function closeAllInlineDrums(commit = true) {
  document.querySelectorAll(".immo-wheel-wrap--drum-inline.is-open").forEach((wrap) => {
    const wheel = wrap.querySelector("[data-wheel]");
    if (wheel) closeInlineDrum(wrap, wheel, commit);
  });
}

function populateInlineScroll(scrollEl, wheel) {
  scrollEl.innerHTML = [...wheel.querySelectorAll(".immo-wheel-opt")]
    .map((btn) => {
      const v = btn.dataset.value ?? "";
      const esc = v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      return `<div class="immo-drum-inline-item" data-value="${esc}">${btn.textContent}</div>`;
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

  const hidden = wrap.querySelector('input[type="hidden"]');
  const current = hidden?.value ?? "";
  let start = [...scrollEl.querySelectorAll(".immo-drum-inline-item")].find((el) => el.dataset.value === current);
  if (!start) start = scrollEl.querySelector(".immo-drum-inline-item");

  scrollEl.onscroll = () => paintInline(scrollEl, wrap);

  drum.hidden = false;
  wrap.classList.add("is-open");
  wrap.closest(".immo-price-range__half")?.classList.add("is-drum-active");
  wrap.closest(".immo-price-range")?.classList.add("has-drum-open");
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
      if (event.target.closest(".immo-wheel-wrap--drum-inline.is-open")) return;
      closeAllInlineDrums(true);
    },
    true
  );
}

export function initDrumWheel(wheel, { emptyLabel = "Mindegy" } = {}) {
  if (!wheel) return;
  const wrap = wheel.closest(".immo-wheel-wrap");
  if (!wrap) return;

  applyDrumModeClass();
  wrap.querySelector(".immo-drum-inline")?.remove();
  wrap.querySelector(".immo-wheel-trigger")?.remove();

  wheel.dataset.drumBound = "1";
  wheel.dataset.menu = "1";
  wheel.classList.add("immo-wheel--drum-source");
  wheel.setAttribute("hidden", "");
  wrap.classList.add("immo-wheel-wrap--drum-inline");

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
  const hidden = wrap.querySelector('input[type="hidden"]');
  const value = hidden?.value ?? "";
  wheel.querySelectorAll(".immo-wheel-opt").forEach((b) => {
    b.classList.toggle("is-active", (b.dataset.value ?? "") === value);
  });
  if (!value) {
    trigger.textContent = emptyLabel;
    return;
  }
  const btn = [...wheel.querySelectorAll(".immo-wheel-opt")].find((b) => (b.dataset.value ?? "") === value);
  trigger.textContent = btn ? formatTriggerShort(btn.textContent?.trim(), value) : value;
}

export { isDrumViewport, formatTriggerShort };
