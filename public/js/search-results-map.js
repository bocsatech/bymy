/**
 * Keresési találatok térképen — autó ikonok + útvonal / távolság a lakhelytől.
 */
import {
  buildCityIndex,
  haversineKm,
  listingCityName,
  resolveListingCoords,
} from "./listing-radius.js";
import { listingDetailHref } from "./listing-return.js?v=scrollTop1";
import { listingTileTitle, listingTilePrice } from "./listing-tile.js?v=listThumb1";
import { getAuthUser } from "./site-auth.js?v=authAcct1";
import { readNearbyPrefs } from "./nearby-search.js?v=korzetFix1";

const HU_CENTER = [47.1625, 19.5033];
const HU_ZOOM = 7;
const JITTER_DEG = 0.0035;
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

let cityIndexPromise = null;
let leafletPromise = null;
let mapInstance = null;
let markersLayer = null;
let routeLayer = null;
let carIcon = null;
let homeIcon = null;
let homeOrigin = null;
let routeRequestId = 0;
let lastPins = [];
let lastLeaflet = null;
let selectedPinId = null;

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

async function resolveHomeOrigin(cityIndex) {
  const user = getAuthUser();
  const prefs = readNearbyPrefs(user?.profile ?? null);
  const postal = String(prefs.postal || user?.profile?.postalCode || "")
    .replace(/\D/g, "")
    .slice(0, 4);
  const cityName = String(user?.profile?.city || user?.profile?.companyCity || "").trim();

  if (postal.length === 4) {
    try {
      const res = await fetch(`/api/postal-codes/lookup?postal_code=${encodeURIComponent(postal)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.lat != null && data.lon != null) {
        return {
          lat: Number(data.lat),
          lon: Number(data.lon),
          label: [data.city, postal].filter(Boolean).join(" · ") || postal,
          postal,
        };
      }
    } catch {
      /* fall through */
    }
  }

  if (cityName && cityIndex) {
    const hit = resolveListingCoords({ preview: { filter: { telepules: cityName } } }, cityIndex);
    if (hit) {
      return { lat: hit.lat, lon: hit.lon, label: hit.city || cityName, postal: postal || "" };
    }
  }
  return null;
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
          <p class="search-map-modal__sub" data-search-map-sub>Válassz autót az útvonalhoz.</p>
        </div>
        <button type="button" class="search-map-modal__close" data-search-map-close aria-label="Bezárás">×</button>
      </header>
      <div class="search-map-modal__body">
        <div id="search-map-canvas" class="search-map-modal__canvas" aria-label="Térkép"></div>
        <aside class="search-map-modal__side" data-search-map-side>
          <p class="search-map-modal__hint">Kattints egy autó ikonra — megmutatjuk az utat a lakhelyedtől.</p>
        </aside>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  root.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-search-map-close]")) {
      closeSearchResultsMap();
      return;
    }
    if (event.target?.closest?.("[data-search-map-back]")) {
      showAllResults();
      return;
    }
    const pick = event.target?.closest?.("[data-search-map-pick]");
    if (pick) {
      const id = String(pick.getAttribute("data-search-map-pick") || "");
      const pin = lastPins.find((p) => String(p.item?.id) === id);
      if (pin && lastLeaflet) showRouteToPin(lastLeaflet, pin, root.querySelector("[data-search-map-side]"));
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !root.hidden) {
      if (selectedPinId != null) showAllResults();
      else closeSearchResultsMap();
    }
  });
  return root;
}

function hashId(id) {
  const n = Number(id) || 0;
  return Math.abs((n * 9301 + 49297) % 233280) / 233280;
}

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

function getHomeIcon(L) {
  if (homeIcon) return homeIcon;
  homeIcon = L.divIcon({
    className: "search-map-home-icon",
    html: `<span class="search-map-home-icon__dot" aria-hidden="true">⌂</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
  return homeIcon;
}

function formatKm(km) {
  if (!Number.isFinite(km)) return "—";
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km).toLocaleString("hu-HU")} km`;
}

function formatDuration(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "";
  const mins = Math.round(s / 60);
  if (mins < 60) return `~${mins} perc`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `~${h} óra ${m} perc` : `~${h} óra`;
}

function clearRoute() {
  if (routeLayer && mapInstance) {
    mapInstance.removeLayer(routeLayer);
    routeLayer = null;
  }
}

async function fetchDrivingRoute(from, to) {
  const url = `${OSRM_URL}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Útvonal nem elérhető.");
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route?.geometry?.coordinates?.length) throw new Error("Nincs útvonal.");
  const latLngs = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  return {
    latLngs,
    distanceKm: Number(route.distance) / 1000,
    durationSec: Number(route.duration),
  };
}

