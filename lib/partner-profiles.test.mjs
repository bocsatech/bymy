import test from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./partner-profiles.mjs";

test("slugify ékezetes partnernévből publikus útvonalat készít", () => {
  assert.equal(slugify("Kovács és Társa Ingatlaniroda"), "kovacs-es-tarsa-ingatlaniroda");
});

test("slugify kiszűri az URL-ben nem használható karaktereket", () => {
  assert.equal(slugify("  Bymy / Partner #1  "), "bymy-partner-1");
});

test("slugify üres névnél stabil alapértéket ad", () => {
  assert.equal(slugify(""), "partner");
});
