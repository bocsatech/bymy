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
import { getAuthUser } from "./site-auth.js?v=authMembersOnly1";
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
  const markup = `
    <div class="search-map-modal__backdrop" data-search-map-close tabindex="-1"></div>
    <div class="search-map-modal__panel" role="dialog" aria-modal="true" aria-labelledby="search-map-title">
      <header class="search-map-modal__head">
        <div>
          <h2 id="search-map-title" class="search-map-modal__title">Találatok a térképen</h2>
          <div class="search-map-modal__stats" data-search-map-stats></div>
          <p class="search-map-modal__sub" data-search-map-sub hidden></p>
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
  if (!root) {
    root = document.createElement("div");
    root.id = "search-map-modal";
    root.className = "search-map-modal";
    root.hidden = true;
    root.innerHTML = markup;
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
  // Upgrade older modal shells (cached tab / previous build).
  if (!root.querySelector("[data-search-map-stats]")) {
    const wasHidden = root.hidden;
    root.innerHTML = markup;
    root.hidden = wasHidden;
  }
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

function getCarIcon(L, selected = false) {
  return L.divIcon({
    className: selected ? "search-map-car-icon search-map-car-icon--sel" : "search-map-car-icon",
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
}

function syncPinIcons(L) {
  if (!L || !lastPins.length) return;
  for (const pin of lastPins) {
    if (!pin.marker) continue;
    const on = selectedPinId != null && String(pin.item?.id) === String(selectedPinId);
    pin.marker.setIcon(getCarIcon(L, on));
    pin.marker.setZIndexOffset(on ? 600 : 0);
  }
}

function listingThumbHtml(item) {
  const img = String(item?.preview?.imageUrl || item?.fo_kep || "").trim();
  if (img) {
    return `<img class="search-map-modal__thumb-sm" src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`;
  }
  return `<span class="search-map-modal__thumb-sm search-map-modal__thumb-sm--empty" aria-hidden="true"></span>`;
}

function pickCardHtml(pin, { selected = false, asLink = false } = {}) {
  const title = escapeHtml(listingTileTitle(pin.item));
  const price = escapeHtml(listingTilePrice(pin.item));
  const city = pin.city ? escapeHtml(pin.city) : "";
  const meta = `${price}${city ? ` · ${city}` : ""}`;
  const on = selected ? " is-on" : "";
  const thumb = listingThumbHtml(pin.item);
  if (asLink) {
    const href = escapeHtml(listingDetailHref(pin.item.id));
    return `<a class="search-map-modal__card search-map-modal__card--solo${on}" href="${href}">
      ${thumb}
      <div>
        <strong>${title}</strong>
        <span>${meta}</span>
      </div>
    </a>`;
  }
  return `<button type="button" class="search-map-modal__card search-map-modal__card--pick${on}" data-search-map-pick="${escapeHtml(String(pin.item.id))}">
    ${thumb}
    <div>
      <strong>${title}</strong>
      <span>${meta}</span>
    </div>
  </button>`;
}

function setMapStats({ pins = 0, skipped = 0, homeLabel = "", empty = false, error = "" } = {}) {
  const root = document.getElementById("search-map-modal");
  const stats = root?.querySelector("[data-search-map-stats]");
  if (!stats) return;
  if (error) {
    stats.innerHTML = `<span class="search-map-modal__stat search-map-modal__stat--warn">${escapeHtml(error)}</span>`;
    return;
  }
  if (empty) {
    stats.innerHTML = `<span class="search-map-modal__stat">Nincs találat</span>`;
    return;
  }
  const bits = [`<span class="search-map-modal__stat">${pins} autó</span>`];
  if (skipped > 0) bits.push(`<span class="search-map-modal__stat">${skipped} kihagyva</span>`);
  if (homeLabel) {
    bits.push(
      `<span class="search-map-modal__stat search-map-modal__stat--home">⌂ ${escapeHtml(homeLabel)}</span>`
    );
  } else {
    bits.push(`<span class="search-map-modal__stat search-map-modal__stat--warn">Nincs lakhely</span>`);
  }
  stats.innerHTML = bits.join("");
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
    ? `${escapeHtml(homeOrigin.label)} → válassz autót`
    : `Állíts be irányítószámot a <a href="/beallitasok.html?szekcio=keresesi-korzet">Keresési körzet</a>ben.`;

  if (!pins?.length) {
    side.innerHTML = `<div class="search-map-modal__side-pin"><p class="search-map-modal__hint">${homeHint}</p></div>`;
    return;
  }

  const cards = pins.map((pin) => pickCardHtml(pin)).join("");
  const routeTeaser = homeOrigin
    ? `<div class="search-map-modal__route search-map-modal__route--teaser">
        <div class="search-map-modal__route-lab">Útvonal</div>
        <p class="search-map-modal__route-title">Válassz autót</p>
        <p class="search-map-modal__route-note">${escapeHtml(homeOrigin.label)} → kattints a listában vagy a térképen</p>
      </div>`
    : `<div class="search-map-modal__route search-map-modal__route--warn">
        <div class="search-map-modal__route-lab">Útvonal</div>
        <p class="search-map-modal__route-title" style="font-size:0.95rem;font-weight:700">Nincs lakhely</p>
        <p class="search-map-modal__route-note">${homeHint}</p>
      </div>`;

  side.innerHTML = `
    <div class="search-map-modal__side-pin">${routeTeaser}</div>
    <div class="search-map-modal__side-scroll">
      <p class="search-map-modal__list-label">${pins.length} autó a találati listából</p>
      <div class="search-map-modal__cards">${cards}</div>
    </div>
  `;
}

function renderRouteBlock(pin, routeInfo) {
  const city = pin?.city ? escapeHtml(pin.city) : "autó";
  const href = escapeHtml(listingDetailHref(pin.item.id));

  if (!homeOrigin) {
    return `<div class="search-map-modal__route search-map-modal__route--warn">
      <div class="search-map-modal__route-lab">Útvonal</div>
      <p class="search-map-modal__route-title" style="font-size:0.95rem;font-weight:700">Nincs lakhely</p>
      <p class="search-map-modal__route-note"><a href="/beallitasok.html?szekcio=keresesi-korzet">Állítsd be</a>, hogy látszódjon az út.</p>
      <div class="search-map-modal__route-actions">
        <a class="search-map-modal__btn search-map-modal__btn--ghost" href="${href}">Hirdetés</a>
      </div>
    </div>`;
  }

  if (routeInfo?.loading) {
    return `<div class="search-map-modal__route search-map-modal__route--loading">
      <div class="search-map-modal__route-lab">Útvonal</div>
      <p class="search-map-modal__route-title">Számítás…</p>
      <p class="search-map-modal__route-note">${escapeHtml(homeOrigin.label)} → ${city}</p>
    </div>`;
  }

  const gmaps = routeInfo?.gmaps
    ? `<a class="search-map-modal__btn search-map-modal__btn--yellow" href="${escapeHtml(routeInfo.gmaps)}" target="_blank" rel="noopener noreferrer">Google Térkép</a>`
    : "";
  const listingBtn = `<a class="search-map-modal__btn search-map-modal__btn--ghost" href="${href}">Hirdetés</a>`;

  if (routeInfo?.error) {
    const air = routeInfo.airKm != null ? formatKm(routeInfo.airKm) : "—";
    return `<div class="search-map-modal__route">
      <div class="search-map-modal__route-lab">Útvonal</div>
      <h3 class="search-map-modal__route-title">${air} · légvonal</h3>
      <p class="search-map-modal__route-note">${escapeHtml(routeInfo.error)}</p>
      <div class="search-map-modal__route-actions">${gmaps}${listingBtn}</div>
    </div>`;
  }

  if (routeInfo) {
    const dur = formatDuration(routeInfo.durationSec);
    const title = `${formatKm(routeInfo.distanceKm)}${dur ? ` · ${dur}` : ""}`;
    return `<div class="search-map-modal__route">
      <div class="search-map-modal__route-lab">Útvonal</div>
      <h3 class="search-map-modal__route-title">${title}</h3>
      <p class="search-map-modal__route-note">${escapeHtml(homeOrigin.label)} → ${city}</p>
      <div class="search-map-modal__route-actions">${gmaps}${listingBtn}</div>
    </div>`;
  }

  return `<div class="search-map-modal__route">
    <div class="search-map-modal__route-lab">Útvonal</div>
    <p class="search-map-modal__route-title" style="font-size:0.95rem;font-weight:700">Válassz autót</p>
    <div class="search-map-modal__route-actions">${listingBtn}</div>
  </div>`;
}

function renderSideListing(side, pin, routeInfo = null) {
  if (!side) return;
  if (!pin) {
    renderSideAll(side, lastPins);
    return;
  }

  const others = lastPins
    .filter((p) => String(p.item?.id) !== String(pin.item?.id))
    .map((p) => pickCardHtml(p))
    .join("");

  side.innerHTML = `
    <div class="search-map-modal__side-pin">
      <button type="button" class="search-map-modal__back" data-search-map-back>‹ Vissza az összes autóhoz</button>
      ${renderRouteBlock(pin, routeInfo)}
      <p class="search-map-modal__list-label">Kiválasztott</p>
      ${pickCardHtml(pin, { selected: true, asLink: true })}
    </div>
    <div class="search-map-modal__side-scroll">
      ${
        others
          ? `<p class="search-map-modal__list-label">Többi a listából</p><div class="search-map-modal__cards">${others}</div>`
          : `<p class="search-map-modal__hint">Nincs más autó a listában.</p>`
      }
    </div>
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
  if (lastLeaflet) syncPinIcons(lastLeaflet);
  fitAllPins();
  requestAnimationFrame(() => mapInstance?.invalidateSize());
}

