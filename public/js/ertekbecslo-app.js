/** Értékbecslő — ugyanaz a feladás asztali menürendszer (mountAdFormBmPickers). */

import { fetchModelTypes } from "./vehicle-catalog-client.js?v=ertekAd1";
import { parseKmDigits } from "./km-input.js?v=30e4feeab0";
import { flattenUzemanyagOptions } from "./equipment-data.js?v=ertekAd1";
import { mountAdFormBmPickers, refreshAdFormBmPickers } from "./ad-form-bm-pickers.js?v=ertekAd1";

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

function ensureLink(href, marker) {
  if (document.querySelector(`link[${marker}]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute(marker, "1");
  document.head.appendChild(link);
}

function ensureAdFormCss() {
  ensureLink("/css/ingatlan-search.css?v=ertekAd1", "data-ertek-immo-css");
  ensureLink("/css/ad-form-desk.css?v=ertekAd1", "data-ertek-desk-css");
  ensureLink("/css/ad-form-bm-pickers.css?v=ertekAd1", "data-ertek-bm-css");
  ensureLink("/css/automax.css?v=ertekAd1", "data-ertek-automax-css");
}

function fieldValue(form, id) {
  const node = form.querySelector(`#${id}`) || document.getElementById(id);
  if (!node) return "";
  const hidden = node._adBmHidden;
  return String(hidden?.value ?? node.value ?? "").trim();
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

function replaceSelectOptions(select, values, emptyLabel) {
  if (!select || select.tagName !== "SELECT") return;
  const prev = String(select.value || "").trim();
  select.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = emptyLabel;
  select.appendChild(empty);
  for (const raw of values || []) {
    const value = typeof raw === "string" ? raw : raw?.value;
    if (!value) continue;
    const o = document.createElement("option");
    o.value = value;
    o.textContent = typeof raw === "string" ? raw : raw.label || value;
    select.appendChild(o);
  }
  if (prev && [...select.options].some((o) => o.value === prev)) select.value = prev;
}

function snapshotForm(form) {
  return {
    gyartmany: fieldValue(form, "gyartmany"),
    modell: fieldValue(form, "modell"),
    tipus: fieldValue(form, "tipus"),
    uzemanyag: fieldValue(form, "uzemanyag"),
    gyartasi_ev: fieldValue(form, "gyartasi_ev"),
    gyartasi_honap: fieldValue(form, "gyartasi_honap"),
    km: el("#km", form)?.value || el("[data-ertek-km]", form)?.value || "",
  };
}

export async function initErtekbecsloPanel(root = document) {
  const panel = el('[data-mm-panel="ertekbecslo"]', root) || el("[data-ertekbecslo]", root);
  if (!panel || panel.dataset.ertekReady === "1") return;
  panel.dataset.ertekReady = "1";
  ensureAdFormCss();

  const form = el("[data-ertek-form]", panel);
  const kmInput = el("#km", panel) || el("[data-ertek-km]", panel);
  const out = el("[data-ertek-out]", panel);
  const status = el("[data-ertek-status]", panel);
  if (!form || !kmInput || !out) return;

  if (document.body?.getAttribute("data-site-page") === "ertekbecsles") {
    document.body.classList.add("ad-form-desk-active");
  }

  const fuel = form.querySelector("#uzemanyag");
  if (fuel && fuel.options.length <= 1) {
    for (const v of flattenUzemanyagOptions()) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      fuel.appendChild(o);
    }
  }

  if (status) status.textContent = "Menü betöltése…";
  try {
    await mountAdFormBmPickers(form);
    if (status) status.textContent = "";
  } catch (err) {
    if (status) status.textContent = err?.message || "Menü nem elérhető.";
    return;
  }

  let timer = null;
  let refreshingTypes = false;

  async function refreshTypes() {
    const gyartmany = fieldValue(form, "gyartmany");
    const modell = fieldValue(form, "modell");
    const tipus = form.querySelector("#tipus");
    if (!tipus) return;
    if (!gyartmany || !modell) {
      replaceSelectOptions(tipus, [], "Válasszon");
      return;
    }
    try {
      const data = await fetchModelTypes(gyartmany, modell, { kind: "szemelyauto" });
      replaceSelectOptions(tipus, data?.tipusok || [], "Válasszon");
    } catch {
      replaceSelectOptions(tipus, [], "Válasszon");
    }
    if (refreshingTypes) return;
    refreshingTypes = true;
    try {
      const snap = snapshotForm(form);
      form._bymyLastFormData = snap;
      await refreshAdFormBmPickers(form);
      if (snap.km) kmInput.value = snap.km;
      if (snap.tipus) {
        const tipus = form.querySelector("#tipus");
        if (tipus) {
          tipus.value = snap.tipus;
          tipus._adBmFillWheel?.(snap.tipus);
          tipus._adBmRefreshSummary?.();
        }
      }
    } finally {
      refreshingTypes = false;
    }
  }

  async function estimate() {
    const gyartmany = fieldValue(form, "gyartmany");
    const modell = fieldValue(form, "modell");
    const tipus = fieldValue(form, "tipus");
    const uzemanyag = fieldValue(form, "uzemanyag");
    const gyartasi_ev = fieldValue(form, "gyartasi_ev");
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

  form.addEventListener("change", (event) => {
    const id = event.target?.id || event.target?.getAttribute?.("name") || "";
    if (id === "gyartmany" || id === "modell") {
      void refreshTypes().then(schedule);
      return;
    }
    schedule();
  });
  form.addEventListener("immo-wheel-change", (event) => {
    const wheel = event.target?.closest?.("[data-wheel]") || event.target;
    const key = wheel?.getAttribute?.("data-wheel") || "";
    if (key === "gyartmany" || key === "modell") {
      void refreshTypes().then(schedule);
      return;
    }
    schedule();
  });
  kmInput.addEventListener("input", schedule);
}
