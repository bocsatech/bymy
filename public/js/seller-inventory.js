/** „Több ettől a hirdetőtől” — kereskedő készlet (demo A), bymy menüsáv érintetlen. */

import { fetchListing, revealListingContact } from "./db-client.js?v=sellerInv1";
import { mountTurnstile } from "./turnstile-ui.js?v=turnstile10";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sellerLabel(listing) {
  const detail = listing?.detail ?? {};
  const name =
    String(detail.sellerName || "").trim() ||
    String(listing?.preview?.sellerName || "").trim() ||
    String(listing?.form?.company || listing?.form?.cegnev || "").trim();
  return name || "Hirdető";
}

function pageShareUrl() {
  return window.location.href.split("#")[0];
}

function injectStylesheet() {
  if (document.querySelector('link[data-seller-inv-css]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/css/seller-inventory.css?v=sellerInv1";
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
      <h2>Oszd meg ezt a kereskedőt</h2>
      <div class="seller-inv__share-actions">
        <button type="button" class="seller-inv__btn seller-inv__btn--accent" data-si-share>Megosztás</button>
        <button type="button" class="seller-inv__ico" data-si-fb aria-label="Facebook" title="Facebook">f</button>
        <button type="button" class="seller-inv__ico" data-si-wa aria-label="WhatsApp" title="WhatsApp">W</button>
        <button type="button" class="seller-inv__btn seller-inv__btn--ghost" data-si-copy>Link másolása</button>
      </div>
    </div>
    <div class="seller-inv__duo">
      <div class="seller-inv__panel">
        <p class="seller-inv__eyebrow">Kapcsolat</p>
        <button type="button" class="seller-inv__btn seller-inv__btn--accent" data-si-contact>Kapcsolat megjelenítése</button>
        <div class="seller-inv__contact-out" data-si-contact-out hidden></div>
        <div data-si-turnstile hidden></div>
      </div>
      <div class="seller-inv__panel">
        <p class="seller-inv__eyebrow">Állapot</p>
        <div class="seller-inv__status"><span class="seller-inv__dot" aria-hidden="true"></span> Aktív kereskedő</div>
      </div>
    </div>
    <h3 class="seller-inv__title">Készlet <small data-si-count>(${Number(count) || 0})</small></h3>
  `;

  let listing = null;
  try {
    listing = await fetchListing(fromId);
  } catch {
    listing = null;
  }
  const label = sellerLabel(listing);
  const shareTitle = host.querySelector(".seller-inv__share h2");
  if (shareTitle && label && label !== "Hirdető") {
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

  const contactBtn = host.querySelector("[data-si-contact]");
  const contactOut = host.querySelector("[data-si-contact-out]");
  const turnstileHost = host.querySelector("[data-si-turnstile]");
  let turnstileApi = null;

  contactBtn?.addEventListener("click", async () => {
    if (!contactBtn || contactBtn.dataset.done === "1") return;
    contactBtn.disabled = true;
    try {
      if (!turnstileApi && turnstileHost) {
        turnstileHost.hidden = false;
        turnstileApi = await mountTurnstile(turnstileHost, { action: "listing-reveal" });
      }
      const token = turnstileApi ? await turnstileApi.getToken() : "";
      const contact = await revealListingContact(fromId, token);
      const phone = String(contact.phone || "").trim();
      const lines = Array.isArray(contact.addressLines) ? contact.addressLines.filter(Boolean) : [];
      const parts = [];
      if (phone) {
        const digits = phone.replace(/[^\d+]/g, "");
        parts.push(
          digits.length >= 7
            ? `<a href="tel:${esc(digits)}">${esc(phone)}</a>`
            : esc(phone)
        );
      }
      for (const line of lines) parts.push(esc(line));
      if (contactOut) {
        contactOut.hidden = false;
        contactOut.innerHTML = parts.length
          ? parts.join("<br />")
          : "Nincs megjeleníthető kapcsolat.";
      }
      contactBtn.dataset.done = "1";
      contactBtn.textContent = "Kapcsolat";
      if (turnstileHost) turnstileHost.hidden = true;
    } catch (err) {
      if (contactOut) {
        contactOut.hidden = false;
        contactOut.textContent = err?.message || "A kapcsolat most nem érhető el.";
      }
      contactBtn.disabled = false;
    }
  });
}

export function updateSellerInventoryCount(count) {
  const el = document.querySelector("[data-si-count]");
  if (el) el.textContent = `(${Number(count) || 0})`;
}
