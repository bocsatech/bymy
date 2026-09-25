/** „Több ettől a hirdetőtől” — kereskedő készlet (demo A), bymy menüsáv érintetlen. */

import { fetchSellerContact, revealListingContact, fetchSellerRating, submitSellerRating } from "./db-client.js?v=sellerInv15";
import { mountTurnstile } from "./turnstile-ui.js?v=turnstile10";
import { getAuthUser } from "./site-auth.js?v=authMembersOnly1";
import { openListingMessage, canMessageListing } from "./start-listing-message.js?v=msgLive3";
import { getParkplatz, addParkplatzItem, removeParkplatzItem } from "./fok-data.js?v=parkThumb1";
import { listingDetailHref } from "./listing-return.js?v=searchNav1";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageShareUrl() {
  return window.location.href.split("#")[0];
}

function injectStylesheet() {
  if (document.querySelector('link[data-seller-inv-css]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/css/seller-inventory.css?v=sellerInv30";
  link.dataset.sellerInvCss = "1";
  document.head.appendChild(link);
}

function ensureHost() {
  let host = document.getElementById("seller-inv-root");
  if (host) return host;
  host = document.createElement("div");
  host.id = "seller-inv-root";
  host.className = "seller-inv";
  const panel = document.querySelector(".home-listings-panel");
  const center = document.querySelector(".home-center, .site-center");
  const grid = document.getElementById("home-grid-track");
  if (panel?.parentElement) {
    panel.parentElement.insertBefore(host, panel);
  } else if (grid?.parentElement) {
    grid.parentElement.insertBefore(host, grid);
  } else if (center) {
    center.prepend(host);
  } else {
    document.querySelector("main")?.prepend(host);
  }
  return host;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const ICON = {
  share: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 8a3 3 0 1 0-2.8-4M8 12a3 3 0 1 0 0 0.01M16 20a3 3 0 1 0-2.8-4M8.7 13.2l6.6 3.6M15.3 7.2l-6.6 3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  facebook: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.5 8.5h2.2V5.2H14.3c-2.6 0-4.3 1.6-4.3 4.4v1.9H7.8v3.4h2.2V22h3.5v-7.1h2.5l.5-3.4h-3V9.8c0-1 .3-1.3 1.2-1.3Z"/></svg>`,
  print: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 8V5h10v3M6 14h12v5H6v-5Z" stroke="currentColor" stroke-width="1.6"/><path d="M4.8 9h14.4A1.7 1.7 0 0 1 21 10.7v4.2h-3M3 14.9V10.7A1.7 1.7 0 0 1 4.8 9" stroke="currentColor" stroke-width="1.6"/></svg>`,
  mail: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16v10H4V7Z" stroke="currentColor" stroke-width="1.6"/><path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.6"/></svg>`,
  phone: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.5 4.8h3.2l1.1 3.2-1.8 1.1a12 12 0 0 0 6 6l1.1-1.8 3.2 1.1v3.2A2 2 0 0 1 17.3 20 15 15 0 0 1 4 6.7 2 2 0 0 1 6.5 4.8Z" stroke="currentColor" stroke-width="1.6"/></svg>`,
  heart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7.2a3.8 3.8 0 0 1 7 3.6C19 15.6 12 20 12 20Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  pin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="11" r="2.2" stroke="currentColor" stroke-width="1.6"/></svg>`,
};

const SELLER_AVATAR_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">` +
      `<circle cx="24" cy="24" r="24" fill="#e4eaf4"/>` +
      `<circle cx="24" cy="17.5" r="7.5" fill="#8e9aaf"/>` +
      `<path fill="#8e9aaf" d="M7.2 42.8C9.2 33.8 15.2 29.5 24 29.5s14.8 4.3 16.8 13.3C36.2 45.6 30.4 47.5 24 47.5S11.8 45.6 7.2 42.8z"/>` +
      `</svg>`
  );

function starsHtml(average, { interactive = false, selected = 0 } = {}) {
  const avg = average != null && Number.isFinite(Number(average)) ? Number(average) : null;
  const filled = selected > 0 ? selected : avg != null ? Math.round(avg) : 0;
  const buttons = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    const on = n <= filled;
    if (interactive) {
      return `<button type="button" class="seller-inv__star${on ? " is-on" : ""}" data-si-rate="${n}" aria-label="${n} csillag">${on ? "★" : "☆"}</button>`;
    }
    return `<span class="seller-inv__star${on ? " is-on" : ""}" aria-hidden="true">${on ? "★" : "☆"}</span>`;
  }).join("");
  return `<div class="seller-inv__stars" role="${interactive ? "group" : "img"}" aria-label="${
    avg != null ? `Értékelés ${avg} / 10` : "Még nincs értékelés"
  }">${buttons}</div>`;
}

function ratingSummaryHtml(rating) {
  const avg = rating?.average != null ? Number(rating.average) : null;
  const count = Number(rating?.count) || 0;
  if (avg == null || count <= 0) {
    return `<p class="seller-inv__rating-summary seller-inv__rating-summary--empty">Még nincs értékelés</p>`;
  }
  const filled = Math.max(0, Math.min(5, Math.round((avg / 10) * 5)));
  const stars = Array.from({ length: 5 }, (_, i) =>
    i < filled
      ? `<span class="seller-inv__star-sm is-on" aria-hidden="true">★</span>`
      : `<span class="seller-inv__star-sm" aria-hidden="true">☆</span>`
  ).join("");
  const avgLabel = Number.isFinite(avg) ? String(avg).replace(".", ",") : String(avg);
  return `<p class="seller-inv__rating-summary" title="${esc(avgLabel)} / 10">
    <span class="seller-inv__stars-sm" role="img" aria-label="Értékelés ${esc(avgLabel)} / 10">${stars}</span>
    <strong>${esc(avgLabel)}</strong>
    <span class="seller-inv__rating-scale">/ 10</span>
    <span class="seller-inv__rating-n">(${count})</span>
  </p>`;
}

function ratingBlockHtml(rating) {
  const myScore = rating?.myScore != null ? Number(rating.myScore) : null;
  let rateExtra = "";
  if (myScore != null) {
    rateExtra = `<p class="seller-inv__hint">Te értékelésed: <strong>${esc(String(myScore))} / 10</strong></p>`;
  } else if (rating?.canRate) {
    rateExtra = `
      <div class="seller-inv__rate" data-si-rate-wrap>
        <p class="seller-inv__rate-label">Értékeld (1–10):</p>
        ${starsHtml(null, { interactive: true, selected: 0 })}
        <button type="button" class="seller-inv__btn seller-inv__btn--soft seller-inv__rate-save" data-si-rate-save disabled>Mentés</button>
        <p class="seller-inv__hint" data-si-rate-msg hidden></p>
      </div>`;
  } else if (!rating?.loggedIn) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    rateExtra = `<p class="seller-inv__hint"><a href="/belepes.html?next=${next}">Jelentkezz be</a> az értékeléshez.</p>`;
  } else {
    rateExtra = `<p class="seller-inv__hint">Saját magadat nem értékelheted.</p>`;
  }

  return `<div class="seller-inv__rating" data-si-rating>
    ${ratingSummaryHtml(rating)}
    ${rateExtra}
  </div>`;
}

