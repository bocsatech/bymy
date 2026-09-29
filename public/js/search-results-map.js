/**
 * Keresési találatok térképen — autó ikonok + útvonal / távolság a lakhelytől.
 */
import {
  buildCityIndex,
  buildPostalIndex,
  haversineKm,
  listingCityName,
  normalizePlace,
  resolveCityCoords,
  resolveListingCoords,
} from "./listing-radius.js?v=mapG1";
import {
  listingDetailHref,
  rememberListingOpen,
  markMapOpenOnReturn,
} from "./listing-return.js?v=perfNav1";
import { listingTileTitle, listingTilePrice } from "./listing-tile.js?v=listThumb1";
import { getAuthUser, loadProfileFromServer } from "./site-auth.js?v=bootFix2";
import { fetchListingsPage } from "./db-client.js?v=ownerBoost6";
import { buildNearbyFilter, readNearbyPrefs } from "./nearby-search.js?v=mapG1";
import { loadGoogleMaps } from "./google-maps-loader.js?v=mapG1";

const HU_CENTER = { lat: 47.1625, lng: 19.5033 };
const HU_ZOOM = 7;
const CLUSTER_ZOOM = 11;
const JITTER_DEG = 0.0035;
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const LABEL_BROWSE = "Autók a Közelben";
const LABEL_FILTERED = "Találatok a térképen";
/** Böngésző térkép: lakhely körüli sugar (km), csoportosítva. */
const MAP_BROWSE_RADIUS_KM = 10;
const MAP_BROWSE_MAX_PAGES = 25;

let cityIndexPromise = null;
let postalIndexPromise = null;
let mapInstance = null;
let mapMarkers = [];
let routeLine = null;
let homeMarkerRef = null;
let homeOrigin = null;
let routeRequestId = 0;
let lastPins = [];
let lastMaps = null;
let selectedPinId = null;
let mapMode = "filtered"; /* browse | filtered */
let lastPreferHomeZoom = false;
let mapSideEl = null;
let moveRefreshBound = false;
let placesAutocomplete = null;

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

/** Körzetes térkép-böngészés: helységnév alapján (~10 km), nem országos. */
async function fetchVerticalListingsInRadius(vertical, { postal, city, radiusKm = MAP_BROWSE_RADIUS_KM } = {}) {
  const cityName = String(city || "").trim();
  const code = String(postal || "")
    .replace(/\D/g, "")
    .slice(0, 4);
  if (!cityName && code.length !== 4) {
    return { items: [], error: "Nincs település a körzetes térképhez." };
  }
  const out = [];
  const seen = new Set();
  let offset = 0;
  let origin = null;
  for (let pageNo = 0; pageNo < MAP_BROWSE_MAX_PAGES; pageNo += 1) {
    const page = await fetchListingsPage({
      limit: 100,
      offset,
      status: "feladott",
      vertical: vertical || null,
      tile: true,
    });
    const batch = page.listings || [];
    if (!batch.length) break;
    try {
      const nearby = await buildNearbyFilter({
        items: batch,
        postal: code,
        city: cityName,
        radiusKm,
      });
      origin = nearby.origin || origin;
      for (const item of batch) {
        const id = Number(item.id);
        if (!Number.isFinite(id) || seen.has(id)) continue;
        const ids = nearby.listingIds;
        if (ids && !(ids.has(id) || ids.has(item.id) || ids.has(String(id)))) continue;
        if (!ids) continue;
        seen.add(id);
        out.push(item);
      }
    } catch (error) {
      return { items: [], error: error?.message || "Körzetes szűrés sikertelen." };
    }
    if (!page.hasMore) break;
    offset += batch.length;
    if (out.length >= 200) break;
  }
  return { items: out, origin, radiusKm };
}

export function updateSearchMapButtonLabels(hasFilters) {
  const label = hasFilters ? LABEL_FILTERED : LABEL_BROWSE;
  document.querySelectorAll("[data-search-map-open]").forEach((btn) => {
    btn.textContent = label;
    btn.dataset.mapMode = hasFilters ? "filtered" : "browse";
  });
}

function loadMapsApi() {
  return loadGoogleMaps();
}

function clearMapOverlays() {
  for (const m of mapMarkers) {
    try {
      m.setMap(null);
    } catch {
    }
  }
  mapMarkers = [];
  if (homeMarkerRef) {
    try {
      homeMarkerRef.setMap(null);
    } catch {
    }
    homeMarkerRef = null;
  }
  clearRoute();
}

function destroyMapInstance() {
  clearMapOverlays();
  if (mapInstance && lastMaps?.event) {
    try {
      lastMaps.event.clearInstanceListeners(mapInstance);
    } catch {
    }
  }
  mapInstance = null;
  moveRefreshBound = false;
  const canvas = document.getElementById("search-map-canvas");
  if (canvas) canvas.innerHTML = "";
}

function ll(lat, lon) {
  return { lat: Number(lat), lng: Number(lon) };
}

function boundsContains(bounds, lat, lon) {
  if (!bounds) return true;
  try {
    return bounds.contains(ll(lat, lon));
  } catch {
    return true;
  }
}