function googleDirectionsUrl(from, to, toLabel) {
  const origin = `${from.lat},${from.lon}`;
  const dest = toLabel
    ? encodeURIComponent(`${toLabel}, Magyarország`)
    : `${to.lat},${to.lon}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
}

function renderSideAll(side, pins) {
  if (!side) return;
  const homeHint = homeOrigin
    ? `Lakhely: <strong>${escapeHtml(homeOrigin.label)}</strong>. Kattints egy autóra az útvonalhoz.`
    : `Állíts be irányítószámot a <a href="/beallitasok.html?szekcio=keresesi-korzet">Keresési körzet</a>ben, hogy mutassuk az utat.`;

  if (!pins?.length) {
    side.innerHTML = `<p class="search-map-modal__hint">${homeHint}</p>`;
    return;
  }

  const cards = pins
    .map((pin) => {
      const title = escapeHtml(listingTileTitle(pin.item));
      const price = escapeHtml(listingTilePrice(pin.item));
      const city = pin.city ? escapeHtml(pin.city) : "";
      return `<button type="button" class="search-map-modal__card search-map-modal__card--pick" data-search-map-pick="${escapeHtml(String(pin.item.id))}">
        <strong>${title}</strong>
        <span>${price}${city ? ` · ${city}` : ""}</span>
      </button>`;
    })
    .join("");

  side.innerHTML = `
    <p class="search-map-modal__hint">${homeHint}</p>
    <p class="search-map-modal__list-label">${pins.length} autó a találati listából</p>
    <div class="search-map-modal__cards">${cards}</div>
  `;
}

function renderSideListing(side, pin, routeInfo = null) {
  if (!side) return;
  if (!pin) {
    renderSideAll(side, lastPins);
    return;
  }
  const { item, city } = pin;
  const title = escapeHtml(listingTileTitle(item));
  const price = escapeHtml(listingTilePrice(item));
  const href = escapeHtml(listingDetailHref(item.id));
  const img = String(item.preview?.imageUrl || item.fo_kep || "").trim();
  const photo = img
    ? `<img class="search-map-modal__thumb" src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : "";

  let routeHtml = "";
  if (!homeOrigin) {
    routeHtml = `<p class="search-map-modal__route search-map-modal__route--warn">Nincs lakhely / irányítószám — <a href="/beallitasok.html?szekcio=keresesi-korzet">állítsd be</a>, hogy látszódjon az út.</p>`;
  } else if (routeInfo?.loading) {
    routeHtml = `<p class="search-map-modal__route">Útvonal számítása…</p>`;
  } else if (routeInfo?.error) {
    const air = routeInfo.airKm != null ? formatKm(routeInfo.airKm) : "—";
    routeHtml = `<div class="search-map-modal__route">
      <p><strong>Légvonal:</strong> ${air}</p>
      <p class="search-map-modal__route-note">${escapeHtml(routeInfo.error)}</p>
    </div>`;
  } else if (routeInfo) {
    const dur = formatDuration(routeInfo.durationSec);
    routeHtml = `<div class="search-map-modal__route">
      <p><strong>Útvonal:</strong> ${formatKm(routeInfo.distanceKm)}${dur ? ` · ${dur}` : ""}</p>
      <p class="search-map-modal__route-note">Lakhely: ${escapeHtml(homeOrigin.label)} → ${escapeHtml(city || "autó")}</p>
      ${
        routeInfo.gmaps
          ? `<a class="search-map-modal__gmaps" href="${escapeHtml(routeInfo.gmaps)}" target="_blank" rel="noopener noreferrer">Útvonal Google Térképen</a>`
          : ""
      }
    </div>`;
  }

  side.innerHTML = `
    <button type="button" class="search-map-modal__back" data-search-map-back>‹ Vissza az összes autóhoz</button>
    <div class="search-map-modal__city">
      <h3>${title}</h3>
      <p>${price}${city ? ` · ${escapeHtml(city)}` : ""}</p>
    </div>
    ${routeHtml}
    <a class="search-map-modal__card search-map-modal__card--solo" href="${href}">
      ${photo}
      <strong>${title}</strong>
      <span>${price}</span>
      <span class="search-map-modal__cta">Hirdetés megnyitása →</span>
    </a>
  `;
}

function fitAllPins() {
  if (!mapInstance || !lastPins.length) return;
  const bounds = [];
  if (homeOrigin) bounds.push([homeOrigin.lat, homeOrigin.lon]);
  for (const pin of lastPins) bounds.push([pin.lat, pin.lon]);
  if (bounds.length === 1) mapInstance.setView(bounds[0], 11);
  else if (bounds.length > 1) mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
}

