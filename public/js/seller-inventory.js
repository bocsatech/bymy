/** „Több ettől a hirdetőtől” — kereskedő készlet (demo A), bymy menüsáv érintetlen. */

import { fetchSellerContact, revealListingContact, fetchSellerRating, submitSellerRating } from "./db-client.js?v=sellerInv15";
import { mountTurnstile } from "./turnstile-ui.js?v=turnstile10";

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
  link.href = "/css/seller-inventory.css?v=sellerInv21";
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

function staffHtml(staff = []) {
  if (!staff.length) return `<p class="seller-inv__hint">Nincs megadott munkatárs.</p>`;
  return `<ul class="seller-inv__staff">${staff
    .map((person) => {
      const name = String(person?.name || "").trim();
      if (!name) return "";
      const photo = String(person?.photoUrl || "").trim();
      const letter = name.charAt(0).toUpperCase();
      const avatar = photo
        ? `<img class="seller-inv__staff-photo" src="${esc(photo)}" alt="" width="48" height="48" loading="lazy" />`
        : `<span class="seller-inv__staff-letter" aria-hidden="true">${esc(letter)}</span>`;
      return `<li class="seller-inv__staff-item">
        <div class="seller-inv__staff-avatar">${avatar}</div>
        <span class="seller-inv__staff-name">${esc(name)}</span>
      </li>`;
    })
    .filter(Boolean)
    .join("")}</ul>`;
}

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

function statusPanelHtml(rating, activeCount) {
  const count = Number(activeCount) || 0;
  const avg = rating?.average;
  const ratingCount = Number(rating?.count) || 0;
  const myScore = rating?.myScore != null ? Number(rating.myScore) : null;
  const avgLabel =
    avg != null
      ? `<span class="seller-inv__rating-avg">${esc(String(avg))}/10</span> <span class="seller-inv__rating-n">(${ratingCount})</span>`
      : `<span class="seller-inv__rating-n">Még nincs értékelés</span>`;

  let rateBlock = "";
  if (myScore != null) {
    rateBlock = `<p class="seller-inv__hint">Te értékelésed: <strong>${esc(String(myScore))}/10</strong></p>`;
  } else if (rating?.canRate) {
    rateBlock = `
      <p class="seller-inv__rate-label">Értékeld (1–10):</p>
      ${starsHtml(null, { interactive: true, selected: 0 })}
      <p class="seller-inv__hint" data-si-rate-msg hidden></p>
    `;
  } else if (!rating?.loggedIn) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    rateBlock = `<p class="seller-inv__hint"><a href="/belepes.html?next=${next}">Jelentkezz be</a> az értékeléshez.</p>`;
  } else {
    rateBlock = `<p class="seller-inv__hint">Saját magadat nem értékelheted.</p>`;
  }

  return `
    <p class="seller-inv__label">Állapot</p>
    <div class="seller-inv__status"><span class="seller-inv__dot" aria-hidden="true"></span> Aktív kereskedő</div>
    <p class="seller-inv__stat-line">Aktív hirdetések: <strong data-si-active-count>${esc(String(count))}</strong></p>
    <div class="seller-inv__rating" data-si-rating>
      <p class="seller-inv__stat-line">Értékelés: ${avgLabel}</p>
      ${starsHtml(avg)}
      <div class="seller-inv__rate" data-si-rate-wrap>${rateBlock}</div>
    </div>
  `;
}

function bindSellerRating(panel, fromId) {
  const wrap = panel.querySelector("[data-si-rate-wrap]");
  if (!wrap) return;
  const stars = [...wrap.querySelectorAll("[data-si-rate]")];
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
    btn.addEventListener("mouseleave", () => paint(0));
    btn.addEventListener("click", async () => {
      const score = Number(btn.getAttribute("data-si-rate"));
      if (!Number.isFinite(score)) return;
      const msg = wrap.querySelector("[data-si-rate-msg]");
      stars.forEach((b) => {
        b.disabled = true;
      });
      try {
        const rating = await submitSellerRating(fromId, score);
        const active = Number(document.querySelector("[data-si-active-count]")?.textContent) || 0;
        panel.innerHTML = statusPanelHtml(rating, active);
        bindSellerRating(panel, fromId);
      } catch (err) {
        if (msg) {
          msg.hidden = false;
          msg.textContent = err?.message || "Nem sikerült az értékelés.";
        }
        stars.forEach((b) => {
          b.disabled = false;
        });
      }
    });
  });
}

const PHONE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.5 4.8h3.2l1.1 3.2-1.8 1.1a12 12 0 0 0 6 6l1.1-1.8 3.2 1.1v3.2A2 2 0 0 1 17.3 20 15 15 0 0 1 4 6.7 2 2 0 0 1 6.5 4.8Z" stroke="currentColor" stroke-width="1.6"/></svg>`;

