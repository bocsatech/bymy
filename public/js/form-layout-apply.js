/** Adminban mentett cellaszélesség — a selectek field-sizing: content-jét felülírja. */
function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}

function sizedControls(wrap) {
  return [
    ...wrap.querySelectorAll(":scope > .inline-2, :scope > .suffix-field"),
    ...[...wrap.children].filter((el) =>
      el.matches("select, textarea, input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file])")
    ),
  ];
}

function clearLayoutSize(wrap) {
  wrap.classList.remove("layout-sized");
  wrap.style.removeProperty("width");
  wrap.style.removeProperty("max-width");
  wrap.style.removeProperty("--layout-control-max");
  wrap.querySelectorAll("[data-layout-sized]").forEach((el) => {
    el.style.removeProperty("width");
    el.style.removeProperty("max-width");
    el.style.removeProperty("flex");
    el.style.removeProperty("min-width");
    el.style.removeProperty("field-sizing");
    el.removeAttribute("data-layout-sized");
  });
}

function applyCellWidth(wrap, rem) {
  wrap.classList.add("layout-sized");
  wrap.style.setProperty("--layout-control-max", `${rem}rem`);
  wrap.style.setProperty("width", `${rem}rem`, "important");
  wrap.style.setProperty("max-width", "100%", "important");
  for (const el of sizedControls(wrap)) {
    el.setAttribute("data-layout-sized", "1");
    el.style.setProperty("width", `${rem}rem`, "important");
    el.style.setProperty("max-width", "100%", "important");
    el.querySelectorAll("select, input").forEach((inner) => {
      inner.setAttribute("data-layout-sized", "1");
      inner.style.setProperty("width", "100%", "important");
      inner.style.setProperty("max-width", "none", "important");
      inner.style.setProperty("flex", "1 1 0%", "important");
      inner.style.setProperty("min-width", "0", "important");
      inner.style.setProperty("field-sizing", "fixed", "important");
    });
  }
}

async function applyAdFormLayout() {
  const form = document.getElementById("ad-form");
  if (!form) return;
  try {
    const res = await fetch("/api/level1/form-layout", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const cells = data.layout?.cells;
    if (!Array.isArray(cells)) return;
    for (const cell of cells) {
      const input =
        document.getElementById(cell.field_key) ||
        form.querySelector(`[name="${cssEscape(cell.field_key)}"]`);
      const wrap = input?.closest(".labeled-field, .field-stack, .md-outlined");
      if (!wrap) continue;
      if (Number(cell.colSpan) === 2) wrap.style.gridColumn = "1 / -1";
      else wrap.style.removeProperty("grid-column");
      if (Number.isFinite(Number(cell.order))) wrap.style.order = String(cell.order);
      const rem = Number(cell.maxWidthRem);
      if (!Number.isFinite(rem) || rem <= 0) {
        clearLayoutSize(wrap);
        continue;
      }
      applyCellWidth(wrap, rem);
    }
  } catch {
    /* az űrlap a kódbeli alapelrendezéssel marad */
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
