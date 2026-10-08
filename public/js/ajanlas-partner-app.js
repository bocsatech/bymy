import {
  PARTNER_CATEGORIES,
  partnerCategoryImageUrl,
} from "./partner-categories-data.js?v=b826a00c74";

const CACHE_KEY = "bymy-ajanlas-partner-v1";

const VERTICAL_LABEL = {
  auto: "Autó",
  teher: "Teherautó",
  ingatlan: "Ingatlan",
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""), window.location.origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function telHref(phone) {
  const digits = String(phone ?? "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

function categoryLabel(id) {
  return PARTNER_CATEGORIES.find((c) => c.id === id)?.label || id;
}

function initial(name) {
  return esc(String(name || "P").trim().slice(0, 1).toUpperCase() || "P");
}

function readCache(id) {
  try {
    const data = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (!data || String(data.id) !== String(id)) return null;
    return data;
  } catch {
    return null;
  }
}

export function cacheAjanlasPartner(partner) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(partner));
  } catch {
  }
}

function buildBio(partner) {
  const services = (partner.services || []).map(categoryLabel).filter(Boolean);
  if (partner.description) return String(partner.description);
  if (services.length) {
    return `${partner.name} ajánlott szolgáltató a Bymy Ajánlások között. Tevékenység: ${services.join(", ")}.`;
  }
  return `${partner.name} ajánlott szolgáltató a Bymy Ajánlások között.`;
}

function listingTile(listing) {
  const preview = listing.preview || {};
  const image = safeUrl(preview.imageUrl || listing.fo_kep);
  const title = preview.title || listing.hirdetes_cime || `Hirdetés #${listing.id}`;
  const price = preview.price || "Ár nélkül";
  const vertical = VERTICAL_LABEL[listing.vertical] || listing.vertical || "Hirdetés";
  const media = image
    ? `style="background-image:url('${esc(image)}')"`
    : "";
  return `<a class="ap-tile" href="/hirdetes.html?id=${encodeURIComponent(listing.id)}">
    <div class="ap-tile-media" ${media}></div>
    <div class="ap-tile-body">
      <span class="ap-tile-cat">${esc(vertical)}</span>
      <strong>${esc(title)}</strong>
      <span class="ap-tile-price">${esc(price)}</span>
    </div>
  </a>`;
}

