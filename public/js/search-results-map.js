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
} from "./listing-radius.js?v=9eab9e5218";
import {
  listingDetailHref,
  rememberListingOpen,
  markMapOpenOnReturn,
} from "./listing-return.js?v=1911f0cb28";
import { listingTileTitle, listingTilePrice } from "./listing-tile.js?v=0633cb6729";
import { getAuthUser, loadProfileFromServer } from "./site-auth.js?v=b7e73b74b0";
import { fetchListingsPage } from "./db-client.js?v=855f1f7e76";
import {
  buildNearbyFilter,
  readNearbyPrefs,
  STORAGE_CITY,
} from "./nearby-search.js?v=0efee20d13";

const HU_CENTER = [47.1625, 19.5033];
const HU_ZOOM = 7;
const CLUSTER_ZOOM = 11;
/** Megnyitáskor település-csoportok látszódjanak (zoom < CLUSTER_ZOOM). */
const BROWSE_OPEN_ZOOM = 9;
const JITTER_DEG = 0.0035;
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const LABEL_BROWSE = "Autók a Közelben";
const LABEL_FILTERED = "Találatok a térképen";
/** Böngésző térkép: lakhely körüli sugar (km), csoportosítva. */
const MAP_BROWSE_RADIUS_KM = 10;
const MAP_BROWSE_MAX_PAGES = 25;

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
let lastPreferHomeZoom = false;
let mapSideEl = null;
let moveRefreshBound = false;
/** Aktív böngésző középpont (lakhely vagy keresett település). */
let browseFocus = null;
let lastBrowseVertical = null;
/** Országos település-összesítők (darabszám) — hirdetés nélkül. */
let browseCityGroups = [];
/** Kiválasztott település — csak ekkor töltünk tile-hirdetéseket. */
let selectedBrowseCity = null;

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

function mapPanelMarkup() {
  return `
    <div class="search-map-modal__panel" role="region" aria-label="Találatok a térképen">
      <div class="search-map-modal__toolbar">
        <label class="search-map-city">
          <span class="search-map-city__label">Település</span>
          <input
            type="search"
            class="search-map-city__input"
            data-search-map-city
            placeholder="Más település keresése…"
            autocomplete="off"
            enterkeyhint="search"
          />
          <ul class="search-map-city__suggest" data-search-map-city-suggest hidden></ul>
        </label>
        <button type="button" class="search-map-city__go" data-search-map-city-go>Keresés</button>
      </div>
      <div class="search-map-modal__body">
        <div id="search-map-canvas" class="search-map-modal__canvas" aria-label="Térkép"></div>
        <aside class="search-map-modal__side" data-search-map-side>
          <p class="search-map-modal__hint">Településenként csoportosítva — kattints egy településre.</p>
        </aside>
      </div>
    </div>
  `;
}

function bindMapPanelNav(root) {
  if (root.dataset.mapNavBound === "1") return;
  root.dataset.mapNavBound = "1";
  root.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-search-map-back]")) {
      showAllResults();
      return;
    }
    const cityPick = event.target?.closest?.("[data-search-map-city-pick]");
    if (cityPick) {
      const city = String(cityPick.getAttribute("data-city") || "").trim();
      const lat = Number(cityPick.getAttribute("data-lat"));
      const lon = Number(cityPick.getAttribute("data-lon"));
      if (city) {
        void selectBrowseCity(city, {
          lat: Number.isFinite(lat) ? lat : null,
          lon: Number.isFinite(lon) ? lon : null,
        });
      }
      return;
    }
    if (event.target?.closest?.("[data-search-map-cities-back]")) {
      void openBrowseMapOverview({ vertical: lastBrowseVertical });
      return;
    }
    const pick = event.target?.closest?.("[data-search-map-pick]");
    if (pick) {
      const id = String(pick.getAttribute("data-search-map-pick") || "");
      const pin = lastPins.find((p) => String(p.item?.id) === id);
      if (pin && lastLeaflet) showRouteToPin(lastLeaflet, pin, root.querySelector("[data-search-map-side]"));
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
          import("./listing-prefetch.js?v=67ac871172")
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
}

