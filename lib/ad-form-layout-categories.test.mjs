import test from "node:test";
import assert from "node:assert/strict";
import {
  isSearchLayoutCategory,
  layoutKvKey,
  searchPostingBaseCategory,
  catalogForLayoutCategory,
  listLayoutCategories,
} from "./ad-form-layout-categories.mjs";
import { defaultSearchFormLayout } from "./search-form-layout.mjs";

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

test("defaultSearchFormLayout teher: raktér a Több szűrőben", () => {
  const layout = defaultSearchFormLayout(null, "teherauto-search");
  assert.equal(layout.category, "teherauto-search");
  const rakter = layout.cells.find((c) => c.field_key === "rakter_terfogat");
  assert.ok(rakter);
  assert.equal(rakter.hidden, false);
  assert.equal(rakter.step, 2);
});
