import { ensureIngatlanFormFields } from "./ingatlan-form-fields.js?v=immoUiParity1";
import { refreshAdFormBmPickers } from "./ad-form-bm-pickers.js?v=appearanceBm2";
import { initTireSizes } from "./tire-sizes-ui.js?v=tireFill1";
import { applyAdFormDesk } from "./ad-form-desk.js?v=adFormDesk37";
import {
  DESK_MUSZAKI_CORE_FIELD_KEYS,
  EV_LAYOUT_GROUP_KEYS,
  TIRE_LAYOUT_GROUP_KEYS,
  insertPinnedDomBlock,
  layoutRowForPinnedBlock,
} from "./ad-form-desk-pinned-blocks.js?v=layoutFromKv1";

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

function pinLeiras(form) {
  if (currentLayoutCategory(form) === "ingatlan") return;
  const panel = form.querySelector('.step-panel[data-step="4"]');
  const leirasWrap =
    form.querySelector(".field-stack--leiras") ||
    document.getElementById("leiras")?.closest(".ad-layout-item, .field-stack, .labeled-field, .md-outlined");
  if (!panel || !leirasWrap) return;

  let leirasCard = panel.querySelector(".card--leiras");
  if (!leirasCard) {
    leirasCard = document.createElement("div");
    leirasCard.className = "card card--leiras";
    leirasCard.innerHTML = '<div class="card-head">Leírás</div><div class="card-body"></div>';
    const egyebCard = document.getElementById("egyeb-info-sections")?.closest(".card");
    if (egyebCard) egyebCard.insertAdjacentElement("afterend", leirasCard);
    else panel.appendChild(leirasCard);
  }

  if (leirasCard.parentElement !== panel) {
    panel.appendChild(leirasCard);
  }

  const body = leirasCard.querySelector(".card-body");
  if (body && leirasWrap.parentElement !== body) {
    body.appendChild(leirasWrap);
  }
  leirasWrap.hidden = false;
  leirasWrap.classList.remove("ad-layout-hidden", "ad-immo-orphan", "ad-layout-item");
  leirasWrap.removeAttribute("hidden");
  leirasWrap.style.removeProperty("display");
  leirasWrap.style.removeProperty("grid-column");
  leirasWrap.style.removeProperty("grid-row");
  leirasCard.hidden = false;
  leirasCard.classList.remove("ad-immo-orphan", "ad-layout-hidden");
  leirasCard.removeAttribute("hidden");
  leirasCard.style.removeProperty("display");
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

const PINNED_DESK_FIELD_HOST = "#electric-fields-block, #tire-sizes-card, .tire-sizes-grid";

function hideUnplacedVehicleChrome(form, placed) {
  form.querySelectorAll(".labeled-field, .field-stack, .md-outlined").forEach((el) => {
    if (placed.has(el)) return;
    if (el.closest(PINNED_DESK_FIELD_HOST)) return;
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
    if (card.classList.contains("card--photos") || card.classList.contains("card--leiras")) return;
    if (card.querySelector(".packages, .phone-lang-grid, .photo-list, #upload-zone, #photo-grid, .photo-upload-bar")) {
      return;
    }
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

const TIRE_ROW_SLOTS = [
  {
    rowSelector: ".tire-block:first-child .tire-row",
    names: ["nyari_gumi_szelesseg", "nyari_gumi_magassag", "nyari_gumi_atmero"],
  },
  {
    rowSelector: ".tire-block:last-child .tire-row",
    names: ["teli_gumi_szelesseg", "teli_gumi_magassag", "teli_gumi_atmero"],
  },
];

function restoreTireSelectsToBlock(form) {
  const grid = form.querySelector(".tire-sizes-grid");
  if (!grid) return;

  for (const { rowSelector, names } of TIRE_ROW_SLOTS) {
    const row = grid.querySelector(rowSelector);
    if (!row) continue;

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const select = form.querySelector(`select[name="${cssEscape(name)}"]`);
      if (!(select instanceof HTMLSelectElement)) continue;
      if (row.contains(select)) continue;

      const strayWrap = select.closest(".labeled-field, .md-outlined, .ad-layout-item");
      const insertBefore = row.children[i * 2] ?? null;
      row.insertBefore(select, insertBefore);

      if (strayWrap && !grid.contains(strayWrap)) {
        const hasOtherControls = [...strayWrap.querySelectorAll("select, input, textarea")].some((el) => el !== select);
        if (!hasOtherControls) strayWrap.remove();
        else {
          strayWrap.classList.add("ad-layout-hidden");
          strayWrap.hidden = true;
          strayWrap.style.setProperty("display", "none", "important");
        }
      }

      select.hidden = false;
      select.classList.remove("ad-layout-hidden");
      select.style.removeProperty("display");
    }
  }
}

function cleanupStrayTireLayoutItems(form) {
  const grid = form.querySelector(".tire-sizes-grid");
  for (const key of TIRE_LAYOUT_GROUP_KEYS) {
    form.querySelectorAll(`select[name="${cssEscape(key)}"]`).forEach((el) => {
      if (grid?.contains(el)) return;
      const wrap = el.closest(".labeled-field, .md-outlined, .ad-layout-item");
      if (!wrap) return;
      wrap.classList.add("ad-layout-hidden");
      wrap.hidden = true;
      wrap.style.setProperty("display", "none", "important");
    });
  }
}

function ensureDeskMuszakiCoreFields(form, cells, placed) {
  if (currentLayoutCategory(form) === "ingatlan") return;
  const lookup = new Map((cells || []).map((cell) => [cell.field_key, cell]));
  for (const key of DESK_MUSZAKI_CORE_FIELD_KEYS) {
    const cell = lookup.get(key);
    if (!cell || cell.hidden) continue;
    const wrap = wrapFor(form, key);
    if (!wrap || placed.has(wrap)) continue;
    wrap.classList.remove("ad-layout-hidden", "ad-immo-orphan");
    wrap.hidden = false;
    wrap.removeAttribute("hidden");
    wrap.style.removeProperty("display");
    setRequired(wrap, true);
    const targetStep = clamp(cell.step || 2, 1, 5);
    const canvas = canvasForStep(form, targetStep);
    if (!canvas || wrap.closest(KEEP_OUT) || wrap.querySelector(KEEP_OUT)) continue;
    canvas.appendChild(wrap);
    placeWrap(wrap, cell);
    placed.add(wrap);
  }
}

/** Éles desk: DOM sorrend = adminban mentett row/col (KV), nem fix kanonikus lista. */
function syncCanvasOrderFromLayoutCells(form, cells) {
  if (currentLayoutCategory(form) === "ingatlan") return;
  const lookup = new Map((cells || []).map((cell) => [cell.field_key, cell]));

  form.querySelectorAll(".ad-layout-item:not(.ad-layout-hidden)").forEach((wrap) => {
    const id =
      wrap.querySelector("input, select, textarea")?.id || wrap.querySelector("[name]")?.name || "";
    const cell = id ? lookup.get(id) : null;
    if (!cell || cell.hidden) return;
    const row = clamp(Number(cell.row) || 1, 1, 80);
    const col = clamp(Number(cell.col) || 1, 1, 12);
    const span = clamp(Number(cell.colSpan) || 6, 1, 13 - col);
    wrap.dataset.layoutRow = String(row);
    wrap.style.setProperty("grid-column", `${col} / span ${span}`, "important");
    wrap.style.setProperty("grid-row", String(row), "important");
  });

  const tireRow = layoutRowForPinnedBlock(cells, TIRE_LAYOUT_GROUP_KEYS);
  const tire = document.getElementById("tire-sizes-card");
  if (tire && !tire.classList.contains("ad-layout-hidden")) {
    tire.dataset.layoutRow = String(tireRow);
  }
  const evRow = layoutRowForPinnedBlock(cells, EV_LAYOUT_GROUP_KEYS);
  const ev = document.getElementById("electric-fields-block");
  if (ev && !ev.classList.contains("ad-layout-hidden") && !ev.hidden) {
    ev.dataset.layoutRow = String(evRow);
  }
}

function pinTireFields(form, layoutCells) {
  if (currentLayoutCategory(form) === "ingatlan") return;
  restoreTireSelectsToBlock(form);
  const block = document.getElementById("tire-sizes-card") || form.querySelector(".tire-sizes-grid")?.closest(".card");
  const canvas = canvasForStep(form, 2);
  if (!block || !canvas) return;
  const row = layoutRowForPinnedBlock(layoutCells, TIRE_LAYOUT_GROUP_KEYS);
  insertPinnedDomBlock(canvas, block, row);
  block.hidden = false;
  block.classList.remove("ad-immo-orphan", "ad-layout-hidden");
  block.removeAttribute("hidden");
  block.style.removeProperty("display");
  cleanupStrayTireLayoutItems(form);
}

function pinElectricFields(form, layoutCells) {
  if (currentLayoutCategory(form) === "ingatlan") return;
  const block = document.getElementById("electric-fields-block");
  const canvas = canvasForStep(form, 2);
  if (!block || !canvas) return;
  const row = layoutRowForPinnedBlock(layoutCells, EV_LAYOUT_GROUP_KEYS);
  insertPinnedDomBlock(canvas, block, row);
  block.classList.remove("ad-immo-orphan", "ad-layout-hidden");
  block.querySelectorAll(".labeled-field").forEach((el) => {
    el.classList.remove("ad-layout-hidden", "ad-immo-orphan");
    el.removeAttribute("hidden");
    el.hidden = false;
    el.style.removeProperty("display");
  });
  cleanupStrayEvLayoutItems(form);
}

function cleanupStrayEvLayoutItems(form) {
  for (const key of EV_LAYOUT_GROUP_KEYS) {
    form.querySelectorAll(`#${cssEscape(key)}`).forEach((el) => {
      if (el.closest("#electric-fields-block")) return;
      const wrap = el.closest(".labeled-field, .md-outlined, .ad-layout-item");
      if (!wrap) return;
      wrap.classList.add("ad-layout-hidden");
      wrap.hidden = true;
      wrap.style.setProperty("display", "none", "important");
    });
  }
}

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

function retireLegacyFormGrid(form) {
  form.querySelectorAll(".step-panel .card-body").forEach((body) => {
    const canvas = body.querySelector(".ad-layout-canvas");
    if (!canvas?.querySelector(".ad-layout-item:not(.ad-layout-hidden)")) return;
    body.querySelectorAll(":scope > .form-grid").forEach((grid) => {
      grid.hidden = true;
      grid.classList.add("ad-layout-grid-retired");
      grid.style.setProperty("display", "none", "important");
      grid.style.setProperty("min-height", "0", "important");
      grid.style.setProperty("margin", "0", "important");
      grid.style.setProperty("padding", "0", "important");
    });
  });
}

function ensurePhotoUploadVisible(form) {
  form.querySelectorAll(".card--photos").forEach((card) => {
    card.hidden = false;
    card.classList.remove("ad-immo-orphan", "ad-layout-hidden");
    card.removeAttribute("hidden");
    card.style.removeProperty("display");
  });
  for (const id of ["upload-zone", "photo-upload-bar", "photo-grid", "photo-input"]) {
    const el = form.querySelector(`#${cssEscape(id)}`);
    if (!el) continue;
    if (id === "photo-input") continue;
    el.hidden = false;
    el.classList.remove("ad-layout-hidden", "ad-immo-orphan");
    el.style.removeProperty("display");
  }
}

function pruneEmptyCards(form) {
  form.querySelectorAll(".field-row").forEach((row) => {
    if (!row.querySelector("input, select, textarea, .labeled-field, .field-stack, .md-outlined")) {
      row.style.display = "none";
    }
  });
  form.querySelectorAll(".step-panel .card").forEach((card) => {
    if (card.id === "success-panel") return;
    if (
      card.querySelector(
        ".packages, .phone-lang-grid, .photo-list, .ad-layout-canvas, #equipment-sections, #egyeb-info-sections, .upload-zone, #photo-grid, .field-stack--leiras, #leiras"
      ) ||
      card.classList.contains("card--leiras")
    ) {
      return;
    }
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
    resetPlacedLayoutItems(form);
    const placed = new Set();
    for (const cell of cells) {
      if (cell.field_key === "leiras") continue;
      if (category !== "ingatlan" && EV_LAYOUT_GROUP_KEYS.has(cell.field_key)) continue;
      if (category !== "ingatlan" && TIRE_LAYOUT_GROUP_KEYS.has(cell.field_key)) continue;
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
    if (!isImmo) {
      ensureDeskMuszakiCoreFields(form, cells, placed);
    }
    if (isImmo) {
      hideVehicleChromeWithoutLayout(form);
      form.querySelectorAll(".step-panel[data-step='1'] .form-grid > .field-row").forEach((row) => {
        if (row.closest("#ingatlan-fields")) return;
        row.hidden = true;
        row.classList.add("ad-immo-orphan");
        row.style.setProperty("display", "none", "important");
      });
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
    if (!isImmo) {
      hideUnplacedVehicleChrome(form, placed);
      ensurePhotoUploadVisible(form);
      retireLegacyFormGrid(form);
    }
    pruneEmptyCards(form);
    if (isImmo) compactCanvasRows(form);
    hideLayoutShellCards(form);
    pinExtras(form);
    pinElectricFields(form, cells);
    pinTireFields(form, cells);
    syncCanvasOrderFromLayoutCells(form, cells);
    pinLeiras(form);
    pinLocation(form);
    pinFooter(form);
    window.dispatchEvent(new Event("ad-form-sync-location"));
    await refreshAdFormBmPickers(form);
    initTireSizes(form);
    window.dispatchEvent(new Event("ad-form-sync-fuel-fields"));
    applyAdFormDesk();
  } catch (error) {
    console.warn("Ad form layout apply:", error);
  }
}

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
