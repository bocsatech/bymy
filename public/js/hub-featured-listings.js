import { fetchListings } from "./db-client.js?v=featured1";
import { pickFeaturedListings } from "./home-featured-slots.js?v=featuredNoAuto1";
import { createListingTileCard } from "./listing-tile.js?v=listThumb1";
import { bindListingOpen, restoreListingReturn } from "./listing-return.js?v=scrollTop1";

const SECTION = document.querySelector('[data-hf="kiemelt"]');
const RAIL = document.getElementById("hub-featured-rail");
const EMPTY = document.getElementById("hub-featured-empty");

function setSectionVisible(hasListings) {
  if (SECTION) SECTION.hidden = !hasListings;
  if (RAIL) RAIL.hidden = !hasListings;
  if (EMPTY) EMPTY.hidden = true;
}

async function init() {
  if (!RAIL || !SECTION) return;
  setSectionVisible(false);

  try {
    const all = await fetchListings({ limit: 80, status: "feladott", vertical: "auto" });
    const active = all.filter((item) => (item.status || "feladott") === "feladott");
    const picked = pickFeaturedListings(active);

    RAIL.innerHTML = "";
    if (!picked.length) {
      setSectionVisible(false);
      return;
    }

    picked.forEach((item, index) => {
      RAIL.appendChild(
        createListingTileCard(item, {
          featured: true,
          configuredFeaturedIds: new Set(picked.map((r) => Number(r.id))),
          eager: index < 4,
        })
      );
    });

    bindListingOpen(RAIL);
    restoreListingReturn();
    setSectionVisible(true);
  } catch {
    setSectionVisible(false);
  }
}

init();
