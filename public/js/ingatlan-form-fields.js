/**
 * Ingatlan űrlapmezők a hirdetésfeladáson — ugyanazok a kulcsok, mint a keresőben.
 * Csak vertical=ingatlan esetén kerülnek a DOM-ba (autó/teher ne lássa).
 */

import {
  INGATLAN_UZLETAG,
  INGATLAN_LAKAS_TIPUS,
  INGATLAN_ALLAPOT,
  INGATLAN_KORA,
  MIN_BERLETI_IDO,
  MIN_BERLETI_IDO_ROVID,
  BUTOROZOTT,
  KILATAS,
  TAJOLAS,
  FUTES,
  PARKOLAS,
  KOMFORT,
  TETOTER,
  FURDO_WC,
  EMELET,
  BELMAGASSAG,
  KOLTOZHETO,
  KOLTOZHETO_ROVID,
  IGEN_MINDEGY,
  INGATLAN_BOOL_FIELDS,
  alapteruletOptions,
  szobaszamOptions,
} from "./ingatlan-fields.js?v=immo2";

function fillSelect(select, options, { keepFirstEmpty = true } = {}) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = "";
  if (keepFirstEmpty) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Válasszon";
    select.appendChild(empty);
  }
  for (const opt of options) {
    if (!opt.value && keepFirstEmpty) continue;
    const el = document.createElement("option");
    el.value = opt.value;
    el.textContent = opt.label;
    select.appendChild(el);
  }
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function selectHtml(id, label) {
  return `<div class="labeled-field md-outlined">
    <label for="${id}">${label}</label>
    <select id="${id}" name="${id}"></select>
  </div>`;
}

function removeIngatlanFormFields(form) {
  form?.querySelector("#ingatlan-fields")?.remove();
}

export function ensureIngatlanFormFields(form) {
  if (!form) return null;
  const existing = form.querySelector("#ingatlan-fields");
  if (existing) return existing;

  const host =
    form.querySelector('.step-panel[data-step="1"] .card > .card-body') ||
    form.querySelector('.step-panel[data-step="1"]');
  if (!host) return null;

  const root = document.createElement("div");
  root.id = "ingatlan-fields";
  root.className = "ingatlan-fields form-grid";
  root.setAttribute("data-ingatlan-only", "1");

  const boolHtml = INGATLAN_BOOL_FIELDS.map((f) => selectHtml(f.field_key, f.label)).join("");

  root.innerHTML = `
    <div class="field-row full">
      ${selectHtml("ingatlan_uzletag", "Ingatlan típus")}
      ${selectHtml("ingatlan_lakas_tipus", "Lakás típus")}
      ${selectHtml("ingatlan_kora", "Ingatlan kora")}
      ${selectHtml("min_berleti_ido", "Minimum bérleti idő")}
      ${selectHtml("butorozott", "Bútorozott")}
      ${selectHtml("kilatas", "Kilátás")}
      ${selectHtml("tajolas", "Tájolás")}
      ${selectHtml("futes", "Fűtés módja")}
      ${selectHtml("parkolas", "Parkolás")}
      ${selectHtml("komfort", "Komfort")}
      ${selectHtml("tetoter", "Tetőtér")}
      ${selectHtml("furdo_wc", "Fürdő és WC")}
      ${selectHtml("emelet", "Emelet")}
      ${selectHtml("belmagassag", "Belmagasság")}
      ${selectHtml("koltozheto", "Mikortól költözhető")}
      ${selectHtml("alapterulet", "Alapterület (m²)")}
      ${selectHtml("szobaszam", "Szobaszám")}
      ${boolHtml}
    </div>
  `;

  host.prepend(root);

  fillSelect(root.querySelector("#ingatlan_uzletag"), INGATLAN_UZLETAG, { keepFirstEmpty: false });
  fillSelect(root.querySelector("#ingatlan_lakas_tipus"), INGATLAN_LAKAS_TIPUS);
  fillSelect(root.querySelector("#ingatlan_kora"), INGATLAN_KORA);
  fillSelect(root.querySelector("#min_berleti_ido"), MIN_BERLETI_IDO);
  fillSelect(root.querySelector("#butorozott"), BUTOROZOTT);
  fillSelect(root.querySelector("#kilatas"), KILATAS);
  fillSelect(root.querySelector("#tajolas"), TAJOLAS);
  fillSelect(root.querySelector("#futes"), FUTES);
  fillSelect(root.querySelector("#parkolas"), PARKOLAS);
  fillSelect(root.querySelector("#komfort"), KOMFORT);
  fillSelect(root.querySelector("#tetoter"), TETOTER);
  fillSelect(root.querySelector("#furdo_wc"), FURDO_WC);
  fillSelect(root.querySelector("#emelet"), EMELET);
  fillSelect(root.querySelector("#belmagassag"), BELMAGASSAG);
  fillSelect(root.querySelector("#koltozheto"), KOLTOZHETO);
  fillSelect(root.querySelector("#alapterulet"), alapteruletOptions());
  fillSelect(root.querySelector("#szobaszam"), szobaszamOptions());
  for (const bool of INGATLAN_BOOL_FIELDS) {
    fillSelect(root.querySelector(`#${bool.field_key}`), IGEN_MINDEGY);
  }

  const uz = root.querySelector("#ingatlan_uzletag");
  if (uz) uz.value = "berles";

  const lakas = root.querySelector("#ingatlan_lakas_tipus");
  lakas?.addEventListener("change", () => {
    const rovid = lakas.value === "rovid_berles";
    fillSelect(root.querySelector("#min_berleti_ido"), rovid ? MIN_BERLETI_IDO_ROVID : MIN_BERLETI_IDO);
    fillSelect(root.querySelector("#koltozheto"), rovid ? KOLTOZHETO_ROVID : KOLTOZHETO);
  });

  return root;
}

