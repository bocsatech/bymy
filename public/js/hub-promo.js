/**
 * Kezdőlap promo képsáv — API lista, opcionális link.
 */
const ASSET_V = "hubPromoRail2";

const DEFAULT_IMAGES = [
  {
    id: "stock-ingatlan",
    href: "/ingatlan.html",
    alt: "Ingatlan — Házak és lakások",
    url: `/images/hub-ingatlan.jpg?v=${ASSET_V}`,
  },
  {
    id: "stock-auto",
    href: "/auto.html",
    alt: "Autó és teherautó — Autók és teherautók",
    url: `/images/hub-auto-motor.jpg?v=${ASSET_V}`,
  },
];

function withAssetV(url) {
  const raw = String(url || "").trim();
  if (!raw) return raw;
  if (/[?&]v=/.test(raw)) return raw;
  return `${raw}${raw.includes("?") ? "&" : "?"}v=${ASSET_V}`;
}

function escAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function cardHtml(item, index) {
  const url = withAssetV(item.url);
  const alt = escAttr(item.alt || "Promo");
  const href = String(item.href || "").trim();
  const priority = index === 0 ? ' fetchpriority="high"' : ' loading="lazy"';
  const img = `<img
          class="hub-promo__full"
          data-hub-promo-img="${escAttr(item.id)}"
          src="${escAttr(url)}"
          alt="${alt}"
          width="1400"
          height="840"
          decoding="async"${priority}
        />`;
  if (href) {
    return `<a class="hub-promo hub-promo--fullimg" href="${escAttr(href)}" data-promo="${escAttr(item.id)}">${img}</a>`;
  }
  return `<div class="hub-promo hub-promo--fullimg hub-promo--nolink" data-promo="${escAttr(item.id)}" role="img" aria-label="${alt}">${img}</div>`;
}

function markup(images) {
  const list = Array.isArray(images) && images.length ? images : DEFAULT_IMAGES;
  return `
    <section class="hub-verticals" aria-label="Főoldal ajánlók" data-hub-verticals>
      ${list.map((item, i) => cardHtml(item, i)).join("")}
    </section>`;
}

function isHomePromoPage() {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return path === "/" || path === "/index.html" || document.body?.classList?.contains("hub-page--feed");
}

function clearPromoMounts(target = document) {
  for (const mount of target.querySelectorAll("[data-hub-promo-root]")) {
    mount.remove();
  }
}

function paint(target, images) {
  const mounts = [...target.querySelectorAll("[data-hub-promo-root]")];
  for (const mount of mounts) {
    mount.innerHTML = markup(images);
  }
  const existing = [...target.querySelectorAll("[data-hub-verticals]")];
  for (const section of existing) {
    if (section.closest("[data-hub-promo-root]")) continue;
    section.outerHTML = markup(images);
  }
}

function paintStockFirst(target) {
  paint(target, DEFAULT_IMAGES);
}

export async function mountHubPromos(target = document) {
  if (!isHomePromoPage()) {
    clearPromoMounts(target);
    return;
  }
  paintStockFirst(target);

  let images = null;
  try {
    const res = await fetch("/api/hub-promo", { headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.images)) images = data.images;
    }
  } catch {
    /* stock marad */
  }

  if (images) paint(target, images);
}

if (typeof document !== "undefined") {
  if (isHomePromoPage()) {
    paintStockFirst(document);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        void mountHubPromos();
      });
    } else {
      void mountHubPromos();
    }
  } else {
    clearPromoMounts(document);
  }
}