function suggestCities(query, cityIndex, limit = 8) {
  const q = normalizePlace(query);
  if (!q || !cityIndex?.size) return [];
  const starts = [];
  const includes = [];
  for (const [key, row] of cityIndex) {
    if (key.startsWith(q)) starts.push(row.city);
    else if (key.includes(q)) includes.push(row.city);
    if (starts.length >= limit) break;
  }
  return [...starts, ...includes].slice(0, limit);
}

function renderCitySuggest(root, names) {
  const box = root.querySelector("[data-search-map-city-suggest]");
  if (!box) return;
  if (!names.length) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  box.innerHTML = names
    .map(
      (name) =>
        `<li><button type="button" data-search-map-city-choice="${escapeHtml(name)}">${escapeHtml(name)}</button></li>`
    )
    .join("");
}

function bindCitySearch(root) {
  if (!root || root.dataset.mapCityBound === "1") return;
  root.dataset.mapCityBound = "1";
  const input = root.querySelector("[data-search-map-city]");
  const go = root.querySelector("[data-search-map-city-go]");
  const suggest = root.querySelector("[data-search-map-city-suggest]");
  if (!input || !go) return;

  let suggestTimer = 0;
  input.addEventListener("input", () => {
    window.clearTimeout(suggestTimer);
    suggestTimer = window.setTimeout(async () => {
      const q = String(input.value || "").trim();
      if (q.length < 2) {
        renderCitySuggest(root, []);
        return;
      }
      try {
        const cityIndex = await getCityIndex();
        renderCitySuggest(root, suggestCities(q, cityIndex));
      } catch {
        renderCitySuggest(root, []);
      }
    }, 160);
  });

  suggest?.addEventListener("click", (event) => {
    const btn = event.target?.closest?.("[data-search-map-city-choice]");
    if (!btn) return;
    input.value = btn.getAttribute("data-search-map-city-choice") || "";
    renderCitySuggest(root, []);
    void runCitySearchFromInput(root);
  });

  const submit = () => {
    renderCitySuggest(root, []);
    void runCitySearchFromInput(root);
  };
  go.addEventListener("click", submit);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  });
}

async function runCitySearchFromInput(root) {
  const input = root.querySelector("[data-search-map-city]");
  const go = root.querySelector("[data-search-map-city-go]");
  const city = String(input?.value || "").trim();
  if (!city) return;
  if (go) {
    go.disabled = true;
    go.textContent = "…";
  }
  try {
    await openBrowseMapAroundCity(city, {
      vertical: lastBrowseVertical,
      getVertical: mapButtonOpts?.getVertical,
    });
  } finally {
    if (go) {
      go.disabled = false;
      go.textContent = "Keresés";
    }
  }
}

function syncCitySearchValue(root) {
  const input = root?.querySelector?.("[data-search-map-city]");
  if (!input) return;
  const label = browseFocus?.city || browseFocus?.label || homeOrigin?.city || homeOrigin?.label || "";
  if (label && !String(input.value || "").trim()) input.value = label;
  else if (label && document.activeElement !== input) input.placeholder = `Most: ${label}`;
}

function ensureMapPanel() {
  let root = document.getElementById("search-map-modal");
  const markup = mapPanelMarkup();
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
    bindMapPanelNav(root);
    bindCitySearch(root);
    return root;
  }

  /* Upgrade older modal / header shell. */
  root.classList.add("search-map-inline");
  root.classList.remove("search-map-modal");
  if (
    root.querySelector(".search-map-modal__head") ||
    root.querySelector(".search-map-modal__backdrop") ||
    !root.querySelector("[data-search-map-side]") ||
    !root.querySelector("[data-search-map-city]") ||
    root.querySelector(".search-map-modal__canvas-wrap")
  ) {
    const wasHidden = root.hidden;
    root.innerHTML = markup;
    root.hidden = wasHidden;
    delete root.dataset.mapCityBound;
    delete root.dataset.mapNavBound;
  }
  if (host && grid && root.parentElement !== host) {
    host.insertBefore(root, grid);
  } else if (host && grid && root.nextElementSibling !== grid) {
    host.insertBefore(root, grid);
  }
  bindMapPanelNav(root);
  bindCitySearch(root);
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

