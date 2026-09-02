import test from "node:test";
import assert from "node:assert/strict";

import {
  INGATLAN_TIPUS_LAYOUTS,
  cellsForSurface,
  defaultIngatlanWheelSchema,
  isIngatlanWheelAdminCategory,
} from "./ingatlan-wheel-schema.mjs";

test("a kereső és feladás a saját felületük mezőit kapják", () => {
  const schema = defaultIngatlanWheelSchema();
  const searchKeys = new Set(cellsForSurface(schema, "search").map((cell) => cell.field_key));
  const postKeys = new Set(cellsForSurface(schema, "post").map((cell) => cell.field_key));

  assert.equal(searchKeys.has("alapterulet_tol"), true);
  assert.equal(searchKeys.has("alapterulet"), false);
  assert.equal(postKeys.has("alapterulet_tol"), false);
  assert.equal(postKeys.has("alapterulet"), true);
  assert.equal(searchKeys.has("emelet_tol"), true);
  assert.equal(postKeys.has("emelet"), true);
});

test("minden ingatlantípus külön admin kerék-sémaként kezelhető", () => {
  for (const type of INGATLAN_TIPUS_LAYOUTS) {
    assert.equal(isIngatlanWheelAdminCategory(type), true, type);
  }
});
