/**
 * Ingatlan feladás — ugyanaz a kereső UI, mint /ingatlan.html (kinézet + működés).
 * Séma: eladó / kiadó / airbnb külön variant.
 */

import { normalizeIngatlanUzletag, INGATLAN_LAKAS_TIPUS, INGATLAN_LAKAS_TIPUS_AIRBNB } from "./ingatlan-fields.js?v=immoTelekArea1";
import {
  initIngatlanSearch,
  readIngatlanSearchForm,
} from "./ingatlan-search.js?v=immoTelekArea1";
import { fetchIngatlanWheelSchema } from "./ingatlan-wheel-schema.js?v=immoTipusFields1";
import { wireTelepulesSuggestIn } from "./telepules-suggest.js?v=telepClose1";

function removeIngatlanFormFields(form) {
  form?.querySelector("#ingatlan-fields")?.remove();
}

function readPickerTip(form) {
  const el = form?.elements?.namedItem("ingatlan_tipus");
  const raw = el instanceof RadioNodeList ? el[0]?.value : el?.value;
  return String(raw ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
}

/** Picker tip → admin kerék-séma variant. */
export function schemaVariantFromImmoTip(tip) {
  const t = String(tip || "").trim().toLowerCase();
  if (t === "elado") return "elado-ingatlan";
  if (t === "airbnb") return "airbnb";
  return "ingatlan"; // kiado (master)
}

function defaultUzletagFromTip(tip) {
  const t = String(tip || "").trim().toLowerCase();
  if (t === "elado") return "elado";
  if (t === "airbnb") return "airbnb";
  return "kiado";
}

export async function ensureIngatlanFormFields(form) {
  if (!form) return null;
  const tip = readPickerTip(form);
  const variant = schemaVariantFromImmoTip(tip);
  const existing = form.querySelector("#ingatlan-fields");
  if (existing?.dataset.schemaReady === "1" && existing.dataset.schemaVariant === variant) {
    return existing;
  }

  const host =
    form.querySelector('.step-panel[data-step="1"] .card > .card-body') ||
    form.querySelector('.step-panel[data-step="1"]');
  if (!host) return null;

  existing?.remove();

  const root = document.createElement("div");
  root.id = "ingatlan-fields";
  root.className = "ingatlan-fields";
  root.setAttribute("data-ingatlan-only", "1");
  root.dataset.schemaVariant = variant;

  /* Kereső UI mezők — Kategória kerék csak az élő keresőn; feladáson hidden a tipből. */
  const uz = defaultUzletagFromTip(tip);
  root.innerHTML = `
    <article class="immo-search-panel immo-search-panel--post">
      <div class="immo-search-form" id="immo-search-form">
        <input type="hidden" id="immo-uzletag" name="ingatlan_uzletag" value="${uz}" />

        <div id="immo-schema-main" class="immo-schema-grid" aria-label="Fő mezők"></div>

        <div class="immo-more" id="immo-more" hidden>
          <div id="immo-schema-more" class="immo-schema-grid" aria-label="További feltételek"></div>
        </div>

        <div class="immo-actions immo-actions--post">
          <div class="immo-actions-secondary">
            <button type="button" class="immo-action" id="immo-tovabbi" aria-expanded="false" aria-controls="immo-more">További feltételek</button>
          </div>
        </div>
      </div>
    </article>
  `;

  host.prepend(root);

  const searchRoot = root.querySelector("#immo-search-form");
  const schema = await fetchIngatlanWheelSchema(variant);
  await initIngatlanSearch({
    form: searchRoot,
    schema,
    defaultUzletag: defaultUzletagFromTip(tip),
    lakasTipusOptions: tip === "airbnb" ? INGATLAN_LAKAS_TIPUS_AIRBNB : INGATLAN_LAKAS_TIPUS,
    enableTipus2: tip !== "airbnb",
    onSearch: () => {},
  });

  /* Település mező: címke + ajánló (keresővel megegyező). */
  root.querySelectorAll('[data-schema-field="keresesi_hely"] .immo-label, label[data-schema-field="keresesi_hely"] .immo-label').forEach((el) => {
    el.textContent = "Település";
  });
  const helyInput = root.querySelector('#immo-keresesi_hely, [name="keresesi_hely"]');
  if (helyInput) {
    helyInput.setAttribute("placeholder", "Település neve");
    helyInput.setAttribute("aria-label", "Település");
  }
  wireTelepulesSuggestIn(root);

  root.dataset.schemaReady = "1";
  return root;
}

function readVertical(form) {
  const el = form?.elements?.namedItem("hirdetes_vertical");
  const raw = el instanceof RadioNodeList ? el[0]?.value : el?.value;
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

export async function syncIngatlanFormVisibility(form) {
  if (!form) return;
  const isImmo = readVertical(form) === "ingatlan";
  form.classList.toggle("ad-form--ingatlan", isImmo);
  document.body.classList.toggle("ad-vertical-ingatlan", isImmo);

  document.querySelectorAll("[data-step-indicator]").forEach((el) => {
    const n = Number(el.dataset.stepIndicator);
    const vehicleStep = n === 2 || n === 3;
    el.classList.toggle("ad-step-skip", isImmo && vehicleStep);
    if (isImmo && vehicleStep) el.setAttribute("aria-hidden", "true");
    else el.removeAttribute("aria-hidden");
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

  const root = await ensureIngatlanFormFields(form);
  if (root) {
    root.hidden = false;
    root.removeAttribute("hidden");
    root.style.removeProperty("display");
    const uz = root.querySelector("#immo-uzletag");
    if (uz) uz.value = normalizeIngatlanUzletag(uz.value);
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

  form.querySelectorAll('.step-panel[data-step="1"] .form-grid select#allapot, .step-panel[data-step="1"] .form-grid #allapot').forEach((el) => {
    if (el.closest("#ingatlan-fields")) return;
    el.removeAttribute("id");
    el.setAttribute("name", "_vehicle_allapot_unused");
    const wrap = el.closest(".labeled-field, .field-row");
    if (wrap) {
      wrap.hidden = true;
      wrap.classList.add("immo-hide-vehicle");
      wrap.style.setProperty("display", "none", "important");
    }
  });

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

export function readIngatlanFormValues(form) {
  const searchRoot = form?.querySelector("#ingatlan-fields #immo-search-form");
  if (!searchRoot) return {};
  return readIngatlanSearchForm(searchRoot);
}
