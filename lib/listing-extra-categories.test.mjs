import test from "node:test";
import assert from "node:assert/strict";
import { categorizeListingExtras } from "./listing-extra-categories.mjs";

test("extrák kategóriák: beltér / műszaki / kültér / multi / egyéb", () => {
  const groups = categorizeListingExtras([
    "digitális klíma",
    "tempomat",
    "könnyűfém felni",
    "Apple CarPlay",
    "garanciális",
    "tempomat",
  ]);
  const byTitle = Object.fromEntries(groups.map((g) => [g.title, g.items]));
  assert.deepEqual(byTitle["Beltér"], ["digitális klíma"]);
  assert.deepEqual(byTitle["Műszaki"], ["tempomat"]);
  assert.deepEqual(byTitle["Kültér"], ["könnyűfém felni"]);
  assert.deepEqual(byTitle["Multimédia / Navigáció"], ["Apple CarPlay"]);
  assert.deepEqual(byTitle["Egyéb információ"], ["garanciális"]);
});

test("ismeretlen extra az Egyéb információba kerül", () => {
  const groups = categorizeListingExtras(["egyedi tuningcsomag"]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, "Egyéb információ");
  assert.deepEqual(groups[0].items, ["egyedi tuningcsomag"]);
});
