const ASSET_V = "hubHeroDemo1";

const ICON_HOUSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
const ICON_CAR = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 16V10.8c0-.4.1-.8.4-1.1l2-2.3A2 2 0 0 1 8.9 6.5h6.2c.6 0 1.1.2 1.5.7l2 2.5c.3.3.4.7.4 1.1V16" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M5 16h14v2.5a1 1 0 0 1-1 1h-1.2a2 2 0 0 1-3.6 0H9.8a2 2 0 0 1-3.6 0H5a1 1 0 0 1-1-1V16Z" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><circle cx="7.5" cy="16.5" r="1.2" fill="#fff"/><circle cx="16.5" cy="16.5" r="1.2" fill="#fff"/></svg>`;

const SPLIT_DEFAULTS = [
  {
    id: "stock-ingatlan",
    href: "/ingatlan.html",
    kicker: "Ingatlan",
    icon: ICON_HOUSE,
    titleHtml: `<span class="hub-promo__accent">Házak és</span><span>lakások</span>`,
    text: "Vétel és bérlés egy átlátható felületen.",
    cta: "Ingatlan keresése →",
    photo: `/images/hub-ingatlan-photo.jpg?v=${ASSET_V}`,
    alt: "Ingatlan — Házak és lakások",
  },
  {
    id: "stock-auto",
    href: "/auto.html",
    kicker: "Autó és teherautó",
    icon: ICON_CAR,
    titleHtml: `<span class="hub-promo__accent">Autók és</span><span>teherautók</span>`,
    text: "Vétel és bérlés egy átlátható felületen.",
    cta: "Járművek keresése →",
    photo: `/images/hub-auto-photo.jpg?v=${ASSET_V}`,
    alt: "Autó és teherautó — Autók és teherautók",
    promo: "auto",
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

function isStockItem(item) {
  const id = String(item?.id || "");
  return item?.stock === true || id.startsWith("stock-") || Boolean(SPLIT_DEFAULTS.find((d) => d.id === id));
}

function splitCardHtml(item, index) {
  const href = escAttr(item.href || "#");
  const alt = escAttr(item.alt || item.kicker || "Promo");
  const photo = escAttr(withAssetV(item.photo));
  const promo = item.promo ? ` data-promo="${escAttr(item.promo)}"` : ` data-promo="${escAttr(item.id)}"`;
  const priority = index === 0 ? ' fetchpriority="high"' : ' loading="lazy"';
  return `<a class="hub-promo" href="${href}"${promo}>
    <span class="hub-promo__copy">
      <span class="hub-promo__kicker"><span class="hub-promo__icon">${item.icon || ""}</span>${escAttr(item.kicker)}</span>
      <span class="hub-promo__title">${item.titleHtml}</span>
      <p class="hub-promo__text">${escAttr(item.text)}</p>
      <span class="hub-promo__cta">${escAttr(item.cta)}</span>
    </span>
    <span class="hub-promo__media">
      <img src="${photo}" alt="${alt}" width="900" height="600" decoding="async"${priority} />
    </span>
  </a>`;
}

function fullimgCardHtml(item, index) {
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

function markupFromImages(images) {
  const list = Array.isArray(images) && images.length ? images : null;
  const useSplit = !list || list.every(isStockItem);
  const cards = useSplit
    ? SPLIT_DEFAULTS.map((item, i) => splitCardHtml(item, i)).join("")
    : list.map((item, i) => fullimgCardHtml(item, i)).join("");
  return `
    <section class="hub-verticals" aria-label="Főoldal ajánlók" data-hub-verticals>
      ${cards}
    </section>`;
}

function isPromoPage() {
  if (typeof window === "undefined" || !document.body) return false;
  if (document.body.classList.contains("auth-gate-page")) return false;
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (path === "/" || path === "/index.html") return true;
  return document.body.classList.contains("hub-page--feed");
}

function ensurePromoRoot(target = document) {
  if (target.querySelector("[data-hub-verticals], [data-hub-promo-root]")) return;
  const band = document.createElement("div");
  band.className = "hub-promo-band";
  band.setAttribute("data-hub-promo-root", "");
  const main = target.querySelector("main") || document.querySelector("main");
  if (main) {
    main.insertBefore(band, main.firstChild);
    return;
  }
  const header =
    target.querySelector(".hub-header, .site-header, .home-header") ||
    document.querySelector(".hub-header, .site-header, .home-header, .mw-app-top");
  if (header) header.after(band);
}

function clearPromoMounts(target = document) {
  for (const mount of target.querySelectorAll("[data-hub-promo-root]")) {
    mount.remove();
  }
  for (const section of target.querySelectorAll("[data-hub-verticals]")) {
    if (section.closest(".hub-intro")) continue;
    section.remove();
  }
}

function paint(target, images) {
  ensurePromoRoot(target);
  const html = markupFromImages(images);
  const mounts = [...target.querySelectorAll("[data-hub-promo-root]")];
  for (const mount of mounts) {
    mount.innerHTML = html;
  }
  const existing = [...target.querySelectorAll("[data-hub-verticals]")];
  for (const section of existing) {
    if (section.closest("[data-hub-promo-root]")) continue;
    section.outerHTML = html;
  }
}

function paintStockFirst(target) {
  paint(target, null);
}

export async function mountHubPromos(target = document) {
  if (!isPromoPage()) {
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
  }

  if (images) paint(target, images);
}

if (typeof document !== "undefined") {
  if (isPromoPage()) {
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