function getCityClusterIcon(L, city, count) {
  const raw = String(city || "—").trim() || "—";
  const short = raw.length > 14 ? `${raw.slice(0, 12)}…` : raw;
  const label = escapeHtml(short);
  const n = Number(count) || 0;
  return L.divIcon({
    className: "search-map-city-cluster",
    html: `<span class="search-map-city-cluster__dot" aria-hidden="true"><strong>${label}</strong><em>${n}</em></span>`,
    iconSize: [64, 36],
    iconAnchor: [32, 18],
  });
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
  if (!mapInstance || !markersLayer || !lastLeaflet) return;
  const L = lastLeaflet;
  const side = mapSideEl || document.querySelector("[data-search-map-side]");
  markersLayer.clearLayers();
  for (const pin of lastPins) pin.marker = null;

  placeHomeMarker(L);

  const bounds = mapInstance.getBounds().pad(0.05);

  /* Országos áttekintés: csak település-összesítők (nincs hirdetéspin). */
  if (mapMode === "browse" && !selectedBrowseCity) {
    const groups = (browseCityGroups || []).filter((g) => bounds.contains([g.lat, g.lon]));
    for (const group of groups) {
      const marker = L.marker([group.lat, group.lon], {
        title: `${group.city} · ${group.count} autó`,
        icon: getCityClusterIcon(L, group.city, group.count),
        zIndexOffset: 200,
      });
      marker.bindTooltip(`${group.city} · ${group.count} autó`, {
        direction: "top",
        offset: [0, -8],
      });
      marker.on("click", () => {
        void selectBrowseCity(group.city, { lat: group.lat, lon: group.lon });
      });
      marker.addTo(markersLayer);
    }
    if (side && selectedPinId == null) {
      renderBrowseCitiesSide(side, groups.length ? groups : browseCityGroups);
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
    const tip = pin.city ? `${title} · ${pin.city}` : title;
    marker.bindTooltip(tip, { direction: "top", offset: [0, -10] });
    marker.on("click", () => {
      showRouteToPin(L, pin, side);
    });
    marker.addTo(markersLayer);
  }
  if (side && selectedPinId == null && mapMode === "browse" && selectedBrowseCity) {
    renderBrowseCityListingsSide(side, lastPins);
  } else if (side && selectedPinId == null && mapMode === "filtered") {
    renderSideAll(side, lastPins);
  }
}

function renderBrowseCityListingsSide(side, pins) {
  if (!side) return;
  const cards = (pins || [])
    .map((pin) => pickCardHtml(pin, { selected: false, asLink: true }))
    .join("");
  side.innerHTML = `<div class="search-map-modal__side-pin">
    <button type="button" class="search-map-modal__cities-back" data-search-map-cities-back>← Települések</button>
    <p class="search-map-modal__route-note">${escapeHtml(selectedBrowseCity || "")} · ${pins?.length || 0} autó</p>
    <p class="search-map-modal__hint">Csak a fő adatok — kattints a kártyára a részletekhez.</p>
  </div>
  <div class="search-map-modal__side-scroll">${cards || `<p class="search-map-modal__hint">Nincs hirdetés ezen a településen.</p>`}</div>`;
}

function renderBrowseCitiesSide(side, groups) {
  if (!side) return;
  const list = (groups || [])
    .slice()
    .sort((a, b) => (b.count || 0) - (a.count || 0) || String(a.city).localeCompare(String(b.city), "hu"))
    .map(
      (g) =>
        `<button type="button" class="search-map-modal__city-row" data-search-map-city-pick data-city="${escapeHtml(g.city)}" data-lat="${g.lat}" data-lon="${g.lon}">
          <strong>${escapeHtml(g.city)}</strong>
          <em>${Number(g.count) || 0}</em>
        </button>`
    )
    .join("");
  const total = (browseCityGroups || []).reduce((n, g) => n + (Number(g.count) || 0), 0);
  side.innerHTML = `<div class="search-map-modal__side-pin">
    <p class="search-map-modal__route-note">${browseCityGroups.length} település · ${total} autó</p>
    <p class="search-map-modal__hint">Kattints egy összesítőre a térképen vagy a listában — csak akkor töltjük be az adott település hirdetéseit.</p>
    ${list ? `<div class="search-map-modal__city-list">${list}</div>` : `<p class="search-map-modal__hint">Nincs megjeleníthető település.</p>`}
  </div>`;
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
  if (mapMode === "browse" && selectedBrowseCity) {
    refreshVisibleMarkers();
    requestAnimationFrame(() => mapInstance?.invalidateSize());
    return;
  }
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

  const focus = browseFocus || homeOrigin;
  if (mapMode === "browse" && lastPreferHomeZoom && focus) {
    mapInstance.setView([focus.lat, focus.lon], BROWSE_OPEN_ZOOM);
  } else {
    const bounds = pins.map((p) => [p.lat, p.lon]);
    if (focus && mapMode === "browse") bounds.push([focus.lat, focus.lon]);
    else if (homeOrigin && mapMode === "filtered") bounds.push([homeOrigin.lat, homeOrigin.lon]);
    if (bounds.length === 1) mapInstance.setView(bounds[0], mapMode === "browse" ? BROWSE_OPEN_ZOOM : 11);
    else if (bounds.length > 1) {
      mapInstance.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: mapMode === "browse" ? BROWSE_OPEN_ZOOM : 12,
      });
    } else if (focus) mapInstance.setView([focus.lat, focus.lon], BROWSE_OPEN_ZOOM);
    else mapInstance.setView(HU_CENTER, HU_ZOOM);
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
  selectedBrowseCity = null;
  browseCityGroups = [];
  lastPins = [];
  mapSideEl = null;
}

