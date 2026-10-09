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
} from "./db-client.js?v=6c1aeac308";

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

function iconStar() {
  return `<svg class="ap-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.7 6.6 19.6l1-6.1L3.2 9.2l6.1-.9L12 2.8z"/></svg>`;
}

function iconPin() {
  return `<svg class="ap-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.4" fill="currentColor"/></svg>`;
}

function iconPhone() {
  return `<svg class="ap-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M6.2 4.8c.7-.7 1.9-.7 2.6 0l1.4 1.4c.6.6.7 1.6.2 2.3l-.9 1.3a12.5 12.5 0 0 0 5.7 5.7l1.3-.9c.7-.5 1.7-.4 2.3.2l1.4 1.4c.7.7.7 1.9 0 2.6l-.8.8c-.8.8-2 1.1-3.1.7C10.5 18.4 5.6 13.5 3.7 7.7c-.4-1.1-.1-2.3.7-3.1l.8-.8z"/></svg>`;
}

function iconRoute() {
  return `<svg class="ap-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M6 19V9a3 3 0 0 1 3-3h7m0 0 2.5 2.5M16 6l2.5-2.5M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>`;
}

function iconMsg() {
  return `<svg class="ap-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" d="M5 6.5h10.5A2.5 2.5 0 0 1 18 9v5a2.5 2.5 0 0 1-2.5 2.5H10l-3.5 2.6V16.5H5A2.5 2.5 0 0 1 2.5 14V9A2.5 2.5 0 0 1 5 6.5z"/></svg>`;
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
  const call = telHref(phone);
  const maps = partner.google_maps_url || "";
  const website = safeUrl(partner.website);
  const email = String(partner.email || "").trim();
  const photo = safeUrl(partner.logo_url || partner.photo_url || partner.avatar_url);
  const companyLogo = safeUrl(partner.company_logo_url);
  const cover = safeUrl(partner.cover_url);
  const services = partner.services || [];
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

  root.innerHTML = `
    <div class="ap-toolbar">
      <p class="ap-crumb">
        <a href="/ajanlasok.html?vertical=${esc(vertical)}">Ajánlások</a>
        ${catFromQuery ? ` / <a href="${esc(listBack)}">${esc(categoryLabel(catFromQuery))}</a>` : ""}
        / <strong>${esc(name)}</strong>
      </p>
      ${
        canEdit
          ? `<button type="button" class="ap-edit-toggle${editMode ? " is-on" : ""}" data-ap-edit-toggle>
              ${editMode ? "Kész" : "Szerkesztés"}
            </button>`
          : ""
      }
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
              ? `<a class="ap-btn ap-btn--primary" href="${esc(call)}">${iconPhone()}<span>Hívás</span></a>`
              : ""
          }
          ${
            maps
              ? `<a class="ap-btn ap-btn--ghost" href="${esc(maps)}" target="_blank" rel="noopener noreferrer">${iconRoute()}<span>Útvonal</span></a>`
              : ""
          }
          ${
            email
              ? `<a class="ap-btn ap-btn--ghost" href="mailto:${esc(email)}">${iconMsg()}<span>Üzenet</span></a>`
              : ""
          }
          ${
            website
              ? `<a class="ap-btn ap-btn--ghost" href="${esc(website)}" target="_blank" rel="noopener noreferrer"><span>Weboldal</span></a>`
              : ""
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
        ${
          services.length
            ? `<div class="ap-tags">${services
                .map((id) => `<span class="ap-tag">${esc(categoryLabel(id))}</span>`)
                .join("")}</div>`
            : ""
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
    <section class="ap-band" id="ap-listings">
      <div class="ap-band-head">
        <h2>Hirdetéseik <span class="ap-count">${listings.length}</span></h2>
        ${listings.length ? `<a class="ap-all" href="#ap-listings">Összes</a>` : ""}
      </div>
      ${
        listings.length
          ? `<div class="ap-rail${listings.length > 4 ? " ap-rail--wrap" : ""}">${listings
              .map(listingTile)
              .join("")}</div>`
          : `<p class="ap-empty">A partnernek jelenleg nincs feladott hirdetése a Bymyn.</p>`
      }
    </section>
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
  };
  wireHeroEditor(root, editorCtx);
  wireBioEditor(root, editorCtx);
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

async function resolveEditAccess({ slug = "", sellerId = 0 } = {}) {
  const user = getAuthUser();
  if (!user?.email) return { canEdit: false, ownProfile: null, accountEdit: false };
  const own = await fetchOwnProfile().catch(() => null);
  const uid = Number(user.id || user.userId || 0);
  const ownsListing = sellerId > 0 && uid > 0 && uid === sellerId;
  const ownsSlug = Boolean(slug && own?.slug && own.slug === slug);
  if (ownsSlug || ownsListing) {
    return {
      canEdit: true,
      ownProfile: own?.slug ? own : null,
      // Listing/kereskedés oldal a fiók company*Url mezőiből olvas — mindig mentsünk oda is.
      accountEdit: true,
    };
  }
  return { canEdit: false, ownProfile: own, accountEdit: false };
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
    services: [],
    partnerSlug: contact?.partnerSlug || "",
  };
}

async function loadListingSellerPage(listingId) {
  const [contact, page] = await Promise.all([
    fetchSellerContact(listingId),
    fetchRelatedListingsPage(listingId, {
      limit: 60,
      offset: 0,
      includeSelf: true,
      tile: true,
    }),
  ]);
  if (!contact) throw new Error("Nincs megjeleníthető kereskedés / partner.");
  let rating = contact.rating || null;
  if (!rating || rating.average == null) {
    rating = await fetchSellerRating(listingId).catch(() => rating);
  }
  const listings = (page.listings || []).filter((item) => (item.status || "feladott") === "feladott");
  return {
    partner: partnerFromSellerContact(contact, rating),
    listings,
    sellerId: Number(contact.sellerId) || 0,
    listingId: String(listingId),
  };
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
      const loaded = await loadListingSellerPage(listingId);
      const access = await resolveEditAccess({
        slug: loaded.partner.partnerSlug || "",
        sellerId: loaded.sellerId,
      });
      // Ha van publikus partner slug és gazdagabb profil, töltsük be azt is (média/leírás).
      if (loaded.partner.partnerSlug) {
        try {
          const res = await fetch(
            `/api/partner-profiles/${encodeURIComponent(loaded.partner.partnerSlug)}`,
            { cache: "no-store" }
          );
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.profile) {
            const p = data.profile;
            const keptRating = loaded.partner.google_rating;
            const keptCount = loaded.partner.google_review_count;
            const keptPlace = {
              city: loaded.partner.city,
              county: loaded.partner.county,
              service_areas: loaded.partner.service_areas,
              address: loaded.partner.address,
            };
            loaded.partner = {
              ...loaded.partner,
              name: p.display_name || loaded.partner.name,
              phone: p.phone || loaded.partner.phone,
              email: p.email || loaded.partner.email,
              website: p.website || loaded.partner.website,
              logo_url: p.logo_url || loaded.partner.logo_url,
              company_logo_url: p.company_logo_url || loaded.partner.company_logo_url,
              cover_url: p.cover_url || loaded.partner.cover_url,
              contact_person: p.contact_person || loaded.partner.contact_person,
              description: p.description || loaded.partner.description,
              // Helyszín / értékelés: a seller-contact a forrásigazság
              ...keptPlace,
              google_rating: keptRating,
              google_review_count: keptCount,
            };
            if (Array.isArray(data.listings) && data.listings.length) {
              loaded.listings = data.listings;
            }
          }
        } catch {
          /* keep contact-based */
        }
      }
      renderProfile(root, loaded.partner, {
        listings: loaded.listings,
        backHref: `/hirdetes.html?id=${encodeURIComponent(listingId)}`,
        canEdit: access.canEdit,
        editMode: access.canEdit && wantEdit,
        ownProfile: access.ownProfile,
        accountEdit: true,
        listingId,
      });
      return;
    }

    if (slug) {
      const res = await fetch(`/api/partner-profiles/${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "A profil nem elérhető.");
      const profile = data.profile || {};
      const listings = data.listings || [];
      const access = await resolveEditAccess({
        slug,
        sellerId: Number(profile.user_id) || 0,
      });
      let google_rating = null;
      let google_review_count = null;
      const sampleListingId = listings.find((row) => Number(row?.id) > 0)?.id;
      if (sampleListingId) {
        try {
          const rating = await fetchSellerRating(sampleListingId);
          if (rating?.average != null) google_rating = Number(rating.average);
          if (rating?.count != null) google_review_count = Number(rating.count);
        } catch {
          /* optional */
        }
      }
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
          google_rating,
          google_review_count,
          services: [],
        },
        {
          listings,
          backHref: "/ajanlasok.html",
          canEdit: access.canEdit,
          editMode: access.canEdit && wantEdit,
          ownProfile: access.ownProfile,
          accountEdit: access.accountEdit,
          listingId: sampleListingId ? String(sampleListingId) : "",
        }
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

    const guessSlug = String(partner.slug || "")
      .trim()
      .toLowerCase();
    if (guessSlug) listings = await loadListingsForSlug(guessSlug);

    const access = await resolveEditAccess({ slug: guessSlug });
    renderProfile(root, partner, {
      listings,
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
