import { requireAuthForPage } from "./site-auth.js?v=publicPartner1";

const root = document.getElementById("partner-root");

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function listingCard(listing) {
  const preview = listing.preview || {};
  const image = safeUrl(preview.imageUrl || listing.fo_kep);
  const title = preview.title || listing.hirdetes_cime || `Hirdetés #${listing.id}`;
  const location = preview.location || preview.telepules || "";
  return `<article class="partner-listing">
    <a class="partner-listing-image" href="/hirdetes.html?id=${encodeURIComponent(listing.id)}">
      ${image ? `<img src="${esc(image)}" alt="" loading="lazy" />` : '<span>Nincs kép</span>'}
    </a>
    <div class="partner-listing-body">
      <p class="partner-listing-price">${esc(preview.price || "Ár nélkül")}</p>
      <h3><a href="/hirdetes.html?id=${encodeURIComponent(listing.id)}">${esc(title)}</a></h3>
      ${location ? `<p class="partner-listing-location">${esc(location)}</p>` : ""}
    </div>
  </article>`;
}

function profileInitial(profile) {
  return esc(String(profile.display_name || "P").trim().slice(0, 1).toUpperCase());
}

function statusBox(profile) {
  const status = profile?.application_status || "pending";
  if (status === "approved") {
    return `<div class="partner-status is-approved"><strong>Jóváhagyott partnerprofil</strong><span>A profilod nyilvános, hirdetéseiden megjelenik az ellenőrzött partnerjelvény.</span></div>`;
  }
  if (status === "rejected") {
    return `<div class="partner-status is-rejected"><strong>A jelentkezés jelenleg nincs jóváhagyva</strong><span>Az adatokat módosíthatod, majd az adminisztrátor ismét ellenőrizheti a profilod.</span></div>`;
  }
  return `<div class="partner-status is-pending"><strong>Jóváhagyásra vár</strong><span>A profil mentése után a Bymy adminisztrátora ellenőrzi a jelentkezést. Addig nem jelenik meg a partnerkeresőben.</span></div>`;
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "A művelet sikertelen.");
  return data;
}

async function manage() {
  if (!(await requireAuthForPage())) return;
  const [profileResult, listingsResult] = await Promise.all([
    jsonFetch("/api/partner-profiles/mine"),
    jsonFetch("/api/listings/mine?limit=200").catch(() => ({ listings: [] })),
  ]);
  const profile = profileResult.profile || {};
  const listings = (listingsResult.listings || []).filter(
    (listing) => String(listing.vertical || listing.preview?.filter?.vertical || "").toLowerCase() === "ingatlan"
  );
  root.innerHTML = `
    <nav class="partner-breadcrumb"><a href="/ingatlan.html">Ingatlan</a><span>›</span><span>Partnerprofil kezelése</span></nav>
    <header class="partner-manage-head">
      <div><p class="partner-eyebrow">BYMY INGATLANOS PARTNERPROGRAM</p><h1>Partnerprofil kezelése</h1><p>Itt adhatod meg a publikus profilodon látható adatokat, és kezelheted saját hirdetéseidet.</p></div>
    </header>
    ${statusBox(profile)}
    <form class="partner-form" id="partner-form">
      <div class="partner-form-title"><div><h2>Partner adatai</h2><p>A csillaggal jelölt mezők kitöltése kötelező.</p></div></div>
      <div class="partner-form-grid">
        <label>Partner vagy iroda neve *<input name="displayName" value="${esc(profile.display_name)}" maxlength="100" required /></label>
        <label>Publikus profilcím *<span class="partner-slug"><span>bymy.hu/partner/</span><input name="slug" value="${esc(profile.slug)}" maxlength="100" required /></span></label>
        <label>Kapcsolattartó neve<input name="contactPerson" value="${esc(profile.contact_person)}" maxlength="160" /></label>
        <label>E-mail cím<input name="email" type="email" value="${esc(profile.email)}" maxlength="320" /></label>
        <label>Weboldal<input name="website" type="url" value="${esc(profile.website)}" placeholder="https://…" maxlength="300" /></label>
        <label>Logó URL<input name="logoUrl" type="url" value="${esc(profile.logo_url)}" placeholder="https://…" /></label>
        <label>Borítókép URL<input name="coverUrl" type="url" value="${esc(profile.cover_url)}" placeholder="https://…" /></label>
        <label class="partner-form-wide">Szolgáltatási terület<input name="serviceAreas" value="${esc(profile.service_areas)}" placeholder="Például: Budapest XI. kerület, Budaörs" maxlength="1000" /></label>
        <label class="partner-form-wide">Bemutatkozás<textarea name="description" maxlength="4000" placeholder="Mutasd be az irodát, a szakterületedet és azt, miben tudsz segíteni.">${esc(profile.description)}</textarea></label>
        <label class="partner-check partner-form-wide"><input type="checkbox" name="isPublic" ${profile.is_public !== false ? "checked" : ""} /><span>A jóváhagyás után legyen nyilvános a profilom</span></label>
      </div>
      <div class="partner-form-actions">
        <button type="submit">Profil mentése</button>
        ${profile.application_status === "approved" && profile.slug ? `<a href="/partner/${encodeURIComponent(profile.slug)}" target="_blank" rel="noopener">Publikus profil megnyitása</a>` : ""}
        <p data-status role="status"></p>
      </div>
    </form>
    <section class="partner-own-listings">
      <div class="partner-section-head"><div><p class="partner-eyebrow">SAJÁT HIRDETÉSEK</p><h2>Ingatlanhirdetéseim</h2></div><a class="partner-primary-link" href="/hirdetesfeladas.html?vertical=ingatlan&subtype=ingatlan&start=1">+ Új hirdetés</a></div>
      <div class="partner-own-list">${listings.length ? listings.map((listing) => `<div class="partner-own-row"><div><strong>${esc(listing.preview?.title || listing.hirdetes_cime || `Hirdetés #${listing.id}`)}</strong><span>${esc(listing.preview?.price || "")}</span></div><span class="partner-own-status">${esc(listing.status || "")}</span><div><a href="/hirdetes.html?id=${listing.id}">Megnyitás</a><a href="/hirdetesfeladas.html?id=${listing.id}">Szerkesztés</a></div></div>`).join("") : "<p class=\"partner-empty\">Még nincs saját hirdetésed.</p>"}</div>
    </section>`;

  root.querySelector("#partner-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("[data-status]");
    const submit = form.querySelector('button[type="submit"]');
    status.textContent = "";
    submit.disabled = true;
    submit.textContent = "Mentés…";
    const payload = Object.fromEntries(new FormData(form));
    payload.isPublic = form.elements.isPublic.checked;
    try {
      const result = await jsonFetch("/api/partner-profiles/mine", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      status.textContent = result.profile.application_status === "approved" ? "A profil mentve." : "A jelentkezés mentve, jóváhagyásra vár.";
      status.className = "is-success";
    } catch (error) {
      status.textContent = error.message;
      status.className = "is-error";
    } finally {
      submit.disabled = false;
      submit.textContent = "Profil mentése";
    }
  });
}

