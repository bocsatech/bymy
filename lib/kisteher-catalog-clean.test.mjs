import test from "node:test";
import assert from "node:assert/strict";
import { cleanKisteherCatalog } from "./kisteher-catalog-clean.mjs";

test("cleanKisteherCatalog drops passenger brands/models, keeps vans", () => {
  const raw = {
    gyartmanyok: ["BMW", "BYD", "FORD", "HONDA", "JAGUAR"],
    modellek: {
      BMW: ["3-AS SOROZAT", "X3"],
      BYD: ["ETP3"],
      FORD: ["FIESTA", "TRANSIT", "RANGER"],
      HONDA: ["FR-V"],
      JAGUAR: ["E-PACE"],
    },
    modellekTree: {
      BMW: [
        { name: "3-AS SOROZAT", children: [] },
        { name: "X3", children: [] },
      ],
      BYD: [{ name: "ETP3", children: [] }],
      FORD: [
        { name: "FIESTA", children: [] },
        { name: "TRANSIT", children: [] },
        { name: "RANGER", children: [] },
      ],
      HONDA: [{ name: "FR-V", children: [] }],
      JAGUAR: [{ name: "E-PACE", children: [] }],
    },
  };
  const szemely = {
    gyartmanyok: ["BMW", "FORD", "HONDA", "JAGUAR"],
    modellek: {
      BMW: ["3-AS SOROZAT", "X3"],
      FORD: ["FIESTA"],
      HONDA: ["FR-V"],
      JAGUAR: ["E-PACE"],
    },
    modellekTree: {},
  };
  const cleaned = cleanKisteherCatalog(raw, szemely);
  assert.equal(cleaned.gyartmanyok.includes("BMW"), false);
  assert.equal(cleaned.gyartmanyok.includes("HONDA"), false);
  assert.equal(cleaned.gyartmanyok.includes("JAGUAR"), false);
  assert.equal(cleaned.gyartmanyok.includes("BYD"), true);
  assert.deepEqual(cleaned.modellek.BYD, ["ETP3"]);
  assert.ok(cleaned.modellek.FORD.includes("TRANSIT"));
  assert.ok(cleaned.modellek.FORD.includes("RANGER"));
  assert.equal(cleaned.modellek.FORD.includes("FIESTA"), false);
});
