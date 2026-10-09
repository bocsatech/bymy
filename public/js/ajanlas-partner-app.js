import {
  PARTNER_CATEGORIES,
  partnerCategoryImageUrl,
} from "./partner-categories-data.js?v=b826a00c74";
import { uploadImage } from "./upload-image.js?v=3b023aae7a";
import {
  getAuthUser,
  getProfile,
  saveProfile,
  loadProfileFromServer,
} from "./site-auth.js?v=4588fd60ff";
import {
  fetchSellerContact,
  fetchSellerRating,
  fetchRelatedListingsPage,
  revealListingContact,
} from "./db-client.js?v=6c1aeac308";
import { openListingMessage, canMessageListing } from "./start-listing-message.js?v=d8693c3af4";

const CACHE_KEY = "bymy-ajanlas-partner-v1";

function syncHubBackLink(href, label) {
  const link = document.querySelector(".hub-header-actions a.hub-btn");
  if (!link || !href) return;
  link.setAttribute("href", href);
  link.textContent = label;
}

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
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^data:image\//i.test(raw)) return raw;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

/** Kereskedő értékelés (1–10) → fejléc: 5 csillag + szöveg. */
function ratingMetaHtml(average, count) {
  const avg = average != null && average !== "" ? Number(average) : null;
  const c = Number(count) || 0;
  const has = avg != null && Number.isFinite(avg) && c > 0;
  const filled = has ? Math.max(0, Math.min(5, Math.round((avg / 10) * 5))) : 0;
  const stars = Array.from({ length: 5 }, (_, i) => {
    const on = i < filled;
    return `<span class="ap-star${on ? " is-on" : ""}" aria-hidden="true">★</span>`;
  }).join("");
  let label = "Még nincs értékelés";
  if (has) {
    // Demó: 4,9 skála — 1–10 → felezve
    const show = (avg > 5 ? avg / 2 : avg).toFixed(1).replace(".", ",");
    label = `${show} (${c} ajánlás)`;
  }
  const title = has ? `${String(avg).replace(".", ",")} / 10` : "Még nincs értékelés";
  return `<span class="ap-meta-item ap-meta-item--star" title="${esc(title)}"><span class="ap-stars" role="img" aria-label="${esc(title)}">${stars}</span><strong>${esc(label)}</strong></span>`;
}

function formatPlaceMeta(partner) {
  const city = String(partner.city || "").trim();
  const county = String(partner.county || partner.megye || "").trim();
  if (city && county) return `${city}, ${county}`;
  if (city) return city;
  const areas = String(partner.service_areas || partner.address || "").trim();
  if (areas) return areas;
  return [partner.postal_code, partner.address].filter(Boolean).join(" ").trim();
}

