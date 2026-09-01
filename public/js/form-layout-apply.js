/** Mentett 12 oszlopos elrendezés — minden mező ugyanazon a lépésrácson. */
import { ensureIngatlanFormFields } from "./ingatlan-form-fields.js?v=immoTelekArea1";
import { refreshAdFormBmPickers } from "./ad-form-bm-pickers.js?v=adBmPickers4";

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
  // A kerék-panel (#ingatlan-fields) ne menjen a canvasra — saját UI.
  if (input.closest("#ingatlan-fields")) return null;
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
  const hideVehicleExtras = currentLayoutCategory(form) === "ingatlan";
  for (const id of ["equipment-sections", "egyeb-info-sections"]) {
    const el = document.getElementById(id);
    if (!el || !body) continue;
    if (hideVehicleExtras) {
      el.hidden = true;
      el.setAttribute("hidden", "");
      el.style.setProperty("display", "none", "important");
      continue;
    }
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

/** Ingatlan feladáskor az elrendezésbe nem került autó mezők / sorok / kártyák elrejtése. */
function hideUnplacedVehicleChrome(form, placed) {
  form.querySelectorAll(".labeled-field, .field-stack, .md-outlined").forEach((el) => {
    if (placed.has(el)) return;
    if (el.closest("#ingatlan-fields")) return;
    if (el.closest(KEEP_OUT)) return;
    if (el.closest(".packages, .phone-lang-grid, .photo-list, #equipment-sections, #egyeb-info-sections")) return;
    el.classList.add("ad-layout-hidden", "ad-immo-orphan");
    el.hidden = true;
    setRequired(el, false);
  });

  form.querySelectorAll(".field-row").forEach((row) => {
    if (row.closest(".ad-layout-canvas") && row.querySelector(".ad-layout-item:not(.ad-layout-hidden)")) return;
    if (row.closest(KEEP_OUT)) return;
    const hasVisible = [...row.querySelectorAll(".labeled-field, .field-stack, .md-outlined")].some(
      (el) => placed.has(el) || (!el.hidden && !el.classList.contains("ad-layout-hidden"))
    );
    if (!hasVisible) {
      row.hidden = true;
      row.classList.add("ad-immo-orphan");
      row.style.setProperty("display", "none", "important");
    }
  });

  const immoRoot = form.querySelector("#ingatlan-fields");
  if (immoRoot) {
    const leftovers = immoRoot.querySelectorAll(
      ".labeled-field:not(.ad-layout-hidden):not([hidden]), .md-outlined:not(.ad-layout-hidden):not([hidden])"
    );
    if (!leftovers.length) {
      immoRoot.hidden = true;
      immoRoot.classList.add("ad-immo-orphan");
      immoRoot.style.setProperty("display", "none", "important");
    }
  }

  form.querySelectorAll(".step-panel .card").forEach((card) => {
    if (card.id === "success-panel") return;
    if (card.querySelector(".packages, .phone-lang-grid, .photo-list")) return;
    if (card.querySelector(".ad-layout-canvas .ad-layout-item:not(.ad-layout-hidden)")) return;
    const visible = [...card.querySelectorAll("input, select, textarea, .labeled-field, .field-stack, .md-outlined")].some(
      (el) => {
        if (el.type === "hidden") return false;
        if (placed.has(el)) return true;
        if (el.hidden || el.classList.contains("ad-layout-hidden")) return false;
        if (el.closest(".ad-layout-hidden, .ad-immo-orphan, [hidden]")) return false;
        return true;
      }
    );
    if (!visible) {
      card.style.setProperty("display", "none", "important");
      card.classList.add("ad-immo-orphan");
      card.hidden = true;
    }
  });
}

/** Előző kategória layout elemei (pl. autó → ingatlan) ne maradjanak láthatóak. */
function resetPlacedLayoutItems(form) {
  form.querySelectorAll(".ad-layout-item").forEach((el) => {
    el.classList.add("ad-layout-hidden");
    el.hidden = true;
    setRequired(el, false);
  });
}

function setIngatlanFormMode(form, on) {
  form.classList.toggle("ad-form--ingatlan", Boolean(on));
  document.body.classList.toggle("ad-vertical-ingatlan", Boolean(on));
}

function clearImmoOrphans(form) {
  form.querySelectorAll(".ad-immo-orphan").forEach((el) => {
    el.classList.remove("ad-immo-orphan");
    if (!el.classList.contains("ad-layout-hidden")) {
      el.hidden = false;
      el.removeAttribute("hidden");
      el.style.removeProperty("display");
    }
  });
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
  wrap.dataset.layoutRow = String(row);
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

/** Üres sorok összezárása — pl. törölt videó/ár mezők után ne maradjon lyuk. */
function compactCanvasRows(form) {
  form.querySelectorAll(".ad-layout-canvas").forEach((canvas) => {
    const items = [...canvas.querySelectorAll(".ad-layout-item:not(.ad-layout-hidden)")];
    if (!items.length) return;
    const rowGroups = new Map();
    for (const item of items) {
      const row = clamp(Number(item.dataset.layoutRow || item.style.getPropertyValue("grid-row") || 1), 1, 80);
      if (!rowGroups.has(row)) rowGroups.set(row, []);
      rowGroups.get(row).push(item);
    }
    [...rowGroups.keys()]
      .sort((a, b) => a - b)
      .forEach((oldRow, index) => {
        const newRow = index + 1;
        for (const item of rowGroups.get(oldRow)) {
          item.dataset.layoutRow = String(newRow);
          item.style.setProperty("grid-row", String(newRow), "important");
        }
      });
  });
}

const LOCATION_FIELD_KEYS = new Set(["megtekintesi_cim", "iranyitoszam", "telepules", "megye"]);

function pinLocation(form) {
  const stack = form.querySelector(".field-stack--location");
  if (!stack) return;
  const canvas = canvasForStep(form, 5);
  if (canvas && stack.parentElement !== canvas) {
    canvas.appendChild(stack);
  }
  stack.classList.remove("ad-layout-hidden");
  stack.hidden = false;
  stack.removeAttribute("hidden");
  stack.style.removeProperty("display");
  if (!stack.classList.contains("ad-layout-item")) {
    stack.classList.add("ad-layout-item");
    stack.style.setProperty("grid-column", "1 / span 12", "important");
    stack.style.setProperty("grid-row", "90", "important");
    stack.dataset.layoutRow = "90";
  }
}

function hideLayoutShellCards(form) {
  form.querySelectorAll('.step-panel[data-step="5"] #ad-panel').forEach((panel) => {
    const canvas = panel.querySelector(".ad-layout-canvas");
    if (!canvas?.querySelector(".ad-layout-item:not(.ad-layout-hidden)")) return;
    panel.querySelectorAll(":scope > .card").forEach((card) => {
      if (card.id === "success-panel") return;
      // Ne rejtsük el, ha a címblokk még a kártyában van (nem került a canvasra).
      if (
        card.querySelector(
          ".field-stack--location, .ad-location-fields, #megtekintesi_cim, #telepules, #iranyitoszam"
        )
      ) {
        return;
      }
      card.style.display = "none";
    });
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
    const category = currentLayoutCategory(form);
    const isImmo = category === "ingatlan";
    setIngatlanFormMode(form, isImmo);
    if (isImmo) {
      await ensureIngatlanFormFields(form);
    } else {
      // Autó/teher: ingatlan mezők ne maradjanak a DOM-ban.
      form.querySelector("#ingatlan-fields")?.remove();
      clearImmoOrphans(form);
    }
    const res = await fetch(`/api/level1/form-layout?category=${encodeURIComponent(category)}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = await res.json();
    const layout = data.layout;
    if (!layout?.live && Number(layout?.version) < 2) {
      if (isImmo) hideVehicleChromeWithoutLayout(form);
      return;
    }
    const cells = layout?.cells;
    if (!Array.isArray(cells) || !cells.length) {
      if (isImmo) hideVehicleChromeWithoutLayout(form);
      return;
    }
    // Előző kategória (autó) canvas elemei ne maradjanak láthatóak.
    resetPlacedLayoutItems(form);
    const placed = new Set();
    for (const cell of cells) {
      // Autó layoutban ne helyezzünk el ingatlan-only mezőket, ha mégis a listában lennének.
      if (category !== "ingatlan" && String(cell.field_key || "").startsWith("ingatlan_")) continue;
      if (
        category !== "ingatlan" &&
        [
          "ingatlan_uzletag",
          "ingatlan_lakas_tipus",
          "ingatlan_kora",
          "min_berleti_ido",
          "butorozott",
          "kilatas",
          "tajolas",
          "futes",
          "parkolas",
          "komfort",
          "tetoter",
          "furdo_wc",
          "emelet",
          "belmagassag",
          "koltozheto",
          "alapterulet",
          "szobaszam",
          "lift",
          "erkely",
          "szigeteles",
          "energiahatekonys",
          "akadalymentesitett",
          "legkondicionalo",
          "kertkapcsolatos",
          "panelprogram",
          "gepesitett",
          "kisallat_megengedett",
          "dohanyzas_megengedett",
          "pince",
          "napelem",
          "uj_parcellazasu",
          "villany",
          "viz",
          "gaz",
          "csatorna",
          "irodahaz_kategoria",
          "telekterulet",
          "szintek",
          "uzemeltetesi_dij",
          "kaucio_max",
          "epitmeny_terulet",
        ].includes(cell.field_key)
      ) {
        continue;
      }
      // Ingatlan layout: ne helyezzünk el jármű-only mezőket, ha valahogy a listában vannak.
      if (
        category === "ingatlan" &&
        [
          "gyartasi_ev",
          "gyartasi_honap",
          "forgalomba_helyezes_ev",
          "forgalomba_helyezes_honap",
          "muszaki_ev",
          "muszaki_honap",
          "gyartmany",
          "modell",
          "egyeb_modell",
          "tipus",
          "egyeb_tipus",
          "kivitel",
          "ajtok",
          "szemelyek",
          "okmany_jelleg",
          "km",
          "alvazszam",
          "rendszam",
          "tulajdonosok_szama",
          "uzemanyag",
          "hengerurtartalom",
          "teljesitmeny_kw",
          "teljesitmeny_le",
          "fogyasztas_varosi",
          "fogyasztas_orszaguti",
          "fogyasztas_kombinalt",
          "sebessegvalto",
          "hajtas",
          "sajat_tomeg",
          "ossztomeg",
          "karpit1",
          "karpit2",
          "szin",
          "tetto",
          "csomagtarto",
          "akkumulator_kwh",
          "hatotav",
          "tolto_csatlakozas",
          "nyari_gumi_szelesseg",
          "nyari_gumi_magassag",
          "nyari_gumi_atmero",
          "teli_gumi_szelesseg",
          "teli_gumi_magassag",
          "teli_gumi_atmero",
          "klima",
          "nem_dohanyzo",
          "holgy_tulajdonos",
        ].includes(cell.field_key)
      ) {
        continue;
      }
      const wrap = wrapFor(form, cell.field_key);
      if (!wrap || placed.has(wrap)) continue;
      if (wrap.closest("#ingatlan-fields") && category !== "ingatlan") continue;
      placed.add(wrap);
      const isLocation = LOCATION_FIELD_KEYS.has(cell.field_key) || wrap.matches?.(".field-stack--location");
      if (cell.hidden && !isLocation) {
        wrap.classList.add("ad-layout-hidden");
        wrap.hidden = true;
        setRequired(wrap, false);
        continue;
      }
      wrap.classList.remove("ad-layout-hidden", "ad-immo-orphan");
      setRequired(wrap, true);
      const targetStep = isLocation ? 5 : clamp(cell.step || 1, 1, 5);
      const canvas = canvasForStep(form, targetStep);
      if (!canvas) continue;
      if (wrap.closest(KEEP_OUT) || wrap.querySelector(KEEP_OUT)) continue;
      canvas.appendChild(wrap);
      placeWrap(wrap, cell);
    }
    if (isImmo) {
      // Kerék UI marad egyben; csak a járműmaradékot rejtjük.
      hideVehicleChromeWithoutLayout(form);
      form.querySelectorAll(".step-panel[data-step='1'] .form-grid > .field-row").forEach((row) => {
        if (row.closest("#ingatlan-fields")) return;
        row.hidden = true;
        row.classList.add("ad-immo-orphan");
        row.style.setProperty("display", "none", "important");
      });
      // Canvasra került autó mezők elrejtése
      form.querySelectorAll(".ad-layout-item").forEach((el) => {
        if (el.closest("#ingatlan-fields")) return;
        const id = el.querySelector("input, select, textarea")?.id || el.querySelector("[name]")?.name;
        const keep = new Set([
          "vetelar",
          "akcios_ar",
          "vetelar_eur",
          "leiras",
          "megye",
          "telepules",
          "iranyitoszam",
          "megtekintesi_cim",
          "email",
          "email_megjelenik",
          "hitel",
          "kezdo_reszlet",
          "havi_reszlet",
          "futamido",
          "berelheto",
          "alkudhato",
          "csere",
          "forgalomba_helyezes_ar",
        ]);
        if (id && keep.has(id)) return;
        if (el.matches?.(".field-stack--location") || el.querySelector?.(".field-stack--location")) return;
        if (LOCATION_FIELD_KEYS.has(id)) return;
        el.classList.add("ad-layout-hidden", "ad-immo-orphan");
        el.hidden = true;
      });
    }
    pruneEmptyCards(form);
    compactCanvasRows(form);
    hideLayoutShellCards(form);
    pinExtras(form);
    pinLocation(form);
    pinFooter(form);
    window.dispatchEvent(new Event("ad-form-sync-location"));
    refreshAdFormBmPickers(form);
  } catch (error) {
    console.warn("Ad form layout apply:", error);
  }
}

/** Layout nélküli fallback: ingatlan feladáskor rejtsd el a járműblokkot. */
function hideVehicleChromeWithoutLayout(form) {
  const selectors = [
    ".field-row--vehicle-top",
    ".field-row--vehicle-year",
    ".field-row--vehicle-ident",
    ".field-row--tipus-egyeb",
    ".field-row--km",
    ".field-row--tech-top",
    "#electric-fields-card",
    ".kisteher-only",
    "#equipment-sections",
    "#egyeb-info-sections",
  ];
  for (const sel of selectors) {
    form.querySelectorAll(sel).forEach((el) => {
      el.hidden = true;
      el.classList.add("ad-immo-orphan");
      el.style.setProperty("display", "none", "important");
    });
  }
  for (const id of [
    "uzemanyag",
    "gyartasi_ev",
    "gyartmany",
    "modell",
    "kivitel",
    "km",
    "hengerurtartalom",
    "nyari_gumi_szelesseg",
    "klima",
    "karpit1",
  ]) {
    const card = form.querySelector(`#${id}`)?.closest(".card");
    if (!card || card.querySelector("#ingatlan-fields")) continue;
    card.hidden = true;
    card.classList.add("ad-immo-orphan");
    card.style.setProperty("display", "none", "important");
  }
}

function currentLayoutCategory(form) {
  const subtype = String(
    form.elements.namedItem("hirdetes_alkategoria")?.value ??
      form.elements.namedItem("jarmu_kategoria")?.value ??
      ""
  )
    .trim()
    .toLowerCase();
  if (
    subtype === "szemelyauto" ||
    subtype === "leasing" ||
    subtype === "berauto" ||
    subtype === "lakokocsi" ||
    subtype === "kisteher" ||
    subtype === "teherauto" ||
    subtype === "ingatlan"
  ) {
    return subtype;
  }
  const vertical = String(form.elements.namedItem("hirdetes_vertical")?.value ?? "")
    .trim()
    .toLowerCase();
  if (vertical === "ingatlan") return "ingatlan";
  if (vertical === "teher") return "teherauto";
  return "szemelyauto";
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
window.addEventListener("ad-form-layout-refresh", applyAdFormLayout);
