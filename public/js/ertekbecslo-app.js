/** Kereskedői értékbecslő — ugyanaz a dobkerék, mint az autókeresőn (mountAutoSearchDrums). */

import { fetchModelTypes } from "./vehicle-catalog-client.js?v=ertek4";
import { parseKmDigits } from "./km-input.js?v=30e4feeab0";
import { flattenUzemanyagOptions } from "./equipment-data.js?v=ertek4";
import {
  mountAutoSearchDrums,
  readAutoDrumFilterValues,
} from "./auto-search-drums.js?v=ertek7";
import { fillWheel, setWheelValue, readWheel } from "./ingatlan-wheels.js?v=6952ba469c";
import { syncDrumWheelDisplay } from "./immo-drum-picker.js?v=c4c7ac29a2";

const DEBOUNCE_MS = 350;

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

function yearList(fromApi) {
  if (Array.isArray(fromApi) && fromApi.length) {
    return fromApi.map((y) => String(y)).sort((a, b) => Number(b) - Number(a));
  }
  const now = new Date().getFullYear();
  const out = [];
  for (let y = now; y >= 1985; y--) out.push(String(y));
  return out;
}

function fillSelectYears(select, years) {
  if (!select) return;
  const prev = select.value;
  select.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Évjárat";
  select.appendChild(empty);
  for (const y of years) {
    const o = document.createElement("option");
    o.value = y;
    o.textContent = y;
    select.appendChild(o);
  }
  if (prev && [...select.options].some((o) => o.value === prev)) select.value = prev;
}

function fillSelectFuel(select) {
  if (!select || select.options.length > 1) return;
  for (const v of flattenUzemanyagOptions()) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  }
}

function ensureLink(href, marker) {
  if (document.querySelector(`link[${marker}]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute(marker, "1");
  document.head.appendChild(link);
}

function ensureDrumCss() {
  ensureLink("/css/ingatlan-search.css?v=ertekDrum7", "data-ertek-immo-css");
  ensureLink("/css/auto-hero.css?v=ertekDrum7", "data-ertek-hero-css");
  ensureLink("/css/auto-desk-layout.css?v=ertekDrum7", "data-ertek-desk-css");
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

function readErtekFilters(form) {
  const drums = readAutoDrumFilterValues(form) || {};
  const brandList = drums.gyartmanyok || (drums.gyartmany ? [drums.gyartmany] : []);
  const modelList = drums.modellek || (drums.modell ? [drums.modell] : []);
  const fuelList = drums.uzemanyagok || (drums.uzemanyag ? [drums.uzemanyag] : []);
  const tipusWheel = form.querySelector('[data-wheel="tipus"]');
  const yearWheel = form.querySelector('[data-wheel="gyartasi_ev"]');
  return {
    gyartmany: brandList[0] || String(readWheel(form.querySelector('[data-wheel="gyartmany"]')) || "").trim(),
    modell: modelList[0] || String(readWheel(form.querySelector('[data-wheel="modell"]')) || "").trim(),
    tipus: String(readWheel(tipusWheel) || drums.tipus || "").trim(),
    uzemanyag: fuelList[0] || "",
    gyartasi_ev: String(readWheel(yearWheel) || drums.gyartasi_ev || "").trim(),
  };
}

function refillWheel(form, wheelName, values, emptyLabel) {
  const wheel = form.querySelector(`[data-wheel="${wheelName}"]`);
  if (!wheel) return;
  const opts = (values || []).map((v) =>
    typeof v === "string" ? { value: v, label: v } : { value: v.value, label: v.label || v.value }
  );
  const cur = String(readWheel(wheel) || "");
  fillWheel(wheel, opts, { emptyLabel });
  if (cur && opts.some((o) => o.value === cur)) setWheelValue(wheel, cur);
  else setWheelValue(wheel, "");
  syncDrumWheelDisplay(wheel);
  const wrap = wheel.closest(".immo-wheel-wrap");
  wrap?._desktopCellDrum?.refresh?.("");
}

export async function initErtekbecsloPanel(root = document) {
  const panel = el('[data-mm-panel="ertekbecslo"]', root) || el("[data-ertekbecslo]", root);
  if (!panel || panel.dataset.ertekReady === "1") return;
  panel.dataset.ertekReady = "1";
  ensureDrumCss();

  const form = el("[data-ertek-form]", panel);
  const kmInput = el("[data-ertek-km]", panel);
  const out = el("[data-ertek-out]", panel);
  const status = el("[data-ertek-status]", panel);
  if (!form || !kmInput || !out) return;

  fillSelectFuel(form.querySelector('[data-filter-key="uzemanyag"]'));
  fillSelectYears(form.querySelector("[data-ertek-year]"), yearList());

  if (status) status.textContent = "Menü betöltése…";
  try {
    const ok = await mountAutoSearchDrums(form);
    if (!ok && form.dataset.drumsMounted !== "1") {
      throw new Error("A keresőmenü nem indult el.");
    }
    if (status) status.textContent = "";
  } catch (err) {
    if (status) status.textContent = err?.message || "Menü nem elérhető.";
    return;
  }

  let timer = null;

  async function refreshTypesAndYears() {
    const { gyartmany, modell } = readErtekFilters(form);
    if (!gyartmany || !modell) {
      refillWheel(form, "tipus", [], "Típus (opcionális)");
      refillWheel(form, "gyartasi_ev", yearList(), "Évjárat");
      return;
    }
    try {
      const data = await fetchModelTypes(gyartmany, modell, { kind: "szemelyauto" });
      refillWheel(form, "tipus", data?.tipusok || [], "Típus (opcionális)");
      refillWheel(form, "gyartasi_ev", yearList(data?.evek), "Évjárat");
    } catch {
      refillWheel(form, "tipus", [], "Típus (opcionális)");
      refillWheel(form, "gyartasi_ev", yearList(), "Évjárat");
    }
  }

  async function estimate() {
    const f = readErtekFilters(form);
    const km = parseKmDigits(kmInput.value || "") || "";
    if (!f.gyartmany || !f.modell || !f.gyartasi_ev || !km) {
      out.innerHTML =
        '<p class="ertek-msg">Kötelező: gyártmány, modell, évjárat, km.</p>';
      return;
    }
    out.innerHTML = '<p class="ertek-msg">Számolás…</p>';
    const q = new URLSearchParams({
      gyartmany: f.gyartmany,
      modell: f.modell,
      gyartasi_ev: f.gyartasi_ev,
      km: String(km),
      require: "1",
      source: "market",
    });
    if (f.tipus) q.set("tipus", f.tipus);
    if (f.uzemanyag) q.set("uzemanyag", f.uzemanyag);
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

  form.addEventListener("immo-wheel-change", (event) => {
    const wheel = event.target?.closest?.("[data-wheel]") || event.target;
    const key = wheel?.getAttribute?.("data-wheel") || wheel?.getAttribute?.("data-filter-key") || "";
    if (key === "gyartmany" || key === "modell") {
      void refreshTypesAndYears().then(schedule);
      return;
    }
    schedule();
  });
  form.addEventListener("change", schedule);
  kmInput.addEventListener("input", schedule);
}
