import test from "node:test";
import assert from "node:assert/strict";
import { pickFeaturedListings, FEATURED_SLOT_IDS } from "../public/js/home-featured-slots.js";

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

test("pickFeaturedListings: automatikus — legfrissebb képes hirdetések", () => {
  const items = [
    { id: 1, updated_at: "2026-08-01" },
    { id: 2, preview: { imageUrl: "/uploads/listings/2.jpg" }, updated_at: "2026-08-03" },
    { id: 3, fo_kep: "/uploads/listings/3.jpg", updated_at: "2026-08-02" },
  ];

  const picked = pickFeaturedListings(items, []);
  assert.deepEqual(
    picked.map((item) => item.id),
    [2, 3]
  );
});
