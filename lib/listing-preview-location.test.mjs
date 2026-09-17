import test from "node:test";
import assert from "node:assert/strict";
import {
  enrichListingItemLocationFromProfile,
  enrichPreviewLocationFromProfile,
  previewNeedsLocationEnrichment,
} from "./listing-preview-location.mjs";

test("previewNeedsLocationEnrichment: üres település", () => {
  assert.equal(previewNeedsLocationEnrichment({ filter: { telepules: "" }, location: "" }), true);
  assert.equal(
    previewNeedsLocationEnrichment({ filter: { telepules: "Győr" }, location: "Győr" }),
    false
  );
});

test("enrichPreviewLocationFromProfile: magán profil város + irányítószám", () => {
  const preview = enrichPreviewLocationFromProfile(
    { filter: { telepules: "", iranyitoszam: "" }, location: "" },
    { accountType: "private", postalCode: "9021", city: "Győr" }
  );
  assert.equal(preview.filter.telepules, "Győr");
  assert.equal(preview.filter.iranyitoszam, "9021");
  assert.equal(preview.filter.megye, "Győr-Moson-Sopron");
  assert.equal(preview.location, "Győr, Győr-Moson-Sopron");
});

test("enrichPreviewLocationFromProfile: csak irányítószám → település lookup", () => {
  const preview = enrichPreviewLocationFromProfile(
    { filter: { telepules: "" }, location: "" },
    { accountType: "private", postalCode: "2040", city: "" }
  );
  assert.equal(preview.filter.telepules, "Budaörs");
  assert.equal(preview.filter.iranyitoszam, "2040");
});

test("enrichListingItemLocationFromProfile: meglévő település érintetlen", () => {
  const item = enrichListingItemLocationFromProfile(
    { id: 1, user_id: 2, preview: { filter: { telepules: "Szeged" }, location: "Szeged" } },
    { postalCode: "1117", city: "Budapest" }
  );
  assert.equal(item.preview.filter.telepules, "Szeged");
});
