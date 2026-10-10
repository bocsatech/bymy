import {
  requireAuthForPage,
  getAuthUser,
  getProfile,
  getDisplayName,
  loadProfileFromServer,
  saveProfile,
  initSiteAuth,
} from "./site-auth.js?v=20aa3f41c9";
import { wirePostalCityAutofill } from "./postal-city-autofill.js?v=ba74000828";
import { fillCountrySelect, PHONE_COUNTRIES } from "./phone-lang-ui.js?v=bc55c36aef";
import { categoriesForVertical } from "./partner-categories-data.js?v=b826a00c74";
import { fetchMyListings } from "./db-client.js?v=6c1aeac308";
import { uploadImage } from "./upload-image.js?v=3b023aae7a";
import { openListingPhotoEditor } from "./listing-photo-edit.js?v=985755542f";

const pageRoot = () => document.getElementById("partner-root");

const ACTIVITY_LABELS = {
  auto: "Autó",
  teherauto: "Teherautó",
  piacter: "Piactér",
  ingatlan: "Ingatlan",
};

function asIdList(value) {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return asIdList(parsed);
    } catch {
      /* comma list */
    }
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function ajanlasSummary(ids, vertical) {
  const cats = categoriesForVertical(vertical);
  const labels = ids
    .map((id) => cats.find((c) => c.id === id)?.label)
    .filter(Boolean);
  if (!labels.length) return "Nincs kategória";
  if (labels.length <= 2) return labels.join(" · ");
  return `${labels.slice(0, 2).join(" · ")} +${labels.length - 2}`;
}

function openAjanlasCategorySheet({ title, vertical, selectedIds, onDone }) {
  const cats = categoriesForVertical(vertical);
  const selected = new Set(asIdList(selectedIds));
  const existing = document.querySelector(".partner-ajanlas-sheet");
  existing?.remove();

  const portal = document.createElement("div");
  portal.className = "partner-ajanlas-sheet";
  portal.setAttribute("role", "dialog");
  portal.setAttribute("aria-modal", "true");
  portal.setAttribute("aria-label", title);

  function paint() {
    const list = portal.querySelector("[data-ajanlas-sheet-list]");
    if (!list) return;
    list.innerHTML = cats
      .map((c) => {
        const on = selected.has(c.id) ? " is-on" : "";
        return `<button type="button" class="partner-ajanlas-sheet__item${on}" data-cat="${esc(c.id)}">
          <span class="partner-ajanlas-sheet__box" aria-hidden="true"></span>
          <span>${esc(c.label)}</span>
        </button>`;
      })
      .join("");
  }

  portal.innerHTML = `
    <button type="button" class="partner-ajanlas-sheet__backdrop" aria-label="Bezárás"></button>
    <div class="partner-ajanlas-sheet__card">
      <header class="partner-ajanlas-sheet__head">
        <button type="button" class="partner-ajanlas-sheet__x" aria-label="Bezárás">×</button>
        <h2>${esc(title)}</h2>
        <button type="button" class="partner-ajanlas-sheet__done">Kész</button>
      </header>
      <div class="partner-ajanlas-sheet__list" data-ajanlas-sheet-list></div>
    </div>`;
  document.body.appendChild(portal);
  document.body.classList.add("partner-ajanlas-sheet-open");
  paint();

  function close(commit) {
    portal.remove();
    document.body.classList.remove("partner-ajanlas-sheet-open");
    if (commit) onDone?.([...selected]);
  }

  portal.querySelector(".partner-ajanlas-sheet__backdrop")?.addEventListener("click", () => close(false));
  portal.querySelector(".partner-ajanlas-sheet__x")?.addEventListener("click", () => close(false));
  portal.querySelector(".partner-ajanlas-sheet__done")?.addEventListener("click", () => close(true));
  portal.querySelector("[data-ajanlas-sheet-list]")?.addEventListener("click", (event) => {
    const btn = event.target?.closest?.("[data-cat]");
    if (!btn) return;
    const id = btn.getAttribute("data-cat") || "";
    if (!id) return;
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    paint();
  });
}

