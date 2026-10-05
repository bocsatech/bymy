/**
 * Értékbecslés: a „Gyártási év” az autós keresőével azonos tól–ig dobkerék.
 * A hirdetésfeladáson marad az év + hónap választó, ezért csak itt cseréljük
 * (ad-form-bm-pickers.js ezen az űrlapon nem építi meg a split-ym menüt).
 */
import { buildDualRangeBlock } from "./auto-search-drums.js?v=32b8f890f2";
import { readWheel } from "./ingatlan-wheels.js?v=6952ba469c";

const NATIVE_IDS = ["gyartasi_ev", "gyartasi_honap"];

/** A natív select és a hónap a DOM-ban marad (űrlap-mentés, layout), csak rejtve. */
function hideNatives(form, field) {
  const ev = form.querySelector("#gyartasi_ev") || document.getElementById("gyartasi_ev");
  if (!ev) return;
  for (const id of NATIVE_IDS) {
    (form.querySelector(`#${id}`) || document.getElementById(id))?.removeAttribute("required");
  }
  let holder = ev.closest(".inline-2");
  if (!holder || holder === field) {
    holder = field.querySelector(".ertek-ev-range__native");
    if (!holder) {
      holder = document.createElement("div");
      holder.className = "ertek-ev-range__native";
      field.insertBefore(holder, ev);
    }
    for (const id of NATIVE_IDS) {
      const select = form.querySelector(`#${id}`) || document.getElementById(id);
      if (select && !holder.contains(select)) holder.appendChild(select);
    }
  }
  holder.hidden = true;
  holder.style.display = "none";
  /* A split-ym menü maradéka, ha egy korábbi mount már megépítette. */
  field.querySelector('.ad-form-split-ym[data-range="gyartasi_ev"]')?.remove();
}

export function mountErtekEvRange(form) {
  if (!form) return null;
  const anchor = form.querySelector("#gyartasi_ev") || form.querySelector('[data-range="gyartasi_ev"]');
  const field = anchor?.closest(".labeled-field, .ad-layout-item");
  if (!field) return null;

  hideNatives(form, field);

  let block = field.querySelector(".ertek-ev-range");
  if (!block) {
    block = buildDualRangeBlock("gyartasi_ev");
    if (!block) return null;
    block.classList.add("ertek-ev-range");
    /* A mezőnek már van „Gyártási év:” címkéje, a tartomány saját címsora felesleges. */
    block.querySelector(".immo-dual-range__title")?.remove();
    field.appendChild(block);
  }
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
