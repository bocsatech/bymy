import { fetchListings } from "./db-client.js?v=featured1";
import { pickFeaturedListings } from "./home-featured-slots.js?v=featured1";
import { createListingTileCard } from "./listing-tile.js?v=featured4";
import { bindListingOpen, restoreListingReturn } from "./listing-return.js?v=scrollTop1";

const RAIL = document.getElementById("hub-featured-rail");
const EMPTY = document.getElementById("hub-featured-empty");
function setVisible(hasListings) {
  if (RAIL) RAIL.hidden = !hasListings;
  if (EMPTY) EMPTY.hidden = hasListings;
}

async function init() {
  if (!RAIL) return;

  try {
    const all = await fetchListings({ limit: 80, status: "feladott", vertical: "auto" });
    const active = all.filter((item) => (item.status || "feladott") === "feladott");
    const picked = pickFeaturedListings(active);

    RAIL.innerHTML = "";
    if (!picked.length) {
      setVisible(false);
      return;
    }

    for (const item of picked) {
      RAIL.appendChild(createListingTileCard(item, { featured: true, configuredFeaturedIds: new Set(picked.map((r) => Number(r.id))) }));
    }

    bindListingOpen(RAIL);
    restoreListingReturn();
    setVisible(true);
  } catch {
    setVisible(false);
  }
}

init();
