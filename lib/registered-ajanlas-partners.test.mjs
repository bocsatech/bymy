import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCompanyWorkRadiusKm,
  normalizeAjanlasPriority,
} from "./registered-ajanlas-partners.mjs";
import { EMPTY_MESSAGE } from "./partners.mjs";

test("normalizeCompanyWorkRadiusKm: engedélyezett értékek", () => {
  assert.equal(normalizeCompanyWorkRadiusKm(30), 30);
  assert.equal(normalizeCompanyWorkRadiusKm(12), 10);
  assert.equal(normalizeCompanyWorkRadiusKm(null), 30);
  assert.equal(normalizeCompanyWorkRadiusKm(5), 5);
});

test("normalizeAjanlasPriority: 1–5 vagy null", () => {
  assert.equal(normalizeAjanlasPriority(1), 1);
  assert.equal(normalizeAjanlasPriority("3"), 3);
  assert.equal(normalizeAjanlasPriority(""), null);
  assert.equal(normalizeAjanlasPriority(9), null);
});

test("EMPTY_MESSAGE: Partnereket keresünk CTA", () => {
  assert.match(EMPTY_MESSAGE, /Partnereket keresünk/i);
});
