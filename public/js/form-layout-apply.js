/** Mentett 12 oszlopos elrendezés — minden mező ugyanazon a lépésrácson. */
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
  return input.closest(".labeled-field, .field-stack");
}

function canvasForStep(form, step) {
  const panel = form.querySelector(`.step-panel[data-step="${step}"]`);
  if (!panel) return null;
  let canvas = panel.querySelector(":scope .ad-layout-canvas");
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
  wrap.hidden = false;
  wrap.removeAttribute("hidden");
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
    const placed = new Set();
    for (const cell of cells) {
      const wrap = wrapFor(form, cell.field_key);
      if (!wrap || placed.has(wrap)) continue;
      placed.add(wrap);
      if (cell.hidden) {
        wrap.classList.add("ad-layout-hidden");
        wrap.hidden = true;
        setRequired(wrap, false);
        continue;
      }
      wrap.classList.remove("ad-layout-hidden");
      setRequired(wrap, true);
      const targetStep = clamp(cell.step || 1, 1, 5);
      const canvas = canvasForStep(form, targetStep);
      if (!canvas) continue;
      canvas.appendChild(wrap);
      placeWrap(wrap, cell);
    }
    form.querySelectorAll(".field-row, .form-grid, .ev-tech-grid, .muszaki-grid").forEach((row) => {
      if (row.classList.contains("ad-layout-canvas")) return;
      if (!row.querySelector(".labeled-field, .field-stack")) {
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
