import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  parseCsvText,
  buildVehicleCatalog,
  listModelTypes,
  listModelYears,
  catalogSummary,
  shortTypeName,
  syncVehicleCatalogToPublic,
} from "./vehicle-catalog.mjs";

/** A lista.csv fejléce: Gyartmany,Modell,EvTol,EvIg,Tipus */
const SAMPLE = `Gyartmany,Modell,EvTol,EvIg,Tipus
ABARTH,124,2016,2020,"124 Spider 1.4 MultiAir T (Automata) [2 ajtós, 170 LE, 2017.03. – 2019.08.]"
ABARTH,124,2016,2019,"124 Spider 1.4 MultiAir T Scorpione [2 ajtós, 170 LE, 2017.06. – 2018.03.]"
ABARTH,500,2007,2013,"500 1.4 [3 ajtós, 135 LE, 2008.07. – 2012.10.]"
ABARTH,500,2015,2017,"500 Coupe 1.4 TJet 140 [3 ajtós, 140 LE, 2016.04. – 2016.07.]"
AUDI,A4,2015,2019,A4 2.0 TDI
`;

function sampleCatalog() {
  return buildVehicleCatalog(parseCsvText(SAMPLE), "test.csv");
}

test("buildVehicleCatalog: gyártmány, modell, évjáratos típus", () => {
  const catalog = sampleCatalog();
  assert.deepEqual(catalog.gyartmanyok, ["ABARTH", "AUDI"]);
  assert.deepEqual(catalog.modellek.ABARTH, ["124", "500"]);
  assert.equal(catalog.tipusok["ABARTH|124"].length, 2);

  const spider = catalog.tipusok["ABARTH|124"][0];
  assert.equal(spider.evTol, 2016);
  assert.equal(spider.evIg, 2020);
});

test("listModelYears: az EvTol–EvIg tartományok uniója, csökkenő sorrendben", () => {
  const years = listModelYears(sampleCatalog(), "ABARTH", "500");
  assert.equal(years[0], 2017);
  assert.equal(years[years.length - 1], 2007);
  assert.ok(years.includes(2010));
  // 2014 egyik tartományban sincs benne
  assert.ok(!years.includes(2014));
});

test("listModelTypes: csak az adott évben létező típus", () => {
  const catalog = sampleCatalog();

  const y2010 = listModelTypes(catalog, "ABARTH", "500", 2010).map((t) => t.nev);
  assert.equal(y2010.length, 1);
  assert.ok(y2010[0].startsWith("500 1.4"));

  const y2016 = listModelTypes(catalog, "ABARTH", "500", 2016).map((t) => t.nev);
  assert.equal(y2016.length, 1);
  assert.ok(y2016[0].startsWith("500 Coupe"));

  // Év nélkül minden típus
  assert.equal(listModelTypes(catalog, "ABARTH", "500").length, 2);
});

test("listModelTypes: ismeretlen évnél a teljes lista jön (nem akad el a feladás)", () => {
  const catalog = sampleCatalog();
  const types = listModelTypes(catalog, "ABARTH", "500", 1995);
  assert.equal(types.length, 2);
});

test("listModelTypes: ismeretlen márka/modell → üres", () => {
  const catalog = sampleCatalog();
  assert.deepEqual(listModelTypes(catalog, "NINCS", "ILYEN"), []);
  assert.deepEqual(listModelYears(catalog, "NINCS", "ILYEN"), []);
});

test("évjárat nélküli régi mentés is működik", () => {
  const catalog = {
    gyartmanyok: ["AUDI"],
    modellek: { AUDI: ["A4"] },
    tipusok: { "AUDI|A4": ["A4 2.0 TDI"] },
  };
  assert.deepEqual(listModelTypes(catalog, "AUDI", "A4", 2015), [
    { nev: "A4 2.0 TDI", evTol: null, evIg: null },
  ]);
});

test("catalogSummary: típusok nélkül, hogy kicsi maradjon", () => {
  const summary = catalogSummary(sampleCatalog());
  assert.deepEqual(summary.gyartmanyok, ["ABARTH", "AUDI"]);
  assert.ok(summary.modellek.ABARTH);
  assert.equal(summary.tipusok, undefined);
});

test("syncVehicleCatalogToPublic: a böngésző fallback fájlt írja", () => {
  const dir = mkdtempSync(join(tmpdir(), "autosweb-catalog-pub-"));
  const out = join(dir, "vehicle-catalog.json");
  const catalog = sampleCatalog();
  const written = syncVehicleCatalogToPublic(catalog, out);
  assert.equal(written, out);
  const loaded = JSON.parse(readFileSync(out, "utf8"));
  assert.deepEqual(loaded.gyartmanyok, ["ABARTH", "AUDI"]);
  assert.ok(loaded.tipusok["ABARTH|500"].length >= 1);
  rmSync(dir, { recursive: true, force: true });
});

test("shortTypeName: a szögletes zárójeles rész lekerül", () => {
  assert.equal(
    shortTypeName("500 Coupe 1.4 TJet 140 [3 ajtós, 140 LE, 2016.04. – 2016.07.]"),
    "500 Coupe 1.4 TJet 140"
  );
  assert.equal(shortTypeName("A4 2.0 TDI"), "A4 2.0 TDI");
});

test("parseCsvText: pontosvesszővel és ékezetes fejléccel is", () => {
  const rows = parseCsvText("Gyártmány;Modell;ÉvTól;ÉvIg;Típus\nFord;Kuga;2012;2019;1.5 EcoBoost\n");
  assert.equal(rows[0].gyartmany, "Ford");
  assert.equal(rows[0].modell, "Kuga");
  assert.equal(rows[0].evtol, "2012");
  assert.equal(rows[0].evig, "2019");
  assert.equal(rows[0].tipus, "1.5 EcoBoost");
});