function bindSellerRating(panel, fromId) {
  const wrap = panel.querySelector("[data-si-rate-wrap]");
  if (!wrap) return;
  const stars = [...wrap.querySelectorAll("[data-si-rate]")];
  const saveBtn = wrap.querySelector("[data-si-rate-save]");
  const msg = wrap.querySelector("[data-si-rate-msg]");
  let selected = 0;

  const paint = (n) => {
    stars.forEach((b) => {
      const v = Number(b.getAttribute("data-si-rate"));
      const on = v <= n;
      b.classList.toggle("is-on", on);
      b.textContent = on ? "★" : "☆";
    });
  };

  stars.forEach((btn) => {
    btn.addEventListener("mouseenter", () => paint(Number(btn.getAttribute("data-si-rate"))));
    btn.addEventListener("mouseleave", () => paint(selected));
    btn.addEventListener("click", () => {
      selected = Number(btn.getAttribute("data-si-rate"));
      if (!Number.isFinite(selected) || selected < 1) selected = 0;
      paint(selected);
      if (saveBtn) saveBtn.disabled = !(selected >= 1 && selected <= 10);
      if (msg) {
        msg.hidden = true;
        msg.textContent = "";
      }
    });
  });

  saveBtn?.addEventListener("click", async () => {
    if (!(selected >= 1 && selected <= 10)) {
      if (msg) {
        msg.hidden = false;
        msg.textContent = "Előbb válassz 1–10 csillagot.";
      }
      return;
    }
    saveBtn.disabled = true;
    stars.forEach((b) => {
      b.disabled = true;
    });
    try {
      const rating = await submitSellerRating(fromId, selected);
      const slot = panel.querySelector("[data-si-rating]") || panel;
      slot.outerHTML = ratingBlockHtml(rating);
      bindSellerRating(panel, fromId);
    } catch (err) {
      if (msg) {
        msg.hidden = false;
        msg.textContent = err?.message || "Nem sikerült az értékelés.";
      }
      stars.forEach((b) => {
        b.disabled = false;
      });
      saveBtn.disabled = false;
    }
  });
}