function telHref(phone) {
  const digits = String(phone ?? "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

function categoryLabel(id) {
  return PARTNER_CATEGORIES.find((c) => c.id === id)?.label || id;
}

function categoryMeta(id) {
  return PARTNER_CATEGORIES.find((c) => c.id === id) || null;
}

function asIdList(value) {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return asIdList(parsed);
    } catch {
      /* comma */
    }
    return raw.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** Fiók companyAjanlasok* mezőiből (tulaj / fallback). */
function servicesFromAccount(profile) {
  if (!profile || profile.companyAjanlasok !== true) return [];
  const out = [];
  if (profile.companyAjanlasokAuto === true) {
    out.push(...asIdList(profile.companyAjanlasokAutoCats));
  }
  if (profile.companyAjanlasokIngatlan === true) {
    out.push(...asIdList(profile.companyAjanlasokIngatlanCats));
  }
  return [...new Set(out)];
}

function ajanlasIslandHtml(serviceIds, { canEdit = false } = {}) {
  const ids = (Array.isArray(serviceIds) ? serviceIds : []).map(String).filter(Boolean);
  const tiles = ids
    .map((id) => {
      const cat = categoryMeta(id);
      if (!cat) return "";
      const href = `/ajanlasok.html?vertical=${encodeURIComponent(cat.vertical)}&cat=${encodeURIComponent(cat.id)}`;
      const img = partnerCategoryImageUrl(cat);
      return `<a class="ap-ajanlas-tile" href="${esc(href)}">
        <span class="ap-ajanlas-tile__media"><img src="${esc(img)}" alt="" loading="lazy" decoding="async" /></span>
        <span class="ap-ajanlas-tile__label">${esc(cat.label)}</span>
      </a>`;
    })
    .filter(Boolean)
    .join("");

  if (!tiles && !canEdit) return "";

  return `
    <section class="ap-band ap-band--ajanlas" id="ap-ajanlasok">
      <div class="ap-band-head">
        <h2>Kiválasztott ajánlások ${ids.length ? `<span class="ap-count">${ids.length}</span>` : ""}</h2>
        ${
          canEdit
            ? `<a class="ap-all" href="/beallitasok.html?szekcio=partner-profil">Szerkesztés</a>`
            : ""
        }
      </div>
      ${
        tiles
          ? `<div class="ap-ajanlas-rail">${tiles}</div>`
          : `<p class="ap-empty">Még nincs kiválasztott ajánlás. A Beállításokban kapcsold be a céges ajánlásokat.</p>`
      }
    </section>
  `;
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
  const media = image ? `style="background-image:url('${esc(image)}')"` : "";
  return `<a class="ap-tile" href="/hirdetes.html?id=${encodeURIComponent(listing.id)}">
    <div class="ap-tile-media" ${media}></div>
    <div class="ap-tile-body">
      <span class="ap-tile-cat">${esc(vertical)}</span>
      <strong>${esc(title)}</strong>
      <span class="ap-tile-price">${esc(price)}</span>
    </div>
  </a>`;
}

function iconPin() {
  return `<svg class="ap-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.4" fill="currentColor"/></svg>`;
}

function iconPhone() {
  return `<svg class="ap-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M6.2 4.8c.7-.7 1.9-.7 2.6 0l1.4 1.4c.6.6.7 1.6.2 2.3l-.9 1.3a12.5 12.5 0 0 0 5.7 5.7l1.3-.9c.7-.5 1.7-.4 2.3.2l1.4 1.4c.7.7.7 1.9 0 2.6l-.8.8c-.8.8-2 1.1-3.1.7C10.5 18.4 5.6 13.5 3.7 7.7c-.4-1.1-.1-2.3.7-3.1l.8-.8z"/></svg>`;
}

/** Share / kapcsolódó csomópontok — Üzenet gomb a demó szerint. */
function iconShareNodes() {
  return `<svg class="ap-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="6.5" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="17.5" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M8 11.2 15.8 7.4M8 12.8l7.8 3.8"/></svg>`;
}

function mediaSlot(kind, label, editMode) {
  if (!editMode) return "";
  return `<button type="button" class="ap-media-edit" data-ap-media="${esc(kind)}" aria-label="${esc(label)} cseréje" title="${esc(label)} cseréje">
    <span>Csere</span>
  </button>`;
}

function renderProfile(root, partner, opts = {}) {
  const {
    listings = [],
    backHref = "/ajanlasok.html",
    editMode = false,
    canEdit = false,
    ownProfile = null,
  } = opts;
  const name = partner.name || partner.display_name || "Partner";
  const phone = String(partner.phone || "").trim();
  const email = String(partner.email || "").trim();
  const call = telHref(phone);
  const placeForMaps = formatPlaceMeta(partner) || String(partner.service_areas || partner.address || "").trim();
  const maps =
    partner.google_maps_url ||
    (placeForMaps
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeForMaps)}`
      : "");
  const photo = safeUrl(partner.logo_url || partner.photo_url || partner.avatar_url);
  const listingId = opts.listingId || "";
  const sellerId = Number(partner.id || partner.sellerId || 0);
  const canMsg = canMessageListing(sellerId > 0 ? sellerId : undefined, { listingId });
  const companyLogo = safeUrl(partner.company_logo_url);
  const cover = safeUrl(partner.cover_url);
  const services = (() => {
    const fromPartner = Array.isArray(partner.services) ? partner.services.filter(Boolean) : [];
    if (fromPartner.length) return fromPartner;
    if (canEdit) return servicesFromAccount(getProfile());
    return [];
  })();
  const ratingHtml = ratingMetaHtml(partner.google_rating, partner.google_review_count);
  const place = formatPlaceMeta(partner);
  const hours = partner.opening_hours || "";
  const role = services.length
    ? services.map(categoryLabel).join(" • ")
    : partner.contact_person
      ? String(partner.contact_person)
      : "Ajánlott szolgáltató";
  const catFromQuery = new URLSearchParams(location.search).get("cat") || "";
  const vertical = new URLSearchParams(location.search).get("vertical") || "auto";
  const listBack = catFromQuery
    ? `/ajanlasok.html?vertical=${encodeURIComponent(vertical)}&cat=${encodeURIComponent(catFromQuery)}`
    : backHref;

  const defaultCover =
    "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1600&q=70";
  const coverUrl = cover || defaultCover;
  const editClass = editMode ? " is-editing" : "";

  const menuBackHref = "/beallitasok.html?szekcio=hirdetes";
  syncHubBackLink(canEdit ? menuBackHref : listBack, canEdit ? "← Saját menü" : "← Ajánlások");

  root.innerHTML = `
    <div class="ap-toolbar">
      <p class="ap-crumb">
        ${
          canEdit
            ? `<a href="${esc(menuBackHref)}">Saját menü</a>`
            : `<a href="/ajanlasok.html?vertical=${esc(vertical)}">Ajánlások</a>`
        }
        ${!canEdit && catFromQuery ? ` / <a href="${esc(listBack)}">${esc(categoryLabel(catFromQuery))}</a>` : ""}
        / <strong>${esc(name)}</strong>
      </p>
      <div class="ap-toolbar-actions">
        ${
          canEdit
            ? `<a class="ap-back-menu" href="${esc(menuBackHref)}">← Saját menü</a>`
            : ""
        }
        ${
          canEdit
            ? `<button type="button" class="ap-edit-toggle${editMode ? " is-on" : ""}" data-ap-edit-toggle>
                ${editMode ? "Kész" : "Szerkesztés"}
              </button>`
            : ""
        }
      </div>
    </div>
    <section class="ap-hero${editClass}" data-ap-hero>
      <div class="ap-hero-cover" data-ap-cover style="--ap-cover:url('${esc(coverUrl)}')"></div>
      <div class="ap-hero-shade" aria-hidden="true"></div>
      ${mediaSlot("cover", "Háttérkép", editMode)}
      <div class="ap-hero-inner">
        <div class="ap-hero-left">
          <div class="ap-photos">
            <span class="ap-photo-person" data-ap-slot="avatar">
              ${photo ? `<img src="${esc(photo)}" alt="" />` : `<span>${initial(name)}</span>`}
              ${mediaSlot("avatar", "Profilkép", editMode)}
            </span>
            <span class="ap-photo-logo" data-ap-slot="logo">
              ${
                companyLogo
                  ? `<img src="${esc(companyLogo)}" alt="" />`
                  : services[0]
                    ? `<img src="${esc(partnerCategoryImageUrl(services[0]))}" alt="" />`
                    : `<span>${initial(name)}</span>`
              }
              ${mediaSlot("logo", "Céglogó", editMode)}
            </span>
          </div>
          <div class="ap-hero-copy">
            <h1>${esc(name)}</h1>
            <p class="ap-role">${esc(role)}</p>
            <p class="ap-meta">
              ${ratingHtml}
              ${place ? `<span class="ap-meta-sep" aria-hidden="true"></span>` : ""}
              ${
                place
                  ? `<span class="ap-meta-item">${iconPin()}<span>${esc(place)}</span></span>`
                  : ""
              }
            </p>
          </div>
        </div>
        <div class="ap-hero-cta">
          ${
            call
              ? `<a class="ap-btn ap-btn--primary" href="${esc(call)}" data-ap-call>${iconPhone()}<span>Hívás</span></a>`
              : `<button type="button" class="ap-btn ap-btn--primary" data-ap-call ${listingId ? "" : "disabled"}>${iconPhone()}<span>Hívás</span></button>`
          }
          ${
            maps
              ? `<a class="ap-btn ap-btn--ghost" href="${esc(maps)}" target="_blank" rel="noopener noreferrer"><span>Útvonal</span></a>`
              : `<button type="button" class="ap-btn ap-btn--ghost" disabled><span>Útvonal</span></button>`
          }
          ${
            canMsg && listingId
              ? `<button type="button" class="ap-btn ap-btn--ghost" data-ap-msg>${iconShareNodes()}<span>Üzenet</span></button>`
              : partner.email
                ? `<a class="ap-btn ap-btn--ghost" href="mailto:${esc(partner.email)}">${iconShareNodes()}<span>Üzenet</span></a>`
                : `<button type="button" class="ap-btn ap-btn--ghost" disabled>${iconShareNodes()}<span>Üzenet</span></button>`
          }
        </div>
      </div>
      <input type="file" accept="image/*" hidden data-ap-file />
      ${editMode ? `<p class="ap-edit-hint" data-ap-edit-status>Kattints a háttérre, profilképre vagy logóra a cseréhez. A bemutatást lent szerkesztheted.</p>` : ""}
    </section>
    <div class="ap-grid">
      <section class="ap-card" data-ap-bio-card>
        <h2>Tevékenység bemutatása</h2>
        ${
          editMode && canEdit
            ? `<textarea class="ap-bio-input" data-ap-bio-input maxlength="4000" rows="6" placeholder="Írd le a tevékenységet, szolgáltatásokat, területet…">${esc(
                String(partner.description || buildBio(partner))
              )}</textarea>
               <div class="ap-bio-actions">
                 <button type="button" class="ap-btn ap-btn--save" data-ap-bio-save>Bemutatás mentése</button>
                 <span class="ap-bio-status" data-ap-bio-status role="status"></span>
               </div>`
            : `<p data-ap-bio-text>${esc(buildBio(partner))}</p>`
        }
        ${hours ? `<p class="ap-hours">Nyitva: ${esc(hours)}</p>` : ""}
      </section>
      <section class="ap-card">
        <h2>Vállalkozás adatai</h2>
        <dl class="ap-dl">
          <dt>Cégnév</dt><dd>${esc(name)}</dd>
          ${partner.contact_person ? `<dt>Kapcsolat</dt><dd>${esc(partner.contact_person)}</dd>` : ""}
          ${place ? `<dt>Cím</dt><dd>${esc(place)}</dd>` : ""}
          ${phone ? `<dt>Telefon</dt><dd>${esc(phone)}</dd>` : ""}
          ${email ? `<dt>E-mail</dt><dd>${esc(email)}</dd>` : ""}
          ${hours ? `<dt>Nyitva</dt><dd>${esc(hours)}</dd>` : ""}
        </dl>
      </section>
    </div>
    ${ajanlasIslandHtml(services, { canEdit })}
    ${listingsBandHtml(listings, { loading: Boolean(opts.listingsLoading) })}
  `;
  document.title = `${name} — Partner profil — Bymy`;
  const editorCtx = {
    partner,
    listings,
    backHref,
    editMode,
    canEdit,
    ownProfile,
    accountEdit: Boolean(opts.accountEdit),
    listingId: opts.listingId || "",
    listingsLoading: Boolean(opts.listingsLoading),
  };
  wireHeroEditor(root, editorCtx);
  wireBioEditor(root, editorCtx);
  wireHeroCta(root, {
    listingId,
    sellerId,
    name,
    phone,
    canMsg,
  });
}

function listingsBandHtml(listings = [], { loading = false } = {}) {
  const rows = Array.isArray(listings) ? listings : [];
  return `
    <section class="ap-band" id="ap-listings">
      <div class="ap-band-head">
        <h2>Hirdetéseik ${
          loading && !rows.length
            ? `<span class="ap-count ap-count--muted">…</span>`
            : `<span class="ap-count">${rows.length}</span>`
        }</h2>
        ${rows.length ? `<a class="ap-all" href="#ap-listings">Összes</a>` : ""}
      </div>
      ${
        rows.length
          ? `<div class="ap-rail${rows.length > 4 ? " ap-rail--wrap" : ""}">${rows
              .map(listingTile)
              .join("")}</div>`
          : loading
            ? `<p class="ap-empty">Hirdetések betöltése…</p>`
            : `<p class="ap-empty">A partnernek jelenleg nincs feladott hirdetése a Bymyn.</p>`
      }
    </section>
  `;
}

function paintListings(root, listings) {
  const band = root.querySelector("#ap-listings");
  if (!band) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = listingsBandHtml(listings, { loading: false }).trim();
  const next = wrap.firstElementChild;
  if (next) band.replaceWith(next);
}

function paintRatingMeta(root, partner) {
  const meta = root.querySelector(".ap-meta");
  if (!meta) return;
  const place = formatPlaceMeta(partner);
  meta.innerHTML = `
    ${ratingMetaHtml(partner.google_rating, partner.google_review_count)}
    ${place ? `<span class="ap-meta-sep" aria-hidden="true"></span>` : ""}
    ${
      place
        ? `<span class="ap-meta-item">${iconPin()}<span>${esc(place)}</span></span>`
        : ""
    }
  `;
}

function wireHeroCta(root, { listingId, sellerId, name, phone, canMsg }) {
  const callBtn = root.querySelector("[data-ap-call]");
  if (callBtn && callBtn.tagName === "BUTTON" && listingId) {
    callBtn.addEventListener("click", async () => {
      callBtn.disabled = true;
      try {
        const revealed = await revealListingContact(listingId, "");
        const nextPhone = String(revealed.phone || revealed.phones?.[0] || "").trim();
        const href = telHref(nextPhone);
        if (!href) throw new Error("Nincs telefonszám.");
        window.location.href = href;
      } catch (error) {
        callBtn.disabled = false;
        window.alert(error?.message || "A hívás most nem elérhető.");
      }
    });
  }

  root.querySelector("[data-ap-msg]")?.addEventListener("click", async () => {
    if (!canMsg || !listingId) return;
    try {
      await openListingMessage({
        listingId,
        sellerId,
        sellerName: name,
        title: name,
      });
    } catch (error) {
      window.alert(error?.message || "Az üzenet indítása sikertelen.");
    }
  });
}

async function fetchOwnProfile() {
  const res = await fetch("/api/partner-profiles/mine", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.profile || null;
}

async function saveOwnMedia(ownProfile, patch) {
  const body = {
    displayName: ownProfile.display_name,
    slug: ownProfile.slug,
    contactPerson: ownProfile.contact_person || "",
    phone: ownProfile.phone,
    email: ownProfile.email,
    commission: ownProfile.commission || "0%",
    website: ownProfile.website || "",
    logoUrl: patch.logo_url ?? ownProfile.logo_url ?? "",
    companyLogoUrl: patch.company_logo_url ?? ownProfile.company_logo_url ?? "",
    coverUrl: patch.cover_url ?? ownProfile.cover_url ?? "",
    serviceAreas: ownProfile.service_areas || "",
    description: patch.description != null ? patch.description : ownProfile.description || "",
    isPublic: ownProfile.is_public !== false,
  };
  const res = await fetch("/api/partner-profiles/mine", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "A mentés sikertelen.");
  return data.profile;
}

async function saveAccountMedia(patch) {
  try {
    await loadProfileFromServer();
  } catch {
    /* local profile */
  }
  const cur = getProfile();
  const next = {
    ...cur,
    companyCoverUrl: patch.cover_url != null ? patch.cover_url : cur.companyCoverUrl || "",
    companyLogoUrl: patch.company_logo_url != null ? patch.company_logo_url : cur.companyLogoUrl || "",
    companyAvatarUrl: patch.logo_url != null ? patch.logo_url : cur.companyAvatarUrl || "",
    companyDescription:
      patch.description != null ? patch.description : cur.companyDescription || "",
  };
  await saveProfile(next);
  return next;
}

async function persistPartnerFields(ctx, patch) {
  const errors = [];
  let ownProfile = ctx.ownProfile;
  // Mindig a fiókprofilba is mentünk — a listing / kereskedés oldal innen olvassa vissza.
  if (ctx.accountEdit || ctx.listingId || !ctx.ownProfile) {
    try {
      await saveAccountMedia(patch);
    } catch (error) {
      errors.push(error?.message || "Fiókprofil mentés sikertelen.");
    }
  }
  if (ctx.ownProfile) {
    try {
      ownProfile = await saveOwnMedia(ctx.ownProfile, {
        logo_url: patch.logo_url ?? ctx.ownProfile.logo_url,
        company_logo_url: patch.company_logo_url ?? ctx.ownProfile.company_logo_url,
        cover_url: patch.cover_url ?? ctx.ownProfile.cover_url,
        description: patch.description != null ? patch.description : ctx.ownProfile.description,
      });
    } catch (error) {
      errors.push(error?.message || "Partnerprofil mentés sikertelen.");
    }
  }
  if (errors.length && !ownProfile && ctx.ownProfile == null && ctx.accountEdit === false) {
    throw new Error(errors[0]);
  }
  if (errors.length === 2) throw new Error(errors[0]);
  return { ownProfile, warn: errors[0] || "" };
}

const persistMedia = persistPartnerFields;

function wireHeroEditor(root, ctx) {
  const toggle = root.querySelector("[data-ap-edit-toggle]");
  toggle?.addEventListener("click", () => {
    const url = new URL(location.href);
    if (ctx.editMode) url.searchParams.delete("szerkeszt");
    else url.searchParams.set("szerkeszt", "1");
    history.replaceState({}, "", url);
    renderProfile(root, ctx.partner, { ...ctx, editMode: !ctx.editMode });
  });

  const canSaveMedia = Boolean(ctx.canEdit && (ctx.ownProfile || ctx.accountEdit || ctx.listingId));
  if (!ctx.editMode || !canSaveMedia) return;

  const fileInput = root.querySelector("[data-ap-file]");
  const status = root.querySelector("[data-ap-edit-status]");
  let pendingKind = "";

  async function applyFile(file) {
    if (!file || !pendingKind) return;
    const kind = pendingKind;
    pendingKind = "";
    if (status) status.textContent = "Feltöltés…";
    try {
      const uploaded = await uploadImage({
        file,
        kind: "profile",
        entityType: "profile",
        folder: "partner-profile",
      });
      const url = String(uploaded.url || uploaded.publicUrl || uploaded.href || "").trim();
      if (!url) throw new Error("Nincs kép URL a feltöltés után.");
      const patch =
        kind === "cover"
          ? { cover_url: url }
          : kind === "logo"
            ? { company_logo_url: url }
            : { logo_url: url };
      const { ownProfile, warn } = await persistMedia({ ...ctx, accountEdit: true }, patch);
      const nextPartner = {
        ...ctx.partner,
        logo_url: patch.logo_url ?? ctx.partner.logo_url,
        company_logo_url: patch.company_logo_url ?? ctx.partner.company_logo_url,
        cover_url: patch.cover_url ?? ctx.partner.cover_url,
      };
      if (ownProfile) {
        nextPartner.logo_url = ownProfile.logo_url || nextPartner.logo_url;
        nextPartner.company_logo_url = ownProfile.company_logo_url || nextPartner.company_logo_url;
        nextPartner.cover_url = ownProfile.cover_url || nextPartner.cover_url;
      }
      if (status) status.textContent = warn ? `Mentve (figyelem: ${warn})` : "Mentve.";
      renderProfile(root, nextPartner, {
        ...ctx,
        partner: nextPartner,
        ownProfile: ownProfile || ctx.ownProfile,
        accountEdit: true,
        editMode: true,
      });
    } catch (error) {
      if (status) status.textContent = error.message || "Hiba a cserénél.";
    }
  }

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    void applyFile(file);
  });

  root.querySelectorAll("[data-ap-media]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      pendingKind = btn.getAttribute("data-ap-media") || "";
      fileInput?.click();
    });
  });

  root.querySelector("[data-ap-cover]")?.addEventListener("click", () => {
    if (!ctx.editMode) return;
    pendingKind = "cover";
    fileInput?.click();
  });
}

function wireBioEditor(root, ctx) {
  const canSave = Boolean(ctx.editMode && ctx.canEdit && (ctx.ownProfile || ctx.accountEdit || ctx.listingId));
  if (!canSave) return;
  const input = root.querySelector("[data-ap-bio-input]");
  const saveBtn = root.querySelector("[data-ap-bio-save]");
  const status = root.querySelector("[data-ap-bio-status]");
  if (!(input instanceof HTMLTextAreaElement) || !saveBtn) return;

  saveBtn.addEventListener("click", async () => {
    const text = String(input.value || "").trim().slice(0, 4000);
    saveBtn.disabled = true;
    if (status) status.textContent = "Mentés…";
    try {
      const { ownProfile, warn } = await persistPartnerFields(
        { ...ctx, accountEdit: true },
        { description: text }
      );
      const nextPartner = { ...ctx.partner, description: text };
      if (status) status.textContent = warn ? `Mentve (figyelem: ${warn})` : "Mentve.";
      renderProfile(root, nextPartner, {
        ...ctx,
        partner: nextPartner,
        ownProfile: ownProfile || ctx.ownProfile,
        accountEdit: true,
        editMode: true,
      });
    } catch (error) {
      if (status) status.textContent = error.message || "A mentés sikertelen.";
      saveBtn.disabled = false;
    }
  });
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

const SHELL_CACHE_TTL_MS = 60_000;

function shellCacheKey(kind, id) {
  return `bymy-ap-shell-v1:${kind}:${id}`;
}

function readShellCache(kind, id) {
  try {
    const raw = sessionStorage.getItem(shellCacheKey(kind, id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || Date.now() - parsed.at > SHELL_CACHE_TTL_MS) return null;
    return parsed.partner || null;
  } catch {
    return null;
  }
}

function writeShellCache(kind, id, partner) {
  try {
    sessionStorage.setItem(
      shellCacheKey(kind, id),
      JSON.stringify({ at: Date.now(), partner })
    );
  } catch {
    /* quota / private */
  }
}

function quickCanEdit(sellerId = 0, slug = "", ownSlug = "") {
  const user = getAuthUser();
  if (!user?.email) return false;
  const uid = Number(user.id || user.userId || 0);
  if (sellerId > 0 && uid > 0 && uid === Number(sellerId)) return true;
  if (slug && ownSlug && slug === ownSlug) return true;
  return false;
}

async function resolveEditAccess({ slug = "", sellerId = 0, ownProfile = null } = {}) {
  const user = getAuthUser();
  if (!user?.email) return { canEdit: false, ownProfile: null, accountEdit: false };
  const own = ownProfile !== undefined ? ownProfile : await fetchOwnProfile().catch(() => null);
  const ownsListing = quickCanEdit(sellerId);
  const ownsSlug = Boolean(slug && own?.slug && own.slug === slug);
  if (ownsSlug || ownsListing) {
    return {
      canEdit: true,
      ownProfile: own?.slug ? own : null,
      accountEdit: true,
    };
  }
  return { canEdit: false, ownProfile: own, accountEdit: false };
}

/** Csak akkor kell a slug API, ha a seller-contact még szegényes. */
function partnerNeedsEnrichment(partner) {
  if (!partner?.partnerSlug) return false;
  const hasMedia = Boolean(
    partner.cover_url || partner.logo_url || partner.company_logo_url
  );
  const hasDesc = Boolean(String(partner.description || "").trim());
  const hasServices = Array.isArray(partner.services) && partner.services.length > 0;
  return !(hasMedia && (hasDesc || hasServices));
}

async function enrichPartnerFromSlug(partner) {
  const slug = String(partner?.partnerSlug || "").trim();
  if (!slug || !partnerNeedsEnrichment(partner)) {
    return { partner, listings: null };
  }
  try {
    const res = await fetch(`/api/partner-profiles/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.profile) return { partner, listings: null };
    const p = data.profile;
    const keptPlace = {
      city: partner.city,
      county: partner.county,
      service_areas: partner.service_areas,
      address: partner.address,
    };
    return {
      partner: {
        ...partner,
        name: p.display_name || partner.name,
        phone: p.phone || partner.phone,
        email: p.email || partner.email,
        website: p.website || partner.website,
        logo_url: p.logo_url || partner.logo_url,
        company_logo_url: p.company_logo_url || partner.company_logo_url,
        cover_url: p.cover_url || partner.cover_url,
        contact_person: p.contact_person || partner.contact_person,
        description: p.description || partner.description,
        services:
          Array.isArray(p.services) && p.services.length ? p.services : partner.services,
        google_rating: partner.google_rating,
        google_review_count: partner.google_review_count,
        ...keptPlace,
      },
      listings: Array.isArray(data.listings) ? data.listings : null,
    };
  } catch {
    return { partner, listings: null };
  }
}

