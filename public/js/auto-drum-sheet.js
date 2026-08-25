/**
 * Autó mobil kereső — alsó lap (sheet) a dobkerék helyett.
 * Natív overflow görgetés, kilép a hero stacking contextből.
 */

import { readWheel, setWheelValue } from "./ingatlan-wheels.js?v=drumScroll3";
import { syncDrumWheelDisplay } from "./immo-drum-picker.js?v=drumScroll3";

let activeSheet = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function closeAutoDrumSheet() {
  if (!activeSheet) return;
  activeSheet.remove();
  activeSheet = null;
  document.body.classList.remove("auto-drum-sheet-open");
}

export function openAutoDrumSheet(wheel, trigger) {
  if (!wheel || !trigger) return;
  closeAutoDrumSheet();

  const wrap = wheel.closest(".immo-wheel-wrap");
  const fieldLabel =
    wrap?.closest(".immo-dual-range")?.querySelector(".immo-dual-range__title")?.textContent?.trim() ||
    wrap?.querySelector(".immo-label")?.textContent?.trim() ||
    trigger.dataset.emptyLabel ||
    "Válassz";
  const emptyLabel = trigger.dataset.emptyLabel || "Mindegy";
  const current = String(readWheel(wheel) ?? "");
  const opts = [...wheel.querySelectorAll(".immo-wheel-opt")];

  const root = document.createElement("div");
  root.className = "auto-drum-sheet";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", fieldLabel);

  const listHtml = opts
    .map((btn) => {
      const value = btn.dataset.value ?? "";
      const label = (btn.textContent || "").trim() || emptyLabel;
      const selected = value === current || (value === "" && current === "");
      return `<button type="button" class="auto-drum-sheet__opt${selected ? " is-selected" : ""}" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
    })
    .join("");

  root.innerHTML = `
    <button type="button" class="auto-drum-sheet__backdrop" aria-label="Bezárás"></button>
    <div class="auto-drum-sheet__panel">
      <div class="auto-drum-sheet__head">
        <span class="auto-drum-sheet__title">${escapeHtml(fieldLabel)}</span>
        <button type="button" class="auto-drum-sheet__close" aria-label="Bezárás">Kész</button>
      </div>
      <div class="auto-drum-sheet__list">${listHtml}</div>
    </div>`;

  const list = root.querySelector(".auto-drum-sheet__list");
  root.querySelector(".auto-drum-sheet__backdrop")?.addEventListener("click", () => closeAutoDrumSheet());
  root.querySelector(".auto-drum-sheet__close")?.addEventListener("click", () => closeAutoDrumSheet());

  list?.querySelectorAll(".auto-drum-sheet__opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.getAttribute("data-value") ?? "";
      setWheelValue(wheel, value);
      syncDrumWheelDisplay(wheel);
      wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value } }));
      closeAutoDrumSheet();
    });
  });

  document.body.appendChild(root);
  document.body.classList.add("auto-drum-sheet-open");
  activeSheet = root;

  const selected = list?.querySelector(".auto-drum-sheet__opt.is-selected");
  if (selected) {
    requestAnimationFrame(() => {
      selected.scrollIntoView({ block: "center", behavior: "auto" });
    });
  }
}

/** Inline dobkerék helyett sheet — a trigger click listener cseréje. */
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
    const form = next.closest("form");
    const live =
      (wheelName && form?.querySelector(`[data-wheel="${wheelName}"]`)) ||
      next.closest(".immo-wheel-wrap")?.querySelector("[data-wheel]");
    if (live) openAutoDrumSheet(live, next);
  });
}
