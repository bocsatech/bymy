import test from "node:test";
import assert from "node:assert/strict";
import { buildListingFeedRow } from "./listing-feed.mjs";

test("buildListingFeedRow: payload id + vertical + slim form", () => {
  const row = buildListingFeedRow({
    id: 42,
    status: "feladott",
    updated_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    hirdetes_cime: "Eladó BMW",
    fo_kep: "https://example.com/a.jpg",
    preview: {
      title: "BMW",
      imageUrls: ["a.jpg", "b.jpg"],
      leiras: "ok",
      filter: { hirdetes_vertical: "auto" },
    },
    form: {
      hirdetes_vertical: "auto",
      gyartmany: "BMW",
      telefon: "titok",
      felszereltseg: ["ABS"],
      leiras: "szöveg",
    },
  });
  assert.equal(row.listing_id, 42);
  assert.equal(row.status, "feladott");
  assert.equal(row.vertical, "auto");
  assert.equal(row.payload.id, 42);
  assert.equal(row.payload.form.telefon, undefined);
  assert.equal(row.payload.form.gyartmany, "BMW");
  assert.deepEqual(row.payload.preview.imageUrls, ["a.jpg"]);
});
