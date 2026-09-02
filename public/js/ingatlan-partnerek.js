const root = document.getElementById("immo-partners-list");
const form = document.getElementById("immo-partners-search");
const queryInput = document.getElementById("immo-partners-query");
const count = document.getElementById("immo-partners-count");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function partnerCard(partner) {
  const logo = partner.logo_url
    ? `<img src="${escapeHtml(partner.logo_url)}" alt="" loading="lazy" />`
    : `<span>${escapeHtml(String(partner.display_name || "P").slice(0, 1))}</span>`;
  return `<a class="immo-partner-card" href="/partner/${encodeURIComponent(partner.slug)}">
    <span class="immo-partner-card-top">
      <span class="immo-partner-logo">${logo}</span>
      ${partner.is_verified ? `<span class="immo-partner-verified"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 10 2.4 2.4L14 7"/></svg>Ellenőrzött partner</span>` : ""}
    </span>
    <span class="immo-partner-copy">
      <span class="immo-partner-name">${escapeHtml(partner.display_name)}</span>
      ${partner.contact_person ? `<span class="immo-partner-contact">${escapeHtml(partner.contact_person)}</span>` : ""}
      ${partner.service_areas ? `<span class="immo-partner-area"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 18s5-5.2 5-10a5 5 0 1 0-10 0c0 4.8 5 10 5 10Z"/><circle cx="10" cy="8" r="1.8"/></svg>${escapeHtml(partner.service_areas)}</span>` : ""}
    </span>
    <span class="immo-partner-open">Profil megnyitása <span aria-hidden="true">→</span></span>
  </a>`;
}

async function loadPartners(query = "") {
  if (!root) return;
  root.innerHTML = `<p class="immo-partners-state">Partnerek betöltése...</p>`;
  if (count) count.textContent = "";
  try {
    const params = new URLSearchParams({ limit: "60" });
    if (query) params.set("q", query);
    const response = await fetch(`/api/partner-profiles?${params}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Partnerek betöltése sikertelen.");
    const partners = data.partners || [];
    if (count) count.textContent = query ? `${partners.length} partner található` : partners.length ? `${partners.length} ellenőrzött partner` : "";
    root.innerHTML = partners.length
      ? partners.map(partnerCard).join("")
      : `<div class="immo-partners-state"><strong>${query ? "Nincs találat." : "Hamarosan érkeznek partnereink."}</strong><span>${query ? "Próbálj másik nevet vagy területet." : "Addig is jelentkezhetsz első ingatlanos partnereink közé."}</span></div>`;
  } catch {
    root.innerHTML = `<div class="immo-partners-state"><strong>A partnerlista most nem elérhető.</strong><span>Kérjük, próbáld újra később.</span></div>`;
  }
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  loadPartners(queryInput?.value.trim() || "");
});

queryInput?.addEventListener("search", () => loadPartners(queryInput.value.trim()));

loadPartners();
