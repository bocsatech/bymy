/**
 * Ingatlan bérlés kereső — mobil-szerű kerék pickerek + szűrés.
 * Csak ezekkel a mezőkulcsokkal kötjük össze a listát.
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
  priceMillionOptions,
  alapteruletOptions,
  szobaszamOptions,
  arFtMinOptions,
  emeletRank,
  normalizeIngatlanUzletag,
} from "./ingatlan-fields.js?v=immoWheel3";
import {
  fillWheel,
  initMenuWheel,
  readWheel,
  readWheelList,
  setWheelValue,
  MULTI_WHEEL_KEYS,
} from "./ingatlan-wheels.js?v=immoWheel7";
import { fetchIngatlanWheelSchema, renderIngatlanSchemaHosts } from "./ingatlan-wheel-schema.js?v=immoWheel4";

const EXACT_KEYS = [
  "ingatlan_uzletag",
  "ingatlan_lakas_tipus",
  "allapot",
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
  "belmagassag",
  "koltozheto",
  ...INGATLAN_BOOL_FIELDS.map((f) => f.field_key),
];

export function emptyIngatlanFilters() {
  return {
    ingatlan_uzletag: "berbe",
    keresesi_hely: "",
    ar_tol: null,
    ar_ig: null,
    ar_ft_min: null,
    alapterulet: null,
    alapterulet_tol: null,
    alapterulet_ig: null,
    szobaszam: "",
    ingatlan_lakas_tipus: "",
    allapot: "",
    ingatlan_kora: "",
    min_berleti_ido: "",
    butorozott: "",
    kilatas: "",
    tajolas: "",
    futes: "",
    parkolas: "",
    komfort: "",
    tetoter: "",
    furdo_wc: "",
    emelet_tol: "",
    emelet_ig: "",
    belmagassag: "",
    koltozheto: "",
    lift: "",
    erkely: "",
    szigeteles: "",
    energiahatekonys: "",
    akadalymentesitett: "",
    legkondicionalo: "",
    kertkapcsolatos: "",
    panelprogram: "",
    gepesitett: "",
    kisallat_megengedett: "",
    dohanyzas_megengedett: "",
  };
}

function numOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function fieldBag(item, key) {
  const f = item?.preview?.filter ?? {};
  const form = item?.form ?? {};
  const v = f[key] ?? form[key];
  return v == null ? "" : String(v).trim();
}

function listingPrice(item) {
  const n = item?.preview?.priceNum;
  if (Number.isFinite(n) && n > 0) return n;
  return numOrNull(item?.form?.vetelar || item?.form?.akcios_ar);
}

function normalizePlace(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isTruthyIgen(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  return v === "igen" || v === "1" || v === "true" || v === "yes";
}

export function filterListingsByIngatlan(items, filters) {
  const f = { ...emptyIngatlanFilters(), ...filters };
  return items.filter((item) => {
    if (f.ingatlan_uzletag) {
      const want = normalizeIngatlanUzletag(f.ingatlan_uzletag);
      const uz = normalizeIngatlanUzletag(fieldBag(item, "ingatlan_uzletag"));
      if (uz && uz !== want) return false;
    }

    if (f.keresesi_hely) {
      const needle = normalizePlace(f.keresesi_hely);
      const hay = normalizePlace(
        [fieldBag(item, "telepules"), item?.preview?.location, item?.preview?.title].join(" ")
      );
      if (!hay.includes(needle)) return false;
    }

    const price = listingPrice(item);
    const minPrice = f.ar_ft_min ?? f.ar_tol;
    if (minPrice != null && price != null && price < minPrice) return false;
    if (f.ar_ig != null && price != null && price > f.ar_ig) return false;

    if (f.alapterulet_tol != null || f.alapterulet_ig != null || f.alapterulet != null) {
      const area = numOrNull(fieldBag(item, "alapterulet"));
      const minArea = f.alapterulet_tol ?? f.alapterulet;
      const maxArea = f.alapterulet_ig;
      if (minArea != null && area != null && area < minArea) return false;
      if (maxArea != null && area != null && area > maxArea) return false;
    }

    if (f.szobaszam) {
      const wants = String(f.szobaszam)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (wants.length) {
        const gotRaw = fieldBag(item, "szobaszam");
        const got = numOrNull(gotRaw);
        const ok = wants.some((want) => {
          if (want === "6" || want === "6+") return got != null && got >= 6;
          const w = numOrNull(want);
          if (got != null && w != null) return got === w;
          return String(gotRaw) === String(want);
        });
        if (gotRaw && !ok) return false;
        if (!gotRaw) return false;
      }
    }

    for (const key of EXACT_KEYS) {
      const want = f[key];
      if (!want) continue;
      if (INGATLAN_BOOL_FIELDS.some((b) => b.field_key === key)) {
        if (!isTruthyIgen(fieldBag(item, key))) return false;
        continue;
      }
      const got = fieldBag(item, key);
      if (!got) continue;
      const wants = String(want)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (wants.length && !wants.includes(got)) return false;
    }

    const floor = fieldBag(item, "emelet");
    const floorRank = emeletRank(floor);
    const fromRank = emeletRank(f.emelet_tol);
    const toRank = emeletRank(f.emelet_ig);
    if (fromRank != null && floorRank != null && floorRank < fromRank) return false;
    if (toRank != null && floorRank != null && floorRank > toRank) return false;

    return true;
  });
}

function syncRovidMenus(form) {
  const tipusList = readWheelList(form.querySelector('[data-wheel="ingatlan_lakas_tipus"]'));
  const rovid = tipusList.includes("rovid_berles");
  const berleti = form.querySelector('[data-wheel="min_berleti_ido"]');
  const koltoz = form.querySelector('[data-wheel="koltozheto"]');
  const prevBerleti = readWheel(berleti);
  const prevKoltoz = readWheel(koltoz);
  fillWheel(berleti, (rovid ? MIN_BERLETI_IDO_ROVID : MIN_BERLETI_IDO).filter((o) => o.value));
  fillWheel(koltoz, (rovid ? KOLTOZHETO_ROVID : KOLTOZHETO).filter((o) => o.value));
  initMenuWheel(berleti, { emptyLabel: "Mindegy", multiple: false });
  initMenuWheel(koltoz, { emptyLabel: "Mindegy", multiple: MULTI_WHEEL_KEYS.has("koltozheto") });
  const berletiOpts = new Set([...(berleti?.querySelectorAll(".immo-wheel-opt") || [])].map((b) => b.dataset.value));
  const koltozOpts = new Set([...(koltoz?.querySelectorAll(".immo-wheel-opt") || [])].map((b) => b.dataset.value));
  const berletiKeep = String(prevBerleti)
    .split(",")
    .filter((v) => berletiOpts.has(v));
  const koltozKeep = String(prevKoltoz)
    .split(",")
    .filter((v) => koltozOpts.has(v));
  setWheelValue(berleti, berletiKeep.join(","));
  setWheelValue(koltoz, koltozKeep.join(","));
}

function readForm(form) {
  const out = emptyIngatlanFilters();
  out.ingatlan_uzletag = normalizeIngatlanUzletag(form.querySelector("#immo-uzletag")?.value || "berbe");
  out.keresesi_hely = form.querySelector('[name="keresesi_hely"]')?.value?.trim() || "";
  out.ar_tol = numOrNull(readWheel(form.querySelector('[data-wheel="ar_tol"]')));
  out.ar_ig = numOrNull(readWheel(form.querySelector('[data-wheel="ar_ig"]')));
  out.alapterulet_tol = numOrNull(readWheel(form.querySelector('[data-wheel="alapterulet_tol"]')));
  out.alapterulet_ig = numOrNull(readWheel(form.querySelector('[data-wheel="alapterulet_ig"]')));
  out.szobaszam = readWheel(form.querySelector('[data-wheel="szobaszam"]'));
  out.ingatlan_lakas_tipus = readWheel(form.querySelector('[data-wheel="ingatlan_lakas_tipus"]'));
  out.allapot = readWheel(form.querySelector('[data-wheel="allapot"]'));
  out.ingatlan_kora = readWheel(form.querySelector('[data-wheel="ingatlan_kora"]'));
  out.min_berleti_ido = readWheel(form.querySelector('[data-wheel="min_berleti_ido"]'));
  out.butorozott = readWheel(form.querySelector('[data-wheel="butorozott"]'));
  out.kilatas = readWheel(form.querySelector('[data-wheel="kilatas"]'));
  out.tajolas = readWheel(form.querySelector('[data-wheel="tajolas"]'));
  out.futes = readWheel(form.querySelector('[data-wheel="futes"]'));
  out.parkolas = readWheel(form.querySelector('[data-wheel="parkolas"]'));
  out.komfort = readWheel(form.querySelector('[data-wheel="komfort"]'));
  out.tetoter = readWheel(form.querySelector('[data-wheel="tetoter"]'));
  out.furdo_wc = readWheel(form.querySelector('[data-wheel="furdo_wc"]'));
  out.emelet_tol = readWheel(form.querySelector('[data-wheel="emelet_tol"]'));
  out.emelet_ig = readWheel(form.querySelector('[data-wheel="emelet_ig"]'));
  out.belmagassag = readWheel(form.querySelector('[data-wheel="belmagassag"]'));
  out.koltozheto = readWheel(form.querySelector('[data-wheel="koltozheto"]'));
  out.ar_ft_min = numOrNull(readWheel(form.querySelector('[data-wheel="ar_ft_min"]')));
  for (const bool of INGATLAN_BOOL_FIELDS) {
    out[bool.field_key] = readWheel(form.querySelector(`[data-wheel="${bool.field_key}"]`));
  }
  return out;
}

export async function initIngatlanSearch({ onSearch = () => {} } = {}) {
  const form = document.getElementById("immo-search-form");
  if (!form) return;

  const schema = await fetchIngatlanWheelSchema();
  renderIngatlanSchemaHosts(
    document.getElementById("immo-schema-main"),
    document.getElementById("immo-schema-more"),
    schema,
    "search"
  );

  const millions = priceMillionOptions();
  const arTol = form.querySelector('[data-wheel="ar_tol"]');
  const arIg = form.querySelector('[data-wheel="ar_ig"]');
  fillWheel(arTol, millions, { emptyLabel: "Min. ár" });
  fillWheel(arIg, millions, { emptyLabel: "Max. ár" });
  fillWheel(form.querySelector('[data-wheel="alapterulet_tol"]'), alapteruletOptions(), { emptyLabel: "Min. m²" });
  fillWheel(form.querySelector('[data-wheel="alapterulet_ig"]'), alapteruletOptions(), { emptyLabel: "Max. m²" });
  fillWheel(form.querySelector('[data-wheel="szobaszam"]'), szobaszamOptions(), { emptyLabel: "Mindegy" });
  fillWheel(form.querySelector('[data-wheel="ingatlan_lakas_tipus"]'), INGATLAN_LAKAS_TIPUS.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="allapot"]'), INGATLAN_ALLAPOT.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="ingatlan_kora"]'), INGATLAN_KORA.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="min_berleti_ido"]'), MIN_BERLETI_IDO.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="butorozott"]'), BUTOROZOTT.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="kilatas"]'), KILATAS.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="tajolas"]'), TAJOLAS.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="futes"]'), FUTES.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="parkolas"]'), PARKOLAS.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="komfort"]'), KOMFORT.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="tetoter"]'), TETOTER.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="furdo_wc"]'), FURDO_WC.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="emelet_tol"]'), EMELET.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="emelet_ig"]'), EMELET.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="belmagassag"]'), BELMAGASSAG.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="koltozheto"]'), KOLTOZHETO.filter((o) => o.value));
  fillWheel(form.querySelector('[data-wheel="ar_ft_min"]'), arFtMinOptions(), { emptyLabel: "Mindegy" });
  for (const bool of INGATLAN_BOOL_FIELDS) {
    fillWheel(form.querySelector(`[data-wheel="${bool.field_key}"]`), IGEN_MINDEGY.filter((o) => o.value));
  }

  const emptyByName = {
    ar_tol: "Min. ár",
    ar_ig: "Max. ár",
    alapterulet_tol: "Min. m²",
    alapterulet_ig: "Max. m²",
    szobaszam: "Szobaszám",
  };
  form.querySelectorAll("[data-wheel]").forEach((wheel) => {
    const name = wheel.getAttribute("data-wheel") || "";
    const isPrice = name === "ar_tol" || name === "ar_ig";
    const isArea = name === "alapterulet_tol" || name === "alapterulet_ig";
    const isRooms = name === "szobaszam";
    initMenuWheel(wheel, {
      emptyLabel: emptyByName[name] || "Mindegy",
      multiple: MULTI_WHEEL_KEYS.has(name),
      customInput: isPrice || isArea || isRooms,
      customKind: isArea ? "area" : isRooms ? "rooms" : "price",
    });
  });

  const uzletag = form.querySelector("#immo-uzletag");
  if (uzletag) {
    uzletag.innerHTML = "";
    for (const opt of INGATLAN_UZLETAG) {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      uzletag.appendChild(el);
    }
    uzletag.value = "berbe";
  }

  const morePanel = document.getElementById("immo-more");
  const moreBtn = document.getElementById("immo-tovabbi");

  function setMoreOpen(open) {
    if (!morePanel || !moreBtn) return;
    morePanel.hidden = !open;
    moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
    moreBtn.textContent = open ? "Kevesebb feltétel" : "További feltételek";
  }

  moreBtn?.addEventListener("click", () => {
    setMoreOpen(!!morePanel?.hidden);
  });

  form.querySelector('[data-wheel="ingatlan_lakas_tipus"]')?.addEventListener("immo-wheel-change", () => {
    syncRovidMenus(form);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSearch(readForm(form));
    document.getElementById("home-grid-track")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      form.querySelectorAll("[data-wheel]").forEach((wheel) => setWheelValue(wheel, ""));
      const hely = form.querySelector('[name="keresesi_hely"]');
      if (hely) hely.value = "";
      if (uzletag) uzletag.value = "berbe";
      syncRovidMenus(form);
      setMoreOpen(false);
      onSearch(emptyIngatlanFilters());
    });
  });

  setMoreOpen(false);
  syncRovidMenus(form);
}
