const STORAGE_KEY = "bymy-text-scale";
const LEVELS = new Set(["100", "105", "110", "120"]);

function normalizeScale(value) {
  const raw = String(value || "").trim();
  return LEVELS.has(raw) ? raw : "100";
}

function preferredScale() {
  try {
    return normalizeScale(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "100";
  }
}

export function getTextScale() {
  const attr = document.documentElement.getAttribute("data-text-scale");
  if (LEVELS.has(attr)) return attr;
  return preferredScale();
}

export function setTextScale(scale) {
  const next = normalizeScale(scale);
  document.documentElement.setAttribute("data-text-scale", next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
  }
  syncScaleUi();
  window.dispatchEvent(new CustomEvent("bymy-text-scale-changed", { detail: { scale: next } }));
}

function syncScaleUi() {
  const scale = getTextScale();
  document.querySelectorAll("[data-text-scale-option]").forEach((btn) => {
    const value = normalizeScale(btn.getAttribute("data-text-scale-option"));
    const selected = value === scale;
    btn.setAttribute("aria-checked", selected ? "true" : "false");
    btn.classList.toggle("is-selected", selected);
  });
}

export function initTextScale() {
  setTextScale(getTextScale());
  document.querySelectorAll("[data-text-scale-option]").forEach((btn) => {
    if (btn.dataset.textScaleBound === "1") return;
    btn.dataset.textScaleBound = "1";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      setTextScale(btn.getAttribute("data-text-scale-option"));
    });
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTextScale);
  } else {
    initTextScale();
  }
}