function fitLatLngs(points, maxZoom = 12, padding = 48) {
  if (!mapInstance || !lastMaps || !points?.length) return;
  if (points.length === 1) {
    mapInstance.setCenter(points[0]);
    mapInstance.setZoom(Math.min(11, maxZoom));
    return;
  }
  const bounds = new lastMaps.LatLngBounds();
  for (const p of points) bounds.extend(p);
  mapInstance.fitBounds(bounds, padding);
  lastMaps.event.addListenerOnce(mapInstance, "idle", () => {
    if (mapInstance && mapInstance.getZoom() > maxZoom) mapInstance.setZoom(maxZoom);
  });
}

function carIconSvg(selected) {
  const bg = selected ? "#f59e0b" : "#0f172a";
  const fg = selected ? "#0f172a" : "#fff";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill="${bg}"/>
    <g fill="none" stroke="${fg}" stroke-width="1.7" stroke-linecap="round" transform="translate(2 2)">
      <path d="M4.5 14.5 6 9.2A2 2 0 0 1 7.9 7.8h8.2A2 2 0 0 1 18 9.2l1.5 5.3"/>
      <path d="M5 14.5h14"/>
      <circle cx="7.5" cy="15.2" r="1.6" fill="${fg}" stroke="none"/>
      <circle cx="16.5" cy="15.2" r="1.6" fill="${fg}" stroke="none"/>
    </g>
  </svg>`;
}

function homeIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <circle cx="15" cy="15" r="14" fill="#2563eb"/>
    <text x="15" y="20" text-anchor="middle" font-size="14" fill="#fff">⌂</text>
  </svg>`;
}

