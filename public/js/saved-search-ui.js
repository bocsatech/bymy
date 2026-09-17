
import { getAuthUser } from "./site-auth.js?v=savedSearch1";
import { addSavedSearch } from "./fok-data.js?v=savedSearch1";
import {
  buildSavedSearchUrl,
  normalizeSavedSearchFilters,
  summarizeSavedSearchFilters,
} from "./saved-search.js?v=savedSearch1";

function defaultSearchName(filters) {
  const summary = summarizeSavedSearchFilters(filters);
  if (summary) return summary.slice(0, 72);
  return "Mentett keresés";
}

export function initSavedSearchUi({ page = "auto", getFilters, whenReady } = {}) {
  const btn = document.getElementById("qs-save-search");
  if (!btn || btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  btn.addEventListener("click", async () => {
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

    btn.textContent = "Mentve ✓";
    window.setTimeout(() => {
      btn.textContent = "Keresés mentése";
    }, 2000);
  });
}
