import {
  PARTNER_CATEGORIES,
  partnerCategoryImageUrl,
} from "./partner-categories-data.js?v=ajanlasMobile1";

const STORAGE_KEY = "bymy_partner_postal_code";
const LEGACY_STORAGE_KEY = "autosweb_partner_postal_code";
const RADIUS_KEY = "bymy_partner_radius_km";
const PARTNER_UI_VERSION = "ajanlasMobile1";
let partnerUiInitialized = false;

function partnerApiErrorMessage(response, data) {
  if (response.status === 404 && data?.error === "Ismeretlen API.") {
    return "A partner API nem elérhető ezen a szerveren.";
  }
  return data?.error ?? "Ajánlások betöltése sikertelen.";
}

export async function fetchPartnerRecommendations(postalCode) {
  const params = new URLSearchParams({ postal_code: String(postalCode).trim() });
  let response;
  try {
    response = await fetch(`/api/partners/recommendations?${params}`);
  } catch {
    throw new Error("Nem érhető el a Bymy szerver.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(partnerApiErrorMessage(response, data));
  }
  return data;
}

export function loadSavedPostalCode() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePostalCode(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

function formatRating(partner) {
  if (partner.google_rating == null) return "";
  const count =
    partner.google_review_count != null ? ` (${partner.google_review_count})` : "";
  return `★ ${Number(partner.google_rating).toFixed(1)}${count}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPartnerCard(partner) {
  const article = document.createElement("article");
  article.className = "home-partner-card";

  const rating = formatRating(partner);
  article.innerHTML = `
    <h4 class="home-partner-name">${escapeHtml(partner.name)}</h4>
    <p class="home-partner-meta">
      <span class="home-partner-distance">~${partner.distance_km} km</span>
      ${rating ? `<span class="home-partner-rating">${escapeHtml(rating)}</span>` : ""}
    </p>
    <p class="home-partner-address">${escapeHtml(partner.address)} · ${escapeHtml(partner.postal_code)}</p>
    ${
      partner.opening_hours
        ? `<p class="home-partner-hours">${escapeHtml(partner.opening_hours)}</p>`
        : ""
    }
    <div class="home-partner-actions">
      <a class="home-partner-call" href="tel:${escapeHtml(partner.phone.replace(/\s/g, ""))}">Hívás</a>
      ${
        partner.google_maps_url
          ? `<a class="home-partner-map" href="${escapeHtml(partner.google_maps_url)}" target="_blank" rel="noopener noreferrer">Google</a>`
          : ""
      }
    </div>
  `;
  return article;
}

function renderCategoryPanel(category) {
  const panel = document.createElement("div");
  panel.className = "home-partner-category-panel";
  panel.hidden = true;
  panel.id = `home-partner-panel-${category.id}`;

  const list = document.createElement("div");
  list.className = "home-partner-list";

  if (category.partners?.length) {
    for (const partner of category.partners) {
      list.append(renderPartnerCard(partner));
    }
  } else {
    const empty = document.createElement("p");
    empty.className = "home-partner-empty";
    empty.textContent = category.empty_message ?? "Hamarosan a környékeden is";
    list.append(empty);
  }

  panel.append(list);
  return panel;
}

function renderCategoryAccordionItem(category) {
  const section = document.createElement("section");
  section.className = "home-partner-category";
  section.dataset.category = category.id;

  const count = category.partners?.length ?? 0;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "home-partner-category-toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", `home-partner-panel-${category.id}`);
  const imageUrl = partnerCategoryImageUrl(category.id);
  toggle.innerHTML = `
    <span class="home-partner-category-photo" aria-hidden="true">
      <img src="${escapeHtml(imageUrl)}?v=ajanlasMobile1" alt="" width="44" height="44" loading="lazy" decoding="async" />
    </span>
    <span class="home-partner-category-label">${escapeHtml(category.label)}</span>
    <span class="home-partner-category-meta">
      <span class="home-partner-category-count">${count > 0 ? count : "0"}</span>
      <span class="home-partner-category-chevron" aria-hidden="true"></span>
    </span>
  `;

  const panel = renderCategoryPanel(category);
  section.append(toggle, panel);
  return section;
}

function bindPartnerAccordion(accordionEl) {
  if (!accordionEl) return () => {};

  let openId = null;

  function setOpen(categoryId) {
    openId = categoryId;
    accordionEl.querySelectorAll(".home-partner-category").forEach((section) => {
      const isOpen = Boolean(categoryId && section.dataset.category === categoryId);
      const toggle = section.querySelector(".home-partner-category-toggle");
      const panel = section.querySelector(".home-partner-category-panel");
      section.classList.toggle("is-open", isOpen);
      if (toggle) toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (panel) panel.hidden = !isOpen;
    });
  }

  accordionEl.addEventListener("click", (event) => {
    const toggle = event.target.closest(".home-partner-category-toggle");
    if (!toggle) return;
    const section = toggle.closest(".home-partner-category");
    const categoryId = section?.dataset.category;
    if (!categoryId) return;
    setOpen(openId === categoryId ? null : categoryId);
  });

  return () => setOpen(null);
}

function setStatus(statusEl, message, type = "") {
  if (!statusEl) return;
  statusEl.hidden = !message;
  statusEl.textContent = message ?? "";
  statusEl.dataset.statusType = type;
}

async function verifyPartnerApi(statusEl) {
  try {
    const response = await fetch("/api/partners/stats");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(statusEl, partnerApiErrorMessage(response, data), "err");
      return false;
    }
    if (!data.activePaid) {
      setStatus(
        statusEl,
        "Nincs fizetős partner az adatbázisban.",
        "err"
      );
      return false;
    }
    return true;
  } catch {
    setStatus(statusEl, "Nem érhető el a Bymy szerver.", "err");
    return false;
  }
}

export function initPartnerRecommendations(rootId = "home-partner-recommendations") {
  if (partnerUiInitialized) return;
  const root = document.getElementById(rootId);
  const toggleBtn = document.getElementById("home-partner-rec-toggle");
  const bodyEl = document.getElementById("home-partner-rec-body");
  const form = document.getElementById("home-partner-postal-form");
  const input = document.getElementById("home-partner-postal-input");
  const statusEl = document.getElementById("home-partner-postal-status");
  const resultsEl = document.getElementById("home-partner-results");
  if (!root || !toggleBtn || !bodyEl || !form || !input || !resultsEl) return;
  partnerUiInitialized = true;
  root.dataset.partnerUiVersion = PARTNER_UI_VERSION;

  let apiReady = false;
  let collapseAccordion = () => {};

  const saved = loadSavedPostalCode();
  if (saved) input.value = saved;

  function setWidgetExpanded(expanded) {
    root.classList.toggle("is-collapsed", !expanded);
    bodyEl.hidden = !expanded;
    toggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function collapseWidget() {
    clearResults();
    setStatus(statusEl, "", "");
    setWidgetExpanded(false);
  }

  function clearResults() {
    collapseAccordion();
    resultsEl.innerHTML = "";
    resultsEl.hidden = true;
  }

  function dismissCategories() {
    collapseWidget();
  }

  function renderResults(categories) {
    resultsEl.innerHTML = "";

    const accordion = document.createElement("div");
    accordion.className = "home-partner-accordion";
    accordion.id = "home-partner-accordion";

    for (const category of categories) {
      accordion.append(renderCategoryAccordionItem(category));
    }

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "home-partner-collapse-all";
    collapseBtn.id = "home-partner-collapse-all";
    collapseBtn.textContent = "Összes becsukása";

    resultsEl.append(accordion, collapseBtn);
    resultsEl.hidden = false;

    collapseAccordion = bindPartnerAccordion(accordion);

    collapseBtn.addEventListener("click", () => {
      dismissCategories();
    });
  }

  async function loadRecommendations(postalCode) {
    if (!apiReady) {
      apiReady = await verifyPartnerApi(statusEl);
      if (!apiReady) return;
    }

    setStatus(statusEl, "Ajánlások betöltése…", "info");
    clearResults();

    try {
      const data = await fetchPartnerRecommendations(postalCode);
      savePostalCode(postalCode);
      setStatus(
        statusEl,
        `${data.city} (${data.postal_code}) — válassz kategóriát`,
        "ok"
      );
      renderResults(data.categories ?? PARTNER_CATEGORIES);
    } catch (error) {
      setStatus(statusEl, error.message ?? "Nem sikerült betölteni az ajánlásokat.", "err");
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const postalCode = input.value.replace(/\D/g, "").slice(0, 4);
    input.value = postalCode;
    if (postalCode.length !== 4) {
      setStatus(statusEl, "Adj meg érvényes 4 számjegyű irányítószámot.", "err");
      return;
    }
    setWidgetExpanded(true);
    loadRecommendations(postalCode);
  });

  toggleBtn.addEventListener("click", () => {
    const willExpand = root.classList.contains("is-collapsed");
    if (willExpand) {
      setWidgetExpanded(true);
      return;
    }
    collapseWidget();
  });

  setWidgetExpanded(false);
}