function showAllResults() {
  selectedPinId = null;
  clearRoute();
  routeRequestId += 1;
  const side = document.querySelector("[data-search-map-side]");
  renderSideAll(side, lastPins);
  fitAllPins();
  requestAnimationFrame(() => mapInstance?.invalidateSize());
}

async function showRouteToPin(L, pin, side) {
  selectedPinId = pin?.item?.id ?? null;
  clearRoute();
  if (!homeOrigin || !mapInstance || !pin) {
    renderSideListing(side, pin);
    return;
  }

  const reqId = ++routeRequestId;
  const airKm = haversineKm(homeOrigin.lat, homeOrigin.lon, pin.lat, pin.lon);
  const gmaps = googleDirectionsUrl(homeOrigin, pin, pin.city);
  renderSideListing(side, pin, { loading: true });

  try {
    const route = await fetchDrivingRoute(homeOrigin, { lat: pin.lat, lon: pin.lon });
    if (reqId !== routeRequestId) return;
    routeLayer = L.polyline(route.latLngs, {
      color: "#1a73e8",
      weight: 5,
      opacity: 0.85,
    }).addTo(mapInstance);
    mapInstance.fitBounds(routeLayer.getBounds(), { padding: [48, 48], maxZoom: 12 });
    renderSideListing(side, pin, {
      distanceKm: route.distanceKm,
      durationSec: route.durationSec,
      airKm,
      gmaps,
    });
  } catch {
    if (reqId !== routeRequestId) return;
    routeLayer = L.polyline(
      [
        [homeOrigin.lat, homeOrigin.lon],
        [pin.lat, pin.lon],
      ],
      { color: "#1a73e8", weight: 3, opacity: 0.55, dashArray: "8 8" }
    ).addTo(mapInstance);
    mapInstance.fitBounds(routeLayer.getBounds(), { padding: [48, 48], maxZoom: 11 });
    renderSideListing(side, pin, {
      distanceKm: airKm,
      durationSec: null,
      airKm,
      gmaps,
      error: "Közúti útvonal ideiglenesen nem elérhető — légvonal megjelenítve.",
    });
  }
}

function paintMap(L, pins, side) {
  const canvas = document.getElementById("search-map-canvas");
  if (!canvas) return;

  lastLeaflet = L;
  lastPins = pins;
  selectedPinId = null;

  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
    markersLayer = null;
    routeLayer = null;
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

  if (homeOrigin) {
    const homeMarker = L.marker([homeOrigin.lat, homeOrigin.lon], {
      title: `Lakhely · ${homeOrigin.label}`,
      icon: getHomeIcon(L),
      zIndexOffset: 400,
    });
    homeMarker.bindTooltip(`Lakhely · ${homeOrigin.label}`, { direction: "top", offset: [0, -10] });
    homeMarker.addTo(markersLayer);
    bounds.push([homeOrigin.lat, homeOrigin.lon]);
  }

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
    marker.on("click", () => {
      showRouteToPin(L, pin, side);
    });
    marker.addTo(markersLayer);
    bounds.push([pin.lat, pin.lon]);
  }

  if (bounds.length === 1) {
    mapInstance.setView(bounds[0], 11);
  } else if (bounds.length > 1) {
    mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }

  renderSideAll(side, pins);
  requestAnimationFrame(() => mapInstance?.invalidateSize());
}

export function closeSearchResultsMap() {
  const root = document.getElementById("search-map-modal");
  if (root) root.hidden = true;
  document.body.classList.remove("search-map-open");
  clearRoute();
  routeRequestId += 1;
  selectedPinId = null;
}

export async function openSearchResultsMap(items) {
  const list = Array.isArray(items) ? items : [];
  const root = ensureModal();
  const sub = root.querySelector("[data-search-map-sub]");
  const side = root.querySelector("[data-search-map-side]");
  root.hidden = false;
  document.body.classList.add("search-map-open");
  homeOrigin = null;
  lastPins = [];
  selectedPinId = null;
  clearRoute();
  renderSideAll(side, []);

  if (!list.length) {
    if (sub) sub.textContent = "Nincs találat a jelenlegi szűrőkkel.";
    return;
  }

  try {
    const [L, cityIndex] = await Promise.all([loadLeaflet(), getCityIndex()]);
    homeOrigin = await resolveHomeOrigin(cityIndex);
    const { pins, skipped } = placeListings(list, cityIndex);
    if (sub) {
      const homeBit = homeOrigin ? `Lakhely: ${homeOrigin.label}.` : "Nincs lakhely beállítva.";
      sub.textContent =
        skipped > 0
          ? `${pins.length} autó · ${skipped} kihagyva. ${homeBit} Kattints egy autóra az útvonalhoz.`
          : `${pins.length} autó. ${homeBit} Kattints egy autóra az útvonalhoz.`;
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