function maskedPhonesHtml(masked = [], hasPhone = false) {
  const list = (masked || []).map((p) => String(p || "").trim()).filter(Boolean);
  if (!list.length && !hasPhone) return `<p class="seller-inv__hint">Nincs telefonszám.</p>`;
  const label = list[0] || "Telefonszám";
  return `
    <button type="button" class="seller-inv__btn seller-inv__btn--soft seller-inv__phone-reveal" data-si-phone-reveal>
      ${ICON.phone}
      <span>${esc(label)} mutatása</span>
    </button>
    <div class="seller-inv__turnstile" data-si-turnstile hidden></div>
  `;
}

function fullPhonesHtml(phones = []) {
  const list = (phones || []).map((p) => String(p || "").trim()).filter(Boolean);
  if (!list.length) return `<p class="seller-inv__hint">Nincs telefonszám.</p>`;
  const first = list[0];
  const digits = first.replace(/[^\d+]/g, "");
  const href = digits.length >= 7 ? `tel:${digits}` : "";
  const more =
    list.length > 1
      ? `<ul class="seller-inv__phones">${list
          .slice(1)
          .map((phone) => {
            const d = phone.replace(/[^\d+]/g, "");
            const h = d.length >= 7 ? `tel:${d}` : "";
            return h
              ? `<li><a href="${esc(h)}">${esc(phone)}</a></li>`
              : `<li>${esc(phone)}</li>`;
          })
          .join("")}</ul>`
      : "";
  return `
    ${
      href
        ? `<a class="seller-inv__btn seller-inv__btn--soft seller-inv__phone-reveal" href="${esc(href)}">${ICON.phone}<span>Hívás · ${esc(first)}</span></a>`
        : `<p class="seller-inv__phones"><span>${esc(first)}</span></p>`
    }
    ${more}
  `;
}

function addressHtml(lines = []) {
  const list = (lines || []).map((l) => String(l || "").trim()).filter(Boolean);
  if (!list.length) return "";
  return `<p class="seller-inv__address">${list.map(esc).join("<br />")}</p>`;
}