function wireCompanyAjanlasBlock(root, account) {
  const masterSw = root.querySelector("[data-partner-ajanlas-switch]");
  const masterBtn = root.querySelector("[data-partner-ajanlas-btn]");
  const subs = root.querySelector("[data-partner-ajanlas-subs]");
  const autoSw = root.querySelector("[data-partner-ajanlas-auto-sw]");
  const immoSw = root.querySelector("[data-partner-ajanlas-immo-sw]");
  const autoBtn = root.querySelector("[data-partner-ajanlas-auto-btn]");
  const immoBtn = root.querySelector("[data-partner-ajanlas-immo-btn]");
  const autoSum = root.querySelector("[data-partner-ajanlas-auto-sum]");
  const immoSum = root.querySelector("[data-partner-ajanlas-immo-sum]");
  if (!(masterSw instanceof HTMLInputElement) || !subs) return;

  const state = {
    autoOn: account.companyAjanlasokAuto === true,
    immoOn: account.companyAjanlasokIngatlan === true,
    autoCats: asIdList(account.companyAjanlasokAutoCats),
    immoCats: asIdList(account.companyAjanlasokIngatlanCats),
  };

  function syncUi() {
    const masterOn = masterSw.checked;
    subs.hidden = !masterOn;
    if (autoSw instanceof HTMLInputElement) autoSw.checked = state.autoOn;
    if (immoSw instanceof HTMLInputElement) immoSw.checked = state.immoOn;
    if (autoSum) autoSum.textContent = ajanlasSummary(state.autoCats, "auto");
    if (immoSum) immoSum.textContent = ajanlasSummary(state.immoCats, "ingatlan");
    autoBtn?.classList.toggle("is-active", state.autoOn);
    immoBtn?.classList.toggle("is-active", state.immoOn);
  }

  masterBtn?.addEventListener("click", () => {
    masterSw.checked = !masterSw.checked;
    masterSw.dispatchEvent(new Event("change", { bubbles: true }));
  });
  masterSw.addEventListener("change", () => syncUi());

  autoSw?.addEventListener("change", () => {
    state.autoOn = Boolean(autoSw.checked);
    syncUi();
  });
  immoSw?.addEventListener("change", () => {
    state.immoOn = Boolean(immoSw.checked);
    syncUi();
  });

  autoBtn?.addEventListener("click", () => {
    if (!masterSw.checked) return;
    openAjanlasCategorySheet({
      title: "Autós ajánlások",
      vertical: "auto",
      selectedIds: state.autoCats,
      onDone: (ids) => {
        state.autoCats = ids;
        syncUi();
      },
    });
  });
  immoBtn?.addEventListener("click", () => {
    if (!masterSw.checked) return;
    openAjanlasCategorySheet({
      title: "Ingatlanos ajánlások",
      vertical: "ingatlan",
      selectedIds: state.immoCats,
      onDone: (ids) => {
        state.immoCats = ids;
        syncUi();
      },
    });
  });

  syncUi();
  return state;
}

function readCompanyAjanlasPayload(form, ajanlasState) {
  const masterOn = Boolean(form.querySelector('[name="companyAjanlasok"]')?.checked);
  if (!masterOn || !ajanlasState) {
    return {
      companyAjanlasok: false,
      companyAjanlasokAuto: false,
      companyAjanlasokIngatlan: false,
      companyAjanlasokAutoCats: [],
      companyAjanlasokIngatlanCats: [],
    };
  }
  const autoOn = Boolean(ajanlasState.autoOn);
  const immoOn = Boolean(ajanlasState.immoOn);
  const autoCats = autoOn ? asIdList(ajanlasState.autoCats) : [];
  const immoCats = immoOn ? asIdList(ajanlasState.immoCats) : [];
  if (autoOn && !autoCats.length) {
    return { error: "Autós ajánlásoknál válassz legalább egy kategóriát, vagy kapcsold ki." };
  }
  if (immoOn && !immoCats.length) {
    return { error: "Ingatlanos ajánlásoknál válassz legalább egy kategóriát, vagy kapcsold ki." };
  }
  return {
    companyAjanlasok: true,
    companyAjanlasokAuto: autoOn,
    companyAjanlasokIngatlan: immoOn,
    companyAjanlasokAutoCats: autoCats,
    companyAjanlasokIngatlanCats: immoCats,
  };
}

/** Profil hero borító ≈ 980×250 → ~3.75; logo/avatar 1:1. */
const PARTNER_MEDIA_ASPECT = {
  logoUrl: 1,
  companyLogoUrl: 1,
  coverUrl: 15 / 4,
};

