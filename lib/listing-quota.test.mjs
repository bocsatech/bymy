import test from "node:test";
import assert from "node:assert/strict";
import {
  PRIVATE_LISTING_LIMIT,
  BUSINESS_LISTING_LIMIT,
  assertCanCreateListing,
  isBusinessAccount,
  lockedVerticalFromListings,
  remainingListingSlots,
} from "./listing-quota.mjs";

test("magán: max 2 hirdetés összesen", () => {
  const user = { id: 1, profile: { accountType: "private" } };
  const existing = [
    { form: { hirdetes_vertical: "auto" } },
    { form: { hirdetes_vertical: "ingatlan" } },
  ];
  const blocked = assertCanCreateListing({
    user,
    formData: { hirdetes_vertical: "teher" },
    existingListings: existing,
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "LISTING_LIMIT");
  assert.match(blocked.error, /2/);
});

test("magán: 1 meglévő után még mehet másik kategóriába", () => {
  const user = { id: 1, profile: { accountType: "private" } };
  const ok = assertCanCreateListing({
    user,
    formData: { hirdetes_vertical: "ingatlan" },
    existingListings: [{ form: { hirdetes_vertical: "auto" } }],
  });
  assert.equal(ok.ok, true);
  assert.equal(remainingListingSlots({ user, existingListings: [{ id: 1 }] }), 1);
});

test("kereskedő: max 50, csak egy vertical", () => {
  const user = { id: 2, profile: { accountType: "business" } };
  assert.equal(isBusinessAccount(user), true);
  const existing = [{ form: { hirdetes_vertical: "auto" } }];
  const wrong = assertCanCreateListing({
    user,
    formData: { hirdetes_vertical: "ingatlan" },
    existingListings: existing,
  });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.code, "VERTICAL_LOCKED");

  const ok = assertCanCreateListing({
    user,
    formData: { hirdetes_vertical: "auto" },
    existingListings: existing,
  });
  assert.equal(ok.ok, true);

  const many = Array.from({ length: BUSINESS_LISTING_LIMIT }, () => ({
    form: { hirdetes_vertical: "auto" },
  }));
  const full = assertCanCreateListing({
    user,
    formData: { hirdetes_vertical: "auto" },
    existingListings: many,
  });
  assert.equal(full.ok, false);
  assert.equal(full.code, "LISTING_LIMIT");
});

test("dealer legacy accountType businessnek számít", () => {
  assert.equal(isBusinessAccount({ profile: { accountType: "dealer" } }), true);
  assert.equal(PRIVATE_LISTING_LIMIT, 2);
  assert.equal(
    lockedVerticalFromListings([{ form: { hirdetes_vertical: "teher", hirdetes_alkategoria: "kisteher" } }]),
    "teher"
  );
});

test("vendég nem adhat fel", () => {
  const r = assertCanCreateListing({ user: null, formData: { hirdetes_vertical: "auto" } });
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
});
