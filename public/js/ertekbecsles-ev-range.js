/**
 * Értékbecslés: gyártási év + km óra állás tól–ig dobkerék, mint az autós keresőben.
 * A hirdetésfeladáson marad az év+hó / natív km mező.
 */
import { buildDualRangeBlock } from "./auto-search-drums.js?v=32b8f890f2";
import { readWheel } from "./ingatlan-wheels.js?v=6952ba469c";

function readFilter(form, key) {
  const wheel = form?.querySelector(`.immo-wheel[data-filter-key="${key}"]`);
  if (wheel) return String(readWheel(wheel) ?? "").trim();
  const input = form?.querySelector(`input[data-filter-key="${key}"]`);
  return String(input?.value ?? "").trim();
}

function hideHolder(holder) {
  if (!holder) return;
  holder.hidden = true;
  /* Az űrlap CSS-e gyakran `display: … !important`, ezért inline !important kell. */
  holder.style.setProperty("display", "none", "important");
}

function mountDual(form, { fieldKey, nativeIds, holderSelector, blockClass, datasetKey }) {
  if (!form) return null;
  const firstId = nativeIds[0];
  const anchor = form.querySelector(`#${firstId}`) || form.querySelector(`[data-range="${fieldKey}"]`);
  const field = anchor?.closest(".labeled-field, .ad-layout-item");
  if (!field) return null;

  for (const id of nativeIds) {
    (form.querySelector(`#${id}`) || document.getElementById(id))?.removeAttribute("required");
  }

  let holder = holderSelector ? field.querySelector(holderSelector) : null;
  if (!holder) {
    const native = form.querySelector(`#${firstId}`) || document.getElementById(firstId);
    holder = native?.closest(holderSelector || ".inline-2, .suffix-field") || null;
  }
  if (!holder) {
    holder = field.querySelector(`.${blockClass}__native`);
    if (!holder) {
      holder = document.createElement("div");
      holder.className = `${blockClass}__native`;
      const native = form.querySelector(`#${firstId}`);
      if (native) field.insertBefore(holder, native);
      else field.appendChild(holder);
    }
    for (const id of nativeIds) {
      const el = form.querySelector(`#${id}`) || document.getElementById(id);
      if (el && !holder.contains(el)) holder.appendChild(el);
    }
  }
  hideHolder(holder);

  field.querySelector(`.ad-form-split-ym[data-range="${fieldKey}"]`)?.remove();

  let block = field.querySelector(`.${blockClass}`);
  if (!block) {
    block = buildDualRangeBlock(fieldKey);
    if (!block) return null;
    block.classList.add(blockClass, "ertek-dual-range");
    block.querySelector(".immo-dual-range__title")?.remove();
    field.appendChild(block);
  }
  field.dataset[datasetKey] = "1";
  return block;
}

export function mountErtekEvRange(form) {
  return mountDual(form, {
    fieldKey: "gyartasi_ev",
    nativeIds: ["gyartasi_ev", "gyartasi_honap"],
    holderSelector: ".inline-2",
    blockClass: "ertek-ev-range",
    datasetKey: "ertekEvRange",
  });
}

export function mountErtekKmRange(form) {
  return mountDual(form, {
    fieldKey: "km",
    nativeIds: ["km"],
    holderSelector: ".suffix-field",
    blockClass: "ertek-km-range",
    datasetKey: "ertekKmRange",
  });
}

/** Mindkét kereső-szerű tartomány az értékbecslésen. */
export function mountErtekDualRanges(form) {
  mountErtekEvRange(form);
  mountErtekKmRange(form);
}

export function readEvRange(form) {
  return { ev_tol: readFilter(form, "ev_tol"), ev_ig: readFilter(form, "ev_ig") };
}

export function readKmRange(form) {
  return { km_tol: readFilter(form, "km_tol"), km_ig: readFilter(form, "km_ig") };
}
