function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function telHref(phone) {
  const digits = String(phone ?? "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

function partnerCard(partner) {
  const href = `/partner/${encodeURIComponent(partner.slug)}`;
  const photo = partner.logo_url
    ? `<img src="${escapeHtml(partner.logo_url)}" alt="" loading="lazy" decoding="async" />`
    : `<span class="immo-partner-photo-fallback">${escapeHtml(String(partner.display_name || "P").slice(0, 1))}</span>`;
  const phone = String(partner.phone || "").trim();
  const email = String(partner.email || "").trim();
  const call = telHref(phone);
  const areas = String(partner.service_areas || "").trim();
  const commission = String(partner.commission || "").trim();
  return `<article class="immo-partner-card">
    <a class="immo-partner-photo" href="${href}" aria-label="${escapeHtml(partner.display_name || "Partner")} profilja">${photo}</a>
    <div class="immo-partner-body">
      <a class="immo-partner-name" href="${href}">${escapeHtml(partner.display_name)}</a>
      ${
        phone && call
          ? `<a class="immo-partner-phone" href="${escapeHtml(call)}">${escapeHtml(phone)}</a>`
          : phone
            ? `<span class="immo-partner-phone">${escapeHtml(phone)}</span>`
            : ""
      }
      ${
        email
          ? `<a class="immo-partner-email" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`
          : ""
      }
      ${
        areas
          ? `<p class="immo-partner-area"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 18s5-5.2 5-10a5 5 0 1 0-10 0c0 4.8 5 10 5 10Z"/><circle cx="10" cy="8" r="1.8"/></svg><span>${escapeHtml(areas)}</span></p>`
          : ""
      }
      ${commission ? `<p class="immo-partner-commission">Jutalék: <strong>${escapeHtml(commission)}</strong></p>` : ""}
    </div>
  </article>`;
}

const root = document.getElementById("immo-partners-list");
const form = document.getElementById("immo-partners-search");
const queryInput = document.getElementById("immo-partners-query");
const count = document.getElementById("immo-partners-count");

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
    if (count) {
      count.textContent = query
        ? `${partners.length} partner található`
        : partners.length
          ? `${partners.length} ellenőrzött partner`
          : "";
    }
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