async function showRouteToPin(L, pin, side) {
  selectedPinId = pin?.item?.id ?? null;
  clearRoute();
  syncPinIcons(L);
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
      color: "#0f172a",
      weight: 5,
      opacity: 0.88,
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
      { color: "#0f172a", weight: 3, opacity: 0.55, dashArray: "8 8" }
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
      icon: getCarIcon(L, false),
      riseOnHover: true,
    });
    pin.marker = marker;
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
  const side = root.querySelector("[data-search-map-side]");
  root.hidden = false;
  document.body.classList.add("search-map-open");
  homeOrigin = null;
  lastPins = [];
  selectedPinId = null;
  clearRoute();
  setMapStats({ empty: !list.length });
  renderSideAll(side, []);

  if (!list.length) {
    setMapStats({ empty: true });
    return;
  }

  try {
    const [L, cityIndex] = await Promise.all([loadLeaflet(), getCityIndex()]);
    homeOrigin = await resolveHomeOrigin(cityIndex);
    const { pins, skipped } = placeListings(list, cityIndex);
    setMapStats({
      pins: pins.length,
      skipped,
      homeLabel: homeOrigin?.label || "",
    });
    if (!pins.length) {
      if (side) {
        side.innerHTML = `<p class="search-map-modal__hint">Nincs településadat a találatokhoz — a térkép üres.</p>`;
      }
      return;
    }
    paintMap(L, pins, side);
  } catch (error) {
    setMapStats({ error: error?.message || "Térkép betöltési hiba." });
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
