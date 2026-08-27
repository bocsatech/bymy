import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureSearchAkkuBoard,
  defaultSearchFormLayout,
  AKKU_SEARCH_LAYOUT_KEYS,
  SEARCH_LAYOUT_STEP_NAMES,
} from "./search-form-layout.mjs";

test("SEARCH_LAYOUT_STEP_NAMES: Akkumulátor Extrák felett", () => {
  assert.equal(SEARCH_LAYOUT_STEP_NAMES[3], "Akkumulátor és hatótáv adatok");
  assert.equal(SEARCH_LAYOUT_STEP_NAMES[4], "Extrák");
});

test("ensureSearchAkkuBoard once: Extrák markers 3→4, does not touch free placement", () => {
  const layout = {
    category: "szemelyauto-search",
    cells: [
      { field_key: "klima", step: 3, hidden: false, col: 1, row: 1, colSpan: 6 },
      { field_key: "km", step: 3, hidden: false, col: 1, row: 2, colSpan: 6 },
      { field_key: "hatotav", step: 2, hidden: false, col: 1, row: 1, colSpan: 6 },
      { field_key: "telepules", step: 5, hidden: false, col: 1, row: 1, colSpan: 6 },
    ],
  };
  ensureSearchAkkuBoard(layout);
  assert.equal(layout.cells.find((c) => c.field_key === "klima")?.step, 4);
  assert.equal(layout.cells.find((c) => c.field_key === "km")?.step, 4);
  // Akku mezőt nem kényszerít / nem rejt el
  const hatotav = layout.cells.find((c) => c.field_key === "hatotav");
  assert.equal(hatotav?.step, 2);
  assert.equal(hatotav?.hidden, false);
});

test("ensureSearchAkkuBoard idempotent: after migrate, admin can keep fields on step 3", () => {
  const layout = {
    category: "szemelyauto-search",
    cells: [
      { field_key: "klima", step: 4, hidden: false, col: 1, row: 1, colSpan: 6 },
      { field_key: "km", step: 3, hidden: false, col: 1, row: 1, colSpan: 4 },
      { field_key: "hatotav", step: 3, hidden: false, col: 1, row: 2, colSpan: 4 },
    ],
  };
  ensureSearchAkkuBoard(layout);
  ensureSearchAkkuBoard(layout);
  assert.equal(layout.cells.find((c) => c.field_key === "klima")?.step, 4);
  assert.equal(layout.cells.find((c) => c.field_key === "km")?.step, 3);
  assert.equal(layout.cells.find((c) => c.field_key === "hatotav")?.step, 3);
  assert.equal(layout.cells.find((c) => c.field_key === "hatotav")?.hidden, false);
});

test("defaultSearchFormLayout puts akku keys on step 3 hidden", () => {
  const layout = defaultSearchFormLayout(null, "szemelyauto-search");
  const akku = layout.cells.filter((c) => AKKU_SEARCH_LAYOUT_KEYS.has(c.field_key));
  assert.ok(akku.length > 0);
  assert.ok(akku.every((c) => c.step === 3 && c.hidden === true));
  const klima = layout.cells.find((c) => c.field_key === "klima");
  assert.equal(klima?.step, 4);
});
