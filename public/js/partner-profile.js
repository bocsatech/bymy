import {
  requireAuthForPage,
  getAuthUser,
  getProfile,
  getDisplayName,
  loadProfileFromServer,
  saveProfile,
  initSiteAuth,
} from "./site-auth.js?v=publicPartner1";
import {
  getDeviceIdentity,
  identityForAccountKind,
  identityFromFormData,
  isNativeApp,
  setDeviceIdentity,
} from "./device-contract-identity.js?v=contractKind1";
import { wirePostalCityAutofill } from "./postal-city-autofill.js?v=postalFill1";
import { fillCountrySelect, PHONE_COUNTRIES } from "./phone-lang-ui.js?v=settingsPhone1";

const pageRoot = () => document.getElementById("partner-root");

const ACTIVITY_LABELS = { auto: "Autó", teherauto: "Teherautó", ingatlan: "Ingatlan" };

function parsePhoneParts(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return { orszag: "+36", korzet: "", szam: "" };
  let compact = raw.replace(/[^\d+]/g, "");
  if (/^\+?06\d/.test(compact)) {
    compact = `+36${compact.replace(/^\+?06/, "")}`;
  }
  const countries = [...PHONE_COUNTRIES].sort((a, b) => b.value.length - a.value.length);
  let orszag = "+36";
  let rest = compact.startsWith("+") ? compact.slice(1) : compact;
  for (const item of countries) {
    const code = item.value.replace(/^\+/, "");
    if (compact.startsWith(item.value) || rest.startsWith(code)) {
      orszag = item.value;
      rest = compact.startsWith(item.value)
        ? compact.slice(item.value.length)
        : rest.slice(code.length);
      break;
    }
  }
  rest = String(rest).replace(/\D/g, "");
  if (!rest) return { orszag, korzet: "", szam: "" };
  let korzetLen = 2;
  if (orszag === "+36" && rest.startsWith("1") && rest.length >= 7) korzetLen = 1;
  else if (rest.length >= 10) korzetLen = 3;
  else if (rest.length <= 7) korzetLen = Math.min(2, Math.max(1, rest.length - 5));
  const korzet = rest.slice(0, Math.min(korzetLen, Math.max(0, rest.length - 4)));
  const szam = rest.slice(korzet.length);
  return { orszag, korzet, szam };
}

function composePhone(orszag, korzet, szam) {
  const o = String(orszag || "+36").trim() || "+36";
  const k = String(korzet || "").replace(/\D/g, "");
  const s = String(szam || "").replace(/\D/g, "");
  if (!k && !s) return "";
  return [o, k, s].filter(Boolean).join(" ");
}

function phoneRowHtml({ name, required = false } = {}) {
  const req = required ? " required" : "";
  return `<div class="settings-phone-row" data-settings-phone data-phone-name="${esc(name)}">
    <select class="phone-country" name="${esc(name)}Country" aria-label="Országkód"></select>
    <span aria-hidden="true">-</span>
    <input type="tel" name="${esc(name)}Area" class="phone-part" inputmode="numeric" maxlength="4" autocomplete="tel-national" placeholder="30" aria-label="Körzetszám" />
    <span aria-hidden="true">/</span>
    <input type="tel" name="${esc(name)}Local" class="phone-part wide" inputmode="numeric" maxlength="12" autocomplete="tel-national" placeholder="1234567" aria-label="Telefonszám" />
    <input type="hidden" name="${esc(name)}" value=""${req} />
  </div>`;
}

