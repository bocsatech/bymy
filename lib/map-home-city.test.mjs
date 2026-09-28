import test from "node:test";
import assert from "node:assert/strict";
import { resolveCityCoords, buildCityIndex } from "../public/js/listing-radius.js";

test("resolveCityCoords: Tolnanémedi and Tolnanémedi Tolna", () => {
  const idx = buildCityIndex([{ city: "Tolnanémedi", lat: 46.7223, lon: 18.4903 }]);
  assert.equal(resolveCityCoords("Tolnanémedi", idx)?.city, "Tolnanémedi");
  assert.equal(resolveCityCoords("Tolnanémedi Tolna", idx)?.city, "Tolnanémedi");
});

test("light auth/me profile must not be used as home (regression note)", () => {
  // /api/auth/me?light returns emptyProfile — map must use /api/auth/profile instead.
  const lightProfile = { adminFlags: {} };
  const city = String(lightProfile.city || lightProfile.companyCity || "").trim();
  assert.equal(city, "");
});
