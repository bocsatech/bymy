/**
 * Értékbecslés: a „Gyártási év” az autós keresőével azonos tól–ig dobkerék.
 * A hirdetésfeladáson marad az év + hónap választó, ezért csak itt cseréljük.
 */
import { buildDualRangeBlock } from "./auto-search-drums.js?v=32b8f890f2";
import { readWheel } from "./ingatlan-wheels.js?v=6952ba469c";

const YM_SELECTOR = '.ad-form-split-ym[data-range="gyartasi_ev"]';

export function mountErtekEvRange(form) {
  if (!form) return null;
  const ym = form.querySelector(YM_SELECTOR);
  const field = ym?.closest(".labeled-field, .ad-layout-item");
  if (!ym || !field) return null;
  if (field.dataset.ertekEvRange === "1") return field.querySelector(".ertek-ev-range");

  const block = buildDualRangeBlock("gyartasi_ev");
  if (!block) return null;
  block.classList.add("ertek-ev-range");
  /* A mezőnek már van „Gyártási év:” címkéje, a tartomány saját címsora felesleges. */
  block.querySelector(".immo-dual-range__title")?.remove();

  /* A natív select és a hónap a DOM-ban marad (űrlap-mentés, layout), csak nem látszik. */
  ym.hidden = true;
  ym.setAttribute("hidden", "");
  form.querySelector("#gyartasi_ev")?.removeAttribute("required");

  field.appendChild(block);
  field.dataset.ertekEvRange = "1";
  return block;
}

export function readEvRange(form) {
  const read = (key) => {
    const wheel = form?.querySelector(`.immo-wheel[data-filter-key="${key}"]`);
    if (wheel) return String(readWheel(wheel) ?? "").trim();
    const input = form?.querySelector(`input[data-filter-key="${key}"]`);
    return String(input?.value ?? "").trim();
  };
  return { ev_tol: read("ev_tol"), ev_ig: read("ev_ig") };
}
