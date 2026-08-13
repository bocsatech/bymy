import test from "node:test";
import assert from "node:assert/strict";
import {
  enrichFormFromImportItem,
  formDataToDisplayCells,
  displayCellsToFormData,
  groupCellsByStep,
} from "./import-cells.mjs";

test("enrichFormFromImportItem: km és forrás URL", () => {
  const data = enrichFormFromImportItem({ gyartmany: "FORD" }, {
    km: "45 000 km",
    url: "https://www.hasznaltauto.hu/test/12345678",
    id: "12345678",
  });
  assert.equal(data.km, "45000");
  assert.equal(data.forras_url, "https://www.hasznaltauto.hu/test/12345678");
  assert.equal(data.hasznaltauto_hirdetes_id, "12345678");
});

test("formDataToDisplayCells: csak kitöltött mezők", () => {
  const cells = formDataToDisplayCells({
    gyartmany: "FORD",
    km: "12000",
    felszereltseg: ["tempomat", "klíma"],
  });
  assert.ok(cells.some((c) => c.label === "Km. óra állás" && c.value === "12000"));
  assert.ok(cells.some((c) => c.label === "tempomat"));
  assert.equal(cells.some((c) => c.label.includes("Segítség")), false);
});

test("displayCellsToFormData: körút", () => {
  const cells = formDataToDisplayCells({ modell: "KUGA", felszereltseg: ["ABS"] });
  const data = displayCellsToFormData(cells);
  assert.equal(data.modell, "KUGA");
  assert.deepEqual(data.felszereltseg, ["ABS"]);
});

test("groupCellsByStep: lépés csoportok", () => {
  const cells = formDataToDisplayCells({
    gyartmany: "FORD",
    hengerurtartalom: "1598",
    vetelar: "2500000",
  });
  const groups = groupCellsByStep(cells);
  assert.ok(groups.some(([step]) => step === 1));
  assert.ok(groups.some(([step]) => step === 2));
  assert.ok(groups.some(([step]) => step === 5));
});
