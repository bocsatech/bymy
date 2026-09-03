import test from "node:test";
import assert from "node:assert/strict";

import {
  INGATLAN_TIPUS_LAYOUTS,
  cellsForSurface,
  defaultIngatlanWheelSchema,
  isIngatlanWheelAdminCategory,
  normalizeIngatlanWheelSchema,
  resolveIngatlanWheelSectionRows,
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
  assert.equal(searchKeys.has("telekterulet_tol"), true);
  assert.equal(postKeys.has("telekterulet"), true);
  assert.equal(searchKeys.has("szintek_tol"), true);
  assert.equal(postKeys.has("szintek"), true);
  assert.equal(postKeys.has("uzemeltetesi_dij"), true);
  assert.equal(postKeys.has("epitmeny_terulet"), true);
});

test("minden ingatlantípus külön admin kerék-sémaként kezelhető", () => {
  for (const type of INGATLAN_TIPUS_LAYOUTS) {
    assert.equal(isIngatlanWheelAdminCategory(type), true, type);
  }
});

test("normalize feloldja az azonos rácssor-ütközéseket", () => {
  const schema = normalizeIngatlanWheelSchema({
    version: 1,
    cells: [
      { field_key: "keresesi_hely", section: "main", row: 1, col: 1, colSpan: 12, hidden: false },
      { field_key: "butorozott", section: "main", row: 2, col: 1, colSpan: 3, hidden: false },
      {
        type: "spacer",
        field_key: "__spacer_test",
        section: "main",
        row: 2,
        col: 1,
        colSpan: 12,
        hidden: false,
      },
      { field_key: "allapot", section: "main", row: 3, col: 1, colSpan: 12, hidden: false },
    ],
  });
  const butor = schema.cells.find((c) => c.field_key === "butorozott");
  const spacer = schema.cells.find((c) => c.field_key === "__spacer_test");
  const hely = schema.cells.find((c) => c.field_key === "keresesi_hely");
  const allapot = schema.cells.find((c) => c.field_key === "allapot");
  assert.notEqual(butor.row, spacer.row, "ütköző sorok szétválasztva");
  assert.ok(butor.row < spacer.row, "relatív sorrend megmarad");
  assert.ok(spacer.row < allapot.row, "állapot a spacer alatt");
});
