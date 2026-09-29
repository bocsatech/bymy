import { fuelValueMatches } from "./auto-fuel-picker.js?v=fuelMatch2";

export const HOME_CATEGORY_IDS = [
  "uj",
  "benzin",
  "diesel",
  "elektromos",
  "hybrid",
  "leasing",
  "berelheto",
  "ot",
];

export const HOME_CATEGORIES = [
  { id: "uj", label: "Új", icon: "✨", image: "uj.png" },
  { id: "benzin", label: "Benzin", icon: "⛽", image: "benzin.png" },
  { id: "diesel", label: "Dízel", icon: "🛢", image: "diesel.png" },
  { id: "elektromos", label: "Elektromos", icon: "⚡", image: "elektromos.png" },
  { id: "hybrid", label: "Hybrid", icon: "🔋", image: "hybrid.png" },
  { id: "leasing", label: "Leasing", icon: "📄", image: "leasing.png" },
  { id: "berelheto", label: "Bérelhető", icon: "🔑", image: "berelheto.png" },
  { id: "ot", label: "OT", icon: "🏛", image: "ot.png" },
];

export function autoCategoryHref(categoryId) {
  return `/auto.html?cat=${encodeURIComponent(categoryId)}`;
}

export function renderHomeCategoryBar(root) {
  if (!root || root.dataset.rendered === "1") return;
  root.dataset.rendered = "1";

  const track = document.createElement("div");
  track.className = "home-category-track";
  track.setAttribute("role", "group");
  track.setAttribute("aria-label", "Gyors kategóriák");

  for (const cat of HOME_CATEGORIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `home-category-card home-category-card--${cat.id} home-category-card--has-photo`;
    button.dataset.category = cat.id;
    button.innerHTML = `
      <span class="home-category-visual" aria-hidden="true">
        <img
          class="home-category-photo"
          src="/images/categories/${cat.image}?v=autoCat2"
          alt=""
          width="486"
          height="236"
          loading="lazy"
          decoding="async"
        />
      </span>
      <span class="home-category-foot">
        <span class="home-category-icon" aria-hidden="true">${cat.icon}</span>
        <span class="home-category-text"><strong>${cat.label}</strong></span>
      </span>`;
    track.appendChild(button);
  }

  root.appendChild(track);
}

function fuelOf(item) {
  return item.preview?.filter?.uzemanyag ?? item.form?.uzemanyag ?? "";
}

function alkategoriaOf(item) {
  return String(
    item.preview?.filter?.hirdetes_alkategoria ?? item.form?.hirdetes_alkategoria ?? ""
  )
    .trim()
    .toLowerCase();
}

function isBerelhetoListing(item) {
  const raw =
    item.preview?.filter?.berelheto ??
    item.form?.berelheto ??
    item.preview?.filter?.berelheto_e ??
    "";
  if (raw === true || raw === 1) return true;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "igen" || v === "true" || v === "on" || v === "yes";
}

function matchesCategory(item, categoryId) {
  const f = item.preview?.filter ?? {};
  const fuel = fuelOf(item);
  const year = f.gyartasi_ev;
  const km = item.preview?.kmNum;
  const allapot = (f.allapot ?? "").toLowerCase();
  const currentYear = new Date().getFullYear();

  switch (categoryId) {
    case "uj":
      return (
        (km != null && km <= 1000) ||
        /új|uj|gyári|gyari|0 km/i.test(allapot) ||
        (year != null && year >= currentYear - 1)
      );
    case "benzin":
      // Csak tiszta benzin — dízel / elektromos / hibrid tilos.
      return (
        fuelValueMatches(fuel, ["Benzin"]) &&
        !fuelValueMatches(fuel, ["Hibrid"]) &&
        !fuelValueMatches(fuel, ["Dízel"]) &&
        !fuelValueMatches(fuel, ["Elektromos"])
      );
    case "diesel":
      return (
        fuelValueMatches(fuel, ["Dízel"]) &&
        !fuelValueMatches(fuel, ["Hibrid"]) &&
        !fuelValueMatches(fuel, ["Elektromos"])
      );
    case "elektromos":
      return fuelValueMatches(fuel, ["Elektromos"]) && !fuelValueMatches(fuel, ["Hibrid"]);
    case "hybrid":
      // Üzemanyag hibrid + almenük (Benzin/elektromos, Dízel/elektromos, …). Cím NEM.
      return fuelValueMatches(fuel, ["Hibrid"]);
    case "leasing":
      return alkategoriaOf(item) === "leasing";
    case "berelheto":
      return isBerelhetoListing(item);
    case "ot":
      // Később — egyelőre ne töltsön be autókat
      return false;
    default:
      return true;
  }
}

export function filterByCategory(items, categoryId) {
  if (!categoryId) return items;
  return items.filter((item) => matchesCategory(item, categoryId));
}

export function initHomeCategoryBar({ onChange, getForm, initialCategory = null }) {
  const buttons = document.querySelectorAll("[data-category]");
  if (!buttons.length) return null;

  let activeCategory = null;

  const syncButtons = () => {
    buttons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.category === activeCategory);
    });
  };

  const applyCategory = (categoryId, { toggle = true, syncUrl = true } = {}) => {
    if (toggle && activeCategory === categoryId) {
      activeCategory = null;
    } else {
      activeCategory = categoryId || null;
    }
    const form = getForm?.();
    if (form && activeCategory) {
      // form.reset() async onSearch({}) törölné a frissen beállított kategóriát —
      // csak a gyors üzemanyag UI-t nullázzuk, reset esemény nélkül.
      form.dataset.haCategoryReset = "1";
      try {
        const fuelQuick = form.querySelector("#filter-uzemanyag-quick");
        if (fuelQuick) fuelQuick.value = "";
        form.querySelectorAll("[data-fuel-quick]").forEach((btn) => btn.classList.remove("is-active"));
        form.querySelectorAll("select, input").forEach((el) => {
          if (el.type === "hidden" || el.type === "submit" || el.type === "button") return;
          if (el.matches("[data-keep-on-category]")) return;
          if (el.type === "checkbox" || el.type === "radio") el.checked = false;
          else el.value = "";
        });
      } finally {
        delete form.dataset.haCategoryReset;
      }
    }
    syncButtons();
    if (syncUrl) {
      const url = new URL(window.location.href);
      if (activeCategory) url.searchParams.set("cat", activeCategory);
      else url.searchParams.delete("cat");
      history.replaceState(null, "", url);
    }
    onChange(activeCategory);
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => applyCategory(button.dataset.category));
  });

  if (initialCategory && HOME_CATEGORY_IDS.includes(initialCategory)) {
    applyCategory(initialCategory, { toggle: false, syncUrl: false });
  }

  return {
    getCategory: () => activeCategory,
    clear: () => {
      activeCategory = null;
      syncButtons();
    },
    setCategory: (categoryId) => applyCategory(categoryId, { toggle: false }),
    syncButtons,
  };
}