function initPartnerPhoneRows(root, values = {}) {
  if (!root) return;
  root.querySelectorAll("[data-settings-phone]").forEach((row) => {
    if (row.dataset.phoneBound === "1") return;
    row.dataset.phoneBound = "1";
    const key = row.getAttribute("data-phone-name") || "phone";
    const country = row.querySelector("select.phone-country");
    const area = row.querySelector("input.phone-part:not(.wide)");
    const local = row.querySelector("input.phone-part.wide");
    const hidden = row.querySelector('input[type="hidden"]');
    const parts = parsePhoneParts(values[key] || "");
    if (country instanceof HTMLSelectElement) fillCountrySelect(country, parts.orszag || "+36");
    if (area instanceof HTMLInputElement) area.value = parts.korzet;
    if (local instanceof HTMLInputElement) local.value = parts.szam;
    const sync = () => {
      const value = composePhone(
        country instanceof HTMLSelectElement ? country.value : "+36",
        area instanceof HTMLInputElement ? area.value : "",
        local instanceof HTMLInputElement ? local.value : ""
      );
      if (hidden instanceof HTMLInputElement) hidden.value = value;
      return value;
    };
    row.addEventListener("input", sync);
    row.addEventListener("change", sync);
    sync();
  });
}

function syncPartnerPhoneRows(form) {
  const out = {};
  if (!form) return out;
  form.querySelectorAll("[data-settings-phone]").forEach((row) => {
    const key = row.getAttribute("data-phone-name");
    if (!key) return;
    const country = row.querySelector("select.phone-country");
    const area = row.querySelector("input.phone-part:not(.wide)");
    const local = row.querySelector("input.phone-part.wide");
    const hidden = row.querySelector('input[type="hidden"]');
    const value = composePhone(
      country instanceof HTMLSelectElement ? country.value : "+36",
      area instanceof HTMLInputElement ? area.value : "",
      local instanceof HTMLInputElement ? local.value : ""
    );
    if (hidden instanceof HTMLInputElement) hidden.value = value;
    out[key] = value;
  });
  return out;
}

function parseActivities(raw) {
  if (Array.isArray(raw)) return raw.map((v) => String(v || "").trim()).filter((id) => ACTIVITY_LABELS[id]);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parseActivities(parsed);
    } catch {
      return raw.split(/[,|;]/).map((s) => s.trim()).filter((id) => ACTIVITY_LABELS[id]);
    }
  }
  return [];
}

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

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "A művelet sikertelen.");
  return data;
}

export function syncManageSidebar(accountType) {
  const company = accountType === "business" || accountType === "dealer";
  document.documentElement.setAttribute("data-mm-account-kind", company ? "company" : "private");
  const typeEl = document.querySelector("[data-mm-account-type]");
  if (typeEl) {
    typeEl.textContent = company ? "céges fiók" : "magán fiók";
    typeEl.hidden = false;
  }
  const companyWrap = document.querySelector("[data-mm-company-nav-wrap]");
  const settingsNav = document.querySelector("[data-mm-settings-nav]");
  if (companyWrap) companyWrap.hidden = !company;
  if (settingsNav) settingsNav.hidden = company;

  const hello = document.querySelector("[data-mm-hello]");
  const user = getAuthUser();
  if (hello) hello.textContent = getDisplayName() || user?.email?.split("@")[0] || "—";
}

