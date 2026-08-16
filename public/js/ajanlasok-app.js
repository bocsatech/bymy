import {
  PARTNER_CATEGORIES,
  partnerCategoryImageUrl,
} from "./partner-categories-data.js?v=ajanlasMobile1";
import {
  fetchPartnerRecommendations,
  loadSavedPostalCode,
  savePostalCode,
} from "./partner-recommendations.js?v=ajanlasMobile1";

const RADIUS_KEY = "bymy_partner_radius_km";
const UI_V = "ajanlasMobile1";

/** Mobil PartnerRecommendationsDemo — API hiba esetén. */
const DEMO_CATEGORIES = [
  {
    id: "atiras_ugyintezes",
    label: "Átírás ügyintézés",
    partners: [
      {
        id: "d1",
        name: "Autó-Átírás Fejér",
        address: "Piac tér 5.",
        postal_code: "8000",
        phone: "+36 22 678 9012",
        opening_hours: "H–P 8–16",
        google_rating: 4.8,
        google_review_count: 34,
        distance_km: 1.2,
        google_maps_url:
          "https://www.google.com/maps/search/?api=1&query=Aut%C3%B3-%C3%81t%C3%ADr%C3%A1s%20Fej%C3%A9r%20Sz%C3%A9kesfeh%C3%A9rv%C3%A1r",
      },
    ],
  },
  {
    id: "eredetvizsga",
    label: "Eredetvizsga",
    partners: [
      {
        id: "d2",
        name: "MVK Vizsgaállomás",
        address: "Ipari park 1.",
        postal_code: "8000",
        phone: "+36 22 567 8901",
        opening_hours: "H–P 7–18",
        google_rating: 4.2,
        google_review_count: 210,
        distance_km: 3.4,
        google_maps_url:
          "https://www.google.com/maps/search/?api=1&query=MVK%20Vizsga%C3%A1llom%C3%A1s%20Sz%C3%A9kesfeh%C3%A9rv%C3%A1r",
      },
    ],
  },
  {
    id: "muszakivizsga",
    label: "Műszaki vizsga",
    partners: [
      {
        id: "d2b",
        name: "MVK Vizsgaállomás",
        address: "Ipari park 1.",
        postal_code: "8000",
        phone: "+36 22 567 8901",
        opening_hours: "H–P 7–18",
        google_rating: 4.2,
        google_review_count: 210,
        distance_km: 3.4,
        google_maps_url:
          "https://www.google.com/maps/search/?api=1&query=MVK%20Vizsga%C3%A1llom%C3%A1s%20Sz%C3%A9kesfeh%C3%A9rv%C3%A1r",
      },
    ],
  },
  {
    id: "autoatvizsgalas",
    label: "Autoátvizsgálás",
    partners: [
      {
        id: "d2c",
        name: "Autóátvizsgálás Fejér",
        address: "Gáz utca 8.",
        postal_code: "8000",
        phone: "+36 22 456 7890",
        opening_hours: "H–P 8–17",
        google_rating: 4.6,
        google_review_count: 48,
        distance_km: 2.7,
        google_maps_url:
          "https://www.google.com/maps/search/?api=1&query=Aut%C3%B3%C3%A1tvizsg%C3%A1l%C3%A1s%20Sz%C3%A9kesfeh%C3%A9rv%C3%A1r",
      },
    ],
  },
  {
    id: "autoszerelo",
    label: "Autószerelő",
    partners: [
      {
        id: "d3",
        name: "Fejér Autószerviz Kft.",
        address: "Fő utca 12.",
        postal_code: "8000",
        phone: "+36 22 123 4567",
        opening_hours: "H–P 8–17, Szo 8–12",
        google_rating: 4.7,
        google_review_count: 89,
        distance_km: 2.1,
        google_maps_url:
          "https://www.google.com/maps/search/?api=1&query=Fej%C3%A9r%20Aut%C3%B3szerviz%20Sz%C3%A9kesfeh%C3%A9rv%C3%A1r",
      },
    ],
  },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadRadiusKm() {
  try {
    const raw = Number(localStorage.getItem(RADIUS_KEY) || 30);
    if (!Number.isFinite(raw)) return 30;
    return Math.min(30, Math.max(5, Math.round(raw)));
  } catch {
    return 30;
  }
}

function filterByRadius(categories, radiusKm) {
  const maxKm = Number(radiusKm) + 0.05;
  return categories.map((category) => ({
    ...category,
    partners: (category.partners ?? []).filter((partner) => {
      if (partner.distance_km == null) return true;
      return Number(partner.distance_km) <= maxKm;
    }),
  }));
}

function formatRating(partner) {
  if (partner.google_rating == null) return "";
  const count =
    partner.google_review_count != null ? ` (${partner.google_review_count})` : "";
  return `★ ${Number(partner.google_rating).toFixed(1)}${count}`;
}

function telHref(phone) {
  return `tel:${String(phone ?? "").replace(/[^\d+]/g, "")}`;
}

function queryCategoryId() {
  try {
    return new URLSearchParams(window.location.search).get("cat") || "";
  } catch {
    return "";
  }
}

function ensureCategoryShell(categories) {
  const byId = new Map((categories ?? []).map((c) => [c.id, c]));
  return PARTNER_CATEGORIES.map((meta) => {
    const found = byId.get(meta.id);
    return {
      id: meta.id,
      label: meta.label,
      partners: found?.partners ?? [],
      empty_message: found?.empty_message,
    };
  });
}

function renderPartnerCard(partner) {
  const article = document.createElement("article");
  article.className = "ajanlas-partner-card";
  const rating = formatRating(partner);
  const phone = partner.phone ? String(partner.phone) : "";
  const maps = partner.google_maps_url ? String(partner.google_maps_url) : "";
  const dist =
    partner.distance_km != null ? ` · ${Number(partner.distance_km).toFixed(1)} km` : "";
  article.innerHTML = `
    <h3 class="ajanlas-partner-name">${escapeHtml(partner.name)}</h3>
    <p class="ajanlas-partner-loc">${escapeHtml(partner.postal_code)} · ${escapeHtml(partner.address)}${escapeHtml(dist)}</p>
    ${
      partner.opening_hours
        ? `<p class="ajanlas-partner-hours">${escapeHtml(partner.opening_hours)}</p>`
        : ""
    }
    ${rating ? `<p class="ajanlas-partner-rating">${escapeHtml(rating)}</p>` : ""}
    <div class="ajanlas-partner-actions">
      ${phone ? `<a class="ajanlas-partner-call" href="${escapeHtml(telHref(phone))}">Hívás</a>` : ""}
      ${
        maps
          ? `<a class="ajanlas-partner-map" href="${escapeHtml(maps)}" target="_blank" rel="noopener noreferrer">Térkép</a>`
          : ""
      }
    </div>
  `;
  return article;
}

function renderCategory(category, openId) {
  const section = document.createElement("section");
  section.className = "ajanlas-category";
  section.dataset.category = category.id;
  const count = category.partners?.length ?? 0;
  const isOpen = openId === category.id;
  if (isOpen) section.classList.add("is-open");

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "ajanlas-category-toggle";
  toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  toggle.innerHTML = `
    <span class="ajanlas-category-photo" aria-hidden="true">
      <img src="${escapeHtml(partnerCategoryImageUrl(category.id))}?v=${UI_V}" alt="" width="44" height="44" loading="lazy" decoding="async" />
    </span>
    <span class="ajanlas-category-label">${escapeHtml(category.label)}</span>
    <span class="ajanlas-category-meta">
      <span class="ajanlas-category-count">${count}</span>
      <span class="ajanlas-category-chevron" aria-hidden="true"></span>
    </span>
  `;

  const panel = document.createElement("div");
  panel.className = "ajanlas-category-panel";
  panel.hidden = !isOpen;

  if (count === 0) {
    const empty = document.createElement("p");
    empty.className = "ajanlas-empty";
    empty.textContent =
      category.empty_message ?? "Ebben a kategóriában nincs ajánlott partner a közelben.";
    panel.append(empty);
  } else {
    for (const partner of category.partners) {
      panel.append(renderPartnerCard(partner));
    }
  }

  section.append(toggle, panel);
  return section;
}

function bindAccordion(root, preferredOpenId) {
  let openId = preferredOpenId || null;

  function apply() {
    root.querySelectorAll(".ajanlas-category").forEach((section) => {
      const isOpen = Boolean(openId && section.dataset.category === openId);
      const toggle = section.querySelector(".ajanlas-category-toggle");
      const panel = section.querySelector(".ajanlas-category-panel");
      section.classList.toggle("is-open", isOpen);
      if (toggle) toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (panel) panel.hidden = !isOpen;
    });
  }

  root.addEventListener("click", (event) => {
    const toggle = event.target.closest(".ajanlas-category-toggle");
    if (!toggle) return;
    const section = toggle.closest(".ajanlas-category");
    const id = section?.dataset.category;
    if (!id) return;
    openId = openId === id ? null : id;
    apply();
  });

  apply();
}

export function initAjanlasokPage() {
  const listEl = document.getElementById("ajanlas-list");
  const noteEl = document.getElementById("ajanlas-note");
  const subtitleEl = document.getElementById("ajanlas-subtitle");
  const refreshBtn = document.getElementById("ajanlas-refresh");
  if (!listEl) return;

  const preferredCat = queryCategoryId();

  function setNote(text) {
    if (noteEl) noteEl.textContent = text ?? "";
  }

  function setSubtitle(text) {
    if (subtitleEl) subtitleEl.textContent = text ?? "";
  }

  function render(categories, openPreferred) {
    const radiusKm = loadRadiusKm();
    let filtered = filterByRadius(ensureCategoryShell(categories), radiusKm);
    const withPartners = filtered.filter((c) => c.partners.length > 0);
    if (withPartners.length) filtered = withPartners;

    listEl.innerHTML = "";
    const openId =
      openPreferred && filtered.some((c) => c.id === preferredCat) ? preferredCat : null;
    for (const category of filtered) {
      listEl.append(renderCategory(category, openId));
    }
    bindAccordion(listEl, openId);
  }

  async function load() {
    const postalCode = String(loadSavedPostalCode() || "")
      .replace(/\D/g, "")
      .slice(0, 4);
    const radiusKm = loadRadiusKm();

    if (postalCode.length !== 4) {
      setSubtitle("Állítsd be a körzetet a Beállításokban");
      setNote("Állítsd be az irányítószámot: Beállítások → Ajánlások körzete");
      listEl.innerHTML = "";
      const empty = document.createElement("p");
      empty.className = "ajanlas-empty ajanlas-empty--page";
        empty.innerHTML =
        'Nincs irányítószám. <a href="/beallitasok.html?szekcio=fiok#recommendationsArea">Beállítások → Ajánlások körzete</a>';
      listEl.append(empty);
      return;
    }

    setSubtitle(`${postalCode} · szolgáltatók ${radiusKm} km-en belül`);
    setNote("Ajánlások betöltése…");
    listEl.setAttribute("aria-busy", "true");

    try {
      const data = await fetchPartnerRecommendations(postalCode);
      savePostalCode(postalCode);
      if (data.city) setSubtitle(`${data.city} · szolgáltatók ${radiusKm} km-en belül`);
      setNote(`Élő · ${postalCode} · ${radiusKm} km`);
      render(data.categories ?? [], true);
    } catch {
      setNote("A szolgáltatók most nem elérhetők.");
      if (postalCode === "8000") {
        setSubtitle(`Székesfehérvár · szolgáltatók ${radiusKm} km-en belül`);
      }
      render(DEMO_CATEGORIES, true);
    } finally {
      listEl.removeAttribute("aria-busy");
    }
  }

  refreshBtn?.addEventListener("click", () => {
    load();
  });

  load();
}

initAjanlasokPage();
