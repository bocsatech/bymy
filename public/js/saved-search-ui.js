
import { getAuthUser } from "./site-auth.js?v=savedSearch5";
import { addSavedSearch } from "./fok-data.js?v=savedSearch5";
import {
  buildSavedSearchUrl,
  normalizeSavedSearchFilters,
  summarizeSavedSearchFilters,
} from "./saved-search.js?v=savedSearch5";

function defaultSearchName(filters) {
  const summary = summarizeSavedSearchFilters(filters);
  if (summary) return summary.slice(0, 72);
  return "Mentett keresés";
}

async function saveCurrentSearch({ page, getFilters, whenReady, triggerEl }) {
    const user = getAuthUser();
    if (!user?.email) {
      const login = "/bejelentkezes.html?return=" + encodeURIComponent(window.location.pathname + window.location.search);
      if (window.confirm("A keresés mentéséhez jelentkezz be. Megnyitod a bejelentkezést?")) {
        window.location.href = login;
      }
      return;
    }

    try {
      await whenReady?.();
    } catch {
    }

    const raw = getFilters?.() ?? {};
    const filters = normalizeSavedSearchFilters(raw);
    if (!Object.keys(filters).length) {
      window.alert("Előbb állíts be legalább egy szűrőt.");
      return;
    }

    const suggested = defaultSearchName(filters);
    const name = window.prompt("Keresés neve:", suggested);
    if (name == null) return;
    const trimmed = String(name).trim();
    if (!trimmed) return;

    const href = buildSavedSearchUrl(page, filters);
    addSavedSearch(user.email, {
      name: trimmed,
      page,
      filters,
      query: summarizeSavedSearchFilters(filters),
      href,
      notify: false,
    });

    const defaultLabel = triggerEl?.dataset?.saveLabel || "Keresés mentése";
    triggerEl.textContent = "Mentve ✓";
    window.setTimeout(() => {
      triggerEl.textContent = defaultLabel;
    }, 2000);
}

export function initSavedSearchUi({ page = "auto", getFilters, whenReady } = {}) {
  const buttons = [
    ...document.querySelectorAll("#qs-save-search, #qs-save-search-bar, #qs-save-search-top"),
  ];
  if (!buttons.length) return;

  for (const btn of buttons) {
    if (btn.dataset.bound === "1") continue;
    btn.dataset.bound = "1";
    if (!btn.dataset.saveLabel) {
      btn.dataset.saveLabel = String(btn.textContent || "Keresés mentése").trim();
    }
    btn.addEventListener("click", () => saveCurrentSearch({ page, getFilters, whenReady, triggerEl: btn }));
  }
}
