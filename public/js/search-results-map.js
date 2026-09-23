/**
 * Keresési találatok térképen — település-középpont pin-ekkel.
 * (Pontos cím nem kerül ki; a pin a város központja.)
 */
import {
  buildCityIndex,
  listingCityName,
  resolveListingCoords,
} from "./listing-radius.js";
import { listingDetailHref } from "./listing-return.js?v=scrollTop1";
import { listingTileTitle, listingTilePrice } from "./listing-tile.js?v=listThumb1";

const HU_CENTER = [47.1625, 19.5033];
const HU_ZOOM = 7;

let cityIndexPromise = null;
let leafletPromise = null;
let mapInstance = null;
let markersLayer = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getCityIndex() {
  if (!cityIndexPromise) {
    cityIndexPromise = fetch("/api/postal-codes/cities")
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (!data.cities) throw new Error("Településlista nem elérhető.");
        return buildCityIndex(data.cities);
      });
  }
  return cityIndexPromise;
}

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

function ensureModal() {
  let root = document.getElementById("search-map-modal");
  if (root) return root;
  root = document.createElement("div");
  root.id = "search-map-modal";
  root.className = "search-map-modal";
  root.hidden = true;
  root.innerHTML = `
    <div class="search-map-modal__backdrop" data-search-map-close tabindex="-1"></div>
    <div class="search-map-modal__panel" role="dialog" aria-modal="true" aria-labelledby="search-map-title">
      <header class="search-map-modal__head">
        <div>
          <h2 id="search-map-title" class="search-map-modal__title">Találatok a térképen</h2>
          <p class="search-map-modal__sub" data-search-map-sub>A pin a település központját mutatja.</p>
        </div>
        <button type="button" class="search-map-modal__close" data-search-map-close aria-label="Bezárás">×</button>
      </header>
      <div class="search-map-modal__body">
        <div id="search-map-canvas" class="search-map-modal__canvas" aria-label="Térkép"></div>
        <aside class="search-map-modal__side" data-search-map-side>
          <p class="search-map-modal__hint">Kattints egy pinre a hirdetésekhez.</p>
        </aside>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  root.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-search-map-close]")) closeSearchResultsMap();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !root.hidden) closeSearchResultsMap();
  });
  return root;
}

function groupByCity(items, cityIndex) {
  const groups = new Map();
  let skipped = 0;
  for (const item of items ?? []) {
    const coords = resolveListingCoords(item, cityIndex);
    if (!coords) {
      skipped += 1;
      continue;
    }
    const key = `${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        city: coords.city || listingCityName(item) || "Ismeretlen",
        lat: coords.lat,
        lon: coords.lon,
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return { groups: [...groups.values()], skipped };
}

function renderSideList(side, group) {
  if (!side) return;
  if (!group) {
    side.innerHTML = `<p class="search-map-modal__hint">Kattints egy pinre a hirdetésekhez.</p>`;
    return;
  }
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${group.city}, Magyarország`)}`;
  const rows = group.items
    .slice(0, 40)
    .map((item) => {
      const title = escapeHtml(listingTileTitle(item));
      const price = escapeHtml(listingTilePrice(item));
      const href = escapeHtml(listingDetailHref(item.id));
      return `<a class="search-map-modal__card" href="${href}"><strong>${title}</strong><span>${price}</span></a>`;
    })
    .join("");
  const more =
    group.items.length > 40
      ? `<p class="search-map-modal__hint">+${group.items.length - 40} további</p>`
      : "";
  side.innerHTML = `
    <div class="search-map-modal__city">
      <h3>${escapeHtml(group.city)}</h3>
      <p>${group.items.length} hirdetés</p>
      <a class="search-map-modal__gmaps" href="${escapeHtml(gmaps)}" target="_blank" rel="noopener noreferrer">Megnyitás Google Térképen</a>
    </div>
    <div class="search-map-modal__cards">${rows}${more}</div>
  `;
}

function paintMap(L, groups, side) {
  const canvas = document.getElementById("search-map-canvas");
  if (!canvas) return;

  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
    markersLayer = null;
  }

  mapInstance = L.map(canvas, {
    scrollWheelZoom: true,
    zoomControl: true,
  }).setView(HU_CENTER, HU_ZOOM);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapInstance);

  L.Icon.Default.imagePath = "/vendor/leaflet/images/";

  markersLayer = L.layerGroup().addTo(mapInstance);
  const bounds = [];

  for (const group of groups) {
    const count = group.items.length;
    const marker = L.marker([group.lat, group.lon], {
      title: `${group.city} (${count})`,
    });
    marker.bindTooltip(`${group.city} · ${count}`, { direction: "top", offset: [0, -12] });
    marker.on("click", () => renderSideList(side, group));
    marker.addTo(markersLayer);
    bounds.push([group.lat, group.lon]);
  }

  if (bounds.length === 1) {
    mapInstance.setView(bounds[0], 11);
  } else if (bounds.length > 1) {
    mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }

  requestAnimationFrame(() => mapInstance?.invalidateSize());
}

export function closeSearchResultsMap() {
  const root = document.getElementById("search-map-modal");
  if (root) root.hidden = true;
  document.body.classList.remove("search-map-open");
}

export async function openSearchResultsMap(items) {
  const list = Array.isArray(items) ? items : [];
  const root = ensureModal();
  const sub = root.querySelector("[data-search-map-sub]");
  const side = root.querySelector("[data-search-map-side]");
  root.hidden = false;
  document.body.classList.add("search-map-open");
  renderSideList(side, null);

  if (!list.length) {
    if (sub) sub.textContent = "Nincs találat a jelenlegi szűrőkkel.";
    return;
  }

  try {
    const [L, cityIndex] = await Promise.all([loadLeaflet(), getCityIndex()]);
    const { groups, skipped } = groupByCity(list, cityIndex);
    if (sub) {
      const placed = groups.reduce((n, g) => n + g.items.length, 0);
      sub.textContent =
        skipped > 0
          ? `${placed} hirdetés a térképen · ${skipped} település nélkül kihagyva. A pin a város központja.`
          : `${placed} hirdetés · a pin a település központját mutatja.`;
    }
    if (!groups.length) {
      if (side) {
        side.innerHTML = `<p class="search-map-modal__hint">Nincs településadat a találatokhoz — a térkép üres.</p>`;
      }
      return;
    }
    paintMap(L, groups, side);
  } catch (error) {
    if (sub) sub.textContent = error?.message || "Térkép betöltési hiba.";
  }
}

export function initSearchResultsMapButtons({ getItems } = {}) {
  const buttons = document.querySelectorAll("[data-search-map-open]");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const items = typeof getItems === "function" ? getItems() : [];
      btn.disabled = true;
      try {
        await openSearchResultsMap(items);
      } finally {
        btn.disabled = false;
      }
    });
  });
}