/** Partneri profil szerkesztő — cég + partner egy helyen, duplikáció nélkül. */
export async function renderPartnerManage(mountRoot) {
  const root = mountRoot || pageRoot();
  if (!root) return;

  let accountType = String(getProfile()?.accountType || "private");
  try {
    const loaded = await loadProfileFromServer();
    if (loaded?.accountType) accountType = String(loaded.accountType);
  } catch {
  }
  syncManageSidebar(accountType);
  const isCompany = accountType === "business" || accountType === "dealer";

  root.innerHTML = `<div class="partner-loading">Partneri profil betöltése…</div>`;

  const profileResult = await jsonFetch("/api/partner-profiles/mine");
  const profile = profileResult.profile || {};
  const account = getProfile() || {};
  if (!String(profile.phone || "").trim()) {
    profile.phone = String(account.companyPhone || account.phone || "").trim();
  }
  if (!String(profile.service_areas || "").trim()) {
    profile.service_areas = String(account.companyCity || account.city || "").trim();
  }
  if (!String(profile.email || "").trim()) {
    profile.email = String(account.companyEmail || getAuthUser()?.email || "").trim();
  }
  if (!String(profile.display_name || "").trim()) {
    profile.display_name = String(account.company || "").trim();
  }
  if (!String(profile.contact_person || "").trim()) {
    const full = [account.firstName, account.lastName].filter(Boolean).join(" ").trim();
    profile.contact_person = full || String(account.salespersonName || "").trim();
  }

  const activities = parseActivities(account.companyActivities);
  const activityChecks = Object.entries(ACTIVITY_LABELS)
    .map(
      ([id, label]) =>
        `<label class="partner-check"><input type="checkbox" name="companyActivity" value="${esc(id)}" ${activities.includes(id) ? "checked" : ""} /><span>${esc(label)}</span></label>`
    )
    .join("");

  const native = isNativeApp();
  const user = getAuthUser();
  const identity = native ? await getDeviceIdentity(user?.email || "") : null;
  const seatFallback = [account.companyPostalCode, account.companyCity, account.companyStreet]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(", ");
  const contractCompanyName = identity?.companyName || account.company || profile.display_name || "";
  const contractSeat = identity?.companySeat || seatFallback;
  const contractRegistry = identity?.companyRegistry || "";
  const contractRep =
    identity?.representative ||
    account.salespersonName ||
    [account.lastName, account.firstName].filter(Boolean).join(" ") ||
    "";

  root.innerHTML = `
    <header class="partner-manage-head">
      <div>
        <p class="partner-eyebrow">CÉGADATOK · PARTNERI PROFIL</p>
        <h1>Partneri profil</h1>
      </div>
    </header>
    <form class="partner-form" id="partner-form">
      ${
        isCompany
          ? `
      <section class="partner-form-section">
        <div class="partner-form-title"><div><h2>1. Cég azonosító</h2></div></div>
        <div class="partner-form-grid">
          <label>Cég neve *<input name="displayName" value="${esc(profile.display_name || account.company)}" maxlength="100" required /></label>
          <label>Cég adószáma<input name="companyTaxId" value="${esc(account.companyTaxId)}" inputmode="numeric" autocomplete="off" /></label>
          <label>Hirdetésben megjelenő cégnév<input name="companyListingName" value="${esc(account.companyListingName)}" maxlength="100" placeholder="pl. Fehérvár Ingatlan" autocomplete="organization" /></label>
          <div class="partner-form-wide partner-activities">
            <span class="partner-activities-label">Cég tevékenysége</span>
            <div class="partner-activities-row">${activityChecks}</div>
          </div>
        </div>
      </section>

      <section class="partner-form-section">
        <div class="partner-form-title"><div><h2>2. Cég címe</h2></div></div>
        <div class="partner-form-grid">
          <label class="partner-form-wide">Utca, házszám<input name="companyStreet" value="${esc(account.companyStreet || account.companyAddress)}" autocomplete="street-address" placeholder="pl. Váci út 1." /></label>
          <label>Irányítószám<input name="companyPostalCode" value="${esc(account.companyPostalCode)}" inputmode="numeric" maxlength="4" autocomplete="postal-code" data-postal-lookup data-company-postal /></label>
          <label>Település<input name="companyCity" value="${esc(account.companyCity)}" autocomplete="address-level2" placeholder="automatikus" data-company-city /></label>
          <label>Ország<input name="companyCountry" value="${esc(account.companyCountry || "Magyarország")}" autocomplete="country-name" /></label>
        </div>
      </section>

      <section class="partner-form-section">
        <div class="partner-form-title"><div><h2>3. Kapcsolat</h2></div></div>
        <div class="partner-form-grid">
          <label>Kapcsolattartó neve<input name="contactPerson" value="${esc(profile.contact_person)}" maxlength="160" /></label>
          <div class="partner-phone-field">
            <span class="partner-phone-label">Kapcsolattartó telefonszáma *</span>
            ${phoneRowHtml({ name: "phone", required: true })}
          </div>
          <label>Értékesítő neve<input name="salespersonName" value="${esc(account.salespersonName)}" autocomplete="name" /></label>
          <div class="partner-phone-field">
            <span class="partner-phone-label">Értékesítő telefonszáma</span>
            ${phoneRowHtml({ name: "companyPhone2" })}
          </div>
          <label>Értékesítő neve (2)<input name="salespersonName2" value="${esc(account.salespersonName2)}" autocomplete="name" /></label>
          <div class="partner-phone-field">
            <span class="partner-phone-label">Értékesítő telefonszáma (2)</span>
            ${phoneRowHtml({ name: "companyPhone3" })}
          </div>
          <label>E-mail cím *<input name="email" type="email" value="${esc(profile.email)}" maxlength="320" required /></label>
          <label>Második e-mail<input name="companyEmail2" type="email" value="${esc(account.companyEmail2)}" maxlength="320" /></label>
        </div>
      </section>
      `
          : `
      <section class="partner-form-section">
        <div class="partner-form-title"><div><h2>1. Alapadatok</h2></div></div>
        <div class="partner-form-grid">
          <label>Partner / iroda neve *<input name="displayName" value="${esc(profile.display_name)}" maxlength="100" required /></label>
          <label>Kapcsolattartó neve<input name="contactPerson" value="${esc(profile.contact_person)}" maxlength="160" /></label>
          <div class="partner-phone-field partner-form-wide">
            <span class="partner-phone-label">Telefonszám *</span>
            ${phoneRowHtml({ name: "phone", required: true })}
          </div>
          <label>E-mail cím *<input name="email" type="email" value="${esc(profile.email)}" maxlength="320" required /></label>
        </div>
      </section>
      `
      }

      <section class="partner-form-section">
        <div class="partner-form-title"><div><h2>${isCompany ? "4" : "2"}. Publikus partnerprofil</h2></div></div>
        <div class="partner-form-grid">
          <label>Publikus profilcím *<span class="partner-slug"><span>bymy.hu/partner/</span><input name="slug" value="${esc(profile.slug)}" maxlength="100" required /></span></label>
          <label>Jutalék *<input name="commission" value="${esc(profile.commission)}" maxlength="80" required placeholder="pl. bruttó 2–4%" /></label>
          <label>Weboldal<input name="website" type="url" value="${esc(profile.website)}" placeholder="https://…" maxlength="300" /></label>
          <label>Profilkép URL<input name="logoUrl" type="url" value="${esc(profile.logo_url)}" placeholder="https://…" /></label>
          <label>Borítókép URL<input name="coverUrl" type="url" value="${esc(profile.cover_url)}" placeholder="https://…" /></label>
          <label class="partner-form-wide">Kerület / értékesítési területek *<input name="serviceAreas" value="${esc(profile.service_areas)}" placeholder="Például: Budapest XI., Budaörs, Érd" maxlength="1000" required /></label>
          <label class="partner-form-wide">Bemutatkozás<textarea name="description" maxlength="4000" placeholder="Mutasd be az irodát és a szakterületedet.">${esc(profile.description)}</textarea></label>
          <label class="partner-check partner-form-wide"><input type="checkbox" name="isPublic" ${profile.is_public !== false ? "checked" : ""} /><span>A jóváhagyás után legyen nyilvános a profilom</span></label>
        </div>
      </section>

      ${
        isCompany
          ? `
      <section class="partner-form-section">
        <div class="partner-form-title"><div><h2>5. Szerződéses adatok</h2></div></div>
        ${
          native
            ? ""
            : `<p class="partner-contract-web-hint">Böngészőben nem szerkeszthető — nyisd meg a Bymy appot a telefonodon.</p>`
        }
        <div class="partner-form-grid">
          <label>Cég neve (szerződés)<input name="local_companyName" value="${esc(native ? contractCompanyName : "")}" ${native ? "" : "readonly"} placeholder="${native ? "" : "Csak a mobilalkalmazásban"}" autocomplete="organization" /></label>
          <label class="partner-form-wide">Székhely<input name="local_companySeat" value="${esc(native ? contractSeat : "")}" ${native ? "" : "readonly"} placeholder="${native ? "pl. 1051 Budapest, …" : "Csak a mobilalkalmazásban"}" autocomplete="street-address" /></label>
          <label>Cégjegyzék / nyilvántartási szám<input name="local_companyRegistry" value="${esc(native ? contractRegistry : "")}" ${native ? "" : "readonly"} placeholder="${native ? "" : "Csak a mobilalkalmazásban"}" autocomplete="off" /></label>
          <label>Képviselő neve<input name="local_representative" value="${esc(native ? contractRep : "")}" ${native ? "" : "readonly"} placeholder="${native ? "" : "Csak a mobilalkalmazásban"}" autocomplete="name" /></label>
        </div>
      </section>
      `
          : ""
      }

      <div class="partner-form-actions">
        <button type="submit">Mentés</button>
        ${profile.application_status === "approved" && profile.slug ? `<a href="/partner/${encodeURIComponent(profile.slug)}" target="_blank" rel="noopener">Publikus profil megnyitása</a>` : ""}
        <p data-status role="status"></p>
      </div>
    </form>`;

  try {
    wirePostalCityAutofill(root);
  } catch {
  }
  initPartnerPhoneRows(root, {
    phone: profile.phone,
    companyPhone2: account.companyPhone2,
    companyPhone3: account.companyPhone3,
  });

  root.querySelector("#partner-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("[data-status]");
    const submit = form.querySelector('button[type="submit"]');
    status.textContent = "";
    status.className = "";
    submit.disabled = true;
    submit.textContent = "Mentés…";
    const phones = syncPartnerPhoneRows(form);
    const raw = Object.fromEntries(new FormData(form).entries());
    const activityIds = [...form.querySelectorAll('input[name="companyActivity"]:checked')].map((el) => el.value);
    const partnerPayload = {
      displayName: String(raw.displayName || "").trim(),
      slug: String(raw.slug || "").trim(),
      contactPerson: String(raw.contactPerson || "").trim(),
      phone: String(phones.phone || raw.phone || "").trim(),
      email: String(raw.email || "").trim(),
      commission: String(raw.commission || "").trim(),
      website: String(raw.website || "").trim(),
      logoUrl: String(raw.logoUrl || "").trim(),
      coverUrl: String(raw.coverUrl || "").trim(),
      serviceAreas: String(raw.serviceAreas || "").trim(),
      description: String(raw.description || "").trim(),
      isPublic: Boolean(form.elements.isPublic?.checked),
    };
    if (!partnerPayload.phone) {
      status.textContent = "Telefonszám kötelező.";
      status.className = "is-error";
      submit.disabled = false;
      submit.textContent = "Mentés";
      return;
    }
    try {
      const result = await jsonFetch("/api/partner-profiles/mine", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partnerPayload),
      });

      if (isCompany) {
        const companyStreet = String(raw.companyStreet || "").trim();
        const companyPostalCode = String(raw.companyPostalCode || "").replace(/\D/g, "").slice(0, 4);
        const companyCity = String(raw.companyCity || "").trim();
        await saveProfile({
          ...getProfile(),
          company: partnerPayload.displayName,
          companyListingName: String(raw.companyListingName || "").trim(),
          companyTaxId: String(raw.companyTaxId || "").trim(),
          companyActivities: activityIds,
          companyStreet,
          companyAddress: companyStreet,
          companyPostalCode,
          companyCity,
          companyCountry: String(raw.companyCountry || "Magyarország").trim() || "Magyarország",
          companyPhone: partnerPayload.phone,
          companyPhone2: String(phones.companyPhone2 || "").trim(),
          companyPhone3: String(phones.companyPhone3 || "").trim(),
          companyEmail: partnerPayload.email,
          companyEmail2: String(raw.companyEmail2 || "").trim(),
          salespersonName: String(raw.salespersonName || "").trim(),
          salespersonName2: String(raw.salespersonName2 || "").trim(),
        });

        if (native && user?.email) {
          const deviceIdentity = identityForAccountKind(identityFromFormData(raw), { company: true });
          await setDeviceIdentity(user.email, deviceIdentity);
        }
      }

      status.textContent =
        result.profile.application_status === "approved"
          ? "Mentve."
          : "Mentve — a partnerjelentkezés jóváhagyásra vár.";
      status.className = "is-success";
    } catch (error) {
      status.textContent = error.message;
      status.className = "is-error";
    } finally {
      submit.disabled = false;
      submit.textContent = "Mentés";
    }
  });
}

