import test from "node:test";
import assert from "node:assert/strict";
import { buildHirdetesCime } from "./map-to-form.mjs";

test("buildHirdetesCime: hasznaltauto h1 formátum változatlan", () => {
  const title = buildHirdetesCime(
    { cim: "Eladó VOLKSWAGEN GOLF Kombi (2018)" },
    { gyartmany: "VOLKSWAGEN", modell: "GOLF", gyartasi_ev: "2018" }
  );
  assert.equal(title, "Eladó VOLKSWAGEN GOLF Kombi (2018)");
});

test("buildHirdetesCime: lista cím + év/hónap", () => {
  const title = buildHirdetesCime(
    { cim: "FORD KUGA 2.5 PHEV ST-Line CVT", evjarat: "2023/7" },
    { gyartmany: "FORD", modell: "KUGA", gyartasi_ev: "2023", gyartasi_honap: "7" }
  );
  assert.equal(title, "Eladó FORD KUGA 2.5 PHEV ST-Line CVT (2023/7)");
});

test("buildHirdetesCime: összerakás gyártmány/modell/típus alapján", () => {
  const title = buildHirdetesCime(
    { cim: "" },
    { gyartmany: "TOYOTA", modell: "COROLLA", tipus: "1.8 Hybrid", gyartasi_ev: "2020" }
  );
  assert.equal(title, "Eladó TOYOTA COROLLA 1.8 Hybrid (2020)");
});
