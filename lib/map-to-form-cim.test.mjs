import test from "node:test";
import assert from "node:assert/strict";
import { buildHirdetesCime, parseTitleParts, mapListingToForm } from "./map-to-form.mjs";

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

test("parseTitleParts: Volvo 2 sor — 2. sor a típus végére", () => {
  const parts = parseTitleParts(
    "VOLVO V90 2.0 [T6] Recharge Inscription AWD Geartronic\nFULL LED/BŐR/NAVI-/KAMERA/ÜLÉS-KORMÁNYFŰTÉS/18 ALU/PLUG-IN HYBRID!"
  );
  assert.equal(parts.gyartmany, "VOLVO");
  assert.equal(parts.modell, "V90");
  assert.match(parts.rest, /^2\.0 \[T6\] Recharge Inscription AWD Geartronic/);
  assert.match(parts.rest, /FULL LED\/BŐR/);
});

test("parseTitleParts: Transporter T4 — modell katalógusból, T4 a típusban", () => {
  const parts = parseTitleParts(
    "VOLKSWAGEN TRANSPORTER T4 1.9 Basic Mixto első tulaj 97000 km Magyarországon vásárolt"
  );
  assert.equal(parts.gyartmany, "VOLKSWAGEN");
  assert.equal(parts.modell, "TRANSPORTER");
  assert.match(parts.rest, /^T4 1\.9 Basic Mixto/);
});

test("parseTitleParts: Transporter T6", () => {
  const parts = parseTitleParts(
    "VOLKSWAGEN TRANSPORTER T6 2.0 TDI BMT 4Motion DSG RT 3 személyes összkerékhajtás L1 H1 több darab"
  );
  assert.equal(parts.gyartmany, "VOLKSWAGEN");
  assert.equal(parts.modell, "TRANSPORTER");
  assert.match(parts.rest, /^T6 2\.0 TDI/);
});

test("mapListingToForm: cím 2. sor típusba, leírás külön", () => {
  const form = mapListingToForm({
    cim: "VOLVO V90 2.0 [T6] Recharge Inscription AWD Geartronic\nFULL LED/BŐR/NAVI-/KAMERA!",
    leiras: "FACELIFT! PLUG-IN HYBRID! 4x4 MÁRKASZERVIZBEN RENDSZERESEN SZERVIZELT.",
    ar: "12990000 Ft",
    evjarat: "2021",
    km: "144000 km",
    nyersAdatok: {
      Üzemanyag: "Hibrid (Benzin)",
      Hajtás: "Összkerék",
      Sebességváltó: "Automata",
    },
  });
  assert.equal(form.gyartmany, "VOLVO");
  assert.equal(form.modell, "V90");
  assert.match(form.tipus, /2\.0 \[T6\]/);
  assert.match(form.tipus, /FULL LED/);
  assert.match(form.leiras, /FACELIFT/);
  assert.doesNotMatch(form.leiras, /FULL LED/);
});