function clusterIconSvg(label, count) {
  const safe = String(label || "")
    .slice(0, 10)
    .replace(/[<>&]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="36" viewBox="0 0 72 36">
    <rect x="1" y="1" width="70" height="34" rx="10" fill="#0f172a"/>
    <text x="36" y="15" text-anchor="middle" font-size="10" font-family="system-ui,sans-serif" fill="#fff">${safe}</text>
    <text x="36" y="28" text-anchor="middle" font-size="11" font-weight="700" font-family="system-ui,sans-serif" fill="#fbbf24">${Number(count) || 0}</text>
  </svg>`;
}

function markerIconFromSvg(maps, svg, sizeW, sizeH) {
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(sizeW, sizeH),
    anchor: new maps.Point(sizeW / 2, sizeH / 2),
  };
}

function profileHomeBits(profile = null) {
  const p = profile || {};
  const postal = String(p.postalCode || p.companyPostalCode || "")
    .replace(/\D/g, "")
    .slice(0, 4);
  let cityName = String(p.city || p.companyCity || "").trim();
  const street = String(p.street || p.companyStreet || p.companyAddress || "").trim();

  /* Utca/cím mezőben gyakran „7083 Tolnanémedi” van — településnév kinyerése. */
  if (!cityName && street) {
    const m = street.match(/\b\d{4}\s+([A-Za-záéíóöőúüűÁÉÍÓÖŐÚÜŰ][\wáéíóöőúüűÁÉÍÓÖŐÚÜŰ\-]*(?:\s+[A-Za-záéíóöőúüűÁÉÍÓÖŐÚÜŰ][\wáéíóöőúüűÁÉÍÓÖŐÚÜŰ\-]*){0,3})/);
    if (m?.[1]) cityName = m[1].trim();
    else if (!/^\d{4}$/.test(street) && !/\d/.test(street.slice(0, 2))) cityName = street.split(",")[0].trim();
  }

  /* „Tolnanémedi Tolna” megye-végződés levágása a címkéhez / egyezéshez */
  const cityCore = cityName.replace(/\s+(megye|vármegye)$/i, "").trim();

  return { postal, cityName: cityCore || cityName, street };
}

async function resolveHomeOrigin(cityIndex, postalIndex = null) {
  let profile = getAuthUser()?.profile ?? null;

  /* Teljes profil kell (city / companyCity) — /api/auth/me light profilt ad, cím nélkül. */
  if (getAuthUser()?.email) {
    try {
      const full = await loadProfileFromServer();
      if (full && typeof full === "object") profile = full;
    } catch {
      /* session profile marad */
    }
  }

  const prefs = readNearbyPrefs(profile);
  const bits = profileHomeBits(profile);
  let postal = String(bits.postal || prefs.postal || "")
    .replace(/\D/g, "")
    .slice(0, 4);
  let cityName = bits.cityName || String(prefs.city || "").trim();

  /* Irsz csak a településnév feloldásához — a középpont SOHA nem az irsz-pin. */
  if (!cityName && postal.length === 4) {
    try {
      const res = await fetch(`/api/postal-codes/lookup?postal_code=${encodeURIComponent(postal)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.city) cityName = String(data.city).trim();
    } catch {
      /* ignore */
    }
    if (!cityName && postalIndex?.has?.(postal)) {
      cityName = String(postalIndex.get(postal).city || "").trim();
    }
  }

  if (cityName && cityIndex) {
    const hit = resolveCityCoords(cityName, cityIndex);
    if (hit) {
      return {
        lat: hit.lat,
        lon: hit.lon,
        label: hit.city || cityName,
        postal: postal || "",
        city: hit.city || cityName,
      };
    }
  }

  if (cityName) {
    try {
      const q = `${cityName}, Magyarország`;
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.lat != null && data.lon != null) {
        return {
          lat: Number(data.lat),
          lon: Number(data.lon),
          label: cityName,
          postal: postal || "",
          city: cityName,
        };
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

function placeHomeMarker(maps) {
  if (!homeOrigin || !mapInstance || !maps) return null;
  if (homeMarkerRef) {
    try { homeMarkerRef.setMap(null); } catch {}
    homeMarkerRef = null;
  }
  homeMarkerRef = new maps.Marker({
    position: ll(homeOrigin.lat, homeOrigin.lon),
    map: mapInstance,
    title: `Lakhely · ${homeOrigin.label}`,
    icon: markerIconFromSvg(maps, homeIconSvg(), 30, 30),
    zIndex: 400,
  });
  return homeMarkerRef;
}

function findListingsHost() {
  return (
    document.querySelector(".home-listings-panel") ||
    document.getElementById("home-grid-track")?.parentElement ||
    null
  );
}

function rememberMapListingNavigation(event, root) {
  const link = event.target?.closest?.("a[href]");
  if (!link || !root?.contains?.(link)) return;
  let id = "";
  try {
    const u = new URL(link.getAttribute("href") || "", window.location.origin);
    if (/\/hirdetes\.html$/i.test(u.pathname)) id = String(u.searchParams.get("id") || "").trim();
  } catch {
  }
  if (!id) return;
  const pinIds = lastPins.map((p) => String(p.item?.id || "")).filter(Boolean);
  rememberListingOpen(id, link, document.getElementById("home-grid-track") || document, "", {
    fromMap: true,
    listingIds: pinIds.length ? pinIds : undefined,
  });
  markMapOpenOnReturn(true);
  try {
    window.dispatchEvent(new CustomEvent("bymy-listing-open", { detail: { id, fromMap: true } }));
  } catch {
  }
}

function ensureMapPanel() {
  let root = document.getElementById("search-map-modal");
  const markup = `
    <div class="search-map-modal__panel" role="region" aria-label="Találatok a térképen">
      <div class="search-map-modal__body">
        <div class="search-map-modal__canvas-wrap">
          <form class="search-map-modal__city-search" data-search-map-city-form autocomplete="off">
            <label class="search-map-modal__city-search-lab" for="search-map-city-input">Település</label>
            <input
              id="search-map-city-input"
              class="search-map-modal__city-input"
              type="search"
              name="map_telepules"
              data-search-map-city
              placeholder="Település neve…"
              autocomplete="off"
              enterkeyhint="search"
            />
            <button type="submit" class="search-map-modal__city-go">Keres</button>
          </form>
          <div id="search-map-canvas" class="search-map-modal__canvas" aria-label="Térkép"></div>
        </div>
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
    root.dataset.mapNavBound = "1";
    root.addEventListener("click", (event) => {
      if (event.target?.closest?.("[data-search-map-back]")) {
        showAllResults();
        return;
      }
      const pick = event.target?.closest?.("[data-search-map-pick]");
      if (pick) {
        const id = String(pick.getAttribute("data-search-map-pick") || "");
        const pin = lastPins.find((p) => String(p.item?.id) === id);
        if (pin && lastMaps) showRouteToPin(lastMaps, pin, root.querySelector("[data-search-map-side]"));
        return;
      }
      rememberMapListingNavigation(event, root);
    });
    root.addEventListener(
      "pointerenter",
      (event) => {
        const a = event.target?.closest?.("a[href*='hirdetes.html']");
        if (!a) return;
        try {
          const u = new URL(a.getAttribute("href"), location.origin);
          const id = u.searchParams.get("id");
          if (id) {
            import("./listing-prefetch.js?v=perfNav1")
              .then((m) => m.prefetchListingDetail(id))
              .catch(() => {});
          }
        } catch {
        }
      },
      true
    );
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !root.hidden) {
        if (selectedPinId != null) showAllResults();
        else {
          markMapOpenOnReturn(false);
          closeSearchResultsMap();
        }
      }
    });
    bindMapCitySearch(root);
    return root;
  }

  /* Upgrade older modal / header shell. */
  root.classList.add("search-map-inline");
  root.classList.remove("search-map-modal");
  if (
    root.querySelector(".search-map-modal__head") ||
    root.querySelector(".search-map-modal__backdrop") ||
    !root.querySelector("[data-search-map-side]") ||
    !root.querySelector("[data-search-map-city]")
  ) {
    const wasHidden = root.hidden;
    root.innerHTML = markup;
    root.hidden = wasHidden;
    delete root.dataset.mapCityBound;
  }
  if (host && grid && root.parentElement !== host) {
    host.insertBefore(root, grid);
  } else if (host && grid && root.nextElementSibling !== grid) {
    host.insertBefore(root, grid);
  }
  if (root.dataset.mapNavBound !== "1") {
    root.dataset.mapNavBound = "1";
    root.addEventListener("click", (event) => {
      if (event.target?.closest?.("[data-search-map-back]")) {
        showAllResults();
        return;
      }
      const pick = event.target?.closest?.("[data-search-map-pick]");
      if (pick) {
        const id = String(pick.getAttribute("data-search-map-pick") || "");
        const pin = lastPins.find((p) => String(p.item?.id) === id);
        if (pin && lastMaps) showRouteToPin(lastMaps, pin, root.querySelector("[data-search-map-side]"));
        return;
      }
      rememberMapListingNavigation(event, root);
    });
  }
  bindMapCitySearch(root);
  return root;
}

function setMapCitySearchValue(cityName) {
  const input = document.querySelector("#search-map-modal [data-search-map-city]");
  if (!input) return;
  const name = String(cityName || "").trim();
  if (name) input.value = name;
}

async function resolveCityOriginByName(cityName, cityIndex = null, postal = "") {
  const name = String(cityName || "").trim();
  if (!name) return null;
  const index = cityIndex || (await getCityIndex());
  const hit = resolveCityCoords(name, index);
  if (hit) {
    return {
      lat: hit.lat,
      lon: hit.lon,
      label: hit.city || name,
      postal: String(postal || "").replace(/\D/g, "").slice(0, 4),
      city: hit.city || name,
    };
  }
  try {
    const q = `${name}, Magyarország`;
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.lat != null && data.lon != null) {
      return {
        lat: Number(data.lat),
        lon: Number(data.lon),
        label: name,
        postal: String(postal || "").replace(/\D/g, "").slice(0, 4),
        city: name,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Egy jel a településen + keresőmező frissítése. */
function placeOnlyHomeMarker(maps) {
  if (!mapInstance || !maps || !homeOrigin) return;
  clearMapOverlays();
  for (const pin of lastPins) pin.marker = null;
  lastPins = [];
  placeHomeMarker(maps);
  mapInstance.setCenter(ll(homeOrigin.lat, homeOrigin.lon));
  mapInstance.setZoom(11);
}

async function applyMapCitySearch(cityName) {
  const name = String(cityName || "").trim();
  if (!name) return;
  setMapCitySearchValue(name);
  try {
    localStorage.setItem("bymy_stats_city", name);
  } catch {
  }
  const cityIndex = await getCityIndex();
  const origin = await resolveCityOriginByName(name, cityIndex, homeOrigin?.postal || "");
  if (!origin) {
    const side = mapSideEl || document.querySelector("[data-search-map-side]");
    if (side) {
      side.innerHTML = `<div class="search-map-modal__side-pin"><p class="search-map-modal__hint">Ismeretlen település: ${escapeHtml(name)}</p></div>`;
    }
    return;
  }
  homeOrigin = origin;
  setMapCitySearchValue(origin.label);
  const maps = lastMaps || (await loadMapsApi());
  lastMaps = maps;
  if (!mapInstance) await ensureBaseMap(maps);
  placeOnlyHomeMarker(maps);
  setMapStats({ empty: true, homeLabel: origin.label });
  const side = mapSideEl || document.querySelector("[data-search-map-side]");
  if (side) {
    side.innerHTML = `<div class="search-map-modal__side-pin"><p class="search-map-modal__route-note">Lakhely: ${escapeHtml(origin.label)}</p><p class="search-map-modal__hint">1 jel a településen. Autók betöltése…</p></div>`;
  }
  try {
    const vertical = document.body?.dataset?.vertical || "auto";
    const nearby = await fetchVerticalListingsInRadius(vertical, {
      postal: origin.postal || "",
      city: origin.city || origin.label,
      radiusKm: MAP_BROWSE_RADIUS_KM,
    });
    const items = nearby.items || [];
    if (!items.length) {
      if (side) {
        side.innerHTML = `<div class="search-map-modal__side-pin"><p class="search-map-modal__route-note">Lakhely: ${escapeHtml(origin.label)} · ${MAP_BROWSE_RADIUS_KM} km</p><p class="search-map-modal__hint">Nincs autó ${MAP_BROWSE_RADIUS_KM} km-es körzetben.</p></div>`;
      }
      return;
    }
    const postalIndex = await getPostalIndex().catch(() => null);
    const { pins, skipped } = placeListings(items, cityIndex, postalIndex);
    mapMode = "browse";
    lastPreferHomeZoom = true;
    setMapStats({ pins: pins.length, skipped, homeLabel: origin.label });
    if (!pins.length) {
      placeOnlyHomeMarker(maps);
      if (side) {
        side.innerHTML = `<div class="search-map-modal__side-pin"><p class="search-map-modal__route-note">Lakhely: ${escapeHtml(origin.label)}</p><p class="search-map-modal__hint">Nincs település a találatokhoz.</p></div>`;
      }
      return;
    }
    paintMap(maps, pins, side);
  } catch (error) {
    if (side) {
      side.innerHTML = `<div class="search-map-modal__side-pin"><p class="search-map-modal__route-note">Lakhely: ${escapeHtml(origin.label)}</p><p class="search-map-modal__hint">${escapeHtml(error?.message || "Hiba")}</p></div>`;
    }
  }
}

function bindMapCitySearch(root) {
  if (!root || root.dataset.mapCityBound === "1") return;
  const form = root.querySelector("[data-search-map-city-form]");
  const input = root.querySelector("[data-search-map-city]");
  if (!form || !input) return;
  root.dataset.mapCityBound = "1";

  void loadMapsApi()
    .then((maps) => {
      if (!maps.places?.Autocomplete || placesAutocomplete) return;
      placesAutocomplete = new maps.places.Autocomplete(input, {
        fields: ["geometry", "name", "formatted_address"],
        componentRestrictions: { country: ["hu"] },
      });
      placesAutocomplete.addListener("place_changed", () => {
        const place = placesAutocomplete.getPlace();
        const loc = place?.geometry?.location;
        const name = String(place?.name || input.value || "").trim();
        if (loc && name) {
          homeOrigin = {
            lat: loc.lat(),
            lon: loc.lng(),
            label: name,
            postal: homeOrigin?.postal || "",
            city: name,
          };
          setMapCitySearchValue(name);
          void applyMapCitySearch(name);
          return;
        }
        void applyMapCitySearch(input.value);
      });
    })
    .catch(() => {
      /* Autocomplete nélkül is megy a form submit + /api/geocode */
    });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void applyMapCitySearch(input.value);
  });
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
    const city = String(coords.city || listingCityName(item) || "").trim() || "Ismeretlen";
    const postal = String(coords.postal || "").replace(/\D/g, "").slice(0, 4);
    /* Pin helye: irsz / pontos koord. Csoport csak azonos pontra (jitter). */
    const key =
      postal.length === 4
        ? `p:${postal}`
        : `ll:${Number(coords.lat).toFixed(4)},${Number(coords.lon).toFixed(4)}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        city,
        postal,
        baseLat: coords.lat,
        baseLon: coords.lon,
        items: [],
      });
    } else if (!byKey.get(key).city || byKey.get(key).city === "Ismeretlen") {
      byKey.get(key).city = city;
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

function getCityClusterIcon(maps, city, count) {
  return markerIconFromSvg(maps, clusterIconSvg(city, count), 72, 36);
}

function groupPinsByCity(pins) {
  const groups = new Map();
  for (const pin of pins) {
    const city = String(pin.city || "").trim();
    const cityNorm = normalizePlace(city);
    const key = cityNorm || `${pin.baseLat?.toFixed(4)},${pin.baseLon?.toFixed(4)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        city: city || "Ismeretlen",
        postal: pin.postal || "",
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
  if (!mapInstance || !lastMaps) return;
  const maps = lastMaps;
  const side = mapSideEl || document.querySelector("[data-search-map-side]");
  for (const m of mapMarkers) {
    try { m.setMap(null); } catch {}
  }
  mapMarkers = [];
  for (const pin of lastPins) pin.marker = null;

  placeHomeMarker(maps);

  const bounds = mapInstance.getBounds();
  const zoom = mapInstance.getZoom();
  const useClusters = mapMode === "browse" && zoom < CLUSTER_ZOOM;

  if (useClusters) {
    const groups = groupPinsByCity(lastPins).filter((g) => boundsContains(bounds, g.lat, g.lon));
    for (const group of groups) {
      const marker = new maps.Marker({
        position: ll(group.lat, group.lon),
        map: mapInstance,
        title: `${group.city} · ${group.pins.length} autó`,
        icon: getCityClusterIcon(maps, group.city, group.pins.length),
        zIndex: 200,
      });
      marker.addListener("click", () => {
        mapInstance.setCenter(ll(group.lat, group.lon));
        mapInstance.setZoom(Math.max(CLUSTER_ZOOM, zoom + 2));
      });
      mapMarkers.push(marker);
    }
    if (side && selectedPinId == null) {
      side.innerHTML = `<div class="search-map-modal__side-pin"><p class="search-map-modal__hint">Település-csoportok a látható területen. Nagyíts, vagy kattints egy településre — kibontja az autókat.</p></div>`;
    }
    return;
  }

  const visiblePins = lastPins.filter((pin) => boundsContains(bounds, pin.lat, pin.lon));
  for (const pin of visiblePins) {
    const title = listingTileTitle(pin.item);
    const selected = selectedPinId != null && String(pin.item?.id) === String(selectedPinId);
    const marker = new maps.Marker({
      position: ll(pin.lat, pin.lon),
      map: mapInstance,
      title: pin.city ? `${title} · ${pin.city}` : title,
      icon: getCarIcon(maps, selected),
      zIndex: selected ? 600 : 100,
    });
    pin.marker = marker;
    marker.addListener("click", () => {
      showRouteToPin(maps, pin, side);
    });
    mapMarkers.push(marker);
  }
  if (side && selectedPinId == null && mapMode === "browse") {
    side.innerHTML = `<div class="search-map-modal__side-pin"><p class="search-map-modal__hint">Látható autók: ${visiblePins.length}. Kattints egy pinre a részletekhez.</p></div>`;
  } else if (side && selectedPinId == null && mapMode === "filtered") {
    renderSideAll(side, lastPins);
  }
}

function getCarIcon(maps, selected = false) {
  return markerIconFromSvg(maps, carIconSvg(selected), 28, 28);
}

function syncPinIcons(maps) {
  if (!maps || !lastPins.length) return;
  for (const pin of lastPins) {
    if (!pin.marker) continue;
    const on = selectedPinId != null && String(pin.item?.id) === String(selectedPinId);
    pin.marker.setIcon(getCarIcon(maps, on));
    pin.marker.setZIndex(on ? 600 : 100);
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
  if (routeLine) {
    try {
      routeLine.setMap(null);
    } catch {
    }
    routeLine = null;
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
    : `Állíts be települést a <a href="/beallitasok.html">Beállítások</a>ban.`;

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
      <p class="search-map-modal__route-note"><a href="/beallitasok.html">Állítsd be a települést</a>, hogy látszódjon az út.</p>
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
  const points = [];
  if (homeOrigin) points.push(ll(homeOrigin.lat, homeOrigin.lon));
  for (const pin of lastPins) points.push(ll(pin.lat, pin.lon));
  fitLatLngs(points, 12, 40);
}

function showAllResults() {
  selectedPinId = null;
  clearRoute();
  routeRequestId += 1;
  refreshVisibleMarkers();
  if (mapMode === "filtered") fitAllPins();
  if (lastMaps?.event && mapInstance) lastMaps.event.trigger(mapInstance, "resize");
}

async function showRouteToPin(maps, pin, side) {
  selectedPinId = pin?.item?.id ?? null;
  clearRoute();
  syncPinIcons(maps);
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
    const path = (route.latLngs || []).map(([lat, lon]) => ll(lat, lon));
    routeLine = new maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#0f172a",
      strokeOpacity: 0.88,
      strokeWeight: 5,
      map: mapInstance,
    });
    fitLatLngs(path, 12, 48);
    renderSideListing(side, pin, {
      distanceKm: route.distanceKm,
      durationSec: route.durationSec,
      airKm,
      gmaps,
    });
  } catch {
    if (reqId !== routeRequestId) return;
    const path = [ll(homeOrigin.lat, homeOrigin.lon), ll(pin.lat, pin.lon)];
    routeLine = new maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#0f172a",
      strokeOpacity: 0.55,
      strokeWeight: 3,
      map: mapInstance,
    });
    fitLatLngs(path, 11, 48);
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
  if (!mapInstance || moveRefreshBound || !lastMaps) return;
  moveRefreshBound = true;
  mapInstance.addListener("idle", () => refreshVisibleMarkers());
}

function paintMap(maps, pins, side) {
  const canvas = document.getElementById("search-map-canvas");
  if (!canvas) return;

  lastMaps = maps;
  lastPins = pins;
  mapSideEl = side;
  selectedPinId = null;
  moveRefreshBound = false;

  destroyMapInstance();

  mapInstance = new maps.Map(canvas, {
    center: HU_CENTER,
    zoom: HU_ZOOM,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    clickableIcons: false,
    gestureHandling: "greedy",
  });
  bindMapViewportRefresh();

  if (mapMode === "browse" && lastPreferHomeZoom && homeOrigin) {
    mapInstance.setCenter(ll(homeOrigin.lat, homeOrigin.lon));
    mapInstance.setZoom(10);
  } else {
    const points = pins.map((p) => ll(p.lat, p.lon));
    if (homeOrigin) points.push(ll(homeOrigin.lat, homeOrigin.lon));
    if (points.length) fitLatLngs(points, 12, 40);
    else if (homeOrigin) {
      mapInstance.setCenter(ll(homeOrigin.lat, homeOrigin.lon));
      mapInstance.setZoom(10);
    } else {
      mapInstance.setCenter(HU_CENTER);
      mapInstance.setZoom(HU_ZOOM);
    }
  }

  refreshVisibleMarkers();
  requestAnimationFrame(() => {
    if (lastMaps?.event && mapInstance) lastMaps.event.trigger(mapInstance, "resize");
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

async function ensureBaseMap(maps) {
  const canvas = document.getElementById("search-map-canvas");
  if (!canvas || !maps) return null;
  lastMaps = maps;
  moveRefreshBound = false;
  destroyMapInstance();
  mapInstance = new maps.Map(canvas, {
    center: HU_CENTER,
    zoom: HU_ZOOM,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    clickableIcons: false,
    gestureHandling: "greedy",
  });
  bindMapViewportRefresh();
  requestAnimationFrame(() => {
    if (lastMaps?.event && mapInstance) lastMaps.event.trigger(mapInstance, "resize");
    requestAnimationFrame(() => {
      if (lastMaps?.event && mapInstance) lastMaps.event.trigger(mapInstance, "resize");
    });
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

let mapOpenGeneration = 0;

export async function openSearchResultsMap(
  items,
  { mode = "filtered", emptyHint = "", preferHomeZoom = false, radiusKm = MAP_BROWSE_RADIUS_KM } = {}
) {
  const gen = ++mapOpenGeneration;
  mapMode = mode === "browse" ? "browse" : "filtered";
  lastPreferHomeZoom = Boolean(preferHomeZoom);
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

  const homeZoom = preferHomeZoom || mapMode === "browse" ? 11 : 10;

  try {
    const [maps, cityIndex, postalIndex] = await Promise.all([
      loadMapsApi(),
      getCityIndex(),
      getPostalIndex().catch(() => null),
    ]);
    if (gen !== mapOpenGeneration) return { pins: 0, skipped: 0, stale: true };
    homeOrigin = await resolveHomeOrigin(cityIndex, postalIndex);
    if (gen !== mapOpenGeneration) return { pins: 0, skipped: 0, stale: true };
    setMapCitySearchValue(homeOrigin?.label || homeOrigin?.city || "");

    if (!list.length) {
      setMapStats({ empty: true, homeLabel: homeOrigin?.label || "" });
      await ensureBaseMap(maps);
      if (gen !== mapOpenGeneration) return { pins: 0, skipped: 0, stale: true };
      placeHomeMarker(maps);
      if (homeOrigin && mapInstance) {
        mapInstance.setCenter(ll(homeOrigin.lat, homeOrigin.lon));
        mapInstance.setZoom(homeZoom);
      }
      if (side) {
        const homeNote = homeOrigin
          ? `<p class="search-map-modal__route-note">Lakhely: ${escapeHtml(homeOrigin.label)} · ${Number(radiusKm) || MAP_BROWSE_RADIUS_KM} km</p>`
          : "";
        const hint =
          emptyHint ||
          (mapMode === "browse"
            ? `Nincs autó ${Number(radiusKm) || MAP_BROWSE_RADIUS_KM} km-es körzetben. Írd be a települést a térkép keresőjébe.`
            : "Nincs autó a találati listában. Állíts más szűrőt, vagy várj a lista betöltésére.");
        side.innerHTML = `<div class="search-map-modal__side-pin">${homeNote}<p class="search-map-modal__hint">${escapeHtml(hint)}</p></div>`;
      }
      return { pins: 0, skipped: 0, stale: false };
    }

    const { pins, skipped } = placeListings(list, cityIndex, postalIndex);
    if (gen !== mapOpenGeneration) return { pins: 0, skipped: 0, stale: true };
    setMapStats({
      pins: pins.length,
      skipped,
      homeLabel: homeOrigin?.label || "",
    });
    if (!pins.length) {
      await ensureBaseMap(maps);
      if (gen !== mapOpenGeneration) return { pins: 0, skipped: 0, stale: true };
      placeHomeMarker(maps);
      if (homeOrigin && mapInstance) {
        mapInstance.setCenter(ll(homeOrigin.lat, homeOrigin.lon));
        mapInstance.setZoom(homeZoom);
      }
      if (side) {
        const homeNote = homeOrigin
          ? `<p class="search-map-modal__route-note">Lakhely: ${escapeHtml(homeOrigin.label)}</p>`
          : "";
        side.innerHTML = `<div class="search-map-modal__side-pin">${homeNote}<p class="search-map-modal__hint">Nincs település a találatokhoz — a térkép üres. (${skipped} kihagyva)</p></div>`;
      }
      return { pins: 0, skipped, stale: false };
    }
    paintMap(maps, pins, side);
    if (gen !== mapOpenGeneration) return { pins: 0, skipped: 0, stale: true };
    if (preferHomeZoom && mapMode === "browse" && homeOrigin && !pins.length && mapInstance) {
      mapInstance.setCenter(ll(homeOrigin.lat, homeOrigin.lon));
      mapInstance.setZoom(homeZoom);
    }
    return { pins: pins.length, skipped, stale: false };
  } catch (error) {
    if (gen !== mapOpenGeneration) return { pins: 0, skipped: 0, stale: true };
    setMapStats({ error: error?.message || "Térkép betöltési hiba." });
    try {
      const maps = await loadMapsApi();
      await ensureBaseMap(maps);
    } catch {
      /* ignore */
    }
    if (side) {
      side.innerHTML = `<p class="search-map-modal__hint">${escapeHtml(error?.message || "Térkép betöltési hiba.")}</p>`;
    }
    return { pins: 0, skipped: 0, stale: false, error: error?.message };
  }
}

/** Aktuális találatok újrarajzolása a nyitott térképen. */
export async function refreshOpenSearchResultsMap(items, opts = {}) {
  const root = document.getElementById("search-map-modal");
  if (!root || root.hidden) return null;
  return openSearchResultsMap(items, {
    mode: opts.mode || mapMode || "filtered",
    preferHomeZoom: false,
    ...opts,
  });
}

/** Lista eredmény (szűrő VAGY „Találatok mutatása”) → ne a lakhely 10 km-e. */
function shouldUseListResults({ useListResults, hasActiveFilters, btn } = {}) {
  if (btn?.dataset?.mapMode === "filtered") return true;
  if (typeof useListResults === "function") return Boolean(useListResults());
  return typeof hasActiveFilters === "function" ? Boolean(hasActiveFilters()) : false;
}

async function openSearchMapForButton(btn, {
  getItems,
  hasActiveFilters,
  useListResults,
  ensureAllListingsLoaded,
  getVertical,
} = {}) {
  const root = document.getElementById("search-map-modal");
  if (root && !root.hidden) {
    markMapOpenOnReturn(false);
    closeSearchResultsMap();
    return;
  }
  const syncLabel = () => {
    updateSearchMapButtonLabels(
      shouldUseListResults({ useListResults, hasActiveFilters, btn })
    );
  };
  btn.disabled = true;
  try {
    syncLabel();
    const fromList = shouldUseListResults({ useListResults, hasActiveFilters, btn });
    let items;
    if (fromList) {
      btn.textContent = "Térkép betöltése…";
      if (typeof ensureAllListingsLoaded === "function") {
        try {
          await ensureAllListingsLoaded();
        } catch (error) {
          console.warn("Térkép lista betöltés:", error);
        }
      }
      items = await resolveMapItems(getItems);
      if (!items.length) {
        const vertical = typeof getVertical === "function" ? getVertical() : null;
        try {
          items = await fetchAllVerticalListings(vertical);
        } catch (error) {
          console.warn("Térkép API lista:", error);
        }
      }
      await openSearchResultsMap(items, { mode: "filtered" });
    } else {
      const vertical = typeof getVertical === "function" ? getVertical() : null;
      btn.textContent = "Térkép betöltése…";
      const [cityIndex] = await Promise.all([getCityIndex()]);
      const home = await resolveHomeOrigin(cityIndex, null);
      const radiusKm = MAP_BROWSE_RADIUS_KM;
      if (!home?.city) {
        // Nincs település: ne üres térkép — mutasd a listát / összes autót.
        items = await resolveMapItems(getItems);
        if (!items.length) {
          try {
            items = await fetchAllVerticalListings(vertical);
          } catch (error) {
            console.warn("Térkép API lista:", error);
          }
        }
        if (items.length) {
          await openSearchResultsMap(items, { mode: "filtered" });
        } else {
          await openSearchResultsMap([], {
            mode: "browse",
            emptyHint:
              "Nincs lakhely a profilban. Állíts be települést a Beállításokban, hogy a térkép a körzetedet mutassa.",
            radiusKm,
          });
        }
      } else {
        const nearby = await fetchVerticalListingsInRadius(vertical, {
          postal: home.postal || "",
          city: home.city || home.label || "",
          radiusKm,
        });
        if (nearby.error) {
          items = [];
          await openSearchResultsMap(items, {
            mode: "browse",
            emptyHint: nearby.error,
            preferHomeZoom: true,
            radiusKm,
          });
        } else {
          items = nearby.items || [];
          if (items.length) {
            await openSearchResultsMap(items, {
              mode: "browse",
              preferHomeZoom: true,
              radiusKm,
            });
          } else {
            /* Üres körzet: ne országos listát dump-oljunk browse+homeZoom-mal (láthatatlan pinek). */
            await openSearchResultsMap([], {
              mode: "browse",
              preferHomeZoom: true,
              emptyHint: `Nincs autó ${radiusKm} km-es körzetben (${home.city || home.label}). Írd be másik települést a térkép keresőjébe.`,
              radiusKm,
            });
          }
        }
      }
    }
    syncLabel();
  } finally {
    btn.disabled = false;
    syncLabel();
  }
}

let mapButtonOpts = null;

/** Lazy-load után közvetlen nyitás (ne disabled-gombos szintetikus click). */
export async function openSearchMapNow(btn) {
  const target =
    btn ||
    document.querySelector("[data-search-map-open]") ||
    null;
  if (!target || !mapButtonOpts) return;
  await openSearchMapForButton(target, mapButtonOpts);
}

export function initSearchResultsMapButtons({
  getItems,
  hasActiveFilters,
  useListResults,
  ensureAllListingsLoaded,
  getVertical,
} = {}) {
  const buttons = document.querySelectorAll("[data-search-map-open]");
  if (!buttons.length) return;

  mapButtonOpts = {
    getItems,
    hasActiveFilters,
    useListResults,
    ensureAllListingsLoaded,
    getVertical,
  };

  const syncLabel = () => {
    updateSearchMapButtonLabels(
      shouldUseListResults({ useListResults, hasActiveFilters })
    );
  };
  syncLabel();

  buttons.forEach((btn) => {
    if (btn.dataset.searchMapBound === "1") return;
    btn.dataset.searchMapBound = "1";
    btn.setAttribute("aria-controls", "search-map-modal");
    btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", async () => {
      await openSearchMapForButton(btn, mapButtonOpts);
    });
  });
}
