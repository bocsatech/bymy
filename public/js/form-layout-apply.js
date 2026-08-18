/** Mentett 12 oszlopos elrendezés a hirdetésfeladáson. */
function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const SKIP_HOST = ".phone-lang-grid, .equipment-grid, .photo-list, .package-grid";

function wrapFor(form, fieldKey) {
  const input =
    document.getElementById(fieldKey) || form.querySelector(`[name="${cssEscape(fieldKey)}"]`);
  if (!input) return null;
  if (input.closest(SKIP_HOST)) return null;
  return input.closest(".labeled-field, .field-stack, .md-outlined");
}

function hostFor(wrap) {
  const locked = wrap.closest(".ev-tech-grid, .muszaki-grid, .owner-flags, .phone-lang-grid, .equipment-grid");
  if (locked) return locked;
  return wrap.closest(".form-grid, .card-body, .ad-layout-canvas");
}

function canvasForStep(form, step) {
  const panel = form.querySelector(`.step-panel[data-step="${step}"]`);
  if (!panel) return null;
  let canvas = panel.querySelector(".ad-layout-canvas");
  if (!canvas) {
    canvas = document.createElement("div");
    canvas.className = "ad-layout-canvas ad-layout-on";
    const body = panel.querySelector(".card-body") || panel;
    body.insertBefore(canvas, body.firstChild);
  }
  return canvas;
}

function setRequired(wrap, on) {
  wrap.querySelectorAll("input, select, textarea").forEach((el) => {
    if (on) {
      if (el.dataset.layoutRequired === "1") el.setAttribute("required", "");
      return;
    }
    if (el.hasAttribute("required")) {
      el.dataset.layoutRequired = "1";
      el.removeAttribute("required");
    }
  });
}

function placeWrap(wrap, cell) {
  const col = clamp(cell.col, 1, 12);
  const span = clamp(cell.colSpan || 6, 1, 13 - col);
  const row = clamp(cell.row || 1, 1, 80);
  wrap.classList.add("ad-layout-item");
  wrap.style.setProperty("grid-column", `${col} / span ${span}`, "important");
  wrap.style.setProperty("grid-row", String(row), "important");
  wrap.style.setProperty("width", "100%", "important");
  wrap.style.setProperty("max-width", "none", "important");
  wrap.querySelectorAll(".inline-2, .suffix-field").forEach((el) => {
    el.style.setProperty("width", "100%", "important");
    el.style.setProperty("max-width", "none", "important");
  });
  wrap.querySelectorAll("select, input:not([type=checkbox]):not([type=hidden]):not([type=file])").forEach((el) => {
    el.style.setProperty("width", "100%", "important");
    el.style.setProperty("max-width", "none", "important");
    el.style.setProperty("field-sizing", "fixed", "important");
    el.style.setProperty("flex", "1 1 0%", "important");
  });
}

async function applyAdFormLayout() {
  const form = document.getElementById("ad-form");
  if (!form) return;
  try {
    const res = await fetch("/api/level1/form-layout", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const layout = data.layout;
    if (!layout?.live && Number(layout?.version) < 2) return;
    const cells = layout?.cells;
    if (!Array.isArray(cells) || !cells.length) return;
    for (const cell of cells) {
      const wrap = wrapFor(form, cell.field_key);
      if (!wrap) continue;
      if (cell.hidden) {
        wrap.classList.add("ad-layout-hidden");
        wrap.hidden = true;
        setRequired(wrap, false);
        continue;
      }
      wrap.classList.remove("ad-layout-hidden");
      wrap.hidden = false;
      setRequired(wrap, true);
      const panel = wrap.closest(".step-panel");
      const currentStep = Number(panel?.dataset.step);
      const targetStep = clamp(cell.step || currentStep || 1, 1, 5);
      if (targetStep !== currentStep) {
        const canvas = canvasForStep(form, targetStep);
        if (canvas) canvas.appendChild(wrap);
        placeWrap(wrap, cell);
        continue;
      }
      const host = hostFor(wrap);
      if (!host) continue;
      host.classList.add("ad-layout-on");
      const parent = wrap.parentElement;
      if (parent && parent !== host && parent.classList.contains("field-row")) {
        host.appendChild(wrap);
      }
      placeWrap(wrap, cell);
    }
    form.querySelectorAll(".field-row").forEach((row) => {
      if (!row.querySelector(".labeled-field, .field-stack, .md-outlined")) {
        row.style.display = "none";
      }
    });
  } catch {
    /* alapelrendezés marad */
  }
}

function scheduleApply() {
  applyAdFormLayout();
  window.setTimeout(applyAdFormLayout, 120);
  window.setTimeout(applyAdFormLayout, 450);
  window.setTimeout(applyAdFormLayout, 900);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleApply);
} else {
  scheduleApply();
}
window.addEventListener("ad-form-ready", applyAdFormLayout);
