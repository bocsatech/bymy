/** Értékbecslő — a feladás teljes asztali menürendszere + piaci sáv. */

import { parseKmDigits } from "./km-input.js?v=30e4feeab0";

const DEBOUNCE_MS = 350;

const DETAIL_FIELDS = [
  "tipus",
  "uzemanyag",
  "kivitel",
  "allapot",
  "okmany_jelleg",
  "sebessegvalto",
  "hajtas",
  "szin",
  "klima",
  "ajtok",
  "hengerurtartalom",
  "teljesitmeny_le",
  "teljesitmeny_kw",
];

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
      <p class="ertek-result__label">Becsült piaci érték</p>
      <p class="ertek-result__price">${escapeHtml(recom)}</p>
      <p class="ertek-result__band">Jó ár: <strong>${escapeHtml(from)}</strong> – <strong>${escapeHtml(to)}</strong></p>
      <p class="ertek-result__meta">${n} hasonló a mintában${data.source ? ` · ${escapeHtml(data.source)}` : ""}</p>
    </div>`;
}

export async function initErtekbecsloPanel(root = document) {
  const panel = el('[data-mm-panel="ertekbecslo"]', root) || el("[data-ertekbecslo]", root);
  if (!panel || panel.dataset.ertekReady === "1") return;
  panel.dataset.ertekReady = "1";

  const form = el("[data-ertek-form]", panel) || el("#ad-form", panel);
  const kmInput = el("#km", panel) || el("[data-ertek-km]", panel);
  const out = el("[data-ertek-out]", root) || el("[data-ertek-out]", panel);
  if (!form || !kmInput || !out) return;

  if (document.body?.getAttribute("data-site-page") === "ertekbecsles") {
    document.body.classList.add("ad-form-desk-active");
  }

  let timer = null;

  async function estimate() {
    const gyartmany = fieldValue(form, "gyartmany");
    const modell = fieldValue(form, "modell");
    const gyartasi_ev = fieldValue(form, "gyartasi_ev");
    const km = parseKmDigits(kmInput.value || "") || "";
    if (!gyartmany || !modell || !gyartasi_ev || !km) {
      out.innerHTML = "";
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
    for (const id of DETAIL_FIELDS) {
      const value = fieldValue(form, id);
      if (value) q.set(id, value);
    }
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

  form.addEventListener("change", schedule);
  form.addEventListener("immo-wheel-change", schedule);
  kmInput.addEventListener("input", schedule);
}
