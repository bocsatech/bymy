import test from "node:test";
import assert from "node:assert/strict";
import {
  isSearchLayoutCategory,
  isDeskPostingLayoutAlias,
  deskPostingLayoutSourceCategory,
  vehiclePostingPreviewPath,
  layoutKvKey,
  searchPostingBaseCategory,
  catalogForLayoutCategory,
  listLayoutCategories,
} from "./ad-form-layout-categories.mjs";
import { applySearchLayoutDefaults, defaultSearchFormLayout } from "./search-form-layout.mjs";

test("teherauto-search szerepel a layout kategóriákban", () => {
  const ids = listLayoutCategories().map((c) => c.id);
  assert.ok(ids.includes("teherauto-search"));
  assert.ok(ids.includes("szemelyauto-search"));
});

test("isSearchLayoutCategory: autó és teher kereső", () => {
  assert.equal(isSearchLayoutCategory("szemelyauto-search"), true);
  assert.equal(isSearchLayoutCategory("teherauto-search"), true);
  assert.equal(isSearchLayoutCategory("teherauto"), false);
});

test("layoutKvKey és posting base teher keresőhöz", () => {
  assert.equal(layoutKvKey("teherauto-search"), "ad_search_layout_teherauto");
  assert.equal(searchPostingBaseCategory("teherauto-search"), "kisteher");
  assert.equal(searchPostingBaseCategory("szemelyauto-search"), "szemelyauto");
});

test("teherauto-search katalógus tartalmaz raktér mezőt", () => {
  const keys = catalogForLayoutCategory("teherauto-search").map((f) => f.field_key);
  assert.ok(keys.includes("rakter_terfogat"));
  assert.ok(keys.includes("gyartmany"));
});

test("desk posting alias → szemelyauto master", () => {
  assert.equal(isDeskPostingLayoutAlias("leasing"), true);
  assert.equal(isDeskPostingLayoutAlias("szemelyauto"), false);
  assert.equal(deskPostingLayoutSourceCategory("berauto"), "szemelyauto");
  assert.equal(deskPostingLayoutSourceCategory("szemelyauto"), "szemelyauto");
  assert.match(vehiclePostingPreviewPath("leasing"), /subtype=leasing/);
});

test("defaultSearchFormLayout teher: raktér a Több szűrőben", () => {
  const layout = defaultSearchFormLayout(null, "teherauto-search");
  assert.equal(layout.category, "teherauto-search");
  const rakter = layout.cells.find((c) => c.field_key === "rakter_terfogat");
  assert.ok(rakter);
  assert.equal(rakter.hidden, false);
  assert.equal(rakter.step, 2);
});

test("teherauto-search: autó Tipus/Csomagtartó soha nem látszik", () => {
  const layout = defaultSearchFormLayout(null, "teherauto-search");
  for (const key of ["tipus", "csomagtarto", "tetto", "karpit1"]) {
    const cell = layout.cells.find((c) => c.field_key === key);
    if (cell) assert.equal(cell.hidden, true, key);
  }
  const live = applySearchLayoutDefaults({
    category: "teherauto-search",
    version: 2,
    live: true,
    cells: [
      { field_key: "tipus", hidden: false, step: 1 },
      { field_key: "csomagtarto", hidden: false, step: 2 },
      { field_key: "rakter_terfogat", hidden: false, step: 2 },
    ],
  });
  assert.equal(live.cells.find((c) => c.field_key === "tipus")?.hidden, true);
  assert.equal(live.cells.find((c) => c.field_key === "csomagtarto")?.hidden, true);
  assert.equal(live.cells.find((c) => c.field_key === "rakter_terfogat")?.hidden, false);
});
