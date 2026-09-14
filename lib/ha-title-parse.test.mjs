import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  parseVehicleTitleFields,
  findListingTitleInHtml,
  enrichDealerCarsWithTitles,
} from "./ha-title-parse.mjs";
import { extractDealerCarsFromHtml } from "./ha-dealer-cdn-extract.mjs";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures/ha-admin-vehicle-list.html"),
  "utf8"
);

test("parseVehicleTitleFields: MERCEDES gold minta", () => {
  const f = parseVehicleTitleFields("MERCEDES-BENZ E 250 CDI 4Matic Classic (Automata)");
  assert.equal(f.gyartmany, "MERCEDES-BENZ");
  assert.equal(f.modell, "E");
  assert.equal(f.tipus, "250 CDI 4Matic Classic (Automata)");
});

test("parseVehicleTitleFields: Kia Ceed", () => {
  const f = parseVehicleTitleFields("Kia Ceed 1.6 CRDI Hybrid 48V");
  assert.equal(f.gyartmany, "KIA");
  assert.equal(f.modell, "Ceed");
  assert.equal(f.tipus, "1.6 CRDI Hybrid 48V");
});

test("findListingTitleInHtml + enrich from fixture", () => {
  assert.match(findListingTitleInHtml(fixture, "23505596"), /Mercedes-Benz E 250/i);
  const cars = enrichDealerCarsWithTitles(extractDealerCarsFromHtml(fixture), fixture);
  const mb = cars.find((c) => c.listingId === "23505596");
  assert.equal(mb.gyartmany, "MERCEDES-BENZ");
  assert.equal(mb.modell, "E");
  assert.match(mb.tipus, /250 CDI/i);
});
