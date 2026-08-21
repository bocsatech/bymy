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
} from "./ingatlan-fields.js?v=immo1";

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
    ingatlan_uzletag: "berles",
    keresesi_hely: "",
    ar_tol: null,
    ar_ig: null,
    ar_ft_min: null,
    alapterulet: null,
    szobaszam: null,
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
      const uz = fieldBag(item, "ingatlan_uzletag");
      if (uz && uz !== f.ingatlan_uzletag) return false;
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

    if (f.alapterulet != null) {
      const area = numOrNull(fieldBag(item, "alapterulet"));
      if (area != null && area < f.alapterulet) return false;
    }

    if (f.szobaszam != null) {
      const rooms = numOrNull(fieldBag(item, "szobaszam"));
      if (rooms != null && rooms < f.szobaszam) return false;
    }

    for (const key of EXACT_KEYS) {
      const want = f[key];
      if (!want) continue;
      if (INGATLAN_BOOL_FIELDS.some((b) => b.field_key === key)) {
        if (!isTruthyIgen(fieldBag(item, key))) return false;
        continue;
      }
      const got = fieldBag(item, key);
      if (got && got !== want) return false;
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

function fillWheel(root, options, { emptyLabel = "Mindegy", includeEmpty = true } = {}) {
  if (!root) return;
  const list = includeEmpty ? [{ value: "", label: emptyLabel }, ...options.filter((o) => o.value !== "")] : options;
  root.innerHTML = list
    .map(
      (opt) =>
        `<button type="button" class="immo-wheel-opt" role="option" data-value="${escapeAttr(opt.value)}">${escapeHtml(
          opt.label
        )}</button>`
    )
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function setWheelValue(wheel, value) {
  if (!wheel) return;
  const want = value == null ? "" : String(value);
  wheel.querySelectorAll(".immo-wheel-opt").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.value === want);
  });
  const active = wheel.querySelector(".immo-wheel-opt.is-active");
  active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  const hidden = wheel.parentElement?.querySelector('input[type="hidden"]');
  if (hidden) hidden.value = want;
}

function readWheel(wheel) {
  const active = wheel?.querySelector(".immo-wheel-opt.is-active");
  if (active) return active.dataset.value ?? "";
  const hidden = wheel?.parentElement?.querySelector('input[type="hidden"]');
  return hidden?.value ?? "";
}

function initWheel(wheel) {
  if (!wheel || wheel.dataset.bound === "1") return;
  wheel.dataset.bound = "1";
  wheel.addEventListener("click", (event) => {
    const btn = event.target.closest(".immo-wheel-opt");
    if (!btn || !wheel.contains(btn)) return;
    setWheelValue(wheel, btn.dataset.value ?? "");
  });
  if (!wheel.querySelector(".immo-wheel-opt.is-active")) {
    const first = wheel.querySelector(".immo-wheel-opt");
    if (first) setWheelValue(wheel, first.dataset.value ?? "");
  }
}

function readForm(form) {
  const out = emptyIngatlanFilters();
  out.ingatlan_uzletag = form.querySelector("#immo-uzletag")?.value || "berles";
  out.keresesi_hely = form.querySelector("#immo-hely")?.value?.trim() || "";
  out.ar_tol = numOrNull(readWheel(form.querySelector('[data-wheel="ar_tol"]')));
  out.ar_ig = numOrNull(readWheel(form.querySelector('[data-wheel="ar_ig"]')));
  out.alapterulet = numOrNull(readWheel(form.querySelector('[data-wheel="alapterulet"]')));
  out.szobaszam = numOrNull(readWheel(form.querySelector('[data-wheel="szobaszam"]')));
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

function syncRovidMenus(form) {
  const tipus = readWheel(form.querySelector('[data-wheel="ingatlan_lakas_tipus"]'));
  const rovid = tipus === "rovid_berles";
  const berleti = form.querySelector('[data-wheel="min_berleti_ido"]');
  const koltoz = form.querySelector('[data-wheel="koltozheto"]');
  const prevBerleti = readWheel(berleti);
  const prevKoltoz = readWheel(koltoz);
  fillWheel(berleti, rovid ? MIN_BERLETI_IDO_ROVID.filter((o) => o.value) : MIN_BERLETI_IDO.filter((o) => o.value));
  fillWheel(koltoz, rovid ? KOLTOZHETO_ROVID.filter((o) => o.value) : KOLTOZHETO.filter((o) => o.value));
  initWheel(berleti);
  initWheel(koltoz);
  const berletiOpts = new Set([...(berleti?.querySelectorAll(".immo-wheel-opt") || [])].map((b) => b.dataset.value));
  const koltozOpts = new Set([...(koltoz?.querySelectorAll(".immo-wheel-opt") || [])].map((b) => b.dataset.value));
  setWheelValue(berleti, berletiOpts.has(prevBerleti) ? prevBerleti : "");
  setWheelValue(koltoz, koltozOpts.has(prevKoltoz) ? prevKoltoz : "");
}

export function initIngatlanSearch({ onSearch = () => {} } = {}) {
  const form = document.getElementById("immo-search-form");
  if (!form) return;

  const millions = priceMillionOptions();
  fillWheel(form.querySelector('[data-wheel="ar_tol"]'), millions, { emptyLabel: "Min. ár" });
  fillWheel(form.querySelector('[data-wheel="ar_ig"]'), millions, { emptyLabel: "Max. ár" });
  fillWheel(form.querySelector('[data-wheel="alapterulet"]'), alapteruletOptions(), { emptyLabel: "Mindegy" });
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

  form.querySelectorAll("[data-wheel]").forEach(initWheel);

  const uzletag = form.querySelector("#immo-uzletag");
  if (uzletag && !uzletag.options.length) {
    for (const opt of INGATLAN_UZLETAG) {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      uzletag.appendChild(el);
    }
    uzletag.value = "berles";
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

  form.querySelector('[data-wheel="ingatlan_lakas_tipus"]')?.addEventListener("click", () => {
    requestAnimationFrame(() => syncRovidMenus(form));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSearch(readForm(form));
    document.getElementById("home-grid-track")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      form.querySelectorAll("[data-wheel]").forEach((wheel) => setWheelValue(wheel, ""));
      if (uzletag) uzletag.value = "berles";
      syncRovidMenus(form);
      setMoreOpen(false);
      onSearch(emptyIngatlanFilters());
    });
  });

  setMoreOpen(false);
  syncRovidMenus(form);
}
