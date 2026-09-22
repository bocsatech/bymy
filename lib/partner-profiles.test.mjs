import test from "node:test";
import assert from "node:assert/strict";
import { slugify, normalizePartnerPhone, normalizePartnerCommission } from "./partner-profiles.mjs";

test("slugify ékezetes partnernévből publikus útvonalat készít", () => {
  assert.equal(slugify("Kovács és Társa Ingatlaniroda"), "kovacs-es-tarsa-ingatlaniroda");
});

test("slugify kiszűri az URL-ben nem használható karaktereket", () => {
  assert.equal(slugify("  Bymy / Partner #1  "), "bymy-partner-1");
});

test("slugify üres névnél stabil alapértéket ad", () => {
  assert.equal(slugify(""), "partner");
});

test("jutalék kötelező és tartalmazzon számot", () => {
  assert.equal(normalizePartnerCommission("bruttó 2–4%"), "bruttó 2–4%");
  assert.throws(() => normalizePartnerCommission(""), /jutalék/i);
  assert.throws(() => normalizePartnerCommission("nincs"), /százalék/i);
});

test("telefonszám kötelező formátum", () => {
  assert.equal(normalizePartnerPhone("+36 30 123 4567"), "+36 30 123 4567");
  assert.throws(() => normalizePartnerPhone("12"), /telefon/i);
});
