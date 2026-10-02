/** Kereskedői értékbecslő — autókereső-szerű mezők + üzemanyag. */

import { fetchVehicleCatalog, fetchModelTypes } from "./vehicle-catalog-client.js?v=ertek2";
import { parseKmDigits } from "./km-input.js?v=30e4feeab0";
import { UZEMANYAG_CATEGORIES } from "./equipment-data.js?v=ertek2";

const DEBOUNCE_MS = 350;
const EMPTY = {
  gyartmany: "Gyártmány",
  modell: "Modell",
  tipus: "Típus (opcionális)",
  uzemanyag: "Üzemanyag (opcionális)",
  ev: "Évjárat",
};

function el(sel, root = document) {
  return root.querySelector(sel);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function yearOptions(fromApi) {
  if (Array.isArray(fromApi) && fromApi.length) {
    return fromApi.map((y) => String(y)).sort((a, b) => Number(b) - Number(a));
  }
  const now = new Date().getFullYear();
  const out = [];
  for (let y = now; y >= 1985; y--) out.push(String(y));
  return out;
}

function toItems(list, { emptyLabel } = {}) {
  const items = [];
  if (emptyLabel != null) items.push({ value: "", label: emptyLabel });
  for (const item of list || []) {
    if (typeof item === "string") {
      if (!item) continue;
      items.push({ value: item, label: item });
    } else if (item?.value != null) {
      items.push({ value: String(item.value), label: String(item.label || item.value) });
    }
  }
  return items;
}

function fuelMainItems() {
  return [
    { value: "", label: EMPTY.uzemanyag },
    ...UZEMANYAG_CATEGORIES.map((cat) => ({
      value: cat.value || cat.id,
      label: cat.label,
    })),
  ];
}

function fuelChildren(value) {
  const cat = UZEMANYAG_CATEGORIES.find((c) => (c.value || c.id) === value);
  if (!cat?.children?.length) return null;
  return cat.children.map((c) => ({ value: c.value, label: c.label }));
}

function formatResult(data) {
  if (!data) return "";
  if (data.error) return `<p class="ertek-msg ertek-msg--err">${escapeHtml(data.error)}</p>`;
  if (data.count === 0) {
    return `<p class="ertek-msg">${escapeHtml(data.message || "Nincs egyező adat a mintában.")}</p>`;
  }
  const recom = data.recommended_formatted || data.average_price_formatted || "—";
  const from = data.good_price_from_formatted || data.min_price_formatted || "—";
  const to = data.good_price_to_formatted || data.max_price_formatted || "—";
  const n = data.count ?? 0;
  return `
    <div class="ertek-result" aria-live="polite">
      <p class="ertek-result__price">${escapeHtml(recom)}</p>
      <p class="ertek-result__band">Jó ár: <strong>${escapeHtml(from)}</strong> – <strong>${escapeHtml(to)}</strong></p>
      <p class="ertek-result__meta">${n} hasonló a mintában${data.source ? ` · ${escapeHtml(data.source)}` : ""}</p>
    </div>`;
}

function ensureDrumCss() {
  if (document.querySelector('link[data-ertek-drum-css]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/css/auto-hero.css?v=ertekDrum1";
  link.dataset.ertekDrumCss = "1";
  document.head.appendChild(link);
}

function setField(panel, key, value, label) {
  const input = el(`[data-ertek-${key}]`, panel);
  const summary = el(`[data-ertek-summary="${key}"]`, panel);
  if (input) input.value = value || "";
  if (summary) {
    summary.textContent = value ? label || value : EMPTY[key] || "—";
    summary.classList.toggle("is-empty", !value);
  }
}

function readField(panel, key) {
  return String(el(`[data-ertek-${key}]`, panel)?.value || "").trim();
}

export async function initErtekbecsloPanel(root = document) {
  const panel = el('[data-mm-panel="ertekbecslo"]', root) || el("[data-ertekbecslo]", root);
  if (!panel || panel.dataset.ertekReady === "1") return;
  panel.dataset.ertekReady = "1";
  ensureDrumCss();

  const kmInput = el("[data-ertek-km]", panel);
  const out = el("[data-ertek-out]", panel);
  const status = el("[data-ertek-status]", panel);
  if (!kmInput || !out) return;

  let catalog = null;
  let typeItems = [];
  let yearItems = toItems(yearOptions(), { emptyLabel: EMPTY.ev });
  let timer = null;
  let openStandaloneSwitchSheet = null;

  try {
    if (status) status.textContent = "Katalógus betöltése…";
    catalog = await fetchVehicleCatalog({ kind: "szemelyauto" });
    if (status) status.textContent = "";
  } catch (err) {
    if (status) status.textContent = err?.message || "Katalógus nem elérhető.";
    return;
  }

  try {
    ({ openStandaloneSwitchSheet } = await import("./auto-drum-sheet.js?v=ertekDrum1"));
  } catch (err) {
    console.warn("Értékbecslő sheet:", err);
  }

  function brandItems() {
    return toItems([...(catalog.gyartmanyok || [])].sort((a, b) => a.localeCompare(b, "hu")), {
      emptyLabel: EMPTY.gyartmany,
    });
  }

  function modelItems(brand) {
    const models = brand ? catalog.modellek?.[brand] || [] : [];
    return toItems(models, { emptyLabel: EMPTY.modell });
  }

  async function refreshTypesAndYears() {
    const brand = readField(panel, "gyartmany");
    const modell = readField(panel, "modell");
    if (!brand || !modell) {
      typeItems = toItems([], { emptyLabel: EMPTY.tipus });
      yearItems = toItems(yearOptions(), { emptyLabel: EMPTY.ev });
      return;
    }
    try {
      const data = await fetchModelTypes(brand, modell, { kind: "szemelyauto" });
      typeItems = toItems(data?.tipusok || [], { emptyLabel: EMPTY.tipus });
      yearItems = toItems(yearOptions(data?.evek), { emptyLabel: EMPTY.ev });
    } catch {
      typeItems = toItems([], { emptyLabel: EMPTY.tipus });
      yearItems = toItems(yearOptions(), { emptyLabel: EMPTY.ev });
    }
  }

  async function estimate() {
    const gyartmany = readField(panel, "gyartmany");
    const modell = readField(panel, "modell");
    const tipus = readField(panel, "tipus");
    const uzemanyag = readField(panel, "uzemanyag");
    const gyartasi_ev = readField(panel, "ev");
    const km = parseKmDigits(kmInput.value || "") || "";

    if (!gyartmany || !modell || !gyartasi_ev || !km) {
      out.innerHTML =
        '<p class="ertek-msg">Kötelező: gyártmány, modell, évjárat, km.</p>';
      return;
    }

    out.innerHTML = '<p class="ertek-msg">Számolás…</p>';
    const q = new URLSearchParams({
      gyartmany,
      modell,
      gyartasi_ev,
      km: String(km),
      require: "1",
      source: "market",
    });
    if (tipus) q.set("tipus", tipus);
    if (uzemanyag) q.set("uzemanyag", uzemanyag);

    try {
      const res = await fetch(`/api/valuation/estimate?${q}`, { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      out.innerHTML = formatResult(data);
    } catch (err) {
      out.innerHTML = `<p class="ertek-msg ertek-msg--err">${escapeHtml(err?.message || "Hiba")}</p>`;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void estimate();
    }, DEBOUNCE_MS);
  }

  async function openField(key) {
    const trigger = el(`[data-ertek-open="${key}"]`, panel);
    if (!trigger || !openStandaloneSwitchSheet) return;

    let items = [];
    let getChildren = null;
    let title = EMPTY[key] || key;

    if (key === "gyartmany") {
      items = brandItems();
      title = "Gyártmány";
    } else if (key === "modell") {
      const brand = readField(panel, "gyartmany");
      if (!brand) {
        out.innerHTML = '<p class="ertek-msg">Előbb válassz gyártmányt.</p>';
        return;
      }
      items = modelItems(brand);
      title = "Modell";
    } else if (key === "tipus") {
      await refreshTypesAndYears();
      items = typeItems;
      title = "Típus";
    } else if (key === "uzemanyag") {
      items = fuelMainItems();
      getChildren = fuelChildren;
      title = "Üzemanyag";
    } else if (key === "ev") {
      await refreshTypesAndYears();
      items = yearItems;
      title = "Évjárat";
    }

    openStandaloneSwitchSheet({
      trigger,
      title,
      emptyLabel: EMPTY[key] || "—",
      items,
      initialSelected: [readField(panel, key)].filter(Boolean),
      singleSelect: true,
      getChildren,
      onDone: (selected) => {
        const value = Array.isArray(selected) ? selected[0] || "" : String(selected || "");
        const label =
          items.find((it) => it.value === value)?.label ||
          (getChildren
            ? UZEMANYAG_CATEGORIES.flatMap((c) => c.children || [c]).find((c) => c.value === value)
                ?.label
            : null) ||
          value;
        setField(panel, key, value, label);

        if (key === "gyartmany") {
          setField(panel, "modell", "");
          setField(panel, "tipus", "");
          setField(panel, "ev", "");
        } else if (key === "modell") {
          setField(panel, "tipus", "");
          setField(panel, "ev", "");
          void refreshTypesAndYears();
        }
        schedule();
      },
    });
  }

  panel.querySelectorAll("[data-ertek-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      void openField(btn.getAttribute("data-ertek-open") || "");
    });
  });
  kmInput.addEventListener("input", schedule);

  Object.keys(EMPTY).forEach((key) => setField(panel, key, ""));
}
