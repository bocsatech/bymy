/** Adminban mentett cellaszélesség / oszlop — a rács celláját nem zsugorítja. */
async function applyAdFormLayout() {
  const form = document.getElementById("ad-form");
  if (!form) return;
  try {
    const res = await fetch("/api/level1/form-layout", { credentials: "same-origin" });
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
      if (Number.isFinite(Number(cell.order))) wrap.style.order = String(cell.order);
      const rem = Number(cell.maxWidthRem);
      if (!Number.isFinite(rem)) continue;
      wrap.querySelectorAll(":scope > .inline-2, :scope > .suffix-field, :scope > select, :scope > input").forEach((el) => {
        el.style.width = `min(100%, ${rem}rem)`;
        el.style.maxWidth = `${rem}rem`;
      });
    }
  } catch {
    /* az űrlap a kódbeli alapelrendezéssel marad */
  }
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyAdFormLayout);
} else {
  applyAdFormLayout();
}