function partnerFromSellerContact(contact, rating) {
  const lines = Array.isArray(contact?.addressLines) ? contact.addressLines.filter(Boolean) : [];
  const place = lines.join(", ");
  // Utolsó sor gyakran: "8000 Székesfehérvár Fejér" vagy "Székesfehérvár, Fejér"
  let city = "";
  let county = "";
  const locLine = lines.length > 1 ? lines[lines.length - 1] : lines[0] || "";
  const locParts = String(locLine)
    .replace(/^\d{4}\s*/, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (locParts.length >= 2) {
    city = locParts[0];
    const rawCounty = locParts[1].replace(/\s*megye$/i, "").trim();
    county = rawCounty ? `${rawCounty} megye` : "";
  } else if (locParts.length === 1) {
    const bits = locParts[0].split(/\s+/).filter(Boolean);
    if (bits.length >= 2 && /megye$/i.test(bits[bits.length - 1] || "")) {
      county = bits[bits.length - 1];
      city = bits.slice(0, -1).join(" ");
    } else if (bits.length >= 2) {
      county = `${bits[bits.length - 1]} megye`;
      city = bits.slice(0, -1).join(" ");
    } else {
      city = locParts[0];
    }
  }
  const ratingSrc = rating || contact?.rating || null;
  const avg = ratingSrc?.average != null ? Number(ratingSrc.average) : null;
  const count = ratingSrc?.count != null ? Number(ratingSrc.count) : null;
  return {
    id: contact?.sellerId || 0,
    name: contact?.sellerName || "Hirdető",
    display_name: contact?.sellerName || "Hirdető",
    phone: "",
    email: contact?.email || "",
    website: contact?.website || "",
    logo_url: contact?.sellerAvatarUrl || "",
    company_logo_url: contact?.companyLogoUrl || "",
    cover_url: contact?.coverUrl || "",
    contact_person: contact?.contactPerson || "",
    service_areas: place,
    address: place,
    city,
    county,
    description: contact?.description || "",
    google_maps_url: contact?.mapQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.mapQuery)}`
      : "",
    google_rating: avg != null && Number.isFinite(avg) ? avg : null,
    google_review_count: count,
    services: Array.isArray(contact?.services) ? contact.services.filter(Boolean) : [],
    partnerSlug: contact?.partnerSlug || "",
  };
}

function filterActiveListings(list) {
  return (list || []).filter((item) => (item.status || "feladott") === "feladott");
}

async function initListingPartnerPage(root, listingId, wantEdit) {
  const backHref = `/hirdetes.html?id=${encodeURIComponent(listingId)}`;
  const cached = readShellCache("listing", listingId);
  const loggedIn = Boolean(getAuthUser()?.email);

  const contactP = fetchSellerContact(listingId);
  const listingsP = fetchRelatedListingsPage(listingId, {
    limit: 60,
    offset: 0,
    includeSelf: true,
    tile: true,
  });
  const profileP = loggedIn ? loadProfileFromServer().catch(() => null) : Promise.resolve(null);
  const ownP = loggedIn ? fetchOwnProfile().catch(() => null) : Promise.resolve(null);

  // 1) Cache → azonnali shell (ha van)
  if (cached) {
    renderProfile(root, cached, {
      listings: [],
      listingsLoading: true,
      backHref,
      canEdit: quickCanEdit(cached.id || cached.sellerId, cached.partnerSlug || ""),
      editMode: false,
      ownProfile: null,
      accountEdit: true,
      listingId,
    });
  }

  // 2) Contact megjön → első / friss shell
  const contact = await contactP;
  if (!contact) throw new Error("Nincs megjeleníthető kereskedés / partner.");
  let partner = partnerFromSellerContact(contact, contact.rating || null);
  const sellerId = Number(contact.sellerId) || 0;
  writeShellCache("listing", listingId, partner);

  const canEditQuick = quickCanEdit(sellerId, partner.partnerSlug || "");
  renderProfile(root, partner, {
    listings: [],
    listingsLoading: true,
    backHref,
    canEdit: canEditQuick,
    editMode: canEditQuick && wantEdit,
    ownProfile: null,
    accountEdit: true,
    listingId,
  });

  // 3) Lista + auth + opcionális enrich párhuzamosan
  const enrichP = enrichPartnerFromSlug(partner);
  const [page, ownProfile, , enrich] = await Promise.all([
    listingsP,
    ownP,
    profileP,
    enrichP,
  ]);
  let listings = filterActiveListings(page?.listings);
  let didEnrich = false;
  if (enrich.partner !== partner) {
    partner = enrich.partner;
    didEnrich = true;
    writeShellCache("listing", listingId, partner);
    if (Array.isArray(enrich.listings) && enrich.listings.length && !listings.length) {
      listings = filterActiveListings(enrich.listings);
    }
  }

  const access = await resolveEditAccess({
    slug: partner.partnerSlug || "",
    sellerId,
    ownProfile,
  });
  // Lista kész: ha csak a sín változott, ne rajzoljuk újra a teljes herót
  if (!didEnrich && access.canEdit === canEditQuick && !access.ownProfile) {
    paintListings(root, listings);
  } else {
    renderProfile(root, partner, {
      listings,
      listingsLoading: false,
      backHref,
      canEdit: access.canEdit,
      editMode: access.canEdit && wantEdit,
      ownProfile: access.ownProfile,
      accountEdit: true,
      listingId,
    });
  }

  // 4) Rating háttérben, ha még nincs
  if (partner.google_rating == null) {
    fetchSellerRating(listingId)
      .then((rating) => {
        if (!rating || rating.average == null) return;
        partner = {
          ...partner,
          google_rating: Number(rating.average),
          google_review_count: Number(rating.count) || 0,
        };
        writeShellCache("listing", listingId, partner);
        paintRatingMeta(root, partner);
      })
      .catch(() => {});
  }
}

async function initSlugPartnerPage(root, slug, wantEdit) {
  const cached = readShellCache("slug", slug);
  const loggedIn = Boolean(getAuthUser()?.email);
  const profileP = loggedIn ? loadProfileFromServer().catch(() => null) : Promise.resolve(null);
  const ownP = loggedIn ? fetchOwnProfile().catch(() => null) : Promise.resolve(null);
  const pageP = fetch(`/api/partner-profiles/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "A profil nem elérhető.");
    return data;
  });

  if (cached) {
    renderProfile(root, cached, {
      listings: [],
      listingsLoading: true,
      backHref: "/ajanlasok.html",
      canEdit: quickCanEdit(cached.id, slug, ""),
      editMode: false,
      ownProfile: null,
      accountEdit: false,
      listingId: "",
    });
  }

  const [data, ownProfile] = await Promise.all([pageP, ownP, profileP]);
  const profile = data.profile || {};
  const listings = filterActiveListings(data.listings || []);
  const sampleListingId = listings.find((row) => Number(row?.id) > 0)?.id;
  let partner = {
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
    google_rating: null,
    google_review_count: null,
    services: Array.isArray(profile.services) ? profile.services.filter(Boolean) : [],
    partnerSlug: slug,
  };
  writeShellCache("slug", slug, partner);

  const access = await resolveEditAccess({
    slug,
    sellerId: Number(profile.user_id) || 0,
    ownProfile,
  });
  renderProfile(root, partner, {
    listings,
    listingsLoading: false,
    backHref: "/ajanlasok.html",
    canEdit: access.canEdit,
    editMode: access.canEdit && wantEdit,
    ownProfile: access.ownProfile,
    accountEdit: access.accountEdit,
    listingId: sampleListingId ? String(sampleListingId) : "",
  });

  if (sampleListingId) {
    fetchSellerRating(sampleListingId)
      .then((rating) => {
        if (!rating || rating.average == null) return;
        partner = {
          ...partner,
          google_rating: Number(rating.average),
          google_review_count: Number(rating.count) || 0,
        };
        writeShellCache("slug", slug, partner);
        paintRatingMeta(root, partner);
      })
      .catch(() => {});
  }
}