function readVertical(form) {
  const el = form?.elements?.namedItem("hirdetes_vertical");
  const raw = el instanceof RadioNodeList ? el[0]?.value : el?.value;
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

export function syncIngatlanFormVisibility(form) {
  if (!form) return;
  const isImmo = readVertical(form) === "ingatlan";
  form.classList.toggle("ad-form--ingatlan", isImmo);
  document.body.classList.toggle("ad-vertical-ingatlan", isImmo);

  document.querySelectorAll("[data-step-indicator]").forEach((el) => {
    const n = Number(el.dataset.stepIndicator);
    const vehicleStep = n === 2 || n === 3;
    el.classList.toggle("ad-step-skip", isImmo && vehicleStep);
    if (isImmo && vehicleStep) {
      el.setAttribute("aria-hidden", "true");
    } else {
      el.removeAttribute("aria-hidden");
    }
  });

  if (!isImmo) {
    removeIngatlanFormFields(form);
    form.querySelectorAll(".ad-immo-orphan, .immo-hide-vehicle").forEach((el) => {
      el.classList.remove("ad-immo-orphan", "immo-hide-vehicle");
      if (!el.classList.contains("ad-layout-hidden")) {
        el.hidden = false;
        el.removeAttribute("hidden");
        el.style.removeProperty("display");
      }
    });
    form.querySelectorAll(".field-row--vehicle-year, .field-row--vehicle-ident, .field-row--tipus-egyeb").forEach((el) => {
      el.hidden = false;
      el.removeAttribute("hidden");
      el.style.removeProperty("display");
    });
    for (const name of ["gyartasi_ev", "gyartmany", "modell", "kivitel", "okmany_jelleg", "km", "uzemanyag"]) {
      const el = form.elements.namedItem(name);
      if (!el) continue;
      const field = el instanceof RadioNodeList ? el[0] : el;
      if (field?.dataset?.wasRequired === "1") {
        field.required = true;
        field.setAttribute("required", "");
      }
    }
    return;
  }

  const root = ensureIngatlanFormFields(form);
  if (root) {
    root.hidden = false;
    root.removeAttribute("hidden");
    root.style.removeProperty("display");
  }

  form
    .querySelectorAll(
      ".field-row--vehicle-top, .field-row--vehicle-year, .field-row--vehicle-ident, .field-row--tipus-egyeb, .field-row--km, .field-row--tech-top, #electric-fields-card, .kisteher-only, #equipment-sections, #egyeb-info-sections"
    )
    .forEach((el) => {
      el.hidden = true;
      el.classList.add("immo-hide-vehicle");
      el.style.setProperty("display", "none", "important");
    });

  // Minden jármű field-row / labeled-field, ami nem az ingatlan blokk része.
  form.querySelectorAll(".step-panel[data-step='1'] .form-grid > .field-row").forEach((row) => {
    if (row.closest("#ingatlan-fields")) return;
    row.hidden = true;
    row.classList.add("immo-hide-vehicle");
    row.style.setProperty("display", "none", "important");
  });

  form.querySelectorAll(".step-panel[data-step='2'], .step-panel[data-step='3']").forEach((panel) => {
    panel.querySelectorAll(".card").forEach((card) => {
      if (card.querySelector(".ad-layout-canvas .ad-layout-item:not(.ad-layout-hidden)")) return;
      card.hidden = true;
      card.classList.add("immo-hide-vehicle");
      card.style.setProperty("display", "none", "important");
    });
  });

  const allapot = form.querySelector("#allapot");
  if (allapot && allapot.dataset.immoOptions !== "1") {
    allapot.dataset.immoOptions = "1";
    fillSelect(allapot, INGATLAN_ALLAPOT);
  }

  for (const name of ["gyartasi_ev", "gyartmany", "modell", "kivitel", "okmany_jelleg", "km", "uzemanyag"]) {
    const el = form.elements.namedItem(name);
    if (!el) continue;
    const field = el instanceof RadioNodeList ? el[0] : el;
    if (!field) continue;
    field.dataset.wasRequired = field.required ? "1" : "0";
    field.required = false;
    field.removeAttribute("required");
  }
}
