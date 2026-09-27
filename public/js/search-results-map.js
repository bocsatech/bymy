/**
 * Keresési találatok térképen — autó ikonok + útvonal / távolság a lakhelytől.
 */
import {
  buildCityIndex,
  buildPostalIndex,
  haversineKm,
  listingCityName,
  resolveListingCoords,
} from "./listing-radius.js?v=mapPostal3";
import { listingDetailHref } from "./listing-return.js?v=scrollTop1";
import { listingTileTitle, listingTilePrice } from "./listing-tile.js?v=listThumb1";
import { getAuthUser } from "./site-auth.js?v=bootFix2";
import { fetchListingsPage } from "./db-client.js?v=ownerBoost6";

const HU_CENTER = [47.1625, 19.5033];
const HU_ZOOM = 7;
const CLUSTER_ZOOM = 11;
const JITTER_DEG = 0.0035;
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const LABEL_BROWSE = "Keresés a térképen";
const LABEL_FILTERED = "Találatok a térképen";

let cityIndexPromise = null;
let postalIndexPromise = null;
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
let mapMode = "filtered"; /* browse | filtered */
let mapSideEl = null;
let moveRefreshBound = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getCityIndex() {
  if (!cityIndexPromise) {
    cityIndexPromise = fetch("/api/postal-codes/cities", { credentials: "same-origin" })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (!data.cities) throw new Error(data.error || "Településlista nem elérhető.");
        return buildCityIndex(data.cities);
      })
      .catch((error) => {
        cityIndexPromise = null;
        throw error;
      });
  }
  return cityIndexPromise;
}

function getPostalIndex() {
  if (!postalIndexPromise) {
    postalIndexPromise = fetch("/api/postal-codes/index", { credentials: "same-origin" })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (!Array.isArray(data.postals)) throw new Error(data.error || "Irányítószám-lista nem elérhető.");
        return buildPostalIndex(data.postals);
      })
      .catch((error) => {
        postalIndexPromise = null;
        throw error;
      });
  }
  return postalIndexPromise;
}

async function fetchAllVerticalListings(vertical) {
  const out = [];
  let offset = 0;
  for (let pageNo = 0; pageNo < 40; pageNo += 1) {
    const page = await fetchListingsPage({
      limit: 100,
      offset,
      status: "feladott",
      vertical: vertical || null,
      tile: true,
    });
    const batch = page.listings || [];
    out.push(...batch);
    if (!page.hasMore || !batch.length) break;
    offset += batch.length;
  }
  return out;
}

