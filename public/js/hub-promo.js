/**
 * Hub promo téglalapok — azonnal stock kép, majd API felülírás (cache-barát).
 */
const ASSET_V = "hubPromoFast1";

const DEFAULTS = {
  ingatlan: {
    href: "/ingatlan.html",
    alt: "Ingatlan — Házak és lakások",
    url: `/images/hub-ingatlan.jpg?v=${ASSET_V}`,
  },
  auto: {
    href: "/auto.html",
    alt: "Autó és teherautó — Autók és teherautók",
    url: `/images/hub-auto-motor.jpg?v=${ASSET_V}`,
  },
};

function withAssetV(url) {
  const raw = String(url || "").trim();
  if (!raw) return raw;
  if (/[?&]v=/.test(raw)) return raw;
  // Feltöltött / API URL: aktív id nélküli stabil verziójel
  return `${raw}${raw.includes("?") ? "&" : "?"}v=${ASSET_V}`;
}

function pathOnly(url) {
  return String(url || "").split("?")[0];
}

function markup(slots) {
  const ingatlan = { ...DEFAULTS.ingatlan, ...(slots?.ingatlan || {}) };
  const auto = { ...DEFAULTS.auto, ...(slots?.auto || {}) };
  return `
    <section class="hub-verticals" aria-label="Fő kategóriák" data-hub-verticals>
      <a class="hub-promo hub-promo--fullimg" href="${ingatlan.href}" data-promo="ingatlan">
        <img
          class="hub-promo__full"
          data-hub-promo-img="ingatlan"
          src="${withAssetV(ingatlan.url)}"
          alt="${ingatlan.alt}"
          width="1400"
          height="840"
          decoding="async"
          fetchpriority="high"
        />
      </a>
      <a class="hub-promo hub-promo--fullimg" href="${auto.href}" data-promo="auto">
        <img
          class="hub-promo__full"
          data-hub-promo-img="auto"
          src="${withAssetV(auto.url)}"
          alt="${auto.alt}"
          width="1400"
          height="840"
          decoding="async"
          fetchpriority="high"
        />
      </a>
    </section>`;
}

function applySlots(root, slots) {
  if (!root || !slots) return;
  for (const id of ["ingatlan", "auto"]) {
    const conf = { ...DEFAULTS[id], ...(slots[id] || {}) };
    const img = root.querySelector(`[data-hub-promo-img="${id}"]`);
    const link = root.querySelector(`[data-promo="${id}"]`);
    if (link && conf.href) link.setAttribute("href", conf.href);
    if (img && conf.url) {
      const next = withAssetV(conf.url);
      if (pathOnly(img.getAttribute("src")) !== pathOnly(next)) {
        img.src = next;
      }
      if (conf.alt) img.alt = conf.alt;
    }
  }
}

function paintStockFirst(target) {
  const mounts = [...target.querySelectorAll("[data-hub-promo-root]")];
  for (const mount of mounts) {
    if (mount.querySelector("[data-hub-verticals]")) continue;
    mount.innerHTML = markup(null);
  }
}

export async function mountHubPromos(target = document) {
  paintStockFirst(target);

  const mounts = [...target.querySelectorAll("[data-hub-promo-root]")];
  const existing = [...target.querySelectorAll("[data-hub-verticals]")];

  let slots = null;
  try {
    const res = await fetch("/api/hub-promo", { headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = await res.json();
      slots = data.slots || null;
    }
  } catch {
    /* stock marad */
  }

  if (!slots) return;

  for (const section of [
    ...existing,
    ...mounts.map((m) => m.querySelector("[data-hub-verticals]")).filter(Boolean),
  ]) {
    applySlots(section, slots);
  }
}

if (typeof document !== "undefined") {
  paintStockFirst(document);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void mountHubPromos();
    });
  } else {
    void mountHubPromos();
  }
}