async function manageStandalone() {
  if (!(await requireAuthForPage())) return;
  initSiteAuth();
  // Régi URL → egységes Fiókom / Partneri profil panel
  window.location.replace("/beallitasok.html?szekcio=partner-profil");
}

async function view() {
  const root = pageRoot();
  if (!root) return;
  const slug = new URLSearchParams(location.search).get("slug") || location.pathname.match(/^\/partner\/([^/]+)\/?$/)?.[1];
  if (!slug) throw new Error("Hiányzó partnerazonosító.");
  const { profile, listings = [] } = await jsonFetch(`/api/partner-profiles/${encodeURIComponent(slug)}`);
  const logo = safeUrl(profile.logo_url);
  const cover = safeUrl(profile.cover_url);
  const website = safeUrl(profile.website);
  const phone = String(profile.phone || "").trim();
  const tel = phone.replace(/[^\d+]/g, "");
  const commission = String(profile.commission || "").trim();
  document.title = `${profile.display_name} — Bymy ingatlanos partner`;
  root.innerHTML = `
    <nav class="partner-breadcrumb"><a href="/ingatlan.html">Ingatlan</a><span>›</span><a href="/ingatlan.html#immo-partners-title">Ingatlanos partnerek</a><span>›</span><span>${esc(profile.display_name)}</span></nav>
    <section class="partner-profile-hero ${cover ? "has-cover" : ""}" ${cover ? `data-cover="${esc(cover)}"` : ""}>
      <div class="partner-profile-identity">
        <span class="partner-profile-logo">${logo ? `<img src="${esc(logo)}" alt="${esc(profile.display_name)} képe" />` : `<span>${profileInitial(profile)}</span>`}</span>
        <div>
          <span class="partner-verified"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 10 2.4 2.4L14 7"/></svg>Ellenőrzött Bymy partner</span>
          <h1>${esc(profile.display_name)}</h1>
          ${profile.contact_person ? `<p class="partner-contact-name">${esc(profile.contact_person)}</p>` : ""}
          ${phone ? `<p class="partner-service-area"><a href="tel:${esc(tel)}">${esc(phone)}</a></p>` : ""}
          ${profile.service_areas ? `<p class="partner-service-area"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 18s5-5.2 5-10a5 5 0 1 0-10 0c0 4.8 5 10 5 10Z"/><circle cx="10" cy="8" r="1.8"/></svg>${esc(profile.service_areas)}</p>` : ""}
          ${commission ? `<p class="partner-service-area">Jutalék: <strong>${esc(commission)}</strong></p>` : ""}
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
        ${phone ? `<a href="tel:${esc(tel)}"><span>Telefon</span><strong>${esc(phone)}</strong></a>` : ""}
        ${profile.email ? `<a href="mailto:${encodeURIComponent(profile.email)}"><span>E-mail</span><strong>${esc(profile.email)}</strong></a>` : ""}
        ${website ? `<a href="${esc(website)}" target="_blank" rel="noopener"><span>Weboldal</span><strong>Weboldal megnyitása ↗</strong></a>` : ""}
        ${commission ? `<div><span>Jutalék</span><strong>${esc(commission)}</strong></div>` : ""}
        <a class="partner-contact-cta" href="#partner-listings">Hirdetések megtekintése</a>
      </aside>
    </div>`;
  root.querySelector(".partner-listings-section")?.setAttribute("id", "partner-listings");
  const hero = root.querySelector("[data-cover]");
  if (hero) hero.style.setProperty("--partner-cover", `url("${cover.replaceAll('"', "%22")}")`);
}

async function init() {
  try {
    if (location.pathname.endsWith("partner-profil-kezelese.html")) await manageStandalone();
    else if (document.body?.dataset?.sitePage === "beallitasok") return;
    else await view();
  } catch (error) {
    const root = pageRoot();
    if (root) {
      root.innerHTML = `<div class="partner-error"><strong>A partnerprofil nem tölthető be.</strong><p>${esc(error.message)}</p><a href="/ingatlan.html">Vissza az Ingatlan oldalra</a></div>`;
    }
  }
}

init();
