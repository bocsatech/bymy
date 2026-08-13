import test from "node:test";
import assert from "node:assert/strict";
import {
  shortTypeName,
  typeNameForField,
  typesForYear,
} from "../public/js/vehicle-catalog-client.js";

test("shortTypeName: a szögletes zárójeles adatok lekerülnek", () => {
  assert.equal(
    shortTypeName("500 Coupe 1.4 TJet 140 [3 ajtós, 140 LE, 2016.04. – 2016.07.]"),
    "500 Coupe 1.4 TJet 140"
  );
  assert.equal(shortTypeName("A4 2.0 TDI"), "A4 2.0 TDI");
  assert.equal(shortTypeName(""), "");
});

test("typeNameForField: a modellnév nem ismétlődik a Típus mezőben", () => {
  assert.equal(
    typeNameForField("500 Coupe 1.4 TJet 140 [3 ajtós, 140 LE, 2016.04. – 2016.07.]", "500"),
    "Coupe 1.4 TJet 140"
  );
  assert.equal(
    typeNameForField("Grand Voyager 2.8 CRD Touring Executive (Automata) [5 ajtós]", "GRAND"),
    "Voyager 2.8 CRD Touring Executive (Automata)"
  );
  assert.equal(typeNameForField("A4 2.0 TDI", "A4"), "2.0 TDI");
});

test("typeNameForField: más kezdetű típus változatlan", () => {
  assert.equal(typeNameForField("1.6 TDI", "GOLF"), "1.6 TDI");
  assert.equal(typeNameForField("A4 2.0 TDI", ""), "A4 2.0 TDI");
});

test("typeNameForField: a csupa modellnév típus megmarad", () => {
  assert.equal(typeNameForField("500", "500"), "500");
});

const TYPES = [
  { nev: "500 1.4", evTol: 2007, evIg: 2013 },
  { nev: "500 Coupe 1.4 TJet 140", evTol: 2015, evIg: 2017 },
  { nev: "Év nélküli", evTol: null, evIg: null },
];

test("typesForYear: évre szűkít, az év nélküli mindig marad", () => {
  const y2010 = typesForYear(TYPES, 2010).map((t) => t.nev);
  assert.deepEqual(y2010, ["500 1.4", "Év nélküli"]);

  const y2016 = typesForYear(TYPES, 2016).map((t) => t.nev);
  assert.deepEqual(y2016, ["500 Coupe 1.4 TJet 140", "Év nélküli"]);
});

test("typesForYear: év nélkül minden típus", () => {
  assert.equal(typesForYear(TYPES, "").length, 3);
  assert.equal(typesForYear(TYPES, null).length, 3);
});
