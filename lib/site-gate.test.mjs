import test from "node:test";
import assert from "node:assert/strict";
import { isPublicApiPath } from "./site-gate.mjs";

test("HA import API tokenes POST nem tagok-kapu", () => {
  assert.equal(isPublicApiPath("/api/import/extracted", "POST"), true);
  assert.equal(isPublicApiPath("/api/import/extracted", "OPTIONS"), true);
  assert.equal(isPublicApiPath("/api/import/ha-bridge", "POST"), true);
  assert.equal(isPublicApiPath("/api/import/extracted", "GET"), false);
  assert.equal(isPublicApiPath("/api/listings", "GET"), false);
});

test("értékbecslés GET nyilvános", () => {
  assert.equal(isPublicApiPath("/api/valuation/estimate", "GET"), true);
  assert.equal(isPublicApiPath("/api/valuation/options", "GET"), true);
  assert.equal(isPublicApiPath("/api/valuation/estimate", "POST"), false);
});
