import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  normalizeImportedLeiras,
  findDescriptionInHtml,
  enrichDealerCarsWithDescriptions,
} from "./ha-description-parse.mjs";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures/ha-admin-edit-leiras.html"),
  "utf8"
);
const gyorsFixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures/ha-admin-gyorsnezet-leiras.html"),
  "utf8"
);

test("normalizeImportedLeiras: levágja a Leírás prefixet és a telefonos stubot", () => {
  assert.equal(
    normalizeImportedLeiras("Leírás Ford Mondeo 1.5 dízel 120Le 6 sebességes manuális váltó."),
    "Ford Mondeo 1.5 dízel 120Le 6 sebességes manuális váltó."
  );
  assert.equal(normalizeImportedLeiras("Megtekinthető telefonon egyeztetett időpontban."), "");
});

test("findDescriptionInHtml: textarea + enrich egy autóhoz", () => {
  const desc = findDescriptionInHtml(fixture);
  assert.match(desc, /Ford Mondeo 1\.5 dízel/i);
  const cars = enrichDealerCarsWithDescriptions(
    [{ listingId: "23505596", photoOnly: true }],
    fixture,
    { pageUrl: "https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto?id=23505596" }
  );
  assert.match(cars[0].visibleDescription, /parkolóradar/i);
});

test("findDescriptionInHtml: gyorsnézet h2 + p (Peugeot minta)", () => {
  const desc = findDescriptionInHtml(gyorsFixture);
  assert.match(desc, /Peugeot 308 SW 1\.6 dízel/i);
  assert.match(desc, /Panorámatető/i);
});

test("findDescriptionInHtml: Leírás és szöveg egy sorban", () => {
  const desc = findDescriptionInHtml(
    "<html><body>Leírás Peugeot 308 SW 1.6 dízel 92Le 5 sebességes manuális váltó, Nagyon szép állapot, folyamatosan szervizelt.</body></html>"
  );
  assert.match(desc, /Peugeot 308 SW/i);
});

test("enrichDealerCarsWithDescriptions: listán több autó — leírás nem másolódik mindegyikre", () => {
  const cars = enrichDealerCarsWithDescriptions(
    [
      { listingId: "11111111", photoOnly: true },
      { listingId: "22222222", photoOnly: true },
    ],
    fixture,
    { pageUrl: "https://admin.hasznaltauto.hu/hirdetesek" }
  );
  assert.equal(cars[0].visibleDescription, undefined);
  assert.equal(cars[1].visibleDescription, undefined);
});
