import test from "node:test";
import assert from "node:assert/strict";
import {
  filterIngatlanListings,
  ingatlanNearbyHref,
} from "../public/js/nearby-search.js";

const lakas = {
  id: 1,
  status: "feladott",
  preview: {
    filter: {
      hirdetes_vertical: "ingatlan",
      ingatlan_uzletag: "elado",
      ingatlan_lakas_tipus: "lakas",
    },
  },
};

const haz = {
  id: 2,
  status: "feladott",
  preview: {
    filter: {
      hirdetes_vertical: "ingatlan",
      ingatlan_uzletag: "elado",
      ingatlan_lakas_tipus: "haz",
    },
  },
};

const kiado = {
  id: 3,
  status: "feladott",
  preview: {
    filter: {
      hirdetes_vertical: "ingatlan",
      ingatlan_uzletag: "kiado",
      ingatlan_lakas_tipus: "lakas",
    },
  },
};

const auto = {
  id: 4,
  status: "feladott",
  preview: { filter: { hirdetes_vertical: "auto" } },
};

test("filterIngatlanListings: eladó lakás", () => {
  const out = filterIngatlanListings([lakas, haz, kiado, auto], {
    uzletag: "elado",
    tipus: "lakas",
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 1);
});

test("filterIngatlanListings: eladó ház", () => {
  const out = filterIngatlanListings([lakas, haz, kiado], {
    uzletag: "elado",
    tipus: "haz",
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 2);
});

test("filterIngatlanListings: összes eladó (ajánlás)", () => {
  const out = filterIngatlanListings([lakas, haz, kiado, auto], {
    uzletag: "elado",
  });
  assert.equal(out.length, 2);
});

test("ingatlanNearbyHref: uzletag + kat", () => {
  const href = ingatlanNearbyHref("1052", 30, { uzletag: "elado", tipus: "lakas" });
  assert.ok(href.includes("nearby=1"));
  assert.ok(href.includes("uzletag=elado"));
  assert.ok(href.includes("kat=lakas"));
  assert.ok(href.startsWith("/ingatlan.html?"));
});
