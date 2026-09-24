/** „Több ettől a hirdetőtől” — kereskedő készlet (demo A), bymy menüsáv érintetlen. */

import { fetchSellerContact } from "./db-client.js?v=sellerInv3";

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
  link.href = "/css/seller-inventory.css?v=sellerInv5";
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

function phonesHtml(phones = []) {
  const list = (phones || []).map((p) => String(p || "").trim()).filter(Boolean);
  if (!list.length) return `<p class="seller-inv__hint">Nincs telefonszám.</p>`;
  return `<ul class="seller-inv__phones">${list
    .map((phone) => {
      const digits = phone.replace(/[^\d+]/g, "");
      const href = digits.length >= 7 ? `tel:${digits}` : "";
      return href
        ? `<li><a href="${esc(href)}">${esc(phone)}</a></li>`
        : `<li>${esc(phone)}</li>`;
    })
    .join("")}</ul>`;
}

function addressHtml(lines = []) {
  const list = (lines || []).map((l) => String(l || "").trim()).filter(Boolean);
  if (!list.length) return `<p class="seller-inv__hint">Nincs cím.</p>`;
  return `<p class="seller-inv__address">${list.map(esc).join("<br />")}</p>`;
}

function navHref(mapQuery) {
  const q = String(mapQuery || "").trim();
  if (!q) return "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

function contactPanelHtml(contact) {
  const staff = Array.isArray(contact?.staff) ? contact.staff : [];
  const phones = Array.isArray(contact?.phones) ? contact.phones : [];
  const lines = Array.isArray(contact?.addressLines) ? contact.addressLines : [];
  const nav = navHref(contact?.mapQuery || lines.join(", "));
  return `
    <p class="seller-inv__label">Kapcsolat</p>
    ${staffHtml(staff)}
    <div class="seller-inv__block">
      <p class="seller-inv__label">Telefon</p>
      ${phonesHtml(phones)}
    </div>
    <div class="seller-inv__block">
      <p class="seller-inv__label">Cím</p>
      ${addressHtml(lines)}
    </div>
    ${
      nav
        ? `<a class="seller-inv__btn seller-inv__btn--yellow seller-inv__nav" href="${esc(nav)}" target="_blank" rel="noopener noreferrer">Navigáció</a>`
        : `<p class="seller-inv__hint">Navigációhoz nincs elég címadat.</p>`
    }
  `;
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
    <div class="seller-inv__head" data-si-head>Kereskedő</div>
    <div class="seller-inv__panel seller-inv__share">
      <h2>Oszd meg ezt a kereskedőt</h2>
      <div class="seller-inv__share-actions">
        <button type="button" class="seller-inv__btn seller-inv__btn--yellow" data-si-share>Megosztás</button>
        <button type="button" class="seller-inv__ico" data-si-fb aria-label="Facebook" title="Facebook">f</button>
        <button type="button" class="seller-inv__ico" data-si-wa aria-label="WhatsApp" title="WhatsApp">W</button>
        <button type="button" class="seller-inv__btn seller-inv__btn--ghost" data-si-copy>Link másolása</button>
      </div>
    </div>
    <div class="seller-inv__duo">
      <div class="seller-inv__panel" data-si-contact-panel>
        <p class="seller-inv__label">Kapcsolat</p>
        <p class="seller-inv__hint">Kapcsolat betöltése…</p>
      </div>
      <div class="seller-inv__panel">
        <p class="seller-inv__label">Állapot</p>
        <div class="seller-inv__status"><span class="seller-inv__dot" aria-hidden="true"></span> Aktív kereskedő</div>
      </div>
    </div>
    <h3 class="seller-inv__title">Készlet <small data-si-count>(${Number(count) || 0})</small></h3>
  `;

  let contact = null;
  try {
    contact = await fetchSellerContact(fromId);
  } catch {
    contact = null;
  }

  const contactPanel = host.querySelector("[data-si-contact-panel]");
  if (contactPanel) {
    contactPanel.innerHTML = contact
      ? contactPanelHtml(contact)
      : `<p class="seller-inv__label">Kapcsolat</p><p class="seller-inv__hint">Nincs megjeleníthető kapcsolat.</p>`;
  }

  const label = String(contact?.sellerName || "").trim() || "Hirdető";
  const head = host.querySelector("[data-si-head]");
  if (head) head.textContent = label;
  const shareTitle = host.querySelector(".seller-inv__share h2");
  if (shareTitle && label !== "Hirdető") {
    shareTitle.textContent = `Oszd meg: ${label}`;
  }

  const url = pageShareUrl();

  host.querySelector("[data-si-share]")?.addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: label, url, text: `${label} hirdetései a Bymy-n` });
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

  host.querySelector("[data-si-copy]")?.addEventListener("click", async () => {
    const btn = host.querySelector("[data-si-copy]");
    const ok = await copyText(url);
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = ok ? "Másolva" : "Nem sikerült";
      setTimeout(() => {
        btn.textContent = prev;
      }, 1600);
    }
  });

  host.querySelector("[data-si-fb]")?.addEventListener("click", () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  });

  host.querySelector("[data-si-wa]")?.addEventListener("click", () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${label} — ${url}`)}`,
      "_blank",
      "noopener,noreferrer"
    );
  });
}

export function updateSellerInventoryCount(count) {
  const el = document.querySelector("[data-si-count]");
  if (el) el.textContent = `(${Number(count) || 0})`;
}
