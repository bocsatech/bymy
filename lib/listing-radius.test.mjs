import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCityIndex,
  buildPostalIndex,
  filterListingsInRadius,
  filterListingsRecentInRadius,
  haversineKm,
  isListingWithinHours,
  listingCityName,
  resolveListingCoords,
} from "../public/js/listing-radius.js";

const cityIndex = buildCityIndex([
  { city: "Székesfehérvár", lat: 47.186, lon: 18.413 },
  { city: "Miskolc", lat: 48.103, lon: 20.778 },
  { city: "Debrecen", lat: 47.531, lon: 21.627 },
]);

const postalIndex = buildPostalIndex([
  { postal_code: "8000", city: "Székesfehérvár", lat: 47.2, lon: 18.42 },
  { postal_code: "8001", city: "Székesfehérvár", lat: 47.21, lon: 18.43 },
]);

test("listingCityName: település a filterből", () => {
  assert.equal(
    listingCityName({ preview: { filter: { telepules: "Miskolc" }, location: "Miskolc, Borsod" } }),
    "Miskolc"
  );
});

test("haversineKm: Székesfehérvár – Dabas távolság", () => {
  const km = haversineKm(47.186, 18.413, 47.186, 19.308);
  assert.ok(km > 60 && km < 80);
});

test("filterListingsInRadius: csak a sugáron belüli települések", () => {
  const items = [
    { id: 1, preview: { filter: { telepules: "Székesfehérvár" } } },
    { id: 2, preview: { filter: { telepules: "Debrecen" } } },
  ];
  const filtered = filterListingsInRadius(items, 47.186, 18.413, 30, cityIndex);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 1);
});

test("filterListingsInRadius: nagy sugár több települést is elér", () => {
  const items = [
    { id: 1, preview: { filter: { telepules: "Székesfehérvár" } } },
    { id: 2, preview: { filter: { telepules: "Debrecen" } } },
  ];
  const filtered = filterListingsInRadius(items, 47.186, 18.413, 280, cityIndex);
  assert.equal(filtered.length, 2);
});

test("isListingWithinHours: friss hirdetés az elmúlt 24 órában", () => {
  const recent = {
    updated_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  };
  const old = {
    updated_at: new Date(Date.now() - 48 * 3600000).toISOString(),
  };
  assert.equal(isListingWithinHours(recent, 24), true);
  assert.equal(isListingWithinHours(old, 24), false);
});

test("filterListingsRecentInRadius: sugár + 24 óra együtt", () => {
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 48 * 3600000).toISOString();
  const items = [
    { id: 1, preview: { filter: { telepules: "Székesfehérvár" } }, updated_at: now },
    { id: 2, preview: { filter: { telepules: "Székesfehérvár" } }, updated_at: old },
    { id: 3, preview: { filter: { telepules: "Debrecen" } }, updated_at: now },
  ];
  const filtered = filterListingsRecentInRadius(items, 47.186, 18.413, 30, cityIndex, 24);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 1);
});

test("resolveListingCoords: irsz → település középpont (nem irsz-pin)", () => {
  const a = resolveListingCoords(
    { preview: { filter: { iranyitoszam: "8000" } } },
    cityIndex,
    postalIndex
  );
  const b = resolveListingCoords(
    { preview: { filter: { iranyitoszam: "8001" } } },
    cityIndex,
    postalIndex
  );
  assert.equal(a.city, "Székesfehérvár");
  assert.equal(b.city, "Székesfehérvár");
  assert.equal(a.lat, 47.186);
  assert.equal(b.lat, 47.186);
  assert.equal(a.lon, 18.413);
  assert.equal(b.lon, 18.413);
});

test("resolveListingCoords: településnév elsőbbség az irsz előtt", () => {
  const hit = resolveListingCoords(
    { preview: { filter: { telepules: "Debrecen", iranyitoszam: "8000" } } },
    cityIndex,
    postalIndex
  );
  assert.equal(hit.city, "Debrecen");
  assert.equal(hit.lat, 47.531);
});