function maskedPhonesHtml(masked = [], hasPhone = false) {
  const list = (masked || []).map((p) => String(p || "").trim()).filter(Boolean);
  if (!list.length && !hasPhone) return `<p class="seller-inv__hint">Nincs telefonszám.</p>`;
  const label = list[0] || "Telefonszám";
  return `
    <button type="button" class="seller-inv__btn seller-inv__btn--yellow seller-inv__phone-reveal" data-si-phone-reveal>
      ${PHONE_ICON}
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
        ? `<a class="seller-inv__btn seller-inv__btn--yellow seller-inv__phone-reveal" href="${esc(href)}">${PHONE_ICON}<span>Hívás · ${esc(first)}</span></a>`
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

function contactPanelHtml(contact) {
  const staff = Array.isArray(contact?.staff) ? contact.staff : [];
  const masked = Array.isArray(contact?.phonesMasked) ? contact.phonesMasked : [];
  const hasPhone = Boolean(contact?.hasPhone) || masked.length > 0;
  const lines = Array.isArray(contact?.addressLines) ? contact.addressLines : [];
  const nav = navHref(contact?.mapQuery || lines.join(", "));
  const addr = addressHtml(lines);
  const right =
    addr || nav
      ? `<div class="seller-inv__contact-right">
          ${addr || ""}
          ${
            nav
              ? `<a class="seller-inv__btn seller-inv__btn--yellow seller-inv__nav" href="${esc(nav)}" target="_blank" rel="noopener noreferrer">Navigáció</a>`
              : ""
          }
        </div>`
      : "";
  return `
    <div class="seller-inv__contact">
      <div class="seller-inv__contact-identity">${staffHtml(staff)}</div>
      ${right}
      <div class="seller-inv__phone-wrap" data-si-phone-col>
        ${maskedPhonesHtml(masked, hasPhone)}
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

/**
 * @param {{ fromId: string, count?: number }} opts
 */
export async function mountSellerInventory({ fromId, count = 0 } = {}) {
  if (!fromId) return;
  injectStylesheet();
  document.body.classList.add("seller-inventory-mode");

  const host = ensureHost();
  const backHref = `/hirdetes.html?id=${encodeURIComponent(fromId)}`;

  host.innerHTML = `
    <a class="seller-inv__back" href="${esc(backHref)}">← Vissza a hirdetéshez</a>
    <div class="seller-inv__panel seller-inv__share">
      <div class="seller-inv__share-main">
        <div class="seller-inv__share-logo" data-si-share-logo hidden></div>
        <p class="seller-inv__share-text">Oszd meg barátaiddal a kereskedésünk autóit.</p>
      </div>
      <div class="seller-inv__share-actions">
        <button type="button" class="seller-inv__btn seller-inv__btn--yellow" data-si-share>Megosztás</button>
      </div>
    </div>
    <div class="seller-inv__duo">
      <div class="seller-inv__panel" data-si-contact-panel>
        <p class="seller-inv__hint">Kapcsolat betöltése…</p>
      </div>
      <div class="seller-inv__panel" data-si-status-panel>
        <p class="seller-inv__label">Állapot</p>
        <p class="seller-inv__hint">Betöltés…</p>
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

  const contactPanel = host.querySelector("[data-si-contact-panel]");
  if (contactPanel) {
    contactPanel.innerHTML = contact
      ? contactPanelHtml(contact)
      : `<p class="seller-inv__hint">Nincs megjeleníthető kapcsolat.</p>`;
    if (contact) bindPhoneReveal(contactPanel, fromId);
  }

  const statusPanel = host.querySelector("[data-si-status-panel]");
  if (statusPanel) {
    statusPanel.innerHTML = statusPanelHtml(rating, count);
    bindSellerRating(statusPanel, fromId);
  }

  const label = String(contact?.sellerName || "").trim() || "Hirdető";
  const logoWrap = host.querySelector("[data-si-share-logo]");
  const logoUrl = String(contact?.sellerAvatarUrl || "").trim();
  if (logoWrap) {
    if (logoUrl) {
      logoWrap.hidden = false;
      logoWrap.innerHTML = `<img src="${esc(logoUrl)}" alt="" width="48" height="48" decoding="async" />`;
    } else {
      const letter = label.charAt(0).toUpperCase() || "?";
      logoWrap.hidden = false;
      logoWrap.innerHTML = `<span class="seller-inv__staff-letter" aria-hidden="true">${esc(letter)}</span>`;
    }
  }

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
      const prev = btn.textContent;
      btn.textContent = "Link másolva";
      setTimeout(() => {
        btn.textContent = prev;
      }, 1600);
    }
  });
}

export function updateSellerInventoryCount(count) {
  const n = Number(count) || 0;
  const el = document.querySelector("[data-si-count]");
  if (el) el.textContent = `(${n})`;
  const active = document.querySelector("[data-si-active-count]");
  if (active) active.textContent = String(n);
}