async function init() {
  const root = document.getElementById("ajanlas-partner-root");
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "";
  const slug = params.get("slug") || "";
  const listingId = params.get("listing") || params.get("hirdeto") || "";
  const wantEdit = params.get("szerkeszt") === "1";

  try {
    if (listingId) {
      await initListingPartnerPage(root, listingId, wantEdit);
      return;
    }

    if (slug) {
      await initSlugPartnerPage(root, slug, wantEdit);
      return;
    }

    if (!id) throw new Error("Hiányzó partnerazonosító.");

    const loggedIn = Boolean(getAuthUser()?.email);
    const profileP = loggedIn ? loadProfileFromServer().catch(() => null) : Promise.resolve(null);
    const ownP = loggedIn ? fetchOwnProfile().catch(() => null) : Promise.resolve(null);

    let partner = null;
    if (/^\d+$/.test(id)) {
      const res = await fetch(`/api/partners/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.partner) partner = data.partner;
    }
    if (!partner) partner = readCache(id);
    if (!partner) throw new Error("Nincs ilyen partner.");

    const guessSlug = String(partner.slug || "")
      .trim()
      .toLowerCase();

    renderProfile(root, partner, {
      listings: [],
      listingsLoading: Boolean(guessSlug),
      backHref: "/ajanlasok.html",
      canEdit: false,
      editMode: false,
      ownProfile: null,
      accountEdit: false,
    });

    const [listings, , ownProfile] = await Promise.all([
      guessSlug ? loadListingsForSlug(guessSlug) : Promise.resolve([]),
      profileP,
      ownP,
    ]);
    const access = await resolveEditAccess({ slug: guessSlug, ownProfile });
    renderProfile(root, partner, {
      listings,
      listingsLoading: false,
      backHref: "/ajanlasok.html",
      canEdit: access.canEdit,
      editMode: access.canEdit && wantEdit,
      ownProfile: access.ownProfile,
      accountEdit: access.accountEdit,
    });
  } catch (error) {
    root.innerHTML = `<div class="ap-error"><strong>A partnerprofil nem tölthető be.</strong><p>${esc(
      error.message
    )}</p><a class="ap-btn" href="/ajanlasok.html">Vissza az Ajánlásokhoz</a></div>`;
  }
}

init();
