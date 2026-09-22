import {
  fetchMyListings,
  updateListingStatusInDb,
  saveListingPhotosOrder,
  saveListingToDb,
  deleteListingFromDb,
} from "./db-client.js?v=myAdsSablon2";
import {
  DEFAULT_PHOTO_OVERLAY_ID,
  detectBymyPhotoOverlay,
  renderListingPhotoOverlay,
} from "./listing-photo-overlay.js?v=photoOverlayDetect1";
import { compressListingPhotos } from "./listing-photo-compress.js?v=myAds1";
import { bindListingOpen, restoreListingReturn } from "./listing-return.js?v=scrollTop1";
import {
  promoKiemeltActive,
  promoTopAjanlatActive,
  listingShowsKiemeltDecor,
} from "./listing-promo.js?v=promo1";

const ICON_CAM = `<svg class="myads-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="13.5" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M8 7 9.5 5h5L15 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const ICON_PIN = `<svg class="myads-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="10" r="2.2" stroke="currentColor" stroke-width="1.5"/></svg>`;
const ICON_STAR = `<svg class="myads-ico myads-ico--star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5 14.8 9l7.2.6-5.5 4.7 1.7 7.1L12 17.8 5.8 21.4l1.7-7.1L2 9.6 9.2 9 12 2.5Z"/></svg>`;
const ICON_EYE = `<svg class="myads-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.8" stroke="currentColor" stroke-width="1.6"/></svg>`;
const ICON_EDIT = `<svg class="myads-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4l9.5-9.5a2.1 2.1 0 0 0 0-3L16.5 4.5a2.1 2.1 0 0 0-3 0L4 14v6Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const ICON_TRASH = `<svg class="myads-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function photoUrls(item) {
  const preview = item.preview || {};
  const urls = [...(preview.imageUrls || [])];
  if (preview.imageUrl && !urls.includes(preview.imageUrl)) urls.unshift(preview.imageUrl);
  if (item.fo_kep && !urls.includes(item.fo_kep)) urls.unshift(item.fo_kep);
  return urls.filter(Boolean);
}

function titleOf(item) {
  const f = item.form || {};
  const filter = item.preview?.filter || {};
  const brand = String(f.gyartmany || filter.gyartmany || "").trim();
  const model = String(f.modell || filter.modell || "").trim();
  const tipus = String(f.tipus || filter.tipus || "").trim();
  const fromIdentity = [brand, model, tipus].filter(Boolean).join(" ");
  if (fromIdentity) return fromIdentity;

  const previewTitle = String(item.preview?.title || "").trim();
  if (previewTitle && !/importált autó\s*\(\d{5,}\)/i.test(previewTitle)) return previewTitle;

  const cim = String(item.hirdetes_cime || f.hirdetes_cime || "").trim();
  if (cim && !/importált autó\s*\(\d{5,}\)/i.test(cim)) {
    return cim.replace(/^Eladó\s+/i, "").trim() || cim;
  }
  return `Hirdetés #${item.id}`;
}

function isImmo(item) {
  const f = item.preview?.filter || item.form || {};
  const v = String(f.hirdetes_vertical ?? "").trim().toLowerCase();
  return v === "ingatlan";
}

function metaLine(item) {
  const f = item.preview?.filter || {};
  const form = item.form || {};
  if (isImmo(item)) {
    const city = String(form.telepules || f.telepules || item.preview?.telepules || "").trim();
    const kat = String(form.ingatlan_tipus || f.ingatlan_tipus || form.tipus || "").trim();
    return [city, kat].filter(Boolean).join(" • ");
  }
  const year = f.gyartasi_ev || "";
  const fuel = f.uzemanyag || "";
  const tipus = String(form.tipus || f.tipus || "").trim();
  return [year, fuel, tipus].filter(Boolean).join(" • ");
}

function locationLine(item) {
  const form = item.form || {};
  const f = item.preview?.filter || {};
  const city = String(form.telepules || f.telepules || item.preview?.telepules || "").trim();
  const street = String(form.cim || form.utca || f.cim || "").trim();
  if (street && city) return `${city}, ${street}`;
  return city || street || `#${item.id}`;
}

