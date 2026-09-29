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
    previewNeedsLocationEnrichment({ filter: { telepules: "" }, location: "Debrecen" }),
    true
  );
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

test("enrichListingItemLocationFromProfile: profil város felülírja a listát", () => {
  const item = enrichListingItemLocationFromProfile(
    { id: 1, user_id: 2, preview: { filter: { telepules: "Szeged" }, location: "Szeged" } },
    { postalCode: "1117", city: "Budapest" }
  );
  assert.equal(item.preview.filter.telepules, "Budapest");
});

test("enrichListingItemLocationFromProfile: form.telepules is szinkron", () => {
  const item = enrichListingItemLocationFromProfile(
    {
      id: 1,
      user_id: 2,
      form: { telepules: "Fejér", iranyitoszam: "8000" },
      preview: {
        filter: { telepules: "Székesfehérvár", iranyitoszam: "8000", megye: "Fejér" },
        location: "Székesfehérvár, Fejér",
      },
    },
    { accountType: "private", postalCode: "6000", city: "Kecskemét" }
  );
  assert.equal(item.preview.filter.telepules, "Kecskemét");
  assert.equal(item.form.telepules, "Kecskemét");
  assert.equal(item.form.iranyitoszam, "6000");
});

test("enrichPreviewLocationFromProfile: 8000 Fehérvár → profil Kecskemét", () => {
  const preview = enrichPreviewLocationFromProfile(
    {
      filter: { telepules: "Székesfehérvár", iranyitoszam: "8000", megye: "Fejér" },
      location: "Székesfehérvár, Fejér",
    },
    { accountType: "private", postalCode: "6000", city: "Kecskemét" }
  );
  assert.equal(preview.filter.telepules, "Kecskemét");
  assert.equal(preview.filter.iranyitoszam, "6000");
  assert.equal(preview.filter.megye, "Bács-Kiskun");
  assert.match(preview.location, /Kecskemét/);
});

test("enrichListingsWithOwnerProfileLocation: feed owner_user_id (user_id nélkül)", async () => {
  const { enrichListingsWithOwnerProfileLocation } = await import("./listing-preview-location.mjs");
  const items = await enrichListingsWithOwnerProfileLocation(
    [
      {
        id: 9,
        form: { owner_user_id: "42" },
        preview: {
          filter: { telepules: "Székesfehérvár", iranyitoszam: "8000" },
          location: "Székesfehérvár",
        },
      },
    ],
    async (id) =>
      Number(id) === 42
        ? { profile: { accountType: "private", city: "Kecskemét", postalCode: "6000" } }
        : null
  );
  assert.equal(items[0].preview.filter.telepules, "Kecskemét");
  assert.match(items[0].preview.location, /Kecskemét/);
});
