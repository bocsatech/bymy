/** Vételár melletti piaci árjelző (sávok + Kevés / Jó ár / Sok). */
import { parsePriceDigits } from "./price-input.js?v=priceFmt1";

const DEBOUNCE_MS = 450;

function el(id) {
  return document.getElementById(id);
}

function tipQuery() {
  const parts = [el("gyartmany")?.value, el("modell")?.value, el("tipus")?.value]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  return parts;
}

function readParams() {
  const [gyartmany, modell, tipus] = tipQuery();
  return {
    gyartmany: gyartmany || "",
    modell: modell || "",
    tipus: tipus || "",
    gyartasi_ev: el("gyartasi_ev")?.value || "",
    km: parsePriceDigits(el("km")?.value || "") || "",
    ar: parsePriceDigits(el("vetelar")?.value || "") || "",
  };
}

function setHint(state) {
  const root = el("price-market-hint");
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

  let timer = 0;
  let lastKey = "";

  async function refresh() {
    const p = readParams();
    if (!p.gyartmany || !p.modell || !p.ar) {
      setHint(null);
      return;
    }
    const key = `${p.gyartmany}|${p.modell}|${p.tipus}|${p.gyartasi_ev}|${p.km}|${p.ar}`;
    if (key === lastKey) return;
    lastKey = key;

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
      const data = await res.json();
      if (!res.ok || data.error || !data.count) {
        setHint(null);
        return;
      }
      setHint(data);
    } catch {
      setHint(null);
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(refresh, DEBOUNCE_MS);
  }

  for (const id of ["vetelar", "km", "gyartasi_ev", "gyartmany", "modell", "tipus"]) {
    const node = el(id);
    if (!node) continue;
    node.addEventListener("input", schedule);
    node.addEventListener("change", schedule);
  }

  schedule();
}