function priceSecondary(item) {
  if (!isImmo(item)) return "";
  const form = item.form || {};
  const ar = Number(String(form.vetelar || "").replace(/\D/g, ""));
  const m2 = Number(String(form.alapterulet || form.lakoterulet || "").replace(/\D/g, ""));
  if (!Number.isFinite(ar) || ar <= 0 || !Number.isFinite(m2) || m2 <= 0) return "";
  const per = Math.round(ar / m2);
  return `(kb. ${per.toLocaleString("hu-HU")} Ft/m²)`;
}

function isActive(item) {
  return (item.status || "feladott") === "feladott";
}

function readFeaturedIdSet() {
  const g = globalThis.BYMY_FEATURED_LISTING_IDS;
  if (!Array.isArray(g)) return new Set();
  return new Set(g.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0));
}

function hasSablonMeta(item) {
  return Boolean(String(item.form?.photo_overlay_template_id ?? "").trim());
}

function overlayInfoFromListing(item) {
  const f = item.form || {};
  const filter = item.preview?.filter || {};
  const le = String(f.teljesitmeny_le ?? filter.teljesitmeny_le ?? "").trim();
  const kw = String(f.teljesitmeny_kw ?? filter.teljesitmeny_kw ?? "").trim();
  const kmRaw = String(f.km ?? filter.km ?? item.preview?.km ?? "").replace(/\D/g, "");
  return {
    templateId: DEFAULT_PHOTO_OVERLAY_ID,
    brand: String(f.gyartmany ?? filter.gyartmany ?? "").trim(),
    model: [f.modell, f.tipus].filter(Boolean).join(" ") || String(f.modell ?? filter.modell ?? "").trim(),
    year: String(f.gyartasi_ev ?? filter.gyartasi_ev ?? "").trim(),
    km: kmRaw,
    le,
    kw,
    fuel: String(f.uzemanyag ?? filter.uzemanyag ?? "").trim(),
    drive: String(f.hajtas ?? filter.hajtas ?? "").trim(),
    gearbox: String(f.sebessegvalto ?? filter.sebessegvalto ?? "").trim(),
    body: String(f.kivitel ?? filter.kivitel ?? "").trim(),
    doors: String(f.ajtok ?? filter.ajtok ?? "").trim(),
    seats: String(f.szemelyek ?? filter.szemelyek ?? "").trim(),
    dealer: "",
  };
}

function editHref(id) {
  return `/hirdetesfeladas.html?id=${encodeURIComponent(String(id))}`;
}

function listingTime(item) {
  return new Date(item.updated_at ?? item.created_at ?? 0).getTime();
}

/** Alap érvényesség feladás napjától (naptári nap, helyi idő). */
const LISTING_VALIDITY_DAYS = 30;

