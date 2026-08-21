/**
 * Hub promo téglalapok — minden oldalon ugyanaz a két kép (API-ból).
 */
const DEFAULTS = {
  ingatlan: {
    href: "/ingatlan.html",
    alt: "Ingatlan — Házak és lakások",
    url: "/images/hub-ingatlan.png",
  },
  auto: {
    href: "/auto.html",
    alt: "Autó és teherautó — Autók és teherautók",
    url: "/images/hub-auto-motor.png",
  },
};

function markup(slots) {
  const ingatlan = { ...DEFAULTS.ingatlan, ...(slots?.ingatlan || {}) };
  const auto = { ...DEFAULTS.auto, ...(slots?.auto || {}) };
  const cache = `v=${Date.now()}`;
  return `
    <section class="hub-verticals" aria-label="Fő kategóriák" data-hub-verticals>
      <a class="hub-promo hub-promo--fullimg" href="${ingatlan.href}" data-promo="ingatlan">
        <img
          class="hub-promo__full"
          data-hub-promo-img="ingatlan"
          src="${ingatlan.url}${ingatlan.url.includes("?") ? "&" : "?"}${cache}"
          alt="${ingatlan.alt}"
          width="2016"
          height="1210"
          decoding="async"
        />
      </a>
      <a class="hub-promo hub-promo--fullimg" href="${auto.href}" data-promo="auto">
        <img
          class="hub-promo__full"
          data-hub-promo-img="auto"
          src="${auto.url}${auto.url.includes("?") ? "&" : "?"}${cache}"
          alt="${auto.alt}"
          width="2016"
          height="1210"
          decoding="async"
        />
      </a>
    </section>`;
}

function applySlots(root, slots) {
  for (const id of ["ingatlan", "auto"]) {
    const conf = { ...DEFAULTS[id], ...(slots?.[id] || {}) };
    const img = root.querySelector(`[data-hub-promo-img="${id}"]`);
    const link = root.querySelector(`[data-promo="${id}"]`);
    if (link && conf.href) link.setAttribute("href", conf.href);
    if (img && conf.url) {
      const sep = conf.url.includes("?") ? "&" : "?";
      img.src = `${conf.url}${sep}v=${Date.now()}`;
      if (conf.alt) img.alt = conf.alt;
    }
  }
}

export async function mountHubPromos(target = document) {
  const mounts = [...target.querySelectorAll("[data-hub-promo-root]")];
  const existing = [...target.querySelectorAll("[data-hub-verticals]")];

  let slots = null;
  try {
    const res = await fetch("/api/hub-promo", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      slots = data.slots || null;
    }
  } catch {
    /* stock fallback */
  }

  for (const mount of mounts) {
    if (mount.querySelector("[data-hub-verticals]")) continue;
    mount.innerHTML = markup(slots);
  }

  for (const section of [...existing, ...mounts.map((m) => m.querySelector("[data-hub-verticals]")).filter(Boolean)]) {
    applySlots(section, slots);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mountHubPromos());
  } else {
    mountHubPromos();
  }
}
