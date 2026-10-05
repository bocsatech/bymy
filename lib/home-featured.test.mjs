import test from "node:test";
import assert from "node:assert/strict";
import {
  pickFeaturedListings,
  featuredListingIdSet,
} from "../public/js/home-featured-slots.js";

test("pickFeaturedListings: összes promo_kiemelt, nincs max-4", () => {
  const items = [
    { id: 1, fo_kep: "/uploads/listings/1.jpg", form: { promo_kiemelt: "1" } },
    { id: 2, fo_kep: "/uploads/listings/2.jpg", form: { promo_kiemelt: "1" } },
    { id: 3, fo_kep: "/uploads/listings/3.jpg", form: { promo_kiemelt: "1" } },
    { id: 4, fo_kep: "/uploads/listings/4.jpg", form: { promo_kiemelt: "1" } },
    { id: 5, fo_kep: "/uploads/listings/5.jpg", form: { promo_kiemelt: "1" } },
    { id: 6, fo_kep: "/uploads/listings/6.jpg", form: {} },
  ];

  const picked = pickFeaturedListings(items);
  assert.deepEqual(
    picked.map((item) => item.id),
    [1, 2, 3, 4, 5]
  );
});

test("pickFeaturedListings: limit opció (hub sín)", () => {
  const items = [
    { id: 1, fo_kep: "/a.jpg", form: { promo_kiemelt: "1" } },
    { id: 2, fo_kep: "/b.jpg", form: { promo_kiemelt: "1" } },
    { id: 3, fo_kep: "/c.jpg", form: { promo_kiemelt: "1" } },
  ];
  assert.deepEqual(
    pickFeaturedListings(items, { limit: 2 }).map((item) => item.id),
    [1, 2]
  );
});

test("featuredListingIdSet: promo_kiemelt hirdetések is benne vannak", () => {
  const items = [
    { id: 10, fo_kep: "/a.jpg", form: { promo_kiemelt: "1" } },
    { id: 11, fo_kep: "/b.jpg", form: {} },
  ];
  const set = featuredListingIdSet(items);
  assert.equal(set.has(10), true);
  assert.equal(set.has(11), false);
});

test("pickFeaturedListings: preview.promo.kiemelt is számít", () => {
  const items = [
    { id: 1, updated_at: "2026-08-01" },
    { id: 2, preview: { imageUrl: "/uploads/listings/2.jpg" }, form: {} },
    {
      id: 3,
      fo_kep: "/uploads/listings/3.jpg",
      preview: { promo: { kiemelt: true } },
    },
  ];

  const picked = pickFeaturedListings(items);
  assert.deepEqual(
    picked.map((item) => item.id),
    [3]
  );
});

test("pickFeaturedListings: nincs promo — üres lista", () => {
  const items = [
    { id: 2, preview: { imageUrl: "/uploads/listings/2.jpg" }, updated_at: "2026-08-03" },
    { id: 3, fo_kep: "/uploads/listings/3.jpg", updated_at: "2026-08-02" },
  ];
  assert.deepEqual(pickFeaturedListings(items), []);
});