function startOfLocalDay(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function listingPostedAtIso(item) {
  return String(item.created_at ?? "").trim() || null;
}

function listingAgeDays(item) {
  const start = startOfLocalDay(listingPostedAtIso(item));
  const today = startOfLocalDay(new Date());
  if (start == null || today == null) return null;
  return Math.max(0, Math.round((today - start) / 86400000));
}

function listingDaysRemaining(item) {
  const age = listingAgeDays(item);
  if (age == null) return null;
  return Math.max(0, LISTING_VALIDITY_DAYS - age);
}

function formatDayCount(n) {
  if (n == null) return "—";
  return `${n} nap`;
}

function myadsCardToggleHtml({ labelActive, labelInactive, on, inputAttrs, ariaLabel }) {
  return `
    <label class="myads-card-toggle">
      <span class="myads-card-toggle-label">${on ? labelActive : labelInactive}</span>
      <span class="myads-card-toggle-dot${on ? " is-on" : ""}" aria-hidden="true"></span>
      <input type="checkbox" class="myads-switch" ${inputAttrs} ${on ? "checked" : ""} aria-label="${escapeHtml(ariaLabel)}" />
    </label>
  `;
}

function listingTenureHtml(item) {
  const elapsed = listingAgeDays(item);
  const remaining = listingDaysRemaining(item);
  const expired = remaining === 0 && elapsed != null && elapsed >= LISTING_VALIDITY_DAYS;
  return `
    <p class="myads-tenure" aria-label="Feladás ideje és érvényesség">
      <span class="myads-tenure-item">Feladás óta: <strong>${escapeHtml(formatDayCount(elapsed))}</strong></span>
      <span class="myads-tenure-sep" aria-hidden="true">·</span>
      <span class="myads-tenure-item${expired ? " myads-tenure-item--warn" : ""}">Érvényes még: <strong>${escapeHtml(expired ? "Lejárt" : formatDayCount(remaining))}</strong></span>
    </p>
  `;
}

function listingPriceNum(item) {
  const raw = String(item?.preview?.price ?? item?.form?.vetelar ?? "").replace(/\D/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function initMyAdsPanel(root) {
  if (!root) return { reload() {} };
  bindListingOpen(root);

  let items = [];
  let filter = "all";
  let sort = "newest";
  let photoState = null;
  /** Főképen beégetett sablon, meta nélkül (régi feladás). */
  const sablonDetectedIds = new Set();

  function hasSablon(item) {
    return hasSablonMeta(item) || sablonDetectedIds.has(Number(item.id));
  }

  async function detectSablonOnItems(rows) {
    sablonDetectedIds.clear();
    await Promise.all(
      rows.map(async (item) => {
        if (hasSablonMeta(item)) return;
        const url = photoUrls(item)[0];
        if (!url) return;
        if (await detectBymyPhotoOverlay(url)) {
          sablonDetectedIds.add(Number(item.id));
        }
      })
    );
  }

  async function reload() {
    root.innerHTML = `<p class="mm-empty">Hirdetések betöltése…</p>`;
    try {
      items = await fetchMyListings({ limit: 200 });
      await detectSablonOnItems(items);
      render();
    } catch (error) {
      root.innerHTML = `<p class="mm-empty">${escapeHtml(error.message ?? "Nem sikerült betölteni.")}</p>`;
    }
  }

  function counts() {
    const featured = readFeaturedIdSet();
    let active = 0;
    let inactive = 0;
    let kiemelt = 0;
    let sablon = 0;
    for (const item of items) {
      if (isActive(item)) active += 1;
      else inactive += 1;
      if (listingShowsKiemeltDecor(item, featured)) kiemelt += 1;
      if (hasSablon(item)) sablon += 1;
    }
    return { active, inactive, kiemelt, sablon, all: items.length };
  }

  function filtered() {
    const featured = readFeaturedIdSet();
    return items.filter((item) => {
      if (filter === "active" && !isActive(item)) return false;
      if (filter === "inactive" && isActive(item)) return false;
      if (filter === "featured" && !listingShowsKiemeltDecor(item, featured)) return false;
      if (filter === "sablon" && !hasSablon(item)) return false;
      return true;
    });
  }

  function sorted(rows) {
    const list = [...rows];
    if (sort === "oldest") {
      return list.sort((a, b) => listingTime(a) - listingTime(b));
    }
    if (sort === "price-asc") {
      return list.sort((a, b) => (listingPriceNum(a) ?? Infinity) - (listingPriceNum(b) ?? Infinity));
    }
    if (sort === "price-desc") {
      return list.sort((a, b) => (listingPriceNum(b) ?? -1) - (listingPriceNum(a) ?? -1));
    }
    return list.sort((a, b) => listingTime(b) - listingTime(a));
  }

  function render() {
    const c = counts();
    const rows = sorted(filtered());
    root.innerHTML = `
      <div class="myads-shell">
        <div class="myads-topbar">
          <h2 class="myads-page-title">Saját hirdetések</h2>
          <a class="myads-new-btn" href="/hirdetesfeladas.html" data-auth-guard>+ Új hirdetés <span class="myads-new-caret" aria-hidden="true">▾</span></a>
        </div>
        <div class="myads-filters-row">
          <div class="myads-pills" role="tablist" aria-label="Szűrés">
            <button type="button" class="myads-pill${filter === "all" ? " is-active" : ""}" data-filter="all" role="tab" aria-selected="${filter === "all"}">Összes</button>
            <button type="button" class="myads-pill${filter === "active" ? " is-active" : ""}" data-filter="active" role="tab" aria-selected="${filter === "active"}">Aktív (${c.active})</button>
            <button type="button" class="myads-pill${filter === "inactive" ? " is-active" : ""}" data-filter="inactive" role="tab" aria-selected="${filter === "inactive"}">Inaktív (${c.inactive})</button>
            <button type="button" class="myads-pill${filter === "featured" ? " is-active" : ""}" data-filter="featured" role="tab" aria-selected="${filter === "featured"}">Kiemelt (${c.kiemelt})</button>
            <button type="button" class="myads-pill${filter === "sablon" ? " is-active" : ""}" data-filter="sablon" role="tab" aria-selected="${filter === "sablon"}">Sablon (${c.sablon})</button>
          </div>
          <label class="myads-sort">
            <span class="myads-sort-icon" aria-hidden="true">⇅</span>
            <select data-myads-sort aria-label="Rendezés">
              <option value="newest"${sort === "newest" ? " selected" : ""}>Legújabb elöl</option>
              <option value="oldest"${sort === "oldest" ? " selected" : ""}>Legrégebbi elöl</option>
              <option value="price-desc"${sort === "price-desc" ? " selected" : ""}>Ár: csökkenő</option>
              <option value="price-asc"${sort === "price-asc" ? " selected" : ""}>Ár: növekvő</option>
            </select>
          </label>
        </div>
        <div class="myads-list-wrap">
          <div class="myads-list" role="list">
            ${
              rows.length
                ? rows.map((item) => rowHtml(item)).join("")
                : `<p class="myads-empty-cell">Nincs megjeleníthető hirdetés.</p>`
            }
          </div>
        </div>
      </div>
      ${photoModalHtml()}
    `;
    bind();
    restoreListingReturn();
  }

  function rowHtml(item) {
    const urls = photoUrls(item);
    const thumb = urls[0] || "";
    const count = urls.length;
    const views = item.views || item.preview?.views || { web: item.views_web || 0, app: item.views_app || 0 };
    const web = Number(views.web || item.views_web || 0);
    const app = Number(views.app || item.views_app || 0);
    const active = isActive(item);
    const featuredIds = readFeaturedIdSet();
    const isFeatured = listingShowsKiemeltDecor(item, featuredIds);
    const kiemeltPromoOn = promoKiemeltActive(item);
    const isTopOffer = promoTopAjanlatActive(item);
    const sablonOn = hasSablon(item);
    const edit = editHref(item.id);
    const price = escapeHtml(item.preview?.price || "—");
    const priceSub = priceSecondary(item);
    const badge = isFeatured ? "Kiemelt" : active ? "Aktív" : "Inaktív";
    const badgeClass = isFeatured ? "is-featured" : active ? "is-active" : "is-inactive";

    return `
      <article class="myads-card${isFeatured ? " myads-card--featured" : ""}" role="listitem" data-id="${item.id}">
        <div class="myads-card-top">
          <div class="myads-photo-cell">
            <div class="myads-thumb">
              ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" />` : `<span class="myads-thumb-empty">Nincs kép</span>`}
              ${count ? `<span class="myads-photo-count">${count}</span>` : ""}
            </div>
            <button type="button" class="myads-photo-manage" data-photos="${item.id}">${ICON_CAM} Képkezelés</button>
          </div>
          <div class="myads-card-head">
            <div class="myads-title-row">
              ${isFeatured ? `<span class="myads-star" aria-hidden="true">${ICON_STAR}</span>` : ""}
              <a class="myads-title" href="/hirdetes.html?id=${item.id}" data-listing-id="${item.id}">${escapeHtml(titleOf(item))}</a>
              <span class="myads-status-badge myads-status-badge--${badgeClass}">${badge}</span>
            </div>
            <p class="myads-meta">${escapeHtml(metaLine(item))}</p>
            <p class="myads-loc">${ICON_PIN}<span>${escapeHtml(locationLine(item))}</span></p>
            <p class="myads-views">Megtekintve: <strong>${web + app}</strong> · Web: <strong>${web}</strong> · Mobilapp: <strong>${app}</strong></p>
            ${listingTenureHtml(item)}
            <label class="myads-inactive myads-inactive--compact">
              <input type="checkbox" data-inactive="${item.id}" ${active ? "" : "checked"} />
              <span>Lefoglalózva / inaktív</span>
            </label>
          </div>
          <div class="myads-price-block">
            <strong class="myads-price-lg">${price}</strong>
            ${priceSub ? `<span class="myads-price-sub">${escapeHtml(priceSub)}</span>` : ""}
            <div class="myads-card-toggles">
              ${myadsCardToggleHtml({
                labelActive: "Sablon: Aktív",
                labelInactive: "Sablon: nincs",
                on: sablonOn,
                inputAttrs: `data-sablon-toggle="${item.id}"`,
                ariaLabel: "Sablon be- és kikapcsolása",
              })}
              ${myadsCardToggleHtml({
                labelActive: "Kiemelés: Aktív",
                labelInactive: "Kiemelés: nincs",
                on: kiemeltPromoOn,
                inputAttrs: `data-promo-toggle="${item.id}" data-promo-kind="kiemelt"`,
                ariaLabel: "Kiemelés be- és kikapcsolása",
              })}
              ${myadsCardToggleHtml({
                labelActive: "TOP ajánlat: Aktív",
                labelInactive: "TOP ajánlat: nincs",
                on: isTopOffer,
                inputAttrs: `data-promo-toggle="${item.id}" data-promo-kind="top"`,
                ariaLabel: "TOP ajánlat be- és kikapcsolása",
              })}
            </div>
          </div>
        </div>
        <div class="myads-promo-strip" role="group" aria-label="Promóció">
          <div class="myads-promo-btns">
            <button type="button" class="myads-promo-btn${kiemeltPromoOn ? " is-on" : ""}" data-promo="kiemelt" data-id="${item.id}">${ICON_STAR}<span>Kiemelés</span></button>
            <button type="button" class="myads-promo-btn${isTopOffer ? " is-on" : ""}" data-promo="top" data-id="${item.id}"><span>TOP ajánlat</span></button>
            <a class="myads-promo-btn myads-promo-btn--link" href="${escapeHtml(edit)}">${ICON_EYE}<span>Sablon</span></a>
          </div>
        </div>
        <footer class="myads-card-foot">
          <strong class="myads-price-foot">${price}</strong>
          <div class="myads-fn">
            <a class="myads-fn-btn" href="${escapeHtml(edit)}">${ICON_EDIT}<span>Módosítás</span></a>
            <a class="myads-fn-btn" href="/hirdetes.html?id=${item.id}" data-listing-id="${item.id}">${ICON_EYE}<span>Megtekintés</span></a>
            <button type="button" class="myads-fn-btn myads-fn-btn--danger" data-delete="${item.id}">${ICON_TRASH}<span>Törlés</span></button>
          </div>
        </footer>
      </article>
    `;
  }

  function photoModalHtml() {
    return `
      <div class="myads-modal" data-photo-modal hidden>
        <div class="myads-modal-card">
          <header class="myads-modal-head">
            <h3>Képkezelés</h3>
            <button type="button" class="myads-link" data-photo-close>Bezárás</button>
          </header>
          <p class="myads-modal-lead" data-photo-title></p>
          <div class="myads-photo-list" data-photo-list></div>
          <div class="myads-photo-add">
            <label class="site-header-btn site-header-btn--outline">
              Képek hozzáadása
              <input type="file" accept="image/*" multiple hidden data-photo-file />
            </label>
          </div>
          <div class="myads-modal-actions">
            <button type="button" class="site-header-btn site-header-btn--primary" data-photo-save>Mentés</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderPhotoList() {
    const list = root.querySelector("[data-photo-list]");
    if (!list || !photoState) return;
    list.innerHTML = photoState.items
      .map((item, index) => {
        const src = item.url || item.preview || "";
        return `
          <div class="myads-photo-item" data-idx="${index}">
            <img src="${escapeHtml(src)}" alt="" />
            <div class="myads-photo-item-actions">
              <button type="button" data-photo-up="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
              <button type="button" data-photo-down="${index}" ${index === photoState.items.length - 1 ? "disabled" : ""}>↓</button>
              <button type="button" data-photo-del="${index}">Törlés</button>
            </div>
            ${index === 0 ? `<span class="myads-photo-primary">Főkép</span>` : ""}
          </div>
        `;
      })
      .join("");
  }

  async function persistPromoFlag(item, fieldKey, active) {
    const form = {
      ...(item.form || {}),
      [fieldKey]: active ? "1" : "0",
    };
    await saveListingToDb(form, item.id, { status: item.status || "feladott" });
    if (item.form) item.form[fieldKey] = form[fieldKey];
  }

  async function persistSablonMeta(item, { active, baseUrl }) {
    const form = {
      ...(item.form || {}),
      photo_overlay_base_url: String(baseUrl || item.form?.photo_overlay_base_url || "").trim(),
      photo_overlay_template_id: active ? DEFAULT_PHOTO_OVERLAY_ID : null,
    };
    await saveListingToDb(form, item.id, { status: item.status || "feladott" });
  }

  async function setSablonActive(item, wantActive) {
    const urls = photoUrls(item);
    if (!urls.length) {
      throw new Error("Előbb adj hozzá legalább egy képet.");
    }
    const form = item.form || {};
    const fo = urls[0];
    let base = String(form.photo_overlay_base_url || "").trim();
    if (!base) base = fo;
    const rest = urls.slice(1).map((url) => ({ url }));
    const id = Number(item.id);
    const alreadyOnImage =
      hasSablon(item) || sablonDetectedIds.has(id) || (await detectBymyPhotoOverlay(fo));

    if (wantActive) {
      if (alreadyOnImage) {
        await persistSablonMeta(item, { active: true, baseUrl: base });
        sablonDetectedIds.add(id);
        return;
      }
      if (!String(form.photo_overlay_base_url || "").trim()) {
        base = fo;
      }
      const dataUrl = await renderListingPhotoOverlay(base, overlayInfoFromListing(item));
      await saveListingPhotosOrder(item.id, [{ data: dataUrl }, ...rest]);
      await persistSablonMeta(item, { active: true, baseUrl: base });
      sablonDetectedIds.add(id);
      return;
    }

    const baseIsOverlay = base === fo && (alreadyOnImage || (await detectBymyPhotoOverlay(fo)));
    if (baseIsOverlay) {
      await persistSablonMeta(item, { active: false, baseUrl: base });
      sablonDetectedIds.delete(id);
      return;
    }

    if (!base) {
      throw new Error("Az eredeti főkép nem állítható vissza. Szerkesztésben állítsd vissza a képet.");
    }
    await saveListingPhotosOrder(item.id, [{ url: base }, ...rest]);
    await persistSablonMeta(item, { active: false, baseUrl: base });
    sablonDetectedIds.delete(id);
  }

  function openPhotos(id) {
    const item = items.find((row) => Number(row.id) === Number(id));
    if (!item) return;
    photoState = {
      id: item.id,
      title: titleOf(item),
      items: photoUrls(item).map((url) => ({ url })),
    };
    const modal = root.querySelector("[data-photo-modal]");
    const title = root.querySelector("[data-photo-title]");
    if (title) title.textContent = photoState.title;
    modal.hidden = false;
    renderPhotoList();
  }

  function bind() {
    root.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filter = btn.dataset.filter || "all";
        render();
      });
    });
    root.querySelector("[data-myads-sort]")?.addEventListener("change", (event) => {
      sort = event.target.value;
      render();
    });
    root.querySelectorAll("[data-photos]").forEach((btn) => {
      btn.addEventListener("click", () => openPhotos(btn.dataset.photos));
    });
    async function setPromoKindActive(item, kind, wantOn) {
      const fieldKey = kind === "top" ? "promo_top_ajanlat" : "promo_kiemelt";
      await persistPromoFlag(item, fieldKey, wantOn);
    }

    root.querySelectorAll("[data-promo='kiemelt'], [data-promo='top']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        const item = items.find((row) => Number(row.id) === id);
        if (!item) return;
        const kind = btn.dataset.promo;
        const wasOn = kind === "top" ? promoTopAjanlatActive(item) : promoKiemeltActive(item);
        const wantOn = !wasOn;
        btn.disabled = true;
        btn.classList.add("is-busy");
        try {
          await setPromoKindActive(item, kind, wantOn);
          await reload();
        } catch (error) {
          alert(error.message ?? "A promó mentése sikertelen.");
        } finally {
          btn.disabled = false;
          btn.classList.remove("is-busy");
        }
      });
    });
    root.querySelectorAll("[data-promo-toggle]").forEach((input) => {
      input.addEventListener("change", async () => {
        const id = Number(input.dataset.promoToggle);
        const kind = input.dataset.promoKind;
        const item = items.find((row) => Number(row.id) === id);
        if (!item || !kind) return;
        const wantOn = input.checked;
        const label = input.closest(".myads-card-toggle");
        label?.classList.add("is-busy");
        input.disabled = true;
        try {
          await setPromoKindActive(item, kind, wantOn);
          await reload();
        } catch (error) {
          input.checked = !wantOn;
          alert(error.message ?? "A promó mentése sikertelen.");
        } finally {
          input.disabled = false;
          label?.classList.remove("is-busy");
        }
      });
    });
    root.querySelectorAll("[data-sablon-toggle]").forEach((input) => {
      input.addEventListener("change", async () => {
        const id = Number(input.dataset.sablonToggle);
        const item = items.find((row) => Number(row.id) === id);
        if (!item) return;
        const wantActive = input.checked;
        const label = input.closest(".myads-card-toggle");
        label?.classList.add("is-busy");
        input.disabled = true;
        try {
          await setSablonActive(item, wantActive);
          await reload();
        } catch (error) {
          input.checked = !wantActive;
          alert(error.message ?? "A sablon mentése sikertelen.");
        } finally {
          input.disabled = false;
          label?.classList.remove("is-busy");
        }
      });
    });
    root.querySelectorAll("[data-inactive]").forEach((box) => {
      box.addEventListener("change", async () => {
        const id = Number(box.dataset.inactive);
        try {
          await updateListingStatusInDb(id, box.checked ? "inaktiv" : "feladott");
          await reload();
        } catch (error) {
          alert(error.message ?? "A státusz mentése sikertelen.");
          box.checked = !box.checked;
        }
      });
    });
    root.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.delete);
        const item = items.find((row) => Number(row.id) === id);
        if (!confirm(`Törlöd ezt a hirdetést?\n\n${titleOf(item || { id })}`)) return;
        try {
          await deleteListingFromDb(id);
          await reload();
        } catch (error) {
          alert(error.message ?? "A törlés sikertelen.");
        }
      });
    });
    root.querySelector("[data-photo-close]")?.addEventListener("click", () => {
      root.querySelector("[data-photo-modal]").hidden = true;
      photoState = null;
    });
    root.querySelector("[data-photo-list]")?.addEventListener("click", (event) => {
      const up = event.target.closest("[data-photo-up]");
      const down = event.target.closest("[data-photo-down]");
      const del = event.target.closest("[data-photo-del]");
      if (!photoState) return;
      if (up) {
        const i = Number(up.dataset.photoUp);
        if (i > 0) {
          const [moved] = photoState.items.splice(i, 1);
          photoState.items.splice(i - 1, 0, moved);
          renderPhotoList();
        }
      }
      if (down) {
        const i = Number(down.dataset.photoDown);
        if (i < photoState.items.length - 1) {
          const [moved] = photoState.items.splice(i, 1);
          photoState.items.splice(i + 1, 0, moved);
          renderPhotoList();
        }
      }
      if (del) {
        const i = Number(del.dataset.photoDel);
        photoState.items.splice(i, 1);
        renderPhotoList();
      }
    });
    root.querySelector("[data-photo-file]")?.addEventListener("change", async (event) => {
      const files = [...(event.target.files || [])];
      event.target.value = "";
      if (!files.length || !photoState) return;
      try {
        const dataUrls = await compressListingPhotos(files);
        for (const data of dataUrls) {
          photoState.items.push({ data, preview: data });
        }
        renderPhotoList();
      } catch (error) {
        alert(error.message ?? "A kép hozzáadása sikertelen.");
      }
    });
    root.querySelector("[data-photo-save]")?.addEventListener("click", async () => {
      if (!photoState) return;
      if (!photoState.items.length) {
        alert("Legalább egy kép kell.");
        return;
      }
      const btn = root.querySelector("[data-photo-save]");
      btn.disabled = true;
      try {
        await saveListingPhotosOrder(
          photoState.id,
          photoState.items.map((item) => (item.url ? { url: item.url } : { data: item.data }))
        );
        root.querySelector("[data-photo-modal]").hidden = true;
        photoState = null;
        await reload();
      } catch (error) {
        alert(error.message ?? "A képek mentése sikertelen.");
      } finally {
        btn.disabled = false;
      }
    });
  }

  return { reload };
}