async function view() {
  const slug = new URLSearchParams(location.search).get("slug") || location.pathname.match(/^\/partner\/([^/]+)\/?$/)?.[1];
  if (!slug) throw new Error("Hiányzó partnerazonosító.");
  const { profile, listings = [] } = await jsonFetch(`/api/partner-profiles/${encodeURIComponent(slug)}`);
  const logo = safeUrl(profile.logo_url);
  const cover = safeUrl(profile.cover_url);
  const website = safeUrl(profile.website);
  document.title = `${profile.display_name} — Bymy ingatlanos partner`;
  root.innerHTML = `
    <nav class="partner-breadcrumb"><a href="/ingatlan.html">Ingatlan</a><span>›</span><a href="/ingatlan.html#immo-partners-title">Ingatlanos partnerek</a><span>›</span><span>${esc(profile.display_name)}</span></nav>
    <section class="partner-profile-hero ${cover ? "has-cover" : ""}" ${cover ? `data-cover="${esc(cover)}"` : ""}>
      <div class="partner-profile-identity">
        <span class="partner-profile-logo">${logo ? `<img src="${esc(logo)}" alt="${esc(profile.display_name)} logója" />` : `<span>${profileInitial(profile)}</span>`}</span>
        <div>
          <span class="partner-verified"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 10 2.4 2.4L14 7"/></svg>Ellenőrzött Bymy partner</span>
          <h1>${esc(profile.display_name)}</h1>
          ${profile.contact_person ? `<p class="partner-contact-name">${esc(profile.contact_person)}</p>` : ""}
          ${profile.service_areas ? `<p class="partner-service-area"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 18s5-5.2 5-10a5 5 0 1 0-10 0c0 4.8 5 10 5 10Z"/><circle cx="10" cy="8" r="1.8"/></svg>${esc(profile.service_areas)}</p>` : ""}
        </div>
      </div>
    </section>
    <div class="partner-profile-layout">
      <div class="partner-profile-content">
        <section class="partner-card partner-about">
          <p class="partner-eyebrow">BEMUTATKOZÁS</p>
          <h2>Rólunk</h2>
          <p>${esc(profile.description || "A partner még nem adott meg bemutatkozást.")}</p>
        </section>
        <section class="partner-listings-section">
          <div class="partner-section-head"><div><p class="partner-eyebrow">AKTÍV HIRDETÉSEK</p><h2>${listings.length} ingatlan</h2></div></div>
          <div class="partner-listing-grid">${listings.length ? listings.map(listingCard).join("") : '<p class="partner-empty">A partnernek jelenleg nincs aktív hirdetése.</p>'}</div>
        </section>
      </div>
      <aside class="partner-card partner-contact-card">
        <h2>Kapcsolat</h2>
        ${profile.contact_person ? `<div><span>Kapcsolattartó</span><strong>${esc(profile.contact_person)}</strong></div>` : ""}
        ${profile.email ? `<a href="mailto:${encodeURIComponent(profile.email)}"><span>E-mail</span><strong>${esc(profile.email)}</strong></a>` : ""}
        ${website ? `<a href="${esc(website)}" target="_blank" rel="noopener"><span>Weboldal</span><strong>Weboldal megnyitása ↗</strong></a>` : ""}
        <a class="partner-contact-cta" href="#partner-listings">Hirdetések megtekintése</a>
      </aside>
    </div>`;
  root.querySelector(".partner-listings-section")?.setAttribute("id", "partner-listings");
  const hero = root.querySelector("[data-cover]");
  if (hero) hero.style.setProperty("--partner-cover", `url("${cover.replaceAll('"', "%22")}")`);
}

async function init() {
  try {
    if (location.pathname.endsWith("partner-profil-kezelese.html")) await manage();
    else await view();
  } catch (error) {
    root.innerHTML = `<div class="partner-error"><strong>A partnerprofil nem tölthető be.</strong><p>${esc(error.message)}</p><a href="/ingatlan.html">Vissza az Ingatlan oldalra</a></div>`;
  }
}

init();