export function updateSearchMapButtonLabels(hasFilters) {
  const label = hasFilters ? LABEL_FILTERED : LABEL_BROWSE;
  document.querySelectorAll("[data-search-map-open]").forEach((btn) => {
    btn.textContent = label;
    btn.dataset.mapMode = hasFilters ? "filtered" : "browse";
  });
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

function profileHomeBits(profile = null) {
  const p = profile || {};
  const postal = String(p.postalCode || p.companyPostalCode || "")
    .replace(/\D/g, "")
    .slice(0, 4);
  const cityName = String(p.city || p.companyCity || "").trim();
  const street = String(p.street || p.companyStreet || "").trim();
  return { postal, cityName, street };
}

async function resolveHomeOrigin(cityIndex, postalIndex = null) {
  const user = getAuthUser();
  let profile = user?.profile ?? null;
  /* Session cache can lag behind /api/auth/me — refresh once if address fields are missing. */
  if (user?.email && !profileHomeBits(profile).postal && !profileHomeBits(profile).cityName) {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.user?.profile) profile = data.user.profile;
    } catch {
      /* keep session profile */
    }
  }

  const bits = profileHomeBits(profile);
  /* Profile address wins for the home pin — stats/nearby localStorage must not move lakhely. */
  const postal = String(bits.postal || "")
    .replace(/\D/g, "")
    .slice(0, 4);
  const cityName = bits.cityName;

  if (postal.length === 4) {
    try {
      const res = await fetch(`/api/postal-codes/lookup?postal_code=${encodeURIComponent(postal)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.lat != null && data.lon != null) {
        return {
          lat: Number(data.lat),
          lon: Number(data.lon),
          label: [data.city || cityName, postal].filter(Boolean).join(" · ") || postal,
          postal,
        };
      }
    } catch {
      /* fall through */
    }
    const fromIndex = postalIndex?.get?.(postal);
    if (fromIndex) {
      return {
        lat: fromIndex.lat,
        lon: fromIndex.lon,
        label: [fromIndex.city || cityName, postal].filter(Boolean).join(" · ") || postal,
        postal,
      };
    }
  }

  if (cityName && cityIndex) {
    const hit = resolveListingCoords(
      { preview: { filter: { telepules: cityName, iranyitoszam: postal } } },
      cityIndex,
      postalIndex
    );
    if (hit) {
      return { lat: hit.lat, lon: hit.lon, label: hit.city || cityName, postal: postal || hit.postal || "" };
    }
  }

  /* Street-level fallback (Nominatim via our API). */
  if (postal.length === 4 || cityName || bits.street) {
    try {
      const lines = [bits.street, [postal, cityName].filter(Boolean).join(" ")].filter(Boolean);
      const q = lines.join(", ") || `${postal} ${cityName}`.trim();
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(q)}&lines=${encodeURIComponent(lines.join("|"))}`,
        { credentials: "same-origin" }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.lat != null && data.lon != null) {
        return {
          lat: Number(data.lat),
          lon: Number(data.lon),
          label: [cityName, postal].filter(Boolean).join(" · ") || data.label || q,
          postal: postal || "",
        };
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function placeHomeMarker(L) {
  if (!homeOrigin || !markersLayer || !L) return null;
  const homeMarker = L.marker([homeOrigin.lat, homeOrigin.lon], {
    title: `Lakhely · ${homeOrigin.label}`,
    icon: getHomeIcon(L),
    zIndexOffset: 400,
  });
  homeMarker.bindTooltip(`Lakhely · ${homeOrigin.label}`, { direction: "top", offset: [0, -10] });
  homeMarker.addTo(markersLayer);
  return homeMarker;
}

function findListingsHost() {
  return (
    document.querySelector(".home-listings-panel") ||
    document.getElementById("home-grid-track")?.parentElement ||
    null
  );
}

function ensureMapPanel() {
  let root = document.getElementById("search-map-modal");
  const markup = `
    <div class="search-map-modal__panel" role="region" aria-label="Találatok a térképen">
      <div class="search-map-modal__body">
        <div id="search-map-canvas" class="search-map-modal__canvas" aria-label="Térkép"></div>
        <aside class="search-map-modal__side" data-search-map-side>
          <p class="search-map-modal__hint">Kattints egy autó ikonra — megmutatjuk az utat a lakhelyedtől.</p>
        </aside>
      </div>
    </div>
  `;
  const host = findListingsHost();
  const grid = document.getElementById("home-grid-track");

  if (!root) {
    root = document.createElement("div");
    root.id = "search-map-modal";
    root.className = "search-map-inline";
    root.hidden = true;
    root.innerHTML = markup;
    if (host && grid && grid.parentElement === host) {
      host.insertBefore(root, grid);
    } else if (host) {
      host.prepend(root);
    } else {
      document.body.appendChild(root);
    }
    root.addEventListener("click", (event) => {
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

  /* Upgrade older modal / header shell. */
  root.classList.add("search-map-inline");
  root.classList.remove("search-map-modal");
  if (
    root.querySelector(".search-map-modal__head") ||
    root.querySelector(".search-map-modal__backdrop") ||
    !root.querySelector("[data-search-map-side]")
  ) {
    const wasHidden = root.hidden;
    root.innerHTML = markup;
    root.hidden = wasHidden;
  }
  if (host && grid && root.parentElement !== host) {
    host.insertBefore(root, grid);
  } else if (host && grid && root.nextElementSibling !== grid) {
    host.insertBefore(root, grid);
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

function placeListings(items, cityIndex, postalIndex = null) {
  const byKey = new Map();
  let skipped = 0;
  for (const item of items ?? []) {
    const coords = resolveListingCoords(item, cityIndex, postalIndex);
    if (!coords) {
      skipped += 1;
      continue;
    }
    const postal = String(coords.postal || "").replace(/\D/g, "").slice(0, 4);
    const key = postal.length === 4 ? `p:${postal}` : `${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        city: coords.city || listingCityName(item) || "Ismeretlen",
        postal,
        baseLat: coords.lat,
        baseLon: coords.lon,
        items: [],
      });
    }
    byKey.get(key).items.push(item);
  }

  const pins = [];
  for (const group of byKey.values()) {
    const total = group.items.length;
    group.items.forEach((item, index) => {
      const pos = jitterCoords(group.baseLat, group.baseLon, index, total, item.id);
      pins.push({
        item,
        city: group.city,
        postal: group.postal,
        baseLat: group.baseLat,
        baseLon: group.baseLon,
        lat: pos.lat,
        lon: pos.lon,
      });
    });
  }
  return { pins, skipped };
}

function getPostalClusterIcon(L, postal, count) {
  const label = escapeHtml(postal || "?");
  const n = Number(count) || 0;
  return L.divIcon({
    className: "search-map-postal-cluster",
    html: `<span class="search-map-postal-cluster__dot" aria-hidden="true"><strong>${label}</strong><em>${n}</em></span>`,
    iconSize: [54, 36],
    iconAnchor: [27, 18],
  });
}

function groupPinsByPostal(pins) {
  const groups = new Map();
  for (const pin of pins) {
    const key = pin.postal?.length === 4 ? pin.postal : `${pin.baseLat?.toFixed(4)},${pin.baseLon?.toFixed(4)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        postal: pin.postal || "",
        city: pin.city || "",
        lat: pin.baseLat ?? pin.lat,
        lon: pin.baseLon ?? pin.lon,
        pins: [],
      });
    }
    groups.get(key).pins.push(pin);
  }
  return [...groups.values()];
}

function refreshVisibleMarkers() {
  if (!mapInstance || !markersLayer || !lastLeaflet) return;
  const L = lastLeaflet;
  const side = mapSideEl || document.querySelector("[data-search-map-side]");
  markersLayer.clearLayers();
  for (const pin of lastPins) pin.marker = null;

  placeHomeMarker(L);

  const bounds = mapInstance.getBounds().pad(0.05);
  const zoom = mapInstance.getZoom();
  const useClusters = mapMode === "browse" && zoom < CLUSTER_ZOOM;

  if (useClusters) {
    const groups = groupPinsByPostal(lastPins).filter((g) => bounds.contains([g.lat, g.lon]));
    for (const group of groups) {
      const marker = L.marker([group.lat, group.lon], {
        title: `${group.postal || group.city} · ${group.pins.length} autó`,
        icon: getPostalClusterIcon(L, group.postal || group.city, group.pins.length),
        zIndexOffset: 200,
      });
      marker.bindTooltip(
        `${group.postal || "—"}${group.city ? ` · ${group.city}` : ""} · ${group.pins.length} autó`,
        { direction: "top", offset: [0, -8] }
      );
      marker.on("click", () => {
        mapInstance.setView([group.lat, group.lon], Math.max(CLUSTER_ZOOM, zoom + 2));
      });
      marker.addTo(markersLayer);
    }
    if (side && selectedPinId == null) {
      side.innerHTML = `<div class="search-map-modal__side-pin"><p class="search-map-modal__hint">Irányítószám-csoportok a látható területen. Nagyíts, vagy kattints egy csoportra — kibontja az autókat.</p></div>`;
    }
    return;
  }

  const visiblePins = lastPins.filter((pin) => bounds.contains([pin.lat, pin.lon]));
  for (const pin of visiblePins) {
    const title = listingTileTitle(pin.item);
    const marker = L.marker([pin.lat, pin.lon], {
      title,
      icon: getCarIcon(L, selectedPinId != null && String(pin.item?.id) === String(selectedPinId)),
      riseOnHover: true,
    });
    pin.marker = marker;
    const tip =
      mapMode === "browse" && pin.postal
        ? `${pin.postal}${pin.city ? ` · ${pin.city}` : ""}`
        : `${title}${pin.city ? ` · ${pin.city}` : ""}`;
    marker.bindTooltip(tip, { direction: "top", offset: [0, -10] });
    marker.on("click", () => {
      showRouteToPin(L, pin, side);
    });
    marker.addTo(markersLayer);
  }
  if (side && selectedPinId == null && mapMode === "browse") {
    side.innerHTML = `<div class="search-map-modal__side-pin"><p class="search-map-modal__hint">Látható autók: ${visiblePins.length}. Kattints egy pinre a részletekhez.</p></div>`;
  } else if (side && selectedPinId == null && mapMode === "filtered") {
    renderSideAll(side, lastPins);
  }
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
    const bits = [`<span class="search-map-modal__stat">Nincs találat</span>`];
    if (homeLabel) {
      bits.push(
        `<span class="search-map-modal__stat search-map-modal__stat--home">⌂ ${escapeHtml(homeLabel)}</span>`
      );
    }
    stats.innerHTML = bits.join("");
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
    ? `${escapeHtml(homeOrigin.label)} → kattints egy autóra a térképen`
    : `Állíts be irányítószámot a <a href="/beallitasok.html?szekcio=keresesi-korzet">Keresési körzet</a>ben.`;

  if (!pins?.length) {
    side.innerHTML = `<div class="search-map-modal__side-pin"><p class="search-map-modal__hint">${homeHint}</p></div>`;
    return;
  }

  const routeTeaser = homeOrigin
    ? `<div class="search-map-modal__route search-map-modal__route--teaser">
        <div class="search-map-modal__route-lab">Útvonal</div>
        <p class="search-map-modal__route-title">Válassz autót</p>
        <p class="search-map-modal__route-note">${escapeHtml(homeOrigin.label)} → kattints egy pinre a térképen</p>
      </div>`
    : `<div class="search-map-modal__route search-map-modal__route--warn">
        <div class="search-map-modal__route-lab">Útvonal</div>
        <p class="search-map-modal__route-title" style="font-size:0.95rem;font-weight:700">Nincs lakhely</p>
        <p class="search-map-modal__route-note">${homeHint}</p>
      </div>`;

  side.innerHTML = `<div class="search-map-modal__side-pin">${routeTeaser}</div>`;
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
    <p class="search-map-modal__route-title" style="font-size:0.95rem;font-weight:700">Kiválasztva</p>
    <div class="search-map-modal__route-actions">${listingBtn}</div>
  </div>`;
}

function renderSideListing(side, pin, routeInfo = null) {
  if (!side) return;
  if (!pin) {
    renderSideAll(side, lastPins);
    return;
  }

  side.innerHTML = `
    <div class="search-map-modal__side-pin">
      <button type="button" class="search-map-modal__back" data-search-map-back>‹ Kiválasztás törlése</button>
      ${renderRouteBlock(pin, routeInfo)}
      <p class="search-map-modal__list-label">Kiválasztott</p>
      ${pickCardHtml(pin, { selected: true, asLink: true })}
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
  refreshVisibleMarkers();
  if (mapMode === "filtered") fitAllPins();
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

function bindMapViewportRefresh() {
  if (!mapInstance || moveRefreshBound) return;
  moveRefreshBound = true;
  mapInstance.on("moveend", () => refreshVisibleMarkers());
  mapInstance.on("zoomend", () => refreshVisibleMarkers());
}

function paintMap(L, pins, side) {
  const canvas = document.getElementById("search-map-canvas");
  if (!canvas) return;

  lastLeaflet = L;
  lastPins = pins;
  mapSideEl = side;
  selectedPinId = null;
  moveRefreshBound = false;

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
  bindMapViewportRefresh();

  if (mapMode === "browse") {
    if (homeOrigin) mapInstance.setView([homeOrigin.lat, homeOrigin.lon], 10);
    else mapInstance.setView(HU_CENTER, HU_ZOOM);
  } else {
    const bounds = pins.map((p) => [p.lat, p.lon]);
    if (homeOrigin) bounds.push([homeOrigin.lat, homeOrigin.lon]);
    if (bounds.length === 1) mapInstance.setView(bounds[0], 11);
    else if (bounds.length > 1) mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }

  refreshVisibleMarkers();
  requestAnimationFrame(() => {
    mapInstance?.invalidateSize();
    refreshVisibleMarkers();
  });
}

function collectListingsFromDom() {
  const cards = document.querySelectorAll(
    "#home-grid-track [data-listing-id], #home-grid-track .home-card, #home-grid-track [data-home-card]"
  );
  const out = [];
  const seen = new Set();
  for (const el of cards) {
    const item = el.__bymyListing;
    if (!item || item.id == null) continue;
    const id = String(item.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

async function resolveMapItems(getItems) {
  const read = () => {
    let items = [];
    try {
      items = typeof getItems === "function" ? getItems() : [];
    } catch (error) {
      console.warn("Térkép getItems:", error);
    }
    if (Array.isArray(items) && items.length) return items;
    const fromDom = collectListingsFromDom();
    if (fromDom.length) return fromDom;
    return Array.isArray(items) ? items : [];
  };
  let items = read();
  if (items.length) return items;
  await new Promise((resolve) => setTimeout(resolve, 450));
  return read();
}

async function ensureBaseMap(L) {
  const canvas = document.getElementById("search-map-canvas");
  if (!canvas || !L) return null;
  lastLeaflet = L;
  moveRefreshBound = false;
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
  bindMapViewportRefresh();
  requestAnimationFrame(() => {
    mapInstance?.invalidateSize();
    requestAnimationFrame(() => mapInstance?.invalidateSize());
  });
  return mapInstance;
}

export function closeSearchResultsMap() {
  const root = document.getElementById("search-map-modal");
  if (root) root.hidden = true;
  document.body.classList.remove("search-map-open");
  document.querySelectorAll("[data-search-map-open]").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
  });
  clearRoute();
  routeRequestId += 1;
  selectedPinId = null;
  mapSideEl = null;
}

export async function openSearchResultsMap(items, { mode = "filtered" } = {}) {
  mapMode = mode === "browse" ? "browse" : "filtered";
  const list = Array.isArray(items) ? items : [];
  const root = ensureMapPanel();
  const side = root.querySelector("[data-search-map-side]");
  mapSideEl = side;
  root.hidden = false;
  document.body.classList.add("search-map-open");
  document.querySelectorAll("[data-search-map-open]").forEach((btn) => {
    btn.setAttribute("aria-expanded", "true");
  });
  homeOrigin = null;
  lastPins = [];
  selectedPinId = null;
  clearRoute();
  setMapStats({ empty: !list.length });
  if (side) {
    side.innerHTML = `<p class="search-map-modal__hint">Térkép betöltése…</p>`;
  }
  try {
    root.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch {
  }

  try {
    const [L, cityIndex, postalIndex] = await Promise.all([
      loadLeaflet(),
      getCityIndex(),
      getPostalIndex().catch(() => null),
    ]);
    homeOrigin = await resolveHomeOrigin(cityIndex, postalIndex);

    if (!list.length) {
      setMapStats({ empty: true, homeLabel: homeOrigin?.label || "" });
      await ensureBaseMap(L);
      placeHomeMarker(L);
      if (homeOrigin) mapInstance?.setView([homeOrigin.lat, homeOrigin.lon], 10);
      if (side) {
        const homeNote = homeOrigin
          ? `<p class="search-map-modal__route-note">Lakhely: ${escapeHtml(homeOrigin.label)}</p>`
          : "";
        side.innerHTML = `<div class="search-map-modal__side-pin">${homeNote}<p class="search-map-modal__hint">Nincs autó a találati listában. Állíts más szűrőt, vagy várj a lista betöltésére.</p></div>`;
      }
      return;
    }

    const { pins, skipped } = placeListings(list, cityIndex, postalIndex);
    setMapStats({
      pins: pins.length,
      skipped,
      homeLabel: homeOrigin?.label || "",
    });
    if (!pins.length) {
      await ensureBaseMap(L);
      placeHomeMarker(L);
      if (homeOrigin) mapInstance?.setView([homeOrigin.lat, homeOrigin.lon], 10);
      if (side) {
        const homeNote = homeOrigin
          ? `<p class="search-map-modal__route-note">Lakhely: ${escapeHtml(homeOrigin.label)}</p>`
          : "";
        side.innerHTML = `<div class="search-map-modal__side-pin">${homeNote}<p class="search-map-modal__hint">Nincs irányítószám / település a találatokhoz — a térkép üres. (${skipped} kihagyva)</p></div>`;
      }
      return;
    }
    paintMap(L, pins, side);
  } catch (error) {
    setMapStats({ error: error?.message || "Térkép betöltési hiba." });
    try {
      const L = await loadLeaflet();
      await ensureBaseMap(L);
    } catch {
      /* ignore */
    }
    if (side) {
      side.innerHTML = `<p class="search-map-modal__hint">${escapeHtml(error?.message || "Térkép betöltési hiba.")}</p>`;
    }
  }
}

export function initSearchResultsMapButtons({
  getItems,
  hasActiveFilters,
  getVertical,
} = {}) {
  const buttons = document.querySelectorAll("[data-search-map-open]");
  if (!buttons.length) return;

  const syncLabel = () => {
    const filtered = typeof hasActiveFilters === "function" ? Boolean(hasActiveFilters()) : false;
    updateSearchMapButtonLabels(filtered);
  };
  syncLabel();

  buttons.forEach((btn) => {
    if (btn.dataset.searchMapBound === "1") return;
    btn.dataset.searchMapBound = "1";
    btn.setAttribute("aria-controls", "search-map-modal");
    btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", async () => {
      const root = document.getElementById("search-map-modal");
      if (root && !root.hidden) {
        closeSearchResultsMap();
        return;
      }
      btn.disabled = true;
      try {
        syncLabel();
        const filtered = typeof hasActiveFilters === "function" ? Boolean(hasActiveFilters()) : false;
        let items;
        if (filtered) {
          items = await resolveMapItems(getItems);
          await openSearchResultsMap(items, { mode: "filtered" });
        } else {
          const vertical = typeof getVertical === "function" ? getVertical() : null;
          if (btn) btn.textContent = "Térkép betöltése…";
          items = await fetchAllVerticalListings(vertical);
          if (!items.length) items = await resolveMapItems(getItems);
          await openSearchResultsMap(items, { mode: "browse" });
          syncLabel();
        }
      } finally {
        btn.disabled = false;
        syncLabel();
      }
    });
  });
}
