import test from "node:test";
import assert from "node:assert/strict";
import { listingNavKey, navCountsFromListings } from "./nav-counts.mjs";

test("üres vagy auto vertical az Autó menübe megy", () => {
  assert.equal(listingNavKey({ preview: { filter: { hirdetes_vertical: "auto" } } }), "auto");
  assert.equal(listingNavKey({ preview: { filter: {} } }), "auto");
  assert.equal(listingNavKey({}), "auto");
});

test("teher és ingatlan külön menü", () => {
  assert.equal(listingNavKey({ preview: { filter: { hirdetes_vertical: "teher" } } }), "teher");
  assert.equal(listingNavKey({ form: { hirdetes_vertical: "ingatlan" } }), "ingatlan");
});

test("navCountsFromListings összesíti a feladott hirdetéseket", () => {
  assert.deepEqual(
    navCountsFromListings([
      { preview: { filter: { hirdetes_vertical: "auto" } } },
      { preview: { filter: { hirdetes_vertical: "auto" } } },
      { preview: { filter: { hirdetes_vertical: "teher" } } },
    ]),
    { auto: 2, teher: 1, ingatlan: 0 }
  );
});
