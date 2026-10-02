/** Kereskedői értékbecslő — csak személyautó, csak katalógus mezők. */

import { fetchVehicleCatalog, fetchModelTypes } from "./vehicle-catalog-client.js?v=ertek1";
import { parseKmDigits } from "./km-input.js?v=30e4feeab0";

const DEBOUNCE_MS = 350;

function el(sel, root = document) {
  return root.querySelector(sel);
}

function fillSelect(select, items, { empty = "—" } = {}) {
  if (!select) return;
  const prev = select.value;
  select.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = empty;
  select.appendChild(opt0);
  for (const item of items) {
    const value = typeof item === "string" ? item : item.value;
    const label = typeof item === "string" ? item : item.label;
    if (!value) continue;
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    select.appendChild(o);
  }
  if (prev && [...select.options].some((o) => o.value === prev)) {
    select.value = prev;
  } else {
    select.value = "";
  }
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function initErtekbecsloPanel(root = document) {
  const panel = el('[data-mm-panel="ertekbecslo"]', root) || el("[data-ertekbecslo]", root);
  if (!panel || panel.dataset.ertekReady === "1") return;
  panel.dataset.ertekReady = "1";

  const brandSel = el("[data-ertek-gyartmany]", panel);
  const modelSel = el("[data-ertek-modell]", panel);
  const typeSel = el("[data-ertek-tipus]", panel);
  const yearSel = el("[data-ertek-ev]", panel);
  const kmInput = el("[data-ertek-km]", panel);
  const out = el("[data-ertek-out]", panel);
  const status = el("[data-ertek-status]", panel);

  if (!brandSel || !modelSel || !yearSel || !kmInput || !out) return;

  let catalog = null;
  let timer = null;

  try {
    if (status) status.textContent = "Katalógus betöltése…";
    catalog = await fetchVehicleCatalog({ kind: "szemelyauto" });
    fillSelect(brandSel, catalog.gyartmanyok || [], { empty: "Gyártmány" });
    fillSelect(modelSel, [], { empty: "Modell" });
    fillSelect(typeSel, [], { empty: "Típus (opcionális)" });
    fillSelect(yearSel, yearOptions(), { empty: "Évjárat" });
    if (status) status.textContent = "";
  } catch (err) {
    if (status) status.textContent = err?.message || "Katalógus nem elérhető.";
    return;
  }

  async function refreshModels() {
    const brand = brandSel.value;
    const models = brand ? catalog.modellek?.[brand] || [] : [];
    fillSelect(modelSel, models, { empty: "Modell" });
    fillSelect(typeSel, [], { empty: "Típus (opcionális)" });
    fillSelect(yearSel, yearOptions(), { empty: "Évjárat" });
  }

  async function refreshTypesAndYears() {
    const brand = brandSel.value;
    const modell = modelSel.value;
    if (!brand || !modell) {
      fillSelect(typeSel, [], { empty: "Típus (opcionális)" });
      fillSelect(yearSel, yearOptions(), { empty: "Évjárat" });
      return;
    }
    try {
      const data = await fetchModelTypes(brand, modell, { kind: "szemelyauto" });
      fillSelect(typeSel, data?.tipusok || [], { empty: "Típus (opcionális)" });
      fillSelect(yearSel, yearOptions(data?.evek), { empty: "Évjárat" });
    } catch {
      fillSelect(typeSel, [], { empty: "Típus (opcionális)" });
      fillSelect(yearSel, yearOptions(), { empty: "Évjárat" });
    }
  }

  async function estimate() {
    const gyartmany = brandSel.value.trim();
    const modell = modelSel.value.trim();
    const tipus = typeSel?.value?.trim() || "";
    const gyartasi_ev = yearSel.value.trim();
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

    try {
      const res = await fetch(`/api/valuation/estimate?${q}`, { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && data.error) {
        out.innerHTML = formatResult(data);
        return;
      }
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

  brandSel.addEventListener("change", () => {
    void refreshModels().then(schedule);
  });
  modelSel.addEventListener("change", () => {
    void refreshTypesAndYears().then(schedule);
  });
  typeSel?.addEventListener("change", schedule);
  yearSel.addEventListener("change", schedule);
  kmInput.addEventListener("input", schedule);
}
