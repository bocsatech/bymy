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

const SKIP_HOST = ".phone-lang-grid, .equipment-grid, .photo-list, .package-grid, .packages, #equipment-sections, #egyeb-info-sections";
const KEEP_OUT = "#footer-actions, #success-panel, #next-btn, #back-btn, #equipment-sections, #egyeb-info-sections";

function wrapFor(form, fieldKey) {
  const input =
    document.getElementById(fieldKey) || form.querySelector(`[name="${cssEscape(fieldKey)}"]`);
  if (!input) return null;
  if (input.closest(SKIP_HOST) || input.closest(KEEP_OUT)) return null;
  const existing = input.closest(".labeled-field, .field-stack, .md-outlined");
  if (existing) {
    if (existing.closest(KEEP_OUT) || existing.querySelector(KEEP_OUT)) return null;
    if (existing.matches("form, .step-panel, #ad-panel, .ad-layout-canvas, .card, .card-body")) return null;
    return existing;
  }
  const suffix = input.closest(".suffix-field");
  const control = suffix || input;
  const label = input.id ? form.querySelector(`label[for="${cssEscape(input.id)}"]`) : null;
  const wrap = document.createElement("div");
  wrap.className = "labeled-field md-outlined";
  const parent = control.parentElement;
  if (!parent) return null;
  parent.insertBefore(wrap, label && label.parentElement === parent ? label : control);
  if (label) wrap.append(label);
  wrap.append(control);
  return wrap;
}

function pinExtras(form) {
  const panel = form.querySelector('.step-panel[data-step="3"]');
  if (!panel) return;
  const body = panel.querySelector(".card > .card-body");
  for (const id of ["equipment-sections", "egyeb-info-sections"]) {
    const el = document.getElementById(id);
    if (!el || !body) continue;
    if (el.closest(".ad-layout-canvas, .ad-layout-hidden") || el.parentElement !== body) {
      if (id === "egyeb-info-sections") {
        const other = panel.querySelectorAll(".card > .card-body")[1];
        (other || body).appendChild(el);
      } else {
        body.appendChild(el);
      }
    }
    el.hidden = false;
    el.removeAttribute("hidden");
    el.style.removeProperty("display");
  }
}
function pinFooter(form) {
  const footer = document.getElementById("footer-actions");
  if (!footer) return;
  if (footer.closest(".ad-layout-canvas, .ad-layout-hidden") || footer.parentElement !== form) {
    form.appendChild(footer);
  }
  const success = document.getElementById("success-panel");
  if (success && !success.classList.contains("hidden")) return;
  footer.classList.remove("hidden");
  footer.hidden = false;
  footer.style.removeProperty("display");
}

function canvasHost(panel) {
  return panel.querySelector("#ad-panel") || panel.querySelector(".card > .card-body") || panel;
}

function canvasForStep(form, step) {
  const panel = form.querySelector(`.step-panel[data-step="${step}"]`);
  if (!panel) return null;
  const host = canvasHost(panel);
  let canvas = panel.querySelector(".ad-layout-canvas");
  if (!canvas) {
    canvas = document.createElement("div");
    canvas.className = "ad-layout-canvas ad-layout-on";
  }
  if (canvas.parentElement !== host) {
    host.insertBefore(canvas, host.firstChild);
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

function pruneEmptyCards(form) {
  form.querySelectorAll(".field-row").forEach((row) => {
    if (!row.querySelector("input, select, textarea, .labeled-field, .field-stack, .md-outlined")) {
      row.style.display = "none";
    }
  });
  form.querySelectorAll(".step-panel .card").forEach((card) => {
    if (card.id === "success-panel") return;
    if (card.querySelector(".packages, .phone-lang-grid, .photo-list, .ad-layout-canvas, #equipment-sections, #egyeb-info-sections")) return;
    if (card.querySelector(".labeled-field, .field-stack, .md-outlined, input:not([type=hidden]), select, textarea")) return;
    card.style.display = "none";
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
      if (wrap.closest(KEEP_OUT) || wrap.querySelector(KEEP_OUT)) continue;
      canvas.appendChild(wrap);
      placeWrap(wrap, cell);
    }
    pruneEmptyCards(form);
    pinExtras(form);
    pinFooter(form);
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
