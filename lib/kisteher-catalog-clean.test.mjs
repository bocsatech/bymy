import test from "node:test";
import assert from "node:assert/strict";
import { cleanKisteherCatalog } from "./kisteher-catalog-clean.mjs";

test("cleanKisteherCatalog keeps only commercial models/brands", () => {
  const raw = {
    gyartmanyok: ["BMW", "BYD", "FORD", "HONDA", "JAGUAR", "DODGE", "AIXAM"],
    modellek: {},
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
      DODGE: [{ name: "EGYÉB", children: [] }],
      AIXAM: [{ name: "EGYÉB", children: [] }],
    },
  };
  const cleaned = cleanKisteherCatalog(raw, null);
  assert.equal(cleaned.gyartmanyok.includes("BMW"), false);
  assert.equal(cleaned.gyartmanyok.includes("HONDA"), false);
  assert.equal(cleaned.gyartmanyok.includes("JAGUAR"), false);
  assert.equal(cleaned.gyartmanyok.includes("DODGE"), false);
  assert.equal(cleaned.gyartmanyok.includes("AIXAM"), false);
  assert.equal(cleaned.gyartmanyok.includes("BYD"), true);
  assert.ok(cleaned.gyartmanyok.includes("FORD"));
  assert.deepEqual(cleaned.modellek.BYD, ["ETP3"]);
  assert.ok(cleaned.modellek.FORD.includes("TRANSIT"));
  assert.ok(cleaned.modellek.FORD.includes("RANGER"));
  assert.equal(cleaned.modellek.FORD.includes("FIESTA"), false);
});
