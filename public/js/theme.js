/**
 * Világos / sötét színmód — localStorage + data-theme a <html>-en.
 */
const STORAGE_KEY = "bymy-theme";

function preferredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  try {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {
    /* ignore */
  }
  return "light";
}

export function getTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return preferredTheme();
}

export function setTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  syncToggleUi();
  window.dispatchEvent(new CustomEvent("bymy-theme-changed", { detail: { theme: next } }));
}

export function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

function syncToggleUi() {
  const theme = getTheme();
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    btn.setAttribute(
      "title",
      theme === "dark" ? "Váltás világos módra" : "Váltás sötét módra"
    );
    btn.setAttribute(
      "aria-label",
      theme === "dark" ? "Váltás világos módra" : "Váltás sötét módra"
    );
  });
}

export function initTheme() {
  setTheme(getTheme());
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    if (btn.dataset.themeBound === "1") return;
    btn.dataset.themeBound = "1";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      toggleTheme();
    });
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
  } else {
    initTheme();
  }
}