function mediaFieldHtml({ name, label, value, round = false }) {
  const url = String(value || "").trim();
  const aspect = PARTNER_MEDIA_ASPECT[name] ?? 4 / 3;
  const previewClass = [
    "partner-media-preview",
    round ? "is-round" : "",
    name === "coverUrl" ? "is-cover" : "",
    name === "companyLogoUrl" ? "is-logo" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `
    <div class="partner-media-field" data-partner-media-field data-partner-media-aspect="${esc(String(aspect))}">
      <span class="partner-media-label">${esc(label)}</span>
      <div class="${previewClass}" data-partner-media-preview>
        ${
          url
            ? `<img src="${esc(url)}" alt="" data-partner-media-img />`
            : `<span class="partner-media-empty">Nincs kép</span>`
        }
      </div>
      <input type="hidden" name="${esc(name)}" value="${esc(url)}" data-partner-media-url />
      <div class="partner-media-actions">
        <button type="button" class="partner-media-upload" data-partner-media-pick>Kép feltöltése</button>
        ${
          url
            ? `<button type="button" class="partner-media-edit" data-partner-media-edit>Szerkesztés</button>
               <button type="button" class="partner-media-clear" data-partner-media-clear>Törlés</button>`
            : ""
        }
      </div>
      <input type="file" accept="image/*" hidden data-partner-media-file />
      <p class="partner-media-hint">Max. 1 kép · ugyanaz a szerkesztő, mint a hirdetésfeladásnál</p>
    </div>
  `;
}

function wirePartnerMediaUploads(root) {
  root.querySelectorAll("[data-partner-media-field]").forEach((field) => {
    const fileInput = field.querySelector("[data-partner-media-file]");
    const hidden = field.querySelector("[data-partner-media-url]");
    const preview = field.querySelector("[data-partner-media-preview]");
    const pickBtn = field.querySelector("[data-partner-media-pick]");
    const actions = field.querySelector(".partner-media-actions");
    if (!(fileInput instanceof HTMLInputElement) || !(hidden instanceof HTMLInputElement)) return;

    // Egy mező = egy kép (ne legyen multiple).
    fileInput.removeAttribute("multiple");

    function syncActionButtons(hasUrl) {
      if (!actions) return;
      let editBtn = actions.querySelector("[data-partner-media-edit]");
      let clearBtn = actions.querySelector("[data-partner-media-clear]");
      if (hasUrl) {
        if (!editBtn) {
          editBtn = document.createElement("button");
          editBtn.type = "button";
          editBtn.className = "partner-media-edit";
          editBtn.setAttribute("data-partner-media-edit", "");
          editBtn.textContent = "Szerkesztés";
          editBtn.addEventListener("click", () => void editCurrent());
          actions.appendChild(editBtn);
        }
        if (!clearBtn) {
          clearBtn = document.createElement("button");
          clearBtn.type = "button";
          clearBtn.className = "partner-media-clear";
          clearBtn.setAttribute("data-partner-media-clear", "");
          clearBtn.textContent = "Törlés";
          clearBtn.addEventListener("click", () => setUrl(""));
          actions.appendChild(clearBtn);
        }
      } else {
        editBtn?.remove();
        clearBtn?.remove();
      }
    }

    function setUrl(nextUrl) {
      const url = String(nextUrl || "").trim();
      hidden.value = url;
      if (preview) {
        preview.innerHTML = url
          ? `<img src="${esc(url)}" alt="" data-partner-media-img />`
          : `<span class="partner-media-empty">Nincs kép</span>`;
      }
      syncActionButtons(Boolean(url));
    }

    async function uploadEditedFile(file) {
      const uploaded = await uploadImage({
        file,
        kind: "profile",
        entityType: "profile",
        folder: "partner-profile",
      });
      const url = String(uploaded.url || uploaded.publicUrl || uploaded.href || "").trim();
      if (!url) throw new Error("Nincs kép URL a feltöltés után.");
      setUrl(url);
    }

    async function editAndUpload(source, fileName = "photo.jpg") {
      const aspect = Number(field.getAttribute("data-partner-media-aspect")) || 4 / 3;
      const edited = await openListingPhotoEditor({ source, fileName, aspect });
      if (!edited) return;
      if (pickBtn) {
        pickBtn.disabled = true;
        pickBtn.textContent = "Feltöltés…";
      }
      try {
        await uploadEditedFile(edited);
      } finally {
        if (pickBtn) {
          pickBtn.disabled = false;
          pickBtn.textContent = "Kép feltöltése";
        }
      }
    }

    async function editCurrent() {
      const url = String(hidden.value || "").trim();
      if (!url) return;
      try {
        await editAndUpload(url, "partner-photo.jpg");
      } catch (error) {
        window.alert(error?.message || "A szerkesztés sikertelen.");
      }
    }

    pickBtn?.addEventListener("click", () => fileInput.click());
    field.querySelector("[data-partner-media-edit]")?.addEventListener("click", () => void editCurrent());
    field.querySelector("[data-partner-media-clear]")?.addEventListener("click", () => setUrl(""));
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file) return;
      try {
        await editAndUpload(file, file.name || "photo.jpg");
      } catch (error) {
        window.alert(error?.message || "A feltöltés sikertelen.");
        if (pickBtn) {
          pickBtn.disabled = false;
          pickBtn.textContent = "Kép feltöltése";
        }
      }
    });
  });
}

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

