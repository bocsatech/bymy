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
  { id: "uj", label: "Új", sub: "Friss modell", icon: "✨", image: "uj.png" },
  { id: "benzin", label: "Benzin", sub: "Otto motor", icon: "⛽", image: "benzin.png" },
  { id: "diesel", label: "Diesel", sub: "Dízelmotor", icon: "🛢", image: "diesel.png" },
  { id: "elektromos", label: "Elektromos", sub: "Zöld hajtás", icon: "⚡", image: "elektromos.png" },
  { id: "hybrid", label: "Hybrid", sub: "Kombinált", icon: "🔋", image: "hybrid.png" },
  { id: "leasing", label: "Leasing", sub: "Havi díj", icon: "📄", image: "leasing.png" },
  { id: "berelheto", label: "Bérelhető", sub: "Rövid táv", icon: "🔑", image: "berelheto.png" },
  { id: "ot", label: "OT", sub: "Oldtimer", icon: "🏛", image: "ot.png" },
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
        <span class="home-category-text"><strong>${cat.label}</strong><span>${cat.sub}</span></span>
      </span>`;
    track.appendChild(button);
  }

  root.appendChild(track);
}

function haystack(item) {
  const preview = item.preview ?? {};
  return [preview.title, preview.leiras, preview.specLine, ...(preview.badges ?? [])]
    .join(" ")
    .toLowerCase();
}

function fuelOf(item) {
  return item.preview?.filter?.uzemanyag ?? "";
}

function matchesCategory(item, categoryId) {
  const f = item.preview?.filter ?? {};
  const fuel = fuelOf(item);
  const text = haystack(item);
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
      return fuel === "Benzin";
    case "diesel":
      return fuel === "Diesel" || fuel === "Dízel";
    case "elektromos":
      return fuel === "Elektromos";
    case "hybrid":
      return (
        (/elektromos/i.test(fuel) && fuel !== "Elektromos") ||
        /hibrid|hybrid/i.test(fuel) ||
        /hibrid|hybrid/i.test(text)
      );
    case "leasing":
      return /leasing|lízing|lizing|hitel\/leasing|operatív/i.test(text);
    case "berelheto":
      return /bérelhet|berelhet|kölcsön|kolcson|rent/i.test(text);
    case "ot":
      return (
        (year != null && year <= 1990) ||
        /oldtimer|veterán|veteran|klasszik|antik/i.test(text)
      );
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
      form.reset();
      const fuelQuick = form.querySelector("#filter-uzemanyag-quick");
      if (fuelQuick) fuelQuick.value = "";
      form.querySelectorAll("[data-fuel-quick]").forEach((btn) => btn.classList.remove("is-active"));
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
