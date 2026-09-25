import {
  fetchListing,
  fetchRelatedListings,
  fetchSellerRating,
  revealListingContact,
  recordListingView,
  deleteListingFromDb,
} from "./db-client.js?v=secReveal1";
import { getAuthUser, getDisplayName, getProfile } from "./site-auth.js?v=auth20260805localdb9";
import { mountTurnstile } from "./turnstile-ui.js?v=turnstile10";
import { startConversation } from "./messages-api.js?v=msgLive2";
import { openListingMessage } from "./start-listing-message.js?v=msgLive2";
import { getParkplatz, addParkplatzItem, removeParkplatzItem } from "./fok-data.js?v=parkThumb1";
import { listingReturnHref, listingDetailHref, rememberListingOpen, getListingSearchNav, touchListingReturnId } from "./listing-return.js?v=searchNav1";

const root = document.getElementById("hd-root");
const ICON = {
  back: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 6 9 12l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  prev: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  close: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  star: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="m12 3.6 2.1 4.4 4.8.5-3.6 3.1 1.1 4.7L12 14.2 7.6 16.3l1.1-4.7-3.6-3.1 4.8-.5L12 3.6Z" stroke="currentColor" stroke-width="1.6"/></svg>`,
  share: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M16 8a3 3 0 1 0-2.8-4M8 12a3 3 0 1 0 0 0.01M16 20a3 3 0 1 0-2.8-4M8.7 13.2l6.6 3.6M15.3 7.2l-6.6 3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  facebook: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.5 8.5h2.2V5.2H14.3c-2.6 0-4.3 1.6-4.3 4.4v1.9H7.8v3.4h2.2V22h3.5v-7.1h2.5l.5-3.4h-3V9.8c0-1 .3-1.3 1.2-1.3Z"/></svg>`,
  print: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 8V5h10v3M6 14h12v5H6v-5Z" stroke="currentColor" stroke-width="1.6"/><path d="M4.8 9h14.4A1.7 1.7 0 0 1 21 10.7v4.2h-3M3 14.9V10.7A1.7 1.7 0 0 1 4.8 9" stroke="currentColor" stroke-width="1.6"/></svg>`,
  mail: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h16v10H4V7Z" stroke="currentColor" stroke-width="1.6"/><path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.6"/></svg>`,
  phone: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6.5 4.8h3.2l1.1 3.2-1.8 1.1a12 12 0 0 0 6 6l1.1-1.8 3.2 1.1v3.2A2 2 0 0 1 17.3 20 15 15 0 0 1 4 6.7 2 2 0 0 1 6.5 4.8Z" stroke="currentColor" stroke-width="1.6"/></svg>`,
  heart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7.2a3.8 3.8 0 0 1 7 3.6C19 15.6 12 20 12 20Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  grid: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="6.5" height="6.5" rx="1.2" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" stroke-width="1.6"/></svg>`,
  zoom: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="5.5" stroke="currentColor" stroke-width="1.6"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  pin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="11" r="2.2" stroke="currentColor" stroke-width="1.6"/></svg>`,
};

const HIGHLIGHT_ICONS = {
  km: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 18 12 6l8 12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 18h9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  power: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="13" r="7" stroke="currentColor" stroke-width="1.7"/><path d="M12 13 15.5 8.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M8 10.2a6 6 0 0 1 8 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  fuel: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 20V6.5A1.5 1.5 0 0 1 8.5 5h5A1.5 1.5 0 0 1 15 6.5V20" stroke="currentColor" stroke-width="1.7"/><path d="M6 20h10M15 9h2.2A1.8 1.8 0 0 1 19 10.8V16a2 2 0 1 0 2-2v-3.5L18.5 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 6v12M16 6v12M8 12h8M8 6h4M16 18h-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  year: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  owners: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8.5" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 19.5c1.2-3.4 3.8-5 6.5-5s5.3 1.6 6.5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  area: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8.5 12 4l8 4.5V20H4V8.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.5 20v-6h5v6" stroke="currentColor" stroke-width="1.7"/></svg>`,
  rooms: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M4 12h16M12 5v14" stroke="currentColor" stroke-width="1.7"/></svg>`,
  condition: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 12.5 3.2 3.2L17 8.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/></svg>`,
  color: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>`,
  generic: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.7"/><path d="M12 8v4.5l2.5 2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
};

function specValue(rows, label) {
  const hit = (rows || []).find((row) => row.label === label);
  return hit?.value ? String(hit.value) : "";
}

function shortGear(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/automat/i.test(raw)) return "Automata";
  if (/manuál|manual|kézi/i.test(raw)) return "Manuális";
  return raw.length > 28 ? `${raw.slice(0, 26)}…` : raw;
}

function highlightSpecsFromView(view) {
  if (view.vertical === "ingatlan") {
    const rows = [
      { key: "area", label: "Alapterület", value: specValue(view.vehicleSpecs, "Alapterület") || specValue(view.bodyTech, "Alapterület") },
      { key: "rooms", label: "Szobák", value: specValue(view.vehicleSpecs, "Szobaszám") },
      { key: "condition", label: "Állapot", value: specValue(view.vehicleSpecs, "Állapot") },
      { key: "year", label: "Év", value: view.year !== "—" ? view.year : "" },
      { key: "color", label: "Fűtés", value: specValue(view.vehicleSpecs, "Fűtés") || specValue(view.motorSpecs, "Fűtés") },
      { key: "generic", label: "Típus", value: specValue(view.vehicleSpecs, "Jármű típusa") || view.typeName },
    ];
    return rows.filter((row) => row.value);
  }
  return [
    { key: "km", label: "Kilométeróra", value: view.km !== "—" ? view.km : "" },
    { key: "power", label: "Teljesítmény", value: view.power !== "—" ? view.power : "" },
    { key: "fuel", label: "Üzemanyag", value: view.fuel !== "—" ? view.fuel : "" },
    {
      key: "gear",
      label: "Sebességváltó",
      value: shortGear(specValue(view.motorSpecs, "Sebességváltó")),
    },
    {
      key: "year",
      label: "Évjárat",
      value: view.registration !== "—" ? view.registration : view.year !== "—" ? view.year : "",
    },
    {
      key: "owners",
      label: "Tulajdonosok",
      value: specValue(view.documentSpecs, "Előző tulajdonosok"),
    },
  ].filter((row) => row.value);
}