const VERTICAL_LABEL = { auto: "Autó", teher: "Teherautó", ingatlan: "Ingatlan" };

function listingCard(listing) {
  const preview = listing.preview || {};
  const image = safeUrl(preview.imageUrl || listing.fo_kep);
  const title = preview.title || listing.hirdetes_cime || `Hirdetés #${listing.id}`;
  const location = preview.location || preview.telepules || "";
  const vertical = VERTICAL_LABEL[listing.vertical] || listing.vertical || "";
  return `<article class="partner-listing">
    <a class="partner-listing-image" href="/hirdetes.html?id=${encodeURIComponent(listing.id)}">
      ${image ? `<img src="${esc(image)}" alt="" loading="lazy" />` : '<span>Nincs kép</span>'}
    </a>
    <div class="partner-listing-body">
      ${vertical ? `<p class="partner-listing-vertical">${esc(vertical)}</p>` : ""}
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
  try {
    localStorage.setItem("bymy-account-kind", company ? "company" : "private");
  } catch {
  }
  const typeEl = document.querySelector("[data-mm-account-type]");
  if (typeEl) {
    typeEl.textContent = company ? "céges fiók" : "magán fiók";
    typeEl.hidden = false;
  }
  const settingsNav = document.querySelector("[data-mm-settings-nav]");
  if (settingsNav) settingsNav.hidden = false;

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

  const [profileResult, myListings] = await Promise.all([
    jsonFetch("/api/partner-profiles/mine"),
    fetchMyListings({ limit: 5 }).catch(() => []),
  ]);
  const profile = profileResult.profile || {};
  const account = getProfile() || {};
  const listingId = (Array.isArray(myListings) ? myListings : []).find(
    (row) => Number(row?.id) > 0
  )?.id;
  // Listing út stabil (seller-contact); a nyilvános slug csak jóváhagyott profilnál megy.
  const profilePageHref = listingId
    ? `/ajanlas-partner.html?listing=${encodeURIComponent(String(listingId))}`
    : profile.slug
      ? `/ajanlas-partner.html?slug=${encodeURIComponent(profile.slug)}`
      : "";
  const avatarUrl =
    String(profile.logo_url || account.companyAvatarUrl || "").trim();
  const companyLogoUrl =
    String(profile.company_logo_url || account.companyLogoUrl || "").trim();
  const coverUrl = String(profile.cover_url || account.companyCoverUrl || "").trim();
  const descriptionText = String(
    profile.description || account.companyDescription || ""
  ).trim();
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

  root.innerHTML = `
    <header class="partner-manage-head">
      <div>
        <p class="partner-eyebrow">CÉGADATOK · PARTNERI PROFIL</p>
        <h1>Partneri profil</h1>
      </div>
      ${
        profilePageHref
          ? `<a class="partner-profile-page-btn" href="${esc(profilePageHref)}">profil oldal</a>`
          : `<span class="partner-profile-page-btn is-disabled" aria-disabled="true" title="Ehhez legalább egy hirdetés vagy publikus slug kell">profil oldal</span>`
      }
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
          <label>E-mail cím<input name="email" type="email" value="${esc(profile.email)}" maxlength="320" /></label>
          <div class="partner-form-wide partner-activities">
            <span class="partner-activities-label">Cég tevékenysége</span>
            <div class="partner-activities-row">${activityChecks}</div>
          </div>
        </div>
      </section>

      <section class="partner-form-section">
        <div class="partner-form-title"><div><h2>2. Cég címe</h2></div></div>
        <div class="partner-form-grid">
          <label class="partner-form-wide">Utca, házszám *<input name="companyStreet" value="${esc(account.companyStreet || account.companyAddress)}" autocomplete="street-address" placeholder="pl. Váci út 1." required /></label>
          <label>Irányítószám *<input name="companyPostalCode" value="${esc(account.companyPostalCode)}" inputmode="numeric" maxlength="4" autocomplete="postal-code" data-postal-lookup data-company-postal required /></label>
          <label>Település *<input name="companyCity" value="${esc(account.companyCity)}" autocomplete="address-level2" placeholder="automatikus" data-company-city required /></label>
          <label>Ország<input name="companyCountry" value="${esc(account.companyCountry || "Magyarország")}" autocomplete="country-name" /></label>
        </div>
      </section>

      <section class="partner-form-section" data-partner-work-radius>
        <div class="partner-form-title"><div><h2>Munkaterület</h2><p>Az Ajánlások listában a cég címe körül ennyi km-en belül jelenik meg a céged.</p></div></div>
        <div class="partner-form-grid">
          <label class="partner-form-wide">Sugár (km)
            <select name="companyWorkRadiusKm">
              ${[5, 10, 15, 20, 30]
                .map((km) => {
                  const cur = Number(account.companyWorkRadiusKm) || 30;
                  return `<option value="${km}"${km === cur ? " selected" : ""}>${km} km</option>`;
                })
                .join("")}
            </select>
          </label>
        </div>
      </section>

      <section class="partner-form-section">
        <div class="partner-form-title"><div><h2>3. Kapcsolat</h2></div></div>
        <div class="partner-form-grid">
          <label>Kapcsolattartó neve *<input name="contactPerson" value="${esc(profile.contact_person)}" maxlength="160" required /></label>
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
          <label>Második e-mail<input name="companyEmail2" type="email" value="${esc(account.companyEmail2)}" maxlength="320" /></label>
        </div>
      </section>

      <section class="partner-form-section">
        <div class="partner-form-title"><div><h2>4. Publikus megjelenés</h2><p>Ezek jelennek meg a profil oldalon. Itt töltsd fel a képeket és írd át a bemutatást.</p></div></div>
        <div class="partner-media-grid">
          ${mediaFieldHtml({ name: "logoUrl", label: "Profilkép", value: avatarUrl, round: true })}
          ${mediaFieldHtml({ name: "companyLogoUrl", label: "Céglogó", value: companyLogoUrl })}
          ${mediaFieldHtml({ name: "coverUrl", label: "Háttérkép / borító", value: coverUrl })}
        </div>
        <div class="partner-form-grid" style="margin-top:14px">
          <label class="partner-form-wide">Tevékenység bemutatása<textarea name="description" maxlength="4000" rows="5" placeholder="Írd le a tevékenységet, szolgáltatásokat, területet…">${esc(descriptionText)}</textarea></label>
          <label>Weboldal<input name="website" type="url" value="${esc(profile.website || account.website || "")}" placeholder="https://…" maxlength="300" /></label>
          <label>Publikus profilcím<span class="partner-slug"><span>bymy.hu/partner/</span><input name="slug" value="${esc(profile.slug || "")}" maxlength="100" placeholder="cegnev" /></span></label>
        </div>
      </section>

      <div class="partner-ajanlas-block">
        <div class="partner-form-actions partner-ajanlas-island" role="group" aria-label="Ajánlások">
          <button type="button" class="partner-ajanlas-btn" data-partner-ajanlas-btn>Ajánlások</button>
          <label class="partner-switch">
            <input
              type="checkbox"
              name="companyAjanlasok"
              data-partner-ajanlas-switch
              ${account.companyAjanlasok === true ? "checked" : ""}
              aria-label="Ajánlások bekapcsolása"
            />
            <span class="partner-switch__track" aria-hidden="true"></span>
          </label>
        </div>
        <div class="partner-ajanlas-subs" data-partner-ajanlas-subs ${account.companyAjanlasok === true ? "" : "hidden"}>
          <div class="partner-form-actions partner-ajanlas-island partner-ajanlas-row">
            <button type="button" class="partner-ajanlas-btn partner-ajanlas-btn--sub" data-partner-ajanlas-auto-btn>
              Autós ajánlások
              <small data-partner-ajanlas-auto-sum>${esc(ajanlasSummary(asIdList(account.companyAjanlasokAutoCats), "auto"))}</small>
            </button>
            <label class="partner-switch">
              <input
                type="checkbox"
                data-partner-ajanlas-auto-sw
                ${account.companyAjanlasokAuto === true ? "checked" : ""}
                aria-label="Autós ajánlások bekapcsolása"
              />
              <span class="partner-switch__track" aria-hidden="true"></span>
            </label>
          </div>
          <div class="partner-form-actions partner-ajanlas-island partner-ajanlas-row">
            <button type="button" class="partner-ajanlas-btn partner-ajanlas-btn--sub" data-partner-ajanlas-immo-btn>
              Ingatlanos ajánlások
              <small data-partner-ajanlas-immo-sum>${esc(ajanlasSummary(asIdList(account.companyAjanlasokIngatlanCats), "ingatlan"))}</small>
            </button>
            <label class="partner-switch">
              <input
                type="checkbox"
                data-partner-ajanlas-immo-sw
                ${account.companyAjanlasokIngatlan === true ? "checked" : ""}
                aria-label="Ingatlanos ajánlások bekapcsolása"
              />
              <span class="partner-switch__track" aria-hidden="true"></span>
            </label>
          </div>
        </div>
      </div>
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

      ${
        isCompany
          ? ""
          : `
      <section class="partner-form-section">
        <div class="partner-form-title"><div><h2>2. Publikus partnerprofil</h2></div></div>
        <div class="partner-form-grid">
          <label>Publikus profilcím *<span class="partner-slug"><span>bymy.hu/partner/</span><input name="slug" value="${esc(profile.slug)}" maxlength="100" required /></span></label>
          <label>Jutalék * (csak ingatlan kereskedők)<input name="commission" value="${esc(profile.commission)}" maxlength="80" required placeholder="pl. bruttó 2–4%" /></label>
          <label>Weboldal<input name="website" type="url" value="${esc(profile.website)}" placeholder="https://…" maxlength="300" /></label>
          <div class="partner-form-wide partner-media-grid">
            ${mediaFieldHtml({ name: "logoUrl", label: "Profilkép", value: profile.logo_url, round: true })}
            ${mediaFieldHtml({ name: "companyLogoUrl", label: "Céglogó", value: profile.company_logo_url })}
            ${mediaFieldHtml({ name: "coverUrl", label: "Háttérkép / borító", value: profile.cover_url })}
          </div>
          <label class="partner-form-wide">Kerület / értékesítési területek *<input name="serviceAreas" value="${esc(profile.service_areas)}" placeholder="Például: Budapest XI., Budaörs, Érd" maxlength="1000" required /></label>
          <label class="partner-form-wide">Bemutatkozás<textarea name="description" maxlength="4000" placeholder="Mutasd be az irodát és a szakterületedet.">${esc(profile.description)}</textarea></label>
          <label class="partner-check partner-form-wide"><input type="checkbox" name="isPublic" ${profile.is_public !== false ? "checked" : ""} /><span>A jóváhagyás után legyen nyilvános a profilom</span></label>
        </div>
      </section>
      `
      }

      <div class="partner-form-actions">
        <button type="submit">Mentés</button>
        ${
          !isCompany && profile.application_status === "approved" && profile.slug
            ? `<a href="/ajanlas-partner.html?slug=${encodeURIComponent(profile.slug)}" target="_blank" rel="noopener">Publikus profil megnyitása</a>`
            : ""
        }
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

  const ajanlasState = isCompany ? wireCompanyAjanlasBlock(root, account) : null;
  wirePartnerMediaUploads(root);

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
    const displayName = String(raw.displayName || "").trim();
    const contactPerson = String(raw.contactPerson || "").trim();
    const phone = String(phones.phone || raw.phone || "").trim();
    const email = String(raw.email || "").trim();
    if (isCompany) {
      const companyStreetCheck = String(raw.companyStreet || "").trim();
      const companyPostalCode = String(raw.companyPostalCode || "").replace(/\D/g, "").slice(0, 4);
      const companyCity = String(raw.companyCity || "").trim();
      let companyError = "";
      if (!displayName) companyError = "A cég neve kötelező.";
      else if (!companyStreetCheck) companyError = "Az utca, házszám kötelező.";
      else if (companyPostalCode.length !== 4) companyError = "Az irányítószám kötelező (4 számjegy).";
      else if (!companyCity) companyError = "A település kötelező.";
      else if (!contactPerson) companyError = "A kapcsolattartó neve kötelező.";
      else if (!phone) companyError = "A kapcsolattartó telefonszáma kötelező.";
      if (companyError) {
        status.textContent = companyError;
        status.className = "is-error";
        submit.disabled = false;
        submit.textContent = "Mentés";
        return;
      }
    } else if (!phone) {
      status.textContent = "Telefonszám kötelező.";
      status.className = "is-error";
      submit.disabled = false;
      submit.textContent = "Mentés";
      return;
    }
    try {
      if (isCompany) {
        const companyStreet = String(raw.companyStreet || "").trim();
        const companyPostalCode = String(raw.companyPostalCode || "").replace(/\D/g, "").slice(0, 4);
        const companyCity = String(raw.companyCity || "").trim();
        const ajanlas = readCompanyAjanlasPayload(form, ajanlasState);
        if (ajanlas.error) {
          status.textContent = ajanlas.error;
          status.className = "is-error";
          submit.disabled = false;
          submit.textContent = "Mentés";
          return;
        }
        const logoUrl = String(raw.logoUrl || "").trim();
        const companyLogoUrlVal = String(raw.companyLogoUrl || "").trim();
        const coverUrlVal = String(raw.coverUrl || "").trim();
        const description = String(raw.description || "").trim().slice(0, 4000);
        const website = String(raw.website || "").trim();
        const slug = String(raw.slug || profile.slug || "").trim();

        await saveProfile({
          ...getProfile(),
          company: displayName,
          companyListingName: String(raw.companyListingName || "").trim(),
          companyTaxId: String(raw.companyTaxId || "").trim(),
          companyActivities: activityIds,
          companyStreet,
          companyAddress: companyStreet,
          companyPostalCode,
          companyCity,
          companyCountry: String(raw.companyCountry || "Magyarország").trim() || "Magyarország",
          companyWorkRadiusKm: Number(raw.companyWorkRadiusKm) || 30,
          companyPhone: phone,
          companyPhone2: String(phones.companyPhone2 || "").trim(),
          companyPhone3: String(phones.companyPhone3 || "").trim(),
          companyEmail: email,
          companyEmail2: String(raw.companyEmail2 || "").trim(),
          salespersonName: String(raw.salespersonName || "").trim(),
          salespersonName2: String(raw.salespersonName2 || "").trim(),
          companyAvatarUrl: logoUrl,
          companyLogoUrl: companyLogoUrlVal,
          companyCoverUrl: coverUrlVal,
          companyDescription: description,
          website,
          ...ajanlas,
        });

        if (slug) {
          try {
            await jsonFetch("/api/partner-profiles/mine", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                displayName,
                slug,
                contactPerson,
                phone,
                email,
                commission: String(profile.commission || "0%").trim() || "0%",
                website,
                logoUrl,
                companyLogoUrl: companyLogoUrlVal,
                coverUrl: coverUrlVal,
                serviceAreas: companyCity || String(profile.service_areas || "").trim(),
                description,
                isPublic: profile.is_public !== false,
              }),
            });
          } catch {
            /* fiókmezők mentve; partner slug opcionális */
          }
        }

        syncManageSidebar(accountType);
        status.textContent = "Mentve.";
        status.className = "is-success";
      } else {
        const partnerPayload = {
          displayName,
          slug: String(raw.slug || "").trim(),
          contactPerson,
          phone,
          email,
          commission: String(raw.commission || "").trim(),
          website: String(raw.website || "").trim(),
          logoUrl: String(raw.logoUrl || "").trim(),
          companyLogoUrl: String(raw.companyLogoUrl || "").trim(),
          coverUrl: String(raw.coverUrl || "").trim(),
          serviceAreas: String(raw.serviceAreas || "").trim(),
          description: String(raw.description || "").trim(),
          isPublic: Boolean(form.elements.isPublic?.checked),
        };
        const result = await jsonFetch("/api/partner-profiles/mine", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(partnerPayload),
        });
        syncManageSidebar(accountType);
        status.textContent =
          result.profile.application_status === "approved"
            ? "Mentve."
            : "Mentve — a partnerjelentkezés jóváhagyásra vár.";
        status.className = "is-success";
      }
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
  // Egységes Ajánlások partner profil UI
  window.location.replace(`/ajanlas-partner.html?slug=${encodeURIComponent(slug)}`);
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