let mapOpenGeneration = 0;

export async function openSearchResultsMap(
  items,
  {
    mode = "filtered",
    emptyHint = "",
    preferHomeZoom = false,
    radiusKm = MAP_BROWSE_RADIUS_KM,
    focusCity = null,
  } = {}
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

  const homeZoom = preferHomeZoom || mapMode === "browse" ? BROWSE_OPEN_ZOOM : 10;

  try {
    const [L, cityIndex, postalIndex] = await Promise.all([
      loadLeaflet(),
      getCityIndex(),
      getPostalIndex().catch(() => null),
    ]);
    if (gen !== mapOpenGeneration) return { pins: 0, skipped: 0, stale: true };
    homeOrigin = await resolveHomeOrigin(cityIndex, postalIndex);
    if (gen !== mapOpenGeneration) return { pins: 0, skipped: 0, stale: true };

    if (focusCity && typeof focusCity === "object" && focusCity.lat != null) {
      browseFocus = {
        lat: Number(focusCity.lat),
        lon: Number(focusCity.lon),
        label: focusCity.label || focusCity.city || "",
        city: focusCity.city || focusCity.label || "",
        postal: focusCity.postal || "",
      };
    } else if (mapMode === "browse") {
      browseFocus = homeOrigin;
    } else {
      browseFocus = null;
    }
    syncCitySearchValue(root);

    if (!list.length) {
      setMapStats({ empty: true, homeLabel: homeOrigin?.label || "" });
      await ensureBaseMap(L);
      if (gen !== mapOpenGeneration) return { pins: 0, skipped: 0, stale: true };
      placeHomeMarker(L);
      const focus = browseFocus || homeOrigin;
      if (focus) mapInstance?.setView([focus.lat, focus.lon], homeZoom);
      if (side) {
        const homeNote = focus
          ? `<p class="search-map-modal__route-note">Középpont: ${escapeHtml(focus.label || focus.city)} · ${Number(radiusKm) || MAP_BROWSE_RADIUS_KM} km</p>`
          : "";
        const hint =
          emptyHint ||
          (mapMode === "browse"
            ? `Nincs autó ${Number(radiusKm) || MAP_BROWSE_RADIUS_KM} km-es körzetben. Keress másik települést fent, vagy állíts be lakhelyet a Beállításokban.`
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
      await ensureBaseMap(L);
      if (gen !== mapOpenGeneration) return { pins: 0, skipped: 0, stale: true };
      placeHomeMarker(L);
      const focus = browseFocus || homeOrigin;
      if (focus) mapInstance?.setView([focus.lat, focus.lon], homeZoom);
      if (side) {
        const homeNote = focus
          ? `<p class="search-map-modal__route-note">Középpont: ${escapeHtml(focus.label || focus.city)}</p>`
          : "";
        side.innerHTML = `<div class="search-map-modal__side-pin">${homeNote}<p class="search-map-modal__hint">Nincs település a találatokhoz — a térkép üres. (${skipped} kihagyva)</p></div>`;
      }
      return { pins: 0, skipped, stale: false };
    }
    paintMap(L, pins, side);
    if (gen !== mapOpenGeneration) return { pins: 0, skipped: 0, stale: true };
    return { pins: pins.length, skipped, stale: false };
  } catch (error) {
    if (gen !== mapOpenGeneration) return { pins: 0, skipped: 0, stale: true };
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

async function fetchMapCityCounts(vertical) {
  const params = new URLSearchParams();
  if (vertical) params.set("vertical", String(vertical));
  const res = await fetch(`/api/listings/map-cities?${params}`, { credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Település-összesítő hiba.");
  return Array.isArray(data.cities) ? data.cities : [];
}

async function fetchMapCityListings(city, vertical) {
  const params = new URLSearchParams({ city: String(city || "").trim() });
  if (vertical) params.set("vertical", String(vertical));
  params.set("limit", "80");
  const res = await fetch(`/api/listings/map-city?${params}`, { credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Település-hirdetések hiba.");
  return Array.isArray(data.listings) ? data.listings : [];
}

/** Országos áttekintés: csak település + darabszám, hirdetés nélkül. */
export async function openBrowseMapOverview({ vertical = null, getVertical = null } = {}) {
  const vert =
    vertical != null
      ? vertical
      : typeof getVertical === "function"
        ? getVertical()
        : lastBrowseVertical;
  lastBrowseVertical = vert || null;
  selectedBrowseCity = null;
  lastPins = [];
  selectedPinId = null;
  browseCityGroups = [];
  mapMode = "browse";
  lastPreferHomeZoom = false;

  const root = ensureMapPanel();
  const side = root.querySelector("[data-search-map-side]");
  mapSideEl = side;
  root.hidden = false;
  document.body.classList.add("search-map-open");
  document.querySelectorAll("[data-search-map-open]").forEach((btn) => {
    btn.setAttribute("aria-expanded", "true");
  });
  if (side) side.innerHTML = `<p class="search-map-modal__hint">Települések betöltése…</p>`;
  setMapStats({ empty: true });
  try {
    root.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch {
  }

  try {
    const [L, cityIndex, postalIndex, cities] = await Promise.all([
      loadLeaflet(),
      getCityIndex(),
      getPostalIndex().catch(() => null),
      fetchMapCityCounts(vert),
    ]);
    homeOrigin = await resolveHomeOrigin(cityIndex, postalIndex).catch(() => null);
    syncCitySearchValue(root);

    const groups = [];
    let skipped = 0;
    for (const row of cities) {
      const hit = resolveCityCoords(row.city, cityIndex);
      if (!hit) {
        skipped += 1;
        continue;
      }
      groups.push({
        city: hit.city || row.city,
        count: Number(row.count) || 0,
        lat: hit.lat,
        lon: hit.lon,
      });
    }
    browseCityGroups = groups;
    const total = groups.reduce((n, g) => n + g.count, 0);
    setMapStats({
      pins: total,
      skipped,
      homeLabel: homeOrigin?.label || "",
    });

    await ensureBaseMap(L);
    placeHomeMarker(L);
    if (groups.length) {
      const bounds = groups.map((g) => [g.lat, g.lon]);
      if (homeOrigin) bounds.push([homeOrigin.lat, homeOrigin.lon]);
      if (bounds.length === 1) mapInstance.setView(bounds[0], BROWSE_OPEN_ZOOM);
      else mapInstance.fitBounds(bounds, { padding: [36, 36], maxZoom: BROWSE_OPEN_ZOOM });
    } else if (homeOrigin) {
      mapInstance.setView([homeOrigin.lat, homeOrigin.lon], BROWSE_OPEN_ZOOM);
    } else {
      mapInstance.setView(HU_CENTER, HU_ZOOM);
    }
    refreshVisibleMarkers();
    requestAnimationFrame(() => {
      mapInstance?.invalidateSize();
      refreshVisibleMarkers();
    });
    return { pins: total, skipped, cities: groups.length };
  } catch (error) {
    setMapStats({ error: error?.message || "Térkép betöltési hiba." });
    if (side) {
      side.innerHTML = `<p class="search-map-modal__hint">${escapeHtml(error?.message || "Térkép betöltési hiba.")}</p>`;
    }
    return { pins: 0, skipped: 0, error: error?.message };
  }
}

/** Település kiválasztása → csak ekkor töltünk tile-hirdetéseket. */
export async function selectBrowseCity(cityName, { lat = null, lon = null } = {}) {
  const city = String(cityName || "").trim();
  if (!city) return { pins: 0, skipped: 0 };
  const root = ensureMapPanel();
  const side = root.querySelector("[data-search-map-side]");
  mapSideEl = side;
  if (side) {
    side.innerHTML = `<p class="search-map-modal__hint">${escapeHtml(city)} hirdetéseinek betöltése…</p>`;
  }
  selectedBrowseCity = city;
  selectedPinId = null;
  clearRoute();
  mapMode = "browse";
  try {
    localStorage.setItem(STORAGE_CITY, city);
  } catch {
  }

  try {
    const [L, cityIndex, postalIndex, items] = await Promise.all([
      loadLeaflet(),
      getCityIndex(),
      getPostalIndex().catch(() => null),
      fetchMapCityListings(city, lastBrowseVertical),
    ]);
    if (!homeOrigin) {
      homeOrigin = await resolveHomeOrigin(cityIndex, postalIndex).catch(() => null);
    }
    const hit = resolveCityCoords(city, cityIndex);
    browseFocus = hit
      ? { lat: hit.lat, lon: hit.lon, city: hit.city, label: hit.city, postal: "" }
      : lat != null && lon != null
        ? { lat, lon, city, label: city, postal: "" }
        : browseFocus;

    const input = root.querySelector("[data-search-map-city]");
    if (input) input.value = hit?.city || city;

    if (!items.length) {
      lastPins = [];
      setMapStats({ empty: true, homeLabel: homeOrigin?.label || "" });
      if (!mapInstance) await ensureBaseMap(L);
      markersLayer?.clearLayers();
      placeHomeMarker(L);
      if (browseFocus) mapInstance?.setView([browseFocus.lat, browseFocus.lon], CLUSTER_ZOOM);
      if (side) {
        side.innerHTML = `<div class="search-map-modal__side-pin">
          <button type="button" class="search-map-modal__cities-back" data-search-map-cities-back>← Települések</button>
          <p class="search-map-modal__hint">Nincs autó ${escapeHtml(city)} településen.</p>
        </div>`;
      }
      return { pins: 0, skipped: 0 };
    }

    const { pins, skipped } = placeListings(items, cityIndex, postalIndex);
    lastPins = pins;
    lastLeaflet = L;
    setMapStats({ pins: pins.length, skipped, homeLabel: homeOrigin?.label || "" });
    if (!mapInstance) await ensureBaseMap(L);
    markersLayer?.clearLayers();
    placeHomeMarker(L);
    if (browseFocus) mapInstance?.setView([browseFocus.lat, browseFocus.lon], CLUSTER_ZOOM);
    else if (pins.length) {
      const bounds = pins.map((p) => [p.lat, p.lon]);
      mapInstance?.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
    refreshVisibleMarkers();
    requestAnimationFrame(() => {
      mapInstance?.invalidateSize();
      refreshVisibleMarkers();
    });
    return { pins: pins.length, skipped };
  } catch (error) {
    if (side) {
      side.innerHTML = `<div class="search-map-modal__side-pin">
        <button type="button" class="search-map-modal__cities-back" data-search-map-cities-back>← Települések</button>
        <p class="search-map-modal__hint">${escapeHtml(error?.message || "Betöltési hiba.")}</p>
      </div>`;
    }
    return { pins: 0, skipped: 0, error: error?.message };
  }
}

/** Településkereső: kiválasztja a helységet és betölti a tile-hirdetéseket. */
export async function openBrowseMapAroundCity(cityName, { vertical = null, getVertical = null } = {}) {
  const city = String(cityName || "").trim();
  if (!city) return { pins: 0, skipped: 0 };
  const vert =
    vertical != null
      ? vertical
      : typeof getVertical === "function"
        ? getVertical()
        : lastBrowseVertical;
  lastBrowseVertical = vert || null;
  if (!browseCityGroups.length) {
    await openBrowseMapOverview({ vertical: vert });
  }
  return selectBrowseCity(city);
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
    if (fromList) {
      btn.textContent = "Térkép betöltése…";
      if (typeof ensureAllListingsLoaded === "function") {
        try {
          await ensureAllListingsLoaded();
        } catch (error) {
          console.warn("Térkép lista betöltés:", error);
        }
      }
      let items = await resolveMapItems(getItems);
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
      lastBrowseVertical = vertical || null;
      btn.textContent = "Térkép betöltése…";
      await openBrowseMapOverview({ vertical, getVertical });
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