function promoBannerText(view) {
  if (view.vertical === "ingatlan") return "Ingatlan: Végre egyszerű";
  if (view.vertical === "teher") return "Teherautó: Végre egyszerű";
  return "Autóvásárlás: Végre egyszerű";
}

function navigationDestination(view) {
  const lines = Array.isArray(view.addressLines) ? view.addressLines.filter(Boolean) : [];
  if (lines.length) return lines.join(", ");
  return String(view.mapQuery || "").trim();
}

function navigationHref(view) {
  const dest = navigationDestination(view);
  if (!dest) return "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

function sideHeadline(view) {
  if (view.brand && view.typeName) {
    return { title: view.brand, subtitle: [view.typeName, view.year !== "—" ? view.year : ""].filter(Boolean).join(" · ") };
  }
  if (view.brand) {
    return { title: view.brand, subtitle: view.year !== "—" ? String(view.year) : "" };
  }
  return { title: view.title, subtitle: view.year !== "—" ? String(view.year) : "" };
}

function highlightHtml(items) {
  if (!items.length) return "";
  return `<section class="hd-highlights" aria-label="Fő adatok">
    ${items
      .map(
        (item) => `<div class="hd-hi">
        <span class="hd-hi-icon">${HIGHLIGHT_ICONS[item.key] || HIGHLIGHT_ICONS.generic}</span>
        <span class="hd-hi-text">
          <span class="hd-hi-label">${escapeHtml(item.label)}</span>
          <strong class="hd-hi-value">${escapeHtml(item.value)}</strong>
        </span>
      </div>`
      )
      .join("")}
  </section>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SELLER_AVATAR_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">` +
      `<circle cx="24" cy="24" r="24" fill="#e4eaf4"/>` +
      `<circle cx="24" cy="17.5" r="7.5" fill="#8e9aaf"/>` +
      `<path fill="#8e9aaf" d="M7.2 42.8C9.2 33.8 15.2 29.5 24 29.5s14.8 4.3 16.8 13.3C36.2 45.6 30.4 47.5 24 47.5S11.8 45.6 7.2 42.8z"/>` +
      `</svg>`
  );

function sellerAvatarHtml(view) {
  const src = String(view.sellerAvatarUrl || "").trim() || SELLER_AVATAR_PLACEHOLDER;
  return `<span class="hd-seller-avatar" aria-hidden="true"><img src="${escapeHtml(src)}" alt="" width="48" height="48" decoding="async" /></span>`;
}

function sellerRatingHtml(rating) {
  const avg = rating?.average != null ? Number(rating.average) : null;
  const count = Number(rating?.count) || 0;
  if (avg == null || count <= 0) {
    return `<p class="hd-seller-rating hd-seller-rating--empty" data-hd-seller-rating>Még nincs értékelés</p>`;
  }
  const filled = Math.max(0, Math.min(5, Math.round((avg / 10) * 5)));
  const stars = Array.from({ length: 5 }, (_, i) =>
    i < filled
      ? `<span class="hd-seller-star is-on" aria-hidden="true">★</span>`
      : `<span class="hd-seller-star" aria-hidden="true">☆</span>`
  ).join("");
  return `<p class="hd-seller-rating" data-hd-seller-rating title="${escapeHtml(String(avg))} / 10">
    <span class="hd-seller-stars" role="img" aria-label="Értékelés ${escapeHtml(String(avg))} / 10">${stars}</span>
    <strong class="hd-seller-avg">${escapeHtml(String(avg))}</strong>
    <span class="hd-seller-count">(${count})</span>
  </p>`;
}

function paintSellerRating(rating) {
  const el = root?.querySelector("[data-hd-seller-rating]");
  if (!el) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = sellerRatingHtml(rating);
  const next = wrap.firstElementChild;
  if (next) el.replaceWith(next);
}

async function loadSellerRating(listingId) {
  try {
    const rating = await fetchSellerRating(listingId);
    paintSellerRating(rating);
  } catch {
    /* értékelés opcionális */
  }
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value.includes("T") ? value : `${value}Z`).toLocaleString("hu-HU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function formatCrumbLabel(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw !== raw.toLocaleUpperCase("hu-HU")) return raw;
  return raw
    .toLocaleLowerCase("hu-HU")
    .split(/([\s/-]+)/)
    .map((part) => {
      if (/^[\s/-]+$/.test(part) || !part) return part;
      return part.charAt(0).toLocaleUpperCase("hu-HU") + part.slice(1);
    })
    .join("");
}

function currentUserId() {
  const id = Number(getAuthUser()?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function isOwnListing(view, listing = null) {
  const uid = currentUserId();
  if (!uid) return false;
  const candidates = [view?.userId, listing?.user_id, listing?.detail?.userId];
  return candidates.some((value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 && n === uid;
  });
}

function clearRelatedUi() {
  if (!root) return;
  document.getElementById("hd-related")?.remove();
  root.querySelectorAll("[data-hd-related-link], a[href='#hd-related']").forEach((el) => el.remove());
}

function kvHtml(rows) {
  if (!rows?.length) return "";
  return `<dl class="hd-grid">${rows
    .map(
      (row) =>
        `<div class="hd-kv"><dt>${escapeHtml(row.label)}:</dt><dd>${escapeHtml(row.value)}</dd></div>`
    )
    .join("")}</dl>`;
}

function specBlockHtml(title, rows) {
  if (!rows?.length) return "";
  return `<section class="hd-spec-block"><h2 class="hd-spec-block__title">${escapeHtml(title)}</h2>${kvHtml(rows)}</section>`;
}

function equipmentGroupsHtml(groups) {
  if (!groups?.length) return "";
  return `<h2 class="hd-h2">Extrák</h2>${groups
    .map(
      (group) =>
        `<div class="hd-extra-group">
          <h3 class="hd-h3 hd-h3--extra">${escapeHtml(group.title)}</h3>
          <ul class="hd-list">${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>`
    )
    .join("")}`;
}

function relatedCard(item) {
  const p = item.preview || {};
  const title = p.title || item.hirdetes_cime || `Hirdetés #${item.id}`;
  const year = p.filter?.gyartasi_ev || "";
  const km = p.km || "";
  const le = p.filter?.teljesitmeny_le ? `${p.filter.teljesitmeny_le} LE` : "";
  const spec = [year, km, le].filter(Boolean).join(", ");
  const img = p.imageUrl || item.fo_kep || "";
  return `<a class="hd-rel" data-listing-id="${item.id}" href="${listingDetailHref(item.id)}">
    ${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async" />` : `<div class="hd-rel-empty"></div>`}
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(spec)}</span>
    <b>${escapeHtml(p.price || "—")}</b>
  </a>`;
}

function applyRelated(view, related) {
  if (!root) return;
  if (root.dataset.ownListing === "1" || root.querySelector(".hd-owner") || isOwnListing(view)) {
    clearRelatedUi();
    return;
  }
  const items = Array.isArray(related) ? related : [];
  const total = items.length + 1;
  const label = `Kereskedés többi hirdetései ${total}`;
  const aside = root.querySelector(".hd-side") || root.querySelector("aside");
  let link =
    aside?.querySelector("[data-hd-related-link]") ||
    aside?.querySelector('a[href="#hd-related"]');
  if (aside && !link && items.length) {
    link = document.createElement("button");
    link.type = "button";
    link.className = "hd-btn hd-btn--ghost";
    link.dataset.hdRelatedLink = "";
    const owner = aside.querySelector(".hd-owner");
    if (owner) aside.insertBefore(link, owner);
    else aside.appendChild(link);
  }
  if (link) {
    link.textContent = label;
    link.hidden = false;
    link.removeAttribute("aria-expanded");
    link.removeAttribute("aria-controls");
  }
  if (!items.length) {
    document.getElementById("hd-related")?.remove();
    return;
  }

  let section = document.getElementById("hd-related");
  const wasOpen = Boolean(section && !section.hidden);
  if (!section) {
    section = document.createElement("section");
    section.className = "hd-section";
    section.id = "hd-related";
    const dealer = root.querySelector(".hd-dealer");
    if (dealer) root.insertBefore(section, dealer);
    else root.appendChild(section);
  }
  section.hidden = !wasOpen;
  section.innerHTML = `
    <div class="hd-related-head">
      <h2 class="hd-h2">Kereskedés többi hirdetései</h2>
    </div>
    <div class="hd-related">${items.map(relatedCard).join("")}</div>
  `;
  if (link) link.removeAttribute("aria-expanded");
  section.querySelectorAll("a[data-listing-id]").forEach((a) => {
    a.addEventListener("click", () => rememberListingOpen(a.dataset.listingId, a));
  });
}

function listPageForVertical(vertical) {
  const v = String(vertical || "").trim().toLowerCase();
  if (v === "ingatlan") return "/ingatlan.html";
  if (v === "teher" || v === "teherauto") return "/teherauto.html";
  return "/auto.html";
}

function listingVerticalFromView(view) {
  const explicit = String(view?.vertical || "").trim().toLowerCase();
  if (explicit === "teher" || explicit === "ingatlan" || explicit === "auto") return explicit;
  const href = String(view?.categoryHref || "");
  if (href.includes("ingatlan")) return "ingatlan";
  if (href.includes("teher")) return "teher";
  return "auto";
}

function sellerListHref(listingId, _vertical) {
  // Egy készletoldal: a kereskedő összes feladott hirdetése (minden vertical).
  const url = new URL("/auto.html", window.location.origin);
  url.searchParams.set("hirdeto", String(listingId));
  return `${url.pathname}${url.search}`;
}

function revealRelatedListings(event) {
  const trigger = event?.target?.closest?.("[data-hd-related-link]");
  if (!trigger || !root?.contains(trigger)) return;
  if (root.dataset.ownListing === "1" || root.querySelector(".hd-owner")) {
    clearRelatedUi();
    return;
  }
  event.preventDefault();
  const listingId = root.dataset.listingId || new URLSearchParams(location.search).get("id");
  if (!listingId) return;
  const vertical = root.dataset.listingVertical || "auto";
  window.location.href = sellerListHref(listingId, vertical);
}

async function loadRelatedListings(listingId, view) {
  if (root?.dataset.ownListing === "1" || isOwnListing(view)) return;
  try {
    const related = await fetchRelatedListings(listingId, { limit: 24 });
    applyRelated(view, related);
  } catch {
  }
}

function render(view, listing, related) {
  const images = view.images?.length ? view.images : [];
  const first = images[0] || "";
  const equipmentGroups = Array.isArray(view.equipmentGroups) ? view.equipmentGroups : [];
  const own = isOwnListing(view, listing);
  const canMsg = !own;
  const user = getAuthUser();
  const profile = getProfile() || {};
  const partner = listing?.partner;
  const partnerHref = partner?.slug
    ? `/partner/${encodeURIComponent(partner.slug)}`
    : "";
  const loginNext = `/belepes.html?next=${encodeURIComponent(location.pathname + location.search)}`;
  root.dataset.listingId = String(view.id);
  root.dataset.listingVertical = listingVerticalFromView(view);
  if (own) root.dataset.ownListing = "1";
  else delete root.dataset.ownListing;

  const searchNav = getListingSearchNav(view.id, view.categoryHref);
  const hasPrevNext = Boolean(searchNav.prevId || searchNav.nextId);
  const highlights = highlightSpecsFromView(view);
  const headline = sideHeadline(view);
  const promoText = promoBannerText(view);
  const navHref = navigationHref(view);

  document.title = `${view.title} — Bymy`;
  document.body.classList.toggle("hd-has-msg-bar", canMsg);
  if (root) root.dataset.ownListing = own ? "1" : "0";
  if (own) clearRelatedUi();

  root.innerHTML = `
    <nav class="hd-topnav" aria-label="Navigáció">
      <ol class="hd-crumb-list">
        <li><a href="/">Kezdőlap</a></li>
        <li><a href="${escapeHtml(view.categoryHref)}">${escapeHtml(view.categoryLabel)}</a></li>
        ${
          view.brand
            ? `<li${view.typeName ? "" : ' aria-current="page"'}>${escapeHtml(formatCrumbLabel(view.brand))}</li>`
            : ""
        }
        ${view.typeName ? `<li aria-current="page">${escapeHtml(formatCrumbLabel(view.typeName))}</li>` : ""}
      </ol>
      <div class="hd-topnav-actions">
        <a class="hd-search-back" href="${escapeHtml(searchNav.returnHref)}">
          <span aria-hidden="true">◂</span> vissza a keresési eredményekhez
        </a>
        ${
          hasPrevNext
            ? `<span class="hd-search-siblings">
          ${
            searchNav.prevId
              ? `<a class="hd-search-prev" href="${escapeHtml(listingDetailHref(searchNav.prevId))}"><span aria-hidden="true">◂</span> előző</a>`
              : `<span class="hd-search-prev is-disabled"><span aria-hidden="true">◂</span> előző</span>`
          }
          <span class="hd-search-sep" aria-hidden="true">|</span>
          ${
            searchNav.nextId
              ? `<a class="hd-search-next" href="${escapeHtml(listingDetailHref(searchNav.nextId))}">következő <span aria-hidden="true">▸</span></a>`
              : `<span class="hd-search-next is-disabled">következő <span aria-hidden="true">▸</span></span>`
          }
        </span>`
            : ""
        }
      </div>
    </nav>

    <div class="hd-hero">
      <div class="hd-gallery">
        <div class="hd-stage">
          ${first ? `<button type="button" class="hd-stage-open" data-hd-open aria-label="Kép nagyítása"><img data-hd-main src="${escapeHtml(first)}" alt="" /></button>` : ""}
          ${
            images.length > 1
              ? `<button type="button" class="hd-stage-nav hd-stage-nav--prev" data-hd-prev aria-label="Előző kép">${ICON.prev}</button>
                 <button type="button" class="hd-stage-nav hd-stage-nav--next" data-hd-next aria-label="Következő kép">${ICON.next}</button>`
              : ""
          }
          <span class="hd-count" data-hd-count>${images.length ? `1 / ${images.length}` : "0 / 0"}</span>
        </div>
        <div class="hd-promo">${escapeHtml(promoText)}</div>
        ${
          images.length
            ? `<div class="hd-thumbs">
          <div class="hd-thumbs-track" data-hd-thumbs>
            ${images
              .map(
                (url, i) =>
                  `<button type="button" class="hd-thumb${i === 0 ? " is-on" : ""}" data-hd-thumb="${i}"><img src="${escapeHtml(url)}" alt="" /></button>`
              )
              .join("")}
          </div>
        </div>`
            : ""
        }
        ${highlightHtml(highlights)}
      </div>
      ${
        images.length
          ? `<dialog class="hd-lb" data-hd-lb>
        <div class="hd-lb-inner">
          <button type="button" class="hd-lb-close" data-hd-lb-close aria-label="Bezárás">${ICON.close}</button>
          <div class="hd-lb-stage">
            <img data-hd-lb-main src="${escapeHtml(first)}" alt="" />
            ${
              images.length > 1
                ? `<button type="button" class="hd-stage-nav hd-stage-nav--prev" data-hd-lb-prev aria-label="Előző kép">${ICON.prev}</button>
                   <button type="button" class="hd-stage-nav hd-stage-nav--next" data-hd-lb-next aria-label="Következő kép">${ICON.next}</button>`
                : ""
            }
            <span class="hd-count" data-hd-lb-count>1 / ${images.length}</span>
          </div>
          <div class="hd-thumbs hd-lb-thumbs">
            <div class="hd-thumbs-track" data-hd-lb-thumbs>
              ${images
                .map(
                  (url, i) =>
                    `<button type="button" class="hd-thumb${i === 0 ? " is-on" : ""}" data-hd-lb-thumb="${i}"><img src="${escapeHtml(url)}" alt="" /></button>`
                )
                .join("")}
            </div>
          </div>
        </div>
      </dialog>`
          : ""
      }
      <aside class="hd-side">
        <div class="hd-side-head">
          <h1 class="hd-side-title">${escapeHtml(headline.title)}</h1>
          ${headline.subtitle ? `<p class="hd-side-sub">${escapeHtml(headline.subtitle)}</p>` : ""}
        </div>
        <div class="hd-price-box">
          <div class="hd-price-row">
            <p class="hd-price">${escapeHtml(view.price)}</p>
            <div class="hd-price-rating" title="Árjelzés">
              <span class="hd-price-bars" aria-hidden="true"><i></i><i></i><i></i><i class="is-dim"></i></span>
              <span>Jó ár</span>
            </div>
          </div>
          ${view.salePrice ? `<p class="hd-price-old">Korábbi ár: ${escapeHtml(view.salePrice)}</p>` : ""}
        </div>
        <div class="hd-seller-card">
          ${sellerAvatarHtml(view)}
          <div class="hd-seller-meta">
            <p class="hd-seller-name">${escapeHtml(view.sellerName)}</p>
            <p class="hd-seller-rating hd-seller-rating--loading" data-hd-seller-rating>Értékelés betöltése…</p>
            ${view.sellerSince ? `<p class="hd-seller-since">Felhasználó ezóta: ${escapeHtml(view.sellerSince)}</p>` : ""}
          </div>
        </div>
        ${
          partnerHref
            ? `<a class="hd-partner-badge" href="${partnerHref}">
                <span class="hd-partner-badge__mark">✓</span>
                <span><strong>Ellenőrzött Bymy partner</strong><small>${escapeHtml(partner.display_name)}</small></span>
              </a>`
            : ""
        }
        ${view.addressLines.length ? `<p class="hd-seller-addr">${view.addressLines.map(escapeHtml).join("<br>")}</p>` : ""}
        ${
          canMsg
            ? `<button type="button" class="hd-btn hd-btn--primary" data-hd-message>${ICON.mail} Üzenet küldése</button>`
            : own
              ? ""
              : `<button type="button" class="hd-btn hd-btn--primary" data-hd-goto-form>${ICON.mail} Hirdető kapcsolata</button>`
        }
        <div class="hd-side-actions${own ? " hd-side-actions--3" : ""}">
          ${
            own
              ? ""
              : `<button type="button" class="hd-btn hd-btn--outline hd-btn--icon" data-hd-star aria-label="Kedvencekhez adás" aria-pressed="false" title="Kedvenc">${ICON.heart}</button>`
          }
          <button type="button" class="hd-btn hd-btn--outline hd-btn--icon" data-hd-share aria-label="Megosztás" title="Megosztás">${ICON.share}</button>
          <button type="button" class="hd-btn hd-btn--outline hd-btn--icon hd-btn--fb" data-hd-share-fb aria-label="Megosztás Facebookon" title="Facebook">${ICON.facebook}</button>
          <button type="button" class="hd-btn hd-btn--outline hd-btn--icon" data-hd-print aria-label="Nyomtatás" title="Nyomtatás">${ICON.print}</button>
        </div>
        ${
          view.hasPhone || view.phone
            ? `<button type="button" class="hd-btn hd-btn--soft" data-hd-phone>${ICON.phone} ${escapeHtml(view.phoneMasked || "Telefonszám")} mutatása</button>`
            : ""
        }
        ${
          navHref
            ? `<a class="hd-btn hd-btn--soft" href="${escapeHtml(navHref)}" target="_blank" rel="noopener" data-hd-navigate>${ICON.pin} Navigáció</a>`
            : ""
        }
        ${
          !own && related.length
            ? `<button type="button" class="hd-btn hd-btn--soft" data-hd-related-link>Kereskedés többi hirdetései ${related.length + 1}</button>`
            : !own
              ? `<button type="button" class="hd-btn hd-btn--soft" data-hd-related-link>Kereskedés többi hirdetései …</button>`
              : ""
        }
        <a class="hd-btn hd-btn--soft" href="/adasveteli-szerzodes.html?id=${encodeURIComponent(view.id)}">Adásvételi szerződés</a>
        ${view.website ? `<a class="hd-web" href="${escapeHtml(view.website)}" target="_blank" rel="noopener">Céges weboldal</a>` : ""}
        ${
          own
            ? `<div class="hd-owner">
                <a class="hd-btn hd-btn--soft" href="/hirdetesfeladas.html?id=${view.id}">Szerkesztés</a>
                <button type="button" class="hd-btn hd-btn--soft" data-hd-delete>Törlés</button>
              </div>`
            : ""
        }
        <p class="hd-side-meta">
          ${view.updatedAt ? `Utoljára módosítva: ${escapeHtml(formatDate(view.updatedAt))}` : ""}
          ${view.code ? `<br>Bymy-kód: ${escapeHtml(view.code)}` : ""}
        </p>
      </aside>
    </div>

    <div class="hd-specs">
      ${specBlockHtml("Jármű adatok", view.vehicleSpecs)}
      ${specBlockHtml("Motor adatok", view.motorSpecs)}
      ${specBlockHtml("Okmányok", view.documentSpecs)}
      ${specBlockHtml("Abroncs", view.tireSpecs)}
      ${
        view.perks.length
          ? `<section class="hd-spec-block hd-spec-block--perks"><h2 class="hd-spec-block__title">További előnyök</h2>${view.perks.map((p) => `<span class="hd-check">${escapeHtml(p)}</span>`).join("")}</section>`
          : ""
      }
    </div>

    ${
      equipmentGroups.length
        ? `<section class="hd-section hd-section--extras">${equipmentGroupsHtml(equipmentGroups)}</section>`
        : ""
    }

    <section class="hd-section">
      <h2 class="hd-h2">Leírás</h2>
      ${view.description ? `<p class="hd-desc is-clip" data-hd-desc>${escapeHtml(view.description)}</p>` : "<p class=\"hd-desc\">Nincs leírás.</p>"}
      ${view.description ? `<button type="button" class="hd-more" data-hd-desc-more>Több megjelenítése +</button>` : ""}
    </section>

    ${
      !own && related.length
        ? `<section class="hd-section" id="hd-related" hidden>
        <div class="hd-related-head">
          <h2 class="hd-h2">Kereskedés többi hirdetései</h2>
        </div>
        <div class="hd-related">${related.map(relatedCard).join("")}</div>
      </section>`
        : ""
    }

    <section class="hd-dealer">
      <div class="hd-card">
        <p class="hd-seller-name">${escapeHtml(view.sellerName)}</p>
        ${
          partnerHref
            ? `<a class="hd-partner-profile-link" href="${partnerHref}">
                ${partner.logo_url ? `<img src="${escapeHtml(partner.logo_url)}" alt="" />` : `<span>${escapeHtml(String(partner.display_name || "P").slice(0, 1))}</span>`}
                <span><small>Ellenőrzött ingatlanos partner</small><strong>${escapeHtml(partner.display_name)}</strong><em>Partnerprofil megnyitása →</em></span>
              </a>`
            : ""
        }
        ${view.addressLines.length ? `<p class="hd-seller-addr">${view.addressLines.map(escapeHtml).join("<br>")}</p>` : ""}
        <p class="hd-seller-addr">Hivatkozási szám: ${escapeHtml(view.code || String(view.id))}</p>
        ${view.website ? `<p><a class="hd-web" href="${escapeHtml(view.website)}" target="_blank" rel="noopener">Weboldal</a></p>` : ""}
        ${
          view.hasPhone || view.phone
            ? `<button type="button" class="hd-btn hd-btn--ghost" data-hd-phone>${ICON.phone} ${escapeHtml(view.phoneMasked || "Telefonszám")} mutatása</button>`
            : ""
        }
      </div>
      <div>
        ${
          view.mapQuery
            ? `<iframe class="hd-map" title="Térkép" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" src="https://maps.google.com/maps?q=${encodeURIComponent(view.mapQuery)}&output=embed"></iframe>`
            : ""
        }
        <form class="hd-card" id="hd-contact" style="margin-top:0.9rem" ${canMsg || own ? "hidden" : ""}>
          <h2 class="hd-h2">Hirdető kapcsolata</h2>
          <p class="hd-h3">Amit a járműről tudni szeretnék</p>
          <div class="hd-ask">
            <label><input type="checkbox" name="q" value="Próbaút lehetséges?" /> Próbaút lehetséges?</label>
            <label><input type="checkbox" name="q" value="Elérhető még a jármű?" /> Elérhető még a jármű?</label>
            <label><input type="checkbox" name="q" value="További információ a járműről" /> További információ a járműről</label>
            <label><input type="checkbox" name="q" value="Beszámítás lehetséges?" /> Beszámítás lehetséges?</label>
          </div>
          <div class="hd-field" style="margin-bottom:0.75rem">
            <span>Név</span>
            <input name="name" required value="${escapeHtml(getDisplayName() || "")}" />
          </div>
          <div class="hd-fields">
            <label class="hd-field"><span>E-mail cím</span><input type="email" name="email" required value="${escapeHtml(user?.email || "")}" /></label>
            <label class="hd-field"><span>Telefonszám <small>(opcionális)</small></span><input type="tel" name="phone" value="${escapeHtml(profile.phone || "")}" /></label>
          </div>
          <label class="hd-field" style="margin-top:0.75rem"><span>Megjegyzés</span><textarea name="comment" rows="3"></textarea></label>
          <label class="hd-copy"><input type="checkbox" name="copy" /> Másolat küldése nekem erről az érdeklődésről</label>
          <button type="submit" class="hd-btn hd-btn--primary">${ICON.mail} E-mail küldése</button>
          <p class="hd-seller-addr" data-hd-form-status hidden></p>
          ${!user ? `<p class="hd-seller-addr">Küldéshez <a href="${loginNext}">jelentkezz be</a>.</p>` : ""}
        </form>
      </div>
    </section>

    <div class="hd-foot">
      <span>Bymy-kód: ${escapeHtml(view.code || String(view.id))} ${view.updatedAt ? `| Utoljára módosítva: ${escapeHtml(formatDate(view.updatedAt))}` : ""}</span>
      <a class="hd-report" href="/uzenetek.html">! Hirdetés jelentése</a>
    </div>
    ${
      canMsg
        ? `<div class="hd-msg-bar" role="region" aria-label="Üzenet">
            ${
              view.phone
                ? `<button type="button" class="hd-btn hd-btn--primary" data-hd-phone data-full="${escapeHtml(view.phone)}">${ICON.phone} Hívás</button>`
                : view.hasPhone
                  ? `<button type="button" class="hd-btn hd-btn--primary" data-hd-phone>${ICON.phone} Hívás</button>`
                  : ""
            }
            <button type="button" class="hd-btn hd-btn--primary" data-hd-message>${ICON.mail} Üzenet</button>
          </div>`
        : ""
    }
    ${
      view.hasPhone && !view.phone
        ? `<div class="hd-phone-security" id="hd-phone-security"><div id="hd-phone-turnstile" class="hd-turnstile"></div></div>`
        : ""
    }
  `;

  bindUi(view, listing);
}

function bindUi(view, listing) {
  const needPhoneReveal = Boolean(view.hasPhone && !view.phone);
  let phoneTurnstile = { enabled: false, ready: true, execute: null, getToken: async () => "", reset: () => {} };
  const phoneTurnstileReady = needPhoneReveal
    ? mountTurnstile(document.getElementById("hd-phone-turnstile"), { size: "invisible" }).then((widget) => {
        phoneTurnstile = widget;
        return widget;
      })
    : Promise.resolve(phoneTurnstile);

  let index = 0;
  const images = view.images || [];
  const main = root.querySelector("[data-hd-main]");
  const count = root.querySelector("[data-hd-count]");
  const lightbox = root.querySelector("[data-hd-lb]");
  const lbMain = root.querySelector("[data-hd-lb-main]");
  const lbCount = root.querySelector("[data-hd-lb-count]");

  function markThumbs(selector) {
    root.querySelectorAll(selector).forEach((btn) => {
      const on = Number(btn.dataset.hdThumb ?? btn.dataset.hdLbThumb) === index;
      btn.classList.toggle("is-on", on);
      if (on && btn.closest("[data-hd-lb]")) {
        btn.scrollIntoView({ block: "nearest", inline: "center" });
      }
    });
  }

  function show(i) {
    if (!images.length) return;
    index = (i + images.length) % images.length;
    if (main) main.src = images[index];
    if (lbMain) lbMain.src = images[index];
    const label = `${index + 1} / ${images.length}`;
    if (count) count.textContent = label;
    if (lbCount) lbCount.textContent = label;
    markThumbs("[data-hd-thumb]");
    markThumbs("[data-hd-lb-thumb]");
  }

  let lbFullscreen = false;

  function setLbFullscreen(on) {
    lbFullscreen = Boolean(on);
    lightbox?.classList.toggle("is-fs", lbFullscreen);
    const closeBtn = root.querySelector("[data-hd-lb-close]");
    if (closeBtn) {
      closeBtn.setAttribute(
        "aria-label",
        lbFullscreen ? "Kicsinyítés" : "Bezárás"
      );
      closeBtn.setAttribute("title", lbFullscreen ? "Vissza a galériához" : "Bezárás");
    }
  }

  function openLightbox() {
    if (!lightbox || !images.length) return;
    setLbFullscreen(false);
    show(index);
    if (typeof lightbox.showModal === "function") lightbox.showModal();
    else lightbox.setAttribute("open", "");
  }

  function closeLightbox() {
    if (!lightbox) return;
    setLbFullscreen(false);
    if (typeof lightbox.close === "function" && lightbox.open) lightbox.close();
    else lightbox.removeAttribute("open");
  }

  root.querySelectorAll("a.hd-search-prev, a.hd-search-next").forEach((link) => {
    link.addEventListener("click", () => {
      try {
        const id = new URL(link.href, location.origin).searchParams.get("id");
        if (id) touchListingReturnId(id);
      } catch {
      }
    });
  });
  root.querySelector("[data-hd-prev]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    show(index - 1);
  });
  root.querySelector("[data-hd-next]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    show(index + 1);
  });
  root.querySelector("[data-hd-open]")?.addEventListener("click", openLightbox);
  root.querySelectorAll("[data-hd-thumb]").forEach((btn) => {
    btn.addEventListener("click", () => show(Number(btn.dataset.hdThumb)));
  });
  root.querySelector("[data-hd-lb-prev]")?.addEventListener("click", () => show(index - 1));
  root.querySelector("[data-hd-lb-next]")?.addEventListener("click", () => show(index + 1));
  root.querySelectorAll("[data-hd-lb-thumb]").forEach((btn) => {
    btn.addEventListener("click", () => show(Number(btn.dataset.hdLbThumb)));
  });
  root.querySelector("[data-hd-lb-close]")?.addEventListener("click", () => {
    if (lbFullscreen) setLbFullscreen(false);
    else closeLightbox();
  });
  const lbStage = root.querySelector(".hd-lb-stage");
  lbStage?.addEventListener("click", (event) => {
    if (event.target.closest("[data-hd-lb-prev], [data-hd-lb-next]")) return;
    if (!lbFullscreen) setLbFullscreen(true);
  });
  lbMain?.addEventListener("dblclick", () => {
    if (lbFullscreen) setLbFullscreen(false);
  });
  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      if (lbFullscreen) setLbFullscreen(false);
      else closeLightbox();
    }
  });
  lightbox?.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (lbFullscreen) setLbFullscreen(false);
    else closeLightbox();
  });
  document.addEventListener("keydown", (event) => {
    if (!images.length) return;
    const open = lightbox?.open || lightbox?.hasAttribute("open");
    if (!open && event.target !== document.body && event.target?.tagName !== "BODY") return;
    if (event.key === "ArrowLeft") show(index - 1);
    if (event.key === "ArrowRight") show(index + 1);
    if (event.key === "Escape" && open) {
      if (lbFullscreen) setLbFullscreen(false);
      else closeLightbox();
    }
  });
  root.querySelector("[data-hd-print]")?.addEventListener("click", () => window.print());
  const shareUrl = () => {
    try {
      const u = new URL(window.location.href);
      u.hash = "";
      return u.toString();
    } catch {
      return window.location.href.split("#")[0];
    }
  };
  root.querySelector("[data-hd-share]")?.addEventListener("click", async () => {
    const url = shareUrl();
    try {
      if (navigator.share) await navigator.share({ title: view.title, url });
      else {
        await navigator.clipboard.writeText(url);
        window.alert("A link a vágólapra került.");
      }
    } catch {
    }
  });
  root.querySelector("[data-hd-share-fb]")?.addEventListener("click", () => {
    const href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl())}`;
    window.open(href, "_blank", "noopener,noreferrer,width=640,height=720");
  });
  try {
    document.title = `${view.title} | Bymy`;
  } catch {
    /* ignore */
  }

  const star = root.querySelector("[data-hd-star]");
  const email = getAuthUser()?.email;
  const saved = email && getParkplatz(email).some((row) => String(row.id) === String(view.id));
  function syncFavButton(on) {
    if (!star) return;
    star.classList.toggle("is-on", on);
    star.setAttribute("aria-pressed", on ? "true" : "false");
    star.setAttribute("aria-label", on ? "Eltávolítás a kedvencekből" : "Kedvencekhez adás");
    star.title = on ? "Kedvenc" : "Kedvencekhez adás";
  }
  if (star && saved) syncFavButton(true);
  star?.addEventListener("click", () => {
    if (root.dataset.ownListing === "1" || isOwnListing(view, listing)) {
      clearRelatedUi();
      return;
    }
    if (!email) {
      window.location.href = `/belepes.html?next=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }
    const on = star.classList.contains("is-on");
    if (on) removeParkplatzItem(email, view.id);
    else {
      addParkplatzItem(email, {
        id: view.id,
        title: view.title,
        price: view.price,
        url: listingDetailHref(view.id),
        imageUrl: view.images?.[0] || "",
      });
    }
    syncFavButton(!on);
  });

  root.querySelectorAll("[data-hd-phone]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.dataset.revealed === "1") return;
      const fullAlready = String(btn.dataset.full || "").trim();
      if (fullAlready) {
        const digits = fullAlready.replace(/[^\d+]/g, "");
        if (digits.length >= 7) window.location.href = `tel:${digits}`;
        return;
      }
      btn.disabled = true;
      try {
        let contact;
        if (view.phone) {
          contact = { phone: view.phone, addressLines: view.addressLines || [] };
        } else {
          await phoneTurnstileReady;
          if (phoneTurnstile.enabled && phoneTurnstile.ready === false) {
            alert("A biztonsági ellenőrző most nem elérhető. Frissítsd az oldalt.");
            return;
          }
          let token = "";
          if (phoneTurnstile.enabled) {
            token = phoneTurnstile.execute
              ? await phoneTurnstile.execute({ waitMs: 15000 })
              : await phoneTurnstile.getToken({ waitMs: 10000 });
            if (!token) {
              alert("A biztonsági ellenőrzés sikertelen. Próbáld újra.");
              phoneTurnstile.reset();
              return;
            }
          }
          contact = await revealListingContact(view.id, token);
          phoneTurnstile.reset();
        }
        const full = String(contact.phone || "").trim();
        if (!full) {
          btn.textContent = "Nincs telefonszám";
          return;
        }
        btn.dataset.revealed = "1";
        btn.textContent = full;
        const digits = full.replace(/[^\d+]/g, "");
        if (digits.length >= 7) window.location.href = `tel:${digits}`;
        if (contact.addressLines?.length) {
          view.addressLines = contact.addressLines;
          if (!view.mapQuery) {
            view.mapQuery = contact.addressLines.join(", ");
          }
          for (const addrEl of root.querySelectorAll(".hd-seller-addr")) {
            if (!addrEl.textContent?.trim()) {
              addrEl.innerHTML = contact.addressLines.map(escapeHtml).join("<br>");
            }
          }
          const href = navigationHref(view);
          let navBtn = root.querySelector("[data-hd-navigate]");
          if (href && !navBtn) {
            navBtn = document.createElement("a");
            navBtn.className = "hd-btn hd-btn--soft";
            navBtn.dataset.hdNavigate = "";
            navBtn.target = "_blank";
            navBtn.rel = "noopener";
            navBtn.innerHTML = `${ICON.pin} Navigáció`;
            const tools = root.querySelector(".hd-side-actions");
            const phoneBtn = root.querySelector(".hd-side [data-hd-phone]");
            if (phoneBtn) phoneBtn.after(navBtn);
            else if (tools) tools.after(navBtn);
            else root.querySelector(".hd-side")?.appendChild(navBtn);
          }
          if (navBtn && href) navBtn.href = href;
        }
      } catch (error) {
        btn.textContent = "Nem elérhető";
        alert(error.message ?? "A telefonszám most nem kérhető le.");
        phoneTurnstile.reset?.();
      } finally {
        btn.disabled = false;
      }
    });
  });

  root.querySelector("[data-hd-goto-form]")?.addEventListener("click", () => {
    document.getElementById("hd-contact")?.scrollIntoView({ behavior: "smooth" });
  });

  root.querySelectorAll("[data-hd-message]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        btn.disabled = true;
        await openListingMessage({
          listingId: view.id,
          title: view.title,
          priceLabel: view.price,
          meta: view.metaLine,
          code: view.code,
          sellerId: view.userId,
          sellerName: view.sellerName,
        });
      } catch (error) {
        alert(error.message ?? "Az üzenet indítása sikertelen.");
      } finally {
        btn.disabled = false;
      }
    });
  });

  root.querySelector("[data-hd-desc-more]")?.addEventListener("click", (event) => {
    root.querySelector("[data-hd-desc]")?.classList.remove("is-clip");
    event.currentTarget.hidden = true;
  });

  root.querySelector("[data-hd-delete]")?.addEventListener("click", async () => {
    if (!confirm(`Törlöd ezt a hirdetést?\n\n${view.title}`)) return;
    await deleteListingFromDb(view.id);
    window.location.href = listingReturnHref("/beallitasok.html?szekcio=hirdetes");
  });

  document.getElementById("hd-contact")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = root.querySelector("[data-hd-form-status]");
    const user = getAuthUser();
    if (!user) {
      window.location.href = `/belepes.html?next=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }
    const data = new FormData(event.currentTarget);
    const questions = data.getAll("q");
    const parts = [
      `Érdeklődés: ${view.title}`,
      questions.length ? `Kérdések: ${questions.join("; ")}` : "",
      data.get("comment") ? `Megjegyzés: ${data.get("comment")}` : "",
      `Név: ${data.get("name")}`,
      `E-mail: ${data.get("email")}`,
      data.get("phone") ? `Telefon: ${data.get("phone")}` : "",
      data.get("copy") ? "Másolatot kér a feladónak." : "",
    ].filter(Boolean);
    try {
      const conv = await startConversation({
        listingId: view.id,
        title: view.title,
        priceLabel: view.price,
        meta: view.metaLine,
        code: view.code,
        sellerId: view.userId,
        initialBody: parts.join("\n"),
      });
      if (status) {
        status.hidden = false;
        status.textContent = "Az érdeklődés elküldve.";
      }
      event.currentTarget.reset();
      window.location.href = `/uzenetek.html?c=${encodeURIComponent(conv.id)}`;
    } catch (error) {
      if (status) {
        status.hidden = false;
        status.textContent = error.message ?? "Küldés sikertelen.";
      }
    }
  });

  root.querySelectorAll("a[data-listing-id]").forEach((a) => {
    a.addEventListener("click", () => rememberListingOpen(a.dataset.listingId, a));
  });

  root.addEventListener("click", revealRelatedListings);
}

async function init() {
  const id = Number(new URLSearchParams(location.search).get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    root.innerHTML = `<p class="hd-empty">Hiányzó hirdetés.</p>`;
    return;
  }
  try {
    const listing = await fetchListing(id, { view: "detail" });
    if (!listing) throw new Error("Nincs ilyen hirdetés.");
    const view = listing.detail;
    if (!view) throw new Error("A hirdetés adatai hiányosak.");
    render(view, listing, []);
    recordListingView(id, "web").catch(() => {});
    void loadRelatedListings(id, view);
    void loadSellerRating(id);
  } catch (error) {
    root.innerHTML = `<p class="hd-empty">${escapeHtml(error.message ?? "A hirdetés nem tölthető be.")}</p>`;
  }
}

init();
