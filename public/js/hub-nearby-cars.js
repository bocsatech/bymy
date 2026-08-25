import { fetchListings } from "./db-client.js?v=nearby1";
import { getAuthUser } from "./site-auth.js?v=nearby1";
import { listingDetailHref } from "./listing-return.js?v=nearby1";
import { formatListingDisplayTitle } from "./listing-card.js";
import {
  autoNearbyHref,
  buildNearbyFilter,
  filterAutoListings,
  readNearbyPrefs,
} from "./nearby-search.js?v=nearby1";

const RAIL = document.getElementById("hub-nearby-rail");
const STATUS = document.getElementById("hub-nearby-status");
const ALL_LINK = document.getElementById("hub-nearby-all");

function sortByDate(items) {
  return [...items].sort((a, b) => {
    const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });
}

function cardTitle(item) {
  const preview = item.preview ?? {};
  const raw = preview.title || item.hirdetes_cime || `Hirdetés #${item.id}`;
  return formatListingDisplayTitle(raw) || `Hirdetés #${item.id}`;
}

function createListingCard(item) {
  const preview = item.preview ?? {};
  const link = document.createElement("a");
  link.className = "hf-card hf-card--listing";
  link.href = listingDetailHref(item.id);
  link.setAttribute("role", "listitem");

  const imageUrl = String(preview.imageUrl || item.fo_kep || "").trim();
  const media = document.createElement("span");
  media.className = "hf-card-media";
  if (imageUrl) {
    // Mindkét tengely 145% — a sima "140%" magassága auto maradna, és fehér sávot hagyna a négyzetben.
    media.style.backgroundImage = `url(${JSON.stringify(imageUrl)})`;
    media.style.backgroundSize = "145% 145%";
    media.style.backgroundPosition = "center center";
    media.style.backgroundRepeat = "no-repeat";
    media.setAttribute("role", "img");
    media.setAttribute("aria-label", cardTitle(item));
  }

  const label = document.createElement("span");
  label.className = "hf-card-label";
  label.textContent = cardTitle(item);

  const sub = document.createElement("span");
  sub.className = "hf-card-sub";
  sub.textContent = preview.price || "—";

  link.append(media, label, sub);
  return link;
}

function createPromptCard(label, href) {
  const link = document.createElement("a");
  link.className = "hf-card hf-card--listing hf-card--prompt";
  link.href = href;
  link.setAttribute("role", "listitem");
  link.innerHTML = `
    <span class="hf-card-media" aria-hidden="true"></span>
    <span class="hf-card-label">${label}</span>`;
  return link;
}

function setStatus(message, { hidden = false } = {}) {
  if (!STATUS) return;
  STATUS.textContent = message || "";
  STATUS.hidden = hidden || !message;
}

function renderRail(items) {
  if (!RAIL) return;
  RAIL.innerHTML = "";
  for (const item of items.slice(0, 12)) {
    RAIL.appendChild(createListingCard(item));
  }
}

async function initHubNearbyCars() {
  if (!RAIL) return;

  const profile = getAuthUser()?.profile ?? null;
  const { postal, radiusKm } = readNearbyPrefs(profile);

  if (ALL_LINK && postal.length === 4) {
    ALL_LINK.href = autoNearbyHref(postal, radiusKm);
  }

  if (postal.length !== 4) {
    renderRail([]);
    RAIL.appendChild(
      createPromptCard("Keresési körzet beállítása", "/beallitasok.html?szekcio=keresesi-korzet")
    );
    setStatus("Add meg az irányítószámot a Beállításokban a közeli autók megjelenítéséhez.");
    return;
  }

  setStatus("Közeli autók betöltése…");

  try {
    const all = await fetchListings({ limit: 500 });
    const autos = sortByDate(filterAutoListings(all));
    const filter = await buildNearbyFilter({ items: autos, postal, radiusKm });
    const nearby = autos.filter((item) => filter.listingIds.has(item.id));

    if (ALL_LINK) ALL_LINK.href = autoNearbyHref(postal, radiusKm);

    if (!nearby.length) {
      renderRail([]);
      RAIL.appendChild(createPromptCard("Nincs autó a körzetben", autoNearbyHref(postal, radiusKm)));
      setStatus(`Nincs autó ${filter.origin.city} ${radiusKm} km-es körzetében.`);
      return;
    }

    renderRail(nearby);
    setStatus(`${nearby.length} autó ${filter.origin.city} ${radiusKm} km-en belül.`, { hidden: true });
  } catch (error) {
    renderRail([]);
    RAIL.appendChild(createPromptCard("Újrapróbálás", "/beallitasok.html?szekcio=keresesi-korzet"));
    setStatus(error.message ?? "Nem sikerült betölteni a közeli autókat.");
  }
}

initHubNearbyCars();
