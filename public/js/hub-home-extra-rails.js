/**
 * Főoldal: Eladó lakások / házak a közelben, Ajánlások ingatlan, Kedvenc hirdetések.
 * Működés: Autók a közelben sín mintájára.
 */
import { fetchListings, fetchListing } from "./db-client.js?v=nearby2";
import { getAuthUser } from "./site-auth.js?v=nearby1";
import { getParkplatz } from "./fok-data.js?v=auth20260805localdb9";
import {
  createListingTileCard,
  formatListingCountBadge,
  slimListingTile,
} from "./listing-tile.js?v=tileAuto1";
import { restoreListingReturn, bindListingOpen } from "./listing-return.js?v=scrollTop1";
import {
  buildNearbyFilter,
  filterIngatlanListings,
  ingatlanNearbyHref,
  readNearbyPrefs,
} from "./nearby-search.js?v=immoRails1";
import { createPromptCard, initHubListingRail, sortByDate } from "./hub-listing-rail.js?v=immoRails1";

function el(id) {
  return document.getElementById(id);
}

async function loadNearbyIngatlan({ postal, radiusKm, uzletag, tipus, cacheKey }) {
  const all = await fetchListings({ limit: 50, status: "feladott", vertical: "ingatlan" });
  const pool = sortByDate(filterIngatlanListings(all, { uzletag, tipus }));
  const filter = await buildNearbyFilter({ items: pool, postal, radiusKm });
  const nearby = pool.filter((item) => filter.listingIds.has(item.id)).map(slimListingTile);
  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({
        postal,
        radiusKm,
        at: Date.now(),
        city: filter.origin?.city || "",
        items: nearby,
      })
    );
  } catch {
    /* quota */
  }
  return {
    items: nearby,
    city: filter.origin?.city || "",
    href: ingatlanNearbyHref(postal, radiusKm, { uzletag, tipus }),
  };
}

function initNearbyIngatlanRail({
  railId,
  statusId,
  countId,
  allId,
  cacheKey,
  uzletag,
  tipus,
  noun,
  nounPlural,
  defaultHref,
}) {
  return initHubListingRail({
    railEl: el(railId),
    statusEl: el(statusId),
    countEl: el(countId),
    allLinkEl: el(allId),
    cacheKey,
    defaultAllHref: defaultHref,
    noun,
    nounPlural,
    needsPostal: true,
    loadFresh: ({ postal, radiusKm }) =>
      loadNearbyIngatlan({ postal, radiusKm, uzletag, tipus, cacheKey }),
  });
}

async function initFavoritesRail({ postal, radiusKm }) {
  void postal;
  void radiusKm;
  const RAIL = el("hub-fav-rail");
  const STATUS = el("hub-fav-status");
  const COUNT_EL = el("hub-fav-count");
  const ALL = el("hub-fav-all");
  if (!RAIL) return;

  bindListingOpen(RAIL);

  function setStatus(msg, { hidden = false } = {}) {
    if (!STATUS) return;
    STATUS.textContent = msg || "";
    STATUS.hidden = hidden || !msg;
  }

  function setCount(n) {
    if (!COUNT_EL) return;
    const label = formatListingCountBadge(n);
    COUNT_EL.textContent = label;
    COUNT_EL.hidden = !label;
  }

  setStatus("Kedvencek betöltése…");
  try {
    const email = getAuthUser()?.email;
    if (!email) {
      RAIL.innerHTML = "";
      setCount(0);
      const href = `/belepes.html?next=${encodeURIComponent("/")}`;
      if (ALL) ALL.href = href;
      RAIL.appendChild(createPromptCard("Bejelentkezés", href));
      setStatus("Jelentkezz be a kedvenc hirdetéseid megtekintéséhez.");
      restoreListingReturn();
      return;
    }

    if (ALL) ALL.href = "/beallitasok.html?szekcio=parkolo";
    const saved = getParkplatz(email);
    if (!saved.length) {
      RAIL.innerHTML = "";
      setCount(0);
      RAIL.appendChild(
        createPromptCard("Még nincs kedvenced", "/beallitasok.html?szekcio=parkolo")
      );
      setStatus("A szív ikonnal menthetsz hirdetéseket a kedvencek közé.");
      restoreListingReturn();
      return;
    }

    const items = [];
    for (const row of saved.slice(0, 20)) {
      try {
        const listing = await fetchListing(row.id);
        if (listing && (listing.status || "feladott") === "feladott") {
          items.push(slimListingTile(listing));
          continue;
        }
      } catch {
        /* hiányzó */
      }
      items.push(
        slimListingTile({
          id: row.id,
          hirdetes_cime: row.title,
          preview: { title: row.title, price: row.price, imageUrl: "" },
        })
      );
    }

    RAIL.innerHTML = "";
    setCount(items.length);
    const INITIAL = 9;
    for (const item of items.slice(0, INITIAL)) {
      RAIL.appendChild(createListingTileCard(item));
    }
    if (items.length > INITIAL) {
      const more = createPromptCard("Összes megnyitása", "/beallitasok.html?szekcio=parkolo");
      more.classList.add("hf-card--prompt-all");
      RAIL.appendChild(more);
    }
    setStatus(`${items.length} kedvenc hirdetés.`, { hidden: true });
  } catch (error) {
    RAIL.innerHTML = "";
    setCount(0);
    RAIL.appendChild(createPromptCard("Újrapróbálás", "/beallitasok.html?szekcio=parkolo"));
    setStatus(error.message ?? "Nem sikerült betölteni a kedvenceket.");
  }
  restoreListingReturn();
}

async function init() {
  const profile = getAuthUser()?.profile ?? null;
  const { postal, radiusKm } = readNearbyPrefs(profile);

  const lakas = initNearbyIngatlanRail({
    railId: "hub-nearby-lakas-rail",
    statusId: "hub-nearby-lakas-status",
    countId: "hub-nearby-lakas-count",
    allId: "hub-nearby-lakas-all",
    cacheKey: "bymy-hub-nearby-lakas-v1",
    uzletag: "elado",
    tipus: "lakas",
    noun: "lakás",
    nounPlural: "lakás",
    defaultHref: "/ingatlan.html?uzletag=elado&kat=lakas",
  });

  const haz = initNearbyIngatlanRail({
    railId: "hub-nearby-haz-rail",
    statusId: "hub-nearby-haz-status",
    countId: "hub-nearby-haz-count",
    allId: "hub-nearby-haz-all",
    cacheKey: "bymy-hub-nearby-haz-v1",
    uzletag: "elado",
    tipus: "haz",
    noun: "ház",
    nounPlural: "ház",
    defaultHref: "/ingatlan.html?uzletag=elado&kat=haz",
  });

  const ajanlas = initNearbyIngatlanRail({
    railId: "hub-ajanlas-ingatlan-rail",
    statusId: "hub-ajanlas-ingatlan-status",
    countId: "hub-ajanlas-ingatlan-count",
    allId: "hub-ajanlas-ingatlan-all",
    cacheKey: "bymy-hub-ajanlas-ingatlan-v1",
    uzletag: "elado",
    tipus: "",
    noun: "ingatlan",
    nounPlural: "ingatlan",
    defaultHref: "/ingatlan.html?uzletag=elado",
  });

  await Promise.all([
    lakas?.start({ postal, radiusKm }),
    haz?.start({ postal, radiusKm }),
    ajanlas?.start({ postal, radiusKm }),
    initFavoritesRail({ postal, radiusKm }),
  ]);
}

init();

window.addEventListener("pageshow", (event) => {
  if (event.persisted) restoreListingReturn();
});
