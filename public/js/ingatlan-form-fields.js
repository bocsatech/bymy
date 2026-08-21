/**
 * Ingatlan feladás — közös kerék-séma (ugyanaz, mint a kereső), kategória csak élőn.
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
  normalizeIngatlanUzletag,
} from "./ingatlan-fields.js?v=immoWheel1";
import { fillWheel, initWheel, readWheel, setWheelValue } from "./ingatlan-wheels.js?v=immoWheel2";
import { fetchIngatlanWheelSchema, renderIngatlanSchemaHosts } from "./ingatlan-wheel-schema.js?v=immoWheel1";

function removeIngatlanFormFields(form) {
  form?.querySelector("#ingatlan-fields")?.remove();
}

function syncRovidMenus(root) {
  const tipus = readWheel(root.querySelector('[data-wheel="ingatlan_lakas_tipus"]'));
  const rovid = tipus === "rovid_berles";
  const berleti = root.querySelector('[data-wheel="min_berleti_ido"]');
  const koltoz = root.querySelector('[data-wheel="koltozheto"]');
  const prevBerleti = readWheel(berleti);
  const prevKoltoz = readWheel(koltoz);
  fillWheel(berleti, (rovid ? MIN_BERLETI_IDO_ROVID : MIN_BERLETI_IDO).filter((o) => o.value));
  fillWheel(koltoz, (rovid ? KOLTOZHETO_ROVID : KOLTOZHETO).filter((o) => o.value));
  if (berleti) berleti.dataset.bound = "";
  if (koltoz) koltoz.dataset.bound = "";
  initWheel(berleti);
  initWheel(koltoz);
  const berletiOpts = new Set([...(berleti?.querySelectorAll(".immo-wheel-opt") || [])].map((b) => b.dataset.value));
  const koltozOpts = new Set([...(koltoz?.querySelectorAll(".immo-wheel-opt") || [])].map((b) => b.dataset.value));
  setWheelValue(berleti, berletiOpts.has(prevBerleti) ? prevBerleti : "");
  setWheelValue(koltoz, koltozOpts.has(prevKoltoz) ? prevKoltoz : "");
}

function fillAllWheels(root) {
  fillWheel(root.querySelector('[data-wheel="alapterulet"]'), alapteruletOptions(), { emptyLabel: "Válasszon" });
  fillWheel(root.querySelector('[data-wheel="szobaszam"]'), szobaszamOptions(), { emptyLabel: "Válasszon" });
  fillWheel(root.querySelector('[data-wheel="ingatlan_lakas_tipus"]'), INGATLAN_LAKAS_TIPUS.filter((o) => o.value), {
    emptyLabel: "Válasszon",
  });
  fillWheel(root.querySelector('[data-wheel="allapot"]'), INGATLAN_ALLAPOT.filter((o) => o.value), {
    emptyLabel: "Válasszon",
  });
  fillWheel(root.querySelector('[data-wheel="ingatlan_kora"]'), INGATLAN_KORA.filter((o) => o.value), {
    emptyLabel: "Válasszon",
  });
  fillWheel(root.querySelector('[data-wheel="min_berleti_ido"]'), MIN_BERLETI_IDO.filter((o) => o.value), {
    emptyLabel: "Válasszon",
  });
  fillWheel(root.querySelector('[data-wheel="butorozott"]'), BUTOROZOTT.filter((o) => o.value), {
    emptyLabel: "Válasszon",
  });
  fillWheel(root.querySelector('[data-wheel="kilatas"]'), KILATAS.filter((o) => o.value), { emptyLabel: "Válasszon" });
  fillWheel(root.querySelector('[data-wheel="tajolas"]'), TAJOLAS.filter((o) => o.value), { emptyLabel: "Válasszon" });
  fillWheel(root.querySelector('[data-wheel="futes"]'), FUTES.filter((o) => o.value), { emptyLabel: "Válasszon" });
  fillWheel(root.querySelector('[data-wheel="parkolas"]'), PARKOLAS.filter((o) => o.value), { emptyLabel: "Válasszon" });
  fillWheel(root.querySelector('[data-wheel="komfort"]'), KOMFORT.filter((o) => o.value), { emptyLabel: "Válasszon" });
  fillWheel(root.querySelector('[data-wheel="tetoter"]'), TETOTER.filter((o) => o.value), { emptyLabel: "Válasszon" });
  fillWheel(root.querySelector('[data-wheel="furdo_wc"]'), FURDO_WC.filter((o) => o.value), { emptyLabel: "Válasszon" });
  fillWheel(root.querySelector('[data-wheel="emelet"]'), EMELET.filter((o) => o.value), { emptyLabel: "Válasszon" });
  fillWheel(root.querySelector('[data-wheel="belmagassag"]'), BELMAGASSAG.filter((o) => o.value), {
    emptyLabel: "Válasszon",
  });
  fillWheel(root.querySelector('[data-wheel="koltozheto"]'), KOLTOZHETO.filter((o) => o.value), {
    emptyLabel: "Válasszon",
  });
  for (const bool of INGATLAN_BOOL_FIELDS) {
    fillWheel(root.querySelector(`[data-wheel="${bool.field_key}"]`), IGEN_MINDEGY.filter((o) => o.value), {
      emptyLabel: "Válasszon",
    });
  }
  root.querySelectorAll("[data-wheel]").forEach((wheel) => {
    wheel.dataset.bound = "";
    initWheel(wheel);
  });
  syncRovidMenus(root);
}

export async function ensureIngatlanFormFields(form) {
  if (!form) return null;
  const existing = form.querySelector("#ingatlan-fields");
  if (existing?.dataset.schemaReady === "1") return existing;

  const host =
    form.querySelector('.step-panel[data-step="1"] .card > .card-body') ||
    form.querySelector('.step-panel[data-step="1"]');
  if (!host) return null;

  existing?.remove();

  const root = document.createElement("div");
  root.id = "ingatlan-fields";
  root.className = "ingatlan-fields immo-post-panel";
  root.setAttribute("data-ingatlan-only", "1");

  const catOpts = INGATLAN_UZLETAG.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");

  root.innerHTML = `
    <article class="immo-search-panel immo-post-panel__card">
      <h2 class="immo-search-title">Ingatlan adatai</h2>
      <div class="immo-search-form">
        <label class="immo-field">
          <span class="immo-label">Kategória</span>
          <select class="immo-control" id="ingatlan_uzletag" name="ingatlan_uzletag">${catOpts}</select>
        </label>
        <div id="immo-post-schema-main" class="immo-schema-grid" aria-label="Fő mezők"></div>
        <div class="immo-more" id="immo-post-more" hidden>
          <div id="immo-post-schema-more" class="immo-schema-grid" aria-label="További feltételek"></div>
        </div>
        <div class="immo-actions-secondary" style="margin-top:0.35rem">
          <button type="button" class="immo-action" id="immo-post-tovabbi" aria-expanded="false" aria-controls="immo-post-more">További feltételek</button>
        </div>
      </div>
    </article>
  `;

  host.prepend(root);

  const schema = await fetchIngatlanWheelSchema();
  renderIngatlanSchemaHosts(
    root.querySelector("#immo-post-schema-main"),
    root.querySelector("#immo-post-schema-more"),
    schema,
    "post"
  );
  root.dataset.schemaReady = "1";

  const uz = root.querySelector("#ingatlan_uzletag");
  if (uz) uz.value = "berbe";

  fillAllWheels(root);

  root.querySelectorAll("[data-wheel]").forEach((wheel) => {
    const name = wheel.getAttribute("data-wheel");
    const hidden = root.querySelector(`input[name="${name}"]`);
    if (hidden?.value) setWheelValue(wheel, hidden.value);
  });

  const morePanel = root.querySelector("#immo-post-more");
  const moreBtn = root.querySelector("#immo-post-tovabbi");
  moreBtn?.addEventListener("click", () => {
    const open = !!morePanel?.hidden;
    if (morePanel) morePanel.hidden = !open;
    moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
    moreBtn.textContent = open ? "Kevesebb feltétel" : "További feltételek";
  });

  root.querySelector('[data-wheel="ingatlan_lakas_tipus"]')?.addEventListener("immo-wheel-change", () => {
    syncRovidMenus(root);
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
    const uz = root.querySelector("#ingatlan_uzletag");
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

  // Régi #allapot a form-gridben ne ütközzön a kerék hiddennel.
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
  const root = form?.querySelector("#ingatlan-fields");
  if (!root) return {};
  const out = {};
  const uz = root.querySelector("#ingatlan_uzletag");
  if (uz) out.ingatlan_uzletag = normalizeIngatlanUzletag(uz.value);
  root.querySelectorAll("[data-wheel]").forEach((wheel) => {
    const name = wheel.getAttribute("data-wheel");
    if (name) out[name] = readWheel(wheel);
  });
  return out;
}