function navHref(mapQuery) {
  const q = String(mapQuery || "").trim();
  if (!q) return "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

function displayName(contact) {
  const staff = Array.isArray(contact?.staff) ? contact.staff : [];
  const first = String(staff[0]?.name || "").trim();
  return first || String(contact?.sellerName || "").trim() || "Hirdető";
}

function sellerMenuHtml(contact, rating, count, fromId) {
  const name = displayName(contact);
  const avatar = String(contact?.sellerAvatarUrl || "").trim() || SELLER_AVATAR_PLACEHOLDER;
  const lines = Array.isArray(contact?.addressLines) ? contact.addressLines : [];
  const nav = navHref(contact?.mapQuery || lines.join(", "));
  const masked = Array.isArray(contact?.phonesMasked) ? contact.phonesMasked : [];
  const hasPhone = Boolean(contact?.hasPhone) || masked.length > 0;
  const n = Number(count) || 0;
  const sellerId = Number(contact?.sellerId || contact?.ownerId || 0);
  const canMsg = canMessageListing(sellerId > 0 ? sellerId : undefined, { listingId: fromId });

  return `
    <div class="seller-inv__menu-grid">
      <div class="seller-inv__menu-identity">
        <div class="seller-inv__menu-card">
          <span class="seller-inv__menu-avatar" aria-hidden="true">
            <img src="${esc(avatar)}" alt="" width="48" height="48" decoding="async" />
          </span>
          <div class="seller-inv__menu-meta">
            <p class="seller-inv__menu-name">${esc(name)}</p>
            ${ratingBlockHtml(rating)}
          </div>
        </div>
        ${addressHtml(lines)}
      </div>
      <div class="seller-inv__menu-actions">
        ${
          canMsg
            ? `<button type="button" class="seller-inv__btn seller-inv__btn--yellow" data-si-message>${ICON.mail} Üzenet küldése</button>`
            : ""
        }
        <div class="seller-inv__menu-icons">
          <button type="button" class="seller-inv__btn seller-inv__btn--icon" data-si-fav aria-label="Kedvencekhez adás" aria-pressed="false" title="Kedvenc">${ICON.heart}</button>
          <button type="button" class="seller-inv__btn seller-inv__btn--icon" data-si-share aria-label="Megosztás" title="Megosztás">${ICON.share}</button>
          <button type="button" class="seller-inv__btn seller-inv__btn--icon seller-inv__btn--fb" data-si-share-fb aria-label="Megosztás Facebookon" title="Facebook">${ICON.facebook}</button>
          <button type="button" class="seller-inv__btn seller-inv__btn--icon" data-si-print aria-label="Nyomtatás" title="Nyomtatás">${ICON.print}</button>
        </div>
        <div class="seller-inv__phone-wrap" data-si-phone-col>
          ${maskedPhonesHtml(masked, hasPhone)}
        </div>
        ${
          nav
            ? `<a class="seller-inv__btn seller-inv__btn--soft" href="${esc(nav)}" target="_blank" rel="noopener noreferrer">${ICON.pin} Navigáció</a>`
            : ""
        }
        <button type="button" class="seller-inv__btn seller-inv__btn--soft" data-si-related>
          Kereskedés többi hirdetései <span data-si-active-count>${esc(String(n))}</span>
        </button>
        <a class="seller-inv__btn seller-inv__btn--soft" href="/adasveteli-szerzodes.html?id=${encodeURIComponent(fromId)}">Adásvételi szerződés</a>
      </div>
    </div>
  `;
}

function bindPhoneReveal(host, fromId) {
  const btn = host.querySelector("[data-si-phone-reveal]");
  const col = host.querySelector("[data-si-phone-col]");
  const turnstileHost = host.querySelector("[data-si-turnstile]");
  if (!btn || !col) return;
  let turnstileApi = null;

  btn.addEventListener("click", async () => {
    if (btn.dataset.done === "1") return;
    btn.disabled = true;
    try {
      if (!turnstileApi && turnstileHost) {
        turnstileHost.hidden = false;
        turnstileApi = await mountTurnstile(turnstileHost, { action: "listing-reveal" });
      }
      let token = "";
      if (turnstileApi?.enabled) {
        token = turnstileApi.execute
          ? await turnstileApi.execute({ waitMs: 15000 })
          : await turnstileApi.getToken({ waitMs: 10000 });
        if (!token) {
          throw new Error("A biztonsági ellenőrzés sikertelen. Próbáld újra.");
        }
      }
      const revealed = await revealListingContact(fromId, token);
      const phones = revealed.phones?.length
        ? revealed.phones
        : revealed.phone
          ? [revealed.phone]
          : [];
      col.innerHTML = fullPhonesHtml(phones);
      btn.dataset.done = "1";
    } catch (err) {
      btn.disabled = false;
      const hint = document.createElement("p");
      hint.className = "seller-inv__hint";
      hint.textContent = err?.message || "A telefonszám most nem érhető el.";
      turnstileHost?.insertAdjacentElement("beforebegin", hint);
      turnstileApi?.reset?.();
    }
  });
}

function bindMenuActions(host, { fromId, contact, label }) {
  const url = pageShareUrl();
  const shareText = "Oszd meg barátaiddal a kereskedésünk autóit.";

  host.querySelector("[data-si-share]")?.addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: label, url, text: shareText });
        return;
      }
    } catch {
      /* fall through */
    }
    const ok = await copyText(url);
    const btn = host.querySelector("[data-si-share]");
    if (btn && ok) {
      btn.title = "Link másolva";
      setTimeout(() => {
        btn.title = "Megosztás";
      }, 1600);
    }
  });

  host.querySelector("[data-si-share-fb]")?.addEventListener("click", () => {
    const href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(href, "_blank", "noopener,noreferrer,width=640,height=720");
  });

  host.querySelector("[data-si-print]")?.addEventListener("click", () => window.print());

  host.querySelector("[data-si-related]")?.addEventListener("click", () => {
    host.querySelector(".seller-inv__title")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  host.querySelector("[data-si-message]")?.addEventListener("click", async () => {
    try {
      await openListingMessage({
        listingId: fromId,
        title: label,
        sellerId: contact?.sellerId || contact?.ownerId,
        sellerName: label,
      });
    } catch (err) {
      window.alert(err?.message || "Az üzenet most nem indítható.");
    }
  });

  const fav = host.querySelector("[data-si-fav]");
  const email = getAuthUser()?.email;
  if (fav && email) {
    const sync = (on) => {
      fav.classList.toggle("is-on", on);
      fav.setAttribute("aria-pressed", on ? "true" : "false");
    };
    sync(getParkplatz(email).some((row) => String(row.id) === String(fromId)));
    fav.addEventListener("click", () => {
      const on = fav.classList.contains("is-on");
      if (on) {
        removeParkplatzItem(email, fromId);
        sync(false);
      } else {
        addParkplatzItem(email, {
          id: fromId,
          title: label,
          price: "",
          url: listingDetailHref(fromId),
          imageUrl: String(contact?.sellerAvatarUrl || "").trim(),
        });
        sync(true);
      }
    });
  } else if (fav) {
    fav.addEventListener("click", () => {
      window.location.href = `/belepes.html?next=${encodeURIComponent(location.pathname + location.search)}`;
    });
  }
}

function buildMapQuery(contact) {
  const lines = (Array.isArray(contact?.addressLines) ? contact.addressLines : [])
    .map((l) => String(l || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const mq = String(contact?.mapQuery || "").replace(/\s+/g, " ").trim();
  const postalCity = lines.find((l) => /^\d{4}\b/.test(l)) || "";
  const street = lines.find((l) => l && l !== postalCity) || "";
  const parts = [street, postalCity, "Magyarország"].filter(Boolean);
  const built = parts.join(", ");
  if (built.replace(/,?\s*Magyarország\s*$/i, "").trim()) return built;
  if (mq) return /magyarország/i.test(mq) ? mq : `${mq}, Magyarország`;
  return "";
}

function mapOpenHref(query) {
  const q = String(query || "").trim();
  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

let leafletPromise = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/vendor/leaflet/leaflet.css";
      link.dataset.leafletCss = "1";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "/vendor/leaflet/leaflet.js";
    script.async = true;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet nem töltődött.")));
    script.onerror = () => reject(new Error("Leaflet betöltési hiba."));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

async function fetchSellerCoords(contact, query) {
  const lines = Array.isArray(contact?.addressLines) ? contact.addressLines : [];
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (lines.length) params.set("lines", lines.join("|"));
  const res = await fetch(`/api/geocode?${params.toString()}`, {
    credentials: "same-origin",
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const lat = data?.lat != null ? Number(data.lat) : NaN;
  const lon = data?.lon != null ? Number(data.lon) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

async function fillSellerMap(panel, contact) {
  if (!panel) return;
  const q = buildMapQuery(contact);
  if (!q) {
    panel.hidden = true;
    panel.innerHTML = `<p class="seller-inv__hint">Nincs megjeleníthető cím a térképhez.</p>`;
    return;
  }
  panel.hidden = false;
  const open = mapOpenHref(q);
  panel.innerHTML = `
    <div class="seller-inv__map-wrap">
      ${
        open
          ? `<a class="seller-inv__map-open" href="${esc(open)}" target="_blank" rel="noopener noreferrer">Megnyitás a Google Térképen</a>`
          : ""
      }
      <div class="seller-inv__map" data-si-map-canvas role="img" aria-label="Kereskedés helye"></div>
    </div>
  `;
  const canvas = panel.querySelector("[data-si-map-canvas]");
  if (!canvas) return;

  let geo = null;
  try {
    geo = await fetchSellerCoords(contact, q);
  } catch {
    geo = null;
  }
  if (!geo) {
    canvas.innerHTML = `<p class="seller-inv__hint">A cím nem található a térképen.</p>`;
    return;
  }

  try {
    const L = await loadLeaflet();
    const map = L.map(canvas, {
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView([geo.lat, geo.lon], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.marker([geo.lat, geo.lon]).addTo(map);
    const refresh = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        /* ignore */
      }
    };
    requestAnimationFrame(refresh);
    setTimeout(refresh, 50);
    setTimeout(refresh, 250);
    setTimeout(refresh, 800);
    window.addEventListener("resize", refresh, { passive: true });
  } catch {
    canvas.innerHTML = `<p class="seller-inv__hint">A térkép nem tölthető be.</p>`;
  }
}

/**
 * @param {{ fromId: string, count?: number }} opts
 */
export async function mountSellerInventory({ fromId, count = 0 } = {}) {
  injectStylesheet();
  document.body.classList.add("seller-inventory-mode");

  const host = ensureHost();
  const backHref = `/hirdetes.html?id=${encodeURIComponent(fromId)}`;

  host.innerHTML = `
    <a class="seller-inv__back" href="${esc(backHref)}">← Vissza a hirdetéshez</a>
    <div class="seller-inv__top">
      <div class="seller-inv__panel seller-inv__menu" data-si-menu>
        <p class="seller-inv__hint">Kapcsolat betöltése…</p>
      </div>
      <div class="seller-inv__panel seller-inv__map-panel" data-si-map-panel>
        <p class="seller-inv__hint">Térkép betöltése…</p>
      </div>
    </div>
    <h3 class="seller-inv__title">Készlet <small data-si-count>(${Number(count) || 0})</small></h3>
  `;

  let contact = null;
  let rating = null;
  try {
    [contact, rating] = await Promise.all([
      fetchSellerContact(fromId).catch(() => null),
      fetchSellerRating(fromId).catch(() => null),
    ]);
  } catch {
    contact = null;
    rating = null;
  }

  const menu = host.querySelector("[data-si-menu]");
  const label = displayName(contact);

  if (menu) {
    if (contact) {
      menu.innerHTML = sellerMenuHtml(contact, rating, count, fromId);
      bindSellerRating(menu, fromId);
      bindPhoneReveal(menu, fromId);
      bindMenuActions(host, { fromId, contact, label });
    } else {
      menu.innerHTML = `<p class="seller-inv__hint">Nincs megjeleníthető kapcsolat.</p>`;
    }
  }

  const mapPanel = host.querySelector("[data-si-map-panel]");
  await fillSellerMap(mapPanel, contact);
}

export function updateSellerInventoryCount(count) {
  const n = Number(count) || 0;
  const el = document.querySelector("[data-si-count]");
  if (el) el.textContent = `(${n})`;
  const active = document.querySelector("[data-si-active-count]");
  if (active) active.textContent = String(n);
}
