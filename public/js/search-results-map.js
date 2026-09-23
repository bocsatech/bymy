/**
 * Keresési találatok térképen — minden autónak saját ikonja.
 * (Pontos cím nem kerül ki; a pin a település központja körül, enyhén szétcsúsztatva.)
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
/** ~150–400 m szétcsúsztatás azonos városban, hogy minden autó külön ikon legyen. */
const JITTER_DEG = 0.0035;

let cityIndexPromise = null;
let leafletPromise = null;
let mapInstance = null;
let markersLayer = null;
let carIcon = null;

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
          <p class="search-map-modal__sub" data-search-map-sub>Minden autónak saját ikonja van (település szerint).</p>
        </div>
        <button type="button" class="search-map-modal__close" data-search-map-close aria-label="Bezárás">×</button>
      </header>
      <div class="search-map-modal__body">
        <div id="search-map-canvas" class="search-map-modal__canvas" aria-label="Térkép"></div>
        <aside class="search-map-modal__side" data-search-map-side>
          <p class="search-map-modal__hint">Kattints egy autó ikonra a részletekhez.</p>
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

function hashId(id) {
  const n = Number(id) || 0;
  return Math.abs((n * 9301 + 49297) % 233280) / 233280;
}

/** Azonos városnál körben szétcsúsztatott lat/lon — minden autó külön látszik. */
function jitterCoords(lat, lon, indexInCity, totalInCity, listingId) {
  if (totalInCity <= 1) return { lat, lon };
  const angle = (2 * Math.PI * indexInCity) / totalInCity + hashId(listingId) * 0.4;
  const radius = JITTER_DEG * (0.45 + 0.55 * Math.min(1, Math.sqrt(totalInCity) / 4));
  const cosLat = Math.cos((lat * Math.PI) / 180) || 0.7;
  return {
    lat: lat + Math.sin(angle) * radius,
    lon: lon + (Math.cos(angle) * radius) / cosLat,
  };
}

function placeListings(items, cityIndex) {
  const byCity = new Map();
  let skipped = 0;
  for (const item of items ?? []) {
    const coords = resolveListingCoords(item, cityIndex);
    if (!coords) {
      skipped += 1;
      continue;
    }
    const key = `${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}`;
    if (!byCity.has(key)) {
      byCity.set(key, {
        city: coords.city || listingCityName(item) || "Ismeretlen",
        baseLat: coords.lat,
        baseLon: coords.lon,
        items: [],
      });
    }
    byCity.get(key).items.push(item);
  }

  const pins = [];
  for (const group of byCity.values()) {
    const total = group.items.length;
    group.items.forEach((item, index) => {
      const pos = jitterCoords(group.baseLat, group.baseLon, index, total, item.id);
      pins.push({
        item,
        city: group.city,
        lat: pos.lat,
        lon: pos.lon,
      });
    });
  }
  return { pins, skipped };
}

function getCarIcon(L) {
  if (carIcon) return carIcon;
  carIcon = L.divIcon({
    className: "search-map-car-icon",
    html: `<span class="search-map-car-icon__dot" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
        <path d="M4.5 14.5 6 9.2A2 2 0 0 1 7.9 7.8h8.2A2 2 0 0 1 18 9.2l1.5 5.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        <path d="M5 14.5h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        <circle cx="7.5" cy="15.2" r="1.6" fill="currentColor"/>
        <circle cx="16.5" cy="15.2" r="1.6" fill="currentColor"/>
      </svg>
    </span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12],
  });
  return carIcon;
}

function renderSideListing(side, pin) {
  if (!side) return;
  if (!pin) {
    side.innerHTML = `<p class="search-map-modal__hint">Kattints egy autó ikonra a részletekhez.</p>`;
    return;
  }
  const { item, city } = pin;
  const title = escapeHtml(listingTileTitle(item));
  const price = escapeHtml(listingTilePrice(item));
  const href = escapeHtml(listingDetailHref(item.id));
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city}, Magyarország`)}`;
  const img = String(item.preview?.imageUrl || item.fo_kep || "").trim();
  const photo = img
    ? `<img class="search-map-modal__thumb" src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : "";
  side.innerHTML = `
    <div class="search-map-modal__city">
      <h3>${title}</h3>
      <p>${price}${city ? ` · ${escapeHtml(city)}` : ""}</p>
      <a class="search-map-modal__gmaps" href="${escapeHtml(gmaps)}" target="_blank" rel="noopener noreferrer">Megnyitás Google Térképen</a>
    </div>
    <a class="search-map-modal__card search-map-modal__card--solo" href="${href}">
      ${photo}
      <strong>${title}</strong>
      <span>${price}</span>
      <span class="search-map-modal__cta">Hirdetés megnyitása →</span>
    </a>
  `;
}

function paintMap(L, pins, side) {
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
  const icon = getCarIcon(L);

  markersLayer = L.layerGroup().addTo(mapInstance);
  const bounds = [];

  for (const pin of pins) {
    const title = listingTileTitle(pin.item);
    const marker = L.marker([pin.lat, pin.lon], {
      title,
      icon,
      riseOnHover: true,
    });
    marker.bindTooltip(`${title}${pin.city ? ` · ${pin.city}` : ""}`, {
      direction: "top",
      offset: [0, -10],
    });
    marker.on("click", () => renderSideListing(side, pin));
    marker.addTo(markersLayer);
    bounds.push([pin.lat, pin.lon]);
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
  renderSideListing(side, null);

  if (!list.length) {
    if (sub) sub.textContent = "Nincs találat a jelenlegi szűrőkkel.";
    return;
  }

  try {
    const [L, cityIndex] = await Promise.all([loadLeaflet(), getCityIndex()]);
    const { pins, skipped } = placeListings(list, cityIndex);
    if (sub) {
      sub.textContent =
        skipped > 0
          ? `${pins.length} autó a térképen · ${skipped} település nélkül kihagyva. Minden autónak saját ikonja van.`
          : `${pins.length} autó · minden találatnak saját ikonja (település szerint).`;
    }
    if (!pins.length) {
      if (side) {
        side.innerHTML = `<p class="search-map-modal__hint">Nincs településadat a találatokhoz — a térkép üres.</p>`;
      }
      return;
    }
    paintMap(L, pins, side);
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