function renderProfile(root, partner, { listings = [], backHref = "/ajanlasok.html" } = {}) {
  const name = partner.name || partner.display_name || "Partner";
  const phone = String(partner.phone || "").trim();
  const call = telHref(phone);
  const maps = partner.google_maps_url || "";
  const website = safeUrl(partner.website);
  const email = String(partner.email || "").trim();
  const photo = safeUrl(partner.logo_url || partner.photo_url || partner.avatar_url);
  const companyLogo = safeUrl(partner.company_logo_url);
  const cover = safeUrl(partner.cover_url);
  const services = partner.services || [];
  const rating =
    partner.google_rating != null
      ? `★ ${Number(partner.google_rating).toFixed(1)}${
          partner.google_review_count != null ? ` (${partner.google_review_count})` : ""
        }`
      : "";
  const loc = [partner.postal_code, partner.address || partner.service_areas]
    .filter(Boolean)
    .join(" · ");
  const hours = partner.opening_hours || "";
  const role = services.length
    ? services.map(categoryLabel).join(" · ")
    : partner.contact_person
      ? String(partner.contact_person)
      : "Ajánlott szolgáltató";
  const facts = [rating, loc, hours, phone].filter(Boolean).join(" · ");
  const catFromQuery = new URLSearchParams(location.search).get("cat") || "";
  const vertical = new URLSearchParams(location.search).get("vertical") || "auto";
  const listBack = catFromQuery
    ? `/ajanlasok.html?vertical=${encodeURIComponent(vertical)}&cat=${encodeURIComponent(catFromQuery)}`
    : backHref;

  root.innerHTML = `
    <p class="ap-crumb">
      <a href="/ajanlasok.html?vertical=${esc(vertical)}">Ajánlások</a>
      ${catFromQuery ? ` · <a href="${esc(listBack)}">${esc(categoryLabel(catFromQuery))}</a>` : ""}
      · <strong>${esc(name)}</strong>
    </p>
    <section class="ap-hero">
      ${cover ? `<div class="ap-hero-cover" style="background-image:url('${esc(cover)}')"></div>` : ""}
      <div class="ap-hero-inner">
        <div class="ap-photos">
          <span class="ap-photo-person">${
            photo ? `<img src="${esc(photo)}" alt="" />` : `<span>${initial(name)}</span>`
          }</span>
          <span class="ap-photo-logo">${
            companyLogo
              ? `<img src="${esc(companyLogo)}" alt="" />`
              : services[0]
                ? `<img src="${esc(partnerCategoryImageUrl(services[0]))}" alt="" />`
                : `<span>${initial(name)}</span>`
          }</span>
        </div>
        <div class="ap-hero-copy">
          <h1>${esc(name)}</h1>
          <p class="ap-role">${esc(role)}</p>
          <p class="ap-facts">${esc(facts)}</p>
        </div>
      </div>
    </section>
    <div class="ap-cta">
      ${call ? `<a class="ap-btn ap-btn--primary" href="${esc(call)}">Hívás</a>` : ""}
      ${maps ? `<a class="ap-btn" href="${esc(maps)}" target="_blank" rel="noopener noreferrer">Útvonal</a>` : ""}
      ${email ? `<a class="ap-btn" href="mailto:${esc(email)}">Üzenet</a>` : ""}
      ${website ? `<a class="ap-btn" href="${esc(website)}" target="_blank" rel="noopener noreferrer">Weboldal</a>` : ""}
      <a class="ap-btn" href="${esc(listBack)}">← Lista</a>
    </div>
    <div class="ap-grid">
      <section class="ap-card">
        <h2>Tevékenység bemutatása</h2>
        <p>${esc(buildBio(partner))}</p>
        ${
          services.length
            ? `<div class="ap-tags">${services
                .map((id) => `<span class="ap-tag">${esc(categoryLabel(id))}</span>`)
                .join("")}</div>`
            : ""
        }
      </section>
      <section class="ap-card">
        <h2>Vállalkozás adatai</h2>
        <dl class="ap-dl">
          <dt>Név</dt><dd>${esc(name)}</dd>
          ${partner.contact_person ? `<dt>Kapcsolat</dt><dd>${esc(partner.contact_person)}</dd>` : ""}
          ${loc ? `<dt>Cím</dt><dd>${esc(loc)}</dd>` : ""}
          ${phone ? `<dt>Telefon</dt><dd>${esc(phone)}</dd>` : ""}
          ${email ? `<dt>E-mail</dt><dd>${esc(email)}</dd>` : ""}
          ${hours ? `<dt>Nyitva</dt><dd>${esc(hours)}</dd>` : ""}
        </dl>
      </section>
    </div>
    <section class="ap-band" id="ap-listings">
      <div class="ap-band-head">
        <h2>Hirdetéseik <span class="ap-count">${listings.length}</span></h2>
      </div>
      ${
        listings.length
          ? `<div class="ap-rail">${listings.map(listingTile).join("")}</div>`
          : `<p class="ap-empty">A partnernek jelenleg nincs feladott hirdetése a Bymyn.</p>`
      }
    </section>
  `;
  document.title = `${name} — Ajánlások — Bymy`;
}

async function loadListingsForSlug(slug) {
  if (!slug) return [];
  try {
    const res = await fetch(`/api/partner-profiles/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return [];
    return Array.isArray(data.listings) ? data.listings : [];
  } catch {
    return [];
  }
}

async function init() {
  const root = document.getElementById("ajanlas-partner-root");
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "";
  const slug = params.get("slug") || "";

  try {
    if (slug) {
      const res = await fetch(`/api/partner-profiles/${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "A profil nem elérhető.");
      const profile = data.profile || {};
      renderProfile(
        root,
        {
          id: profile.user_id,
          name: profile.display_name,
          display_name: profile.display_name,
          phone: profile.phone,
          email: profile.email,
          website: profile.website,
          logo_url: profile.logo_url,
          company_logo_url: profile.company_logo_url,
          cover_url: profile.cover_url,
          contact_person: profile.contact_person,
          service_areas: profile.service_areas,
          description: profile.description,
          services: [],
        },
        { listings: data.listings || [], backHref: "/ajanlasok.html" }
      );
      return;
    }

    if (!id) throw new Error("Hiányzó partnerazonosító.");

    let partner = null;
    let listings = [];
    if (/^\d+$/.test(id)) {
      const res = await fetch(`/api/partners/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.partner) partner = data.partner;
    }
    if (!partner) partner = readCache(id);
    if (!partner) throw new Error("Nincs ilyen partner.");

    // Ha van egyező publikus slug a névből, hirdetéseket is próbáljuk
    const guessSlug = String(partner.slug || "")
      .trim()
      .toLowerCase();
    if (guessSlug) listings = await loadListingsForSlug(guessSlug);

    renderProfile(root, partner, { listings });
  } catch (error) {
    root.innerHTML = `<div class="ap-error"><strong>A partnerprofil nem tölthető be.</strong><p>${esc(
      error.message
    )}</p><a class="ap-btn" href="/ajanlasok.html">Vissza az Ajánlásokhoz</a></div>`;
  }
}

init();
