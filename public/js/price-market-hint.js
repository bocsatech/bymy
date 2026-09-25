/** Vételár melletti piaci árjelző (sávok + Kevés / Jó ár / Sok). */
import { parsePriceDigits } from "./price-input.js?v=priceFmt1";

const DEBOUNCE_MS = 400;

function el(id) {
  return document.getElementById(id);
}

/** BM picker: érték gyakran a hidden inputban van (JSON tömb vagy plain). */
function fieldValue(id) {
  const select = el(id);
  if (!select) return "";
  const hidden = select._adBmHidden;
  if (hidden?.value != null && String(hidden.value).trim() !== "") {
    const raw = String(hidden.value).trim();
    if (raw.startsWith("[")) {
      try {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length) return String(list[0] ?? "").trim();
      } catch {
        /* fall through */
      }
    }
    return raw;
  }
  if (select.name) {
    const named = select.form?.elements?.namedItem(select.name) || select.form?.elements?.namedItem(id);
    if (named && named !== select && "value" in named && String(named.value || "").trim()) {
      const raw = String(named.value).trim();
      if (raw.startsWith("[")) {
        try {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length) return String(list[0] ?? "").trim();
        } catch {
          /* ignore */
        }
      }
      return raw;
    }
  }
  return String(select.value || "").trim();
}

function readParams() {
  return {
    gyartmany: fieldValue("gyartmany"),
    modell: fieldValue("modell"),
    tipus: fieldValue("tipus") || fieldValue("egyeb_tipus"),
    gyartasi_ev: fieldValue("gyartasi_ev"),
    km: parsePriceDigits(el("km")?.value || "") || "",
    ar: parsePriceDigits(el("vetelar")?.value || "") || "",
  };
}

function ensureHintEl() {
  let root = el("price-market-hint");
  const input = el("vetelar");
  if (!input) return null;

  let wrap = input.closest(".vetelar-market-wrap");
  if (!wrap) {
    const suffix = input.closest(".suffix-field");
    const host = suffix?.parentElement;
    if (!suffix || !host) return root;
    wrap = document.createElement("div");
    wrap.className = "vetelar-market-wrap";
    host.insertBefore(wrap, suffix);
    wrap.appendChild(suffix);
  }

  if (!root) {
    root = document.createElement("div");
    root.id = "price-market-hint";
    root.className = "price-market-hint";
    root.hidden = true;
    root.setAttribute("aria-live", "polite");
    root.innerHTML =
      '<span class="price-market-bars" data-level="0" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
      '<span class="price-market-label"></span>';
  }
  if (!wrap.contains(root)) wrap.appendChild(root);
  return root;
}

function setHint(state) {
  const root = ensureHintEl();
  if (!root) return;
  const label = root.querySelector(".price-market-label");
  const bars = root.querySelector(".price-market-bars");
  if (!state?.opinion || !state.bars) {
    root.hidden = true;
    root.removeAttribute("data-opinion");
    if (bars) bars.dataset.level = "0";
    if (label) label.textContent = "";
    return;
  }
  root.hidden = false;
  root.dataset.opinion = state.opinion;
  if (bars) bars.dataset.level = String(state.bars);
  if (label) {
    label.textContent =
      state.opinion === "jó ár" ? "Jó ár" : state.opinion === "kevés" ? "Kevés" : "Sok";
  }
}

export function initPriceMarketHint(form = document.getElementById("ad-form")) {
  if (!form || form.dataset.priceMarketHint === "1") return;
  form.dataset.priceMarketHint = "1";
  ensureHintEl();

  let timer = 0;
  let lastKey = "";
  let seq = 0;

  async function refresh() {
    ensureHintEl();
    const p = readParams();
    if (!p.gyartmany || !p.modell || !p.ar) {
      setHint(null);
      return;
    }
    const key = `${p.gyartmany}|${p.modell}|${p.tipus}|${p.gyartasi_ev}|${p.km}|${p.ar}`;
    if (key === lastKey) return;
    lastKey = key;
    const my = ++seq;

    const qs = new URLSearchParams({
      gyartmany: p.gyartmany,
      modell: p.modell,
      tipus: p.tipus,
      gyartasi_ev: p.gyartasi_ev,
      km: String(p.km || ""),
      ar: String(p.ar),
      source: "market",
    });

    try {
      const res = await fetch(`/api/valuation/estimate?${qs}`, { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (my !== seq) return;
      if (!res.ok || data.error || !data.count || !data.opinion) {
        setHint(null);
        return;
      }
      setHint(data);
    } catch {
      if (my === seq) setHint(null);
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(refresh, DEBOUNCE_MS);
  }

  form.addEventListener("input", schedule);
  form.addEventListener("change", schedule);
  window.addEventListener("ad-form-ready", schedule);
  window.addEventListener("ad-form-layout-refresh", () => {
    ensureHintEl();
    lastKey = "";
    schedule();
  });
  window.addEventListener("ad-form-bm-ready", () => {
    lastKey = "";
    schedule();
  });

  schedule();
}
