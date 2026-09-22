import test from "node:test";
import assert from "node:assert/strict";
import {
  pickFeaturedListings,
  FEATURED_SLOT_IDS,
  featuredListingIdSet,
} from "../public/js/home-featured-slots.js";

test("pickFeaturedListings: konfigurált ID-k sorrendben, max 4", () => {
  const items = [
    { id: 1, fo_kep: "/uploads/listings/1.jpg", updated_at: "2026-08-01" },
    { id: 2, fo_kep: "/uploads/listings/2.jpg", updated_at: "2026-08-02" },
    { id: 3, fo_kep: "/uploads/listings/3.jpg", updated_at: "2026-08-03" },
    { id: 4, fo_kep: "/uploads/listings/4.jpg", updated_at: "2026-08-04" },
    { id: 5, fo_kep: "/uploads/listings/5.jpg", updated_at: "2026-08-05" },
  ];

  const picked = pickFeaturedListings(items, [5, 2, 99]);
  assert.deepEqual(
    picked.map((item) => item.id),
    [5, 2]
  );
  assert.equal(FEATURED_SLOT_IDS.length, 4);
});

test("featuredListingIdSet: promo_kiemelt hirdetések is benne vannak", () => {
  const items = [
    { id: 10, fo_kep: "/a.jpg", form: { promo_kiemelt: "1" } },
    { id: 11, fo_kep: "/b.jpg", form: {} },
  ];
  const set = featuredListingIdSet(items, []);
  assert.equal(set.has(10), true);
  assert.equal(set.has(11), false);
});

test("pickFeaturedListings: üres config — csak promo_kiemelt, nincs auto legújabb", () => {
  const items = [
    { id: 1, updated_at: "2026-08-01" },
    { id: 2, preview: { imageUrl: "/uploads/listings/2.jpg" }, updated_at: "2026-08-03", form: {} },
    {
      id: 3,
      fo_kep: "/uploads/listings/3.jpg",
      updated_at: "2026-08-02",
      form: { promo_kiemelt: "1" },
    },
  ];

  const picked = pickFeaturedListings(items, []);
  assert.deepEqual(
    picked.map((item) => item.id),
    [3]
  );
});

test("pickFeaturedListings: üres config, nincs promo — üres lista", () => {
  const items = [
    { id: 2, preview: { imageUrl: "/uploads/listings/2.jpg" }, updated_at: "2026-08-03" },
    { id: 3, fo_kep: "/uploads/listings/3.jpg", updated_at: "2026-08-02" },
  ];
  assert.deepEqual(pickFeaturedListings(items, []), []);
});
